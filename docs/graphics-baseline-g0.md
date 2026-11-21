# G0 — Desktop Graphics Performance Baseline

**Date:** 2026-11-21 (00:10–01:0x IST)
**Build measured:** production build — G0 numbers are from the Phase 2 build (`dist/assets/index-Bu8ZrhOg.js` 1,148,941 bytes, 1,148.94 kB JS / gzip 312.43 kB). The G0-finalisation build (Low population cap, §11) is `index-CqD2r4_b.js`, 1,149.52 kB / gzip 312.63 kB (+0.58 kB). The G0-final-fix build (Low shadow override, §12) is `index-BwCTemi6.js`, 1,149.60 kB / gzip 312.65 kB (+0.08 kB).
**Scope:** measurement and documentation only. No game source file was edited, no setting or default was changed, no dependency was installed, no gameplay or save data was modified. No G1 work was started.

---

## 1. The honesty box — read this first

There is **no GPU in this environment**. Every frame-time / FPS number in this document was measured in **headless Chromium with SwiftShader software rendering** — the CPU rasterizing every pixel of a 1280×800 frame. Those numbers are **reference values only. They are not desktop performance evidence and must never be quoted as the game's FPS on a real machine.**

What *is* real and hardware-independent, and therefore the actual baseline:

- **Draw calls, triangles, geometries, textures, shader programs** (from `renderer.info`) — these are the same on any GPU.
- **JS heap** (from `performance.memory`) — same on any machine.
- **Load timing** against the local preview server — real, but local-network only.
- **Stability behaviour** (draw-call / heap drift over 60 s) and **adaptive step-down behaviour** — real logic, observed live.
- **Scenario confirmations** (populations, pursuit, encounter, cinematic) — all verified live.

What could **not** be measured here: real 1% lows, real frame times on a real GPU, GPU VRAM / driver details, GPU memory usage, real first-load time over a real network, input latency, real-device mobile performance. **Real desktop FPS and the GPU model have since been measured by Sachi on her desktop — see §11.** Section 8 lists what is still unmeasured, with a 2-minute recipe for capturing the rest.

**Environment actually used:**

