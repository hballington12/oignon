/**
 * Graph building module - orchestrates paper fetching, ranking, and graph construction
 */

import type {
  RawGraph,
  RawPaper,
  GraphMetadata,
  GraphEdge,
  PaperMetadata,
  ProgressCallback,
} from '@/types'
import {
  fetchPaper,
  fetchPapersBulkFull,
  fetchPapersBulkSlim,
  fetchCitingPapers,
  fetchAuthor,
  fetchAuthorWorks,
  extractId,
  resetApiCallCount,
  getApiCallCount,
  OPENALEX_MAX_FILTER_IDS,
} from './openAlexApi'
import type { SlimPaper } from './paperFormatter'
import { computeRootRanks, computeBranchRanks, getTopRanked } from './ranking'
import { buildEdges, preprocessGraph } from './preprocessing'

// Re-export for external use
export { fetchPaper } from './openAlexApi'
export { preprocessGraph } from './preprocessing'

// Configuration
const DEFAULT_N_ROOTS = 25
const DEFAULT_N_BRANCHES = 25
const DEFAULT_BRANCH_SEEDS_LIMIT = 200
const MIN_BRANCH_REF_FREQUENCY = 2

export interface BuildGraphOptions {
  nRoots?: number
  nBranches?: number
  onProgress?: ProgressCallback
}

/**
 * Build a citation graph starting from a source paper
 */
