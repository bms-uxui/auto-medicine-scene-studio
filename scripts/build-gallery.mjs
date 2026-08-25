/**
 * Stages the rendered films for a static build.
 *
 * The studio's gallery talks to the dev server, which reads `out/` off disk and zips on
 * request. A deployed page has no server, so everything it needs is prepared here: the
 * films are copied into `public/media`, listed in a manifest, and bundled into one
 * archive per scene — the same STORE zips the dev server hands out.
 */
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildZip } from './zip.mjs'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'out')
const MEDIA = path.join(ROOT, 'public', 'media')
const PLAYABLE = /\.(mp4|webm|gif|webp)$/i

const sceneOf = (name) => name.replace(PLAYABLE, '').replace(/-(th|en)$/i, '')

let names = []
try {
  names = (await readdir(OUT)).filter((n) => PLAYABLE.test(n)).sort()
} catch {
  console.warn('build-gallery: no out/ directory — the gallery will be empty')
}

await rm(MEDIA, { recursive: true, force: true })
await mkdir(MEDIA, { recursive: true })

const manifest = []
const byScene = new Map()

for (const name of names) {
  const info = await stat(path.join(OUT, name))
  await copyFile(path.join(OUT, name), path.join(MEDIA, name))
  manifest.push({ name, size: info.size, modified: info.mtimeMs })
  const scene = sceneOf(name)
  byScene.set(scene, [...(byScene.get(scene) ?? []), name])
}

for (const [scene, files] of byScene) {
  const entries = await Promise.all(
    files.map(async (name) => ({ name, data: await readFile(path.join(OUT, name)) })),
  )
  await writeFile(path.join(MEDIA, `${scene}.zip`), buildZip(entries))
}

await writeFile(path.join(MEDIA, 'index.json'), JSON.stringify({ files: manifest }, null, 2))
console.log(`build-gallery: staged ${manifest.length} file(s), ${byScene.size} archive(s) -> public/media`)