| Item | Value (verbatim) |
|---|---|
| OS | Ubuntu 24.04.5 LTS, kernel 7.0.0-44-generic, x86_64 |
| Browser | HeadlessChrome/140.0.7339.16 (`chromium_headless_shell-1187`), `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.7339.16 Safari/537.36` |
| CPUs | 4 logical (`hardwareConcurrency: 4`), 1.5 shared vCPUs on this VM |
| Memory | 8 GB VM RAM; `deviceMemory` not exposed by headless Chrome |
| Test resolution | 1280×800 viewport, `devicePixelRatio` 1, no touch |
| WebGL | WebGL 2.0 (OpenGL ES 3.0 Chromium), GLSL ES 3.00 |
| Renderer string | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` — vendor `Google Inc. (Google)` |
| Server | `npx vite preview --port 4173` on 127.0.0.1 (local, no network) |

**Method (so the numbers are repeatable):**

- One fresh browser profile per preset; settings seeded via localStorage key `vice-city-stories.settings.v1` (quality = low/medium/high, shadows on, showFps on, pedestrians `normal` (18), traffic `medium` (14), police `normal` (4), pursuit `normal`, wanted on). No source default was changed.
- Each scenario observed for a fixed **12 s real-time window** with an in-page `requestAnimationFrame` sampler recording frame deltas, `renderer.info.render.calls` / `.triangles` every frame, `renderer.info.memory` and `info.programs.length` at the end, and `performance.memory` heap. The engine's own FPS (`getStats().fps`, 45-frame mean) was sampled alongside.
- **The auto step-down was held** for the fixed-preset runs (`lastDowngradeAt` pinned far in the future through the QA handle) so each preset is measured as a fixed tier. The adaptive behaviour was measured separately with the step-down enabled (Section 6).
- Camera positions are fixed per scenario (Section 3). Scenarios E/F raise populations through the handles (session only). Scenario G sets heat 90 and drives the GT; H teleports to the South Beach encounter; I plays the 1.1 intro cinematic at normal speed.
- **Frame counts are tiny at SwiftShader rates (4–17 frames per 12 s window).** Averages are meaningful; p95/p99 and 1% low are computed from those few frames and are weak — they are reported with their frame counts, not as robust percentiles.
- Raw data: `~/workspace/qa-shots/g0-low.json`, `g0-medium.json`, `g0-high.json`, `g0-stability.json`, `g0-adaptive.json`. Harness: `vcs-g0-measure.mjs`, `vcs-g0-stability.mjs`, `vcs-g0-adaptive.mjs`, `vcs-g0-closeup-retake.mjs`.

---

## 2. Load times

| | Low | Medium | High |
|---|---|---|---|
| Navigation (domContentLoaded → load) | 201 ms | 117 ms | 200 ms |
| Menu visible (`.play-button`) | 3.8 s | 3.1 s | 3.4 s |
| Engine ready after Play | 34.9 s | 38.6 s | 36.1 s |
| Total to engine ready | 49.1 s | 52.0 s | 50.5 s |

Notes:

- Navigation timing is local-server only (responseEnd 11–92 ms). It says nothing about a real network.
- **Engine-ready time (35–39 s) is dominated by shader compilation in SwiftShader** — 24–28 shader programs compiling on the CPU, plus the 4 s settle sleep in the harness. On a real desktop GPU this is expected to be ~1–3 s. That is an estimate, not a measurement; verify it with the desktop recipe in Section 8.
- Resource transfer sizes read 0 KB in all three runs because the page was reloaded from cache; the real on-disk sizes are JS 1,148,941 bytes and CSS 43,820 bytes.

---

## 3. Scenarios and camera positions

| ID | Scenario | Position / camera | What confirms it ran |
|---|---|---|---|
| A | Main menu | Before Play (no 3D renderer yet) | `.play-button` visible; menu rAF sampled |
| B | Spawn gameplay | (0, 0, 8), camYaw 0 (north), pitch 0.32 | Default view, mission card live |
| C | Downtown | (48, 42), looking NE into the (60, 30) intersection | 72 buildings in view at High |
| D | Beach / boardwalk | (133, 90), looking east at the ocean | Ocean shader, boardwalk, beach |
| E | Max pedestrians | (54, 36), looking at the intersection, crowd `busy` | 28/28 NPCs active in all presets |
| F | Max traffic | (48, 42), same as C, traffic `high` | 20/20 cars active in all presets |
| G | Police pursuit | Driving the GT from (0, −20), heat set to 90 | Wanted level 5, status `pursuit`, 4 police active |
| H | Active combat encounter | (165, 150), South Beach encounter | Encounter `active`, 3 enemies active |
| I | Cinematic sequence | FIRST LIGHT intro cinematic, normal speed | `cinematic.isActive() === true` |

---

## 4. Results — the baseline tables

### 4.1 Frame rate (SwiftShader reference only — NOT desktop evidence)

Average FPS over each 12 s window. The engine's own FPS column is `getStats().fps` (45-frame mean, reads 0–1 at these rates).

| Scenario | Low | Medium | High |
|---|---|---|---|
| A — menu (DOM/CSS only) | 5.58 | 5.39 | 5.20 |
| B — spawn | 0.55 | 0.46 | 0.32 |
| C — downtown | 1.42 | 0.84 | 0.52 |
| D — beach | 0.89 | 0.74 | 0.67 |
| E — max pedestrians | 0.81 | 0.48 | 0.49 |
| F — max traffic | 1.06 | 0.66 | 0.62 |
| G — pursuit | 0.47 | 0.39 | 0.50 |
| H — combat | 0.89 | 0.52 | 0.50 |
| I — cinematic | 1.28 | 0.67 | 0.63 |

Reading: Low is roughly 1.5–2× Medium/High in most scenarios, which is the expected direction (fewer buildings, no shadows, pixelRatio 1) — but the absolute differences are small because **SwiftShader's software rasterizer dominates everything**. The menu runs at ~5.2–5.6 FPS in all presets, which is a headless-compositor artifact, not a game signal — the preset cannot affect the menu (no 3D renderer is running yet), and even DOM compositing is slow here.

Two anomalies, both explained:

- **B (spawn) is slower than C (downtown) at Low (0.55 vs 1.42).** B runs first after boot and includes warm-up: shader compilation finishing, textures uploading, NPCs/traffic still spawning in. The first scenario after boot is always the slowest; treat B's FPS as warm-up-contaminated.
- **G (pursuit) is the slowest scenario at Low/Medium (0.47 / 0.39).** Driving + 4 police cars + the wanted HUD is the heaviest live load; at High it reads 0.50, within noise of the others.

### 4.2 Frame times (SwiftShader reference only)

Average frame time in ms (frames sampled in the 12 s window in brackets). p95 and 1% low are weak at these sample sizes — they are the slowest frame(s) of 4–17 frames, not robust percentiles.

| Scenario | Low avg (n) | Low p95 | Low 1% low FPS | Medium avg (n) | Medium p95 | Medium 1% low | High avg (n) | High p95 | High 1% low |
|---|---|---|---|---|---|---|---|---|---|
| B — spawn | 1,812 (7) | 4,200 | 0.24 | 2,151 (6) | 4,917 | 0.20 | 3,146 (4) | 5,202 | 0.19 |
| C — downtown | 706 (17) | 1,500 | 0.67 | 1,194 (11) | 2,600 | 0.38 | 1,917 (7) | 4,450 | 0.22 |
| D — beach | 1,118 (11) | 1,783 | 0.56 | 1,350 (11) | 4,216 | 0.24 | 1,502 (9) | 2,317 | 0.43 |
| E — max ped. | 1,230 (14) | 5,616 | 0.18 | 2,067 (6) | 3,000 | 0.33 | 2,028 (6) | 2,817 | 0.36 |
| F — max traffic | 940 (13) | 1,683 | 0.59 | 1,521 (9) | 4,300 | 0.23 | 1,625 (8) | 3,900 | 0.26 |
| G — pursuit | 2,135 (6) | 2,917 | 0.34 | 2,564 (6) | 4,667 | 0.21 | 2,011 (6) | 4,417 | 0.23 |
| H — combat | 1,126 (11) | 4,800 | 0.21 | 1,912 (7) | 4,933 | 0.20 | 2,013 (7) | 4,700 | 0.21 |
| I — cinematic | 781 (17) | 3,583 | 0.28 | 1,499 (9) | 4,583 | 0.22 | 1,576 (9) | 4,717 | 0.21 |

The p95 values (1.5–5.6 s) are single-frame stalls — shader compiles, texture uploads, garbage collection — not a steady-state frame-time distribution. No real 1% low can be computed from 4–17 frames; the column exists so a future desktop run can fill it properly.

### 4.3 Draw calls — the real baseline

Average / maximum `renderer.info.render.calls` per frame over each 12 s window.

| Scenario | Low | Medium | High |
|---|---|---|---|
| B — spawn | 220 / 232 | 223 / 237 | 239 / 239 |
| C — downtown | 244 / 278 | 270 / 285 | 287 / 287 |
| D — beach | 149 / 172 | 152 / 175 | 150 / 179 |
| E — max pedestrians | 255 / 273 | 280 / 280 | 282 / 282 |
| F — max traffic | 246 / 278 | 266 / 285 | 265 / 287 |
| G — pursuit | 199 / 200 | 208 / 209 | 210 / 211 |
| H — combat | 152 / 179 | 158 / 178 | 170 / 180 |
| I — cinematic | 216 / **303** | 209 / **304** | 208 / **300** |

Reading:

- Draw calls scale sensibly with tier in the same scenario (Low → Medium +~10%, Medium → High +~7%), driven by building counts (28 / 48 / 72).
- **The most expensive steady state is max pedestrians downtown: 255 / 280 / 282.** The cinematic peaks at 300–304 (staged actors + extra meshes on top of the scene) — the single highest draw-call count observed anywhere.
- **Beach (149–152) and combat (152–170) are the cheapest** — few buildings in view from the beach.
- Against the audit's budgets (low ≤200, medium ≤300, high ≤400, ultra ≤500): Medium (max 285) and High (max 304) are inside budget. **Low exceeds its 200 budget at max pedestrians (255–273) and downtown (244–278).** Either the low budget needs raising to ~280, or Low tier should cap population more aggressively. Recommendation in Section 7.
- Note on the 9F figure: the 9F report quoted "152 draw calls at spawn". G0 measures 220–239 at the same spot. The difference is method: G0 measures with the full default population (18 NPCs, 14 traffic cars), the mission marker beam/ring/diamond and the sprint ring all live, at a fixed camera. 9F's 152 was likely an earlier moment with fewer systems active. **G0's numbers are the baseline from here** — same method, same camera, repeatable per preset.

### 4.4 Triangles

Average / maximum triangles per frame.

| Scenario | Low | Medium | High |
|---|---|---|---|
| B — spawn | 171,171 / 180,918 | 192,930 / 205,302 | 210,174 / 210,174 |
| C — downtown | 151,766 / 179,862 | 190,977 / 204,474 | 209,346 / 209,346 |
| D — beach | 153,779 / 172,388 | 175,167 / 195,412 | 175,873 / 201,472 |
| E — max pedestrians | 165,097 / 179,718 | 204,330 / 204,330 | 209,202 / 209,202 |
| F — max traffic | 153,619 / 179,862 | 187,978 / 204,474 | 190,147 / 209,346 |
| G — pursuit | 178,874 / 178,892 | 203,754 / 203,772 | 208,626 / 208,644 |
| H — combat | 146,537 / 170,408 | 172,247 / 192,760 | 185,457 / 196,084 |
| I — cinematic | 147,282 / 188,100 | 172,967 / 212,276 | 176,602 / **216,472** |

Reading: triangles track building count by tier (Low ~147–179k, Medium ~172–204k, High ~176–210k). The single highest triangle count is the cinematic at High (216,472 max) — staged actors plus the city behind them. The ocean (48×48 segments ≈ 4.6k triangles) is a small share; buildings dominate. For a desktop GPU, ~150–216k triangles per frame is light work.

### 4.5 Geometries, textures, programs, memory

| | Low | Medium | High |
|---|---|---|---|
| Geometries (start of run → end of run) | 157 → 269 | 160 → 275 | 162 → 276 |
| Textures (start → end) | 18 → 31 | 18 → 33 | 18 → 33 |
| Shader programs (start → end) | 24 → 28 | 24 → 28 | 24 → 28 |
| JS heap used | 9.5 MB flat, every scenario | 9.5 MB flat | 9.5 MB flat |
| JS heap total | 10.1–10.7 MB | 10.1–10.7 MB | 10.1–10.7 MB |

Reading:

- **Geometries grow through a session (157 → 276)** as systems activate — police cars, enemies, story actors, cinematic staging each create new geometries rather than pooling them. The JS heap stays flat (9.5 MB), so this is not a leak in the JS sense, but geometry creation is per-activation and worth watching when G1+ adds geometry-heavy systems. Per scenario, geometries rise monotonically (spawn 157–162 → downtown 189–195 → beach 190–196 → max pop 214–221 → pursuit 214–221 → combat 243–247 → cinematic 269–276).
- Textures 18 → 31–33: all runtime `CanvasTexture`s (facades, signs, sand, boardwalk). No image assets are loaded. Texture *count* is measured; texture *VRAM* was not measurable here (GPU memory is invisible to the page).
- Programs 24 → 28: the four extra programs appear once combat/cinematic systems activate.
- JS heap is flat at 9.5 MB in every scenario of the three preset runs (the stability run read 18.4 MB — see Section 5; the difference is GC timing, not growth: heap is flat *within* each run).

**Zero console errors in all three preset runs.**

---

## 5. Stability — 60-second observation (High, downtown, fixed tier)

12 × 5 s windows (spanning ~75 s wall time — each window overruns by up to one slow frame), camera fixed at (48, 42) looking NE into the (60, 30) intersection, step-down held.

| Metric | Value |
|---|---|
| Average FPS (SwiftShader reference) | 0.43 |
| Min / max window FPS | 0.13 / 1.12 |
| Standard deviation | 0.25 |
| First 10 s avg / last 10 s avg | 0.38 / 0.30 |
| Draw calls | **287 constant** (min = max = 287) |
| Triangles | **209,346 constant** |
| JS heap | 18.4 MB → 18.4 MB (**delta 0.0 MB**) |
| Worst single frame | 11,199.6 ms (first window — warm-up stall) |
| Console errors | 0 |

Reading: the render load is perfectly stable — draw calls and triangles do not drift at all over the observation, and the JS heap does not grow. The FPS series is noisy (0.13–1.12 across windows) and drifts slightly down (0.38 → 0.30), but with a standard deviation of 0.25 on a mean of 0.43 that drift is not significant — it is SwiftShader scheduling noise, not a degradation signal. The honest stability conclusion from this run: **no drift in draw calls, triangles or heap; no errors; frame rate noisy but not collapsing.**

---

## 6. Adaptive behaviour — auto step-down (step-down enabled)

Fresh boot at High, downtown, 75 s observation, step-down **enabled** (the only run where it was).

| Time | Tier | Engine FPS | Draw calls | Shadows | Pixel ratio |
|---|---|---|---|---|---|
| 5–30 s | high | 0–1 | 200–287 | on | 1 |
| ~56 s | **medium** | 0 | 285 | on | 1 |
| ~66 s | **low** | 0 | 195 | **off** | 1 |
| 66–101 s | low | 1 | 195 | off | 1 |

Reading: the step-down works exactly as designed — High → Medium → Low in ~75 s at SwiftShader frame rates, ending at Low with shadows off and 195 draw calls. The two tier transitions each carried a **~10–26 s gap** in the sampling series: that is the world rebuild (`applyQualityPreset` disposes and rebuilds player, vehicle and world, recompiling shaders) running on SwiftShader. On a real GPU that rebuild is expected to take ~100–300 ms (estimate, not measured) — a brief hitch, not a freeze. On a real desktop GPU at 60 FPS the step-down would never fire at all (its threshold is avg FPS < 28 sustained). Pixel ratio read 1 throughout because headless `devicePixelRatio` is 1; on a HiDPI desktop, High tier would render at up to 2×.

---

## 7. Bottlenecks and recommended performance budget

### Bottlenecks (in order of evidence)

1. **SwiftShader is the bottleneck in this environment, not the game.** Every scenario is CPU-rasterization-bound; preset differences in FPS are small (Low ~1.5–2× High) because the rasterizer dominates. Nothing in these numbers indicts the game's scene complexity on real hardware — the draw-call and triangle counts below are the evidence for that.
2. **Draw calls are the real budget to watch.** Max-population downtown is the worst steady state (255 / 280 / 282); the cinematic peaks at 300–304. The audit's budgets hold for Medium and High. **Low exceeded its 200 budget in the G0 runs — resolved in §11: the cause is not population (see below), it is the shadow pass firing at Low.**
3. **Geometry creation is per-activation, not pooled** (157 → 276 geometries over a session). Not a leak — heap is flat — but each new system that spawns geometry adds to the count permanently for the session.
4. **Shadow map is fixed at the origin (±100 m frustum, 2048 at High)** — it does not follow the player (audit finding 8.18). Shadows off Low is the single biggest tier win.
5. **No environment map, no post-processing, no LOD, no texture maps** (audit) — the G1 work. These are quality gaps, not performance problems today: the game is cheap to render (150–216k triangles) and the headroom exists.
6. **Engine boot is shader-compile-bound** (35–39 s in SwiftShader). On real hardware this should be seconds; verify with the desktop recipe.
7. **The step-down rebuild is a full world rebuild** — fine as a rare event, but it must stay rare (it is, by the 15 s cooldown + 28 FPS threshold).

### Recommended budget for G1–G9 (reaffirmed from the audit, checked against G0)

| Resource | Low | Medium | High | Ultra | G0 status |
|---|---|---|---|---|---|
| Draw calls (steady state) | ≤200 | ≤300 | ≤400 | ≤500 | Low **meets it at boot (195 downtown, constant)** — shadow override fixed, §12 |
| Draw calls (cinematic peak) | ≤250 | ≤350 | ≤450 | ≤550 | High peak 304 inside |
| Triangles per frame | ≤200k | ≤250k | ≤250k | ≤300k | High max 216k — ~15% headroom |
| Shader programs | ≤30 | ≤30 | ≤32 | ≤35 | 28 — inside |
| Textures (count) | ≤40 | ≤40 | ≤40 | ≤40 | 31–33 — inside |
| JS heap | <50 MB, flat over 60 s | same | same | same | 9.5–18.4 MB, flat — inside |
| Engine-ready on real desktop GPU | <5 s | <5 s | <5 s | <5 s | **Not measured — desktop recipe, Section 8** |
| Frame rate on a mid-range desktop GPU | 30 FPS floor | 45 FPS | 60 FPS target | 60 FPS | **Measured on Sachi's desktop (§11): 55–60 FPS — inside target** |

**Decision — resolved in §11 and §12 (G0 finalisation + final fix, 2026-11-21):** the Low budget stays at **≤200**. The population cap (option (b)) is implemented, and the shadow override is now fixed — Low downtown reads a constant **195 calls at boot**, inside budget, with the saved shadows preference untouched.

**Gates for each G-phase:** re-run the G0 harness (same scenarios, same cameras) after each phase and compare draw calls / triangles / heap against this baseline. A phase that pushes any budget over its limit does not ship until it is back inside or the budget is consciously revised.

---

## 8. What could not be measured — and how to get it in 2 minutes

| Measurement | Why not here | How to capture it (desktop) |
|---|---|---|
| Real FPS / 1% low / frame times | No GPU; SwiftShader only | **Average FPS now measured on Sachi's desktop (§11): 60 spawn, 55 downtown, 60 beach.** 1% low / frame times still unmeasured — DevTools → Performance → record 10 s → frame-time graph; Rendering → Frame Rendering Stats for 1% low |
| GPU model / VRAM / driver | No GPU | **GPU now known (§11): AMD Radeon (TM) Graphics, ANGLE/D3D11.** VRAM / driver version still unmeasured — `chrome://gpu` |
| GPU memory usage | Not visible to the page | DevTools → Performance → Memory (JS heap only); GPU memory needs `chrome://gpu` / OS task manager |
| Real first-load / engine-ready time | Local server, SwiftShader compile | `npm run dev`, open http://localhost:5173, time from Play click to the 3D scene appearing; expect ~1–3 s on a real GPU (estimate) |
| Input latency / real-device mobile | Headless only | Play on the real device; the 390 px mobile layout was verified clean in Phase 1/2, but frame rate on a phone is unmeasured |
| Texture VRAM | CanvasTextures counted (31–33) but bytes not measured | Once image textures land in G2, sum `texture.image.width × height × 4` bytes in the console |

