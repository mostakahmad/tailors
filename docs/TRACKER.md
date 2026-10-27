# Work tracker

Source of truth for unfinished work. Update this file in the same change as the code. A new clone is enough to continue: read [ARCHITECTURE.md](ARCHITECTURE.md), then take the first item marked `todo`.

Status values: `todo` | `doing` | `done` | `blocked`.

Do not start a later phase while an earlier phase still has `todo` items. Phases are ordered because later UI depends on session correctness.

## Already shipped

Do not rebuild these. They work and are the baseline.

- Landing, working nav, three-step studio, sample body, upload, drag-drop, camera dialog
- 18 illustrative measurements, cm/in, search, filters, manual edit, CSV, JSON, print
- On-device pose landmarks when MediaPipe loads, with a non-blocking fallback
- Procedural Three.js mannequin and 2D diagram
- English/Bangla UI and light/dark theme
- Relative paths, `.nojekyll`, vendored Three.js r0.170.0

## Out of scope

- Calculating real chest, waist, hip, or other tape measurements from photos or landmarks
- Reconstructing the 3D body from an uploaded photo
- Segmentation masks
- A backend, database, authentication, API key, or paid API
- Pushing to a remote, unless the owner asks in that session
- Changing the exact English disclaimer string

The disclaimer must remain, in the ribbon, report, footer, and exports:

`Concept Prototype — Measurements are illustrative and not suitable for tailoring.`

These strings stay English even in Bangla mode: that disclaimer, the button `Generate Measurement Preview`, and the label `Illustrative 3D Body Model`.

## Phase 1 — Session and capture

### P1-session-token

- Status: `todo`
- Files: `js/processing.js` (`runProcessing`), `js/studio.js` (`detectNow`), `js/poseDetection.js` (`detectView`)
- Problem: reset or a replaced photo during `await` can still write `generatedAt`, `measurements`, or `pose` for the old run. `detectView` keeps the capture object from before `ensureLandmarker()` and `loadHtmlImage()`.
- Done when: a generation token is checked after every await. A mismatch does not write pose results or a report. Replacing a photo mid-detect does not attach landmarks to the new object URL.

### P1-pose-engine-flag

- Status: `todo`
- Files: `js/state.js` (`resetSession`), `js/poseDetection.js` (`ensureLandmarker`), `js/processing.js`, `js/studio.js` (`detectNow`)
- Problem: `resetSession` sets `pose.engine` and `engineCode` to `idle`, but the module-level landmarker stays open. The next `ensureLandmarker()` returns it without setting `ready`. A timeout sets `engineCode` to `timeout` and a later success does not clear it. A pose stage is marked done even when no view detected a person.
- Done when: if the cached landmarker exists after reset, flags read `ready` again. A successful load after timeout sets `engineCode` to `ready`. The pose stage is not `done` when neither photo has `status === 'detected'`. Do not close the model on reset.

### P1-camera-shot

- Status: `todo`
- Files: `js/studio.js` (`useShot`, `discardShot`, `openStream`, `openCamera`)
- Problem: `useShot` discards the still and closes the dialog before `readImageFile`. A rejected frame is gone. A double click can start two `getUserMedia` streams and only one is stopped. The second open prefers `devices[0]`, which may not be the front camera. `discardShot` revokes the blob but leaves `#cameraStill.src` and canvas pixels.
- Done when: the dialog closes only after validation succeeds. A failed shot stays on screen. In-flight camera opens cannot orphan a track. A new open uses `facingMode: 'user'` until the user presses the switch. Discard clears the still `src` and the canvas.

### P1-profile-form

- Status: `todo`
- Files: `js/studio.js` (`commitProfile`), `index.html` (`#profileForm`)
- Problem: Enter in the profile form can submit and reload the page, wiping the in-memory session. Switching 170 cm to feet and back commits 170.2 because `cmToFeetParts(170)` is 5 ft 7 in and `feetInchesToCm(5, 7)` is 170.2. An invalid feet entry sets `aria-invalid` on `#heightCm`.
- Done when: form submit is prevented. Displaying feet does not change the stored centimetres until the user edits a field. Invalid feet input marks the feet fields. Unsaved height fields are copied when the mode changes.

### P1-sample-and-dirty-reset

- Status: `todo`
- Files: `js/studio.js` (`loadSamplePair`, `useSample`, `confirmReset`)
- Problem: loading a sample does not clear `#captureAlert`. Reset treats the session as clean when only height or preset changed, so it toasts that there is nothing to reset.
- Done when: sample load clears the capture alert. A changed height or preset counts as dirty and opens the confirm dialog.

## Phase 2 — Measurement interaction

### P2-inch-edit

- Status: `todo`
- Files: `js/measurementDashboard.js` (`applyEdit`), `js/utils.js` (`formatNumber`, `parseMeasurement`)
- Problem: 37 cm displays as 14.6 in. Saving 14.6 stores `14.6 * 2.54 = 37.1` and sets `manuallyEdited`. Changing units while the editor is focused leaves the old number in the input, so the next save parses it in the new unit.
- Done when: saving a value that rounds to the current `valueCm` does not call `setMeasurementValue`. A unit toggle reformats a focused editor from the stored centimetres.

