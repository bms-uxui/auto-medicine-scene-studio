import { Suspense, createContext, useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { LAYOUT } from '../overlay/draw'
import { sampleScene, type SampledFrame } from '../anim/sampler'
import type { ActorDef, SceneDef, Vec3 } from '../anim/types'
import { useStudio } from '../studio/store'
import { Kiosk, KIOSK_ANCHORS, type KioskDynamic } from './Kiosk'
import { liveryById } from './liveries'
import { Character, type CharacterDynamic } from './Character'
import { ProxyCharacter } from './ProxyCharacter'
import { Billboard2D, type BillboardDynamic } from './Billboard2D'
import { Staff3D, type StaffDynamic } from './Staff3D'
import { CutoutRig, type CutoutRigDynamic } from './CutoutRig'
import { CUTOUT_RIGS } from './cutoutRigs'
import { ActorErrorBoundary } from '../studio/ErrorBoundary'
import { PROP_COMPONENTS, type PropDynamic, type PropPrimitive } from './Props'
import { StudioStage } from './Stage'

const FrameCtx = createContext<{ current: SampledFrame }>({ current: {} })
export const useSampledFrame = () => useContext(FrameCtx)

const v3 = (v: unknown, fallback: Vec3): Vec3 => (Array.isArray(v) && v.length === 3 ? (v as Vec3) : fallback)

/** Applies sampled transform channels onto a live Object3D. */
function applyCommon(obj: THREE.Object3D | null, actor: ActorDef, values: Record<string, unknown> | undefined) {
  if (!obj) return
  const pos = v3(values?.position, actor.position ?? [0, 0, 0])
  const rot = v3(values?.rotation, actor.rotation ?? [0, 0, 0])
  const rawScale = values?.scale ?? actor.scale ?? 1
  const scale = typeof rawScale === 'number' ? ([rawScale, rawScale, rawScale] as Vec3) : v3(rawScale, [1, 1, 1])
  obj.position.set(pos[0], pos[1], pos[2])
  obj.rotation.set(rot[0], rot[1], rot[2])
  obj.scale.set(scale[0], scale[1], scale[2])
  const visible = values?.visible
  obj.visible = visible === undefined ? actor.visible !== false : Boolean(visible)

  const opacity = values?.opacity
  if (typeof opacity === 'number') {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh
      // Lines carry material too. The plastic case draws its edges as line segments so
      // clear plastic reads against a pale cabinet, and skipping them left that wireframe
      // hanging in frame at full strength while the case itself had faded to nothing.
      const isLine = (child as unknown as THREE.Line).isLine
      if (!mesh.isMesh && !isLine) return
      if (mesh.isMesh) {
        // the shadow pass ignores opacity, so a faded-out actor would still throw its
        // shadow across the floor of the demonstration — stop casting once it is gone
        if (mesh.userData.baseCastShadow === undefined) mesh.userData.baseCastShadow = mesh.castShadow
        mesh.castShadow = (mesh.userData.baseCastShadow as boolean) && opacity > 0.05
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of materials) {
        const mat = m as THREE.MeshStandardMaterial
        // Fading an actor scales what the material asks for rather than replacing
        // it. The material's own ask lives in userData.baseOpacity: captured once from
        // the authored material, and kept up to date by anything that animates its own
        // opacity per frame (the scan beam, the case lid) — those writers update
        // baseOpacity rather than fighting over mat.opacity. The old handshake compared
        // mat.opacity against the last value written here; one missed frame made base
        // undefined, and the resulting NaN survived forever because NaN !== NaN.
        if (mat.userData.baseOpacity === undefined) {
          mat.userData.baseOpacity = mat.opacity
          mat.userData.baseTransparent = mat.transparent
          mat.userData.baseDepthWrite = mat.depthWrite
        }
        const base = mat.userData.baseOpacity as number
        mat.opacity = base * opacity
        const wantTransparent =
          (mat.userData.baseTransparent as boolean) || opacity < 0.999 || base < 0.999
        if (mat.transparent !== wantTransparent) {
          // three only honours a changed transparent flag after a rebuild; without this
          // the material stays in the opaque pass and renders solid at opacity 0
          mat.transparent = wantTransparent
          mat.needsUpdate = true
        }
        mat.depthWrite = (mat.userData.baseTransparent as boolean)
          ? (mat.userData.baseDepthWrite as boolean)
          : opacity > 0.99
      }
    })
  }
}

