import type { SceneDef } from '../anim/types'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import {
  A, BASKET, BASKET_VIEW, BOX_ON_SHELF, CARTON, DEMO, DOOR, FULL, IN_BASKET,
  READ, SCAN, SLOT, TABLE, TAKE, collectActors,
} from './collectCommon'

/**
 * OPD flow, as the hospital runs it.
 *
 * The QR code is stuck on the *outside* of the plastic case, so the case is read before it
 * is ever opened — scanning comes second, not after the unpacking:
 *
 *   take the case from the bay -> hold it up to the scan window -> open it and return the
 *   empty case -> collect the printed sticker -> apply it to the medicine.
 *
 * (A few items are too small to be cased at all; those carry the QR on the medicine
 * itself. `MedicinePackage` takes a `qr` prop for that variant.)
 *
 * The cabinet dispenses the whole order in one go, so there is no next-item step.
 *
 * The close beats are not cuts: everything but what she is holding dissolves away, the
 * medicine is demonstrated on its own, and the cabinet dissolves back in.
 *
 * Beat sheet (all times chosen on 0.2s steps so the sheet stays editable):
 *   0.0- 2.6  establish, call out the bay — she walks in while it opens
 *   2.6- 4.2  the door is open: straight into the zoomed grab
 *   4.2- 5.0  the case lifts off the shelf and crossfades into her hand
 *   5.0- 7.4  pull back and walk her across to the scan window
 *   7.4- 9.8  she raises the case; the QR on the lid is read; verified at 9.2
 *   9.8-11.4  she carries it to the table; the cabinet dissolves
 *  11.4-14.2  isometric on the case: the lid pops off, the medicine rises and is taken
 *  14.2-16.0  the empty case is lowered into the basket; the cabinet dissolves back
 *  16.0-19.4  the sticker prints at the middle slot and is taken
 *  19.4-23.0  dissolve to the medicine; the sticker is pressed onto it
 *  23.0-26.4  back at the cabinet; the screen confirms the whole order is done
 */
/** where she stands beside the table, having just set the case down */
const AT_TABLE: [number, number, number] = [TABLE[0] - 0.34, 0, 0.8]
/** where she stands at the front of the cabinet, facing the scan window and the slot */
const AT_FRONT: [number, number, number] = [0.24, 0, 0.92]
/** the pull-back that takes in the cabinet and her walking across its face */
const FRONT_WIDE: [number, number, number] = [FULL[0], 1.05, FULL[2] + 0.2]

/** framing for the final push-in on the kiosk screen */
const SCREEN_VIEW: [number, number, number] = [A.screen[0], A.screen[1] - 0.1, A.screen[2]]

/** where the case ends up once it has been lifted clear of the shelf */
const LIFTED: [number, number, number] = [BOX_ON_SHELF[0], BOX_ON_SHELF[1] + 0.1, BOX_ON_SHELF[2] + 0.06]

