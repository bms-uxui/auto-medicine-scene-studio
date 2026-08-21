import type { SceneDef, Step } from '../anim/types'

/**
 * Frame layout copied from the Figma reference (node 1:54559, "Camera Position - 7").
 * Everything is expressed in that frame's 1080x683 units and scaled to the render size.
 */
export const LAYOUT = {
  frame: { w: 1080, h: 683 },
  rail: { x: 64, y: 64, w: 173, h: 555, radius: 24 },
  card: { x: 261, y: 64, w: 755, h: 555, radius: 24 },
  /** icon + label placement inside a chip, as a fraction of chip height */
  chip: { iconCenter: 0.4288, labelCenter: 0.5928, iconSize: 40, labelSize: 21 },
} as const

const COLOR = {
  page: '#ffffff',
  cardStroke: '#e9ecf1',
  active: '#f47b20',
  idle: '#f4f5f7',
  activeInk: '#ffffff',
  idleInk: '#c2c8d1',
  caption: 'rgba(24,28,34,0.86)',
}

/** Material Symbols exported from the Figma frame, plus matching icons for the other steps. */
const ICONS: Record<Step['icon'], string> = {
  camera: '/icons/photo_camera.svg',
  barcode: '/icons/barcode_scanner.svg',
  qr: '/icons/barcode_scanner.svg',
  box: '/icons/move_to_inbox.svg',
  sticker: '/icons/note_stack.svg',
  apply: '/icons/task_alt.svg',
  continue: '/icons/forward_to_inbox.svg',
}

const iconCache = new Map<string, HTMLImageElement>()
const tintCache = new Map<string, HTMLCanvasElement>()

function icon(src: string): HTMLImageElement | undefined {
  const cached = iconCache.get(src)
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : undefined
  const img = new Image()
  img.src = src
  iconCache.set(src, img)
  return undefined
}

/** Icons ship as black glyphs; recolour them through an offscreen buffer. */
function tinted(src: string, color: string, size: number): HTMLCanvasElement | undefined {
  const key = `${src}|${color}|${size}`
  const cached = tintCache.get(key)
  if (cached) return cached
  const img = icon(src)
  if (!img) return undefined
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, size, size)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  tintCache.set(key, canvas)
  return canvas
}

/** Preloads every icon so the first exported frame is not missing artwork. */
export function preloadOverlayIcons() {
  return Promise.all(
    Object.values(ICONS).map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => resolve()
          img.src = src
          iconCache.set(src, img)
        }),
    ),
  )
}

