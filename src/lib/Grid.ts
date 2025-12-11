import { Graphics, Container, RenderTexture, Sprite, type Renderer } from 'pixi.js'
import { BloomFilter } from 'pixi-filters'
import { GRID } from './constants'
import type { GraphNode, VisualNode } from '@/types'
import {
  createRotationHelpers,
  calcRotatedControlPoints,
  sampleBezierMinX,
  sampleBezierMinY,
  subdivideBezier,
  type Point,
} from './bezier'
import { getColormapColor, getBrighterColor, COLORMAPS } from './colormap'
import { ColorMapFilter } from './ColorMapFilter'

// Node sizing
const MIN_NODE_RADIUS = 6
const MAX_NODE_RADIUS = (Math.min(GRID.xSpacing, GRID.ySpacing) / 2) * 0.8

// Node visual constants
const NODE_SHADOW = {
  outerOffset: { x: 2, y: 3 },
  outerExtraRadius: 2,
  outerAlpha: 0.25,
  innerOffset: { x: 1, y: 2 },
  innerAlpha: 0.4,
}

const NODE_HIGHLIGHT = {
  primary: { offset: 0.15, radius: 0.75, alpha: 0.12 },
  secondary: { offset: 0.25, radius: 0.45, alpha: 0.2 },
  tertiary: { offset: 0.3, radius: 0.2, alpha: 0.35 },
}

const NODE_STROKE = {
  default: { width: 2.5, color: 0x000000, alpha: 0.7 },
  selected: { width: 4, color: 0xffffff, alpha: 1 },
}

const NODE_HIT_AREA_SCALE = 1.5
const NODE_MIN_HIT_RADIUS = 12

// Curve params (hardcoded for now, was in controls.js)
const CURVE_PARAMS = {
  bulge: 0.8,
  tail: 0.15,
  density: 0.2,
}

const CP1Y = 0
const CP2Y = 0.5
const MAX_CP1X = 2
const MAX_CP2X = 1.0

function getCp1x() {
  return CURVE_PARAMS.bulge * 2
}
function getCp2x() {
  return 1.0 - CURVE_PARAMS.tail * 0.5
}
function getDensity() {
  return CURVE_PARAMS.density * 0.75
}
function getInnerBulgeFactor() {
  return 1 - getDensity()
}

// Curve direction constant
const CURVE_ANGLE = 30

// Bezier curve Y-position ranges for control points
const CP1Y_RANGE = { min: -0.1, max: 0.1 }
const CP2Y_RANGE = { min: 0.4, max: 0.6 }

// Curve visual constants
const CURVE_STROKE_WIDTH = 2
const CURVE_STROKE_ALPHA = 0.2
const CURVE_FILL_COLOR = 0xffffff
const CURVE_STROKE_COLOR = 0xffffff

// Easing functions
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// Animate a sprite's alpha from current value to target
function animateSpriteAlpha(
  sprite: Sprite,
  targetAlpha: number,
  duration: number,
  onComplete?: () => void,
) {
  const startAlpha = sprite.alpha
  const startTime = performance.now()

  const animate = () => {
    const elapsed = performance.now() - startTime
    const progress = Math.min(1, elapsed / duration)
    const eased = easeOutCubic(progress)
    sprite.alpha = startAlpha + (targetAlpha - startAlpha) * eased

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      onComplete?.()
    }
  }
  requestAnimationFrame(animate)
}

interface CurveControlPoints {
  outer: { cp1: Point; cp2: Point; end: Point }
  inner: { cp1: Point; cp2: Point }
}

// Reverse a curve so it animates from end to start
function reverseCurve(
  start: Point,
  cp: CurveControlPoints,
): { start: Point; cp: CurveControlPoints } {
  return {
    start: cp.outer.end,
    cp: {
      outer: { cp1: cp.outer.cp2, cp2: cp.outer.cp1, end: start },
      inner: { cp1: cp.inner.cp2, cp2: cp.inner.cp1 },
    },
  }
}

// Cached curve data for efficient animation
interface CachedCurve {
  start: Point
  cp: CurveControlPoints
  fillAlpha: number
  sourceNode: VisualNode
  targetNode: VisualNode
  direction: 'up' | 'down'
}

type DrawDirection = 'left' | 'right' | 'symmetric'
export type DrawDirectionStrategy = 'alternating' | 'symmetric' | 'random' | 'uniform'

interface TargetGroup {
  sourceNode: VisualNode
  targets: VisualNode[]
  drawDirection: DrawDirection
}

