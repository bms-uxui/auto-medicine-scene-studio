import { KIOSK_LAYOUT, type KioskLayout } from './kioskLayout'

/** UV window into a texture: [u0, v0, u1, v1], v measured from the bottom. */
export type UvWindow = [number, number, number, number]

export interface LiveryPanel {
  url: string
  /** which slice of the texture wraps this panel; omit for the whole image */
  window?: UvWindow
}

export interface Livery {
  id: string
  name: string
  front: LiveryPanel
  side: LiveryPanel
  /** face layout that goes with this wrap */
  layout: KioskLayout
  /** shell colour showing at the edges and around the panels */
  shell: string
}

/**
 * The teal wrap (Figma node 30:398) is the machine as built: a single sheet covering
 * LH | front | RH, so each panel takes a slice of it. Window values were fitted against
 * the cut-outs printed on the sheet; the model lab can nudge them further.
 */
const TEAL_LAYOUT: KioskLayout = {
  ...KIOSK_LAYOUT,
  // measured off the wrap sheet (cut-outs printed on it), converted to front-panel units
  screen: [3919, 1021, 1094, 1894],
  cameraBar: [4213, 703, 503, 134],
  sensorDot: [4400, 3380, 60, 60],
  stickerSlot: [3980, 3560, 330, 78],
  receiptSlot: [4380, 3560, 330, 78],
  scannerBox: [4790, 3490, 220, 220],
  pickup: [3858, 4584, 1155, 966],
}

export const LIVERIES: Livery[] = [
  {
    id: 'teal-medical',
    name: 'Teal medical (30:398)',
    front: { url: '/textures/liveries/teal-wrap.png', window: [0.301, 0, 0.737, 1] },
    side: { url: '/textures/liveries/teal-wrap.png', window: [0.737, 0, 0.993, 1] },
    layout: TEAL_LAYOUT,
    shell: '#cfe4e8',
  },
  {
    id: 'bgs-white',
    name: 'BGS white (14:342)',
    front: { url: '/textures/liveries/bgs-front.png' },
    side: { url: '/textures/liveries/bgs-side.png' },
    layout: KIOSK_LAYOUT,
    shell: '#fbfcfe',
  },
]

export const DEFAULT_LIVERY = LIVERIES[0]

export function liveryById(id: string): Livery {
  return LIVERIES.find((l) => l.id === id) ?? DEFAULT_LIVERY
}
