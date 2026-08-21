import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * Screens captured from the live kiosk app
 * (kiosk-medical-dispensing-o9vdra.flutterflow.app). Each state maps to the route it
 * came from; `en` is filled in where the app ships an ENG page, otherwise the Thai
 * page is reused.
 */
export const SCREEN_PAGES = {
  welcome: { th: 'welcome', en: 'welcomeENG' },
  selectRole: { th: 'selectRole', en: 'selectRole' },
  scanQR: { th: 'orderMedicineInstruction', en: 'orderMedicineInstructionENG' },
  medicineList: { th: 'orderMedicineList', en: 'orderMedicineList' },
  collecting: { th: 'orderMedicineCollecting', en: 'orderMedicineCollectingENG' },
  collectingNext: { th: 'orderMedicineCollectingNext', en: 'orderMedicineCollectingNext' },
  collectingDone: { th: 'orderMedicineCollectingCompleted', en: 'orderMedicineCollectingCompleted' },
  faceScan: { th: 'staffFaceScan', en: 'staffFaceScan' },
  staffLogin: { th: 'staffManualLogin', en: 'staffManualLogin' },
  scanBarcode: { th: 'addMedicineInstruction', en: 'addMedicineInstructionENG' },
  addMedicine: { th: 'addMedicineDetails', en: 'addMedicineDetails' },
  addMedicineDone: { th: 'addMedicineCompleted', en: 'addMedicineCompleted' },
} as const

export type ScreenState = keyof typeof SCREEN_PAGES

const url = (page: string) => `/textures/screens/${page}.jpg`

const PAGE_URLS = Array.from(
  new Set(Object.values(SCREEN_PAGES).flatMap((p) => [url(p.th), url(p.en)])),
)

/**
 * Screen pages are loaded on demand and cached. Loading all sixteen up front costs
 * ~60MB of texture memory and can take the GPU context down on weaker machines.
 */
const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

function pageTexture(src: string): THREE.Texture | undefined {
  const hit = cache.get(src)
  if (hit) return hit.image ? hit : undefined
  const tex = loader.load(src, (t) => {
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    t.needsUpdate = true
  })
  tex.colorSpace = THREE.SRGBColorSpace
  cache.set(src, tex)
  return undefined
}

/** Warms the pages a scene is about to use. */
export function preloadScreens(states: ScreenState[], lang: 'th' | 'en' = 'th') {
  for (const state of states) {
    const page = SCREEN_PAGES[state]
    if (page) pageTexture(url(lang === 'en' ? page.en : page.th))
  }
}

export interface ScreenDynamic {
  state?: ScreenState
  lang?: 'th' | 'en'
  /** 0..1 dim, e.g. while the kiosk sleeps */
  brightness?: number
}

/**
 * The kiosk display. Page swaps happen on the material, never through React, so the
 * timeline can flip screens every frame without re-rendering the scene.
 */
export function KioskScreen({
  width,
  height,
  dyn,
}: {
  width: number
  height: number
  dyn?: React.RefObject<ScreenDynamic>
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const current = useRef<string>('')

  useFrame(() => {
    const mat = matRef.current
    if (!mat) return
    const d = dyn?.current ?? {}
    const page = SCREEN_PAGES[d.state ?? 'welcome'] ?? SCREEN_PAGES.welcome
    const next = url(d.lang === 'en' ? page.en : page.th)
    // pageTexture returns undefined until the image has decoded; keep the old page until then
    const tex = pageTexture(next)
    if (tex && next !== current.current) {
      mat.map = tex
      mat.emissiveMap = tex
      mat.needsUpdate = true
      current.current = next
    }
    mat.emissiveIntensity = 0.55 * (d.brightness ?? 1)
  })

  // The panel goes through the tone curve: left untone-mapped it sits right on the
  // bloom threshold, and the halo pulses in and out as the shot moves.
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        ref={matRef}
        emissive="#ffffff"
        emissiveIntensity={0.55}
        roughness={0.12}
        metalness={0}
      />
    </mesh>
  )
}

// warm just the first page; the rest load when the timeline asks for them
pageTexture(url(SCREEN_PAGES.welcome.th))
void PAGE_URLS
