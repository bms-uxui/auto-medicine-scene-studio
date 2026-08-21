import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'

const ROOT = process.cwd()
const WORK = path.join(ROOT, '.studio')

function json(req: Connect.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function run(cmd: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('error', (e) => resolve({ code: 127, out: String(e) }))
    child.on('close', (code) => resolve({ code: code ?? 1, out }))
  })
}

const ENCODE_PY = `
import sys, glob, os
from PIL import Image
frames_dir, out_path, fps, fmt = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
colors = int(sys.argv[5]) if len(sys.argv) > 5 else 128
files = sorted(glob.glob(os.path.join(frames_dir, "frame_*.png")))
if not files:
    print("no frames"); sys.exit(1)
imgs = [Image.open(f).convert("RGBA") for f in files]
duration = int(round(1000.0 / fps))
if fmt == "gif":
    # one shared palette derived from a mid-timeline frame keeps colours stable and
    # lets the GIF encoder emit small inter-frame diffs instead of full frames
    palette = imgs[len(imgs) // 2].convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT)
    conv = [im.convert("RGB").quantize(palette=palette, dither=Image.NONE) for im in imgs]
    conv[0].save(out_path, save_all=True, append_images=conv[1:], duration=duration, loop=0, optimize=True, disposal=1)
else:
    imgs[0].save(out_path, save_all=True, append_images=imgs[1:], duration=duration, loop=0, quality=88, method=4)
print(out_path)
`

/**
 * Dev-only backend for the studio: receives rendered PNG frames, encodes them into
 * GIF/WebP (Pillow) or WebM/MP4 (ffmpeg when present), and persists edited scenes.
 */
export function studioServer(): Plugin {
  return {
    name: 'studio-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__studio', async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const send = (code: number, body: unknown) => {
          res.statusCode = code
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        try {
          if (req.method !== 'POST') return next()

          if (url === '/frames/begin') {
            const { scene } = await json(req)
            const dir = path.join(WORK, 'frames', scene)
            await rm(dir, { recursive: true, force: true })
            await mkdir(dir, { recursive: true })
            return send(200, { ok: true, dir })
          }

          if (url === '/frames') {
            const { scene, startIndex, frames } = await json(req)
            const dir = path.join(WORK, 'frames', scene)
            await mkdir(dir, { recursive: true })
            await Promise.all(
              (frames as string[]).map((dataUrl, i) => {
                const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
                const name = `frame_${String(startIndex + i).padStart(5, '0')}.png`
                return writeFile(path.join(dir, name), Buffer.from(b64, 'base64'))
              }),
            )
            return send(200, { ok: true, written: frames.length })
          }

          if (url === '/encode') {
            const { scene, fps, format, colors } = await json(req)
            const dir = path.join(WORK, 'frames', scene)
            const outDir = path.join(ROOT, 'out')
            await mkdir(outDir, { recursive: true })

            if (format === 'png') return send(200, { ok: true, path: path.relative(ROOT, dir) })

            if (format === 'gif' || format === 'webp') {
              const out = path.join(outDir, `${scene}.${format}`)
              const script = path.join(WORK, 'encode.py')
              await writeFile(script, ENCODE_PY)
              const r = await run('python3', [script, dir, out, String(fps), format, String(colors ?? 128)])
              if (r.code !== 0) return send(500, { ok: false, error: r.out })
              return send(200, { ok: true, path: path.relative(ROOT, out) })
            }

            const out = path.join(outDir, `${scene}.${format === 'mp4' ? 'mp4' : 'webm'}`)
            const args =
              format === 'mp4'
                ? ['-y', '-framerate', String(fps), '-i', path.join(dir, 'frame_%05d.png'),
                   // frames captured at an odd size would be rejected by libx264
                   '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                   '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out]
                : ['-y', '-framerate', String(fps), '-i', path.join(dir, 'frame_%05d.png'),
                   '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                   '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-row-mt', '1', out]
            const r = await run('ffmpeg', args)
            if (r.code === 127) {
              return send(501, { ok: false, error: 'ffmpeg not found — install it (brew install ffmpeg) or export gif/webp' })
            }
            if (r.code !== 0) return send(500, { ok: false, error: r.out.slice(-2000) })
            return send(200, { ok: true, path: path.relative(ROOT, out) })
          }

          if (url === '/save-layout') {
            const { layout } = await json(req)
            const file = path.join(ROOT, 'src', 'scene', 'kioskLayout.json')
            await writeFile(file, JSON.stringify(layout, null, 2))
            return send(200, { ok: true, path: path.relative(ROOT, file) })
          }

          if (url === '/save-scene') {
            const { scene } = await json(req)
            const dir = path.join(ROOT, 'src', 'scenes', 'saved')
            await mkdir(dir, { recursive: true })
            const file = path.join(dir, `${scene.id}.json`)
            await writeFile(file, JSON.stringify(scene, null, 2))
            return send(200, { ok: true, path: path.relative(ROOT, file) })
          }

          return next()
        } catch (err) {
          return send(500, { ok: false, error: String(err) })
        }
      })
    },
  }
}