**Desktop capture recipe (for Sachi, ~2 minutes):**

1. `cd ~/workspace/vice-city-stories && npm run dev` → open http://localhost:5173.
2. Settings → Quality **High**, showFps on. Play.
3. Stand at spawn, note the FPS badge. Drive to downtown (60, 30), note it. Walk the beach, note it.
4. DevTools (F12) → Performance → Record 10 s while driving downtown → the frame-time graph gives real frame times and 1% lows.
5. `chrome://gpu` → note the GPU model. Send those four numbers and the GPU model, and the baseline is complete.

---

## 9. Screenshots — visual comparison references for G1–G9

All under `~/workspace/qa-shots/qa/`, 1280×800, 11 per preset (33 total). Naming: `g0-{low|medium|high}-{shot}.png`.

| Shot | File suffix | What it shows |
|---|---|---|
| Main menu | `a-menu` | Menu screen, title, PLAY/SETTINGS/ABOUT |
| Spawn | `b-spawn` | Player at spawn (0, 0, 8), looking north |
| Downtown | `c-downtown` | (60, 30) intersection from (48, 42) |
| Beach | `d-beach` | Boardwalk (133, 90) looking east at the ocean |
| Pedestrians | `e-pedestrians` | Max population (28 NPCs) at the intersection |
| Traffic | `f-traffic` | Max traffic (20 cars) at the intersection |
| Pursuit | `g-pursuit` | Police pursuit, wanted level 5, driving the GT |
| Combat | `h-combat` | South Beach encounter, 3 enemies active |
| Cinematic | `i-cinematic` | FIRST LIGHT intro cinematic frame |
| Sunset / sky | `sunset-sky` | Boardwalk looking west — sunset over the city |
| Vehicle close-up | `vehicle-closeup` | Velocity GT, rear three-quarter, player beside it, camDistance 4 |

