import {
  Application,
  Container,
  Graphics,
  Sprite,
  Texture,
  Text,
  TextStyle,
  AlphaFilter,
  type ContainerChild,
} from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { BloomFilter } from 'pixi-filters'
import type { Grid } from './Grid'
import type { VisualNode } from '@/types'
import { BatchedCurveMesh } from './BatchedCurveMesh'
import type { CurveData } from './BatchedCurveGeometry'
import { ColorMapFilter } from './ColorMapFilter'
import { GRID } from './constants'
import {
  calculateCurveControlPoints,
  getNodeDrawDirection,
  getAnglesForDirection,
  DEFAULT_CURVE_PARAMS,
  type CurveParams,
  type DrawDirectionStrategy,
} from './curvePositioning'
import { ParticleSystem, type ParticleSystemOptions } from './ParticleSystem'

const BASE_CIRCLE_RADIUS = 32

// Viewport zoom limits (relative to base/fit scale)
const MIN_SCALE_FACTOR = 0.75
const MAX_SCALE_FACTOR = 10

// Node visual constants (matching legacy)
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
  default: { width: 5, color: 0x000000, alpha: 0.7 },
}

// Easing: slow start, fast middle, slow end
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Elastic easing for bouncy node pop-in
function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t
  return 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * ((2 * Math.PI) / 3))
}

// Ease-out quadratic for stagger distribution
function easeOutQuad(t: number): number {
  return 1 - Math.pow(1 - t, 2)
}

export interface NodeAnimationOptions {
  totalDuration?: number // Total time for all nodes to start animating
  nodeDuration?: number // Duration of each individual node's animation
}

export interface CurveAnimationOptions {
  duration?: number // Duration for each curve's animation
  awaitSourceNode?: boolean // Wait for source node to finish before starting curve
  awaitBothNodes?: boolean // Wait for both source AND target nodes to finish
  durationStrategy?: 'fixedIndependent' | 'fixedGlobal'
  // fixedIndependent: each curve gets full duration regardless of start time
  // fixedGlobal: all curves must finish by globalStartTime + duration
}

// Maps curve index to its source/target nodes for timing calculations
interface CurveNodeMapping {
  curveIndex: number
  sourceNodeId: string
  targetNodeId: string
}

export class Renderer {
  private app: Application
  private viewport: Viewport | null = null
  private baseScale = 1
  private particleSystem: ParticleSystem | null = null
  private curvesContainer: Container
  private selectionCurvesContainer: Container
  private nodesContainer: Container
  private yearAxisContainer: Container
  private shadowTexture: Texture | null = null // Shadows - drawn under fill
  private fillTexture: Texture | null = null // Plain white circle, tinted per-node
  private overlayTexture: Texture | null = null // Stroke, highlights - untinted, on top
  private selectionRingTexture: Texture | null = null // Selection ring - added when selected
  private textureRadius = BASE_CIRCLE_RADIUS // Actual radius in texture for scaling
  private nodeContainers: Map<string, Container> = new Map() // Container with fill + overlay
  private selectedNodeIds: Set<string> = new Set() // Currently selected nodes
  private batchedCurves: BatchedCurveMesh | null = null
  private selectionCurvesMesh: BatchedCurveMesh | null = null
  private initialized = false

  // Node animation state
  private nodeAnimationId = 0 // Incremented to cancel running animations
  private nodeSpriteOrder: { nodeId: string; sprite: Container; citationCount: number }[] = []
  nodeFinishedMap: Map<string, number> = new Map() // nodeId -> finish timestamp
  nodeAnimationComplete = false

  // Curve animation state
  private curveAnimationId = 0 // Incremented to cancel running animations
  private curveNodeMappings: CurveNodeMapping[] = []

  // Curve configuration
  drawDirectionStrategy: DrawDirectionStrategy = 'alternating'
  curveParams: CurveParams = DEFAULT_CURVE_PARAMS
  private colorMapFilter: ColorMapFilter | null = null
  private selectionColorMapFilter: ColorMapFilter | null = null
  private curveAlphaFilter: AlphaFilter | null = null
  private curveAlphaAnimationId = 0
  private selectionCurveAnimationId = 0
  private curveDataCache: CurveData[] = [] // Store curve data for selection rebuilding

