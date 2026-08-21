/**
 * Kiosk face layout, in the units of the Figma front-panel artwork
 * (file Auto-Medicine-Vending-Machine, node 14:342). Everything the model builds —
 * geometry, anchors, UV slices — is derived from this table, so the 3D fittings and
 * the printed livery can never drift apart.
 */
export interface KioskLayout {
  /** front panel export size in Figma units */
  front: { w: number; h: number }
  /** side panel (LH/RH) width in the same units */
  sideW: number
  /** cabinet height in metres; width and depth follow the artwork proportions */
  height: number
  /** rects are [x, y, w, h] in front-panel units */
  screen: [number, number, number, number]
  cameraBar: [number, number, number, number]
  sensorDot: [number, number, number, number]
  stickerSlot: [number, number, number, number]
  receiptSlot: [number, number, number, number]
  scannerBox: [number, number, number, number]
  pickup: [number, number, number, number]
}

export const KIOSK_LAYOUT: KioskLayout = {
  front: { w: 5480, h: 7710 },
  sideW: 3212,
  height: 2.0,
  screen: [3919, 1479, 1080, 1920],
  cameraBar: [4084, 1051, 750, 180],
  sensorDot: [4433, 3660, 52, 52],
  // the label prints from the middle slot; the receipt is the one on the left
  receiptSlot: [3960, 3900, 340, 80],
  stickerSlot: [4360, 3900, 340, 80],
  scannerBox: [4770, 3830, 230, 230],
  pickup: [3919, 4970, 1080, 1080],
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface KioskMetrics {
  size: { width: number; height: number; depth: number }
  face: number
  screen: Rect
  cameraBar: Rect
  sensorDot: Rect
  stickerSlot: Rect
  receiptSlot: Rect
  scannerBox: Rect
  pickup: Rect
}

/** Converts the artwork table into kiosk-local metres. */
export function computeMetrics(layout: KioskLayout): KioskMetrics {
  const H = layout.height
  const width = (H * layout.front.w) / layout.front.h
  const depth = (H * layout.sideW) / layout.front.h

  const rect = ([x, y, w, h]: [number, number, number, number]): Rect => ({
    x: ((x + w / 2) / layout.front.w - 0.5) * width,
    y: (1 - (y + h / 2) / layout.front.h) * H,
    w: (w / layout.front.w) * width,
    h: (h / layout.front.h) * H,
  })

  return {
    size: { width, height: H, depth },
    face: depth / 2,
    screen: rect(layout.screen),
    cameraBar: rect(layout.cameraBar),
    sensorDot: rect(layout.sensorDot),
    stickerSlot: rect(layout.stickerSlot),
    receiptSlot: rect(layout.receiptSlot),
    scannerBox: rect(layout.scannerBox),
    pickup: rect(layout.pickup),
  }
}

export type Vec3 = [number, number, number]

export interface KioskAnchors {
  screen: Vec3
  camera: Vec3
  scanner: Vec3
  stickerSlot: Vec3
  receiptSlot: Vec3
  pickup: Vec3
  pickupShelf: Vec3
  /** centre of the cabinet, used to frame the establishing shot */
  body: Vec3
}

/** World-space (kiosk-local) points scenes aim cameras and hands at. */
/** how deep the pick-up recess is cut into the cabinet, in metres */
export const BAY_DEPTH = 0.3
/** height of the shelf's top surface above the floor of that recess */
export const BAY_SHELF_RISE = 0.052

export function computeAnchors(layout: KioskLayout): KioskAnchors {
  const m = computeMetrics(layout)
  const at = (r: Rect): Vec3 => [r.x, r.y, m.face]
  return {
    screen: at(m.screen),
    camera: at(m.cameraBar),
    scanner: at(m.scannerBox),
    stickerSlot: at(m.stickerSlot),
    receiptSlot: at(m.receiptSlot),
    pickup: at(m.pickup),
    // the surface a package actually rests on, in the middle of the recess
    pickupShelf: [m.pickup.x, m.pickup.y - m.pickup.h / 2 + BAY_SHELF_RISE + 0.007, m.face - BAY_DEPTH / 2],
    body: [0.1, m.size.height * 0.5, 0],
  }
}

export const DEFAULT_METRICS = computeMetrics(KIOSK_LAYOUT)