export class Grid {
  rows: number
  cols: number
  container: Container
  nodes: Map<string, VisualNode>
  selectedNodes: Set<VisualNode>

  curveOverhang = 0
  curveUnderhang = 0
  maxConnections = 0

  private graphics: Graphics
  private nodesOverlayContainer: Container | null = null
  private graphicsToNode: Map<Container, VisualNode> = new Map()
  private onionContainer: Container
  private onionGraphics: Graphics[] = []
  private onionTexture: RenderTexture | null = null
  private onionSprite: Sprite | null = null
  private renderer: Renderer | null = null
  private colorMapFilter: ColorMapFilter
  private bloomFilter: BloomFilter

  // Animation state
  nodeAnimationComplete = false
  nodeFinishedMap = new Map<VisualNode, number>() // value = finish timestamp
  private curveAnimationId = 0 // incremented to cancel running animations

  // Draw direction strategy
  drawDirectionStrategy: DrawDirectionStrategy = 'alternating'
  private randomSeed = 12345

  // Callbacks
  onNodeHover: ((node: VisualNode, isOver: boolean) => void) | null = null
  onNodeClick: ((node: VisualNode) => void) | null = null
  onSelectionChange: ((nodes: VisualNode[]) => void) | null = null

  constructor(rows: number, cols: number) {
    this.rows = rows
    this.cols = cols
    this.graphics = new Graphics()
    this.container = new Container()
    this.nodes = new Map()
    this.selectedNodes = new Set()
    this.onionContainer = new Container()
    this.colorMapFilter = new ColorMapFilter()
    this.bloomFilter = new BloomFilter({ strength: 8 })
    this.container.addChild(this.graphics)
  }

  // Get nodes that have valid citations (targets exist in graph and are above)
  private getNodesWithCitations(): VisualNode[] {
    return [...this.nodes.values()]
      .filter((node) => node.citedBy.some((id) => this.nodes.has(id)))
      .sort((a, b) => b.gridY - a.gridY)
  }

  // Get valid targets for a source node (exist in graph, above source)
  private getValidTargets(sourceNode: VisualNode): VisualNode[] {
    return sourceNode.citedBy
      .map((id) => this.nodes.get(id))
      .filter((n): n is VisualNode => n !== undefined && n.gridY < sourceNode.gridY)
  }

  // Get curve angles for a draw direction
  private getAnglesForDirection(direction: DrawDirection): number[] {
    switch (direction) {
      case 'left':
        return [CURVE_ANGLE]
      case 'right':
        return [-CURVE_ANGLE]
      case 'symmetric':
        return [CURVE_ANGLE, -CURVE_ANGLE]
    }
  }

  // Filter targets for a specific angle (for symmetric splitting)
  private filterTargetsForAngle(
    targets: VisualNode[],
    angle: number,
    sourceNode: VisualNode,
  ): VisualNode[] {
    if (angle === CURVE_ANGLE) {
      // Left side: targets left of center, or balanced
      return this.splitTargetsByDirection(targets).left
    } else {
      // Right side
      return this.splitTargetsByDirection(targets).right
    }
  }

  // Seeded random for deterministic "random" direction
  private seededRandom(x: number, y: number): number {
    const hash = (x * 73856093) ^ (y * 19349663) ^ this.randomSeed
    return ((hash * 16807) % 2147483647) / 2147483647
  }

  // Determine draw direction for a node based on current strategy
  private getNodeDrawDirection(node: VisualNode): DrawDirection {
    // Source nodes always symmetric
    if (node.metadata?.isSource) {
      return 'symmetric'
    }

    switch (this.drawDirectionStrategy) {
      case 'uniform':
        // All nodes draw symmetrically
        return 'symmetric'

      case 'symmetric':
        // Center column symmetric, others based on position
        const gridCenter = this.cols / 2
        if (node.gridX < gridCenter) return 'left'
        if (node.gridX > gridCenter) return 'right'
        return 'symmetric'

      case 'random':
        // Seeded random for deterministic results
        const rand = this.seededRandom(node.gridX, node.gridY)
        if (rand < 0.33) return 'left'
        if (rand < 0.66) return 'right'
        return 'symmetric'

      case 'alternating':
      default:
        // Left/right of center, center column alternates by row
        const center = this.cols / 2
        if (node.gridX < center) return 'left'
        if (node.gridX > center) return 'right'
        return node.gridY % 2 === 0 ? 'right' : 'left'
    }
  }

