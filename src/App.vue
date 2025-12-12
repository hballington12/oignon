<script setup lang="ts">
import '@/assets/styles/variables.css'
import { ref, computed, watch } from 'vue'
import GraphCanvas from '@/components/GraphCanvas.vue'
import SearchPanel from '@/components/SearchPanel.vue'
import ControlPanel from '@/components/ControlPanel.vue'
import PaperTooltip from '@/components/PaperTooltip.vue'
import PaperDetailsPanel from '@/components/PaperDetailsPanel.vue'
import LibraryPanel from '@/components/LibraryPanel.vue'
import MobileTabBar from '@/components/MobileTabBar.vue'
import MobileInfoPanel from '@/components/MobileInfoPanel.vue'
import { TAB_HEIGHTS, TAB_BAR_HEIGHT, type TabId } from '@/types/mobile'
import { useGraphStore } from '@/stores/graph'
import { useMobile } from '@/composables/useMobile'
import { buildGraph, preprocessGraph } from '@/lib/graphBuilder'
import { getBackgroundColorHex, COLORMAPS } from '@/lib/colormap'

const store = useGraphStore()
const { isMobile } = useMobile()
const activeTab = ref<TabId | null>(null)

function handleTabSelect(tab: TabId) {
  // Toggle off if tapping the same tab
  activeTab.value = activeTab.value === tab ? null : tab
}

// Switch to search tab on mobile when a build is triggered
watch(
  () => store.pendingBuildId,
  (newId) => {
    if (newId && isMobile.value) {
      activeTab.value = 'search'
    }
  },
)

// Switch to details tab on mobile when a node is selected
watch(
  () => store.selectedNodes[0],
  (node) => {
    if (node && isMobile.value) {
      activeTab.value = 'details'
    }
  },
)

const bottomAreaHeight = computed(() => {
  if (!activeTab.value) return TAB_BAR_HEIGHT
  return TAB_BAR_HEIGHT + TAB_HEIGHTS[activeTab.value]
})

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

    // Add to recent graphs
    const sourceNode = processed.nodes.find((n) => n.metadata.isSource)
    if (sourceNode) {
      store.addRecentGraph(
        sourceNode.id,
        sourceNode.metadata.title,
        processed.nodes.length,
        sourceNode.metadata.authors?.[0],
        sourceNode.order,
        sourceNode.metadata.doi,
        sourceNode.metadata.openAlexUrl,
      )
    }
  } catch (e) {
    console.error('Failed to build graph:', e)
    store.setLoading(false)
  }
}

function handleFitToView() {
  graphCanvas.value?.fitToView()
}

function handleZoomIn() {
  graphCanvas.value?.zoomIn()
}

function handleZoomOut() {
  graphCanvas.value?.zoomOut()
}

function handleColormapChange(index: number) {
  store.setColormap(index)
  graphCanvas.value?.setColormap(index)
}
</script>

<template>
  <div class="app" :class="{ mobile: isMobile }" :style="{ background: backgroundColor }">
    <!-- Canvas area (shared between layouts) -->
    <div class="canvas-area">
      <GraphCanvas ref="graphCanvas" />
    </div>

    <!-- Desktop panels -->
    <template v-if="!isMobile">
      <SearchPanel @search="handleSearch" />
      <ControlPanel
        @fit-to-view="handleFitToView"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @colormap-change="handleColormapChange"
      />
      <PaperTooltip />
      <PaperDetailsPanel />
      <LibraryPanel />
    </template>

    <!-- Mobile bottom area -->
    <div v-if="isMobile" class="mobile-bottom-area" :style="{ height: bottomAreaHeight + 'px' }">
      <MobileInfoPanel
        :active-tab="activeTab"
        @colormap-change="handleColormapChange"
        @search="handleSearch"
        @show-details="activeTab = 'details'"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @fit-to-view="handleFitToView"
      />
      <MobileTabBar :active-tab="activeTab" @select="handleTabSelect" />
    </div>
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

/* Canvas area - full size on desktop, flex on mobile */
.canvas-area {
  position: absolute;
  inset: 0;
}

/* Mobile flexbox layout */
.app.mobile {
  display: flex;
  flex-direction: column;
}

.app.mobile .canvas-area {
  position: relative;
  flex: 1;
  min-height: 0;
}

.mobile-bottom-area {
  flex-shrink: 0;
  transition: height var(--transition-smooth);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
