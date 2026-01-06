export type TabId = 'search' | 'details' | 'library' | 'controls'
export type LayoutMode = 'auto' | 'portrait' | 'landscape'

// Layout constants
export const TAB_BAR_HEIGHT = 52
export const TAB_BAR_WIDTH = 52 // Same dimension for vertical bar
export const TAB_ICON_SIZE = 22

// Panel heights per tab (portrait mode)
export const TAB_HEIGHTS: Record<TabId, number> = {
  search: 60,
  details: 260,
  library: 260,
  controls: 60,
}

// Panel widths per tab (landscape mode)
export const TAB_WIDTHS: Record<TabId, number> = {
  search: 80,
  details: 320,
  library: 320,
  controls: 80,
}

// Resize constraints (portrait)
export const PANEL_MIN_HEIGHT = 60
export const PANEL_MAX_HEIGHT = 400

// Resize constraints (landscape)
export const PANEL_MIN_WIDTH = 80
export const PANEL_MAX_WIDTH = 500

// Animation timing (matches --transition-smooth in variables.css)
export const TRANSITION_SMOOTH_MS = 300
export const TRANSITION_SAFE_PADDING_MS = 50
