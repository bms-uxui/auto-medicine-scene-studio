import type { SceneDef } from '../anim/types'
import { DIST, FOV, custom, k, shot, steps, track } from './dsl'
import { KIOSK_ANCHORS } from '../scene/Kiosk'

/**
 * Rework of Patient_Scan_QR.gif / Patient-ScanOrderQRCode_ENG.gif.
 * Beats: establish kiosk -> call out where the scan window is -> patient walks in ->
 * holds the prescription slip up to it -> confirmation.
 *
 * The first step is a location callout, not a face check: the point is to show the user
 * where the scan camera sits on the cabinet, matching the original GIF's zoom on it.
 *
 * Same treatment as the staff flow: the patient is the Figma vector art (68:401) split
 * into a body and a hinged limb, aimed at the scanner in screen space; she walks in from
 * off-frame rather than fading up, and the shot stays on the scan for the confirmation.
 */
const A = KIOSK_ANCHORS
const FULL = A.body
const SCAN = A.scanner
/** where the QR slip has to land, just clear of the scanner window */
const REACH: [number, number, number] = [SCAN[0], SCAN[1] - 0.04, SCAN[2] + 0.12]

export const patientScanQr: SceneDef = {
  id: 'patient-scan-qr',
  name: 'Patient · Scan QR',
  duration: 11.5,
  fps: 30,
  size: [1080, 683],
  background: '#ffffff',
  camera: { position: shot(FULL, DIST.wide, 35, 13), target: FULL, fov: FOV },
  actors: [
    {
      // the room the machine stands in — see `HospitalLobby`. First in the cast so it is
      // built before anything that has to sit in front of it.
      id: 'lobby',
      kind: 'prop',
      primitive: 'hospitalLobby',
      label: 'Hospital lobby',
      position: [0, 0, 0],
    },
    { id: 'kiosk', kind: 'kiosk', label: 'Kiosk', position: [0, 0, 0] },
    {
      id: 'patient',
      kind: 'puppet',
      label: 'Patient (2D rig)',
      url: '/textures/actors/patient.svg',
      position: [-1.5, 0, 1.95],
      visible: false,
      params: { height: 1.68, tilt: 0.7, rig: 'patient' },
    },
  ],
  tracks: [
    // ---- shot list ----
    // barely holds on the establisher, then every beat after it gets time to land
    track('camera', 'position', [
      k(0.0, shot(FULL, DIST.wide, 35, 13)),
      k(0.4, shot(FULL, DIST.wide, 35, 13)),
      k(1.6, shot(SCAN, DIST.close, 32, 12), 'smooth'),       // where the scan window is
      k(2.6, shot(SCAN, 1.45, 30, 8), 'standard'),            // right in on the window
      k(4.2, shot(SCAN, 1.45, 30, 8)),                        // hold on the callout
      k(5.2, shot(SCAN, DIST.close, 34, 10), 'smooth'),       // widen for the approach
      k(7.0, shot(REACH, DIST.close + 0.3, 44, 8), 'smooth'), // over-shoulder on the slip
      k(9.0, shot(SCAN, DIST.close, 40, 9), 'smooth'),
      k(11.5, shot(SCAN, DIST.close, 40, 9)),                 // confirmation, same framing
    ]),
    track('target', 'position', [
      k(0.0, FULL),
      k(0.4, FULL),
      k(1.6, SCAN, 'smooth'),
      k(4.2, SCAN),
      k(5.2, SCAN, 'smooth'),
      k(7.0, REACH),
      k(9.0, SCAN, 'smooth'),
      k(11.5, SCAN),
    ]),
    custom('camera', 'fov', [k(0, FOV), k(0.4, FOV), k(2.6, 19, 'smooth'), k(4.2, 19), k(5.2, 26, 'smooth'), k(9.0, 24), k(11.5, 24)]),

    // ---- kiosk states ----
    custom('kiosk', 'screenState', steps([
      [0, 'welcome'], [0.8, 'selectRole'], [2.0, 'scanQR'], [9.6, 'medicineList'],
    ])),
    // the beam pulses on during the callout to point the window out, then runs properly
    // once the slip is actually held up to it
    // the beam stops on the slip: it reaches exactly as far as she holds it out, and
    // spreads to half the slip's height so it closes on its top and bottom edges
    custom('kiosk', 'scanReach', [k(0, 0.34), k(6.2, 0.34), k(6.9, 0.26, 'decelerate'), k(11.5, 0.26)]),
    custom('kiosk', 'scanSpread', [k(0, 0.1), k(6.2, 0.1), k(6.9, 0.17, 'decelerate'), k(11.5, 0.17)]),
    custom('kiosk', 'scanTilt', [k(0, 0.16), k(6.2, 0.16), k(6.9, -0.2, 'smooth'), k(11.5, -0.2)]),
    custom('kiosk', 'scanGlow', [
      k(1.6, 0), k(2.6, 0.9, 'decelerate'), k(4.2, 0.7), k(4.8, 0.15, 'accelerate'),
      k(5.6, 0.15), k(6.6, 1, 'decelerate'), k(9.2, 0.9), k(9.6, 0, 'accelerate'),
    ]),

    // ---- patient (2D cut-out rig, Figma 68:401) ----
    track('patient', 'visible', steps([[0, false], [4.2, true]])),
    // starts outside the frame on the left and walks in — fading her up inside the shot
    // would look like she materialised out of the cabinet
    track('patient', 'position', [
      k(4.2, [-1.5, 0, 1.95]),
      k(6.9, [0.26, 0, 0.92], 'smooth'),
      k(11.5, [0.26, 0, 0.92]),
    ]),
    track('patient', 'opacity', [k(4.2, 1), k(11.5, 1)]),
    // a strongly camera-aligned board leans into the cabinet, so keep the tilt low
    custom('patient', 'tilt', [k(4.2, 0.3), k(6.6, 0.45, 'smooth'), k(11.5, 0.45)]),
    // the arm hinges up to hold the slip in the beam, dwells there through the check
    track('patient', 'reach', [
      k(4.2, 0), k(6.0, 0), k(7.6, 1, 'smooth'), k(11.5, 1),
    ]),
    custom('patient', 'reachTarget', [k(0, REACH)]),
  ],
  markers: [
    { t: 1.6, label: 'scanner callout' },
    { t: 5.2, label: 'present QR' },
    { t: 9.6, label: 'verified' },
  ],
  steps: [
    { id: 'camera', label: 'ตำแหน่ง\nช่องสแกน', labelEn: 'Scanner\nPosition', icon: 'camera', t0: 0, t1: 4.6 },
    { id: 'scan', label: 'สแกน\nคิวอาร์โค้ด', labelEn: 'Scan\nQR Code', icon: 'qr', t0: 4.6, t1: 11.5 },
  ],
  captions: [
    { t0: 1.9, t1: 4.3, text: 'ช่องสแกนใบสั่งยาอยู่บริเวณนี้', textEn: 'The prescription scan window is located here' },
    { t0: 5.8, t1: 9.4, text: 'กรุณายื่นใบสั่งยาที่ช่องสแกน', textEn: 'Please hold your prescription up to the scan window' },
    { t0: 9.8, t1: 11.4, text: 'ตรวจสอบใบสั่งยาเรียบร้อย', textEn: 'Your prescription has been verified' },
  ],
  success: [{ t0: 9.6, t1: 11.5 }],
}
