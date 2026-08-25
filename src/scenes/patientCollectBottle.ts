import type { ActorDef, SceneDef } from '../anim/types'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import { A, BASKET, DEMO, DOOR, FULL, READ, SCAN, SLOT, TABLE, TAKE } from './collectCommon'

/**
 * The other half of the collecting-medicine flow: an item that never goes in a case.
 *
 * A bottle of oral solution will not fit a plastic case, so the hospital sticks the QR
 * code on the bottle itself and the pharmacy sticker goes back onto the same bottle.
 * There is nothing to unpack and nothing to hand back, which makes this the short flow:
 *
 *   take the bottle from the bay -> hold it up to the scan window -> collect the printed
 *   sticker -> apply it to the bottle.
 *
 * The boxed flow is `patientCollectOpd`; the two are rendered as separate films.
 *
 * Beat sheet (all times chosen on 0.2s steps so the sheet stays editable):
 *   0.0- 2.6  establish, call out the bay — she walks in while it opens
 *   2.6- 4.2  the door is open: straight into the zoomed grab
 *   4.2- 5.0  the bottle lifts off the shelf and crossfades into her hand
 *   5.0- 7.4  pull back and walk her across to the scan window
 *   7.4- 9.8  she raises the bottle; the QR on it is read; verified at 9.2
 *   9.8-13.2  the sticker prints at the middle slot and is taken
 *  13.2-16.8  dissolve to the bottle; the sticker is pressed onto it
 *  16.8-19.4  back at the cabinet; the screen confirms the whole order is done
 */
/** where she stands at the front of the cabinet, facing the scan window and the slot */
const AT_FRONT: [number, number, number] = [0.24, 0, 0.92]
/**
 * And where she stands to reach into the pick-up bay. The rig only swings the arm about
 * the shoulder — it cannot lengthen it — so how close she stands is what decides where
 * her hand lands; from talking distance the fingers stop short of the shelf.
 */
const AT_BAY: [number, number, number] = [0.3, 0, 0.78]
/** the pull-back that takes in the cabinet and her walking across its face */
const FRONT_WIDE: [number, number, number] = [FULL[0], 1.05, FULL[2] + 0.2]
/**
 * Where the hand goes while the bottle is read. Higher than the boxed flow's `READ`: the
 * bottle hangs below the fist, so a hand level with the window leaves the QR under the
 * beam entirely.
 */
const READ_HIGH: [number, number, number] = [SCAN[0], SCAN[1] + 0.03, SCAN[2] + 0.14]

/** framing for the final push-in on the kiosk screen */
const SCREEN_VIEW: [number, number, number] = [A.screen[0], A.screen[1] - 0.1, A.screen[2]]

/**
 * Where the bottle waits on the shelf. It is 10.5 cm tall and drawn around its centre, so
 * it has to stand half of that above the shelf or it sinks into it.
 */
const ON_SHELF: [number, number, number] = [A.pickupShelf[0], A.pickupShelf[1] + 0.055, A.pickupShelf[2] + 0.05]
/**
 * How the bottle sits in her hand at the moment she closes on it, and how it is turned
 * there — the offset and rotation that put the copy riding her hand exactly where the one
 * on the shelf is standing, read off the rig rather than staged by eye.
 *
 * This is what makes the pick-up a pick-up. The bottle used to travel from the shelf to
 * her hand while the hand held still, so it read as floating up into her fingers. Now
 * nothing on the shelf ever moves: the copy in her hand takes over on the spot, and it is
 * her arm that lifts it out. The offset is large because the rig aims the hand in screen
 * space — on screen the fingers are on the bottle, in world they are a hand's length in
 * front of it — and it eases back to `CARRY` as she draws it out, which reads as the
 * bottle settling into her grip.
 */
const CONTACT: [number, number, number] = [0.0822, 0.061, -0.1018]
const CONTACT_TURN: [number, number, number] = [0.7833, -0.3629, 1.2045]
/** where it ends up sitting in her hand once it is out */
const CARRY: [number, number, number] = [0.006, -0.066, -0.022]
const CARRY_TURN: [number, number, number] = [0.05, -0.3, 0.75]

/**
 * What her hand is aimed at during the grab. The grip lands a little short along the line
 * from the shoulder, so the aim is carried just above the bottle to bring the fingers
 * level with it.
 */
const GRAB_AIM: [number, number, number] = [ON_SHELF[0], ON_SHELF[1] + 0.02, ON_SHELF[2]]

