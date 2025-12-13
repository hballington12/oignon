// Colormap utilities for mapping normalized values to colors

export interface ColormapStop {
  t: number
  r: number
  g: number
  b: number
}

export interface Colormap {
  name: string
  stops: ColormapStop[]
  isDark: boolean
}

// Dark themes (start black)
const FREEZE: Colormap = {
  name: 'Freeze',
  isDark: true,
  stops: [
    { t: 0.0, r: 0.0, g: 0.0, b: 0.0 },
    { t: 0.25, r: 0.2157, g: 0.1804, b: 0.4039 },
    { t: 0.5, r: 0.1529, g: 0.4431, b: 0.8784 },
    { t: 0.75, r: 0.4235, g: 0.7569, b: 0.8392 },
    { t: 1.0, r: 1.0, g: 1.0, b: 1.0 },
  ],
}

const LAVENDER: Colormap = {
  name: 'Lavender',
  isDark: true,
  stops: [
    { t: 0.0, r: 0.0, g: 0.0, b: 0.0 },
    { t: 0.25, r: 0.2745, g: 0.0078, b: 0.3647 },
    { t: 0.5, r: 0.2314, g: 0.3529, b: 0.5725 },
    { t: 0.75, r: 0.1333, g: 0.6196, b: 0.5451 },
    { t: 1.0, r: 0.4667, g: 0.8588, b: 0.2745 },
  ],
}

const VOLTAGE: Colormap = {
  name: 'Voltage',
  isDark: true,
  stops: [
    { t: 0.0, r: 0.0, g: 0.0, b: 0.0 },
    { t: 0.25, r: 0.3451, g: 0.0784, b: 0.349 },
    { t: 0.5, r: 0.5098, g: 0.3137, b: 0.8941 },
    { t: 0.75, r: 0.4745, g: 0.7255, b: 0.9725 },
    { t: 1.0, r: 1.0, g: 1.0, b: 1.0 },
  ],
}

const EMBER: Colormap = {
  name: 'Ember',
  isDark: true,
  stops: [
    { t: 0.0, r: 0.0, g: 0.0, b: 0.0 },
    { t: 0.25, r: 0.3059, g: 0.102, b: 0.2392 },
    { t: 0.5, r: 0.7255, g: 0.0471, b: 0.2078 },
    { t: 0.75, r: 0.9255, g: 0.4627, b: 0.0039 },
    { t: 1.0, r: 0.9451, g: 0.8824, b: 0.2431 },
  ],
}

const TORCH: Colormap = {
  name: 'Torch',
  isDark: true,
  stops: [
    { t: 0.0, r: 0.0, g: 0.0, b: 0.0 },
    { t: 0.25, r: 0.1647, g: 0.1412, b: 0.5882 },
    { t: 0.5, r: 0.6353, g: 0.3098, b: 0.5294 },
    { t: 0.75, r: 1.0, g: 0.5529, b: 0.3059 },
    { t: 1.0, r: 1.0, g: 1.0, b: 1.0 },
  ],
}

const INK: Colormap = {
  name: 'Ink',
  isDark: true,
  stops: [
    { t: 0.0, r: 0.0, g: 0.0, b: 0.0 },
    { t: 0.25, r: 0.1, g: 0.12, b: 0.18 },
    { t: 0.5, r: 0.25, g: 0.32, b: 0.42 },
    { t: 0.75, r: 0.55, g: 0.62, b: 0.72 },
    { t: 1.0, r: 1.0, g: 1.0, b: 1.0 },
  ],
}

const SLATE: Colormap = {
  name: 'Slate',
  isDark: true,
  stops: [
    { t: 0.0, r: 0.0, g: 0.0, b: 0.0 },
    { t: 0.25, r: 0.15, g: 0.15, b: 0.15 },
    { t: 0.5, r: 0.35, g: 0.35, b: 0.35 },
    { t: 0.75, r: 0.65, g: 0.65, b: 0.65 },
    { t: 1.0, r: 1.0, g: 1.0, b: 1.0 },
  ],
}

const OCEAN: Colormap = {
  name: 'Ocean',
  isDark: true,
  stops: [
    { t: 0.0, r: 0.0, g: 0.0, b: 0.0 },
    { t: 0.25, r: 0.0, g: 0.1, b: 0.22 },
    { t: 0.5, r: 0.0, g: 0.3, b: 0.55 },
    { t: 0.75, r: 0.4, g: 0.65, b: 0.85 },
    { t: 1.0, r: 1.0, g: 1.0, b: 1.0 },
  ],
}

const FOREST: Colormap = {
  name: 'Forest',
  isDark: true,
  stops: [
    { t: 0.0, r: 0.0, g: 0.0, b: 0.0 },
    { t: 0.25, r: 0.05, g: 0.15, b: 0.08 },
    { t: 0.5, r: 0.1, g: 0.4, b: 0.2 },
    { t: 0.75, r: 0.4, g: 0.7, b: 0.45 },
    { t: 1.0, r: 1.0, g: 1.0, b: 1.0 },
  ],
}

// Available colormaps
export const COLORMAPS: Colormap[] = [
  FREEZE,
  LAVENDER,
  VOLTAGE,
  EMBER,
  TORCH,
  INK,
  SLATE,
  OCEAN,
  FOREST,
]

export function getColormapByIndex(index: number): Colormap {
  return COLORMAPS[index % COLORMAPS.length]!
}

/**
 * Get the background color for a colormap (slightly above t=0)
 */
export function getBackgroundColor(colormap: Colormap): number {
  return getColormapColor(0.1, colormap.stops)
}

/**
 * Get the canvas background color for a colormap (darker, at t=0.05)
 */
export function getCanvasBackgroundColor(colormap: Colormap): number {
  return getColormapColor(0.05, colormap.stops)
}

/**
 * Get the background color as a CSS hex string
 */
export function getBackgroundColorHex(colormap: Colormap): string {
  const color = getBackgroundColor(colormap)
  return '#' + color.toString(16).padStart(6, '0')
}

/**
 * Get a darker background color for overlays (t=0.05)
 */
export function getDarkerBackgroundColorHex(colormap: Colormap): string {
  const color = getColormapColor(0.05, colormap.stops)
  return '#' + color.toString(16).padStart(6, '0')
}

/**
 * Interpolate a color from a colormap based on normalized value t (0-1)
 */
export function getColormapColor(t: number, stops: ColormapStop[]): number {
  t = Math.max(0, Math.min(1, t))

  let lower = stops[0]!
  let upper = stops[stops.length - 1]!

  for (let i = 0; i < stops.length - 1; i++) {
    const curr = stops[i]!
    const next = stops[i + 1]!
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

/**
 * Get a colormap color at position t as a CSS hex string
 */
export function getColormapColorHex(t: number, colormap: Colormap): string {
  const color = getColormapColor(t, colormap.stops)
  return '#' + color.toString(16).padStart(6, '0')
}
