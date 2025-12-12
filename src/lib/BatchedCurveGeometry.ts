// Builds batched triangle strip geometry for multiple bezier curves
// Each vertex includes position, UV, and curve index for shader lookup

import type { Point } from './bezier'

export interface CurveData {
  start: Point
  cp1: Point
  cp2: Point
  end: Point
  width?: number
}

export interface BatchedCurveGeometryData {
  positions: Float32Array
  uvs: Float32Array
  curveIndices: Float32Array
  indices: Uint32Array
  curveCount: number
}

// Sample a cubic bezier at parameter t
function sampleBezier(p0: Point, cp1: Point, cp2: Point, p3: Point, t: number): Point {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t

  return {
    x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p3.y,
  }
}

// Get tangent (derivative) of cubic bezier at parameter t
function sampleBezierTangent(p0: Point, cp1: Point, cp2: Point, p3: Point, t: number): Point {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t

  const x = 3 * mt2 * (cp1.x - p0.x) + 6 * mt * t * (cp2.x - cp1.x) + 3 * t2 * (p3.x - cp2.x)
  const y = 3 * mt2 * (cp1.y - p0.y) + 6 * mt * t * (cp2.y - cp1.y) + 3 * t2 * (p3.y - cp2.y)

  return { x, y }
}

function normalize(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y)
  if (len === 0) return { x: 0, y: 1 }
  return { x: v.x / len, y: v.y / len }
}

function perpendicular(v: Point): Point {
  return { x: -v.y, y: v.x }
}

/**
 * Build batched geometry for multiple bezier curves
 * All curves are combined into a single geometry with curve index attribute
 */
export function buildBatchedCurveGeometry(
  curves: CurveData[],
  segments = 32,
  defaultWidth = 4,
): BatchedCurveGeometryData {
  const curveCount = curves.length
  if (curveCount === 0) {
    return {
      positions: new Float32Array(0),
      uvs: new Float32Array(0),
      curveIndices: new Float32Array(0),
      indices: new Uint32Array(0),
      curveCount: 0,
    }
  }

  // Each curve has (segments + 1) * 2 vertices
  const verticesPerCurve = (segments + 1) * 2
  const totalVertices = curveCount * verticesPerCurve

  // Each curve has segments * 2 triangles = segments * 6 indices
  const indicesPerCurve = segments * 6
  const totalIndices = curveCount * indicesPerCurve

  const positions = new Float32Array(totalVertices * 2)
  const uvs = new Float32Array(totalVertices * 2)
  const curveIndices = new Float32Array(totalVertices)
  const indices = new Uint32Array(totalIndices)

  let vertexOffset = 0
  let indexOffset = 0
  let baseVertex = 0

  for (let curveIdx = 0; curveIdx < curveCount; curveIdx++) {
    const curve = curves[curveIdx]!
    const { start, cp1, cp2, end } = curve
    const width = curve.width ?? defaultWidth

    // Build vertices for this curve
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const point = sampleBezier(start, cp1, cp2, end, t)
      const tangent = sampleBezierTangent(start, cp1, cp2, end, t)
      const normal = perpendicular(normalize(tangent))
      const halfWidth = width / 2

      // Left vertex
      const leftPosIdx = vertexOffset * 2
      positions[leftPosIdx] = point.x - normal.x * halfWidth
      positions[leftPosIdx + 1] = point.y - normal.y * halfWidth
      uvs[leftPosIdx] = t
      uvs[leftPosIdx + 1] = 0
      curveIndices[vertexOffset] = curveIdx

      vertexOffset++

      // Right vertex
      const rightPosIdx = vertexOffset * 2
      positions[rightPosIdx] = point.x + normal.x * halfWidth
      positions[rightPosIdx + 1] = point.y + normal.y * halfWidth
      uvs[rightPosIdx] = t
      uvs[rightPosIdx + 1] = 1
      curveIndices[vertexOffset] = curveIdx

      vertexOffset++
    }

    // Build indices for this curve
    for (let i = 0; i < segments; i++) {
      const v = baseVertex + i * 2

      // First triangle
      indices[indexOffset++] = v
      indices[indexOffset++] = v + 1
      indices[indexOffset++] = v + 2

      // Second triangle
      indices[indexOffset++] = v + 1
      indices[indexOffset++] = v + 3
      indices[indexOffset++] = v + 2
    }

    baseVertex += verticesPerCurve
  }

  return { positions, uvs, curveIndices, indices, curveCount }
}
