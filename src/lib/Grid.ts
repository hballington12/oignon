import { GRID } from './constants'
import type { GraphNode, VisualNode } from '@/types'
import { getColormapColor, getBrighterColor, COLORMAPS } from './colormap'

// Node sizing
const MIN_NODE_RADIUS = 6
const MAX_NODE_RADIUS = (Math.min(GRID.xSpacing, GRID.ySpacing) / 2) * 0.8

// Minimum colormap position for nodes (avoids dark nodes on dark background)
const MIN_COLORMAP_T = 0.5

/** Remap normalized value (0-1) to colormap range (MIN_COLORMAP_T to 1) */
function toColormapT(t: number): number {
  return MIN_COLORMAP_T + t * (1 - MIN_COLORMAP_T)
}

export class Grid {
  rows: number
  cols: number
  nodes: Map<string, VisualNode>
  selectedNodes: Set<VisualNode>
  maxConnections = 0

  // Colormap index
  private colormapIndex = 0

  // Callbacks
  onNodeHover: ((node: VisualNode, isOver: boolean) => void) | null = null
  onNodeClick: ((node: VisualNode) => void) | null = null
  onSelectionChange: ((nodes: VisualNode[]) => void) | null = null

  constructor(rows: number, cols: number) {
    this.rows = rows
    this.cols = cols
    this.nodes = new Map()
    this.selectedNodes = new Set()
  }

  get width() {
    return this.cols * GRID.xSpacing
  }

  get height() {
    return (this.rows - 1) * GRID.ySpacing
  }

  get canvasWidth() {
    return this.width + GRID.padding * 2
  }

  get canvasHeight() {
    return this.height + GRID.padding * 2
  }

  populateNodes(nodesData: GraphNode[], orderToRow: Record<number, number>) {
    const nodesByOrder: Record<number, GraphNode[]> = {}

    nodesData.forEach((n) => {
      const order = n.order ?? 0
      if (!nodesByOrder[order]) nodesByOrder[order] = []
      nodesByOrder[order].push(n)
    })

    for (const [orderStr, group] of Object.entries(nodesByOrder)) {
      const order = Number(orderStr)
      if (isNaN(order)) continue

      const row = orderToRow[order]
      if (row === undefined) continue

      const count = group.length
      const mid = this.cols / 2
      const offset = (count - 1) / 2
      const startX = mid - offset

      group.forEach((n, i) => {
        const gridX = startX + i
        const gridY = row
        const x = GRID.padding + gridX * GRID.xSpacing
        const y = GRID.padding + gridY * GRID.ySpacing

        const visualNode: VisualNode = {
          ...n,
          gridX,
          gridY,
          x,
          y,
          radius: MIN_NODE_RADIUS,
          normalizedCitations: 0,
          fillColor: getColormapColor(toColormapT(0), this.getColormapStops()),
          strokeColor: 0x000000,
        }
        this.nodes.set(n.id, visualNode)
      })
    }

    this.computeNodeVisuals()
    return this
  }

  private computeNodeVisuals() {
    let minCount = Infinity
    let maxCount = 0

    for (const node of this.nodes.values()) {
      const count = node.citedBy.length
      minCount = Math.min(minCount, count)
      maxCount = Math.max(maxCount, count)
    }
    if (minCount === Infinity) minCount = 0

    for (const node of this.nodes.values()) {
      const count = node.citedBy.length

      if (maxCount === minCount) {
        node.radius = (MIN_NODE_RADIUS + MAX_NODE_RADIUS) / 2
        node.normalizedCitations = 0.5
        node.fillColor = getColormapColor(toColormapT(0.5), this.getColormapStops())
        continue
      }

      const logMin = Math.log1p(minCount)
      const logMax = Math.log1p(maxCount)
      const logCount = Math.log1p(count)
      const t = (logCount - logMin) / (logMax - logMin)

      node.radius = MIN_NODE_RADIUS + t * (MAX_NODE_RADIUS - MIN_NODE_RADIUS)
      node.normalizedCitations = t
      node.fillColor = getColormapColor(toColormapT(t), this.getColormapStops())
      node.strokeColor = getBrighterColor(node.fillColor)
    }
  }

  // Get nodes that have valid citations (targets exist in graph and are above)
  getNodesWithCitations(): VisualNode[] {
    return [...this.nodes.values()]
      .filter((node) => node.citedBy.some((id) => this.nodes.has(id)))
      .sort((a, b) => b.gridY - a.gridY)
  }

  // Get valid targets for a source node (exist in graph, above source)
  getValidTargets(sourceNode: VisualNode): VisualNode[] {
    return sourceNode.citedBy
      .map((id) => this.nodes.get(id))
      .filter((n): n is VisualNode => n !== undefined && n.gridY < sourceNode.gridY)
  }

  selectNode(node: VisualNode, multiSelect = false) {
    if (multiSelect) {
      if (this.selectedNodes.has(node)) {
        this.selectedNodes.delete(node)
      } else {
        this.selectedNodes.add(node)
      }
    } else {
      if (this.selectedNodes.has(node) && this.selectedNodes.size === 1) {
        this.clearSelection()
        return
      }
      this.selectedNodes.clear()
      this.selectedNodes.add(node)
    }

    this.onSelectionChange?.([...this.selectedNodes])
  }

  clearSelection() {
    this.selectedNodes.clear()
    this.onSelectionChange?.([])
  }

  setColormap(index: number) {
    this.colormapIndex = index
  }

  getColormap(): number {
    return this.colormapIndex
  }

  private getColormapStops() {
    return COLORMAPS[this.colormapIndex]!.stops
  }

  updateNodeColors() {
    const stops = this.getColormapStops()
    for (const node of this.nodes.values()) {
      node.fillColor = getColormapColor(toColormapT(node.normalizedCitations), stops)
      node.strokeColor = getBrighterColor(node.fillColor)
    }
  }

  destroy() {
    this.nodes.clear()
    this.selectedNodes.clear()
  }
}
