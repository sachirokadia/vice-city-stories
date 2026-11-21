# G1.2 Stage 1 — Results: one static downtown reflection probe (GT paint + glass)

**Status: IMPLEMENTED and VERIFIED live. Pipeline PASS. Visual requirement NOT MET on the GT's flat bodywork — see §5. Stop here for Sachi's review; no Stage 2.**

Scope implemented exactly as approved: one static 128×128 downtown probe, Velocity GT paint + glass only, existing sky PMREM kept as `scene.environment`. No other vehicles, no building materials, no Stage 2 work. No push, no deploy.

Build: **1,151.05 kB / gzip 313.25 kB** (was 1,150.03 / 312.82 — +1.02 kB). `npx tsc --noEmit` clean. qa81 GREEN (only the pre-existing carbine-mag flake, 27 vs 25). Zero console errors in every run.

## 1. What changed (3 files)

| File | Change |
|---|---|
| **NEW** `src/game/ReflectionProbes.ts` | `bakeCityProbe(renderer, scene, position)` — CubeCamera (near 0.5, far 900) at 128² + PMREM `fromCubemap`, with tone mapping off, fog null, `scene.environment` null during capture (linear capture, no double tone mapping, no env-in-env recursion, no orange haze); restores everything in a `finally`. `assignProbeToVehicle(vehicle, texture)` — sets `envMap` + `needsUpdate` on paint + glass (null clears back to the sky env). Constants: `DOWNTOWN_PROBE_POSITION = (0, 2, -120)`, `PROBE_SIZE = 128`. |
| `src/game/Vehicle.ts` | `VehicleMesh` + `VehicleHandle` now expose `glassMat` (was only `paintMat`) and the handle exposes `id` (spec id, e.g. `'velocity-gt'`). No geometry or driving change. |
| `src/game/GameEngine.ts` | Factory: bake right after `buildWorld` — at that point the scene holds only the lighting group + world group, so nothing dynamic exists yet and nothing needs hiding (try/catch: on failure the game continues with the sky env only). `applyProbeToActiveVehicle()` — assigns the probe only when the active vehicle is the GT; called after every vehicle (re)creation: factory, `applyQualityPreset`, `garageSelect`. `dispose()` disposes the probe target. New QA hooks: `probeTarget` (private), `probeMs` (public). |

No other files changed. The story grant path (`grantStoryVehicle`) needs no hook — it only ever grants the Vortex RS, never the GT.

## 2. Verification — the probe and the pipeline

All live in the headless browser (SwiftShader), zero console errors. Harness: `~/workspace/qa-shots/vcs-g1-stage1.mjs` → `g1-stage1.json`.

- **Bake:** `probeTarget` exists; texture mapping 301 (CubeUVReflectionMapping); PMREM target 256×256; texture is NOT the sky env; `probeMs` **14,414 ms in SwiftShader** (see §4 — not a desktop number).
- **Assignment:** vehicle is `velocity-gt`; `paintMat.envMap === probeTarget.texture` and `glassMat.envMap === probeTarget.texture`; `envMapIntensity` 1 on both. Sky env intact: `scene.environment` present, `environmentIntensity` still **0.55**.
- **Probe content (chrome sphere, built correctly this time — fresh `new SphereGeometry(0.5, 32, 16)`, NOT a cloned donor):** the sphere shows a **recognisable city** — a dark tower with lit windows, a blue sky band, warm sunset at the horizon, dark ground below (cropped close-up: `qa/g1-s1-crop-chrome.png`). The paint-clone sphere is vivid glossy red with a bright sky highlight (`qa/g1-s1-crop-paint.png`). The probe content is correct.
- **Presets (all PASS):** Low / Medium / High — same probe target throughout (no re-bake, `probeMs` unchanged), probe re-applied to each newly created vehicle instance, shadows correct (Low off, Medium/High on), sky env intact at every tier.
- **Garage gate (PASS):** `garageSelect('vortex-rs')` → Vortex paint + glass `envMap` null (no probe). `garageSelect('velocity-gt')` → probe assigned again.
- **Draw calls:** zero change by construction (a texture, no new meshes, no extra passes). Measured High spawn **152 constant = the G1.1 baseline exactly**. Low downtown **109 constant** at this harness's vantage (player (0,0,-60) looking north) — not directly comparable to the G0 195 figure, which was measured at a different downtown vantage; the point stands that the probe adds no draw calls.
- **Heap:** 20.7 MB at boot and at the end (flat; G1.1 was 23.4 → 22.0 MB — same range).

## 3. Pixel deltas — the reflection is localised, and it makes the car darker

Probe off = sky env only (G1.1 state). Probe on = sky env + downtown probe on paint + glass. Car-box = 140×140 px around the GT; full-frame = whole image.

| Angle | Car-box off → on | Car delta | Frame delta |
|---|---|---|---|
| Side | [57.7, 20.0, 14.7] → [31.4, 11.7, 8.3] | **[-26.3, -8.3, -6.4]** | [-3.5, -0.6, -0.7] |
| Rear-low | [64.3, 24.8, 19.8] → [51.4, 20.7, 16.7] | **[-12.9, -4.1, -3.1]** | [-0.4, 0.1, -0.2] |
| Front-low | [66.9, 18.5, 16.4] → [56.0, 32.2, 25.4] | **[-10.9, +13.7, +9.0]** | [+4.6, -2.8, -4.9] |

