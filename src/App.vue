<script setup lang="ts">
import '@/assets/styles/variables.css'
import { ref, computed, watch } from 'vue'
import GraphCanvas from '@/components/GraphCanvas.vue'
import MobileTabBar from '@/components/MobileTabBar.vue'
import MobileInfoPanel from '@/components/MobileInfoPanel.vue'
import FloatingControls from '@/components/FloatingControls.vue'
import TutorialOverlay from '@/components/TutorialOverlay.vue'
import MobileSearchOverlay from '@/components/MobileSearchOverlay.vue'
import {
  TAB_HEIGHTS,
  TAB_WIDTHS,
  TAB_BAR_HEIGHT,
  TAB_BAR_WIDTH,
  TRANSITION_SMOOTH_MS,
  TRANSITION_SAFE_PADDING_MS,
  type TabId,
} from '@/types/mobile'
import type { Author } from '@/types'
import { useGraphStore } from '@/stores/graph'
import { buildGraph, buildAuthorGraph, preprocessGraph } from '@/lib/graphBuilder'
import { getBackgroundColorHex, COLORMAPS } from '@/lib/colormap'

const store = useGraphStore()
const activeTab = ref<TabId | null>(null)
const customPanelHeights = ref<Partial<Record<TabId, number>>>({})
const customPanelWidths = ref<Partial<Record<TabId, number>>>({})
const isPanelDragging = ref(false)

// Layout mode from store
const layoutMode = computed(() => store.layoutMode)
const effectiveLayoutMode = computed(() => store.effectiveLayoutMode)
const isLandscape = computed(() => effectiveLayoutMode.value === 'landscape')
const searchOverlayOpen = ref(false)
const pendingAuthorBuild = ref<Author | null>(null)
const showHelpHint = ref(false)
let helpHintTimer: ReturnType<typeof setTimeout> | null = null

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
    clearHelpHint()
    return
  }
  // Toggle off if tapping the same tab
  activeTab.value = activeTab.value === tab ? null : tab
}

function handlePanelSizeChange(size: number) {
  if (activeTab.value) {
    if (isLandscape.value) {
      customPanelWidths.value[activeTab.value] = size
    } else {
      customPanelHeights.value[activeTab.value] = size
    }
  }
}

function handlePanelDragStart() {
  isPanelDragging.value = true
}

function handlePanelDragEnd() {
  isPanelDragging.value = false
}

// Open search overlay when a build is triggered externally
watch(
  () => store.pendingBuildId,
  (newId) => {
    if (newId) {
      searchOverlayOpen.value = true
      // Trigger build with the pending ID
      handleSearch(newId)
      store.clearPendingBuild()
    }
  },
)

// Switch to details tab when a node is selected
watch(
  () => store.selectedNodes[0],
  (node) => {
    if (node) {
      activeTab.value = 'details'
    }
  },
)

// Side/bottom area size (height in portrait, width in landscape)
const sideAreaSize = computed(() => {
  if (isLandscape.value) {
    if (!activeTab.value) return TAB_BAR_WIDTH
    const panelWidth = customPanelWidths.value[activeTab.value] ?? TAB_WIDTHS[activeTab.value]
    return TAB_BAR_WIDTH + panelWidth
  } else {
    if (!activeTab.value) return TAB_BAR_HEIGHT
    const panelHeight = customPanelHeights.value[activeTab.value] ?? TAB_HEIGHTS[activeTab.value]
    return TAB_BAR_HEIGHT + panelHeight
  }
})

const backgroundColor = computed(() => {
  // Light mode: use off-white background
  if (!store.isDarkMode) {
    return '#f5f5f0'
  }
  // Dark mode: derive from colormap
  const colormap = COLORMAPS[store.activeColormap]
  return colormap ? getBackgroundColorHex(colormap) : '#000000'
})

const graphType = computed(() => store.graphType)

