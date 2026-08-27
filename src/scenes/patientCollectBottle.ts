import type { ActorDef, SceneDef, Vec3 } from '../anim/types'
import type { Ease } from '../anim/easing'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import { A, BASKET, DEMO, DOOR, FULL, READ, SCAN, SLOT, TABLE } from './collectCommon'

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
 *   9.8-12.3  the sticker prints at the middle slot; she watches it feed
 *  12.3-15.1  dissolve to the bottle; the sticker is pressed onto it
 *  15.1-18.5  back at the cabinet; the screen confirms the whole order is done
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

/**
 * What the printing beat frames. Not the slot on its own: pulled a little towards her and
 * down, so she is in the shot watching it rather than cut in half by the left edge.
 */
const SLOT_VIEW: [number, number, number] = [SLOT[0] - 0.08, SLOT[1] - 0.1, SLOT[2]]

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
const CONTACT: [number, number, number] = [0.1069, -0.0232, -0.0477]
const CONTACT_TURN: [number, number, number] = [0.8189, -0.5741, 1.0793]
/**
 * Where it ends up sitting in her hand once it is out. In the middle of the palm, not out
 * at the fingertips: the grip is the centre of the drawn fist, so an offset this far out
 * along the hand hung the bottle off the ends of her fingers for the whole carry. Depth is
 * left shallow on purpose — the runtime keeps it behind the plane the hand is drawn on.
 */
const CARRY: [number, number, number] = [0.062, -0.012, -0.03]
const CARRY_TURN: [number, number, number] = [0.05, -0.3, 0.75]

/**
 * What her hand is aimed at during the grab. The grip lands a little short along the line
 * from the shoulder, so the aim is carried just above the bottle to bring the fingers
 * level with it.
 */
const GRAB_AIM: [number, number, number] = [ON_SHELF[0], ON_SHELF[1] + 0.02, ON_SHELF[2]]

/**
 * Where the aim sits while the arm is still travelling. The arm swings about the shoulder
 * on a fixed radius, so on the way in it sweeps across the shelf rather than towards it —
 * and the bottle stands ten centimetres tall, so a hand coming in level with the aim
 * crosses it. Coming in high keeps the fist above the cap and lets it settle onto the
 * bottle at the end, which is also how a hand reaches for something standing on a shelf.
 */
const APPROACH_AIM: [number, number, number] = [GRAB_AIM[0], GRAB_AIM[1] + 0.1, GRAB_AIM[2]]
/**
 * Out of the bay before up. Whatever she holds rides behind the fist, so a hand that goes
 * straight up from the shelf takes the bottle up the inside of the front panel, where it
 * is hidden for the whole lift. This draws the hand out of the mouth of the bay first.
 */
const OUT_AIM: [number, number, number] = [GRAB_AIM[0], GRAB_AIM[1] + 0.05, GRAB_AIM[2] + 0.17]
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
  ]
}

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
const PUSH_T1 = 3.2
const PUSH_DIST = 0.82
const PUSH_STEPS = 28
const push = Array.from({ length: PUSH_STEPS + 1 }, (_, i) => {
  const v = i / PUSH_STEPS
  // starts and arrives at rest; everything between runs at a near-constant zoom rate
  const u = v * v * (3 - 2 * v)
  return {
    t: +(PUSH_T0 + (PUSH_T1 - PUSH_T0) * v).toFixed(3),
    // the frame settles from the whole cabinet onto the open bay, then onto the bottle
    target: u < 0.5 ? mix(FULL, DOOR, u * 2) : mix(DOOR, ON_SHELF, (u - 0.5) * 2),
    dist: DIST.wide * Math.pow(PUSH_DIST / DIST.wide, u),
    // the last key's easing governs the hold that follows it, not the push
    ease: (i === PUSH_STEPS ? 'smooth' : 'linear') as Ease,
  }
})

/**
 * And the pull back out, built the same way as the push.
 *
 * It starts while she is still reaching, not once she has hold of the bottle: the
 * handover happens at 4.6, and a frame that is already widening at that moment reads as a
 * person taking something off a shelf rather than as a prop changing hands.
 *
 * Distance grows by a constant ratio so the apparent zoom rate stays even, every key is
 * linear except the last, and the bay stays centred while the camera swings round to her
 * right — pulling straight back onto her puts her shoulder across the frame.
 */
