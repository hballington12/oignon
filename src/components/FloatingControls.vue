<script setup lang="ts">
import type { LayoutMode } from '@/types/mobile'

const props = defineProps<{
  showYearAxis?: boolean
  graphType?: 'paper' | 'author'
  showHelpHint?: boolean
  layoutMode?: LayoutMode
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  fitToView: []
  restartTutorial: []
  toggleYearAxis: []
  zoomToSource: []
  dismissHelpHint: []
  toggleLayoutMode: []
}>()
</script>

<template>
  <div class="floating-controls">
    <div class="help-btn-wrapper">
      <button
        class="float-btn"
        :class="{ 'help-hint-active': props.showHelpHint }"
        @click="emit('restartTutorial')"
        title="Tutorial"
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
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>
      <Transition name="hint-fade">
        <div v-if="props.showHelpHint" class="help-hint-tooltip">
          <span>Not sure what to do? Click here...</span>
          <button class="dismiss-hint" @click.stop="emit('dismissHelpHint')">
            Don't show this again.
          </button>
        </div>
      </Transition>
    </div>
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
      v-if="props.graphType !== 'author'"
      class="float-btn"
      @click="emit('zoomToSource')"
      title="Go to source"
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
        <circle cx="12" cy="12" r="10" />
        <line x1="22" y1="12" x2="18" y2="12" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="12" y1="22" x2="12" y2="18" />
      </svg>
    </button>
    <button
      class="float-btn"
      :class="{ active: props.layoutMode !== 'auto' }"
      @click="emit('toggleLayoutMode')"
      :title="`Layout: ${props.layoutMode}`"
    >
      <!-- Auto: phone with rotation arrows -->
      <svg
        v-if="props.layoutMode === 'auto'"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="7" y="4" width="10" height="16" rx="2" />
        <path d="M4 12a5 5 0 0 1 3-4.5" />
        <path d="M4 9l-1.5 1.5L4 12" />
        <path d="M20 12a5 5 0 0 1-3 4.5" />
        <path d="M20 15l1.5-1.5L20 12" />
      </svg>
      <!-- Portrait: vertical phone -->
      <svg
        v-else-if="props.layoutMode === 'portrait'"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <circle cx="12" cy="17" r="1" />
      </svg>
      <!-- Landscape: horizontal phone -->
      <svg
        v-else
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="17" cy="12" r="1" />
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
  top: calc(var(--spacing-lg) + env(safe-area-inset-top));
  right: calc(var(--spacing-lg) + env(safe-area-inset-right));
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
  background: var(--bg-panel-colormap, var(--bg-panel-solid));
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  -webkit-tap-highlight-color: transparent;
  transition:
    background var(--transition-smooth),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
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

/* Help hint styles */
.help-btn-wrapper {
  position: relative;
}

@keyframes help-hint-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 0 rgba(59, 130, 246, 0.6),
      0 0 8px rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow:
      0 0 0 6px rgba(59, 130, 246, 0),
      0 0 16px rgba(59, 130, 246, 0.6);
  }
}

.float-btn.help-hint-active {
  animation: help-hint-pulse 1.5s ease-in-out infinite;
  border-color: #3b82f6;
  color: var(--text-primary);
}

.help-hint-tooltip {
  position: absolute;
  top: 50%;
  right: calc(100% + 12px);
  transform: translateY(-50%);
  white-space: nowrap;
  background: rgba(30, 30, 50, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.dismiss-hint {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease;
}

.dismiss-hint:hover {
  color: rgba(255, 255, 255, 0.8);
}

.help-hint-tooltip::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -6px;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-left-color: rgba(30, 30, 50, 0.95);
}

.hint-fade-enter-active {
  transition:
    opacity 1s ease,
    transform 1s ease;
}

.hint-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(10px);
}
</style>
