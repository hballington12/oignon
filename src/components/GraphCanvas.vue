<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useDrag, usePinch, useWheel, useMove } from '@vueuse/gesture'
import { useGraphStore } from '@/stores/graph'
import { Grid } from '@/lib/Grid'
import { Renderer } from '@/lib/Renderer'

const store = useGraphStore()
const canvasContainer = ref<HTMLDivElement | null>(null)

let renderer: Renderer | null = null
let grid: Grid | null = null
let resizeObserver: ResizeObserver | null = null
let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null
let baseScale = 1

// Viewport limits
const MIN_SCALE_FACTOR = 0.5
const MAX_SCALE_FACTOR = 4

// Gesture state
let pinchStartScale = 1
let isPinching = false

// Drag threshold detection
const DRAG_THRESHOLD = 5
let dragStartX = 0
let dragStartY = 0
let isDragging = false
let hasMoved = false

// --- Gestures ---

// Pinch-to-zoom
usePinch(
  ({ da: [distance], origin: [ox, oy], first, active }) => {
    if (!renderer) return

    if (first) {
      pinchStartScale = renderer.getViewport().scale
      isPinching = true
    }

    if (active && distance > 0) {
      const scaleRatio = distance / 100 // Normalize distance
      const newScale = pinchStartScale * scaleRatio
      const clampedScale = clampScale(newScale)
      renderer.zoomAt(clampedScale, ox, oy)
    }

    if (!active) {
      isPinching = false
    }
  },
  {
    domTarget: canvasContainer,
    eventOptions: { passive: false },
  },
)

// Wheel zoom
useWheel(
  ({ delta: [, dy], event }) => {
    if (!renderer || isPinching) return

    const rect = canvasContainer.value?.getBoundingClientRect()
    if (!rect) return

    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    const currentScale = renderer.getViewport().scale
    const zoomFactor = dy > 0 ? 0.9 : 1.1
    const newScale = clampScale(currentScale * zoomFactor)

    renderer.zoomAt(newScale, mouseX, mouseY)
  },
  {
    domTarget: canvasContainer,
    eventOptions: { passive: false },
  },
)

// Drag to pan + tap detection
let lastDragX = 0
let lastDragY = 0

useDrag(
  ({ xy: [x, y], initial: [ix, iy], first, last, movement: [mx, my] }) => {
    if (!renderer || isPinching) return

    const rect = canvasContainer.value?.getBoundingClientRect()
    if (!rect) return

    if (first) {
      dragStartX = ix
      dragStartY = iy
      lastDragX = x
      lastDragY = y
      isDragging = false
      hasMoved = false
    }

    // Check if we've exceeded drag threshold
    const distance = Math.sqrt(mx * mx + my * my)
    if (distance > DRAG_THRESHOLD) {
      hasMoved = true
      isDragging = true
    }

    // Pan while dragging (use delta from last frame)
    if (isDragging) {
      const dx = x - lastDragX
      const dy = y - lastDragY
      renderer.pan(dx, dy)
    }

    lastDragX = x
    lastDragY = y

    // Handle tap (click without drag)
    if (last) {
      if (!hasMoved && grid) {
        const screenX = ix - rect.left
        const screenY = iy - rect.top

        const nodeId = renderer.hitTestNode(screenX, screenY, grid)
        if (nodeId) {
          store.selectNode(nodeId)
        } else {
          store.clearSelection()
        }
      }

      isDragging = false
      hasMoved = false
    }
  },
  {
    domTarget: canvasContainer,
    eventOptions: { passive: false },
  },
)

// Mouse move for hover detection (desktop only)
useMove(
  ({ xy: [x, y], event }) => {
    if (!renderer || !grid || isPinching || isDragging) return

    // Skip touch events for hover
    if (event instanceof TouchEvent) return

    const rect = canvasContainer.value?.getBoundingClientRect()
    if (!rect) return

    const screenX = x - rect.left
    const screenY = y - rect.top

    const nodeId = renderer.hitTestNode(screenX, screenY, grid)
    store.setHoveredNode(nodeId)
  },
  {
    domTarget: canvasContainer,
  },
)

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
  grid.setColormap(store.activeColormap)
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

  // Set colormap and tell renderer to draw
  renderer.setColormap(store.activeColormap)
  renderer.render(grid)

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

function fitToView() {
  if (!renderer || !grid) return
  baseScale = renderer.fitToView(grid)
}

let zoomAnimationId = 0

function smoothZoom(targetScale: number, centerX: number, centerY: number, duration = 200) {
  if (!renderer) return

  zoomAnimationId++
  const animationId = zoomAnimationId
  const startScale = renderer.getViewport().scale
  const startTime = performance.now()

  const animate = () => {
    if (animationId !== zoomAnimationId) return
    if (!renderer) return

    const elapsed = performance.now() - startTime
    const progress = Math.min(1, elapsed / duration)
    const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic

    const newScale = startScale + (targetScale - startScale) * eased
    renderer.zoomAt(newScale, centerX, centerY)

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}

function zoomIn() {
  if (!renderer || !canvasContainer.value) return
  const rect = canvasContainer.value.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const current = renderer.getViewport()
  smoothZoom(current.scale * 1.2, centerX, centerY)
}

function zoomOut() {
  if (!renderer || !canvasContainer.value) return
  const rect = canvasContainer.value.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const current = renderer.getViewport()
  smoothZoom(current.scale / 1.2, centerX, centerY)
}

function cleanup() {
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

onMounted(async () => {
  await init()
  if (store.graph) {
    renderGraph()
  }

  // Cleanup on page refresh/close (onUnmounted doesn't fire fast enough)
  window.addEventListener('beforeunload', cleanup)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', cleanup)
  cleanup()
})

// Colormap change handler
function handleColormapChange(index: number) {
  if (!grid || !renderer) return
  grid.setColormap(index)
  grid.updateNodeColors()
  renderer.setColormap(index)
  renderer.updateNodeColors(grid)
}

// Expose for parent components
defineExpose({
  fitToView,
  zoomIn,
  zoomOut,
  setColormap: handleColormapChange,
})
</script>

<template>
  <div ref="canvasContainer" class="graph-canvas"></div>
</template>

<style scoped>
.graph-canvas {
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
}
</style>
