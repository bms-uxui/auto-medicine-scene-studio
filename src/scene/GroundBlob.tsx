import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Soft elliptical shadow pad. Real shadow maps handle the cast shadow; this adds the
 * dark contact under an object so nothing looks like it is floating — and it works the
 * same for flat billboard art, which cannot cast a shadow at all.
 */
export function GroundBlob({
  width,
  depth,
  opacity = 0.55,
  ...props
}: { width: number; depth: number; opacity?: number } & React.ComponentProps<'mesh'>) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const ctx = canvas.getContext('2d')!
    // a solid ellipse with a blurred edge reads as a real shadow; a plain radial
    // gradient fades out before it clears the object and disappears on white
    ctx.filter = 'blur(20px)'
    ctx.fillStyle = 'rgba(24,30,42,0.9)'
    ctx.beginPath()
    ctx.ellipse(128, 128, 84, 84, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.filter = 'none'
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  // renderOrder keeps the pad above the opaque floor, which is drawn first
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} {...props}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
