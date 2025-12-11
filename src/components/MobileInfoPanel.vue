<script setup lang="ts">
import { computed, type Component } from 'vue'
import { TAB_HEIGHTS, type TabId } from '@/types/mobile'
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
}>()

const panelHeight = computed(() => {
  if (!props.activeTab) return 0
  return TAB_HEIGHTS[props.activeTab]
})

const activeComponent = computed(() => {
  if (!props.activeTab) return null
  return contentComponents[props.activeTab] ?? null
})
</script>

<template>
  <div
    class="mobile-info-panel"
    :class="{ open: activeTab !== null }"
    :style="{ height: panelHeight + 'px' }"
  >
    <div class="info-panel-content">
      <Transition name="fade" mode="out-in">
        <component
          :is="activeComponent"
          v-if="activeComponent"
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
.mobile-info-panel {
  height: 0;
  border-top: 1px solid transparent;
  overflow: hidden;
  transition:
    height var(--transition-smooth),
    border-color var(--transition-smooth);
}

.mobile-info-panel.open {
  border-top-color: var(--border-light);
}

.info-panel-content {
  height: 100%;
  color: var(--text-secondary);
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
