<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useGraphStore } from '@/stores/graph'
import { Grid } from '@/lib/Grid'
import { Renderer } from '@/lib/Renderer'
import { COLORMAPS } from '@/lib/colormap'
import NodeTooltip from './NodeTooltip.vue'

const props = defineProps<{
  showYearAxis?: boolean
}>()

const store = useGraphStore()
const canvasContainer = ref<HTMLDivElement | null>(null)

let renderer: Renderer | null = null
let grid: Grid | null = null
let resizeObserver: ResizeObserver | null = null
let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null
let baseScale = 1

// Viewport limits
const MIN_SCALE_FACTOR = 0.75
const MAX_SCALE_FACTOR = 10

// Tap detection state
let pointerDownTime = 0
let pointerDownX = 0
let pointerDownY = 0
const TAP_THRESHOLD = 10 // max movement for a tap
const TAP_TIMEOUT = 300 // max time for a tap (ms)

// Vim-style navigation state (remembers preferred column like vim)
let preferredGridX: number | null = null

// Tooltip state
const tooltipX = ref(0)
const tooltipY = ref(0)
const hoveredNode = computed(() => {
  if (!store.hoveredNodeId) return null
  return store.nodes.get(store.hoveredNodeId) ?? null
})

// --- Keyboard Navigation ---

function onKeyDown(e: KeyboardEvent) {
  // Don't intercept if user is typing in an input
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  const key = e.key.toLowerCase()

  // Zoom controls (work anytime)
  if (key === 'i') {
    e.preventDefault()
    zoomIn()
    return
  } else if (key === 'o') {
    e.preventDefault()
    zoomOut()
    return
  }

  // Navigation requires a selected node
  if (!grid || !store.selectedNodes.length) return

  const isNavKey = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'h', 'j', 'k', 'l'].includes(
    key,
  )
  if (!isNavKey) return

  e.preventDefault()

  const currentNode = store.selectedNodes[0]
  if (!currentNode) return

  let targetNode: typeof currentNode | null = null

  if (key === 'arrowup' || key === 'k') {
    targetNode = findNodeInRow(currentNode.gridY - 1)
  } else if (key === 'arrowdown' || key === 'j') {
    targetNode = findNodeInRow(currentNode.gridY + 1)
  } else if (key === 'arrowleft' || key === 'h') {
    targetNode = findNodeInColumn(currentNode.gridY, currentNode.gridX - 1)
    if (targetNode) preferredGridX = targetNode.gridX
  } else if (key === 'arrowright' || key === 'l') {
    targetNode = findNodeInColumn(currentNode.gridY, currentNode.gridX + 1)
    if (targetNode) preferredGridX = targetNode.gridX
  }

  if (targetNode) {
    store.selectNode(targetNode.id)
    // Pan to keep the node visible (maintain current zoom level)
    const currentScale = renderer?.getViewport().scale ?? baseScale
    zoomToNode(targetNode.id, currentScale)
  }
}

function findNodeInRow(targetRow: number): (typeof store.selectedNodes)[0] | null {
  if (!grid) return null

  const nodesInRow = [...grid.nodes.values()].filter((n) => n.gridY === targetRow)
  if (nodesInRow.length === 0) return null

  // Use preferredGridX to find closest node
  const targetX = preferredGridX ?? store.selectedNodes[0]?.gridX ?? 0

  return nodesInRow.reduce((closest, node) => {
    const closestDist = Math.abs(closest.gridX - targetX)
    const nodeDist = Math.abs(node.gridX - targetX)
    return nodeDist < closestDist ? node : closest
  })
}

function findNodeInColumn(row: number, targetX: number): (typeof store.selectedNodes)[0] | null {
  if (!grid) return null

  const nodesInRow = [...grid.nodes.values()].filter((n) => n.gridY === row)
  return nodesInRow.find((n) => n.gridX === targetX) ?? null
}

// --- Event Handlers ---

function onPointerDown(e: PointerEvent) {
  pointerDownTime = performance.now()
  pointerDownX = e.clientX
  pointerDownY = e.clientY
}

