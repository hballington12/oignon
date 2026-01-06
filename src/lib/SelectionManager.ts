import { Container, Sprite, Texture } from 'pixi.js'
import { BatchedCurveMesh } from './BatchedCurveMesh'
import type { CurveData } from './BatchedCurveGeometry'
import { AnimationRunner, animateProgress } from './AnimationRunner'
import { easeInOutCubic } from './easing'

// Higher alpha for selection curves since fewer curves = less additive buildup
const SELECTION_CURVE_ALPHA = 0.45

// Endpoint fade animation duration
const ENDPOINT_FADE_DURATION = 400

export interface CurveNodeMapping {
  curveIndex: number
  sourceNodeId: string
  targetNodeId: string
}

/**
 * Manages node selection state and visuals
 * - Adds/removes selection rings on nodes
 * - Creates filtered curve mesh for selected nodes
 * - Clones connected endpoint nodes to a top layer
 * - Animates curve drawing when selection changes
 */
export class SelectionManager {
  private selectedIds = new Set<string>()
  private connectedIds = new Set<string>()
  private selectionRingTexture: Texture | null = null
  private nodeContainers: Map<string, Container> = new Map()

  // Selection curves
  readonly selectionCurvesContainer: Container
  private selectionCurvesMesh: BatchedCurveMesh | null = null
  private selectionCurveAnimationRunner = new AnimationRunner()

  // Selected endpoint nodes (cloned above curves)
  readonly selectedEndpointsContainer: Container
  private endpointClones: Map<string, Container> = new Map()
  private endpointAnimationRunner = new AnimationRunner()

  constructor() {
    this.selectionCurvesContainer = new Container()
    this.selectedEndpointsContainer = new Container()
  }

  /**
   * Initialize with texture and node container references
   */
  init(selectionRingTexture: Texture, nodeContainers: Map<string, Container>) {
    this.selectionRingTexture = selectionRingTexture
    this.nodeContainers = nodeContainers
  }

  /**
   * Update selection, rebuilding selection curves and cloning connected endpoint nodes
   * Selection ring is now added to cloned endpoints, not original nodes
   * @returns true if selection changed
   */
  setSelected(
    nodeIds: Set<string>,
    curveDataCache: CurveData[],
    curveNodeMappings: CurveNodeMapping[],
  ): boolean {
    const changed =
      nodeIds.size !== this.selectedIds.size ||
      ![...nodeIds].every((id) => this.selectedIds.has(id))

    if (!changed) return false

    // Update selectedIds first so rebuildSelectedEndpoints can use it
    this.selectedIds = new Set(nodeIds)

    // Calculate connected node IDs and rebuild visuals
    const previousConnectedIds = this.connectedIds
    this.connectedIds = this.calculateConnectedIds(nodeIds, curveNodeMappings)
    this.rebuildSelectionCurves(nodeIds, curveDataCache, curveNodeMappings)
    this.rebuildSelectedEndpoints(previousConnectedIds)

    return true
  }

  /**
   * Get all node IDs connected to the selection (selected + their neighbors)
   */
  private calculateConnectedIds(
    nodeIds: Set<string>,
    curveNodeMappings: CurveNodeMapping[],
  ): Set<string> {
    if (nodeIds.size === 0) return new Set()

    const connected = new Set<string>()

    for (const mapping of curveNodeMappings) {
      const sourceSelected = nodeIds.has(mapping.sourceNodeId)
      const targetSelected = nodeIds.has(mapping.targetNodeId)

      if (sourceSelected || targetSelected) {
        connected.add(mapping.sourceNodeId)
        connected.add(mapping.targetNodeId)
      }
    }

    return connected
  }

  /**
   * Get the current set of connected node IDs (for external use)
   */
  getConnectedIds(): Set<string> {
    return new Set(this.connectedIds)
  }

  /**
   * Update colors of cloned endpoint nodes (call after colormap change)
   */
  updateEndpointColors() {
    for (const [nodeId, clone] of this.endpointClones) {
      const original = this.nodeContainers.get(nodeId)
      if (!original) continue

      // Copy tint from original fill sprite (index 1) to clone fill sprite
      const originalFill = original.children[1] as Sprite
      const cloneFill = clone.children[1] as Sprite
      if (originalFill && cloneFill) {
        cloneFill.tint = originalFill.tint
      }
    }
  }

  private rebuildSelectionCurves(
    nodeIds: Set<string>,
    curveDataCache: CurveData[],
    curveNodeMappings: CurveNodeMapping[],
  ) {
    // Destroy existing mesh
    if (this.selectionCurvesMesh) {
      this.selectionCurvesContainer.removeChild(this.selectionCurvesMesh)
      this.selectionCurvesMesh.destroy()
      this.selectionCurvesMesh = null
    }

    if (nodeIds.size === 0) return

    // Find curves connected to selected nodes
    const selectionCurves: CurveData[] = []
    for (let i = 0; i < curveNodeMappings.length; i++) {
      const mapping = curveNodeMappings[i]!
      const curveData = curveDataCache[i]
      if (curveData && (nodeIds.has(mapping.sourceNodeId) || nodeIds.has(mapping.targetNodeId))) {
        selectionCurves.push(curveData)
      }
    }

    if (selectionCurves.length === 0) return

    // Create new mesh
    this.selectionCurvesMesh = new BatchedCurveMesh({
      curves: selectionCurves,
      segments: 32,
      defaultWidth: 3,
      alpha: SELECTION_CURVE_ALPHA,
    })

    this.selectionCurvesContainer.addChild(this.selectionCurvesMesh)
    this.animateSelectionCurvesIn()
  }

