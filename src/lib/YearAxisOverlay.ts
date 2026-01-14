import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { GRID } from './constants'
import { AnimationRunner, animateProgress } from './AnimationRunner'
import { easeOutCubic } from './easing'

interface YearAxisEntry {
  year: number
  worldY: number
}

const AXIS_X = 12
const TICK_WIDTH = 8

// Dark mode text style
const DARK_TEXT_STYLE = new TextStyle({
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

// Light mode text style - higher contrast
const LIGHT_TEXT_STYLE = new TextStyle({
  fontSize: 11,
  fill: 0x333333,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  dropShadow: {
    color: 0xffffff,
    blur: 3,
    distance: 0,
    alpha: 0.8,
  },
})

/**
 * Renders a year axis overlay on the left side of the screen
 * Shows year labels that stay fixed horizontally but scroll with the viewport vertically
 * Includes horizontal grid lines that extend across the viewport
 */
export class YearAxisOverlay {
  readonly container: Container
  private gridContainer: Container
  private data: YearAxisEntry[] = []
  private animationRunner = new AnimationRunner()
  private _visible = true
  private _isDarkMode = true
  private _screenWidth = 0

  constructor() {
    this.container = new Container()
    this.gridContainer = new Container()
    // Grid lines go behind everything else
    this.container.addChild(this.gridContainer)
  }

  /**
   * Build axis from orderToRow mapping (year -> grid row)
   */
  build(orderToRow: Record<number, number>) {
    this.container.removeChildren()
    this.gridContainer = new Container()
    this.container.addChild(this.gridContainer)
    this.data = []

    // Build year -> worldY mapping
    for (const [yearStr, row] of Object.entries(orderToRow)) {
      const year = Number(yearStr)
      if (isNaN(year)) continue
      const worldY = GRID.padding + row * GRID.ySpacing
      this.data.push({ year, worldY })
    }

    // Sort by year descending (oldest at top)
    this.data.sort((a, b) => b.year - a.year)

    const textStyle = this._isDarkMode ? DARK_TEXT_STYLE : LIGHT_TEXT_STYLE
    const bgColor = this._isDarkMode ? 0x000000 : 0xffffff
    const bgAlpha = this._isDarkMode ? 0.4 : 0.6
    const tickColor = this._isDarkMode ? 0x444444 : 0x999999
    const gridColor = this._isDarkMode ? 0x333333 : 0xcccccc

    // Create labels, tick marks, and grid lines
    for (const { year } of this.data) {
      // Grid line (horizontal line across the screen)
      const gridLine = new Graphics()
      gridLine.moveTo(0, 0)
      gridLine.lineTo(this._screenWidth || 2000, 0)
      gridLine.stroke({ width: 1, color: gridColor, alpha: 0.3 })
      gridLine.label = `grid-${year}`
      gridLine.x = 0
      this.gridContainer.addChild(gridLine)

      // Background rectangle
      const bg = new Graphics()
      bg.roundRect(-4, -8, 42, 16, 3)
      bg.fill({ color: bgColor, alpha: bgAlpha })
      bg.x = AXIS_X + TICK_WIDTH + 6
      bg.label = `bg-${year}`
      this.container.addChild(bg)

      // Year label
      const label = new Text({ text: String(year), style: textStyle })
      label.anchor.set(0, 0.5)
      label.x = AXIS_X + TICK_WIDTH + 6
      label.label = `year-${year}`
      this.container.addChild(label)

      // Tick mark
      const tick = new Graphics()
      tick.moveTo(0, 0)
      tick.lineTo(TICK_WIDTH, 0)
      tick.stroke({ width: 1, color: tickColor })
      tick.label = `tick-${year}`
      tick.x = AXIS_X
      this.container.addChild(tick)
    }

    // Apply current visibility state immediately
    this.container.visible = this._visible
    this.container.alpha = this._visible ? 1 : 0
    this.container.x = this._visible ? 0 : -60
  }

  /**
   * Update label positions based on viewport transform
   */
  update(viewport: Viewport, screenHeight: number, screenWidth?: number) {
    if (this.data.length === 0) return

    // Update screen width if provided (for grid line length)
    if (screenWidth !== undefined && screenWidth !== this._screenWidth) {
      this._screenWidth = screenWidth
      this.updateGridLineWidth()
    }

    for (const { year, worldY } of this.data) {
      const screenY = viewport.toScreen(0, worldY).y
      const visible = screenY > -20 && screenY < screenHeight + 20 ? 1 : 0

      const label = this.container.getChildByLabel(`year-${year}`)
      const tick = this.container.getChildByLabel(`tick-${year}`)
      const bg = this.container.getChildByLabel(`bg-${year}`)
      const gridLine = this.gridContainer.getChildByLabel(`grid-${year}`)

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
      if (gridLine) {
        gridLine.y = screenY
        gridLine.alpha = visible
      }
    }
  }

  /**
   * Update grid line widths when screen size changes
   */
  private updateGridLineWidth() {
    const gridColor = this._isDarkMode ? 0x333333 : 0xcccccc

    for (const { year } of this.data) {
      const gridLine = this.gridContainer.getChildByLabel(`grid-${year}`) as Graphics
      if (gridLine) {
        gridLine.clear()
        gridLine.moveTo(0, 0)
        gridLine.lineTo(this._screenWidth, 0)
        gridLine.stroke({ width: 1, color: gridColor, alpha: 0.3 })
      }
    }
  }

  /**
   * Set dark/light mode and update styles
   */
  setDarkMode(isDark: boolean) {
    if (isDark === this._isDarkMode) return
    this._isDarkMode = isDark

    // If no data, just save state
    if (this.data.length === 0) return

    const textStyle = isDark ? DARK_TEXT_STYLE : LIGHT_TEXT_STYLE
    const bgColor = isDark ? 0x000000 : 0xffffff
    const bgAlpha = isDark ? 0.4 : 0.6
    const tickColor = isDark ? 0x444444 : 0x999999
    const gridColor = isDark ? 0x333333 : 0xcccccc

    // Update all elements
    for (const { year } of this.data) {
      const label = this.container.getChildByLabel(`year-${year}`) as Text
      const bg = this.container.getChildByLabel(`bg-${year}`) as Graphics
      const tick = this.container.getChildByLabel(`tick-${year}`) as Graphics
      const gridLine = this.gridContainer.getChildByLabel(`grid-${year}`) as Graphics

      if (label) {
        label.style = textStyle
      }
      if (bg) {
        bg.clear()
        bg.roundRect(-4, -8, 42, 16, 3)
        bg.fill({ color: bgColor, alpha: bgAlpha })
      }
      if (tick) {
        tick.clear()
        tick.moveTo(0, 0)
        tick.lineTo(TICK_WIDTH, 0)
        tick.stroke({ width: 1, color: tickColor })
      }
      if (gridLine) {
        gridLine.clear()
        gridLine.moveTo(0, 0)
        gridLine.lineTo(this._screenWidth || 2000, 0)
        gridLine.stroke({ width: 1, color: gridColor, alpha: 0.3 })
      }
    }
  }

  /**
   * Show or hide with slide animation
   */
  setVisible(visible: boolean, duration = 250) {
    if (visible === this._visible) return
    this._visible = visible

    // If not built yet, just update state
    if (this.data.length === 0) {
      this.container.visible = visible
      this.container.alpha = visible ? 1 : 0
      this.container.x = visible ? 0 : -60
      return
    }

    // Ensure visible during animation
    this.container.visible = true

    const startX = this.container.x
    const startAlpha = this.container.alpha
    const targetX = visible ? 0 : -60
    const targetAlpha = visible ? 1 : 0

    animateProgress(
      this.animationRunner,
      duration,
      easeOutCubic,
      (progress) => {
        this.container.x = startX + (targetX - startX) * progress
        this.container.alpha = startAlpha + (targetAlpha - startAlpha) * progress
      },
      () => {
        if (!visible) {
          this.container.visible = false
        }
      },
    )
  }

  get visible(): boolean {
    return this._visible
  }

  /**
   * Clear all data and elements
   */
  clear() {
    this.animationRunner.cancel()
    this.container.removeChildren()
    this.gridContainer = new Container()
    this.container.addChild(this.gridContainer)
    this.data = []
  }
}
