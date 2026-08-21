import { useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Staff3D, type StaffDynamic } from '../scene/Staff3D'
import { KIOSK_ANCHORS } from '../scene/Kiosk'
import './lab.css'

const VIEWS = {
  'three-quarter': { pos: [1.9, 1.5, 2.4], target: [0, 0.95, 0] },
  front: { pos: [0, 1.4, 3.1], target: [0, 0.95, 0] },
  side: { pos: [3.1, 1.4, 0], target: [0, 0.95, 0] },
  back: { pos: [-1.6, 1.5, -2.4], target: [0, 0.95, 0] },
  head: { pos: [0.7, 1.75, 1.1], target: [0, 1.6, 0] },
  hands: { pos: [0.9, 1.35, 1.2], target: [0.3, 1.1, 0.2] },
} as const
type ViewKey = keyof typeof VIEWS

function LabLights() {
  return (
    <>
      <Environment resolution={256} environmentIntensity={0.3}>
        <color attach="background" args={['#eef1f6']} />
        <Lightformer form="rect" intensity={1.6} position={[0, 5, 1.5]} scale={[9, 5, 1]} rotation={[-Math.PI / 2.4, 0, 0]} />
        <Lightformer form="rect" intensity={1.0} color="#dbe7ff" position={[-5, 2.4, 2]} scale={[5, 6, 1]} rotation={[0, Math.PI / 3, 0]} />
      </Environment>
      <hemisphereLight args={['#eaf1ff', '#e6e2db', 0.12]} />
      <directionalLight castShadow position={[3.4, 4.6, 3.4]} intensity={1.8} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.02} />
      <directionalLight position={[-4.5, 2.6, 2.4]} intensity={0.3} color="#cfe0ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>
    </>
  )
}

/** Pose bench for the 3D staff worker — the model lab, but for the character. */
export function StaffLab() {
  const [view, setView] = useState<ViewKey>('three-quarter')
  const [reach, setReach] = useState(0)
  const [walk, setWalk] = useState(0)
  const [holdBox, setHoldBox] = useState(true)
  const [grid, setGrid] = useState(true)
  const [yaw, setYaw] = useState(0.35)

  // the pose is pushed through a ref so dragging a slider never re-renders the canvas
  const dyn = useRef<StaffDynamic>({ reach: 0, walk: 0, holdBox: true })
  dyn.current = {
    reach,
    walk,
    holdBox,
    reachTarget: [KIOSK_ANCHORS.scanner[0], KIOSK_ANCHORS.scanner[1] - 0.04, KIOSK_ANCHORS.scanner[2] + 0.1],
  }

  return (
    <div className="lab">
      <div className="lab-bar">
        <strong>Staff · Model Lab</strong>
        <span className="status">Figma 36:400 → 3D</span>
        <nav>
          {(Object.keys(VIEWS) as ViewKey[]).map((v) => (
            <button key={v} className={v === view ? 'on' : ''} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </nav>
        <span className="spacer" />
        <a className="link" href="#/lab">kiosk lab</a>
        <a className="link" href="#/">studio</a>
      </div>

      <main>
        <div className="lab-view">
          <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}>
            <PerspectiveCamera makeDefault fov={32} position={VIEWS[view].pos as unknown as [number, number, number]} />
            <color attach="background" args={['#f7f8fb']} />
            <LabLights />
            <group rotation={[0, yaw, 0]}>
              <Staff3D dyn={dyn} />
            </group>
            {grid && (
              <Grid args={[20, 20]} cellSize={0.1} cellColor="#dbe1ea" sectionSize={0.5} sectionColor="#b9c3d1" fadeDistance={16} infiniteGrid position={[0, 0.001, 0]} />
            )}
            <OrbitControls
              makeDefault
              target={VIEWS[view].target as unknown as [number, number, number]}
              enableDamping
              dampingFactor={0.08}
              minDistance={0.5}
              maxDistance={10}
              maxPolarAngle={Math.PI / 2 - 0.02}
            />
          </Canvas>
        </div>

        <aside className="lab-panel lab-pose">
          <section>
            <h3>Pose</h3>
            <label>
              reach <span>{reach.toFixed(2)}</span>
              <input type="range" min={0} max={1} step={0.01} value={reach} onChange={(e) => setReach(Number(e.target.value))} />
            </label>
            <label>
              walk <span>{walk.toFixed(2)}</span>
              <input type="range" min={0} max={1} step={0.01} value={walk} onChange={(e) => setWalk(Number(e.target.value))} />
            </label>
            <label>
              body yaw <span>{yaw.toFixed(2)}</span>
              <input type="range" min={-3.14} max={3.14} step={0.01} value={yaw} onChange={(e) => setYaw(Number(e.target.value))} />
            </label>
          </section>
          <section>
            <h3>Display</h3>
            <label className="row">
              <input type="checkbox" checked={holdBox} onChange={(e) => setHoldBox(e.target.checked)} /> medicine box
            </label>
            <label className="row">
              <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> grid
            </label>
          </section>
          <section>
            <h3>Reference</h3>
            <img src="/textures/actors/staff.svg" alt="Figma 36:400" style={{ width: '100%', background: '#f2f4f8', borderRadius: 8 }} />
          </section>
        </aside>
      </main>
    </div>
  )
}
