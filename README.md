# Auto Medicine · Scene Studio

3D rework of the Auto Medicine vending-machine GIFs. The originals in
[`Joe-sit/auto-medicine@flutterflow`](https://github.com/Joe-sit/auto-medicine/tree/flutterflow/assets/images)
were animated frame by frame in Figma; this project rebuilds them as a real-time
Three.js/R3F scene with a keyframe timeline and a deterministic frame exporter.

## What is in here

| Area | Path | Notes |
| --- | --- | --- |
| Animation core | [src/anim/](src/anim/) | keyframes, easing curves, sampler |
| Scene content | [src/scene/](src/scene/) | kiosk model, characters, props, lighting |
| Scene definitions | [src/scenes/](src/scenes/) | one file per reworked GIF |
| Studio UI | [src/studio/](src/studio/) | viewport, timeline editor, inspector |
| 2D overlay | [src/overlay/draw.ts](src/overlay/draw.ts) | step rail + captions, shared by viewport and export |
| Export | [src/export/Exporter.tsx](src/export/Exporter.tsx), [vite-plugins/studio-server.ts](vite-plugins/studio-server.ts) | frame capture and GIF/WebP/WebM/MP4 encoding |

## Run

```bash
npm install
node scripts/fetch-assets.mjs   # character GLBs into public/models
npm run dev
```

Query flags: `?proxy` renders capsule stand-ins instead of the skinned GLBs,
`?nofx` disables post-processing. Both are also toggles in the inspector.

### Keyboard

`Space` play/pause · `←`/`→` step one frame · `Home` jump to start.

## Scenes

| Scene | Source GIF | Length |
| --- | --- | --- |
| `patient-scan-qr` | `Patient_Scan_QR.gif`, `Patient-ScanOrderQRCode_ENG.gif` | 8.2s |
| `patient-collect-medicine` | `Patient-WhileCollectingMedicine_ENG.gif`, `Patient_Collecting_Medicine_Revised_Wording.gif` | 27s |
| `staff-scan-barcode` | `Staff_Scan_Medicine.gif`, `Staff-AddMedicine_ENG.gif` | 6.4s |

Thai and English wording live in the same scene file; switch with the `lang`
control, so one scene exports both language variants.

## Workspaces

The app has two pages, switched by hash route:

- `#/studio` — the scene studio: timeline, actors, overlay, export
- `#/lab` — the **kiosk model lab**: the machine on its own, orbit camera, view presets
  (front / side / back / top / detail / three-quarter), part toggles, a 10cm ruler, and
  the whole Figma face layout editable live

[src/scene/kioskLayout.ts](src/scene/kioskLayout.ts) is the single source of truth for
the face: the Figma-unit rects and `computeMetrics()`, which converts them to kiosk-local
metres. The lab edits those numbers and the model rebuilds instantly; **save layout**
writes `src/scene/kioskLayout.json` so a tuned layout can be folded back into the table.

## Liveries

The wrap is data, not baked into the model. [src/scene/liveries.ts](src/scene/liveries.ts)
registers each one with its textures, the UV window each panel takes from the sheet, the
face layout that goes with it, and the shell colour:

| id | source | notes |
| --- | --- | --- |
| `teal-medical` **(default)** | Figma `30:398` (`St-tu-A1`) | the machine as built; one sheet covering LH \| front \| RH, each panel takes a slice |
| `bgs-white` | Figma `14:342` (Front / LH / RH) | earlier white/red/blue wrap, one texture per panel |

Scene staging follows the active wrap: `computeAnchors()` in
[src/scene/kioskLayout.ts](src/scene/kioskLayout.ts) turns the layout into the points the
scenes aim cameras and hands at, so swapping the wrap moves the shots with it instead of
needing every keyframe retuned.

Pick a wrap in the model lab (**Livery → wrap**) or in the studio inspector — scenes and
exports follow it. The lab also exposes the UV window per panel, so a new sheet can be
fitted by eye and copied out with **copy livery json**.

Both sheets have the machine's fittings printed on them; those marks are painted out of
the textures so they cannot ghost behind the 3D parts (`bgs-front-figma.png` keeps the
untouched export).

## The kiosk

[src/scene/Kiosk.tsx](src/scene/Kiosk.tsx) uses the **real Figma artwork** exported from
`Auto-Medicine-Vending-Machine` (node `14:342` — `Front`, `LH`, `RH`) as the cabinet
livery ([public/textures/liveries/](public/textures/liveries/)). Cabinet proportions come
from that artwork too (front 5480x7710 units, sides 3212 wide → 1.42m x 2.0m x 0.83m).

Every fitting is placed from the same Figma coordinates (`KIOSK_LAYOUT`), so geometry
lines up with the livery: the touchscreen, camera bar, metal
barcode/QR scanner, the receipt slot, the `PICK UP` door — which swings open carrying
its slice of the artwork — and the **added sticker print slot** below the receipt slot,
per the built machine in node `14:349`.

The exported livery has the machine's fittings *printed* on it (scanner box, sensor dot,
slot bar). Those are painted out of `kiosk-front.png` so they cannot ghost behind the 3D
parts — the untouched export is kept as `kiosk-front-figma.png`. To refresh the artwork,
re-export the frames from Figma, repeat that clean-up, and update `KIOSK_LAYOUT` if the
face layout moved.

