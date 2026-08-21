import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useFrame } from '@react-three/fiber'

export interface CharacterProps extends React.ComponentProps<'group'> {
  url: string
  /** animation clip name from the GLB, or from a merged Mixamo clip */
  clip?: string
  /** mutable per-frame state written by the timeline (no React re-render) */
  dyn?: React.RefObject<CharacterDynamic>
  /** rest pose applied when the GLB ships no animation clips (scans, RPM avatars) */
  posed?: boolean
  tint?: string
}

/** Mixamo exports prefix every bone; Ready Player Me and most scans do not. */
const BONE_PREFIXES = ['mixamorig', 'mixamorig:', '']

const BONE_ROLES = {
  upperArmR: 'RightArm',
  foreArmR: 'RightForeArm',
  handR: 'RightHand',
  upperArmL: 'LeftArm',
  foreArmL: 'LeftForeArm',
  spine: 'Spine1',
  head: 'Head',
} as const

type BoneRole = keyof typeof BONE_ROLES

/**
 * Skinned character with a two-bone aim override on the right arm so the hand can
 * land exactly on a kiosk anchor regardless of which body clip is playing.
 */
export interface CharacterDynamic {
  /** when set, the clip is scrubbed by the timeline instead of running free */
  clipTime?: number
  /** 0..1 blend of the right-arm aim override toward reachTarget */
  reach?: number
  reachTarget?: [number, number, number]
}

export function Character({ url, clip, dyn, posed, tint, ...props }: CharacterProps) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(url)
  const cloned = useMemo(() => {
    const copy = cloneSkeleton(scene)
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      if (tint) {
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
        mat.color = new THREE.Color(tint)
        mesh.material = mat
      }
    })
    return copy
  }, [scene, tint])

  const { actions, mixer } = useAnimations(animations, group)

  const bones = useRef<Partial<Record<BoneRole, THREE.Bone>>>({})
  useEffect(() => {
    const byName = new Map<string, THREE.Bone>()
    cloned.traverse((o) => {
      const bone = o as THREE.Bone
      if (bone.isBone) byName.set(bone.name, bone)
    })
    const found: Partial<Record<BoneRole, THREE.Bone>> = {}
    for (const [role, base] of Object.entries(BONE_ROLES) as Array<[BoneRole, string]>) {
      for (const prefix of BONE_PREFIXES) {
        const hit = byName.get(prefix + base)
        if (hit) {
          found[role] = hit
          break
        }
      }
    }
    bones.current = found
    // scans and RPM avatars arrive in an A-pose; drop the arms to a natural stance
    if (posed !== false) {
      if (found.upperArmR) found.upperArmR.rotation.set(0.05, 0, -0.62)
      if (found.upperArmL) found.upperArmL.rotation.set(0.05, 0, 0.62)
      if (found.foreArmR) found.foreArmR.rotation.set(0, 0, -0.12)
      if (found.foreArmL) found.foreArmL.rotation.set(0, 0, 0.12)
    }
  }, [cloned, posed])

  /** rigs name clips differently (idle vs Idle vs mixamo.com) — resolve loosely */
  const resolved = useMemo(() => {
    if (!clip) return undefined
    const names = Object.keys(actions)
    return (
      names.find((n) => n === clip) ??
      names.find((n) => n.toLowerCase() === clip.toLowerCase()) ??
      names.find((n) => n.toLowerCase().includes(clip.toLowerCase())) ??
      names[0]
    )
  }, [actions, clip])

  useEffect(() => {
    if (!resolved) return
    const action = actions[resolved]
    if (!action) return
    action.reset().fadeIn(0.25).play()
    return () => { action.fadeOut(0.2) }
  }, [actions, resolved])

  const world = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const parentQ = useMemo(() => new THREE.Quaternion(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((state, dt) => {
    const d = dyn?.current ?? {}
    const clipTime = d.clipTime
    const reach = d.reach ?? 0
    const reachTarget = d.reachTarget ?? [0, 1, 0]
    // scrubbed playback keeps exports deterministic; free playback is used while authoring
    if (resolved && clipTime !== undefined) {
      const action = actions[resolved]
      if (action) {
        action.paused = true
        action.time = clipTime % (action.getClip().duration || 1)
        mixer.update(0)
      }
    } else {
      mixer.update(dt)
    }

    // idle breathing keeps a clip-less scan from reading as a mannequin
    const spine = bones.current.spine
    if (spine && !resolved) {
      const t = state.clock.elapsedTime
      spine.rotation.x = Math.sin(t * 1.1) * 0.012
      spine.rotation.y = Math.sin(t * 0.42) * 0.02
    }

    const upper = bones.current.upperArmR
    if (!upper || reach <= 0.001) return
    // aim the upper arm at the world-space target, blended by `reach`
    upper.parent?.getWorldQuaternion(parentQ)
    world.set(reachTarget[0], reachTarget[1], reachTarget[2])
    upper.getWorldPosition(dir)
    dir.subVectors(world, dir).normalize()
    dir.applyQuaternion(parentQ.invert())
    q.setFromUnitVectors(up, dir)
    upper.quaternion.slerp(q, THREE.MathUtils.clamp(reach, 0, 1))
    const fore = bones.current.foreArmR
    if (fore) fore.rotation.x = THREE.MathUtils.lerp(fore.rotation.x, -0.35, reach)
  })

  return (
    <group ref={group} {...props}>
      <primitive object={cloned} />
    </group>
  )
}

// warm the loader so the first scene switch does not pop
useGLTF.preload('/models/patient_tham.glb')
