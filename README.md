# TAILARS — Body Measurement Studio

A static, client-facing prototype of a photo-guided fitting studio. It runs entirely in the browser and is meant for GitHub Pages.

**Concept Prototype — Measurements are illustrative and not suitable for tailoring.**

Circumference and length values are a deterministic demo based on the entered height and a body preset. They are not tape measurements and are not calculated from photographs. On-device pose landmarks, when the model loads, are real model output and are drawn only as joint points. They are not converted into garment measurements.

## What is real

- Upload, drag-and-drop, and `getUserMedia` camera capture
- Local preview only — photos are not uploaded, not stored in `localStorage` / `sessionStorage` / IndexedDB, and not included in exports
- Image type, size, decode, and resolution checks
- MediaPipe Pose Landmarker, loaded on demand from a public CDN, running in the browser
- Unit conversion, manual edits, CSV, JSON, and browser print
- Interactive Three.js mannequin (procedural geometry, MIT-licensed Three.js vendored in `vendor/`)

## What is simulated

- The 18 tailoring measurements
- Body presets (Regular, Slim, Athletic, Full)
- The 3D mannequin’s proportions
- The sample report

Presets are illustration controls, not scanned body types. The mannequin is not reconstructed from the customer’s photo.

## Run locally

ES modules need a local server. Opening `index.html` as a file will not work.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

Camera capture needs a secure context (`http://localhost` or HTTPS). If the camera is blocked, upload a photo instead.

Optional unit tests (no browser):

```bash
node --test tests/
```

## Publish on GitHub Pages

The site is static. Paths are relative, so it works at `https://USERNAME.github.io/REPOSITORY-NAME/` as well as at a domain root. `.nojekyll` is included so GitHub Pages serves the files as-is.

1. Push this folder to a public GitHub repository.
2. Settings → Pages → Build and deployment → Deploy from a branch.
3. Branch `main`, folder `/ (root)`.
4. Open `https://USERNAME.github.io/REPOSITORY-NAME/`.

No server, database, API key, or paid service is required. Bootstrap CSS and the font files load from CDNs. Three.js is vendored. The pose model and MediaPipe runtime download only when landmark detection runs:

- `@mediapipe/tasks-vision@0.10.21`
- `pose_landmarker_lite` float16 (Google-hosted model file)

If those downloads fail, the illustrative studio still works. Sample mode does not need the model.

Do not commit real body photographs.

## Privacy

- Photos stay in memory as object URLs and are revoked on remove, reset, and page hide.
- The camera track stops when the dialog closes, the session resets, or the page is hidden/unloaded.
- Exports contain measurements, preset, height, and pose status only — not pixels and not landmark coordinates.
- Theme and language preferences may be saved in `localStorage`. Images are not.

## Future measurement service

`js/measurementProvider.js` defines `MeasurementProvider.analyze(input)`. `IllustrativeMeasurementProvider` is the working demo. A validated provider can return the same measurement objects with `source: "verified_external_provider"`. This prototype does not call a measurement API and does not ship credentials.

## Layout

- `index.html` — studio page
- `style.css`, `css/components.css`, `css/responsive.css`, `css/print.css`
- `js/` — state, capture studio, pose detection, demo measurements, 2D diagram, Three.js avatar, report
- `assets/` — sample silhouettes and favicon only
- `vendor/` — Three.js r0.170.0 and OrbitControls (MIT)
