/**
 * Multi-paper graph building.
 *
 * Treats the N input papers as the reference list of a "virtual" source
 * paper and runs the same roots/branches algorithm as the single-paper
 * build, once, around the whole set:
 *   - the inputs play the role of root seeds (refs of the virtual source)
 *   - roots come from papers commonly cited by the inputs
 *   - branch seeds are papers citing the inputs, favoring those that cite
 *     several of them
 *   - branches come from papers commonly cited by the branch seeds
 *
 * API cost is comparable to a single-paper build regardless of N, instead
 * of N full builds.
 */

import type { RawGraph, RawPaper, GraphMetadata, ProgressCallback } from '@/types'
import {
  fetchPapersBulkFull,
  fetchPapersBulkSlim,
  fetchCitationsBulk,
  extractId,
  resetApiCallCount,
  getApiCallCount,
  OPENALEX_MAX_FILTER_IDS,
} from './openAlexApi'
import type { SlimPaper } from './paperFormatter'
import { computeRootRanks, computeBranchRanks, getTopRanked } from './ranking'
import { buildEdgesFromPapers } from './preprocessing'

// Configuration (mirrors single-paper build defaults)
const DEFAULT_N_ROOTS = 25
const DEFAULT_N_BRANCHES = 25
const MAX_BRANCH_SEEDS = 100
const MIN_BRANCH_REF_FREQUENCY = 2

export const MAX_MULTI_SOURCES = 50

export interface BuildMultiGraphOptions {
  nRoots?: number
  nBranches?: number
  onProgress?: ProgressCallback
}

/**
 * Build a citation graph around a set of source papers
 */
