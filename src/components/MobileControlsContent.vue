<script setup lang="ts">
import { computed } from 'vue'
import { COLORMAPS, type Colormap } from '@/lib/colormap'
import { useGraphStore } from '@/stores/graph'

const store = useGraphStore()

const emit = defineEmits<{
  colormapChange: [index: number]
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
  </div>
</template>

<style scoped>
.controls-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  gap: clamp(12px, 4vw, 24px);
}

.controls-group {
  display: flex;
  align-items: center;
  justify-content: center;
}

.colormap-buttons {
  display: flex;
  gap: clamp(8px, 3vw, 16px);
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
</style>
