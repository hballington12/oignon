// Author Types

export interface Author {
  id?: string // OpenAlex author ID
  name: string
  orcid?: string | null
  affiliation?: string
  affiliation_country?: string
}

// Paper / Node Types

// Topic classification from OpenAlex
export interface TopicClassification {
  id: string
  name: string
}

export interface PrimaryTopic {
  id: string
  name: string
  subfield: TopicClassification
  field: TopicClassification
  domain: TopicClassification
}

// Sustainable Development Goal
export interface SDG {
  id: string
  name: string
  score: number
}

// Citation percentile info
export interface CitationPercentile {
  value: number
  isInTop1Percent: boolean
  isInTop10Percent: boolean
}

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
  // Extended metadata
  fwci?: number // Field-Weighted Citation Impact
  citationPercentile?: CitationPercentile
  primaryTopic?: PrimaryTopic
  sdgs?: SDG[] // Sustainable Development Goals
  keywords?: string[]
  isRetracted?: boolean
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
  year: number
  references: string[]
  metadata: PaperMetadata
  // Graph building fields (not part of display metadata)
  role?: 'root' | 'branch' | 'root_seed' | 'branch_seed'
  rank?: number
  citedCount?: number
  coCitedCount?: number
  coCitingCount?: number
  citingCount?: number
}

export interface GraphEdge {
  source: string
  target: string
  type: 'cites'
}

export interface GraphMetadata {
  source_year?: number
  total_root_seeds?: number
  total_root_papers?: number
  total_branch_seeds?: number
  total_branch_papers?: number
  n_roots?: number
  n_branches?: number
  papers_in_graph: number
  edges_in_graph: number
  build_time_seconds: number
  timestamp: string
  api_calls?: number
  // Author graph specific
  graph_type?: 'paper' | 'author'
  author_id?: string
  author_name?: string
  author_orcid?: string
  author_affiliation?: string
  author_works_count?: number
  author_cited_by_count?: number
  author_h_index?: number
  author_i10_index?: number
}

export interface RawGraph {
  source_paper?: RawPaper
  root_seeds: RawPaper[]
  branch_seeds: RawPaper[]
  papers: RawPaper[]
  edges: GraphEdge[]
  metadata: GraphMetadata
}

export interface ProcessedGraph {
  nodes: GraphNode[]
  metadata?: GraphMetadata
  graphType?: 'paper' | 'author'
}

// Slim cache types (for localStorage efficiency)
// Uses numeric IDs (stripped of "W" prefix) to save space
// citedBy is rebuilt from connections on load
export interface SlimGraphNode {
  id: number
  order: number
  connections: number[]
}

export interface SlimCache {
  slim: true
  nodes: SlimGraphNode[]
  graphType?: 'paper' | 'author'
  sourceId?: number // paper ID for paper graphs (numeric, stripped of "W" prefix)
  authorId?: string // author OpenAlex ID for author graphs
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

// Library Types (bookmarks and recent graphs)

export interface BookmarkedPaper {
  id: string
  title: string
  firstAuthor?: string
  year?: number
  citations: number
  doi?: string
  openAlexUrl?: string
  addedAt: number // timestamp
}

export interface RecentGraph {
  sourceId: string
  title: string
  firstAuthor?: string
  year?: number
  nodeCount: number
  doi?: string
  openAlexUrl?: string
  timestamp: string // formatted date string
  addedAt: number // timestamp for sorting
  cache: SlimCache // slim cache data for instant reload
}

export interface FollowedAuthor {
  id: string
  displayName: string
  affiliation?: string
  orcid?: string
  worksCount: number
  citedByCount: number
  hIndex: number
  addedAt: number // timestamp
}

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
