import { Application, Container, Sprite, AlphaFilter } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { BloomFilter } from 'pixi-filters'
import type { Grid } from './Grid'
import type { VisualNode } from '@/types'
import { BatchedCurveMesh } from './BatchedCurveMesh'
import type { CurveData } from './BatchedCurveGeometry'
import { ColorMapFilter } from './ColorMapFilter'
import { COLORMAPS, getCanvasBackgroundColor } from './colormap'
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
import { createNodeTextures, destroyNodeTextures, type NodeTextures } from './NodeTextureFactory'
import { YearAxisOverlay } from './YearAxisOverlay'
import { SelectionManager, type CurveNodeMapping } from './SelectionManager'
import { AnimationRunner, animateProgress } from './AnimationRunner'
import { easeInOutCubic, easeOutCubic, easeOutElastic, easeOutQuad, easeMaterial } from './easing'

// Viewport zoom limits (relative to base/fit scale)
const MIN_SCALE_FACTOR = 1
const MAX_SCALE_FACTOR = 10

// Node dimming when selection is active
const NODE_DIM_ALPHA = 0.25
const NODE_DIM_DURATION = 300

export interface NodeAnimationOptions {
  totalDuration?: number // Total time for all nodes to start animating
  nodeDuration?: number // Duration of each individual node's animation
}

export interface CurveAnimationOptions {
  duration?: number
  awaitSourceNode?: boolean
  awaitBothNodes?: boolean
  durationStrategy?: 'fixedIndependent' | 'fixedGlobal'
}

export class Renderer {
  private app: Application
  private viewport: Viewport | null = null
  private baseScale = 1
  private particleSystems: ParticleSystem[] = []
  private curvesContainer: Container
  private nodesContainer: Container
  private nodeTextures: NodeTextures | null = null
  private nodeContainers: Map<string, Container> = new Map()
  private batchedCurves: BatchedCurveMesh | null = null
  private initialized = false
  private isDarkMode = true

  // Extracted modules
  private yearAxisOverlay: YearAxisOverlay
  private selectionManager: SelectionManager

  // Node animation state
  private nodeAnimationRunner = new AnimationRunner()
  private nodeSpriteOrder: { nodeId: string; sprite: Container; citationCount: number }[] = []
  nodeFinishedMap: Map<string, number> = new Map()
  nodeAnimationComplete = false

  // Curve animation state
  private curveAnimationRunner = new AnimationRunner()
  private curveNodeMappings: CurveNodeMapping[] = []
  private curveDataCache: CurveData[] = []

  // Curve configuration
  drawDirectionStrategy: DrawDirectionStrategy = 'alternating'
  curveParams: CurveParams = DEFAULT_CURVE_PARAMS
  private colorMapFilter: ColorMapFilter | null = null
  private selectionColorMapFilter: ColorMapFilter | null = null
  private curveAlphaFilter: AlphaFilter | null = null
  private curveAlphaAnimationRunner = new AnimationRunner()
  private nodeAlphaAnimationRunner = new AnimationRunner()
  private resizeObserver: ResizeObserver | null = null

