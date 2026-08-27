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
/**
 * @param qr the hospital's QR label printed on the front of the carton. Most items are
 *   read through the code on their plastic case; the few that do not fit in one carry it
 *   on the medicine itself, and those are the ones that set this.
 */
export function MedicinePackage({ qr, ...props }: { qr?: boolean } & React.ComponentProps<'group'>) {
  const face = useMemo(() => cartonTexture('Lorem', '100 mg'), [])
  const code = qrTexture()
  useEffect(() => () => face.dispose(), [face])
  const W = 0.062
  const H = 0.128
  const D = 0.034
  return (
    <group {...props}>
      {qr && (
        <mesh position={[0, -H * 0.28, D / 2 + 0.0012]}>
          <planeGeometry args={[W * 0.44, W * 0.44]} />
          <meshStandardMaterial map={code} roughness={0.7} metalness={0} />
        </mesh>
      )}
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

/**
 * Label artwork for the bottle of oral solution: a printed panel with a blue header, the
 * drug and strength, the dosage lines and a fill scale down one side.
 */
function bottleLabelTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 320
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fbfcfd'
  ctx.fillRect(0, 0, 640, 320)
  ctx.fillStyle = BRAND.blue
  ctx.fillRect(0, 0, 640, 82)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 46px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('Lorem', 30, 60)
  ctx.font = '500 30px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('100 mg / 5 ml', 210, 58)

  ctx.fillStyle = '#39424e'
  ctx.font = '500 27px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('Oral solution', 30, 136)
  ctx.fillStyle = '#6b7684'
  ctx.font = '400 24px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('Shake well before use', 30, 176)
  ctx.fillText('Store below 30°C', 30, 212)

  // the dosing scale printed down the right-hand edge of the label
  ctx.strokeStyle = '#9aa5b1'
  ctx.lineWidth = 3
  for (let i = 0; i <= 4; i++) {
    const y = 120 + i * 42
    ctx.beginPath()
    ctx.moveTo(600, y)
    ctx.lineTo(i % 2 ? 572 : 552, y)
    ctx.stroke()
  }
  ctx.fillStyle = '#6b7684'
  ctx.font = '400 20px Inter, Helvetica, Arial, sans-serif'
  ctx.fillText('60 ml', 494, 300)

  ctx.strokeStyle = '#dfe5ec'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, 636, 316)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/**
 * A bottle of oral solution: the medicine that cannot be put in a plastic case at all.
 *
 * Those items carry the hospital's QR code on the bottle itself, and the pharmacy
 * sticker goes back onto the same bottle — there is nothing to unpack, so the flow that
 * uses this prop is three beats shorter than the boxed one.
 *
 * The body is turned from a profile rather than built out of cylinders: a real bottle has
 * a base fillet, a shoulder and a neck, and stacking primitives left it reading as a tube
 * with a lid balanced on it.
 */
export function MedicineBottle(props: React.ComponentProps<'group'>) {
  const label = useMemo(() => bottleLabelTexture(), [])
  const code = qrTexture()
  useEffect(() => () => label.dispose(), [label])
  const R = 0.0235
  const H = 0.105
  /** half the body height — everything is measured from the bottle's own centre */
  const h = H / 2

  /** the turned profile, from the centre of the base up to the lip of the neck */
  const glass = useMemo(() => {
    const p: [number, number][] = [
      [0, -h],
      [R * 0.86, -h],
      [R, -h + 0.006],            // base fillet
      [R, h * 0.52],              // straight body
      [R * 0.985, h * 0.62],
      [R * 0.9, h * 0.72],        // shoulder
      [R * 0.7, h * 0.86],
      [R * 0.47, h * 0.97],
      [R * 0.4, h * 1.06],        // neck
      [R * 0.4, h * 1.3],
      [R * 0.44, h * 1.34],       // the lip the cap screws onto
    ]
    return new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 48)
  }, [h, R])

  /** the syrup inside, stopping short of the shoulder so there is a headspace */
  const fill = useMemo(() => {
    const p: [number, number][] = [
      [0, -h + 0.004],
      [R * 0.93, -h + 0.004],
      [R * 0.93, h * 0.42],
      [0, h * 0.42],
    ]
    return new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 40)
  }, [h, R])

  useEffect(() => () => { glass.dispose(); fill.dispose() }, [glass, fill])

  /** a panel wrapped on the glass rather than floated in front of it */
  const arc = (r: number, height: number, span: number) =>
    [r, r, height, 44, 1, true, -span / 2, span] as const

  return (
    <group {...props}>
      {/* amber glass */}
      <mesh geometry={glass} castShadow receiveShadow>
        <meshStandardMaterial
          color="#cf8b34"
          roughness={0.2}
          metalness={0.04}
          transparent
          opacity={0.74}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* the syrup it is filled with, a shade deeper than the glass */}
      <mesh geometry={fill}>
        <meshStandardMaterial color="#7d4310" roughness={0.34} metalness={0} />
      </mesh>
      {/* screw cap: a body, the knurled band round it and a flat crown */}
      <mesh position={[0, h * 1.42, 0]} castShadow>
        <cylinderGeometry args={[R * 0.56, R * 0.56, 0.019, 40]} />
        <meshStandardMaterial color="#eef2f6" roughness={0.45} metalness={0} />
      </mesh>
      <mesh position={[0, h * 1.42, 0]}>
        <cylinderGeometry args={[R * 0.575, R * 0.575, 0.012, 40, 1, true]} />
        <meshStandardMaterial color="#d7dee6" roughness={0.7} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, h * 1.42 + 0.0098, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R * 0.56, 40]} />
        <meshStandardMaterial color="#f6f9fb" roughness={0.4} metalness={0} />
      </mesh>
      {/* the printed label, wrapped round the lower half of the front */}
      <mesh position={[0, -h * 0.44, 0]}>
        <cylinderGeometry args={arc(R * 1.015, H * 0.4, Math.PI * 0.95)} />
        <meshStandardMaterial map={label} roughness={0.72} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/*
        The hospital's QR, on the bare glass above the label. It has to sit clear of the
        label: the pharmacy sticker is applied over that, and would cover the code.
      */}
      <mesh position={[0, h * 0.3, 0]}>
        <cylinderGeometry args={arc(R * 1.03, R * 1.16, Math.PI * 0.6)} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, h * 0.3, 0]}>
        <cylinderGeometry args={arc(R * 1.045, R * 0.95, Math.PI * 0.46)} />
        <meshStandardMaterial map={code} roughness={0.7} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/**
 * Front artwork for the syrup carton: a pale blue card with a tall rounded panel printed
 * on it, a black band naming what it is, and the indications under it.
 *
 * Deliberately unbranded. It is drawn after the shape of a real Thai cough-syrup carton,
 * which is what the hospital dispenses for a liquid — but the film is a demonstration of a
 * machine, not an advertisement for a product, so there is no maker's mark, no logo and no
 * trade name on it.
 */
