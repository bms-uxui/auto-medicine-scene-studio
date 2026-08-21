import { useEffect, useMemo } from 'react'
import { button, folder, useControls } from 'leva'
import { useStudio, type ExportFormat } from './store'
import { LIVERIES } from '../scene/liveries'

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}

/**
 * Leva-backed inspector: scene/playback controls, actor transform, keying helpers
 * and export triggers. Keying reads the live object so gizmo edits become keyframes.
 */
export function Inspector() {
  const scene = useStudio((s) => s.scene())
  const selection = useStudio((s) => s.selection)
  const actor = scene.actors.find((a) => a.id === selection)

  useControls(
    'Scene',
    () => ({
      livery: {
        value: useStudio.getState().liveryId,
        options: Object.fromEntries(LIVERIES.map((l) => [l.name, l.id])),
        onChange: (v: string) => useStudio.getState().set('liveryId', v),
      },
      lang: {
        value: useStudio.getState().lang,
        options: { 'ไทย': 'th', English: 'en' },
        onChange: (v: 'th' | 'en') => useStudio.getState().set('lang', v),
      },
      speed: { value: 1, min: 0.1, max: 3, step: 0.1, onChange: (v: number) => useStudio.getState().set('speed', v) },
      loop: { value: true, onChange: (v: boolean) => useStudio.getState().set('loop', v) },
      helpers: { value: false, onChange: (v: boolean) => useStudio.getState().set('showHelpers', v) },
      overlay: { value: true, onChange: (v: boolean) => useStudio.getState().set('showOverlay', v) },
      postFx: { value: useStudio.getState().postFx, onChange: (v: boolean) => useStudio.getState().set('postFx', v) },
      'flat kiosk': { value: useStudio.getState().flatKiosk, onChange: (v: boolean) => useStudio.getState().set('flatKiosk', v) },
      'proxy characters': {
        value: useStudio.getState().proxyCharacters,
        onChange: (v: boolean) => useStudio.getState().set('proxyCharacters', v),
      },
    }),
    [scene.id],
  )

  const actorFolder = useMemo((): Record<string, unknown> => {
    if (!actor) return { Actor: folder({ hint: { value: 'select an actor', editable: false } }) }
    return {
      Actor: folder({
        id: { value: actor.id, editable: false },
        position: {
          value: actor.position ?? [0, 0, 0],
          step: 0.01,
          onChange: (v: [number, number, number]) => useStudio.getState().patchActor(actor.id, { position: v }),
        },
        rotation: {
          value: actor.rotation ?? [0, 0, 0],
          step: 0.01,
          onChange: (v: [number, number, number]) => useStudio.getState().patchActor(actor.id, { rotation: v }),
        },
        'key position': button(() => useStudio.getState().keyFromViewport(actor.id, 'position')),
        'key rotation': button(() => useStudio.getState().keyFromViewport(actor.id, 'rotation')),
        'key scale': button(() => useStudio.getState().keyFromViewport(actor.id, 'scale')),
      }),
    }
  }, [actor])

  useControls(actorFolder as never, [actorFolder])

  useControls('Lighting', () => ({
    exposure: {
      value: useStudio.getState().exposure, min: 0.4, max: 1.8, step: 0.01,
      onChange: (v: number) => useStudio.getState().set('exposure', v),
    },
    key: {
      value: useStudio.getState().lighting.key, min: 0, max: 5, step: 0.05,
      onChange: (v: number) => useStudio.setState((s) => ({ lighting: { ...s.lighting, key: v } })),
    },
    fill: {
      value: useStudio.getState().lighting.fill, min: 0, max: 3, step: 0.05,
      onChange: (v: number) => useStudio.setState((s) => ({ lighting: { ...s.lighting, fill: v } })),
    },
    rim: {
      value: useStudio.getState().lighting.rim, min: 0, max: 4, step: 0.05,
      onChange: (v: number) => useStudio.setState((s) => ({ lighting: { ...s.lighting, rim: v } })),
    },
    env: {
      value: useStudio.getState().lighting.env, min: 0, max: 2, step: 0.05,
      onChange: (v: number) => useStudio.setState((s) => ({ lighting: { ...s.lighting, env: v } })),
    },
    shadow: {
      value: useStudio.getState().lighting.shadow, min: 0, max: 1, step: 0.02,
      onChange: (v: number) => useStudio.setState((s) => ({ lighting: { ...s.lighting, shadow: v } })),
    },
    // pulls the flat Figma actors toward the same shading the kiosk gets
    'flat art lit': {
      value: useStudio.getState().lighting.spriteLit, min: 0, max: 1, step: 0.02,
      onChange: (v: number) => useStudio.setState((s) => ({ lighting: { ...s.lighting, spriteLit: v } })),
    },
  }))

  useControls('Export', () => ({
    format: {
      value: 'gif',
      options: ['gif', 'webp', 'webm', 'mp4', 'png'],
      onChange: (v: ExportFormat) => useStudio.getState().setExport({ format: v }),
    },
    fps: {
      value: 15, min: 6, max: 60, step: 1,
      onChange: (v: number) => useStudio.getState().setExport({ fps: v }),
    },
    colors: {
      value: 128, min: 16, max: 256, step: 16,
      onChange: (v: number) => useStudio.getState().setExport({ colors: v }),
    },
    langs: {
      value: useStudio.getState().exportState.langs,
      options: ['both', 'th', 'en'] as const,
      onChange: (v: 'both' | 'th' | 'en') => useStudio.getState().setExport({ langs: v }),
    },
    scale: {
      value: 1, min: 0.5, max: 2, step: 0.25,
      onChange: (v: number) => useStudio.getState().setExport({ scale: v }),
    },
    render: button(() => useStudio.getState().setExport({ running: true, frame: 0, message: 'starting…' })),
    'save scene json': button(async () => {
      const res = await post('/__studio/save-scene', { scene: useStudio.getState().scene() })
      useStudio.getState().setExport({ message: res.ok ? `saved ${res.path}` : `failed: ${res.error}` })
    }),
    'copy scene json': button(() => navigator.clipboard.writeText(JSON.stringify(useStudio.getState().scene(), null, 2))),
  }))

  // spacebar toggles playback, arrows step a single frame
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const s = useStudio.getState()
      if (e.code === 'Space') { e.preventDefault(); s.toggle() }
      if (e.code === 'ArrowRight') s.setTime(s.time + 1 / s.scene().fps)
      if (e.code === 'ArrowLeft') s.setTime(Math.max(0, s.time - 1 / s.scene().fps))
      if (e.code === 'Home') s.setTime(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}
