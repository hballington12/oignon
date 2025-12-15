import { ref, computed, shallowRef } from 'vue'
import Fuse from 'fuse.js'
import type { VisualNode } from '@/types'

const query = ref('')
const isOpen = ref(false)
const results = shallowRef<VisualNode[]>([])
const selectedIndex = ref(0)
let fuse: Fuse<VisualNode> | null = null

const selectedResult = computed(() => results.value[selectedIndex.value] ?? null)

const hasResults = computed(() => results.value.length > 0)

export function useGraphSearch() {
  function buildIndex(nodes: Map<string, VisualNode>) {
    const nodeArray = [...nodes.values()]
    fuse = new Fuse(nodeArray, {
      keys: [
        { name: 'metadata.title', weight: 2 },
        { name: 'metadata.authors', weight: 1.5 },
        { name: 'metadata.abstract', weight: 1 },
        { name: 'metadata.keywords', weight: 1.5 },
        { name: 'metadata.primaryTopic.name', weight: 1 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      includeScore: true,
    })
  }

  function open() {
    isOpen.value = true
    query.value = ''
    results.value = []
    selectedIndex.value = 0
  }

  function close() {
    isOpen.value = false
    query.value = ''
    results.value = []
    selectedIndex.value = 0
  }

  function nextResult() {
    if (results.value.length === 0) return
    selectedIndex.value = (selectedIndex.value + 1) % results.value.length
  }

  function prevResult() {
    if (results.value.length === 0) return
    selectedIndex.value = (selectedIndex.value - 1 + results.value.length) % results.value.length
  }

  // Search function - call directly, no watch
  function search() {
    const q = query.value.trim()
    if (fuse && q.length > 0) {
      const searchResults = fuse.search(q, { limit: 50 })
      results.value = searchResults.map((r) => r.item)
      selectedIndex.value = 0
    } else {
      results.value = []
      selectedIndex.value = 0
    }
  }

  return {
    query,
    isOpen,
    results,
    selectedIndex,
    selectedResult,
    hasResults,
    buildIndex,
    search,
    open,
    close,
    nextResult,
    prevResult,
  } as const
}
