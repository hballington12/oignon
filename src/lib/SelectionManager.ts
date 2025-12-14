import { Container, Sprite, Texture } from 'pixi.js'
import { BatchedCurveMesh } from './BatchedCurveMesh'
import type { CurveData } from './BatchedCurveGeometry'
import { AnimationRunner, animateProgress } from './AnimationRunner'
import { easeInOutCubic } from './easing'

interface CurveNodeMapping {
  curveIndex: number
  sourceNodeId: string
  targetNodeId: string
}

/**
 * Manages node selection state and visuals
 * - Adds/removes selection rings on nodes
 * - Creates filtered curve mesh for selected nodes
 * - Animates curve alpha when selection changes
 */
export class SelectionManager {
  private selectedIds = new Set<string>()
  private selectionRingTexture: Texture | null = null
  private nodeContainers: Map<string, Container> = new Map()

  // Selection curves
  readonly selectionCurvesContainer: Container
  private selectionCurvesMesh: BatchedCurveMesh | null = null
  private selectionCurveAnimationRunner = new AnimationRunner()

  constructor() {
    this.selectionCurvesContainer = new Container()
  }

  /**
   * Initialize with texture and node container references
   */
  init(selectionRingTexture: Texture, nodeContainers: Map<string, Container>) {
    this.selectionRingTexture = selectionRingTexture
    this.nodeContainers = nodeContainers
  }

  /**
   * Update selection, adding/removing rings and rebuilding selection curves
   * @returns true if selection changed
   */
  setSelected(
    nodeIds: Set<string>,
    curveDataCache: CurveData[],
    curveNodeMappings: CurveNodeMapping[],
  ): boolean {
    const changed =
      nodeIds.size !== this.selectedIds.size || ![...nodeIds].every((id) => this.selectedIds.has(id))

    if (!changed) return false

    // Remove rings from deselected nodes
    for (const id of this.selectedIds) {
      if (!nodeIds.has(id)) {
        this.removeRing(id)
      }
    }

    // Add rings to newly selected nodes
    for (const id of nodeIds) {
      if (!this.selectedIds.has(id)) {
        this.addRing(id)
      }
    }

    // Rebuild selection curves
    this.rebuildSelectionCurves(nodeIds, curveDataCache, curveNodeMappings)

    this.selectedIds = new Set(nodeIds)
    return true
  }

  private addRing(nodeId: string) {
    const container = this.nodeContainers.get(nodeId)
    if (container && this.selectionRingTexture) {
      const ring = new Sprite(this.selectionRingTexture)
      ring.anchor.set(0.5)
      container.addChild(ring)
    }
  }

  private removeRing(nodeId: string) {
    const container = this.nodeContainers.get(nodeId)
    if (container && container.children.length > 3) {
      // Ring is the 4th child (shadow=0, fill=1, overlay=2, ring=3)
      container.removeChildAt(3)
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
      alpha: 0.1,
    })

    this.selectionCurvesContainer.addChild(this.selectionCurvesMesh)
    this.animateSelectionCurvesIn()
  }

  private animateSelectionCurvesIn(duration = 500) {
    if (!this.selectionCurvesMesh) return

    const mesh = this.selectionCurvesMesh

    animateProgress(
      this.selectionCurveAnimationRunner,
      duration,
      easeInOutCubic,
      (progress) => {
        // Check mesh still exists and is same instance
        if (this.selectionCurvesMesh === mesh) {
          mesh.setAllProgress(progress)
          mesh.updateProgress()
        }
      },
    )
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
   * Clear selection state and destroy curves
   */
  clear() {
    this.selectionCurveAnimationRunner.cancel()
    this.selectedIds.clear()

    if (this.selectionCurvesMesh) {
      this.selectionCurvesContainer.removeChild(this.selectionCurvesMesh)
      this.selectionCurvesMesh.destroy()
      this.selectionCurvesMesh = null
    }

    this.selectionCurvesContainer.removeChildren()
  }
}
