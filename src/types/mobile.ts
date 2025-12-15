export type TabId = 'search' | 'details' | 'library' | 'controls'

// Layout constants
export const TAB_BAR_HEIGHT = 52
export const TAB_ICON_SIZE = 22

// Panel heights per tab
export const TAB_HEIGHTS: Record<TabId, number> = {
  search: 60,
  details: 260,
  library: 260,
  controls: 60,
}

// Resize constraints
export const PANEL_MIN_HEIGHT = 60
export const PANEL_MAX_HEIGHT = 400

// Animation timing (matches --transition-smooth in variables.css)
export const TRANSITION_SMOOTH_MS = 300
export const TRANSITION_SAFE_PADDING_MS = 50
