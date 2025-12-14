/**
 * Ranking algorithms for selecting top papers in citation graph
 */

const CITATION_HALF_LIFE = 4

export interface RankInfo {
  rank: number
  citedCount?: number
  coCitedCount?: number
  coCitingCount?: number
  citingCount?: number
}

// Common interface for ranking (works with both RawPaper and SlimPaper)
export type RankablePaper = { id?: string; references?: string[]; year?: number }

/**
 * Recency weight - boosts papers relative to how recent they are
 */
export function recencyWeight(
  paperYear: number,
  currentYear: number = new Date().getFullYear(),
  halfLife: number = CITATION_HALF_LIFE,
): number {
  const yearsSince = Math.max(1, currentYear - paperYear)
  return 1 + Math.log(1 + halfLife / yearsSince)
}

/**
 * Compute ranks for root papers (references of source's references)
 * Scoring based on: cited by seeds, co-cited with seeds, co-citing seeds
 */
export function computeRootRanks(
  rootSeeds: Record<string, RankablePaper>,
  rootPapers: Record<string, RankablePaper>,
): Record<string, RankInfo> {
  const allPapers = { ...rootSeeds, ...rootPapers }
  const seedIds = new Set(Object.keys(rootSeeds))

  // Count how many seeds cite each paper
  const citedCounts: Record<string, number> = {}
  for (const seed of Object.values(rootSeeds)) {
    for (const refId of seed.references || []) {
      if (refId in rootPapers) {
        citedCounts[refId] = (citedCounts[refId] || 0) + 1
      }
    }
  }

  // Count co-citations with seeds
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

  // Build set of all seed references
  const seedRefs = new Set<string>()
  for (const seed of Object.values(rootSeeds)) {
    for (const ref of seed.references || []) {
      seedRefs.add(ref)
    }
  }

  // Count co-citing (papers that cite same refs as seeds)
  const coCitingCounts: Record<string, number> = {}
  for (const [paperId, paper] of Object.entries(allPapers)) {
    if (seedIds.has(paperId)) continue
    const refs = new Set(paper.references || [])
    const shared = [...refs].filter((r) => seedRefs.has(r)).length
    if (shared > 0) {
      coCitingCounts[paperId] = shared
    }
  }

  // Combine scores
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

/**
 * Compute ranks for branch papers (papers citing the source)
 * Scoring based on: citing seeds, co-citing source, co-cited with source
 */
export function computeBranchRanks(
  source: RankablePaper,
  branchSeeds: Record<string, RankablePaper>,
  branchPapers: Record<string, RankablePaper>,
): Record<string, RankInfo> {
  const subjectRefs = new Set(source.references || [])
  const subjectId = extractId(source.id || '')
  const allPapers = { ...branchSeeds, ...branchPapers }
  const branchSeedIds = new Set(Object.keys(branchSeeds))
  const currentYear = new Date().getFullYear()

  // Count how many seeds each paper cites
  const citingCounts: Record<string, number> = {}
  for (const [paperId, paper] of Object.entries(branchPapers)) {
    const refs = new Set(paper.references || [])
    const count = [...refs].filter((r) => branchSeedIds.has(r)).length
    if (count > 0) {
      citingCounts[paperId] = count
    }
  }

  // Count co-citing (papers that cite same refs as source)
  const coCitingCounts: Record<string, number> = {}
  for (const [paperId, paper] of Object.entries(branchPapers)) {
    const refs = new Set(paper.references || [])
    const shared = [...refs].filter((r) => subjectRefs.has(r)).length
    if (shared > 0) {
      coCitingCounts[paperId] = shared
    }
  }

  // Count co-cited with source (recency weighted)
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

  // Combine scores
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

/**
 * Get top N papers by rank score
 */
export function getTopRanked(ranks: Record<string, RankInfo>, n: number = 50): string[] {
  return Object.entries(ranks)
    .sort((a, b) => b[1].rank - a[1].rank)
    .slice(0, n)
    .map(([id]) => id)
}

// Local helper
function extractId(openalexUrl: string | undefined): string {
  if (openalexUrl && openalexUrl.startsWith('https://openalex.org/')) {
    return openalexUrl.split('/').pop() || ''
  }
  return openalexUrl || ''
}
