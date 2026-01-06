<script setup lang="ts">
import type { TabId, LayoutMode } from '@/types/mobile'
import TabIcon from '@/components/TabIcon.vue'

defineProps<{
  activeTab: TabId | null
  layoutMode?: LayoutMode
}>()

const emit = defineEmits<{
  select: [tab: TabId]
}>()

const tabs: { id: TabId; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'details', label: 'Details' },
  { id: 'library', label: 'Library' },
  { id: 'controls', label: 'Controls' },
]

function handleTap(id: TabId) {
  emit('select', id)
}
</script>

<template>
  <div class="mobile-tab-bar" :class="{ landscape: layoutMode === 'landscape' }">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-button"
      :class="{ active: activeTab === tab.id }"
      :aria-label="tab.label"
      @click="handleTap(tab.id)"
    >
      <TabIcon :tab="tab.id" />
      <span class="tab-indicator" />
      <span :id="`${tab.id}-tab`" class="tab-target" />
    </button>
  </div>
</template>

<style scoped>
/* Portrait mode (default) - horizontal bar at bottom */
.mobile-tab-bar {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  height: calc(52px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid var(--border-light);
}

/* Landscape mode - vertical bar on left */
.mobile-tab-bar.landscape {
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  width: calc(52px + env(safe-area-inset-left));
  height: 100%;
  padding-bottom: 0;
  padding-left: env(safe-area-inset-left);
  padding-top: env(safe-area-inset-top);
  border-top: none;
  border-right: 1px solid var(--border-light);
}

.tab-button {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 100%;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
  position: relative;
  -webkit-tap-highlight-color: transparent;
}

/* Landscape tab button */
.mobile-tab-bar.landscape .tab-button {
  flex: 0 0 auto;
  width: 100%;
  height: auto;
  padding: var(--spacing-md) 0;
}

.tab-button:active {
  color: var(--text-secondary);
}

.tab-button.active {
  color: var(--text-primary);
}

/* Portrait indicator - horizontal at bottom */
.tab-indicator {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 20px;
  height: 2px;
  background: var(--text-primary);
  border-radius: 1px;
  transition: transform var(--transition-smooth);
}

.tab-button.active .tab-indicator {
  transform: translateX(-50%) scaleX(1);
}

/* Landscape indicator - vertical on right edge */
.mobile-tab-bar.landscape .tab-indicator {
  bottom: auto;
  left: auto;
  right: 8px;
  top: 50%;
  transform: translateY(-50%) scaleX(0);
  width: 2px;
  height: 20px;
}

.mobile-tab-bar.landscape .tab-button.active .tab-indicator {
  transform: translateY(-50%) scaleX(1);
}

.tab-target {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 36px;
  pointer-events: none;
}
</style>
