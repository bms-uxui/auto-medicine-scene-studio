import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { textureFromImage } from './artTexture'

/**
 * The Figma staff illustration (36:400) as a 2D cut-out puppet.
 *
 * The export is one flat SVG, but the arm is its own set of paths, so it can be split
 * into three layers — body, arm, hand+box — and hinged at the shoulder and the wrist.
 * That lets the timeline point the arm at a world-space target (the scanner window)
 * while the art stays the vector art from the design file.
 */

/** paths that make up the sleeve and the bare arm */
const ARM_IDS = ['path2090', 'path2089']
/** the hand plus every part of the medicine box it holds */
const HAND_IDS = ['path2091', 'Vector', ...Array.from({ length: 14 }, (_, i) => `Vector_${i + 2}`)]

/** art-space landmarks, read off the Figma path bounds (viewBox is 515 x 978) */
const ART = {
  w: 515,
  h: 978,
  shoulder: [205, 243] as const,
  wrist: [389, 344] as const,
  /** centre of the medicine box — what actually has to land on the scanner */
  grip: [468, 336] as const,
}

type Layers = { body: THREE.Texture; arm: THREE.Texture; hand: THREE.Texture }

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

/** Splits the source SVG into body / arm / hand layers, each on the full canvas. */
function useStaffLayers(url: string, pixelHeight = 1024) {
  const [layers, setLayers] = useState<Layers | null>(null)
  useEffect(() => {
    let cancelled = false
    const build = async () => {
      const text = await fetch(url).then((r) => r.text())
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
      const root = doc.documentElement
      const aspect = ART.w / ART.h

      const only = (keep: (id: string) => boolean) => {
        const copy = root.cloneNode(true) as SVGSVGElement
        for (const node of Array.from(copy.querySelectorAll('path[id]'))) {
          if (!keep(node.getAttribute('id') ?? '')) node.remove()
        }
        return new XMLSerializer().serializeToString(copy)
      }

      const moving = new Set([...ARM_IDS, ...HAND_IDS])
      const [body, arm, hand] = await Promise.all([
        rasterise(only((id) => !moving.has(id)), pixelHeight, aspect),
        rasterise(only((id) => ARM_IDS.includes(id)), pixelHeight, aspect),
        rasterise(only((id) => HAND_IDS.includes(id)), pixelHeight, aspect),
      ])
      if (cancelled) {
        for (const t of [body, arm, hand]) t.dispose()
        return
      }
      setLayers({ body, arm, hand })
    }
    void build()
    return () => {
      cancelled = true
    }
  }, [url, pixelHeight])

  useEffect(
    () => () => {
      if (layers) for (const t of Object.values(layers)) t.dispose()
    },
    [layers],
  )
  return layers
}

export interface StaffRigDynamic {
  opacity?: number
  /** 0 = upright billboard, 1 = fully camera-aligned */
  tilt?: number
  /** 0 = arm at rest, 1 = arm points at reachTarget */
  reach?: number
  /** world point the hand aims at */
  reachTarget?: [number, number, number]
}