function syrupCartonTexture() {
  const canvas = document.createElement('canvas')
  const W = 480
  const H = 1290
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const TH = (weight: number, size: number) =>
    `${weight} ${size}px "Noto Sans Thai", Inter, Helvetica, Arial, sans-serif`

  ctx.fillStyle = '#cadde8'
  ctx.fillRect(0, 0, W, H)

  /** the rounded panel the printing sits on, inset from the card's edges */
  const px = 44
  const py = 60
  const pw = W - px * 2
  const ph = H - py * 2
  const r = pw / 2
  ctx.beginPath()
  ctx.moveTo(px, py + r)
  ctx.arcTo(px, py, px + r, py, r)
  ctx.arcTo(px + pw, py, px + pw, py + r, r)
  ctx.lineTo(px + pw, py + ph - r)
  ctx.arcTo(px + pw, py + ph, px + pw - r, py + ph, r)
  ctx.arcTo(px, py + ph, px, py + ph - r, r)
  ctx.closePath()
  ctx.fillStyle = '#eef1f2'
  ctx.fill()
  ctx.strokeStyle = '#c3ccd2'
  ctx.lineWidth = 3
  ctx.stroke()

  // the panel is two tones: white above the band, a light grey below it
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#fdfefe'
  ctx.fillRect(px, py, pw, 430)
  ctx.fillStyle = '#111417'
  ctx.fillRect(px, 430, pw, 150)
  ctx.fillStyle = '#dfe4e6'
  ctx.fillRect(px, 580, pw, ph)
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = TH(700, 74)
  ctx.fillText('ยาน้ำแก้ไอ', W / 2, 512)
  ctx.font = TH(400, 38)
  ctx.fillText('ชนิดน้ำเชื่อม', W / 2, 560)

  ctx.fillStyle = '#3d464d'
  ctx.font = TH(400, 40)
  for (const [i, line] of ['บรรเทาอาการไอ', 'ช่วยขับเสมหะ', 'และทำให้ชุ่มคอ'].entries()) {
    ctx.fillText(line, W / 2, 680 + i * 62)
  }

  ctx.fillStyle = '#7c868d'
  ctx.font = TH(400, 34)
  ctx.fillText('ขนาดบรรจุ 60 มล.', W / 2, H - 190)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/**
 * The carton a bottle of syrup is dispensed in: tall, slim, and far too big for a plastic
 * case — which is the whole reason the no-case flow exists.
 *
 * It carries the hospital's QR on its own front, low enough that the pharmacy sticker,
 * which goes on above it, cannot cover the code.
 */
export function SyrupCarton(props: React.ComponentProps<'group'>) {
  const face = useMemo(() => syrupCartonTexture(), [])
  const code = qrTexture()
  useEffect(() => () => face.dispose(), [face])
  const W = 0.05
  const H = 0.134
  const D = 0.04
  const QR = W * 0.5
  return (
    <group {...props}>
      <RoundedBox args={[W, H, D]} radius={0.002} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#cadde8" roughness={0.66} metalness={0} />
      </RoundedBox>
      {/* the printed front and back, a hair proud of the card so they never z-fight */}
      {([1, -1] as const).map((side) => (
        <mesh key={side} position={[0, 0, (side * D) / 2 + side * 0.0006]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial map={face} roughness={0.62} metalness={0} />
        </mesh>
      ))}
      {/* the hospital's code, low on the front and clear of where the sticker lands */}
      <mesh position={[0, -H * 0.3, D / 2 + 0.0014]}>
        <planeGeometry args={[QR + 0.005, QR + 0.005]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, -H * 0.3, D / 2 + 0.0018]}>
        <planeGeometry args={[QR, QR]} />
        <meshStandardMaterial map={code} roughness={0.75} metalness={0} />
      </mesh>
    </group>
  )
}

/**
 * The wayfinding sign on the wall: a pale panel with a cross, the department and an arrow.
 * Deliberately low-contrast — it is there to say "hospital", not to be read.
 */
function signTexture() {
  const canvas = document.createElement('canvas')
  const W = 720
  const H = 260
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const TH = (weight: number, size: number) =>
    `${weight} ${size}px "Noto Sans Thai", Inter, Helvetica, Arial, sans-serif`

  ctx.fillStyle = '#f7f9fa'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#dfe8ec'
  ctx.fillRect(0, 0, 210, H)
  // the cross, drawn as two bars rather than a glyph so no font has to carry it
  ctx.fillStyle = '#8fb3c2'
  ctx.fillRect(88, 62, 34, 136)
  ctx.fillRect(37, 113, 136, 34)

  ctx.fillStyle = '#5d6b73'
  ctx.font = TH(600, 62)
  ctx.fillText('ห้องจ่ายยา', 246, 122)
  ctx.font = TH(400, 40)
  ctx.fillStyle = '#8d979d'
  ctx.fillText('Pharmacy', 248, 182)

  // arrow to the right, three strokes
  ctx.strokeStyle = '#9fb0b8'
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(600, 130)
  ctx.lineTo(680, 130)
  ctx.moveTo(650, 100)
  ctx.lineTo(682, 130)
  ctx.lineTo(650, 160)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/**
 * The room the kiosk stands in.
 *
 * Everything used to float on a white cyclorama, which reads as a product shot rather than
 * as a machine installed somewhere — at the establishing width there was no floor line, no
 * horizon and nothing to say the patient had walked into a hospital.
 *
 * It is dressed to be ignored: the wall and floor are a shade off white and the dressing is
 * desaturated and kept a good two metres clear of the cabinet on both sides, so nothing
 * competes with the machine in a wide shot or wanders into an insert. It is a prop like any
 * other, so each film fades it out with the cabinet for the demonstrations — those play in
 * an empty white room on purpose.
 */
export function HospitalLobby(props: React.ComponentProps<'group'>) {
  const sign = useMemo(() => signTexture(), [])
  useEffect(() => () => sign.dispose(), [sign])

  /** how far behind the cabinet the wall stands */
  const Z = -1.6
  const WALL_W = 22
  const WALL_H = 6.4
  /** the height of the painted dado band, which is what gives the wall a scale */
  const DADO = 1.15

  /** one waiting chair: a seat, a back and a pair of runners */
  const chair = (x: number, key: number) => (
    <group key={key} position={[x, 0, Z + 0.62]}>
      <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.05, 0.44]} />
        {/* a shade of blue, not another off-white: against a pale wall the chairs had no
            edge at all and the row read as a smudge */}
        <meshStandardMaterial color="#b7ccd8" emissive="#9db6c4" emissiveIntensity={0.35} roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[0, 0.66, -0.2]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.46, 0.42, 0.05]} />
        {/* a shade of blue, not another off-white: against a pale wall the chairs had no
            edge at all and the row read as a smudge */}
        <meshStandardMaterial color="#b7ccd8" emissive="#9db6c4" emissiveIntensity={0.35} roughness={0.8} metalness={0} />
      </mesh>
      {([1, -1] as const).map((side) => (
        <mesh key={side} position={[side * 0.19, 0.21, 0]} castShadow>
          <boxGeometry args={[0.03, 0.42, 0.4]} />
          <meshStandardMaterial color="#c9d3d9" emissive="#bcc7ce" emissiveIntensity={0.35} roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
    </group>
  )

  return (
    <group {...props}>
      {/* the wall, in two tones with a skirting along the bottom */}
      <mesh position={[0, WALL_H / 2, Z]} receiveShadow>
        <planeGeometry args={[WALL_W, WALL_H]} />
        {/* the wall faces the camera and takes almost no key, so it is painted well up
            towards white or it renders as mid grey and the room reads as a basement */}
        <meshStandardMaterial color="#ffffff" emissive="#eef4f7" emissiveIntensity={0.55} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, DADO / 2, Z + 0.004]} receiveShadow>
        <planeGeometry args={[WALL_W, DADO]} />
        <meshStandardMaterial color="#e8eff2" emissive="#dbe6ec" emissiveIntensity={0.45} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, DADO, Z + 0.006]}>
        <planeGeometry args={[WALL_W, 0.012]} />
        <meshStandardMaterial color="#cfdae0" emissive="#c6d3da" emissiveIntensity={0.4} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, 0.045, Z + 0.02]}>
        <boxGeometry args={[WALL_W, 0.09, 0.04]} />
        <meshStandardMaterial color="#dde5e9" emissive="#cfd9df" emissiveIntensity={0.35} roughness={1} metalness={0} />
      </mesh>

      {/*
        The floor. It sits a millimetre and a half above the stage's own shadow-catcher
        rather than replacing it: that plane is pure white and is what the contact shadows
        are tuned against, and it is what shows through when the room fades for a
        demonstration.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0015, 0]} receiveShadow>
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#f1f4f5" roughness={0.92} metalness={0} />
      </mesh>

      {/* wayfinding, well off to the left of the cabinet */}
      <mesh position={[-2.55, 1.92, Z + 0.03]}>
        <planeGeometry args={[1.12, 0.4]} />
        <meshStandardMaterial map={sign} roughness={0.85} metalness={0} />
      </mesh>

      {/* a row of waiting chairs against the wall, left of the machine */}
      {[-3.15, -2.6, -2.05].map((x, i) => chair(x, i))}

      {/* and a plant on the other side, to stop the right of the frame going empty */}
      <group position={[2.35, 0, Z + 0.55]}>
        <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.17, 0.13, 0.34, 20]} />
          <meshStandardMaterial color="#eceff1" emissive="#dfe4e7" emissiveIntensity={0.35} roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[0, 0.345, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.02, 20]} />
          <meshStandardMaterial color="#5f6f63" roughness={1} metalness={0} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            position={[Math.sin(i * 1.3) * 0.1, 0.62 + (i % 3) * 0.12, Math.cos(i * 1.3) * 0.08]}
            rotation={[0.1, i * 1.3, Math.sin(i) * 0.35]}
            castShadow
          >
            <planeGeometry args={[0.2, 0.46]} />
            <meshStandardMaterial color="#c8dbca" emissive="#a9c3ac" emissiveIntensity={0.4} roughness={0.9} metalness={0} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
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
/**
 * One QR texture for the whole scene.
 *
 * The hospital sticks a QR code on the plastic case, and on the medicine itself for the
 * few items that will not fit in a case, so the same code shows up on several props —
 * building it once keeps them identical and costs one canvas instead of one per prop.
 */
