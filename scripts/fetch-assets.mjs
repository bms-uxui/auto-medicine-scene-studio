#!/usr/bin/env node
// Downloads the rigged character placeholders used by the scenes.
// Swap in your own GLB (Quaternius / Mixamo export) by overwriting these files —
// the scenes only depend on the file name and on Mixamo-style bone names.
import { mkdir, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.join(process.cwd(), 'public', 'models')

const ASSETS = [
  {
    file: 'patient_tham.glb',
    url: 'https://raw.githubusercontent.com/hmthanh/3d-human-model/HEAD/assets/model/ThamColor.glb',
    note: 'scanned/RPM avatar from hmthanh/3d-human-model — rigged, ships no clips (posed in code)',
  },
  {
    file: 'staff.glb',
    url: 'https://threejs.org/examples/models/gltf/Soldier.glb',
    note: 'three.js Soldier — clips: Idle, Walk, Run (placeholder for the staff character)',
  },
]

await mkdir(OUT, { recursive: true })
for (const asset of ASSETS) {
  const dest = path.join(OUT, asset.file)
  const force = process.argv.includes('--force')
  if (!force) {
    const exists = await stat(dest).then(() => true).catch(() => false)
    if (exists) {
      console.log(`skip ${asset.file} (exists, use --force to refetch)`)
      continue
    }
  }
  process.stdout.write(`fetch ${asset.file} … `)
  const res = await fetch(asset.url)
  if (!res.ok) throw new Error(`${asset.url} -> ${res.status}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
  console.log(`ok (${asset.note})`)
}
