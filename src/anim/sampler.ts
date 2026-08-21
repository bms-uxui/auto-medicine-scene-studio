import { cubicBezier, clamp01, lerp } from './easing'
import type { Keyframe, Track, TrackValue, Vec3 } from './types'

function isVec3(v: TrackValue): v is Vec3 {
  return Array.isArray(v) && v.length === 3
}

/** Value of a keyframe list at time t. Numbers and Vec3 interpolate, everything else steps. */
export function sampleKeys(keys: Keyframe[], t: number): TrackValue | undefined {
  if (keys.length === 0) return undefined
  if (t <= keys[0].t) return keys[0].v
  const last = keys[keys.length - 1]
  if (t >= last.t) return last.v

  let i = 0
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++
  const a = keys[i]
  const b = keys[i + 1]

  const span = b.t - a.t
  const raw = span <= 0 ? 1 : clamp01((t - a.t) / span)
  const p = cubicBezier(a.ease ?? 'standard', raw)

  if (typeof a.v === 'number' && typeof b.v === 'number') return lerp(a.v, b.v, p)
  if (isVec3(a.v) && isVec3(b.v)) {
    return [lerp(a.v[0], b.v[0], p), lerp(a.v[1], b.v[1], p), lerp(a.v[2], b.v[2], p)] as Vec3
  }
  return a.v
}

export interface SampledFrame {
  /** actorId -> property -> value */
  [target: string]: Record<string, TrackValue>
}

export function sampleScene(tracks: Track[], t: number): SampledFrame {
  const out: SampledFrame = {}
  for (const track of tracks) {
    if (track.muted) continue
    const v = sampleKeys(track.keys, t)
    if (v === undefined) continue
    const key = track.property === 'custom' && track.path ? `custom:${track.path}` : track.property
    ;(out[track.target] ??= {})[key] = v
  }
  return out
}

/** Total length implied by the keys, used when auto-fitting the timeline. */
export function tracksDuration(tracks: Track[]): number {
  let max = 0
  for (const track of tracks) {
    const last = track.keys[track.keys.length - 1]
    if (last && last.t > max) max = last.t
  }
  return max
}
