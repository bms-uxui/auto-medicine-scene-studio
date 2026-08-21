import type { SceneDef } from '../anim/types'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import { KIOSK_ANCHORS } from '../scene/Kiosk'

/**
 * Rework of Patient_Scan_QR.gif / Patient-ScanOrderQRCode_ENG.gif (8.2s, 76 frames).
 * Beats: establish kiosk -> highlight camera -> patient approaches -> scan QR -> success -> pull out.
 */
// staging anchors follow the kiosk layout, so a different wrap restages the shots
const A = KIOSK_ANCHORS
const FULL = A.body
const CAM = A.camera
const SCAN = A.scanner
/** where the patient's hand and the slip meet the scanner window */
const REACH: [number, number, number] = [A.scanner[0], A.scanner[1], A.scanner[2] + 0.08]

export const patientScanQr: SceneDef = {
  id: 'patient-scan-qr',
  name: 'Patient · Scan QR',
  duration: 8.2,
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
      position: [-0.55, 0, 1.5],
      rotation: [0, 3.0, 0],
      scale: 1,
      params: { height: 1.68 },
    },
    { id: 'qrCard', kind: 'prop', primitive: 'qrCard', label: 'QR slip', position: [0.2, 1.05, 0.7], visible: false },
  ],
  tracks: [
    // camera: wide establish -> push in on the camera module -> settle on the scanner -> pull back
    // shot list: establish wide -> push to the camera bar -> over-shoulder on the scanner -> back out
    track('camera', 'position', [
      k(0.0, shot(FULL, DIST.wide, 35, 13), 'decelerate'),
      k(1.2, shot(CAM, DIST.mid, 26, 8), 'standard'),
      k(2.4, shot(CAM, DIST.close, 30, 8), 'standard'),
      k(3.6, shot(SCAN, DIST.close + 0.8, 52, 12), 'smooth'),
      k(6.2, shot(SCAN, DIST.close + 0.6, 50, 11), 'standard'),
      k(7.2, shot(FULL, DIST.wide, 35, 13), 'standard'),
    ]),
    track('target', 'position', [
      k(0.0, FULL),
      k(1.2, CAM),
      k(2.4, CAM),
      k(3.6, SCAN),
      k(6.2, SCAN),
      k(7.2, FULL),
    ]),
    custom('camera', 'fov', [k(0, FOV), k(2.4, 26), k(7.2, FOV)]),

    // kiosk states
    custom('kiosk', 'screenState', steps([[0, 'welcome'], [1.6, 'selectRole'], [3.0, 'scanQR'], [6.0, 'medicineList']])),
    custom('kiosk', 'cameraGlow', [k(1.3, 0), k(1.8, 1, 'decelerate'), k(2.6, 0.35), k(3.2, 0)]),
    custom('kiosk', 'scanGlow', [k(3.2, 0), k(3.6, 1, 'decelerate'), k(5.8, 0.85), k(6.0, 0.1, 'accelerate')]),

    // patient: walks in, presents the slip, steps back
    track('patient', 'position', [
      k(2.2, [-0.55, 0, 1.5], 'decelerate'),
      k(3.4, [0.16, 0, 1.02], 'standard'),
      k(6.6, [0.16, 0, 1.02]),
      k(7.4, [-0.45, 0, 1.45], 'accelerate'),
    ]),
    track('patient', 'clip', steps([[0, 'walk'], [3.4, 'idle'], [7.0, 'walk']])),
    track('patient', 'reach', [k(3.4, 0), k(4.0, 0.85, 'decelerate'), k(5.9, 0.85), k(6.4, 0, 'accelerate')]),
    custom('patient', 'reachTarget', [k(0, REACH)]),

    // QR slip follows the hand into the scanner window
    track('qrCard', 'visible', steps([[0, false], [3.3, true], [6.6, false]])),
    track('qrCard', 'position', [
      k(3.3, [0.16, 1.0, 0.95], 'decelerate'),
      k(4.1, [REACH[0], REACH[1] + 0.01, REACH[2] + 0.03], 'smooth'),
      k(5.9, [REACH[0], REACH[1] + 0.01, REACH[2] + 0.02]),
      k(6.5, [0.2, 1.0, 0.9], 'accelerate'),
    ]),
    track('qrCard', 'rotation', [k(3.3, [0, 0.5, 0.2]), k(4.1, [0.1, 0.05, 0], 'smooth')]),
  ],
  markers: [
    { t: 1.3, label: 'camera highlight' },
    { t: 3.4, label: 'reach scanner' },
    { t: 6.0, label: 'scan success' },
  ],
  steps: [
    { id: 'camera', label: 'ตำแหน่งกล้อง', labelEn: 'Camera Placement', icon: 'camera', t0: 0, t1: 3.1 },
    { id: 'scan', label: 'สแกนคิวอาร์โค้ด', labelEn: 'Scan QR Code', icon: 'qr', t0: 3.1, t1: 7.0 },
  ],
  captions: [
    { t0: 3.4, t1: 5.9, text: 'ยื่นคิวอาร์โค้ดที่ช่องสแกน', textEn: 'Hold the QR code up to the scanner' },
    { t0: 6.0, t1: 7.2, text: 'ยืนยันสำเร็จ', textEn: 'Verified' },
  ],
}
