import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBox, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { BRAND } from './textures'
import { KioskScreen, type ScreenDynamic, type ScreenState } from './KioskScreen'
import { GroundBlob } from './GroundBlob'
import { computeAnchors, computeMetrics, type KioskLayout, type KioskMetrics } from './kioskLayout'
import { DEFAULT_LIVERY, type Livery, type UvWindow } from './liveries'

/** how far the scanner beam reaches out of the window, in metres */
const BEAM_LEN = 0.42

/** how far the scanner window is sunk into the fascia, and how much it narrows */
const SCANNER_DEPTH = 0.055
const SCANNER_TAPER = 0.5

/** how deep the pick-up recess is cut into the cabinet, in metres */
const BAY_DEPTH = 0.3
/** the front slab is cut the full depth of the recess, so nothing of the cabinet is
 *  left standing behind the opening */
const FASCIA = BAY_DEPTH

export interface KioskConfig {
  /** overall height in metres; width and depth follow the artwork proportions */
  height: number
  screenState: ScreenState
  /** 0 closed, 1 fully open */
  doorOpen: number
  /** 0..1 strength of the scanner glow */
  scanGlow: number
  /** 0..1 camera indicator */
  cameraGlow: number
  /** 0..1 how far the printed sticker has travelled out of the print slot */
  stickerFeed: number
  lang: 'th' | 'en'
}

export const KIOSK_DEFAULTS: KioskConfig = {
  height: 2.0,
  screenState: 'welcome',
  doorOpen: 0,
  scanGlow: 0,
  cameraGlow: 0,
  stickerFeed: 0,
  lang: 'th',
}

/** Metrics and anchors of the default wrap, which scenes stage against. */
export const DEFAULT_METRICS = computeMetrics(DEFAULT_LIVERY.layout)
export const KIOSK_SIZE = DEFAULT_METRICS.size
export const KIOSK_ANCHORS = computeAnchors(DEFAULT_LIVERY.layout)

export type KioskDynamic = Partial<
  Pick<KioskConfig, 'screenState' | 'doorOpen' | 'scanGlow' | 'cameraGlow' | 'stickerFeed' | 'lang'>
>

/**
 * `config` holds the static build. `dyn` is a mutable ref written by the timeline
 * every frame, so animating the kiosk never re-renders React.
 */
