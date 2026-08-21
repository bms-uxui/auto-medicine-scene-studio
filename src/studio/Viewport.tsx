import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, OrbitControls, TransformControls, useProgress } from '@react-three/drei'
import { Bloom, EffectComposer, HueSaturation, N8AO } from '@react-three/postprocessing'
import { SceneRuntime } from '../scene/SceneRuntime'
import { Exporter } from '../export/Exporter'
import { drawOverlay, preloadOverlayIcons } from '../overlay/draw'
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
function PostFx({ enabled }: { enabled: boolean }) {
  const { active } = useProgress()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (active) {
      setReady(false)
      return
    }
    const id = setTimeout(() => setReady(true), 120)
    return () => clearTimeout(id)
  }, [active])

  if (!enabled || !ready) return null
  return (
    <EffectComposer enableNormalPass>
      {/* contact occlusion only — a large radius muddies the white shell */}
      <N8AO aoRadius={0.28} intensity={1.1} distanceFalloff={0.6} halfRes />
      {/* only the emissive display should bloom */}
      <Bloom intensity={0.22} luminanceThreshold={1.0} luminanceSmoothing={0.25} mipmapBlur />
      <HueSaturation saturation={0.12} />
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
  const showHelpers = useStudio((s) => s.showHelpers)
  const exporting = useStudio((s) => s.exportState.running)
  const postFx = useStudio((s) => s.postFx)
  // once the context drops, the composer must not be rebuilt — it reads context
  // attributes off a dead GL and throws before the canvas can recover
  const [contextLost, setContextLost] = useState(false)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  return (
    <div className="viewport" style={{ aspectRatio: `${scene.size[0]} / ${scene.size[1]}` }}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop={exporting ? 'never' : 'always'}
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          // ACES crushes the brand reds and blues; the neutral curve keeps them saturated
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 0.98,
        }}
        camera={{ position: scene.camera.position, fov: scene.camera.fov, near: 0.05, far: 60 }}
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
