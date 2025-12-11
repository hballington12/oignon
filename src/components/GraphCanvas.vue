<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Application, Container, Graphics } from 'pixi.js'
import { useGraphStore } from '@/stores/graph'
import { Grid } from '@/lib/Grid'
import { getBackgroundColor } from '@/lib/colormap'
const store = useGraphStore()
const canvasContainer = ref<HTMLDivElement | null>(null)

let app: Application | null = null
let viewport: Container | null = null
let selectionBox: Graphics | null = null
let grid: Grid | null = null

// Drag state
let isDragging = false
let isBoxSelecting = false
let dragStartX = 0
let dragStartY = 0
let lastX = 0
let lastY = 0

async function initPixi() {
  if (!canvasContainer.value) return

  app = new Application()
  await app.init({
    resizeTo: canvasContainer.value,
    backgroundColor: getBackgroundColor(),
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  canvasContainer.value.appendChild(app.canvas)

  // Create viewport container
  viewport = new Container()
  app.stage.addChild(viewport)

  // Create selection box
  selectionBox = new Graphics()
  app.stage.addChild(selectionBox)

  // Set up interaction handlers
  setupInteraction()

  // Start animation loop
  app.ticker.add(animationLoop)
}

function renderGraph() {
  if (!app || !viewport || !store.graph) return

  // Clear old grid
  if (grid) {
    viewport.removeChildren()
    grid.destroy()
    grid = null
  }

  // Create new grid
  grid = new Grid(store.rows, store.cols)
  grid.setRenderer(app.renderer)
  grid.populateNodes(store.graph.nodes, store.orderToRow)

  // Set up callbacks
  grid.onNodeHover = (node, isOver) => {
    store.setHoveredNode(isOver ? node.id : null)
  }

  grid.onNodeClick = (node) => {
    clickedOnNode = true
    store.selectNode(node.id)
  }

  grid.onSelectionChange = (nodes) => {
    store.selectedNodeIds = new Set(nodes.map((n) => n.id))
  }

  // Calculate bounds and draw
  grid.calculateCurveBounds()
  grid.drawNodesOverlay()

  // Position grid container
  grid.container.x = grid.curveOverhang
  grid.container.y = grid.curveUnderhang
  viewport.addChild(grid.container)

  // Sync nodes to store
  for (const [id, node] of grid.nodes) {
    store.setNode(id, node)
  }

  // Fit to view
  fitToView()

  // Animate in
  grid.animateNodesIn(4000, 1000)
  grid.animateCurvesIn({
    duration: 1000,
    awaitBothNodes: true,
    awaitSourceNode: true,
    durationStrategy: 'fixedIndependent',
  })
}

function fitToView() {
  if (!grid || !canvasContainer.value || !viewport) return

  const rect = canvasContainer.value.getBoundingClientRect()
  const padding = 40

  const sx = (rect.width - padding * 2) / grid.canvasWidth
  const sy = (rect.height - padding * 2) / grid.canvasHeight
  const newScale = Math.min(sx, sy, 1)

  const newX = (rect.width - grid.canvasWidth * newScale) / 2
  const newY = (rect.height - grid.canvasHeight * newScale) / 2

  store.setViewport({
    scale: newScale,
    targetScale: newScale,
    x: newX,
    y: newY,
    targetX: newX,
    targetY: newY,
    animating: false,
  })

  viewport.scale.set(newScale)
  viewport.x = newX
  viewport.y = newY

  store.viewportLimits.defaultScale = newScale
  store.viewportLimits.minScale = newScale / 1.5
}

function setupInteraction() {
  if (!canvasContainer.value) return

  const el = canvasContainer.value

  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointerleave', onPointerUp)
  el.addEventListener('wheel', onWheel, { passive: false })
}

function onPointerDown(e: PointerEvent) {
  // Stop any ongoing zoom/pan animation
  store.snapViewport()

  dragStartX = e.clientX
  dragStartY = e.clientY
  lastX = e.clientX
  lastY = e.clientY

  if (e.ctrlKey || e.metaKey) {
    isBoxSelecting = true
  } else {
    isDragging = true
  }
}

function onPointerMove(e: PointerEvent) {
  if (isDragging && viewport) {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    viewport.x += dx
    viewport.y += dy
    store.setViewport({ x: viewport.x, y: viewport.y })
    lastX = e.clientX
    lastY = e.clientY
  }

  if (isBoxSelecting && selectionBox) {
    const x = Math.min(dragStartX, e.clientX)
    const y = Math.min(dragStartY, e.clientY)
    const w = Math.abs(e.clientX - dragStartX)
    const h = Math.abs(e.clientY - dragStartY)

    selectionBox.clear()
    selectionBox.rect(x, y, w, h)
    selectionBox.fill({ color: 0x4488ff, alpha: 0.2 })
    selectionBox.stroke({ color: 0x4488ff, width: 1 })
  }
}

let clickedOnNode = false

function onPointerUp(e: PointerEvent) {
  const wasDragging = isDragging
  const wasBoxSelecting = isBoxSelecting
  isDragging = false
  isBoxSelecting = false

  if (selectionBox) {
    selectionBox.clear()
  }

  // Check if this was a click (not a drag)
  const dx = Math.abs(e.clientX - dragStartX)
  const dy = Math.abs(e.clientY - dragStartY)
  const isClick = dx < 5 && dy < 5

  if (isClick && !wasBoxSelecting && store.selectedNodeIds.size > 0 && !clickedOnNode) {
    // Clicked on empty canvas space - deselect all
    grid?.clearSelection()
    store.clearSelection()
  }

  clickedOnNode = false
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (!viewport) return

  const rect = canvasContainer.value?.getBoundingClientRect()
  if (!rect) return

  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = store.viewport.scale * zoomFactor

  store.smoothZoom(newScale, mouseX, mouseY)
}

function animationLoop() {
  if (!viewport) return

  const v = store.viewport
  if (!v.animating) return

  const ease = 0.15

  const dScale = v.targetScale - v.scale
  const dX = v.targetX - viewport.x
  const dY = v.targetY - viewport.y

  if (Math.abs(dScale) < 0.001 && Math.abs(dX) < 0.5 && Math.abs(dY) < 0.5) {
    store.setViewport({
      scale: v.targetScale,
      x: v.targetX,
      y: v.targetY,
      animating: false,
    })
    viewport.scale.set(v.targetScale)
    viewport.x = v.targetX
    viewport.y = v.targetY
    return
  }

  const newScale = v.scale + dScale * ease
  viewport.x += dX * ease
  viewport.y += dY * ease
  viewport.scale.set(newScale)

  store.setViewport({
    scale: newScale,
    x: viewport.x,
    y: viewport.y,
  })
}

function cleanup() {
  if (canvasContainer.value) {
    const el = canvasContainer.value
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointerleave', onPointerUp)
    el.removeEventListener('wheel', onWheel)
  }

  if (grid) {
    grid.destroy()
    grid = null
  }

  if (app) {
    app.destroy(true)
    app = null
  }
}

// Watch for graph changes - wait for app to be ready
watch(
  () => store.graph,
  (newGraph) => {
    if (newGraph && app) {
      renderGraph()
    }
  },
)

// Also check on mount if graph already loaded (from cache)
async function initAndRender() {
  await initPixi()
  if (store.graph) {
    renderGraph()
  }
}

onMounted(() => {
  initAndRender()
})

onUnmounted(() => {
  cleanup()
})

// Colormap change handler
function handleColormapChange(index: number) {
  grid?.setColormap(index)
  grid?.updateNodeColors()
  if (app) {
    app.renderer.background.color = getBackgroundColor()
  }
}

// Expose for parent components
defineExpose({
  app,
  viewport,
  fitToView,
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
}
</style>
