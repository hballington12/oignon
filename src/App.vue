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
import FloatingControls from '@/components/FloatingControls.vue'
import TutorialOverlay from '@/components/TutorialOverlay.vue'
import { TAB_HEIGHTS, TAB_BAR_HEIGHT, type TabId } from '@/types/mobile'
import { useGraphStore } from '@/stores/graph'
import { useMobile } from '@/composables/useMobile'
import { buildGraph, preprocessGraph } from '@/lib/graphBuilder'
import { getBackgroundColorHex, COLORMAPS } from '@/lib/colormap'

const store = useGraphStore()
const { isMobile } = useMobile()
const activeTab = ref<TabId | null>(null)
const customPanelHeights = ref<Partial<Record<TabId, number>>>({})
const isPanelDragging = ref(false)

// Year axis visibility (persisted)
const YEAR_AXIS_KEY = 'oignon:showYearAxis'
const showYearAxis = ref(localStorage.getItem(YEAR_AXIS_KEY) !== 'false')

function toggleYearAxis() {
  showYearAxis.value = !showYearAxis.value
  localStorage.setItem(YEAR_AXIS_KEY, String(showYearAxis.value))
}

function handleTabSelect(tab: TabId) {
  // Toggle off if tapping the same tab
  activeTab.value = activeTab.value === tab ? null : tab
}

function handlePanelHeightChange(height: number) {
  if (activeTab.value) {
    customPanelHeights.value[activeTab.value] = height
  }
}

function handlePanelDragStart() {
  isPanelDragging.value = true
}

function handlePanelDragEnd() {
  isPanelDragging.value = false
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
  const panelHeight = customPanelHeights.value[activeTab.value] ?? TAB_HEIGHTS[activeTab.value]
  return TAB_BAR_HEIGHT + panelHeight
})

const backgroundColor = computed(() => {
  const colormap = COLORMAPS[store.activeColormap]
  return colormap ? getBackgroundColorHex(colormap) : '#000000'
})
const graphCanvas = ref<InstanceType<typeof GraphCanvas> | null>(null)

// Load cached graph on startup (before mount)
store.loadFromCache()

function normalizeDoi(input: string): string {
  // Strip common DOI URL prefixes
  return input
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^https?:\/\/dx\.doi\.org\//i, '')
    .trim()
}

async function handleSearch(query: string) {
  const normalizedQuery = normalizeDoi(query)

  // Check if we have this graph cached (by sourceId or DOI)
  const cached = store.recentGraphs.find(
    (g) =>
      g.sourceId === normalizedQuery ||
      (g.doi && normalizeDoi(g.doi).toLowerCase() === normalizedQuery.toLowerCase()),
  )
  if (cached) {
    store.loadRecentGraph(cached.sourceId)
    return
  }

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

function handleZoomToSource() {
  const sourceNode = store.sourceNode
  if (sourceNode) {
    store.selectNode(sourceNode.id)
    graphCanvas.value?.zoomToNode(sourceNode.id)
  }
}

function handleScrollDetailsToTop() {
  const detailsPanel = document.getElementById('details-panel')
  if (detailsPanel) {
    detailsPanel.scrollTop = 0
  }
}

function handleBookmarkSource() {
  const sourceNode = store.sourceNode
  if (sourceNode && !store.isBookmarked(sourceNode.id)) {
    store.addBookmark({
      id: sourceNode.id,
      title: sourceNode.metadata.title || 'Untitled',
      firstAuthor: sourceNode.metadata.authors?.[0],
      year: sourceNode.order,
      citations: sourceNode.metadata.citationCount || 0,
      doi: sourceNode.metadata.doi,
      openAlexUrl: sourceNode.metadata.openAlexUrl,
    })
  }
}

function handleTutorialCleanup() {
  store.clearSelection()
  activeTab.value = null
  showYearAxis.value = true
  graphCanvas.value?.fitToView()
}

function handleSkipTutorial() {
  store.skipTutorial()
  handleTutorialCleanup()
}

function handleRestartTutorial() {
  store.resetTutorial()
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
      <GraphCanvas ref="graphCanvas" :show-year-axis="showYearAxis" />
      <FloatingControls
        v-if="isMobile"
        :show-year-axis="showYearAxis"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @fit-to-view="handleFitToView"
        @restart-tutorial="handleRestartTutorial"
        @toggle-year-axis="toggleYearAxis"
      />
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
    <div
      v-if="isMobile"
      class="mobile-bottom-area"
      :class="{ dragging: isPanelDragging }"
      :style="{ height: bottomAreaHeight + 'px' }"
    >
      <MobileInfoPanel
        :active-tab="activeTab"
        @colormap-change="handleColormapChange"
        @search="handleSearch"
        @show-details="activeTab = 'details'"
        @height-change="handlePanelHeightChange"
        @drag-start="handlePanelDragStart"
        @drag-end="handlePanelDragEnd"
        @collapse="activeTab = null"
      />
      <MobileTabBar :active-tab="activeTab" @select="handleTabSelect" />
    </div>

    <!-- Tutorial overlay -->
    <TutorialOverlay
      :visible="isMobile && store.tutorialStatus === 'pending'"
      :active-tab="activeTab"
      :skip-welcome="store.tutorialSkipWelcome"
      @start="store.completeTutorial()"
      @skip="handleSkipTutorial"
      @zoom-to-source="handleZoomToSource"
      @scroll-details-to-top="handleScrollDetailsToTop"
      @bookmark-source="handleBookmarkSource"
      @open-details-tab="activeTab = 'details'"
      @cleanup="handleTutorialCleanup"
    />
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

.mobile-bottom-area.dragging {
  transition: none;
}
</style>
