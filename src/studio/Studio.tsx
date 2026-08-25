import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Leva } from 'leva'
import { Viewport } from './Viewport'
import { Timeline } from './Timeline'
import { Inspector } from './Inspector'
import { Theater } from './Theater'
import { useStudio } from './store'
import './studio.css'

// dev handle for scripted/automated driving of the studio (screenshots, batch export)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __studio: typeof useStudio }).__studio = useStudio
}

export function Studio() {
  const [orbit, setOrbit] = useState(false)
  const [theater, setTheater] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate' | 'scale'>('translate')
  const scene = useStudio((s) => s.scene())
  const playing = useStudio((s) => s.playing)
  const exportState = useStudio((s) => s.exportState)
  const lastError = useStudio((s) => s.lastError)
  const selection = useStudio((s) => s.selection)

  /**
   * Review mode: the whole chrome goes away and the frame fills the display, so what is
   * on screen is exactly what will be exported. It only toggles CSS — remounting the
   * canvas would drop the WebGL context and reload every model.
   */
  const toggleTheater = useCallback(() => {
    setTheater((on) => {
      if (on) document.exitFullscreen().catch(() => {})
      else root.current?.requestFullscreen?.().catch(() => {})
      return !on
    })
  }, [])

  useEffect(() => {
    // Escape leaves browser fullscreen on its own; follow it back out of review mode
    const onChange = () => { if (!document.fullscreenElement) setTheater(false) }
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.code === 'KeyF') { e.preventDefault(); toggleTheater() }
    }
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
    }
  }, [toggleTheater])

  return (
    <div ref={root} className={`studio${theater ? ' theater' : ''}`}>
      <header className="toolbar">
        <strong>Auto Medicine · Scene Studio</strong>
        <nav>
          {useStudio.getState().scenes.map((s) => (
            <button key={s.id} className={s.id === scene.id ? 'on' : ''} onClick={() => useStudio.getState().setScene(s.id)}>
              {s.name}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <button onClick={() => useStudio.getState().toggle()}>{playing ? '❚❚ pause' : '▶ play'}</button>
        <button onClick={() => useStudio.getState().setTime(0)}>⏮ start</button>
        <button className={orbit ? 'on' : ''} onClick={() => setOrbit((v) => !v)}>
          {orbit ? 'free camera' : 'scene camera'}
        </button>
        {(['translate', 'rotate', 'scale'] as const).map((m) => (
          <button key={m} className={gizmoMode === m ? 'on' : ''} onClick={() => setGizmoMode(m)}>{m[0].toUpperCase()}</button>
        ))}
        <button onClick={toggleTheater} title="full screen review (F)">⛶ full screen</button>
        <a className="link" href="#/gallery">gallery →</a>
        <a className="link" href="#/lab">model lab →</a>
        <span className={`status${lastError ? ' error' : ''}`} title={lastError ?? undefined}>
          {lastError ?? (exportState.running ? `export ${exportState.frame}/${exportState.total}` : exportState.message)}
        </span>
      </header>

      <main>
        <section className="stage">
          <Suspense fallback={<div className="loading">loading models…</div>}>
            <Viewport orbit={orbit} gizmoMode={gizmoMode} />
          </Suspense>
          <div className="actors">
            {scene.actors.map((a) => (
              <button key={a.id} className={selection === a.id ? 'on' : ''} onClick={() => useStudio.getState().select(a.id)}>
                {a.label}
              </button>
            ))}
            <button onClick={() => useStudio.getState().select(null)}>none</button>
          </div>
        </section>
        <aside className="panel">
          <Leva fill titleBar={false} />
        </aside>
      </main>

      {theater && <Theater onExit={toggleTheater} />}
      <Timeline />
      <Inspector />
    </div>
  )
}
