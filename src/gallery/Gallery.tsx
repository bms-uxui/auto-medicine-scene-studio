import { useEffect, useMemo, useRef, useState } from 'react'
import { SCENES } from '../scenes'
import './gallery.css'

interface ExportFile {
  name: string
  size: number
  modified: number
}

type Lang = 'th' | 'en'

interface Work {
  sceneId: string
  title: string
  /** seconds and pixel size of the scene the files were rendered from, when it is known */
  duration?: number
  frame?: [number, number]
  /** lang -> format -> file */
  files: Record<Lang, Record<string, ExportFile>>
}

const LANG_LABEL: Record<Lang, string> = { th: 'TH', en: 'EN' }

/** The studio names its scenes in English; the gallery is a Thai-facing page. */
const THAI_TITLE: Record<string, string> = {
  'patient-scan-qr': 'ผู้ป่วย · สแกนคิวอาร์โค้ด',
  'patient-collect-opd': 'ผู้ป่วย · รับยา (OPD)',
  'patient-collect-ipd': 'ผู้ป่วย · รับยา (IPD)',
  'staff-scan-barcode': 'เจ้าหน้าที่ · สแกนคิวอาร์โค้ดใบเติมยา',
}

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`)

const fmtClock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`

/**
 * Where the films are served from.
 *
 * In the studio they come off the dev server, which reads `out/` and zips on request. A
 * deployed build has no server, so it reads the manifest and the archives that
 * `scripts/build-gallery.mjs` staged into `public/media` instead.
 */
type Source = { list: string; file: (name: string) => string; zip: (scene: string) => string }

const STUDIO_SOURCE: Source = {
  list: '/__studio/exports',
  file: (name) => `/__studio/out/${encodeURIComponent(name)}`,
  zip: (scene) => `/__studio/out-zip/${encodeURIComponent(scene)}.zip`,
}

const STATIC_SOURCE: Source = {
  list: `${import.meta.env.BASE_URL}media/index.json`,
  file: (name) => `${import.meta.env.BASE_URL}media/${encodeURIComponent(name)}`,
  zip: (scene) => `${import.meta.env.BASE_URL}media/${encodeURIComponent(scene)}.zip`,
}

/**
 * Splits `patient-collect-opd-th.mp4` into the scene it belongs to, its language and its
 * format. A file with no language suffix is a single-language render, and is filed under
 * Thai so it still shows up.
 */
function parse(file: ExportFile): { sceneId: string; lang: Lang; format: string } | null {
  const dot = file.name.lastIndexOf('.')
  if (dot < 0) return null
  const format = file.name.slice(dot + 1).toLowerCase()
  const stem = file.name.slice(0, dot)
  const m = /^(.*)-(th|en)$/.exec(stem)
  return { sceneId: m ? m[1] : stem, lang: (m?.[2] as Lang) ?? 'th', format }
}

function useExports() {
  const [files, setFiles] = useState<ExportFile[] | null>(null)
  const [source, setSource] = useState<Source>(STUDIO_SOURCE)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let live = true
    const read = async () => {
      // the dev server first; a deployed build simply has no such route
      for (const candidate of [STUDIO_SOURCE, STATIC_SOURCE]) {
        try {
          const res = await fetch(candidate.list)
          if (!res.ok) continue
          const data = await res.json()
          if (!live) return
          setSource(candidate)
          setFiles(data.files ?? [])
          return
        } catch {
          // try the next one
        }
      }
      if (live) setError('ไม่พบรายการวิดีโอ')
    }
    void read()
    return () => {
      live = false
    }
  }, [nonce])
  return { files, source, error, reload: () => setNonce((n) => n + 1) }
}

/** Which file the player should show, and what that format is called. */
function pickPlayable(byFormat: Record<string, ExportFile>) {
  if (byFormat.mp4) return { file: byFormat.mp4, format: 'mp4' }
  if (byFormat.webm) return { file: byFormat.webm, format: 'webm' }
  return null
}

/** A work rendered in one language only still has to play: fall back to what it has. */
const langFor = (work: Work, want: Lang): Lang =>
  Object.keys(work.files[want]).length ? want : want === 'th' ? 'en' : 'th'

/**
 * One accordion panel. Collapsed it is a spine with the title running up it; open it is
 * the player, with the language switch and the download sitting as pills over the corner.
 */
