import { useEffect } from 'react'
import { advance, useThree } from '@react-three/fiber'
import type { SceneDef } from '../anim/types'
import { drawOverlay, preloadOverlayIcons } from '../overlay/draw'
import { cutoutsReady, pending as cutoutsPending } from '../scene/CutoutRig'
import { SCREEN_PAGES, preloadScreens, type ScreenState } from '../scene/KioskScreen'
import { useStudio, type ExportFormat } from '../studio/store'

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${await res.text()}`)
  return res.json()
}

/**
 * Deterministic frame exporter. Drives the R3F loop by hand at exactly 1/fps so the
 * output is frame-identical between runs, composites the 2D overlay on top of each
 * frame, and streams PNGs to the dev server which encodes the final file.
 */
export function Exporter({ scene, overlay }: { scene: SceneDef; overlay: React.RefObject<HTMLCanvasElement | null> }) {
  const gl = useThree((s) => s.gl)
  const running = useStudio((s) => s.exportState.running)
  const format = useStudio((s) => s.exportState.format)

  useEffect(() => {
    if (!running) return
    let cancelled = false
    const setExport = useStudio.getState().setExport

    const run = async () => {
      const settings = useStudio.getState().exportState
      const scale = settings.scale || 1
      // even dimensions: H.264 in yuv420p subsamples chroma 2x2 and refuses an odd size
      const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
      const W = even(scene.size[0] * scale)
      const H = even(scene.size[1] * scale)
      const fps = settings.fps || scene.fps
      const total = Math.round(scene.duration * fps)
      const dt = 1 / fps
      // 'both' writes a TH and an EN file: the captions, the step rail and the kiosk's
      // own screen are all language-dependent, so each one needs its own render pass
      const langs: Array<'th' | 'en'> =
        settings.langs === 'both' ? ['th', 'en'] : [settings.langs as 'th' | 'en']
      const restoreLang = useStudio.getState().lang

      const out = document.createElement('canvas')
      out.width = W
      out.height = H
      const ctx = out.getContext('2d')!
      const ov = document.createElement('canvas')
      ov.width = W
      ov.height = H
      const ovCtx = ov.getContext('2d')!

      await preloadOverlayIcons()
      // a figure whose art is still being split into layers renders with parts missing;
      // an export that starts in that window bakes the hole into every frame
      await cutoutsReady()

      // Render at the exact output resolution. The viewport canvas is only as wide as
      // the window allows, and copying that into a larger frame just upscales it — the
      // export came out soft. Going through r3f's own setSize keeps the post-processing
      // composer's render targets in step.
      // The viewport switches its pixel ratio to the export resolution while
      // `exportState.running` is set (see Viewport); wait for that resize — and the
      // composer's targets — to land before the first capture.
      await new Promise((r) => setTimeout(r, 120))

      const saved: string[] = []
      /*
       * One clock for the whole export, not one per language.
       *
       * It used to be reset at the top of each pass, so the second pass handed r3f a
       * timestamp minutes ahead of the last frame it had seen. Every per-frame animator
       * then got that gap as its delta in a single step — damped values snapped, and the
       * cut-out rigs came out of it with the waist and arm gone, which is why a run could
       * write a whole TH file and then an EN one with pieces of the character missing.
       */
      let clock = performance.now()
      for (const lang of langs) {
      const key = langs.length > 1 ? `${scene.id}-${lang}` : scene.id
      useStudio.getState().set('lang', lang)
      preloadScreens(Object.keys(SCREEN_PAGES) as ScreenState[], lang)
      // give the swapped-in screen pages a moment to decode before the first frame
      await new Promise((r) => setTimeout(r, 250))
      // Swapping the language rebuilds the scene, which remounts the cut-out figures and
      // sets them cutting their art again. The second language pass used to start right
      // through that window, which is why the TH file came out whole and the EN one had
      // a character with no torso.
      await cutoutsReady()

      setExport({ total, frame: 0, message: `rendering ${lang.toUpperCase()}…` })
      await post('/__studio/frames/begin', { scene: key })

      let batch: string[] = []
      const flush = async (startIndex: number) => {
        if (batch.length === 0) return
        const payload = { scene: key, startIndex, frames: batch }
        batch = []
        await post('/__studio/frames', payload)
      }

      // two warm-up frames so lazy assets and the first mixer update settle
      useStudio.getState().setTime(0)
      for (let i = 0; i < 2; i++) {
        clock += dt * 1000
        advance(clock)
      }

      let batchStart = 0
      for (let i = 0; i < total; i++) {
        if (cancelled) break
        // A figure can start re-cutting its art mid-render — a module reloading under the
        // dev server does it — and every frame captured in that window would be missing a
        // layer. The check costs nothing while nothing is rebuilding.
        if (cutoutsPending.count > 0) await cutoutsReady()
        useStudio.getState().setTime(i * dt)
        clock += dt * 1000
        advance(clock)

        ctx.fillStyle = scene.background
        ctx.fillRect(0, 0, W, H)
        ctx.drawImage(gl.domElement, 0, 0, W, H)
        if (useStudio.getState().showOverlay) {
          drawOverlay(ovCtx, scene, i * dt, lang)
          ctx.drawImage(ov, 0, 0)
        }
        batch.push(out.toDataURL('image/png'))
        if (batch.length >= 8) {
          await flush(batchStart)
          batchStart = i + 1
        }
        setExport({ frame: i + 1 })
        // yield so the UI stays responsive during long exports
        if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0))
      }
      await flush(batchStart)

      if (cancelled) {
        useStudio.getState().set('lang', restoreLang)
        setExport({ running: false, message: 'cancelled' })
        return
      }
      setExport({ message: `encoding ${format} (${lang.toUpperCase()})…` })
      const result = await post('/__studio/encode', {
        scene: key,
        fps,
        format: format satisfies ExportFormat,
        colors: settings.colors,
        size: [W, H],
      })
      saved.push(result.path)
      }

      useStudio.getState().set('lang', restoreLang)
      setExport({ running: false, message: `saved ${saved.join(' + ')}` })
    }

    run().catch((err: Error) => {
      console.error(err)
      useStudio.getState().setExport({ running: false, message: `failed: ${err.message}` })
    })

    return () => {
      cancelled = true
    }
  }, [running, scene, gl, format, overlay])

  return null
}
