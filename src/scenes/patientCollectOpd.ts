import type { SceneDef, Vec3 } from '../anim/types'
import type { Ease } from '../anim/easing'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import {
  A, BASKET, BASKET_VIEW, BOX_ON_SHELF, CARTON, DEMO, DOOR, FULL, IN_BASKET,
  READ, SCAN, SLOT, TAKE, collectActors,
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
 *
 * It is solved, not typed: anything that changes where her hand ends up invalidates it,
 * and the failure is loud — the case jumps the moment it changes hands. Re-phrasing the
 * reach moved the settled arm by half a degree and reshaping the pull moved the camera
 * the aim is solved against, and between them the case was snapping 6.8 cm at 4.6.
 */
const CONTACT: [number, number, number] = [0.1281, 0.0145, -0.0405]
const CONTACT_TURN: [number, number, number] = [0.8544, -0.5014, 1.1528]
/**
 * How she carries it at the window, and how far behind her hand it rides.
 *
 * The depth here is a clearance, not a look. The rig is a cut-out: the fist is painted on
 * a flat plane through the grip, so anything whose near face lands in front of that plane
 * cuts through the drawn fingers, and anything pushed far behind it disappears into the
 * arm. The usable band is only a few centimetres wide, and how wide depends entirely on
 * how the case is turned — carried on edge it reaches 7.6 cm towards the camera and a
 * third of it stood through her hand; carried flat, with the lid facing away, it reaches
 * only 4 cm and sits clear at 5.2 cm back while still reading as a box she is holding.
 *
 * Nothing turns it while she is picking it up, though. It comes out of the bay held
 * exactly as it stood on the shelf — a case that rolls over in a closing hand reads as an
 * object being posed rather than one being taken — and only turns flat once it is clear of
 * the cabinet and on its way to the reader.
 */
const CARRY: [number, number, number] = [0.075, -0.03, -0.052]
/**
 * Where it rides while it is still turned exactly as it came off the shelf. Held on edge
 * like that the case reaches 9.4 cm towards the camera from its own centre — more than
 * twice what it needs lying flat — so it has to ride that much further back to stay behind
 * the drawn fist, and only comes forward to `CARRY` once it is flat for the reader.
 */
const HOLD: [number, number, number] = [0.085, -0.02, -0.112]
/*
 * And where it rides on the way out of the bay, before it is turned. `HOLD` is the depth
 * an on-edge case needs to stay behind the drawn fist; lying flat, as it does all the way
 * out, it needs less than half of that — and eleven centimetres behind the hand while the
 * hand is still at the mouth of the bay puts the case back inside the cabinet, where the
 * front panel hides it for the whole lift. It carries in the palm until it turns.
 */
const LIFT_HOLD: [number, number, number] = [0.085, -0.02, -0.055]
/** raised as she arrives at the window, and turned so the lid's QR faces the reader */
const SCAN_TURN: [number, number, number] = [-1.4387, 0.0632, -1.7614]
/**
 * And how it is carried on the way there. Both of these are solved, not dialled in: the
 * QR is on the lid, so the lid's normal has to point at the scanner window on the panel,
 * and the offset that achieves that lives in the hand's frame — which turns with her arm
 * all the way across the cabinet. A single angle held through the carry therefore drifts,
 * and what it drifted into was the lid facing the camera instead of the machine.
 */
const CARRY_TURN: [number, number, number] = [-1.6233, -0.8269, -2.0686]

/**
 * What her hand is aimed at during the grab. The rig swings the arm about the shoulder
 * and the grip lands short along that line, so aiming at the case itself leaves the
 * fingers below it — the aim is carried above the case to bring them level with it.
 */
const GRAB_AIM: [number, number, number] = [BOX_ON_SHELF[0], BOX_ON_SHELF[1] + 0.02, BOX_ON_SHELF[2]]

/**
 * Where the aim sits while the arm is still travelling. The arm swings about the shoulder
 * on a fixed radius, so on the way in it sweeps across the case rather than towards it,
 * and around 3.45 the drawn hand crosses the case's own volume. Coming in a few
 * centimetres high keeps the hand above the lid through the swing and lets it settle down
 * onto the case at the end, which is also how a hand reaches for something on a shelf.
 */
const APPROACH_AIM: [number, number, number] = [GRAB_AIM[0], GRAB_AIM[1] + 0.1, GRAB_AIM[2]]

/**
 * Out of the bay before up. The case rides behind the fist, so a hand that goes straight
 * up from the shelf takes the case up the *inside* of the front panel — it passes the top
 * edge of the bay opening still a hand's depth inside the cabinet and is simply hidden for
 * the whole lift. This aim draws the hand out of the mouth of the bay first and barely
 * raises it; the rise is what follows.
 */
const OUT_AIM: [number, number, number] = [GRAB_AIM[0], GRAB_AIM[1] + 0.05, GRAB_AIM[2] + 0.17]
/** what her hand is aimed at as she draws it out — the lift is the arm, not the prop */
const LIFT_AIM: [number, number, number] = [GRAB_AIM[0], GRAB_AIM[1] + 0.16, GRAB_AIM[2] + 0.09]
/** and where she stands to reach into the pick-up bay */
const AT_BAY: [number, number, number] = [0.3, 0, 0.75]
/** the pull-back that takes in the cabinet and her walking across its face */
const FRONT_WIDE: [number, number, number] = [FULL[0], 1.05, FULL[2] + 0.2]

/** framing for the final push-in on the kiosk screen */
const SCREEN_VIEW: [number, number, number] = [A.screen[0], A.screen[1] - 0.1, A.screen[2]]

/**
 * The push from the establishing wide into the pick-up bay.
 *
 * It used to be three keys — 15 m, then 3 m, then 1.5 m, then the insert — and since
 * every key eases out to a stop, the move stalled three times on the way in.
 *
 * What reads as one continuous push is a constant *apparent* zoom rate, which means the
 * distance has to fall by the same ratio at each step rather than by the same number of
 * metres. So the move is sampled off an exponential in distance, eased in and out of rest
 * by the S-curve on `u` rather than by the keys' own easings — every key is linear, and
 * there are enough of them (one every tenth of a second) that the corner where two of
 * them meet is far below anything the eye picks up. Six keys with eased ends was not
 * enough: the join between the ramp-in and the first straight span halved the zoom rate
 * in a single frame.
 *
 * (Their times are off the 0.2s grid the rest of the sheet uses because they are points
 * on that curve, not beats.)
 */
const mix = (a: Vec3, b: Vec3, u: number): Vec3 =>
  [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
const PUSH_T0 = 0.4
const PUSH_T1 = 2.9
const PUSH_DIST = 0.82
const PUSH_STEPS = 28
const push = Array.from({ length: PUSH_STEPS + 1 }, (_, i) => {
  const v = i / PUSH_STEPS
  // starts and arrives at rest; everything between runs at a near-constant zoom rate
  const u = v * v * (3 - 2 * v)
  return {
    t: +(PUSH_T0 + (PUSH_T1 - PUSH_T0) * v).toFixed(3),
    // the frame settles from the whole cabinet onto the open bay, then onto the case
    target: u < 0.5 ? mix(FULL, DOOR, u * 2) : mix(DOOR, BOX_ON_SHELF, (u - 0.5) * 2),
    dist: DIST.wide * Math.pow(PUSH_DIST / DIST.wide, u),
    // the last key's easing governs the hold that follows it, not the push
    ease: (i === PUSH_STEPS ? 'smooth' : 'linear') as Ease,
  }
})

/**
 * And the pull back out, built the same way as the push.
 *
 * It waits for the whole grab. The insert holds from 2.9 to 4.9 — reach, contact, lift —
 * and only then opens up. At 0.82 m the frame is the bay and the hand in it and nothing
 * else: her stooped body is off the bottom of it entirely, which is the point. The one
 * thing that never looks right in a stoop is the stoop.
 *
 * Same reasoning as `push` for the shape: constant apparent zoom rate means the distance
 * grows by a constant ratio, so it is sampled off an exponential and every key is linear
 * except the last. The bay stays centred while the camera swings round to her right —
 * pulling straight back onto her puts her shoulder across the frame.
 */
const PULL_T0 = 3.8
const PULL_T1 = 6.2
const PULL_STEPS = 24
const PULL_DIST = 2.4
/**
 * What the widening frame is centred on. Straight from the shelf to the bay it left the
 * hand riding the top edge the whole way out — the action has left the shelf by then. It
 * follows the lift first, then settles on the bay a little high, where the case she is
 * holding sits about a third down the frame instead of on the rim.
 */
const PULL_HIGH: Vec3 = [DOOR[0], DOOR[1] + 0.16, DOOR[2]]
const pull = Array.from({ length: PULL_STEPS + 1 }, (_, i) => {
  const v = i / PULL_STEPS
  /*
   * Even, not front-loaded. `standard` puts a third of the move in its first two tenths,
   * which at this size is a lurch — the frame leaps and then crawls for two seconds. It
   * needed that when the pull started at 4.3 and had a handover to get clear of; starting
   * at 3.8 there is time to spend, so this is a plain smoothstep: at rest at both ends,
   * quickest in the middle, and no part of it more than about a third faster than the
   * average.
   */
  const u = v * v * (3 - 2 * v)
  return {
    t: +(PULL_T0 + (PULL_T1 - PULL_T0) * v).toFixed(3),
    target: u < 0.4 ? mix(BOX_ON_SHELF, LIFT_AIM, u / 0.4) : mix(LIFT_AIM, PULL_HIGH, (u - 0.4) / 0.6),
    dist: PUSH_DIST * Math.pow(PULL_DIST / PUSH_DIST, u),
    yaw: 34.6 + (42 - 34.6) * u,
    pitch: 13 + (12 - 13) * u,
    ease: (i === PULL_STEPS ? 'smooth' : 'linear') as Ease,
  }
})

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
      // one continuous push into the bay — see `push` above. It is settled on the case by 3.2
      // and all but parked until she has hold of it: the rig aims her hand in screen space
      // and locks that aim half a second after the reach stops changing, so a camera still
      // moving through the grab leaves the hand grasping at thin air.
      ...push.map((s) => k(s.t, shot(s.target, s.dist, 34.6, 13), s.ease)),
      // The insert holds only as long as the reach. It starts widening before her fingers
      // close, not after: at this distance the lift is half the frame, so a parked camera
      // loses her hand off the top, and the body that comes back into it is one already on
      // its way up rather than a stoop.
      ...pull.map((s) => k(s.t, shot(s.target, s.dist, s.yaw, s.pitch), s.ease)),
      // then back onto her, and across the cabinet face to the window
      k(6.7, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(7.2, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(8.0, shot(SCAN, 2.3, 40, 9), 'smooth'),
      k(9.8, shot(SCAN, 2.05, 40, 9), 'smooth'),                  // slow push while it reads
      // The move to the demo happens on an empty white frame. It used to start while the
      // cabinet and the figure were still up, and the camera flew straight through both.
      k(10.5, shot(SCAN, 2.0, 40, 9), 'smooth'),
      k(11.3, shot(DEMO, 0.62, 45, 32), 'smooth'),                // isometric for the demo
      // The return starts as the medicine leaves, not a second and a half later. The
      // demonstration used to sit on a finished frame — carton gone, case open and still —
      // for the best part of two seconds before anything moved again.
      k(13.9, shot(DEMO, 0.62, 45, 32), 'smooth'),
      k(15.0, shot(BASKET_VIEW, 1.75, 45, 32), 'smooth'),         // the return reads iso too
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
      ...push.map((s) => k(s.t, s.target, s.ease)),
      ...pull.map((s) => k(s.t, s.target, s.ease)),
      k(6.7, FRONT_WIDE, 'smooth'),
      k(7.2, FRONT_WIDE),
      k(8.0, SCAN, 'smooth'),
      k(9.8, SCAN),
      k(10.5, SCAN),
      k(11.3, DEMO, 'smooth'),
      // the target flies WITH the case — same keys, same easing as its position track,
      // so the case stays pinned to frame centre for the whole carry
      k(13.9, DEMO),
      k(15.0, [IN_BASKET[0], IN_BASKET[1] + 0.2, IN_BASKET[2]], 'smooth'),
      k(16.0, [BASKET[0] + 0.03, BASKET[1] + 0.1, BASKET[2]], 'smooth'),
      k(17.0, SLOT, 'smooth'),
      k(18.8, TAKE, 'smooth'),
      k(20.4, CARTON, 'smooth'),
      k(22.8, CARTON),
      k(24.2, SCREEN_VIEW, 'smooth'),
      k(26.4, SCREEN_VIEW),
    ]),
    custom('camera', 'fov', [
      // held through the push: a focal length changing under a dolly is a second move on
      // top of the first, and they do not cancel
      k(0, 23), k(4.9, 23), k(6.3, 23, 'smooth'), k(6.7, 24, 'smooth'), k(7.2, 24),
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
      k(1.6, 0), k(2.4, 1, 'decelerate'), k(5.5, 1), k(6.6, 0, 'accelerate'),
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
      k(2.8, AT_BAY, 'smooth'),
      // She steps back off the bay as she lifts the case out, not a second later — and
      // over the whole lift, not in one move at the front of it. It used to happen
      // between 5.4 and 6.7, by which point she is standing in the open holding the case
      // and it reads as shuffling; spread across the lift it is the step back you take
      // with something you have just picked up.
      k(3.9, AT_BAY, 'accelerate'),
      /*
       * Most of the step is spent in the first half second of it. The board yaws to face
       * the camera, so while she is standing at the bay her shoulder swings into the
       * cabinet's front panel and the arm is drawn through it — she has to be clear of the
       * face by the time the frame is wide enough to show it, which is a little after 4.2.
       * The rest of the distance is spread over the remaining second so it still reads as
       * one continuous step back rather than a retreat and a drift.
       */
      k(4.7, [0.27, 0, 0.888], 'smooth'),
      k(5.7, AT_FRONT, 'smooth'),
      // and she stays there. She used to walk across to the table as the cabinet
      // dissolved and walk back for the sticker, but the demonstrations do not play at
      // the table — they play on their own, with her faded out — so the walk was two
      // moves that started while she was still on screen and served nothing.
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
      k(1.4, 0.3), k(2.6, 0.3, 'smooth'), k(3.2, 0.08, 'smooth'),
      k(4.8, 0.08, 'smooth'), k(6.2, 0.45, 'smooth'), k(26.4, 0.45),
    ]),
    /*
     * Nothing but the arm is drawn while the camera is in tight. The rig folds the whole
     * upper body to get the hand down to a shelf at waist height, and a stoop drawn as a
     * flat cut-out is the least convincing thing the puppet does — so under the insert the
     * body, torso and shadow are dropped and what plays is a hand going into a hatch.
     *
     * It comes back as the camera widens, not after it. The channel is a level rather
     * than a switch, so the body dissolves in over the same six tenths the frame takes to
     * open — a shot that has opened up with nothing in it but an arm, and a figure
     * appearing whole on one frame afterwards, are both worse than a body arriving with
     * the room it is standing in.
     *
     * Going the other way it is a cut: the frame is tight enough at 2.9 that there is
     * nothing on screen to see leave.
     */
    custom('patient', 'armOnly', [
      k(0, 0), k(2.85, 0, 'linear'), k(2.9, 1, 'linear'),
      k(3.8, 1, 'smooth'), k(4.4, 0, 'smooth'), k(26.4, 0),
    ]),
    // into the bay -> up to the scan window with the case -> down while the sticker
    // prints -> up to the slot -> resting on the medicine
    track('patient', 'reach', [
      /*
       * The grab, phrased the way a hand actually moves: the arm leaves rest, covers most
       * of the distance, then crawls the last few centimetres onto the case.
       *
       * One span, not two. It used to accelerate to 0.87 and then decelerate the rest of
       * the way, and both of those easings are one-sided — `accelerate` arrives at full
       * speed and `decelerate` leaves at full speed — so the join at 3.9 was a step in
       * velocity, not a shape: the arm was still speeding up when it hit the seam and
       * lurched through it. `standard` is the whole reach in one curve, at rest at both
       * ends and quickest early, which is the same phrasing without the seam.
       *
       * It then holds dead still from 4.15 to 5.05. That hold is doing two jobs: it is
       * the beat where the fingers close before anything is lifted, and it is what lets
       * the rig lock its aim (half a second after the reach stops changing) before the
       * case moves, so the case comes up out of a hand that is not still drifting.
       */
      k(1.4, 0), k(2.8, 0, 'standard'),
      k(3.7, 1, 'smooth'),
      k(4.6, 1, 'smooth'),
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
       *
       * It leaves rest on a `smooth`, not a `decelerate`: `decelerate` starts at full
       * speed, so the torso used to take a third of the lean in the first two frames and
       * then settle, which is the jolt the arm was riding on top of.
       */
      k(2.8, 0, 'smooth'),
      // at the limit for the grab: the waist is the only hinge that moves the hand much —
      // the arm swings about the shoulder, so aiming it lower barely lowers it
      k(3.6, 0.94, 'smooth'),
      k(4.2, 0.94, 'smooth'),
      k(5.0, 0, 'smooth'), k(26.4, 0),
    ]),
    custom('patient', 'reachTarget', [
      // the rig lines the grip up with the target on screen, so aiming at the case itself
      // puts her hand on it while the board stays in front of the cabinet
      k(0, APPROACH_AIM),
      /*
       * It comes down onto the case over the last stretch of the reach and is settled on
       * it well before the handover, so the rig has the aim it was solved against by the
       * time the case changes hands.
       */
      k(3.52, APPROACH_AIM, 'smooth'),
      k(3.9, GRAB_AIM, 'smooth'),
      // she holds the aim through the contact beat, then lifts — the hand rises and takes
      // the case with it, which is the whole point of handing it over on the shelf
      /*
       * The lift starts on the same frame the case changes hands, and is already moving
       * on it. The attach can never be perfectly seamless — the case's offset in her hand
       * is solved against where the rig settles, and that settles to within a few
       * millimetres of the same pose, not to the same pose — and a few millimetres is
       * nothing inside a move and visible in a frame that is otherwise dead still, which
       * is what a hold either side of it made it.
       *
       * Not `decelerate`, though: leaving at full speed had the case a third of the way
       * out of the bay two frames after she touched it. This leaves at about a third of
       * that, which is enough to carry the seam and still reads as a lift.
       */
      k(4.1, GRAB_AIM, [0.3, 0.1, 0.3, 1]),
      k(4.55, OUT_AIM, 'smooth'),
      k(5.1, LIFT_AIM, 'smooth'),
      k(5.4, LIFT_AIM),
      k(7.2, READ, 'smooth'),
      k(17.0, READ),
      k(18.0, TAKE, 'smooth'),
      k(19.2, TAKE),
      k(20, READ, 'smooth'),
      k(26.4, READ),
    ]),

    // ---- props in her hand ----
    // from the unpacking demonstration on, what she carries is the medicine itself
    /*
     * She is empty-handed at the sticker slot. The medicine used to be back in her hand
     * from 15.8, so the whole collecting-the-sticker beat played with a box held up
     * beside the slot it prints from — two things to look at, and only one of them is
     * what the caption is asking her to do. It comes back for the last beat, once the
     * sticker is on it.
     */
    track('handBox', 'visible', steps([[0, false], [23.2, true]])),
    track('handBox', 'opacity', [k(23.2, 0), k(24.0, 1, 'smooth'), k(26.4, 1)]),
    track('handBox', 'rotation', [k(23.2, [0.05, -0.2, 0])]),
    // the printed sticker rides in her hand from the slot into the applying demonstration
    track('label', 'visible', steps([[0, false], [19.4, true], [20.0, false]])),
    track('label', 'opacity', [k(19.4, 1), k(19.6, 1), k(20.0, 0, 'smooth')]),
    track('label', 'position', [
      k(19.4, [0.024, 0.07, 0.075], 'decelerate'),
      k(20.4, [0.004, 0.02, 0.065], 'smooth'),
    ]),
    track('label', 'rotation', [k(19.4, [0.2, -0.3, 0.25]), k(20.4, [0.05, -0.2, 0.02], 'smooth')]),

    // ---- the case: one object, from the shelf to the basket ----
    /*
     * It is never swapped for a copy in her hand. `attachTo` is a timeline channel, so
     * the same actor simply changes what it is parented to: it stands on the shelf until
     * her fingers close on it, rides her hand from there, and is set down in the basket.
     *
     * The position and rotation tracks change meaning at each switch — world coordinates
     * while it is loose, an offset in the hand's frame while it is held — so the key that
     * ends one span and the key that opens the next sit a tenth of a millisecond apart.
     * No frame can land inside that gap and read a blend of the two.
     */
    custom('case', 'attachTo', steps([[0, ''], [4.1, 'patient:grip'], [10.6, '']])),
    /*
     * Up to the demonstration the carton inside is the one the case draws for itself, so
     * it rides the case exactly however the case is turned — a separate actor tracking it
     * by keyframes ended up poking through the lid as the case was lifted and rolled.
     * From the demonstration on it is the `demoBox` actor instead, because there it has
     * to leave the case rather than stay in it.
     */
    custom('case', 'empty', steps([[0, 0], [10.6, 1]])),
    custom('case', 'open', [k(12.3, 0), k(13.2, 1, 'smooth'), k(26.4, 1)]),
    track('case', 'opacity', [
      // it dissolves out with her for the demonstration, and is back for it
      // A crossfade, not a cut to black. The case has to be switched off for a moment
      // because it jumps from her hand to the demonstration stand at 10.6 — but it used to
      // stay off for most of a second after the cabinet and she had already gone, and with
      // nothing else on stage that reads as a blank frame rather than a dissolve. It comes
      // straight back on the far side of the jump and is up to full while the camera is
      // still swinging round to it.
      k(0, 1), k(9.9, 1), k(10.55, 0, 'smooth'),
      k(10.6, 0, 'linear'), k(11.15, 1, 'smooth'), k(26.4, 1),
    ]),
    /*
     * The hand is drawn on a flat plane, so nothing it holds may cross that plane. The
     * runtime keeps the case behind it; this is only the let-go for the handover itself,
     * where the case is still standing on the shelf inside her closing fingers and does
     * cross it. It comes fully under the rule as the fingers close.
     */
    custom('case', 'clamp', [k(0, 0), k(4.1, 0, 'smooth'), k(4.6, 1, 'smooth'), k(26.4, 1)]),
    track('case', 'position', [
      k(0, BOX_ON_SHELF),
      k(4.0999, BOX_ON_SHELF, 'linear'),
      // ---- held: an offset in her hand's frame ----
      /*
       * The contact offset is where the case is *standing*, not where her hand is. The rig
       * cannot lengthen the arm, so the grip lands short of the shelf and the case is
       * caught a hand's width out towards her fingertips — which is why it reads as sitting
       * off the front of her hand at the moment it changes owners.
       *
       * It settles back into the palm over the four tenths after that, while the hand is
       * still down inside the bay and the lift is already carrying the frame. Any longer
       * and the case is out at the fingers in open shot; any shorter and the settle is a
       * jump of its own.
       */
      k(4.1, CONTACT, [0.3, 0.1, 0.3, 1]),
      k(4.6, LIFT_HOLD, 'smooth'),
      k(5.4, LIFT_HOLD, 'smooth'),
      // it drops back into the deeper hold as it turns on edge for the reader
      k(5.98, HOLD, 'smooth'),
      k(7.2, HOLD, 'smooth'),
      k(7.8, CARRY, 'smooth'),
      k(10.5999, CARRY, 'linear'),
      // ---- loose again: world coordinates ----
      k(10.6, DEMO),
      k(13.9, DEMO),
      // carried to a spot directly over the basket, then lowered straight down into it
      k(14.8, [IN_BASKET[0], IN_BASKET[1] + 0.24, IN_BASKET[2]], 'smooth'),
      k(15.6, IN_BASKET, 'decelerate'),
      k(26.4, IN_BASKET),
    ]),
    track('case', 'rotation', [
      k(0, [0, 0.2, 0]),
      k(4.0999, [0, 0.2, 0], 'linear'),
      // Nothing turns it through the pick-up. It is rigid in her hand from the moment she
      // closes on it, held exactly as it stood on the shelf, all the way out of the bay —
      // a case that rolls over between the fingers as they close reads as a prop being
      // posed. Only once it is clear does it turn flat, on the walk to the window.
      k(4.1, CONTACT_TURN),
      k(5.4, CONTACT_TURN, 'smooth'),
      /*
       * The QR is printed on the lid, so the lid has to be turned to face the reader —
       * held flat the code points at the ceiling and the beam plays over the side wall.
       *
       * She turns it as she comes out of the bay, not at the window: the turn used to run
       * to a raised pose at 7.2 and only square up to the reader at 8.6, so for the whole
       * walk across the face of the cabinet the case was carried edge-on and then rolled
       * over at the last moment. Turning it on the way out is what a person does — the
       * hand finds the reading face while the arm is still travelling — and it leaves the
       * approach to the window with nothing to do but arrive.
       */
      k(5.98, CARRY_TURN, 'smooth'),
      k(8.6, SCAN_TURN, 'smooth'),
      k(10.5999, SCAN_TURN, 'linear'),
      k(10.6, [0, 0, 0]),
    ]),
    // the table and basket are real furniture — no fade tracks, they are simply there

    // ---- the medicine itself, on stage for both demonstrations ----
    track('demoBox', 'visible', steps([
      [0, false], [10.6, true], [14.1, false], [19.6, true], [23.4, false],
    ])),
    track('demoBox', 'opacity', [
      // it used to hold full opacity until the frame it was switched off, so it popped
      // rather than left. It fades from the moment it is clear of the tray and is gone
      // well before the case starts down into the basket at 15.2 — the return is the
      // instruction here, and nothing should still be drawing the eye when it happens.
      k(10.6, 0), k(11.15, 1, 'smooth'), k(13.5, 1), k(14.0, 0, 'smooth'),
      k(19.6, 0), k(20.4, 1, 'smooth'), k(22.8, 1), k(23.4, 0, 'smooth'),
    ]),
    track('demoBox', 'position', [
      k(0, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      k(10.6, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      /*
       * It leaves with the lid, not after it. The rise used to wait until 13.6 — four
       * tenths after the lid had finished coming off — so the beat played as two separate
       * events with a hole between them. Starting it as the lid cracks makes one action of
       * it: the case opens and the medicine comes out of it.
       */
      k(12.45, [DEMO[0], DEMO[1] - 0.006, DEMO[2]]),
      // up out of the open tray, then away — the shot stays with the case, which is
      // what goes back to the basket
      k(13.4, [DEMO[0], DEMO[1] + 0.075, DEMO[2]], 'smooth'),
      k(14.1, [DEMO[0], DEMO[1] + 0.075, DEMO[2]]),
      k(14.2, CARTON),   // repositioned while invisible, ready for the apply demo
      k(26.4, CARTON),
    ]),
    track('demoBox', 'rotation', [
      // Flat in the case at the demonstration, then square to camera for the apply beat.
      // The turn between the two has to happen after it is switched off, not before: it
      // used to start at 14.2 while the carton was still up, so what read on screen was
      // the medicine tilting as it rose out of the tray.
      k(0, [-Math.PI / 2, 0, Math.PI / 2]),
      k(10.6, [-Math.PI / 2, 0, Math.PI / 2]),
      k(14.1, [-Math.PI / 2, 0, Math.PI / 2]),
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
