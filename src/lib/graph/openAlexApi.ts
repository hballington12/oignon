/**
 * OpenAlex API client for fetching academic paper data
 */

import type { RawPaper } from '@/types'
import { formatPaper, formatSlimPaper, type SlimPaper } from './paperFormatter'

// Configuration
const OPENALEX_API = 'https://api.openalex.org'
const OPENALEX_EMAIL = 'ballington@uni-wuppertal.de'
const OPENALEX_USER_AGENT = 'CitationGraphBuilder/1.0 (mailto:ballington@uni-wuppertal.de)'
export const OPENALEX_MAX_PER_PAGE = 200
export const OPENALEX_MAX_FILTER_IDS = 100
const MAX_PARALLEL_REQUESTS = 10

const OPENALEX_FETCH_OPTIONS: RequestInit = {
  headers: {
    'User-Agent': OPENALEX_USER_AGENT,
  },
}

// Full fields for final papers (displayed in UI)
const OPENALEX_FULL_FIELDS = [
  'id',
  'doi',
  'title',
  'authorships',
  'publication_year',
  'cited_by_count',
  'referenced_works',
  'type',
  'language',
  'open_access',
  'primary_location',
  'abstract_inverted_index',
  'fwci',
  'citation_normalized_percentile',
  'primary_topic',
  'sustainable_development_goals',
  'keywords',
].join(',')

// Slim fields for intermediate papers (only used for ranking)
const OPENALEX_SLIM_FIELDS = ['id', 'publication_year', 'cited_by_count', 'referenced_works'].join(
  ',',
)

// --- API call tracking ---

let apiCallCount = 0

export function logApiCall(endpoint: string, detail?: string) {
  apiCallCount++
  console.log(`[API #${apiCallCount}] ${endpoint}${detail ? ` (${detail})` : ''}`)
}

export function resetApiCallCount() {
  apiCallCount = 0
}

export function getApiCallCount() {
  return apiCallCount
}

// --- Utilities ---