Animated channels (`custom:` tracks): `screenState`, `doorOpen`, `scanGlow`,
`cameraGlow`, `stickerFeed`. Reach anchors for hands and props are exported as
`KIOSK_ANCHORS`.

## Authoring a scene

Scenes are plain data ([src/anim/types.ts](src/anim/types.ts)):

```ts
track('patient', 'reach', [k(3.4, 0), k(4.0, 0.85, 'decelerate'), k(6.4, 0, 'accelerate')])
custom('kiosk', 'stickerFeed', [k(9.4, 0), k(11.0, 1, 'decelerate')])
k(0, shot(SCAN, DIST.close, 46, 12))   // camera placement helper
```

In the studio: select an actor, move it with the gizmo, then **key position /
rotation / scale** in the inspector to write a keyframe at the playhead. On the
timeline, drag a key to retime it, `shift+click` cycles its easing, `alt+click`
deletes it. **save scene json** writes the edited scene to `src/scenes/saved/<id>.json`.

## Export

Inspector → Export. The exporter drives the render loop by hand at a fixed step, so
output is frame-identical between runs, then composites the 2D overlay and streams
PNGs to the dev server.

- `gif` / `webp` — encoded with Pillow (`python3` + Pillow required)
- `webm` / `mp4` — encoded with `ffmpeg` if it is on PATH (`brew install ffmpeg`)
- `png` — leaves the numbered frames in `.studio/frames/<scene>/`

Files land in `out/`. Defaults are 15fps and a 128-colour palette; the legacy GIFs ran
at 7-13fps, so drop `fps` and `colors` if you need to match their file size, or export
`webp` which compresses the shaded gradients far better than GIF.

## Kiosk display

The touchscreen shows the **real kiosk UI**, captured from the live FlutterFlow app
(`kiosk-medical-dispensing-o9vdra.flutterflow.app`) into
[public/textures/screens/](public/textures/screens/). `SCREEN_PAGES` in
[src/scene/KioskScreen.tsx](src/scene/KioskScreen.tsx) maps each timeline state to the
route it came from:

| state | route |
| --- | --- |
| `welcome` / `selectRole` | `/welcome`, `/selectRole` |
| `scanQR` | `/orderMedicineInstruction` |
| `medicineList` | `/orderMedicineList` |
| `collecting` / `collectingNext` / `collectingDone` | `/orderMedicineCollecting*` |
| `faceScan` / `staffLogin` | `/staffFaceScan`, `/staffManualLogin` |
| `scanBarcode` / `addMedicine` / `addMedicineDone` | `/addMedicine*` |

Pages with an ENG route swap automatically with the `lang` control. Page changes are
applied to the material inside the render loop, so switching screens never re-renders
the React tree.

Refresh them with `node scripts/fetch-screens.mjs` (needs `playwright`), or point it at
another deployment with `KIOSK_URL=... node scripts/fetch-screens.mjs`.

## Frame layout and shot list

The frame follows the Figma storyboard (node `1:54559`): **1080x683**, a 173px step rail
at x64 and a 755x555 viewport card at x261. [src/overlay/draw.ts](src/overlay/draw.ts)
draws that rail and card, using the Material Symbols icons exported from the same file
([public/icons/](public/icons/)); the 3D render is masked to the card and the camera is
projection-shifted so the kiosk sits inside it rather than in the middle of the frame.

Camera work uses the reference lens: `FOV = 22` with `DIST` presets in
[src/scenes/dsl.ts](src/scenes/dsl.ts), and `shot(target, dist, yaw, pitch)` for
placement — the establishing shot is `shot(FULL, DIST.wide, 35, 16)`, matching the
board's elevated 3/4 view.

The staff scene follows the six boards of Figma node `21:351`: Camera Position 7 →
Camera Position 8 → Scan Barcode 1 → 2 → 3 → Complete, ending on the success flash that
[src/overlay/draw.ts](src/overlay/draw.ts) draws from the scene's `success` cues.

## Characters

Two kinds of actor can play a person:

**`sprite`** — the flat Figma illustration itself
([public/textures/actors/staff.svg](public/textures/actors/staff.svg), node `1:55180`),
billboarded into the scene by [src/scene/Billboard2D.tsx](src/scene/Billboard2D.tsx).
The plane is anchored at the feet and its `tilt` channel blends between staying upright
and matching the camera's orientation, so the 2D art leans with the shot instead of
reading as a cut-out. Animate it with a `custom:tilt` track (0 = upright, 1 = fully
camera-aligned).

**`character`** — a rigged GLB, described below.


`node scripts/fetch-assets.mjs` downloads rigged placeholders into `public/models/`
(`patient.glb`, `staff.glb`). Replace those files with your own Quaternius/Mixamo
exports — [src/scene/Character.tsx](src/scene/Character.tsx) resolves clip names loosely
(`idle` matches `Idle`, `mixamo.com`, …) and aims the right arm at the timeline's
`reachTarget`, so no scene changes are needed when swapping a model.

Headless/software renderers (CI, `swiftshader`) drop the WebGL context on skinned
meshes — use `?proxy` there.
