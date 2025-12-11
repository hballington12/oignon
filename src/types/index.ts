// Author Types

export interface Author {
  name: string
  orcid?: string | null
  affiliation?: string
  affiliation_country?: string
}

// Paper / Node Types

export interface PaperMetadata {
  title: string
  authors: string[]
  authorsDetailed?: Author[]
  citationCount: number
  referencesCount?: number
  doi?: string
  openAlexUrl?: string
  isSource?: boolean
  // Additional metadata
  type?: string // e.g., 'article', 'preprint', 'book-chapter'
  sourceType?: string // e.g., 'journal', 'conference', 'repository'
  sourceName?: string // e.g., 'Nature', 'arXiv'
  openAccess?: boolean
  language?: string
  abstract?: string
}

export interface GraphNode {
  id: string
  order: number
  connections: string[]
  citedBy: string[]
  metadata: PaperMetadata
}

// Raw API / Graph Builder Types

export interface RawPaper {
  id: string
  doi?: string
  title: string
  authors: Author[]
  year: number
  citationCount: number
  referencesCount: number
  openAlexUrl: string
  references: string[]
  role?: 'root' | 'branch' | 'root_seed' | 'branch_seed'
  isSource?: boolean
  rank?: number
  citedCount?: number
  coCitedCount?: number
  coCitingCount?: number
  citingCount?: number
  // Additional metadata
  type?: string
  sourceType?: string
  sourceName?: string
  openAccess?: boolean
  language?: string
  abstract?: string
}

export interface GraphEdge {
  source: string
  target: string
  type: 'cites'
}

export interface GraphMetadata {
  source_year: number
  total_root_seeds: number
  total_root_papers: number
  total_branch_seeds: number
  total_branch_papers: number
  n_roots: number
  n_branches: number
  papers_in_graph: number
  edges_in_graph: number
  build_time_seconds: number
  timestamp: string
}

export interface RawGraph {
  source_paper: RawPaper
  root_seeds: RawPaper[]
  branch_seeds: RawPaper[]
  papers: RawPaper[]
  edges: GraphEdge[]
  metadata: GraphMetadata
}

export interface ProcessedGraph {
  nodes: GraphNode[]
}

// Visual / Rendering Types

export interface NodeVisuals {
  radius: number
  normalizedCitations: number
  fillColor: number
  strokeColor: number
  x: number
  y: number
}

export interface VisualNode extends GraphNode, NodeVisuals {
  gridX: number
  gridY: number
}

// Viewport Types

export interface ViewportState {
  scale: number
  targetScale: number
  x: number
  y: number
  targetX: number
  targetY: number
  animating: boolean
}

export interface ViewportLimits {
  minScale: number
  maxScale: number
  defaultScale: number
}

// Selection Types

export interface SelectionBox {
  startX: number
  startY: number
  endX: number
  endY: number
  active: boolean
}

export interface SelectionState {
  selectedNodeIds: Set<string>
  hoveredNodeId: string | null
  selectionBox: SelectionBox | null
}

// Colormap Types

export enum Colormap {
  Plasma = 0,
  Viridis = 1,
  Inferno = 2,
  Magma = 3,
  Cividis = 4,
  Turbo = 5,
}

export interface ColormapStop {
  t: number
  r: number
  g: number
  b: number
}

// Progress Types

export interface BuildProgress {
  message: string
  percent: number
  completed: number
  total: number
}

export type ProgressCallback = (progress: BuildProgress) => void

// App State Types (for Pinia store)

export interface AppState {
  graph: ProcessedGraph | null
  sourceNode: VisualNode | null
  rows: number
  cols: number
  uniqueOrders: number[]
  orderToRow: Record<number, number>
  viewport: ViewportState
  viewportLimits: ViewportLimits
  selection: SelectionState
  activeColormap: Colormap
  sidePanelCollapsed: boolean
  loading: boolean
  loadingProgress: BuildProgress | null
}
