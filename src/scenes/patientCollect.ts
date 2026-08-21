import type { SceneDef } from '../anim/types'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import { KIOSK_ANCHORS } from '../scene/Kiosk'

/**
 * Rework of Patient-WhileCollectingMedicine, following the storyboard at Figma 73:4292
 * and the client's flow: take the plastic case out of the pick-up bay, take the medicine
 * out of the case, scan that at the window on the right, collect the printed label, apply
 * it to the box, hand the empty case back, then press for the next item.
 *
 * The rail keeps the storyboard's four steps. The patient is the Figma vector art on a
 * hinged limb; the case, the carton and the label are props riding in her hand, and the
 * close beats — opening the case, applying the label, returning the case — are staged as
 * inserts clear of the cabinet.
 */
const A = KIOSK_ANCHORS
const FULL = A.body
const SCAN = A.scanner
const DOOR = A.pickup
const SLOT = A.stickerSlot
/** where the carton is held while it is read */
const READ: [number, number, number] = [SCAN[0], SCAN[1] - 0.04, SCAN[2] + 0.14]
/** and where it meets the label coming out of the slot */
const TAKE: [number, number, number] = [SLOT[0], SLOT[1] - 0.05, SLOT[2] + 0.14]
/** where the case waits on the shelf */
const BOX_ON_SHELF: [number, number, number] = [A.pickupShelf[0], A.pickupShelf[1] + 0.017, A.pickupShelf[2] + 0.075]
/** what the pick-up insert frames: the open bay with the case sitting in it */
const BAYVIEW: [number, number, number] = [A.pickup[0], A.pickupShelf[1] + 0.05, DOOR[2]]
/** staging point for the close inserts, clear of the cabinet */
const DEMO: [number, number, number] = [-1.05, 1.2, 1.75]
/** where the carton sits once it is out of the case, and where the label lands on it */
const CARTON: [number, number, number] = [DEMO[0] + 0.07, DEMO[1] + 0.08, DEMO[2] + 0.02]
/** the basket the empty case goes back into, staged under the insert */
const BASKET: [number, number, number] = [DEMO[0] - 0.13, DEMO[1] - 0.3, DEMO[2] - 0.02]
/** the shot that takes in the basket */
const BASKET_VIEW: [number, number, number] = [DEMO[0] - 0.07, DEMO[1] - 0.1, DEMO[2]]
/** the button on the kiosk screen she presses for the next item */
const BUTTON: [number, number, number] = [A.screen[0], A.screen[1] - 0.22, A.screen[2]]

