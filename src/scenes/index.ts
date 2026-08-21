import type { SceneDef } from '../anim/types'
import { patientScanQr } from './patientScanQr'
import { patientCollect } from './patientCollect'
import { staffScan } from './staffScan'

export const SCENES: SceneDef[] = [patientScanQr, patientCollect, staffScan]
export { patientScanQr, patientCollect, staffScan }
