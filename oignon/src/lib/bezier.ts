// Bezier curve utilities

export interface Point {
  x: number
  y: number
}

export function sampleBezierMinX(p0: Point, p1: Point, p2: Point, p3: Point, samples = 20): number {
  let minX = Math.min(p0.x, p3.x)
  for (let i = 1; i < samples; i++) {
    const t = i / samples
    const mt = 1 - t
    const x =
      mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x
    minX = Math.min(minX, x)
  }
  return minX
}

export function sampleBezierMinY(p0: Point, p1: Point, p2: Point, p3: Point, samples = 20): number {
  let minY = Math.min(p0.y, p3.y)
  for (let i = 1; i < samples; i++) {
    const t = i / samples
    const mt = 1 - t
    const y =
      mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
    minY = Math.min(minY, y)
  }
  return minY
}

export interface RotationHelpers {
  cosR: number
  sinR: number
  rotateBack: (p: Point) => Point
}

export function createRotationHelpers(
  angleDegrees: number,
  originX: number,
  originY: number,
): RotationHelpers {
  const rotAngle = (-angleDegrees * Math.PI) / 180
  const cosR = Math.cos(rotAngle)
  const sinR = Math.sin(rotAngle)
  const cosBack = Math.cos(-rotAngle)
  const sinBack = Math.sin(-rotAngle)

  return {
    cosR,
    sinR,
    rotateBack: (p: Point) => ({
      x: p.x * cosBack - p.y * sinBack + originX,
      y: p.x * sinBack + p.y * cosBack + originY,
    }),
  }
}

export interface ControlPoints {
  cp1: Point
  cp2: Point
  end: Point
}

export function calcRotatedControlPoints(
  rotX: number,
  rotY: number,
  cp1xFactor: number,
  cp1yFactor: number,
  cp2xFactor: number,
  cp2yFactor: number,
): ControlPoints {
  return {
    cp1: { x: rotX * cp1xFactor, y: rotY * cp1yFactor },
    cp2: { x: rotX * cp2xFactor, y: rotY * cp2yFactor },
    end: { x: rotX, y: rotY },
  }
}

// Linear interpolation between two points
function lerp(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }
}

// Subdivided bezier curve (first segment only, up to parameter t)
export interface SubdividedBezier {
  p0: Point
  cp1: Point
  cp2: Point
  p3: Point
}

/**
 * De Casteljau subdivision - returns the first segment of a bezier curve
 * split at parameter t. This gives exact bezier control points for the
 * partial curve, allowing native bezierCurveTo() instead of line segments.
 */
export function subdivideBezier(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
  t: number,
): SubdividedBezier {
  // First level
  const q0 = lerp(p0, cp1, t)
  const q1 = lerp(cp1, cp2, t)
  const q2 = lerp(cp2, p3, t)

  // Second level
  const r0 = lerp(q0, q1, t)
  const r1 = lerp(q1, q2, t)

  // Third level - the split point
  const splitPoint = lerp(r0, r1, t)

  // Return first segment: p0 -> q0 -> r0 -> splitPoint
  return {
    p0,
    cp1: q0,
    cp2: r0,
    p3: splitPoint,
  }
}
