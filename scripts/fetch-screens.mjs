#!/usr/bin/env node
// Re-captures the kiosk UI pages from the live FlutterFlow app into
// public/textures/screens/. Needs playwright: `npm i -D playwright && npx playwright install chromium`.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.KIOSK_URL ?? 'https://kiosk-medical-dispensing-o9vdra.flutterflow.app/'
const OUT = path.join(process.cwd(), 'public', 'textures', 'screens')

/** Routes used by the 3D scenes; see SCREEN_PAGES in src/scene/KioskScreen.tsx. */
const ROUTES = [
  'welcome', 'welcomeENG', 'selectRole',
  'orderMedicineInstruction', 'orderMedicineInstructionENG', 'orderMedicineList',
  'orderMedicineCollecting', 'orderMedicineCollectingENG', 'orderMedicineCollectingNext',
  'orderMedicineCollectingCompleted',
  'staffFaceScan', 'staffManualLogin',
  'addMedicineInstruction', 'addMedicineInstructionENG', 'addMedicineDetails', 'addMedicineCompleted',
]

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('playwright is not installed. Run: npm i -D playwright && npx playwright install chromium')
  process.exit(1)
}

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
// the kiosk display is portrait 1080x1920 in the Figma face; capture at native size
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })

for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 })
  // FlutterFlow renders to canvas; give fonts and images a beat to settle
  await page.waitForTimeout(5000)
  const buffer = await page.screenshot({ type: 'jpeg', quality: 88 })
  await writeFile(path.join(OUT, `${route}.jpg`), buffer)
  console.log(`captured ${route}`)
}

await browser.close()
console.log(`\nwrote ${ROUTES.length} screens to ${path.relative(process.cwd(), OUT)}`)
console.log('note: screens are stored at 1080x1920; downscale to 720x1280 if bundle size matters')
