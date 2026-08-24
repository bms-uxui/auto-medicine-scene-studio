import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { BRAND } from './textures'
import { textureFromImage } from './artTexture'

/**
 * Channels a prop reads every frame.
 *
 * They cannot be plain props: the timeline drives the scene through refs and never
 * re-renders during playback, so a prop read at render time is whatever it was when React
 * last committed — the lid would only move when something else happened to cause a
 * render, such as hitting pause.
 */
export interface PropDynamic {
  /** 0 = flat on its backing, 1 = fully peeled */
  curl?: number
  /** 0 = lid on, 1 = lid lifted clear */
  open?: number
  /** >= 0.5 = the case no longer holds a carton */
  empty?: number
}

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
export function stickerTexture() {
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
      <RoundedBox args={[W, H, D]} radius={0.0035} smoothness={4} receiveShadow>
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
      <RoundedBox args={[0.11, 0.16, 0.05]} radius={0.006} smoothness={3} receiveShadow>
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
export function Sticker({ dyn, ...props }: { dyn?: React.RefObject<PropDynamic> } & React.ComponentProps<'group'>) {
  const label = useMemo(() => stickerTexture(), [])
  const geo = useMemo(() => new THREE.PlaneGeometry(0.1, 0.061, 24, 4), [])
  /** the flat sheet the curl is measured from */
  const flat = useMemo(() => (geo.attributes.position as THREE.BufferAttribute).clone(), [geo])
  const applied = useRef(-1)
  useEffect(() => () => geo.dispose(), [geo])

  // peeling is animated on the timeline, so it has to be written per frame rather than
  // rebuilt on render — nothing re-renders while the scene plays
  useFrame(() => {
    const curl = THREE.MathUtils.clamp(dyn?.current?.curl ?? 0, 0, 1)
    if (Math.abs(curl - applied.current) < 0.001) return
    applied.current = curl
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = flat.getX(i)
      const u = (x + 0.05) / 0.1
      pos.setX(i, x - Math.pow(u, 2) * curl * 0.02)
      pos.setZ(i, Math.pow(u, 2) * curl * 0.06)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  })

  return (
    <group {...props}>
      <mesh geometry={geo}>
        <meshStandardMaterial map={label} side={THREE.DoubleSide} roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Phone showing the patient app, used for the QR beat and the closing shot. */
export function Phone({ screen, ...props }: { screen?: THREE.Texture } & React.ComponentProps<'group'>) {
  return (
    <group {...props}>
      <RoundedBox args={[0.075, 0.155, 0.009]} radius={0.008} smoothness={4}>
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
      <mesh>
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
 * The clear case the medicine is dispensed in: a shallow landscape box with a solid base
 * and a lid hinged along its back edge, the way a bakery box opens. The carton lies flat
 * inside it, so lifting the medicine out is a straight vertical move that never passes
 * through a wall.
 */
export function PlasticCase({ dyn, ...props }: { dyn?: React.RefObject<PropDynamic> } & React.ComponentProps<'group'>) {
  const lid = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  useFrame(() => {
    const open = THREE.MathUtils.clamp(dyn?.current?.open ?? 0, 0, 1)
    if (lid.current) {
      // two readable phases: a decisive straight lift well clear of the box, then a
      // slide aside — solid through the lift so the action cannot be missed
      const lift = THREE.MathUtils.smoothstep(open, 0, 0.55)
      const drift = THREE.MathUtils.smoothstep(open, 0.55, 1)
      lid.current.position.set(-drift * 0.11, lift * 0.085 + drift * 0.03, -drift * 0.02)
      lid.current.rotation.z = drift * 0.22
      // it only starts to dissolve once it is moving aside, not during the lift
      const fade = 1 - THREE.MathUtils.smoothstep(open, 0.75, 1)
      lid.current.visible = fade > 0.01
      lid.current.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh) return
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (mat.userData.lidBase === undefined) mat.userData.lidBase = mat.opacity
        mat.transparent = true
        // publish through baseOpacity so the actor-level fade in SceneRuntime
        // multiplies on top of this instead of fighting the write
        const faded = (mat.userData.lidBase as number) * fade
        mat.userData.baseOpacity = faded
        mat.opacity = faded
      })
    }
    if (inner.current) inner.current.visible = (dyn?.current?.empty ?? 0) < 0.5
  })
  const W = 0.168
  const D = 0.104
  const H = 0.05
  /** how deep the lid's skirt comes down over the base */
  const LIP = 0.014
  const shell = (
    // low roughness on a plane tilting up into the overhead lightformer threw a hard
    // blown-out highlight across the lid right as it lifts into a close shot
    <meshStandardMaterial
      color="#d9e6ee"
      transparent
      opacity={0.5}
      roughness={0.6}
      metalness={0}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  )
  return (
    <group {...props}>
      {/* base */}
      <mesh position={[0, -H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#e3edf3" transparent opacity={0.5} roughness={0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* long walls */}
      {([1, -1] as const).map((side) => (
        <mesh key={`z${side}`} position={[0, 0, (side * D) / 2]}>
          <planeGeometry args={[W, H]} />
          {shell}
        </mesh>
      ))}
      {/* short walls */}
      {([1, -1] as const).map((side) => (
        <mesh key={`x${side}`} position={[(side * W) / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[D, H]} />
          {shell}
        </mesh>
      ))}
      {/*
        Lid: a cover that lifts straight off, not a hinged flap — a shallow tray of its
        own that sits over the rim of the base and rises clear of it.
      */}
      <group ref={lid}>
        <mesh position={[0, H / 2 + LIP, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W + 0.004, D + 0.004]} />
          {shell}
        </mesh>
        {/* the cover's own skirt, so it reads as a cap rather than a floating sheet */}
        {([1, -1] as const).map((side) => (
          <mesh key={`lz${side}`} position={[0, H / 2 + LIP / 2, (side * (D + 0.004)) / 2]}>
            <planeGeometry args={[W + 0.004, LIP]} />
            {shell}
          </mesh>
        ))}
        {([1, -1] as const).map((side) => (
          <mesh key={`lx${side}`} position={[(side * (W + 0.004)) / 2, H / 2 + LIP / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[D + 0.004, LIP]} />
            {shell}
          </mesh>
        ))}
        {/* the printed channel label sits on the lid */}
        <mesh position={[W * 0.28, H / 2 + LIP + 0.0006, D * 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W * 0.3, D * 0.34]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* the medicine lies flat on the base until it is lifted out */}
      <group ref={inner}>
        <MedicinePackage rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, -H / 2 + 0.019, 0]} />
      </group>
      {/* a hint of an edge so the clear plastic reads against a pale cabinet */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(W, H, D)]} />
        <lineBasicMaterial color="#9fb4c2" transparent opacity={0.5} />
      </lineSegments>
    </group>
  )
}

/** Small side table next to the kiosk that the return basket sits on. */
export function SideTable(props: React.ComponentProps<'group'>) {
  const W = 0.52
  const D = 0.42
  const H = 0.72
  const T = 0.035
  const legIn = 0.05
  return (
    <group {...props}>
      <RoundedBox args={[W, T, D]} radius={0.008} smoothness={3} position={[0, H - T / 2, 0]} receiveShadow>
        <meshStandardMaterial color="#f2f5f8" roughness={0.5} metalness={0} />
      </RoundedBox>
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - legIn), (H - T) / 2, sz * (D / 2 - legIn)]}>
            <boxGeometry args={[0.03, H - T, 0.03]} />
            <meshStandardMaterial color="#c3ced9" roughness={0.55} metalness={0.1} />
          </mesh>
        )),
      )}
      {/* a low stretcher so the legs read as one piece of furniture */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[W - legIn * 2, 0.024, 0.03]} />
        <meshStandardMaterial color="#c3ced9" roughness={0.55} metalness={0.1} />
      </mesh>
    </group>
  )
}

