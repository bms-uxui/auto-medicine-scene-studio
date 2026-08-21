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
  duration: 7.2,
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
      params: { height: 1.78, tilt: 0.7, pivotX: 0.393 },
    },
  ],
  tracks: [
    // ---- shot list ----
    track('camera', 'position', [
      k(0.0, shot(FULL, DIST.wide, 35, 13), 'decelerate'),      // 1 · Camera Position 7
      k(1.3, shot(CAM, DIST.mid, 30, 12), 'standard'),          // 2 · Camera Position 8
      k(2.6, shot(CAM, DIST.close, 26, 8), 'standard'),
      k(3.4, shot(SCAN, DIST.close, 34, 10), 'smooth'),         // 3 · Scan Barcode 1
      k(4.4, shot(HANDOFF, DIST.close + 0.3, 44, 8), 'smooth'), // 4 · Scan Barcode 2
      k(5.6, shot(SCAN, DIST.close, 40, 9), 'standard'),        // 5 · Scan Barcode 3
      k(6.2, shot(FULL, DIST.wide, 35, 13), 'standard'),        // 6 · Complete
    ]),
    track('target', 'position', [
      k(0.0, FULL),
      k(1.3, CAM),
      k(2.6, CAM),
      k(3.4, SCAN),
      k(4.4, HANDOFF),
      k(5.6, SCAN),
      k(6.2, FULL),
    ]),
    custom('camera', 'fov', [k(0, FOV), k(2.6, 26), k(5.6, 24), k(6.2, FOV)]),

    // ---- kiosk states ----
    custom('kiosk', 'screenState', steps([
      [0, 'welcome'], [1.0, 'selectRole'], [1.8, 'faceScan'], [3.0, 'scanBarcode'], [4.8, 'addMedicine'], [6.1, 'addMedicineDone'],
    ])),
    custom('kiosk', 'cameraGlow', [k(1.3, 0), k(1.8, 1, 'decelerate'), k(2.4, 0.35), k(3.0, 0)]),
    custom('kiosk', 'scanGlow', [k(3.6, 0), k(4.4, 1, 'decelerate'), k(5.8, 0.9), k(6.0, 0.1, 'accelerate')]),

    // ---- staff (2D billboard, Figma 36:400) ----
    track('staff', 'visible', steps([[0, false], [3.3, true], [6.6, false]])),
    // he stops clear of the cabinet — the arm is aimed in screen space, so the box
    // still lines up with the scanner without the art having to intersect the kiosk
    track('staff', 'position', [
      k(3.3, [-0.3, 0, 1.45], 'decelerate'),
      k(4.3, [0.24, 0, 0.9], 'standard'),
      k(5.9, [0.24, 0, 0.9]),
      k(6.5, [-0.25, 0, 1.4], 'accelerate'),
    ]),
    track('staff', 'opacity', [k(3.3, 0), k(3.7, 1, 'decelerate'), k(6.2, 1), k(6.6, 0, 'accelerate')]),
    // the art leans with the shot: nearly upright when wide, camera-aligned up close
    // a strongly camera-aligned board leans into the cabinet, so keep the tilt low
    custom('staff', 'tilt', [k(3.3, 0.3), k(4.4, 0.45, 'smooth'), k(6.0, 0.35)]),
    // the arm hinges up to hold the box in the scanner beam, then drops back
    track('staff', 'reach', [
      k(3.6, 0), k(4.4, 1, 'decelerate'), k(5.9, 1), k(6.3, 0, 'accelerate'),
    ]),
    custom('staff', 'reachTarget', [k(0, [SCAN[0], SCAN[1] + 0.02, SCAN[2] + 0.12])]),
  ],
  markers: [
    { t: 1.3, label: 'camera callout' },
    { t: 3.4, label: 'scan barcode' },
    { t: 6.0, label: 'complete' },
  ],
  steps: [
    { id: 'camera', label: 'ตำแหน่งกล้อง', labelEn: 'Camera Placement', icon: 'camera', t0: 0, t1: 2.9 },
    { id: 'barcode', label: 'สแกนบาร์โค้ด', labelEn: 'Scan Barcode', icon: 'barcode', t0: 2.9, t1: 7.2 },
  ],
  captions: [
    { t0: 1.5, t1: 2.8, text: 'มองกล้องเพื่อยืนยันตัวตนเจ้าหน้าที่', textEn: 'Look at the camera to verify staff identity' },
    { t0: 3.6, t1: 5.8, text: 'สแกนบาร์โค้ดยาก่อนเติมเข้าตู้', textEn: 'Scan the medicine barcode before loading' },
  ],
  success: [{ t0: 6.0, t1: 7.0 }],
}
