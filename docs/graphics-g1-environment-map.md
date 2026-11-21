# G1.1 — Environment Map & Realistic Reflections

**Status:** implemented, verified live in headless Chrome (SwiftShader), 2026-11-21.
**Scope:** environment map only. No building redesign, no new vehicle models,
no character redesign, no new textures, no bloom or post-processing, no
story/mission/control/save-data changes, no new dependencies, no push, no
deploy. G0, Phase 9F and all approved gameplay fixes are preserved.

## What it is

One `THREE.PMREMGenerator` pass at engine boot, from the **existing sunset
sky** — no HDR image, no new dependency. The result is assigned to
`scene.environment` and reused for the whole session. It lights every
standard/physical material with the same sunset the player sees: car paint
and clearcoat reflect the orange sky, glass and rims pick up warm
highlights, dark paint stops reading as pure black.

## Implementation

Only two source files changed.

### `src/game/Lighting.ts`

- `LightingHandle` gains `environmentScene: THREE.Scene`.
- `createLighting` builds it from **clones** of the sky dome and the sun disc
  (shared geometry/material with the live sky — the clones are never disposed
  here; the live sky's dispose covers the shared resources).
- The sun disc is now named `'sun-disc'` (was unnamed).

### `src/game/GameEngine.ts`

- New module constant `ENVIRONMENT_INTENSITY = 0.55` — how strongly the env
  map lights the scene (`scene.environmentIntensity`). 1.0 would roughly
  double the ambient on top of the hemisphere light and wash out the sunset
  palette; 0.55 keeps reflections clearly visible while the diffuse lift
  stays a soft bounce.
- New fields: `private envMapTarget: THREE.WebGLRenderTarget | null` and
  public `envMapMs: number | null` (QA hook: how long the one-time PMREM
  pass took at boot, ms).
- Factory (`GameEngine.create`), immediately after `createLighting`:

```ts
const t0 = performance.now();
const pmrem = new THREE.PMREMGenerator(engine.renderer);
const envRT = pmrem.fromScene(engine.lighting.environmentScene, 0, 0.1, 1000);
engine.scene.environment = envRT.texture;
engine.scene.environmentIntensity = ENVIRONMENT_INTENSITY;
engine.envMapTarget = envRT;
engine.envMapMs = performance.now() - t0;
pmrem.dispose();
```

`far = 1000` because the sky dome sits at radius 600 and the sun disc at
~415. `pmrem.dispose()` runs immediately after generation. The map is
generated **once, never per frame**, and survives quality rebuilds (only the
world handle rebuilds; the scene persists). It costs **zero draw calls**.

- `dispose()`: `scene.environment = null` + `envMapTarget.dispose()` just
  before `scene.clear()`. Disposal verified live (see §5).

### Materials — no per-material changes were needed

No `envMapIntensity`, roughness or metalness value was changed. The defaults
plus the 0.55 global intensity delivered the improvement (see §3). In
particular:

- Vehicle paint (`MeshPhysicalMaterial`, metalness 0.55, roughness 0.3,
  clearcoat 1) — now reflects the sunset.
- Vehicle glass (metalness 0.9, roughness 0.12) and rims (0xc8ccd2,
  metalness 0.9, roughness 0.25) — warm highlights, rims visible.
- Building glass facades (metalness 0.55, roughness 0.32) — warmer, lit
  panes more visible; still dark head-on, which is physically plausible for
  dark glass at normal incidence (Fresnel). Stronger mirror-glass is a G3
  facade job, not a G1.1 retune.
- Traffic paint deliberately left alone (metalness 0.05 — the dielectric
  value is correct with an env map too; the old comment about metalness
  turning paint black no longer applies, but the value itself was already
  right).
- The protagonist's gold chain (metalness 0.75) now glints.
- Sky dome and ocean are `ShaderMaterial` / `MeshBasicMaterial` and are
  unaffected by `scene.environment` by construction — the sky and ocean look
  identical before/after (confirmed in shots D and E).

## Before / after screenshots

Same fixed cameras, High preset, same seed, before and after. Files under
`~/workspace/qa-shots/qa/` (`g1-before-*.png` / `g1-after-*.png`).
Harness: `~/workspace/qa-shots/vcs-g1-capture.mjs`.

### A — Velocity GT close-up

- **Before:** flat dark red, near-black roof/glass, rims invisible.
- **After:** vivid reflective cherry red with a warm clearcoat gradient
  across the side panels, rims clearly visible, warm highlight along the
  roofline. The car reads as painted metal, not a flat cut-out.

### B — other garage vehicles (garage bay, rear view)

- **Shadow LX:** the most dramatic change in the set. Before it was a pure
  black silhouette — you could not tell what colour it was. After it reads
  as a dark blue sedan with a warm sunset gradient across the roof and rear
  deck. This is the audit's "metalness turns black" problem, fixed.
- **Vortex RS:** flat orange-red → vivid orange with a warm gradient on the
  rear deck. The protagonist's gold chain glints at the neck in the after
  shot.
- **Trailhawk X:** dark green with a near-black roof → readable green SUV
  with a sunlit warm roof and visible roof rack.

### C — downtown glass buildings

- **Before:** beige facades, flat; dark glass tower near-black.
- **After:** facades warmer and more luminous, lit windows read warmer.
  The dark glass tower is still dark head-on (see §2). No washout, palette
  preserved.

### D — beach and boardwalk

- **Before/after nearly identical**, as expected: sand (roughness 1) and
  boardwalk (0.9) get only a slight warm lift; the ocean shader and the sky
  are unchanged by construction. The railing metal (0.6/0.5) is too thin at
  this distance to judge — it is a close-up matter, not a beach-shot one.

### E — sunset skyline (from the beach, looking west)

- **Before:** beige buildings, pale sand, flat red sky.
- **After:** the whole city reads warmer and more luminous — facades glow
  warm orange, windows brighter — while the sky itself is pixel-identical.
  The scene is still unmistakably Vice City Stories.

**Verdict:** the improvement is real and visible where it matters most
(vehicle paint, the previous black-paint failure), modest on facades, subtle
on the beach. No material went chrome, nothing turned black, the sunset
palette survived.

## Performance

Headless Chromium + SwiftShader (software rasteriser). FPS numbers from
here are **not** desktop evidence — see §6.

| Shot | Before (calls / tris) | After (calls / tris) |
|---|---|---|
| A GT close-up | 214 / 203,326 | 214 / 203,326 |
| B Shadow LX | 232 / 204,578 | 145 / 127,782 |
| B Vortex RS | 145 / 127,806 | 145 / 127,806 |
| B Trailhawk X | 144 / 127,410 | 144 / 127,410 |
| C downtown | 200 / 132,550 | 200 / 132,550 |
| D beach | 92 / 124,676 | 92 / 124,676 |
| E skyline | 278 / 208,446 | 278 / 208,446 |

- **Draw calls: unchanged.** Every shot is identical before/after except
  B-Shadow, where the before frame caught the shadow pass (232) and the
  after frame caught a no-shadow instant (145) — the same 145 the Vortex
  and Trailhawk shots read. The env map adds zero draw calls.
- **JS heap:** 23.4 MB before → 22.0 MB after (noise-level; the env map is
  GPU texture memory, ~2–4 MB at 256², not JS heap). No leak observed.
- **PMREM generation time (`envMapMs`):** 1,501 ms (High capture),
  1,224 ms (Low preset check) — in **SwiftShader software rendering**.
  On a real GPU the audit estimates 50–150 ms. It runs once during the
  loading screen, never per frame, and produces no stutter after boot.
- **Boot (headless, navigation → engine ready):** 18,858 ms before →
  24,907 ms after. The +6 s is the SwiftShader PMREM pass plus run
  variance; it is not a real-load number (G0 measured 35–39 s engine-ready
  in the same environment).

### Presets and the Low shadow rule (all PASS, zero console errors)

Harness: `~/workspace/qa-shots/vcs-g1-presets.mjs` → `g1-presets.json`.

| Check | Result |
|---|---|
| Low boot | env present, intensity 0.55, shadows **off**, population capped 10/8 |
| Low downtown draw calls | **195 constant** (avg/min/max all 195) — G0 budget holds |
| Medium | env present, shadows on, population restored 28/20 |
| High | env present, shadows on, population restored 28/20 |
| Low again (after High) | env present, shadows off, population capped 10/8 |
| Low downtown again | 195 constant |
| Saved settings after all switching | intact (quality low, shadows true, busy/high) |
| `dispose()` | clean, no error |

The G0 final fix (effective shadows = tier allows AND user wants them) is
intact: the env map does not touch the shadow path.

## Regression

- `npx tsc --noEmit`: clean.
- `npm run build`: passes — `index-jBpzam6X.js` 1,150.03 kB / gzip 312.82 kB
  (was 1,149.60 / 312.65 — +0.43 kB), only the pre-existing chunk-size
  warning.
- qa81 regression: **GREEN** (exit 0, zero console errors). Cash chain exact
  at every step (BEACON RUN 12,500 → sprint 12,340 → garage 4,040 →
  carbine 2,840 → South Beach 3,090 → North Dunes 3,340, +250 each);
  all 4 garage vehicles owned; carbine bought; both encounters completed;
  contract active (3 remaining, 247 draw calls); arrest cycle reached
  BUSTED with a clean respawn (heat 0, level 0). The **only** mismatch is
  the known pre-existing carbine-magazine flake: 27 after 5 shots vs 25
  expected (seen as 26 on earlier runs; combat code untouched by this
  change).
- Zero console errors in every capture, preset and regression run.

## Limitations and honest notes

- **Desktop FPS was not measured here.** Only headless SwiftShader exists
  in this VM. The G0 baselines are Spawn 60 / Downtown 55 / Beach 60 FPS
  (real desktop, AMD Radeon, ANGLE/D3D11, supplied by Sachi). The env map
  adds no draw calls and no per-frame work, so no regression is expected —
  but it must be confirmed on her desktop. The check: load the game, play
  2 minutes, read the FPS badge at spawn, downtown and the beach, and
  compare with 60 / 55 / 60. If Low feels slower at boot, the fallback is a
  128² map or skipping the env on Low — not yet needed.
- `envMapMs` in SwiftShader (1.2–1.5 s) is a software artefact, not a load
  time a player will see.
- The A-shot framing is a top-down three-quarter view, not a tight
  close-up (the chase camera sits behind the player at distance 4). The
  paint difference is still clearly visible in it.
- Dark glass facades stay dark head-on (physically plausible; G3).
- The FPS badge reads 0–1 in headless screenshots — a SwiftShader
  artefact, not a measurement.

## Files changed

- `src/game/Lighting.ts` — `environmentScene` on the handle, sky clones,
  sun disc named.
- `src/game/GameEngine.ts` — `ENVIRONMENT_INTENSITY`, `envMapTarget`,
  `envMapMs`, one-time PMREM generation in the factory, disposal in
  `dispose()`.
- `docs/graphics-g1-environment-map.md` — this report.
- QA: `~/workspace/qa-shots/vcs-g1-capture.mjs`,
  `vcs-g1-presets.mjs`, `g1-before.json`, `g1-after.json`,
  `g1-presets.json`, screenshots `qa/g1-{before,after}-*.png`.

No save-data changes. No new dependencies. No push, no deploy.
**G1.1 is the env map only — do not start G1.2 without approval.**

## Addendum — G1.2 Stage 1 (2026-11-21, approved and implemented)

One static 128² downtown probe, GT paint + glass only, sky PMREM kept — see `docs/graphics-g1-stage-1-results.md` for the full report. Pipeline PASS (bake, assignment, presets, garage gate, zero draw-call change, qa81 green). Visual requirement NOT MET on the GT's flat bodywork: the sides go darker (side −26 R) because flat panels reflect the dark towers as one uniform colour; the downtown test proves it is not a position problem. Boot cost on the desktop still needs her loading-screen timing.
