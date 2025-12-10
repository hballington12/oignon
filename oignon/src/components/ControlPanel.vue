<script setup lang="ts">
import { useGraphStore } from '@/stores/graph'
import { Colormap } from '@/types'

const store = useGraphStore()

const colormaps = [
  { id: Colormap.Plasma, name: 'Plasma' },
  { id: Colormap.Viridis, name: 'Viridis' },
  { id: Colormap.Inferno, name: 'Inferno' },
  { id: Colormap.Magma, name: 'Magma' },
  { id: Colormap.Cividis, name: 'Cividis' },
  { id: Colormap.Turbo, name: 'Turbo' },
]

const emit = defineEmits<{
  fitToView: []
  zoomIn: []
  zoomOut: []
}>()
</script>

<template>
  <div class="control-panel" :class="{ collapsed: store.sidePanelCollapsed }">
    <button class="toggle-btn" @click="store.toggleSidePanel">
      {{ store.sidePanelCollapsed ? '◀' : '▶' }}
    </button>

    <div v-if="!store.sidePanelCollapsed" class="panel-content">
      <section class="section">
        <h4>View</h4>
        <div class="button-row">
          <button @click="emit('zoomIn')">+</button>
          <button @click="emit('zoomOut')">−</button>
          <button @click="emit('fitToView')">Fit</button>
        </div>
      </section>

      <section class="section">
        <h4>Colormap</h4>
        <div class="colormap-list">
          <button
            v-for="cm in colormaps"
            :key="cm.id"
            class="colormap-btn"
            :class="{ active: store.activeColormap === cm.id }"
            @click="store.setColormap(cm.id)"
          >
            {{ cm.name }}
          </button>
        </div>
      </section>

      <section v-if="store.selectedNodes.length" class="section">
        <h4>Selected ({{ store.selectedNodes.length }})</h4>
        <ul class="selected-list">
          <li v-for="node in store.selectedNodes.slice(0, 5)" :key="node.id">
            {{ node.metadata.title?.slice(0, 40) }}...
          </li>
          <li v-if="store.selectedNodes.length > 5" class="more">
            +{{ store.selectedNodes.length - 5 }} more
          </li>
        </ul>
        <button class="clear-btn" @click="store.clearSelection">
          Clear Selection
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(30, 30, 50, 0.95);
  border-radius: 8px;
  padding: 16px;
  min-width: 200px;
  color: #fff;
  z-index: 100;
}

.control-panel.collapsed {
  min-width: auto;
  padding: 8px;
}

.toggle-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  background: none;
  border: none;
  color: #888;
  font-size: 12px;
  cursor: pointer;
}

.toggle-btn:hover {
  color: #fff;
}

.panel-content {
  margin-top: 20px;
}

.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

h4 {
  margin: 0 0 10px 0;
  font-size: 12px;
  font-weight: 500;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.button-row {
  display: flex;
  gap: 6px;
}

.button-row button {
  flex: 1;
  padding: 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #2a2a3e;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.button-row button:hover {
  background: #3a3a4e;
}

.colormap-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.colormap-btn {
  padding: 8px 12px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #2a2a3e;
  color: #aaa;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.colormap-btn:hover {
  background: #3a3a4e;
}

.colormap-btn.active {
  border-color: #6b8afd;
  color: #fff;
}

.selected-list {
  list-style: none;
  padding: 0;
  margin: 0 0 10px 0;
  font-size: 12px;
  color: #aaa;
}

.selected-list li {
  padding: 4px 0;
  border-bottom: 1px solid #333;
}

.selected-list .more {
  color: #666;
  font-style: italic;
}

.clear-btn {
  width: 100%;
  padding: 8px;
  border: 1px solid #555;
  border-radius: 4px;
  background: transparent;
  color: #888;
  font-size: 12px;
  cursor: pointer;
}

.clear-btn:hover {
  border-color: #777;
  color: #fff;
}
</style>