  constructor() {
    this.app = new Application()
    this.curvesContainer = new Container()
    this.nodesContainer = new Container()
    this.yearAxisOverlay = new YearAxisOverlay()
    this.selectionManager = new SelectionManager()
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

    this.viewport = new Viewport({
      screenWidth: this.app.screen.width,
      screenHeight: this.app.screen.height,
      worldWidth: 1000,
      worldHeight: 1000,
      events: this.app.renderer.events,
    })

    this.viewport.drag().pinch().wheel().decelerate()

    // Triple-layer particle system: back to front (density = particles per million px²)
    this.particleSystems = [
      // Layer 1: large, faint, slow drifters (background)
      new ParticleSystem({
        density: 10,
        minSize: 8,
        maxSize: 32,
        alpha: 0.45,
        drift: 60,
        speed: 0.001,
      }),
      // Layer 2: medium (midground)
      new ParticleSystem({
        density: 15,
        minSize: 4,
        maxSize: 10,
        alpha: 0.55,
        drift: 40,
        speed: 0.002,
      }),
      // Layer 3: small, brighter, faster (foreground)
      new ParticleSystem({
        density: 20,
        minSize: 2,
        maxSize: 6,
        alpha: 0.75,
        drift: 25,
        speed: 0.003,
      }),
    ]

    // Layer order: particles -> curves -> nodes -> selection curves -> selected endpoints
    // Static curves render behind nodes (normal view)
    // Selection curves + cloned endpoints render above nodes (highlighted on select)
    for (const ps of this.particleSystems) {
      this.viewport.addChild(ps.container)
    }
    this.viewport.addChild(this.curvesContainer)
    this.viewport.addChild(this.nodesContainer)
    this.viewport.addChild(this.selectionManager.selectionCurvesContainer)
    this.viewport.addChild(this.selectionManager.selectedEndpointsContainer)
    this.app.stage.addChild(this.viewport)

    // Year axis overlay (outside viewport)
    this.app.stage.addChild(this.yearAxisOverlay.container)
    this.viewport.on('moved', () => this.updateYearAxis())

    // Filters for curves
    this.colorMapFilter = new ColorMapFilter()
    const bloomFilter = new BloomFilter({ strength: 5, quality: 4 })
    this.curveAlphaFilter = new AlphaFilter({ alpha: 1 })
    this.curvesContainer.filters = [this.colorMapFilter, bloomFilter, this.curveAlphaFilter]

    // Selection curves filters
    this.selectionColorMapFilter = new ColorMapFilter()
    const selectionBloomFilter = new BloomFilter({ strength: 5, quality: 4 })
    this.selectionManager.selectionCurvesContainer.filters = [
      this.selectionColorMapFilter,
      selectionBloomFilter,
    ]

    this.nodeTextures = createNodeTextures(this.app)
    this.initialized = true

    // Watch for container resize and update viewport
    this.resizeObserver = new ResizeObserver(() => {
      // Force PixiJS to update its screen dimensions first
      this.app.resize()
      if (this.viewport) {
        // Preserve the world center point during resize
        const centerX = this.viewport.center.x
        const centerY = this.viewport.center.y

        this.viewport.resize(this.app.screen.width, this.app.screen.height)

        // Move back to the same world center
        this.viewport.moveCenter(centerX, centerY)
      }
    })
    this.resizeObserver.observe(element)
  }

  render(grid: Grid, orderToRow?: Record<number, number>) {
    if (!this.initialized) return

    this.clear()
    this.renderCurves(grid)
    this.renderNodes(grid)
    this.initParticles(grid)
    this.centerOnScreen(grid)

    if (orderToRow) {
      this.yearAxisOverlay.build(orderToRow)
    }

    // Init selection manager with current node containers
    if (this.nodeTextures) {
      this.selectionManager.init(this.nodeTextures.selectionRing, this.nodeContainers)
    }
  }

  private renderCurves(grid: Grid) {
    const curves: CurveData[] = []
    this.curveNodeMappings = []
    const nodesWithCitations = grid.getNodesWithCitations()

    let curveIndex = 0
    for (const sourceNode of nodesWithCitations) {
      const targets = grid.getValidTargets(sourceNode)
      if (targets.length === 0) continue

      const direction = getNodeDrawDirection(
        {
          gridX: sourceNode.gridX,
          gridY: sourceNode.gridY,
          isSource: sourceNode.metadata?.isSource,
        },
        grid.cols,
        this.drawDirectionStrategy,
      )

      const angles = getAnglesForDirection(direction)
      const sortedTargets = [...targets].sort((a, b) => b.y - a.y)

      for (let i = 0; i < sortedTargets.length; i++) {
        const targetNode = sortedTargets[i]!
        const angle = angles[i % angles.length]!
        const t = sortedTargets.length > 1 ? i / (sortedTargets.length - 1) : 0.5
        curves.push(this.createCurveData(sourceNode, targetNode, angle, t, this.curveParams))

        this.curveNodeMappings.push({
          curveIndex,
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
        })
        curveIndex++
      }
    }

    if (curves.length === 0) return

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
    if (!this.nodeTextures) return

    this.nodeSpriteOrder = []

    for (const node of grid.nodes.values()) {
      const container = this.createNodeSprite(node)
      this.nodeContainers.set(node.id, container)
      this.nodesContainer.addChild(container)

      this.nodeSpriteOrder.push({
        nodeId: node.id,
        sprite: container,
        citationCount: node.citedBy.length,
      })
    }

    this.nodeSpriteOrder.sort((a, b) => b.citationCount - a.citationCount)
  }

