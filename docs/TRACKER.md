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

- Status: `done`
- Files: `js/processing.js` (`runProcessing`), `js/studio.js` (`detectNow`), `js/poseDetection.js` (`detectView`), `js/state.js` (`sessionToken`)
- Problem: reset or a replaced photo during `await` can still write `generatedAt`, `measurements`, or `pose` for the old run. `detectView` keeps the capture object from before `ensureLandmarker()` and `loadHtmlImage()`.
- Done when: a generation token is checked after every await. A mismatch does not write pose results or a report. Replacing a photo mid-detect does not attach landmarks to the new object URL.
- Verified: 2026-10-27. `sessionToken` increments on reset and `replaceCapture`. Preview and pose detection compare it after each await, and landmarks are stored only when the object URL is unchanged. Unit test covers the token and the object-URL guard.

### P1-pose-engine-flag

- Status: `done`
- Files: `js/state.js` (`resetSession`), `js/poseDetection.js` (`ensureLandmarker`), `js/processing.js`, `js/studio.js` (`detectNow`)
- Problem: `resetSession` sets `pose.engine` and `engineCode` to `idle`, but the module-level landmarker stays open. The next `ensureLandmarker()` returns it without setting `ready`. A timeout sets `engineCode` to `timeout` and a later success does not clear it. A pose stage is marked done even when no view detected a person.
- Done when: if the cached landmarker exists after reset, flags read `ready` again. A successful load after timeout sets `engineCode` to `ready`. The pose stage is not `done` when neither photo has `status === 'detected'`. Do not close the model on reset.
- Verified: 2026-10-27. A cached landmarker sets `engine` and `engineCode` back to `ready`. A timeout no longer overwrites `ready`, and a later successful load sets `ready`. The pose stage is `warn` when neither photo is `detected`. Reset does not call `closePose`. A later browser journey still saw “not loaded” after reset, because nothing restored the flag before `emit`. `restoreCachedEngine` now runs from `setAfterReset` only when the cached landmarker exists.

### P1-camera-shot

- Status: `done`
- Files: `js/studio.js` (`useShot`, `discardShot`, `openStream`, `openCamera`)
- Problem: `useShot` discards the still and closes the dialog before `readImageFile`. A rejected frame is gone. A double click can start two `getUserMedia` streams and only one is stopped. The second open prefers `devices[0]`, which may not be the front camera. `discardShot` revokes the blob but leaves `#cameraStill.src` and canvas pixels.
- Done when: the dialog closes only after validation succeeds. A failed shot stays on screen. In-flight camera opens cannot orphan a track. A new open uses `facingMode: 'user'` until the user presses the switch. Discard clears the still `src` and the canvas.
- Verified: 2026-10-27. In Chrome, two overlapping opens both requested `facingMode: 'user'` and the older track was stopped. A real permission prompt and a real captured still were not available, so dialog-close clearing of a live still was not observed on a physical camera.

### P1-profile-form

- Status: `done`
- Files: `js/studio.js` (`commitProfile`), `js/utils.js` (`resolveHeightCm`), `index.html` (`#profileForm`)
- Problem: Enter in the profile form can submit and reload the page, wiping the in-memory session. Switching 170 cm to feet and back commits 170.2 because `cmToFeetParts(170)` is 5 ft 7 in and `feetInchesToCm(5, 7)` is 170.2. An invalid feet entry sets `aria-invalid` on `#heightCm`.
- Done when: form submit is prevented. Displaying feet does not change the stored centimetres until the user edits a field. Invalid feet input marks the feet fields. Unsaved height fields are copied when the mode changes.
- Verified: 2026-10-27. Enter in the name field did not reload. 170 cm shown as 5 ft 7 in stayed 170.0 cm. Unsaved 180 cm survived a feet round trip. Inches set to 20 marked the feet fields and left `#heightCm` unmarked. Unit test covers the 170 cm commit.

### P1-sample-and-dirty-reset

- Status: `done`
- Files: `js/studio.js` (`loadSamplePair`, `useSample`, `confirmReset`)
- Problem: loading a sample does not clear `#captureAlert`. Reset treats the session as clean when only height or preset changed, so it toasts that there is nothing to reset.
- Done when: sample load clears the capture alert. A changed height or preset counts as dirty and opens the confirm dialog.
- Verified: 2026-10-27. Choosing Slim opened the reset dialog. The missing-photo alert was cleared by both the paired sample button and a single-view sample.

