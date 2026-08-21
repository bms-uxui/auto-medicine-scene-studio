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
import { StaffRig, type StaffRigDynamic } from './StaffRig'
import { ActorErrorBoundary } from '../studio/ErrorBoundary'
import { PROP_COMPONENTS, type PropPrimitive } from './Props'
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
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of materials) {
        const mat = m as THREE.MeshStandardMaterial
        mat.transparent = opacity < 0.999
        mat.opacity = opacity
        mat.depthWrite = opacity > 0.99
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
      screenState: (values?.['custom:screenState'] as KioskDynamic['screenState']) ?? 'welcome',
      doorOpen: (values?.['custom:doorOpen'] as number) ?? 0,
      scanGlow: (values?.['custom:scanGlow'] as number) ?? 0,
      cameraGlow: (values?.['custom:cameraGlow'] as number) ?? 0,
      stickerFeed: (values?.['custom:stickerFeed'] as number) ?? 0,
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
  const flat = useStudio((s) => s.flatKiosk)
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
        lit={(actor.params?.lit as number) ?? (flat ? Math.min(spriteLit, 0.18) : spriteLit)}
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
  const flat = useStudio((s) => s.flatKiosk)
  const dyn = useRef<StaffRigDynamic>({})
  useFrame(() => {
    const values = frame.current[actor.id]
    applyCommon(ref.current, actor, values)
    dyn.current = {
      opacity: (values?.opacity as number) ?? 1,
      tilt: (values?.['custom:tilt'] as number) ?? (actor.params?.tilt as number) ?? 0.65,
      reach: (values?.reach as number) ?? 0,
      reachTarget: v3(values?.['custom:reachTarget'], KIOSK_ANCHORS.scanner),
    }
  })
  return (
    <group ref={ref}>
      <StaffRig
        url={actor.url!}
        height={(actor.params?.height as number) ?? 1.78}
        pivotX={(actor.params?.pivotX as number) ?? 0.393}
        lit={(actor.params?.lit as number) ?? (flat ? Math.min(spriteLit, 0.18) : spriteLit)}
        dyn={dyn}
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

function PropActor({ actor }: { actor: ActorDef }) {
  const ref = useRegister(actor.id)
  const frame = useSampledFrame()
  const Comp = PROP_COMPONENTS[(actor.primitive ?? 'medicineBox') as PropPrimitive]
  useFrame(() => {
    applyCommon(ref.current, actor, frame.current[actor.id])
  })
  return (
    <group ref={ref}>
      <Comp />
    </group>
  )
}

function CameraRig({ scene }: { scene: SceneDef }) {
  const frame = useSampledFrame()
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
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
