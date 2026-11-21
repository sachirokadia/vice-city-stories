# City-Aware Reflection Design — G1.1 Follow-Up

**Status:** Design only. No production code changed. No G1.2 implementation.
**Date:** 2026-11-21
**Author:** Muse (design investigation for Sachi)
**Related docs:** `docs/graphics-baseline-g0.md`, `docs/graphics-g1-environment-map.md`,
`docs/realistic-graphics-transformation-audit.md`
**Related evidence:** `~/workspace/qa-shots/g1-diag.json`, `~/workspace/qa-shots/g1-diag.log`,
`~/workspace/qa-shots/qa/g1-diag-side-envoff.png`, `~/workspace/qa-shots/qa/g1-diag-side-envon.png`

---

## 1. Summary and recommendation

**Recommended architecture: E — hybrid. Keep the existing sky PMREM as
`scene.environment` (the global warm sunset ambient), and add a small set of
static city reflection probes (B), produced by a dedicated capture scene
built from the original city geometry (D). Assign the probe maps only to the
materials that need recognizable reflections: vehicle paint, vehicle glass
and rims, and the downtown glass facades.**

The static probes deliver roughly 80% of the visual win of a live system
for roughly 0% of the runtime cost: they add zero draw calls, zero per-frame
work, and about 4–6 MB of GPU memory. The live CubeCamera option (C) is the
only one that is strictly more accurate, and it is the only one that risks
the G0 desktop baseline (60 / 55 / 60 FPS) — it is deferred to an optional
later stage, gated by measured FPS, High preset only.