/** what her hand is aimed at as she draws it out — the lift is the arm, not the prop */
const LIFT_AIM: [number, number, number] = [GRAB_AIM[0], GRAB_AIM[1] + 0.16, GRAB_AIM[2] + 0.09]
/** where the bottle is staged for the applying demonstration */
const STAGE: [number, number, number] = [DEMO[0] + 0.07, DEMO[1] + 0.09, DEMO[2] + 0.02]

/**
 * Same cast as the boxed flow minus the case, the medicine carton and the basket: nothing
 * is unpacked here, so nothing is handed back either. The table stays — it is furniture
 * that stands by the kiosk whichever flow is playing.
 */
function bottleActors(): ActorDef[] {
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
      // one bottle for the whole clip: it starts on the shelf inside the bay and is the
      // same object the applying demonstration stages
      id: 'bottle',
      kind: 'prop',
      primitive: 'medicineBottle',
      label: 'Bottle of oral solution',
      position: ON_SHELF,
      rotation: [0, 0.2, 0],
    },
    { id: 'table', kind: 'prop', primitive: 'sideTable', label: 'Side table', position: TABLE },
    { id: 'demoBasket', kind: 'prop', primitive: 'returnBasket', label: 'Return basket', position: BASKET },
    {
      id: 'demoLabel',
      kind: 'prop',
      primitive: 'sticker',
      // narrower than the boxed flow's: it has to sit inside the curve of the bottle
      scale: 0.34,
      label: 'Demo · sticker',
      position: [STAGE[0], STAGE[1], STAGE[2] + 0.06],
      visible: false,
    },
    {
      id: 'label',
      kind: 'prop',
      primitive: 'sticker',
      label: 'Printed sticker',
      scale: 0.62,
      position: [0, -0.02, 0.05],
      visible: false,
      params: { attachTo: 'patient:grip' },
    },
  ]
}

