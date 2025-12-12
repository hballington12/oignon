// BatchedCurveMesh - renders multiple bezier curves in a single draw call
// Uses a data texture for per-curve progress values

import { Mesh, Geometry, Shader, GlProgram, UniformGroup, Matrix, Texture } from 'pixi.js'
import { buildBatchedCurveGeometry, type CurveData } from './BatchedCurveGeometry'
import { batchedCurveVertex, batchedCurveFragment } from './shaders/batchedCurve'

export interface BatchedCurveMeshOptions {
  curves: CurveData[]
  segments?: number
  defaultWidth?: number
  alpha?: number
}

export class BatchedCurveMesh extends Mesh<Geometry, Shader> {
  private curveUniforms: UniformGroup
  private localUniforms: UniformGroup
  private progressData: Uint8Array
  private progressTexture: Texture
  private _curveCount: number
  private textureWidth: number

  constructor(options: BatchedCurveMeshOptions) {
    const { curves, segments = 32, defaultWidth = 4, alpha = 0.1 } = options

    // Build batched geometry
    const geometryData = buildBatchedCurveGeometry(curves, segments, defaultWidth)

    // Create geometry with custom attributes
    const geometry = new Geometry({
      attributes: {
        aPosition: {
          buffer: geometryData.positions,
          format: 'float32x2',
          stride: 2 * 4,
          offset: 0,
        },
        aUV: {
          buffer: geometryData.uvs,
          format: 'float32x2',
          stride: 2 * 4,
          offset: 0,
        },
        aCurveIndex: {
          buffer: geometryData.curveIndices,
          format: 'float32',
          stride: 4,
          offset: 0,
        },
      },
      indexBuffer: geometryData.indices,
    })

    // Create progress data texture using Uint8 RGBA
    // Progress is stored in red channel as 0-255 (mapped to 0-1 in shader)
    const textureWidth = Math.max(1, nextPowerOf2(geometryData.curveCount))
    const progressData = new Uint8Array(textureWidth * 4) // RGBA, one pixel per curve

    // Create texture from raw data using canvas as intermediary
    const canvas = document.createElement('canvas')
    canvas.width = textureWidth
    canvas.height = 1
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(textureWidth, 1)

    // Initialize with 0 progress (will be updated later)
    for (let i = 0; i < textureWidth; i++) {
      imageData.data[i * 4] = 0 // R = progress
      imageData.data[i * 4 + 1] = 0 // G
      imageData.data[i * 4 + 2] = 0 // B
      imageData.data[i * 4 + 3] = 255 // A = fully opaque
    }
    ctx.putImageData(imageData, 0, 0)

    const progressTexture = Texture.from({
      resource: canvas,
      autoGenerateMipmaps: false,
      scaleMode: 'nearest',
    })

    // Curve uniforms
    const curveUniforms = new UniformGroup({
      uAlpha: { value: alpha, type: 'f32' },
      uProgressTextureWidth: { value: textureWidth, type: 'f32' },
    })

    // Local transform uniforms
    const localUniforms = new UniformGroup({
      uTransformMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
    })

    // Create GL program
    const glProgram = new GlProgram({
      vertex: batchedCurveVertex,
      fragment: batchedCurveFragment,
      name: 'batched-curve-shader',
    })

    // Create shader
    const shader = new Shader({
      glProgram,
      resources: {
        curveUniforms,
        localUniforms,
        uProgressTexture: progressTexture.source,
      },
    })

    super({ geometry, shader })

    this.blendMode = 'normal'

    this.curveUniforms = curveUniforms
    this.localUniforms = localUniforms
    this.progressData = progressData
    this.progressTexture = progressTexture
    this._curveCount = geometryData.curveCount
    this.textureWidth = textureWidth

    // Store canvas for updates
    ;(this as any)._canvas = canvas
    ;(this as any)._ctx = ctx
  }

  get curveCount(): number {
    return this._curveCount
  }

  /**
   * Set progress for a specific curve (0-1)
   */
  setProgress(curveIndex: number, progress: number) {
    if (curveIndex < 0 || curveIndex >= this._curveCount) return
    // Store as 0-255 in red channel
    this.progressData[curveIndex * 4] = Math.floor(Math.max(0, Math.min(1, progress)) * 255)
  }

  /**
   * Set progress for all curves at once
   */
  setAllProgress(progress: number) {
    const value = Math.floor(Math.max(0, Math.min(1, progress)) * 255)
    for (let i = 0; i < this._curveCount; i++) {
      this.progressData[i * 4] = value
    }
  }

  /**
   * Set progress from an array (one value per curve)
   */
  setProgressArray(values: number[]) {
    const count = Math.min(values.length, this._curveCount)
    for (let i = 0; i < count; i++) {
      this.progressData[i * 4] = Math.floor(Math.max(0, Math.min(1, values[i] ?? 0)) * 255)
    }
  }

  /**
   * Upload progress data to GPU - call this after modifying progress values
   */
  updateProgress() {
    const canvas = (this as any)._canvas as HTMLCanvasElement
    const ctx = (this as any)._ctx as CanvasRenderingContext2D

    const imageData = ctx.createImageData(this.textureWidth, 1)
    for (let i = 0; i < this.textureWidth; i++) {
      imageData.data[i * 4] = this.progressData[i * 4] ?? 0 // R = progress
      imageData.data[i * 4 + 1] = 0
      imageData.data[i * 4 + 2] = 0
      imageData.data[i * 4 + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)

    this.progressTexture.source.update()
  }

  /**
   * Set the alpha value for curve rendering (0-1)
   * Lower values create more subtle curves that accumulate with overlap
   */
  setAlpha(alpha: number) {
    this.curveUniforms.uniforms.uAlpha = Math.max(0, Math.min(1, alpha))
  }

  destroy(options?: boolean | { children?: boolean; texture?: boolean; textureSource?: boolean }) {
    this.progressTexture.destroy(true)
    super.destroy(options)
  }
}

function nextPowerOf2(n: number): number {
  if (n <= 1) return 1
  return Math.pow(2, Math.ceil(Math.log2(n)))
}
