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
} from '@/types'
import { hydrateMetadata } from '@/lib/graphBuilder'

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
  const activeColormap = ref<number>(0) // Colormap.Plasma
  const sidePanelCollapsed = ref(true)
  const loading = ref(false)
  const loadingProgress = ref<BuildProgress | null>(null)
  const pendingBuildId = ref<string | null>(null)
  const hydratingMetadata = ref(false)

  // Cache
  const CACHE_KEY = 'oignon_graph_cache'

  // Computed
  const hasGraph = computed(() => graph.value !== null && nodes.value.size > 0)

  const sourceNode = computed(() => {
    for (const node of nodes.value.values()) {
      if (node.metadata?.isSource) return node
    }
    return null
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
  }

  function setNode(id: string, node: VisualNode) {
    nodes.value.set(id, node)
  }

  function selectNode(id: string, additive = false) {
    if (!additive) {
      selectedNodeIds.value = new Set([id])
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
  }

  function toggleSidePanel() {
    sidePanelCollapsed.value = !sidePanelCollapsed.value
  }

  function setLoading(isLoading: boolean, progress?: BuildProgress) {
    loading.value = isLoading
    loadingProgress.value = progress ?? null
  }

  function triggerBuild(nodeId: string) {
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

  function saveToCache() {
    if (!graph.value) return
    try {
      // Save slim version with numeric IDs (citedBy rebuilt on load)
      const slimCache: SlimCache = {
        slim: true,
        nodes: graph.value.nodes.map((node) => ({
          id: toNumericId(node.id),
          order: node.order,
          connections: node.connections.map(toNumericId),
        })),
      }
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
        // Slim cache: convert numeric IDs back to strings, rebuild citedBy
        const nodeMap = new Map<string, GraphNode>()

        // First pass: create nodes with empty citedBy
        for (const node of data.nodes as SlimCache['nodes']) {
          const id = toStringId(node.id)
          nodeMap.set(id, {
            id,
            order: node.order,
            connections: node.connections.map(toStringId),
            citedBy: [],
            metadata: {
              title: 'Loading...',
              authors: [],
              citationCount: 0,
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
        loadGraph({ nodes: fullNodes })

        // Hydrate metadata in background
        const nodeIds = fullNodes.map((n) => n.id)
        runMetadataHydration(nodeIds)
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

  function clearCache() {
    localStorage.removeItem(CACHE_KEY)
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
    loading,
    loadingProgress,
    pendingBuildId,
    hydratingMetadata,

    // Computed
    hasGraph,
    sourceNode,
    selectedNodes,

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
    setLoading,
    triggerBuild,
    clearPendingBuild,
    saveToCache,
    loadFromCache,
    clearCache,
  }
})