function useRegister(id: string) {
  const ref = useRef<THREE.Group>(null)
  const registry = useStudio((s) => s.registry)
  useMemo(() => registry, [registry])
  useFrame(() => {
    if (ref.current && registry.get(id) !== ref.current) registry.set(id, ref.current)
  })
  return ref
}

function KioskActor({ actor }: { actor: ActorDef }) {
  const ref = useRegister(actor.id)
  const frame = useSampledFrame()
  const dyn = useRef<KioskDynamic>({})
  const lang = useStudio((s) => s.lang)
  const livery = useStudio((s) => liveryById(s.liveryId))
  const flat = useStudio((s) => s.flatKiosk)
  useFrame(() => {
    const values = frame.current[actor.id]
    applyCommon(ref.current, actor, values)
    dyn.current = {
      lang,
      time: useStudio.getState().time,
      screenState: (values?.['custom:screenState'] as KioskDynamic['screenState']) ?? 'welcome',
      doorOpen: (values?.['custom:doorOpen'] as number) ?? 0,
      scanGlow: (values?.['custom:scanGlow'] as number) ?? 0,
      cameraGlow: (values?.['custom:cameraGlow'] as number) ?? 0,
      stickerFeed: (values?.['custom:stickerFeed'] as number) ?? 0,
      scanReach: values?.['custom:scanReach'] as number | undefined,
      scanSpread: values?.['custom:scanSpread'] as number | undefined,
      scanTilt: values?.['custom:scanTilt'] as number | undefined,
    }
  })
  return (
    <group ref={ref}>
      <Kiosk dyn={dyn} livery={livery} flat={flat} config={actor.params as never} />
    </group>
  )
}

function CharacterActor({ actor }: { actor: ActorDef }) {
  const proxy = useStudio((s) => s.proxyCharacters)
  const ref = useRegister(actor.id)
  const frame = useSampledFrame()
  const dyn = useRef<CharacterDynamic>({})
  useFrame(() => {
    const values = frame.current[actor.id]
    applyCommon(ref.current, actor, values)
    dyn.current = {
      reach: (values?.reach as number) ?? 0,
      clipTime: values?.clipTime as number | undefined,
      reachTarget: v3(values?.['custom:reachTarget'], KIOSK_ANCHORS.scanner),
    }
  })
  const clip = (frame.current[actor.id]?.clip as string) ?? (actor.params?.clip as string | undefined)
  const tint = actor.params?.tint as string | undefined
  const height = (actor.params?.height as number) ?? 1.7
  const standIn = <ProxyCharacter dyn={dyn} tint={tint} height={height} />
  return (
    <group ref={ref}>
      {proxy || !actor.url ? (
        standIn
      ) : (
        // a missing or broken GLB falls back to the capsule stand-in instead of
        // taking the whole scene down with it
        <ActorErrorBoundary label={actor.id} fallback={standIn}>
          <Suspense fallback={standIn}>
            <Character url={actor.url} clip={clip} dyn={dyn} tint={tint} />
          </Suspense>
        </ActorErrorBoundary>
      )}
    </group>
  )
}

