import type { Ease } from '../anim/easing'
import type { AnimProperty, Keyframe, Track, TrackValue, Vec3 } from '../anim/types'

export const k = (t: number, v: TrackValue, ease: Ease = 'standard'): Keyframe => ({ t, v, ease })

export function track(target: string, property: AnimProperty, keys: Keyframe[], path?: string): Track {
  return { id: path ? `${target}.${property}.${path}` : `${target}.${property}`, target, property, keys, path }
}

/** Shorthand for a `custom` channel such as kiosk.doorOpen or kiosk.screenState. */
export const custom = (target: string, path: string, keys: Keyframe[]) => track(target, 'custom', keys, path)

/** Hold a value, then switch — used for discrete states (screen pages, clip names). */
export const steps = (pairs: Array<[number, TrackValue]>): Keyframe[] => pairs.map(([t, v]) => ({ t, v, ease: 'linear' as const }))

/**
 * Camera placement helper. Returns a position `dist` metres from `target`, rotated
 * `yaw` degrees around it (0 = straight in front of the kiosk face, positive = to the
 * viewer's right) and raised `pitch` degrees above it.
 */
export function shot(target: Vec3, dist: number, yaw: number, pitch: number): Vec3 {
  const y = (yaw * Math.PI) / 180
  const p = (pitch * Math.PI) / 180
  return [
    target[0] + dist * Math.cos(p) * Math.sin(y),
    target[1] + dist * Math.sin(p),
    target[2] + dist * Math.cos(p) * Math.cos(y),
  ]
}

/** Shot-size presets in metres from the subject. */
export const DIST = { wide: 15.0, full: 7.6, mid: 4.6, close: 3.0, macro: 2.0 }

/** Reference lens. The Figma frame reads as a long lens on a 1080x683 card. */
export const FOV = 22