function Panel({
  work,
  index,
  open,
  onOpen,
  source,
}: {
  work: Work
  index: number
  open: boolean
  onOpen: () => void
  source: Source
}) {
  const [lang, setLang] = useState<Lang>('th')
  const shown = langFor(work, lang)
  const playable = pickPlayable(work.files[shown])
  const video = useRef<HTMLVideoElement>(null)

  // what the archive will hold, so the pill can say so before it is asked for
  const bundle = useMemo(() => {
    const all = [...Object.values(work.files.th), ...Object.values(work.files.en)]
    const langs = (['th', 'en'] as Lang[]).filter((l) => Object.keys(work.files[l]).length > 0)
    return {
      count: all.length,
      size: all.reduce((n, f) => n + f.size, 0),
      langs: langs.map((l) => l.toUpperCase()).join('+'),
    }
  }, [work])

  // a panel that closes stops playing; nothing should be running off-screen behind a spine
  useEffect(() => {
    if (!open) video.current?.pause()
  }, [open])

  return (
    <section
      className={`panel${open ? ' open' : ''}`}
      onClick={() => !open && onOpen()}
      onMouseEnter={onOpen}
      aria-expanded={open}
    >
      {/*
        The media box is always the width of an *open* panel and never resizes; the panel
        clips it. Resizing a playing video every frame is what made the expand judder —
        this way the only thing the animation changes is where the card is cut.
      */}
      <div className="media">
        {playable ? (
          <video
            ref={video}
            key={source.file(playable.file.name)}
            className="player"
            src={source.file(playable.file.name)}
            controls={open}
            loop
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="player empty">ยังไม่มีไฟล์วิดีโอ</div>
        )}
        {/* the dim on a closed card: an overlay that fades, not a filter on the video */}
        <span className="dim" aria-hidden="true" />
      </div>

      {/* pills, top corner of the card */}
      <div className="pills" onClick={(e) => e.stopPropagation()}>
        <div className="segmented" role="group" aria-label="ภาษา">
          {(['th', 'en'] as Lang[]).map((l) => (
            <button key={l} className={l === shown ? 'on' : ''} onClick={() => setLang(l)}>
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        {bundle.count > 0 && (
          // one archive with every render of this scene — both languages, every format
          <a className="pill-cta" href={source.zip(work.sceneId)} download>
            <span className="ico" aria-hidden="true">
              ↓
            </span>
            ดาวน์โหลด ZIP
            <span className="pill-note">
              {bundle.langs} · {fmtSize(bundle.size)}
            </span>
          </a>
        )}
      </div>

      {/* only a closed card is labelled, as a spine; the open one is left clean and the
          caption for it sits under the row */}
      {!open && (
        <div className="label">
          <span className="n">{String(index + 1).padStart(2, '0')}</span>
          <span className="t">{work.title}</span>
        </div>
      )}
    </section>
  )
}

export function Gallery() {
  const { files, source, error, reload } = useExports()
  const [open, setOpen] = useState(0)
  const accordion = useRef<HTMLDivElement>(null)

  const works = useMemo<Work[]>(() => {
    if (!files) return []
    const map = new Map<string, Work>()
    for (const file of files) {
      const info = parse(file)
      if (!info) continue
      let work = map.get(info.sceneId)
      if (!work) {
        const scene = SCENES.find((s) => s.id === info.sceneId)
        work = {
          sceneId: info.sceneId,
          title: THAI_TITLE[info.sceneId] ?? scene?.name ?? info.sceneId,
          duration: scene?.duration,
          frame: scene?.size,
          files: { th: {}, en: {} },
        }
        map.set(info.sceneId, work)
      }
      work.files[info.lang][info.format] = file
    }
    // the order the scenes are listed in the studio, then anything unrecognised
    const order = SCENES.map((s) => s.id)
    return [...map.values()].sort((a, b) => {
      const ia = order.indexOf(a.sceneId)
      const ib = order.indexOf(b.sceneId)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [files])

  /**
   * Panels animate between two pixel widths rather than between flex ratios: `flex-grow`
   * has no interpolable start value on the closed side, and the browser was re-laying the
   * whole row on every frame. The two widths are measured here and handed to CSS.
   */
  useEffect(() => {
    const el = accordion.current
    if (!el || works.length === 0) return
    const measure = () => {
      const style = getComputedStyle(el)
      const gap = parseFloat(style.columnGap) || 0
      const inner = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      // a closed panel is a preview, not a hairline: it keeps a real slice of its frame,
      // shrinking only when there are enough works that the open one would be crowded out
      const others = Math.max(1, works.length - 1)
      let closed = Math.min(300, Math.max(130, inner * 0.17))
      // whatever else happens, the open panel keeps at least half the row
      const maxClosed = (inner - gap * others - inner * 0.5) / others
      closed = Math.max(96, Math.min(closed, maxClosed))
      const openWidth = Math.max(240, inner - gap * others - closed * others)
      el.style.setProperty('--w-closed', `${closed}px`)
      el.style.setProperty('--w-open', `${openWidth}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [works.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setOpen((i) => Math.min(i + 1, works.length - 1))
      if (e.key === 'ArrowLeft') setOpen((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [works.length])

  return (
    <div className="gallery">
      <header>
        <div className="brand">
          <span className="mark">AM</span>
          <div>
            <p className="name">Auto Medicine</p>
            <p className="sub">คลังวิดีโอสาธิตตู้รับยาอัตโนมัติ</p>
          </div>
        </div>
        <div className="tools">
          <button className="ghost" onClick={reload}>
            รีเฟรช
          </button>
          <a className="ghost" href="#/">
            สตูดิโอ
          </a>
        </div>
      </header>

      {error && <div className="note error">{error}</div>}
      {!files && !error && <div className="note">กำลังอ่านไฟล์…</div>}
      {files && works.length === 0 && (
        <div className="note">ยังไม่มีไฟล์ใน out/ — render จากสตูดิโอก่อน แล้วกดรีเฟรช</div>
      )}

      {works.length > 0 && (
        <>
          <div className="accordion" ref={accordion}>
            {works.map((work, i) => (
              <Panel
                key={work.sceneId}
                work={work}
                index={i}
                open={i === open}
                onOpen={() => setOpen(i)}
                source={source}
              />
            ))}
          </div>

          <div className="now">
            <span className="n">{String(open + 1).padStart(2, '0')}</span>
            <h1>{works[open]?.title}</h1>
            <span className="m">
              {works[open]?.duration !== undefined && <span>{fmtClock(works[open].duration!)}</span>}
              {works[open]?.frame && (
                <span>
                  {works[open].frame![0]} × {works[open].frame![1]}
                </span>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
