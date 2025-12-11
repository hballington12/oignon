<script setup lang="ts">
import { useGraphStore } from '@/stores/graph'
import { COLORMAPS } from '@/lib/colormap'
import CollapsiblePanel from '@/components/CollapsiblePanel.vue'

const store = useGraphStore()

const colormaps = COLORMAPS.map((cm, index) => ({
  id: index,
  name: cm.name,
}))

const emit = defineEmits<{
  colormapChange: [index: number]
  fitToView: []
  zoomIn: []
  zoomOut: []
}>()

function handleColormapChange(index: number) {
  store.setColormap(index)
  emit('colormapChange', index)
}
</script>

<template>
  <div class="control-panel-container">
    <CollapsiblePanel
      v-model:collapsed="store.sidePanelCollapsed"
      toggle-position="upper-west"
      :width="200"
      icon="wrench"
      label="controls"
    >
      <div class="panel-header">Controls</div>

      <!-- Colormap Section -->
      <div class="panel-section">
        <div class="panel-section-title">Colormap</div>
        <div class="colormap-grid">
          <button
            v-for="cm in colormaps"
            :key="cm.id"
            class="colormap-btn"
            :class="{ active: store.activeColormap === cm.id }"
            @click="handleColormapChange(cm.id)"
          >
            {{ cm.name }}
          </button>
        </div>
      </div>

      <!-- Viewport Controls Section -->
      <div class="panel-section">
        <div class="panel-section-title">View</div>
        <div class="viewport-controls">
          <button class="control-btn" @click="emit('zoomIn')" title="Zoom in">+</button>
          <button class="control-btn" @click="emit('zoomOut')" title="Zoom out">−</button>
          <div class="control-btn-divider"></div>
          <button class="control-btn" @click="emit('fitToView')" title="Fit to view">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>
      </div>
    </CollapsiblePanel>
  </div>
</template>

<style>
@import '@/assets/styles/panel.css';
</style>

<style scoped>
.control-panel-container {
  position: absolute;
  top: var(--spacing-xl);
  right: var(--spacing-xl);
  z-index: var(--z-panel);
  pointer-events: none;
}

/* Colormap Grid */
.colormap-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-xs);
}

.colormap-btn {
  padding: 6px 8px;
  border: 1px solid var(--btn-border);
  border-radius: var(--btn-radius);
  background: var(--btn-bg);
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.colormap-btn:hover {
  background: var(--btn-bg-hover);
  color: var(--text-secondary);
}

.colormap-btn.active {
  border-color: var(--accent-blue);
  color: var(--text-primary);
  background: var(--btn-bg-active);
}

/* Viewport Controls */
.viewport-controls {
  display: flex;
  gap: var(--spacing-xs);
}

.control-btn {
  width: var(--control-btn-size);
  height: var(--control-btn-size);
  border: 1px solid var(--border-light);
  border-radius: var(--btn-radius);
  background: var(--btn-bg);
  color: var(--text-tertiary);
  font-size: var(--font-size-xl);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.control-btn:hover {
  background: var(--btn-bg-hover);
  color: var(--text-primary);
}

.control-btn:active {
  transform: scale(0.95);
}

.control-btn-divider {
  width: 1px;
  background: var(--border-medium);
  margin: 6px 2px;
}
</style>
