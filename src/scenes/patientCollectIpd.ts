import type { SceneDef } from '../anim/types'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import {
  BASKET, BASKET_VIEW, BOX_ON_SHELF, BUTTON, CARTON, DEMO, DOOR, FULL, IN_BASKET,
  READ, SLOT, TAKE, collectActors,
} from './collectCommon'

/**
 * IPD flow. There is nothing to scan: pressing to collect at the screen releases both the
 * medicine and its label, so the label is already waiting at the sticker slot by the time
 * she has the case open.
 *
 *   press to collect -> take the case from the bay -> open it and return the empty case
 *   -> collect the printed label -> apply it -> press for the next item.
 *
 * Staging matches the OPD cut: the close beats dissolve the cabinet away rather than
 * cutting to another set.
 */
export const patientCollectIpd: SceneDef = {
  id: 'patient-collect-ipd',
  name: 'Patient · Collecting Medicine (IPD)',
  duration: 30.34,
  fps: 30,
  size: [1080, 683],
  background: '#ffffff',
  camera: { position: shot(FULL, DIST.wide, 35, 13), target: FULL, fov: FOV },
  actors: collectActors(),
  tracks: [
    // ---- shot list ----
    track('camera', 'position', [
      k(0, shot(FULL, DIST.wide, 35, 13)),
      k(0.6, shot(FULL, DIST.wide, 35, 13)),
      k(2.2, shot(BUTTON, DIST.close + 0.4, 34, 8), 'smooth'),    // 1 · press to collect
      k(4, shot(BUTTON, DIST.close + 0.4, 34, 8)),
      k(5.2, shot(DOOR, DIST.close + 0.4, 40, 12), 'smooth'),     // the bay opens
      // no close-up of the hand taking it: as she reaches for the case the cabinet
      // dissolves away and the case itself carries the shot into the unpacking step
      k(6.4, shot(DOOR, 1.35, 38, 12), 'smooth'),
      k(7.6, shot(BOX_ON_SHELF, 1.0, 32, 12), 'smooth'),
      k(9.34, shot(DEMO, 0.62, 22, 8), 'smooth'),
      k(13.69, shot(CARTON, 0.54, 24, 6), 'smooth'),
      k(14.56, shot(BASKET_VIEW, 1.75, 22, 14), 'smooth'),
      k(16.01, shot(BASKET_VIEW, 1.7, 22, 14)),
      // 2 · Collecting Sticker — the label has been waiting at the slot since she pressed
      k(18.15, shot(SLOT, 1.4, 34, 10), 'smooth'),
      k(19.95, shot(TAKE, DIST.close, 42, 10), 'smooth'),
      // 3 · Applying Sticker — dissolve to the medicine on its own
      k(21.69, shot(CARTON, 0.5, 24, 6), 'smooth'),
      k(24.39, shot(CARTON, 0.46, 26, 6), 'smooth'),
      // 4 · Continue Collecting
      k(26.34, shot(BUTTON, DIST.close + 0.4, 34, 8), 'smooth'),
      k(30.34, shot(BUTTON, DIST.close + 0.4, 34, 8)),
    ]),
    track('target', 'position', [
      k(0, FULL),
      k(0.6, FULL),
      k(2.2, BUTTON, 'smooth'),
      k(4, BUTTON),
      k(5.2, DOOR, 'smooth'),
      k(6.4, DOOR, 'smooth'),
      k(7.6, BOX_ON_SHELF, 'smooth'),
      k(9.34, DEMO, 'smooth'),
      k(13.69, CARTON, 'smooth'),
      k(14.56, [BASKET[0] + 0.03, BASKET[1] + 0.1, BASKET[2]], 'smooth'),
      k(16.01, [BASKET[0] + 0.03, BASKET[1] + 0.1, BASKET[2]]),
      k(18.15, SLOT, 'smooth'),
      k(19.95, TAKE, 'smooth'),
      k(21.69, CARTON, 'smooth'),
      k(24.39, CARTON),
      k(26.34, BUTTON, 'smooth'),
      k(30.34, BUTTON),
    ]),
    custom('camera', 'fov', [
      k(0, FOV), k(0.6, FOV), k(2.2, 26, 'smooth'), k(4, 26), k(5.2, 26),
      k(6.4, 24, 'smooth'), k(7.6, 23), k(9.34, 22, 'smooth'), k(16.01, 22),
      k(18.15, 22), k(19.95, 26, 'smooth'), k(21.69, 24, 'smooth'), k(24.39, 24),
      k(26.34, 26, 'smooth'), k(30.34, 26),
    ]),

    // ---- kiosk ----
    custom('kiosk', 'screenState', steps([
      [0, 'medicineList'], [3.8, 'collecting'], [15.43, 'collectingNext'], [27.74, 'collectingDone'], [28.94, 'medicineList'],
    ])),
    // pressing to collect opens the bay...
    custom('kiosk', 'doorOpen', [
      k(3.8, 0), k(4.8, 1, 'decelerate'), k(8.04, 1), k(9.19, 0, 'accelerate'),
    ]),
    // ...and prints the label at the same time. IPD never scans anything: the label is out
    // and waiting by the time she has the medicine.
    custom('kiosk', 'stickerFeed', [
      k(4.4, 0), k(6, 1, 'decelerate'), k(20.35, 1), k(20.75, 0, 'accelerate'),
    ]),
    custom('kiosk', 'scanGlow', [k(0, 0), k(30.34, 0)]),
    // the cabinet dissolves away for each demonstration and comes back after it
    track('kiosk', 'opacity', [
      k(6.8, 1), k(7.6, 0, 'smooth'), k(16.59, 0), k(17.75, 1, 'smooth'),
      k(20.95, 1), k(21.69, 0, 'smooth'), k(24.39, 0), k(25.74, 1, 'smooth'), k(30.34, 1),
    ]),

    // ---- patient ----
    track('patient', 'visible', steps([[0, false], [0.6, true]])),
    track('patient', 'position', [
      k(0.6, [-1.5, 0, 1.95]),
      k(2.6, [0.24, 0, 0.92], 'smooth'),
      k(5.6, [0.24, 0, 0.92]),
      k(6.6, [0.28, 0, 0.72], 'smooth'),
      k(7.5, [0.28, 0, 0.72]),
      k(8.32, [0.24, 0, 0.92], 'smooth'),
      k(30.34, [0.24, 0, 0.92]),
    ]),
    track('patient', 'opacity', [
      k(0.6, 1), k(6.8, 1), k(7.6, 0, 'smooth'), k(16.59, 0), k(17.75, 1, 'smooth'),
      k(20.95, 1), k(21.42, 0, 'smooth'), k(24.39, 0), k(25.74, 1, 'smooth'), k(30.34, 1),
    ]),
    custom('patient', 'tilt', [k(0.6, 0.3), k(2.6, 0.45, 'smooth'), k(30.34, 0.45)]),
    // up to the button -> down into the bay -> up to the sticker slot -> up to the button
    track('patient', 'reach', [
      k(0.6, 0), k(2.4, 0), k(3.4, 1, 'smooth'), k(4.4, 1),
      k(5.2, 0.3, 'smooth'), k(5.8, 0.3), k(6.9, 1, 'smooth'), k(18.55, 1),
      k(19.75, 1), k(21.69, 0.55, 'smooth'),
      k(25.74, 0.55), k(26.94, 1, 'smooth'), k(30.34, 1),
    ]),
    custom('patient', 'bend', [
      k(5.9, 0), k(6.9, 1, 'smooth'), k(7.5, 1), k(8.32, 0, 'smooth'), k(30.34, 0),
    ]),
    custom('patient', 'reachTarget', [
      k(0, BUTTON),
      k(4.6, BUTTON),
      k(5.6, BOX_ON_SHELF, 'smooth'),
      k(7.6, BOX_ON_SHELF),
      k(17.75, READ, 'smooth'),
      k(18.75, TAKE, 'smooth'),
      k(20.55, TAKE),
      k(21.69, READ, 'smooth'),
      k(26.14, READ),
      k(26.94, BUTTON, 'smooth'),
      k(30.34, BUTTON),
    ]),

    // ---- props in her hand ----
    track('handBox', 'visible', steps([[0, false], [16.73, true], [21.69, false], [24.93, true]])),
    track('handBox', 'opacity', [
      k(16.73, 0), k(17.75, 1, 'smooth'), k(20.95, 1), k(21.42, 0, 'smooth'),
      k(24.93, 0), k(25.74, 1, 'smooth'), k(30.34, 1),
    ]),
    track('handBox', 'rotation', [
      k(16.73, [0.05, -0.3, 0.1]),
      k(18.15, [0.05, -0.2, 0], 'smooth'),
    ]),
    track('label', 'visible', steps([[0, false], [20.75, true], [21.69, false]])),
    track('label', 'opacity', [k(20.75, 1), k(20.95, 1), k(21.55, 0, 'smooth')]),
    track('label', 'position', [
      k(20.75, [0.02, 0.07, 0.06], 'decelerate'),
      k(21.55, [0.0, 0.02, 0.05], 'smooth'),
    ]),
    track('label', 'rotation', [k(20.75, [0.2, -0.3, 0.25]), k(21.55, [0.05, -0.2, 0.02], 'smooth')]),

    // ---- demonstration 1: open the case, take the medicine out, hand the case back ----
    track('case', 'visible', steps([[0, true], [17.46, false]])),
    track('case', 'opacity', [k(0, 1), k(15.72, 1), k(16.59, 0, 'smooth')]),
    // the carton in the case is the demoBox actor, not the one the case draws for itself:
    // one box, so it visibly leaves the case instead of appearing to stay in it
    custom('case', 'empty', [k(0, 1)]),
    custom('case', 'open', [k(10.79, 0), k(11.95, 1, 'smooth'), k(30.34, 1)]),
    track('case', 'position', [
      // it only starts travelling once the dissolve has finished, so it stays where the
      // camera is looking instead of drifting ahead of the move
      k(7.6, BOX_ON_SHELF, 'smooth'),
      k(9.34, DEMO, 'smooth'),
      k(14.27, DEMO),
      k(15.43, IN_BASKET, 'decelerate'),
      k(17.46, IN_BASKET),
    ]),
    track('case', 'rotation', [
      k(7.6, [0, 0.2, 0], 'smooth'),
      k(9.34, [0.12, -0.5, 0], 'smooth'),
      k(14.27, [0.12, -0.5, 0]),
      k(15.43, [0.2, -0.5, -0.3], 'smooth'),
    ]),
    track('demoBasket', 'visible', steps([[0, false], [14.12, true], [17.46, false]])),
    track('demoBasket', 'opacity', [k(14.12, 0), k(14.71, 1, 'smooth'), k(15.72, 1), k(16.59, 0, 'smooth')]),

    // ---- the medicine itself, on stage for both demonstrations ----
    track('demoBox', 'visible', steps([[0, true], [17.17, false], [21.15, true], [25.2, false]])),
    track('demoBox', 'opacity', [
      k(0, 1), k(15.72, 1), k(16.59, 0, 'smooth'),
      k(21.15, 0), k(21.96, 1, 'smooth'), k(24.52, 1), k(25.2, 0, 'smooth'),
    ]),
    track('demoBox', 'position', [
      k(7.6, [BOX_ON_SHELF[0], BOX_ON_SHELF[1] - 0.006, BOX_ON_SHELF[2]], 'smooth'),
      k(9.34, [DEMO[0], DEMO[1] - 0.006, DEMO[2]], 'smooth'),
      k(12.09, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      // straight up out of the open lid first, then across and upright
      k(12.68, [DEMO[0], DEMO[1] + 0.1, DEMO[2]], 'smooth'),
      k(13.84, CARTON, 'decelerate'),
      k(30.34, CARTON),
    ]),
    track('demoBox', 'rotation', [
      k(7.6, [-Math.PI / 2, 0, Math.PI / 2], 'smooth'),
      k(9.34, [-1.451, 0, 1.071], 'smooth'),
      k(12.09, [-1.451, 0, 1.071]),
      k(13.4, [0.05, -0.34, 0.05], 'smooth'),
    ]),

    // ---- demonstration 2: peel the label off its backing and press it on ----
    track('demoLabel', 'visible', steps([[0, false], [21.96, true], [25.2, false]])),
    track('demoLabel', 'opacity', [k(21.96, 1), k(24.52, 1), k(25.2, 0, 'smooth')]),
    custom('demoLabel', 'curl', [k(21.96, 1), k(22.64, 0.75, 'smooth'), k(23.58, 0.06, 'smooth'), k(23.98, 0)]),
    track('demoLabel', 'position', [
      k(21.96, [CARTON[0] - 0.02, CARTON[1] + 0.085, CARTON[2] + 0.075], 'decelerate'),
      k(22.77, [CARTON[0] - 0.005, CARTON[1] + 0.05, CARTON[2] + 0.055], 'smooth'),
      k(23.71, [CARTON[0] - 0.007, CARTON[1] + 0.012, CARTON[2] + 0.019], 'decelerate'),
      k(23.98, [CARTON[0] - 0.007, CARTON[1] + 0.012, CARTON[2] + 0.019]),
    ]),
    track('demoLabel', 'rotation', [
      k(21.96, [0.5, -0.62, 0.35]),
      k(23.71, [0.05, -0.34, 0.05], 'smooth'),
    ]),
  ],
  markers: [
    { t: 3.4, label: 'press to collect' },
    { t: 4.8, label: 'bay opens, label prints' },
    { t: 7.45, label: 'case taken' },
    { t: 11.66, label: 'medicine out of the case' },
    { t: 15.14, label: 'case returned' },
    { t: 20.35, label: 'label taken' },
    { t: 23.98, label: 'label applied' },
    { t: 27.74, label: 'next item' },
  ],
  steps: [
    { id: 'collect', label: 'รับยา', labelEn: 'Collecting\nMedicine', icon: 'box', t0: 0, t1: 17.75 },
    { id: 'sticker', label: 'รับสติ๊กเกอร์', labelEn: 'Collecting\nSticker', icon: 'sticker', t0: 17.75, t1: 21.15 },
    { id: 'apply', label: 'แปะสติ๊กเกอร์', labelEn: 'Applying\nSticker', icon: 'apply', t0: 21.15, t1: 25.74 },
    { id: 'continue', label: 'รับรายการต่อไป', labelEn: 'Continue\nCollecting', icon: 'continue', t0: 25.74, t1: 30.34 },
  ],
  captions: [
    { t0: 1.6, t1: 3.6, text: 'กรุณากดปุ่มรับยาที่หน้าจอ', textEn: 'Please press to collect on the screen' },
    { t0: 4.4, t1: 5.6, text: 'ระบบกำลังจ่ายยาและพิมพ์ฉลากยา', textEn: 'The machine is dispensing the medicine and printing the label' },
    { t0: 6, t1: 7.89, text: 'กรุณาหยิบกล่องยาออกจากช่องรับยา', textEn: 'Please take the medicine from the pick-up slot' },
    { t0: 10.21, t1: 13.98, text: 'กรุณานำยาออกจากกล่องพลาสติก แล้ววางกล่องคืนที่ตะกร้า', textEn: 'Take the medicine out of the plastic case and return the case to the basket' },
    { t0: 18.35, t1: 20.35, text: 'กรุณารับฉลากยาที่ช่องสติกเกอร์', textEn: 'Please take the label from the sticker slot' },
    { t0: 22.23, t1: 24.39, text: 'กรุณาติดฉลากยาลงบนกล่องยา', textEn: 'Please apply the label to the medicine box' },
    { t0: 26.74, t1: 29.74, text: 'กรุณากดปุ่มเพื่อรับยารายการถัดไป', textEn: 'Please press the button for the next item' },
  ],
  success: [{ t0: 27.74, t1: 28.94 }],
}