const PULL_T0 = 4.3
const PULL_T1 = 6.2
const PULL_STEPS = 24
/**
 * How far out it gets. The pull used to start at 3.25, a second and a third before the
 * handover, on the theory that the weakest frame in the scene is a prop changing owners
 * and the defence is not to be looking closely when it happens. What it actually bought
 * was a pick-up played out in a wide shot: by the time her hand reached the shelf the bay
 * was a stamp in the corner of the frame and nothing about the grab could be read. It now
 * starts three tenths before the handover, as the boxed flow's does — moving on the frame
 * that matters, but from the tight framing rather than well outside it.
 */
const PULL_DIST = 2.62
/** where the frame ends up: the open bay, lifted for the arm coming up out of it */
const PULL_HIGH: Vec3 = [DOOR[0], DOOR[1] + 0.16, DOOR[2]]
/**
 * What the frame follows on the way up. Below the hand's own aim: the bottle hangs under
 * the fist rather than sitting in it, so a frame centred on where the hand is going drops
 * the bottle off its bottom edge for the whole lift.
 */
const LIFT_VIEW: Vec3 = [LIFT_AIM[0], LIFT_AIM[1] - 0.06, LIFT_AIM[2]]
const pull = Array.from({ length: PULL_STEPS + 1 }, (_, i) => {
  const v = i / PULL_STEPS
  // even, not front-loaded: at this size a `standard` puts a third of the move into its
  // first two tenths, which reads as a lurch and then a crawl
  const u = v * v * (3 - 2 * v)
  return {
    t: +(PULL_T0 + (PULL_T1 - PULL_T0) * v).toFixed(3),
    // it follows the lift out of the bay first, then settles on the open bay itself
    target: u < 0.45 ? mix(ON_SHELF, LIFT_VIEW, u / 0.45) : mix(LIFT_VIEW, PULL_HIGH, (u - 0.45) / 0.55),
    dist: PUSH_DIST * Math.pow(PULL_DIST / PUSH_DIST, u),
    yaw: 34.6 + (36 - 34.6) * u,
    pitch: 13 + (12 - 13) * u,
    ease: (i === PULL_STEPS ? 'smooth' : 'linear') as Ease,
  }
})