## Phase 2 — Measurement interaction

### P2-inch-edit

- Status: `done`
- Files: `js/measurementDashboard.js` (`applyEdit`), `js/utils.js` (`formatNumber`, `parseMeasurement`)
- Problem: 37 cm displays as 14.6 in. Saving 14.6 stores `14.6 * 2.54 = 37.1` and sets `manuallyEdited`. Changing units while the editor is focused leaves the old number in the input, so the next save parses it in the new unit.
- Done when: saving a value that rounds to the current `valueCm` does not call `setMeasurementValue`. A unit toggle reformats a focused editor from the stored centimetres.
- Verified: 2026-10-27. Unit test: displayed 14.6 in parses as 37.1 cm and is treated as unchanged. Chrome sample report: saving neck at 14.6 in left it unedited; a focused editor showing 99.0 was rewritten to 37.0 cm when the unit changed.

### P2-selection-by-key

- Status: `done`
- Files: `js/bodyDiagram.js` (`regionActive`), `js/avatar3d.js` (highlight and annotation labels), `js/config.js` (`selectionHighlights`, `calloutValueKey`)
- Problem: highlight uses shared `region`. Selecting `neck` lights the Shoulder chip and shows the shoulder number. `bicep`, `wrist`, `back`, and `torso` have the same mismatch. The 3D torso case lights chest, waist, and hip rings; the 2D diagram does not.
- Done when: highlight follows the selected `key`. A measurement without its own callout shows that key’s `valueCm`, not a sibling’s. Torso highlighting matches in 2D and 3D.
- Verified: 2026-10-27. Unit test covers key highlight and hosted values. Chrome sample report: neck shows 37.0 cm on the shoulder chip without selecting it; bicep shows 30.0 cm on the arm chip; torso selects chest, waist, and hip in both the diagram and the 3D labels and shows 66.0 cm.

### P2-length-guides

- Status: `done`
- Files: `js/avatar3d.js`, `js/i18n.js`, `index.html`
- Problem: sleeve and inseam are lengths, but the viewer draws them as girth rings.
- Done when: sleeve and inseam render as guide lines. Girth keys can stay rings. The mannequin mesh still comes from `PRESET_SHAPES` and height scale, not from edited centimetres. Dashboard copy says the numbers stay in sync and the body shape is the illustrative preset.
- Verified: 2026-10-27. Chrome sample mannequin: shoulder, chest, waist, and hip stay rings. Sleeve and inseam are length lines; selecting each turns that line green and shows 62.0 cm and 78.0 cm. The mesh is still built from `PRESET_SHAPES` and `heightCm / 170`. Dashboard lead, in English and Bangla, says the values stay in sync and the body shape is the illustrative preset.

### P2-pose-summary

- Status: `done`
- Files: `js/bodyDiagram.js`
- Problem: `#poseSummary` is only rewritten in photo layout. Returning to the diagram or a sample view can leave a stale “detected” line.
- Done when: diagram mode clears or replaces the summary, and sample mode shows the skipped-pose text.
- Verified: 2026-10-27. Chrome sample body in diagram mode shows the skipped-pose line. A photo view with a detected pose shows the detected line; Diagram clears it; the sample side shows the skipped line again. A real person photograph was not used.

## Phase 3 — Report and print

### P3-sheet-honesty

- Status: `done`
- Files: `index.html` (`#reportSheet`), `js/report.js` (`poseLabel`, snapshot render)
- Problem: CSV and JSON include the full `CUTTING_WARNING` from `js/config.js`. The on-screen sheet uses a shorter sentence and omits “Photographs are not tape measurements.” Pose warnings are in JSON but not on the sheet. Report height is always centimetres.
- Done when: the sheet shows `snapshot.notice`, pose warning codes, and a line that a photo source was not used as a measurement. Height uses the active unit.
- Verified: 2026-10-27. Chrome sample sheet shows the full cutting warning, including “Photographs are not tape measurements.”, and “Photographs are not used to calculate these values”. Height is 170.0 cm, then 66.9 in after the unit change. A detected pose with `low_resolution` and `incomplete_framing` shows those codes on the sheet. The English disclaimer is unchanged.