export function StaffRig({
  url,
  height = 1.78,
  pivotX = 0.393,
  tilt = 0.65,
  lit = 0.18,
  dyn,
  ...props
}: {
  url: string
  height?: number
  pivotX?: number
  tilt?: number
  lit?: number
  dyn?: React.RefObject<StaffRigDynamic>
} & React.ComponentProps<'group'>) {
  const layers = useStaffLayers(url)
  const camera = useThree((s) => s.camera)

  const board = useRef<THREE.Group>(null)
  const armPivot = useRef<THREE.Group>(null)
  const handPivot = useRef<THREE.Group>(null)
  const gripMarker = useRef<THREE.Object3D>(null)
  const swing = useRef(0)

  /** art pixels -> metres in the billboard's own plane, feet on the ground */
  const geom = useMemo(() => {
    const s = height / ART.h
    const w = ART.w * s
    const toLocal = (px: number, py: number): [number, number] => [(px - pivotX * ART.w) * s, (ART.h - py) * s]
    const shoulder = toLocal(ART.shoulder[0], ART.shoulder[1])
    const wrist = toLocal(ART.wrist[0], ART.wrist[1])
    const grip = toLocal(ART.grip[0], ART.grip[1])
    // aim by the box, not the wrist: the arm swings until the box sits on the target
    const restAngle = Math.atan2(grip[1] - shoulder[1], grip[0] - shoulder[0])
    const plane = new THREE.PlaneGeometry(w, height)
    plane.translate((0.5 - pivotX) * w, height / 2, 0)
    return { s, w, shoulder, wrist, grip, restAngle, plane }
  }, [height, pivotX])

  useEffect(() => () => geom.plane.dispose(), [geom])

  const upright = useMemo(() => new THREE.Quaternion(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const worldPos = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const gripPos = useMemo(() => new THREE.Vector3(), [])
  const shoulderPos = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const node = board.current
    if (!node) return
    const d = dyn?.current ?? {}
    const blend = THREE.MathUtils.clamp(d.tilt ?? tilt, 0, 1)

    node.getWorldPosition(worldPos)
    dir.subVectors(camera.position, worldPos)
    upright.setFromEuler(new THREE.Euler(0, Math.atan2(dir.x, dir.z), 0, 'YXZ'))
    node.quaternion.copy(upright).slerp(camera.quaternion, blend)

    /**
     * The arm is aimed on screen, not in the art's own plane: the billboard tilts with
     * the camera, so plane-space geometry drifts away from what the shot actually
     * shows. Each frame the box and the target are projected to the camera, and the
     * remaining angle around the shoulder is fed back into the hinge — a couple of
     * frames and the box sits on the scanner from the camera's point of view.
     */
    const reach = THREE.MathUtils.clamp(d.reach ?? 0, 0, 1)
    const t = d.reachTarget
    if (t && reach > 0.001 && armPivot.current && gripMarker.current) {
      target.set(t[0], t[1], t[2]).project(camera)
      gripMarker.current.getWorldPosition(gripPos).project(camera)
      armPivot.current.getWorldPosition(shoulderPos).project(camera)
      const aim = Math.atan2(target.y - shoulderPos.y, target.x - shoulderPos.x)
      const have = Math.atan2(gripPos.y - shoulderPos.y, gripPos.x - shoulderPos.x)
      let err = THREE.MathUtils.euclideanModulo(aim - have + Math.PI, Math.PI * 2) - Math.PI
      err = THREE.MathUtils.clamp(err, -0.4, 0.4)
      swing.current = THREE.MathUtils.clamp(swing.current + err * 0.5 * reach, -1.3, 1.0)
    } else {
      swing.current = THREE.MathUtils.lerp(swing.current, 0, 0.15)
    }
    if (armPivot.current) armPivot.current.rotation.z = swing.current
    // the hand keeps the box level instead of rolling with the forearm
    if (handPivot.current) handPivot.current.rotation.z = -swing.current * 0.55

    const opacity = d.opacity ?? 1
    node.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.opacity = opacity
      mat.transparent = true
    })
  })

  if (!layers) return null

  const layerMaterial = (map: THREE.Texture, order: number) => (
    <meshStandardMaterial
      map={map}
      emissive="#ffffff"
      emissiveMap={map}
      emissiveIntensity={1 - lit}
      roughness={0.92}
      metalness={0}
      transparent
      alphaTest={0.5}
      depthWrite={order === 0}
      side={THREE.DoubleSide}
    />
  )

  return (
    <group {...props}>
      <group ref={board}>
        <mesh geometry={geom.plane} renderOrder={0}>{layerMaterial(layers.body, 0)}</mesh>

        {/* arm hinged at the shoulder; the plane is shifted so the pivot sits at origin */}
        <group ref={armPivot} position={[geom.shoulder[0], geom.shoulder[1], 0.002]}>
          <mesh geometry={geom.plane} position={[-geom.shoulder[0], -geom.shoulder[1], 0]} renderOrder={1}>
            {layerMaterial(layers.arm, 1)}
          </mesh>

          {/* hand and box hinged at the wrist, carried along by the arm */}
          <group
            ref={handPivot}
            position={[geom.wrist[0] - geom.shoulder[0], geom.wrist[1] - geom.shoulder[1], 0.002]}
          >
            <mesh geometry={geom.plane} position={[-geom.wrist[0], -geom.wrist[1], 0]} renderOrder={2}>
              {layerMaterial(layers.hand, 2)}
            </mesh>
            {/* where the medicine box sits, used to close the aiming loop */}
            <object3D ref={gripMarker} position={[geom.grip[0] - geom.wrist[0], geom.grip[1] - geom.wrist[1], 0]} />
          </group>
        </group>
      </group>

      {/* flat art cannot cast a real shadow, so ground it with a soft blob */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={2}>
        <circleGeometry args={[height * 0.2, 32]} />
        <meshBasicMaterial color="#2f3846" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}
