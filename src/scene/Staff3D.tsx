import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'

/**
 * The staff worker from the Figma illustration (node 36:400), sculpted in 3D.
 *
 * Proportions and palette come straight from that artwork: yellow bib overalls over a
 * teal tee, a yellow cap, dark boots, and a medicine box carried in the right hand.
 * The body is a joint hierarchy (hips -> chest -> shoulders -> arms, hips -> legs) so
 * the timeline can drive a walk cycle and an arm reach without a skinned mesh.
 */

/** palette lifted from the Figma export */
export const STAFF_COLORS = {
  overallLight: '#f8b10c',
  overallDark: '#f2a00f',
  shirt: '#2bc7ad',
  shirtShade: '#1d8674',
  skin: '#fabeaf',
  skinShade: '#f9aa9a',
  hair: '#3f1715',
  boot: '#3f1715',
  boxBody: '#e8ebee',
  boxShade: '#afafaf',
  boxLabel: '#1964ef',
  boxLabelDark: '#0c43ab',
}

/** every measurement below is in metres for a 1.78 m figure */
const M = {
  hip: 0.95,
  chest: 1.3,
  shoulderY: 1.42,
  shoulderX: 0.19,
  neck: 1.52,
  headY: 1.63,
  headR: 0.115,
  upperArm: 0.28,
  foreArm: 0.26,
  thigh: 0.45,
  shin: 0.44,
  ankle: 0.07,
}

export interface StaffDynamic {
  /** 0 = arm at rest, 1 = fully extended at `reachTarget` */
  reach?: number
  /** world-space point the right hand aims at */
  reachTarget?: [number, number, number]
  /** 0 = standing, 1 = full walk cycle */
  walk?: number
  /** seconds along the gait; falls back to the render clock */
  clipTime?: number
  /** the medicine box in the right hand */
  holdBox?: boolean
}

function useFlat(color: string, roughness = 0.72) {
  return useMemo(() => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }), [color, roughness])
}

/** the white/blue package the worker carries */
function MedicineBox({ material, label, labelDark }: { material: THREE.Material; label: THREE.Material; labelDark: THREE.Material }) {
  return (
    <group>
      <RoundedBox args={[0.21, 0.055, 0.11]} radius={0.012} smoothness={3} material={material} />
      {/* printed band + barcode stripe, matching the box art */}
      <RoundedBox args={[0.215, 0.03, 0.028]} radius={0.008} smoothness={3} position={[0, 0.001, 0.042]} material={label} />
      <mesh position={[-0.06, 0.029, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.06, 0.05]} />
        <primitive object={labelDark} attach="material" />
      </mesh>
    </group>
  )
}

