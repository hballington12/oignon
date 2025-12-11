<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Application, Container, Graphics, FederatedPointerEvent } from 'pixi.js'
import { usePinch } from '@vueuse/gesture'
import { useGraphStore } from '@/stores/graph'
import { Grid } from '@/lib/Grid'
import { getBackgroundColor, COLORMAPS } from '@/lib/colormap'
const store = useGraphStore()
const canvasContainer = ref<HTMLDivElement | null>(null)

let app: Application | null = null
let viewport: Container | null = null
let background: Graphics | null = null
let selectionBox: Graphics | null = null
let grid: Grid | null = null
let resizeObserver: ResizeObserver | null = null
let baseScale = 1
let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Gesture state machine
type GestureState = 'idle' | 'possible' | 'dragging' | 'boxSelecting'
let gestureState: GestureState = 'idle'
let dragStartX = 0
let dragStartY = 0
let lastX = 0
let lastY = 0
let pointerDownTarget: Container | null = null

// Thresholds
const DRAG_THRESHOLD_MOUSE = 5
const DRAG_THRESHOLD_TOUCH = 15

// Pinch-to-zoom state
let pinchStartScale = 1
let pinchStartDistance = 0
let isPinching = false

// Setup pinch gesture for mobile zoom
usePinch(
  ({ da: [distance], origin: [ox, oy], first, active }) => {
    if (first) {
      pinchStartScale = store.viewport.scale
      pinchStartDistance = distance
      isPinching = true
    }

    if (active && pinchStartDistance > 0) {
      // Use ratio of current distance to starting distance
      const scaleRatio = distance / pinchStartDistance
      const newScale = pinchStartScale * scaleRatio

      // Direct viewport update for smoother performance (skip animation)
      const clampedScale = Math.max(
        store.viewportLimits.minScale,
        Math.min(store.viewportLimits.maxScale, newScale),
      )

      // Calculate new position to zoom toward pinch center
      const worldX = (ox - store.viewport.x) / store.viewport.scale
      const worldY = (oy - store.viewport.y) / store.viewport.scale

      store.setViewport({
        scale: clampedScale,
        targetScale: clampedScale,
        x: ox - worldX * clampedScale,
        y: oy - worldY * clampedScale,
        targetX: ox - worldX * clampedScale,
        targetY: oy - worldY * clampedScale,
      })

      if (viewport) {
        viewport.scale.set(clampedScale)
        viewport.x = ox - worldX * clampedScale
        viewport.y = oy - worldY * clampedScale
      }
    } else if (!active) {
      isPinching = false
    }
  },
  {
    domTarget: canvasContainer,
    eventOptions: { passive: false },
  },
)

