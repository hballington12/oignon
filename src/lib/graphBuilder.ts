import type {
  RawPaper,
  RawGraph,
  ProcessedGraph,
  GraphNode,
  GraphEdge,
  GraphMetadata,
  Author,
  BuildProgress,
  ProgressCallback,
  PaperMetadata,
  PrimaryTopic,
  SDG,
  CitationPercentile,
} from '@/types'

// Configuration
const OPENALEX_API = 'https://api.openalex.org'
const OPENALEX_MAX_PER_PAGE = 200
const OPENALEX_MAX_FILTER_IDS = 100
const MAX_PARALLEL_REQUESTS = 10

const DEFAULT_N_ROOTS = 25
const DEFAULT_N_BRANCHES = 25
const DEFAULT_BRANCH_SEEDS_LIMIT = 200
const MAX_AUTHORS_IN_PAPER = 5
const CITATION_HALF_LIFE = 4

// Utilities
function extractId(openalexUrl: string | undefined): string {
  if (openalexUrl && openalexUrl.startsWith('https://openalex.org/')) {
    return openalexUrl.split('/').pop() || ''
  }
  return openalexUrl || ''
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

function recencyWeight(
  paperYear: number,
  currentYear: number = new Date().getFullYear(),
  halfLife: number = CITATION_HALF_LIFE,
): number {
  const yearsSince = Math.max(1, currentYear - paperYear)
  return 1 + Math.log(1 + halfLife / yearsSince)
}

// Paper formatting
interface OpenAlexWork {
  id: string
  doi?: string
  title: string
  authorships?: Array<{
    author?: { display_name?: string; orcid?: string | null }
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
  // Extended fields
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
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string {
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

function formatPaper(work: OpenAlexWork): RawPaper {
  const refs = work.referenced_works || []
  const authorships = work.authorships || []

  const authors: Author[] = authorships.slice(0, MAX_AUTHORS_IN_PAPER).map((authorship) => {
    const authorInfo: Author = {
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

  // Parse keywords (just the strings)
  const keywords: string[] | undefined = work.keywords
    ?.filter((kw) => kw.keyword)
    .map((kw) => kw.keyword || '')

  return {
    id: work.id,
    doi: work.doi,
    title: work.title,
    authors,
    year: work.publication_year,
    citationCount: work.cited_by_count || 0,
    referencesCount: refs.length,
    openAlexUrl: work.id,
    references: refs.map(extractId),
    type: work.type,
    sourceType: work.primary_location?.source?.type,
    sourceName: work.primary_location?.source?.display_name,
    openAccess: work.open_access?.is_oa,
    language: work.language,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    // Extended metadata
    fwci: work.fwci,
    citationPercentile,
    primaryTopic,
    sdgs: sdgs?.length ? sdgs : undefined,
    keywords: keywords?.length ? keywords : undefined,
  }
}

// API Fetching
export async function fetchPaper(workId: string): Promise<RawPaper | null> {
  try {
    const response = await fetch(`${OPENALEX_API}/works/${workId}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const work = await response.json()
    return formatPaper(work)
  } catch (e) {
    console.error(`Error fetching ${workId}:`, e)
    return null
  }
}

// Fields to fetch from OpenAlex API
const OPENALEX_SELECT_FIELDS = [
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
  // Extended metadata
  'fwci',
  'citation_normalized_percentile',
  'primary_topic',
  'sustainable_development_goals',
  'keywords',
].join(',')

async function fetchBatch(batch: string[]): Promise<Record<string, RawPaper>> {
  const idFilter = batch.join('|')
  const params = new URLSearchParams({
    filter: `openalex:${idFilter}`,
    select: OPENALEX_SELECT_FIELDS,
    per_page: OPENALEX_MAX_PER_PAGE.toString(),
  })

  try {
    const response = await fetch(`${OPENALEX_API}/works?${params}`)
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

async function fetchPapersBulk(
  workIds: string[],
  onBatchComplete?: () => void,
): Promise<Record<string, RawPaper>> {
  if (!workIds.length) return {}

  const batches = chunk(workIds, OPENALEX_MAX_FILTER_IDS)
  const papers: Record<string, RawPaper> = {}

  for (let i = 0; i < batches.length; i += MAX_PARALLEL_REQUESTS) {
    const batchGroup = batches.slice(i, i + MAX_PARALLEL_REQUESTS)
    const results = await Promise.all(batchGroup.map(fetchBatch))

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

async function fetchCitationsBatch(batch: string[]): Promise<Set<string>> {
  const citesFilter = batch.join('|')
  const params = new URLSearchParams({
    filter: `cites:${citesFilter}`,
    select: 'id',
    per_page: OPENALEX_MAX_PER_PAGE.toString(),
  })

  try {
    const response = await fetch(`${OPENALEX_API}/works?${params}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    return new Set((data.results || []).map((work: { id: string }) => extractId(work.id)))
  } catch (e) {
    console.error('Citations batch error:', e)
    return new Set()
  }
}

async function fetchCitationsBulk(
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

async function fetchCitingPapers(
  workId: string,
  limit: number = DEFAULT_BRANCH_SEEDS_LIMIT,
): Promise<string[]> {
  const params = new URLSearchParams({
    filter: `cites:${workId}`,
    select: 'id',
    per_page: limit.toString(),
  })

  try {
    const response = await fetch(`${OPENALEX_API}/works?${params}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    return (data.results || []).map((work: { id: string }) => extractId(work.id))
  } catch (e) {
    console.error(`Error fetching citations for ${workId}:`, e)
    return []
  }
}

// Ranking
interface RankInfo {
  rank: number
  citedCount?: number
  coCitedCount?: number
  coCitingCount?: number
  citingCount?: number
}

function computeRootRanks(
  rootSeeds: Record<string, RawPaper>,
  rootPapers: Record<string, RawPaper>,
): Record<string, RankInfo> {
  const allPapers = { ...rootSeeds, ...rootPapers }
  const seedIds = new Set(Object.keys(rootSeeds))

  const citedCounts: Record<string, number> = {}
  for (const seed of Object.values(rootSeeds)) {
    for (const refId of seed.references || []) {
      if (refId in rootPapers) {
        citedCounts[refId] = (citedCounts[refId] || 0) + 1
      }
    }
  }

  const coCitedCounts: Record<string, number> = {}
  for (const paper of Object.values(allPapers)) {
    const refs = new Set(paper.references || [])
    const seedsInRefs = [...refs].filter((r) => seedIds.has(r))

    if (seedsInRefs.length > 0) {
      for (const refId of refs) {
        if (!seedIds.has(refId) && refId in allPapers) {
          coCitedCounts[refId] = (coCitedCounts[refId] || 0) + seedsInRefs.length
        }
      }
    }
  }

  const seedRefs = new Set<string>()
  for (const seed of Object.values(rootSeeds)) {
    for (const ref of seed.references || []) {
      seedRefs.add(ref)
    }
  }

  const coCitingCounts: Record<string, number> = {}
  for (const [paperId, paper] of Object.entries(allPapers)) {
    if (seedIds.has(paperId)) continue
    const refs = new Set(paper.references || [])
    const shared = [...refs].filter((r) => seedRefs.has(r)).length
    if (shared > 0) {
      coCitingCounts[paperId] = shared
    }
  }

  const ranks: Record<string, RankInfo> = {}
  for (const paperId of Object.keys(rootPapers)) {
    const cited = citedCounts[paperId] || 0
    const coCited = coCitedCounts[paperId] || 0
    const coCiting = coCitingCounts[paperId] || 0

    ranks[paperId] = {
      rank: cited + coCited + coCiting,
      citedCount: cited,
      coCitedCount: coCited,
      coCitingCount: coCiting,
    }
  }

  return ranks
}

function computeBranchRanks(
  source: RawPaper,
  branchSeeds: Record<string, RawPaper>,
  branchPapers: Record<string, RawPaper>,
): Record<string, RankInfo> {
  const subjectRefs = new Set(source.references || [])
  const subjectId = extractId(source.id || '')
  const allPapers = { ...branchSeeds, ...branchPapers }
  const branchSeedIds = new Set(Object.keys(branchSeeds))
  const currentYear = new Date().getFullYear()

  const citingCounts: Record<string, number> = {}
  for (const [paperId, paper] of Object.entries(branchPapers)) {
    const refs = new Set(paper.references || [])
    const count = [...refs].filter((r) => branchSeedIds.has(r)).length
    if (count > 0) {
      citingCounts[paperId] = count
    }
  }

  const coCitingCounts: Record<string, number> = {}
  for (const [paperId, paper] of Object.entries(branchPapers)) {
    const refs = new Set(paper.references || [])
    const shared = [...refs].filter((r) => subjectRefs.has(r)).length
    if (shared > 0) {
      coCitingCounts[paperId] = shared
    }
  }

  const coCitedCounts: Record<string, number> = {}
  for (const paper of Object.values(allPapers)) {
    const refs = paper.references || []
    const refIds = new Set(refs.map((r) => (r.includes('/') ? r.split('/').pop() : r)))

    if (refIds.has(subjectId)) {
      const paperYear = paper.year || currentYear
      const weight = recencyWeight(paperYear, currentYear)

      for (const refId of refIds) {
        if (refId && refId !== subjectId && refId in branchPapers) {
          coCitedCounts[refId] = (coCitedCounts[refId] || 0) + weight
        }
      }
    }
  }

  const ranks: Record<string, RankInfo> = {}
  for (const paperId of Object.keys(branchPapers)) {
    const citing = citingCounts[paperId] || 0
    const coCiting = coCitingCounts[paperId] || 0
    const coCited = coCitedCounts[paperId] || 0

    ranks[paperId] = {
      rank: citing + coCiting + coCited,
      citingCount: citing,
      coCitingCount: coCiting,
      coCitedCount: Math.round(coCited * 100) / 100,
    }
  }

  return ranks
}

function getTopRanked(ranks: Record<string, RankInfo>, n: number = 50): string[] {
  return Object.entries(ranks)
    .sort((a, b) => b[1].rank - a[1].rank)
    .slice(0, n)
    .map(([id]) => id)
}

// Edge Building
function buildEdges(
  source: RawPaper,
  allSeeds: Record<string, RawPaper>,
  topPapers: Record<string, RawPaper>,
): GraphEdge[] {
  const edges: GraphEdge[] = []
  const allIds = new Set([
    extractId(source.id),
    ...Object.keys(allSeeds),
    ...Object.keys(topPapers),
  ])
  const sourceId = extractId(source.id)

  for (const refId of source.references || []) {
    if (allIds.has(refId)) {
      edges.push({ source: sourceId, target: refId, type: 'cites' })
    }
  }

  for (const [seedId, seed] of Object.entries(allSeeds)) {
    for (const refId of seed.references || []) {
      if (allIds.has(refId)) {
        edges.push({ source: seedId, target: refId, type: 'cites' })
      }
    }
  }

  for (const [paperId, paper] of Object.entries(topPapers)) {
    for (const refId of paper.references || []) {
      if (allIds.has(refId)) {
        edges.push({ source: paperId, target: refId, type: 'cites' })
      }
    }
  }

  return edges
}

// Main Graph Builder
export interface BuildGraphOptions {
  nRoots?: number
  nBranches?: number
  onProgress?: ProgressCallback
}

export async function buildGraph(
  sourceId: string,
  options: BuildGraphOptions = {},
): Promise<RawGraph> {
  const { nRoots = DEFAULT_N_ROOTS, nBranches = DEFAULT_N_BRANCHES, onProgress } = options

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
  const estBranchRefBatches = Math.ceil((DEFAULT_BRANCH_SEEDS_LIMIT * 15) / OPENALEX_MAX_FILTER_IDS)
  const estBranchCitationBatches = Math.ceil(DEFAULT_BRANCH_SEEDS_LIMIT / 50)

  totalApiCalls =
    1 +
    estRootSeedBatches +
    estRootExpansionBatches +
    1 +
    estBranchSeedBatches +
    estBranchRefBatches +
    estBranchCitationBatches

  reportProgress(`Source: ${source.title} (${source.year})`)

  // Step 2: Build ROOTS
  reportProgress('Building roots...')
  const seedIds = source.references || []
  const rootSeeds = await fetchPapersBulk(seedIds, onBatchComplete)

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
    completedApiCalls +
    actualRootExpansionBatches +
    1 +
    estBranchSeedBatches +
    estBranchRefBatches +
    estBranchCitationBatches

  reportProgress(`Expanding roots: ${allRootRefIds.size} papers...`)
  const rootPapers = await fetchPapersBulk([...allRootRefIds], onBatchComplete)

  // Step 3: Rank and select top roots
  reportProgress('Ranking roots...')
  const rootRanks = computeRootRanks(rootSeeds, rootPapers)
  const topRootIds = getTopRanked(rootRanks, nRoots)

  // Step 4: Build BRANCHES
  reportProgress('Fetching citing papers...')
  const citingIds = await fetchCitingPapers(extractId(source.id), DEFAULT_BRANCH_SEEDS_LIMIT)
  completedApiCalls++

  const branchSeedBatches = Math.ceil(citingIds.length / OPENALEX_MAX_FILTER_IDS)
  reportProgress(`Fetching ${citingIds.length} branch seeds...`)
  const branchSeedsRaw = await fetchPapersBulk(citingIds, onBatchComplete)

  const minYear = (source.year || 0) + 1
  const branchSeeds: Record<string, RawPaper> = {}
  for (const [pid, paper] of Object.entries(branchSeedsRaw)) {
    if ((paper.citationCount || 0) > 0 && (paper.year || 0) >= minYear) {
      branchSeeds[pid] = paper
    }
  }

  const allBranchRefIds = new Set<string>()
  for (const seed of Object.values(branchSeeds)) {
    for (const ref of seed.references || []) {
      allBranchRefIds.add(ref)
    }
  }
  const sourceIdClean = extractId(source.id || '')
  for (const seedId of Object.keys(branchSeeds)) {
    allBranchRefIds.delete(seedId)
  }
  allBranchRefIds.delete(sourceIdClean)

  const branchSeedCount = Object.keys(branchSeeds).length
  const actualBranchRefBatches = Math.ceil(allBranchRefIds.size / OPENALEX_MAX_FILTER_IDS)
  const actualBranchCitationBatches = Math.ceil(branchSeedCount / 50)

  totalApiCalls = completedApiCalls + actualBranchRefBatches + actualBranchCitationBatches

  reportProgress(`Expanding branches: ${allBranchRefIds.size} refs...`)
  const branchRefsRaw = await fetchPapersBulk([...allBranchRefIds], onBatchComplete)

  reportProgress(`Fetching citations of ${branchSeedCount} seeds...`)
  const branchCitingIds = await fetchCitationsBulk(Object.keys(branchSeeds), onBatchComplete)

  const branchPapersRaw: Record<string, RawPaper> = { ...branchRefsRaw }

  const missingCitingIds = [...branchCitingIds].filter((id) => !(id in branchPapersRaw))
  if (missingCitingIds.length > 0) {
    const missingBatches = Math.ceil(missingCitingIds.length / OPENALEX_MAX_FILTER_IDS)
    totalApiCalls += missingBatches
    const missingPapers = await fetchPapersBulk(missingCitingIds, onBatchComplete)
    Object.assign(branchPapersRaw, missingPapers)
  }

  const branchPapers: Record<string, RawPaper> = {}
  for (const [pid, paper] of Object.entries(branchPapersRaw)) {
    if ((paper.year || 0) >= minYear && (paper.citationCount || 0) > 0) {
      branchPapers[pid] = paper
    }
  }

  // Step 5: Rank and select top branches
  reportProgress('Ranking branches...')
  const branchRanks = computeBranchRanks(source, branchSeeds, branchPapers)
  const topBranchIds = getTopRanked(branchRanks, nBranches)

  // Step 6: Combine and build edges
  reportProgress('Building graph...')
  const topPapers: Record<string, RawPaper> = {}
  for (const pid of topRootIds) {
    const paper = rootPapers[pid]
    if (paper) {
      topPapers[pid] = { ...paper, role: 'root' }
    }
  }
  for (const pid of topBranchIds) {
    const paper = branchPapers[pid]
    if (paper) {
      topPapers[pid] = { ...paper, role: 'branch' }
    }
  }

  const allSeeds = { ...rootSeeds, ...branchSeeds }
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
  }

  return {
    source_paper: source,
    root_seeds: Object.values(rootSeeds),
    branch_seeds: Object.values(branchSeeds),
    papers: [...topRootIds, ...topBranchIds]
      .filter((pid) => pid in topPapers)
      .map((pid) => ({ ...topPapers[pid]!, ...allRanks[pid] })),
    edges,
    metadata,
  }
}

// Hydrate metadata for slim-cached nodes
export async function hydrateMetadata(
  nodeIds: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Record<string, PaperMetadata>> {
  const batches = chunk(nodeIds, OPENALEX_MAX_FILTER_IDS)
  const totalBatches = batches.length
  let completedBatches = 0

  const results: Record<string, PaperMetadata> = {}

  for (let i = 0; i < batches.length; i += MAX_PARALLEL_REQUESTS) {
    const batchGroup = batches.slice(i, i + MAX_PARALLEL_REQUESTS)
    const batchResults = await Promise.all(batchGroup.map(fetchBatch))

    for (const paperMap of batchResults) {
      for (const [id, paper] of Object.entries(paperMap)) {
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
          // Extended metadata
          fwci: paper.fwci,
          citationPercentile: paper.citationPercentile,
          primaryTopic: paper.primaryTopic,
          sdgs: paper.sdgs,
          keywords: paper.keywords,
        }
      }
      completedBatches++
      onProgress?.(completedBatches, totalBatches)
    }
  }

  return results
}

// Preprocessing (converts graph to app format)
export function preprocessGraph(graph: RawGraph): ProcessedGraph {
  const allPapers: Record<string, RawPaper & { isSource?: boolean; role?: string }> = {}

  // Source paper
  if (graph.source_paper?.id) {
    const sourceId = extractId(graph.source_paper.id)
    allPapers[sourceId] = {
      ...graph.source_paper,
      id: sourceId,
      isSource: true,
    }
  }

  // Root seeds
  for (const paper of graph.root_seeds || []) {
    if (paper.id) {
      const pid = extractId(paper.id)
      if (!(pid in allPapers)) {
        allPapers[pid] = { ...paper, id: pid, role: 'root_seed' }
      }
    }
  }

  // Branch seeds
  for (const paper of graph.branch_seeds || []) {
    if (paper.id) {
      const pid = extractId(paper.id)
      if (!(pid in allPapers)) {
        allPapers[pid] = { ...paper, id: pid, role: 'branch_seed' }
      }
    }
  }

  // Ranked papers
  for (const paper of graph.papers || []) {
    if (paper.id) {
      const pid = extractId(paper.id)
      if (!(pid in allPapers)) {
        allPapers[pid] = { ...paper, id: pid }
      }
    }
  }

  const nodeIds = new Set(Object.keys(allPapers))

  // Build citedBy index
  const citedBy: Record<string, string[]> = {}
  for (const pid of nodeIds) {
    citedBy[pid] = []
  }
  for (const [pid, paper] of Object.entries(allPapers)) {
    for (const ref of paper.references || []) {
      const refId = extractId(ref)
      if (refId in citedBy) {
        citedBy[refId]?.push(pid)
      }
    }
  }

  // Transform to output format
  const nodes: GraphNode[] = []
  for (const [pid, paper] of Object.entries(allPapers)) {
    const refs = paper.references || []
    const connections = refs.map(extractId).filter((r) => nodeIds.has(r))

    const authorsRaw = paper.authors || []
    const authorNames = authorsRaw.map((a) => (typeof a === 'object' ? a.name || '' : String(a)))

    const metadata = {
      title: paper.title || '',
      authors: authorNames,
      citationCount: paper.citationCount || 0,
      doi: paper.doi,
      referencesCount: paper.referencesCount,
      openAlexUrl: paper.openAlexUrl,
      authorsDetailed:
        authorsRaw.length && typeof authorsRaw[0] === 'object' ? authorsRaw : undefined,
      isSource: paper.isSource,
      type: paper.type,
      sourceType: paper.sourceType,
      sourceName: paper.sourceName,
      openAccess: paper.openAccess,
      language: paper.language,
      abstract: paper.abstract,
      // Extended metadata
      fwci: paper.fwci,
      citationPercentile: paper.citationPercentile,
      primaryTopic: paper.primaryTopic,
      sdgs: paper.sdgs,
      keywords: paper.keywords,
    }

    nodes.push({
      id: pid,
      connections,
      order: paper.year,
      metadata,
      citedBy: citedBy[pid] || [],
    })
  }

  // Sort by year descending
  nodes.sort((a, b) => -(a.order || 0) - -(b.order || 0) || a.id.localeCompare(b.id))

  return { nodes }
}