export async function buildGraph(
  sourceId: string,
  options: BuildGraphOptions = {},
): Promise<RawGraph> {
  const { nRoots = DEFAULT_N_ROOTS, nBranches = DEFAULT_N_BRANCHES, onProgress } = options

  resetApiCallCount()

  const startTime = performance.now()

  let totalApiCalls = 1
  let completedApiCalls = 0

  const reportProgress = (message: string) => {
    const percent = totalApiCalls > 0 ? Math.round((completedApiCalls / totalApiCalls) * 100) : 0
    onProgress?.({
      message,
      percent,
      completed: completedApiCalls,
      total: totalApiCalls,
    })
  }

  const onBatchComplete = () => {
    completedApiCalls++
    reportProgress('Fetching papers...')
  }

  // Clean up source ID
  sourceId = extractId(sourceId)

  // Handle DOI input
  if (sourceId.startsWith('10.')) {
    sourceId = `https://doi.org/${sourceId}`
  }

  // Step 1: Fetch source paper
  reportProgress('Fetching source paper...')
  const source = await fetchPaper(sourceId)
  if (!source) {
    throw new Error(`Could not fetch source paper: ${sourceId}`)
  }
  completedApiCalls = 1

  // Estimate total API calls
  const refCount = (source.references || []).length
  const estRootSeedBatches = Math.ceil(refCount / OPENALEX_MAX_FILTER_IDS)
  const estRootExpansionBatches = Math.ceil((refCount * 25) / OPENALEX_MAX_FILTER_IDS)
  const estBranchSeedBatches = Math.ceil(DEFAULT_BRANCH_SEEDS_LIMIT / OPENALEX_MAX_FILTER_IDS)
  const estBranchRefBatches = Math.ceil((DEFAULT_BRANCH_SEEDS_LIMIT * 2) / OPENALEX_MAX_FILTER_IDS)

  totalApiCalls =
    1 +
    estRootSeedBatches +
    estRootExpansionBatches +
    1 +
    estBranchSeedBatches +
    estBranchRefBatches

  reportProgress(`Source: ${source.title} (${source.year})`)

  // Step 2: Build ROOTS
  reportProgress('Building roots...')
  const seedIds = source.references || []
  const rootSeeds = await fetchPapersBulkSlim(seedIds, onBatchComplete)

  const allRootRefIds = new Set<string>()
  for (const seed of Object.values(rootSeeds)) {
    for (const ref of seed.references || []) {
      allRootRefIds.add(ref)
    }
  }
  for (const seedId of Object.keys(rootSeeds)) {
    allRootRefIds.delete(seedId)
  }

  const actualRootExpansionBatches = Math.ceil(allRootRefIds.size / OPENALEX_MAX_FILTER_IDS)
  totalApiCalls =
    completedApiCalls + actualRootExpansionBatches + 1 + estBranchSeedBatches + estBranchRefBatches

  reportProgress(`Expanding roots: ${allRootRefIds.size} papers...`)
  const rootPapers = await fetchPapersBulkSlim([...allRootRefIds], onBatchComplete)

  // Step 3: Rank and select top roots
  reportProgress('Ranking roots...')
  const rootRanks = computeRootRanks(rootSeeds, rootPapers)
  const topRootIds = getTopRanked(rootRanks, nRoots)

  // Step 4: Build BRANCHES
  reportProgress('Fetching citing papers...')
  const citingIds = await fetchCitingPapers(extractId(source.id), DEFAULT_BRANCH_SEEDS_LIMIT)
  completedApiCalls++

  reportProgress(`Fetching ${citingIds.length} branch seeds...`)
  const branchSeedsRaw = await fetchPapersBulkSlim(citingIds, onBatchComplete)

  const minYear = (source.year || 0) + 1
  const branchSeeds: Record<string, SlimPaper> = {}
  for (const [pid, paper] of Object.entries(branchSeedsRaw)) {
    if ((paper.citationCount || 0) > 0 && (paper.year || 0) >= minYear) {
      branchSeeds[pid] = paper
    }
  }

  // Count reference frequency across all branch seeds
  const branchRefFrequency: Record<string, number> = {}
  for (const seed of Object.values(branchSeeds)) {
    for (const ref of seed.references || []) {
      branchRefFrequency[ref] = (branchRefFrequency[ref] || 0) + 1
    }
  }

  // Filter to papers referenced by >= MIN_BRANCH_REF_FREQUENCY seeds
  const sourceIdClean = extractId(source.id || '')
  const branchSeedIds = new Set(Object.keys(branchSeeds))
  const allBranchRefIds = new Set<string>()

  for (const [refId, count] of Object.entries(branchRefFrequency)) {
    if (count >= MIN_BRANCH_REF_FREQUENCY && !branchSeedIds.has(refId) && refId !== sourceIdClean) {
      allBranchRefIds.add(refId)
    }
  }

  const totalUniqueRefs = Object.keys(branchRefFrequency).length
  void totalUniqueRefs // Used for debugging

  const actualBranchRefBatches = Math.ceil(allBranchRefIds.size / OPENALEX_MAX_FILTER_IDS)
  totalApiCalls = completedApiCalls + actualBranchRefBatches

  reportProgress(`Expanding branches: ${allBranchRefIds.size} refs...`)
  const branchRefsRaw = await fetchPapersBulkSlim([...allBranchRefIds], onBatchComplete)

  const branchPapersRaw: Record<string, SlimPaper> = { ...branchRefsRaw }

  const branchPapers: Record<string, SlimPaper> = {}
  for (const [pid, paper] of Object.entries(branchPapersRaw)) {
    if ((paper.year || 0) >= minYear && (paper.citationCount || 0) > 0) {
      branchPapers[pid] = paper
    }
  }

  // Step 5: Rank and select top branches
  reportProgress('Ranking branches...')
  const branchRanks = computeBranchRanks(source, branchSeeds, branchPapers)
  const topBranchIds = getTopRanked(branchRanks, nBranches)

  // Step 6: Fetch full metadata for final papers
  const allSeedIds = [...Object.keys(rootSeeds), ...Object.keys(branchSeeds)]
  const allTopIds = [...topRootIds, ...topBranchIds]
  const idsNeedingFullData = [...new Set([...allSeedIds, ...allTopIds])]

  reportProgress(`Fetching full metadata for ${idsNeedingFullData.length} papers...`)
  const fullPapers = await fetchPapersBulkFull(idsNeedingFullData, onBatchComplete)

  // Build topPapers with full data
  const topPapers: Record<string, RawPaper> = {}
  for (const pid of topRootIds) {
    const paper = fullPapers[pid]
    if (paper) {
      topPapers[pid] = { ...paper, role: 'root' }
    }
  }
  for (const pid of topBranchIds) {
    const paper = fullPapers[pid]
    if (paper) {
      topPapers[pid] = { ...paper, role: 'branch' }
    }
  }

  // Build seeds with full data
  const fullRootSeeds: Record<string, RawPaper> = {}
  for (const pid of Object.keys(rootSeeds)) {
    if (fullPapers[pid]) {
      fullRootSeeds[pid] = fullPapers[pid]
    }
  }
  const fullBranchSeeds: Record<string, RawPaper> = {}
  for (const pid of Object.keys(branchSeeds)) {
    if (fullPapers[pid]) {
      fullBranchSeeds[pid] = fullPapers[pid]
    }
  }

  const allSeeds = { ...fullRootSeeds, ...fullBranchSeeds }
  const edges = buildEdges(source, allSeeds, topPapers)

  const allRanks = { ...rootRanks, ...branchRanks }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
  completedApiCalls = totalApiCalls
  reportProgress(`Complete in ${elapsed}s`)

  const metadata: GraphMetadata = {
    source_year: source.year,
    total_root_seeds: Object.keys(rootSeeds).length,
    total_root_papers: Object.keys(rootPapers).length,
    total_branch_seeds: Object.keys(branchSeeds).length,
    total_branch_papers: Object.keys(branchPapers).length,
    n_roots: topRootIds.length,
    n_branches: topBranchIds.length,
    papers_in_graph: Object.keys(topPapers).length,
    edges_in_graph: edges.length,
    build_time_seconds: parseFloat(elapsed),
    timestamp: new Date().toISOString(),
    api_calls: getApiCallCount(),
  }

  return {
    source_paper: source,
    root_seeds: Object.values(fullRootSeeds),
    branch_seeds: Object.values(fullBranchSeeds),
    papers: [...topRootIds, ...topBranchIds]
      .filter((pid) => pid in topPapers)
      .map((pid) => ({ ...topPapers[pid]!, ...allRanks[pid] })),
    edges,
    metadata,
  }
}

