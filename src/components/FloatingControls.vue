<script setup lang="ts">
const props = defineProps<{
  showYearAxis?: boolean
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  fitToView: []
  restartTutorial: []
  toggleYearAxis: []
}>()
</script>

<template>
  <div class="floating-controls">
    <button class="float-btn" @click="emit('restartTutorial')" title="Tutorial">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>
    <button class="float-btn" @click="emit('zoomIn')" title="Zoom in">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    </button>
    <button class="float-btn" @click="emit('zoomOut')" title="Zoom out">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    </button>
    <button class="float-btn" @click="emit('fitToView')" title="Fit to view">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    </button>
    <button
      class="float-btn"
      :class="{ active: props.showYearAxis }"
      @click="emit('toggleYearAxis')"
      title="Toggle year axis"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.floating-controls {
  position: absolute;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  z-index: var(--z-floating);
}

.float-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-panel-solid);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  -webkit-tap-highlight-color: transparent;
  transition: all var(--transition-fast);
}

@media (hover: hover) {
  .float-btn:hover {
    background: var(--bg-item-hover);
    color: var(--text-primary);
    border-color: var(--border-medium);
  }
}

.float-btn:active {
  transform: scale(0.92);
  background: var(--bg-item-active);
}

.float-btn.active {
  background: var(--bg-item-active);
  color: var(--text-primary);
  border-color: var(--border-medium);
}
</style>
