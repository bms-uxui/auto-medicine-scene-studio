// Easing library. Curves follow motion-design conventions:
// entrances decelerate, exits accelerate, moves between states use standard.

export type Vec4 = [number, number, number, number]

export const EASE_PRESETS = {
  linear: [0, 0, 1, 1],
  standard: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
  emphasized: [0.2, 0, 0, 1],
  anticipate: [0.6, -0.28, 0.735, 0.045],
  overshoot: [0.34, 1.56, 0.64, 1],
  smooth: [0.45, 0, 0.55, 1],
} satisfies Record<string, Vec4>

export type EaseName = keyof typeof EASE_PRESETS
export type Ease = EaseName | Vec4

const NEWTON_ITERATIONS = 6
const EPSILON = 1e-6

function bezierComponent(t: number, a: number, b: number) {
  // cubic bezier with p0 = 0, p3 = 1
  const mt = 1 - t
  return 3 * mt * mt * t * a + 3 * mt * t * t * b + t * t * t
}

function bezierSlope(t: number, a: number, b: number) {
  const mt = 1 - t
  return 3 * mt * mt * a + 6 * mt * t * (b - a) + 3 * t * t * (1 - b)
}

/** Solve y for a cubic-bezier(x1,y1,x2,y2) curve at progress x in [0,1]. */
export function cubicBezier(ease: Ease, x: number): number {
  const [x1, y1, x2, y2] = typeof ease === 'string' ? EASE_PRESETS[ease] : ease
  if (x <= 0) return 0
  if (x >= 1) return 1
  if (x1 === y1 && x2 === y2) return x // linear

  let t = x
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const err = bezierComponent(t, x1, x2) - x
    if (Math.abs(err) < EPSILON) break
    const slope = bezierSlope(t, x1, x2)
    if (Math.abs(slope) < EPSILON) break
    t -= err / slope
  }
  return bezierComponent(t, y1, y2)
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Damped spring used for secondary motion (follow-through on hands, pills). */
export function springStep(current: number, velocity: number, target: number, dt: number, stiffness = 170, damping = 26) {
  const force = -stiffness * (current - target)
  const damper = -damping * velocity
  const v = velocity + ((force + damper) * dt)
  return { value: current + v * dt, velocity: v }
}
