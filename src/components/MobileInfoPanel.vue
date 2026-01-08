<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { useEventListener } from '@vueuse/core'
import {
  TAB_HEIGHTS,
  TAB_WIDTHS,
  PANEL_MIN_HEIGHT,
  PANEL_MIN_WIDTH,
  type TabId,
  type LayoutMode,
} from '@/types/mobile'
import { useGraphStore } from '@/stores/graph'
import MobileControlsContent from '@/components/MobileControlsContent.vue'
import PaperDetailsContent from '@/components/PaperDetailsContent.vue'
import AuthorDetailsContent from '@/components/AuthorDetailsContent.vue'
import LibraryContent from '@/components/LibraryContent.vue'

const store = useGraphStore()

const contentComponents: Partial<Record<TabId, Component>> = {
  controls: MobileControlsContent,
  details: PaperDetailsContent,
  library: LibraryContent,
}

const props = defineProps<{
  activeTab: TabId | null
  layoutMode?: LayoutMode
}>()

import type { Author } from '@/types'

const emit = defineEmits<{
  colormapChange: [index: number]
  search: [query: string]
  buildAuthor: [id: string]
  confirmBuildAuthor: [author: Author]
  showDetails: []
  sizeChange: [size: number]
  dragStart: []
  dragEnd: []
  collapse: []
}>()

// Drag handle ref and resize state
const handleRef = ref<HTMLElement | null>(null)
const customHeights = ref<Partial<Record<TabId, number>>>({})
const customWidths = ref<Partial<Record<TabId, number>>>({})
const isDragging = ref(false)

// Orientation helpers
const isLandscape = computed(() => props.layoutMode === 'landscape')

const minSize = computed(() => (isLandscape.value ? PANEL_MIN_WIDTH : PANEL_MIN_HEIGHT))

const defaultSizes = computed(() => (isLandscape.value ? TAB_WIDTHS : TAB_HEIGHTS))

const customSizes = computed(() => (isLandscape.value ? customWidths.value : customHeights.value))

// Dynamic max size - 70% of viewport
function getMaxSize(): number {
  const dimension = isLandscape.value ? window.innerWidth : window.innerHeight
  return Math.round(dimension * 0.7)
}

// Drag state
let dragStartPos = 0
let dragStartSize = 0
let hasMoved = false
const TAP_THRESHOLD = 5 // pixels - below this counts as a tap

// Momentum tracking (like pixi-viewport's Decelerate plugin)
interface Snapshot {
  pos: number
  time: number
}
const snapshots: Snapshot[] = []
const SNAPSHOT_WINDOW = 100 // Only use snapshots from last 100ms for velocity calc
const FRICTION = 0.95 // Velocity multiplier per frame (0.95 = loses 5% per frame)
const MIN_VELOCITY = 0.5 // Stop when velocity drops below this
let velocity = 0
let momentumFrame: number | null = null

function clampSize(s: number): number {
  return Math.round(Math.min(getMaxSize(), Math.max(minSize.value, s)))
}

function setSize(s: number) {
  if (!props.activeTab) return
  const clamped = clampSize(s)
  if (isLandscape.value) {
    customWidths.value[props.activeTab] = clamped
  } else {
    customHeights.value[props.activeTab] = clamped
  }
  emit('sizeChange', clamped)
}

// Get pointer position based on orientation
function getPointerPos(e: PointerEvent): number {
  return isLandscape.value ? e.clientX : e.clientY
}

const isMomentumActive = ref(false)

function stopMomentum() {
  if (momentumFrame) {
    cancelAnimationFrame(momentumFrame)
    momentumFrame = null
  }
  velocity = 0
  if (isMomentumActive.value) {
    isMomentumActive.value = false
    emit('dragEnd')
  }
}

function applyMomentum() {
  if (!props.activeTab) return

  velocity *= FRICTION

  if (Math.abs(velocity) < MIN_VELOCITY) {
    stopMomentum()
    return
  }

  const currentSize =
    customSizes.value[props.activeTab] ?? defaultSizes.value[props.activeTab] ?? minSize.value
  const newSize = currentSize + velocity

  // Stop if we hit bounds
  if (newSize <= minSize.value || newSize >= getMaxSize()) {
    setSize(newSize)
    stopMomentum()
    return
  }

  setSize(newSize)
  momentumFrame = requestAnimationFrame(applyMomentum)
}

