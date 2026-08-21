import type { Ease } from './easing'

export type Vec3 = [number, number, number]
export type TrackValue = number | Vec3 | boolean | string

export interface Keyframe<T extends TrackValue = TrackValue> {
  /** seconds from scene start */
  t: number
  v: T
  /** easing applied on the segment that STARTS at this key */
  ease?: Ease
}

/** Properties an actor can expose to the timeline. */
export type AnimProperty =
  | 'position'
  | 'rotation'
  | 'scale'
  | 'opacity'
  | 'visible'
  | 'clip'
  | 'clipTime'
  | 'reach'
  | 'custom'

export interface Track {
  id: string
  /** actor id, or 'camera' / 'target' for the camera rig */
  target: string
  property: AnimProperty
  /** for property 'custom', the dotted path applied on the actor's userData */
  path?: string
  keys: Keyframe[]
  muted?: boolean
}

export type ActorKind = 'kiosk' | 'character' | 'sprite' | 'puppet' | 'staff' | 'prop' | 'overlay'

export interface ActorDef {
  id: string
  kind: ActorKind
  label: string
  /** model url for kind 'character' | 'prop' */
  url?: string
  /** prop primitive when no url: 'medicineBox' | 'sticker' | 'phone' | 'qrCard' | 'scanner' */
  primitive?: string
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3 | number
  visible?: boolean
  /** free-form per-actor config surfaced in the inspector */
  params?: Record<string, number | string | boolean>
}

export interface Marker {
  t: number
  label: string
}

/** Left rail step, mirrors the step chips of the original GIFs. */
export interface Step {
  id: string
  label: string
  labelEn: string
  icon: 'camera' | 'qr' | 'barcode' | 'box' | 'sticker' | 'apply' | 'continue'
  t0: number
  t1: number
}

export interface CaptionCue {
  t0: number
  t1: number
  text: string
  textEn: string
}

/** Full-frame success flash, as on the Figma "Complete" board. */
export interface SuccessCue {
  t0: number
  t1: number
}

export interface SceneDef {
  id: string
  name: string
  /** seconds */
  duration: number
  fps: number
  /** export resolution, matches the legacy GIFs by default */
  size: [number, number]
  background: string
  actors: ActorDef[]
  tracks: Track[]
  markers: Marker[]
  steps: Step[]
  captions: CaptionCue[]
  success?: SuccessCue[]
  /** camera starting pose, animated through tracks targeting 'camera' / 'target' */
  camera: { position: Vec3; target: Vec3; fov: number }
}