let qrTex: THREE.CanvasTexture | null = null
export function qrTexture() {
  if (qrTex) return qrTex
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
  qrTex = new THREE.CanvasTexture(c)
  qrTex.colorSpace = THREE.SRGBColorSpace
  return qrTex
}

export function QrCard(props: React.ComponentProps<'group'>) {
  const tex = qrTexture()
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
  const qr = qrTexture()
  const W = 0.168
  const D = 0.104
  const H = 0.05
  /** how deep the lid's skirt comes down over the base */
  const LIP = 0.014
  /** the code square on the end wall, which is only H tall — the wall sets the size */
  const QR = H * 0.76
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
      </group>
      {/*
        The hospital's QR label, stuck on the end of the case rather than its lid. That end
        is the face that looks out of the bay where the case stands, and it stays that face
        the whole way to the scan window: on the lid the code pointed at the ceiling, and
        the only way to present it was to roll the case over in a hand that cannot turn.

        It is on the base, not the lid, so it is still there once the lid comes off — and
        it sits a hair proud of the wall so it does not fight it for depth.
      */}
      <mesh position={[W / 2 + 0.0006, 0.002, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[QR + 0.006, QR + 0.006]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[W / 2 + 0.0012, 0.002, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[QR, QR]} />
        <meshStandardMaterial map={qr} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
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
  medicineBottle: MedicineBottle,
  syrupCarton: SyrupCarton,
  hospitalLobby: HospitalLobby,
  medicineBoxArt: MedicineBoxArt,
  medicineBox: MedicineBox,
  sticker: Sticker,
  phone: Phone,
  qrCard: QrCard,
} as const

export type PropPrimitive = keyof typeof PROP_COMPONENTS
