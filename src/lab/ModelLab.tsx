import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Bounds, Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Leva, button, folder, useControls } from 'leva'
import { Kiosk, type KioskDynamic } from '../scene/Kiosk'
import { GroundBlob } from '../scene/GroundBlob'
import { computeMetrics, type KioskLayout } from '../scene/kioskLayout'
import { LIVERIES, liveryById, type Livery, type UvWindow } from '../scene/liveries'
import { SCREEN_PAGES, type ScreenState } from '../scene/KioskScreen'
import './lab.css'

type Rect4 = [number, number, number, number]

const VIEWS = {
  'three-quarter': { pos: [3.6, 2.4, 4.2], target: [0, 1.0, 0] },
  front: { pos: [0, 1.35, 4.6], target: [0, 1.05, 0] },
  side: { pos: [4.6, 1.35, 0], target: [0, 1.05, 0] },
  back: { pos: [-2.6, 1.6, -4.0], target: [0, 1.0, 0] },
  top: { pos: [0.01, 5.4, 0.9], target: [0, 0.6, 0] },
  detail: { pos: [1.25, 1.35, 1.4], target: [0.45, 1.15, 0.3] },
  bay: { pos: [1.1, 1.05, 1.5], target: [0.35, 0.62, 0.2] },
  scanner: { pos: [0.92, 1.2, 0.95], target: [0.56, 1.07, 0.42] },
} as const

type ViewName = keyof typeof VIEWS

function LabLights() {
  return (
    <>
      <Environment resolution={256} environmentIntensity={0.28}>
        <color attach="background" args={['#eef1f6']} />
        <Lightformer form="rect" intensity={1.6} position={[0, 5, 1.5]} scale={[9, 5, 1]} rotation={[-Math.PI / 2.4, 0, 0]} />
        <Lightformer form="rect" intensity={1.0} color="#dbe7ff" position={[-5, 2.4, 2]} scale={[5, 6, 1]} rotation={[0, Math.PI / 3, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#fff2e2" position={[5, 2.2, -1.5]} scale={[5, 6, 1]} rotation={[0, -Math.PI / 2.6, 0]} />
      </Environment>
      <hemisphereLight args={['#eaf1ff', '#e6e2db', 0.12]} />
      <directionalLight
        castShadow
        position={[3.4, 4.6, 3.4]}
        intensity={1.9}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3.4}
        shadow-camera-bottom={-1.6}
      />
      <directionalLight position={[0.5, 7, 1.1]} intensity={0.85} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4.5, 2.6, 2.4]} intensity={0.3} color="#cfe0ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>
    </>
  )
}

/** Ruler ticks every 10cm up the cabinet, so proportions can be read off directly. */
function Ruler({ height }: { height: number }) {
  const marks = useMemo(() => Array.from({ length: Math.floor(height * 10) + 1 }, (_, i) => i / 10), [height])
  return (
    <group position={[-0.95, 0, 0.5]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[0.004, height, 0.004]} />
        <meshBasicMaterial color="#94a3b8" />
      </mesh>
      {marks.map((y) => (
        <mesh key={y} position={[y % 0.5 === 0 ? 0.02 : 0.012, y, 0]}>
          <boxGeometry args={[y % 0.5 === 0 ? 0.05 : 0.03, 0.004, 0.004]} />
          <meshBasicMaterial color={y % 0.5 === 0 ? '#475569' : '#94a3b8'} />
        </mesh>
      ))}
    </group>
  )
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}

/**
 * Model lab: the kiosk on its own, with the Figma-derived face layout editable live.
 * Separate from the scene studio so the machine can be dialled in without a timeline.
 */
