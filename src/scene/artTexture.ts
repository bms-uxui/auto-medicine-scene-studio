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
export function bleedEdges(ctx: CanvasRenderingContext2D, width: number, height: number, passes = 4) {
  const img = ctx.getImageData(0, 0, width, height)
  const data = img.data

  // "known" starts as the fully opaque art. Everything else — the anti-aliased rim and
  // the transparent surround — has unreliable colour: reading it back un-premultiplies
  // it, which divides by a small alpha and drives the result to white. Those texels
  // still get averaged into the mip levels, which is where the pale outline came from.
  const known = new Uint8Array(width * height)
  for (let p = 0; p < width * height; p++) known[p] = data[p * 4 + 3] > 250 ? 1 : 0

  for (let pass = 0; pass < passes; pass++) {
    const source = new Uint8ClampedArray(data)
    const wasKnown = known.slice()
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x
        if (wasKnown[p]) continue
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const q = ny * width + nx
            if (!wasKnown[q]) continue
            r += source[q * 4]
            g += source[q * 4 + 1]
            b += source[q * 4 + 2]
            n++
          }
        }
        if (!n) continue
        data[p * 4] = r / n
        data[p * 4 + 1] = g / n
        data[p * 4 + 2] = b / n
        known[p] = 1
      }
    }
  }

  // Grow the opaque area by one texel. More than that leaves a visible fringe of a
  // layer's own edge colour wherever it overlaps another layer. With a hard alpha cut the layers of a cut-out
  // puppet would meet edge-to-edge and leave a hairline of background showing at the
  // wrist; a one-texel overlap closes it.
  for (let round = 0; round < 1; round++) {
  const grownAlpha = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      grownAlpha[p] = data[p * 4 + 3]
      if (grownAlpha[p] > 250 || grownAlpha[p] === 0) continue
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          if (data[(ny * width + nx) * 4 + 3] > 250) {
            grownAlpha[p] = 255
            dy = 2
            break
          }
        }
      }
    }
  }
  for (let p = 0; p < width * height; p++) data[p * 4 + 3] = grownAlpha[p]
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
  // A blank raster is a real failure mode: Chromium occasionally hands back an empty
  // frame for an SVG blob that has only just decoded, and the layer then silently
  // disappears from the render — a character with no torso or arm. Coverage is reported
  // so the caller can retry instead of shipping the hole.
  let coverage = 0
  for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i] > 8) coverage++
  const tex = new THREE.DataTexture(new Uint8Array(pixels.data.buffer), canvas.width, canvas.height, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = true
  // No mip chain: the levels average the anti-aliased rim into the art and the result
  // reads as a pale outline around every character. The art is drawn at roughly screen
  // resolution anyway, so there is nothing to gain from minification levels.
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 8
  tex.needsUpdate = true
  tex.userData.coverage = coverage / (canvas.width * canvas.height)
  return tex
}