  private animateSelectionCurvesIn(duration = 500) {
    if (!this.selectionCurvesMesh) return

    const mesh = this.selectionCurvesMesh

    animateProgress(this.selectionCurveAnimationRunner, duration, easeInOutCubic, (progress) => {
      // Check mesh still exists and is same instance
      if (this.selectionCurvesMesh === mesh) {
        mesh.setAllProgress(progress)
        mesh.updateProgress()
      }
    })
  }

  /**
   * Update endpoint clones with fade transitions
   */
  private rebuildSelectedEndpoints(previousConnectedIds: Set<string>) {
    // Determine which endpoints to add, remove, or keep
    const toAdd = new Set<string>()
    const toRemove = new Set<string>()

    for (const id of this.connectedIds) {
      if (!previousConnectedIds.has(id)) {
        toAdd.add(id)
      }
    }

    for (const id of previousConnectedIds) {
      if (!this.connectedIds.has(id)) {
        toRemove.add(id)
      }
    }

    // Fade out and remove old endpoints
    for (const id of toRemove) {
      const clone = this.endpointClones.get(id)
      if (clone) {
        this.fadeOutAndRemove(clone)
        this.endpointClones.delete(id)
      }
    }

    // Add and fade in new endpoints
    for (const id of toAdd) {
      const original = this.nodeContainers.get(id)
      if (original) {
        // Pass isSelected=true for selected nodes to add the selection ring
        const isSelected = this.selectedIds.has(id)
        const clone = this.cloneNodeContainer(original, isSelected)
        clone.alpha = 0
        this.selectedEndpointsContainer.addChild(clone)
        this.endpointClones.set(id, clone)
        this.fadeIn(clone)
      }
    }
  }

  private fadeIn(container: Container) {
    const startAlpha = container.alpha
    const targetAlpha = 1

    animateProgress(new AnimationRunner(), ENDPOINT_FADE_DURATION, easeInOutCubic, (progress) => {
      container.alpha = startAlpha + (targetAlpha - startAlpha) * progress
    })
  }

  private fadeOutAndRemove(container: Container) {
    const startAlpha = container.alpha

    animateProgress(
      new AnimationRunner(),
      ENDPOINT_FADE_DURATION,
      easeInOutCubic,
      (progress) => {
        container.alpha = startAlpha * (1 - progress)
      },
      () => {
        this.selectedEndpointsContainer.removeChild(container)
      },
    )
  }

  /**
   * Clone a node container (shadow, fill, overlay sprites)
   * If isSelected is true, also add the selection ring
   */
  private cloneNodeContainer(original: Container, isSelected: boolean = false): Container {
    const clone = new Container()
    clone.x = original.x
    clone.y = original.y
    clone.scale.copyFrom(original.scale)
    clone.alpha = original.alpha

    // Clone the base sprites (shadow=0, fill=1, overlay=2), skip selection ring if present
    const baseChildCount = 3
    for (let i = 0; i < Math.min(original.children.length, baseChildCount); i++) {
      const child = original.children[i]
      if (child instanceof Sprite) {
        const spriteClone = new Sprite(child.texture)
        spriteClone.anchor.copyFrom(child.anchor)
        spriteClone.tint = child.tint
        clone.addChild(spriteClone)
      }
    }

    // Add selection ring to selected nodes
    if (isSelected && this.selectionRingTexture) {
      const ring = new Sprite(this.selectionRingTexture)
      ring.anchor.set(0.5)
      clone.addChild(ring)
    }

    return clone
  }

  /**
   * Whether any nodes are selected
   */
  get hasSelection(): boolean {
    return this.selectedIds.size > 0
  }

  /**
   * Current selected node IDs
   */
  get selected(): Set<string> {
    return new Set(this.selectedIds)
  }

  /**
   * Clear selection state, destroy curves, and remove endpoint clones
   */
  clear() {
    this.selectionCurveAnimationRunner.cancel()
    this.endpointAnimationRunner.cancel()
    this.selectedIds.clear()
    this.connectedIds.clear()
    this.endpointClones.clear()

    if (this.selectionCurvesMesh) {
      this.selectionCurvesContainer.removeChild(this.selectionCurvesMesh)
      this.selectionCurvesMesh.destroy()
      this.selectionCurvesMesh = null
    }

    this.selectionCurvesContainer.removeChildren()
    this.selectedEndpointsContainer.removeChildren()
  }
}
