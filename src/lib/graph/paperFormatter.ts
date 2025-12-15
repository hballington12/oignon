/**
 * Paper formatting utilities for converting OpenAlex API responses
 */

import type {
  RawPaper,
  Author,
  PrimaryTopic,
  SDG,
  CitationPercentile,
  PaperMetadata,
} from '@/types'

const MAX_AUTHORS_IN_PAPER = 5

// OpenAlex work response shape
export interface OpenAlexWork {
  id: string
  doi?: string
  title: string
  authorships?: Array<{
    author?: { id?: string; display_name?: string; orcid?: string | null }
    institutions?: Array<{ display_name?: string; country_code?: string }>
  }>
  publication_year: number
  cited_by_count?: number
  referenced_works?: string[]
  type?: string
  language?: string
  open_access?: { is_oa?: boolean }
  primary_location?: {
    source?: {
      display_name?: string
      type?: string
    }
  }
  abstract_inverted_index?: Record<string, number[]>
  fwci?: number
  citation_normalized_percentile?: {
    value?: number
    is_in_top_1_percent?: boolean
    is_in_top_10_percent?: boolean
  }
  primary_topic?: {
    id?: string
    display_name?: string
    subfield?: { id?: string; display_name?: string }
    field?: { id?: string; display_name?: string }
    domain?: { id?: string; display_name?: string }
  }
  sustainable_development_goals?: Array<{
    id?: string
    display_name?: string
    score?: number
  }>
  keywords?: Array<{
    keyword?: string
    score?: number
  }>
  is_retracted?: boolean
}

// Slim paper type for ranking (minimal data)
export interface SlimPaper {
  id: string
  year: number
  citationCount: number
  references: string[]
}

/**
 * Reconstruct abstract from OpenAlex's inverted index format
 */
export function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string {
  if (!invertedIndex) return ''
  const words: [string, number][] = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos])
    }
  }
  words.sort((a, b) => a[1] - b[1])
  return words.map(([word]) => word).join(' ')
}

function extractId(openalexUrl: string | undefined): string {
  if (openalexUrl && openalexUrl.startsWith('https://openalex.org/')) {
    return openalexUrl.split('/').pop() || ''
  }
  return openalexUrl || ''
}

/**
 * Format full OpenAlex work to RawPaper
 */
export function formatPaper(work: OpenAlexWork): RawPaper {
  const refs = work.referenced_works || []
  const authorships = work.authorships || []

  const authors: Author[] = authorships.slice(0, MAX_AUTHORS_IN_PAPER).map((authorship) => {
    // Extract OpenAlex author ID from URL (e.g., "https://openalex.org/A12345" -> "A12345")
    const authorId = authorship.author?.id?.split('/').pop()
    const authorInfo: Author = {
      id: authorId,
      name: authorship.author?.display_name || '',
      orcid: authorship.author?.orcid || null,
    }
    const institutions = authorship.institutions || []
    if (institutions.length > 0 && institutions[0]) {
      authorInfo.affiliation = institutions[0].display_name || ''
      authorInfo.affiliation_country = institutions[0].country_code || ''
    }
    return authorInfo
  })

  // Parse primary topic hierarchy
  let primaryTopic: PrimaryTopic | undefined
  if (work.primary_topic?.display_name) {
    primaryTopic = {
      id: work.primary_topic.id || '',
      name: work.primary_topic.display_name,
      subfield: {
        id: work.primary_topic.subfield?.id || '',
        name: work.primary_topic.subfield?.display_name || '',
      },
      field: {
        id: work.primary_topic.field?.id || '',
        name: work.primary_topic.field?.display_name || '',
      },
      domain: {
        id: work.primary_topic.domain?.id || '',
        name: work.primary_topic.domain?.display_name || '',
      },
    }
  }

  // Parse citation percentile
  let citationPercentile: CitationPercentile | undefined
  if (work.citation_normalized_percentile?.value !== undefined) {
    const value = work.citation_normalized_percentile.value
    citationPercentile = {
      value,
      isInTop1Percent: work.citation_normalized_percentile.is_in_top_1_percent || value >= 99,
      isInTop10Percent: work.citation_normalized_percentile.is_in_top_10_percent || value >= 90,
    }
  }

  // Parse SDGs
  const sdgs: SDG[] | undefined = work.sustainable_development_goals
    ?.filter((sdg) => sdg.display_name && sdg.score !== undefined)
    .map((sdg) => ({
      id: sdg.id || '',
      name: sdg.display_name || '',
      score: sdg.score || 0,
    }))

  // Parse keywords
  const keywords: string[] | undefined = work.keywords
    ?.filter((kw) => kw.keyword)
    .map((kw) => kw.keyword || '')

  const metadata: PaperMetadata = {
    title: work.title,
    authors: authors.map((a) => a.name),
    authorsDetailed: authors,
    citationCount: work.cited_by_count || 0,
    referencesCount: refs.length,
    doi: work.doi,
    openAlexUrl: work.id,
    type: work.type,
    sourceType: work.primary_location?.source?.type,
    sourceName: work.primary_location?.source?.display_name,
    openAccess: work.open_access?.is_oa,
    language: work.language,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    fwci: work.fwci,
    citationPercentile,
    primaryTopic,
    sdgs: sdgs?.length ? sdgs : undefined,
    keywords: keywords?.length ? keywords : undefined,
    isRetracted: work.is_retracted,
  }

  return {
    id: work.id,
    year: work.publication_year,
    references: refs.map(extractId),
    metadata,
  }
}

/**
 * Format slim OpenAlex work for ranking (minimal fields)
 */
export function formatSlimPaper(work: {
  id: string
  publication_year?: number
  cited_by_count?: number
  referenced_works?: string[]
}): SlimPaper {
  return {
    id: extractId(work.id),
    year: work.publication_year || 0,
    citationCount: work.cited_by_count || 0,
    references: (work.referenced_works || []).map(extractId),
  }
}