  private createNodeSprite(node: VisualNode): Container {
    const textures = this.nodeTextures!
    const targetScale = node.radius / textures.radius

    const container = new Container()
    container.x = node.x
    container.y = node.y
    ;(container as any)._targetScale = targetScale
    container.scale.set(0)
    container.alpha = 0

    const shadow = new Sprite(textures.shadow)
    shadow.anchor.set(0.5)

    const fill = new Sprite(textures.fill)
    fill.anchor.set(0.5)
    fill.tint = node.fillColor

    const overlay = new Sprite(textures.overlay)
    overlay.anchor.set(0.5)

    container.addChild(shadow)
    container.addChild(fill)
    container.addChild(overlay)

    return container
  }

  private initParticles(grid: Grid) {
    // Calculate the fit-to-view scale to determine visible area in world coords
    const { scale } = this.calculateFitToView(grid)
    const visibleWidth = this.app.screen.width / scale
    const visibleHeight = this.app.screen.height / scale

    // Use the larger of graph canvas or visible viewport
    const padding = 100
    const worldWidth = Math.max(grid.canvasWidth, visibleWidth) + padding * 2
    const worldHeight = Math.max(grid.canvasHeight, visibleHeight) + padding * 2

    // Center the particle area on the graph
    const offsetX = (grid.canvasWidth - worldWidth) / 2
    const offsetY = (grid.canvasHeight - worldHeight) / 2

    for (const ps of this.particleSystems) {
      ps.init(this.app, worldWidth, worldHeight)
      ps.container.x = offsetX
      ps.container.y = offsetY
    }
  }

  private centerOnScreen(grid: Grid) {
    if (!this.viewport) return
    this.viewport.x = (this.app.screen.width - grid.canvasWidth) / 2
    this.viewport.y = (this.app.screen.height - grid.canvasHeight) / 2
  }

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

  fitToView(grid: Grid, padding = 20): number {
    if (!this.viewport) return 1

    // Stop any momentum/deceleration
    this.viewport.plugins.get('decelerate')?.reset()

    const { scale, x, y } = this.calculateFitToView(grid, padding)

    this.viewport.scale.set(scale)
    this.viewport.x = x
    this.viewport.y = y

    this.baseScale = scale
    this.applyZoomLimits()

    return scale
  }

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

  getViewport() {
    if (!this.viewport) return { x: 0, y: 0, scale: 1 }
    return {
      x: this.viewport.x,
      y: this.viewport.y,
      scale: this.viewport.scale.x,
    }
  }

  setViewport(x: number, y: number, scale: number) {
    if (!this.viewport) return
    this.viewport.x = x
    this.viewport.y = y
    this.viewport.scale.set(scale)
    this.viewport.emit('moved', { viewport: this.viewport, type: 'animate' })
  }

  pan(dx: number, dy: number) {
    if (!this.viewport) return
    this.viewport.x += dx
    this.viewport.y += dy
  }

  zoomAt(newScale: number, screenX: number, screenY: number) {
    if (!this.viewport) return
    const oldScale = this.viewport.scale.x
    const worldX = (screenX - this.viewport.x) / oldScale
    const worldY = (screenY - this.viewport.y) / oldScale

    this.viewport.scale.set(newScale)
    this.viewport.x = screenX - worldX * newScale
    this.viewport.y = screenY - worldY * newScale
  }