export function ModelLab() {
  const [liveryId, setLiveryId] = useState(LIVERIES[0].id)
  const [windows, setWindows] = useState<{ front: UvWindow; side: UvWindow }>(() => ({
    front: LIVERIES[0].front.window ?? [0, 0, 1, 1],
    side: LIVERIES[0].side.window ?? [0, 0, 1, 1],
  }))
  const [layout, setLayout] = useState<KioskLayout>(() => structuredClone(LIVERIES[0].layout))
  const [view, setView] = useState<ViewName>('three-quarter')
  const [status, setStatus] = useState('')
  // `#/lab?door=1` opens the pick-up bay on load
  const initialDoor = Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('door') ?? 0)
  const dyn = useRef<KioskDynamic>({ screenState: 'welcome', lang: 'th', doorOpen: initialDoor })
  const controls = useRef<{ reset: () => void } | null>(null)

  const metrics = useMemo(() => computeMetrics(layout), [layout])
  const livery: Livery = useMemo(() => {
    const base = liveryById(liveryId)
    return { ...base, front: { ...base.front, window: windows.front }, side: { ...base.side, window: windows.side } }
  }, [liveryId, windows])

  /** switching wrap also swaps in the face layout that belongs to it */
  const liveryCtl = useRef<((values: Record<string, number>) => void) | null>(null)
  const selectLivery = (id: string) => {
    const next = liveryById(id)
    const front = next.front.window ?? ([0, 0, 1, 1] as UvWindow)
    const side = next.side.window ?? ([0, 0, 1, 1] as UvWindow)
    setLiveryId(id)
    setWindows({ front, side })
    setLayout(structuredClone(next.layout))
    // push the wrap's own window values back into the panel
    liveryCtl.current?.({
      'front u0': front[0], 'front u1': front[2], 'front v0': front[1], 'front v1': front[3],
      'side u0': side[0], 'side u1': side[2],
    })
  }
  const setWindow = (panel: 'front' | 'side', index: number, value: number) =>
    setWindows((prev) => {
      const win = [...prev[panel]] as UvWindow
      win[index] = value
      return { ...prev, [panel]: win }
    })
  const patch = (key: keyof KioskLayout, value: Rect4 | number) =>
    setLayout((prev) => ({ ...prev, [key]: value }) as KioskLayout)

  const [{ wireframe, grid, ruler }, setDisplay] = useControls('Display', () => ({
    wireframe: false,
    grid: true,
    ruler: true,
    view: {
      value: 'three-quarter',
      options: Object.keys(VIEWS),
      onChange: (v: ViewName) => setView(v),
    },
  }))
  void setDisplay

  const [, setLiveryCtl] = useControls('Livery', () => ({
    wrap: {
      value: liveryId,
      options: Object.fromEntries(LIVERIES.map((l) => [l.name, l.id])),
      onChange: selectLivery,
    },
    'front u0': { value: windows.front[0], min: 0, max: 1, step: 0.001, onChange: (v: number) => setWindow('front', 0, v) },
    'front u1': { value: windows.front[2], min: 0, max: 1, step: 0.001, onChange: (v: number) => setWindow('front', 2, v) },
    'front v0': { value: windows.front[1], min: 0, max: 1, step: 0.001, onChange: (v: number) => setWindow('front', 1, v) },
    'front v1': { value: windows.front[3], min: 0, max: 1, step: 0.001, onChange: (v: number) => setWindow('front', 3, v) },
    'side u0': { value: windows.side[0], min: 0, max: 1, step: 0.001, onChange: (v: number) => setWindow('side', 0, v) },
    'side u1': { value: windows.side[2], min: 0, max: 1, step: 0.001, onChange: (v: number) => setWindow('side', 2, v) },
    'copy livery json': button(() =>
      navigator.clipboard.writeText(JSON.stringify({ id: liveryId, front: { window: windows.front }, side: { window: windows.side }, layout }, null, 2)),
    ),
  }), [liveryId])
  liveryCtl.current = setLiveryCtl as unknown as (values: Record<string, number>) => void

  const parts = useControls('Parts', {
    shell: true,
    livery: true,
    screen: true,
    camera: true,
    slots: true,
    scanner: true,
    door: true,
    pad: true,
  })

  useControls('State', {
    screen: {
      value: 'welcome',
      options: Object.keys(SCREEN_PAGES),
      onChange: (v: ScreenState) => (dyn.current = { ...dyn.current, screenState: v }),
    },
    lang: {
      value: 'th',
      options: { 'ไทย': 'th', English: 'en' },
      onChange: (v: 'th' | 'en') => (dyn.current = { ...dyn.current, lang: v }),
    },
    doorOpen: { value: initialDoor, min: 0, max: 1, step: 0.01, onChange: (v: number) => (dyn.current = { ...dyn.current, doorOpen: v }) },
    stickerFeed: { value: 0, min: 0, max: 1, step: 0.01, onChange: (v: number) => (dyn.current = { ...dyn.current, stickerFeed: v }) },
    scanGlow: { value: 0, min: 0, max: 1, step: 0.01, onChange: (v: number) => (dyn.current = { ...dyn.current, scanGlow: v }) },
    cameraGlow: { value: 0, min: 0, max: 1, step: 0.01, onChange: (v: number) => (dyn.current = { ...dyn.current, cameraGlow: v }) },
  })

  const rectControl = (key: Exclude<keyof KioskLayout, 'front' | 'sideW' | 'height'>) => {
    const [x, y, w, h] = layout[key]
    return folder({
      [`${key} x`]: { value: x, min: 0, max: layout.front.w, step: 5, onChange: (v: number) => patch(key, [v, layout[key][1], layout[key][2], layout[key][3]]) },
      [`${key} y`]: { value: y, min: 0, max: layout.front.h, step: 5, onChange: (v: number) => patch(key, [layout[key][0], v, layout[key][2], layout[key][3]]) },
      [`${key} w`]: { value: w, min: 20, max: 2400, step: 5, onChange: (v: number) => patch(key, [layout[key][0], layout[key][1], v, layout[key][3]]) },
      [`${key} h`]: { value: h, min: 20, max: 2400, step: 5, onChange: (v: number) => patch(key, [layout[key][0], layout[key][1], layout[key][2], v]) },
    })
  }

  useControls('Layout (Figma units)', () => ({
    height: { value: layout.height, min: 1.4, max: 2.6, step: 0.01, onChange: (v: number) => patch('height', v) },
    Screen: rectControl('screen'),
    'Camera bar': rectControl('cameraBar'),
    'Sensor dot': rectControl('sensorDot'),
    'Sticker slot': rectControl('stickerSlot'),
    'Receipt slot': rectControl('receiptSlot'),
    'Scanner box': rectControl('scannerBox'),
    'Pick-up door': rectControl('pickup'),
    'reset layout': button(() => setLayout(structuredClone(liveryById(liveryId).layout))),
    'save layout': button(async () => {
      const res = await post('/__studio/save-layout', { layout, livery: { id: liveryId, front: windows.front, side: windows.side } })
      setStatus(res.ok ? `saved ${res.path}` : `failed: ${res.error}`)
    }),
    'copy layout': button(() => navigator.clipboard.writeText(JSON.stringify(layout, null, 2))),
  }), [layout, liveryId])

  const wireMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#334155', wireframe: true }), [])

  return (
    <div className="lab">
      <header className="lab-bar">
        <strong>Kiosk · Model Lab</strong>
        <nav>
          {(Object.keys(VIEWS) as ViewName[]).map((v) => (
            <button key={v} className={v === view ? 'on' : ''} onClick={() => setView(v)}>{v}</button>
          ))}
        </nav>
        <span className="dims">
          {metrics.size.width.toFixed(3)} × {metrics.size.height.toFixed(2)} × {metrics.size.depth.toFixed(3)} m
        </span>
        <div className="spacer" />
        <span className="status">{status}</span>
        <a className="link" href="#/studio">scene studio →</a>
      </header>

      <main>
        <div className="lab-view">
          <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 0.95, preserveDrawingBuffer: true }}>
            <PerspectiveCamera makeDefault fov={30} position={VIEWS[view].pos as unknown as [number, number, number]} />
            <color attach="background" args={['#f7f8fb']} />
            <LabLights />
            <Suspense fallback={null}>
              <Bounds clip observe margin={1.1}>
                <group>
                  <Kiosk layout={layout} livery={livery} dyn={dyn} parts={parts} />
                  {wireframe && (
                    <mesh position={[0, metrics.size.height / 2, 0]} material={wireMaterial}>
                      <boxGeometry args={[metrics.size.width, metrics.size.height, metrics.size.depth]} />
                    </mesh>
                  )}
                </group>
              </Bounds>
            </Suspense>
            {ruler && <Ruler height={metrics.size.height} />}
            {grid && (
              <Grid
                args={[20, 20]}
                cellSize={0.1}
                cellColor="#dbe1ea"
                sectionSize={0.5}
                sectionColor="#b9c3d1"
                fadeDistance={16}
                infiniteGrid
                position={[0, 0.001, 0]}
              />
            )}
            <GroundBlob width={metrics.size.width * 1.9} depth={metrics.size.depth * 2.6} opacity={0.5} position={[0, 0.012, 0.05]} />
            <OrbitControls
              makeDefault
              ref={controls as never}
              target={VIEWS[view].target as unknown as [number, number, number]}
              enableDamping
              dampingFactor={0.08}
              minDistance={0.6}
              maxDistance={12}
              maxPolarAngle={Math.PI / 2 - 0.02}
            />
          </Canvas>
        </div>
        <aside className="lab-panel">
          <Leva fill titleBar={false} />
        </aside>
      </main>
    </div>
  )
}
