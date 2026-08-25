import type { SceneDef } from '../anim/types'
import { patientScanQr } from './patientScanQr'
import { patientCollectOpd } from './patientCollectOpd'
import { patientCollectBottle } from './patientCollectBottle'
import { patientCollectIpd } from './patientCollectIpd'
import { staffScan } from './staffScan'

export const SCENES: SceneDef[] = [patientScanQr, patientCollectOpd, patientCollectBottle, patientCollectIpd, staffScan]
export { patientScanQr, patientCollectOpd, patientCollectBottle, patientCollectIpd, staffScan }