**Staged plan (all gated by Sachi's approval, one stage at a time):**

| Stage | What | Proves |
|---|---|---|
| 1 — Isolated probe | One static city probe (downtown), baked at boot, assigned to the Velocity GT's paint + glass only. No building changes. | The bake → PMREM → assign pipeline works end to end, and the reflection is *localized* (see §12). |
| 2 — Probe set + glass | Four probes (downtown / spawn / beach / garage), nearest-probe assignment for all player vehicles, downtown glass facades take the downtown probe. | Reflections match the local district; glass towers reflect towers. |
| 3 — Optional | Dedicated capture scene (D) for cleaner bakes; coastal glass variant; storefront glass; live CubeCamera (C) for High only, FPS-gated. | Cleaner content, more glass, live accuracy — only if Stages 1–2 hold the FPS baseline. |

**What this design does NOT do:** no wet-street reflections (the reference
images of puddles are a different system — road materials, §3), no curved
car bodywork (the flat extruded sides limit reflections to blocky panels,
§8), no mirror-perfect windows (glass roughness 0.32 blurs by design).

---

## 2. What the diagnostic proved (recap, with numbers)

The G1.1 visual diagnostic (`g1-diag.json`, zero errors) established:

- The sky PMREM **is** generated and assigned: 256² CubeUV render-target
  texture, `scene.environment`, intensity 0.55, same texture across Low →
  High → 20 s of play. No disposal, no replacement.
- All 906 materials are capable and unsuppressed: zero `envMapIntensity`
  overrides, zero explicit `envMap`. GT paint is MeshPhysicalMaterial,
  metalness 0.55, roughness 0.3, clearcoat 1, clearcoatRoughness 0.1.
- The env scene contains **only** the sky dome and the sun disc. Pixel
  stats of the env scene: top half mean [172, 40, 30], bottom half mean
  [253, 111, 50] — a smooth two-tone gradient plus the sun disc. No
  buildings, no street, no ground.
- The measured effect is a **global warm lift, not a localized
  reflection**: GT car-box delta env-off → env-on is +39 red at the side
  angle, while the whole-frame delta is +40 red. The paint reflects no
  more than the average surface. A global colour change does not count
  as a successful reflection — and this is why the gameplay screenshot
  did not read as "reflections".

Two corrections to the G1.1 report, recorded here so the design starts
from true facts:

1. **"Only 3 meshes use the glass style" was a mesh count, not a surface
   area.** The glass style covers the *entire downtown district* — every
   downtown tower. The 3 meshes are the batched meshes (one per
   repeat-variant material, see §5). The glass surface area is large,
   which makes assigning a probe to the glass material a high-payoff
   change, not a marginal one.
2. **The lower half of the current env map is wrong.** It is bright
   sunset orange (#feb47b) because the sky dome's bottom is orange.
   In reality the lower hemisphere seen by a car or a facade is dark
   asphalt, buildings and ground. A city capture fixes this: the lower
   hemisphere becomes dark city, which is also why the current env
   over-brightens downward-facing surfaces.

---

## 3. The visual target — what the reference images actually ask for

The ten reference images supplied 2026-11-21 split into three distinct
systems. Only two of them are in scope for reflection probes.

| Reference theme | Images | System | Probe relevance |
|---|---|---|---|
| Car paint reflecting identifiable buildings, sky and sun | Black Porsche with bronze wheels; red car rear; black car + glass towers; yellow car side glass; red Porsche hood reflecting a tower | Vehicle paint / glass (metalness 0.55–0.9, roughness 0.12–0.3, clearcoat) | **Directly addressed.** A city probe gives the paint real content to reflect. |
| Glass facades reflecting neighbouring towers | Glass tower reflecting towers; blue glass tower reflecting a white tower; orange sunset in glass | Facade glass (metalness 0.55, roughness 0.32) | **Directly addressed.** A city probe assigned to the glass material makes towers reflect towers. |
| Wet streets reflecting sky, sun and buildings | Dusk wet street; sunset street with sun in puddles; wet street reflecting buildings | Road / ground materials (currently roughness 0.95, metalness 0) | **Not addressed by probes.** Wet-looking roads need a road-material change (lower roughness, higher metalness, or planar reflections) — a separate G4/roads item. Do not expect puddle reflections from this design. |

**Vehicle requirement, restated precisely:** it must be possible to
recognise surrounding buildings, sky and city structures in the car
paint. A global colour change does not count. The acceptance test for
this is in §12: after the probe is assigned, the car-box pixel delta
(probe-on vs probe-off) must be *larger* than the full-frame delta —
proving the effect is localized to the reflective surfaces, not a
global lift.

---

## 4. Architecture as it stands (inspection findings)

All facts below were read from the current source on 2026-11-21. File
paths are relative to `~/workspace/vice-city-stories/src/game/`.

### 4.1 Scene lifecycle — what survives, what rebuilds

`GameEngine.create` (factory, `GameEngine.ts` ~line 465) builds, in order:
lighting → sky PMREM (`scene.environment`) → `buildWorld` → range,
encounters, enemies, contracts, story encounters → player → active
vehicle → crowd → traffic → police.

`applyQualityPreset` (`GameEngine.ts:815`) **disposes and recreates the
player, the vehicle and the whole world** (fresh `buildWorld`), and
re-attaches the weapon and outfit. Crowd, traffic and police *survive*
(only `setCount`); lighting survives; `scene.environment` survives
(the scene persists, only the world handle rebuilds).

**Consequence for probes:** the probe *textures* survive a preset switch
(they are engine-owned render targets, not world-owned), but every
*material assignment* dies with the rebuild — vehicle paint (new
`buildVehicleMesh` per vehicle), facade glass (new `buildBuildings`
materials), everything. Probe assignment must therefore be a single
re-applied step, called at the end of the factory, at the end of
`applyQualityPreset`, and after `garageSelect` (which also disposes and
recreates the vehicle, `GameEngine.ts:1763`). This is the same shape as
the existing outfit re-application (`player.applyOutfit(...)` after
rebuild) — a known, working pattern in this codebase.

`dispose()` (`GameEngine.ts` ~line 2719) nulls `scene.environment` and
disposes the env target. Probe targets must be disposed in the same
place, or they leak one set of render targets per engine lifetime.

### 4.2 The sky env (G1.1) — what exists today

`Lighting.ts` (`createLighting`): sky dome (`SphereGeometry(600, 24, 16)`,
gradient ShaderMaterial, top `#16265e`, mid `#ff7e5f`, bottom
`#feb47b`, named `'sky-dome'`) + sun disc (`CircleGeometry(26)`,
MeshBasicMaterial `#ffdf8a`, at (−260, 42, −320), named `'sun-disc'`)
+ hemi (`#ffc49a`/`#332a44`, 1.25) + sun (`#ffc08a`, 2.4, shadow
frustum ±100). `LightingHandle` exposes `environmentScene` built from
clones of the sky dome + sun disc (shared geometry/material with the
live sky; the clones are never disposed separately).

`GameEngine.ts` factory: `pmrem.fromScene(lighting.environmentScene, 0,
0.1, 1000)` → `scene.environment`, `scene.environmentIntensity = 0.55`
(module constant `ENVIRONMENT_INTENSITY`). One PMREM pass at boot,
~1,683 ms in SwiftShader, real-GPU estimate 50–150 ms (unverified).
No per-material `envMap` anywhere in `src/` (verified by grep).

### 4.3 Materials — the reflection surface inventory

| Surface | Material | env-relevant params | Instances |
|---|---|---|---|
| Vehicle paint (all 4 cars) | MeshPhysicalMaterial, per-vehicle instance (`buildVehicleMesh`, `Vehicle.ts`) | metalness 0.55, roughness 0.3, clearcoat 1, clearcoatRoughness 0.1 | 1 per vehicle; `setPaint()` mutates colour only, so a probe assignment survives repaints |
| Vehicle glass (cabin) | MeshStandardMaterial, per-vehicle | metalness 0.9, roughness 0.12 | 1 per vehicle |
| Vehicle rims | MeshStandardMaterial, per-vehicle | metalness 0.9, roughness 0.25 | 1 per vehicle |
| Vehicle trim / tires | MeshStandardMaterial | metalness 0.4 / 0, roughness 0.6 / 0.95 | per-vehicle; tires will not show reflections (correct) |
| Downtown glass facades | MeshStandardMaterial, **shared across all downtown plots**, batched per repeat-variant (`facadeFor`, `Buildings.ts`) | metalness 0.55, roughness 0.32, canvas map (dark `#2e5a80` + dark panes) | 3 batched meshes carry the whole downtown district |
| Other facades (brick / pastel / hotel / concrete) | MeshStandardMaterial, shared + batched | metalness 0.05, roughness 0.85 | diffuse only; probes add only a faint warm tint — fine |
| Beacon Tower | MeshStandardMaterial | metalness 0.3, roughness 0.5 | 1 mesh |
| Ground / roads / pads | MeshStandardMaterial | roughness 0.95, metalness 0 | no reflection (correct for dry asphalt) |
| Signs | MeshBasicMaterial | — | env-irrelevant by construction |

Key facts for the design:

- **Vehicle materials are per-vehicle instances.** Per-vehicle probe
  assignment (nearest probe) is possible without touching any other
  car. The garage 3D preview renders `buildVehicleMesh` in its own
  small scene — assignment must happen at the GameEngine handle level,
  not inside `buildVehicleMesh`, or the preview would pick up probe
  maps too.
- **Facade materials are shared and batched.** One probe per glass
  material, not per building. All downtown glass takes the downtown
  probe — geographically correct, since downtown is one district.
- **`VehicleHandle` does not expose its materials.** The paint material
  is exposed on `VehicleMesh.paintMat`, but the handle returned by
  `createVehicle` does not carry it. Probe assignment needs either a
  small accessor on the handle (recommended: `paintMaterial()` /
  `glassMaterial()` returning the per-vehicle instances) or a traversal
  of `vehicle.group` matching materials by type. The accessor is
  cleaner and is the only `Vehicle.ts` change the design needs.
- **The car body is an extruded flat side profile** (bevel 0.05). Each
  side panel is flat, so it reflects a single env direction — a tower
  reflection reads as a colour block, not a warped shape. The reference
  images' curved, warped reflections (e.g. a whole tower warped across
  a hood) need curved bodywork — a G6 vehicles-v2 concern, not this
  phase. The probe still satisfies the stated requirement
  ("recognise surrounding buildings") — the shapes will be blocky but
  identifiable, plus a sun glint on the clearcoat.

### 4.4 City data — deterministic, tier-dependent

`CityGenerator.ts`: layout is deterministic (seed 20261119). Avenues at
x = −120, −60, 0, 60, 120; streets at z = −150, −90, −30, 30, 90, 150.
Districts: downtown north (cz < −90, towers 26–64 m, one big tower per
block), coastal east (cx ≥ 60, hotels 13–28 m), commercial (cz < 30),
residential south, two parks. Building counts by tier (`Quality.ts`):
Low 28, Medium 48, High 72, Ultra 96. **Downtown plots are ordered
first**, so a Low city still keeps the skyline; the plots dropped at
Low are mostly residential/commercial.

**Consequence for probes:** a probe baked from the High city shows
phantom buildings at Low (72 vs 28). Downtown is mostly intact at Low,
so a downtown probe baked at High is *mostly* accurate at Low — the
phantom content is smaller buildings, not the skyline. The design
handles this by baking for the *current* tier at boot and re-baking on
preset switch (§7), rather than baking once for all tiers.

### 4.5 What can be hidden during a capture — the exclusion list

Every dynamic or gameplay system owns exactly one top-level
`THREE.Group` added to the scene, so capture exclusion is a
`visible = false` toggle per group, restored afterwards. No layers are
used anywhere in the codebase today (grep: zero `.layers` uses), so
layers are available as a clean mechanism if a live system ever needs
one — but static bakes do not need them.

| Group | In capture? | Why |
|---|---|---|
| World group `'vice-city'` (buildings, roads, ground, pads, vegetation, beach/ocean, garage, shop, tower) | **Yes** | This *is* the content to reflect. |
| Lighting group (sky dome, sun disc, sun + hemi lights) | **Yes** | The sky and sun must appear in the probe, as they do in the real view. |
| Player group | **No** | The player must never appear in a reflection. |
| Active vehicle group | **No** | A car must not reflect itself. |
| Mission / story-follow vehicle group | **No** | Same — no self-reflection, and it is transient. |
| Crowd group (NPC InstancedMesh) | **No** | Pedestrians are dynamic; frozen mid-stride figures in a reflection read as a bug. |
| Traffic group (InstancedMesh bodies/wheels/lights) | **No** | Same; traffic positions change every second. |
| Police group (`'police'`) | **No** | Dynamic; also the light bar would bake a false glow into the probe. |
| Enemies group | **No** | Dormant enemies are hidden anyway; active ones are dynamic. |
| Range / Encounters / Contracts / StoryEncounters groups | **No** | Gameplay markers (glowing rings, signs, beacons, cover boxes) are not city content; baking them would put floating UI-like shapes in reflections. |
| Combat muzzle-flash Sprite | **No** | Transient; ensure no firing during the capture window (capture runs before the game loop starts). |
| Ocean / traffic-light animation | Frozen | `worldHandle.update` (ocean, signals) must not run during the capture; bake at a fixed world state — right after `buildWorld`, before the loop starts — for determinism. |

**Recursive reflections — how they are prevented:**

1. **Capture with no env active.** During the bake, set
   `scene.environment = null` and ensure no material carries an
   `envMap` (bake before any assignment, or temporarily clear
   assignments). Captured surfaces are then lit by direct lights only
   (sun + hemi) — the probe contains the city, not the city's own
   env lighting. If the capture ran with the sky env active, the probe
   would contain env-lit surfaces and materials sampling it would
   double-count the IBL (progressively brighter with each re-bake).
2. **Probe textures are never scene objects.** They are only sampled as
   `envMap`s; nothing in the scene renders them, so a probe can never
   capture itself.
3. **Live updates (C only) need one more guard:** during
   `CubeCamera.update`, additionally null the assigned probe `envMap`s
   (or move reflective objects to a layer the cube camera does not
   render). Otherwise each update bakes the previous probe's
   reflections into the next one — a feedback loop that brightens and
   smears with every cycle. Static bakes (A/B/D/E) do not have this
   problem, because the capture happens once, before assignment.

**Fog during capture:** `scene.fog` is `Fog(#e88a6b, near, far)` per
tier. Fog would haze distant towers inside the probe. Disable fog
during the capture and restore it afterwards, or the reflections will
carry a false orange haze.

---

## 5. The five approaches compared

All five use only three.js core (`CubeCamera`, `WebGLCubeRenderTarget`,
`PMREMGenerator.fromScene` / `fromCubemap`) in three 0.187 — no new
dependencies for any of them. The differences are in *what* is captured,
*when*, and *how many* textures the result needs.

Memory figures below are computed, not measured: a 128² RGBA8 cubemap is
6 × 128² × 4 B ≈ 0.38 MB (0.5 MB with full mip chain); a 256² cubemap is
≈ 1.5 MB (2 MB with mips). A PMREM'd (CubeUV) version retains roughly
2× the source cubemap; the raw cubemap can be disposed after the PMREM
pass, so the retained cost per probe is ≈ 1 MB at 128² and ≈ 4 MB at
256². Generation-time figures are estimates from the G0/G1.1 evidence
(the game renders 150–300 draw calls per frame; the sky PMREM took
1,683 ms in SwiftShader and an estimated 50–150 ms on a real GPU) —
they must be measured on the desktop during Stage 1 (§12).

### A. One static city cubemap

One CubeCamera capture at a representative point (e.g. the downtown
avenue), PMREM'd once at boot, used as the new `scene.environment`
(replacing the sky-only env) or assigned to the reflective materials.

- **Visual quality:** Good at the capture point — real towers, sky and
  street in the reflections, recognisable shapes. Wrong everywhere
  else: drive to the beach and the paint still reflects downtown
  towers. The mismatch is most visible when the surroundings change
  character (downtown → beach → tower plaza).
- **Reflection accuracy:** Correct at the capture point, increasingly
  wrong with distance from it. Error is a content error (wrong
  buildings), not a blur error.
- **Parallax:** None — a standard IBL limitation. The map is treated
  as infinitely distant; reflections do not shift as the car moves.
  Over a 300 m drive the reflected skyline is identical, which the eye
  notices mainly at district boundaries.
- **GPU memory:** ≈ 1 MB retained at 128², ≈ 4 MB at 256². (Plus the
  existing sky env if it is kept — see E.)
- **Generation cost:** One capture = 6 renders of the scene at capture
  resolution + one PMREM pass. Estimated 40–80 ms at 128² on a real
  GPU, once at boot, behind the loading screen.
- **Runtime performance:** Zero. A static texture, exactly like the
  current sky env. Zero extra draw calls.
- **Compatibility:** Core three only. `CubeCamera` + `PMREMGenerator`
  are already in use in this codebase in spirit (PMREM from a scene).
- **Presets:** One bake per tier is the honest answer (see §4.4). A
  High-city bake at Low shows phantom buildings. Baking for the
  current tier at boot, and re-baking on preset switch, solves it at
  the cost of a ~50 ms hitch on switch (the switch already hitches on
  the world rebuild).
- **Verdict:** The cheapest meaningful step, and the right shape for
  Stage 1. Its weakness — one capture point for a 380 m-wide city —
  is exactly what B fixes.

### B. Multiple static reflection probes at representative city locations

Four probes (see §7 for positions), each a PMREM'd cubemap baked once
at boot. Reflective materials sample the *nearest* probe: vehicle
paint/glass/rims per vehicle (they move), glass facades per material
(downtown glass takes the downtown probe — the material is shared, so
this is one assignment, not one per building).

- **Visual quality:** Better than A in direct proportion to the probe
  count. Downtown paint reflects towers; beach paint reflects hotels,
  sand and open sky; the garage forecourt reflects low residential
  roofs. The remaining artefact is the *transition*: three.js
  `MeshStandardMaterial` holds exactly one `envMap`, so two probes
  cannot blend on one material in stock three. Crossing a zone
  boundary is a hard switch — a visible pop on a stationary car if
  the two probes differ strongly. Mitigations, in order of
  practicality: (1) hysteresis — switch only when the vehicle is
  well inside the new zone (e.g. 10 m past the boundary) and moving;
  (2) place boundaries mid-block on quiet streets, not at
  intersections where the player lingers; (3) precompute a boundary
  probe at the midpoint so the step is smaller. True blending needs a
  custom shader (`onBeforeCompile` mixing two env maps) — out of
  scope for G1.2, noted as a possible later refinement.
- **Reflection accuracy:** Good within each zone (probe captured at
  the zone centre; error grows with distance from the probe, worst at
  zone edges — still far better than A's single point).
- **Parallax:** Same IBL limitation per probe, but the zones shrink
  the error: a car is never more than ~100 m from its probe, instead
  of up to ~300 m from A's single point.
- **GPU memory:** ≈ 4 MB retained for four probes at 128² (≈ 1 MB
  each); ≈ 16 MB at 256². **128² is the right resolution here:**
  reflections on roughness-0.3 paint and roughness-0.32 glass are
  blurred by the material itself — 256² buys almost nothing visible
  for 4× the memory. The sky env (256², already paid) stays.
- **Generation cost:** 4 × (6 renders + PMREM) ≈ 160–320 ms at boot,
  estimated, behind the loading screen. Acceptable; if measured above
  ~500 ms on the desktop, drop to 3 probes or 64² for the smallest
  zone.
- **Runtime performance:** Zero per-frame rendering cost. The only
  runtime work is a nearest-probe lookup when the vehicle moves
  (a few distance comparisons, or only on zone change — negligible).
- **Compatibility:** Core three only. Per-material `envMap` overrides
  `scene.environment` — documented three.js behaviour, and it is the
  mechanism the hybrid (E) relies on.
- **Presets:** Low — 1 probe (downtown) at 64², or sky env only; the
  Low tier's job is the 195-draw-call budget, and probes add no draw
  calls either way, so the choice is about boot time and memory, not
  frame rate. Medium — 2–3 probes at 128². High — 4 probes at 128².
  Re-bake on preset switch (or keep the previous tier's probes and
  accept the mismatch — the switch already hitches; re-baking is the
  cleaner choice and the hitch is one-off).
- **Verdict:** The workhorse of the recommended architecture. Best
  visual return per unit of risk.

### C. Selectively updated CubeCamera probes

One (or two) live `CubeCamera`(s) following the player's vehicle,
updated on a schedule: e.g. one face per frame (a full refresh every
6 frames), or a full update every 2 s when the vehicle has moved more
than 15 m, at 64–128², capturing only the static city + sky (dynamic
objects hidden, §4.5).

- **Visual quality:** The best possible — reflections always match the
  actual surroundings, including the exact street the car is on. This
  is the only option that is strictly more accurate than B.
- **Reflection accuracy:** Near-exact for the car's own paint (the
  probe sits at the car, so the capture viewpoint *is* the reflection
  viewpoint). For buildings, the probe is far away, so their
  reflections stay approximate — same as B.
- **Parallax:** Minimal for the car; unchanged for buildings.
- **GPU memory:** Small — one live cube RT at 128² (≈ 0.5 MB) + one
  PMREM target (≈ 1 MB), optionally double-buffered. The smallest
  memory footprint of the five.
- **Generation cost:** This is the problem. A full update is 6 renders
  of the scene: 6 × ~250 draw calls ≈ 1,500 draw calls, plus a PMREM
  pass (~5 ms at 128², estimated). On the G0 desktop baseline
  (downtown 55 FPS ≈ 18 ms/frame), a full update in one frame could
  add 5–15 ms — a visible hitch on every update. Mitigations: one
  face per frame spreads it to ~250 extra draw calls/frame (≈ +2–4
  ms/frame for 6 frames); updating only when the car moved skips
  parked time; capturing at 64² barely helps (the cost is draw-call
  bound, not fill-rate bound). Even spread out, this is a permanent
  tax on the frame budget, and it lands hardest downtown — exactly
  where the baseline is already the tightest (55 FPS).
- **Runtime performance:** The only option with a real ongoing cost.
  Needs a perf budget and a kill-switch: disable live updates when
  FPS drops, or when the quality preset is Low/Medium. The auto
  step-down system (`lastDowngradeAt`, 15 s cooldown) already exists
  and could gate it, but the interaction needs design, not just code.
- **Compatibility:** Core three only. `CubeCamera.update` renders
  synchronously and blocks the frame — there is no async option in
  stock three.
- **Presets:** Low — disabled (static probes only). Medium — one face
  per frame at 64², slow rate. High — 128², one face per frame.
  This is a clean ladder, but it means the feature behaves differently
  per tier, which complicates QA (three behaviours to verify instead
  of one).
- **Verdict:** Not recommended as a first step. Defer to Stage 3,
  High only, FPS-gated, and only if Stages 1–2 hold the baseline.
  Static probes (B) deliver most of the visual win for none of the
  runtime cost; C's extra accuracy is real but its cost is paid every
  second the game runs.

### D. Baked environment maps created from original city geometry

**D is best understood as a production method for B, not a competing
architecture.** The distinction is *where the capture comes from*:

- **D (capture scene):** build a dedicated, minimal scene from the same
  builders — `generateLayout` + `buildBuildings` + `buildRoads` +
  `buildVegetation` + `buildEnvironment` + the sky — into a throwaway
  scene, bake the probes from it, dispose it. The capture contains
  *only* static city geometry: no dynamic objects, no gameplay
  markers, no player, nothing to hide. It is also controllable: the
  bake can simplify the capture (e.g. skip balcony/rooftop/sign
  batches) for a cleaner reflection, or keep everything for fidelity.
- **B (live scene, hidden objects):** bake from the running game scene
  with the §4.5 groups hidden. Cheaper to build (no second world),
  but the result depends on live state (ocean phase, traffic-light
  phase) unless the bake runs before the loop starts — which it does
  in this design, so the two are near-identical in practice.

- **Visual quality / accuracy / parallax:** Identical to B — the
  textures are the same kind; only the capture source differs. D's
  advantage is cleanliness and control, not a different visual class.
- **GPU memory:** Same as B (≈ 4 MB for four probes at 128²).
- **Generation cost:** D adds one extra world build (the capture
  scene) — `buildWorld` into a throwaway scene costs roughly the same
  as the game world's build (estimated 100–300 ms) plus the same probe
  renders as B, plus transient geometry memory until the capture scene
  is disposed (estimated +10–20 MB during boot, freed afterwards).
  B's live-scene capture avoids the second build entirely.
- **Runtime performance:** Zero, as B.
- **Compatibility:** Core three. `buildWorld(scene, quality)` already
  takes a scene parameter — a capture scene needs no `World.ts`
  change. One caution: `buildWorld` also creates the ground texture
  with `Math.random()` noise (`makeGroundTexture`) — the capture
  scene's ground will differ cosmetically from the game's ground.
  That is fine for a reflection (the ground is a dark blur in the
  probe), but the bake must not depend on the two grounds matching.
- **Presets:** Same tier logic as B.
- **Verdict:** Use D's capture scene as the *production path* for the
  probe set in Stage 2/3 if the double-build cost measures acceptably
  at boot; keep B's hidden-objects live capture as the fallback (and
  as the Stage 1 path, where only one probe is needed and a second
  world build is wasteful). The design does not force the choice now —
  Stage 1 will measure both.

