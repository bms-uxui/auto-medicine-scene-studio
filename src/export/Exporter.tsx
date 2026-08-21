import { useEffect } from 'react'
import { advance, useThree } from '@react-three/fiber'
import type { SceneDef } from '../anim/types'
import { drawOverlay, preloadOverlayIcons } from '../overlay/draw'
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
      const W = Math.round(scene.size[0] * scale)
      const H = Math.round(scene.size[1] * scale)
      const fps = settings.fps || scene.fps
      const total = Math.round(scene.duration * fps)
      const dt = 1 / fps
      const lang = useStudio.getState().lang

      const out = document.createElement('canvas')
      out.width = W
      out.height = H
      const ctx = out.getContext('2d')!
      const ov = document.createElement('canvas')
      ov.width = W
      ov.height = H
      const ovCtx = ov.getContext('2d')!

      await preloadOverlayIcons()
      setExport({ total, frame: 0, message: 'rendering…' })
      await post('/__studio/frames/begin', { scene: scene.id })

      let clock = performance.now()
      let batch: string[] = []
      const flush = async (startIndex: number) => {
        if (batch.length === 0) return
        const payload = { scene: scene.id, startIndex, frames: batch }
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
        setExport({ running: false, message: 'cancelled' })
        return
      }
      setExport({ message: `encoding ${format}…` })
      const result = await post('/__studio/encode', {
        scene: scene.id,
        fps,
        format: format satisfies ExportFormat,
        colors: settings.colors,
        size: [W, H],
      })
      setExport({ running: false, message: `saved ${result.path}` })
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
