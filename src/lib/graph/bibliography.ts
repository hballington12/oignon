/**
 * Bibliography parsing - extracts DOIs and arXiv IDs from pasted text
 * (BBL, BibTeX, plain reference lists) and resolves them to OpenAlex works.
 *
 * Parsing is purely local and deterministic: only explicit DOIs and arXiv
 * identifiers are recognized. Free-text titles without an identifier are
 * left for the user to add via the regular search.
 */

import { apiFetch, logApiCall } from './apiClient'
import { chunk, extractId } from './openAlexApi'

const OPENALEX_API = 'https://api.openalex.org'

// DOIs contain URL-unfriendly characters; keep batches small so the
// pipe-joined filter stays well under URL length limits
const DOI_BATCH_SIZE = 40

// DOI: "10." prefix, 4-9 digit registrant, then suffix up to whitespace,
// quotes, or (Bib)TeX delimiters
const DOI_REGEX = /\b10\.\d{4,9}\/[^\s"'<>{}\\]+/g

// arXiv new-style (2007+): arXiv:2512.22159 or arxiv.org/abs/2512.22159
const ARXIV_NEW_REGEX = /(?:arxiv\s*[:/]\s*|arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5})(?:v\d+)?/gi

// arXiv old-style (pre-2007): hep-th/9711200, math.GT/0309136
const ARXIV_OLD_REGEX =
  /(?:arxiv\s*[:/]\s*|arxiv\.org\/(?:abs|pdf)\/)([a-z-]+(?:\.[a-z]{2})?\/\d{7})(?:v\d+)?/gi

/** Strip punctuation that trails a DOI in running text (e.g. "10.1000/xyz.") */
function cleanDoi(raw: string): string {
  return raw.replace(/[.,;:)\]}"']+$/, '').toLowerCase()
}

function arxivToDoi(arxivId: string): string {
  return `10.48550/arxiv.${arxivId.toLowerCase()}`
}

/**
 * Extract unique DOIs from pasted bibliography text, in order of appearance.
 * arXiv IDs are converted to their canonical DataCite DOI form.
 */
export function parseBibliography(text: string): string[] {
  const seen = new Set<string>()
  const dois: string[] = []

  const add = (doi: string) => {
    if (!seen.has(doi)) {
      seen.add(doi)
      dois.push(doi)
    }
  }

  for (const match of text.matchAll(DOI_REGEX)) {
    add(cleanDoi(match[0]))
  }
  for (const match of text.matchAll(ARXIV_NEW_REGEX)) {
    if (match[1]) add(arxivToDoi(match[1]))
  }
  for (const match of text.matchAll(ARXIV_OLD_REGEX)) {
    if (match[1]) add(arxivToDoi(match[1]))
  }

  return dois
}

export interface ResolvedReference {
  id: string // OpenAlex work ID (W...)
  doi: string
  title: string
  firstAuthor?: string
  year?: number
  citationCount: number
}

export interface ResolutionResult {
  resolved: ResolvedReference[]
  unresolvedDois: string[]
}

interface OpenAlexWorkLite {
  id?: string
  doi?: string
  title?: string
  authorships?: Array<{ author?: { display_name?: string } }>
  publication_year?: number
  cited_by_count?: number
}

function toResolvedReference(work: OpenAlexWorkLite): ResolvedReference | null {
  const id = extractId(work.id)
  if (!id) return null
  return {
    id,
    doi: (work.doi || '').replace(/^https?:\/\/doi\.org\//i, '').toLowerCase(),
    title: work.title || 'Untitled',
    firstAuthor: work.authorships?.[0]?.author?.display_name,
    year: work.publication_year,
    citationCount: work.cited_by_count || 0,
  }
}

/**
 * Look up a single DOI via the entity endpoint. Needed for DOIs the batch
 * filter cannot handle, e.g. old-style arXiv DOIs with a slash in the
 * suffix (10.48550/arxiv.hep-th/9711200).
 */
async function resolveSingleDoi(doi: string): Promise<ResolvedReference | null> {
  logApiCall('/works/{doi}', `doi lookup: ${doi.slice(0, 40)}`)
  try {
    const encoded = encodeURIComponent(`https://doi.org/${doi}`)
    const response = await apiFetch(`${OPENALEX_API}/works/${encoded}`)
    if (!response.ok) return null
    const work = await response.json()
    return toResolvedReference(work)
  } catch (e) {
    console.error('Single DOI lookup error:', e)
    return null
  }
}

/**
 * Resolve DOIs to OpenAlex works in batches, with a per-DOI fallback for
 * anything the batch filter misses. Duplicate works (e.g. the same paper
 * found via both its arXiv DOI and its journal DOI) are deduplicated by
 * work ID.
 */
export async function resolveDois(
  dois: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<ResolutionResult> {
  const resolved: ResolvedReference[] = []
  const foundDois = new Set<string>()
  const seenWorkIds = new Set<string>()
  const batches = chunk(dois, DOI_BATCH_SIZE)

  let completed = 0
  for (const batch of batches) {
    const params = new URLSearchParams({
      filter: `doi:${batch.join('|')}`,
      select: 'id,doi,title,authorships,publication_year,cited_by_count',
      per_page: '100',
    })

    logApiCall('/works', `doi resolution batch: ${batch.length} dois`)

    try {
      const response = await apiFetch(`${OPENALEX_API}/works?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      for (const work of data.results || []) {
        const ref = toResolvedReference(work)
        if (!ref || seenWorkIds.has(ref.id)) continue
        seenWorkIds.add(ref.id)
        if (ref.doi) foundDois.add(ref.doi)
        resolved.push(ref)
      }
    } catch (e) {
      console.error('DOI resolution batch error:', e)
    }

    completed++
    onProgress?.(completed, batches.length)
  }

  // Fallback: individual lookups for DOIs the batch filter missed
  const missing = dois.filter((d) => !foundDois.has(d))
  const total = batches.length + missing.length
  const unresolvedDois: string[] = []

  for (const doi of missing) {
    const ref = await resolveSingleDoi(doi)
    if (ref && !seenWorkIds.has(ref.id)) {
      seenWorkIds.add(ref.id)
      resolved.push(ref)
    } else if (!ref) {
      unresolvedDois.push(doi)
    }
    completed++
    onProgress?.(completed, total)
  }

  return { resolved, unresolvedDois }
}
