/**
 * Rate-limited fetch wrapper for the OpenAlex API.
 *
 * OpenAlex allows roughly 10 requests/second per client; bursts above that
 * return HTTP 429. Every request helper in this module goes through apiFetch
 * so the whole app shares a single request budget, no matter how many
 * builds or hydrations are in flight.
 */

import { analytics } from '@/composables/usePostHog'

const REQUESTS_PER_SECOND = 8
const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 1000

// --- API call tracking ---

let apiCallCount = 0

export function logApiCall(endpoint: string, detail?: string) {
  apiCallCount++
  analytics.apiCall(endpoint, detail)
}

export function resetApiCallCount() {
  apiCallCount = 0
}

export function getApiCallCount() {
  return apiCallCount
}

// --- Rate limiting ---

// Timestamp of the next free request slot. Concurrent callers each claim
// the next slot synchronously, so parallel batches space out evenly.
let nextSlotTime = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function acquireSlot(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, nextSlotTime - now)
  nextSlotTime = Math.max(now, nextSlotTime) + 1000 / REQUESTS_PER_SECOND
  if (wait > 0) await sleep(wait)
}

/**
 * Fetch with rate limiting and retry on 429 (honors Retry-After if present)
 */
export async function apiFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    await acquireSlot()
    const response = await fetch(url)
    if (response.status !== 429 || attempt >= MAX_RETRIES) {
      return response
    }
    const retryAfter = parseFloat(response.headers.get('Retry-After') || '')
    const delay = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : RETRY_BASE_DELAY_MS * (attempt + 1)
    await sleep(delay)
  }
}