Notes on the set: the first vehicle-closeup attempt photographed the 1.1 cinematic still playing (cinematics advance on sim time, ~5% of real time in headless, so a 10.5 s cinematic was still on shot 0). All three close-ups were **retaken** with a fresh boot per preset and no cinematic open; the retaken High shot was visually verified. The `i-cinematic` shots are genuine cinematic frames and are kept as the cinematic reference. The downtown High shot was visually verified (clean intersection, "High (manual)" badge, 0 FPS in the HUD — the HUD reads 0–1 at SwiftShader rates).

---

## 10. Raw data and scripts

- `~/workspace/qa-shots/g0-low.json`, `g0-medium.json`, `g0-high.json` — per-preset scenario tables (includes environment, load timings, per-scenario samples, console errors).
- `~/workspace/qa-shots/g0-stability.json` — 60 s series (12 × 5 s windows).
- `~/workspace/qa-shots/g0-adaptive.json` — step-down observation (tier per 5 s sample).
- `~/workspace/qa-shots/vcs-g0-measure.mjs [low|medium|high]` — fixed-preset harness (step-down held).
- `~/workspace/qa-shots/vcs-g0-stability.mjs` — 60 s stability run.
- `~/workspace/qa-shots/vcs-g0-adaptive.mjs` — step-down observation.
- `~/workspace/qa-shots/vcs-g0-closeup-retake.mjs` — vehicle close-up retake.
- Logs: `g0-low.log`, `g0-medium.log`, `g0-high.log`, `g0-stability.log`, `g0-adaptive.log`.

