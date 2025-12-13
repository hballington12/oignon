import {
  Container,
  Graphics,
  Sprite,
  Texture,
  BlurFilter,
  Rectangle,
  type Application,
  type Filter,
} from 'pixi.js'

// Simple value noise - less fancy than simplex but bulletproof
class ValueNoise {
  private values: number[] = []

  constructor(seed = Math.random() * 65536) {
    // Generate 256 random values using seeded PRNG
    let s = seed
    for (let i = 0; i < 256; i++) {
      s = (s * 16807) % 2147483647
      this.values[i] = (s / 2147483647) * 2 - 1 // Range [-1, 1]
    }
  }

  private hash(x: number, y: number): number {
    const xi = Math.floor(x) & 255
    const yi = Math.floor(y) & 255
    return this.values[(xi + yi * 37) & 255]!
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t)
  }

  noise2D(x: number, y: number): number {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi

    const sx = this.smoothstep(xf)
    const sy = this.smoothstep(yf)

    // Get values at four corners
    const n00 = this.hash(xi, yi)
    const n10 = this.hash(xi + 1, yi)
    const n01 = this.hash(xi, yi + 1)
    const n11 = this.hash(xi + 1, yi + 1)

    // Bilinear interpolation
    const nx0 = n00 + sx * (n10 - n00)
    const nx1 = n01 + sx * (n11 - n01)
    return nx0 + sy * (nx1 - nx0)
  }
}

interface Particle {
  sprite: Sprite
  baseX: number
  baseY: number
  noiseOffsetX: number
  noiseOffsetY: number
  rotationSpeed: number
  size: number
  alpha: number
  age: number // Current age in frames
  lifetime: number // Total lifetime in frames
}

export interface ParticleSystemOptions {
  count?: number
  minSize?: number
  maxSize?: number
  drift?: number // How far particles drift from base position
  speed?: number // How fast particles move
  alpha?: number // Base alpha for particles
  color?: number // Tint color
  minLifetime?: number // Min lifetime in seconds
  maxLifetime?: number // Max lifetime in seconds
  fadeRatio?: number // Portion of lifetime spent fading in/out (0-0.5)
  blur?: number // Blur strength baked into texture (0 = no blur)
}

const DEFAULT_OPTIONS: Required<ParticleSystemOptions> = {
  count: 30,
  minSize: 4,
  maxSize: 10,
  drift: 40,
  speed: 0.002,
  alpha: 0.15,
  color: 0xffffff,
  minLifetime: 25,
  maxLifetime: 50,
  fadeRatio: 0.2,
  blur: 20,
}

export class ParticleSystem {
  container: Container
  private particles: Particle[] = []
  private hexTexture: Texture | null = null
  private noise: ValueNoise
  private time = 0
  private animationId = 0
  private options: Required<ParticleSystemOptions>
  private worldWidth = 0
  private worldHeight = 0

  constructor(options: ParticleSystemOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.container = new Container()
    this.noise = new ValueNoise()
  }

  init(app: Application, worldWidth: number, worldHeight: number) {
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight

    // Build filters array for texture
    const filters: Filter[] = []
    if (this.options.blur > 0) {
      filters.push(new BlurFilter({ strength: this.options.blur }))
    }

    this.createHexTexture(app, filters.length > 0 ? filters : undefined)
    this.spawnParticles()
    this.startAnimation()
  }

  private createHexTexture(app: Application, filters?: Filter[]) {
    const radius = 16 // Base size, will be scaled per particle
    // Blur needs padding proportional to strength
    const padding = this.options.blur > 0 ? Math.ceil(this.options.blur * 4) + 8 : 0
    const size = (radius + padding) * 2

    const graphics = new Graphics()

    // Draw hexagon centered
    const cx = size / 2
    const cy = size / 2

    graphics.moveTo(cx + radius, cy)
    for (let i = 1; i <= 6; i++) {
      const angle = (i * Math.PI) / 3
      graphics.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
    }
    graphics.closePath()
    graphics.fill({ color: 0xffffff, alpha: 1 })

    // Apply filters before generating texture
    if (filters && filters.length > 0) {
      graphics.filters = filters
    }

    // Explicitly set the texture region to include padding for blur
    this.hexTexture = app.renderer.generateTexture({
      target: graphics,
      frame: new Rectangle(0, 0, size, size),
      resolution: window.devicePixelRatio || 1,
    })
    graphics.destroy()
  }

  private spawnParticles() {
    const { count } = this.options

    for (let i = 0; i < count; i++) {
      // Stagger initial ages so particles don't all die at once
      const initialAge = Math.random()
      this.spawnParticle(initialAge)
    }
  }

