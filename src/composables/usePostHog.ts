import posthog from 'posthog-js'

let initialized = false

export function usePostHog() {
  if (!initialized) {
    posthog.init('phc_Uo7mnD7wlAPXXXQ4dBCevkGi7gKM10Y7dL8KPglYZJ3', {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
    })
    initialized = true
  }

  return { posthog }
}

type GraphType = 'paper' | 'author' | 'multi'

// Analytics events - all tracking logic contained here.
//
// Design: one event per meaningful user action, never per API request. The key
// funnel is activation (graph_built) -> engagement (exported / shared) and the
// bibliography feature (bibliography_imported). Graph mode rides on graph_built
// so we can see which of the three build modes people actually use.
export const analytics = {
  graphBuilt: (graphType: GraphType, nodeCount: number, apiCalls?: number) => {
    posthog.capture('graph_built', { graphType, nodeCount, apiCalls })
  },

  graphExported: (graphType: GraphType, paperCount: number) => {
    posthog.capture('graph_exported', { graphType, paperCount })
  },

  graphShared: (graphType: GraphType, nodeCount: number) => {
    posthog.capture('graph_shared', { graphType, nodeCount })
  },

  bibliographyImported: (paperCount: number) => {
    posthog.capture('bibliography_imported', { paperCount })
  },

  paperBookmarked: () => {
    posthog.capture('paper_bookmarked')
  },
}
