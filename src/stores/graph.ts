import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ProcessedGraph,
  GraphNode,
  VisualNode,
  ViewportState,
  ViewportLimits,
  BuildProgress,
  SlimCache,
  PaperMetadata,
  BookmarkedPaper,
  FollowedAuthor,
  RecentGraph,
} from '@/types'
import type { LayoutMode } from '@/types/mobile'
import { hydrateMetadata, fetchPaper, fetchAuthor } from '@/lib/graphBuilder'
import {
  DEFAULT_DISABLED_BUCKETS,
  type WorkTypeBucket,
} from '@/lib/workTypes'
import { analytics } from '@/composables/usePostHog'

export const useGraphStore = defineStore('graph', () => {
  // Graph data
  const graph = ref<ProcessedGraph | null>(null)
  const nodes = ref<Map<string, VisualNode>>(new Map())

  // Grid dimensions
  const rows = ref(0)
  const cols = ref(0)
  const uniqueOrders = ref<number[]>([])
  const orderToRow = ref<Record<number, number>>({})

  // Viewport state
  const viewport = ref<ViewportState>({
    scale: 1,
    targetScale: 1,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    animating: false,
  })

  const viewportLimits = ref<ViewportLimits>({
    minScale: 0.5,
    maxScale: 4,
    defaultScale: 1,
  })

  // Selection
  const selectedNodeIds = ref<Set<string>>(new Set())
  const hoveredNodeId = ref<string | null>(null)

  // UI state
  const activeColormap = ref<number>(7) // Ocean
  const sidePanelCollapsed = ref(true)
  const searchPanelCollapsed = ref(false)
  const detailsPanelCollapsed = ref(false)
  const loading = ref(false)
  const loadingProgress = ref<BuildProgress | null>(null)
  const pendingBuildId = ref<string | null>(null)
  const hydratingMetadata = ref(false)

  // Standalone paper display (for bookmarks not in current graph)
  const standalonePaper = ref<VisualNode | null>(null)
  const loadingStandalone = ref(false)

  // Tutorial state: 'pending' | 'completed' | 'skipped'
  const tutorialStatus = ref<'pending' | 'completed' | 'skipped'>('pending')

  // Layout mode: 'auto' | 'portrait' | 'landscape'
  const layoutMode = ref<LayoutMode>('auto')

  // Theme mode: dark (true) or light (false)
  const isDarkMode = ref(false)

  // Particles enabled (only visible in dark mode)
  const particlesEnabled = ref(true)

  // Disabled work-type buckets (e.g. preprint, peer-review).
  // Nodes whose mapped bucket is in this set fade out in the renderer.
  const disabledTypeBuckets = ref<Set<WorkTypeBucket>>(new Set(DEFAULT_DISABLED_BUCKETS))

  // Screen orientation for auto mode
  const screenIsLandscape = ref(false)

  // Detect screen orientation
  function updateScreenOrientation() {
    screenIsLandscape.value = window.matchMedia('(orientation: landscape)').matches
  }

  // Initialize orientation detection
  if (typeof window !== 'undefined') {
    updateScreenOrientation()
    window
      .matchMedia('(orientation: landscape)')
      .addEventListener('change', updateScreenOrientation)
  }

  // Effective layout mode resolves 'auto' to actual orientation
  const effectiveLayoutMode = computed(() => {
    if (layoutMode.value === 'auto') {
      return screenIsLandscape.value ? 'landscape' : 'portrait'
    }
    return layoutMode.value
  })

  // Cache keys
  const CACHE_KEY = 'oignon_graph_cache'
  const BOOKMARKS_KEY = 'oignon_bookmarks'
  const FOLLOWED_AUTHORS_KEY = 'oignon_followed_authors'
  const RECENT_GRAPHS_KEY = 'oignon_recent_graphs'
  const COLORMAP_KEY = 'oignon_colormap'
  const TUTORIAL_KEY = 'oignon_tutorial'
  const LAYOUT_MODE_KEY = 'oignon:layoutMode'
  const THEME_KEY = 'oignon:theme'
  const TYPE_FILTER_KEY = 'oignon:disabledTypeBuckets'
  const MAX_RECENT_GRAPHS = 10

  // Library state
  const bookmarkedPapers = ref<BookmarkedPaper[]>([])
  const followedAuthors = ref<FollowedAuthor[]>([])
  const recentGraphs = ref<RecentGraph[]>([])

  // In-memory metadata cache (session-only, not persisted)
  // Stores full paper metadata for bookmarks to avoid re-fetching
  const metadataCache = new Map<string, PaperMetadata>()

  // Load library data and preferences from localStorage on init
  function loadLibraryData() {
    try {
      const bookmarks = localStorage.getItem(BOOKMARKS_KEY)
      if (bookmarks) {
        bookmarkedPapers.value = JSON.parse(bookmarks)
      }
      const authors = localStorage.getItem(FOLLOWED_AUTHORS_KEY)
      if (authors) {
        followedAuthors.value = JSON.parse(authors)
      }
      const recent = localStorage.getItem(RECENT_GRAPHS_KEY)
      if (recent) {
        recentGraphs.value = JSON.parse(recent)
      }
      const colormap = localStorage.getItem(COLORMAP_KEY)
      if (colormap !== null) {
        activeColormap.value = parseInt(colormap, 10)
      }
      const tutorial = localStorage.getItem(TUTORIAL_KEY)
      const loadTutorialStatus = import.meta.env.VITE_FORCE_NEW_USER !== 'true'
      if (tutorial !== null && loadTutorialStatus) {
        tutorialStatus.value = tutorial as 'pending' | 'completed' | 'skipped'
      }
      const savedLayoutMode = localStorage.getItem(LAYOUT_MODE_KEY)
      if (savedLayoutMode === 'portrait' || savedLayoutMode === 'landscape') {
        layoutMode.value = savedLayoutMode
      }
      // 'auto' is the default, so no need to explicitly set it

      const savedTheme = localStorage.getItem(THEME_KEY)
      if (savedTheme !== null) {
        isDarkMode.value = savedTheme === 'dark'
      }

      const savedFilter = localStorage.getItem(TYPE_FILTER_KEY)
      if (savedFilter !== null) {
        try {
          const parsed = JSON.parse(savedFilter) as unknown
          if (Array.isArray(parsed)) {
            disabledTypeBuckets.value = new Set(parsed as WorkTypeBucket[])
          }
        } catch {
          // ignore malformed value, fall back to defaults
        }
      }
    } catch (e) {
      console.warn('Failed to load library data:', e)
    }
  }

  // Save library data to localStorage
  function saveBookmarks() {
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarkedPapers.value))
    } catch (e) {
      console.warn('Failed to save bookmarks:', e)
    }
  }

  function saveFollowedAuthors() {
    try {
      localStorage.setItem(FOLLOWED_AUTHORS_KEY, JSON.stringify(followedAuthors.value))
    } catch (e) {
      console.warn('Failed to save followed authors:', e)
    }
  }

  function saveRecentGraphs() {
    try {
      localStorage.setItem(RECENT_GRAPHS_KEY, JSON.stringify(recentGraphs.value))
    } catch (e) {
      console.warn('Failed to save recent graphs:', e)
    }
  }

  function completeTutorial() {
    tutorialStatus.value = 'completed'
    tutorialSkipWelcome.value = false
    localStorage.setItem(TUTORIAL_KEY, 'completed')
  }

  function skipTutorial() {
    tutorialStatus.value = 'skipped'
    tutorialSkipWelcome.value = false
    localStorage.setItem(TUTORIAL_KEY, 'skipped')
  }

  const tutorialSkipWelcome = ref(false)

  function resetTutorial() {
    tutorialSkipWelcome.value = true
    tutorialStatus.value = 'pending'
    // Keep localStorage as 'completed' or 'skipped' - user has seen tutorial before
    // On next page load, they won't see welcome message
    // We just reset in-memory state so they can replay the tutorial this session
  }

  // Layout mode actions
  function setLayoutMode(mode: LayoutMode) {
    layoutMode.value = mode
    localStorage.setItem(LAYOUT_MODE_KEY, mode)
  }

  function toggleLayoutMode() {
    // Cycle: auto → portrait → landscape → auto
    const cycle: LayoutMode[] = ['auto', 'portrait', 'landscape']
    const currentIndex = cycle.indexOf(layoutMode.value)
    const nextIndex = (currentIndex + 1) % cycle.length
    setLayoutMode(cycle[nextIndex] ?? 'auto')
  }

  // Theme mode actions
  function toggleTheme() {
    isDarkMode.value = !isDarkMode.value
    localStorage.setItem(THEME_KEY, isDarkMode.value ? 'dark' : 'light')
  }

  // Particles toggle
  function toggleParticles() {
    particlesEnabled.value = !particlesEnabled.value
  }

  // Type-bucket filter toggle. Returns the new set so consumers can re-trigger
  // reactive watchers if needed.
  function toggleTypeBucket(bucket: WorkTypeBucket) {
    const next = new Set(disabledTypeBuckets.value)
    if (next.has(bucket)) {
      next.delete(bucket)
    } else {
      next.add(bucket)
    }
    disabledTypeBuckets.value = next
    try {
      localStorage.setItem(TYPE_FILTER_KEY, JSON.stringify([...next]))
    } catch (e) {
      console.warn('Failed to save type filter:', e)
    }
  }

  // Initialize library on store creation
  loadLibraryData()

  // Computed
  const hasGraph = computed(() => graph.value !== null && nodes.value.size > 0)

  const sourceNode = computed(() => {
    for (const node of nodes.value.values()) {
      if (node.metadata?.isSource) return node
    }
    return null
  })

  const graphMetadata = computed(() => graph.value?.metadata)
  const graphType = computed(() => graph.value?.graphType)
  const isAuthorGraph = computed(() => graph.value?.graphType === 'author')
  const isMultiGraph = computed(() => graph.value?.graphType === 'multi')

  const sourceNodes = computed(() => {
    const result: VisualNode[] = []
    for (const node of nodes.value.values()) {
      if (node.metadata?.isSource) result.push(node)
    }
    return result
  })

  const selectedNodes = computed(() => {
    const result: VisualNode[] = []
    for (const id of selectedNodeIds.value) {
      const node = nodes.value.get(id)
      if (node) result.push(node)
    }
    return result
  })

  // Actions
  function loadGraph(data: ProcessedGraph) {
    clearGraph()
    graph.value = data

    // Calculate grid dimensions
    const orderCounts: Record<number, number> = {}
    data.nodes.forEach((node) => {
      const order = node.order ?? 0
      orderCounts[order] = (orderCounts[order] || 0) + 1
    })

    uniqueOrders.value = Object.keys(orderCounts)
      .map(Number)
      .filter((k) => !isNaN(k))
      .sort((a, b) => a - b)

    rows.value = uniqueOrders.value.length
    cols.value = Math.max(...Object.values(orderCounts), 0)

    // Map order values to row indices (highest order at top = row 0)
    orderToRow.value = {}
    uniqueOrders.value.forEach((order, i) => {
      orderToRow.value[order] = rows.value - 1 - i
    })

    loading.value = false
    loadingProgress.value = null
  }

  function clearGraph() {
    graph.value = null
    nodes.value = new Map()
    rows.value = 0
    cols.value = 0
    uniqueOrders.value = []
    orderToRow.value = {}
    selectedNodeIds.value = new Set()
    hoveredNodeId.value = null
    standalonePaper.value = null
  }

  function setNode(id: string, node: VisualNode) {
    nodes.value.set(id, node)
  }

  function selectNode(id: string, additive = false) {
    // Clear standalone paper when selecting a graph node
    standalonePaper.value = null

    if (!additive) {
      selectedNodeIds.value = new Set([id])
      // Focus details panel when selecting a single node
      focusDetailsPanel()
    } else {
      const newSet = new Set(selectedNodeIds.value)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      selectedNodeIds.value = newSet
    }
  }

  function clearSelection() {
    selectedNodeIds.value = new Set()
    // Also clear standalone paper (same behavior as deselecting a graph node)
    standalonePaper.value = null
  }

  function setHoveredNode(id: string | null) {
    hoveredNodeId.value = id
  }

  // Viewport actions
  function setViewport(state: Partial<ViewportState>) {
    viewport.value = { ...viewport.value, ...state }
  }

  function smoothZoom(newScale: number, centerX: number, centerY: number) {
    const worldX = (centerX - viewport.value.x) / viewport.value.scale
    const worldY = (centerY - viewport.value.y) / viewport.value.scale

    const clampedScale = Math.max(
      viewportLimits.value.minScale,
      Math.min(viewportLimits.value.maxScale, newScale),
    )

    viewport.value.targetScale = clampedScale
    viewport.value.targetX = centerX - worldX * clampedScale
    viewport.value.targetY = centerY - worldY * clampedScale
    viewport.value.animating = true
  }

  function smoothPan(dx: number, dy: number) {
    viewport.value.targetX += dx
    viewport.value.targetY += dy
    viewport.value.animating = true
  }

  function snapViewport() {
    if (!viewport.value.animating) return
    viewport.value.targetScale = viewport.value.scale
    viewport.value.targetX = viewport.value.x
    viewport.value.targetY = viewport.value.y
    viewport.value.animating = false
  }

  // UI actions
  function setColormap(colormap: number) {
    activeColormap.value = colormap
    localStorage.setItem(COLORMAP_KEY, String(colormap))
  }

  function toggleSidePanel() {
    sidePanelCollapsed.value = !sidePanelCollapsed.value
  }

  // Focus on details panel (expand it, collapse search)
  function focusDetailsPanel() {
    detailsPanelCollapsed.value = false
    searchPanelCollapsed.value = true
  }

  function setLoading(isLoading: boolean, progress?: BuildProgress) {
    loading.value = isLoading
    loadingProgress.value = progress ?? null
  }

  function triggerBuild(nodeId: string) {
    // Check if we already have this graph in the recent graphs cache
    // Match by sourceId or by DOI
    const cached = recentGraphs.value.find(
      (g) => g.sourceId === nodeId || (g.doi && g.doi === nodeId),
    )
    if (cached) {
      // Load from cache instead of rebuilding
      loadRecentGraph(cached.sourceId)
      return
    }

    // Otherwise trigger a fresh build
    pendingBuildId.value = nodeId
  }

  function clearPendingBuild() {
    pendingBuildId.value = null
  }

  // Convert OpenAlex ID to numeric (strip "W" prefix)
  function toNumericId(id: string): number {
    return parseInt(id.slice(1), 10)
  }

  // Convert numeric ID back to OpenAlex format
  function toStringId(id: number): string {
    return `W${id}`
  }

  function buildSlimCache(): SlimCache {
    if (!graph.value) {
      return { slim: true, nodes: [] }
    }

    const isAuthor = graph.value.graphType === 'author'
    const isMulti = graph.value.graphType === 'multi'

    // Find the source node(s) (only for paper and multi graphs)
    const sources = !isAuthor ? graph.value.nodes.filter((n) => n.metadata?.isSource) : []

    return {
      slim: true,
      nodes: graph.value.nodes.map((node) => ({
        id: toNumericId(node.id),
        order: node.order,
        connections: node.connections.map(toNumericId),
      })),
      graphType: graph.value.graphType,
      sourceId: !isMulti && sources[0] ? toNumericId(sources[0].id) : undefined,
      sourceIds: isMulti ? sources.map((n) => toNumericId(n.id)) : undefined,
      authorId: isAuthor ? graph.value.metadata?.author_id : undefined,
    }
  }

  function loadSlimCache(slimCache: SlimCache) {
    const nodeMap = new Map<string, GraphNode>()
    const sourceIdSet = new Set<string>()
    if (slimCache.sourceId) sourceIdSet.add(toStringId(slimCache.sourceId))
    for (const id of slimCache.sourceIds || []) sourceIdSet.add(toStringId(id))

    // First pass: create nodes with empty citedBy
    for (const node of slimCache.nodes) {
      const id = toStringId(node.id)
      const isSource = sourceIdSet.has(id)
      nodeMap.set(id, {
        id,
        order: node.order,
        connections: node.connections.map(toStringId),
        citedBy: [],
        metadata: {
          title: 'Loading...',
          authors: [],
          citationCount: 0,
          isSource,
        },
      })
    }

    // Second pass: rebuild citedBy from connections
    for (const node of nodeMap.values()) {
      for (const connId of node.connections) {
        const targetNode = nodeMap.get(connId)
        if (targetNode) {
          targetNode.citedBy.push(node.id)
        }
      }
    }

    const fullNodes = Array.from(nodeMap.values())
    loadGraph({ nodes: fullNodes, graphType: slimCache.graphType })

    // Hydrate metadata in background (skip in dev if flag is set)
    if (import.meta.env.VITE_DEV_SKIP_HYDRATION !== 'true') {
      // For author graphs, hydrate author metadata; for paper graphs, hydrate node metadata
      if (slimCache.graphType === 'author' && slimCache.authorId) {
        runAuthorHydration(slimCache.authorId)
      }
      const nodeIds = fullNodes.map((n) => n.id)
      runMetadataHydration(nodeIds)
    }
  }

  function saveToCache() {
    if (!graph.value) return
    try {
      const slimCache = buildSlimCache()
      const json = JSON.stringify(slimCache)
      localStorage.setItem(CACHE_KEY, json)
    } catch (e) {
      console.warn('Failed to cache graph:', e)
    }
  }

  function loadFromCache(): boolean {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return false
      const data = JSON.parse(cached)
      if (!data?.nodes) return false

      if (data.slim) {
        loadSlimCache(data as SlimCache)
      } else {
        // Full cache (legacy): load directly
        loadGraph(data)
      }
      return true
    } catch (e) {
      console.warn('Failed to load cached graph:', e)
    }
    return false
  }

  async function runMetadataHydration(nodeIds: string[]) {
    hydratingMetadata.value = true

    try {
      const metadata = await hydrateMetadata(nodeIds)

      // Update visual nodes in the map (this is what the UI reads from)
      for (const [id, node] of nodes.value) {
        const meta = metadata[id]
        if (meta) {
          node.metadata = { ...node.metadata, ...meta }
        }
      }

      // Trigger reactivity by reassigning the map
      nodes.value = new Map(nodes.value)
    } catch (e) {
      console.warn('Failed to hydrate metadata:', e)
    } finally {
      hydratingMetadata.value = false
    }
  }

  async function runAuthorHydration(authorId: string) {
    hydratingMetadata.value = true

    try {
      const author = await fetchAuthor(authorId)
      if (author && graph.value) {
        // Update graph metadata with author info
        graph.value.metadata = {
          ...graph.value.metadata,
          graph_type: 'author',
          author_id: author.id,
          author_name: author.display_name,
          author_orcid: author.orcid || undefined,
          author_affiliation: author.affiliation || undefined,
          author_works_count: author.works_count,
          author_cited_by_count: author.cited_by_count,
          author_h_index: author.h_index,
          author_i10_index: author.i10_index,
          papers_in_graph: graph.value.nodes.length,
          edges_in_graph: graph.value.metadata?.edges_in_graph ?? 0,
          build_time_seconds: graph.value.metadata?.build_time_seconds ?? 0,
          timestamp: graph.value.metadata?.timestamp ?? new Date().toISOString(),
        }
      }
    } catch (e) {
      console.warn('Failed to hydrate author metadata:', e)
    } finally {
      hydratingMetadata.value = false
    }
  }

  function clearCache() {
    localStorage.removeItem(CACHE_KEY)
  }

  // Library actions - Bookmarks
  function addBookmark(paper: {
    id: string
    title: string
    firstAuthor?: string
    year?: number
    citations: number
    doi?: string
    openAlexUrl?: string
  }) {
    // Don't add if already bookmarked
    if (bookmarkedPapers.value.some((b) => b.id === paper.id)) return

    bookmarkedPapers.value.unshift({
      ...paper,
      addedAt: Date.now(),
    })
    saveBookmarks()
    analytics.paperBookmarked()
  }

  function removeBookmark(id: string) {
    bookmarkedPapers.value = bookmarkedPapers.value.filter((b) => b.id !== id)
    saveBookmarks()
  }

  function clearBookmarks() {
    bookmarkedPapers.value = []
    saveBookmarks()
  }

  function isBookmarked(id: string): boolean {
    return bookmarkedPapers.value.some((b) => b.id === id)
  }

  // Library actions - Followed Authors
  function followAuthor(author: {
    id: string
    displayName: string
    affiliation?: string
    orcid?: string
    worksCount: number
    citedByCount: number
    hIndex: number
  }) {
    // Don't add if already following
    if (followedAuthors.value.some((a) => a.id === author.id)) return

    followedAuthors.value.unshift({
      ...author,
      addedAt: Date.now(),
    })
    saveFollowedAuthors()
  }

  function unfollowAuthor(id: string) {
    followedAuthors.value = followedAuthors.value.filter((a) => a.id !== id)
    saveFollowedAuthors()
  }

  function clearFollowedAuthors() {
    followedAuthors.value = []
    saveFollowedAuthors()
  }

  function isFollowingAuthor(id: string): boolean {
    return followedAuthors.value.some((a) => a.id === id)
  }

  // Select a bookmarked paper - either from graph or fetch standalone
  // Helper to build a standalone VisualNode from cached metadata
  function buildStandaloneNode(id: string, metadata: PaperMetadata, year: number): VisualNode {
    return {
      id,
      order: year,
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      radius: 10,
      normalizedCitations: 0,
      fillColor: 0xffffff,
      strokeColor: 0xffffff,
      connections: [],
      citedBy: [],
      metadata,
    }
  }

  async function selectBookmarkedPaper(id: string) {
    // Clear any existing standalone paper
    standalonePaper.value = null

    // If node exists in current graph, just select it
    if (nodes.value.has(id)) {
      selectNode(id)
      return
    }

    // Check in-memory cache first
    const cached = metadataCache.get(id)
    if (cached) {
      selectedNodeIds.value = new Set()
      const bookmark = bookmarkedPapers.value.find((b) => b.id === id)
      standalonePaper.value = buildStandaloneNode(id, cached, bookmark?.year ?? 0)
      focusDetailsPanel()
      return
    }

    // Otherwise, fetch from OpenAlex and cache the result
    loadingStandalone.value = true
    try {
      const paper = await fetchPaper(id)
      if (paper) {
        // Clear graph selection first (before setting standalone)
        selectedNodeIds.value = new Set()

        const metadata: PaperMetadata = {
          ...paper.metadata,
          isSource: false,
        }

        // Cache it for this session
        metadataCache.set(id, metadata)

        standalonePaper.value = buildStandaloneNode(id, metadata, paper.year)
        focusDetailsPanel()
      }
    } catch (e) {
      console.warn('Failed to fetch bookmarked paper:', e)
    } finally {
      loadingStandalone.value = false
    }
  }

  function clearStandalonePaper() {
    standalonePaper.value = null
  }

  // Library actions - Recent Graphs
  function addRecentGraph(
    sourceId: string,
    title: string,
    nodeCount: number,
    firstAuthor?: string,
    year?: number,
    doi?: string,
    openAlexUrl?: string,
  ) {
    // Build slim cache from current graph
    const cache = buildSlimCache()

    // Remove existing entry for same source
    recentGraphs.value = recentGraphs.value.filter((g) => g.sourceId !== sourceId)

    // Add to front
    recentGraphs.value.unshift({
      sourceId,
      title,
      firstAuthor,
      year,
      nodeCount,
      doi,
      openAlexUrl,
      timestamp: new Date().toLocaleDateString(),
      addedAt: Date.now(),
      cache,
    })

    // Keep only MAX_RECENT_GRAPHS
    if (recentGraphs.value.length > MAX_RECENT_GRAPHS) {
      recentGraphs.value = recentGraphs.value.slice(0, MAX_RECENT_GRAPHS)
    }

    saveRecentGraphs()
  }

  function loadRecentGraph(sourceId: string) {
    const recent = recentGraphs.value.find((g) => g.sourceId === sourceId)
    if (!recent) return

    // Load directly from cached slim data
    loadSlimCache(recent.cache)

    // Also update the main cache
    localStorage.setItem(CACHE_KEY, JSON.stringify(recent.cache))

    // Focus details panel to show the source node
    focusDetailsPanel()
  }

  function removeRecentGraph(sourceId: string) {
    recentGraphs.value = recentGraphs.value.filter((g) => g.sourceId !== sourceId)
    saveRecentGraphs()
  }

  function clearRecentGraphs() {
    recentGraphs.value = []
    saveRecentGraphs()
  }

  return {
    // State
    graph,
    nodes,
    rows,
    cols,
    uniqueOrders,
    orderToRow,
    viewport,
    viewportLimits,
    selectedNodeIds,
    hoveredNodeId,
    activeColormap,
    sidePanelCollapsed,
    searchPanelCollapsed,
    detailsPanelCollapsed,
    loading,
    loadingProgress,
    pendingBuildId,
    hydratingMetadata,
    bookmarkedPapers,
    followedAuthors,
    recentGraphs,
    standalonePaper,
    loadingStandalone,

    // Computed
    hasGraph,
    sourceNode,
    sourceNodes,
    selectedNodes,
    graphMetadata,
    graphType,
    isAuthorGraph,
    isMultiGraph,

    // Actions
    loadGraph,
    clearGraph,
    setNode,
    selectNode,
    clearSelection,
    setHoveredNode,
    setViewport,
    smoothZoom,
    smoothPan,
    snapViewport,
    setColormap,
    toggleSidePanel,
    focusDetailsPanel,
    setLoading,
    triggerBuild,
    clearPendingBuild,
    saveToCache,
    loadFromCache,
    clearCache,

    // Library actions
    addBookmark,
    removeBookmark,
    clearBookmarks,
    isBookmarked,
    selectBookmarkedPaper,
    followAuthor,
    unfollowAuthor,
    clearFollowedAuthors,
    isFollowingAuthor,
    clearStandalonePaper,
    addRecentGraph,
    loadRecentGraph,
    removeRecentGraph,
    clearRecentGraphs,

    // Tutorial
    tutorialStatus,
    tutorialSkipWelcome,
    completeTutorial,
    skipTutorial,
    resetTutorial,

    // Layout mode
    layoutMode,
    effectiveLayoutMode,
    setLayoutMode,
    toggleLayoutMode,

    // Theme mode
    isDarkMode,
    toggleTheme,

    // Particles
    particlesEnabled,
    toggleParticles,

    // Work-type filter
    disabledTypeBuckets,
    toggleTypeBucket,
  }
})
