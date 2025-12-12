// CurveMesh - a bezier curve ribbon with animated drawing via shader
// Compatible with PixiJS v8

import { Mesh, MeshGeometry, Shader, GlProgram, UniformGroup, Matrix } from 'pixi.js'
import { buildCurveGeometry } from './CurveGeometry'
import { curveVertex, curveFragment } from './shaders/curve'
import type { Point } from './bezier'

export interface CurveMeshOptions {
  start: Point
  cp1: Point
  cp2: Point
  end: Point
  width?: number | ((t: number) => number)
  segments?: number
  color?: number
  alpha?: number
}

export class CurveMesh extends Mesh<MeshGeometry, Shader> {
  private curveUniforms: UniformGroup
  private localUniforms: UniformGroup

  constructor(options: CurveMeshOptions) {
    const { start, cp1, cp2, end, width = 4, segments = 32, color = 0xffffff, alpha = 1 } = options

    // Build geometry
    const { positions, uvs, indices } = buildCurveGeometry(start, cp1, cp2, end, width, segments)

    const geometry = new MeshGeometry({
      positions,
      uvs,
      indices,
    })

    // Convert hex color to RGBA floats
    const r = ((color >> 16) & 0xff) / 255
    const g = ((color >> 8) & 0xff) / 255
    const b = (color & 0xff) / 255

    // Curve-specific uniforms (progress and color)
    const curveUniforms = new UniformGroup({
      uProgress: { value: 0, type: 'f32' },
      uColor: { value: new Float32Array([r, g, b, alpha]), type: 'vec4<f32>' },
    })

    // Local transform uniforms (identity by default, set by renderer)
    const localUniforms = new UniformGroup({
      uTransformMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
    })

    // Create GL program
    const glProgram = new GlProgram({
      vertex: curveVertex,
      fragment: curveFragment,
      name: 'curve-shader',
    })

    // Create shader with resources
    const shader = new Shader({
      glProgram,
      resources: {
        curveUniforms,
        localUniforms,
      },
    })

    super({ geometry, shader })

    this.curveUniforms = curveUniforms
    this.localUniforms = localUniforms
  }

  get progress(): number {
    return this.curveUniforms.uniforms.uProgress as number
  }

  set progress(value: number) {
    this.curveUniforms.uniforms.uProgress = Math.max(0, Math.min(1, value))
  }

  setColor(color: number) {
    const r = ((color >> 16) & 0xff) / 255
    const g = ((color >> 8) & 0xff) / 255
    const b = (color & 0xff) / 255
    const colorArray = this.curveUniforms.uniforms.uColor as Float32Array
    colorArray[0] = r
    colorArray[1] = g
    colorArray[2] = b
  }

  setAlpha(alpha: number) {
    const colorArray = this.curveUniforms.uniforms.uColor as Float32Array
    colorArray[3] = alpha
  }
}
