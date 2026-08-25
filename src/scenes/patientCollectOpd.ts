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
/**
 * How the case sits in her hand at the moment she closes on it, and how it is turned
 * there — the offset and rotation that put the copy riding her hand exactly where the one
 * on the shelf is standing, read off the rig rather than staged by eye.
 *
 * This is what makes the pick-up a pick-up. The case used to travel from the shelf to
 * her hand while the hand held still, so it read as floating up into her fingers. Now
 * nothing on the shelf ever moves: the copy in her hand takes over on the spot, and it is
 * her arm that lifts it out. The offset is large because the rig aims the hand in screen
 * space — on screen the fingers are on the case, in world they are a hand's length in
 * front of it — and it eases back to `CARRY` as she draws it out, which reads as the
 * case settling into her grip.
 */
const CONTACT: [number, number, number] = [0.154, 0.0448, -0.1023]
const CONTACT_TURN: [number, number, number] = [0.7819, -0.3668, 1.2004]
/** where it ends up sitting in her hand once it is out */
const CARRY: [number, number, number] = [0.004, -0.044, -0.042]
const CARRY_TURN: [number, number, number] = [0.05, -0.3, 0.78]

/**
 * What her hand is aimed at during the grab. The rig swings the arm about the shoulder
 * and the grip lands short along that line, so aiming at the case itself leaves the
 * fingers below it — the aim is carried above the case to bring them level with it.
 */
const GRAB_AIM: [number, number, number] = [BOX_ON_SHELF[0], BOX_ON_SHELF[1] + 0.02, BOX_ON_SHELF[2]]

/** what her hand is aimed at as she draws it out — the lift is the arm, not the prop */
const LIFT_AIM: [number, number, number] = [GRAB_AIM[0], GRAB_AIM[1] + 0.16, GRAB_AIM[2] + 0.09]
/** and where she stands to reach into the pick-up bay */
const AT_BAY: [number, number, number] = [0.3, 0, 0.78]
/** the pull-back that takes in the cabinet and her walking across its face */
const FRONT_WIDE: [number, number, number] = [FULL[0], 1.05, FULL[2] + 0.2]