  // Split targets into left/right groups (for source node)
  private splitTargetsByDirection(targets: VisualNode[]): {
    left: VisualNode[]
    right: VisualNode[]
  } {
    const gridCenter = this.cols / 2
    const left: VisualNode[] = []
    const right: VisualNode[] = []

    for (const target of targets) {
      if (target.gridX < gridCenter) {
        left.push(target)
      } else if (target.gridX > gridCenter) {
        right.push(target)
      } else {
        // Center targets: balance between sides
        if (left.length <= right.length) {
          left.push(target)
        } else {
          right.push(target)
        }
      }
    }

    return { left, right }
  }

  // Build all target groups for curve rendering
  private buildTargetGroups(filterBySelection = false): TargetGroup[] {
    const groups: TargetGroup[] = []
    const nodesWithCitations = this.getNodesWithCitations()

    // Calculate max connections
    this.maxConnections = 0
    for (const node of nodesWithCitations) {
      const targets = this.getValidTargets(node)
      this.maxConnections = Math.max(this.maxConnections, targets.length)
    }

    for (const sourceNode of nodesWithCitations) {
      let targets = this.getValidTargets(sourceNode)

      // Filter by selection if needed
      if (filterBySelection && this.selectedNodes.size > 0) {
        if (!this.selectedNodes.has(sourceNode)) {
          targets = targets.filter((t) => this.selectedNodes.has(t))
          if (targets.length === 0) continue
        }
      }

      if (targets.length === 0) continue

      const drawDirection = this.getNodeDrawDirection(sourceNode)
      groups.push({ sourceNode, targets, drawDirection })
    }

    return groups
  }

  // Set random seed for the 'random' draw direction strategy
  setRandomSeed(seed: number) {
    this.randomSeed = seed
  }

  get width() {
    return this.cols * GRID.xSpacing
  }

  get height() {
    return (this.rows - 1) * GRID.ySpacing
  }

  get canvasWidth() {
    return this.width + GRID.padding * 2 + this.curveOverhang * 2
  }

  get canvasHeight() {
    return this.height + GRID.padding * 2 + this.curveUnderhang * 2
  }

  setRenderer(renderer: Renderer) {
    this.renderer = renderer
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
          fillColor: getColormapColor(0, this.getColormapStops()),
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
        node.fillColor = getColormapColor(0.5, this.getColormapStops())
        continue
      }

      const logMin = Math.log1p(minCount)
      const logMax = Math.log1p(maxCount)
      const logCount = Math.log1p(count)
      const t = (logCount - logMin) / (logMax - logMin)

