import { computed } from 'vue'
import { useGraphStore } from '@/stores/graph'
import { getColormapColorHex, COLORMAPS } from '@/lib/colormap'
import type { FollowedAuthor } from '@/types'

// Badge type for header badges
export interface Badge {
  text: string
  color: string // background color
  textColor: string // text color
  title: string // tooltip
}

export function useAuthorDetails() {
  const store = useGraphStore()

  // Author metadata from graph
  const authorMetadata = computed(() => store.graphMetadata)

  // Whether this is an author graph
  const isAuthorGraph = computed(() => store.isAuthorGraph)

  // Author display name
  const displayName = computed(() => authorMetadata.value?.author_name ?? null)

  // Institution/affiliation
  const affiliation = computed(() => authorMetadata.value?.author_affiliation ?? null)

  // ORCID (just the ID part, not full URL)
  const orcid = computed(() => {
    const raw = authorMetadata.value?.author_orcid
    if (!raw) return null
    // Extract just the ORCID ID if it's a full URL
    return raw.replace('https://orcid.org/', '')
  })

  // Full ORCID URL for linking
  const orcidUrl = computed(() => {
    if (!orcid.value) return null
    return `https://orcid.org/${orcid.value}`
  })

  // OpenAlex URL for the author
  const openAlexUrl = computed(() => {
    const id = authorMetadata.value?.author_id
    if (!id) return null
    return `https://openalex.org/authors/${id}`
  })

  // Stats
  const worksCount = computed(() => authorMetadata.value?.author_works_count ?? 0)
  const citedByCount = computed(() => authorMetadata.value?.author_cited_by_count ?? 0)
  const hIndex = computed(() => authorMetadata.value?.author_h_index ?? 0)
  const i10Index = computed(() => authorMetadata.value?.author_i10_index ?? 0)

  // Papers in current graph
  const papersInGraph = computed(() => authorMetadata.value?.papers_in_graph ?? 0)

  // Author ID for following
  const authorId = computed(() => authorMetadata.value?.author_id ?? null)

  // Whether the current author is being followed
  const isFollowing = computed(() => {
    const id = authorId.value
    if (!id) return false
    return store.isFollowingAuthor(id)
  })

  // H-index badge with color scaling (0-100 scale)
  const badges = computed<Badge[]>(() => {
    const result: Badge[] = []
    const h = hIndex.value
    if (h <= 0) return result

    const colormap = COLORMAPS[store.activeColormap]
    // Scale h-index: 0 -> 0.0, 100+ -> 1.0
    const t = Math.min(h / 100, 1)
    const color = colormap ? getColormapColorHex(t, colormap) : '#f59e0b'

    result.push({
      text: `h=${h}`,
      color,
      textColor: t > 0.5 ? '#0d0d17' : '#ffffff',
      title: `h-index: ${h}`,
    })

    return result
  })

  // Open ORCID link in new tab
  function openOrcid() {
    if (orcidUrl.value) window.open(orcidUrl.value, '_blank')
  }

  // Open OpenAlex link in new tab
  function openOpenAlex() {
    if (openAlexUrl.value) window.open(openAlexUrl.value, '_blank')
  }

  // Toggle follow status for the current author
  function toggleFollow() {
    const id = authorId.value
    if (!id) return

    if (isFollowing.value) {
      store.unfollowAuthor(id)
    } else {
      store.followAuthor({
        id,
        displayName: displayName.value ?? '',
        affiliation: affiliation.value ?? undefined,
        orcid: orcid.value ?? undefined,
        worksCount: worksCount.value,
        citedByCount: citedByCount.value,
        hIndex: hIndex.value,
      })
    }
  }

  // Format large numbers with k/M suffix
  function formatCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    }
    return count.toLocaleString()
  }

  return {
    // Computed
    isAuthorGraph,
    authorMetadata,
    displayName,
    affiliation,
    orcid,
    orcidUrl,
    openAlexUrl,
    worksCount,
    citedByCount,
    hIndex,
    i10Index,
    papersInGraph,
    badges,
    isFollowing,
    // Methods
    openOrcid,
    openOpenAlex,
    toggleFollow,
    formatCount,
  }
}
