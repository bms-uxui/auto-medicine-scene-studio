import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { BRAND } from './textures'

function labelTexture(lines: string[], accent = BRAND.blue) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 320
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 512, 320)
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 512, 54)
  ctx.fillStyle = '#fff'
  ctx.font = '700 30px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText(lines[0] ?? '', 22, 38)
  ctx.fillStyle = '#5b6672'
  ctx.font = '400 24px Inter, Helvetica, Arial, sans-serif'
  lines.slice(1).forEach((l, i) => ctx.fillText(l, 22, 104 + i * 40))
  ctx.strokeStyle = '#dde3ec'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, 508, 316)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Medicine box the machine dispenses. */
export function MedicineBox(props: React.ComponentProps<'group'>) {
  const label = useMemo(() => labelTexture(['Lorem 100 mg', 'Take 1 tablet after meals', 'Qty 30'], BRAND.blue), [])
  return (
    <group {...props}>
      <RoundedBox args={[0.11, 0.16, 0.05]} radius={0.006} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.55} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0255]}>
        <planeGeometry args={[0.1, 0.14]} />
        <meshStandardMaterial map={label} roughness={0.6} />
      </mesh>
    </group>
  )
}

/** Peel-off medicine sticker used in the "apply the sticker" beat. */
export function Sticker({ curl = 0, ...props }: { curl?: number } & React.ComponentProps<'group'>) {
  const label = useMemo(() => labelTexture(['Lorem 100', 'Patient: Somchai J.', 'HN 000123'], BRAND.blue), [])
  const geo = useMemo(() => new THREE.PlaneGeometry(0.1, 0.06, 24, 4), [])
  const bent = useMemo(() => {
    const g = geo.clone()
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const u = (x + 0.05) / 0.1
      pos.setZ(i, Math.pow(u, 2) * curl * 0.06)
      pos.setX(i, x - Math.pow(u, 2) * curl * 0.02)
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
    return g
  }, [geo, curl])
  return (
    <group {...props}>
      <mesh geometry={bent} castShadow>
        <meshStandardMaterial map={label} side={THREE.DoubleSide} roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Phone showing the patient app, used for the QR beat and the closing shot. */
export function Phone({ screen, ...props }: { screen?: THREE.Texture } & React.ComponentProps<'group'>) {
  return (
    <group {...props}>
      <RoundedBox args={[0.075, 0.155, 0.009]} radius={0.008} smoothness={4} castShadow>
        <meshStandardMaterial color="#1b1f27" roughness={0.35} metalness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[0.068, 0.144]} />
        {screen ? (
          <meshStandardMaterial map={screen} emissiveMap={screen} emissive="#fff" emissiveIntensity={0.5} toneMapped={false} />
        ) : (
          <meshStandardMaterial color="#dfe6f0" emissive="#8fa6c8" emissiveIntensity={0.3} />
        )}
      </mesh>
    </group>
  )
}

/** Printed order slip with a QR code the patient holds up to the scanner. */
export function QrCard(props: React.ComponentProps<'group'>) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = '#111'
    // deterministic pseudo-QR pattern
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        if (rnd() > 0.5) ctx.fillRect(24 + x * 9.9, 24 + y * 9.9, 9.9, 9.9)
      }
    }
    for (const [ox, oy] of [[24, 24], [154, 24], [24, 154]]) {
      ctx.fillStyle = '#fff'; ctx.fillRect(ox, oy, 78, 78)
      ctx.fillStyle = '#111'; ctx.fillRect(ox, oy, 78, 78)
      ctx.fillStyle = '#fff'; ctx.fillRect(ox + 12, oy + 12, 54, 54)
      ctx.fillStyle = '#111'; ctx.fillRect(ox + 24, oy + 24, 30, 30)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <group {...props}>
      <mesh castShadow>
        <boxGeometry args={[0.09, 0.12, 0.001]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.005, 0.0008]}>
        <planeGeometry args={[0.06, 0.06]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
    </group>
  )
}

export const PROP_COMPONENTS = {
  medicineBox: MedicineBox,
  sticker: Sticker,
  phone: Phone,
  qrCard: QrCard,
} as const

export type PropPrimitive = keyof typeof PROP_COMPONENTS
