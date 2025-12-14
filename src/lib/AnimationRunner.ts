/**
 * Manages cancelable requestAnimationFrame loops
 * Provides a consistent pattern for animations that need to be cancelled/restarted
 */
export class AnimationRunner {
  private animationId = 0

  /**
   * Start a new animation, cancelling any previous one
   * @param tick - Called each frame with elapsed time (ms). Return false to stop.
   * @param onComplete - Called when animation completes (tick returns false)
   */
  start(tick: (elapsed: number) => boolean, onComplete?: () => void) {
    this.animationId++
    const currentId = this.animationId
    const startTime = performance.now()

    const animate = () => {
      // Check if cancelled
      if (currentId !== this.animationId) return

      const elapsed = performance.now() - startTime
      const shouldContinue = tick(elapsed)

      if (shouldContinue) {
        requestAnimationFrame(animate)
      } else {
        onComplete?.()
      }
    }

    requestAnimationFrame(animate)
  }

  /**
   * Cancel the current animation
   */
  cancel() {
    this.animationId++
  }

  /**
   * Check if an animation is potentially running
   * (Note: can't know for certain since RAF is async)
   */
  get currentId(): number {
    return this.animationId
  }
}

/**
 * Simple progress-based animation helper
 * @param duration - Animation duration in ms
 * @param easing - Easing function to apply
 * @param onProgress - Called with eased progress (0-1)
 * @param onComplete - Called when animation finishes
 */
export function animateProgress(
  runner: AnimationRunner,
  duration: number,
  easing: (t: number) => number,
  onProgress: (progress: number) => void,
  onComplete?: () => void,
) {
  runner.start((elapsed) => {
    const rawProgress = Math.min(1, elapsed / duration)
    const easedProgress = easing(rawProgress)
    onProgress(easedProgress)
    return rawProgress < 1
  }, onComplete)
}