### P2-selection-by-key

- Status: `todo`
- Files: `js/bodyDiagram.js` (`regionActive`), `js/avatar3d.js` (highlight and annotation labels)
- Problem: highlight uses shared `region`. Selecting `neck` lights the Shoulder chip and shows the shoulder number. `bicep`, `wrist`, `back`, and `torso` have the same mismatch. The 3D torso case lights chest, waist, and hip rings; the 2D diagram does not.
- Done when: highlight follows the selected `key`. A measurement without its own callout shows that key’s `valueCm`, not a sibling’s. Torso highlighting matches in 2D and 3D.

### P2-length-guides

- Status: `todo`
- Files: `js/avatar3d.js`
- Problem: sleeve and inseam are lengths, but the viewer draws them as girth rings.
- Done when: sleeve and inseam render as guide lines. Girth keys can stay rings. The mannequin mesh still comes from `PRESET_SHAPES` and height scale, not from edited centimetres. Dashboard copy says the numbers stay in sync and the body shape is the illustrative preset.

### P2-pose-summary

- Status: `todo`
- Files: `js/bodyDiagram.js`
- Problem: `#poseSummary` is only rewritten in photo layout. Returning to the diagram or a sample view can leave a stale “detected” line.
- Done when: diagram mode clears or replaces the summary, and sample mode shows the skipped-pose text.

## Phase 3 — Report and print

### P3-sheet-honesty

- Status: `todo`
- Files: `index.html` (`#reportSheet`), `js/report.js` (`poseLabel`, snapshot render)
- Problem: CSV and JSON include the full `CUTTING_WARNING` from `js/config.js`. The on-screen sheet uses a shorter sentence and omits “Photographs are not tape measurements.” Pose warnings are in JSON but not on the sheet. Report height is always centimetres.
- Done when: the sheet shows `snapshot.notice`, pose warning codes, and a line that a photo source was not used as a measurement. Height uses the active unit.

### P3-print

- Status: `todo`
- Files: `css/print.css`, `index.html`
- Problem: printing before generate hides `#reportEmpty`, so the page is nearly blank. The `#report` section heading still prints. Dark-theme SVG fills can print as dark shapes.
- Done when: an empty report prints one readable line. The section heading is hidden in print. The diagram stays readable on white paper.

## Phase 4 — Viewer and small screens

### P4-avatar-input

- Status: `todo`
- Files: `js/avatar3d.js`
- Problem: a drag that ends on a ring changes the selection. `webglcontextlost` uses `{ once: true }` and there is no `webglcontextrestored` path. Camera distance and the floor shadow do not follow `heightCm / 170`.
- Done when: pointer movement above a small threshold does not raycast on click. Context restore rebuilds the viewer, or the fallback stays and the lost handler can run again. Camera distance and the shadow scale with height.

### P4-layout

- Status: `todo`
- Files: `css/components.css`, `css/responsive.css`, `style.css`, `js/navigation.js`
- Problem: the camera dialog has no max-height, so at 360px the actions can sit below the viewport. The report table has no horizontal scroll wrapper. The hero float can clip between 769px and 1100px. The open mobile menu does not trap focus.
- Done when: the camera dialog scrolls inside the viewport at 360px. The report table scrolls instead of widening the page. The hero card is fully visible from 768px through 1100px. Tab and Escape stay inside the open mobile menu until it closes.

### P4-bangla-cutting-warning

- Status: `todo`
- Files: `js/i18n.js`, `index.html` or `js/report.js`
- Problem: the on-page cutting warning is English only and shorter than `CUTTING_WARNING`.
- Done when: Bangla mode translates the cutting warning. The exact English disclaimer is still not passed through `data-i18n`.

## Phase 5 — Tests

### P5-unit

- Status: `todo`
- Files: `tests/measurements.test.mjs`, and a small pure helper if the inch-save rule cannot be tested without the DOM
- Done when: `node --test tests/` covers all of the following and passes:
  - saving the displayed inch value does not change centimetres or mark the row edited
  - 170 cm shown as feet and committed without an edit is still 170.0, not 170.2
  - a report snapshot includes the full cutting warning and pose warning codes

### P5-browser

- Status: `todo`
- Files: none required if verified manually; record the result in the log below
- Done when: these journeys have been run in a browser and the log says what passed:
  - sample body → generate → 18 rows → chest 94.0 cm at 170 cm regular
  - inches, save without a real edit, neck selection highlights neck
  - reset after pose detection does not leave the engine stuck on “not loaded” if the model is still cached
  - camera dialog usable at 360px width
- If a real person photo or a real camera permission prompt was not available, write that in the log. Do not mark this item `done` on unit tests alone.

## Verification log

Add a row when a phase is checked. Do not invent a pass.

| Date | Item | Command or journey | Result |
| --- | --- | --- | --- |
| 2026-10-27 | baseline, before this tracker | `node --test tests/` | 7 passed, 0 failed |
| 2026-10-27 | baseline sample and blank-image pose | headless Chrome on a local static server | Sample report and WebGL viewer rendered. A 640×800 blank PNG loaded MediaPipe and reported no pose, then the illustrative report still generated. Real person photo and real camera permission were not run. |
