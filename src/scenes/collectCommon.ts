import type { ActorDef } from '../anim/types'
import { KIOSK_ANCHORS, KIOSK_SIZE } from '../scene/Kiosk'

/**
 * Shared staging for the two collecting-medicine flows.
 *
 * OPD and IPD differ only in what releases the label — scanning the medicine at the
 * window, or pressing to collect at the screen — so the anchors, the props and the way
 * the close beats are staged are the same for both.
 */
export const A = KIOSK_ANCHORS
export const FULL = A.body
export const SCAN = A.scanner
export const DOOR = A.pickup
export const SLOT = A.stickerSlot

/** where the medicine is held while it is read */
export const READ: [number, number, number] = [SCAN[0], SCAN[1] - 0.04, SCAN[2] + 0.14]
/** and where a hand meets the label coming out of the slot */
export const TAKE: [number, number, number] = [SLOT[0], SLOT[1] - 0.05, SLOT[2] + 0.14]
/**
 * Where the case waits on the shelf. The case is 5 cm deep and drawn around its centre,
 * so it has to sit half of that above the shelf or it cuts into it — and the
 * demonstration fades in on this same anchor, so a wrong height shows up as the case
 * jumping the moment the cabinet dissolves.
 */
export const BOX_ON_SHELF: [number, number, number] = [
  A.pickupShelf[0],
  A.pickupShelf[1] + 0.026,
  A.pickupShelf[2] + 0.05,
]
/** what the pick-up insert frames: the open bay with the case sitting in it */
export const BAYVIEW: [number, number, number] = [A.pickup[0], A.pickupShelf[1] + 0.05, DOOR[2]]
/**
 * Where the demonstrations are staged. They sit just in front of where she is standing,
 * so fading the cabinet out and pushing in reads as one continuous move rather than a cut
 * to another set.
 */
export const DEMO: [number, number, number] = [SLOT[0] - 0.3, SLOT[1] - 0.05, SLOT[2] + 0.55]
/** where the medicine sits once it is out of the case, and where the label lands on it */
export const CARTON: [number, number, number] = [DEMO[0] + 0.07, DEMO[1] + 0.08, DEMO[2] + 0.02]
/** the side table against the kiosk's left flank, real furniture on the floor */
export const TABLE: [number, number, number] = [KIOSK_SIZE.width / 2 + 0.34, 0, 0.18]
const TABLE_TOP = 0.72
/** the basket the empty case goes back into, standing on the table */
export const BASKET: [number, number, number] = [TABLE[0], TABLE_TOP, TABLE[2] + 0.02]
/** where the case ends up once it is in the basket */
export const IN_BASKET: [number, number, number] = [BASKET[0], BASKET[1] + 0.088, BASKET[2] + 0.058]
/** the shot that takes in the basket and the table under it */
export const BASKET_VIEW: [number, number, number] = [BASKET[0], BASKET[1] + 0.04, BASKET[2]]
/** the button on the kiosk screen she presses */
export const BUTTON: [number, number, number] = [A.screen[0], A.screen[1] - 0.22, A.screen[2]]

/** Everything on stage. Both flows use the same cast; only the timing differs. */
export function collectActors(): ActorDef[] {
  return [
    { id: 'kiosk', kind: 'kiosk', label: 'Kiosk', position: [0, 0, 0] },
    {
      id: 'patient',
      kind: 'puppet',
      label: 'Patient (2D rig)',
      url: '/textures/actors/patient-empty.svg',
      position: [-1.5, 0, 1.95],
      visible: false,
      params: { height: 1.68, tilt: 0.7, rig: 'patient-hand' },
    },
    {
      // what she carries out of the bay
      id: 'handCase',
      kind: 'prop',
      primitive: 'plasticCase',
      label: 'Case in her hand',
      // In the hand's own frame: well behind the drawn fist and low in it, so the fingers
      // close over the near edge instead of the case cutting through them. At full size
      // the tray is twice the width of the hand and read as passing straight through it.
      position: [0.03, -0.026, -0.042],
      scale: 0.68,
      visible: false,
      params: { attachTo: 'patient:grip' },
    },
    {
      // the medicine, carried from the unpacking demonstration onwards
      id: 'handBox',
      kind: 'prop',
      primitive: 'medicinePackage',
      label: 'Medicine box',
      // deeper into the fist than the case: the carton is taller, so it has to sit
      // lower and further behind or its top corner pokes out between the fingers
      position: [0.006, -0.046, -0.026],
      scale: 0.85,
      visible: false,
      params: { attachTo: 'patient:grip' },
    },
    {
      // One case for the whole clip: it starts on the shelf inside the bay and is the
      // same object that the demonstration opens and hands back. Splitting it in two was
      // what let the one in the bay drift out of step with the one in the close-up.
      id: 'case',
      kind: 'prop',
      primitive: 'plasticCase',
      label: 'Plastic case',
      position: BOX_ON_SHELF,
      rotation: [0, 0.2, 0],
    },
    {
      // real set dressing: the table and its basket stand by the kiosk from frame one,
      // and the same basket is the one the demonstration drops the empty case into
      id: 'table',
      kind: 'prop',
      primitive: 'sideTable',
      label: 'Side table',
      position: TABLE,
    },
    {
      id: 'demoBasket',
      kind: 'prop',
      primitive: 'returnBasket',
      label: 'Return basket',
      position: BASKET,
    },
    {
      // likewise the medicine: it lies in the case from the first frame
      id: 'demoBox',
      kind: 'prop',
      primitive: 'medicinePackage',
      label: 'Medicine box',
      position: [BOX_ON_SHELF[0], BOX_ON_SHELF[1] - 0.006, BOX_ON_SHELF[2]],
      // lying flat and square to the case, which sits on the shelf at yaw 0.2
      rotation: [-Math.PI / 2, 0, Math.PI / 2 + 0.2],
    },
    {
      id: 'demoLabel',
      kind: 'prop',
      primitive: 'sticker',
      label: 'Demo · label',
      // narrower than the carton face, so it sits inside the box edges when applied
      scale: 0.52,
      position: [CARTON[0] - 0.01, CARTON[1] + 0.07, CARTON[2] + 0.06],
      visible: false,
    },
    {
      id: 'label',
      kind: 'prop',
      primitive: 'sticker',
      label: 'Printed label',
      scale: 0.62,
      position: [0, -0.02, 0.05],
      visible: false,
      params: { attachTo: 'patient:grip' },
    },
  ]
}