### P3-print

- Status: `done`
- Files: `css/print.css`
- Problem: printing before generate hides `#reportEmpty`, so the page is nearly blank. The `#report` section heading still prints. Dark-theme SVG fills can print as dark shapes.
- Done when: an empty report prints one readable line. The section heading is hidden in print. The diagram stays readable on white paper.
- Verified: 2026-10-27. Chrome print preview before generate shows one black line, “প্রিভিউর জন্য রিপোর্ট অপেক্ষা করছে”, and hides the section heading. After a sample report in the dark theme, the printed figure fill is the light green and the strokes stay dark on white.

## Phase 4 — Viewer and small screens

### P4-avatar-input

- Status: `done`
- Files: `js/avatar3d.js`
- Problem: a drag that ends on a ring changes the selection. `webglcontextlost` uses `{ once: true }` and there is no `webglcontextrestored` path. Camera distance and the floor shadow do not follow `heightCm / 170`.
- Done when: pointer movement above a small threshold does not raycast on click. Context restore rebuilds the viewer, or the fallback stays and the lost handler can run again. Camera distance and the shadow scale with height.
- Verified: 2026-10-27. Chrome: a 40px drag ending on the shoulder ring left the selection on height; a tap there selected shoulder. A lost context hid the canvas and showed the fallback, a second loss did the same, and restore left the fallback up. Shoulder and inseam labels stayed 279px apart at 170 cm and at 220 cm, so the camera pulled back with the height. The floor shadow uses that same scale.

### P4-layout

- Status: `done`
- Files: `css/components.css`, `css/responsive.css`, `css/print.css`, `index.html`, `js/navigation.js`
- Problem: the camera dialog has no max-height, so at 360px the actions can sit below the viewport. The report table has no horizontal scroll wrapper. The hero float can clip between 769px and 1100px. The open mobile menu does not trap focus.
- Done when: the camera dialog scrolls inside the viewport at 360px. The report table scrolls instead of widening the page. The hero card is fully visible from 768px through 1100px. Tab and Escape stay inside the open mobile menu until it closes.
- Verified: 2026-10-27. Chrome at 360×640: the camera dialog stays inside the viewport, scrolls, and the action row can be scrolled into that dialog. The report table is 576px inside a 290px scroller while the page stays 360px wide. Hero card and both float cards sit inside the hero at 768, 770, 900, and 1100. At 800px, Tab and Shift+Tab cycle inside the open menu, Escape closes it and returns to the toggle, and a closed menu does not trap. Print still hides the section heading and does not force the table’s minimum width.

### P4-bangla-cutting-warning

- Status: `done`
- Files: `js/i18n.js`, `index.html`, `js/report.js`
- Problem: the on-page cutting warning is English only and shorter than `CUTTING_WARNING`.
- Done when: Bangla mode translates the cutting warning. The exact English disclaimer is still not passed through `data-i18n`.
- Verified: 2026-10-27. Chrome sample report in Bangla shows the full cutting warning on the sheet and in the footer. English mode shows the exact `CUTTING_WARNING` in both places. The export snapshot notice stays that English sentence. The disclaimer stays the exact English sentence in the ribbon, sheet, and footer, with no `data-i18n`. `Generate Measurement Preview` and `Illustrative 3D Body Model` stay English.

## Phase 5 — Tests

### P5-unit

- Status: `done`
- Files: `tests/measurements.test.mjs`, `tests/index.js`, `js/utils.js` (`applyDisplayedEdit`)
- Done when: `node --test tests/` covers all of the following and passes:
  - saving the displayed inch value does not change centimetres or mark the row edited
  - 170 cm shown as feet and committed without an edit is still 170.0, not 170.2
  - a report snapshot includes the full cutting warning and pose warning codes
- Verified: 2026-10-27. `node --test tests/` — 11 passed, 0 failed. The inch save leaves 37 cm unedited, untouched 5 ft 7 in stays 170.0 cm rather than 170.2, and the snapshot notice is the full cutting warning with pose codes `low_resolution` and `incomplete_framing`.

