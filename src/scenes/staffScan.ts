import type { SceneDef } from '../anim/types'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import { KIOSK_ANCHORS } from '../scene/Kiosk'

const A = KIOSK_ANCHORS
const FULL = A.body
const CAM = A.camera
const SCAN = A.scanner
/** framing point for the over-shoulder beat, between staff and scanner */
const HANDOFF: [number, number, number] = [A.scanner[0] - 0.2, A.scanner[1] + 0.12, A.scanner[2] + 0.18]

/**
 * Staff flow, following the Figma storyboard (node 21:351):
 * Camera Position 7 -> Camera Position 8 -> Scan Barcode 1 -> 2 -> 3 -> Complete.
 * The staff member is the flat Figma illustration, billboarded into the scene.
 */
export const staffScan: SceneDef = {
  id: 'staff-scan-barcode',
  name: 'Staff · Scan Barcode',
  duration: 11.5,
  fps: 30,
  size: [1080, 683],
  background: '#ffffff',
  camera: { position: shot(FULL, DIST.wide, 35, 13), target: FULL, fov: FOV },
  actors: [
    { id: 'kiosk', kind: 'kiosk', label: 'Kiosk', position: [0, 0, 0] },
    {
      id: 'staff',
      kind: 'puppet',
      label: 'Staff (2D rig)',
      url: '/textures/actors/staff.svg',
      position: [-0.1, 0, 1.15],
      visible: false,
      // the Figma group (36:400) includes the outstretched arm and the medicine box, so
      // the body sits left of the art's centre
      params: { height: 1.78, tilt: 0.7, rig: 'staff' },
    },
  ],
  tracks: [
    // ---- shot list ----
    // The opening barely holds: long enough to read the machine, short enough that the
    // first step starts almost straight away. Every beat after that gets time to land.
    track('camera', 'position', [
      k(0.0, shot(FULL, DIST.wide, 35, 13)),                    // 1 · Camera Position 7
      k(0.4, shot(FULL, DIST.wide, 35, 13)),
      k(1.6, shot(CAM, DIST.mid, 30, 12), 'smooth'),            // 2 · Camera Position 8
      k(2.4, shot(CAM, DIST.close, 26, 8), 'standard'),
      k(4.0, shot(CAM, DIST.close, 26, 8)),                     // hold on the face scan
      k(5.2, shot(SCAN, DIST.close, 34, 10), 'smooth'),         // 3 · Scan Barcode 1
      k(7.0, shot(HANDOFF, DIST.close + 0.3, 44, 8), 'smooth'), // 4 · Scan Barcode 2
      k(9.0, shot(SCAN, DIST.close, 40, 9), 'smooth'),          // 5 · Scan Barcode 3
      // 6 · Complete — the confirmation lands on the same framing as the scan, so the
      // shot stays where the action was instead of pulling back to an empty wide
      k(11.5, shot(SCAN, DIST.close, 40, 9)),
    ]),
    track('target', 'position', [
      k(0.0, FULL),
      k(0.4, FULL),
      k(1.6, CAM, 'smooth'),
      k(4.0, CAM),
      k(5.2, SCAN, 'smooth'),
      k(7.0, HANDOFF),
      k(9.0, SCAN, 'smooth'),
      k(11.5, SCAN),
    ]),
    custom('camera', 'fov', [k(0, FOV), k(0.4, FOV), k(2.4, 26, 'smooth'), k(9.0, 24), k(11.5, 24)]),

    // ---- kiosk states ----
    custom('kiosk', 'screenState', steps([
      [0, 'welcome'], [0.8, 'selectRole'], [2.0, 'faceScan'], [4.6, 'scanBarcode'], [8.2, 'addMedicine'], [9.6, 'addMedicineDone'],
    ])),

    custom('kiosk', 'cameraGlow', [k(1.9, 0), k(2.6, 1, 'decelerate'), k(3.8, 0.4), k(4.4, 0)]),
    custom('kiosk', 'scanGlow', [k(5.6, 0), k(6.6, 1, 'decelerate'), k(9.2, 0.9), k(9.6, 0, 'accelerate')]),

    // ---- staff (2D billboard, Figma 36:400) ----
    track('staff', 'visible', steps([[0, false], [4.2, true]])),
    // he stops clear of the cabinet — the arm is aimed in screen space, so the box
    // still lines up with the scanner without the art having to intersect the kiosk
    track('staff', 'position', [
      // starts outside the frame on the left and walks in; fading him up inside the
      // shot made it look like he materialised out of the cabinet
      k(4.2, [-1.55, 0, 1.95]),
      k(6.9, [0.2, 0, 1.0], 'smooth'),
      k(11.5, [0.2, 0, 1.0]),
    ]),
    track('staff', 'opacity', [k(4.2, 1), k(11.5, 1)]),
    // a strongly camera-aligned board leans into the cabinet, so keep the tilt low
    custom('staff', 'tilt', [k(4.2, 0.3), k(6.6, 0.45, 'smooth'), k(11.5, 0.45)]),
    // the arm hinges up to hold the box in the beam, dwells there, then drops back
    track('staff', 'reach', [
      k(5.4, 0), k(6.8, 1, 'decelerate'), k(11.5, 1),
    ]),
    custom('staff', 'reachTarget', [k(0, [SCAN[0], SCAN[1] - 0.06, SCAN[2] + 0.12])]),
  ],
  markers: [
    { t: 1.6, label: 'camera callout' },
    { t: 5.2, label: 'scan barcode' },
    { t: 9.6, label: 'complete' },
  ],
  steps: [
    { id: 'camera', label: 'ตำแหน่ง\nกล้อง', labelEn: 'Camera\nPlacement', icon: 'camera', t0: 0, t1: 4.6 },
    { id: 'barcode', label: 'สแกน\nบาร์โค้ด', labelEn: 'Scan\nBarcode', icon: 'barcode', t0: 4.6, t1: 11.5 },
  ],
  captions: [
    { t0: 1.9, t1: 4.3, text: 'มองกล้องเพื่อยืนยันตัวตนเจ้าหน้าที่', textEn: 'Look at the camera to verify staff identity' },
    { t0: 5.8, t1: 9.4, text: 'สแกนบาร์โค้ดยาก่อนเติมเข้าตู้', textEn: 'Scan the medicine barcode before loading' },
    { t0: 9.8, t1: 11.4, text: 'สแกนสำเร็จ เติมยาเข้าตู้ได้เลย', textEn: 'Scanned — the medicine is ready to load' },
  ],
  success: [{ t0: 9.6, t1: 11.5 }],
}
