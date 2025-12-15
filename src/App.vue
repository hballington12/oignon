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
import MobileSearchOverlay from '@/components/MobileSearchOverlay.vue'
import { TAB_HEIGHTS, TAB_BAR_HEIGHT, type TabId } from '@/types/mobile'
import type { Author } from '@/types'
import { useGraphStore } from '@/stores/graph'
import { useMobile } from '@/composables/useMobile'
import { buildGraph, buildAuthorGraph, preprocessGraph } from '@/lib/graphBuilder'
import { getBackgroundColorHex, COLORMAPS } from '@/lib/colormap'

const store = useGraphStore()
const { isMobile } = useMobile()
const activeTab = ref<TabId | null>(null)
const customPanelHeights = ref<Partial<Record<TabId, number>>>({})
const isPanelDragging = ref(false)
const searchOverlayOpen = ref(false)
const pendingAuthorBuild = ref<Author | null>(null)

// Year axis visibility (persisted)
const YEAR_AXIS_KEY = 'oignon:showYearAxis'
const showYearAxis = ref(localStorage.getItem(YEAR_AXIS_KEY) !== 'false')

function toggleYearAxis() {
  showYearAxis.value = !showYearAxis.value
  localStorage.setItem(YEAR_AXIS_KEY, String(showYearAxis.value))
}