### P5-browser

- Status: `done`
- Files: `js/state.js` (`setAfterReset`, `resetSession`), `js/poseDetection.js` (`restoreCachedEngine`), `js/studio.js`
- Done when: these journeys have been run in a browser and the log says what passed:
  - sample body → generate → 18 rows → chest 94.0 cm at 170 cm regular
  - inches, save without a real edit, neck selection highlights neck
  - reset after pose detection does not leave the engine stuck on “not loaded” if the model is still cached
  - camera dialog usable at 360px width
- Verified: 2026-10-27. Chrome on `http://127.0.0.1:8000/`. Sample body then Generate Measurement Preview: 18 dashboard rows and 18 report rows, chest 94.0 cm, height 170.0 cm, profile 170 cm regular. Inches: neck showed 14.6 in; saving that display left `valueCm` 37, `manuallyEdited` false, and `illustrative_demo`. The neck row was selected and the shoulder chip was not; the shoulder callout showed the neck name and 14.6 in. A generated 640×800 blank PNG (no person) loaded the pose model, found no body, and the quality line read ready. Reset through the confirm dialog cleared the session and the same line stayed “ল্যান্ডমার্ক মডেল এই ডিভাইসে প্রস্তুত” because the cached landmarker was still open. At 360×640 the camera dialog opened from the photo step, stayed inside the viewport (top 37, bottom 603, overflow auto), and the capture button sat inside it (top 541–585) while the page stayed 360px wide. The automated browser granted a camera stream (1280px video); no still was captured and no person photograph was stored.

## Verification log

Add a row when a phase is checked. Do not invent a pass.

| Date | Item | Command or journey | Result |
| --- | --- | --- | --- |
| 2026-10-27 | baseline, before this tracker | `node --test tests/` | 7 passed, 0 failed |
| 2026-10-27 | baseline sample and blank-image pose | headless Chrome on a local static server | Sample report and WebGL viewer rendered. A 640×800 blank PNG loaded MediaPipe and reported no pose, then the illustrative report still generated. Real person photo and real camera permission were not run. |
| 2026-10-27 | Phase 1 session and capture | `node --test tests/measurements.test.mjs` | 9 passed, 0 failed |
| 2026-10-27 | Phase 1 profile, reset, sample, camera constraints | Chrome on `http://127.0.0.1:8000/` | Profile Enter did not reload. Feet display of 170 cm stayed 170.0. Slim opened reset. Sample load cleared the capture alert. Overlapping camera opens used `facingMode: 'user'` and stopped the older track. Real camera permission and a real still were not run. |
| 2026-10-27 | Phase 2 measurement interaction | `node --test tests/measurements.test.mjs` and Chrome on `http://127.0.0.1:8000/` | 11 passed, 0 failed. Inch save, key highlight, sleeve and inseam guide lines, and pose summary were checked in Chrome. A real person photograph was not used for the pose summary. |
| 2026-10-27 | Phase 3 report and print | Chrome print media on `http://127.0.0.1:8000/` | The sheet shows the full cutting warning, photo-source line, active-unit height, and pose warning codes. An empty print shows one readable line and hides the section heading. A dark-theme diagram prints with a light fill and dark strokes. |
| 2026-10-27 | Phase 4 viewer and small screens | Chrome on `http://127.0.0.1:8000/` | Avatar drag, context loss, and height framing were checked earlier. Layout at 360px, 768–1100px, and the open menu were checked earlier. Bangla mode now shows the full cutting warning on the sheet and in the footer; English mode shows the exact `CUTTING_WARNING`. The disclaimer has no `data-i18n`. |
| 2026-10-27 | Phase 5 tests | `node --test tests/` and Chrome on `http://127.0.0.1:8000/` | 11 passed, 0 failed. Sample report had 18 rows and chest 94.0 cm. Saving the displayed 14.6 in neck left 37 cm unedited and selected only the neck row. A blank 640×800 PNG loaded the pose model with no body; after confirm-reset the quality line stayed ready. At 360×640 the camera dialog and its capture button stayed inside the viewport. No person photograph was stored. The automated browser did open a camera stream; a still was not captured. |
