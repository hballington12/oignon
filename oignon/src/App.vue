<script setup lang="ts">
import '@/assets/styles/variables.css'
import { ref, computed } from 'vue'
import GraphCanvas from '@/components/GraphCanvas.vue'
import SearchPanel from '@/components/SearchPanel.vue'
import ControlPanel from '@/components/ControlPanel.vue'
import PaperTooltip from '@/components/PaperTooltip.vue'
import PaperDetailsPanel from '@/components/PaperDetailsPanel.vue'
import { useGraphStore } from '@/stores/graph'
import { buildGraph, preprocessGraph } from '@/lib/graphBuilder'
import { getBackgroundColorHex, COLORMAPS } from '@/lib/colormap'

const store = useGraphStore()
const backgroundColor = computed(() => {
  const colormap = COLORMAPS[store.activeColormap]
  return colormap ? getBackgroundColorHex(colormap) : '#000000'
})
const graphCanvas = ref<InstanceType<typeof GraphCanvas> | null>(null)

// Load cached graph on startup (before mount)
store.loadFromCache()

async function handleSearch(query: string) {
  store.setLoading(true, { message: 'Starting...', percent: 0, completed: 0, total: 1 })

  try {
    const rawGraph = await buildGraph(query, {
      onProgress: (progress) => {
        store.setLoading(true, progress)
      },
    })

    const processed = preprocessGraph(rawGraph)
    store.loadGraph(processed)
    store.saveToCache()
  } catch (e) {
    console.error('Failed to build graph:', e)
    store.setLoading(false)
  }
}

function handleFitToView() {
  graphCanvas.value?.fitToView()
}

function handleZoomIn() {
  const v = store.viewport
  store.smoothZoom(v.scale * 1.2, window.innerWidth / 2, window.innerHeight / 2)
}

function handleZoomOut() {
  const v = store.viewport
  store.smoothZoom(v.scale / 1.2, window.innerWidth / 2, window.innerHeight / 2)
}

function handleColormapChange(index: number) {
  graphCanvas.value?.setColormap(index)
}
</script>

<template>
  <div class="app" :style="{ background: backgroundColor }">
    <GraphCanvas ref="graphCanvas" />
    <SearchPanel @search="handleSearch" />
    <ControlPanel
      @fit-to-view="handleFitToView"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @colormap-change="handleColormapChange"
    />
    <PaperTooltip />
    <PaperDetailsPanel />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