/** Flat Figma character art, billboarded into the scene. */
function SpriteActor({ actor }: { actor: ActorDef }) {
  const ref = useRegister(actor.id)
  const spriteLit = useStudio((s) => s.lighting.spriteLit)
  const frame = useSampledFrame()
  const dyn = useRef<BillboardDynamic>({})
  useFrame(() => {
    const values = frame.current[actor.id]
    applyCommon(ref.current, actor, values)
    dyn.current = {
      opacity: (values?.opacity as number) ?? 1,
      tilt: (values?.['custom:tilt'] as number) ?? (actor.params?.tilt as number) ?? 0.65,
    }
  })
  return (
    <group ref={ref}>
      <Billboard2D
        url={actor.url!}
        height={(actor.params?.height as number) ?? 1.7}
        pivotX={(actor.params?.pivotX as number) ?? 0.5}
        lit={(actor.params?.lit as number) ?? spriteLit}
        grade={(actor.params?.grade as string) ?? '#ffffff'}
        dyn={dyn}
      />
    </group>
  )
}

/** Flat Figma art split into hinged layers, so the arm can aim at a kiosk anchor. */
function PuppetActor({ actor }: { actor: ActorDef }) {
  const ref = useRegister(actor.id)
  const frame = useSampledFrame()
  const spriteLit = useStudio((s) => s.lighting.spriteLit)
  const dyn = useRef<CutoutRigDynamic>({})
  const grip = useRef<THREE.Object3D | null>(null)
  const registry = useStudio((s) => s.registry)
  useFrame(() => {
    const values = frame.current[actor.id]
    applyCommon(ref.current, actor, values)
    if (grip.current && registry.get(`${actor.id}:grip`) !== grip.current) {
      registry.set(`${actor.id}:grip`, grip.current)
    }
    dyn.current = {
      opacity: (values?.opacity as number) ?? 1,
      tilt: (values?.['custom:tilt'] as number) ?? (actor.params?.tilt as number) ?? 0.65,
      reach: (values?.reach as number) ?? 0,
      reachTarget: v3(values?.['custom:reachTarget'], KIOSK_ANCHORS.scanner),
      bend: (values?.['custom:bend'] as number) ?? 0,
      armOnly: (values?.['custom:armOnly'] as number) ?? 0,
    }
  })
  return (
    <group ref={ref}>
      <CutoutRig
        url={actor.url!}
        rig={CUTOUT_RIGS[(actor.params?.rig as string) ?? 'staff'] ?? CUTOUT_RIGS.staff}
        height={(actor.params?.height as number) ?? 1.78}
        pivotX={actor.params?.pivotX as number | undefined}
        lit={(actor.params?.lit as number) ?? spriteLit}
        dyn={dyn}
        gripRef={grip}
      />
    </group>
  )
}

/** The Figma staff worker (36:400) as a jointed 3D model. */
function StaffActor({ actor }: { actor: ActorDef }) {
  const ref = useRegister(actor.id)
  const frame = useSampledFrame()
  const dyn = useRef<StaffDynamic>({})
  useFrame(() => {
    const values = frame.current[actor.id]
    applyCommon(ref.current, actor, values)
    const clip = (values?.clip as string) ?? (actor.params?.clip as string | undefined)
    dyn.current = {
      reach: (values?.reach as number) ?? 0,
      reachTarget: v3(values?.['custom:reachTarget'], KIOSK_ANCHORS.scanner),
      walk: (values?.['custom:walk'] as number) ?? (clip === 'walk' ? 1 : 0),
      clipTime: values?.clipTime as number | undefined,
      holdBox: (values?.['custom:holdBox'] as boolean) ?? true,
    }
  })
  return (
    <group ref={ref}>
      <Staff3D height={(actor.params?.height as number) ?? 1.78} dyn={dyn} />
    </group>
  )
}

/**
 * How close a held prop may come to the plane its holder is drawn on, in metres.
 * Small: this is a backstop against the prop crossing the plane, not a way of pushing it
 * out of the hand.
 */
const HAND_CLEARANCE = 0.004

