// Curve positioning module
// Calculates bezier control points for citation curves with angle-based swooping

import type { Point } from './bezier'

// Curve shape parameters
export interface CurveParams {
  bulge: number // 0-1, how much curves bulge outward
  tail: number // 0-1, how the curve tapers at the end
  density: number // 0-1, affects fill alpha/thickness
}

// Default curve parameters
export const DEFAULT_CURVE_PARAMS: CurveParams = {
  bulge: 0.8,
  tail: 0.15,
  density: 0.2,
}

// Curve direction angle in degrees
export const CURVE_ANGLE = 30

// Control point Y-position ranges (normalized along curve)
const CP1Y_RANGE = { min: -0.1, max: 0.1 }
const CP2Y_RANGE = { min: 0.4, max: 0.6 }

// Derived values from params
function getCp1x(params: CurveParams): number {
  return params.bulge * 2
}

function getCp2x(params: CurveParams): number {
  return 1.0 - params.tail * 0.5
}

function getDensity(params: CurveParams): number {
  return params.density * 0.75
}

function getInnerBulgeFactor(params: CurveParams): number {
  return 1 - getDensity(params)
}

// Rotation helpers for angle-based curve positioning
interface RotationHelpers {
  cosR: number
  sinR: number
  rotateBack: (p: Point) => Point
}

function createRotationHelpers(
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

// Calculate rotated control points with given factors
function calcRotatedControlPoints(
  rotX: number,
  rotY: number,
  cp1xFactor: number,
  cp1yFactor: number,
  cp2xFactor: number,
  cp2yFactor: number,
): { cp1: Point; cp2: Point; end: Point } {
  return {
    cp1: { x: rotX * cp1xFactor, y: rotY * cp1yFactor },
    cp2: { x: rotX * cp2xFactor, y: rotY * cp2yFactor },
    end: { x: rotX, y: rotY },
  }
}

// Output of curve calculation - just start, cp1, cp2, end for our ribbon geometry
export interface CurveControlPoints {
  start: Point
  cp1: Point
  cp2: Point
  end: Point
}

/**
 * Calculate bezier control points for a curve from source to target
 *
 * @param source - Source node position
 * @param target - Target node position
 * @param angle - Curve angle in degrees (positive = left, negative = right)
 * @param t - Interpolation factor for control point spread (0-1, based on curve index in group)
 * @param params - Curve shape parameters
 */
export function calculateCurveControlPoints(
  source: Point,
  target: Point,
  angle: number = CURVE_ANGLE,
  t: number = 0.5,
  params: CurveParams = DEFAULT_CURVE_PARAMS,
): CurveControlPoints {
  const { cosR, sinR, rotateBack } = createRotationHelpers(angle, source.x, source.y)

  // Get relative position and rotate into curve space
  const relX = target.x - source.x
  const relY = target.y - source.y
  const rotX = relX * cosR - relY * sinR
  const rotY = relX * sinR + relY * cosR

  // Calculate Y factors based on t (spreads curves within a group)
  const cp1y = CP1Y_RANGE.min + t * (CP1Y_RANGE.max - CP1Y_RANGE.min)
  const cp2y = CP2Y_RANGE.min + t * (CP2Y_RANGE.max - CP2Y_RANGE.min)

  // Calculate outer curve control points
  const outer = calcRotatedControlPoints(rotX, rotY, getCp1x(params), cp1y, getCp2x(params), cp2y)

  // Rotate back to world space
  return {
    start: source,
    cp1: rotateBack(outer.cp1),
    cp2: rotateBack(outer.cp2),
    end: rotateBack(outer.end),
  }
}

/**
 * Simple curve calculation without angle rotation
 * Uses basic dx/dy factors for control points
 */
export function calculateSimpleCurveControlPoints(
  source: Point,
  target: Point,
): CurveControlPoints {
  const dx = target.x - source.x
  const dy = target.y - source.y

  return {
    start: source,
    cp1: { x: source.x + dx * 0.3, y: source.y + dy * 0.1 },
    cp2: { x: target.x - dx * 0.3, y: target.y - dy * 0.1 },
    end: target,
  }
}

// Draw direction for curve groups
export type DrawDirection = 'left' | 'right' | 'symmetric'

// Strategy for determining draw direction
export type DrawDirectionStrategy = 'alternating' | 'symmetric' | 'random' | 'uniform'

/**
 * Get curve angle(s) for a draw direction
 */
export function getAnglesForDirection(direction: DrawDirection): number[] {
  switch (direction) {
    case 'left':
      return [CURVE_ANGLE]
    case 'right':
      return [-CURVE_ANGLE]
    case 'symmetric':
      return [CURVE_ANGLE, -CURVE_ANGLE]
  }
}

// Seeded random for deterministic "random" direction
function seededRandom(x: number, y: number, seed: number): number {
  const hash = (x * 73856093) ^ (y * 19349663) ^ seed
  return ((hash * 16807) % 2147483647) / 2147483647
}

export interface NodePosition {
  gridX: number
  gridY: number
  isSource?: boolean
}

/**
 * Determine draw direction for a node based on strategy and grid position
 */
export function getNodeDrawDirection(
  node: NodePosition,
  gridCols: number,
  strategy: DrawDirectionStrategy = 'alternating',
  randomSeed: number = 12345,
): DrawDirection {
  // Source nodes always symmetric
  if (node.isSource) {
    return 'symmetric'
  }

  const gridCenter = gridCols / 2

  switch (strategy) {
    case 'uniform':
      // All nodes draw symmetrically
      return 'symmetric'

    case 'symmetric':
      // Based on position relative to center
      if (node.gridX < gridCenter) return 'left'
      if (node.gridX > gridCenter) return 'right'
      return 'symmetric'

    case 'random':
      // Seeded random for deterministic results
      const rand = seededRandom(node.gridX, node.gridY, randomSeed)
      if (rand < 0.33) return 'left'
      if (rand < 0.66) return 'right'
      return 'symmetric'

    case 'alternating':
    default:
      // Left/right of center, center column alternates by row
      if (node.gridX < gridCenter) return 'left'
      if (node.gridX > gridCenter) return 'right'
      return node.gridY % 2 === 0 ? 'right' : 'left'
  }
}