async function initPixi() {
  if (!canvasContainer.value) return

  app = new Application()
  await app.init({
    resizeTo: canvasContainer.value,
    backgroundColor: getBackgroundColor(COLORMAPS[store.activeColormap]!),
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  canvasContainer.value.appendChild(app.canvas)

  // Create background for capturing pointer events on empty space
  background = new Graphics()
  background.eventMode = 'static'
  background.cursor = 'default'
  app.stage.addChild(background)
  updateBackgroundHitArea()

  // Create viewport container
  viewport = new Container()
  app.stage.addChild(viewport)

  // Create selection box
  selectionBox = new Graphics()
  app.stage.addChild(selectionBox)

  // Set up Pixi-based interaction handlers
  setupPixiInteraction()

  // Wheel still needs DOM handler (Pixi wheel support is limited)
  canvasContainer.value.addEventListener('wheel', onWheel, { passive: false })

  // Handle resize to update background hit area and refit graph (only if not zoomed in)
  resizeObserver = new ResizeObserver(() => {
    updateBackgroundHitArea()
    if (store.viewport.scale <= baseScale) {
      // Debounce fitToView to wait for panel transitions to complete
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer)
      resizeDebounceTimer = setTimeout(() => {
        fitToView()
      }, 100)
    }
  })
  resizeObserver.observe(canvasContainer.value)

  // Start animation loop
  app.ticker.add(animationLoop)
}

function updateBackgroundHitArea() {
  if (!background || !canvasContainer.value) return
  const rect = canvasContainer.value.getBoundingClientRect()
  background.hitArea = { contains: () => true } // Catch everything
  // Redraw to cover full screen (invisible but needed for hit testing)
  background.clear()
  background.rect(0, 0, rect.width, rect.height)
  background.fill({ color: 0x000000, alpha: 0 })
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

  // Draw nodes
  grid.drawNodesOverlay()
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
  const padding = 5

  const sx = (rect.width - padding * 2) / grid.canvasWidth
  const sy = (rect.height - padding * 2) / grid.canvasHeight
  const newScale = Math.min(sx, sy)

  const newX = (rect.width - grid.canvasWidth * newScale) / 2
  const newY = (rect.height - grid.canvasHeight * newScale) / 2

  baseScale = newScale

  store.setViewport({
    targetScale: newScale,
    targetX: newX,
    targetY: newY,
    animating: true,
  })

  store.viewportLimits.defaultScale = newScale
  store.viewportLimits.minScale = newScale / 1.5
}

function setupPixiInteraction() {
  if (!app) return

  // Listen at stage level to catch all pointer events (event delegation)
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen
  app.stage.on('pointerdown', onPointerDown)
  app.stage.on('pointermove', onPointerMove)
  app.stage.on('pointerup', onPointerUp)
  app.stage.on('pointerupoutside', onPointerUp)
}

function onPointerDown(e: FederatedPointerEvent) {
  // Stop any ongoing zoom/pan animation
  store.snapViewport()

  dragStartX = e.globalX
  dragStartY = e.globalY
  lastX = e.globalX
  lastY = e.globalY
  pointerDownTarget = e.target as Container

  // Enter "possible" state - we don't know yet if this is tap or drag
  if (e.ctrlKey || e.metaKey) {
    gestureState = 'boxSelecting'
  } else {
    gestureState = 'possible'
  }
}

function onPointerMove(e: FederatedPointerEvent) {
  if (gestureState === 'idle' || isPinching) return

  const dx = e.globalX - dragStartX
  const dy = e.globalY - dragStartY
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Determine threshold based on input type
  const isTouch = e.pointerType === 'touch'
  const threshold = isTouch ? DRAG_THRESHOLD_TOUCH : DRAG_THRESHOLD_MOUSE

  // Transition from "possible" to "dragging" once threshold exceeded
  if (gestureState === 'possible' && distance > threshold) {
    gestureState = 'dragging'
  }

  // Only pan if we've committed to dragging
  if (gestureState === 'dragging' && viewport) {
    const moveDx = e.globalX - lastX
    const moveDy = e.globalY - lastY
    viewport.x += moveDx
    viewport.y += moveDy
    store.setViewport({ x: viewport.x, y: viewport.y })
    lastX = e.globalX
    lastY = e.globalY
  }

  if (gestureState === 'boxSelecting' && selectionBox) {
    const x = Math.min(dragStartX, e.globalX)
    const y = Math.min(dragStartY, e.globalY)
    const w = Math.abs(e.globalX - dragStartX)
    const h = Math.abs(e.globalY - dragStartY)

    selectionBox.clear()
    selectionBox.rect(x, y, w, h)
    selectionBox.fill({ color: 0x4488ff, alpha: 0.2 })
    selectionBox.stroke({ color: 0x4488ff, width: 1 })
  }
}

function onPointerUp(e: FederatedPointerEvent) {
  const previousState = gestureState

  if (selectionBox) {
    selectionBox.clear()
  }

  // If we were still in "possible" state, it was a tap (not a drag)
  if (previousState === 'possible') {
    const node = grid?.getNodeFromTarget(pointerDownTarget)
    if (node) {
      // Tapped on a node - select it
      const multiSelect = e.ctrlKey || e.metaKey
      grid?.selectNode(node, multiSelect)
      grid?.onNodeClick?.(node)
    } else {
      // Tapped on background - deselect all
      if (store.selectedNodeIds.size > 0) {
        grid?.clearSelection()
        store.clearSelection()
      }
    }
  }

  // Reset state
  pointerDownTarget = null
  gestureState = 'idle'
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
  // Remove DOM listeners
  if (canvasContainer.value) {
    canvasContainer.value.removeEventListener('wheel', onWheel)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  // Clean up Pixi objects
  if (grid) {
    grid.destroy()
    grid = null
  }

  if (app) {
    app.destroy(true)
    app = null
  }

  background = null
  viewport = null
  selectionBox = null
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
    app.renderer.background.color = getBackgroundColor(COLORMAPS[index]!)
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
  touch-action: none;
}
</style>
