import type { SceneDef } from '../anim/types'
import { patientScanQr } from './patientScanQr'
import { patientCollectOpd } from './patientCollectOpd'
import { patientCollectIpd } from './patientCollectIpd'
import { staffScan } from './staffScan'

export const SCENES: SceneDef[] = [patientScanQr, patientCollectOpd, patientCollectIpd, staffScan]
export { patientScanQr, patientCollectOpd, patientCollectIpd, staffScan }
