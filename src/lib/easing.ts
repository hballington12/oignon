/**
 * Easing functions for animations
 * See https://easings.net for visualizations
 */

/** Slow start, fast middle, slow end */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Elastic bounce effect - great for pop-in animations */
export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t
  return 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * ((2 * Math.PI) / 3))
}

/** Quadratic ease-out - decelerating from start */
export function easeOutQuad(t: number): number {
  return 1 - Math.pow(1 - t, 2)
}

/** Cubic ease-out - smoother deceleration than quad */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