function onPointerUp(e: PointerEvent) {
  if (!renderer || !grid) return

  const elapsed = performance.now() - pointerDownTime
  const dx = e.clientX - pointerDownX
  const dy = e.clientY - pointerDownY
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Check if this was a tap (short time, small movement)
  if (elapsed < TAP_TIMEOUT && distance < TAP_THRESHOLD) {
    const rect = canvasContainer.value?.getBoundingClientRect()
    if (!rect) return

    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    const nodeId = renderer.hitTestNode(screenX, screenY, grid)
    if (nodeId) {
      store.selectNode(nodeId)
      // Update preferred column for vim-style navigation
      const node = grid.nodes.get(nodeId)
      if (node) preferredGridX = node.gridX
    } else {
      store.clearSelection()
      preferredGridX = null
    }
  }
}

function onPointerMove(e: PointerEvent) {
  if (!renderer || !grid) return

  // Skip if not a mouse (touch hover doesn't make sense)
  if (e.pointerType !== 'mouse') return

  const rect = canvasContainer.value?.getBoundingClientRect()
  if (!rect) return

  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top

  const nodeId = renderer.hitTestNode(screenX, screenY, grid)
  store.setHoveredNode(nodeId)

  // Track mouse position for tooltip
  if (nodeId) {
    tooltipX.value = e.clientX
    tooltipY.value = e.clientY
  }
}

// --- Helpers ---

function clampScale(scale: number): number {
  const minScale = baseScale * MIN_SCALE_FACTOR
  const maxScale = baseScale * MAX_SCALE_FACTOR
  return Math.max(minScale, Math.min(maxScale, scale))
}

// --- Lifecycle ---

async function init() {
  if (!canvasContainer.value) return

  renderer = new Renderer()
  await renderer.init(canvasContainer.value)

  // Attach pointer event listeners for tap detection and hover
  canvasContainer.value.addEventListener('pointerdown', onPointerDown)
  canvasContainer.value.addEventListener('pointerup', onPointerUp)
  canvasContainer.value.addEventListener('pointermove', onPointerMove)

  // Handle resize - PixiJS auto-resizes via resizeTo, no need to refit view
  resizeObserver = new ResizeObserver(() => {
    // Just let PixiJS handle the resize, don't rescale the viewport
  })
  resizeObserver.observe(canvasContainer.value)
}

function renderGraph() {
  if (!renderer || !store.graph) return

  // Clean up old grid
  if (grid) {
    grid.destroy()
    grid = null
  }

  // Create new grid (data only)
  grid = new Grid(store.rows, store.cols)
  grid.setColormap(store.activeColormap) // Set before populateNodes so initial colors are correct
  grid.populateNodes(store.graph.nodes, store.orderToRow)

  // Set up callbacks
  grid.onNodeHover = (node, isOver) => {
    store.setHoveredNode(isOver ? node.id : null)
  }

  grid.onNodeClick = (node) => {
    store.selectNode(node.id)
  }

  grid.onSelectionChange = (nodes) => {
    store.selectedNodeIds = new Set(nodes.map((n) => n.id))
  }

  // Sync nodes to store
  for (const [id, node] of grid.nodes) {
    store.setNode(id, node)
  }

  // Set colormap, year axis visibility, and tell renderer to draw
  renderer.setColormap(store.activeColormap, grid)
  renderer.setYearAxisVisible(props.showYearAxis ?? true)
  renderer.render(grid, store.orderToRow)

  // Animate in: start both, curves wait for both source and target nodes
  renderer.animateNodesIn({ totalDuration: 4000, nodeDuration: 1000 })
  renderer.animateCurvesIn({
    duration: 1000,
    awaitBothNodes: true,
  })

  // Fit to view after rendering
  fitToView()

  console.log('[GraphCanvas] Grid created with', grid.nodes.size, 'nodes')
}

let zoomAnimationId = 0

