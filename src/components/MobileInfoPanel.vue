<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { useEventListener } from '@vueuse/core'
import { TAB_HEIGHTS, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT, type TabId } from '@/types/mobile'
import MobileControlsContent from '@/components/MobileControlsContent.vue'
import PaperDetailsContent from '@/components/PaperDetailsContent.vue'
import MobileSearchContent from '@/components/MobileSearchContent.vue'
import LibraryContent from '@/components/LibraryContent.vue'

const contentComponents: Partial<Record<TabId, Component>> = {
  controls: MobileControlsContent,
  details: PaperDetailsContent,
  search: MobileSearchContent,
  library: LibraryContent,
}

const props = defineProps<{
  activeTab: TabId | null
}>()

const emit = defineEmits<{
  colormapChange: [index: number]
  search: [query: string]
  showDetails: []
  zoomIn: []
  zoomOut: []
  fitToView: []
  heightChange: [height: number]
  dragStart: []
  dragEnd: []
}>()

// Drag handle ref and resize state
const handleRef = ref<HTMLElement | null>(null)
const customHeights = ref<Partial<Record<TabId, number>>>({})
const isDragging = ref(false)

// Drag state
let dragStartY = 0
let dragStartHeight = 0

function onPointerDown(e: PointerEvent) {
  if (!props.activeTab) return

  isDragging.value = true
  dragStartY = e.clientY
  dragStartHeight =
    customHeights.value[props.activeTab] ?? TAB_HEIGHTS[props.activeTab] ?? PANEL_MIN_HEIGHT

  // Capture pointer for smooth tracking even outside element
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

  emit('dragStart')
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value || !props.activeTab) return

  const deltaY = dragStartY - e.clientY // Negative = dragging up = increase height
  const newHeight = Math.round(
    Math.min(PANEL_MAX_HEIGHT, Math.max(PANEL_MIN_HEIGHT, dragStartHeight + deltaY)),
  )

  customHeights.value[props.activeTab] = newHeight
  emit('heightChange', newHeight)
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value) return

  isDragging.value = false
  ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

  emit('dragEnd')
}

// Attach listeners to handle
useEventListener(handleRef, 'pointerdown', onPointerDown)
useEventListener(handleRef, 'pointermove', onPointerMove)
useEventListener(handleRef, 'pointerup', onPointerUp)
useEventListener(handleRef, 'pointercancel', onPointerUp)

const panelHeight = computed(() => {
  if (!props.activeTab) return 0
  return customHeights.value[props.activeTab] ?? TAB_HEIGHTS[props.activeTab]
})

const activeComponent = computed(() => {
  if (!props.activeTab) return null
  return contentComponents[props.activeTab] ?? null
})
</script>

<template>
  <div
    class="mobile-info-panel"
    :class="{ open: activeTab !== null, dragging: isDragging }"
    :style="{ height: panelHeight + 'px' }"
  >
    <div class="info-panel-content">
      <Transition name="fade" mode="out-in">
        <!-- Resizable tabs (details/library) get wrapped with drag handle -->
        <div v-if="activeTab === 'details'" key="details" class="resizable-wrapper">
          <div ref="handleRef" class="drag-handle">
            <div class="drag-handle-pill" />
          </div>
          <div class="resizable-content">
            <PaperDetailsContent
              @search="emit('search', $event)"
              @show-details="emit('showDetails')"
            />
          </div>
        </div>

        <div v-else-if="activeTab === 'library'" key="library" class="resizable-wrapper">
          <div ref="handleRef" class="drag-handle">
            <div class="drag-handle-pill" />
          </div>
          <div class="resizable-content">
            <LibraryContent @search="emit('search', $event)" @show-details="emit('showDetails')" />
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
          @zoom-in="emit('zoomIn')"
          @zoom-out="emit('zoomOut')"
          @fit-to-view="emit('fitToView')"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
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

.mobile-info-panel.dragging {
  transition: none;
}

.mobile-info-panel.open {
  border-top-color: var(--border-light);
}

/* Drag handle */
.drag-handle {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 20px;
  cursor: ns-resize;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.drag-handle-pill {
  width: 40px;
  height: 4px;
  background: var(--border-medium);
  border-radius: 2px;
  transition: background var(--transition-fast);
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

.resizable-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