### E. Hybrid — sky PMREM + local city reflection probes (RECOMMENDED)

Keep the current sky PMREM as `scene.environment` (the global warm
sunset ambient — it already works and costs nothing at runtime), and
assign city probe maps only to the materials that need recognizable
reflections: vehicle paint, vehicle glass, rims, and the downtown glass
facades. Everything else keeps the sky env.

- **Visual quality:** The best of both. The warm ambient stays (the
  scene does not go dark — the sky env's diffuse IBL is what fixed
  the black-paint problem in G1.1), and the reflective surfaces gain
  real city content. This is the standard industry approach (global
  IBL + local reflection probes), and it is the only option that
  directly answers the diagnostic: the sky env supplies warmth, the
  probes supply *recognisable content*.
- **Reflection accuracy / parallax:** As B (the probes are B's probes).
- **GPU memory:** Sky env (≈ 2–4 MB at 256², already paid) + probes
  (≈ 4 MB for four at 128²) ≈ 6–8 MB total. Fine on desktop; the Low
  tier can drop to sky-only or one probe.
- **Generation cost:** Sky PMREM (already paid, 50–150 ms estimated
  real GPU) + probe bakes (≈ 160–320 ms for four, estimated). Total
  boot addition ≈ 200–300 ms behind the loading screen.
- **Runtime performance:** Zero per-frame cost (static probes) + a
  nearest-probe lookup on vehicle movement (negligible). The Low
  shadow and population fixes are untouched — probe code does not
  interact with shadows or population at all.
- **Compatibility:** Core three. The only mechanism is per-material
  `envMap`, which overrides `scene.environment` for that material —
  documented behaviour, no shader changes, no `onBeforeCompile`.
- **Presets:** The cleanest ladder of the five. Low: sky env only, or
  one downtown probe at 64². Medium: sky env + 2–3 probes at 128².
  High: sky env + 4 probes at 128². (C) can later sit on top of High
  only, as an optional live layer.
- **Verdict:** **Recommended.** It preserves everything G1.1 bought,
  adds the missing content where it matters, and risks nothing at
  runtime.

### Comparison table

| | A — one city cubemap | B — multiple static probes | C — live CubeCamera | D — baked from city geometry | E — hybrid (recommended) |
|---|---|---|---|---|---|
| Visual quality | Good at one point, wrong elsewhere | Good per district; hard zone switches | Best, always local | Same as B (production method) | Best static: warmth + content |
| Reflection accuracy | Correct at capture point only | Good within each zone | Near-exact for the car | As B | As B |
| Parallax | None | None per probe; zones shrink the error | Minimal for the car | As B | As B |
| GPU memory (retained) | ~1 MB @128² | ~4 MB (4 probes @128²) | ~1.5 MB (live RT + PMREM) | As B | ~6–8 MB incl. sky env |
| Generation cost (boot) | ~40–80 ms | ~160–320 ms | Ongoing (see below) | B + one extra world build | ~200–300 ms over today's boot |
| Runtime cost | 0 | 0 (+ nearest-probe lookup) | 6 renders/update; ~250 extra draw calls/frame spread over 6 frames; PMREM per update | 0 | 0 |
| Three.js compat | Core only | Core only | Core only (sync `update`) | Core only | Core only |
| Low preset | 1 probe @64² or sky only | 1 probe @64² or sky only | Disabled | As B | Sky only or 1 probe |
| Medium preset | 1 probe @128² | 2–3 probes @128² | 1 face/frame @64², slow | As B | Sky + 2–3 probes |
| High preset | 1 probe @128² | 4 probes @128² | 1 face/frame @128² | As B | Sky + 4 probes |
| Main risk | Wrong content for 80% of the map | Zone-switch pop; tier phantom buildings | Frame hitches downtown; FPS-gating complexity | Double-build boot cost | Zone-switch pop (same as B) |

---

## 6. Recommended architecture (E) in detail

```
Boot (factory, after buildWorld, before the game loop starts):
  1. scene.environment = null, fog disabled, dynamic groups hidden (§4.5)
  2. For each probe position: CubeCamera captures the static city + sky
     (6 faces, 128²) → PMREM → CubeUV render target (retained)
  3. Restore: scene.environment = sky PMREM (0.55), fog on, groups visible
  4. Assign: vehicle paint/glass/rims ← nearest probe;
             downtown glass facades ← downtown probe
  5. (On preset switch / garage select: re-run step 4 only, after the
     rebuild. Re-bake step 2 on preset switch — the tier's city changed.)

Per frame: nothing. On vehicle move across a zone boundary (with
hysteresis): swap the vehicle's paint/glass/rim envMap to the new
nearest probe.
```

**Why the bake runs before the loop starts:** the world is in a fixed,
deterministic state (ocean at phase 0, traffic lights at their initial
phase, no vehicle moving, no combat), so the probes are reproducible
run to run — the same property the city layout already has (seed
20261119). Baking later, mid-game, would capture a random ocean phase
and random traffic-light state.

**Why 128²:** the probe is sampled through materials with roughness
0.12–0.32, which blur it. 256² costs 4× the memory for no visible
gain on this art style. The sky env stays at 256² (it is already paid
for and its smooth gradient does not need detail either — but changing
it is out of scope).

**Why the sky env stays:** it is the diffuse ambient that fixed the
black-paint problem (G1.1). Removing it and relying on the city probes
alone would darken every non-reflective surface (the probes are
assigned only to reflective materials; everything else would lose its
IBL). The hybrid keeps the warmth and adds the content.

**Disposal:** probe render targets are engine-owned. `dispose()` must
dispose them alongside the existing sky env target, and the PMREM
generator must be disposed after each bake pass (as the factory
already does for the sky env).

## 7. Probe set — positions, zones, assignment

Positions are on streets, plazas or sand — never inside a building
footprint. All are derived from the layout data (`CityGenerator.ts`),
so they stay valid if the layout changes, as long as the streets do.

| Probe | Position (x, z) | Height | What it sees | Serves |
|---|---|---|---|---|
| Downtown | (0, −120) — avenue x = 0, between streets z = −90 and −150 | 2 m | Towers on both sides, Beacon Tower to the north, sunset sky | Downtown driving; **the downtown glass facades** (shared material → one assignment) |
| Spawn / commercial | (0, 0) — avenue x = 0, at the spawn plaza | 2 m | Commercial blocks, the GT's home area, mid-rise facades | Spawn, commercial district, the garage approach |
| Beach / coastal | (150, 0) — sand, east of the boardwalk | 2 m | Hotels to the west, open sky and ocean to the east, boardwalk | Beach, coastal hotels, Sunset Sprint, the Range |
| Garage / residential | (22, 30) — the garage parking bay, on street z = 30 | 2 m | Low residential roofs, the garage, the Mart | Garage forecourt, residential south |

Zone assignment for vehicles: nearest probe by horizontal distance,
with **10 m of hysteresis** (switch only when the vehicle is 10 m
past the midpoint between two probes) and a **moving-only rule**
(don't switch while the car is stationary — a pop on a parked car is
far more visible than one at speed). A fifth probe at the tower plaza
(0, −165) is optional — the downtown probe already covers the north;
add it only if the plaza reads wrong in testing.

Facades do not move, so they take a fixed probe: downtown glass ←
downtown probe; any future coastal glass ← beach probe.

**Tier mapping:** Low — downtown probe only at 64² (or sky env only;
decide in Stage 1 from the measured boot cost). Medium — downtown +
spawn + beach at 128². High — all four at 128².

## 8. Vehicle reflections — requirements and honest limits

**Requirement:** surrounding buildings, sky and city structures must be
recognisable in the car paint. The acceptance test is quantitative
(§12): the car-box pixel delta with the probe on must exceed the
full-frame delta — the opposite of the diagnostic's result for the sky
env.

**What the probe delivers on the current cars:**

- The **paint** (metalness 0.55, roughness 0.3, clearcoat 1) will show
  the probe's content: dark tower silhouettes against the sky band on
  the side panels, the bright sun disc as a clearcoat glint at the
  right angle, warm sky on the roof. Recognisable, but **blocky**:
  each flat extruded panel reflects one direction, so a tower reads as
  a dark rectangle, not a warped tower. That satisfies "recognise
  surrounding buildings" — it does not reproduce the reference images'
  curved reflections.
- The **glasshouse** (metalness 0.9, roughness 0.12) is the sharpest
  reflector on the car. It will mirror the sky and the towers across
  the street almost like the reference images' side glass (yellow-car
  image). This is where the probe will be most visibly convincing.
