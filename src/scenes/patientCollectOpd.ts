import type { SceneDef } from '../anim/types'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import {
  A, BASKET, BASKET_VIEW, BOX_ON_SHELF, BUTTON, CARTON, DEMO, DOOR, FULL, IN_BASKET,
  READ, SCAN, SLOT, TABLE, TAKE, collectActors,
} from './collectCommon'

/**
 * OPD flow. The label is released by scanning the medicine itself, so the medicine has to
 * be out of its plastic case before it goes up to the window:
 *
 *   take the case from the bay -> open it and return the empty case -> scan the medicine
 *   -> collect the printed label -> apply it -> press for the next item.
 *
 * The close beats are not cuts: everything but what she is holding dissolves away, the
 * medicine is demonstrated on its own, and the cabinet dissolves back in.
 *
 * Beat sheet (all times chosen on 0.2s steps so the sheet stays editable):
 *   0.0- 2.6  establish, call out the bay — she walks in while it opens
 *   2.6- 4.4  the door is open: straight into the zoomed grab, the cabinet dissolves
 *   4.4- 5.6  the case rises from the shelf to centre frame
 *   5.8- 6.6  the lid pops straight up, slides aside and fades (isometric)
 *   5.6- 7.4  isometric on the case: the lid pops off, the medicine rises and is
 *             taken away — the focus stays on the case
 *   7.6- 9.0  the case is carried over the basket and lowered straight in
 *   9.2-10.6  pull back: she is at the table, then walks to the window
 *  11.6-15.0  she raises the medicine to the window; verified at 14.4
 *  15.6-19.4  the label prints at the middle slot and is taken
 *  19.4-22.6  dissolve to the medicine; peel and press the label on
 *  23.8-26.4  back at the cabinet; press for the next item at 24.6
 */
/** where she stands beside the table, having just set the case down */
const AT_TABLE: [number, number, number] = [TABLE[0] - 0.34, 0, 0.8]
/** the pull-back that reveals her by the table with the kiosk behind */
const TABLE_WIDE: [number, number, number] = [(TABLE[0] + 0.24) / 2, 1.05, 0.35]

/** framing for the final push-in on the kiosk screen */
const SCREEN_VIEW: [number, number, number] = [A.screen[0], A.screen[1] - 0.1, A.screen[2]]

