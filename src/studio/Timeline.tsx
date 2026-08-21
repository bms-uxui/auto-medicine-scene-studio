import { useCallback, useMemo, useRef, useState } from 'react'
import type { Keyframe, Track } from '../anim/types'
import { EASE_PRESETS, type EaseName } from '../anim/easing'
import { useStudio } from './store'

function fmt(t: number) {
  const s = Math.floor(t)
  const cs = Math.floor((t - s) * 100)
  return `${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}s`
}

interface DragState {
  trackId: string
  index: number
}

/** Keyframe editor: ruler, step bands, per-track key rows, drag to retime. */
export function Timeline() {
  const scene = useStudio((s) => s.scene())
  const time = useStudio((s) => s.time)
  const selection = useStudio((s) => s.selection)
  const laneRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [filter, setFilter] = useState('')

  const toTime = useCallback(
    (clientX: number) => {
      const el = laneRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      return Math.max(0, Math.min(scene.duration, ((clientX - rect.left) / rect.width) * scene.duration))
    },
    [scene.duration],
  )

  const tracks = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return scene.tracks.filter((tr) => {
      if (selection && tr.target !== selection && !q) return true
      return !q || tr.id.toLowerCase().includes(q)
    })
  }, [scene.tracks, filter, selection])

  const pct = (t: number) => `${(t / scene.duration) * 100}%`

  const onLanePointer = (e: React.PointerEvent) => {
    if (drag) return
    useStudio.getState().setTime(toTime(e.clientX))
  }

  const onKeyPointerDown = (e: React.PointerEvent, track: Track, index: number) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setDrag({ trackId: track.id, index })
    useStudio.getState().select(track.target)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    useStudio.getState().moveKey(drag.trackId, drag.index, toTime(e.clientX))
  }

  const onPointerUp = () => setDrag(null)

  const cycleEase = (track: Track, index: number, key: Keyframe) => {
    const names = Object.keys(EASE_PRESETS) as EaseName[]
    const current = typeof key.ease === 'string' ? key.ease : 'standard'
    const next = names[(names.indexOf(current) + 1) % names.length]
    useStudio.getState().upsertKey(track.id, { ...key, ease: next })
    void index
  }

  return (
    <div className="timeline" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div className="timeline-head">
        <strong>Timeline</strong>
        <span className="muted">{fmt(time)} / {fmt(scene.duration)} · {scene.fps}fps · {Math.round(time * scene.fps)}f</span>
        <input className="filter" placeholder="filter tracks…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <div className="ruler" ref={laneRef} onPointerDown={onLanePointer}>
        {scene.steps.map((step) => (
          <div key={step.id} className="step-band" style={{ left: pct(step.t0), width: pct(step.t1 - step.t0) }} title={step.labelEn}>
            <span>{step.labelEn}</span>
          </div>
        ))}
        {scene.markers.map((m) => (
          <div key={m.label} className="marker" style={{ left: pct(m.t) }} title={`${m.label} @ ${fmt(m.t)}`} />
        ))}
        {Array.from({ length: Math.floor(scene.duration) + 1 }, (_, i) => (
          <div key={i} className="tick" style={{ left: pct(i) }}>
            <span>{i}s</span>
          </div>
        ))}
        <div className="playhead" style={{ left: pct(time) }} />
      </div>

      <div className="tracks">
        {tracks.map((track) => (
          <div key={track.id} className={`track-row${selection === track.target ? ' active' : ''}`}>
            <button className="track-name" onClick={() => useStudio.getState().select(track.target)} title={track.id}>
              <span className={`dot${track.muted ? ' muted' : ''}`} onClick={(e) => { e.stopPropagation(); useStudio.getState().setTrackMuted(track.id, !track.muted) }} />
              {track.target}<em>{track.path ? `.${track.path}` : `.${track.property}`}</em>
            </button>
            <div className="track-lane" onPointerDown={onLanePointer}>
              {track.keys.map((key, i) => (
                <button
                  key={`${key.t}-${i}`}
                  className="key"
                  style={{ left: pct(key.t) }}
                  title={`${fmt(key.t)} · ${JSON.stringify(key.v)} · ${typeof key.ease === 'string' ? key.ease : 'custom'}\nshift+click: cycle easing · alt+click: delete`}
                  onPointerDown={(e) => onKeyPointerDown(e, track, i)}
                  onClick={(e) => {
                    if (e.altKey) useStudio.getState().removeKey(track.id, i)
                    else if (e.shiftKey) cycleEase(track, i, key)
                    else useStudio.getState().setTime(key.t)
                  }}
                />
              ))}
              <div className="lane-playhead" style={{ left: pct(time) }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
