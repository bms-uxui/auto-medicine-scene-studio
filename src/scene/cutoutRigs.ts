/**
 * Rig descriptions for the flat Figma characters.
 *
 * Each one names the paths that make up the moving limb and the landmarks the hinge
 * needs, all in the artwork's own coordinate space. Everything else about the character
 * — proportions, colours, the object in its hand — comes from the SVG itself.
 */
export interface CutoutRigDef {
  /** the SVG's viewBox */
  art: { w: number; h: number }
  /** ids of the paths that swing with the shoulder: sleeve, arm, hand and whatever it holds */
  limbIds: string[]
  /** hinge point, in art coordinates */
  shoulder: [number, number]
  /** the thing being presented to the kiosk — what the aim actually lines up */
  grip: [number, number]
  /** fraction of the art width that sits over the actor's origin, so the feet plant */
  pivotX: number
  /** how far the limb may swing, in radians */
  swing: [number, number]
  /** angle the limb sits at with `reach` 0 — the pose it starts from and returns to */
  rest: number
  /**
   * Paths that make up everything above the waist. Given these, the figure gets a
   * second hinge so it can bend forward — reaching down into the pick-up bay reads as a
   * stoop rather than an arm stretching out of a rigid body. The limb hangs off the
   * torso, so it follows the bend.
   */
  torsoIds?: string[]
  /** hinge point for that bend, in art coordinates */
  waist?: [number, number]
  /** how far it may bend, in radians */
  bendLimit?: number
}

export const CUTOUT_RIGS: Record<string, CutoutRigDef> = {
  /**
   * Staff worker holding the refill sheet — Figma 36:400.
   *
   * The art was re-exported when the flow changed from scanning a medicine box to
   * presenting a refill sheet at the QR window: the limb now carries the sheet
   * (`Rectangle 108`), the same id the patient's prescription slip has.
   */
  staff: {
    art: { w: 484, h: 978 },
    limbIds: ['path2090', 'path2089', 'path2071', 'Rectangle 108'],
    shoulder: [205, 243],
    // the middle of the sheet, which is what has to land in the beam
    grip: [445, 352],
    pivotX: 0.417,
    swing: [-1.3, 1.0],
    // he walks in with the sheet held down at his side and lifts it to the window
    rest: -0.9,
  },
  /**
   * The same patient with an empty hand — Figma 74:4453. Used wherever a prop has to sit
   * in the hand instead of the prescription slip that the other export carries.
   */
  'patient-hand': {
    art: { w: 452, h: 977 },
    limbIds: ['path1674', 'path2071'],
    shoulder: [180, 250],
    grip: [404, 296],
    pivotX: 0.32,
    swing: [-1.2, 0.9],
    rest: -0.85,
    // head, hair, neck and torso bend at the waist; the legs stay planted
    torsoIds: ['path1672', 'path1668', 'path1669', 'path1667', 'path1671', 'path1663'],
    waist: [140, 415],
    // she really has to fold down to the shelf; the insert shot crops to the arm at
    // that moment, so a deep bend reads as reaching in rather than clipping the cabinet
    bendLimit: 1.0,
  },

  /** Patient holding a QR slip — Figma 68:401 */
  patient: {
    art: { w: 426, h: 977 },
    limbIds: ['path1674', 'path2071', 'Rectangle 108'],
    shoulder: [178, 252],
    grip: [402, 327],
    pivotX: 0.34,
    swing: [-1.2, 0.9],
    // she walks in with the slip held down at her side and lifts it to the window
    rest: -0.85,
  },
}
