import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { BRAND } from './textures'
import { textureFromImage } from './artTexture'

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


/**
 * The pharmacy label as it is actually printed: hospital line, HN, patient name, the drug
 * and strength, then the dosage in capitals — matching the printed slip the client
 * photographed. Portrait-printed on a landscape sticker, so the text runs across it.
 */
function stickerTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 620
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fbfbf7'
  ctx.fillRect(0, 0, 1024, 620)
  ctx.strokeStyle = '#d9dbd4'
  ctx.lineWidth = 5
  ctx.strokeRect(3, 3, 1018, 614)

  ctx.fillStyle = '#4b5560'
  ctx.font = '400 26px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('AUTOMATED MEDICINE DISPENSER', 52, 74)
  ctx.fillText('HN 5850430', 52, 118)

  ctx.fillStyle = '#161c24'
  ctx.font = '600 46px "Noto Sans Thai", Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('Name  นายทดสอบ ระบบ', 52, 196)

  ctx.font = '700 44px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('BROMHEXINE 8 mg', 52, 286)

  ctx.font = '600 40px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('TAKE 1 TABLET', 52, 372)
  ctx.fillText('3 TIMES A DAY', 52, 424)
  ctx.fillStyle = '#4b5560'
  ctx.font = '400 32px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('AFTER BREAKFAST  LUNCH  DINNER', 52, 480)

  ctx.fillStyle = '#161c24'
  ctx.font = '600 30px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('MUCOLYTIC', 52, 560)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/**
 * Carton artwork for the dispensed package, drawn to match the design file's box
 * (74:4528): a blue block with the product name reversed out of it, dosage lines under
 * it, and a barcode at the foot.
 */
