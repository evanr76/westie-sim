# AGENTS.md — Westie in the Park

Context file for AI agents working on this project. Read this before editing.

## What this is
A single-file, browser-based, first-person **West Highland Terrier park simulator**. The entire app is `index.html` (HTML + CSS + one inline `<script>` IIFE). Three.js **r149** is vendored at `three.min.js` (a **peer of `index.html`**, not in a subdirectory) as a **UMD/global build** (exposes `window.THREE`). User-facing docs are in `README.md`.

## Hard constraints (do not break these)
- **Single self-contained file.** All game code lives in `index.html`. Do not split into modules or add a build step.
- **No network at runtime, no external assets.** The world is procedural: geometry, textures (drawn to `<canvas>`), and audio (Web Audio synthesis). The ONE exception is the Westie himself: a rigged/animated GLB (generated from photos of the real Ludo via Meshy, owned output) **base64-embedded in `index.html`** and decoded by an inline ~90-line mini-glTF parser — still no network, no separate files, works from `file://`. Do not add any OTHER asset files or CDN `<script>`/`import` tags. Model source files live in `assets-src/` (dev-only, never loaded at runtime).
- **Classic script, not ES modules.** Three.js is loaded with `<script src="three.min.js">` so the file works from `file://`. Use the global `THREE` (aliased to `T`). Do **not** convert to `import` syntax or `examples/jsm` — the vendored build has neither.
- **Pin to r149 semantics.** This build uses `renderer.outputEncoding = THREE.sRGBEncoding`, `THREE.ACESFilmicToneMapping`, and `texture.encoding = THREE.sRGBEncoding`. These are correct for r149 — do **not** "modernize" them to `outputColorSpace`/`SRGBColorSpace` (those would silently no-op on this build).