- The **rims** (metalness 0.9, roughness 0.25) will pick up the street
  and sky — a small but visible win, especially the bronze-style
  warmth on the Shadow LX's rims.
- The **gold chain** on the protagonist and other small metals will
  also sample the probe if they use the sky env today — they keep the
  sky env (they are not assigned probes), so no change there.

**What the probe cannot deliver on the current cars:** warped,
curved reflections (flat bodywork — see §4.3); a tower mirrored
across the whole hood (the hood is a flat extruded top face — it
reflects one sky direction); reflections that track the car's
surroundings *exactly* as it drives (static probes are frozen at
their capture point — the reflection content changes only at zone
boundaries). If Sachi wants the curved look, that is a vehicle-geometry
project (G6), not a probe project.

**Traffic and police cars:** they use their own materials (Traffic.ts
body materials, Police.ts). Assigning probes to them is possible (same
mechanism) but not recommended for Stage 1–2: traffic paint is
metalness 0.05 (dielectric — it barely reflects anything), and
updating probe assignments for up to 20 moving traffic cars adds
bookkeeping for little visual return. The player's cars and the glass
are the payoff. Revisit only if traffic paint is ever made metallic.

## 9. Buildings — facade architecture and the practical glass path

**Current architecture** (`Buildings.ts`): five facade styles mapped by
district — downtown `'glass'`, coastal `'hotel'`, commercial `'brick'`,
residential `'pastel'`, park `'concrete'` (`STYLE_FOR`). Facades are
canvas textures (128×256) on a shared unit box, merged by
`GeometryBatch` into one mesh per material (per repeat-variant). The
glass material is roughness 0.32 / metalness 0.55 with a dark canvas
(`#2e5a80` base, dark panes `rgba(8,18,34,0.9)`, ~42% warm lit panes
`#ffcf7d`). The dark diffuse means the env's *diffuse* contribution is
muted (the map multiplies it); the reflection lives in the *specular*
channel (metalness 0.55) — which is exactly where a city probe pays
off: dark glass + bright tower reflections, like reference images 2
and 7.