export const patientCollectOpd: SceneDef = {
  id: 'patient-collect-opd',
  name: 'Patient · Collecting Medicine (OPD)',
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
      // the moment the door is open the shot pushes straight into the grab insert —
      // no pull-back to a wide in between. As she reaches, the cabinet dissolves away
      // and the case itself carries the shot into the unpacking step
      k(3.2, shot(DOOR, 1.35, 38, 12), 'smooth'),
      k(4.4, shot(BOX_ON_SHELF, 1.0, 32, 12), 'smooth'),
      k(5.6, shot(DEMO, 0.62, 45, 32), 'smooth'),                 // isometric for the demo
      // parked dead ahead while the lid pops off (5.8-6.6) and the medicine rises
      // (6.8-7.4); the camera only travels once there is something to follow
      // parked on the iso view while the lid pops (5.8-6.6); the medicine rises and
      // is taken away — the shot stays with the case, which is what goes back
      k(7, shot(DEMO, 0.62, 45, 32), 'smooth'),
      k(8.4, shot(BASKET_VIEW, 1.75, 45, 32), 'smooth'),   // the return reads iso too
      k(9.2, shot(BASKET_VIEW, 1.7, 45, 32), 'smooth'),
      // pull back from the basket: she is standing right there at the table, and the
      // camera walks her back across to the scan window — one continuous move
      k(10.2, shot(TABLE_WIDE, 2.9, 26, 9), 'smooth'),
      k(11, shot(TABLE_WIDE, 2.9, 26, 9), 'smooth'),
      k(13, shot(SCAN, 2.3, 40, 9), 'smooth'),
      k(15, shot(SCAN, 2.05, 40, 9), 'smooth'),                 // slow push while it reads
      k(16, shot(SLOT, 1.4, 34, 10), 'smooth'),                 // 2 · Collecting Sticker
      k(18.4, shot(TAKE, 1.5, 38, 10), 'smooth'),
      // 3 · Applying Sticker — the label carries the shot from the slot to the staging
      k(20.2, shot(CARTON, 0.5, 0, 0), 'smooth'),
      k(22.6, shot(CARTON, 0.46, 0, 0), 'smooth'),
      // 4 · Continue Collecting — the cabinet dissolves back in as the camera pulls out
      k(24, shot(SCREEN_VIEW, 1.15, 16, 5), 'smooth'),
      k(26.4, shot(SCREEN_VIEW, 0.95, 10, 3)),   // slow push-in on the screen
    ]),
    track('target', 'position', [
      k(0, FULL),
      k(0.4, FULL),
      k(1.6, DOOR, 'smooth'),
      k(3.2, DOOR, 'smooth'),
      k(4.4, BOX_ON_SHELF, 'smooth'),
      k(5.6, DEMO, 'smooth'),
      k(7, DEMO, 'smooth'),
      // the target flies WITH the case — same keys, same easing as its position track,
      // so the case stays pinned to frame centre for the whole carry
      k(7.6, DEMO),
      k(8.4, [IN_BASKET[0], IN_BASKET[1] + 0.2, IN_BASKET[2]], 'smooth'),
      k(9.2, [BASKET[0] + 0.03, BASKET[1] + 0.1, BASKET[2]], 'smooth'),
      k(10.2, TABLE_WIDE, 'smooth'),
      k(11, TABLE_WIDE, 'smooth'),
      k(13, SCAN, 'smooth'),
      k(15, SCAN),
      k(16, SLOT, 'smooth'),
      k(18.4, TAKE, 'smooth'),
      k(20.2, CARTON, 'smooth'),
      k(22.6, CARTON),
      k(24, SCREEN_VIEW, 'smooth'),
      k(26.4, SCREEN_VIEW),
    ]),
    custom('camera', 'fov', [
      k(0, FOV), k(0.4, FOV), k(2.6, 20, 'smooth'),
      k(3.2, 24, 'smooth'), k(4.4, 23), k(5.6, 22, 'smooth'), k(9.2, 22),
      k(10.2, 24, 'smooth'), k(13, 22, 'smooth'), k(15, 22), k(16, 22, 'smooth'), k(18.4, 23, 'smooth'),
      k(20.2, 24, 'smooth'), k(22.6, 24), k(24, 22, 'smooth'), k(26.4, 22),
    ]),

    // ---- kiosk ----
    custom('kiosk', 'screenState', steps([
      [0, 'medicineList'], [1.6, 'collecting'], [15, 'collectingNext'], [24.6, 'collectingDone'],
    ])),
    custom('kiosk', 'doorOpen', [
      k(1.6, 0), k(2.6, 1, 'decelerate'), k(4.8, 1), k(6, 0, 'accelerate'),
    ]),
    // the window closes on the medicine she holds up to it — only once the cabinet is
    // fully back on screen, or the beam plays over a half-dissolved kiosk
    custom('kiosk', 'scanGlow', [
      k(13, 0), k(13.6, 0.45, 'decelerate'), k(14, 0.4), k(14.4, 1, 'decelerate'),
      k(14.8, 0.9), k(15, 0, 'accelerate'),
    ]),
    custom('kiosk', 'scanReach', [k(0, 0.34), k(13.8, 0.34), k(14.4, 0.24, 'decelerate'), k(26.4, 0.24)]),
    custom('kiosk', 'scanSpread', [k(0, 0.1), k(13.8, 0.1), k(14.4, 0.14, 'decelerate'), k(26.4, 0.14)]),
    custom('kiosk', 'scanTilt', [k(0, 0.16), k(13.8, 0.16), k(14.4, -0.1, 'smooth'), k(26.4, -0.1)]),
    // OPD: the label is only printed once the medicine has been read
    custom('kiosk', 'stickerFeed', [
      k(15.6, 0), k(17.2, 1, 'decelerate'), k(18.6, 1), k(19, 0, 'accelerate'),
    ]),
    // the cabinet dissolves away for each demonstration and comes back after it
    track('kiosk', 'opacity', [
      k(3.6, 1), k(4.4, 0, 'smooth'), k(9.2, 0), k(10.2, 1, 'smooth'),
      k(19.2, 1), k(20, 0, 'smooth'), k(22.6, 0), k(23.8, 1, 'smooth'), k(26.4, 1),
    ]),

    // ---- patient ----
    track('patient', 'visible', steps([[0, false], [1.4, true]])),
    track('patient', 'position', [
      k(1.4, [-1.5, 0, 1.95]),
      k(3, [0.24, 0, 0.92], 'smooth'),
      k(3.4, [0.28, 0, 0.72], 'smooth'),
      k(4.3, [0.28, 0, 0.72]),
      k(5.1, [0.24, 0, 0.92], 'smooth'),
      // repositioned while hidden: she comes back beside the table she just used,
      // then walks over to the scan window
      k(8.1, AT_TABLE),
      k(10.6, AT_TABLE),
      k(12, [0.24, 0, 0.92], 'smooth'),
      k(26.4, [0.24, 0, 0.92]),
    ]),
    // she fades out with the cabinet: what is left on screen is the medicine alone
    track('patient', 'opacity', [
      k(1.4, 1), k(3.6, 1), k(4.4, 0, 'smooth'), k(9.2, 0), k(10.2, 1, 'smooth'),
      k(19.2, 1), k(20, 0, 'smooth'), k(22.6, 0), k(23.8, 1, 'smooth'), k(26.4, 1),
    ]),
    custom('patient', 'tilt', [k(1.4, 0.3), k(3, 0.45, 'smooth'), k(26.4, 0.45)]),
    // into the bay -> up to the scan window -> down while the label prints -> up to the
    // slot -> up to the button on the screen
    track('patient', 'reach', [
      k(1.4, 0), k(2.6, 0), k(3.7, 1, 'smooth'),
      k(4.6, 1), k(6, 0.3), k(12.2, 0.3), k(13, 1, 'smooth'), k(14.6, 1),
      k(15.6, 0.12, 'smooth'), k(17, 0.12),
      k(18, 1, 'smooth'), k(19.2, 1), k(20, 0.55, 'smooth'),
      k(23.8, 0.55), k(24.4, 1, 'smooth'), k(26.4, 1),
    ]),
    custom('patient', 'bend', [
      k(2.7, 0), k(3.7, 1, 'smooth'), k(4.3, 1), k(5.1, 0, 'smooth'), k(26.4, 0),
    ]),
    custom('patient', 'reachTarget', [
      // the rig lines the grip up with the target on screen, so aiming at the case itself
      // puts her hand on it while the board stays in front of the cabinet. The slide up
      // to READ happens while she is hidden and lands as she fades back in.
      k(0, BOX_ON_SHELF),
      k(4.4, BOX_ON_SHELF),
      k(11.4, READ, 'smooth'),
      k(16.6, READ),
      k(17.6, TAKE, 'smooth'),
      k(19.2, TAKE),
      k(20, READ, 'smooth'),
      k(23.8, READ),
      k(24.2, BUTTON, 'smooth'),
      k(26.4, BUTTON),
    ]),

    // ---- props in her hand ----
    // from the demonstration on, what she carries is the unpacked medicine
    track('handBox', 'visible', steps([[0, false], [9.2, true], [20, false], [23, true]])),
    track('handBox', 'opacity', [
      k(9.2, 0), k(10.2, 1, 'smooth'), k(19.2, 1), k(20, 0, 'smooth'),
      k(23, 0), k(23.8, 1, 'smooth'), k(26.4, 1),
    ]),
    track('handBox', 'rotation', [
      k(10.4, [0.05, -0.3, 0.1]),
      k(12, [0.05, -0.2, 0], 'smooth'),
    ]),
    // the printed label rides in her hand from the slot into the applying demonstration
    track('label', 'visible', steps([[0, false], [19, true], [19.6, false]])),
    track('label', 'opacity', [k(19, 1), k(19.2, 1), k(19.6, 0, 'smooth')]),
    track('label', 'position', [
      k(19, [0.024, 0.07, 0.075], 'decelerate'),
      k(20, [0.004, 0.02, 0.065], 'smooth'),
    ]),
    track('label', 'rotation', [k(19, [0.2, -0.3, 0.25]), k(20, [0.05, -0.2, 0.02], 'smooth')]),

    // ---- demonstration 1: open the case, take the medicine out, hand the case back ----
    // once returned it stays in the basket: it is real set dressing from then on
    track('case', 'visible', steps([[0, true]])),
    // the carton in the case is the demoBox actor, not the one the case draws for itself:
    // one box, so it visibly leaves the case instead of appearing to stay in it
    custom('case', 'empty', [k(0, 1)]),
    custom('case', 'open', [k(5.8, 0), k(6.6, 1, 'smooth'), k(26.4, 1)]),
    track('case', 'position', [
      // it only starts travelling once the dissolve has finished, so it stays where the
      // camera is looking instead of drifting ahead of the move
      k(4.4, BOX_ON_SHELF, 'smooth'),
      k(5.6, DEMO, 'smooth'),
      k(7.6, DEMO),
      // carried to a spot directly over the basket, then lowered straight down into it
      k(8.4, [IN_BASKET[0], IN_BASKET[1] + 0.24, IN_BASKET[2]], 'smooth'),
      k(9.1, IN_BASKET, 'decelerate'),
      k(10.8, IN_BASKET),
    ]),
    track('case', 'rotation', [
      k(4.4, [0, 0.2, 0], 'smooth'),
      k(5.6, [0, 0, 0], 'smooth'),
      k(7.6, [0, 0, 0]),
      k(8.6, [0, 0, 0], 'smooth'),
    ]),
    // the table and basket are real furniture — no fade tracks, they are simply there

    // ---- the medicine itself, on stage for both demonstrations ----
    track('demoBox', 'visible', steps([[0, true], [7.8, false], [19.4, true], [23.2, false]])),
    track('demoBox', 'opacity', [
      k(0, 1), k(7, 1), k(7.6, 0, 'smooth'),
      k(19.4, 0), k(20.2, 1, 'smooth'), k(22.6, 1), k(23.2, 0, 'smooth'),
    ]),
    track('demoBox', 'position', [
      k(4.4, [BOX_ON_SHELF[0], BOX_ON_SHELF[1] - 0.006, BOX_ON_SHELF[2]], 'smooth'),
      k(5.6, [DEMO[0], DEMO[1] - 0.006, DEMO[2]], 'smooth'),
      k(6.8, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      // up out of the open tray, then across to the staging spot while the camera
      // swings round to the front with it
      k(7.4, [DEMO[0], DEMO[1] + 0.075, DEMO[2]], 'smooth'),
      k(7.6, [DEMO[0], DEMO[1] + 0.075, DEMO[2]]),
      k(7.8, CARTON),   // repositioned while invisible, ready for the apply demo
      k(26.4, CARTON),
    ]),
    track('demoBox', 'rotation', [
      // flat in the case, matching the case's yaw at each station: 0.2 on the shelf,
      // square once it is staged for the demo
      k(4.4, [-Math.PI / 2, 0, Math.PI / 2 + 0.2], 'smooth'),
      k(5.6, [-Math.PI / 2, 0, Math.PI / 2], 'smooth'),
      k(7.4, [-Math.PI / 2, 0, Math.PI / 2]),
      k(7.8, [0, 0, 0]),
    ]),

    // ---- demonstration 2: peel the label off its backing and press it on ----
    track('demoLabel', 'visible', steps([[0, false], [19.6, true], [23.2, false]])),
    track('demoLabel', 'opacity', [k(19.6, 0), k(20.2, 1, 'smooth'), k(22.6, 1), k(23.2, 0, 'smooth')]),
    custom('demoLabel', 'curl', [k(20.2, 1), k(21, 0.7, 'smooth'), k(21.9, 0.04, 'smooth'), k(22.1, 0)]),
    track('demoLabel', 'position', [
      // it fades in curled a short way off the face and is pressed straight down
      // onto it, finishing flush with the printed surface
      k(19.6, [CARTON[0], CARTON[1] + 0.024, CARTON[2] + 0.05], 'smooth'),
      k(21, [CARTON[0], CARTON[1] + 0.012, CARTON[2] + 0.034], 'smooth'),
      k(21.8, [CARTON[0], CARTON[1] + 0.004, CARTON[2] + 0.0185], 'decelerate'),
      k(22.1, [CARTON[0], CARTON[1] + 0.004, CARTON[2] + 0.0185]),
    ]),
    track('demoLabel', 'rotation', [
      k(19.6, [0.28, -0.22, 0.12], 'smooth'),
      k(21.8, [0, 0, 0], 'smooth'),
    ]),
  ],
  markers: [
    { t: 1.6, label: 'pick-up bay' },
    { t: 4.4, label: 'case taken' },
    { t: 7.4, label: 'medicine out of the case' },
    { t: 8.6, label: 'case returned' },
    { t: 14.4, label: 'medicine scanned' },
    { t: 17.2, label: 'label printed' },
    { t: 22.1, label: 'label applied' },
    { t: 24.6, label: 'next item' },
  ],
  steps: [
    { id: 'collect', label: 'รับยา', labelEn: 'Collecting\nMedicine', icon: 'box', t0: 0, t1: 15.6 },
    { id: 'sticker', label: 'รับสติ๊กเกอร์', labelEn: 'Collecting\nSticker', icon: 'sticker', t0: 15.6, t1: 19.4 },
    { id: 'apply', label: 'แปะสติ๊กเกอร์', labelEn: 'Applying\nSticker', icon: 'apply', t0: 19.4, t1: 23.8 },
    { id: 'continue', label: 'รับรายการต่อไป', labelEn: 'Continue\nCollecting', icon: 'continue', t0: 23.8, t1: 26.4 },
  ],
  captions: [
    { t0: 1.6, t1: 2.6, text: 'ช่องรับยาอยู่บริเวณนี้', textEn: 'The pick-up slot is located here' },
    { t0: 2.8, t1: 4.2, text: 'กรุณาหยิบกล่องยาออกจากช่องรับยา', textEn: 'Please take the medicine from the pick-up slot' },
    // one instruction covers the whole unpacking beat, through the basket return
    { t0: 5.8, t1: 9, text: 'กรุณานำยาออกจากกล่องพลาสติก แล้ววางกล่องคืนที่ตะกร้า', textEn: 'Take the medicine out of the plastic case and return the case to the basket' },
    { t0: 11.8, t1: 13.6, text: 'กรุณาสแกนกล่องยาที่ช่องสแกนด้านขวา', textEn: 'Please scan the medicine at the window on the right' },
    { t0: 15.8, t1: 18.6, text: 'ระบบกำลังพิมพ์ฉลากยาที่ช่องสติกเกอร์', textEn: 'The label is being printed at the sticker slot' },
    { t0: 20.4, t1: 22.4, text: 'กรุณาติดฉลากยาลงบนกล่องยา', textEn: 'Please apply the label to the medicine box' },
    { t0: 24, t1: 26, text: 'กรุณากดปุ่มเพื่อรับยารายการถัดไป', textEn: 'Please press the button for the next item' },
  ],
  success: [{ t0: 24.6, t1: 25.8 }],
}
