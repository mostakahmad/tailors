# Architecture

Static prototype of a photo-guided fitting studio. One HTML page, vanilla ES modules, no build step.

**Concept Prototype — Measurements are illustrative and not suitable for tailoring.**

## Boot

`index.html` loads `js/main.js` as a module. Import map:

- `three` → `vendor/three.module.js` (Three.js r0.170.0)
- `three/addons/` → `vendor/addons/`

`js/main.js` order: `loadPreferences`, `initI18n`, `initNavigation`, `initStudio`, `initGuide`, `initDashboard`, `initDiagram`, `initReport`, `initGlobalErrors`, then `initAvatar()` (not awaited). `initGuide` opens the first-visit dialog once. Choosing the sample loads the illustrations. Dismissing it, including Escape, only stores that the guide was seen.

Bootstrap 5.3.3 CSS is linked for availability. Layout classes are our own (`tl-btn`, design tokens in `style.css`). The page still lays out if the Bootstrap CDN fails. `css/motion.css` is presentation only: step changes, processing progress, toasts, dialogs, the profile silhouette, and the mannequin preset morph. It does not change measurement values. `prefers-reduced-motion` disables it.

## One state object

`js/state.js` exports a mutable `state` singleton. Modules call `subscribe(fn)` and `emit()`. Renderers must not call `emit()` while handling an emit, or updates recurse.

Stored only in memory for a tab session:

- `profile`: `name`, `heightCm` (100–220), `heightInput` (`cm` or `ft`), `preset`, `units`
- `captures.front` and `captures.side`: `kind` is `empty`, `sample`, or `photo`
- `pose.front` and `pose.side`: slim landmarks `{x, y, visibility}` when detection ran
- `measurements[]` after a preview is generated
- `generatedAt`, `selectedKey`, `step` (1–3)
- `sessionToken` increments on reset and when a capture is replaced. In-flight preview and pose detection compare it after every await and skip pose results, measurements, and `generatedAt` when it has changed. Replacing a photo also requires the same object URL before landmarks are stored.

`localStorage` keys are only `tailars-theme`, `tailars-lang`, and `tailars-guide` (`seen` after the first-visit dialog closes). Photos, landmarks, and measurements are not written to `localStorage`, `sessionStorage`, or IndexedDB. Object URLs are revoked on replace, reset, and `pagehide`.

## Measurement object

Built in `js/demoMeasurements.js`:

```js
{
  key: "chest",
  group: "upper",
  region: "chest",
  illustrativeCm: 94.0,
  valueCm: 94.0,
  source: "illustrative_demo",
  manuallyEdited: false
}
```

Formula: `round1((BASELINES[key] + presetOffset) * (heightCm / 170))`. The `height` row is the entered height and is not scaled. Manual edits survive a later preset or height change, except `height`, which always follows the profile (`mergeMeasurements`).

Allowed `source` values: `illustrative_demo`, `manual_entry`, and `verified_external_provider` (reserved; nothing sets it today).

`js/measurementProvider.js`:

- `MeasurementProvider.analyze()` throws. That is the future contract.
- `IllustrativeMeasurementProvider` is the live provider. It reads `heightCm` and `preset` only. It must not read pixels.
- `getProvider()` / `setProvider()` exist so a test or a future provider can be swapped. The UI does not call a remote API.

## What each module owns

| File | Owns |
| --- | --- |
| `js/config.js` | Disclaimer text, limits, baselines, preset offsets, measurement defs, MediaPipe URLs |
| `js/utils.js` | DOM helpers, cm/in/feet conversion, toasts, downloads |
| `js/i18n.js` | English and Bangla dictionaries. `applyI18n` runs on emit |
| `js/studio.js` | Wizard, upload, drag-drop, camera, sample load, reset confirm |
| `js/imageValidation.js` | Type, size, decode. JPEG, PNG, WebP. Max 12 MB |
| `js/poseDetection.js` | Lazy MediaPipe Pose Landmarker. GPU then CPU. IMAGE mode |
| `js/processing.js` | Generate-preview stages. Pose failure does not block the report |
| `js/measurementDashboard.js` | List, search, filters, unit toggle, manual edit |
| `js/bodyDiagram.js` | Fixed SVG figure plus photo landmark canvas |
| `js/avatar3d.js` | Procedural mannequin, OrbitControls, measurement markers |
| `js/report.js` | On-screen sheet, CSV, JSON, print snapshot |
| `js/navigation.js` | Menu, theme, language, preset shortcut buttons |
| `js/guide.js` | First-visit sample path. Stores only that the dialog was seen |

## Real versus simulated

Real browser work:

- Camera via `navigator.mediaDevices.getUserMedia`
- File validation and local preview
- MediaPipe landmarks on uploaded photos (CDN model; images are not uploaded)
- Three.js WebGL viewer
- Unit conversion, edits, CSV, JSON, `window.print`

Simulated, and must stay labeled that way:

- All 18 circumferences and tailoring lengths
- Presets Regular, Slim, Athletic, Full
- Mannequin shape (`PRESET_SHAPES` in `js/config.js`, plus height scale)
- Sample silhouettes in `assets/`

Sample mode skips pose detection. Landmark coordinates are not exported. The 2D measurement guides are on the diagram, not mapped onto arbitrary photos.

## Pages and anchors

`#overview`, `#how`, `#studio`, `#visualization`, `#report`. Navigation uses those hashes. The dashboard lives inside `#report`.

## Known gaps

The working demo still has correctness bugs. They are listed with file names and acceptance checks in [TRACKER.md](TRACKER.md). Do not treat that list as new product scope. Out of scope is also recorded there.

## Verify

```bash
node --test tests/
python3 -m http.server 8000
```

`tests/measurements.test.mjs` covers the formula, merge, unit conversion, file metadata, pose assessment, and export disclaimer. It does not drive the browser.