**The practical path — no building redesign:**

1. **Stage 2, zero geometry change:** assign the downtown probe envMap
   to the existing glass facade materials (the 3 batched meshes). One
   assignment per material, re-applied after rebuilds (§4.1). The
   glass already has the right metalness/roughness; it only lacked
   content to reflect. Expected result: downtown towers reflecting
   neighbouring towers and the sunset — the single biggest
   building-side win in the design, for the smallest change.
2. **Optional, still no geometry change:** a coastal glass variant.
   The `'hotel'` style (balcony bands, lit windows) stays as it is;
   add a second material for coastal plots with the same hotel texture
   but metalness 0.3 / roughness 0.6 — a subtle sheen on the
   beachfront hotels — and assign the beach probe. Or, if the balcony
   texture fights the reflection, introduce a `'glass-tower'` style
   (new `FacadeStyle`, brighter canvas, roughness 0.15, metalness 0.9)
   for the tallest downtown plots only, as a skyline accent. Both are
   material-parameter changes in `Buildings.ts`, not geometry.
3. **Optional, small geometry:** storefront glass. The ground-floor
   storefronts (commercial + coastal, `storeMat` roughness 0.6) could
   take a shop-window material (metalness 0.7, roughness 0.15,
   assigned the local probe) — ground-floor reflections at street
   level, where the player walks. This is one more batched material,
   not a redesign.