export function extractId(openalexUrl: string | undefined): string {
  if (openalexUrl && openalexUrl.startsWith('https://openalex.org/')) {
    return openalexUrl.split('/').pop() || ''
  }
  return openalexUrl || ''
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// --- Single paper fetch ---

export async function fetchPaper(workId: string): Promise<RawPaper | null> {
  logApiCall('/works/{id}', `single paper: ${workId.slice(0, 30)}`)
  try {
    const response = await fetch(
      `${OPENALEX_API}/works/${workId}?mailto=${OPENALEX_EMAIL}`,
      OPENALEX_FETCH_OPTIONS,
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const work = await response.json()
    return formatPaper(work)
  } catch (e) {
    console.error(`Error fetching ${workId}:`, e)
    return null
  }
}

// --- Batch fetching ---

async function fetchBatchFull(batch: string[]): Promise<Record<string, RawPaper>> {
  const idFilter = batch.join('|')
  const params = new URLSearchParams({
    filter: `openalex:${idFilter}`,
    select: OPENALEX_FULL_FIELDS,
    per_page: OPENALEX_MAX_PER_PAGE.toString(),
    mailto: OPENALEX_EMAIL,
  })

  logApiCall('/works', `full batch: ${batch.length} ids`)

  try {
    const response = await fetch(`${OPENALEX_API}/works?${params}`, OPENALEX_FETCH_OPTIONS)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    const papers: Record<string, RawPaper> = {}
    for (const work of data.results || []) {
      const paper = formatPaper(work)
      papers[extractId(paper.id)] = paper
    }
    return papers
  } catch (e) {
    console.error('Batch fetch error:', e)
    return {}
  }
}

async function fetchBatchSlim(batch: string[]): Promise<Record<string, SlimPaper>> {
  const idFilter = batch.join('|')
  const params = new URLSearchParams({
    filter: `openalex:${idFilter}`,
    select: OPENALEX_SLIM_FIELDS,
    per_page: OPENALEX_MAX_PER_PAGE.toString(),
    mailto: OPENALEX_EMAIL,
  })

  logApiCall('/works', `slim batch: ${batch.length} ids`)

  try {
    const response = await fetch(`${OPENALEX_API}/works?${params}`, OPENALEX_FETCH_OPTIONS)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    const papers: Record<string, SlimPaper> = {}
    for (const work of data.results || []) {
      const paper = formatSlimPaper(work)
      papers[paper.id] = paper
    }
    return papers
  } catch (e) {
    console.error('Slim batch fetch error:', e)
    return {}
  }
}

// --- Bulk fetching (generic) ---

async function fetchPapersBulk<T>(
  workIds: string[],
  batchFetcher: (batch: string[]) => Promise<Record<string, T>>,
  onBatchComplete?: () => void,
): Promise<Record<string, T>> {
  if (!workIds.length) return {}

  const batches = chunk(workIds, OPENALEX_MAX_FILTER_IDS)
  const papers: Record<string, T> = {}

  for (let i = 0; i < batches.length; i += MAX_PARALLEL_REQUESTS) {
    const batchGroup = batches.slice(i, i + MAX_PARALLEL_REQUESTS)
    const results = await Promise.all(batchGroup.map(batchFetcher))

    for (const result of results) {
      Object.assign(papers, result)
    }

    if (onBatchComplete) {
      for (let j = 0; j < batchGroup.length; j++) {
        onBatchComplete()
      }
    }
  }

  return papers
}

export async function fetchPapersBulkFull(
  workIds: string[],
  onBatchComplete?: () => void,
): Promise<Record<string, RawPaper>> {
  return fetchPapersBulk(workIds, fetchBatchFull, onBatchComplete)
}

export async function fetchPapersBulkSlim(
  workIds: string[],
  onBatchComplete?: () => void,
): Promise<Record<string, SlimPaper>> {
  return fetchPapersBulk(workIds, fetchBatchSlim, onBatchComplete)
}

// --- Citation fetching ---

async function fetchCitationsBatch(batch: string[]): Promise<Set<string>> {
  const citesFilter = batch.join('|')
  const params = new URLSearchParams({
    filter: `cites:${citesFilter}`,
    select: 'id',
    per_page: OPENALEX_MAX_PER_PAGE.toString(),
    mailto: OPENALEX_EMAIL,
  })

  logApiCall('/works', `citations batch: ${batch.length} ids`)

  try {
    const response = await fetch(`${OPENALEX_API}/works?${params}`, OPENALEX_FETCH_OPTIONS)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    return new Set((data.results || []).map((work: { id: string }) => extractId(work.id)))
  } catch (e) {
    console.error('Citations batch error:', e)
    return new Set()
  }
}

export async function fetchCitationsBulk(
  workIds: string[],
  onBatchComplete?: () => void,
): Promise<Set<string>> {
  if (!workIds.length) return new Set()

  const batchSize = Math.floor(OPENALEX_MAX_FILTER_IDS / 2)
  const batches = chunk(workIds, batchSize)
  const citingIds = new Set<string>()

  for (let i = 0; i < batches.length; i += MAX_PARALLEL_REQUESTS) {
    const batchGroup = batches.slice(i, i + MAX_PARALLEL_REQUESTS)
    const results = await Promise.all(batchGroup.map(fetchCitationsBatch))

    for (const result of results) {
      for (const id of result) {
        citingIds.add(id)
      }
    }

    if (onBatchComplete) {
      for (let j = 0; j < batchGroup.length; j++) {
        onBatchComplete()
      }
    }
  }

  return citingIds
}

// --- Autocomplete ---

export interface AutocompleteResult {
  id: string
  display_name: string
  hint: string | null
  cited_by_count: number
  entity_type: string
  external_id: string | null
}

export async function fetchAutocomplete(query: string): Promise<AutocompleteResult[]> {
  if (!query || query.length === 0) return []

  const params = new URLSearchParams({
    q: query,
    mailto: OPENALEX_EMAIL,
  })

  try {
    const response = await fetch(
      `${OPENALEX_API}/autocomplete/works?${params}`,
      OPENALEX_FETCH_OPTIONS,
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    return (data.results || []).map((result: AutocompleteResult) => ({
      id: extractId(result.id),
      display_name: result.display_name,
      hint: result.hint,
      cited_by_count: result.cited_by_count || 0,
      entity_type: result.entity_type,
      external_id: result.external_id,
    }))
  } catch (e) {
    console.error('Autocomplete error:', e)
    return []
  }
}

// --- Citation fetching ---

export async function fetchCitingPapers(workId: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({
    filter: `cites:${workId}`,
    select: 'id',
    per_page: limit.toString(),
    mailto: OPENALEX_EMAIL,
  })

  logApiCall('/works', `citing papers for ${workId.slice(0, 20)}, limit ${limit}`)

  try {
    const response = await fetch(`${OPENALEX_API}/works?${params}`, OPENALEX_FETCH_OPTIONS)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    return (data.results || []).map((work: { id: string }) => extractId(work.id))
  } catch (e) {
    console.error(`Error fetching citations for ${workId}:`, e)
    return []
  }
}