/** Starts a fresh rounded-rect path. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r as number)
}

/**
 * Draws the 2D layer on top of the render: the step rail and viewport card from the
 * Figma frame, plus the caption bar. Shared by the viewport and the exporter.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  scene: SceneDef,
  t: number,
  lang: 'th' | 'en',
  opts: { chrome?: boolean } = {},
) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const s = W / LAYOUT.frame.w // uniform scale; the frame ratio is fixed at 1080:683
  ctx.clearRect(0, 0, W, H)

  const card = {
    x: LAYOUT.card.x * s,
    y: LAYOUT.card.y * s,
    w: LAYOUT.card.w * s,
    h: LAYOUT.card.h * s,
    r: LAYOUT.card.radius * s,
  }

  // mask everything outside the viewport card so the render cannot bleed into the page
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  // second subpath must join the same path, so the rounded card punches a hole
  ctx.roundRect(card.x, card.y, card.w, card.h, card.r)
  ctx.fillStyle = COLOR.page
  ctx.fill('evenodd')
  ctx.restore()

  if (opts.chrome !== false) {
    roundRect(ctx, card.x, card.y, card.w, card.h, card.r)
    ctx.strokeStyle = COLOR.cardStroke
    ctx.lineWidth = Math.max(1, 2 * s)
    ctx.stroke()
  }

  // step rail: one chip per step, split evenly over the rail height
  const rail = {
    x: LAYOUT.rail.x * s,
    y: LAYOUT.rail.y * s,
    w: LAYOUT.rail.w * s,
    h: LAYOUT.rail.h * s,
    r: LAYOUT.rail.radius * s,
  }
  const count = Math.max(1, scene.steps.length)
  const chipH = rail.h / count

  scene.steps.forEach((step, i) => {
    const y = rail.y + i * chipH
    const first = i === 0
    const last = i === count - 1
    const radii = [first ? rail.r : 0, first ? rail.r : 0, last ? rail.r : 0, last ? rail.r : 0]

    const active = t >= step.t0 && t < step.t1
    // chips cross-fade over 0.25s so the state change reads as motion, not a cut
    const fadeIn = Math.min(1, Math.max(0, (t - step.t0) / 0.25))
    const fadeOut = Math.min(1, Math.max(0, (t - step.t1) / 0.25))
    const strength = active ? fadeIn : t >= step.t1 ? 1 - fadeOut : 0

    roundRect(ctx, rail.x, y, rail.w, chipH, radii)
    ctx.fillStyle = COLOR.idle
    ctx.fill()
    if (strength > 0.001) {
      ctx.save()
      ctx.globalAlpha = strength
      roundRect(ctx, rail.x, y, rail.w, chipH, radii)
      ctx.fillStyle = COLOR.active
      ctx.fill()
      ctx.restore()
    }

    const ink = strength > 0.5 ? COLOR.activeInk : COLOR.idleInk
    const iconSize = LAYOUT.chip.iconSize * s
    const glyph = tinted(ICONS[step.icon], ink, Math.round(iconSize * 2))
    if (glyph) {
      ctx.drawImage(glyph, rail.x + rail.w / 2 - iconSize / 2, y + chipH * LAYOUT.chip.iconCenter - iconSize / 2, iconSize, iconSize)
    }

    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${LAYOUT.chip.labelSize * s}px "Noto Sans Thai", Inter, Helvetica, Arial, sans-serif`
    const label = lang === 'th' ? step.label : step.labelEn
    // the scene decides where a label breaks: splitting on every space put "QR" and
    // "Code" on separate lines
    const lines = label.split('\n')
    const lineH = LAYOUT.chip.labelSize * 1.25 * s
    const top = y + chipH * LAYOUT.chip.labelCenter - ((lines.length - 1) * lineH) / 2
    lines.forEach((line, li) => ctx.fillText(line, rail.x + rail.w / 2, top + li * lineH, rail.w * 0.86))
  })

  // success flash: the card dims and a green check lands, as on the Figma Complete board
  const win = scene.success?.find((c) => t >= c.t0 && t < c.t1)
  if (win) {
    const inP = Math.min(1, (t - win.t0) / 0.35)
    const outP = Math.min(1, (win.t1 - t) / 0.3)
    const alpha = Math.max(0, Math.min(inP, outP))
    ctx.save()
    roundRect(ctx, card.x, card.y, card.w, card.h, card.r)
    ctx.clip()
    ctx.fillStyle = `rgba(60,64,70,${0.45 * alpha})`
    ctx.fillRect(card.x, card.y, card.w, card.h)
    // overshoot pop on the check badge
    const pop = 1 - Math.pow(1 - inP, 3)
    const r = 78 * s * (0.7 + 0.3 * pop) * (1 + 0.06 * Math.sin(Math.min(1, inP) * Math.PI))
    const cx = card.x + card.w / 2
    const cy = card.y + card.h / 2
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#22a45d'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = r * 0.16
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.38, cy + r * 0.02)
    ctx.lineTo(cx - r * 0.08, cy + r * 0.32)
    ctx.lineTo(cx + r * 0.42, cy - r * 0.3)
    ctx.stroke()
    ctx.restore()
  }

  // caption bar, pinned inside the card
  const cue = scene.captions.find((c) => t >= c.t0 && t < c.t1)
  if (cue) {
    const alpha = Math.max(0, Math.min(Math.min(1, (t - cue.t0) / 0.3), Math.min(1, (cue.t1 - t) / 0.3)))
    const text = lang === 'th' ? cue.text : cue.textEn
    const size = 26 * s
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = `600 ${size}px "Noto Sans Thai", Inter, Helvetica, Arial, sans-serif`
    const boxW = Math.min(card.w - 48 * s, ctx.measureText(text).width + size * 1.6)
    const boxH = size * 1.9
    const bx = card.x + (card.w - boxW) / 2
    const by = card.y + card.h - boxH - 24 * s + (1 - alpha) * 8 * s
    roundRect(ctx, bx, by, boxW, boxH, boxH * 0.32)
    ctx.fillStyle = COLOR.caption
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, bx + boxW / 2, by + boxH / 2, boxW - size)
    ctx.restore()
  }
}