4. **Not recommended:** making every facade reflective. Brick/pastel/
   concrete at metalness 0.05 / roughness 0.85 are correct as diffuse
   surfaces; raising their metalness would make the whole city look
   wet or plasticky, and would fight the sunset palette. Reflections
   belong on glass and paint, not on brick.

**What about the "only 3 glass meshes" fact?** It is a strength, not a
weakness: three material assignments cover the entire downtown
district. The cost of the building side of this design is three
`envMap` assignments, not a per-building rollout.

## 10. Performance — budgets, risks, and Low-tier protection

**Baseline (user-measured desktop, G0):** Spawn 60 FPS, Downtown
55 FPS, Beach 60 FPS. Headless/SwiftShader numbers are not evidence
and are not used here.

**What static probes cost:**

| Cost | Amount | When |
|---|---|---|
| Draw calls | 0 | Probes are textures; they add no meshes, no passes per frame. |
| Per-frame CPU/GPU | ~0 | One nearest-probe lookup on vehicle movement (a few distance comparisons). |
| GPU memory (retained) | ≈ 4 MB (4 probes @128²) + sky env ≈ 2–4 MB (already paid) | For the engine lifetime; disposed in `dispose()`. |
| Boot time (estimated) | ≈ 160–320 ms for 4 probes (6 renders + PMREM each) | Once, behind the loading screen. Must be measured on the desktop in Stage 1; if it exceeds ~500 ms, drop to 3 probes or 64². |
| Preset-switch hitch (estimated) | ≈ 160–320 ms re-bake + the existing world-rebuild hitch | One-off on a user action, not per frame. Alternative: keep the previous tier's probes and accept the mismatch (phantom/missing buildings in reflections only). |