function smoothZoomTo(targetScale: number, targetX: number, targetY: number, duration = 200) {
  if (!renderer) return

  zoomAnimationId++
  const animationId = zoomAnimationId
  const start = renderer.getViewport()
  const startTime = performance.now()

  const animate = () => {
    if (animationId !== zoomAnimationId) return
    if (!renderer) return

    const elapsed = performance.now() - startTime
    const progress = Math.min(1, elapsed / duration)
    const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic

    const newScale = start.scale + (targetScale - start.scale) * eased
    const newX = start.x + (targetX - start.x) * eased
    const newY = start.y + (targetY - start.y) * eased

    renderer.setViewport(newX, newY, newScale)

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}

function smoothZoom(targetScale: number, centerX: number, centerY: number, duration = 200) {
  if (!renderer) return

  const current = renderer.getViewport()
  const worldX = (centerX - current.x) / current.scale
  const worldY = (centerY - current.y) / current.scale

  const targetX = centerX - worldX * targetScale
  const targetY = centerY - worldY * targetScale

  smoothZoomTo(targetScale, targetX, targetY, duration)
}

function fitToView() {
  if (!renderer || !grid) return
  const target = renderer.calculateFitToView(grid)
  baseScale = target.scale
  renderer.setZoomLimits(baseScale)
  smoothZoomTo(target.scale, target.x, target.y, 300)
}

function zoomIn() {
  if (!renderer || !canvasContainer.value) return
  const rect = canvasContainer.value.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const current = renderer.getViewport()
  const targetScale = clampScale(current.scale * 1.2)
  smoothZoom(targetScale, centerX, centerY)
}

function zoomOut() {
  if (!renderer || !canvasContainer.value) return
  const rect = canvasContainer.value.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const current = renderer.getViewport()
  const targetScale = clampScale(current.scale / 1.2)
  smoothZoom(targetScale, centerX, centerY)
}

function zoomToNode(nodeId: string, scale?: number) {
  if (!renderer || !grid || !canvasContainer.value) return

  const node = grid.nodes.get(nodeId)
  if (!node) return

  const rect = canvasContainer.value.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2

  // Target scale: use provided scale or zoom in a bit from base
  const targetScale = scale ?? clampScale(baseScale * 2)

  // Calculate viewport position to center the node
  const targetX = centerX - node.x * targetScale
  const targetY = centerY - node.y * targetScale

  smoothZoomTo(targetScale, targetX, targetY, 500)
}

function cleanup() {
  // Remove pointer event listeners
  if (canvasContainer.value) {
    canvasContainer.value.removeEventListener('pointerdown', onPointerDown)
    canvasContainer.value.removeEventListener('pointerup', onPointerUp)
    canvasContainer.value.removeEventListener('pointermove', onPointerMove)
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
    resizeDebounceTimer = null
  }

  if (grid) {
    grid.destroy()
    grid = null
  }

  if (renderer) {
    renderer.destroy()
    renderer = null
  }
}

// Watch for graph changes
watch(
  () => store.graph,
  (newGraph) => {
    if (newGraph && renderer) {
      renderGraph()
    }
  },
)

// Watch for selection changes and update visuals
watch(
  () => store.selectedNodeIds,
  (newSelection) => {
    if (renderer) {
      renderer.setSelectedNodes(newSelection)
    }
  },
  { deep: true },
)

// Watch for year axis visibility changes
watch(
  () => props.showYearAxis,
  (show) => {
    if (renderer) {
      renderer.setYearAxisVisible(show ?? true)
    }
  },
)

onMounted(async () => {
  await init()

  // Apply initial dark mode state (particles visibility and background)
  if (renderer) {
    renderer.setDarkMode(store.isDarkMode, store.activeColormap)
  }

  if (store.graph) {
    renderGraph()
  }

  // Keyboard navigation
  window.addEventListener('keydown', onKeyDown)

  // Cleanup on page refresh/close (onUnmounted doesn't fire fast enough)
  window.addEventListener('beforeunload', cleanup)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('beforeunload', cleanup)
  cleanup()
})

// Colormap change handler
function handleColormapChange(index: number) {
  if (!grid || !renderer) return
  renderer.setColormap(index, grid)
}

// Dark mode handler
function handleSetDarkMode(isDark: boolean) {
  if (!renderer) return
  renderer.setDarkMode(isDark, store.activeColormap)
}

// Expose for parent components
defineExpose({
  fitToView,
  zoomIn,
  zoomOut,
  zoomToNode,
  setColormap: handleColormapChange,
  setDarkMode: handleSetDarkMode,
})
</script>

<template>
  <div id="graph-canvas" ref="canvasContainer" class="graph-canvas">
    <div id="year-axis-target" class="year-axis-target"></div>
    <NodeTooltip :node="hoveredNode" :x="tooltipX" :y="tooltipY" />
  </div>
</template>

<style scoped>
.graph-canvas {
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  position: relative;
}

.year-axis-target {
  position: absolute;
  left: 0;
  top: 0;
  width: 80px;
  height: 100%;
  pointer-events: none;
}
</style>