      node.radius = MIN_NODE_RADIUS + t * (MAX_NODE_RADIUS - MIN_NODE_RADIUS)
      node.normalizedCitations = t
      node.fillColor = getColormapColor(t, this.getColormapStops())
      node.strokeColor = getBrighterColor(node.fillColor)
    }
  }

  // Draw shadows for a node
  private drawNodeShadows(g: Graphics, x: number, y: number, radius: number) {
    const { outerOffset, outerExtraRadius, outerAlpha, innerOffset, innerAlpha } = NODE_SHADOW
    g.circle(x + outerOffset.x, y + outerOffset.y, radius + outerExtraRadius)
    g.fill({ color: 0x000000, alpha: outerAlpha })
    g.circle(x + innerOffset.x, y + innerOffset.y, radius)
    g.fill({ color: 0x000000, alpha: innerAlpha })
  }

  // Draw highlights for a node
  private drawNodeHighlights(g: Graphics, x: number, y: number, radius: number) {
    const { primary, secondary, tertiary } = NODE_HIGHLIGHT
    g.circle(x - radius * primary.offset, y - radius * primary.offset, radius * primary.radius)
    g.fill({ color: 0xffffff, alpha: primary.alpha })
    g.circle(
      x - radius * secondary.offset,
      y - radius * secondary.offset,
      radius * secondary.radius,
    )
    g.fill({ color: 0xffffff, alpha: secondary.alpha })
    g.circle(x - radius * tertiary.offset, y - radius * tertiary.offset, radius * tertiary.radius)
    g.fill({ color: 0xffffff, alpha: tertiary.alpha })
  }

  // Draw stroke for a node
  private drawNodeStroke(g: Graphics, x: number, y: number, radius: number, isSelected: boolean) {
    const stroke = isSelected ? NODE_STROKE.selected : NODE_STROKE.default
    g.circle(x, y, radius)
    g.stroke({ width: stroke.width, color: stroke.color, alpha: stroke.alpha })
  }

  // Setup node interactivity
  private setupNodeInteraction(g: Graphics, node: VisualNode) {
    const { x, y, radius } = node
    const hitRadius = Math.max(radius * NODE_HIT_AREA_SCALE, NODE_MIN_HIT_RADIUS)

    g.eventMode = 'static'
    g.cursor = 'pointer'
    g.hitArea = {
      contains: (px: number, py: number) => Math.hypot(px - x, py - y) <= hitRadius,
    }

    g.on('pointerover', () => this.onNodeHover?.(node, true))
    g.on('pointerout', () => this.onNodeHover?.(node, false))
    g.on('pointertap', (e) => {
      e.stopPropagation()
      const multiSelect = e.ctrlKey || e.metaKey
      this.selectNode(node, multiSelect)
      this.onNodeClick?.(node)
    })
  }

  drawNodesOverlay() {
    if (this.nodesOverlayContainer) {
      this.container.removeChild(this.nodesOverlayContainer)
      this.nodesOverlayContainer.destroy({ children: true })
    }

    this.nodesOverlayContainer = new Container()
    this.graphicsToNode.clear()

    for (const node of this.nodes.values()) {
      const g = new Graphics()
      const { x, y, radius, fillColor } = node
      const isSelected = this.selectedNodes.has(node)

      this.drawNodeShadows(g, x, y, radius)
      g.circle(x, y, radius)
      g.fill({ color: fillColor })
      this.drawNodeHighlights(g, x, y, radius)
      this.drawNodeStroke(g, x, y, radius, isSelected)
      this.setupNodeInteraction(g, node)

      g.pivot.set(x, y)
      g.position.set(x, y)

      this.graphicsToNode.set(g, node)
      this.nodesOverlayContainer.addChild(g)
    }

    this.container.addChild(this.nodesOverlayContainer)
    return this
  }

  selectNode(node: VisualNode, multiSelect = false) {
    if (multiSelect) {
      if (this.selectedNodes.has(node)) {
        this.selectedNodes.delete(node)
      } else {
        this.selectedNodes.add(node)
      }
    } else {
      // Toggle: if clicking already-selected node, deselect it
      if (this.selectedNodes.has(node) && this.selectedNodes.size === 1) {
        this.clearSelection()
        return
      }
      this.selectedNodes.clear()
      this.selectedNodes.add(node)
    }

    this.drawNodesOverlay()
    this.animateSelection()
    this.onSelectionChange?.([...this.selectedNodes])
  }

  clearSelection() {
    this.selectedNodes.clear()
    this.drawNodesOverlay()
    this.fadeInStaticConnectors()
    this.onSelectionChange?.([])
  }

  // Animate curves for current selection (or all if none selected)
  animateSelection(duration = 500) {
    this.animateCurvesIn({ duration, durationStrategy: 'fixedIndependent' })
  }

  // Fade in the static connector sprite (used when deselecting)
  fadeInStaticConnectors(duration = 400) {
    // Cancel any running curve animation
    this.curveAnimationId++

    // Clear any existing connectors without fade (we'll create new ones)
    this.clearConnectors(false)

    // Draw the full static connectors (no selection filter since selectedNodes is empty)
    this.drawOnionConnectors(1)

    // Fade the sprite in from 0
    if (this.onionSprite) {
      this.onionSprite.alpha = 0
      animateSpriteAlpha(this.onionSprite, 1, duration)
    }
  }

  // Clear static connector graphics
  private clearConnectors(fade = false, fadeDuration = 500) {
    // Clear onion graphics immediately
    for (const g of this.onionGraphics) {
      this.onionContainer.removeChild(g)
      g.destroy()
    }
    this.onionGraphics = []

    if (this.onionSprite) {
      if (fade && this.onionSprite.alpha > 0) {
        const sprite = this.onionSprite
        this.onionSprite = null
        animateSpriteAlpha(sprite, 0, fadeDuration, () => {
          this.container.removeChild(sprite)
          sprite.destroy()
        })
      } else {
        this.container.removeChild(this.onionSprite)
        this.onionSprite.destroy()
        this.onionSprite = null
      }
    }

    if (this.onionTexture) {
      // Don't destroy texture if fading - sprite still needs it
      if (!fade) {
        this.onionTexture.destroy()
      }
      this.onionTexture = null
    }
  }

  calculateCurveBounds() {
    this.curveOverhang = 0
    this.curveUnderhang = 0

    const groups = this.buildTargetGroups(false)
    if (groups.length === 0) return this

    for (const { sourceNode, targets, drawDirection } of groups) {
      const x0 = sourceNode.x
      const y0 = sourceNode.y
      const start = { x: x0, y: y0 }

      const angles = this.getAnglesForDirection(drawDirection)

      for (const angle of angles) {
        const curveTargets =
          drawDirection === 'symmetric'
            ? this.filterTargetsForAngle(targets, angle, sourceNode)
            : targets

        if (curveTargets.length === 0) continue

        const { cosR, sinR, rotateBack } = createRotationHelpers(angle, x0, y0)

        let globalMinX = x0
        let globalMinY = y0

        for (const target of curveTargets) {
          const relX = target.x - x0
          const relY = target.y - y0
          const rotX = relX * cosR - relY * sinR
          const rotY = relX * sinR + relY * cosR

          const { cp1, cp2, end } = calcRotatedControlPoints(
            rotX,
            rotY,
            MAX_CP1X,
            CP1Y,
            MAX_CP2X,
            CP2Y,
          )
          const cp1Back = rotateBack(cp1)
          const cp2Back = rotateBack(cp2)
          const endBack = rotateBack(end)

          globalMinX = Math.min(globalMinX, sampleBezierMinX(start, cp1Back, cp2Back, endBack))
          globalMinY = Math.min(globalMinY, sampleBezierMinY(start, cp1Back, cp2Back, endBack))
        }

        this.curveOverhang = Math.max(this.curveOverhang, GRID.padding - globalMinX)
        this.curveUnderhang = Math.max(this.curveUnderhang, GRID.padding - globalMinY)
      }
    }

    return this
  }

  drawOnionConnectors(progress = 1) {
    this.clearConnectors()

    const groups = this.buildTargetGroups(true)
    if (groups.length === 0) return this

    for (const { sourceNode, targets, drawDirection } of groups) {
      const angles = this.getAnglesForDirection(drawDirection)
      for (const angle of angles) {
        const curveTargets =
          drawDirection === 'symmetric'
            ? this.filterTargetsForAngle(targets, angle, sourceNode)
            : targets
        if (curveTargets.length === 0) continue
        this.drawConnectorGroup(sourceNode, curveTargets, angle, progress)
      }
    }

    // Render to texture
    if (this.renderer && this.onionGraphics.length > 0) {
      const baseResolution = this.renderer.resolution || 1
      const resolution = baseResolution * 2 // 2x supersampling for sharper curves
      this.onionTexture = RenderTexture.create({
        width: this.canvasWidth,
        height: this.canvasHeight,
        resolution,
        antialias: true,
      })

      this.onionContainer.x = this.curveOverhang
      this.onionContainer.y = this.curveUnderhang

      this.renderer.render({
        container: this.onionContainer,
        target: this.onionTexture,
        clear: true,
      })

      this.onionSprite = new Sprite(this.onionTexture)
      this.onionSprite.x = -this.curveOverhang
      this.onionSprite.y = -this.curveUnderhang
      this.onionSprite.filters = [this.colorMapFilter, this.bloomFilter]
      this.container.addChildAt(this.onionSprite, 0)
    }

    return this
  }

  // Calculate curve control points for a target
  private calculateCurvePoints(
    target: VisualNode,
    x0: number,
    y0: number,
    cosR: number,
    sinR: number,
    rotateBack: (p: Point) => Point,
    t: number,
  ): CurveControlPoints {
    const relX = target.x - x0
    const relY = target.y - y0
    const rotX = relX * cosR - relY * sinR
    const rotY = relX * sinR + relY * cosR

    const cp1y = CP1Y_RANGE.min + t * (CP1Y_RANGE.max - CP1Y_RANGE.min)
    const cp2y = CP2Y_RANGE.min + t * (CP2Y_RANGE.max - CP2Y_RANGE.min)

    const outer = calcRotatedControlPoints(rotX, rotY, getCp1x(), cp1y, getCp2x(), cp2y)
    const innerCp1x = getCp1x() * getInnerBulgeFactor()
    const inner = calcRotatedControlPoints(rotX, rotY, innerCp1x, cp1y, 0.5, cp2y)

    return {
      outer: {
        cp1: rotateBack(outer.cp1),
        cp2: rotateBack(outer.cp2),
        end: rotateBack(outer.end),
      },
      inner: {
        cp1: rotateBack(inner.cp1),
        cp2: rotateBack(inner.cp2),
      },
    }
  }

  // Draw a complete bezier curve (no animation)
  private drawCompleteCurve(g: Graphics, start: Point, cp: CurveControlPoints, fillAlpha: number) {
    // Fill shape
    g.moveTo(start.x, start.y)
    g.bezierCurveTo(
      cp.outer.cp1.x,
      cp.outer.cp1.y,
      cp.outer.cp2.x,
      cp.outer.cp2.y,
      cp.outer.end.x,
      cp.outer.end.y,
    )
    g.bezierCurveTo(
      cp.inner.cp2.x,
      cp.inner.cp2.y,
      cp.inner.cp1.x,
      cp.inner.cp1.y,
      start.x,
      start.y,
    )
    g.closePath()
    g.fill({ color: CURVE_FILL_COLOR, alpha: fillAlpha })

    // Stroke outline
    g.moveTo(start.x, start.y)
    g.bezierCurveTo(
      cp.outer.cp1.x,
      cp.outer.cp1.y,
      cp.outer.cp2.x,
      cp.outer.cp2.y,
      cp.outer.end.x,
      cp.outer.end.y,
    )
    g.stroke({ width: CURVE_STROKE_WIDTH, color: CURVE_STROKE_COLOR, alpha: CURVE_STROKE_ALPHA })
  }

  // Draw a partial bezier curve using De Casteljau subdivision
  // This uses native bezierCurveTo() for smooth curves instead of line segments
  private drawPartialCurve(
    g: Graphics,
    start: Point,
    cp: CurveControlPoints,
    fillAlpha: number,
    progress: number,
  ) {
    if (progress <= 0) return

    // Subdivide both curves at the progress point
    const outer = subdivideBezier(start, cp.outer.cp1, cp.outer.cp2, cp.outer.end, progress)
    const inner = subdivideBezier(start, cp.inner.cp1, cp.inner.cp2, cp.outer.end, progress)

    // Taper: lerp inner endpoint toward outer endpoint
    const taperAmount = Math.pow(progress, 0.5) // More taper at start, less at end
    const taperFactor = 0.3 + 0.7 * taperAmount // 30% pinch at start, full width at end
    const innerEnd = {
      x: outer.p3.x + (inner.p3.x - outer.p3.x) * taperFactor,
      y: outer.p3.y + (inner.p3.y - outer.p3.y) * taperFactor,
    }

    // Also taper the inner control point near the end
    const innerCp2 = {
      x: outer.cp2.x + (inner.cp2.x - outer.cp2.x) * taperFactor,
      y: outer.cp2.y + (inner.cp2.y - outer.cp2.y) * taperFactor,
    }

    // Draw fill shape using native bezier curves
    g.moveTo(start.x, start.y)
    g.bezierCurveTo(outer.cp1.x, outer.cp1.y, outer.cp2.x, outer.cp2.y, outer.p3.x, outer.p3.y)
    g.bezierCurveTo(innerCp2.x, innerCp2.y, inner.cp1.x, inner.cp1.y, start.x, start.y)
    g.closePath()
    g.fill({ color: CURVE_FILL_COLOR, alpha: fillAlpha })

    // Draw stroke with alpha fade at tip
    g.moveTo(start.x, start.y)
    g.bezierCurveTo(outer.cp1.x, outer.cp1.y, outer.cp2.x, outer.cp2.y, outer.p3.x, outer.p3.y)
    const tipAlpha = progress > 0.9 ? CURVE_STROKE_ALPHA : CURVE_STROKE_ALPHA * (progress / 0.9)
    g.stroke({ width: CURVE_STROKE_WIDTH, color: CURVE_STROKE_COLOR, alpha: tipAlpha })
  }

  private drawConnectorGroup(
    sourceNode: VisualNode,
    targets: VisualNode[],
    angle: number,
    progress: number,
  ) {
    const g = new Graphics()
    this.onionGraphics.push(g)

    const x0 = sourceNode.x
    const y0 = sourceNode.y
    const start = { x: x0, y: y0 }
    const { cosR, sinR, rotateBack } = createRotationHelpers(angle, x0, y0)

    const sortedTargets = [...targets].sort((a, b) => b.y - a.y)
    const fillAlpha = (getDensity() * (1 / this.maxConnections)) / 0.75

    for (let i = 0; i < sortedTargets.length; i++) {
      const t = sortedTargets.length > 1 ? i / (sortedTargets.length - 1) : 0.5
      const cp = this.calculateCurvePoints(sortedTargets[i]!, x0, y0, cosR, sinR, rotateBack, t)

      if (progress >= 1) {
        this.drawCompleteCurve(g, start, cp, fillAlpha)
      } else {
        this.drawPartialCurve(g, start, cp, fillAlpha, progress)
      }
    }

    this.onionContainer.addChild(g)
  }

  animateNodesIn(totalDuration = 2000, nodeDuration = 400, onComplete?: () => void) {
    if (!this.nodesOverlayContainer) return this

    const children = this.nodesOverlayContainer.children as Container[]
    const startTime = performance.now()

    // Sort by citation count (most cited first)
    const sorted = [...children].sort((a, b) => {
      const nodeA = this.graphicsToNode.get(a)
      const nodeB = this.graphicsToNode.get(b)
      return (nodeB?.citedBy.length ?? 0) - (nodeA?.citedBy.length ?? 0)
    })

    const count = sorted.length
    if (count === 0) {
      onComplete?.()
      return this
    }

    const startTimes = sorted.map((_, i) => {
      const t = i / (count - 1 || 1)
      const eased = 1 - Math.pow(1 - t, 2)
      return eased * (totalDuration - nodeDuration)
    })

    sorted.forEach((g) => {
      g.scale.set(0)
      g.alpha = 0
    })

    const animate = () => {
      const elapsed = performance.now() - startTime
      let allDone = true

      sorted.forEach((g, i) => {
        if (g.destroyed) return

        const node = this.graphicsToNode.get(g)
        const nodeStart = startTimes[i] ?? 0
        const nodeElapsed = elapsed - nodeStart

        if (nodeElapsed < 0) {
          allDone = false
          return
        }

        const progress = Math.min(1, nodeElapsed / nodeDuration)
        const eased =
          progress === 1
            ? 1
            : 1 -
              Math.pow(2, -10 * progress) * Math.cos((progress * 10 - 0.75) * ((2 * Math.PI) / 3))

        g.scale.set(eased)
        g.alpha = Math.min(1, progress * 2)

        // Mark node as finished when its animation completes (store timestamp)
        if (progress >= 1 && node && !this.nodeFinishedMap.has(node)) {
          this.nodeFinishedMap.set(node, performance.now())
        }

        if (progress < 1) allDone = false
      })

      if (!allDone) {
        requestAnimationFrame(animate)
      } else {
        this.nodeAnimationComplete = true
        onComplete?.()
      }
    }

    this.nodeAnimationComplete = false
    this.nodeFinishedMap.clear()
    requestAnimationFrame(animate)
    return this
  }

  // Pre-calculate all curve geometry for animation
  private buildCurveCache(): CachedCurve[] {
    const curves: CachedCurve[] = []
    const groups = this.buildTargetGroups(true)
    const fillAlpha = (getDensity() * (1 / this.maxConnections)) / 0.75

    for (const { sourceNode, targets, drawDirection } of groups) {
      const x0 = sourceNode.x
      const y0 = sourceNode.y
      const sourceStart = { x: x0, y: y0 }

      const angles = this.getAnglesForDirection(drawDirection)

      for (const angle of angles) {
        const curveTargets =
          drawDirection === 'symmetric'
            ? this.filterTargetsForAngle(targets, angle, sourceNode)
            : targets

        if (curveTargets.length === 0) continue

        const { cosR, sinR, rotateBack } = createRotationHelpers(angle, x0, y0)
        const sortedTargets = [...curveTargets].sort((a, b) => b.y - a.y)

        for (let i = 0; i < sortedTargets.length; i++) {
          const t = sortedTargets.length > 1 ? i / (sortedTargets.length - 1) : 0.5
          const cp = this.calculateCurvePoints(sortedTargets[i]!, x0, y0, cosR, sinR, rotateBack, t)

          curves.push({
            start: sourceStart,
            cp,
            fillAlpha,
            sourceNode,
            targetNode: sortedTargets[i]!,
            direction: 'up' as const,
          })
        }
      }
    }

    return curves
  }

  // Draw curves directly to a graphics object (for animation)
  private drawCurvesToGraphics(g: Graphics, curves: CachedCurve[], progress: number) {
    for (const { start, cp, fillAlpha } of curves) {
      if (progress >= 1) {
        this.drawCompleteCurve(g, start, cp, fillAlpha)
      } else {
        this.drawPartialCurve(g, start, cp, fillAlpha, progress)
      }
    }
  }

  animateCurvesIn(
    config: {
      duration?: number
      awaitNodeAnimation?: boolean
      awaitSourceNode?: boolean
      awaitBothNodes?: boolean
      durationStrategy?: 'fixedIndependent' | 'fixedGlobal'
    } = {},
  ) {
    const {
      duration = 2500,
      awaitNodeAnimation = false,
      awaitSourceNode = false,
      awaitBothNodes = false,
      durationStrategy = 'fixedIndependent',
    } = config

    // Cancel any running curve animation
    this.curveAnimationId++
    const animationId = this.curveAnimationId

    // Fade out static connectors (will be recreated when animation completes)
    this.clearConnectors(true)

    const cachedCurves = this.buildCurveCache()
    if (cachedCurves.length === 0) return this

    const animGraphics = new Graphics()
    animGraphics.filters = [this.colorMapFilter, this.bloomFilter]
    this.container.addChildAt(animGraphics, 0)

    let globalStartTime: number | null = null
    let warnedAboutDuration = false

    const shouldDrawCurve = (curve: CachedCurve): boolean => {
      if (awaitBothNodes) {
        if (!this.nodeFinishedMap.has(curve.sourceNode)) return false
        if (!this.nodeFinishedMap.has(curve.targetNode)) return false
      } else if (awaitSourceNode) {
        if (!this.nodeFinishedMap.has(curve.sourceNode)) return false
      }
      return true
    }

    // Standard progress calculation (raw elapsed → eased progress)
    const calcProgress = (elapsed: number, dur: number): number => {
      const raw = Math.min(1, elapsed / dur)
      return 1 - Math.pow(1 - raw, 3) // ease-out cubic
    }

    const getCurveProgress = (curve: CachedCurve, now: number): number => {
      let curveStartTime: number | null = null

      if (awaitBothNodes) {
        const sourceFinish = this.nodeFinishedMap.get(curve.sourceNode)
        const targetFinish = this.nodeFinishedMap.get(curve.targetNode)
        if (!sourceFinish || !targetFinish) return 0
        curveStartTime = Math.max(sourceFinish, targetFinish)
      } else if (awaitSourceNode) {
        curveStartTime = this.nodeFinishedMap.get(curve.sourceNode) ?? null
        if (!curveStartTime) return 0
      } else {
        curveStartTime = globalStartTime
      }

      if (!curveStartTime) return 0

      if (durationStrategy === 'fixedGlobal') {
        // Curve must finish by globalStartTime + duration
        const globalEndTime = globalStartTime! + duration
        const curveAvailableDuration = globalEndTime - curveStartTime
        if (curveAvailableDuration <= 0) {
          if (!warnedAboutDuration) {
            console.warn(
              `[animateCurvesIn] fixedGlobal duration (${duration}ms) is shorter than node animation time. ` +
                `Some curves have no time to animate. Consider increasing duration.`,
            )
            warnedAboutDuration = true
          }
          return 1
        }
        return calcProgress(now - curveStartTime, curveAvailableDuration)
      } else {
        // fixedIndependent: each curve gets full duration
        return calcProgress(now - curveStartTime, duration)
      }
    }

    const animate = () => {
      // Check if this animation was cancelled
      if (animationId !== this.curveAnimationId) {
        this.container.removeChild(animGraphics)
        animGraphics.destroy()
        return
      }

      // Guard against destroyed graphics context
      if (animGraphics.destroyed) {
        return
      }

      if (globalStartTime === null) {
        globalStartTime = performance.now()
      }

      const now = performance.now()

      animGraphics.clear()

      let minProgress = Infinity

      for (const curve of cachedCurves) {
        if (!shouldDrawCurve(curve)) {
          minProgress = 0 // curve not ready yet
          continue
        }

        const curveProgress = getCurveProgress(curve, now)
        minProgress = Math.min(minProgress, curveProgress)

        const { start, cp, fillAlpha } = curve
        if (curveProgress >= 1) {
          this.drawCompleteCurve(animGraphics, start, cp, fillAlpha)
        } else if (curveProgress > 0) {
          this.drawPartialCurve(animGraphics, start, cp, fillAlpha, curveProgress)
        }
      }

      // Continue until all curves are complete
      if (minProgress < 1) {
        requestAnimationFrame(animate)
      } else {
        // Animation complete - switch to RenderTexture for final static result
        this.container.removeChild(animGraphics)
        animGraphics.destroy()
        this.drawOnionConnectors(1)
      }
    }

    requestAnimationFrame(animate)
    return this
  }

  setColormap(index: number) {
    this.colorMapFilter.colormap = index
  }

  getColormap(): number {
    return this.colorMapFilter.colormap
  }

  private getColormapStops() {
    return COLORMAPS[this.colorMapFilter.colormap]!.stops
  }

  updateNodeColors() {
    const stops = this.getColormapStops()
    for (const node of this.nodes.values()) {
      node.fillColor = getColormapColor(node.normalizedCitations, stops)
      node.strokeColor = getBrighterColor(node.fillColor)
    }
    this.drawNodesOverlay()
  }

  destroy() {
    this.container.destroy({ children: true })
    this.onionTexture?.destroy()
  }
}
