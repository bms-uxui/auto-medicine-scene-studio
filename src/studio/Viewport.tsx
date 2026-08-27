import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, OrbitControls, TransformControls, useProgress } from '@react-three/drei'
import { Bloom, EffectComposer, HueSaturation, N8AO, Vignette } from '@react-three/postprocessing'
import { SceneRuntime } from '../scene/SceneRuntime'
import { Exporter } from '../export/Exporter'
import { drawOverlay, preloadOverlayIcons } from '../overlay/draw'
import { SCREEN_PAGES, preloadScreens, type ScreenState } from '../scene/KioskScreen'
import { useStudio } from './store'
import { ActorErrorBoundary } from './ErrorBoundary'

/** Surfaces GPU context loss in the status bar instead of silently going white. */
function ContextWatch({ onLoss }: { onLoss: (lost: boolean) => void }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    let unmounted = false
    const onLost = (e: Event) => {
      e.preventDefault()
      onLoss(true)
      // a loss fired while the canvas is going away is just teardown, not a GPU fault
      if (unmounted) return
      useStudio.getState().set('lastError', 'WebGL context lost — reload the page (try postFx off / proxy characters)')
    }
    const onRestored = () => {
      onLoss(false)
      useStudio.getState().set('lastError', null)
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      unmounted = true
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl, onLoss])
  return null
}

/** Live exposure control; changing it must not remount the renderer. */
function Exposure() {
  const gl = useThree((s) => s.gl)
  const exposure = useStudio((s) => s.exposure)
  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  return null
}

/**
 * The composer cannot be built while assets are still streaming in — it would grab a
 * null buffer and throw — so it mounts only once loading has settled.
 */
function FxProbe() {
  // dev probe: the screenshot harness counts composer mounts to catch it being torn
  // down and rebuilt mid-scene
  useEffect(() => {
    const w = window as unknown as { __fxMounts?: number }
    w.__fxMounts = (w.__fxMounts ?? 0) + 1
  }, [])
  return null
}

function PostFx({ enabled }: { enabled: boolean }) {
  const { active } = useProgress()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    // Latching: the composer waits for the first load to settle, then stays mounted.
    // Later loads — a kiosk screen page swapping in mid-scene — also raise `active`,
    // and tearing the composer down for them makes the whole image jump.
    if (ready || active) return
    const id = setTimeout(() => setReady(true), 120)
    return () => clearTimeout(id)
  }, [active, ready])

  if (!enabled || !ready) return null
  return (
    // No ambient-occlusion pass: its half-res sampling is re-randomised every frame, so
    // the shading crawls and reads as a flicker — and it buys nothing on the flat look,
    // where the cabinet is drawn unlit anyway.
    // Multisampling on: the composer renders to its own target, and with MSAA off the
    // canvas setting no longer applies — the hard edges of the flat art then crawl from
    // frame to frame, which reads as the picture shimmering.
    <EffectComposer multisampling={4}>
      {import.meta.env.DEV ? <FxProbe /> : <></>}
      {/* only the emissive parts — screen, scanner, bay light — should bloom */}
      {/* a wide smoothing band: a hard threshold makes the glow pop on and off as the
          scanner pulses across it */}
      {/*
        Contact darkening where surfaces meet — under the cabinet, in the pick-up recess,
        along the skirting. It is the single biggest thing between "lit" and "in a room":
        no light rig puts shade in a corner the way occlusion does.
      */}
      <N8AO aoRadius={0.32} intensity={1.05} distanceFalloff={0.7} quality="medium" color="#3d3730" halfRes />
      <Bloom intensity={0.25} luminanceThreshold={1.0} luminanceSmoothing={0.7} mipmapBlur />
      {/* the room came out grey and cold — a hospital, but the sad kind. A little more
          colour in the grade and a touch more exposure is most of the way back */}
      <HueSaturation saturation={0.2} />
      {/* barely there: it settles the corners of a bright frame rather than framing it */}
      <Vignette offset={0.32} darkness={0.28} />
    </EffectComposer>
  )
}

function Ticker() {
  const playing = useStudio((s) => s.playing)
  useFrame((_, dt) => {
    if (!playing) return
    useStudio.getState().advance(Math.min(dt, 0.05))
  })
  return null
}