function onPointerDown(e: PointerEvent) {
  if (!props.activeTab) return

  // Stop any ongoing momentum
  stopMomentum()
  snapshots.length = 0
  hasMoved = false

  isDragging.value = true
  dragStartPos = getPointerPos(e)
  dragStartSize =
    customSizes.value[props.activeTab] ?? defaultSizes.value[props.activeTab] ?? minSize.value

  // Record initial snapshot
  snapshots.push({ pos: getPointerPos(e), time: performance.now() })

  // Capture pointer for smooth tracking even outside element
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

  emit('dragStart')
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value || !props.activeTab) return

  // Record snapshot for velocity calculation
  snapshots.push({ pos: getPointerPos(e), time: performance.now() })
  // Keep buffer reasonable
  if (snapshots.length > 60) {
    snapshots.splice(0, 30)
  }

  // Portrait: drag up (negative Y delta) = increase height
  // Landscape: drag right (positive X delta) = increase width
  const pointerPos = getPointerPos(e)
  const delta = isLandscape.value ? pointerPos - dragStartPos : dragStartPos - pointerPos

  // Check if we've moved enough to count as a drag
  if (!hasMoved && Math.abs(delta) > TAP_THRESHOLD) {
    hasMoved = true
  }

  const newSize = clampSize(dragStartSize + delta)

  if (isLandscape.value) {
    customWidths.value[props.activeTab] = newSize
  } else {
    customHeights.value[props.activeTab] = newSize
  }
  emit('sizeChange', newSize)
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value) return

  isDragging.value = false
  ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

  // If it was a tap (no significant movement), collapse the panel
  if (!hasMoved) {
    emit('dragEnd')
    emit('collapse')
    return
  }

  // Calculate velocity from recent snapshots
  const now = performance.now()
  const recentSnapshot = snapshots.find((s) => now - s.time <= SNAPSHOT_WINDOW)

  if (recentSnapshot) {
    const dt = now - recentSnapshot.time
    if (dt > 0) {
      // Velocity in pixels per frame (~16ms)
      // Portrait: negative deltaY = dragging up = positive height change
      // Landscape: positive deltaX = dragging right = positive width change
      const pointerPos = getPointerPos(e)
      const deltaPos = isLandscape.value
        ? pointerPos - recentSnapshot.pos
        : recentSnapshot.pos - pointerPos
      velocity = (deltaPos / dt) * 16
    }
  }

  // Start momentum if velocity is significant, otherwise emit dragEnd now
  if (Math.abs(velocity) > MIN_VELOCITY) {
    isMomentumActive.value = true
    momentumFrame = requestAnimationFrame(applyMomentum)
  } else {
    emit('dragEnd')
  }
}

// Attach listeners to handle
useEventListener(handleRef, 'pointerdown', onPointerDown)
useEventListener(handleRef, 'pointermove', onPointerMove)
useEventListener(handleRef, 'pointerup', onPointerUp)
useEventListener(handleRef, 'pointercancel', onPointerUp)

const panelSize = computed(() => {
  if (!props.activeTab) return 0
  return customSizes.value[props.activeTab] ?? defaultSizes.value[props.activeTab]
})

function resetHeights() {
  customHeights.value = {}
}

defineExpose({ resetHeights })

const activeComponent = computed(() => {
  if (!props.activeTab) return null
  return contentComponents[props.activeTab] ?? null
})
</script>