export async function buildMultiGraph(
  workIds: string[],
  options: BuildMultiGraphOptions = {},
): Promise<RawGraph> {
  const { nRoots = DEFAULT_N_ROOTS, nBranches = DEFAULT_N_BRANCHES, onProgress } = options

  const inputIds = [...new Set(workIds.map(extractId))].filter(Boolean).slice(0, MAX_MULTI_SOURCES)
  if (inputIds.length === 0) {
    throw new Error('No source papers provided')
  }

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

  // Rough initial estimate, revised as actual counts become known
  const estInputBatches = Math.ceil(inputIds.length / OPENALEX_MAX_FILTER_IDS)
  const estRootExpansionBatches = Math.ceil((inputIds.length * 30) / OPENALEX_MAX_FILTER_IDS)
  const estCitationBatches = Math.ceil(inputIds.length / (OPENALEX_MAX_FILTER_IDS / 2))
  totalApiCalls = estInputBatches + estRootExpansionBatches + estCitationBatches + 4

  // Step 1: Fetch the input papers (full metadata - they are displayed as sources)
  reportProgress(`Fetching ${inputIds.length} source papers...`)
  const inputPapers = await fetchPapersBulkFull(inputIds, onBatchComplete)

  const foundInputIds = Object.keys(inputPapers)
  if (foundInputIds.length === 0) {
    throw new Error('Could not fetch any of the source papers')
  }
  const inputIdSet = new Set(foundInputIds)

  // Inputs as rankable seeds (the virtual source's reference list)
  const inputSeeds: Record<string, SlimPaper> = {}
  for (const [pid, paper] of Object.entries(inputPapers)) {
    inputSeeds[pid] = {
      id: pid,
      year: paper.year || 0,
      citationCount: paper.metadata.citationCount || 0,
      references: paper.references || [],
    }
  }

  // Step 2: Build ROOTS - expand references of the inputs
  const allRootRefIds = new Set<string>()
  for (const seed of Object.values(inputSeeds)) {
    for (const ref of seed.references) {
      if (!inputIdSet.has(ref)) {
        allRootRefIds.add(ref)
      }
    }
  }

  const actualRootExpansionBatches = Math.ceil(allRootRefIds.size / OPENALEX_MAX_FILTER_IDS)
  totalApiCalls = completedApiCalls + actualRootExpansionBatches + estCitationBatches + 4

  reportProgress(`Expanding roots: ${allRootRefIds.size} papers...`)
  const rootPapers = await fetchPapersBulkSlim([...allRootRefIds], onBatchComplete)

  // Step 3: Rank and select top roots
  reportProgress('Ranking roots...')
  const rootRanks = computeRootRanks(inputSeeds, rootPapers)
  const topRootIds = getTopRanked(rootRanks, nRoots)

  // Step 4: Build BRANCHES - papers citing the inputs
  reportProgress('Fetching citing papers...')
  const citingIdSet = await fetchCitationsBulk(foundInputIds, onBatchComplete)
  for (const pid of foundInputIds) {
    citingIdSet.delete(pid)
  }

  reportProgress(`Fetching ${citingIdSet.size} citing papers...`)
  const citingPapersRaw = await fetchPapersBulkSlim([...citingIdSet], onBatchComplete)

  // Select branch seeds: prefer papers citing several inputs, then citations
  const minInputYear = Math.min(...Object.values(inputSeeds).map((s) => s.year || 0))
  const candidates: Array<{ paper: SlimPaper; inputsCited: number }> = []
  for (const paper of Object.values(citingPapersRaw)) {
    if ((paper.citationCount || 0) === 0) continue
    if ((paper.year || 0) < minInputYear) continue
    const inputsCited = paper.references.filter((r) => inputIdSet.has(r)).length
    candidates.push({ paper, inputsCited })
  }
  candidates.sort(
    (a, b) =>
      b.inputsCited - a.inputsCited || (b.paper.citationCount || 0) - (a.paper.citationCount || 0),
  )

  const branchSeeds: Record<string, SlimPaper> = {}
  for (const { paper } of candidates.slice(0, MAX_BRANCH_SEEDS)) {
    branchSeeds[paper.id] = paper
  }

  // Step 5: Expand branches - refs shared by multiple branch seeds
  const branchRefFrequency: Record<string, number> = {}
  for (const seed of Object.values(branchSeeds)) {
    for (const ref of seed.references) {
      branchRefFrequency[ref] = (branchRefFrequency[ref] || 0) + 1
    }
  }

  const branchSeedIds = new Set(Object.keys(branchSeeds))
  const allBranchRefIds = new Set<string>()
  for (const [refId, count] of Object.entries(branchRefFrequency)) {
    if (count >= MIN_BRANCH_REF_FREQUENCY && !branchSeedIds.has(refId) && !inputIdSet.has(refId)) {
      allBranchRefIds.add(refId)
    }
  }

  const actualBranchRefBatches = Math.ceil(allBranchRefIds.size / OPENALEX_MAX_FILTER_IDS)
  totalApiCalls = completedApiCalls + actualBranchRefBatches + 2

  reportProgress(`Expanding branches: ${allBranchRefIds.size} refs...`)
  const branchRefsRaw = await fetchPapersBulkSlim([...allBranchRefIds], onBatchComplete)

  const branchPapers: Record<string, SlimPaper> = {}
  for (const [pid, paper] of Object.entries(branchRefsRaw)) {
    if ((paper.year || 0) >= minInputYear && (paper.citationCount || 0) > 0) {
      branchPapers[pid] = paper
    }
  }

  // Step 6: Rank and select top branches, using the virtual source
  reportProgress('Ranking branches...')
  const maxInputYear = Math.max(...Object.values(inputSeeds).map((s) => s.year || 0))
  const virtualSource = {
    id: 'VIRTUAL',
    references: foundInputIds,
    year: maxInputYear,
  }
  const branchRanks = computeBranchRanks(virtualSource, branchSeeds, branchPapers)
  const topBranchIds = getTopRanked(branchRanks, nBranches)

  // Step 7: Fetch full metadata for branch seeds and top-ranked papers
  const idsNeedingFullData = [
    ...new Set([...branchSeedIds, ...topRootIds, ...topBranchIds]),
  ].filter((pid) => !inputIdSet.has(pid))

  totalApiCalls = completedApiCalls + Math.ceil(idsNeedingFullData.length / OPENALEX_MAX_FILTER_IDS)

  reportProgress(`Fetching full metadata for ${idsNeedingFullData.length} papers...`)
  const fullPapers = await fetchPapersBulkFull(idsNeedingFullData, onBatchComplete)

  const allRanks = { ...rootRanks, ...branchRanks }

  const topPapers: Record<string, RawPaper> = {}
  for (const pid of topRootIds) {
    const paper = fullPapers[pid]
    if (paper) topPapers[pid] = { ...paper, role: 'root' }
  }
  for (const pid of topBranchIds) {
    const paper = fullPapers[pid]
    if (paper) topPapers[pid] = { ...paper, role: 'branch' }
  }

  const fullBranchSeeds: Record<string, RawPaper> = {}
  for (const pid of branchSeedIds) {
    const paper = fullPapers[pid]
    if (paper) fullBranchSeeds[pid] = paper
  }

  // Step 8: Build edges across everything in the graph
  const graphPapers: Record<string, RawPaper> = {
    ...topPapers,
    ...fullBranchSeeds,
    ...inputPapers,
  }
  const edges = buildEdgesFromPapers(graphPapers)

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
  completedApiCalls = totalApiCalls
  reportProgress(`Complete in ${elapsed}s`)

  const metadata: GraphMetadata = {
    graph_type: 'multi',
    source_ids: foundInputIds,
    source_count: foundInputIds.length,
    total_root_papers: Object.keys(rootPapers).length,
    total_branch_seeds: Object.keys(branchSeeds).length,
    total_branch_papers: Object.keys(branchPapers).length,
    n_roots: topRootIds.length,
    n_branches: topBranchIds.length,
    papers_in_graph: Object.keys(graphPapers).length,
    edges_in_graph: edges.length,
    build_time_seconds: parseFloat(elapsed),
    timestamp: new Date().toISOString(),
    api_calls: getApiCallCount(),
  }

  return {
    source_paper: undefined,
    source_papers: Object.values(inputPapers),
    root_seeds: [],
    branch_seeds: Object.values(fullBranchSeeds),
    papers: [...topRootIds, ...topBranchIds]
      .filter((pid) => pid in topPapers)
      .map((pid) => ({ ...topPapers[pid]!, ...allRanks[pid] })),
    edges,
    metadata,
  }
}