  // Year axis state
  private yearAxisData: { year: number; worldY: number }[] = []

  constructor() {
    this.app = new Application()
    this.curvesContainer = new Container()
    this.selectionCurvesContainer = new Container()
    this.nodesContainer = new Container()
    this.yearAxisContainer = new Container()
  }

  async init(element: HTMLElement) {
    await this.app.init({
      background: '#1a1a2e',
      resizeTo: element,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    element.appendChild(this.app.canvas)

    // Create viewport with pixi-viewport for smooth pinch/zoom/pan
    this.viewport = new Viewport({
      screenWidth: this.app.screen.width,
      screenHeight: this.app.screen.height,
      worldWidth: 1000, // Will be updated when graph is rendered
      worldHeight: 1000,
      events: this.app.renderer.events,
    })

    // Enable drag, pinch, wheel gestures
    this.viewport.drag().pinch().wheel().decelerate()

    // Initialize particle system (config in ParticleSystem.ts DEFAULT_OPTIONS)
    this.particleSystem = new ParticleSystem()

    // Layer order: particles -> curves -> selection curves -> nodes
    this.viewport.addChild(this.particleSystem.container)
    this.viewport.addChild(this.curvesContainer)
    this.viewport.addChild(this.selectionCurvesContainer)
    this.viewport.addChild(this.nodesContainer)
    this.app.stage.addChild(this.viewport)

    // Year axis overlay (outside viewport, on top)
    this.app.stage.addChild(this.yearAxisContainer)
    this.viewport.on('moved', () => this.updateYearAxis())

    // Apply colormap, bloom, and alpha filters to curves container
    this.colorMapFilter = new ColorMapFilter()
    const bloomFilter = new BloomFilter({ strength: 5, quality: 4 })
    this.curveAlphaFilter = new AlphaFilter({ alpha: 1 })
    this.curvesContainer.filters = [this.colorMapFilter, bloomFilter, this.curveAlphaFilter]

    // Selection curves get colormap + bloom but no alpha fade
    this.selectionColorMapFilter = new ColorMapFilter()
    const selectionBloomFilter = new BloomFilter({ strength: 5, quality: 4 })
    this.selectionCurvesContainer.filters = [this.selectionColorMapFilter, selectionBloomFilter]

    this.createNodeTextures()
    this.initialized = true
  }

  private createNodeTextures() {
    const r = BASE_CIRCLE_RADIUS
    const { outerOffset, outerExtraRadius, outerAlpha, innerOffset, innerAlpha } = NODE_SHADOW
    const { primary, secondary, tertiary } = NODE_HIGHLIGHT
    const stroke = NODE_STROKE.default

    // Texture needs extra space for shadows and stroke
    const padding = Math.max(
      outerOffset.x + outerExtraRadius,
      outerOffset.y + outerExtraRadius,
      stroke.width,
    )
    const size = r + padding
    const cx = size // center x
    const cy = size // center y

    // --- Shadow texture: drawn UNDER the fill (outer + inner shadows) ---
    const shadowGraphics = new Graphics()
    shadowGraphics.circle(cx + outerOffset.x, cy + outerOffset.y, r + outerExtraRadius)
    shadowGraphics.fill({ color: 0x000000, alpha: outerAlpha })
    shadowGraphics.circle(cx + innerOffset.x, cy + innerOffset.y, r)
    shadowGraphics.fill({ color: 0x000000, alpha: innerAlpha })
    this.shadowTexture = this.app.renderer.generateTexture(shadowGraphics)
    shadowGraphics.destroy()

    // --- Fill texture: just a white circle (will be tinted per-node) ---
    const fillGraphics = new Graphics()
    fillGraphics.circle(cx, cy, r)
    fillGraphics.fill({ color: 0xffffff })
    this.fillTexture = this.app.renderer.generateTexture(fillGraphics)
    fillGraphics.destroy()

    // --- Overlay texture: stroke + highlights (drawn ON TOP of fill) ---
    const overlayGraphics = new Graphics()

    // 1. Stroke outline
    overlayGraphics.circle(cx, cy, r)
    overlayGraphics.stroke({ width: stroke.width, color: stroke.color, alpha: stroke.alpha })

    // 2. Glossy highlights (white circles offset to top-left)
    overlayGraphics.circle(cx - r * primary.offset, cy - r * primary.offset, r * primary.radius)
    overlayGraphics.fill({ color: 0xffffff, alpha: primary.alpha })

    overlayGraphics.circle(
      cx - r * secondary.offset,
      cy - r * secondary.offset,
      r * secondary.radius,
    )
    overlayGraphics.fill({ color: 0xffffff, alpha: secondary.alpha })

    overlayGraphics.circle(cx - r * tertiary.offset, cy - r * tertiary.offset, r * tertiary.radius)
    overlayGraphics.fill({ color: 0xffffff, alpha: tertiary.alpha })

    this.overlayTexture = this.app.renderer.generateTexture(overlayGraphics)
    overlayGraphics.destroy()

    // --- Selection ring texture: bright white ring for selected nodes ---
    const selectionGraphics = new Graphics()
    selectionGraphics.circle(cx, cy, r)
    selectionGraphics.stroke({ width: 4, color: 0xffffff, alpha: 1 })
    this.selectionRingTexture = this.app.renderer.generateTexture(selectionGraphics)
    selectionGraphics.destroy()

    this.textureRadius = r // Store for scaling calculations
  }

  render(grid: Grid, orderToRow?: Record<number, number>) {
    if (!this.initialized) return

    this.clear()
    this.renderCurves(grid)
    this.renderNodes(grid)
    this.initParticles(grid)
    this.centerOnScreen(grid)
    this.buildYearAxis(grid, orderToRow)
    // Nodes start invisible (scale=0, alpha=0)
    // Call animateNodesIn() to start the animation
  }

  private renderCurves(grid: Grid) {
    const curves: CurveData[] = []
    this.curveNodeMappings = []
    const nodesWithCitations = grid.getNodesWithCitations()

    let curveIndex = 0
    for (const sourceNode of nodesWithCitations) {
      const targets = grid.getValidTargets(sourceNode)
      if (targets.length === 0) continue

      // Determine draw direction for this source node
      const direction = getNodeDrawDirection(
        {
          gridX: sourceNode.gridX,
          gridY: sourceNode.gridY,
          isSource: sourceNode.metadata?.isSource,
        },
        grid.cols,
        this.drawDirectionStrategy,
      )

      // Get angles for this direction
      const angles = getAnglesForDirection(direction)

      // Sort targets by Y position for consistent t values
      const sortedTargets = [...targets].sort((a, b) => b.y - a.y)

      // For symmetric nodes, alternate angles across targets (not duplicate per target)
      for (let i = 0; i < sortedTargets.length; i++) {
        const targetNode = sortedTargets[i]!
        const angle = angles[i % angles.length]!
        const t = sortedTargets.length > 1 ? i / (sortedTargets.length - 1) : 0.5
        curves.push(this.createCurveData(sourceNode, targetNode, angle, t, this.curveParams))

        // Track mapping for per-curve timing
        this.curveNodeMappings.push({
          curveIndex,
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
        })
        curveIndex++
      }
    }

    if (curves.length === 0) return

    // Cache curve data for selection rebuilding
    this.curveDataCache = curves

    this.batchedCurves = new BatchedCurveMesh({
      curves,
      segments: 32,
      defaultWidth: 3,
      alpha: 0.1,
    })

    this.curvesContainer.addChild(this.batchedCurves)
  }

  private createCurveData(
    source: VisualNode,
    target: VisualNode,
    angle: number,
    t: number,
    params: CurveParams,
  ): CurveData {
    const controlPoints = calculateCurveControlPoints(
      { x: source.x, y: source.y },
      { x: target.x, y: target.y },
      angle,
      t,
      params,
    )

    return {
      start: controlPoints.start,
      cp1: controlPoints.cp1,
      cp2: controlPoints.cp2,
      end: controlPoints.end,
      width: 3,
    }
  }

  private renderNodes(grid: Grid) {
    this.nodeSpriteOrder = []

    for (const node of grid.nodes.values()) {
      const container = this.createNodeSprite(node)
      this.nodeContainers.set(node.id, container)
      this.nodesContainer.addChild(container)

      // Track for animation ordering
      this.nodeSpriteOrder.push({
        nodeId: node.id,
        sprite: container,
        citationCount: node.citedBy.length,
      })
    }

    // Sort by citation count (most cited first for staggered animation)
    this.nodeSpriteOrder.sort((a, b) => b.citationCount - a.citationCount)
  }

  private createNodeSprite(node: VisualNode): Container {
    const targetScale = node.radius / this.textureRadius

    // Container to hold all three sprites
    const container = new Container()
    container.x = node.x
    container.y = node.y
    ;(container as any)._targetScale = targetScale
    container.scale.set(0)
    container.alpha = 0

    // Shadow sprite (drawn first, underneath everything)
    const shadow = new Sprite(this.shadowTexture!)
    shadow.anchor.set(0.5)

    // Fill sprite (tinted to node color)
    const fill = new Sprite(this.fillTexture!)
    fill.anchor.set(0.5)
    fill.tint = node.fillColor

    // Overlay sprite (stroke, highlights - untinted, on top)
    const overlay = new Sprite(this.overlayTexture!)
    overlay.anchor.set(0.5)

    // Layer order: shadow -> fill -> overlay
    container.addChild(shadow)
    container.addChild(fill)
    container.addChild(overlay)

    return container
  }

  private initParticles(grid: Grid) {
    if (!this.particleSystem) return
    // Initialize with some padding beyond the graph bounds
    const padding = 100
    this.particleSystem.init(
      this.app,
      grid.canvasWidth + padding * 2,
      grid.canvasHeight + padding * 2,
    )
    // Offset container to account for padding
    this.particleSystem.container.x = -padding
    this.particleSystem.container.y = -padding
  }

  private centerOnScreen(grid: Grid) {
    if (!this.viewport) return
    // Just center without scaling (used during initial render)
    this.viewport.x = (this.app.screen.width - grid.canvasWidth) / 2
    this.viewport.y = (this.app.screen.height - grid.canvasHeight) / 2
  }

  /**
   * Calculate the scale and position needed to fit the graph in view
   */
  calculateFitToView(grid: Grid, padding = 20): { scale: number; x: number; y: number } {
    const screenWidth = this.app.screen.width
    const screenHeight = this.app.screen.height

    const scaleX = (screenWidth - padding * 2) / grid.canvasWidth
    const scaleY = (screenHeight - padding * 2) / grid.canvasHeight
    const scale = Math.min(scaleX, scaleY)

    const x = (screenWidth - grid.canvasWidth * scale) / 2
    const y = (screenHeight - grid.canvasHeight * scale) / 2

    return { scale, x, y }
  }

  /**
   * Scale and center the graph to fit within the screen with padding
   * Returns the calculated scale for use as baseScale
   */
  fitToView(grid: Grid, padding = 20): number {
    if (!this.viewport) return 1

    const { scale, x, y } = this.calculateFitToView(grid, padding)

    this.viewport.scale.set(scale)
    this.viewport.x = x
    this.viewport.y = y

    // Store base scale and apply zoom limits
    this.baseScale = scale
    this.applyZoomLimits()

    return scale
  }

  /** Set zoom limits based on a base scale */
  setZoomLimits(baseScale: number) {
    this.baseScale = baseScale
    this.applyZoomLimits()
  }

  private applyZoomLimits() {
    if (!this.viewport) return
    this.viewport.clampZoom({
      minScale: this.baseScale * MIN_SCALE_FACTOR,
      maxScale: this.baseScale * MAX_SCALE_FACTOR,
    })
  }

  // --- Viewport manipulation ---

  /** Get current viewport state */
  getViewport() {
    if (!this.viewport) return { x: 0, y: 0, scale: 1 }
    return {
      x: this.viewport.x,
      y: this.viewport.y,
      scale: this.viewport.scale.x,
    }
  }

  /** Set viewport position and scale directly */
  setViewport(x: number, y: number, scale: number) {
    if (!this.viewport) return
    this.viewport.x = x
    this.viewport.y = y
    this.viewport.scale.set(scale)
    this.viewport.emit('moved', { viewport: this.viewport, type: 'animate' })
  }

  /** Pan viewport by delta */
  pan(dx: number, dy: number) {
    if (!this.viewport) return
    this.viewport.x += dx
    this.viewport.y += dy
  }

  /** Zoom toward a point (in screen coordinates) */
  zoomAt(newScale: number, screenX: number, screenY: number) {
    if (!this.viewport) return
    const oldScale = this.viewport.scale.x
    const worldX = (screenX - this.viewport.x) / oldScale
    const worldY = (screenY - this.viewport.y) / oldScale

    this.viewport.scale.set(newScale)
    this.viewport.x = screenX - worldX * newScale
    this.viewport.y = screenY - worldY * newScale
  }

  /** Hit test: find node at screen coordinates */
  hitTestNode(screenX: number, screenY: number, grid: Grid): string | null {
    if (!this.viewport) return null
    const scale = this.viewport.scale.x
    const worldX = (screenX - this.viewport.x) / scale
    const worldY = (screenY - this.viewport.y) / scale

    // Hit radius based on grid cell size, not node visual radius
    const hitRadius = (0.9 * Math.min(GRID.xSpacing, GRID.ySpacing)) / 2
    const hitRadiusSq = hitRadius * hitRadius

    for (const [id, node] of grid.nodes) {
      const dx = worldX - node.x
      const dy = worldY - node.y
      if (dx * dx + dy * dy <= hitRadiusSq) {
        return id
      }
    }
    return null
  }

  /**
   * Animate nodes popping in with staggered timing
   * Most-cited nodes appear first, with elastic bounce effect
   */
  animateNodesIn(options: NodeAnimationOptions = {}, onComplete?: () => void) {
    const { totalDuration = 2000, nodeDuration = 400 } = options

    // Cancel any running node animation
    this.nodeAnimationId++
    const animationId = this.nodeAnimationId

    // Reset state
    this.nodeFinishedMap.clear()
    this.nodeAnimationComplete = false

    const count = this.nodeSpriteOrder.length
    if (count === 0) {
      this.nodeAnimationComplete = true
      onComplete?.()
      return
    }

    // Calculate staggered start times (eased distribution)
    // Most-cited nodes start first, last node starts at (totalDuration - nodeDuration)
    const startTimes = this.nodeSpriteOrder.map((_, i) => {
      const t = i / (count - 1 || 1)
      const eased = easeOutQuad(t)
      return eased * (totalDuration - nodeDuration)
    })

    // Ensure all containers start invisible
    for (const { sprite } of this.nodeSpriteOrder) {
      sprite.scale.set(0)
      sprite.alpha = 0
    }

    const animationStartTime = performance.now()

    const animate = () => {
      // Check if cancelled
      if (animationId !== this.nodeAnimationId) return

      const now = performance.now()
      const elapsed = now - animationStartTime
      let allDone = true

      for (let i = 0; i < this.nodeSpriteOrder.length; i++) {
        const { nodeId, sprite } = this.nodeSpriteOrder[i]!
        const nodeStartTime = startTimes[i]!

        // Skip if this node hasn't started yet
        if (elapsed < nodeStartTime) {
          allDone = false
          continue
        }

        const nodeElapsed = elapsed - nodeStartTime
        const progress = Math.min(1, nodeElapsed / nodeDuration)

        if (progress < 1) {
          allDone = false

          // Elastic scale animation
          const eased = easeOutElastic(progress)
          const targetScale = (sprite as any)._targetScale || 1
          sprite.scale.set(targetScale * eased)

          // Alpha fades in faster (reaches 1 at halfway point)
          sprite.alpha = Math.min(1, progress * 2)
        } else {
          // Ensure final state
          const targetScale = (sprite as any)._targetScale || 1
          sprite.scale.set(targetScale)
          sprite.alpha = 1

          // Record finish timestamp (only once)
          if (!this.nodeFinishedMap.has(nodeId)) {
            this.nodeFinishedMap.set(nodeId, now)
          }
        }
      }

      if (!allDone) {
        requestAnimationFrame(animate)
      } else {
        this.nodeAnimationComplete = true
        onComplete?.()
      }
    }

    requestAnimationFrame(animate)
  }

  /**
   * Animate curves drawing in with optional per-curve timing
   * Can wait for source/target nodes to finish animating before starting each curve
   */
  animateCurvesIn(options: CurveAnimationOptions = {}, onComplete?: () => void) {
    const {
      duration = 2000,
      awaitSourceNode = false,
      awaitBothNodes = false,
      durationStrategy = 'fixedIndependent',
    } = options

    // Cancel any running curve animation
    this.curveAnimationId++
    const animationId = this.curveAnimationId

    if (!this.batchedCurves || this.curveNodeMappings.length === 0) {
      onComplete?.()
      return
    }

    const batchedCurves = this.batchedCurves
    const mappings = this.curveNodeMappings
    let globalStartTime: number | null = null
    let warnedAboutDuration = false

    // Check if a curve should start drawing yet
    const shouldDrawCurve = (mapping: CurveNodeMapping): boolean => {
      if (awaitBothNodes) {
        if (!this.nodeFinishedMap.has(mapping.sourceNodeId)) return false
        if (!this.nodeFinishedMap.has(mapping.targetNodeId)) return false
      } else if (awaitSourceNode) {
        if (!this.nodeFinishedMap.has(mapping.sourceNodeId)) return false
      }
      return true
    }

    // Calculate progress for a single curve
    const getCurveProgress = (mapping: CurveNodeMapping, now: number): number => {
      let curveStartTime: number | null = null

      if (awaitBothNodes) {
        const sourceFinish = this.nodeFinishedMap.get(mapping.sourceNodeId)
        const targetFinish = this.nodeFinishedMap.get(mapping.targetNodeId)
        if (!sourceFinish || !targetFinish) return 0
        curveStartTime = Math.max(sourceFinish, targetFinish)
      } else if (awaitSourceNode) {
        curveStartTime = this.nodeFinishedMap.get(mapping.sourceNodeId) ?? null
        if (!curveStartTime) return 0
      } else {
        curveStartTime = globalStartTime
      }

      if (!curveStartTime) return 0

      const elapsed = now - curveStartTime

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
        const raw = Math.min(1, elapsed / curveAvailableDuration)
        return easeInOutCubic(raw)
      } else {
        // fixedIndependent: each curve gets full duration
        const raw = Math.min(1, elapsed / duration)
        return easeInOutCubic(raw)
      }
    }

    const animate = () => {
      // Check if cancelled
      if (animationId !== this.curveAnimationId) return

      if (globalStartTime === null) {
        globalStartTime = performance.now()
      }

      const now = performance.now()
      let minProgress = Infinity

      for (const mapping of mappings) {
        if (!shouldDrawCurve(mapping)) {
          minProgress = 0 // curve not ready yet
          batchedCurves.setProgress(mapping.curveIndex, 0)
          continue
        }

        const progress = getCurveProgress(mapping, now)
        minProgress = Math.min(minProgress, progress)
        batchedCurves.setProgress(mapping.curveIndex, progress)
      }

      batchedCurves.updateProgress()

      // Continue until all curves complete
      if (minProgress < 1) {
        requestAnimationFrame(animate)
      } else {
        onComplete?.()
      }
    }

    requestAnimationFrame(animate)
  }

  /**
   * Set the active colormap for curves
   * Supports fractional values for smooth transitions (e.g., 1.5 blends between colormap 1 and 2)
   */
  setColormap(colormap: number) {
    if (this.colorMapFilter) {
      this.colorMapFilter.colormap = colormap
    }
    if (this.selectionColorMapFilter) {
      this.selectionColorMapFilter.colormap = colormap
    }
  }

  /**
   * Set the canvas background color
   */
  setBackgroundColor(color: number) {
    this.app.renderer.background.color = color
  }

  /**
   * Update node sprite tints from their current fillColor values
   * Call this after Grid.updateNodeColors() to sync the visuals
   */
  updateNodeColors(grid: Grid) {
    for (const [id, container] of this.nodeContainers) {
      const node = grid.nodes.get(id)
      if (!node) continue

      // Second child is the fill sprite (shadow=0, fill=1, overlay=2)
      const fill = container.children[1] as Sprite
      if (fill) {
        fill.tint = node.fillColor
      }
    }
  }

  /**
   * Update selection visuals - add/remove selection rings and fade curves
   */
  setSelectedNodes(nodeIds: Set<string>) {
    // Remove rings from previously selected nodes
    for (const id of this.selectedNodeIds) {
      if (!nodeIds.has(id)) {
        const container = this.nodeContainers.get(id)
        if (container && container.children.length > 3) {
          // Remove the selection ring (4th child)
          container.removeChildAt(3)
        }
      }
    }

    // Add rings to newly selected nodes
    for (const id of nodeIds) {
      if (!this.selectedNodeIds.has(id)) {
        const container = this.nodeContainers.get(id)
        if (container && this.selectionRingTexture) {
          const ring = new Sprite(this.selectionRingTexture)
          ring.anchor.set(0.5)
          container.addChild(ring)
        }
      }
    }

    // Animate curve fade when selection changes
    this.animateCurveAlpha(nodeIds.size > 0 ? 0 : 1)

    // Create/destroy selection curves
    this.updateSelectionCurves(nodeIds)

    this.selectedNodeIds = new Set(nodeIds)
  }

  /**
   * Create a mesh with only curves connected to selected nodes
   */
  private updateSelectionCurves(nodeIds: Set<string>) {
    // Destroy existing selection mesh
    if (this.selectionCurvesMesh) {
      this.selectionCurvesContainer.removeChild(this.selectionCurvesMesh)
      this.selectionCurvesMesh.destroy()
      this.selectionCurvesMesh = null
    }

    // If no selection, we're done
    if (nodeIds.size === 0) return

    // Find curves connected to selected nodes
    const selectionCurves: CurveData[] = []
    for (let i = 0; i < this.curveNodeMappings.length; i++) {
      const mapping = this.curveNodeMappings[i]!
      const curveData = this.curveDataCache[i]
      if (curveData && (nodeIds.has(mapping.sourceNodeId) || nodeIds.has(mapping.targetNodeId))) {
        selectionCurves.push(curveData)
      }
    }

    if (selectionCurves.length === 0) return

    // Create new mesh with selection curves
    this.selectionCurvesMesh = new BatchedCurveMesh({
      curves: selectionCurves,
      segments: 32,
      defaultWidth: 3,
      alpha: 0.1,
    })

    this.selectionCurvesContainer.addChild(this.selectionCurvesMesh)

    // Animate selection curves in
    this.animateSelectionCurvesIn()
  }

  /**
   * Animate selection curves from 0 to 1 progress
   */
  private animateSelectionCurvesIn(duration = 500) {
    if (!this.selectionCurvesMesh) return

    this.selectionCurveAnimationId++
    const animationId = this.selectionCurveAnimationId
    const mesh = this.selectionCurvesMesh
    const startTime = performance.now()

    const animate = () => {
      if (animationId !== this.selectionCurveAnimationId) return
      if (!this.selectionCurvesMesh || this.selectionCurvesMesh !== mesh) return

      const elapsed = performance.now() - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = easeInOutCubic(progress)

      mesh.setAllProgress(eased)
      mesh.updateProgress()

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }

  /**
   * Animate curve alpha filter to target value
   */
  private animateCurveAlpha(targetAlpha: number, duration = 300) {
    if (!this.curveAlphaFilter) return

    this.curveAlphaAnimationId++
    const animationId = this.curveAlphaAnimationId

    const startAlpha = this.curveAlphaFilter.alpha
    const startTime = performance.now()

    const animate = () => {
      if (animationId !== this.curveAlphaAnimationId) return
      if (!this.curveAlphaFilter) return

      const elapsed = performance.now() - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = easeInOutCubic(progress)

      this.curveAlphaFilter.alpha = startAlpha + (targetAlpha - startAlpha) * eased

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }

  private clear() {
    // Cancel running animations
    this.nodeAnimationId++
    this.curveAnimationId++
    this.curveAlphaAnimationId++
    this.selectionCurveAnimationId++

    this.nodesContainer.removeChildren()
    this.curvesContainer.removeChildren()
    this.selectionCurvesContainer.removeChildren()
    this.yearAxisContainer.removeChildren()
    this.nodeContainers.clear()
    this.nodeSpriteOrder = []
    this.nodeFinishedMap.clear()
    this.nodeAnimationComplete = false
    this.curveNodeMappings = []
    this.curveDataCache = []
    this.yearAxisData = []
    this.selectedNodeIds.clear()

    if (this.batchedCurves) {
      this.batchedCurves.destroy()
      this.batchedCurves = null
    }

    if (this.selectionCurvesMesh) {
      this.selectionCurvesMesh.destroy()
      this.selectionCurvesMesh = null
    }
  }

  /**
   * Update particle system options dynamically
   */
  setParticleOptions(options: ParticleSystemOptions) {
    this.particleSystem?.setOptions(options)
  }

  /**
   * Build year axis data from grid and orderToRow mapping
   */
  private buildYearAxis(grid: Grid, orderToRow?: Record<number, number>) {
    this.yearAxisContainer.removeChildren()
    this.yearAxisData = []

    if (!orderToRow) return

    // Build year -> worldY mapping
    for (const [yearStr, row] of Object.entries(orderToRow)) {
      const year = Number(yearStr)
      if (isNaN(year)) continue
      const worldY = GRID.padding + row * GRID.ySpacing
      this.yearAxisData.push({ year, worldY })
    }

    // Sort by year descending (oldest at top)
    this.yearAxisData.sort((a, b) => b.year - a.year)

    // Create text labels and tick marks
    const axisX = 12 // Left margin
    const tickWidth = 8
    const textStyle = new TextStyle({
      fontSize: 11,
      fill: 0xaaaaaa,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      dropShadow: {
        color: 0x000000,
        blur: 3,
        distance: 0,
        alpha: 0.6,
      },
    })

    // Create labels for each year
    for (const { year } of this.yearAxisData) {
      // Background rectangle
      const bg = new Graphics()
      bg.roundRect(-4, -8, 42, 16, 3)
      bg.fill({ color: 0x000000, alpha: 0.4 })
      bg.x = axisX + tickWidth + 6
      bg.label = `bg-${year}`
      this.yearAxisContainer.addChild(bg)

      const label = new Text({ text: String(year), style: textStyle })
      label.anchor.set(0, 0.5)
      label.x = axisX + tickWidth + 6
      label.label = `year-${year}` // For lookup during update
      this.yearAxisContainer.addChild(label)

      // Tick mark
      const tick = new Graphics()
      tick.moveTo(0, 0)
      tick.lineTo(tickWidth, 0)
      tick.stroke({ width: 1, color: 0x444444 })
      tick.label = `tick-${year}`
      tick.x = axisX
      this.yearAxisContainer.addChild(tick)
    }

    this.updateYearAxis()
  }

  /**
   * Update year axis positions based on viewport transform
   */
  private updateYearAxis() {
    if (!this.viewport || this.yearAxisData.length === 0) return

    const screenHeight = this.app.screen.height

    for (const { year, worldY } of this.yearAxisData) {
      // Transform world Y to screen Y
      const screenY = this.viewport.toScreen(0, worldY).y

      // Find label, tick, and background
      const label = this.yearAxisContainer.getChildByLabel(`year-${year}`)
      const tick = this.yearAxisContainer.getChildByLabel(`tick-${year}`)
      const bg = this.yearAxisContainer.getChildByLabel(`bg-${year}`)

      const visible = screenY > -20 && screenY < screenHeight + 20 ? 1 : 0

      if (label) {
        label.y = screenY
        label.alpha = visible
      }
      if (tick) {
        tick.y = screenY
        tick.alpha = visible
      }
      if (bg) {
        bg.y = screenY
        bg.alpha = visible
      }
    }
  }

  destroy() {
    if (!this.initialized) return

    this.clear()
    this.particleSystem?.destroy()
    this.particleSystem = null
    this.shadowTexture?.destroy(true)
    this.shadowTexture = null
    this.fillTexture?.destroy(true)
    this.fillTexture = null
    this.overlayTexture?.destroy(true)
    this.overlayTexture = null
    this.selectionRingTexture?.destroy(true)
    this.selectionRingTexture = null
    this.app.destroy(true)
    this.initialized = false
  }
}
