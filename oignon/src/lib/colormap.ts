// Colormap utilities for mapping normalized values to colors

interface ColormapStop {
  t: number
  r: number
  g: number
  b: number
}

// Plasma colormap (Matplotlib-style)
const PLASMA: ColormapStop[] = [
  { t: 0.0, r: 0.05, g: 0.03, b: 0.53 },
  { t: 0.25, r: 0.55, g: 0.08, b: 0.62 },
  { t: 0.5, r: 0.93, g: 0.3, b: 0.4 },
  { t: 0.75, r: 0.99, g: 0.65, b: 0.22 },
  { t: 1.0, r: 0.94, g: 0.98, b: 0.13 },
]

// Available colormaps
export const COLORMAPS = {
  plasma: PLASMA,
} as const

export type ColormapName = keyof typeof COLORMAPS

/**
 * Interpolate a color from a colormap based on normalized value t (0-1)
 */
export function getColormapColor(t: number, colormap: ColormapStop[] = PLASMA): number {
  t = Math.max(0, Math.min(1, t))

  let lower = colormap[0]!
  let upper = colormap[colormap.length - 1]!

  for (let i = 0; i < colormap.length - 1; i++) {
    const curr = colormap[i]!
    const next = colormap[i + 1]!
    if (t >= curr.t && t <= next.t) {
      lower = curr
      upper = next
      break
    }
  }

  const range = upper.t - lower.t
  const localT = range > 0 ? (t - lower.t) / range : 0

  const r = lower.r + localT * (upper.r - lower.r)
  const g = lower.g + localT * (upper.g - lower.g)
  const b = lower.b + localT * (upper.b - lower.b)

  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255)
}

/**
 * Create a brighter stroke color from a fill color
 */
export function getBrighterColor(color: number, amount = 40): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount)
  const g = Math.min(255, ((color >> 8) & 0xff) + amount)
  const b = Math.min(255, (color & 0xff) + amount)
  return (r << 16) | (g << 8) | b
}