function cartonTexture(name: string, strength: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f4f7fa'
  ctx.fillRect(0, 0, 512, 1024)

  // the blue field the design uses across most of the face
  ctx.fillStyle = BRAND.blue
  ctx.fillRect(0, 0, 512, 620)
  ctx.fillStyle = '#0c43ab'
  ctx.fillRect(0, 560, 512, 60)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 78px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText(name, 44, 250)
  ctx.font = '500 52px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText(strength, 44, 330)
  ctx.globalAlpha = 0.75
  ctx.font = '400 34px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('film-coated tablets', 44, 400)
  ctx.fillText('30 tablets', 44, 450)
  ctx.globalAlpha = 1

  // dosage block
  ctx.fillStyle = '#5b6672'
  ctx.font = '400 32px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('Take 1 tablet after meals', 44, 720)
  ctx.fillText('Store below 30°C', 44, 770)

  // barcode
  let x = 44
  ctx.fillStyle = '#1b2430'
  for (let i = 0; i < 46; i++) {
    const w = 3 + ((i * 7) % 4) * 3
    ctx.fillRect(x, 850, w, 96)
    x += w + 5
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/**
 * The dispensed package as real geometry: a carton with the printed face on the front
 * and back, the blue of the artwork wrapping the sides, and a soft edge so it catches
 * the studio light like a physical box.
 */
export function MedicinePackage(props: React.ComponentProps<'group'>) {
  const face = useMemo(() => cartonTexture('Lorem', '100 mg'), [])
  useEffect(() => () => face.dispose(), [face])
  const W = 0.062
  const H = 0.128
  const D = 0.034
  return (
    <group {...props}>
      <RoundedBox args={[W, H, D]} radius={0.0035} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#e9eef4" roughness={0.62} metalness={0} />
      </RoundedBox>
      {/* printed faces, a hair proud of the carton so they never z-fight */}
      {([1, -1] as const).map((side) => (
        <mesh key={side} position={[0, 0, (side * D) / 2 + side * 0.0006]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial map={face} roughness={0.6} metalness={0} />
        </mesh>
      ))}
      {/* the blue wraps around the sides of the carton */}
      {([1, -1] as const).map((side) => (
        <mesh key={`s${side}`} position={[(side * W) / 2 + side * 0.0006, H * 0.06, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
          <planeGeometry args={[D, H * 0.62]} />
          <meshStandardMaterial color={BRAND.blue} roughness={0.6} metalness={0} />
        </mesh>
      ))}
    </group>
  )
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
  const label = useMemo(() => stickerTexture(), [])
  const geo = useMemo(() => new THREE.PlaneGeometry(0.1, 0.061, 24, 4), [])
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

/**
 * A prop that is flat Figma art rather than geometry — the medicine box (74:4528), for
 * instance. It faces the shot like the characters do, so a 2D prop in a 2D hand reads
 * as one drawing.
 */
export function FlatArtProp({
  url,
  width,
  ...props
}: { url: string; width: number } & React.ComponentProps<'group'>) {
  const [art, setArt] = useState<{ tex: THREE.Texture; aspect: number } | null>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const aspect = img.naturalWidth / img.naturalHeight
      setArt({ tex: textureFromImage(img, 512, aspect), aspect })
    }
    img.src = url
    return () => {
      cancelled = true
    }
  }, [url])
  useEffect(() => () => art?.tex.dispose(), [art])

  useFrame(() => {
    if (mesh.current) mesh.current.quaternion.copy(camera.quaternion)
  })

  if (!art) return null
  return (
    <group {...props}>
      <mesh ref={mesh}>
        <planeGeometry args={[width, width / art.aspect]} />
        <meshStandardMaterial
          map={art.tex}
          emissive="#ffffff"
          emissiveMap={art.tex}
          emissiveIntensity={0}
          roughness={0.9}
          metalness={0}
          alphaTest={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

/** the medicine box as drawn in the design file */
export function MedicineBoxArt(props: React.ComponentProps<'group'>) {
  return <FlatArtProp url="/textures/props/medicine-box.svg" width={0.16} {...props} />
}


/**
 * The clear slim case the machine actually stores medicine in — the numbered channels in
 * the client's photo of the cabinet interior are full of these. The carton rides inside
 * it, and the patient has to hand the case back once the medicine is out.
 */
export function PlasticCase({ open = 0, empty = 0, ...props }: { open?: number; empty?: number } & React.ComponentProps<'group'>) {
  const W = 0.078
  const H = 0.138
  const D = 0.036
  const shell = (
    <meshStandardMaterial
      color="#eaf2f7"
      transparent
      opacity={0.34}
      roughness={0.12}
      metalness={0}
      depthWrite={false}
    />
  )
  return (
    <group {...props}>
      {/* body: four walls and a floor, left open at the top so the carton can lift out */}
      <mesh position={[0, 0, -D / 2]}>
        <planeGeometry args={[W, H]} />
        {shell}
      </mesh>
      {([1, -1] as const).map((side) => (
        <mesh key={side} position={[(side * W) / 2, 0, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
          <planeGeometry args={[D, H]} />
          {shell}
        </mesh>
      ))}
      <mesh position={[0, -H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        {shell}
      </mesh>
      {/* front face, hinged at the foot so it can drop open */}
      <group position={[0, -H / 2, D / 2]} rotation={[-open * 1.5, 0, 0]}>
        <mesh position={[0, H / 2, 0]}>
          <planeGeometry args={[W, H]} />
          {shell}
        </mesh>
        {/* the printed channel label, as on every case in the cabinet */}
        <mesh position={[0, H * 0.36, 0.0006]}>
          <planeGeometry args={[W * 0.5, H * 0.12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
        </mesh>
      </group>
      {/* the carton rides inside until the patient lifts it out */}
      {empty < 0.5 && <MedicinePackage scale={0.92} />}
      {/* a hint of an edge so the clear plastic reads against a pale cabinet */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(W, H, D)]} />
        <lineBasicMaterial color="#9fb4c2" transparent opacity={0.55} />
      </lineSegments>
    </group>
  )
}

/** Basket by the kiosk where the empty cases are returned. */
export function ReturnBasket(props: React.ComponentProps<'group'>) {
  const W = 0.24
  const H = 0.1
  const D = 0.17
  const wall = <meshStandardMaterial color="#bcd3de" roughness={0.5} metalness={0} side={THREE.DoubleSide} />
  return (
    <group {...props}>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        {wall}
      </mesh>
      {([1, -1] as const).map((s) => (
        <mesh key={`x${s}`} position={[(s * W) / 2, H / 2, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <planeGeometry args={[D, H]} />
          {wall}
        </mesh>
      ))}
      {([1, -1] as const).map((s) => (
        <mesh key={`z${s}`} position={[0, H / 2, (s * D) / 2]}>
          <planeGeometry args={[W, H]} />
          {wall}
        </mesh>
      ))}
      {/* rim, so the open top reads as a lip rather than a cut edge */}
      <mesh position={[0, H, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, 0.001, 4]} />
        <meshBasicMaterial color="#9fb4c2" />
      </mesh>
    </group>
  )
}

export const PROP_COMPONENTS = {
  plasticCase: PlasticCase,
  returnBasket: ReturnBasket,
  medicinePackage: MedicinePackage,
  medicineBoxArt: MedicineBoxArt,
  medicineBox: MedicineBox,
  sticker: Sticker,
  phone: Phone,
  qrCard: QrCard,
} as const

export type PropPrimitive = keyof typeof PROP_COMPONENTS