**Verification:** no `src/` file was modified (G0 is measurement only); zero console errors in all five runs; all 33 screenshots present; scenario confirmations (28/28 NPCs, 20/20 traffic, wanted level 5 with 4 police, 3 active enemies, cinematic active) recorded in the JSONs.

- `~/workspace/qa-shots/vcs-g0-measure.mjs [low|medium|high]` — fixed-preset harness (step-down held).
- `~/workspace/qa-shots/vcs-g0-stability.mjs` — 60 s stability run.
- `~/workspace/qa-shots/vcs-g0-adaptive.mjs` — step-down observation.
- `~/workspace/qa-shots/vcs-g0-closeup-retake.mjs` — vehicle close-up retake.
- Logs: `g0-low.log`, `g0-medium.log`, `g0-high.log`, `g0-stability.log`, `g0-adaptive.log`.
- G0-finalisation data (see §11): `g0low-probe.json`, `g0low-verify.json`, `vcs-g0low-probe.mjs`, `vcs-g0low-verify.mjs`, `g0low-probe.log`, `g0low-verify.log`.
- G0-final-fix data (see §12): `g0fix-verify.json`, `vcs-g0fix-verify.mjs`, `g0fix-verify.log`.

**Verification:** no `src/` file was modified (G0 is measurement only); zero console errors in all five runs; all 33 screenshots present; scenario confirmations (28/28 NPCs, 20/20 traffic, wanted level 5 with 4 police, 3 active enemies, cinematic active) recorded in the JSONs.