/**
 * Keeps a held prop behind the hand that holds it.
 *
 * The characters are cut-out art: the fist is painted on a flat plane through the grip,
 * so a prop hung off that grip is only "in the hand" while every part of it stays behind
 * that plane. It is a box, though, and it turns — the depth it takes up along the plane's
 * normal changes with every degree it rolls, from a couple of centimetres lying flat to
 * nearly ten on edge — so an offset that clears the hand in one pose has a corner through
 * the fingers in the next.
 *
 * This measures the prop's own geometry in the grip's frame each frame and, if its
 * nearest face has come through, slides it back along the grip's normal by exactly the
 * overlap. It only ever pushes away from the camera side of the plane: a prop already
 * clear is left exactly where the timeline put it, so the authored offsets are untouched.
 *
 * `custom:clamp` weights it, for the one moment it has to be let go of: at the instant the
 * case changes hands it is still standing on the shelf with her fingers around it, so it
 * genuinely crosses the plane there, and snapping it clear on that frame is the handover
 * jump the whole beat is built to avoid. The scenes ramp it in as the fingers close.
 */
function clampBehindHost(
  node: THREE.Object3D,
  host: THREE.Object3D,
  weight: number,
  world: THREE.Vector3,
  quat: THREE.Quaternion,
  frame3: THREE.Matrix4,
  inv3: THREE.Matrix4,
  corner: THREE.Vector3,
) {
  node.updateMatrixWorld(true)
  // the grip's frame without its scale: the rig is scaled to the character's height, and
  // a scaled inverse would measure the overlap in the wrong units
  host.getWorldPosition(world)
  host.getWorldQuaternion(quat)
  frame3.compose(world, quat, ONE)
  inv3.copy(frame3).invert()

  let front = -Infinity
  node.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || !mesh.visible) return
    const geo = mesh.geometry
    if (!geo.boundingBox) geo.computeBoundingBox()
    const bb = geo.boundingBox
    if (!bb) return
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z)
      corner.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv3)
      if (corner.z > front) front = corner.z
    }
  })
  if (front === -Infinity) return

  const over = front + HAND_CLEARANCE
  if (over <= 0) return
  // straight back along the grip's normal, in world space
  corner.set(0, 0, -over * weight).applyQuaternion(quat)
  node.position.add(corner)
}

const ONE = new THREE.Vector3(1, 1, 1)

function PropActor({ actor }: { actor: ActorDef }) {
  const ref = useRegister(actor.id)
  // peel, lid and emptiness are read per frame: nothing re-renders during playback, so a
  // value read at render time would only update when something else forced a commit
  const dyn = useRef<PropDynamic>({})
  const frame = useSampledFrame()
  const registry = useStudio((s) => s.registry)
  const Comp = PROP_COMPONENTS[(actor.primitive ?? 'medicineBox') as PropPrimitive]
  const world = useMemo(() => new THREE.Vector3(), [])
  const local = useMemo(() => new THREE.Vector3(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])
  const frame3 = useMemo(() => new THREE.Matrix4(), [])
  const inv3 = useMemo(() => new THREE.Matrix4(), [])
  const corner = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const values = frame.current[actor.id]
    applyCommon(ref.current, actor, values)
    dyn.current = {
      curl: values?.['custom:curl'] as number | undefined,
      open: values?.['custom:open'] as number | undefined,
      empty: values?.['custom:empty'] as number | undefined,
    }
    // `attachTo` names something in the registry — a character's hand, say — and the
    // prop rides it, with its own position track read as an offset from that point
    const attach = (values?.['custom:attachTo'] as string) ?? (actor.params?.attachTo as string | undefined)
    const host = attach ? registry.get(attach) : undefined
    if (host && ref.current) {
      host.getWorldPosition(world)
      host.getWorldQuaternion(quat)
      // the offset is expressed in the host's frame: a negative z then means "behind
      // the hand", whichever way the character happens to be facing
      const offset = v3(values?.position, actor.position ?? [0, 0, 0])
      local.set(offset[0], offset[1], offset[2]).applyQuaternion(quat)
      ref.current.position.copy(world).add(local)
      ref.current.quaternion.copy(quat)
      const rot = v3(values?.rotation, actor.rotation ?? [0, 0, 0])
      ref.current.rotateX(rot[0])
      ref.current.rotateY(rot[1])
      ref.current.rotateZ(rot[2])
      /*
       * Props meant to sit in front of the hand — the printed label she holds up — are
       * authored with a positive offset, and are left alone.
       */
      const clamp = (values?.['custom:clamp'] as number) ?? 1
      if (offset[2] < 0 && clamp > 0) {
        clampBehindHost(ref.current, host, clamp, world, quat, frame3, inv3, corner)
      }
    }
  })
  // the sticker reads its peel from the timeline; other primitives ignore it
  return (
    // named so a pose can be read back off a specific prop: the graph is rebuilt as
    // actors come and go, so position in the tree is not an identity
    <group ref={ref} name={actor.id}>
      <Comp dyn={dyn} />
    </group>
  )
}