/** Basket by the kiosk where the empty cases are returned. */
export function ReturnBasket(props: React.ComponentProps<'group'>) {
  // IKEA-style storage crate: tapered open basket with slatted sides under a solid rim
  const WB = 0.34
  const DB = 0.25
  const WT = 0.39
  const DT = 0.28
  const H = 0.15
  const RIM = 0.028
  /** a couple of cases other patients have already returned */
  const returned = useRef<PropDynamic>({ empty: 1, open: 0.05 })
  const lean = { x: Math.atan(((DT - DB) / 2) / H), z: Math.atan(((WT - WB) / 2) / H) }
  const plastic = <meshStandardMaterial color="#f2f5f7" roughness={0.45} metalness={0} />
  const slats = (count: number, width: number, along: 'x' | 'z') => {
    const span = (along === 'x' ? WB : DB) - 0.03
    return Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0 : i / (count - 1)
      return (t - 0.5) * span
    }).map((off, i) => ({ off, key: `${along}${i}`, width }))
  }
  return (
    <group {...props}>
      {/* solid base */}
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[WB, 0.01, DB]} />
        {plastic}
      </mesh>
      {/* slatted long sides, leaning out to meet the wider rim */}
      {([1, -1] as const).map((side) =>
        slats(10, 0.017, 'x').map(({ off, key, width }) => (
          <mesh
            key={`l${side}${key}`}
            position={[off, (H - RIM) / 2 + 0.01, side * ((DB + (DT - DB) * 0.5) / 2)]}
            rotation={[-side * lean.x, 0, 0]}
          >
            <boxGeometry args={[width, H - RIM, 0.008]} />
            {plastic}
          </mesh>
        )),
      )}
      {/* slatted short sides */}
      {([1, -1] as const).map((side) =>
        slats(7, 0.017, 'z').map(({ off, key, width }) => (
          <mesh
            key={`s${side}${key}`}
            position={[side * ((WB + (WT - WB) * 0.5) / 2), (H - RIM) / 2 + 0.01, off]}
            rotation={[0, Math.PI / 2, side * lean.z]}
          >
            <boxGeometry args={[width, H - RIM, 0.008]} />
            {plastic}
          </mesh>
        )),
      )}
      {/* solid rim band around the open top */}
      {([1, -1] as const).map((side) => (
        <mesh key={`rz${side}`} position={[0, H - RIM / 2, (side * DT) / 2]}>
          <boxGeometry args={[WT + 0.012, RIM, 0.012]} />
          {plastic}
        </mesh>
      ))}
      {([1, -1] as const).map((side) => (
        <mesh key={`rx${side}`} position={[(side * WT) / 2, H - RIM / 2, 0]}>
          <boxGeometry args={[0.012, RIM, DT + 0.012]} />
          {plastic}
        </mesh>
      ))}
      {/* cases already returned by earlier patients, stacked neatly side by side */}
      <group position={[0, 0.036, 0.058]}>
        <PlasticCase dyn={returned} />
      </group>
      <group position={[0, 0.036, -0.058]}>
        <PlasticCase dyn={returned} />
      </group>
    </group>
  )
}

export const PROP_COMPONENTS = {
  plasticCase: PlasticCase,
  returnBasket: ReturnBasket,
  sideTable: SideTable,
  medicinePackage: MedicinePackage,
  medicineBoxArt: MedicineBoxArt,
  medicineBox: MedicineBox,
  sticker: Sticker,
  phone: Phone,
  qrCard: QrCard,
} as const

export type PropPrimitive = keyof typeof PROP_COMPONENTS