// Dynamic CSS variables based on colormap and theme
const colormapStyles = computed(() => {
  const bg = backgroundColor.value
  if (!store.isDarkMode) {
    // Light mode: use matching off-white panel backgrounds
    return {
      '--bg-colormap': bg,
      '--bg-panel-colormap': `${bg}f2`, // 95% opacity of #f5f5f0
      '--bg-panel-colormap-light': `${bg}cc`, // 80% opacity of #f5f5f0
    }
  }
  // Dark mode: derive from colormap
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
  // Wait for panel close animation before fitting to view
  setTimeout(
    () => graphCanvas.value?.fitToView(),
    TRANSITION_SMOOTH_MS + TRANSITION_SAFE_PADDING_MS,
  )
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
  startHelpHintTimer()
}

function startHelpHintTimer() {
  // Only show hint if user hasn't completed tutorial before and hasn't dismissed it
  if (localStorage.getItem('oignon:tutorial') === 'completed') return
  if (localStorage.getItem('oignon:helpHintDismissed') === 'true') return

  helpHintTimer = setTimeout(() => {
    // Only show if search hasn't been opened
    if (!searchOverlayOpen.value) {
      showHelpHint.value = true
    }
  }, 10000)
}

function clearHelpHint() {
  showHelpHint.value = false
  if (helpHintTimer) {
    clearTimeout(helpHintTimer)
    helpHintTimer = null
  }
}

function dismissHelpHintPermanently() {
  clearHelpHint()
  localStorage.setItem('oignon:helpHintDismissed', 'true')
}

function handleRestartTutorial() {
  clearHelpHint()
  store.resetTutorial()
}

function handleZoomOut() {
  graphCanvas.value?.zoomOut()
}

function handleColormapChange(index: number) {
  store.setColormap(index)
  graphCanvas.value?.setColormap(index)
}

function handleToggleTheme() {
  store.toggleTheme()
  graphCanvas.value?.setDarkMode(store.isDarkMode)
}

function handleToggleParticles() {
  store.toggleParticles()
  graphCanvas.value?.setParticlesVisible(store.particlesEnabled)
}
</script>

<template>
  <div
    class="app"
    :class="{ landscape: isLandscape, 'light-mode': !store.isDarkMode }"
    :style="{ background: backgroundColor, ...colormapStyles }"
  >
    <!-- Canvas area -->
    <div class="canvas-area">
      <GraphCanvas ref="graphCanvas" :show-year-axis="showYearAxis" />
      <FloatingControls
        :show-year-axis="showYearAxis"
        :graph-type="graphType"
        :show-help-hint="showHelpHint"
        :layout-mode="layoutMode"
        :is-dark-mode="store.isDarkMode"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @fit-to-view="handleFitToView"
        @restart-tutorial="handleRestartTutorial"
        @toggle-year-axis="toggleYearAxis"
        @zoom-to-source="handleZoomToSource"
        @dismiss-help-hint="dismissHelpHintPermanently"
        @toggle-layout-mode="store.toggleLayoutMode"
        @toggle-theme="handleToggleTheme"
      />
    </div>

    <!-- Side/bottom area -->
    <div
      class="mobile-side-area"
      :class="{ dragging: isPanelDragging, landscape: isLandscape }"
      :style="isLandscape ? { width: sideAreaSize + 'px' } : { height: sideAreaSize + 'px' }"
    >
      <MobileInfoPanel
        ref="mobileInfoPanel"
        :active-tab="activeTab"
        :layout-mode="effectiveLayoutMode"
        @colormap-change="handleColormapChange"
        @toggle-particles="handleToggleParticles"
        @search="handleSearch"
        @build-author="handleAuthorSearch"
        @confirm-build-author="handleAuthorClick"
        @show-details="activeTab = 'details'"
        @size-change="handlePanelSizeChange"
        @drag-start="handlePanelDragStart"
        @drag-end="handlePanelDragEnd"
        @collapse="activeTab = null"
      />
      <MobileTabBar
        :active-tab="activeTab"
        :layout-mode="effectiveLayoutMode"
        @select="handleTabSelect"
      />
    </div>

    <!-- Search overlay -->
    <MobileSearchOverlay
      :open="searchOverlayOpen"
      :colormap-color="backgroundColor"
      :tutorial-query="tutorialSearchQuery"
      :is-dark-mode="store.isDarkMode"
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
      :visible="store.tutorialStatus === 'pending'"
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
  display: flex;
  flex-direction: column;
  transition: background var(--transition-smooth);
}

.app.landscape {
  flex-direction: row;
}

.canvas-area {
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* Portrait mode (default) */
.mobile-side-area {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  transition: height var(--transition-smooth);
  padding-bottom: env(safe-area-inset-bottom);
}

/* Landscape mode */
.mobile-side-area.landscape {
  flex-direction: row;
  order: -1; /* Move to left side */
  transition: width var(--transition-smooth);
  padding-bottom: 0;
  padding-left: env(safe-area-inset-left);
}

.mobile-side-area.dragging {
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

/* Light mode overrides */
.app.light-mode {
  --text-primary: #1a1a1a;
  --text-secondary: rgba(0, 0, 0, 0.85);
  --text-tertiary: rgba(0, 0, 0, 0.75);
  --text-muted: rgba(0, 0, 0, 0.65);
  --text-dim: rgba(0, 0, 0, 0.55);
  --text-faint: rgba(0, 0, 0, 0.45);
  --text-placeholder: rgba(0, 0, 0, 0.5);

  --bg-panel: rgba(255, 255, 255, 0.7);
  --bg-panel-solid: rgba(245, 245, 240, 0.95);
  --bg-panel-colormap: rgba(255, 255, 255, 0.85);
  --bg-panel-colormap-light: rgba(255, 255, 255, 0.7);
  --bg-input: rgba(0, 0, 0, 0.06);
  --bg-input-focus: rgba(0, 0, 0, 0.1);
  --bg-item: rgba(0, 0, 0, 0.04);
  --bg-item-hover: rgba(0, 0, 0, 0.08);
  --bg-item-active: rgba(0, 0, 0, 0.12);

  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-light: rgba(0, 0, 0, 0.1);
  --border-medium: rgba(0, 0, 0, 0.15);
  --border-strong: rgba(0, 0, 0, 0.25);
  --border-focus: rgba(0, 0, 0, 0.4);

  --panel-bg: rgba(255, 255, 255, 0.7);
  --panel-border: rgba(0, 0, 0, 0.1);

  --btn-bg: rgba(0, 0, 0, 0.06);
  --btn-bg-hover: rgba(0, 0, 0, 0.1);
  --btn-bg-active: rgba(0, 0, 0, 0.14);
  --btn-border: rgba(0, 0, 0, 0.12);
  --btn-border-hover: rgba(0, 0, 0, 0.2);

  --shadow-panel: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
}
</style>
