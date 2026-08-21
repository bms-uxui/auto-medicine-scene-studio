import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { CutoutRigDef } from './cutoutRigs'
import { textureFromImage } from './artTexture'

/**
 * A flat Figma character as a 2D cut-out puppet.
 *
 * The export is one flat SVG, but the limb is its own set of paths, so it can be split
 * off into a second layer and hinged at the shoulder. That lets the timeline point what
 * the character is holding at a world-space target — the scanner window — while the art
 * itself stays exactly the vector art from the design file.
 *
 * Which paths move, and where the hinge sits, comes from `cutoutRigs.ts`.
 */

/** alpha cut-off for the layers: high enough to drop the anti-aliased rim outright */
const EDGE_CUT = 0.35

type Layers = { body: THREE.Texture; arm: THREE.Texture; torso?: THREE.Texture }

function rasterise(svg: string, pixelHeight: number, aspect: number): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(textureFromImage(img, pixelHeight, aspect))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('staff layer failed to rasterise'))
    }
    img.src = url
  })
}

/** Splits the source SVG into a body layer and a limb layer, each on the full canvas. */
function useCutoutLayers(url: string, rig: CutoutRigDef, pixelHeight = 1024) {
  const [layers, setLayers] = useState<Layers | null>(null)
  useEffect(() => {
    let cancelled = false
    const build = async () => {
      const text = await fetch(url).then((r) => r.text())
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
      const root = doc.documentElement
      const aspect = rig.art.w / rig.art.h

      const only = (keep: (id: string) => boolean) => {
        const copy = root.cloneNode(true) as SVGSVGElement
        for (const node of Array.from(copy.querySelectorAll('path[id]'))) {
          if (!keep(node.getAttribute('id') ?? '')) node.remove()
        }
        return new XMLSerializer().serializeToString(copy)
      }

      const moving = new Set(rig.limbIds)
      const upper = new Set(rig.torsoIds ?? [])
      const [body, arm, torso] = await Promise.all([
        rasterise(only((id) => !moving.has(id) && !upper.has(id)), pixelHeight, aspect),
        rasterise(only((id) => moving.has(id)), pixelHeight, aspect),
        upper.size ? rasterise(only((id) => upper.has(id)), pixelHeight, aspect) : Promise.resolve(undefined),
      ])
      if (cancelled) {
        for (const t of [body, arm, torso]) t?.dispose()
        return
      }
      setLayers({ body, arm, torso })
    }
    void build()
    return () => {
      cancelled = true
    }
  }, [url, rig, pixelHeight])

  useEffect(
    () => () => {
      // `torso` is absent for rigs without a waist hinge
      if (layers) for (const t of Object.values(layers)) t?.dispose()
    },
    [layers],
  )
  return layers
}

export interface CutoutRigDynamic {
  opacity?: number
  /** 0 = upright billboard, 1 = fully camera-aligned */
  tilt?: number
  /** 0 = arm at rest, 1 = arm points at reachTarget */
  reach?: number
  /** world point the hand aims at */
  reachTarget?: [number, number, number]
  /** 0 = standing straight, 1 = bent as far as the rig allows */
  bend?: number
  /**
   * 1 hides everything but the hinged limb. Used for inserts that frame the hand alone:
   * a flat board reaching deep into the cabinet would otherwise show the whole figure
   * standing inside it.
   */
  armOnly?: number
}

