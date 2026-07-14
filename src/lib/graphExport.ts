/**
 * Graph export - serializes the current graph to a downloadable JSON file.
 *
 * Reads from the visual node map (not ProcessedGraph.nodes) because metadata
 * hydration after a slim-cache load only updates the visual nodes.
 */

import type { VisualNode, GraphMetadata } from '@/types'

export interface ExportedPaper {
  id: string
  title: string
  authors: string[]
  year?: number
  doi?: string
  openAlexUrl?: string
  citationCount: number
  // True for the paper(s) the graph was built from: the single source paper,
  // or every input paper of a multi-paper graph
  isSource: boolean
  // IDs of other papers in this graph that this paper cites
  references: string[]
}

export interface GraphExport {
  app: 'oignon'
  version: 1
  exportedAt: string
  graphType: 'paper' | 'author' | 'multi'
  paperCount: number
  metadata?: GraphMetadata
  papers: ExportedPaper[]
}

export function buildGraphExport(
  nodes: Iterable<VisualNode>,
  graphType?: 'paper' | 'author' | 'multi',
  metadata?: GraphMetadata,
): GraphExport {
  const papers: ExportedPaper[] = []

  for (const node of nodes) {
    papers.push({
      id: node.id,
      title: node.metadata?.title || 'Untitled',
      authors: node.metadata?.authors || [],
      year: node.order || undefined,
      doi: node.metadata?.doi,
      openAlexUrl: node.metadata?.openAlexUrl,
      citationCount: node.metadata?.citationCount || 0,
      isSource: node.metadata?.isSource === true,
      references: node.connections,
    })
  }

  // Sources first, then by year descending
  papers.sort(
    (a, b) =>
      Number(b.isSource) - Number(a.isSource) ||
      (b.year || 0) - (a.year || 0) ||
      a.id.localeCompare(b.id),
  )

  return {
    app: 'oignon',
    version: 1,
    exportedAt: new Date().toISOString(),
    graphType: graphType || 'paper',
    paperCount: papers.length,
    metadata,
    papers,
  }
}

export function downloadGraphExport(data: GraphExport) {
  const date = data.exportedAt.slice(0, 10)
  const filename = `oignon-${data.graphType}-graph-${date}.json`

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