export function Kiosk({
  config,
  dyn,
  layout,
  livery = DEFAULT_LIVERY,
  parts,
  flat = false,
  ...props
}: {
  config?: Partial<KioskConfig>
  dyn?: React.RefObject<KioskDynamic>
  /** overrides the face layout — the model lab edits this live */
  layout?: KioskLayout
  /** 2.5D flat look: drops PBR shading so the cabinet sits next to vector characters */
  flat?: boolean
  /** wrap applied to the cabinet; each panel may take a slice of a shared sheet */
  livery?: Livery
  /** per-part visibility, for inspecting the build */
  parts?: Partial<Record<'shell' | 'livery' | 'screen' | 'camera' | 'slots' | 'scanner' | 'door' | 'pad', boolean>>
} & React.ComponentProps<'group'>) {
  const cfg = { ...KIOSK_DEFAULTS, ...config }
  const activeLayout = layout ?? livery.layout
  const M: KioskMetrics = useMemo(() => computeMetrics(activeLayout), [activeLayout])
  const show = {
    shell: true, livery: true, screen: true, camera: true, slots: true, scanner: true, door: true, pad: true,
    ...parts,
  }
  const [frontSheet, sideSheet] = useTexture([livery.front.url, livery.side.url])
  const screenDyn = useRef<ScreenDynamic>({})
  const doorRef = useRef<THREE.Group>(null)
  const bayLightRef = useRef<THREE.PointLight>(null)
  const bayGlowRef = useRef<THREE.Mesh>(null)
  const scanRef = useRef<THREE.Mesh>(null)
  const beamRef = useRef<THREE.Mesh>(null)
  const beamLightRef = useRef<THREE.SpotLight>(null)
  const beamLineRef = useRef<THREE.Mesh>(null)
  const beamTargetRef = useRef<THREE.Object3D>(null)
  const camRef = useRef<THREE.Mesh>(null)
  const printRef = useRef<THREE.Group>(null)
  const elapsed = useRef(0)

  /** a panel shows its window of the sheet, so one wrap can cover several faces */
  const slice = (source: THREE.Texture, window?: UvWindow) => {
    const t = source.clone()
    t.needsUpdate = true
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    if (window) {
      const [u0, v0, u1, v1] = window
      t.repeat.set(u1 - u0, v1 - v0)
      t.offset.set(u0, v0)
    }
    return t
  }

  const frontMap = useMemo(() => slice(frontSheet, livery.front.window), [frontSheet, livery])
  const sideMap = useMemo(() => slice(sideSheet, livery.side.window), [sideSheet, livery])
  // clones share their source with the cached sheet, so they must NOT be disposed here:
  // releasing one would free the shared GPU texture the other panels still draw from

  /** the pick-up door carries its slice of the front artwork, so it opens with the PICK UP panel on it */
  const doorMap = useMemo(() => {
    const t = frontSheet.clone()
    t.needsUpdate = true
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    const [x, y, w, h] = activeLayout.pickup
    const win = livery.front.window ?? [0, 0, 1, 1]
    const spanU = win[2] - win[0]
    const spanV = win[3] - win[1]
    t.repeat.set((w / activeLayout.front.w) * spanU, (h / activeLayout.front.h) * spanV)
    t.offset.set(
      win[0] + (x / activeLayout.front.w) * spanU,
      win[1] + (1 - (y + h) / activeLayout.front.h) * spanV,
    )
    return t
  }, [frontMap, activeLayout, livery])


  /**
   * The front livery is a plane with the pick-up rectangle cut out, so the bay behind
   * it is a real hole rather than a dark decal. UVs are remapped from the vertex
   * positions, otherwise ShapeGeometry would rescale the artwork to the outline.
   */
  const frontPanel = useMemo(() => {
    const { width: pw, height: ph } = M.size
    const r = 0.03
    const shape = new THREE.Shape()
    shape.moveTo(-pw / 2 + r, -ph / 2)
    shape.lineTo(pw / 2 - r, -ph / 2)
    shape.quadraticCurveTo(pw / 2, -ph / 2, pw / 2, -ph / 2 + r)
    shape.lineTo(pw / 2, ph / 2 - r)
    shape.quadraticCurveTo(pw / 2, ph / 2, pw / 2 - r, ph / 2)
    shape.lineTo(-pw / 2 + r, ph / 2)
    shape.quadraticCurveTo(-pw / 2, ph / 2, -pw / 2, ph / 2 - r)
    shape.lineTo(-pw / 2, -ph / 2 + r)
    shape.quadraticCurveTo(-pw / 2, -ph / 2, -pw / 2 + r, -ph / 2)
    shape.closePath()
    // one hole per recess: the pick-up bay and the sunken scanner window
    const cut = (r: { x: number; y: number; w: number; h: number }) => {
      const cx = r.x
      const cy = r.y - ph / 2
      const hole = new THREE.Path()
      hole.moveTo(cx - r.w / 2, cy - r.h / 2)
      hole.lineTo(cx - r.w / 2, cy + r.h / 2)
      hole.lineTo(cx + r.w / 2, cy + r.h / 2)
      hole.lineTo(cx + r.w / 2, cy - r.h / 2)
      hole.closePath()
      shape.holes.push(hole)
    }
    cut(M.pickup)
    cut(M.scannerBox)
    const g = new THREE.ShapeGeometry(shape)
    const pos = g.attributes.position
    const uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / pw + 0.5
      uv[i * 2 + 1] = pos.getY(i) / ph + 0.5
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    // the cabinet's own front face has to carry the same opening, or the solid shell
    // would sit in front of the recess and hide it
    const slab = new THREE.ExtrudeGeometry(shape, { depth: FASCIA, bevelEnabled: false })
    slab.translate(0, 0, -FASCIA)
    return { panel: g, slab }
  }, [M])
  useEffect(
    () => () => {
      frontPanel.panel.dispose()
      frontPanel.slab.dispose()
    },
    [frontPanel],
  )

  /**
   * 2.5D flat pass: every lit surface is swapped for an unlit one carrying the same
   * colour or artwork, with a fixed shade per facing so the box still reads as a box.
   * Emissive parts (screen, scanner, bay light) keep their material — the timeline
   * animates their glow.
   */
  const rootRef = useRef<THREE.Group>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root || !flat) return
    const made: THREE.Material[] = []
    const normal = new THREE.Vector3()
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || mesh.userData.flatDone) return
      const src = mesh.material as THREE.MeshStandardMaterial
      if (!src || (src as THREE.Material).type !== 'MeshStandardMaterial') return
      if (src.emissive && src.emissive.getHex() !== 0) return
      // shade by which way the surface faces: top brightest, sides a step down
      mesh.geometry.computeVertexNormals?.()
      const n = mesh.geometry.getAttribute('normal')
      normal.set(0, 0, 1)
      if (n && n.count) normal.set(n.getX(0), n.getY(0), n.getZ(0)).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()))
      const shade = 1 + normal.y * 0.06 - Math.abs(normal.x) * 0.07
      const basic = new THREE.MeshBasicMaterial({
        map: src.map ?? null,
        color: src.color.clone().multiplyScalar(shade),
        transparent: src.transparent,
        opacity: src.opacity,
        alphaTest: src.alphaTest,
        side: src.side,
        depthWrite: src.depthWrite,
      })
      mesh.userData.flatDone = true
      mesh.userData.pbrMaterial = src
      mesh.material = basic
      made.push(basic)
    })
    return () => {
      root.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh && mesh.userData.pbrMaterial) {
          mesh.material = mesh.userData.pbrMaterial as THREE.Material
          mesh.userData.flatDone = false
          mesh.userData.pbrMaterial = undefined
        }
      })
      for (const m of made) m.dispose()
    }
  }, [flat, livery, M, frontPanel])

  /**
   * The scanner sits at the bottom of a square funnel cut into the fascia, the way the
   * real machine has it: wide at the surface, tapering back to the lens plate.
   */
  const scannerFunnel = useMemo(() => {
    const outer = (M.scannerBox.w / 2) * Math.SQRT2
    const inner = outer * SCANNER_TAPER
    // wide end at the top so it lands at the mouth once the funnel is turned to face +Z
    const g = new THREE.CylinderGeometry(outer, inner, SCANNER_DEPTH, 4, 1, true)
    g.rotateY(Math.PI / 4) // corners to the diagonals, so the walls read as flat panels
    g.rotateX(Math.PI / 2) // funnel opens along +Z
    return g
  }, [M])
  useEffect(() => () => scannerFunnel.dispose(), [scannerFunnel])

  useFrame((_, dt) => {
    elapsed.current += dt
    const d0 = dyn?.current ?? {}
    screenDyn.current = { state: d0.screenState ?? cfg.screenState, lang: d0.lang ?? cfg.lang }

    const open = THREE.MathUtils.clamp(d0.doorOpen ?? cfg.doorOpen, 0, 1)
    // the shutter drops straight down and disappears behind the fascia
    if (doorRef.current) doorRef.current.position.y = -open * (M.pickup.h + 0.012)
    if (bayLightRef.current) bayLightRef.current.intensity = 0.05 + open * 0.45
    if (bayGlowRef.current) {
      const m = bayGlowRef.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 0.15 + open * 1.0
    }
    const scan = THREE.MathUtils.clamp(d0.scanGlow ?? cfg.scanGlow, 0, 1)
    if (scanRef.current) {
      const m = scanRef.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 0.3 + scan * 4
    }
    // the beam fires out of the window: a soft additive cone, a sweeping read line
    // and a real spot light so whatever is held up to it picks up the red spill
    if (beamRef.current) {
      const flicker = 0.86 + Math.sin(elapsed.current * 34) * 0.14
      beamRef.current.visible = scan > 0.01
      const m = beamRef.current.material as THREE.MeshBasicMaterial
      m.opacity = scan * 0.16 * flicker
    }
    if (beamLineRef.current) {
      beamLineRef.current.visible = scan > 0.01
      const m = beamLineRef.current.material as THREE.MeshBasicMaterial
      m.opacity = scan * 0.85
      // the read line sweeps across the beam the way a laser scanner does
      beamLineRef.current.position.y = Math.sin(elapsed.current * 7.5) * BEAM_LEN * 0.16
    }
    if (beamLightRef.current) {
      // a spot light aims at its target object, which has to live in the scene graph
      if (beamTargetRef.current && beamLightRef.current.target !== beamTargetRef.current) {
        beamLightRef.current.target = beamTargetRef.current
      }
      beamLightRef.current.intensity = scan * 6
    }
    if (camRef.current) {
      const m = camRef.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = (d0.cameraGlow ?? cfg.cameraGlow) * 3
    }
    if (printRef.current) {
      // the printed label slides out of the slot and hangs down as it feeds
      const feed = THREE.MathUtils.clamp(d0.stickerFeed ?? cfg.stickerFeed, 0, 1)
      printRef.current.visible = feed > 0.001
      printRef.current.scale.set(1, feed, 1)
      printRef.current.position.y = M.stickerSlot.y - (feed * 0.075) / 2
    }
  })

  const { width: w, height: h, depth: d } = M.size

  return (
    <group ref={rootRef} {...props}>
      {/* contact pad so the cabinet reads as sitting on the floor */}
      {show.pad && <GroundBlob width={w * 1.9} depth={d * 2.6} opacity={0.55} position={[0, 0.014, 0.05]} />}

      {/* cabinet shell */}
      {show.shell && (
      <>
        <RoundedBox
          args={[w, h, d - FASCIA]}
          radius={0.03}
          smoothness={4}
          position={[0, h / 2, -FASCIA / 2]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={livery.shell} roughness={0.3} metalness={0.05} />
        </RoundedBox>
        {/* front slab with the pick-up bay cut clean through it. Extrude puts the
            cabinet's outer edges and the hole's walls in the same material group, so
            the slab stays shell-coloured and the recess brings its own walls. */}
        <mesh geometry={frontPanel.slab} position={[0, h / 2, d / 2]} castShadow receiveShadow>
          <meshStandardMaterial color={livery.shell} roughness={0.3} metalness={0.05} />
        </mesh>
      </>
      )}

      {show.livery && (
        <>
  {/* Figma livery: front panel */}
        <mesh position={[0, h / 2, d / 2 + 0.002]} geometry={frontPanel.panel} castShadow>
          <meshStandardMaterial map={frontMap} transparent roughness={0.26} metalness={0.02} />
        </mesh>
        </>
      )}

      {/* Figma livery: LH / RH panels */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[(s * w) / 2 + s * 0.002, h / 2, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial map={sideMap} transparent roughness={0.26} metalness={0.02} />
        </mesh>
      ))}

      {show.screen && (
        <>
  {/* touchscreen, sitting in the artwork's screen cut-out */}
        <group position={[M.screen.x, M.screen.y, d / 2 + 0.004]}>
          <RoundedBox args={[M.screen.w + 0.02, M.screen.h + 0.02, 0.026]} radius={0.01} smoothness={4} castShadow>
            <meshStandardMaterial color="#171b22" roughness={0.38} metalness={0.55} />
          </RoundedBox>
          <group position={[0, 0, 0.015]}>
            <KioskScreen width={M.screen.w} height={M.screen.h} dyn={screenDyn} />
          </group>
        </group>
        </>
      )}

      {show.camera && (
        <>
  {/* camera bar */}
        <group position={[M.cameraBar.x, M.cameraBar.y, d / 2 + 0.004]}>
          <RoundedBox args={[M.cameraBar.w, M.cameraBar.h, 0.02]} radius={M.cameraBar.h * 0.45} smoothness={3}>
            <meshStandardMaterial color="#20242c" roughness={0.32} metalness={0.6} />
          </RoundedBox>
          <mesh ref={camRef} position={[0, 0, 0.012]}>
            <circleGeometry args={[M.cameraBar.h * 0.26, 24]} />
            <meshStandardMaterial color="#0b0d12" emissive="#4fd1ff" emissiveIntensity={0} roughness={0.1} />
          </mesh>
        </group>
        </>
      )}

      {show.slots && (
        <>
  {/* sensor dot above the slot row */}
        <mesh position={[M.sensorDot.x, M.sensorDot.y, d / 2 + 0.004]}>
          <circleGeometry args={[M.sensorDot.w / 2, 20]} />
          <meshStandardMaterial color="#2a2f38" roughness={0.35} metalness={0.4} />
        </mesh>
        </>
      )}

      {show.scanner && (
        <>
  {/* barcode / QR scanner window */}
        <group position={[M.scannerBox.x, M.scannerBox.y, d / 2 + 0.002]}>
          {/* dark rim around the mouth — four strips, so nothing covers the opening */}
          {([-1, 1] as const).map((sy) => (
            <mesh key={`rh${sy}`} position={[0, (sy * M.scannerBox.h) / 2, 0.001]}>
              <planeGeometry args={[M.scannerBox.w * 1.12, M.scannerBox.h * 0.06]} />
              <meshStandardMaterial color="#1d222a" roughness={0.5} metalness={0.35} />
            </mesh>
          ))}
          {([-1, 1] as const).map((sx) => (
            <mesh key={`rv${sx}`} position={[(sx * M.scannerBox.w) / 2, 0, 0.001]}>
              <planeGeometry args={[M.scannerBox.w * 0.06, M.scannerBox.h * 1.12]} />
              <meshStandardMaterial color="#1d222a" roughness={0.5} metalness={0.35} />
            </mesh>
          ))}
          {/* the funnel walls, catching a gradient from the mouth down to the lens */}
          <mesh geometry={scannerFunnel} position={[0, 0, -SCANNER_DEPTH / 2]} receiveShadow>
            <meshStandardMaterial
              color="#eef2f6"
              emissive="#ffffff"
              emissiveIntensity={0.22}
              roughness={0.45}
              metalness={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* lens plate at the bottom of the funnel */}
          <mesh position={[0, 0, -SCANNER_DEPTH]}>
            <planeGeometry args={[M.scannerBox.w * SCANNER_TAPER, M.scannerBox.h * SCANNER_TAPER]} />
            <meshStandardMaterial color="#14181f" roughness={0.3} metalness={0.55} />
          </mesh>
          {/* beam cone, widening as it leaves the window */}
          <mesh ref={beamRef} position={[0, 0, BEAM_LEN / 2 - SCANNER_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
            <cylinderGeometry args={[M.scannerBox.w * 0.5, M.scannerBox.w * 0.22, BEAM_LEN, 20, 1, true]} />
            <meshBasicMaterial
              color={BRAND.red}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
          {/* the read line the beam paints on whatever is held in front of it */}
          <mesh ref={beamLineRef} position={[0, 0, BEAM_LEN * 0.55]} visible={false}>
            <planeGeometry args={[M.scannerBox.w * 1.35, 0.006]} />
            <meshBasicMaterial color="#ff4a3d" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <spotLight
            ref={beamLightRef}
            position={[0, 0, 0.02]}
            color={BRAND.red}
            angle={0.5}
            penumbra={0.7}
            distance={1.4}
            decay={2}
            intensity={0}
          />
          <object3D ref={beamTargetRef} position={[0, 0, 1]} />
          <mesh ref={scanRef} position={[0, 0, -SCANNER_DEPTH + 0.002]}>
            <planeGeometry args={[M.scannerBox.w * 0.24, M.scannerBox.h * 0.24]} />
            <meshStandardMaterial color="#2a0d0c" emissive={BRAND.red} emissiveIntensity={0.3} toneMapped={false} />
          </mesh>
        </group>
        </>
      )}

      {show.slots && (
        <>
  {/* print slots, side by side as on the built machine: sticker (left), receipt (right) */}
        {[M.stickerSlot, M.receiptSlot].map((slot, i) => (
          <group key={i} position={[slot.x, slot.y, d / 2 + 0.004]}>
            <mesh>
              <planeGeometry args={[slot.w, slot.h]} />
              <meshStandardMaterial color="#0d1015" roughness={0.9} />
            </mesh>
            <mesh position={[0, slot.h * 0.62, 0.001]}>
              <planeGeometry args={[slot.w * 1.04, slot.h * 0.2]} />
              <meshStandardMaterial color="#8a929e" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
        ))}

        {/* the label being printed, extruding from the sticker slot */}
        <group ref={printRef} position={[M.stickerSlot.x, M.stickerSlot.y, d / 2 + 0.008]} visible={false}>
          <mesh>
            <planeGeometry args={[M.stickerSlot.w * 0.92, 0.075]} />
            <meshStandardMaterial color="#fdfdfd" roughness={0.75} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[M.stickerSlot.w * 0.7, 0.01]} />
            <meshStandardMaterial color={BRAND.blue} roughness={0.7} />
          </mesh>
        </group>
        </>
      )}

      {show.door && (
        <>
        {/* pick-up bay: a real recess behind the cut-out in the fascia */}
        <group position={[M.pickup.x, M.pickup.y, d / 2 - BAY_DEPTH / 2]}>
          {/* recess walls, drawn just inside the cut so they hide the slab's own edges */}
          {([-1, 1] as const).map((sx) => (
            <mesh key={`w${sx}`} position={[(sx * (M.pickup.w - 0.004)) / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
              <planeGeometry args={[BAY_DEPTH, M.pickup.h]} />
              <meshStandardMaterial color="#8c96a3" roughness={0.7} metalness={0.05} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <mesh position={[0, (M.pickup.h - 0.004) / 2, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[M.pickup.w, BAY_DEPTH]} />
            <meshStandardMaterial color="#a3adb9" roughness={0.62} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -(M.pickup.h - 0.004) / 2, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[M.pickup.w, BAY_DEPTH]} />
            <meshStandardMaterial color="#6f7885" roughness={0.78} side={THREE.DoubleSide} />
          </mesh>
          {/* back wall of the recess */}
          <mesh position={[0, 0, -BAY_DEPTH / 2 + 0.002]} receiveShadow>
            <planeGeometry args={[M.pickup.w, M.pickup.h]} />
            <meshStandardMaterial color="#646d79" roughness={0.75} metalness={0.05} />
          </mesh>
          {/* shelf the packages sit on, lifted off the bay floor */}
          <mesh position={[0, -M.pickup.h / 2 + 0.045, 0.01]} receiveShadow castShadow>
            <boxGeometry args={[M.pickup.w * 0.94, 0.014, BAY_DEPTH * 0.82]} />
            <meshStandardMaterial color="#aab3bf" roughness={0.5} metalness={0.15} />
          </mesh>
          {/* compartment light: an emissive strip under the bay ceiling plus a real
              point light, both driven by how far the shutter has opened */}
          <mesh ref={bayGlowRef} position={[0, M.pickup.h / 2 - 0.012, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[M.pickup.w * 0.8, BAY_DEPTH * 0.5]} />
            <meshStandardMaterial color="#ffffff" emissive="#eaf6ff" emissiveIntensity={0.25} toneMapped={false} />
          </mesh>
          <pointLight
            ref={bayLightRef}
            position={[0, M.pickup.h / 2 - 0.05, 0.02]}
            color="#e8f4ff"
            intensity={0.15}
            distance={0.9}
            decay={2}
          />
        </group>

        {/* dark gasket around the mouth, so the cut in the fascia reads as an edge */}
        <group position={[M.pickup.x, M.pickup.y, d / 2 + 0.001]}>
          {([-1, 1] as const).map((sx) => (
            <mesh key={`v${sx}`} position={[(sx * M.pickup.w) / 2, 0, 0]}>
              <planeGeometry args={[0.012, M.pickup.h + 0.012]} />
              <meshStandardMaterial color="#3a424d" roughness={0.8} />
            </mesh>
          ))}
          {([-1, 1] as const).map((sy) => (
            <mesh key={`h${sy}`} position={[0, (sy * M.pickup.h) / 2, 0]}>
              <planeGeometry args={[M.pickup.w + 0.012, 0.012]} />
              <meshStandardMaterial color="#3a424d" roughness={0.8} />
            </mesh>
          ))}
        </group>

        {/* roller shutter: slides straight down and vanishes behind the fascia */}
        <group position={[M.pickup.x, M.pickup.y, d / 2 - 0.012]}>
          <group ref={doorRef}>
            <mesh castShadow>
              <boxGeometry args={[M.pickup.w * 0.995, M.pickup.h, 0.014]} />
              <meshStandardMaterial color="#f3f4f7" roughness={0.28} metalness={0.08} />
            </mesh>
            <mesh position={[0, 0, 0.008]}>
              <planeGeometry args={[M.pickup.w * 0.995, M.pickup.h]} />
              <meshStandardMaterial map={doorMap} transparent roughness={0.26} />
            </mesh>
          </group>
        </group>
        </>
      )}

          </group>
  )
}

useTexture.preload(['/textures/kiosk-front.png', '/textures/kiosk-side.png'])