function Gizmo({ mode }: { mode: 'translate' | 'rotate' | 'scale' }) {
  const selection = useStudio((s) => s.selection)
  const registry = useStudio((s) => s.registry)
  const scene = useThree((s) => s.scene)
  const target = selection ? registry.get(selection) : undefined
  if (!target || !scene) return null
  return <TransformControls object={target} mode={mode} size={0.7} />
}

/** 2D layer drawn on top of the render — same code path the exporter composites. */
function Overlay({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    void preloadOverlayIcons()
    let raf = 0
    const draw = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const s = useStudio.getState()
        const scene = s.scene()
        const [w, h] = scene.size
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          if (s.showOverlay) drawOverlay(ctx, scene, s.time, s.lang)
          else ctx.clearRect(0, 0, w, h)
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [canvasRef])
  return <canvas ref={canvasRef} className="overlay-canvas" />
}

export function Viewport({ orbit, gizmoMode }: { orbit: boolean; gizmoMode: 'translate' | 'rotate' | 'scale' }) {
  const scene = useStudio((s) => s.scene())
  const lang = useStudio((s) => s.lang)
  // pull every screen page in up front: a page that decodes mid-scene both pops on the
  // display and disturbs anything watching the loading manager
  useEffect(() => {
    preloadScreens(Object.keys(SCREEN_PAGES) as ScreenState[], lang)
  }, [lang])
  const showHelpers = useStudio((s) => s.showHelpers)
  const exporting = useStudio((s) => s.exportState.running)
  const postFx = useStudio((s) => s.postFx)
  // once the context drops, the composer must not be rebuilt — it reads context
  // attributes off a dead GL and throws before the canvas can recover
  const [contextLost, setContextLost] = useState(false)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const ratio = scene.size[0] / scene.size[1]
  // The frame box is sized here rather than in CSS: `aspect-ratio` loses to a
  // `max-height` clamp — the height shrinks, the width does not, and the canvas ends up
  // wider than the scene. That silently widens the camera's horizontal FOV, and the
  // exporter then squeezes that canvas into the output frame, so the render came out
  // stretched. Fitting the box by hand keeps the canvas at exactly the scene ratio.
  useEffect(() => {
    const el = holder.current?.parentElement
    if (!el) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      const availW = r.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const availH = r.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      const cap = holder.current?.closest('.studio.theater') ? Infinity : scene.size[0]
      const w = Math.max(1, Math.min(availW, availH * ratio, cap))
      setBox({ w, h: w / ratio })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ratio, scene.size])
  const cssWidth = box?.w ?? 0
  // While exporting, the backing store is grown to the full output resolution: copying a
  // window-sized canvas into a 1080-wide frame just upscales it, and the render came out
  // soft. The dpr prop is the only lever — r3f re-applies it on every commit.
  const exportScale = useStudio((s) => s.exportState.scale)
  const exportDpr =
    cssWidth > 0 ? Math.min(4, Math.max(1, (scene.size[0] * (exportScale || 1)) / cssWidth)) : 1

  return (
    <div ref={holder} className="viewport" style={box ? { width: box.w, height: box.h } : { visibility: 'hidden' }}>
      <Canvas
        shadows="soft"
        dpr={exporting ? exportDpr : [1, 1.5]}
        frameloop={exporting ? 'never' : 'always'}
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          // ACES crushes the brand reds and blues; the neutral curve keeps them saturated
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 1.03,
        }}
        camera={{ position: scene.camera.position, fov: scene.camera.fov, near: 0.15, far: 40 }}
        style={{ background: scene.background }}
      >
        <ContextWatch onLoss={setContextLost} />
        <Exposure />
        <Ticker />
        <ActorErrorBoundary label="scene">
          <SceneRuntime scene={scene} orbit={orbit} />
        </ActorErrorBoundary>
        {showHelpers && (
          <Grid args={[20, 20]} cellSize={0.25} cellColor="#d7dbe2" sectionSize={1} sectionColor="#b9c0cb" fadeDistance={14} infiniteGrid position={[0, 0.001, 0]} />
        )}
        {showHelpers && <Gizmo mode={gizmoMode} />}
        {orbit && <OrbitControls makeDefault target={scene.camera.target} enableDamping dampingFactor={0.1} />}
        <PostFx enabled={postFx && !contextLost} />
        <Exporter scene={scene} overlay={overlayRef} />
      </Canvas>
      <Overlay canvasRef={overlayRef} />
    </div>
  )
}
