/**
 * Graph preprocessing - converts raw graph to app format
 */

import type { RawGraph, RawPaper, ProcessedGraph, GraphNode, GraphEdge } from '@/types'

function extractId(openalexUrl: string | undefined): string {
  if (openalexUrl && openalexUrl.startsWith('https://openalex.org/')) {
    return openalexUrl.split('/').pop() || ''
  }
  return openalexUrl || ''
}

/**
 * Build citation edges between papers in the graph
 */
export function buildEdges(
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

  // Edges from source
  for (const refId of source.references || []) {
    if (allIds.has(refId)) {
      edges.push({ source: sourceId, target: refId, type: 'cites' })
    }
  }

  // Edges from seeds
  for (const [seedId, seed] of Object.entries(allSeeds)) {
    for (const refId of seed.references || []) {
      if (allIds.has(refId)) {
        edges.push({ source: seedId, target: refId, type: 'cites' })
      }
    }
  }

  // Edges from top papers
  for (const [paperId, paper] of Object.entries(topPapers)) {
    for (const refId of paper.references || []) {
      if (allIds.has(refId)) {
        edges.push({ source: paperId, target: refId, type: 'cites' })
      }
    }
  }

  return edges
}

/**
 * Convert raw graph to processed format for the app
 */
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
