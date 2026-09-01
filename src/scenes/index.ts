import type { SceneDef } from '../anim/types'
import { patientScanQr } from './patientScanQr'
import { patientCollectOpd } from './patientCollectOpd'
import { patientCollectBottle } from './patientCollectBottle'
import { staffScan } from './staffScan'

export const SCENES: SceneDef[] = [patientScanQr, patientCollectOpd, patientCollectBottle, staffScan]
export { patientScanQr, patientCollectOpd, patientCollectBottle, staffScan }
