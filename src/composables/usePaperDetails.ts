import { computed, ref, watch } from 'vue'
import { useGraphStore } from '@/stores/graph'
import { getDarkerBackgroundColorHex, getColormapColorHex, COLORMAPS } from '@/lib/colormap'

// Badge type for header badges
export interface Badge {
  text: string
  color: string // background color
  textColor: string // text color
  title: string // tooltip
}

export function usePaperDetails() {
  const store = useGraphStore()

  const abstractExpanded = ref(false)
  const detailsContent = ref<HTMLElement | null>(null)

  // Background color based on active colormap
  const backgroundColor = computed(() => {
    const colormap = COLORMAPS[store.activeColormap]
    return colormap ? getDarkerBackgroundColorHex(colormap) : '#0d0d17'
  })

  // The node to display - priority: standalone > selected > source
  const displayNode = computed(() => {
    if (store.standalonePaper) {
      return store.standalonePaper
    }
    if (store.selectedNodes.length === 1) {
      return store.selectedNodes[0] ?? null
    }
    return store.sourceNode ?? null
  })

  // Close abstract overlay and reset scroll when node changes
  watch(
    () => displayNode.value?.id,
    () => {
      abstractExpanded.value = false
      detailsContent.value?.scrollTo({ top: 0, behavior: 'smooth' })
    },
  )

  // Whether we're showing a standalone bookmarked paper
  const isStandalone = computed(() => store.standalonePaper !== null)

  // Whether the displayed node is the source paper
  const isSource = computed(() => {
    return displayNode.value?.metadata.isSource ?? false
  })

  // Whether metadata is still loading (hydration in progress)
  const isMetadataLoading = computed(() => {
    return store.hydratingMetadata && displayNode.value?.metadata.title === 'Loading...'
  })

  // Label text for the panel header
  const labelText = computed(() => {
    if (isStandalone.value) {
      return 'Bookmarked'
    }
    if (store.selectedNodes.length === 1) {
      return isSource.value ? 'Source' : 'Selected'
    }
    return 'Source'
  })

  // In-graph citations (papers in our graph that cite this paper)
  const inGraphCitations = computed(() => {
    return displayNode.value?.citedBy.length ?? 0
  })

  // Format work type for display
  const workType = computed(() => {
    const type = displayNode.value?.metadata.type
    if (!type) return null
    return type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  })

  // Format source info (journal/conference/repository)
  const sourceInfo = computed(() => {
    const meta = displayNode.value?.metadata
    if (!meta?.sourceName) return null
    const typeLabel =
      meta.sourceType === 'journal'
        ? 'Journal'
        : meta.sourceType === 'conference'
          ? 'Conference'
          : meta.sourceType === 'repository'
            ? 'Repository'
            : 'Source'
    return { type: typeLabel, name: meta.sourceName }
  })

  // Whether the current paper is bookmarked
  const isBookmarked = computed(() => {
    if (!displayNode.value) return false
    return store.isBookmarked(displayNode.value.id)
  })

  // Primary topic classification hierarchy
  const primaryTopic = computed(() => {
    return displayNode.value?.metadata.primaryTopic ?? null
  })

  // Keywords list
  const keywords = computed(() => {
    const kw = displayNode.value?.metadata.keywords
    if (!kw || kw.length === 0) return null
    return kw
  })

  // Sustainable Development Goals formatted as pipe-separated string
  const sdgsFormatted = computed(() => {
    const sdgs = displayNode.value?.metadata.sdgs
    if (!sdgs || sdgs.length === 0) return null
    return sdgs.map((s) => s.name).join(' | ')
  })

  // Header badges array
  const badges = computed<Badge[]>(() => {
    const result: Badge[] = []
    const meta = displayNode.value?.metadata
    if (!meta) return result

    const colormap = COLORMAPS[store.activeColormap]

    // Source badge
    if (meta.isSource) {
      result.push({
        text: 'Source',
        color: '#22c55e', // green
        textColor: '#0d0d17',
        title: 'Source paper of this graph',
      })
    }

    // Access badge (Open or Closed)
    if (meta.openAccess === true) {
      result.push({
        text: 'Open',
        color: '#22c55e', // green
        textColor: '#0d0d17',
        title: 'Open Access',
      })
    } else if (meta.openAccess === false) {
      result.push({
        text: 'Closed',
        color: '#6b7280', // gray
        textColor: '#ffffff',
        title: 'Closed Access',
      })
    }

    // Percentile badge (mutually exclusive, show highest)
    const percentile = meta.citationPercentile
    if (percentile) {
      if (percentile.isInTop1Percent) {
        result.push({
          text: 'Top 1%',
          color: colormap ? getColormapColorHex(0.95, colormap) : '#f59e0b',
          textColor: '#0d0d17',
          title: 'Top 1% citation percentile (by year/subfield)',
        })
      } else if (percentile.isInTop10Percent) {
        result.push({
          text: 'Top 10%',
          color: colormap ? getColormapColorHex(0.7, colormap) : '#f59e0b',
          textColor: '#0d0d17',
          title: 'Top 10% citation percentile (by year/subfield)',
        })
      }
    }

    // Language badge (only show if not English)
    const lang = meta.language
    if (lang && lang !== 'en') {
      result.push({
        text: lang.toUpperCase(),
        color: '#374151', // dark gray
        textColor: '#e5e7eb',
        title: `Language: ${lang.toUpperCase()}`,
      })
    }

    return result
  })

  // Open DOI link in new tab
  function openDoi(doi: string | undefined) {
    if (doi) window.open(doi, '_blank')
  }

  // Open OpenAlex link in new tab
  function openOpenAlex(url: string | undefined) {
    if (url) window.open(url, '_blank')
  }

  // Trigger building a new graph from the current paper
  function handleBuild() {
    if (displayNode.value) {
      store.triggerBuild(displayNode.value.id)
    }
  }

  // Toggle bookmark status for the current paper
  function toggleBookmark() {
    if (!displayNode.value) return
    const node = displayNode.value
    if (isBookmarked.value) {
      store.removeBookmark(node.id)
    } else {
      store.addBookmark({
        id: node.id,
        title: node.metadata.title,
        firstAuthor: node.metadata.authors?.[0],
        year: node.order,
        citations: node.metadata.citationCount,
        doi: node.metadata.doi,
        openAlexUrl: node.metadata.openAlexUrl,
      })
    }
  }

  // Collapse abstract overlay
  function collapseAbstract() {
    abstractExpanded.value = false
  }

  // Expand abstract overlay
  function expandAbstract() {
    abstractExpanded.value = true
  }

  return {
    // Refs
    abstractExpanded,
    detailsContent,
    // Computed
    backgroundColor,
    displayNode,
    isStandalone,
    isSource,
    isMetadataLoading,
    labelText,
    inGraphCitations,
    workType,
    sourceInfo,
    isBookmarked,
    primaryTopic,
    keywords,
    sdgsFormatted,
    badges,
    // Store access
    store,
    // Methods
    openDoi,
    openOpenAlex,
    handleBuild,
    toggleBookmark,
    collapseAbstract,
    expandAbstract,
  }
}
