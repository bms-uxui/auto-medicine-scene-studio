import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { textureFromImage } from './artTexture'

/** Rasterises an SVG/PNG at a fixed pixel height so flat art stays crisp in 3D. */
function useArtTexture(url: string, pixelHeight = 1024) {
  const [state, setState] = useState<{ tex: THREE.Texture; aspect: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const aspect = img.naturalWidth / img.naturalHeight
      setState({ tex: textureFromImage(img, pixelHeight, aspect), aspect })
    }
    img.src = url
    return () => {
      cancelled = true
    }
  }, [url, pixelHeight])

  useEffect(() => () => state?.tex.dispose(), [state])
  return state
}

export interface BillboardDynamic {
  opacity?: number
  /** 0 = upright, 1 = fully matches the camera tilt */
  tilt?: number
}

/**
 * Flat Figma character art placed in the 3D scene. The plane is anchored at the feet
 * and turns to face the camera every frame; `tilt` blends between staying upright and
 * matching the camera's full orientation, so the 2D art leans with the shot instead of
 * reading as a cardboard cut-out.
 */
/** Soft radial blob used as a stand-in contact shadow for flat art. */
const blobTexture = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  g.addColorStop(0, 'rgba(47,56,70,0.85)')
  g.addColorStop(0.55, 'rgba(47,56,70,0.28)')
  g.addColorStop(1, 'rgba(47,56,70,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
})()

export function Billboard2D({
  url,
  height = 1.7,
  tilt = 0.65,
  pivotX = 0.5,
  lit = 0.55,
  grade = '#ffffff',
  dyn,
  ...props
}: {
  url: string
  /** world height in metres */
  height?: number
  tilt?: number
  /** horizontal fraction of the art that sits over the group origin (0=left, 1=right).
   *  Art with an outstretched arm is not centred on the body, so the feet need this. */
  pivotX?: number
  /** how much scene light shapes the art: 0 = flat print, 1 = fully lit surface.
   *  The rest of the art is carried by the emissive copy so it never goes muddy. */
  lit?: number
  /** multiplied into the art, to pull it toward the scene's white balance */
  grade?: string
  dyn?: React.RefObject<BillboardDynamic>
} & React.ComponentProps<'group'>) {
  const art = useArtTexture(url)
  const mesh = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)

  const geometry = useMemo(() => {
    if (!art) return null
    const w = height * art.aspect
    const g = new THREE.PlaneGeometry(w, height)
    g.translate((0.5 - pivotX) * w, height / 2, 0) // anchor at the feet
    return g
  }, [art, height, pivotX])

  useEffect(() => () => geometry?.dispose(), [geometry])

  const upright = useMemo(() => new THREE.Quaternion(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const worldPos = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const node = mesh.current
    if (!node) return
    const d = dyn?.current ?? {}
    const blend = THREE.MathUtils.clamp(d.tilt ?? tilt, 0, 1)

    // upright billboard: yaw only, so the character keeps its feet on the floor
    node.getWorldPosition(worldPos)
    dir.subVectors(camera.position, worldPos)
    const yaw = Math.atan2(dir.x, dir.z)
    upright.setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'))
    // camera-aligned billboard: the art tilts exactly with the shot
    node.quaternion.copy(upright).slerp(camera.quaternion, blend)

    const mat = node.material as THREE.MeshStandardMaterial
    const opacity = d.opacity ?? 1
    mat.opacity = opacity
    // blending only while fading; see StaffRig for why a blended layer picks up a rim
    mat.transparent = opacity < 0.999
    // the cut-off follows the fade, otherwise the art stays invisible and then pops in
    // the moment opacity climbs past it
    mat.alphaTest = Math.max(0.02, 0.5 * opacity)
  })

  if (!art || !geometry) return null

  return (
    <group {...props}>
      <mesh ref={mesh} geometry={geometry}>
        {/* the same PBR path and tone curve the kiosk goes through, so the flat art
            sits in the shot instead of reading as a sticker pasted on top: `lit` of it
            is shaded by the scene lights, the remainder comes back as emissive */}
        <meshStandardMaterial
          map={art.tex}
          color={grade}
          emissive="#ffffff"
          emissiveMap={art.tex}
          emissiveIntensity={1 - lit}
          roughness={0.92}
          metalness={0}
          alphaTest={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* flat art cannot cast a real shadow, so ground it with a soft blob */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={2}>
        <circleGeometry args={[height * 0.2, 32]} />
        <meshBasicMaterial map={blobTexture} transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  )
}