function CameraRig({ scene }: { scene: SceneDef }) {
  const frame = useSampledFrame()
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const root = useThree((s) => s.scene)
  const target = useRef(new THREE.Vector3(...scene.camera.target))

  // The Figma frame puts the 3D card right of centre; shift the projection so the
  // subject lands inside that card instead of the middle of the render.
  useEffect(() => {
    const [w, h] = scene.size
    const cardCentre = (LAYOUT.card.x + LAYOUT.card.w / 2) / LAYOUT.frame.w
    const offsetX = (cardCentre - 0.5) * w
    camera.setViewOffset(w, h, -offsetX, 0, w, h)
    camera.updateProjectionMatrix()
    return () => {
      camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  }, [camera, scene.size])
  useFrame(() => {
    const cam = frame.current.camera
    const tgt = frame.current.target
    const pos = v3(cam?.position, scene.camera.position)
    camera.position.set(pos[0], pos[1], pos[2])
    const fov = (cam?.custom_fov as number) ?? (cam?.['custom:fov'] as number) ?? scene.camera.fov
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    const tp = v3(tgt?.position, scene.camera.target)
    target.current.set(tp[0], tp[1], tp[2])
    camera.lookAt(target.current)
    if (import.meta.env.DEV) {
      // dev probe: lets the screenshot harness see what the camera is actually doing
      ;(window as unknown as { __camObj?: unknown }).__camObj = camera
      // the camera is not parented into the scene, so the harness needs the root itself
      // to read a pose off the rig
      ;(window as unknown as { __scene?: unknown }).__scene = root
      ;(window as unknown as { __cam?: unknown }).__cam = {
        fov: camera.fov,
        aspect: +camera.aspect.toFixed(4),
        pos: camera.position.toArray().map((n) => +n.toFixed(3)),
        view: camera.view ? { ...camera.view } : null,
      }
    }
  })
  return null
}

/** Samples the timeline once per frame, then lets every actor read from the result. */
export function SceneRuntime({ scene, orbit }: { scene: SceneDef; orbit: boolean }) {
  const lighting = useStudio((s) => s.lighting)
  const frame = useRef<SampledFrame>({})
  useFrame(() => {
    frame.current = sampleScene(scene.tracks, useStudio.getState().time)
  }, -1)

  return (
    <FrameCtx.Provider value={frame}>
      <StudioStage config={lighting} />
      {!orbit && <CameraRig scene={scene} />}
      {scene.actors.map((actor) => {
        if (actor.kind === 'kiosk') return <KioskActor key={actor.id} actor={actor} />
        if (actor.kind === 'character') return <CharacterActor key={actor.id} actor={actor} />
        if (actor.kind === 'sprite') return <SpriteActor key={actor.id} actor={actor} />
        if (actor.kind === 'puppet') return <PuppetActor key={actor.id} actor={actor} />
        if (actor.kind === 'staff') return <StaffActor key={actor.id} actor={actor} />
        if (actor.kind === 'prop') return <PropActor key={actor.id} actor={actor} />
        return null
      })}
    </FrameCtx.Provider>
  )
}
