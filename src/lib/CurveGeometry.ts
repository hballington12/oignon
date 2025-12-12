// Builds triangle strip geometry from a bezier curve
// Each vertex includes position and UV (where U = progress along curve)

import type { Point } from './bezier'

export interface CurveGeometryData {
  positions: Float32Array
  uvs: Float32Array
  indices: Uint32Array
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

  // Derivative of cubic bezier
  const x = 3 * mt2 * (cp1.x - p0.x) + 6 * mt * t * (cp2.x - cp1.x) + 3 * t2 * (p3.x - cp2.x)
  const y = 3 * mt2 * (cp1.y - p0.y) + 6 * mt * t * (cp2.y - cp1.y) + 3 * t2 * (p3.y - cp2.y)

  return { x, y }
}

// Normalize a vector
function normalize(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y)
  if (len === 0) return { x: 0, y: 1 }
  return { x: v.x / len, y: v.y / len }
}

// Get perpendicular (normal) to a vector
function perpendicular(v: Point): Point {
  return { x: -v.y, y: v.x }
}

/**
 * Build geometry for a bezier curve ribbon
 *
 * @param start - Start point of curve
 * @param cp1 - First control point
 * @param cp2 - Second control point
 * @param end - End point of curve
 * @param width - Width of ribbon (can be number or function of t)
 * @param segments - Number of segments to divide curve into
 */
export function buildCurveGeometry(
  start: Point,
  cp1: Point,
  cp2: Point,
  end: Point,
  width: number | ((t: number) => number) = 4,
  segments = 32,
): CurveGeometryData {
  const getWidth = typeof width === 'function' ? width : () => width

  // Each segment has 2 vertices (left and right edge of ribbon)
  const vertexCount = (segments + 1) * 2
  const positions = new Float32Array(vertexCount * 2)
  const uvs = new Float32Array(vertexCount * 2)

  // Build vertices along the curve
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const point = sampleBezier(start, cp1, cp2, end, t)
    const tangent = sampleBezierTangent(start, cp1, cp2, end, t)
    const normal = perpendicular(normalize(tangent))
    const halfWidth = getWidth(t) / 2

    // Left vertex
    const leftIdx = i * 4
    positions[leftIdx] = point.x - normal.x * halfWidth
    positions[leftIdx + 1] = point.y - normal.y * halfWidth
    uvs[leftIdx] = t      // U = progress along curve
    uvs[leftIdx + 1] = 0  // V = left edge

    // Right vertex
    const rightIdx = i * 4 + 2
    positions[rightIdx] = point.x + normal.x * halfWidth
    positions[rightIdx + 1] = point.y + normal.y * halfWidth
    uvs[rightIdx] = t     // U = progress along curve
    uvs[rightIdx + 1] = 1 // V = right edge
  }

  // Build triangle indices (triangle strip as indexed triangles)
  const triangleCount = segments * 2
  const indices = new Uint32Array(triangleCount * 3)

  for (let i = 0; i < segments; i++) {
    const baseVertex = i * 2
    const baseIndex = i * 6

    // First triangle: bottom-left, bottom-right, top-left
    indices[baseIndex] = baseVertex
    indices[baseIndex + 1] = baseVertex + 1
    indices[baseIndex + 2] = baseVertex + 2

    // Second triangle: bottom-right, top-right, top-left
    indices[baseIndex + 3] = baseVertex + 1
    indices[baseIndex + 4] = baseVertex + 3
    indices[baseIndex + 5] = baseVertex + 2
  }

  return { positions, uvs, indices }
}
