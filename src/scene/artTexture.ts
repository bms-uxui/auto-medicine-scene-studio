import * as THREE from 'three'

/**
 * Rasterising vector art onto a transparent canvas leaves the edge texels partly
 * transparent. Whatever the upload path does with those texels — un-premultiplying
 * them, or averaging them into a mip level — their RGB is unreliable, and on this
 * artwork it lands close to white, so every silhouette picks up a pale outline.
 *
 * Bleeding fixes it at the source: any texel that is not fully opaque takes the colour
 * of its nearest opaque neighbour, so there is no stray colour left to leak. Alpha is
 * untouched, so the edges stay anti-aliased.
 */
export function bleedEdges(ctx: CanvasRenderingContext2D, width: number, height: number, passes = 3) {
  const img = ctx.getImageData(0, 0, width, height)
  const data = img.data
  const opaque = (i: number) => data[i + 3] > 250

  for (let pass = 0; pass < passes; pass++) {
    const snapshot = new Uint8ClampedArray(data)
    const wasOpaque = (i: number) => snapshot[i + 3] > 250
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (opaque(i) || snapshot[i + 3] === 0) continue
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const j = (ny * width + nx) * 4
            if (!wasOpaque(j)) continue
            r += snapshot[j]
            g += snapshot[j + 1]
            b += snapshot[j + 2]
            n++
          }
        }
        if (!n) continue
        data[i] = r / n
        data[i + 1] = g / n
        data[i + 2] = b / n
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Rasterises art into a texture.
 *
 * The pixels are handed to three as raw data rather than as a canvas: uploading a
 * canvas lets the browser un-premultiply its internally premultiplied store, which
 * divides the colour of every edge texel by a small alpha and drives it to white —
 * the pale outline that used to trace the characters.
 */
export function textureFromImage(img: CanvasImageSource, pixelHeight: number, aspect: number) {
  const canvas = document.createElement('canvas')
  canvas.height = pixelHeight
  canvas.width = Math.max(1, Math.round(pixelHeight * aspect))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  bleedEdges(ctx, canvas.width, canvas.height)

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const tex = new THREE.DataTexture(new Uint8Array(pixels.data.buffer), canvas.width, canvas.height, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = true
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}
