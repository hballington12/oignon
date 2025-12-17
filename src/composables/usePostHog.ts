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

// Analytics events - all tracking logic contained here
export const analytics = {
  apiCall: (endpoint: string, detail?: string) => {
    posthog.capture('openalex_api_call', { endpoint, detail })
  },

  graphBuilt: (sourceId: string, nodeCount: number) => {
    posthog.capture('graph_built', { sourceId, nodeCount })
  },

  paperBookmarked: (paperId: string) => {
    posthog.capture('paper_bookmarked', { paperId })
  },
}
