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

/**
 * Poly Haven model sets, for the room the kiosk stands in.
 *
 * These arrive as a glTF with its buffer and textures beside it rather than as one file,
 * so each set is written into its own directory and the relative paths inside the glTF
 * resolve as they are. All of Poly Haven is CC0 — no attribution is required, and none of
 * it is baked into the films.
 *
 * The 1k textures are deliberate: both of these sit two metres behind the subject and are
 * never in focus, and the 4k sets are twenty times the size for nothing.
 */
const SETS = [
  {
    dir: 'lobby-chair',
    note: 'Poly Haven modern_arm_chair_01 (CC0) — the armchair beside the machine',
    api: 'https://api.polyhaven.com/files/modern_arm_chair_01',
    main: 'modern_arm_chair_01_1k.gltf',
  },
  {
    dir: 'lobby-plant',
    note: 'Poly Haven potted_plant_02 (CC0) — the plant beside the machine',
    api: 'https://api.polyhaven.com/files/potted_plant_02',
    main: 'potted_plant_02_1k.gltf',
  },
]

await mkdir(OUT, { recursive: true })

for (const set of SETS) {
  const dest = path.join(OUT, set.dir)
  const force = process.argv.includes('--force')
  const exists = await stat(path.join(dest, set.main)).then(() => true).catch(() => false)
  if (exists && !force) {
    console.log(`skip ${set.dir} (exists, use --force to refetch)`)
    continue
  }
  process.stdout.write(`fetch ${set.dir} … `)
  const files = await (await fetch(set.api)).json()
  const gltf = files.gltf['1k'].gltf
  const parts = [[set.main, gltf.url], ...Object.entries(gltf.include).map(([rel, f]) => [rel, f.url])]
  for (const [rel, url] of parts) {
    const file = path.join(dest, rel)
    await mkdir(path.dirname(file), { recursive: true })
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url} -> ${res.status}`)
    await writeFile(file, Buffer.from(await res.arrayBuffer()))
  }
  console.log(`ok, ${parts.length} file(s) (${set.note})`)
}

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
