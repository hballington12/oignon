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

const TEXT_STYLE = new TextStyle({
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

/**
 * Renders a year axis overlay on the left side of the screen
 * Shows year labels that stay fixed horizontally but scroll with the viewport vertically
 */
export class YearAxisOverlay {
  readonly container: Container
  private data: YearAxisEntry[] = []
  private animationRunner = new AnimationRunner()
  private _visible = true

  constructor() {
    this.container = new Container()
  }

  /**
   * Build axis from orderToRow mapping (year -> grid row)
   */
  build(orderToRow: Record<number, number>) {
    this.container.removeChildren()
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

    // Create labels and tick marks
    for (const { year } of this.data) {
      // Background rectangle
      const bg = new Graphics()
      bg.roundRect(-4, -8, 42, 16, 3)
      bg.fill({ color: 0x000000, alpha: 0.4 })
      bg.x = AXIS_X + TICK_WIDTH + 6
      bg.label = `bg-${year}`
      this.container.addChild(bg)

      // Year label
      const label = new Text({ text: String(year), style: TEXT_STYLE })
      label.anchor.set(0, 0.5)
      label.x = AXIS_X + TICK_WIDTH + 6
      label.label = `year-${year}`
      this.container.addChild(label)

      // Tick mark
      const tick = new Graphics()
      tick.moveTo(0, 0)
      tick.lineTo(TICK_WIDTH, 0)
      tick.stroke({ width: 1, color: 0x444444 })
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
  update(viewport: Viewport, screenHeight: number) {
    if (this.data.length === 0) return

    for (const { year, worldY } of this.data) {
      const screenY = viewport.toScreen(0, worldY).y
      const visible = screenY > -20 && screenY < screenHeight + 20 ? 1 : 0

      const label = this.container.getChildByLabel(`year-${year}`)
      const tick = this.container.getChildByLabel(`tick-${year}`)
      const bg = this.container.getChildByLabel(`bg-${year}`)

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
    this.data = []
  }
}