  private spawnParticle(initialAgeRatio = 0) {
    const { minSize, maxSize, alpha, color, minLifetime, maxLifetime } = this.options

    const sprite = new Sprite(this.hexTexture!)
    sprite.anchor.set(0.5)

    // Random position across the world
    const baseX = Math.random() * this.worldWidth
    const baseY = Math.random() * this.worldHeight

    // Random size
    const size = minSize + Math.random() * (maxSize - minSize)
    const scale = size / 16 // 16 is base texture radius
    sprite.scale.set(scale)

    // Random rotation
    sprite.rotation = Math.random() * Math.PI * 2

    // Random alpha variation (base alpha, will be modulated by lifetime)
    const particleAlpha = alpha * (0.5 + Math.random() * 0.5)
    sprite.alpha = 0 // Start invisible, will fade in

    // Tint
    sprite.tint = color

    // Position
    sprite.x = baseX
    sprite.y = baseY

    // Lifetime in frames (60fps assumed)
    const lifetimeSeconds = minLifetime + Math.random() * (maxLifetime - minLifetime)
    const lifetime = Math.floor(lifetimeSeconds * 60)
    const age = Math.floor(initialAgeRatio * lifetime)

    this.container.addChild(sprite)

    this.particles.push({
      sprite,
      baseX,
      baseY,
      noiseOffsetX: Math.random() * 1000,
      noiseOffsetY: Math.random() * 1000,
      rotationSpeed: (Math.random() - 0.5) * 0.002,
      size,
      alpha: particleAlpha,
      age,
      lifetime,
    })
  }

  private respawnParticle(particle: Particle) {
    const { minSize, maxSize, alpha, color, minLifetime, maxLifetime } = this.options

    // New random position
    particle.baseX = Math.random() * this.worldWidth
    particle.baseY = Math.random() * this.worldHeight

    // New size
    particle.size = minSize + Math.random() * (maxSize - minSize)
    const scale = particle.size / 16
    particle.sprite.scale.set(scale)

    // New alpha
    particle.alpha = alpha * (0.5 + Math.random() * 0.5)
    particle.sprite.alpha = 0

    // New rotation
    particle.sprite.rotation = Math.random() * Math.PI * 2
    particle.rotationSpeed = (Math.random() - 0.5) * 0.002

    // New noise offsets for different movement path
    particle.noiseOffsetX = Math.random() * 1000
    particle.noiseOffsetY = Math.random() * 1000

    // New lifetime
    const lifetimeSeconds = minLifetime + Math.random() * (maxLifetime - minLifetime)
    particle.lifetime = Math.floor(lifetimeSeconds * 60)
    particle.age = 0

    // Tint (in case it changed)
    particle.sprite.tint = color
  }

  private startAnimation() {
    this.animationId++
    const currentId = this.animationId

    const animate = () => {
      if (currentId !== this.animationId) return

      this.time += 1
      this.updateParticles()
      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }

  private updateParticles() {
    const { drift, speed, fadeRatio } = this.options
    const t = this.time * speed

    for (const particle of this.particles) {
      // Age the particle
      particle.age++

      // Check if particle should respawn
      if (particle.age >= particle.lifetime) {
        this.respawnParticle(particle)
        continue
      }

      // Calculate fade based on age
      const lifeProgress = particle.age / particle.lifetime
      let fadeMult = 1

      if (lifeProgress < fadeRatio) {
        // Fading in
        fadeMult = lifeProgress / fadeRatio
      } else if (lifeProgress > 1 - fadeRatio) {
        // Fading out
        fadeMult = (1 - lifeProgress) / fadeRatio
      }

      particle.sprite.alpha = particle.alpha * fadeMult

      // Sample noise at particle's unique offset + time
      // Use different axes for X and Y movement to get more organic paths
      const noiseX = this.noise.noise2D(particle.noiseOffsetX + t, particle.noiseOffsetY + t * 0.7)
      const noiseY = this.noise.noise2D(particle.noiseOffsetX + t * 0.7, particle.noiseOffsetY + t)

      // Apply drift based on noise
      particle.sprite.x = particle.baseX + noiseX * drift
      particle.sprite.y = particle.baseY + noiseY * drift

      // Gentle rotation
      particle.sprite.rotation += particle.rotationSpeed
    }
  }

  /**
   * Update world bounds and redistribute particles
   */
  resize(worldWidth: number, worldHeight: number) {
    for (const particle of this.particles) {
      particle.baseX = Math.random() * worldWidth
      particle.baseY = Math.random() * worldHeight
      particle.sprite.x = particle.baseX
      particle.sprite.y = particle.baseY
    }
  }

  /**
   * Update options dynamically
   */
  setOptions(options: Partial<ParticleSystemOptions>) {
    if (options.alpha !== undefined) {
      for (const particle of this.particles) {
        const ratio = particle.alpha / this.options.alpha
        particle.alpha = options.alpha * ratio
        particle.sprite.alpha = particle.alpha
      }
    }

    if (options.color !== undefined) {
      for (const particle of this.particles) {
        particle.sprite.tint = options.color
      }
    }

    Object.assign(this.options, options)
  }

  destroy() {
    this.animationId++ // Stop animation
    this.container.removeChildren()
    this.particles = []
    this.hexTexture?.destroy(true)
    this.hexTexture = null
  }
}