**Risks:**

1. **Boot-time regression.** The sky PMREM already costs 50–150 ms
   (estimated real GPU). Four probes could add 160–320 ms. The
   loading screen hides it, but a total boot over ~1 s starts to feel
   slow. Mitigation: bake at 128² (not 256²), bake only the current
   tier's probes, measure in Stage 1 and cut probe count if needed.
2. **Low-end GPUs.** PMREM generation is a GPU compute-ish pass; on
   weak integrated GPUs the cost is higher than the estimate. The
   tier ladder (Low = 1 probe @64² or sky-only) is the guard.
3. **Preset-switch hitch.** Re-baking on switch is a one-off ~200 ms
   freeze. Acceptable for a deliberate user action, but it must be
   measured — if it feels bad, keep stale probes across the switch
   (reflections only; gameplay unaffected).
4. **Zone-switch pop (B/E).** A hard `envMap` swap is visible if the
   two probes differ strongly and the car is stationary. Mitigations
   in §5B (hysteresis, moving-only rule, boundary placement). If the
   pop is still visible in testing, the fallback is a single probe per
   district with boundaries on quiet mid-block streets — or a custom
   blend shader (out of scope for G1.2).
5. **Tier phantom buildings.** A probe baked at High shows buildings
   that do not exist at Low. Mitigated by per-tier baking (§4.4);
   residual risk is small because downtown (the skyline) is intact at
   every tier.
6. **Live CubeCamera (C) — the only runtime risk in this document.**
   It is deferred to Stage 3 precisely because its cost is paid every
   second and lands hardest downtown (55 FPS baseline). It must be
   FPS-gated and measured before it is ever enabled by default.

**What is protected:** the G0 Low-tier fixes are untouched. Probe code
does not touch `setShadows`, the shadow frustum, the population caps
(`LOW_PEDESTRIAN_CAP` / `LOW_TRAFFIC_CAP`), or the auto step-down.
Probes add no draw calls, so the Low downtown figure (195 constant)
cannot regress from this work. Gameplay, story, missions and saves are
not touched at all — the probe system only reads the scene and writes
`envMap` fields on materials.

---

## 11. Implementation stages (for G1.2, when approved)

### Stage 1 — One isolated probe (the first implementation proposal)

**Scope (deliberately small):** one static city probe at downtown
(0, −120), baked at boot from the live scene with the §4.5 groups
hidden, PMREM'd at 128², assigned to the Velocity GT's paint and glass
materials only. No building changes. No probe set, no zone logic, no
capture scene, no live updates.

**Steps:**

1. New module `ReflectionProbes.ts`: `bakeProbe(renderer, scene,
   position)` — hides the exclusion groups, nulls `scene.environment`
   and fog, renders a `CubeCamera` (near 0.5, far 900) at 128²,
   PMREM's the result, restores everything, returns the CubeUV render
   target. Plus `assignVehicleProbe(vehicle, target)` — sets
   `envMap` on the vehicle's paint/glass/rim materials (needs the
   `VehicleHandle` accessor, §13).
2. `GameEngine.ts` factory: after `buildWorld` (so the city exists)
   and before the loop starts, bake the downtown probe; assign it to
   the active vehicle. Store the target on the engine; dispose it in
   `dispose()`.
3. `applyQualityPreset` + `garageSelect`: re-run the assignment only
   (the probe texture survives; the vehicle is new). Do **not** re-bake
   in Stage 1 — the downtown skyline is intact at every tier, so the
   mismatch is negligible for one probe. (Per-tier re-baking arrives
   in Stage 2.)
4. QA harness `vcs-g1-probe.mjs` (§12): chrome sphere (correctly
   built — see §12), pixel deltas, before/after screenshots, boot-time
   measurement (`envMapMs`-style timing for the probe bake), preset
   switches, qa81 regression.

**Exit criteria for Stage 1:** the chrome sphere shows recognisable
buildings (not a smooth gradient); the GT car-box delta exceeds the
full-frame delta (localized reflection, §3); desktop FPS unchanged
(Sachi to confirm 60/55/60); zero console errors; qa81 green. If any
criterion fails, Stage 1 stops and the design is revised — Stage 2 does
not start on a failed Stage 1.

### Stage 2 — Probe set + glass

1. Four probes (downtown / spawn / beach / garage, §7), baked at boot
   for the current tier; re-bake on preset switch.
2. Nearest-probe assignment for all four player vehicles
   (paint/glass/rims), with hysteresis + moving-only switching (§7).
3. Downtown glass facades ← downtown probe (3 material assignments).
4. QA: zone-boundary drive test (pop check), facade before/after,
   presets, qa81, desktop FPS.

### Stage 3 — Optional refinements (only if Stages 1–2 hold the baseline)

1. Dedicated capture scene (D) as the production path for the bakes,
   if the double-build boot cost measures acceptably.
2. Coastal glass variant and/or storefront glass (§9, items 2–3).
3. Live CubeCamera (C) for High only, one face per frame at 128²,
   FPS-gated (disabled below a measured threshold, disabled on
   Low/Medium). This is a separate approval — it is the only item in
   this document with a runtime cost.

## 12. Testing plan

The plan reuses the diagnostic harness pattern from G1.1
(`vcs-g1-capture.mjs`, `vcs-g1-diag.mjs`) and fixes its one flaw.