  hitTestNode(screenX: number, screenY: number, grid: Grid): string | null {
    if (!this.viewport) return null
    const scale = this.viewport.scale.x
    const worldX = (screenX - this.viewport.x) / scale
    const worldY = (screenY - this.viewport.y) / scale

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

  // --- Node animation ---

  animateNodesIn(options: NodeAnimationOptions = {}, onComplete?: () => void) {
    const { totalDuration = 2000, nodeDuration = 400 } = options

    this.nodeFinishedMap.clear()
    this.nodeAnimationComplete = false

    const count = this.nodeSpriteOrder.length
    if (count === 0) {
      this.nodeAnimationComplete = true
      onComplete?.()
      return
    }

    // Calculate staggered start times
    const startTimes = this.nodeSpriteOrder.map((_, i) => {
      const t = i / (count - 1 || 1)
      const eased = easeOutQuad(t)
      return eased * (totalDuration - nodeDuration)
    })

    // Ensure all start invisible
    for (const { sprite } of this.nodeSpriteOrder) {
      sprite.scale.set(0)
      sprite.alpha = 0
    }

    const animationStartTime = performance.now()

    this.nodeAnimationRunner.start((elapsed) => {
      const now = animationStartTime + elapsed
      let allDone = true

      for (let i = 0; i < this.nodeSpriteOrder.length; i++) {
        const { nodeId, sprite } = this.nodeSpriteOrder[i]!
        const nodeStartTime = startTimes[i]!

        if (elapsed < nodeStartTime) {
          allDone = false
          continue
        }

        const nodeElapsed = elapsed - nodeStartTime
        const progress = Math.min(1, nodeElapsed / nodeDuration)

        if (progress < 1) {
          allDone = false
          const eased = easeOutElastic(progress)
          const targetScale = (sprite as any)._targetScale || 1
          sprite.scale.set(targetScale * eased)
          sprite.alpha = Math.min(1, progress * 2)
        } else {
          const targetScale = (sprite as any)._targetScale || 1
          sprite.scale.set(targetScale)
          sprite.alpha = 1

          if (!this.nodeFinishedMap.has(nodeId)) {
            this.nodeFinishedMap.set(nodeId, now)
          }
        }
      }

      if (allDone) {
        this.nodeAnimationComplete = true
      }

      return !allDone
    }, onComplete)
  }

  // --- Curve animation ---

  animateCurvesIn(options: CurveAnimationOptions = {}, onComplete?: () => void) {
    const {
      duration = 2000,
      awaitSourceNode = false,
      awaitBothNodes = false,
      durationStrategy = 'fixedIndependent',
    } = options

    if (!this.batchedCurves || this.curveNodeMappings.length === 0) {
      onComplete?.()
      return
    }

    const batchedCurves = this.batchedCurves
    const mappings = this.curveNodeMappings
    let globalStartTime: number | null = null
    let warnedAboutDuration = false

    this.curveAnimationRunner.start((elapsed) => {
      if (globalStartTime === null) {
        globalStartTime = performance.now()
      }

      const now = performance.now()
      let minProgress = Infinity

      for (const mapping of mappings) {
        // Check if curve should start
        if (awaitBothNodes) {
          if (
            !this.nodeFinishedMap.has(mapping.sourceNodeId) ||
            !this.nodeFinishedMap.has(mapping.targetNodeId)
          ) {
            minProgress = 0
            batchedCurves.setProgress(mapping.curveIndex, 0)
            continue
          }
        } else if (awaitSourceNode) {
          if (!this.nodeFinishedMap.has(mapping.sourceNodeId)) {
            minProgress = 0
            batchedCurves.setProgress(mapping.curveIndex, 0)
            continue
          }
        }

        // Calculate start time for this curve
        let curveStartTime: number
        if (awaitBothNodes) {
          const sourceFinish = this.nodeFinishedMap.get(mapping.sourceNodeId)!
          const targetFinish = this.nodeFinishedMap.get(mapping.targetNodeId)!
          curveStartTime = Math.max(sourceFinish, targetFinish)
        } else if (awaitSourceNode) {
          curveStartTime = this.nodeFinishedMap.get(mapping.sourceNodeId)!
        } else {
          curveStartTime = globalStartTime
        }

        const curveElapsed = now - curveStartTime

        let progress: number
        if (durationStrategy === 'fixedGlobal') {
          const globalEndTime = globalStartTime + duration
          const curveAvailableDuration = globalEndTime - curveStartTime
          if (curveAvailableDuration <= 0) {
            if (!warnedAboutDuration) {
              console.warn(
                `[animateCurvesIn] fixedGlobal duration (${duration}ms) is shorter than node animation time.`,
              )
              warnedAboutDuration = true
            }
            progress = 1
          } else {
            progress = easeInOutCubic(Math.min(1, curveElapsed / curveAvailableDuration))
          }
        } else {
          progress = easeInOutCubic(Math.min(1, curveElapsed / duration))
        }

        minProgress = Math.min(minProgress, progress)
        batchedCurves.setProgress(mapping.curveIndex, progress)
      }

      batchedCurves.updateProgress()

      return minProgress < 1
    }, onComplete)
  }

  // --- Colormap and background ---

  setColormap(index: number, grid: Grid) {
    const colormapData = COLORMAPS[index]
    if (!colormapData) return

    // Curve filters
    if (this.colorMapFilter) {
      this.colorMapFilter.colormap = index
    }
    if (this.selectionColorMapFilter) {
      this.selectionColorMapFilter.colormap = index
    }

    // Particles
    for (const ps of this.particleSystems) {
      ps.setColormap(colormapData.stops)
    }

    // Nodes (update grid data, then sprites)
    grid.setColormap(index)
    grid.updateNodeColors()
    this.updateNodeColors(grid)

    // Background (only update if in dark mode)
    if (this.isDarkMode) {
      this.app.renderer.background.color = getCanvasBackgroundColor(colormapData)
    }
  }

  private updateNodeColors(grid: Grid) {
    for (const [id, container] of this.nodeContainers) {
      const node = grid.nodes.get(id)
      if (!node) continue

      const fill = container.children[1] as Sprite
      if (fill) {
        fill.tint = node.fillColor
      }
    }

    // Also update cloned endpoint nodes
    this.selectionManager.updateEndpointColors()
  }

  // --- Selection ---

  setSelectedNodes(nodeIds: Set<string>) {
    const changed = this.selectionManager.setSelected(
      nodeIds,
      this.curveDataCache,
      this.curveNodeMappings,
    )

    if (changed) {
      const hasSelection = nodeIds.size > 0
      this.animateCurveAlpha(hasSelection ? 0 : 1)
      this.animateNodeDimming(hasSelection)
    }
  }

  private animateNodeDimming(dim: boolean) {
    const targetAlpha = dim ? NODE_DIM_ALPHA : 1
    const startAlpha = this.nodesContainer.alpha

    animateProgress(
      this.nodeAlphaAnimationRunner,
      NODE_DIM_DURATION,
      easeInOutCubic,
      (progress) => {
        this.nodesContainer.alpha = startAlpha + (targetAlpha - startAlpha) * progress
      },
    )
  }

  private animateCurveAlpha(targetAlpha: number, duration = 300) {
    if (!this.curveAlphaFilter) return

    const startAlpha = this.curveAlphaFilter.alpha

    animateProgress(this.curveAlphaAnimationRunner, duration, easeInOutCubic, (progress) => {
      if (this.curveAlphaFilter) {
        this.curveAlphaFilter.alpha = startAlpha + (targetAlpha - startAlpha) * progress
      }
    })
  }

  // --- Year axis ---

  private updateYearAxis() {
    if (!this.viewport) return
    this.yearAxisOverlay.update(this.viewport, this.app.screen.height, this.app.screen.width)
  }

  setYearAxisVisible(visible: boolean, duration = 250) {
    this.yearAxisOverlay.setVisible(visible, duration)
  }

  // --- Particles ---

  setParticleOptions(options: ParticleSystemOptions) {
    for (const ps of this.particleSystems) {
      ps.setOptions(options)
    }
  }

  private particleAnimationRunner = new AnimationRunner()

  setParticlesVisible(visible: boolean, duration = 300) {
    // Ensure containers are visible during animation
    for (const ps of this.particleSystems) {
      ps.container.visible = true
    }

    const startAlpha = this.particleSystems[0]?.container.alpha ?? (visible ? 0 : 1)
    const targetAlpha = visible ? 1 : 0

    animateProgress(
      this.particleAnimationRunner,
      duration,
      easeOutCubic,
      (progress) => {
        const alpha = startAlpha + (targetAlpha - startAlpha) * progress
        for (const ps of this.particleSystems) {
          ps.container.alpha = alpha
        }
      },
      () => {
        // Hide containers when fully faded out
        if (!visible) {
          for (const ps of this.particleSystems) {
            ps.container.visible = false
          }
        }
      },
    )
  }

  private bgColorAnimationRunner = new AnimationRunner()

  setDarkMode(isDark: boolean, colormapIndex?: number, animate = true) {
    this.isDarkMode = isDark

    // Update year axis overlay theme
    this.yearAxisOverlay.setDarkMode(isDark)

    // Disable particles in light mode
    this.setParticlesVisible(isDark)

    // Determine target background color
    let targetColor: number
    if (isDark) {
      // Dark mode: use colormap background
      if (colormapIndex !== undefined) {
        const colormapData = COLORMAPS[colormapIndex]
        if (colormapData) {
          targetColor = getCanvasBackgroundColor(colormapData)
        } else {
          targetColor = 0x1a1a2e
        }
      } else {
        targetColor = 0x1a1a2e
      }
    } else {
      // Light mode: off-white background
      targetColor = 0xf5f5f0
    }

    if (animate) {
      this.animateBackgroundColor(targetColor)
    } else {
      this.app.renderer.background.color = targetColor
    }
  }

  private animateBackgroundColor(targetColor: number, duration = 300) {
    const bgColor = this.app.renderer.background.color
    const startColor = typeof bgColor === 'number' ? bgColor : bgColor.toNumber()

    // Extract RGB components
    const startR = (startColor >> 16) & 0xff
    const startG = (startColor >> 8) & 0xff
    const startB = startColor & 0xff

    const targetR = (targetColor >> 16) & 0xff
    const targetG = (targetColor >> 8) & 0xff
    const targetB = targetColor & 0xff

    animateProgress(this.bgColorAnimationRunner, duration, easeMaterial, (progress) => {
      const r = Math.round(startR + (targetR - startR) * progress)
      const g = Math.round(startG + (targetG - startG) * progress)
      const b = Math.round(startB + (targetB - startB) * progress)
      this.app.renderer.background.color = (r << 16) | (g << 8) | b
    })
  }

  // --- Cleanup ---

  private clear() {
    this.nodeAnimationRunner.cancel()
    this.curveAnimationRunner.cancel()
    this.curveAlphaAnimationRunner.cancel()
    this.nodeAlphaAnimationRunner.cancel()

    // Reset curve alpha to fully visible for fresh render
    if (this.curveAlphaFilter) {
      this.curveAlphaFilter.alpha = 1
    }

    // Reset node container alpha (may have been dimmed by selection)
    this.nodesContainer.alpha = 1

    this.nodesContainer.removeChildren()
    this.curvesContainer.removeChildren()
    this.nodeContainers.clear()
    this.nodeSpriteOrder = []
    this.nodeFinishedMap.clear()
    this.nodeAnimationComplete = false
    this.curveNodeMappings = []
    this.curveDataCache = []

    this.yearAxisOverlay.clear()
    this.selectionManager.clear()

    if (this.batchedCurves) {
      this.batchedCurves.destroy()
      this.batchedCurves = null
    }
  }

  destroy() {
    if (!this.initialized) return

    this.clear()
    for (const ps of this.particleSystems) {
      ps.destroy()
    }
    this.particleSystems = []

    if (this.nodeTextures) {
      destroyNodeTextures(this.nodeTextures)
      this.nodeTextures = null
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    this.app.destroy(true)
    this.initialized = false
  }
}
