import { Graphics, Texture, type Application } from 'pixi.js'

const BASE_CIRCLE_RADIUS = 32

/** Shadow configuration for node visuals */
const NODE_SHADOW = {
  outerOffset: { x: 2, y: 3 },
  outerExtraRadius: 2,
  outerAlpha: 0.25,
  innerOffset: { x: 1, y: 2 },
  innerAlpha: 0.4,
}

/** Glossy highlight configuration */
const NODE_HIGHLIGHT = {
  primary: { offset: 0.15, radius: 0.75, alpha: 0.12 },
  secondary: { offset: 0.25, radius: 0.45, alpha: 0.2 },
  tertiary: { offset: 0.3, radius: 0.2, alpha: 0.35 },
}

/** Stroke configuration */
const NODE_STROKE = {
  default: { width: 5, color: 0x000000, alpha: 0.7 },
}

export interface NodeTextures {
  shadow: Texture
  fill: Texture
  overlay: Texture
  selectionRing: Texture
  radius: number
}

/**
 * Creates all textures needed for rendering nodes
 * - Shadow: drawn under the fill (outer + inner shadows)
 * - Fill: white circle tinted per-node
 * - Overlay: stroke + glossy highlights on top
 * - Selection ring: bright ring for selected nodes
 */
export function createNodeTextures(app: Application): NodeTextures {
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

  // --- Shadow texture ---
  const shadowGraphics = new Graphics()
  shadowGraphics.circle(cx + outerOffset.x, cy + outerOffset.y, r + outerExtraRadius)
  shadowGraphics.fill({ color: 0x000000, alpha: outerAlpha })
  shadowGraphics.circle(cx + innerOffset.x, cy + innerOffset.y, r)
  shadowGraphics.fill({ color: 0x000000, alpha: innerAlpha })
  const shadow = app.renderer.generateTexture(shadowGraphics)
  shadowGraphics.destroy()

  // --- Fill texture ---
  const fillGraphics = new Graphics()
  fillGraphics.circle(cx, cy, r)
  fillGraphics.fill({ color: 0xffffff })
  const fill = app.renderer.generateTexture(fillGraphics)
  fillGraphics.destroy()

  // --- Overlay texture ---
  const overlayGraphics = new Graphics()

  // Stroke outline
  overlayGraphics.circle(cx, cy, r)
  overlayGraphics.stroke({ width: stroke.width, color: stroke.color, alpha: stroke.alpha })

  // Glossy highlights (white circles offset to top-left)
  overlayGraphics.circle(cx - r * primary.offset, cy - r * primary.offset, r * primary.radius)
  overlayGraphics.fill({ color: 0xffffff, alpha: primary.alpha })

  overlayGraphics.circle(cx - r * secondary.offset, cy - r * secondary.offset, r * secondary.radius)
  overlayGraphics.fill({ color: 0xffffff, alpha: secondary.alpha })

  overlayGraphics.circle(cx - r * tertiary.offset, cy - r * tertiary.offset, r * tertiary.radius)
  overlayGraphics.fill({ color: 0xffffff, alpha: tertiary.alpha })

  const overlay = app.renderer.generateTexture(overlayGraphics)
  overlayGraphics.destroy()

  // --- Selection ring texture ---
  const selectionGraphics = new Graphics()
  selectionGraphics.circle(cx, cy, r)
  selectionGraphics.stroke({ width: 8, color: 0xffffff, alpha: 1 })
  const selectionRing = app.renderer.generateTexture(selectionGraphics)
  selectionGraphics.destroy()

  return {
    shadow,
    fill,
    overlay,
    selectionRing,
    radius: r,
  }
}

/**
 * Destroy all node textures and free GPU memory
 */
export function destroyNodeTextures(textures: NodeTextures) {
  textures.shadow.destroy(true)
  textures.fill.destroy(true)
  textures.overlay.destroy(true)
  textures.selectionRing.destroy(true)
}