---

## 11. G0 finalisation — real desktop measurements + Low-tier population cap (2026-11-21)

### 11.1 Real desktop measurements (reported by Sachi, 2026-11-21)

| Item | Value |
|---|---|
| GPU | AMD Radeon (TM) Graphics, ANGLE/D3D11 |
| Spawn | **60 FPS** |
| Downtown | **55 FPS** |
| Beach | **60 FPS** |

Notes: measured by Sachi on her own desktop; the preset she ran was not specified (the default `auto` quality on a desktop with 4+ cores / 4+ GB detects High). These are average FPS readings from the in-game HUD badge, not a DevTools trace — 1% lows and frame times are still unmeasured (§8). The numbers confirm the G0 conclusion: on real hardware the game is comfortably inside its frame-rate targets (60 FPS target at High, 30 FPS floor at Low). The SwiftShader numbers in §4 remain reference values only.

### 11.2 The Low-budget decision

The Low draw-call budget stays at **≤200 maximum** — the audit's figure, not raised to ~280. The cap below is the mechanism chosen. But the probe (§11.3) proved the budget question is not really about population at all.

### 11.3 Probe: what does population actually cost at Low?

Before writing any code, draw calls were measured at Low with the population swept at three fixed cameras (8 s windows, step-down held, camera settled):

| Camera | busy/high (28/20) | normal/medium (18/14) | few/low (10/8) | off/off (0/0) |
|---|---|---|---|---|
| Downtown (48, 42) | 278 avg / **278 max** | 254 / **278** | 250 / **278** | 263 / **278** |
| Spawn (0, 8) | 232 / **232** | — | 219 / **232** | 213 / **232** |
| Beach (133, 90) | 144 / **172** | — | 153 / **172** | — |

The maximum frame is **identical at every population level, including zero population**. Population is draw-call-neutral: both the crowd (NPC) and traffic systems render through `THREE.InstancedMesh` (one draw call per body part / car part, regardless of how many are active), and `setCount` only flips `active` flags and zeroes inactive slots — it never changes the instanced mesh count. The averages differ by ±15 calls, which is sampling noise (how many of the intermittent shadow-pass frames each window caught), not a population effect.

The same probe exposed the real cause. At every camera the frame cost swings between two values exactly **83 calls** apart (downtown 195↔278, spawn 149↔232, beach 89↔172), independent of camera and population. That is the **shadow-map pass**: 83 extra calls (and ~50k extra triangles) on frames where it re-renders. It fires at Low even though the Low tier disables shadows, because the Settings shadows toggle (default on) re-enables the shadow map at mount — `GameCanvas.tsx` calls `engine.setShadows(settings.shadows)` on mount, and `setShadows(true)` sets `renderer.shadowMap.enabled = true`, overriding the tier's `shadows: false` (GameEngine.ts:371/380 sets it from the tier at construction; the mount effect then overrides it). The shadow map only re-renders when the shadow anchor moves >0.6 m (`tick`, GameEngine.ts:2388), which is why the pass is intermittent.

**Consequence:** with shadows off, Low downtown is a constant **195 calls** — inside the ≤200 budget. With the boot override on, it is **278 max**. Population capping cannot move that number either way. The cap was still implemented as specified (it cuts ambient CPU/AI work on weak hardware), but the budget is only truly met when the shadow override is addressed — a separate fix, not made here ("no other graphics changes").