function handleTabSelect(tab: TabId) {
  // Search tab opens the overlay instead of the panel
  if (tab === 'search') {
    // During tutorial, just set activeTab so tutorial can handle opening with pre-filled DOI
    if (store.tutorialStatus === 'pending') {
      activeTab.value = 'search'
      return
    }
    searchOverlayOpen.value = true
    return
  }
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

// Open search overlay on mobile when a build is triggered externally
watch(
  () => store.pendingBuildId,
  (newId) => {
    if (newId && isMobile.value) {
      searchOverlayOpen.value = true
      // Trigger build with the pending ID
      handleSearch(newId)
      store.clearPendingBuild()
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

const graphType = computed(() => store.graphType)

// Dynamic CSS variables based on colormap
const colormapStyles = computed(() => {
  const bg = backgroundColor.value
  return {
    '--bg-colormap': bg,
    '--bg-panel-colormap': `${bg}f2`, // 95% opacity
    '--bg-panel-colormap-light': `${bg}cc`, // 80% opacity
  }
})
const graphCanvas = ref<InstanceType<typeof GraphCanvas> | null>(null)
const mobileInfoPanel = ref<InstanceType<typeof MobileInfoPanel> | null>(null)
const tutorialSearchQuery = ref<string | undefined>(undefined)

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

function handleAuthorClick(author: Author) {
  pendingAuthorBuild.value = author
}

function confirmAuthorBuild() {
  if (pendingAuthorBuild.value?.id) {
    const authorId = pendingAuthorBuild.value.id
    const cacheKey = `author:${authorId}`
    const isCached = store.recentGraphs.some((g) => g.sourceId === cacheKey)
    if (!isCached) {
      searchOverlayOpen.value = true
    }
    handleAuthorSearch(authorId)
  }
  pendingAuthorBuild.value = null
}

function cancelAuthorBuild() {
  pendingAuthorBuild.value = null
}

async function handleAuthorSearch(authorId: string) {
  // Check if we have this author graph cached
  const cacheKey = `author:${authorId}`
  const cached = store.recentGraphs.find((g) => g.sourceId === cacheKey)
  if (cached) {
    store.loadRecentGraph(cached.sourceId)
    return
  }

  store.setLoading(true, { message: 'Starting...', percent: 0, completed: 0, total: 1 })

  try {
    const rawGraph = await buildAuthorGraph(authorId, {
      onProgress: (progress) => {
        store.setLoading(true, progress)
      },
    })

    const processed = preprocessGraph(rawGraph)
    store.loadGraph(processed)
    store.saveToCache()

    // Add to recent graphs (using author info from metadata)
    if (rawGraph.metadata.author_name) {
      store.addRecentGraph(
        `author:${rawGraph.metadata.author_id}`,
        rawGraph.metadata.author_name,
        processed.nodes.length,
        rawGraph.metadata.author_affiliation,
        undefined, // no year for author graphs
        undefined, // no DOI
        undefined, // no OpenAlex URL for now
      )
    }
  } catch (e) {
    console.error('Failed to build author graph:', e)
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
  customPanelHeights.value = {}
  tutorialSearchQuery.value = undefined
  searchOverlayOpen.value = false
  mobileInfoPanel.value?.resetHeights()
  graphCanvas.value?.fitToView()
}

function handleTutorialOpenSearch(doi: string) {
  tutorialSearchQuery.value = doi
  searchOverlayOpen.value = true
}

function handleSearchOverlayClose() {
  searchOverlayOpen.value = false
  tutorialSearchQuery.value = undefined
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
  <div
    class="app"
    :class="{ mobile: isMobile }"
    :style="{ background: backgroundColor, ...colormapStyles }"
  >
    <!-- Canvas area (shared between layouts) -->
    <div class="canvas-area">
      <GraphCanvas ref="graphCanvas" :show-year-axis="showYearAxis" />
      <FloatingControls
        v-if="isMobile"
        :show-year-axis="showYearAxis"
        :graph-type="graphType"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @fit-to-view="handleFitToView"
        @restart-tutorial="handleRestartTutorial"
        @toggle-year-axis="toggleYearAxis"
        @zoom-to-source="handleZoomToSource"
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
        ref="mobileInfoPanel"
        :active-tab="activeTab"
        @colormap-change="handleColormapChange"
        @search="handleSearch"
        @build-author="handleAuthorClick"
        @show-details="activeTab = 'details'"
        @height-change="handlePanelHeightChange"
        @drag-start="handlePanelDragStart"
        @drag-end="handlePanelDragEnd"
        @collapse="activeTab = null"
      />
      <MobileTabBar :active-tab="activeTab" @select="handleTabSelect" />
    </div>

    <!-- Mobile search overlay -->
    <MobileSearchOverlay
      v-if="isMobile"
      :open="searchOverlayOpen"
      :colormap-color="backgroundColor"
      :tutorial-query="tutorialSearchQuery"
      @close="handleSearchOverlayClose"
      @build="handleSearch"
      @build-author="handleAuthorSearch"
    />

    <!-- Author build confirmation modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="pendingAuthorBuild"
          class="author-confirm-overlay"
          @click.self="cancelAuthorBuild"
        >
          <div class="author-confirm-modal">
            <p class="author-confirm-text">
              Build author graph for <strong>{{ pendingAuthorBuild.name }}</strong
              >?
            </p>
            <div class="author-confirm-buttons">
              <button class="confirm-btn cancel" @click="cancelAuthorBuild">Cancel</button>
              <button class="confirm-btn confirm" @click="confirmAuthorBuild">Build</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
      @open-search="handleTutorialOpenSearch"
      @close-search="handleSearchOverlayClose"
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
  overflow: hidden;
}

.mobile-bottom-area {
  flex-shrink: 0;
  transition: height var(--transition-smooth);
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-bottom-area.dragging {
  transition: none;
}

/* Author confirmation modal */
.author-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-lg);
}

.author-confirm-modal {
  border-radius: 16px;
  padding: var(--spacing-lg);
  max-width: 320px;
  width: 100%;
  border: 1px solid var(--border-light);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.author-confirm-text {
  color: var(--text-primary);
  font-size: var(--font-size-base);
  text-align: center;
  margin-bottom: var(--spacing-lg);
  line-height: 1.5;
}

.author-confirm-text strong {
  color: var(--text-primary);
}

.author-confirm-buttons {
  display: flex;
  gap: var(--spacing-sm);
}

.confirm-btn {
  flex: 1;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.confirm-btn.cancel {
  background: var(--bg-panel-solid);
  color: var(--text-secondary);
}

.confirm-btn.cancel:hover {
  background: var(--bg-item-hover);
}

.confirm-btn.confirm {
  background: var(--accent-green);
  color: #000;
  border-color: var(--accent-green);
}

.confirm-btn.confirm:hover {
  filter: brightness(1.1);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