export const patientCollectBottle: SceneDef = {
  id: 'patient-collect-bottle',
  name: 'Patient · Collecting Medicine (no case)',
  duration: 19.4,
  fps: 30,
  size: [1080, 683],
  background: '#ffffff',
  camera: { position: shot(FULL, DIST.wide, 35, 13), target: FULL, fov: FOV },
  actors: bottleActors(),
  tracks: [
    // ---- shot list ----
    track('camera', 'position', [
      k(0, shot(FULL, DIST.wide, 35, 13)),
      k(0.4, shot(FULL, DIST.wide, 35, 13)),
      k(1.6, shot(DOOR, DIST.close, 36, 14), 'smooth'),           // 1 · Collecting Medicine
      k(2.6, shot(DOOR, 1.5, 34, 10), 'standard'),
      // settled on the bottle by 3.2 and all but parked until she has hold of it: the
      // rig locks its screen-space aim half a second after the reach stops changing, so a
      // camera still moving through the grab leaves the hand grasping at thin air
      k(3.2, shot(ON_SHELF, 1.06, 34, 13), 'smooth'),
      k(5.45, shot(ON_SHELF, 1.02, 34, 13), 'smooth'),
      // out of the insert and back onto her, then across the cabinet face to the window
      k(6.7, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(7.2, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(8.0, shot(SCAN, 2.0, 40, 9), 'smooth'),
      k(9.8, shot(SCAN, 1.72, 40, 9), 'smooth'),                  // slow push while it reads
      k(10.8, shot(SLOT, 1.4, 34, 10), 'smooth'),                 // 2 · Collecting Sticker
      k(12.6, shot(TAKE, 1.5, 38, 10), 'smooth'),
      // The move to the demo happens on an empty white frame — it used to start while the
      // cabinet and the figure were still up, and flew the camera straight through both.
      k(13.4, shot(TAKE, 1.5, 38, 10), 'smooth'),
      // 3 · Applying Sticker — the sticker carries the shot from the slot to the staging
      k(14.2, shot(STAGE, 0.64, 0, 0), 'smooth'),
      k(16.6, shot(STAGE, 0.58, 0, 0), 'smooth'),
      // the cabinet dissolves back in as the camera pulls out onto the screen
      k(17.6, shot(SCREEN_VIEW, 1.15, 16, 5), 'smooth'),
      k(19.4, shot(SCREEN_VIEW, 0.95, 10, 3)),
    ]),
    track('target', 'position', [
      k(0, FULL),
      k(0.4, FULL),
      k(1.6, DOOR, 'smooth'),
      k(3.2, DOOR, 'smooth'),
      k(3.2, ON_SHELF, 'smooth'),
      k(5.45, ON_SHELF),
      k(6.7, FRONT_WIDE, 'smooth'),
      k(7.2, FRONT_WIDE),
      k(8.0, SCAN, 'smooth'),
      k(9.8, SCAN),
      k(10.8, SLOT, 'smooth'),
      k(12.6, TAKE, 'smooth'),
      k(13.4, TAKE),
      k(14.2, STAGE, 'smooth'),
      k(16.6, STAGE),
      k(17.6, SCREEN_VIEW, 'smooth'),
      k(19.4, SCREEN_VIEW),
    ]),
    custom('camera', 'fov', [
      k(0, FOV), k(0.4, FOV), k(2.6, 20, 'smooth'),
      k(3.2, 23, 'smooth'), k(5.45, 23), k(6.7, 24, 'smooth'), k(7.2, 24),
      k(8.0, 22, 'smooth'), k(9.8, 22), k(10.8, 22, 'smooth'), k(13.4, 23, 'smooth'),
      k(14.2, 24, 'smooth'), k(16.6, 24), k(17.6, 22, 'smooth'), k(19.4, 22),
    ]),

    // ---- kiosk ----
    // the cabinet dispenses the whole order in one go: straight to the completed summary
    custom('kiosk', 'screenState', steps([[0, 'medicineList'], [1.6, 'collectingDone']])),
    custom('kiosk', 'doorOpen', [
      k(1.6, 0), k(2.6, 1, 'decelerate'), k(5.5, 1), k(6.6, 0, 'accelerate'),
    ]),
    // the window closes on the bottle she holds up to it — the QR is wrapped on the glass
    custom('kiosk', 'scanGlow', [
      k(8.0, 0), k(8.6, 0.45, 'decelerate'), k(9.0, 0.4), k(9.2, 1, 'decelerate'),
      k(9.6, 0.9), k(9.8, 0, 'accelerate'),
    ]),
    // the beam has to reach further and further down than the boxed flow's: the bottle
    // hangs below the fist rather than sitting in it
    custom('kiosk', 'scanReach', [k(0, 0.34), k(8.6, 0.34), k(9.2, 0.30, 'decelerate'), k(19.4, 0.30)]),
    custom('kiosk', 'scanSpread', [k(0, 0.1), k(8.6, 0.1), k(9.2, 0.19, 'decelerate'), k(19.4, 0.19)]),
    custom('kiosk', 'scanTilt', [k(0, 0.16), k(8.6, 0.16), k(9.2, -0.26, 'smooth'), k(19.4, -0.26)]),
    custom('kiosk', 'stickerFeed', [
      k(9.8, 0), k(11.4, 1, 'decelerate'), k(12.8, 1), k(13.2, 0, 'accelerate'),
    ]),
    // the cabinet dissolves away for the applying demonstration and comes back after it
    track('kiosk', 'opacity', [
      k(0, 1), k(12.7, 1), k(13.4, 0, 'smooth'), k(16.6, 0), k(17.4, 1, 'smooth'), k(19.4, 1),
    ]),

    // ---- patient ----
    track('patient', 'visible', steps([[0, false], [1.4, true]])),
    track('patient', 'position', [
      // One walk, not two, and over before the camera goes tight: a key in front of the
      // cabinet eased out to a stop there, and what was left of the move played out under
      // the insert framing, where she appeared to be yanked into shot
      k(1.4, [-1.5, 0, 1.95], 'smooth'),
      k(3.0, AT_BAY, 'smooth'),
      k(5.5, AT_BAY),
      k(6.7, AT_FRONT, 'smooth'),
      k(19.4, AT_FRONT),
    ]),
    // she fades out with the cabinet: what is left on screen is the bottle alone
    track('patient', 'opacity', [
      k(1.4, 1), k(12.7, 1), k(13.4, 0, 'smooth'), k(16.6, 0), k(17.4, 1, 'smooth'), k(19.4, 1),
    ]),
    custom('patient', 'tilt', [
      /*
       * `tilt` blends the cut-out board from upright towards fully camera-aligned. Under
       * the insert the camera is a metre from the shelf and pitched down, so a tilted
       * board lays its top away from the lens — straight through the front of the
       * cabinet. She stands up square for the grab and only leans back into the shot
       * once the camera has pulled out again.
       */
      k(1.4, 0.3), k(2.8, 0.3, 'smooth'), k(3.4, 0.08, 'smooth'),
      k(5.5, 0.08, 'smooth'), k(6.7, 0.45, 'smooth'), k(19.4, 0.45),
    ]),
    // into the bay -> up to the scan window -> down while the sticker prints -> up to
    // the slot -> resting on the bottle
    track('patient', 'reach', [
      /*
        * The grab, phrased the way a hand actually moves: the arm leaves rest quickly,
        * covers most of the distance, then crawls the last few centimetres onto the
        * bottle. It holds dead still from 4.15 to 5.05 — the beat where the fingers close
        * before anything lifts, and long enough for the rig to lock its screen-space aim
        * before the bottle moves.
        */
      k(1.4, 0), k(3.0, 0, 'accelerate'),
      k(3.9, 0.87, 'decelerate'),
      k(4.15, 1, 'smooth'),
      k(5.4, 1, 'smooth'),
      k(5.9, 0.6, 'smooth'), k(6.6, 0.35, 'smooth'), k(7.4, 0.35), k(8.4, 1, 'smooth'), k(9.8, 1),
      k(10.4, 0.12, 'smooth'), k(11.2, 0.12),
      k(12.0, 1, 'smooth'), k(13.0, 1), k(13.6, 0.55, 'smooth'), k(19.4, 0.55),
    ]),
    custom('patient', 'bend', [
      /*
       * A light lean, not a fold: the shelf is at waist height, and a full bend swings the
       * whole arm down with the torso, well under it. The lean leads the arm on the way in
       * and leads it back up on the way out.
       */
      k(3.0, 0, 'decelerate'),
      k(3.7, 0.63, 'smooth'),
      k(4.15, 0.88, 'smooth'),
      k(5.4, 0.88, 'smooth'),
      k(6.2, 0, 'smooth'), k(19.4, 0),
    ]),
    custom('patient', 'reachTarget', [
      k(0, GRAB_AIM),
      // she holds the aim through the contact beat, then lifts — the hand rises and takes
      // the bottle with it, which is the whole point of handing it over on the shelf
      k(4.7, GRAB_AIM, 'standard'),
      k(5.4, LIFT_AIM, 'smooth'),
      k(5.8, LIFT_AIM),
      k(7.2, READ_HIGH, 'smooth'),
      k(11.4, READ_HIGH),
      k(12.0, TAKE, 'smooth'),
      k(13.0, TAKE),
      k(13.6, READ, 'smooth'),
      k(19.4, READ),
    ]),

    // ---- props in her hand ----
    // the printed sticker rides in her hand from the slot into the applying demonstration
    track('label', 'visible', steps([[0, false], [13.0, true], [13.6, false]])),
    track('label', 'opacity', [k(13.0, 1), k(13.2, 1), k(13.6, 0, 'smooth')]),
    track('label', 'position', [
      k(13.0, [0.024, 0.07, 0.075], 'decelerate'),
      k(14.0, [0.004, 0.02, 0.065], 'smooth'),
    ]),
    track('label', 'rotation', [k(13.0, [0.2, -0.3, 0.25]), k(14.0, [0.05, -0.2, 0.02], 'smooth')]),

    // ---- the bottle: one object, from the shelf to the demonstration ----
    /*
     * Never swapped for a copy in her hand. `attachTo` is a timeline channel, so the same
     * actor changes what it is parented to: it stands on the shelf until her fingers close
     * on it, and rides her hand from there.
     *
     * The position and rotation tracks change meaning at each switch — world coordinates
     * while it is loose, an offset in the hand's frame while it is held — so the key that
     * ends one span and the key that opens the next sit a tenth of a millisecond apart.
     */
    custom('bottle', 'attachTo', steps([[0, ''], [4.6, 'patient:grip'], [13.5, '']])),
    track('bottle', 'opacity', [
      k(0, 1), k(12.7, 1), k(13.4, 0, 'smooth'),
      k(13.8, 0), k(14.4, 1, 'smooth'), k(19.4, 1),
    ]),
    track('bottle', 'position', [
      k(0, ON_SHELF),
      k(4.5999, ON_SHELF, 'linear'),
      // ---- held: an offset in her hand's frame ----
      k(4.6, CONTACT),
      k(4.7, CONTACT, 'smooth'),
      k(5.4, CARRY, 'smooth'),
      k(13.4999, CARRY, 'linear'),
      // ---- loose again: world coordinates, staged for the applying demonstration ----
      k(13.5, STAGE),
      k(19.4, STAGE),
    ]),
    track('bottle', 'rotation', [
      k(0, [0, 0.2, 0]),
      k(4.5999, [0, 0.2, 0], 'linear'),
      // it stays turned exactly as it stood on the shelf and comes upright in her hand as
      // she draws it out; the counter-roll in CARRY_TURN cancels the roll the arm swing
      // puts into the hand's own frame
      k(4.6, CONTACT_TURN),
      k(4.7, CONTACT_TURN, 'smooth'),
      k(5.4, CARRY_TURN, 'smooth'),
      k(7.2, [0.05, -0.2, 0.65], 'smooth'),
      k(7.5, [0.05, -0.2, 0.65]),
      // the QR is wrapped on the front of the glass, so the front is turned to the reader
      k(8.6, [0.05, -0.05, 0.06], 'smooth'),
      k(13.4999, [0.05, -0.05, 0.06], 'linear'),
      k(13.5, [0, -0.14, 0]),
    ]),

    // ---- demonstration: peel the sticker off its backing and press it on the bottle ----
    track('demoLabel', 'visible', steps([[0, false], [13.6, true], [17.0, false]])),
    track('demoLabel', 'opacity', [k(13.6, 0), k(14.2, 1, 'smooth'), k(16.6, 1), k(17.0, 0, 'smooth')]),
    custom('demoLabel', 'curl', [k(14.2, 1), k(15.0, 0.7, 'smooth'), k(15.9, 0.04, 'smooth'), k(16.1, 0)]),
    track('demoLabel', 'position', [
      // it fades in curled a short way off the glass and is pressed straight onto it,
      // finishing on the curve just below the label already printed there
      k(13.6, [STAGE[0], STAGE[1] - 0.018, STAGE[2] + 0.068], 'smooth'),
      k(15.0, [STAGE[0], STAGE[1] - 0.022, STAGE[2] + 0.047], 'smooth'),
      k(15.8, [STAGE[0], STAGE[1] - 0.026, STAGE[2] + 0.0248], 'decelerate'),
      k(16.1, [STAGE[0], STAGE[1] - 0.026, STAGE[2] + 0.0248]),
    ]),
    track('demoLabel', 'rotation', [
      k(13.6, [0.28, -0.22, 0.12], 'smooth'),
      k(15.8, [0, -0.14, 0], 'smooth'),
    ]),
  ],
  markers: [
    { t: 1.6, label: 'pick-up bay' },
    { t: 4.8, label: 'bottle taken' },
    { t: 9.2, label: 'QR on the bottle scanned' },
    { t: 11.4, label: 'sticker printed' },
    { t: 16.1, label: 'sticker applied' },
    { t: 17.8, label: 'order complete' },
  ],
  steps: [
    { id: 'collect', label: 'รับยา', labelEn: 'Collecting\nMedicine', icon: 'box', t0: 0, t1: 9.8 },
    { id: 'sticker', label: 'รับสติ๊กเกอร์', labelEn: 'Collecting\nSticker', icon: 'sticker', t0: 9.8, t1: 13.2 },
    { id: 'apply', label: 'แปะสติ๊กเกอร์', labelEn: 'Applying\nSticker', icon: 'apply', t0: 13.2, t1: 19.4 },
  ],
  captions: [
    { t0: 1.6, t1: 2.6, text: 'ช่องรับยาอยู่บริเวณนี้', textEn: 'The pick-up slot is located here' },
    { t0: 2.8, t1: 4.9, text: 'กรุณาหยิบยาออกจากช่องรับยา', textEn: 'Please take the medicine from the pick-up slot' },
    { t0: 6.3, t1: 7.4, text: 'ยาที่ใส่กล่องไม่ได้ จะมีคิวอาร์โค้ดติดอยู่ที่ตัวยา', textEn: 'Medicine that will not fit a case carries its QR code on the item itself' },
    { t0: 7.8, t1: 9.6, text: 'กรุณาสแกนคิวอาร์โค้ดที่ช่องสแกนด้านขวา', textEn: 'Scan the QR code at the window on the right' },
    { t0: 10.0, t1: 12.8, text: 'ระบบกำลังพิมพ์สติกเกอร์ยาที่ช่องสติกเกอร์', textEn: 'The medicine sticker is being printed at the sticker slot' },
    { t0: 14.4, t1: 16.4, text: 'กรุณาแปะสติกเกอร์ลงบนขวดยา', textEn: 'Please apply the sticker to the bottle' },
    { t0: 17.6, t1: 19.0, text: 'รับยาครบทุกรายการเรียบร้อย', textEn: 'All items in the order have been collected' },
  ],
  success: [{ t0: 17.8, t1: 19.0 }],
}