export const patientCollectBottle: SceneDef = {
  id: 'patient-collect-bottle',
  name: 'Patient · Collecting Medicine (no case)',
  duration: 18.5,
  fps: 30,
  size: [1080, 683],
  background: '#ffffff',
  camera: { position: shot(FULL, DIST.wide, 35, 13), target: FULL, fov: FOV },
  actors: bottleActors(),
  tracks: [
    // ---- shot list ----
    track('camera', 'position', [
      k(0, shot(FULL, DIST.wide, 35, 13)),
      // one continuous push into the bay — see `push` above. It is settled on the bottle by 3.2
      // and all but parked until she has hold of it: the rig aims her hand in screen space
      // and locks that aim half a second after the reach stops changing, so a camera still
      // moving through the grab leaves the hand grasping at thin air.
      ...push.map((s) => k(s.t, shot(s.target, s.dist, 34.6, 13), s.ease)),
      // a beat at the tightest framing while her hand comes into the bay, then straight
      // back out again under the grab — see `pull` above
      ...pull.map((s) => k(s.t, shot(s.target, s.dist, s.yaw, s.pitch), s.ease)),
      /*
       * Then back onto her, and across the cabinet face to the window. This used to be one
       * tenth of a second after the pull's last key, which asked the camera to cross most
       * of a metre and fourteen degrees of yaw in three frames — the pull ran out and the
       * frame snapped. The pull now finishes at 6.2, closer to where this shot starts, and
       * has half a second to get there.
       */
      k(7.2, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(7.5, shot(FRONT_WIDE, 2.9, 28, 10), 'smooth'),
      k(8.0, shot(SCAN, 2.0, 40, 9), 'smooth'),
      k(9.8, shot(SCAN, 1.72, 40, 9), 'smooth'),                  // slow push while it reads
      k(10.8, shot(SLOT_VIEW, 1.95, 34, 10), 'smooth'),           // 2 · Collecting Sticker
      // She does not take it. There is nothing to take it out of — the sticker is the
      // demonstration's subject, and reaching for it only to have it dissolve out of her
      // hand a second later was a move that led nowhere. The shot creeps in on the slot
      // while it prints and then dissolves straight to the demonstration.
      k(12.5, shot(SLOT_VIEW, 1.72, 34, 10), 'smooth'),
      // 3 · Applying Sticker — the sticker carries the shot from the slot to the staging
      k(13.3, shot(STAGE, 0.64, 0, 0), 'smooth'),
      // the demonstration is over when the sticker is down; it used to sit on a finished
      // frame for the best part of a second before anything moved again
      k(15.1, shot(STAGE, 0.58, 0, 0), 'smooth'),
      // the cabinet dissolves back in as the camera pulls out onto the screen
      k(16.2, shot(SCREEN_VIEW, 1.15, 16, 5), 'smooth'),
      k(18.5, shot(SCREEN_VIEW, 0.95, 10, 3)),
    ]),
    track('target', 'position', [
      k(0, FULL),
      ...push.map((s) => k(s.t, s.target, s.ease)),
      ...pull.map((s) => k(s.t, s.target, s.ease)),
      k(7.2, FRONT_WIDE, 'smooth'),
      k(7.5, FRONT_WIDE),
      k(8.0, SCAN, 'smooth'),
      k(9.8, SCAN),
      k(10.8, SLOT_VIEW, 'smooth'),
      k(12.5, SLOT_VIEW),
      k(13.3, STAGE, 'smooth'),
      k(15.1, STAGE),
      k(16.2, SCREEN_VIEW, 'smooth'),
      k(18.5, SCREEN_VIEW),
    ]),
    custom('camera', 'fov', [
      // held through the push: a focal length changing under a dolly is a second move on
      // top of the first, and they do not cancel
      k(0, 23), k(4.3, 23), k(6.2, 23, 'smooth'), k(7.2, 24, 'smooth'), k(7.5, 24),
      k(8.0, 22, 'smooth'), k(9.8, 22), k(10.8, 22, 'smooth'), k(12.5, 23, 'smooth'),
      k(13.3, 24, 'smooth'), k(15.1, 24), k(16.2, 22, 'smooth'), k(18.5, 22),
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
    custom('kiosk', 'scanReach', [k(0, 0.34), k(8.6, 0.34), k(9.2, 0.30, 'decelerate'), k(18.5, 0.30)]),
    custom('kiosk', 'scanSpread', [k(0, 0.1), k(8.6, 0.1), k(9.2, 0.19, 'decelerate'), k(18.5, 0.19)]),
    custom('kiosk', 'scanTilt', [k(0, 0.16), k(8.6, 0.16), k(9.2, -0.26, 'smooth'), k(18.5, -0.26)]),
    // it stays hanging out of the slot and goes with the cabinet, rather than being
    // drawn back in behind a hand that is no longer reaching for it
    custom('kiosk', 'stickerFeed', [k(9.8, 0), k(11.4, 1, 'decelerate'), k(12.5, 1)]),
    // the cabinet dissolves away for the applying demonstration and comes back after it
    track('kiosk', 'opacity', [
      k(0, 1), k(11.8, 1), k(12.5, 0, 'smooth'), k(15.1, 0), k(16.0, 1, 'smooth'), k(18.5, 1),
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
      k(18.5, AT_FRONT),
    ]),
    // she fades out with the cabinet: what is left on screen is the bottle alone
    track('patient', 'opacity', [
      k(1.4, 1), k(11.8, 1), k(12.5, 0, 'smooth'), k(15.1, 0), k(16.0, 1, 'smooth'), k(18.5, 1),
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
      k(5.3, 0.08, 'smooth'), k(6.5, 0.45, 'smooth'), k(18.5, 0.45),
    ]),
    // into the bay -> up to the scan window -> down while the sticker prints -> up to
    // the slot -> resting on the bottle
    track('patient', 'reach', [
      /*
        * The grab, phrased the way a hand actually moves: the arm leaves rest, covers most
        * of the distance, then crawls the last few centimetres onto the bottle. It holds
        * dead still from 4.15 to 5.05 — the beat where the fingers close before anything
        * lifts, and long enough for the rig to lock its screen-space aim before the
        * bottle moves.
        *
        * One span, not two: an `accelerate` arriving at full speed into a `decelerate`
        * leaving at full speed made the join at 3.9 a step in velocity, and the arm
        * lurched through it.
        */
      k(1.4, 0), k(3.0, 0, 'standard'),
      k(4.15, 1, 'smooth'),
      k(5.4, 1, 'smooth'),
      k(5.9, 0.6, 'smooth'), k(6.6, 0.35, 'smooth'), k(7.4, 0.35), k(8.4, 1, 'smooth'), k(9.8, 1),
      // she does not drop her arm to her side while the sticker prints: at this framing
      // that put her hand and the bottle below the bottom edge and left her cut off in the
      // corner of the frame. She holds the bottle where she can see it and waits.
      k(10.4, 0.42, 'smooth'), k(12.5, 0.42),
      k(12.7, 0.55, 'smooth'), k(18.5, 0.55),
    ]),
    custom('patient', 'bend', [
      /*
       * A light lean, not a fold: the shelf is at waist height, and a full bend swings the
       * whole arm down with the torso, well under it. The lean leads the arm on the way in
       * and leads it back up on the way out.
       *
       * It leaves rest on a `smooth`, not a `decelerate`: `decelerate` starts at full
       * speed, so the torso took a third of the lean in the first two frames.
       */
      k(3.0, 0, 'smooth'),
      k(3.95, 0.88, 'smooth'),
      k(5.4, 0.88, 'smooth'),
      k(6.2, 0, 'smooth'), k(18.5, 0),
    ]),
    custom('patient', 'reachTarget', [
      k(0, APPROACH_AIM),
      // it comes down onto the bottle over the last stretch of the reach and is settled on
      // it before the handover, so the rig has the aim it was solved against by then
      k(4.0, APPROACH_AIM, 'smooth'),
      k(4.4, GRAB_AIM, 'smooth'),
      // she holds the aim through the contact beat, then lifts — the hand rises and takes
      // the bottle with it, which is the whole point of handing it over on the shelf
      k(4.7, GRAB_AIM, 'standard'),
      k(5.0, OUT_AIM, 'smooth'),
      k(5.4, LIFT_AIM, 'smooth'),
      k(5.9, LIFT_AIM),
      k(7.2, READ_HIGH, 'smooth'),
      k(12.5, READ_HIGH),
      k(12.7, READ, 'smooth'),
      k(18.5, READ),
    ]),

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
    custom('bottle', 'attachTo', steps([[0, ''], [4.6, 'patient:grip'], [12.6, '']])),
    /*
     * Nothing she holds may cross the plane her hand is drawn on; the runtime enforces it.
     * This is the let-go for the handover itself, where the bottle is still standing on the
     * shelf inside her closing fingers and does cross it.
     */
    custom('bottle', 'clamp', [k(0, 0), k(4.6, 0, 'smooth'), k(5.1, 1, 'smooth'), k(18.5, 1)]),
    track('bottle', 'opacity', [
      k(0, 1), k(11.8, 1), k(12.5, 0, 'smooth'),
      k(12.9, 0), k(13.5, 1, 'smooth'), k(18.5, 1),
    ]),
    track('bottle', 'position', [
      k(0, ON_SHELF),
      k(4.5999, ON_SHELF, 'linear'),
      // ---- held: an offset in her hand's frame ----
      k(4.6, CONTACT),
      k(4.7, CONTACT, 'smooth'),
      k(5.4, CARRY, 'smooth'),
      k(12.5999, CARRY, 'linear'),
      // ---- loose again: world coordinates, staged for the applying demonstration ----
      k(12.6, STAGE),
      k(18.5, STAGE),
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
      k(12.5999, [0.05, -0.05, 0.06], 'linear'),
      k(12.6, [0, -0.14, 0]),
    ]),

    // ---- demonstration: peel the sticker off its backing and press it on the bottle ----
    track('demoLabel', 'visible', steps([[0, false], [12.7, true], [15.5, false]])),
    track('demoLabel', 'opacity', [k(12.7, 0), k(13.3, 1, 'smooth'), k(15.0, 1), k(15.5, 0, 'smooth')]),
    custom('demoLabel', 'curl', [k(13.1, 1), k(13.9, 0.7, 'smooth'), k(14.6, 0.04, 'smooth'), k(14.8, 0)]),
    track('demoLabel', 'position', [
      /*
       * It lands on the orange glass above the printed label, not on the label itself.
       * The sticker is white and the bottle already carries a white block through its
       * middle, so pressed on there it disappeared into it: the beat played, and what was
       * on screen was a bottle that did not change. It also comes in from twice as far
       * off the glass, so the press is a move rather than a nudge.
       */
      k(12.7, [STAGE[0] + 0.01, STAGE[1] + 0.062, STAGE[2] + 0.115], 'smooth'),
      k(13.9, [STAGE[0] + 0.004, STAGE[1] + 0.042, STAGE[2] + 0.07], 'smooth'),
      k(14.6, [STAGE[0] + 0.004, STAGE[1] + 0.034, STAGE[2] + 0.0272], 'decelerate'),
      k(14.8, [STAGE[0] + 0.004, STAGE[1] + 0.034, STAGE[2] + 0.0272]),
    ]),
    track('demoLabel', 'rotation', [
      k(12.7, [0.28, -0.22, 0.12], 'smooth'),
      k(14.6, [0, -0.14, 0], 'smooth'),
    ]),
  ],
  markers: [
    { t: 1.6, label: 'pick-up bay' },
    { t: 4.8, label: 'bottle taken' },
    { t: 9.2, label: 'QR on the bottle scanned' },
    { t: 11.4, label: 'sticker printed' },
    { t: 14.8, label: 'sticker applied' },
    { t: 16.9, label: 'order complete' },
  ],
  steps: [
    { id: 'collect', label: 'รับยา', labelEn: 'Collecting\nMedicine', icon: 'box', t0: 0, t1: 9.8 },
    { id: 'sticker', label: 'รับสติ๊กเกอร์', labelEn: 'Collecting\nSticker', icon: 'sticker', t0: 9.8, t1: 12.3 },
    { id: 'apply', label: 'แปะสติ๊กเกอร์', labelEn: 'Applying\nSticker', icon: 'apply', t0: 12.3, t1: 18.5 },
  ],
  captions: [
    { t0: 1.6, t1: 2.6, text: 'ช่องรับยาอยู่บริเวณนี้', textEn: 'The pick-up slot is located here' },
    { t0: 2.8, t1: 4.9, text: 'กรุณาหยิบยาออกจากช่องรับยา', textEn: 'Please take the medicine from the pick-up slot' },
    { t0: 6.3, t1: 7.4, text: 'ยาที่ใส่กล่องไม่ได้ จะมีคิวอาร์โค้ดติดอยู่ที่ตัวยา', textEn: 'Medicine that will not fit a case carries its QR code on the item itself' },
    { t0: 7.8, t1: 9.6, text: 'กรุณาสแกนคิวอาร์โค้ดที่ช่องสแกนด้านขวา', textEn: 'Scan the QR code at the window on the right' },
    { t0: 10.0, t1: 11.9, text: 'ระบบกำลังพิมพ์สติกเกอร์ยาที่ช่องสติกเกอร์', textEn: 'The medicine sticker is being printed at the sticker slot' },
    { t0: 13.1, t1: 15.0, text: 'กรุณาแปะสติกเกอร์ลงบนขวดยา', textEn: 'Please apply the sticker to the bottle' },
    { t0: 16.7, t1: 18.1, text: 'รับยาครบทุกรายการเรียบร้อย', textEn: 'All items in the order have been collected' },
  ],
  success: [{ t0: 16.9, t1: 18.1 }],
}
