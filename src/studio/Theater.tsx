import { useEffect, useRef, useState } from 'react'
import { useStudio } from './store'

/**
 * The control bar for review mode. It floats over the frame and hides itself while the
 * clip is running, so a full-screen pass shows nothing but what will be exported.
 */
export function Theater({ onExit }: { onExit: () => void }) {
  const time = useStudio((s) => s.time)
  const playing = useStudio((s) => s.playing)
  const speed = useStudio((s) => s.speed)
  const loop = useStudio((s) => s.loop)
  const lang = useStudio((s) => s.lang)
  const scene = useStudio((s) => s.scene())
  const [idle, setIdle] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // any pointer movement brings the bar back; it only fades again during playback
  useEffect(() => {
    const wake = () => {
      setIdle(false)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setIdle(useStudio.getState().playing), 2200)
    }
    wake()
    window.addEventListener('pointermove', wake)
    window.addEventListener('keydown', wake)
    return () => {
      window.clearTimeout(timer.current)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [playing])

  const s = useStudio.getState()
  const step = scene.steps?.find((x) => time >= x.t0 && time < x.t1)

  return (
    <div className={`theater-bar${idle ? ' idle' : ''}`}>
      <button onClick={() => s.setTime(0)} title="back to the start (Home)">⏮</button>
      <button onClick={() => s.toggle()} title="play / pause (Space)">{playing ? '❚❚' : '▶'}</button>
      <input
        className="scrub"
        type="range"
        min={0}
        max={scene.duration}
        step={1 / scene.fps}
        value={time}
        onChange={(e) => s.setTime(Number(e.target.value))}
      />
      <span className="clock">{time.toFixed(2)} / {scene.duration.toFixed(2)}s</span>
      {step && <span className="beat">{(lang === 'en' ? (step.labelEn ?? step.label) : step.label).replace(/\n/g, ' ')}</span>}
      {([0.5, 0.7, 1] as const).map((v) => (
        <button key={v} className={speed === v ? 'on' : ''} onClick={() => s.set('speed', v)}>{v}×</button>
      ))}
      <button className={loop ? 'on' : ''} onClick={() => s.set('loop', !loop)} title="loop">↻</button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => s.set('lang', lang === 'en' ? 'th' : 'en')}>
        {lang.toUpperCase()}
      </button>
      <button onClick={onExit} title="leave review mode (Esc)">✕</button>
    </div>
  )
}