<template>
  <div
    class="mobile-info-panel"
    :class="{
      open: activeTab !== null,
      dragging: isDragging || isMomentumActive,
      landscape: isLandscape,
    }"
    :style="isLandscape ? { width: panelSize + 'px' } : { height: panelSize + 'px' }"
  >
    <div class="info-panel-content">
      <Transition name="fade" mode="out-in">
        <!-- Resizable tabs (details/library) get wrapped with drag handle -->
        <div v-if="activeTab === 'details'" key="details" class="resizable-wrapper">
          <div ref="handleRef" class="drag-handle">
            <div class="drag-handle-pill" />
          </div>
          <div class="resizable-content">
            <!-- Show author details for author graphs when no node selected and no standalone paper -->
            <Transition name="details-fade" mode="out-in">
              <AuthorDetailsContent
                v-if="
                  store.isAuthorGraph && store.selectedNodes.length === 0 && !store.standalonePaper
                "
                key="author"
              />
              <PaperDetailsContent
                v-else
                key="paper"
                @search="emit('search', $event)"
                @show-details="emit('showDetails')"
                @build-author="emit('confirmBuildAuthor', $event)"
              />
            </Transition>
          </div>
        </div>

        <div v-else-if="activeTab === 'library'" key="library" class="resizable-wrapper">
          <div ref="handleRef" class="drag-handle">
            <div class="drag-handle-pill" />
          </div>
          <div class="resizable-content">
            <LibraryContent
              @search="emit('search', $event)"
              @build-author="emit('buildAuthor', $event)"
              @show-details="emit('showDetails')"
            />
          </div>
        </div>

        <!-- Non-resizable tabs render directly -->
        <component
          :is="activeComponent"
          v-else-if="activeComponent"
          :key="activeTab"
          @colormap-change="emit('colormapChange', $event)"
          @search="emit('search', $event)"
          @show-details="emit('showDetails')"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* Portrait mode (default) */
.mobile-info-panel {
  height: 0;
  border-top: 1px solid transparent;
  overflow: hidden;
  transition:
    height var(--transition-smooth),
    border-color var(--transition-smooth);
  display: flex;
  flex-direction: column;
}

/* Landscape mode */
.mobile-info-panel.landscape {
  height: 100%;
  width: 0;
  border-top: none;
  border-right: 1px solid transparent;
  transition:
    width var(--transition-smooth),
    border-color var(--transition-smooth);
  flex-direction: row;
}

.mobile-info-panel.dragging {
  transition: none;
}

.mobile-info-panel.open {
  border-top-color: var(--border-light);
}

.mobile-info-panel.landscape.open {
  border-top-color: transparent;
  border-right-color: var(--border-light);
}

/* Drag handle - portrait */
.drag-handle {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 5px 0;
  cursor: ns-resize;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  position: relative;
}

/* Drag handle - landscape */
.mobile-info-panel.landscape .drag-handle {
  order: 1; /* Move handle to right edge */
  padding: 0 5px;
  cursor: ew-resize;
  width: auto;
  height: 100%;
}

/* Hit area - portrait */
.drag-handle::before {
  content: '';
  position: absolute;
  top: -34px;
  bottom: -10px;
  left: 0;
  right: 0;
  pointer-events: auto;
  z-index: 10;
}

/* Hit area - landscape */
.mobile-info-panel.landscape .drag-handle::before {
  top: 0;
  bottom: 0;
  left: -10px;
  right: -34px;
}

/* Pill - portrait */
.drag-handle-pill {
  width: 98px;
  height: 8px;
  background: var(--border-medium);
  border-radius: 4px;
  transition: background var(--transition-smooth);
}

/* Pill - landscape */
.mobile-info-panel.landscape .drag-handle-pill {
  width: 8px;
  height: 98px;
}

.drag-handle:hover .drag-handle-pill,
.drag-handle:active .drag-handle-pill {
  background: var(--border-strong);
}

.info-panel-content {
  flex: 1;
  min-height: 0;
  color: var(--text-secondary);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Wrapper for resizable content (details/library) */
.resizable-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Landscape wrapper */
.mobile-info-panel.landscape .resizable-wrapper {
  flex-direction: row;
  width: 100%;
}

.resizable-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Landscape content - on left of handle */
.mobile-info-panel.landscape .resizable-content {
  order: 0;
  min-width: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Details content fade (author <-> paper) */
.details-fade-enter-active {
  transition: opacity 0.15s ease-out;
}

.details-fade-leave-active {
  transition: opacity 0.08s ease-in;
}

.details-fade-enter-from,
.details-fade-leave-to {
  opacity: 0;
}
</style>