/** framing for the final push-in on the kiosk screen */
const SCREEN_VIEW: [number, number, number] = [A.screen[0], A.screen[1] - 0.1, A.screen[2]]

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
      // settled on the case by 3.2 and all but parked until she has hold of it. The rig
      // aims her hand in screen space and locks that aim after half a second, so a camera
      // still moving through the reach leaves the hand grasping at where the case was.
      k(3.2, shot(BOX_ON_SHELF, 1.06, 34, 13), 'smooth'),
      k(5.45, shot(BOX_ON_SHELF, 1.02, 34, 13), 'smooth'),
      // out of the insert and back onto her, then across the cabinet face to the window
      k(6.7, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(7.2, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(8.0, shot(SCAN, 2.3, 40, 9), 'smooth'),
      k(9.8, shot(SCAN, 2.05, 40, 9), 'smooth'),                  // slow push while it reads
      // The move to the demo happens on an empty white frame. It used to start while the
      // cabinet and the figure were still up, and the camera flew straight through both.
      k(10.5, shot(SCAN, 2.0, 40, 9), 'smooth'),
      k(11.3, shot(DEMO, 0.62, 45, 32), 'smooth'),                // isometric for the demo
      k(14.6, shot(DEMO, 0.62, 45, 32), 'smooth'),
      k(15.4, shot(BASKET_VIEW, 1.75, 45, 32), 'smooth'),         // the return reads iso too
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
      k(3.2, BOX_ON_SHELF, 'smooth'),
      k(5.45, BOX_ON_SHELF),
      k(6.7, FRONT_WIDE, 'smooth'),
      k(7.2, FRONT_WIDE),
      k(8.0, SCAN, 'smooth'),
      k(9.8, SCAN),
      k(10.5, SCAN),
      k(11.3, DEMO, 'smooth'),
      // the target flies WITH the case — same keys, same easing as its position track,
      // so the case stays pinned to frame centre for the whole carry
      k(14.6, DEMO),
      k(15.4, [IN_BASKET[0], IN_BASKET[1] + 0.2, IN_BASKET[2]], 'smooth'),
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
      k(3.2, 23, 'smooth'), k(5.45, 23), k(6.7, 24, 'smooth'), k(7.2, 24),
      k(8.0, 22, 'smooth'), k(10.5, 22), k(11.3, 22, 'smooth'), k(16.0, 22),
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
      k(1.6, 0), k(2.6, 1, 'decelerate'), k(5.5, 1), k(6.6, 0, 'accelerate'),
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
      k(0, 1), k(9.9, 1), k(10.5, 0, 'smooth'), k(15.6, 0), k(16.4, 1, 'smooth'),
      k(19.4, 1), k(20.2, 0, 'smooth'), k(22.8, 0), k(24.0, 1, 'smooth'), k(26.4, 1),
    ]),

    // ---- patient ----
    track('patient', 'visible', steps([[0, false], [1.4, true]])),
    track('patient', 'position', [
      // One walk, not two, and it is over before the camera goes tight. She used to be
      // brought to a halt in front of the cabinet and then sent on to the bay — and since
      // every key eases out to a stop, that read as a stop and a lurch. What was left of
      // the second move then played out under the insert framing, where a few centimetres
      // fill a third of the frame, so she appeared to be yanked into shot.
      //
      // She steps right up to the bay for the grab. The rig only swings the arm about the
      // shoulder — it cannot lengthen it — so where the hand lands is set by how close she
      // is standing, and from her talking distance the fingers stopped short of the shelf.
      k(1.4, [-1.5, 0, 1.95], 'smooth'),
      k(3.0, AT_BAY, 'smooth'),
      k(4.4, AT_BAY),
      k(5.5, AT_BAY),
      k(6.7, AT_FRONT, 'smooth'),
      k(9.8, AT_FRONT),
      // she walks to the table as the cabinet dissolves, and is repositioned there while
      // hidden for the unpacking demonstration
      k(10.8, AT_TABLE, 'smooth'),
      k(15.6, AT_TABLE),
      k(16.4, AT_FRONT, 'smooth'),
      k(26.4, AT_FRONT),
    ]),
    // she fades out with the cabinet: what is left on screen is the case alone
    track('patient', 'opacity', [
      k(1.4, 1), k(9.9, 1), k(10.5, 0, 'smooth'), k(15.6, 0), k(16.4, 1, 'smooth'),
      k(19.4, 1), k(20.2, 0, 'smooth'), k(22.8, 0), k(24.0, 1, 'smooth'), k(26.4, 1),
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
      k(5.5, 0.08, 'smooth'), k(6.7, 0.45, 'smooth'), k(26.4, 0.45),
    ]),
    // into the bay -> up to the scan window with the case -> down while the sticker
    // prints -> up to the slot -> resting on the medicine
    track('patient', 'reach', [
      /*
       * The grab, phrased the way a hand actually moves: the arm leaves rest quickly,
       * covers most of the distance, then crawls the last few centimetres onto the case —
       * a single eased ramp read as one machine sweep.
       *
       * It then holds dead still from 4.15 to 5.05. That hold is doing two jobs: it is
       * the beat where the fingers close before anything is lifted, and it is what lets
       * the rig lock its aim (half a second after the reach stops changing) before the
       * case moves, so the case comes up out of a hand that is not still drifting.
       */
      k(1.4, 0), k(3.0, 0, 'accelerate'),
      k(3.9, 0.87, 'decelerate'),
      k(4.15, 1, 'smooth'),
      k(5.4, 1, 'smooth'),
      k(5.9, 0.6, 'smooth'), k(6.6, 0.35, 'smooth'), k(7.4, 0.35), k(8.4, 1, 'smooth'), k(9.8, 1),
      k(10.4, 0.3, 'smooth'), k(16.6, 0.3),
      k(17.6, 1, 'smooth'), k(19.2, 1), k(20, 0.55, 'smooth'),
      k(26.4, 0.55),
    ]),
    custom('patient', 'bend', [
      /*
       * A light lean, not a fold: the shelf is at waist height, and a full bend swings the
       * whole arm down with the torso, so the hand passes well under the case.
       *
       * The lean leads the arm — she folds toward the shelf first and is settled at the
       * angle the grab is tuned around before the hand arrives — and holds there until
       * the case is out. Straightening leads the arm back up on the way out.
       */
      k(3.0, 0, 'decelerate'),
      k(3.7, 0.63, 'smooth'),
      k(4.15, 0.72, 'smooth'),
      k(5.4, 0.72, 'smooth'),
      k(6.2, 0, 'smooth'), k(26.4, 0),
    ]),
    custom('patient', 'reachTarget', [
      // the rig lines the grip up with the target on screen, so aiming at the case itself
      // puts her hand on it while the board stays in front of the cabinet
      k(0, GRAB_AIM),
      // she holds the aim through the contact beat, then lifts — the hand rises and takes
      // the case with it, which is the whole point of handing it over on the shelf
      k(4.7, GRAB_AIM, 'standard'),
      k(5.4, LIFT_AIM, 'smooth'),
      k(5.8, LIFT_AIM),
      k(7.2, READ, 'smooth'),
      k(17.0, READ),
      k(18.0, TAKE, 'smooth'),
      k(19.2, TAKE),
      k(20, READ, 'smooth'),
      k(26.4, READ),
    ]),

    // ---- props in her hand ----
    // the case rides in her hand from the bay all the way to the scan window
    track('handCase', 'visible', steps([[0, false], [4.6, true], [10.5, false]])),
    track('handCase', 'opacity', [
      // a short crossfade with the one on the shelf: any longer and both are legible at
      // once, which reads as two cases
      k(4.6, 1), k(9.9, 1), k(10.5, 0, 'smooth'),
    ]),
    track('handCase', 'position', [
      // held exactly on the shelf pose until the crossfade has finished — a copy that
      // has already started settling into the grip no longer matches the one it replaces
      k(4.48, CONTACT),
      k(4.7, CONTACT, 'smooth'),
      k(5.4, CARRY, 'smooth'),
      k(10.5, CARRY),
    ]),
    track('handCase', 'rotation', [
      // it starts turned exactly as it was on the shelf and rolls level in her hand as she
      // draws it out. The hand's own frame is rolled over by the arm swing, so without the
      // counter-roll in CARRY_TURN the tray ends up carried on its side.
      k(4.48, CONTACT_TURN),
      k(4.7, CONTACT_TURN, 'smooth'),
      k(5.4, CARRY_TURN, 'smooth'),
      k(7.2, [0.05, -0.2, 0.68], 'smooth'),
      k(7.5, [0.05, -0.2, 0.68]),
      // the QR is printed on the lid, so the lid has to be turned to face the reader —
      // held flat the code points at the ceiling and the beam plays over the side wall
      k(8.6, [1.25, -0.22, 0.05], 'smooth'),
      k(9.9, [1.25, -0.22, 0.05]),
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
    track('case', 'visible', steps([[0, true], [4.6, false], [11.2, true]])),
    /*
      * Up to the demonstration the carton inside is the one the case draws for itself, so
      * it rides the case exactly however the case is turned — a separate actor tracking it
      * by keyframes ended up poking through the lid as the case was lifted and rolled.
      * From the demonstration on it is the `demoBox` actor instead, because there it has
      * to leave the case rather than stay in it.
      */
    custom('case', 'empty', steps([[0, 0], [11.2, 1]])),
    custom('case', 'open', [k(12.3, 0), k(13.2, 1, 'smooth'), k(26.4, 1)]),
    track('case', 'opacity', [
      // it lifts off the shelf and crossfades into the one in her hand
      // a straight swap, not a crossfade: the case is clear plastic, and two coincident
      // copies at half opacity double every edge in it
      k(0, 1), k(4.6, 1),
      k(11.2, 0), k(11.8, 1, 'smooth'), k(26.4, 1),
    ]),
    track('case', 'position', [
      // it never moves: the copy in her hand takes over where it stands
      k(0, BOX_ON_SHELF),
      k(4.75, BOX_ON_SHELF),
      // repositioned while invisible, ready for the unpacking demonstration
      k(11.2, DEMO),
      k(14.6, DEMO),
      // carried to a spot directly over the basket, then lowered straight down into it
      k(15.2, [IN_BASKET[0], IN_BASKET[1] + 0.24, IN_BASKET[2]], 'smooth'),
      k(15.8, IN_BASKET, 'decelerate'),
      k(26.4, IN_BASKET),
    ]),
    track('case', 'rotation', [
      k(0, [0, 0.2, 0]),
      k(4.75, [0, 0.2, 0]),
      k(11.2, [0, 0, 0]),
    ]),
    // the table and basket are real furniture — no fade tracks, they are simply there

    // ---- the medicine itself, on stage for both demonstrations ----
    track('demoBox', 'visible', steps([
      [0, false], [11.2, true], [14.3, false], [19.6, true], [23.4, false],
    ])),
    track('demoBox', 'opacity', [
      k(11.2, 0), k(11.8, 1, 'smooth'), k(14.2, 1),
      k(19.6, 0), k(20.4, 1, 'smooth'), k(22.8, 1), k(23.4, 0, 'smooth'),
    ]),
    track('demoBox', 'position', [
      k(0, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      k(11.2, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      k(13.6, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      // up out of the open tray, then away — the shot stays with the case, which is
      // what goes back to the basket
      k(14.2, [DEMO[0], DEMO[1] + 0.075, DEMO[2]], 'smooth'),
      k(14.3, [DEMO[0], DEMO[1] + 0.075, DEMO[2]]),
      k(14.5, CARTON),   // repositioned while invisible, ready for the apply demo
      k(26.4, CARTON),
    ]),
    track('demoBox', 'rotation', [
      // flat in the case at the demonstration, then square to camera for the apply beat
      k(0, [-Math.PI / 2, 0, Math.PI / 2]),
      k(11.2, [-Math.PI / 2, 0, Math.PI / 2]),
      k(14.2, [-Math.PI / 2, 0, Math.PI / 2]),
      k(14.5, [0, 0, 0]),
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
    { t: 14.2, label: 'medicine out of the case' },
    { t: 15.8, label: 'case returned' },
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
    { t0: 2.8, t1: 4.9, text: 'กรุณาหยิบกล่องยาออกจากช่องรับยา', textEn: 'Please take the medicine case from the pick-up slot' },
    { t0: 6.3, t1: 7.4, text: 'กรุณานำกล่องยาไปสแกนที่ช่องสแกนด้านขวา', textEn: 'Take the case to the scan window on the right' },
    { t0: 7.8, t1: 9.6, text: 'สแกนคิวอาร์โค้ดบนกล่องยา', textEn: 'Scan the QR code on the medicine case' },
    { t0: 11.8, t1: 15.4, text: 'กรุณาแกะกล่อง นำยาออกจากกล่อง แล้ววางกล่องคืนที่ตะกร้า', textEn: 'Open the case, take the medicine out and return the case to the basket' },
    { t0: 16.2, t1: 19.0, text: 'ระบบกำลังพิมพ์สติกเกอร์ยาที่ช่องสติกเกอร์', textEn: 'The medicine sticker is being printed at the sticker slot' },
    { t0: 20.6, t1: 22.8, text: 'กรุณาแปะสติกเกอร์ลงบนซองยา', textEn: 'Please apply the sticker to the medicine packet' },
    { t0: 24.2, t1: 26.0, text: 'รับยาครบทุกรายการเรียบร้อย', textEn: 'All items in the order have been collected' },
  ],
  success: [{ t0: 24.8, t1: 26.0 }],
}
