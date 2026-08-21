import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { CharacterDynamic } from './Character'

/**
 * Lightweight stand-in for a rigged character: capsule torso, sphere head and a
 * two-segment right arm that aims at the reach target. Used for blocking, for
 * low-end machines, and anywhere skinned GLBs are too heavy to render.
 */
export function ProxyCharacter({
  dyn,
  tint = '#7fd3ea',
  height = 1.7,
  ...props
}: { dyn?: React.RefObject<CharacterDynamic>; tint?: string; height?: number } & React.ComponentProps<'group'>) {
  const shoulder = useRef<THREE.Group>(null)
  const elbow = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const targetV = useMemo(() => new THREE.Vector3(), [])
  const localV = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const down = useMemo(() => new THREE.Vector3(0, -1, 0), [])

  const skin = '#f2c9a8'
  const shoulderY = height * 0.82
  const upperLen = height * 0.17
  const foreLen = height * 0.16

  useFrame((state) => {
    const d = dyn?.current ?? {}
    const reach = d.reach ?? 0
    const t = d.clipTime ?? state.clock.elapsedTime
    // idle sway keeps the proxy from reading as a frozen mannequin
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.6) * 0.006
      body.current.rotation.y = Math.sin(t * 0.8) * 0.03
    }
    if (!shoulder.current) return
    const rest = new THREE.Euler(0.12, 0, 0.06)
    if (reach > 0.001 && d.reachTarget) {
      shoulder.current.getWorldPosition(localV)
      targetV.set(d.reachTarget[0], d.reachTarget[1], d.reachTarget[2]).sub(localV)
      const parent = shoulder.current.parent
      if (parent) targetV.applyQuaternion(parent.getWorldQuaternion(q).invert())
      targetV.normalize()
      q.setFromUnitVectors(down, targetV)
      shoulder.current.quaternion.slerp(q, reach)
      if (elbow.current) elbow.current.rotation.x = THREE.MathUtils.lerp(elbow.current.rotation.x, -0.25, reach)
    } else {
      shoulder.current.quaternion.slerp(new THREE.Quaternion().setFromEuler(rest), 0.15)
      if (elbow.current) elbow.current.rotation.x = THREE.MathUtils.lerp(elbow.current.rotation.x, -0.15, 0.15)
    }
  })

  return (
    <group {...props}>
      <group ref={body}>
        {/* legs */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * height * 0.055, height * 0.22, 0]} castShadow>
            <capsuleGeometry args={[height * 0.052, height * 0.4, 4, 12]} />
            <meshStandardMaterial color="#3d4759" roughness={0.8} />
          </mesh>
        ))}
        {/* torso */}
        <mesh position={[0, height * 0.63, 0]} castShadow>
          <capsuleGeometry args={[height * 0.12, height * 0.3, 6, 16]} />
          <meshStandardMaterial color={tint} roughness={0.7} />
        </mesh>
        {/* head */}
        <mesh position={[0, height * 0.94, 0]} castShadow>
          <sphereGeometry args={[height * 0.085, 24, 20]} />
          <meshStandardMaterial color={skin} roughness={0.75} />
        </mesh>
        {/* left arm, static */}
        <group position={[-height * 0.15, shoulderY, 0]} rotation={[0.12, 0, -0.1]}>
          <mesh position={[0, -upperLen / 2, 0]} castShadow>
            <capsuleGeometry args={[height * 0.035, upperLen, 4, 12]} />
            <meshStandardMaterial color={tint} roughness={0.7} />
          </mesh>
          <mesh position={[0, -upperLen - foreLen / 2, 0]} castShadow>
            <capsuleGeometry args={[height * 0.03, foreLen, 4, 12]} />
            <meshStandardMaterial color={skin} roughness={0.75} />
          </mesh>
        </group>
        {/* right arm, aimed by the timeline */}
        <group ref={shoulder} position={[height * 0.15, shoulderY, 0]}>
          <mesh position={[0, -upperLen / 2, 0]} castShadow>
            <capsuleGeometry args={[height * 0.035, upperLen, 4, 12]} />
            <meshStandardMaterial color={tint} roughness={0.7} />
          </mesh>
          <group ref={elbow} position={[0, -upperLen, 0]}>
            <mesh position={[0, -foreLen / 2, 0]} castShadow>
              <capsuleGeometry args={[height * 0.03, foreLen, 4, 12]} />
              <meshStandardMaterial color={skin} roughness={0.75} />
            </mesh>
            <mesh position={[0, -foreLen - height * 0.02, 0]} castShadow>
              <sphereGeometry args={[height * 0.033, 16, 12]} />
              <meshStandardMaterial color={skin} roughness={0.75} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