## Conventions
- `T` = `THREE`. Small helpers at the top: `clamp`, `lerp`, `rand`, `randi`, `damp`, `$` (getElementById), `TAU`.
- Procedural textures are built on `<canvas>` and must be **tileable** when used with `RepeatWrapping` — use the `wrapArc()` helper so noise/patches wrap across edges (a non-tileable ground texture caused a visible seam, now fixed).
- Custom shaders are injected via `material.onBeforeCompile` (grass wind/parting, water ripples). The grass shader overrides `#include <project_vertex>` to do world-space parting around `uDogPos`; keep `mvPosition` defined through to the end of that chunk so downstream chunks (fog) still work.
- **The visible Westie is the real Ludo**: a GLB generated from photos (Meshy image-to-3D → Remesh 30K → Quadruped Auto-Rig → walk preset), base64-embedded as `LUDO_GLB_B64` and parsed inline. 54k tris, 27-bone rig (`Hips`, `chest`, `head`/`headend`, `earend`/`R_earend`, `tail`+`tailstart`+`tail1-3`, four legs × 4 bones), 1K JPEG texture, ONE clip (a 1s walk cycle). Handles: `ludoDog` (wrapper Group), `ludoBones` (by bare bone name), `ludoMixer`/`ludoWalk`. **glTF spec traps already handled — do not "fix" them back**: (1) the skinned mesh node's transform must be IGNORED — the `SkinnedMesh` is parented at the wrapper root and bound with an IDENTITY matrix; parenting it under the Armature (scale 0.01, IBMs ×100) explodes the mesh into a starburst. (2) The export is ~6&nbsp;mm long — the wrapper normalizes scale from measured bone span and rotates `Math.PI` (GLB rests facing +z; game forward is -z). Grounding is EXACT, not eye-tuned: at load the mesh is CPU-skinned at 8 phases of the walk cycle (`mesh.boneTransform`) and the lowest paw vertex over the whole cycle is planted at y=0 — note r149's `boneTransform(index, target)` requires the vertex's rest position pre-loaded into `target` (later three versions read the attribute themselves; passing a stale vector silently produces garbage offsets). (3) Texture `flipY=false`, `sRGBEncoding`.
- **Run and idle are derived, not clips**: `ludoWalk.timeScale = 0.1 + clamp(sp/2.2, 0, 2.7)` speed-matches the cycle (idle = slow weight-shifting creep), and bone-rotation overlays are added AFTER `ludoMixer.update(dt)` each frame (tail wag, ear perk/flop on bark via `bp`/`earFlop`, head dip in scent mode). Overlays use `bone.rotation.x += ...` post-mixer — stable because the mixer rewrites the pose every frame. If Meshy ever yields real run/idle clips, they merge as extra `AnimationAction`s on the same mixer (same armature → same track names).
- The **face cam is a 3/4 angle** (not dead-front) so the face and tail read well. The FP head parts (camera-attached muzzle/ears/paws, `WHITE`/`NOSE_MAT` etc.) are still procedural and unchanged; `applyView()` hides the whole `ludoDog` in first-person (you can't hide just the GLB's head).
- **Runtime model picker**: the 🐕 HUD button (or dragging a `.glb` onto the window) loads a local file via FileReader and calls `buildLudoFromBuffer()` — the same builder the embedded payload boots through. It parses fully BEFORE swapping, so a bad file toasts an error and keeps the current dog; the old wrap is removed and disposed (geometry/material/texture, mixer uncached). Expects Meshy-style GLBs (single skinned primitive, one clip, embedded texture, the joint names above). Test hook: `__westie.loadLudoBuffer(arrayBuffer)`. The dog material gets a warm >1 color lift (`new T.Color(1.22,1.18,1.10)`) so baked-grey AI textures read white in the golden-hour light.
- To swap the EMBEDDED default model: `node tools/add-ludo.mjs <file.glb>` (or no arg = newest `.glb` in `assets-src/`). It validates (rig/clip/texture/joint names), copies the source into `assets-src/`, optimizes (texture → 1024px JPEG via macOS `sips`, emissive stripped, bufferViews repacked → `<name>-opt.glb`), and swaps the `LUDO_GLB_B64` payload atomically with a rolling backup at `assets-src/index.prev.html.bak`. It aborts before touching `index.html` on any validation failure. Zero npm deps. Never edit the ~3 MB payload literal by hand.
- The dog rig hierarchy: `playerRig` (yaw, on the ground) → `bodyGroup` (the visible Westie: body, legs, tail, and a `dogFace` head group) and `pitchObj` (FP "eye" marker). The **camera is unparented** and driven manually each frame in `update()`: in `'fp'` it copies `pitchObj`'s world transform (eye height); in `'chase'` it sits behind+above the dog (smoothed `_chasePos`) and `lookAt`s the dog. `viewMode` toggles via the 🎥 button / `V` key (`toggleView`→`applyView`), which swaps visibility of the FP `head` (camera-child muzzle/ears/paws) and the body's `dogFace` so neither blocks the other. The grounded body sits behind/below the FP eye so you don't see your own back in first-person.
- Per-frame code in `update()` and the `updateX()` system functions should avoid allocations. Reuse module-scope scratch objects where practical.

## Current status (working & verified in-browser)
- Renders cleanly, no console errors. Golden-hour palette, sky shader + sun, fog, shadows.
- The GLB Ludo is integrated and verified in all three cameras: face-cam 3/4 shows the face/collar, chase cam shows the gait cycle at speed, FP hides the mesh. Interactions (bark, fetch, sniff) run clean with the bone-overlay system. `index.html` is ~3.2 MB (≈3.1 MB of that is the embedded model).
- First-person dog: gait head-bob, sway/roll, ears flop, paws reach when galloping, tongue when panting, ground shadow.
- Grass: ~28k instanced blades, vertex wind + radial part-and-spring around the dog, backlit tips, denser in the central play area.
- Movement (WASD/arrows + sprint), pointer-lock mouse look, full mobile touch layer.
- Interactions **all verified working**: squirrels flee→tree (score), pigeons scatter→fly→land, ball throw/bounce/fetch (score), treat collection + scent-mode trails (score), bark, dog-vision toggle, reduce-motion/comfort toggle, mute.
- HUD: stats with pop animation, zoomies/stamina bar, toasts, control hints, pause overlay.

