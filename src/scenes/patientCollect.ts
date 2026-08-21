import type { SceneDef } from '../anim/types'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import { KIOSK_ANCHORS } from '../scene/Kiosk'

/**
 * Rework of Patient-WhileCollectingMedicine_ENG.gif (27s, 180 frames).
 * Beats: establish -> collect medicine from the pick-up door -> the machine prints the
 * label from the sticker slot -> apply the sticker on the package -> continue collecting
 * on the phone -> pull out.
 */
const A = KIOSK_ANCHORS
const FULL = A.body
const DOOR = A.pickup
const SLOT = A.stickerSlot
/** where the box is held while the label goes on */
const HANDS: [number, number, number] = [A.pickup[0] - 0.16, A.stickerSlot[1] - 0.02, A.pickup[2] + 0.3]

export const patientCollect: SceneDef = {
  id: 'patient-collect-medicine',
  name: 'Patient · Collecting Medicine',
  duration: 27,
  fps: 30,
  size: [1080, 683],
  background: '#ffffff',
  camera: { position: shot(FULL, DIST.wide, 35, 13), target: FULL, fov: FOV },
  actors: [
    { id: 'kiosk', kind: 'kiosk', label: 'Kiosk', position: [0, 0, 0] },
    {
      id: 'patient',
      kind: 'character',
      label: 'Patient',
      url: '/models/patient_tham.glb',
      position: [-0.6, 0, 1.6],
      rotation: [0, 3.0, 0],
      params: { height: 1.68 },
    },
    { id: 'box', kind: 'prop', primitive: 'medicineBox', label: 'Medicine box', position: [0.45, 0.57, 0.24], visible: false },
    { id: 'sticker', kind: 'prop', primitive: 'sticker', label: 'Sticker', position: [0.36, 0.96, 0.45], visible: false },
    { id: 'phone', kind: 'prop', primitive: 'phone', label: 'Phone', position: [0.1, 1.1, 1.0], visible: false },
  ],
  tracks: [
    track('camera', 'position', [
      k(0.0, shot(FULL, DIST.wide, 35, 13), 'decelerate'),
      k(2.5, shot(FULL, DIST.full, 30, 10), 'standard'),
      k(5.0, shot(DOOR, DIST.mid, 44, 16), 'standard'),      // pick-up door
      k(9.0, shot(HANDS, DIST.close + 0.7, 56, 10), 'smooth'),      // box in hands
      k(11.5, shot(SLOT, DIST.close, 44, 10), 'standard'),    // label printing
      k(14.5, shot(HANDS, DIST.macro + 0.3, 56, 8), 'standard'), // sticker goes on
      k(18.5, shot(HANDS, DIST.close + 0.7, 56, 10), 'standard'),
      k(21.0, shot(FULL, DIST.full, 32, 10), 'standard'),    // continue collecting
      k(25.0, shot(FULL, DIST.wide, 35, 13), 'standard'),
    ]),
    track('target', 'position', [
      k(0.0, FULL),
      k(2.5, FULL),
      k(5.0, DOOR),
      k(9.0, HANDS),
      k(11.5, SLOT),
      k(14.5, HANDS),
      k(18.5, HANDS),
      k(21.0, [0.15, 1.15, 0.5]),
      k(25.0, FULL),
    ]),
    custom('camera', 'fov', [k(0, FOV), k(5, 24), k(11.5, 26), k(14.5, 28), k(21, 24), k(25, FOV)]),

    custom('kiosk', 'screenState', steps([
      [0, 'medicineList'], [3.0, 'collecting'], [12.6, 'collectingNext'], [19.0, 'collecting'], [24.5, 'collectingDone'],
    ])),
    // the label prints out of the sticker slot once the box is in hand
    custom('kiosk', 'stickerFeed', [
      k(9.4, 0), k(11.0, 1, 'decelerate'), k(12.6, 1), k(13.0, 0, 'accelerate'),
    ]),
    custom('kiosk', 'doorOpen', [
      k(3.4, 0), k(4.2, 1, 'decelerate'), k(8.0, 1), k(8.8, 0, 'accelerate'),
      k(19.2, 0), k(20.0, 1, 'decelerate'), k(23.5, 1), k(24.2, 0, 'accelerate'),
    ]),

    track('patient', 'position', [
      k(1.5, [-0.6, 0, 1.6], 'decelerate'),
      k(3.0, [0.16, 0, 1.05], 'standard'),
      k(24.0, [0.16, 0, 1.05]),
      k(25.5, [-0.5, 0, 1.55], 'accelerate'),
    ]),
    track('patient', 'clip', steps([[0, 'walk'], [3.0, 'idle'], [25.0, 'walk']])),
    track('patient', 'reach', [
      k(4.2, 0), k(5.0, 0.9, 'decelerate'), k(7.6, 0.9), k(8.4, 0.2, 'accelerate'),
      k(11.6, 0.2), k(12.2, 0.9, 'decelerate'), k(13.0, 0.9), k(13.6, 0.3, 'accelerate'),
      k(20.0, 0.2), k(20.8, 0.85, 'decelerate'), k(23.2, 0.85), k(24.0, 0, 'accelerate'),
    ]),
    custom('patient', 'reachTarget', [
      k(0, [DOOR[0], DOOR[1], DOOR[2] + 0.08]),
      k(9.0, HANDS),
      k(11.8, [SLOT[0], SLOT[1], SLOT[2] + 0.06]),
      k(14.0, HANDS),
      k(19.5, [DOOR[0], DOOR[1], DOOR[2] + 0.08]),
    ]),

    // medicine box: sits in the compartment, is lifted out, held while the sticker is applied
    track('box', 'visible', steps([[0, false], [3.6, true]])),
    track('box', 'position', [
      k(3.6, [DOOR[0], DOOR[1] - 0.02, DOOR[2] - 0.18], 'decelerate'),
      k(5.6, [DOOR[0], DOOR[1], DOOR[2] + 0.02], 'standard'),
      k(7.2, [HANDS[0] + 0.04, HANDS[1] - 0.05, HANDS[2] - 0.02], 'smooth'),
      k(9.5, [HANDS[0], HANDS[1], HANDS[2] + 0.02], 'smooth'),
      k(18.5, [HANDS[0], HANDS[1], HANDS[2] + 0.02]),
      k(21.0, [0.1, 1.1, 0.82], 'standard'),
      k(25.0, [0.1, 1.1, 0.82]),
    ]),
    track('box', 'rotation', [
      k(3.6, [0, 0, 0]),
      k(7.2, [0.12, -0.5, 0.08], 'smooth'),
      k(12.0, [0.35, -0.75, 0.1], 'smooth'),
      k(18.5, [0.2, -0.6, 0.05]),
    ]),

    // sticker: taken off the print slot, carried over and pressed onto the box face
    track('sticker', 'visible', steps([[0, false], [12.6, true], [24.0, false]])),
    track('sticker', 'position', [
      k(12.6, [SLOT[0], SLOT[1] - 0.02, SLOT[2] + 0.04], 'decelerate'),
      k(13.6, [SLOT[0] - 0.03, SLOT[1] + 0.09, SLOT[2] + 0.2], 'smooth'),
      k(15.4, [HANDS[0] + 0.02, HANDS[1] + 0.03, HANDS[2] - 0.02], 'standard'),
      k(16.8, [HANDS[0], HANDS[1] + 0.005, HANDS[2] + 0.045], 'decelerate'),
      k(18.5, [HANDS[0], HANDS[1] + 0.002, HANDS[2] + 0.044]),
    ]),
    track('sticker', 'rotation', [
      k(12.6, [0, 0, 0]),
      k(13.6, [0.15, -0.35, 0.2], 'smooth'),
      k(16.8, [0.12, -0.05, 0.02], 'decelerate'),
    ]),

    // phone appears for the "continue collecting" beat
    track('phone', 'visible', steps([[0, false], [20.5, true]])),
    track('phone', 'position', [
      k(20.5, [0.06, 0.95, 0.95], 'decelerate'),
      k(21.6, [0.02, 1.18, 1.0], 'smooth'),
      k(25.0, [0.02, 1.18, 1.0]),
    ]),
    track('phone', 'rotation', [k(20.5, [-0.5, 0.2, 0.1]), k(21.6, [-0.3, 0.15, 0.05], 'smooth')]),
  ],
  markers: [
    { t: 4.2, label: 'door opens' },
    { t: 10.2, label: 'label prints' },
    { t: 16.8, label: 'sticker applied' },
    { t: 20.5, label: 'continue collecting' },
  ],
  steps: [
    { id: 'collect', label: 'รับยา', labelEn: 'Collecting Medicine', icon: 'box', t0: 0, t1: 9.5 },
    { id: 'sticker', label: 'รับสติกเกอร์', labelEn: 'Collecting Sticker', icon: 'sticker', t0: 9.5, t1: 12.6 },
    { id: 'apply', label: 'ติดสติกเกอร์', labelEn: 'Applying Sticker', icon: 'apply', t0: 12.6, t1: 19.0 },
    { id: 'continue', label: 'รับยาต่อ', labelEn: 'Continue Collecting', icon: 'continue', t0: 19.0, t1: 27 },
  ],
  captions: [
    { t0: 4.5, t1: 8.5, text: 'หยิบยาจากช่องรับยา', textEn: 'Take the medicine from the pick-up slot' },
    { t0: 9.8, t1: 12.4, text: 'ตู้พิมพ์ฉลากยาออกทางช่องสติกเกอร์', textEn: 'The machine prints the label from the sticker slot' },
    { t0: 13.0, t1: 18.0, text: 'ติดฉลากลงบนซองยา', textEn: 'Apply the sticker on the medicine package' },
    { t0: 20.5, t1: 24.0, text: 'ทำซ้ำจนครบทุกรายการ', textEn: 'Repeat until every item is collected' },
  ],
}
