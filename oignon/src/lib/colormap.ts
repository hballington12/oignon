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

// Available colormaps
export const COLORMAPS: Colormap[] = [FREEZE, LAVENDER, VOLTAGE, EMBER, TORCH]

// Current active colormap
let activeColormap: Colormap = FREEZE

export function getActiveColormap(): Colormap {
  return activeColormap
}

export function setActiveColormap(colormap: Colormap) {
  activeColormap = colormap
}

export function getColormapByIndex(index: number): Colormap {
  return COLORMAPS[index % COLORMAPS.length]!
}

/**
 * Get the background color for the current colormap (slightly above t=0)
 */
export function getBackgroundColor(colormap: Colormap = activeColormap): number {
  return getColormapColor(0.1, colormap.stops)
}

/**
 * Get the background color as a CSS hex string
 */
export function getBackgroundColorHex(colormap: Colormap = activeColormap): string {
  const color = getBackgroundColor(colormap)
  return '#' + color.toString(16).padStart(6, '0')
}

/**
 * Interpolate a color from a colormap based on normalized value t (0-1)
 */
export function getColormapColor(
  t: number,
  colormap: ColormapStop[] = activeColormap.stops,
): number {
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