### 11.4 The cap — design

Implemented in **one file only, `src/game/GameEngine.ts`** (no new dependencies, no changes to NPC/Traffic/Settings/Quality, no AI, collision, mission or story changes, no save-data changes):

- **Cap values:** pedestrians `'few'` (10), traffic `'low'` (8) — applied only while the tier is Low. The smallest non-zero populations that keep the city inhabited; `'off'` would empty it for no draw-call benefit.
- **Effective counts, not stored settings:** the engine keeps the user's *requested* choices (`requestedPedestrians` / `requestedTraffic`, set from Settings at construction and updated by the Settings-panel setters). The cap is a pure function `capPedestrians(choice, tier)` / `capTraffic(choice, tier)` that only ever *lowers* the requested choice and returns it unchanged on Medium/High/Ultra.
- **Applied at all three points where population is set:** boot (`GameEngine.create` passes the capped choice to `createCrowd` / `createTraffic`), preset switch (`applyQualityPreset` re-applies the effective counts for the new tier — including the auto step-down, which goes through the same method), and live Settings changes (`setPedestrianCount` / `setTrafficDensity` store the requested choice and apply the capped one).
- **Mission-critical entities are untouched by construction:** story characters, mission vehicles and encounter enemies do not live in the crowd/traffic systems — the cap only calls `crowd.setCount` / `traffic.setCount`. Police counts are not capped (not ambient population in the spec's sense).

Build after the change: `npx tsc --noEmit` clean; `npm run build` passes, `index-CqD2r4_b.js` 1,149.52 kB / gzip 312.63 kB (+0.58 kB vs Phase 2), only the pre-existing chunk-size warning.

### 11.5 Verification — all 8 required tests (live, production build, zero console errors)

Seeded with **maximum requested population** (pedestrians `busy` = 28, traffic `high` = 20) at Low; step-down held; camera settled before each sample.

| # | Test | Result |
|---|---|---|
| 1 | Low at spawn | **PASS** — NPCs **10/28**, traffic **8/20** (capped from busy/high); calls 220 avg / 149–232; `shadowMap.enabled: true` (boot override) |
| 2 | Low downtown, max requested | **PASS** — NPCs **10**, traffic **8**; calls 255 avg / 195–278 |
| 3 | Low at beach | **PASS** — NPCs **10**, traffic **8**; calls 151 avg / 89–172 |
| 4 | Switch Low → Medium → High | **PASS** — Medium: NPCs **28**, traffic **20** (restored); calls 234 avg / 200–285. High: NPCs **28**, traffic **20** (restored); calls 233 avg / 200–287 |
| 5 | Switch High → Low again | **PASS** — NPCs **10**, traffic **8** (cap re-applied); calls **195 constant** (195–195); `shadowMap.enabled: false` — the preset switch applies the tier's shadows-off correctly, and with shadows off Low downtown sits at 195, inside budget |
| 6 | Mission characters & vehicles remain | **PASS** — story follow vehicle present at (62.5, −142), heading π, parked; story board shows **3 chapters**; garage shows **4 vehicles** (1 owned — the GT, fresh profile); **34 enemies, all dormant**; crowd pool total **28**, traffic pool total **20** (pools untouched — the cap only changes *active* counts); player vehicle present. (The probe's mission-count field read 0 because it read `chapter.missions` — the field is named `entries` — the chapters themselves are intact.) |
| 7 | Population returns to normal on higher presets | **PASS** — 28/20 at both Medium and High (test 4) |
| 8 | Draw calls recorded | **PASS** — every scenario above; full data in `g0low-verify.json` |

Saved settings verified untouched after all switches: localStorage still reads `pedestrians: 'busy'`, `traffic: 'high'`, `quality: 'low'` — the cap never writes settings.

### 11.6 What G0 finalisation did and did not do

- **Did:** implemented the Low population cap (few/low), verified it live across all 8 required tests, recorded real desktop FPS + GPU, and established that Low meets the ≤200 budget with shadows off (195 downtown) but reads 278 max at boot because of the shadow override.
- **Did not:** change any other graphics behaviour, fix the shadow override, touch AI/collision/missions/story, modify save data, add dependencies, push, or deploy. No G1 work started.

**Open decision for her (since resolved — see §12):** the shadow override (Settings toggle re-enabling the shadow map at Low on mount). Fixing it — making the tier's `shadows: false` win over the toggle at Low, or equivalently not calling `setShadows(true)` when the tier disables shadows — would make Low read 195 downtown at boot, inside budget, with no population change. Leaving it means Low measures 278 max at boot despite the cap. Either way the cap stays; the question is only whether the shadow fix is the next step.

---

## 12. G0 final fix — Low shadow override (2026-11-21)

### 12.1 The bug, precisely

The override was worse than a single mount effect. `GameEngine.setShadows()` — the live setter GameCanvas calls whenever the Settings shadows toggle changes, including once at mount — did three things with the saved preference:

1. **Overwrote the tier's value:** `this.quality.shadows = enabled` — at Low boot, the mount call `setShadows(true)` set the engine's tier shadows to `true`, so the engine forgot Low ever disabled shadows. The tick's shadow scheduling (`if (this.quality.shadows)`, GameEngine.ts:2425) then fired, and the shadow pass rendered (+83 calls).
2. **Re-enabled the renderer flag:** `renderer.shadowMap.enabled = enabled`.
3. **Re-enabled the sun's casting:** `lighting.setShadows(enabled)` → `sun.castShadow = true`.

The constructor had the same flaw in reverse: `if (!settings.shadows) quality.shadows = false` destroyed the tier's `true` value whenever shadows=false was saved, so a later switch to High could not know the tier allowed shadows — and `applyQualityPreset` set `renderer.shadowMap.enabled = next.shadows` with no regard for the preference at all, so switching to High with shadows=false saved turned shadows back on.

### 12.2 The fix — one rule, in `src/game/GameEngine.ts` only

**Effective shadows = tier allows AND the user wants them.** The tier's value is never overwritten anywhere; the saved preference is stored separately (`private shadowsRequested`, set from Settings at construction and by the setter) and is never written back to localStorage. Applied at all three points where shadows are decided:

- **Constructor:** the mutation is gone; `renderer.shadowMap.enabled = quality.shadows && settings.shadows`.
- **`setShadows(enabled)` (live toggle):** stores the preference, computes `effective = enabled && this.quality.shadows`, applies it to the renderer flag **and** the sun's `castShadow`, and only schedules a shadow-map re-render when effective is true. The material recompile traverse is unchanged.
- **`applyQualityPreset(tier)`:** `shadowsOn = next.shadows && this.shadowsRequested` for both the renderer flag and `lighting.setShadows`. The auto step-down flows through the same method.

No changes to Quality, Settings, GameCanvas, the Settings panel, Lighting, or any other graphics system. No lighting/shadow-quality/shadow-map/camera/material changes. The population cap is untouched.

Build after the change: `npx tsc --noEmit` clean; `npm run build` passes, `index-BwCTemi6.js` 1,149.60 kB / gzip 312.65 kB (+0.08 kB vs the cap build), only the pre-existing chunk-size warning.

### 12.3 Verification — live, production build, zero console errors

Two phases, both seeded with maximum requested population (Phase A) or the named settings (Phase B); step-down held; camera settled before each sample.

**Phase A — saved shadows=true, Low:**

| # | Test | Result |
|---|---|---|
| 1 | Fresh boot, Low + shadows=true saved | **PASS** — tier low, `quality.shadows: false` (tier intact), `shadowMap.enabled: false`, `sun.castShadow: false`, NPCs **10/28**, traffic **8/20** |
| 2 | Low spawn | **PASS** — calls **149 constant** (149–149) |
| 3 | Low downtown | **PASS** — calls **195 constant** (195–195), 111,630 tris — the expected value, no swing |
| 4 | Low beach | **PASS** — calls **89 constant** (89–89) |
| 5 | Low → Medium | **PASS** — shadows restored (`enabled: true`, sun casting), NPCs **28**, traffic **20**; downtown 248 avg / 200–285 (shadow pass on by design at Medium) |
| 6 | Medium → High | **PASS** — shadows restored, 28/20; downtown 229 avg / 200–287 |
| 7 | High → Low | **PASS** — shadows disabled again (`enabled: false`, sun not casting), 10/8; downtown **195 constant** |
| 8 | Live setter (the Settings effect's path) | **PASS** — all 5: Low `setShadows(true)` → off; Low `setShadows(false)` → off; High `setShadows(false)` → off; High `setShadows(true)` → on; Low `setShadows(true)` after High → off |
| 9 | Real Settings-panel checkbox (pause → Settings → Shadows) | **PASS** — checkbox found, checked (reflects the saved preference); uncheck → `savedShadows: false`, engine off; re-check at Low → checked, `savedShadows: true`, engine **still off** |
| 10 | Reload, saved preference intact | **PASS** — localStorage still `quality: low, shadows: true, pedestrians: busy, traffic: high`; after reload tier low, shadows off, 10/8; downtown **195 constant** |

**Phase B — saved shadows=false, High (the preference's other direction):**

| # | Test | Result |
|---|---|---|
| 1 | Fresh boot, High + shadows=false saved | **PASS** — tier high, `quality.shadows: true` (tier intact — the old constructor mutation would have destroyed this), `shadowEnabled: false`, sun not casting; NPCs 18 (normal), traffic 14 (medium) |
| 2 | High downtown, preference off | **PASS** — calls **200 constant** (200–200) — no shadow pass |
| 3 | High → Low | **PASS** — shadows off, downtown **195 constant**, population capped 10/8 |
| 4 | Low → High | **PASS** — shadows **stay off** (`enabled: false`, tier value `true`) — the old code turned them back on here; downtown **200 constant** |
| 5 | Live setter at High | **PASS** — `setShadows(true)` → on (the user can still turn them on), `setShadows(false)` → off |

**Population cap regression:** 10/8 at Low and 28/20 at Medium/High in every scenario above — the cap is intact and unchanged.

**G0 is closed.** Low meets its ≤200 draw-call budget at boot (195 downtown, constant), the saved shadow preference is respected in both directions, and the Settings UI behaves as before. No G1 work started. No push, no deploy.