export const patientCollectOpd: SceneDef = {
  id: 'patient-collect-opd',
  name: 'Patient · Collecting Medicine (in a case)',
  duration: 26.4,
  fps: 30,
  size: [1080, 683],
  background: '#ffffff',
  camera: { position: shot(FULL, DIST.wide, 35, 13), target: FULL, fov: FOV },
  actors: collectActors(),
  tracks: [
    // ---- shot list ----
    track('camera', 'position', [
      k(0, shot(FULL, DIST.wide, 35, 13)),
      k(0.4, shot(FULL, DIST.wide, 35, 13)),
      k(1.6, shot(DOOR, DIST.close, 36, 14), 'smooth'),           // 1 · Collecting Medicine
      // she's already on her way in as the door finishes opening — no dwell on the
      // empty bay before she gets there
      k(2.6, shot(DOOR, 1.5, 34, 10), 'standard'),
      // the moment the door is open the shot pushes straight into the grab insert
      k(3.2, shot(DOOR, 1.35, 38, 12), 'smooth'),
      k(4.2, shot(BOX_ON_SHELF, 1.0, 32, 12), 'smooth'),
      // out of the insert and back onto her, then across the cabinet face to the window
      k(5.6, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(6.4, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(8.0, shot(SCAN, 2.3, 40, 9), 'smooth'),
      k(9.8, shot(SCAN, 2.05, 40, 9), 'smooth'),                  // slow push while it reads
      // the cabinet dissolves and the case carries the shot into the unpacking step
      k(11.4, shot(DEMO, 0.62, 45, 32), 'smooth'),                // isometric for the demo
      k(14.2, shot(DEMO, 0.62, 45, 32), 'smooth'),
      k(15.2, shot(BASKET_VIEW, 1.75, 45, 32), 'smooth'),         // the return reads iso too
      k(16.0, shot(BASKET_VIEW, 1.7, 45, 32), 'smooth'),
      k(17.0, shot(SLOT, 1.4, 34, 10), 'smooth'),                 // 2 · Collecting Sticker
      k(18.8, shot(TAKE, 1.5, 38, 10), 'smooth'),
      // 3 · Applying Sticker — the sticker carries the shot from the slot to the staging
      k(20.4, shot(CARTON, 0.5, 0, 0), 'smooth'),
      k(22.8, shot(CARTON, 0.46, 0, 0), 'smooth'),
      // the cabinet dissolves back in as the camera pulls out onto the screen
      k(24.2, shot(SCREEN_VIEW, 1.15, 16, 5), 'smooth'),
      k(26.4, shot(SCREEN_VIEW, 0.95, 10, 3)),   // slow push-in on the screen
    ]),
    track('target', 'position', [
      k(0, FULL),
      k(0.4, FULL),
      k(1.6, DOOR, 'smooth'),
      k(3.2, DOOR, 'smooth'),
      k(4.2, BOX_ON_SHELF, 'smooth'),
      k(5.6, FRONT_WIDE, 'smooth'),
      k(6.4, FRONT_WIDE),
      k(8.0, SCAN, 'smooth'),
      k(9.8, SCAN),
      k(11.4, DEMO, 'smooth'),
      // the target flies WITH the case — same keys, same easing as its position track,
      // so the case stays pinned to frame centre for the whole carry
      k(14.2, DEMO),
      k(15.2, [IN_BASKET[0], IN_BASKET[1] + 0.2, IN_BASKET[2]], 'smooth'),
      k(16.0, [BASKET[0] + 0.03, BASKET[1] + 0.1, BASKET[2]], 'smooth'),
      k(17.0, SLOT, 'smooth'),
      k(18.8, TAKE, 'smooth'),
      k(20.4, CARTON, 'smooth'),
      k(22.8, CARTON),
      k(24.2, SCREEN_VIEW, 'smooth'),
      k(26.4, SCREEN_VIEW),
    ]),
    custom('camera', 'fov', [
      k(0, FOV), k(0.4, FOV), k(2.6, 20, 'smooth'),
      k(3.2, 24, 'smooth'), k(4.2, 23), k(5.6, 24, 'smooth'), k(6.4, 24),
      k(8.0, 22, 'smooth'), k(9.8, 22), k(11.4, 22, 'smooth'), k(16.0, 22),
      k(17.0, 22, 'smooth'), k(18.8, 23, 'smooth'),
      k(20.4, 24, 'smooth'), k(22.8, 24), k(24.2, 22, 'smooth'), k(26.4, 22),
    ]),

    // ---- kiosk ----
    custom('kiosk', 'screenState', steps([
      // The cabinet dispenses the whole order in one go, so the flow never reaches a
      // next-item step — and both collecting pages carry that button in their artwork.
      // The screen goes straight from the order list to the completed summary.
      [0, 'medicineList'], [1.6, 'collectingDone'],
    ])),
    custom('kiosk', 'doorOpen', [
      k(1.6, 0), k(2.6, 1, 'decelerate'), k(4.6, 1), k(5.8, 0, 'accelerate'),
    ]),
    // the window closes on the case she holds up to it — the QR is on its lid
    custom('kiosk', 'scanGlow', [
      k(8.0, 0), k(8.6, 0.45, 'decelerate'), k(9.0, 0.4), k(9.2, 1, 'decelerate'),
      k(9.6, 0.9), k(9.8, 0, 'accelerate'),
    ]),
    custom('kiosk', 'scanReach', [k(0, 0.34), k(8.6, 0.34), k(9.2, 0.24, 'decelerate'), k(26.4, 0.24)]),
    custom('kiosk', 'scanSpread', [k(0, 0.1), k(8.6, 0.1), k(9.2, 0.14, 'decelerate'), k(26.4, 0.14)]),
    custom('kiosk', 'scanTilt', [k(0, 0.16), k(8.6, 0.16), k(9.2, -0.1, 'smooth'), k(26.4, -0.1)]),
    // the sticker is only printed once the case has been read and emptied
    custom('kiosk', 'stickerFeed', [
      k(16.0, 0), k(17.6, 1, 'decelerate'), k(19.0, 1), k(19.4, 0, 'accelerate'),
    ]),
    // the cabinet dissolves away for each demonstration and comes back after it
    track('kiosk', 'opacity', [
      k(0, 1), k(10.6, 1), k(11.4, 0, 'smooth'), k(15.6, 0), k(16.4, 1, 'smooth'),
      k(19.4, 1), k(20.2, 0, 'smooth'), k(22.8, 0), k(24.0, 1, 'smooth'), k(26.4, 1),
    ]),

    // ---- patient ----
    track('patient', 'visible', steps([[0, false], [1.4, true]])),
    track('patient', 'position', [
      k(1.4, [-1.5, 0, 1.95]),
      k(3, AT_FRONT, 'smooth'),
      k(3.4, [0.28, 0, 0.72], 'smooth'),
      k(4.4, [0.28, 0, 0.72]),
      k(5.6, AT_FRONT, 'smooth'),
      k(9.8, AT_FRONT),
      // she walks to the table as the cabinet dissolves, and is repositioned there while
      // hidden for the unpacking demonstration
      k(11.6, AT_TABLE, 'smooth'),
      k(15.6, AT_TABLE),
      k(16.4, AT_FRONT, 'smooth'),
      k(26.4, AT_FRONT),
    ]),
    // she fades out with the cabinet: what is left on screen is the case alone
    track('patient', 'opacity', [
      k(1.4, 1), k(10.6, 1), k(11.4, 0, 'smooth'), k(15.6, 0), k(16.4, 1, 'smooth'),
      k(19.4, 1), k(20.2, 0, 'smooth'), k(22.8, 0), k(24.0, 1, 'smooth'), k(26.4, 1),
    ]),
    custom('patient', 'tilt', [k(1.4, 0.3), k(3, 0.45, 'smooth'), k(26.4, 0.45)]),
    // into the bay -> up to the scan window with the case -> down while the sticker
    // prints -> up to the slot -> resting on the medicine
    track('patient', 'reach', [
      k(1.4, 0), k(2.6, 0), k(3.6, 1, 'smooth'),
      k(4.6, 1), k(5.8, 0.35), k(7.4, 0.35), k(8.4, 1, 'smooth'), k(9.8, 1),
      k(10.6, 0.3, 'smooth'), k(16.6, 0.3),
      k(17.6, 1, 'smooth'), k(19.2, 1), k(20, 0.55, 'smooth'),
      k(26.4, 0.55),
    ]),
    custom('patient', 'bend', [
      k(2.7, 0), k(3.6, 1, 'smooth'), k(4.4, 1), k(5.4, 0, 'smooth'), k(26.4, 0),
    ]),
    custom('patient', 'reachTarget', [
      // the rig lines the grip up with the target on screen, so aiming at the case itself
      // puts her hand on it while the board stays in front of the cabinet
      k(0, BOX_ON_SHELF),
      k(4.6, BOX_ON_SHELF),
      k(6.6, READ, 'smooth'),
      k(17.0, READ),
      k(18.0, TAKE, 'smooth'),
      k(19.2, TAKE),
      k(20, READ, 'smooth'),
      k(26.4, READ),
    ]),

    // ---- props in her hand ----
    // the case rides in her hand from the bay all the way to the scan window
    track('handCase', 'visible', steps([[0, false], [4.6, true], [11.4, false]])),
    track('handCase', 'opacity', [
      k(4.6, 0), k(5.0, 1, 'smooth'), k(10.6, 1), k(11.4, 0, 'smooth'),
    ]),
    track('handCase', 'rotation', [
      k(4.8, [0.05, -0.3, 0.1]),
      k(6.4, [0.05, -0.2, 0], 'smooth'),
      k(7.4, [0.05, -0.2, 0]),
      // the QR is printed on the lid, so the lid has to be turned to face the reader —
      // held flat the code points at the ceiling and the beam plays over the side wall
      k(8.6, [1.25, -0.22, 0.05], 'smooth'),
      k(10.6, [1.25, -0.22, 0.05]),
    ]),
    // from the unpacking demonstration on, what she carries is the medicine itself
    track('handBox', 'visible', steps([[0, false], [15.8, true], [20.2, false], [23.2, true]])),
    track('handBox', 'opacity', [
      k(15.8, 0), k(16.4, 1, 'smooth'), k(19.4, 1), k(20.2, 0, 'smooth'),
      k(23.2, 0), k(24.0, 1, 'smooth'), k(26.4, 1),
    ]),
    track('handBox', 'rotation', [
      k(16.4, [0.05, -0.3, 0.1]),
      k(17.6, [0.05, -0.2, 0], 'smooth'),
    ]),
    // the printed sticker rides in her hand from the slot into the applying demonstration
    track('label', 'visible', steps([[0, false], [19.4, true], [20.0, false]])),
    track('label', 'opacity', [k(19.4, 1), k(19.6, 1), k(20.0, 0, 'smooth')]),
    track('label', 'position', [
      k(19.4, [0.024, 0.07, 0.075], 'decelerate'),
      k(20.4, [0.004, 0.02, 0.065], 'smooth'),
    ]),
    track('label', 'rotation', [k(19.4, [0.2, -0.3, 0.25]), k(20.4, [0.05, -0.2, 0.02], 'smooth')]),

    // ---- the case: on the shelf, then staged for the unpacking demonstration ----
    // once returned it stays in the basket: it is real set dressing from then on
    track('case', 'visible', steps([[0, true], [5.2, false], [11.4, true]])),
    // the carton in the case is the demoBox actor, not the one the case draws for itself:
    // one box, so it visibly leaves the case instead of appearing to stay in it
    custom('case', 'empty', [k(0, 1)]),
    custom('case', 'open', [k(12.2, 0), k(13.0, 1, 'smooth'), k(26.4, 1)]),
    track('case', 'opacity', [
      // it lifts off the shelf and crossfades into the one in her hand
      k(0, 1), k(4.6, 1), k(5.2, 0, 'smooth'),
      k(11.4, 0), k(12.0, 1, 'smooth'), k(26.4, 1),
    ]),
    track('case', 'position', [
      k(0, BOX_ON_SHELF),
      k(3.9, BOX_ON_SHELF),
      k(4.8, LIFTED, 'smooth'),
      k(5.2, LIFTED),
      // repositioned while invisible, ready for the unpacking demonstration
      k(11.4, DEMO),
      k(14.2, DEMO),
      // carried to a spot directly over the basket, then lowered straight down into it
      k(15.0, [IN_BASKET[0], IN_BASKET[1] + 0.24, IN_BASKET[2]], 'smooth'),
      k(15.7, IN_BASKET, 'decelerate'),
      k(26.4, IN_BASKET),
    ]),
    track('case', 'rotation', [
      k(0, [0, 0.2, 0]),
      k(4.8, [0, 0.1, 0], 'smooth'),
      k(11.4, [0, 0, 0]),
    ]),
    // the table and basket are real furniture — no fade tracks, they are simply there

    // ---- the medicine itself, on stage for both demonstrations ----
    track('demoBox', 'visible', steps([
      [0, true], [5.2, false], [11.4, true], [14.0, false], [19.6, true], [23.4, false],
    ])),
    track('demoBox', 'opacity', [
      k(0, 1), k(4.6, 1), k(5.2, 0, 'smooth'),
      k(11.4, 0), k(12.0, 1, 'smooth'), k(13.9, 1),
      k(19.6, 0), k(20.4, 1, 'smooth'), k(22.8, 1), k(23.4, 0, 'smooth'),
    ]),
    track('demoBox', 'position', [
      // it lies in the case, so it rides the shelf and the lift with it
      k(0, [BOX_ON_SHELF[0], BOX_ON_SHELF[1] - 0.006, BOX_ON_SHELF[2]]),
      k(3.9, [BOX_ON_SHELF[0], BOX_ON_SHELF[1] - 0.006, BOX_ON_SHELF[2]]),
      k(4.8, [LIFTED[0], LIFTED[1] - 0.006, LIFTED[2]], 'smooth'),
      k(5.2, [LIFTED[0], LIFTED[1] - 0.006, LIFTED[2]]),
      k(11.4, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      k(13.2, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      // up out of the open tray, then away — the shot stays with the case, which is
      // what goes back to the basket
      k(13.8, [DEMO[0], DEMO[1] + 0.075, DEMO[2]], 'smooth'),
      k(14.0, [DEMO[0], DEMO[1] + 0.075, DEMO[2]]),
      k(14.2, CARTON),   // repositioned while invisible, ready for the apply demo
      k(26.4, CARTON),
    ]),
    track('demoBox', 'rotation', [
      // flat in the case, matching the case's yaw at each station
      k(0, [-Math.PI / 2, 0, Math.PI / 2 + 0.2]),
      k(4.8, [-Math.PI / 2, 0, Math.PI / 2 + 0.1], 'smooth'),
      k(11.4, [-Math.PI / 2, 0, Math.PI / 2]),
      k(13.8, [-Math.PI / 2, 0, Math.PI / 2]),
      k(14.2, [0, 0, 0]),
    ]),

    // ---- demonstration 2: peel the sticker off its backing and press it on ----
    track('demoLabel', 'visible', steps([[0, false], [20.0, true], [23.4, false]])),
    track('demoLabel', 'opacity', [k(20.0, 0), k(20.6, 1, 'smooth'), k(22.8, 1), k(23.4, 0, 'smooth')]),
    custom('demoLabel', 'curl', [k(20.6, 1), k(21.4, 0.7, 'smooth'), k(22.3, 0.04, 'smooth'), k(22.5, 0)]),
    track('demoLabel', 'position', [
      // it fades in curled a short way off the face and is pressed straight down
      // onto it, finishing flush with the printed surface
      k(20.0, [CARTON[0], CARTON[1] + 0.024, CARTON[2] + 0.05], 'smooth'),
      k(21.4, [CARTON[0], CARTON[1] + 0.012, CARTON[2] + 0.034], 'smooth'),
      k(22.2, [CARTON[0], CARTON[1] + 0.004, CARTON[2] + 0.0185], 'decelerate'),
      k(22.5, [CARTON[0], CARTON[1] + 0.004, CARTON[2] + 0.0185]),
    ]),
    track('demoLabel', 'rotation', [
      k(20.0, [0.28, -0.22, 0.12], 'smooth'),
      k(22.2, [0, 0, 0], 'smooth'),
    ]),
  ],
  markers: [
    { t: 1.6, label: 'pick-up bay' },
    { t: 4.8, label: 'case taken' },
    { t: 9.2, label: 'QR on the case scanned' },
    { t: 13.8, label: 'medicine out of the case' },
    { t: 15.7, label: 'case returned' },
    { t: 17.6, label: 'sticker printed' },
    { t: 22.5, label: 'sticker applied' },
    { t: 24.8, label: 'order complete' },
  ],
  steps: [
    { id: 'collect', label: 'รับยา', labelEn: 'Collecting\nMedicine', icon: 'box', t0: 0, t1: 16.0 },
    { id: 'sticker', label: 'รับสติ๊กเกอร์', labelEn: 'Collecting\nSticker', icon: 'sticker', t0: 16.0, t1: 19.4 },
    { id: 'apply', label: 'แปะสติ๊กเกอร์', labelEn: 'Applying\nSticker', icon: 'apply', t0: 19.4, t1: 26.4 },
  ],
  captions: [
    { t0: 1.6, t1: 2.6, text: 'ช่องรับยาอยู่บริเวณนี้', textEn: 'The pick-up slot is located here' },
    { t0: 2.8, t1: 4.4, text: 'กรุณาหยิบกล่องยาออกจากช่องรับยา', textEn: 'Please take the medicine case from the pick-up slot' },
    { t0: 5.8, t1: 7.4, text: 'กรุณานำกล่องยาไปสแกนที่ช่องสแกนด้านขวา', textEn: 'Take the case to the scan window on the right' },
    { t0: 7.8, t1: 9.6, text: 'สแกนคิวอาร์โค้ดบนกล่องยา', textEn: 'Scan the QR code on the medicine case' },
    { t0: 11.8, t1: 15.4, text: 'กรุณาแกะกล่อง นำยาออกจากกล่อง แล้ววางกล่องคืนที่ตะกร้า', textEn: 'Open the case, take the medicine out and return the case to the basket' },
    { t0: 16.2, t1: 19.0, text: 'ระบบกำลังพิมพ์สติกเกอร์ยาที่ช่องสติกเกอร์', textEn: 'The medicine sticker is being printed at the sticker slot' },
    { t0: 20.6, t1: 22.8, text: 'กรุณาแปะสติกเกอร์ลงบนซองยา', textEn: 'Please apply the sticker to the medicine packet' },
    { t0: 24.2, t1: 26.0, text: 'รับยาครบทุกรายการเรียบร้อย', textEn: 'All items in the order have been collected' },
  ],
  success: [{ t0: 24.8, t1: 26.0 }],
}
