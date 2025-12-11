<script setup lang="ts">
import type { TabId } from '@/types/mobile'
import TabIcon from '@/components/TabIcon.vue'

defineProps<{
  activeTab: TabId | null
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
  <div class="mobile-tab-bar">
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
    </button>
  </div>
</template>

<style scoped>
.mobile-tab-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 52px;
  border-top: 1px solid var(--border-light);
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

.tab-button:active {
  color: var(--text-secondary);
}

.tab-button.active {
  color: var(--text-primary);
}

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
</style>
