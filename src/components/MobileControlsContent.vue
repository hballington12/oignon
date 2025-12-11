<script setup lang="ts">
import { computed } from 'vue'
import { COLORMAPS, type Colormap } from '@/lib/colormap'
import { useGraphStore } from '@/stores/graph'

const store = useGraphStore()

const emit = defineEmits<{
  colormapChange: [index: number]
  zoomIn: []
  zoomOut: []
  fitToView: []
}>()

function stopToRgb(stop: { r: number; g: number; b: number }): string {
  return `rgb(${Math.round(stop.r * 255)}, ${Math.round(stop.g * 255)}, ${Math.round(stop.b * 255)})`
}

function getGradientStyle(colormap: Colormap): string {
  const stops = colormap.stops.map((s) => `${stopToRgb(s)} ${s.t * 100}%`).join(', ')
  return `linear-gradient(135deg, ${stops})`
}

function selectColormap(index: number) {
  emit('colormapChange', index)
}
</script>

<template>
  <div class="controls-content">
    <div class="controls-group">
      <div class="colormap-buttons">
        <button
          v-for="(colormap, index) in COLORMAPS"
          :key="colormap.name"
          class="colormap-btn"
          :class="{ active: store.activeColormap === index }"
          :style="{ background: getGradientStyle(colormap) }"
          :title="colormap.name"
          @click="selectColormap(index)"
        >
          <span class="colormap-gloss" />
        </button>
      </div>
    </div>

    <div class="divider" />

    <div class="controls-group">
      <div class="zoom-buttons">
        <button class="zoom-btn" @click="emit('zoomOut')" title="Zoom out">
          <svg
            width="18"
            height="18"
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
        <button class="zoom-btn" @click="emit('zoomIn')" title="Zoom in">
          <svg
            width="18"
            height="18"
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
        <button class="zoom-btn" @click="emit('fitToView')" title="Fit to view">
          <svg
            width="18"
            height="18"
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.controls-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  gap: var(--spacing-lg);
}

.controls-group {
  display: flex;
  align-items: center;
  justify-content: center;
}

.colormap-buttons {
  display: flex;
  gap: var(--spacing-xl);
}

.colormap-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.colormap-btn:active {
  transform: scale(0.9);
}

.colormap-btn.active {
  border-color: var(--text-primary);
  transform: scale(0.9);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
}

.colormap-gloss {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(255, 255, 255, 0.1) 40%,
    rgba(0, 0, 0, 0.05) 60%,
    rgba(0, 0, 0, 0.15) 100%
  );
  pointer-events: none;
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--border-light);
}

.zoom-buttons {
  display: flex;
  gap: var(--spacing-xl);
}

.zoom-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--btn-bg);
  border: 1px solid var(--btn-border);
  border-radius: var(--btn-radius);
  color: var(--text-secondary);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all var(--transition-fast);
}

.zoom-btn:active {
  background: var(--btn-bg-active);
  transform: scale(0.95);
}
</style>