export const patientCollect: SceneDef = {
  id: 'patient-collect-medicine',
  name: 'Patient · Collecting Medicine',
  duration: 29.4,
  fps: 30,
  size: [1080, 683],
  background: '#ffffff',
  camera: { position: shot(FULL, DIST.wide, 35, 13), target: FULL, fov: FOV },
  actors: [
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
      // the case waiting on the shelf inside the bay, before she takes it
      id: 'bayBox',
      kind: 'prop',
      primitive: 'plasticCase',
      label: 'Case in the bay',
      position: BOX_ON_SHELF,
      rotation: [-Math.PI / 2, 0, 0.15],
      visible: false,
    },
    {
      // what she carries out of the bay, until the carton comes out of it
      id: 'handCase',
      kind: 'prop',
      primitive: 'plasticCase',
      label: 'Case in her hand',
      // in the hand's own frame: centred on the fist and behind it, so the fingers cover
      // the near edge. Scaled to the hand — full size hangs out of the drawn fist.
      position: [0.008, -0.03, -0.018],
      scale: 0.85,
      visible: false,
      params: { attachTo: 'patient:grip' },
    },
    {
      // the medicine itself, from the moment it is out of the case
      id: 'handBox',
      kind: 'prop',
      primitive: 'medicinePackage',
      label: 'Medicine box',
      position: [0.008, -0.03, -0.018],
      scale: 0.85,
      visible: false,
      params: { attachTo: 'patient:grip' },
    },
    {
      // inserts: the case is opened, the carton comes out, the label goes on, the case
      // goes back in the basket
      id: 'demoCase',
      kind: 'prop',
      primitive: 'plasticCase',
      label: 'Demo · case',
      position: DEMO,
      rotation: [0.05, -0.5, 0.05],
      visible: false,
    },
    {
      id: 'demoBasket',
      kind: 'prop',
      primitive: 'returnBasket',
      label: 'Demo · return basket',
      position: BASKET,
      rotation: [0, -0.5, 0],
      visible: false,
    },
    {
      id: 'demoBox',
      kind: 'prop',
      primitive: 'medicinePackage',
      label: 'Demo · box',
      position: CARTON,
      rotation: [0.05, -0.5, 0.05],
      visible: false,
    },
    {
      id: 'demoLabel',
      kind: 'prop',
      primitive: 'sticker',
      label: 'Demo · label',
      scale: 0.62,
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
  ],
  tracks: [
    // ---- shot list ----
    track('camera', 'position', [
      k(0, shot(FULL, DIST.wide, 35, 13)),
      k(0.4, shot(FULL, DIST.wide, 35, 13)),
      k(1.6, shot(DOOR, DIST.close, 36, 14), 'smooth'),           // 1 · Collecting Medicine
      k(2.6, shot(DOOR, 1.5, 34, 10), 'standard'),
      k(4, shot(DOOR, 1.5, 34, 10)),                              // hold on the open bay
      k(5.4, shot(DOOR, DIST.close + 0.4, 40, 12), 'smooth'),
      // push in on the bay before she folds at all, so the stoop happens off-frame and
      // the move stays continuous — no cut in the middle of the pick-up
      k(6.2, shot(BAYVIEW, 1.15, 40, 12), 'smooth'),
      k(7.65, shot(BAYVIEW, 1.05, 40, 12)),
      k(8.1, shot(READ, DIST.close + 0.4, 42, 10), 'smooth'),     // ease back out with the case
      // insert: the medicine comes out of the case
      k(8.6, shot(DEMO, 0.58, 18, 8)),
      k(10.1, shot(CARTON, 0.52, 22, 8), 'smooth'),
      // back to the cabinet with the medicine, up to the scan window
      k(10.6, shot(READ, DIST.close + 0.2, 44, 9)),
      k(12.4, shot(SCAN, DIST.close, 40, 9), 'smooth'),
      k(14.6, shot(SCAN, DIST.close, 40, 9)),                     // hold on the scan result
      k(16.2, shot(SLOT, 1.4, 34, 10), 'smooth'),                 // 2 · Collecting Sticker
      k(18.6, shot(TAKE, DIST.close, 42, 10), 'smooth'),
      // 3 · Applying Sticker — a straight cut to the demonstration, no camera move
      k(20.4, shot(CARTON, 0.5, 24, 6)),
      k(22.9, shot(CARTON, 0.46, 26, 6), 'smooth'),
      k(23.4, shot(BASKET_VIEW, 1.35, 22, 20), 'smooth'),         // down onto the basket
      k(24.9, shot(BASKET_VIEW, 1.3, 22, 20)),
      // 4 · Continue Collecting — she presses for the next item
      k(25.4, shot(BUTTON, DIST.close + 0.4, 34, 8)),
      k(29.4, shot(BUTTON, DIST.close + 0.4, 34, 8)),
    ]),
    track('target', 'position', [
      k(0, FULL),
      k(0.4, FULL),
      k(1.6, DOOR, 'smooth'),
      k(5.4, DOOR),
      k(6.2, BAYVIEW, 'smooth'),
      k(7.65, BAYVIEW),
      k(8.1, READ, 'smooth'),
      k(8.6, DEMO),
      k(10.1, CARTON, 'smooth'),
      k(10.6, READ),
      k(12.4, SCAN, 'smooth'),
      k(14.6, SCAN),
      k(16.2, SLOT, 'smooth'),
      k(18.6, TAKE, 'smooth'),
      k(20.4, CARTON),
      k(22.9, CARTON),
      k(23.4, [BASKET[0] + 0.03, BASKET[1] + 0.1, BASKET[2]], 'smooth'),
      k(24.9, [BASKET[0] + 0.03, BASKET[1] + 0.1, BASKET[2]]),
      k(25.4, BUTTON),
      k(29.4, BUTTON),
    ]),
    custom('camera', 'fov', [
      k(0, FOV), k(0.4, FOV), k(2.6, 20, 'smooth'), k(4, 20), k(5.4, 26, 'smooth'),
      k(6.2, 24, 'smooth'), k(7.65, 24), k(8.1, 26, 'smooth'), k(8.6, 20), k(10.1, 20),
      k(10.6, 26), k(14.6, 26), k(16.2, 22, 'smooth'), k(18.6, 26, 'smooth'),
      k(20.4, 24), k(24.9, 24), k(25.4, 26), k(29.4, 26),
    ]),

    // ---- kiosk ----
    custom('kiosk', 'screenState', steps([
      [0, 'medicineList'], [1.6, 'collecting'], [12.6, 'collectingNext'], [26.6, 'collectingDone'], [27.8, 'medicineList'],
    ])),
    // the bay opens for the callout and stays open until her arm is clear of it
    custom('kiosk', 'doorOpen', [
      k(1.6, 0), k(2.6, 1, 'decelerate'), k(7.9, 1), k(8.7, 0, 'accelerate'),
    ]),
    // scan window: points itself out, then closes on the carton she holds up to it
    custom('kiosk', 'scanGlow', [
      k(9.8, 0), k(10.6, 0.45, 'decelerate'), k(11.4, 0.4), k(12.0, 1, 'decelerate'),
      k(12.2, 0.9), k(12.6, 0, 'accelerate'),
    ]),
    custom('kiosk', 'scanReach', [k(0, 0.34), k(11.4, 0.34), k(12.0, 0.24, 'decelerate'), k(29.4, 0.24)]),
    custom('kiosk', 'scanSpread', [k(0, 0.1), k(11.4, 0.1), k(12.0, 0.14, 'decelerate'), k(29.4, 0.14)]),
    custom('kiosk', 'scanTilt', [k(0, 0.16), k(11.4, 0.16), k(12.0, -0.1, 'smooth'), k(29.4, -0.1)]),
    // the label feeds out of the sticker slot, and is taken once the hand reaches it
    custom('kiosk', 'stickerFeed', [
      k(15.6, 0), k(17.2, 1, 'decelerate'), k(19.0, 1), k(19.4, 0, 'accelerate'),
    ]),

    // ---- patient ----
    // she is off screen for the inserts, which are staged away from the cabinet
    track('patient', 'visible', steps([
      [0, false], [4, true], [8.6, false], [10.45, true], [20.4, false], [25.4, true],
    ])),
    track('patient', 'position', [
      k(4, [-1.5, 0, 1.95]),
      k(6.2, [0.24, 0, 0.92], 'smooth'),
      // one move in and one move back out: she steps up to the bay, stoops, and returns
      k(6.6, [0.28, 0, 0.72], 'smooth'),
      k(7.5, [0.28, 0, 0.72]),
      k(8.1, [0.24, 0, 0.92], 'smooth'),
      k(29.4, [0.24, 0, 0.92]),
    ]),
    track('patient', 'opacity', [k(4, 1), k(29.4, 1)]),
    custom('patient', 'tilt', [k(4, 0.3), k(6.2, 0.45, 'smooth'), k(29.4, 0.45)]),
    // down into the bay -> up to the scan window -> down while the label prints -> up to
    // the slot -> up to the button on the screen
    track('patient', 'reach', [
      k(4, 0), k(5.8, 0), k(6.9, 1, 'smooth'), k(13.2, 1),
      k(14.4, 0.12, 'smooth'), k(17.0, 0.12),
      k(18.4, 1, 'smooth'), k(19.6, 1), k(20.4, 0.55, 'smooth'),
      k(25.4, 0.55), k(26.4, 1, 'smooth'), k(29.4, 1),
    ]),
    // the pick-up insert is framed on the bay alone, so the rest of the figure is switched
    // off for it: what is left is the arm coming into frame and taking the case.
    // Held, not stepped — two numeric keys would interpolate and show the body half-on.
    custom('patient', 'armOnly', [k(0, 0), k(6.19, 0), k(6.2, 1), k(7.79, 1), k(7.8, 0), k(29.4, 0)]),
    // she stoops to the bay and straightens up with the case
    custom('patient', 'bend', [
      k(5.9, 0), k(6.9, 1, 'smooth'), k(7.5, 1), k(8.1, 0, 'smooth'), k(29.4, 0),
    ]),
    custom('patient', 'reachTarget', [
      // the rig lines the grip up with the target on screen, so aiming at the case itself
      // puts her hand on it while the board stays in front of the cabinet
      k(0, BOX_ON_SHELF),
      k(7.6, BOX_ON_SHELF),
      k(10.9, READ, 'smooth'),
      k(16.4, READ),
      k(17.8, TAKE, 'smooth'),
      k(19.6, TAKE),
      k(20.4, READ, 'smooth'),
      k(25.8, READ),
      k(26.6, BUTTON, 'smooth'),
      k(29.4, BUTTON),
    ]),

    // ---- props in her hand ----
    // the case is on the shelf from the start — the shutter hides it until the bay opens,
    // so the bay must never be seen empty and then filled
    track('bayBox', 'visible', steps([[0, true], [7.45, false]])),
    track('bayBox', 'position', [
      k(0, BOX_ON_SHELF),
      k(7.25, BOX_ON_SHELF),
      // lifted a little as she closes her hand on it
      k(7.45, [BOX_ON_SHELF[0], BOX_ON_SHELF[1] + 0.02, BOX_ON_SHELF[2] + 0.03], 'decelerate'),
    ]),
    track('bayBox', 'rotation', [
      k(0, [-Math.PI / 2, 0, 0.15]),
      k(7.25, [-Math.PI / 2, 0, 0.15]),
      k(7.45, [-Math.PI / 3, 0, 0.1], 'decelerate'),
    ]),
    // she carries the case out of the bay; from the insert on, she carries the medicine
    track('handCase', 'visible', steps([[0, false], [7.45, true], [8.6, false]])),
    track('handCase', 'rotation', [k(7.45, [0.1, -0.5, 0.35]), k(8.4, [0.05, -0.3, 0.2], 'smooth')]),
    track('handBox', 'visible', steps([[0, false], [10.6, true], [20.4, false], [25.4, true]])),
    track('handBox', 'rotation', [
      k(10.6, [0.05, -0.3, 0.1]),
      k(12.0, [0.05, -0.2, 0], 'smooth'),
    ]),
    // the printed label rides in her hand between the slot and the applying insert
    track('label', 'visible', steps([[0, false], [19.4, true], [20.4, false]])),
    track('label', 'position', [
      k(19.4, [0.02, 0.07, 0.06], 'decelerate'),
      k(20.4, [0.0, 0.02, 0.05], 'smooth'),
    ]),
    track('label', 'rotation', [k(19.4, [0.2, -0.3, 0.25]), k(20.4, [0.05, -0.2, 0.02], 'smooth')]),

    // ---- insert 1: the medicine comes out of the plastic case ----
    track('demoCase', 'visible', steps([[0, false], [8.6, true], [10.6, false], [20.4, true], [25.4, false]])),
    // the lid drops open for the first insert and stays open through the return
    custom('demoCase', 'open', [k(8.6, 0), k(8.9, 0), k(9.6, 1, 'smooth'), k(29.4, 1)]),
    custom('demoCase', 'empty', [k(0, 0), k(9.9, 0), k(10.0, 1), k(29.4, 1)]),
    track('demoCase', 'position', [
      k(8.6, DEMO),
      k(23.5, DEMO),
      // returned to the basket at the end of the applying step
      k(24.5, [BASKET[0] + 0.01, BASKET[1] + 0.045, BASKET[2]], 'decelerate'),
      k(25.4, [BASKET[0] + 0.01, BASKET[1] + 0.045, BASKET[2]]),
    ]),
    track('demoCase', 'rotation', [
      k(8.6, [0.05, -0.5, 0.05]),
      k(23.5, [0.05, -0.5, 0.05]),
      k(24.5, [0.05, -0.5, -0.42], 'smooth'),
    ]),
    // the carton lifts out of the open case
    track('demoBox', 'visible', steps([[0, false], [8.6, true], [10.6, false], [20.4, true], [25.4, false]])),
    track('demoBox', 'position', [
      k(8.6, [DEMO[0], DEMO[1], DEMO[2] + 0.005]),
      k(9.9, [DEMO[0], DEMO[1], DEMO[2] + 0.005]),
      k(10.5, CARTON, 'decelerate'),
      k(29.4, CARTON),
    ]),
    track('demoBox', 'rotation', [k(8.6, [0.05, -0.62, 0.05]), k(10.5, [0.05, -0.34, 0.05], 'smooth')]),

    // ---- insert 2: the label is peeled off its backing and pressed onto the carton ----
    track('demoLabel', 'visible', steps([[0, false], [20.5, true], [25.4, false]])),
    custom('demoLabel', 'curl', [k(20.5, 1), k(21.2, 0.75, 'smooth'), k(22.1, 0.06, 'smooth'), k(22.5, 0)]),
    track('demoLabel', 'position', [
      k(20.5, [CARTON[0] - 0.02, CARTON[1] + 0.085, CARTON[2] + 0.075], 'decelerate'),
      k(21.4, [CARTON[0] - 0.005, CARTON[1] + 0.05, CARTON[2] + 0.055], 'smooth'),
      k(22.3, [CARTON[0] - 0.007, CARTON[1] + 0.012, CARTON[2] + 0.019], 'decelerate'),
      k(22.5, [CARTON[0] - 0.007, CARTON[1] + 0.012, CARTON[2] + 0.019]),
    ]),
    track('demoLabel', 'rotation', [
      k(20.5, [0.5, -0.62, 0.35]),
      k(22.3, [0.05, -0.34, 0.05], 'smooth'),
    ]),

    // ---- insert 3: the empty case goes back in the basket ----
    track('demoBasket', 'visible', steps([[0, false], [23.2, true], [25.4, false]])),
  ],
  markers: [
    { t: 1.6, label: 'pick-up bay' },
    { t: 7.45, label: 'case taken' },
    { t: 10.0, label: 'medicine out of the case' },
    { t: 12.0, label: 'scan the medicine' },
    { t: 17.2, label: 'label printed' },
    { t: 22.5, label: 'label applied' },
    { t: 24.5, label: 'case returned' },
    { t: 26.6, label: 'next item' },
  ],
  steps: [
    { id: 'collect', label: 'รับยา', labelEn: 'Collecting\nMedicine', icon: 'box', t0: 0, t1: 15.6 },
    { id: 'sticker', label: 'รับ\nสติกเกอร์', labelEn: 'Collecting\nSticker', icon: 'sticker', t0: 15.6, t1: 20.4 },
    { id: 'apply', label: 'ติด\nสติกเกอร์', labelEn: 'Applying\nSticker', icon: 'apply', t0: 20.4, t1: 25.4 },
    { id: 'continue', label: 'รับยาต่อ', labelEn: 'Continue\nCollecting', icon: 'continue', t0: 25.4, t1: 29.4 },
  ],
  captions: [
    { t0: 2, t1: 5, text: 'ช่องรับยาอยู่บริเวณนี้', textEn: 'The pick-up slot is located here' },
    { t0: 5.8, t1: 7.8, text: 'กรุณาหยิบกล่องยาออกจากช่องรับยา', textEn: 'Please take the medicine from the pick-up slot' },
    { t0: 8.8, t1: 10.4, text: 'กรุณานำยาออกจากกล่องพลาสติก', textEn: 'Please take the medicine out of the plastic case' },
    { t0: 11.0, t1: 12.4, text: 'กรุณาสแกนกล่องยาที่ช่องสแกนด้านขวา', textEn: 'Please scan the medicine at the window on the right' },
    { t0: 16.0, t1: 19.0, text: 'ระบบกำลังพิมพ์ฉลากยาที่ช่องสติกเกอร์', textEn: 'The label is being printed at the sticker slot' },
    { t0: 20.6, t1: 22.6, text: 'กรุณาติดฉลากยาลงบนกล่องยา', textEn: 'Please apply the label to the medicine box' },
    { t0: 23.6, t1: 25.0, text: 'กรุณาวางกล่องพลาสติกคืนที่ตะกร้า', textEn: 'Please return the plastic case to the basket' },
    { t0: 26.0, t1: 28.8, text: 'กรุณากดปุ่มเพื่อรับยารายการถัดไป', textEn: 'Please press the button for the next item' },
  ],
  success: [{ t0: 26.6, t1: 27.8 }],
}