export function CutoutRig({
  url,
  rig,
  height = 1.78,
  pivotX,
  tilt = 0.65,
  lit = 0.18,
  dyn,
  gripRef,
  ...props
}: {
  url: string
  rig: CutoutRigDef
  /** filled with the object that rides in the character's hand, for props to follow */
  gripRef?: React.MutableRefObject<THREE.Object3D | null>
  height?: number
  /** overrides the rig's own pivot when a scene needs the figure nudged sideways */
  pivotX?: number
  tilt?: number
  lit?: number
  dyn?: React.RefObject<CutoutRigDynamic>
} & React.ComponentProps<'group'>) {
  const layers = useCutoutLayers(url, rig)
  const pivot = pivotX ?? rig.pivotX
  const camera = useThree((s) => s.camera)

  const board = useRef<THREE.Group>(null)
  const armPivot = useRef<THREE.Group>(null)
  const waistPivot = useRef<THREE.Group>(null)
  const gripMarker = useRef<THREE.Object3D>(null)
  const bodyMesh = useRef<THREE.Mesh>(null)
  const torsoMesh = useRef<THREE.Mesh>(null)
  const blob = useRef<THREE.Mesh>(null)
  const swing = useRef(0)
  const aimSwing = useRef(0)
  /** how long the aim inputs have been unchanged, in seconds */
  const settled = useRef(0)
  const lastAim = useRef({ x: 0, y: 0, z: 0, reach: -1 })

  /** art pixels -> metres in the billboard's own plane, feet on the ground */
  const geom = useMemo(() => {
    const s = height / rig.art.h
    const w = rig.art.w * s
    const toLocal = (px: number, py: number): [number, number] => [(px - pivot * rig.art.w) * s, (rig.art.h - py) * s]
    const shoulder = toLocal(rig.shoulder[0], rig.shoulder[1])
    const waist = toLocal(rig.waist?.[0] ?? rig.shoulder[0], rig.waist?.[1] ?? rig.shoulder[1])
    // aim by what is held, not by the wrist: the limb swings until that lands on target
    const grip = toLocal(rig.grip[0], rig.grip[1])
    const plane = new THREE.PlaneGeometry(w, height)
    plane.translate((0.5 - pivot) * w, height / 2, 0)
    return { s, w, shoulder, waist, grip, plane }
  }, [height, pivot, rig])

  useEffect(() => () => geom.plane.dispose(), [geom])

  const upright = useMemo(() => new THREE.Quaternion(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const worldPos = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const gripPos = useMemo(() => new THREE.Vector3(), [])
  const shoulderPos = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    const node = board.current
    if (!node) return
    if (gripRef && gripRef.current !== gripMarker.current) gripRef.current = gripMarker.current
    const d = dyn?.current ?? {}
    const blend = THREE.MathUtils.clamp(d.tilt ?? tilt, 0, 1)

    node.getWorldPosition(worldPos)
    dir.subVectors(camera.position, worldPos)
    upright.setFromEuler(new THREE.Euler(0, Math.atan2(dir.x, dir.z), 0, 'YXZ'))
    node.quaternion.copy(upright).slerp(camera.quaternion, blend)

    /**
     * The arm is aimed on screen, not in the art's own plane: the billboard tilts with
     * the camera, so plane-space geometry drifts away from what the shot actually
     * shows. Each frame what the character holds and the target it is being offered to
     * are both projected to the camera, and the angle still between them is fed back
     * into the hinge.
     *
     * `reach` then blends that aim against the rig's resting angle, so an arm can start
     * hanging at the character's side and rise into position rather than snapping to it.
     */
    const reach = THREE.MathUtils.clamp(d.reach ?? 0, 0, 1)
    const t = d.reachTarget
    /*
     * Once the target and the reach have held still long enough for the feedback to
     * converge, the aim is locked. Otherwise a camera move — which changes the screen
     * geometry without anything about the pose changing — keeps re-solving the hinge and
     * the arm drifts around under the move.
     */
    if (t) {
      const moved =
        Math.abs(t[0] - lastAim.current.x) > 1e-4 ||
        Math.abs(t[1] - lastAim.current.y) > 1e-4 ||
        Math.abs(t[2] - lastAim.current.z) > 1e-4 ||
        Math.abs(reach - lastAim.current.reach) > 1e-3
      settled.current = moved ? 0 : settled.current + dt
      lastAim.current = { x: t[0], y: t[1], z: t[2], reach }
    }
    const locked = settled.current > 0.5
    if (t && !locked && armPivot.current && gripMarker.current) {
      target.set(t[0], t[1], t[2]).project(camera)
      gripMarker.current.getWorldPosition(gripPos).project(camera)
      armPivot.current.getWorldPosition(shoulderPos).project(camera)
      const aim = Math.atan2(target.y - shoulderPos.y, target.x - shoulderPos.x)
      const have = Math.atan2(gripPos.y - shoulderPos.y, gripPos.x - shoulderPos.x)
      let err = THREE.MathUtils.euclideanModulo(aim - have + Math.PI, Math.PI * 2) - Math.PI
      err = THREE.MathUtils.clamp(err, -0.4, 0.4)
      // the marker reports where the grip is *now*, so the correction is relative to the
      // angle currently applied, whatever the blend happens to be
      aimSwing.current = THREE.MathUtils.clamp(swing.current + err, rig.swing[0], rig.swing[1])
    }
    // stooping toward a low target: the torso leans and takes the arm with it
    if (waistPivot.current) {
      const bend = THREE.MathUtils.clamp(d.bend ?? 0, 0, 1) * (rig.bendLimit ?? 0)
      waistPivot.current.rotation.z = THREE.MathUtils.damp(waistPivot.current.rotation.z, -bend, 6, dt)
    }

    const want = THREE.MathUtils.lerp(rig.rest, aimSwing.current, reach)
    swing.current = THREE.MathUtils.lerp(swing.current, want, 0.35)
    if (armPivot.current) armPivot.current.rotation.z = swing.current

    // insert framing: only the arm is on screen, so drop the rest of the board
    const armOnly = (d.armOnly ?? 0) > 0.5
    if (bodyMesh.current) bodyMesh.current.visible = !armOnly
    if (torsoMesh.current) torsoMesh.current.visible = !armOnly
    if (blob.current) blob.current.visible = !armOnly

    const opacity = d.opacity ?? 1
    node.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.opacity = opacity
      // Only blend while fading. A blended layer joins the transparent pass, which is
      // drawn before the kiosk's own transparent livery, so its edge texels mix with
      // the background instead of the cabinet — that is the pale outline.
      mat.transparent = opacity < 0.999
      // alphaTest is compared against the texture alpha *after* opacity is applied, so a
      // fixed cut-off discards the whole figure until the fade passes it and then pops it
      // in at that opacity. Scaling the cut-off keeps the same silhouette all the way up.
      mat.alphaTest = Math.max(0.02, EDGE_CUT * opacity)
    })
  })

  if (!layers) return null

  const layerMaterial = (map: THREE.Texture) => (
    <meshStandardMaterial
      map={map}
      emissive="#ffffff"
      emissiveMap={map}
      emissiveIntensity={1 - lit}
      roughness={0.92}
      metalness={0}
      alphaTest={EDGE_CUT}
      depthWrite
      side={THREE.DoubleSide}
    />
  )

  return (
    <group {...props}>
      <group ref={board}>
        <mesh ref={bodyMesh} geometry={geom.plane} renderOrder={0}>{layerMaterial(layers.body)}</mesh>

        {/* everything above the waist hinges here, so the arm bends with the body */}
        <group ref={waistPivot} position={[geom.waist[0], geom.waist[1], 0.001]}>
        {layers.torso && (
          <mesh ref={torsoMesh} geometry={geom.plane} position={[-geom.waist[0], -geom.waist[1], 0]} renderOrder={1}>
            {layerMaterial(layers.torso)}
          </mesh>
        )}

        {/* arm hinged at the shoulder; the plane is shifted so the pivot sits at origin */}
        <group ref={armPivot} position={[geom.shoulder[0] - geom.waist[0], geom.shoulder[1] - geom.waist[1], 0.002]}>
          <mesh geometry={geom.plane} position={[-geom.shoulder[0], -geom.shoulder[1], 0]} renderOrder={2}>
            {layerMaterial(layers.arm)}
          </mesh>

          {/* where the medicine box sits, used to close the aiming loop */}
          <object3D ref={gripMarker} position={[geom.grip[0] - geom.shoulder[0], geom.grip[1] - geom.shoulder[1], 0]} />
        </group>
        </group>
      </group>

      {/* flat art cannot cast a real shadow, so ground it with a soft blob */}
      <mesh ref={blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={2}>
        <circleGeometry args={[height * 0.2, 32]} />
        <meshBasicMaterial color="#2f3846" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}