export function Staff3D({
  height = 1.78,
  dyn,
  ...props
}: {
  /** world height in metres */
  height?: number
  dyn?: React.RefObject<StaffDynamic>
} & React.ComponentProps<'group'>) {
  const skin = useFlat(STAFF_COLORS.skin, 0.8)
  const skinShade = useFlat(STAFF_COLORS.skinShade, 0.8)
  const shirt = useFlat(STAFF_COLORS.shirt, 0.85)
  const shirtShade = useFlat(STAFF_COLORS.shirtShade, 0.85)
  const overall = useFlat(STAFF_COLORS.overallLight, 0.85)
  const overallDark = useFlat(STAFF_COLORS.overallDark, 0.85)
  const hair = useFlat(STAFF_COLORS.hair, 0.9)
  const boot = useFlat(STAFF_COLORS.boot, 0.7)
  const boxBody = useFlat(STAFF_COLORS.boxBody, 0.55)
  const boxLabel = useFlat(STAFF_COLORS.boxLabel, 0.5)
  const boxLabelDark = useFlat(STAFF_COLORS.boxLabelDark, 0.5)

  const root = useRef<THREE.Group>(null)
  const chest = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const elbowR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const elbowL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const kneeR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const kneeL = useRef<THREE.Group>(null)
  const boxRef = useRef<THREE.Group>(null)

  const aim = useMemo(() => new THREE.Vector3(), [])
  const local = useMemo(() => new THREE.Vector3(), [])
  const inv = useMemo(() => new THREE.Matrix4(), [])
  const restQ = useMemo(() => new THREE.Quaternion(), [])
  const aimQ = useMemo(() => new THREE.Quaternion(), [])
  const DOWN = useMemo(() => new THREE.Vector3(0, -1, 0), [])

  useFrame((state) => {
    const d = dyn?.current ?? {}
    const reach = THREE.MathUtils.clamp(d.reach ?? 0, 0, 1)
    const walk = THREE.MathUtils.clamp(d.walk ?? 0, 0, 1)
    const t = d.clipTime ?? state.clock.elapsedTime

    // gait: a 1.1 s cycle, legs opposed, free arm counter-swinging
    const phase = t * (Math.PI * 2) / 1.1
    const swing = Math.sin(phase) * 0.62 * walk
    const lift = Math.max(0, Math.sin(phase)) * 0.5 * walk
    if (legR.current) legR.current.rotation.x = swing
    if (legL.current) legL.current.rotation.x = -swing
    if (kneeR.current) kneeR.current.rotation.x = lift
    if (kneeL.current) kneeL.current.rotation.x = Math.max(0, -Math.sin(phase)) * 0.5 * walk
    if (root.current) root.current.position.y = Math.abs(Math.sin(phase)) * 0.018 * walk

    // idle breathing keeps the figure alive when it is standing still
    if (chest.current) {
      chest.current.rotation.x = Math.sin(t * 1.6) * 0.012 * (1 - walk * 0.7)
      chest.current.rotation.y = swing * -0.18
    }
    if (head.current) head.current.rotation.y = Math.sin(t * 0.8) * 0.05 * (1 - walk)

    // left arm only counter-swings; the right arm is reserved for the reach
    if (armL.current) armL.current.rotation.x = -swing * 0.7
    if (elbowL.current) elbowL.current.rotation.x = 0.25 + lift * 0.3

    // right arm: rest pose blended toward an aim at the target point
    const arm = armR.current
    if (arm) {
      restQ.setFromEuler(new THREE.Euler(swing * 0.7, 0, -0.12))
      const target = d.reachTarget
      if (reach > 0.001 && target) {
        aim.set(target[0], target[1], target[2])
        // the shoulder's parent frame is what the rotation has to be expressed in
        arm.updateWorldMatrix(true, false)
        inv.copy(arm.matrixWorld).invert()
        local.copy(aim).applyMatrix4(inv).normalize()
        aimQ.setFromUnitVectors(DOWN, local)
        arm.quaternion.copy(restQ).slerp(restQ.clone().multiply(aimQ), reach)
      } else {
        arm.quaternion.copy(restQ)
      }
    }
    if (elbowR.current) elbowR.current.rotation.x = THREE.MathUtils.lerp(0.3 - swing * 0.3, -0.12, reach)
    if (boxRef.current) boxRef.current.visible = d.holdBox ?? true
  })

  return (
    <group {...props} scale={height / 1.78}>
      <group ref={root}>
        {/* ---- legs ---- */}
        {([1, -1] as const).map((side) => {
          const hipRef = side === 1 ? legR : legL
          const kneeRef = side === 1 ? kneeR : kneeL
          return (
            <group key={side} ref={hipRef} position={[0.1 * side, M.hip - 0.06, 0]}>
              <mesh position={[0, -M.thigh / 2, 0]} castShadow material={overall}>
                <capsuleGeometry args={[0.088, M.thigh - 0.12, 4, 12]} />
              </mesh>
              <group ref={kneeRef} position={[0, -M.thigh, 0]}>
                <mesh position={[0, -M.shin / 2, 0]} castShadow material={overallDark}>
                  <capsuleGeometry args={[0.075, M.shin - 0.14, 4, 12]} />
                </mesh>
                {/* boot */}
                <RoundedBox
                  args={[0.12, 0.09, 0.24]}
                  radius={0.035}
                  smoothness={3}
                  position={[0, -M.shin - M.ankle + 0.03, 0.045]}
                  castShadow
                  material={boot}
                />
              </group>
            </group>
          )
        })}

        {/* ---- hips / overall seat ---- */}
        <RoundedBox args={[0.34, 0.26, 0.25]} radius={0.07} smoothness={4} position={[0, M.hip, 0]} castShadow material={overall} />

        {/* ---- torso ---- */}
        <group ref={chest} position={[0, M.hip + 0.02, 0]}>
          {/* teal tee */}
          <RoundedBox args={[0.37, 0.4, 0.24]} radius={0.09} smoothness={4} position={[0, 0.2, 0]} castShadow material={shirt} />
          {/* bib and straps of the overalls, sitting proud of the shirt */}
          <RoundedBox args={[0.22, 0.24, 0.02]} radius={0.02} smoothness={3} position={[0, 0.2, 0.115]} material={overall} />
          <RoundedBox args={[0.11, 0.09, 0.012]} radius={0.012} smoothness={3} position={[-0.03, 0.235, 0.13]} material={overallDark} />
          {([1, -1] as const).map((side) => (
            <RoundedBox
              key={side}
              args={[0.05, 0.3, 0.02]}
              radius={0.012}
              smoothness={3}
              position={[0.085 * side, 0.28, 0.1 * (side === 1 ? 1 : 1)]}
              rotation={[0.12, 0, -0.06 * side]}
              material={overall}
            />
          ))}
          {/* the straps continue over the shoulders to the back */}
          {([1, -1] as const).map((side) => (
            <RoundedBox
              key={`b${side}`}
              args={[0.05, 0.26, 0.02]}
              radius={0.012}
              smoothness={3}
              position={[0.085 * side, 0.27, -0.1]}
              rotation={[-0.1, 0, -0.06 * side]}
              material={overallDark}
            />
          ))}

          {/* ---- arms ---- */}
          {([1, -1] as const).map((side) => {
            const shoulderRef = side === 1 ? armR : armL
            const elbRef = side === 1 ? elbowR : elbowL
            return (
              <group key={side} ref={shoulderRef} position={[M.shoulderX * side, M.shoulderY - M.hip - 0.02, 0]}>
                {/* short teal sleeve */}
                <mesh position={[0, -0.07, 0]} castShadow material={side === 1 ? shirt : shirtShade}>
                  <capsuleGeometry args={[0.072, 0.09, 4, 12]} />
                </mesh>
                <mesh position={[0, -M.upperArm / 2 - 0.04, 0]} castShadow material={skin}>
                  <capsuleGeometry args={[0.052, M.upperArm - 0.12, 4, 12]} />
                </mesh>
                <group ref={elbRef} position={[0, -M.upperArm, 0]}>
                  <mesh position={[0, -M.foreArm / 2, 0]} castShadow material={side === 1 ? skin : skinShade}>
                    <capsuleGeometry args={[0.046, M.foreArm - 0.1, 4, 12]} />
                  </mesh>
                  {/* hand */}
                  <mesh position={[0, -M.foreArm - 0.03, 0]} castShadow material={skin}>
                    <sphereGeometry args={[0.055, 16, 12]} />
                  </mesh>
                  {side === 1 && (
                    <group ref={boxRef} position={[0, -M.foreArm - 0.06, 0.03]} rotation={[0, 0, 0]}>
                      <MedicineBox material={boxBody} label={boxLabel} labelDark={boxLabelDark} />
                    </group>
                  )}
                </group>
              </group>
            )
          })}

          {/* ---- head ---- */}
          <group ref={head} position={[0, M.neck - M.hip - 0.02, 0]}>
            <mesh position={[0, 0.02, 0]} castShadow material={skin}>
              <capsuleGeometry args={[0.045, 0.05, 4, 10]} />
            </mesh>
            <mesh position={[0, M.headY - M.neck + 0.02, 0]} scale={[1, 1.08, 1.02]} castShadow material={skin}>
              <sphereGeometry args={[M.headR, 24, 18]} />
            </mesh>
            {/* hair at the back and sides, cap on top */}
            <mesh position={[0, M.headY - M.neck + 0.03, -0.03]} scale={[1.02, 1.0, 1.0]} material={hair}>
              <sphereGeometry args={[M.headR * 0.99, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            </mesh>
            <mesh position={[0, M.headY - M.neck + 0.05, 0]} scale={[1.06, 0.9, 1.06]} castShadow material={overall}>
              <sphereGeometry args={[M.headR, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            {/* cap brim */}
            <RoundedBox
              args={[0.19, 0.022, 0.13]}
              radius={0.01}
              smoothness={3}
              position={[0, M.headY - M.neck + 0.05, 0.095]}
              rotation={[0.12, 0, 0]}
              castShadow
              material={overallDark}
            />
          </group>
        </group>
      </group>
    </group>
  )
}