Notes on the criterion: the design's acceptance test said the car-box delta must exceed the full-frame delta. The harness implemented that as a per-channel *positive* comparison and reported `LOCALISED: false` — that check was wrong. The correct reading is **magnitude**: at every angle the car changes far more than the frame (|−26.3| vs |−3.5| side; |−12.9| vs |−0.4| rear; |−10.9/+13.7| vs |+4.6/−2.8| front). The reflection **is localised** — the car, not the scene, is what changes. (The frame delta itself is mostly the car's own contribution to the frame mean, since the GT is in the frame.)

But the direction matters: the side and rear go **darker** (red −26 and −13), and the front colour-shifts toward the cooler northern sky (red −11, green +14, blue +9). The paint is now reflecting the actual city — dark towers on the sides, northern sky on the front — instead of the bright orange sky gradient from every direction.

## 4. Boot time — the one number that needs Sachi's desktop

`probeMs` = **14,414 ms in SwiftShader**. That is a software-rendering number, not a desktop number, and it must not be read as one: SwiftShader renders 6 city passes + PMREM in software. For scale, the sky PMREM was 1,683 ms in SwiftShader and an estimated 50–150 ms on a real GPU; the design estimate for one probe on a real GPU was ~40–80 ms. The honest position: **the desktop boot cost is unknown until Sachi times the loading screen.** If it is over ~500 ms, Stage 2 should cut probe count or resolution. Please time the loading screen on the desktop and report it.

## 5. The visual verdict — pipeline PASS, requirement NOT MET

The design's requirement was: *surrounding buildings, sky and city structures must be recognisable in the car paint; a global colour change does not count.*

**What the evidence shows:**

- The probe works. The chrome sphere proves the probe holds recognisable city content. The deltas prove the paint samples it, locally, at every angle.
- The GT's flat extruded panels cannot display it. Each panel reflects exactly one direction and renders as one uniform colour. The side panel faces the dark towers across the street, so it renders as uniform dark maroon — darker than the vivid cherry red the sky env gave it. There is no structure on the panel to recognise as a building. The upward-facing surfaces (hood, roof edges) do catch brighter sky reflections, and the same paint on a curved surface (the paint sphere) looks vivid and glossy — the material is fine; the geometry is the limit.
- **It is not a position problem.** The follow-up diagnostic (`vcs-g1-stage1-downtown.mjs`) parked the GT exactly at the probe point (0, −120), among the towers the probe captured: the side delta is **[-25.8, -8.4, -6.3]** — essentially identical to the spawn side delta [-26.3, -8.3, -6.4]. At the probe point itself, the side still goes dark by the same amount. The downtown/spawn mismatch does not explain the result.
- Side by side, the probe makes the GT **darker than the sky-env traffic cars around it** (front-low shot: the yellow taxi and green bus stay vivid while the GT is dark maroon). The G1.1 vivid look is gone from the sides; what replaced it is physically accurate but visually flatter.

**So: Stage 1 proves the bake → PMREM → assign pipeline end to end, and proves the probe content is right. It does not deliver recognisable building reflections on the GT, because the car's flat bodywork cannot show them.** This is the design doc's §8 warning, now measured rather than predicted: curved bodywork (G6) is what would let the probe read as reflections on the car.

## 6. What this means — Sachi's call

Three honest options; no recommendation is being pushed, because this is a look-and-feel call:

1. **Keep Stage 1.** The probe stays. The GT is more accurate (it reflects its surroundings; the glasshouse and upward surfaces benefit), and the pipeline is proven for whatever comes next. The price is darker, flatter sides.
2. **Revert the probe on the car** (keep the module and the bake off, or remove the assignment). The GT goes back to the vivid G1.1 sky-env look. The probe's visible benefit on flat cars does not cover its cost (darker sides + boot time).
3. **The real fix is vehicle geometry (G6)** — curved bodywork would let the probe read as reflections. Probes alone cannot do it on flat panels.

One note for the Stage 2 decision either way: the **building** side may still be worth doing. The downtown glass facades are huge flat surfaces — a flat facade reflecting the sky or a neighbouring tower reads as glass, which is exactly how real glass towers look (reference images 2 and 7). The car's problem is that it is small and its dark side reads as dark paint; a tower's dark side reads as dark glass. Stage 2's facade work is not condemned by this result — but Stage 2's *vehicle* work (more probes for cars) would hit the same flat-panel limit.

## 7. Screenshots (all under `~/workspace/qa-shots/qa/`)

- `g1-s1-chrome-probe.png` — chrome + paint spheres at spawn (probe content proof); crops: `g1-s1-crop-chrome.png`, `g1-s1-crop-paint.png`
- `g1-s1-gt-side-probeoff.png` / `g1-s1-gt-side-probeon.png` — the before/after pair (side)
- `g1-s1-gt-rear-probeon.png`, `g1-s1-gt-front-probeon.png` — rear / front with probe on
- `g1-s1-gt-downtown-chrome.png`, `g1-s1-gt-downtown-side-probeoff.png`, `g1-s1-gt-downtown-side-probeon.png` — the GT at the probe point (downtown diagnostic)

Raw data: `~/workspace/qa-shots/g1-stage1.json`, `g1-stage1-downtown.json`. Harnesses: `vcs-g1-stage1.mjs`, `vcs-g1-stage1-downtown.mjs`.

## 8. Desktop FPS — still hers to confirm

Headless FPS is not evidence (SwiftShader reads 0–1 FPS). The probe adds zero draw calls and no per-frame work, so no FPS change is expected — but the G0 baseline (spawn 60 / downtown 55 / beach 60) should be re-confirmed on her desktop, along with the loading-screen time (§4).