## Debug / verification hooks
- `window.__westie` exposes handles for automated testing: `play()` (force-unpause, ignores the tab-hidden auto-pause), `pause()`, `step(n)` (advance n fixed frames + render — use this to drive the sim deterministically when `requestAnimationFrame` is throttled in a hidden/headless tab), `teleport(x,z)`, `setKey/setYaw/setPitch`, and `bark()/fetch()/sniff()`, plus `birds/squirrels/treats/ball/ballState/HUD/player/scene/camera`.
- This project is verified by opening it in a browser preview, calling `__westie.play()` then `__westie.step()`, and screenshotting — **not** by unit tests (there are none).
- Note: in an embedded/preview browser the page often reports `visibilityState:"hidden"`, which (a) triggers the auto-pause and (b) throttles rAF. Use `__westie.play()` + `step()` to work around it. The auto-pause-on-hidden is intentional for real users — keep it.

## Recently fixed (don't reintroduce)
- FP body parts were oversized/too close and filled the screen → resized and the grounded body moved behind/below the camera.
- Tall grass blades clipped through the lens → grass now parts/flattens around `uDogPos`; bulk blades are short mown-lawn height with a few tall accents.
- Ground had a vertical seam → ground texture made tileable (`wrapArc`) and switched from `CircleGeometry` to `PlaneGeometry`.
- Startled pigeons re-landed instantly (landing check fired on the first ascending frame) → land only while descending.

### Post-review pass (adversarial multi-agent review, all verified fixed)
- **Ball**: added a post-throw `noGrab` cooldown (no instant re-fetch / no double-count on 120 Hz+ displays); clamps back inside the fence and bounces off prop colliders instead of tunnelling; held-ball position inlined (no per-frame `Vector3`).
- **Squirrels**: a treed squirrel could be frozen unscoreable if you camped near the tree (3D distance gate) → now gates on horizontal distance with a hard timeout, and latches `descendAt` on climb entry.
- **Pointer lock / cursor freedom**: pressing `Esc` (browser-native pointer-lock exit) frees the cursor *without pausing* and shows the `#cursorhint` banner, so the HUD buttons (top-right) become clickable and view/toggle changes apply live; clicking the park (`requestLock`) re-captures the mouse. Explicit pause is the ⏸️ button or `P`. (The `pointerlockchange` handler only toggles the hint now — it no longer auto-pauses; tab-switch still pauses via `visibilitychange`.) `requestPointerLock()` promise rejections are swallowed.
- **Resize**: re-applies `setPixelRatio` (fixes blur on zoom / monitor DPR change) and zero-guards width/height (no NaN projection matrix).
- **Audio**: continuous in-pond splash now actually plays (`Audio.splash()` — was a `?0:0` no-op); `AudioContext` resumes on tab return.
- **Accessibility**: start button is `autofocus`; Space/Enter start the game from the overlay.
- **Perf**: tightened the shadow frustum (SH 20, far 100 — sharper + cheaper; NOTE: did *not* gate shadow-map regen on player movement, which would freeze the shadows of dynamic casters — ball/squirrels/gait); hoisted movement scratch vectors; guarded `camera.updateProjectionMatrix()` behind an actual FOV change; squirrel/bird animation reads the sim `time` instead of `performance.now()`.

## Known minor / outstanding (nice-to-have, from the design spec)
- Pond is functional but uses a cheap animated material — could add reeds, lily pads, ducks, and a footbridge.
- No hand-rolled post-processing (bloom / god-rays) yet; relies on tone-mapping + CSS vignettes. The grass uses a single instanced field, not the spec's "rolling pool" that follows the dog infinitely (fine for the current bounded park).
- Stretch features not built: ball-catch-at-apex + owner head-pat, fireflies/dusk day-night cycle, wet pawprints / wet-dog shake, comfort sub-sliders (only a single reduce-motion toggle exists).
- Pigeon/squirrel models are simple low-poly; could be prettier.

## When changing visuals
Verify in a browser preview and screenshot. Colors/sizes are tuned by eye — don't trust the code alone. Watch for: objects enveloping/clipping the near camera, grass clipping the lens, texture seams (must be tileable), and shadow-frustum artifacts.