/**
 * Hydrate metadata for slim-cached nodes
 */
export async function hydrateMetadata(
  nodeIds: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Record<string, PaperMetadata>> {
  const results: Record<string, PaperMetadata> = {}
  let completed = 0

  const fullPapers = await fetchPapersBulkFull(nodeIds, () => {
    completed++
    onProgress?.(completed, Math.ceil(nodeIds.length / OPENALEX_MAX_FILTER_IDS))
  })

  for (const [id, paper] of Object.entries(fullPapers)) {
    const authorNames = (paper.authors || []).map((a) =>
      typeof a === 'object' ? a.name || '' : String(a),
    )

    results[id] = {
      title: paper.title || '',
      authors: authorNames,
      authorsDetailed: paper.authors,
      citationCount: paper.citationCount || 0,
      referencesCount: paper.referencesCount,
      doi: paper.doi,
      openAlexUrl: paper.openAlexUrl,
      type: paper.type,
      sourceType: paper.sourceType,
      sourceName: paper.sourceName,
      openAccess: paper.openAccess,
      language: paper.language,
      abstract: paper.abstract,
      fwci: paper.fwci,
      citationPercentile: paper.citationPercentile,
      primaryTopic: paper.primaryTopic,
      sdgs: paper.sdgs,
      keywords: paper.keywords,
    }
  }

  return results
}

// --- Author Graph Building ---

const DEFAULT_AUTHOR_WORKS_LIMIT = 100

export interface BuildAuthorGraphOptions {
  maxWorks?: number
  onProgress?: ProgressCallback
}

/**
 * Build a citation graph from an author's publications
 */
export async function buildAuthorGraph(
  authorId: string,
  options: BuildAuthorGraphOptions = {},
): Promise<RawGraph> {
  const { maxWorks = DEFAULT_AUTHOR_WORKS_LIMIT, onProgress } = options

  resetApiCallCount()
  const startTime = performance.now()

  let totalApiCalls = 2 // author + works
  let completedApiCalls = 0

  const reportProgress = (message: string) => {
    const percent = totalApiCalls > 0 ? Math.round((completedApiCalls / totalApiCalls) * 100) : 0
    onProgress?.({
      message,
      percent,
      completed: completedApiCalls,
      total: totalApiCalls,
    })
  }

  // Step 1: Fetch author metadata
  reportProgress('Fetching author info...')
  const author = await fetchAuthor(authorId)
  if (!author) {
    throw new Error(`Could not fetch author: ${authorId}`)
  }
  completedApiCalls++

  // Step 2: Fetch author's works
  reportProgress(`Fetching works by ${author.display_name}...`)
  const works = await fetchAuthorWorks(authorId, maxWorks, () => {
    completedApiCalls++
    reportProgress(`Fetching works by ${author.display_name}...`)
  })
  completedApiCalls++

  const workIds = new Set(Object.keys(works))

  // Step 3: Build edges between works that cite each other
  reportProgress('Building citation network...')
  const edges: GraphEdge[] = []
  for (const [workId, paper] of Object.entries(works)) {
    for (const refId of paper.references || []) {
      const cleanRefId = extractId(refId)
      if (workIds.has(cleanRefId)) {
        edges.push({ source: workId, target: cleanRefId, type: 'cites' })
      }
    }
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
  reportProgress(`Complete in ${elapsed}s`)

  const metadata: GraphMetadata = {
    graph_type: 'author',
    author_id: author.id,
    author_name: author.display_name,
    author_affiliation: author.affiliation || undefined,
    papers_in_graph: Object.keys(works).length,
    edges_in_graph: edges.length,
    build_time_seconds: parseFloat(elapsed),
    timestamp: new Date().toISOString(),
    api_calls: getApiCallCount(),
  }

  return {
    source_paper: undefined,
    root_seeds: [],
    branch_seeds: [],
    papers: Object.values(works),
    edges,
    metadata,
  }
}