**12.1 Chrome-sphere probe (the correct way).** The G1.1 diagnostic's
chrome probe failed silently: it cloned the first `SphereGeometry`
found by traversal, which was the sky dome (radius 600) — the
"probe" was a 960 m invisible sphere. The test must build the sphere
from fresh geometry:

```ts
const geo = new THREE.SphereGeometry(0.5, 32, 16);
const chrome = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
  color: 0xffffff, metalness: 1, roughness: 0,
}));
```

Place it 2 m from the GT at a known camera, screenshot it, and require
that **recognisable buildings** (not a smooth gradient) are visible in
it. Add a second sphere with the GT paint material next to it, for the
paint's own reflection. Both spheres are added and removed inside the
harness only — never in `src/`.

**12.2 Localised-delta criterion (the key number).** For each angle
(side / rear-low / front-low), measure the GT car-box mean and the
full-frame mean with the probe off (sky env only) and on (sky env +
probe). **Pass = car-box delta > full-frame delta** — the reflection
is localized to the car. The diagnostic's sky-env result was the
opposite (car-box +39 ≈ full-frame +40), which is how the global lift
was caught. Also record the delta at probe intensity 1.0 for reference.

**12.3 Probe content check.** Render each probe's six faces to a
canvas (or read back pixels) and verify: the probe is not a smooth
gradient (pixel variance far above the sky env's), buildings are
recognisable as dark/bright blocks, the lower hemisphere is dark
(ground, not orange sky), the sun disc is present.

**12.4 Before/after screenshots.** Same fixed cameras as G1.1
(GT close-up, Shadow LX, Vortex, Trailhawk, downtown, beach,
skyline), probe-off vs probe-on. Plus a new shot: a downtown glass
facade close-up, probe-off vs probe-on (Stage 2).

**12.5 Presets and lifecycle.** Boot Low / Medium / High: correct
probe assignment, `scene.environment` intact, shadows correct per
tier (Low off), population caps intact (Low 10/8), downtown draw
calls Low = 195 constant. Switch Low → Medium → High → Low live:
assignments re-applied, no console errors, no leaked render targets
(check `renderer.info.memory.textures` before/after if needed).
`garageSelect` to each of the four cars: probe assigned to the new
vehicle. `dispose()` clean (no errors, targets freed).

**12.6 Zone switching (Stage 2).** Drive the GT across a zone
boundary (downtown → spawn, spawn → beach); record screenshots just
before and after the switch; require no visible pop while moving, and
no switch while stationary. If a pop is visible, apply the §5B
mitigations (hysteresis tuning, boundary placement) before proceeding.

**12.7 Regression.** `npx tsc --noEmit` clean; `npm run build`
passes; qa81 green (same cash chain and encounter checks as G1.1);
zero console errors in every run. Desktop FPS re-measured by Sachi at
spawn / downtown / beach against 60 / 55 / 60 — headless FPS is not
evidence and is not reported as a result.

**12.8 Boot-time measurement.** Time the probe bakes with a
`performance.now()` pair (same pattern as `envMapMs`) and report the
number per probe and total, on the desktop. If the total exceeds
~500 ms, cut probe count or resolution before shipping the stage.

## 13. Exact files likely to change (G1.2, when approved)

| File | Change | Stage |
|---|---|---|
| **NEW** `src/game/ReflectionProbes.ts` | Probe bake (`CubeCamera` + PMREM), exclusion hide/restore, nearest-probe lookup, assignment helpers. The bulk of the work lives here. | 1–2 |
| `src/game/GameEngine.ts` | Call the bake after `buildWorld` in the factory; re-apply assignments at the end of `applyQualityPreset` and in `garageSelect`; own + dispose the probe render targets in `dispose()`; expose the probe timing (an `envMapMs`-style field) for QA. | 1–2 |
| `src/game/Vehicle.ts` | Add a small accessor on `VehicleHandle` (e.g. `paintMaterial()` / `reflectiveMaterials()`) returning the per-vehicle paint/glass/rim instances, so assignment does not traverse the group. No geometry or driving change. | 1 |
| `src/game/Lighting.ts` | Possibly a helper to null/restore `scene.environment` + fog around a bake, if that logic does not belong in `ReflectionProbes.ts`. No sky change. | 1 |
| `src/game/Buildings.ts` | **Stage 2 only:** assign the downtown probe to the glass facade materials (done from `GameEngine`/`ReflectionProbes`, but the material references live here — likely a small accessor or a returned handle). **Optional:** coastal glass variant / `'glass-tower'` style / storefront glass material. No geometry redesign. | 2–3 |
| `src/game/World.ts` | No change expected. `buildWorld(scene, quality)` already accepts a scene, so a Stage 3 capture scene needs no edit. | 3 |
| `src/game/Quality.ts` | Possibly a `probes` count/resolution per tier in `QualitySettings`. Small. | 2 |
| `docs/graphics-g1-environment-map.md` | Addendum recording the probe results (keeps the G1.1 record accurate). | 1 |
| `~/workspace/qa-shots/vcs-g1-probe.mjs` (+ logs) | New QA harness (not `src/`). | 1 |

**Not changing:** `CityGenerator.ts` (layout data is reused as-is),
`Traffic.ts`, `Police.ts`, `NPC.ts` (dynamic objects are hidden, not
modified), `Player.ts`, story/mission/combat/save files, `global.css`,
any UI component. No new dependencies.

## 14. Risks, open questions, and non-goals

**Residual risks** (beyond §10): the zone-switch pop is the main
unknown — it cannot be judged from code, only from the Stage 2 drive
test. The flat-body limit (§8) means the result will look like the
reference images' *glass* more than their *curved paint*; if Sachi
judges the blocky reflections insufficient, the answer is vehicle
geometry (G6), not more probes.

**Open questions for Sachi:**

1. Approve Stage 1 (one downtown probe on the GT only) as the first
   implementation, or go straight to the Stage 2 probe set?
2. Is a ~200–300 ms boot addition behind the loading screen
   acceptable, or should the probe count start at 2 (downtown +
   spawn)?
3. Wet streets: the reference images' puddle reflections are a
   separate system (road materials). Should that be scoped as its own
   later item, or is it out of scope for the graphics track entirely?
4. Should the live CubeCamera (C) stay on the roadmap for High, or
   be dropped in favour of static probes only?

**Non-goals (explicitly not in this design):** any production code
change (this document is design only); G1.2 implementation; gameplay,
story, missions or save changes; any push or deployment; any new
dependency; any change to the G0 Low shadow/population fixes; curved
car bodywork; wet-road reflections; true probe blending (custom
shader) — noted as a possible later refinement, not part of G1.2.
