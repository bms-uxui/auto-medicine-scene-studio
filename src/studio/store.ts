import { create } from 'zustand'
import type { Object3D } from 'three'
import type { ActorDef, Keyframe, SceneDef, Track, TrackValue } from '../anim/types'
import { SCENES } from '../scenes'
import { LIGHTING_DEFAULTS, type LightingConfig } from '../scene/Stage'
import { DEFAULT_LIVERY } from '../scene/liveries'

export type ExportFormat = 'gif' | 'webp' | 'webm' | 'mp4' | 'png'

interface ExportState {
  running: boolean
  frame: number
  total: number
  format: ExportFormat
  /** render/playback rate of the exported file; the legacy GIFs ran at 7-15fps */
  fps: number
  /** GIF/WebP palette size — lower means smaller files */
  colors: number
  /** render scale relative to the scene size */
  scale: number
  message: string
}

interface StudioState {
  scenes: SceneDef[]
  sceneId: string
  time: number
  playing: boolean
  loop: boolean
  speed: number
  selection: string | null
  showHelpers: boolean
  showOverlay: boolean
  postFx: boolean
  /** 2.5D flat look for the kiosk, so it matches the vector characters */
  flatKiosk: boolean
  lighting: LightingConfig
  /** wrap applied to the kiosk in every scene */
  liveryId: string
  exposure: number
  /** render capsule stand-ins instead of skinned GLBs (blocking / low-end / headless) */
  proxyCharacters: boolean
  lang: 'th' | 'en'
  /** last error caught inside the WebGL tree, shown in the status bar */
  lastError: string | null
  exportState: ExportState

  /** live object registry, filled by actors as they mount */
  registry: Map<string, Object3D>

  scene: () => SceneDef
  setScene: (id: string) => void
  setTime: (t: number) => void
  advance: (dt: number) => void
  setPlaying: (playing: boolean) => void
  toggle: () => void
  select: (id: string | null) => void
  set: <K extends keyof StudioState>(key: K, value: StudioState[K]) => void

  patchActor: (actorId: string, patch: Partial<ActorDef>) => void
  upsertKey: (trackId: string, key: Keyframe) => void
  moveKey: (trackId: string, index: number, t: number) => void
  removeKey: (trackId: string, index: number) => void
  addTrack: (track: Track) => void
  setTrackMuted: (trackId: string, muted: boolean) => void
  /** write current live transform of an actor as a keyframe at the playhead */
  keyFromViewport: (actorId: string, property: 'position' | 'rotation' | 'scale') => void
  replaceScene: (next: SceneDef) => void
  setExport: (patch: Partial<ExportState>) => void
}

function clone<T>(v: T): T {
  return structuredClone(v)
}

export const useStudio = create<StudioState>((set, get) => ({
  scenes: clone(SCENES),
  sceneId: SCENES[0].id,
  time: 0,
  playing: false,
  loop: true,
  speed: 1,
  selection: null,
  showHelpers: false,
  showOverlay: true,
  // opt-in: the composer's normal pass is what tips the GPU into a context loss on
  // some machines, so the studio ships without it and `?fx` turns it back on
  postFx: new URLSearchParams(location.search).has('fx'),
  flatKiosk: true,
  lighting: { ...LIGHTING_DEFAULTS },
  liveryId: DEFAULT_LIVERY.id,
  exposure: 1.02,
  proxyCharacters: new URLSearchParams(location.search).has('proxy'),
  lang: 'th',
  lastError: null,
  exportState: { running: false, frame: 0, total: 0, format: 'gif', fps: 15, colors: 128, scale: 1, message: '' },
  registry: new Map(),

  scene: () => {
    const { scenes, sceneId } = get()
    return scenes.find((s) => s.id === sceneId) ?? scenes[0]
  },

  setScene: (id) => set({ sceneId: id, time: 0, selection: null }),
  setTime: (t) => set({ time: Math.max(0, t) }),

  advance: (dt) => {
    const { time, speed, loop } = get()
    const duration = get().scene().duration
    let next = time + dt * speed
    if (next > duration) next = loop ? next % duration : duration
    set({ time: next, playing: loop ? true : next < duration })
  },

  setPlaying: (playing) => set({ playing }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  select: (id) => set({ selection: id }),
  set: (key, value) => set({ [key]: value } as never),

  patchActor: (actorId, patch) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id !== s.sceneId
          ? sc
          : { ...sc, actors: sc.actors.map((a) => (a.id === actorId ? { ...a, ...patch } : a)) },
      ),
    })),

  upsertKey: (trackId, key) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => {
        if (sc.id !== s.sceneId) return sc
        return {
          ...sc,
          tracks: sc.tracks.map((tr) => {
            if (tr.id !== trackId) return tr
            const keys = tr.keys.filter((k) => Math.abs(k.t - key.t) > 1e-4)
            keys.push(key)
            keys.sort((a, b) => a.t - b.t)
            return { ...tr, keys }
          }),
        }
      }),
    })),

  moveKey: (trackId, index, t) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => {
        if (sc.id !== s.sceneId) return sc
        return {
          ...sc,
          tracks: sc.tracks.map((tr) => {
            if (tr.id !== trackId) return tr
            const keys = tr.keys.map((k, i) => (i === index ? { ...k, t: Math.max(0, t) } : k))
            keys.sort((a, b) => a.t - b.t)
            return { ...tr, keys }
          }),
        }
      }),
    })),

  removeKey: (trackId, index) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id !== s.sceneId
          ? sc
          : { ...sc, tracks: sc.tracks.map((tr) => (tr.id === trackId ? { ...tr, keys: tr.keys.filter((_, i) => i !== index) } : tr)) },
      ),
    })),

  addTrack: (track) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id !== s.sceneId ? sc : { ...sc, tracks: [...sc.tracks, track] },
      ),
    })),

  setTrackMuted: (trackId, muted) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id !== s.sceneId ? sc : { ...sc, tracks: sc.tracks.map((tr) => (tr.id === trackId ? { ...tr, muted } : tr)) },
      ),
    })),

  keyFromViewport: (actorId, property) => {
    const obj = get().registry.get(actorId)
    if (!obj) return
    const t = get().time
    const value: TrackValue =
      property === 'position'
        ? [obj.position.x, obj.position.y, obj.position.z]
        : property === 'rotation'
          ? [obj.rotation.x, obj.rotation.y, obj.rotation.z]
          : [obj.scale.x, obj.scale.y, obj.scale.z]
    const trackId = `${actorId}.${property}`
    const exists = get().scene().tracks.some((tr) => tr.id === trackId)
    if (!exists) get().addTrack({ id: trackId, target: actorId, property, keys: [] })
    get().upsertKey(trackId, { t, v: value, ease: 'standard' })
  },

  replaceScene: (next) =>
    set((s) => ({ scenes: s.scenes.map((sc) => (sc.id === next.id ? next : sc)) })),

  setExport: (patch) => set((s) => ({ exportState: { ...s.exportState, ...patch } })),
}))

export const selectScene = (s: StudioState) => s.scenes.find((sc) => sc.id === s.sceneId) ?? s.scenes[0]
