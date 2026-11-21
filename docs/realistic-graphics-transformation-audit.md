# Vice City Stories — Realistic Graphics Transformation Audit

**Date:** 2026-11-20
**Scope:** AUDIT ONLY. No game file was edited, no build was run, no
dependency was added, no push, no deploy, no implementation started.
**Baseline:** Phase 9F (full campaign QA, complete) + Phase 1 (dialogue
fixes 7.1 + 7.7) + Phase 2 (vehicle wheels 2.1 + pedestrian collision
3.1). All gameplay, story, save and progression systems are preserved
as-is; this audit is about the visual layer only.
**Reference:** the attached image (a busy AAA open-world intersection
— dense traffic, pedestrians on crosswalks, large billboards, varied
storefronts, palm trees, hazy daylight). It is used here as a **quality
and density target only**. Its assets, logos, brand names, artwork and
layout must not be copied; the route below builds the same *kind* of
image from original assets. Where the reference and the game's identity
diverge (daylight vs the game's frozen sunset), the audit says so
explicitly instead of silently picking one.
**Evidence:** every claim below is grounded in the code at
`~/workspace/vice-city-stories/src/` (file:line references) and in two
fresh screenshots of the current build taken for this audit:
`~/workspace/qa-shots/qa/p2gfx-current-downtown.png` (downtown
intersection, High tier) and `~/workspace/qa-shots/qa/p2gfx-current-beach.png`
(beach boardwalk — note it reads "Low — battery saver" because the auto
step-down fired at 1 FPS in headless SwiftShader; that is a headless
artifact, not a real-device measurement). Findings already established
by the Animation & Visual Fidelity Audit (`docs/animation-visual-audit.md`,
§8 environment and §9 UI) are cited by number (A8.x / A9.x) rather than
re-derived.

**One-line verdict:** the game is a coherent, well-batched, stylised
low-poly city. Reaching the reference's look is achievable in stages,
but not by one big change: the single highest-leverage fix is an
environment map (the whole PBR material stack is currently
environment-starved), followed by facade depth, road texture, palm
rebuild and street density. True photorealism is not achievable in this
browser architecture at this scale, and the audit does not pretend
otherwise — the realistic target is "AAA-like stylised realism": the
reference's density, material response and light quality, rendered in
the game's own sunset palette.

---

## 1. Current rendering architecture (inspected)

### 1.1 Renderer, camera, tone mapping

- `GameEngine.ts:373-388` — one `THREE.WebGLRenderer`,
  `powerPreference: 'high-performance'`, `antialias` per quality tier,
  `setPixelRatio` per tier, `shadowMap.type = PCFSoftShadowMap`,
  **`shadowMap.autoUpdate = false`** with manual `needsUpdate = true`
  on changes (a deliberate perf choice: shadows re-render only when
  something moves), `toneMapping = ACESFilmicToneMapping`,
  `toneMappingExposure = 1.05`. No `outputColorSpace` override
  (default sRGB in three 0.187).
- `GameEngine.ts:390-395` — one `PerspectiveCamera`, **FOV 62**,
  near 0.1, far 900. Third-person chase: `camDistance = 8.5`,
  `camPitch = 0.32` (`GameEngine.ts:342-344`), fixed distance with no
  speed-based pull-back (A-audit: "meets standard", minor nit).
  Cinematics use the same camera at FOV 62 (A-audit §6).
- **No post-processing anywhere.** Zero imports of `EffectComposer`,
  `RenderPass`, `UnrealBloomPass`, `SSAOPass`, `OutputPass` or any
  `three/addons` module. The only "composer" in the codebase is a
  helper named `composeRoot` in `NPC.ts`. Bloom, vignette, depth of
  field, colour grading and SMAA/FXAA are all absent; the image is
  exactly what the forward renderer draws, plus ACES.
- **No environment map.** No `PMREMGenerator`, no `scene.environment`,
  no `RoomEnvironment`. `Traffic.ts:242` says it outright: "Near-zero
  metalness: with no environment map, metalness turns [black]". This is
  the single most consequential rendering fact in the whole project:
  every metal, glass and clearcoat material in the game is lit only by
  the two analytic lights, so it reads flat or near-black instead of
  reflecting anything.

### 1.2 Lights, sky, fog

- `Lighting.ts:74-88` — the whole lighting rig is **two lights**: a
  `HemisphereLight` (`#ffc49a` sky / `#332a44` ground, intensity 1.25)
  and one `DirectionalLight` sun (`#ffc08a`, 2.4) at (-60, 55, -40).
  No fill lights, no bounce lights, no point/spot lights anywhere in
  the world (streetlight "lamps" are emissive spheres, A8.6).
- Sun shadow camera: **±100 m frustum**, near 5, far 260, bias
  -0.0004, map size 512 / 1024 / 2048 by tier (`Lighting.ts:80-89`).
  Shadows vanish beyond ±100 m of the origin — the Beacon Tower and
  the beach have no shadows at all (A8.18, High). The frustum does not
  follow the player.
- Sky: `Lighting.ts:27-66` — a gradient dome, `SphereGeometry(600,
  24, 16)` with a custom `ShaderMaterial` (top `#16265e` deep blue,
  mid `#ff7e5f`, bottom `#feb47b`), plus a flat `CircleGeometry` sun
  disc (r 26) at (-260, 42, -320). No clouds, no sun glow, no stars,
  no birds, no sky life (A8.5). The dome sits outside the fog, so the
  distant city can read washed-out against a sharp sky (A8.21).
- Fog: `THREE.Fog('#e88a6b')`, near/far per tier — low 60/220,
  medium 80/300, high 100/380, ultra 120/460 (`Quality.ts`). The fog
  colour is a fixed salmon that matches the sunset horizon but not the
  blue zenith, so looking up and looking across the city are two
  different colour worlds.

### 1.3 Materials and textures — the whole story in one paragraph

- Material census: **132 `MeshStandardMaterial`, 2
  `MeshPhysicalMaterial` (vehicle paint is one), 33
  `MeshBasicMaterial`** (signs, bulbs, sun disc, markers).
- **Every texture in the game is a runtime `CanvasTexture`.** There is
  no `TextureLoader`, no image file in `src/` or `public/` (public/
  holds only `favicon.svg` and `icons.svg`), no normal map, no
  roughness map, no metalness map, no AO map, no bump map anywhere.
  The texture inventory is: facade 128×256 (`Buildings.ts:29`),
  sign 256×64 (`Buildings.ts:98`), sand 256² and boardwalk 128×256
  (`Environment.ts:13,33`), garage facade (`Garage.ts:21`), muzzle
  flash (`Combat.ts:178`), contract/encounter signs
  (`Contracts.ts:242`, `Encounters.ts:151`), ground asphalt noise
  512² (`World.ts`). All colour-only, all flat, all low resolution.
  This is why the city reads "clean": there is no surface variation
  anywhere — no grime, no wear, no roughness variation, no
  reflectivity variation.
- Consequences of the missing env map, per material: glass facades
  (`metalness 0.55, roughness 0.32`) are dark slabs; car paint
  (`MeshPhysicalMaterial`, metalness 0.55, roughness 0.3, clearcoat 1,
  clearcoatRoughness 0.1) has a clearcoat that reflects nothing; car
  glass (`metalness 0.9, roughness 0.12`) is near-black; rims
  (`metalness 0.9`) are grey discs, not chrome. The reference's
  defining material quality — paint reflecting the sky, glass
  reflecting the street — is structurally impossible in the current
  setup. This is fixable without any new asset: see §3.1.

### 1.4 World and city generation

- `CityGenerator.ts` — one deterministic 5×6 street grid (seed
  20261119): avenues x = -120, -60, 0, 60, 120; streets z = -150, -90,
  -30, 30, 90, 150; `ROAD_HALF = 5`, `SIDEWALK = 3`, `BLOCK_INSET =
  8`, `CITY_HALF = 190`. Districts: downtown (height 26–64 m),
  coastal (13–28), commercial (9–22), residential (6–13), two parks.
  Downtown gets one tower per block; other districts split a block
  into up to 4 buildings. Building counts per tier: 28 / 48 / 72 /
  96. Beach x 138–196, ocean from x 196. The layout is data; the
  builders only draw what it says — so layout changes (denser blocks,
  narrower streets, a second landmark) are cheap, while geometry
  changes are not.
- `Buildings.ts` — every building is **one unit `BoxGeometry(1,1,1)`**
  scaled to its plot, merged per material through `GeometryBatch`
  (`Merge.ts`): ~25 draw calls for the whole city. Five facade
  styles (glass / brick / pastel / concrete / hotel) as 128×256
  canvas textures with flat window grids (lit windows are flat yellow
  rectangles, ~32–42% lit at random). Roof cap (dark box), neon roof
  trim (emissive boxes, downtown/coastal only), storefront box +
  awning plane + one of 6 rotating sign names (`CAFÉ AZUL`, `SURF
  SHOP`, `TACO BAR`, `NEON BAR`, `HOTEL VISTA`, `PIZZA`) on
  commercial/coastal faces, balconies / rooftop AC units / water
  towers as `InstancedMesh` boxes and cylinders. Beacon Tower: blue
  cylinder (r 5→7, h 52, 16 segments) + 3 neon torus rings + glowing
  sphere. No window geometry, no setbacks, no floor variation, no
  ground-floor glass, no entrance doors, no loading bays, no
  billboards.
- `World.ts` — base ground is one 512² asphalt-noise canvas texture
  (`#2e2a33` + 2600 speckles) stretched over the whole city; block
  pads are flat; the spawn plaza and tower plaza are flat decals.
  Between buildings the ground is bare — the reference has no bare
  ground anywhere.
- `Roads.ts` — flat colour planes: asphalt `#1b1920` roughness 0.95,
  sidewalk `#55505c`, curb, edge lines; instanced yellow centre dashes
  and white crosswalk stripes; streetlights (cylinder pole + emissive
  sphere lamp, no light cast); 6 signalised intersections out of 30,
  bulbs as one `InstancedMesh` with per-instance colour — **yellow is
  never lit** (A8.2, High). No road texture, no wear, no arrows, no
  turn lanes, no parking lines, no manhole covers, no STOP or street
  signs, no wet patches.
- `Vegetation.ts` — palms are a cylinder trunk (r 0.16–0.24, h 4.6,
  6 segments) plus **one `ConeGeometry` (r 2.1, h 2.8, 7 segments)**
  as the entire crown; park trees are a cylinder + an
  `IcosahedronGeometry(2.2, 0)` blob; benches are boxes; beach
  umbrellas are a pole + a coloured cone. Palm counts 12 / 28 / 48 /
  64 by tier. Everything is static (A8.16). The beach screenshot shows
  the problem at its worst: one palm crown reads as a giant green
  triangle filling a quarter of the frame.
- `Environment.ts` — ocean is a custom `ShaderMaterial` on a
  244×440 plane, 48×48 segments, three sine waves, a foam band and a
  sun-glitter term. No reflections, no transparency, no normal-mapped
  detail; from the boardwalk it reads as a flat blue band (see the
  beach screenshot). Sand and boardwalk are flat canvas textures.

### 1.5 Vehicles, characters, crowd

- Player cars (`Vehicle.ts` + `VehicleCatalog.ts`) — the best-modelled
  objects in the game, and still the furthest from the reference.
  Body and cabin are **extruded 2D side profiles** (`ExtrudeGeometry`,
  bevel 0.05), so every car is the same silhouette family with
  different length/height/cabin numbers: 4 specs (Velocity GT, Shadow
  LX, Vortex RS, Trailhawk X). Wheels are 20-segment tires + 12-segment
  rims, steering pivots up front, spin with speed (Phase 2). Details
  (headlights, taillights, grille, mirrors, spoiler, exhausts) are
  boxes merged by material. No interior, no seats, no steering wheel,
  no door lines, no panel gaps, no mirrors that reflect, no dirt.
  Headlights/taillights are constant emissive (A8.7) — no brake
  brightening, no beam.
- Traffic (`Traffic.ts`) — 6 categories, vertex-coloured merged
  tire+rim, `wheelSpin`, brake-reactive tails, headlights always on.
  Counts: off 0 / low 8 / medium 14 / high 20. The reference shows
  ~10 cars in a single intersection frame; the game shows 14 across
  the whole city, so any one frame feels empty.
- Mission sedan (`MissionVehicle.ts`) — a box body with 12-segment
  wheels + rim discs (Phase 2). Police cars (`Police.ts`) — light bar
  alternates red/blue with no glow (A8.9).
- Player (`Character.ts`) — ~22 meshes, all boxes/cylinders/spheres,
  flat `MeshStandardMaterial` colours (grey hoodie, cream tee, gold
  chain at metalness 0.75 — again env-starved), no face, no fingers,
  no clothing folds, no textures. Animation (`CharacterAnimation.ts`)
  is procedural: leg/arm swing, lean, bob — serviceable at 8.5 m, thin
  up close.
- NPCs (`NPC.ts`) — 12 archetypes from 5 skins, 5 hair colours, 4
  hair styles + cap, skirt flag, height 0.92–1.06, width 0.9–1.12,
  cruise 1.1–1.9 m/s; **~14 instanced draw calls for up to 28
  pedestrians**. Same boxy rig as the player, recoloured. No
  accessories, no bags, no phones, no hats beyond caps.
- Enemies (`EnemyModels.ts`) — recoloured protagonist rigs; same
  limits.

### 1.6 Camera, UI, quality settings, performance

- Camera: FOV 62, chase 8.5 m, no speed pull-back, no FOV kick on
  sprint, no shake, no depth of field. Cinematics are the only
  alternative framing (14 scenes, 44 shots, all at FOV 62).
- UI: React + hand-written CSS (`src/styles/global.css`), **system-ui
  font stack — no display typeface at all**. Main menu is a CSS
  sky/sun/clouds/skyline/sea scene (no image). HUD is pill buttons
  across the top; panels are flat dark cards. A-audit §9: no exit
  animations (A9.2), no Esc/backdrop close on panels (A9.3, High),
  RangePanel ignores buy results (A9.4, High), no compass/minimap
  (A8.19). The reference has no visible game UI, but its *signage*
  typography (billboards, storefronts, street signs) is a huge part of
  its realism — the game's 6 canvas sign names in Arial bold are the
  equivalent, and they are the weakest text in the game.
- Quality (`Quality.ts`): low (pixelRatio 1, no AA, **no shadows**,
  512 shadow map, 28 buildings, 12 palms, fog 60/220), medium (1.5,
  AA, 1024, 48, 28, 80/300), high (2, AA, 2048, 72, 48, 100/380),
  ultra (2, AA, 2048, 96, 64, 120/460). Detection from cores /
  memory / DPR / mobile; auto step-down one-way only, avg FPS < 28
  over 45 frames, 15 s cooldown (`GameEngine.ts:2515-2535`). The
  step-down works — it fired in headless at 1 FPS during this audit's
  screenshot run — but headless FPS reads 1 in SwiftShader and is not
  a real measurement (9F).
- Performance baseline (9F, real browser): **draw calls 152 at spawn /
  247 downtown / 308 max**; heap delta 0 MB over 5 cinematic cycles.
  **No LOD system** (no `THREE.LOD` anywhere); frustum culling is
  default-on except instanced meshes, which are `frustumCulled =
  false` because they span the city. The batching discipline
  (`GeometryBatch` + `InstancedMesh`) is the reason the game runs at
  all — it is the asset this transformation must not break.
- Build: Vite 8 + React 19 + TypeScript 7 + three 0.187 only. Bundle
  **1,148.94 kB JS / 312.43 kB gzip**; `dist/` 1.2 MB; zero image
  assets in the bundle. Anything added (models, textures) grows this
  from near-zero — see §6 for budgets.

---

## 2. Category-by-category comparison with the reference

Reading the reference image first, as a list of what it *has* that the
game does not: bright hazy daylight; ~10 distinct cars and ~20
pedestrians in one frame; a huge illustrated billboard; layered
storefronts with awnings and outdoor seating; street-name and STOP
signs; traffic lights on mast arms; worn asphalt with arrows, yellow
hatching and red kerbs; real palm fronds and dense hedges; car paint
and glass reflecting the sky; wet patches reflecting cars; long soft
shadows; distant buildings dissolving into haze. Every category below
is measured against that list.

### 2.1 City realism

- **Current:** a clean 5×6 grid with 28–96 identical-footprint boxes
  on bare ground pads, two parks, one landmark tower, one beach. The
  downtown screenshot shows the truth: wide empty roads, bare
  concrete between buildings, no clutter anywhere. The city is a
  diagram of a city.
- **Gap:** the reference has *no empty surface*. Every square metre
  carries something: a hedge, a planter, a sign, a parked car, a
  person, a bin, a billboard, a shadow. Density, not geometry, is the
  first thing the eye reads.
- **Recommended upgrade:** a **density pass before any geometry
  pass** — street furniture, parked cars, signs, planters, billboards
  and clutter instanced along every block (see 2.4, 2.8, 2.12). Then
  block variety: vary setbacks, add a second landmark, narrow two
  avenues into a "main street" with tighter buildings.
- **Files:** `CityGenerator.ts` (layout data), `World.ts` (assembly),
  new `StreetFurniture.ts` (instanced clutter), `Roads.ts`,
  `Vegetation.ts`.
- **Difficulty:** Low–Medium (furniture is instancing work the codebase
  already does well; layout changes are data changes).
- **Performance risk:** Low if instanced (one draw call per furniture
  type); Medium if every item becomes a mesh. Budget: +10–20 draw
  calls, +2–4 MB geometry.
- **Dependencies/assets:** none — all procedural; the win is
  placement density, not new models.

### 2.2 Building geometry and textures

- **Current:** one scaled box per building; windows are a flat
  128×256 canvas texture; roofs are a dark box; no setbacks, no
  floor articulation, no ground-floor glass, no doors. The downtown
  screenshot shows beige slabs with a repeating window grid — the
  same grid on a 6 m shop and a 64 m tower, just repeated 1–3×.
- **Gap:** the reference's buildings have *depth*: panel cladding
  with visible seams, recessed windows with real glass, balconies,
  rooftop plant, ground floors that are a different material from the
  tower, and a billboard that is a separate object with its own
  artwork. The game's buildings have one material per face and zero
  relief.
- **Recommended upgrade (in order):**
  1. **Facade texture v2** — canvas-generated 512² maps with
     roughness variation, grime at the base, panel seams, and a
     matching roughness map (see §3.3). Cheapest, biggest texture win.
  2. **Facade depth** — window insets as shallow boxes (instanced,
     one per lit window row, not per window), a ground-floor band
     (glass + door + sign) as a separate box, and 2–3 setback steps on
     downtown towers. This is the expensive one; do it after the
     texture pass proves itself.
  3. **Billboards** — 3–5 large original illustrated billboards
     (canvas-drawn art, not copied) on downtown/coastal roofs, plus
     the existing 6 shop signs expanded to ~20 names with distinct
     type and colour.
- **Files:** `Buildings.ts` (all of it), `CityGenerator.ts` (setback
  data), `Merge.ts` (batching — must extend, not replace).
- **Difficulty:** Medium (texture v2) to High (facade depth — it
  touches the batching and the collision boxes, which currently assume
  a single box per plot).
- **Performance risk:** Medium. Texture v2 is near-free (same draw
  calls, larger textures). Facade depth adds geometry: budget +30–60
  draw calls at high tier if batched per material, more if not. Must
  stay inside the §6 draw-call budget.
- **Dependencies/assets:** none for the texture pass (procedural
  canvas); billboard art needs an artist pass (original illustration
  — canvas-drawn or a licensed stock illustration, never a GTA frame).

### 2.3 Roads, markings and sidewalks

- **Current:** flat colour planes; yellow dashes and white crosswalk
  stripes as instanced planes; no texture on asphalt or sidewalk;
  no arrows, turn lanes, parking bays, manholes, STOP lines, or
  street signs.
- **Gap:** the reference's road is the busiest surface in the frame:
  worn asphalt with patch repairs, white turn arrows, yellow box
  hatching, red-painted kerbs, a manhole cover, and a wet patch
  reflecting a car. The game's road is a flat dark rectangle.
- **Recommended upgrade:**
  1. **Asphalt + sidewalk texture v2** — 512² canvas textures with
     aggregate noise, cracks, patch rectangles and wear near the
     wheel lines, plus a roughness map so worn patches are shinier
     (the "wet" read, cheaply). Sidewalks get expansion joints and
     stains.
  2. **Marking kit** — turn arrows, STOP lines, yellow hatching,
     parking-bay lines, "ONLY" text, as instanced planes from one
     atlas texture (one draw call).
  3. **Street signs** — STOP signs, "3rd Street"-style avenue/street
     blades, parking signs, one-way arrows, as instanced meshes with
     canvas textures. These are the cheapest realism in the whole
     audit: the reference has at least six visible signs in one frame
     and the game has none.
  4. **Wet patches (optional, later)** — a few glossy dark planes
     with high metalness + low roughness once an env map exists; they
     read as puddles reflecting the sky. Do not attempt real planar
     reflections (see §3.7).
- **Files:** `Roads.ts` (all of it), `World.ts` (ground texture),
  new `StreetSigns.ts` or inside `Roads.ts`.
- **Difficulty:** Low (texture + markings + signs are all instancing
  and canvas work the codebase already does).
- **Performance risk:** Low. +3–6 draw calls, +2–3 MB textures.
- **Dependencies/assets:** none — procedural.

### 2.4 Vehicles and wheels

- **Current:** 4 player cars from one extruded-profile family; 6
  traffic categories from the same builder; mission sedan is a box;
  wheels spin (Phase 2) with rim discs; paint is clearcoat
  `MeshPhysicalMaterial` that reflects nothing; glass is near-black;
  no interiors, door lines, panel gaps, or dirt.
- **Gap:** the reference's cars are the most "real" objects in the
  frame because their paint and glass reflect the environment and
  their bodies have panel gaps, grilles, mirrors and lights with
  depth. The game's cars read as coloured toys — the silhouette is
  right, the surface is wrong.
- **Recommended upgrade (in order):**
  1. **Env map (§3.1) first** — it fixes paint, glass and rims with
     zero geometry change. Do not touch car geometry before this.
  2. **Detail pass on the existing builder** — door shut-lines and
     panel gaps as thin dark inset boxes, a real grille (dark box +
     slats), side mirrors with a reflective face, front/rear light
     clusters with depth (lens box + emissive core), number plates,
     and a simple dark interior box visible through the glass once
     the glass is transparent enough to see through.
  3. **Traffic variety** — 2–3 more body variants (hatchback, van,
     pickup) from the same extruded-profile builder, plus colour
     variation per category, so a traffic jam stops looking like
     clones.
  4. **Wheels v2** — tyre sidewall ring, 5-spoke rim geometry
     instead of a flat disc, brake disc behind the rim.
  5. **glTF cars (only if 1–4 are not enough)** — see §4. This is
     the last resort, not the first step: a single licensed car model
     is 2–10 MB and the current four cars cost nothing.
- **Files:** `Vehicle.ts`, `VehicleCatalog.ts`, `Traffic.ts`,
  `MissionVehicle.ts`, `Police.ts`, `VehiclePreview.tsx`.
- **Difficulty:** Low (env map) → Medium (detail pass) → High (glTF
  pipeline: loading, LOD, memory, licensing).
- **Performance risk:** Low for 1–3 (same draw calls, more batched
  boxes); Medium for glTF (per-car draw calls rise unless merged;
  budget in §6).
- **Dependencies/assets:** none for 1–4; glTF needs licensed or
  original models (§4).

### 2.5 Player character

- **Current:** ~22 meshes, all boxes/cylinders/spheres, flat colours,
  no face, no fingers, no clothing folds, no textures. Procedural
  walk/sprint/idle. Reads fine at 8.5 m chase distance; falls apart
  in cinematics, where the camera comes to ~4 m (A-audit §6: a 1.85 m
  character is ~14% of frame height at 10.8 m, and the close shots
  are the ones that expose the model).
- **Gap:** the reference's pedestrians have faces, hair, clothing
  with folds and logos, bags, phones — and they are *small in frame*.
  The game's protagonist is large in frame (chase cam + cinematics)
  and has the least detail of any character on screen.
- **Recommended upgrade:**
  1. **Detail pass on the existing rig** — a simple face (eyes/brows/
     mouth as tiny dark boxes or a canvas face texture on the head),
     fingers as a small box, shoe soles with tread colour, hoodie
     pocket and drawstrings, a watch/chain that catches the env map.
     Keep the ~22-mesh budget; swap boxes for slightly better boxes.
  2. **Outfit texture** — a canvas texture for the hoodie/tee with
     a chest graphic and fabric noise, instead of flat colour.
  3. **glTF character (only if 1–2 are not enough)** — a rigged,
     skinned original character with a walk/run animation set. This
     is the most expensive single asset decision in the project
     (rigging, skinning, animation retargeting, and the existing
     procedural animation system would need a compatibility layer).
     Do not start here.
- **Files:** `Character.ts`, `CharacterAnimation.ts`, `Outfits.ts`,
  `CinematicStaging.ts` (staged actors are recoloured protagonist
  rigs — they inherit the upgrade for free).
- **Difficulty:** Low (detail pass) → High (glTF rig).
- **Performance risk:** Low (detail pass); High for a skinned rig on
  mobile (skinning cost per character × 28 NPCs — NPCs must stay on
  the cheap rig; only the protagonist gets the upgrade).
- **Dependencies/assets:** none for 1–2; a rigged model needs an
  artist or a licensed rigged character (§4).

### 2.6 Pedestrian appearance and animation

- **Current:** 12 archetypes, 5 skins, 5 hair colours, 4 hair styles
  + cap, flat colours, procedural walk with bob/lean, ~14 instanced
  draw calls for 28 max. Reactions (glance, hurry, sidestep) exist
  and read well.
- **Gap:** the reference's crowd is diverse in *silhouette* — skirts,
  jackets, backpacks, hats, phones, different builds — and dense
  (20+ people in one crossing). The game's crowd is diverse in
  *colour* but identical in silhouette, and sparse (18 default).
- **Recommended upgrade:**
  1. **Silhouette variety on the existing instancing** — 3–4 new
     accessory meshes (backpack box, cap variants, shoulder bag,
     phone-in-hand) as additional instanced meshes toggled per
     archetype; 2–3 more archetypes (tall, short, heavy build via
     scale, already supported).
  2. **Density** — raise the default pedestrian count (18 → 24) and
     the busy cap (28 → 36) once the perf budget allows; add
     crossing groups (NPCs already use crosswalks — cluster their
     spawn so crossings look busy rather than random).
  3. **Walk-cycle polish** — the A-audit §3 already covers this
     (arm swing, foot planting); do not re-audit here.
- **Files:** `NPC.ts`, `PedestrianPaths.ts`, `Quality.ts` (counts).
- **Difficulty:** Low–Medium (accessories are instancing; density is
  a number change gated by perf).
- **Performance risk:** Low (+2–4 instanced draw calls); Medium for
  the density raise on low tier (gate it by tier).
- **Dependencies/assets:** none — procedural.

### 2.7 Traffic density and behaviour

- **Current:** 6 categories, 8–20 cars by tier (14 default), lane
  graph, stops at signals, yields to pedestrians and the player,
  brake-reactive tails, headlights always on. Behaviour is good;
  density is the gap.
- **Gap:** the reference's intersection has ~10 cars visible and
  reads as congested; the game's 14 cars are spread over a 380×380 m
  city, so most roads are empty most of the time.
- **Recommended upgrade:** raise the default traffic count (14 → 20)
  and the high cap (20 → 28) *after* the draw-call budget is
  re-measured; add parked cars along avenues (static, instanced, 1
  draw call — the cheapest density in the audit); add a simple
  "rush" clustering so cars bunch at the 6 signalised intersections
  rather than spreading evenly.
- **Files:** `Traffic.ts`, `TrafficPaths.ts`, `Quality.ts`.
- **Difficulty:** Low (numbers + parked cars).
- **Performance risk:** Low–Medium. Each active traffic car is
  several draw calls; parked cars are one instanced draw call.
  Measure before raising the cap (§6).
- **Dependencies/assets:** none.

### 2.8 Palm trees and vegetation

- **Current:** palms are a trunk cylinder + one 7-segment cone;
  park trees are a cylinder + an icosahedron blob; no hedges, no
  planters, no grass texture, no flower beds. Static (A8.16).
- **Gap:** the reference's palms have 8–12 arching fronds each, and
  its hedges are dense, trimmed boxes lining every sidewalk. The
  game's single cone is the most visibly "game-y" object in the
  beach screenshot — it reads as a traffic cone, not a tree.
- **Recommended upgrade:**
  1. **Palm rebuild** — trunk (curved, 2 segments) + 8–10 fronds
     as bent planes (or thin tapered boxes) arranged radially with
     droop, as 2 instanced meshes (trunks + fronds). This is the
     highest-visibility vegetation fix and it is pure geometry.
  2. **Hedges** — trimmed dark-green boxes with a noise-displaced
     top, instanced along sidewalks and around parks (the reference
     has hedges everywhere; the game has none).
  3. **Planters and flower beds** — instanced boxes with a colour
     speckle top; grass tufts as crossed planes on park lawns.
  4. **Sway (optional, later)** — a vertex-shader sway on the frond
     instanced mesh, amplitude ~2–3 cm, gated by tier. Cheap on GPU,
     but judge on a real device (A8.16).
- **Files:** `Vegetation.ts` (all of it), `Quality.ts` (palm counts).
- **Difficulty:** Medium (frond geometry + instancing; the bend is
  the fiddly part).
- **Performance risk:** Low–Medium. Fronds as instanced planes: +2
  draw calls. Sway shader: negligible. Hedge boxes: +1 draw call.
- **Dependencies/assets:** none — procedural.

### 2.9 Lighting and shadows

- **Current:** 2 lights (hemi + sun), ±100 m shadow frustum, no
  shadows beyond downtown, no contact shadows, no AO, fake
  streetlights, constant vehicle lights, no glow on the police bar
  or neon.
- **Gap:** the reference's realism is mostly *light*: long soft
  shadows from every object, ambient occlusion in every corner and
  under every car, hazy bounce light, sun glare, and neon that
  actually glows. The game's shadows are hard-edged, short-range,
  and absent where the player spends half their time (beach, tower).
- **Recommended upgrade (in order):**
  1. **Shadow camera follows the player** — re-centre the ±100 m
     frustum on the camera target each frame (or every 0.5 s), so
     shadows exist wherever the player is. Cost: one shadow-map
     re-render per move; the existing `autoUpdate = false` discipline
     already pays this only on change. This alone fixes A8.18.
  2. **Env map (§3.1)** — it is also a lighting fix: it supplies
     the bounce/ambient term the hemi light fakes badly, and it makes
     every material respond to the sky.
  3. **Contact darkening** — a cheap blob shadow (dark radial
     gradient plane) under the player, NPCs and cars, or a single
     screen-space AO pass on high/ultra only. Blob shadows are
     near-free and fix the "floating" read; SSAO is a real
     post-processing cost (see §3.6).
  4. **Real streetlight pools (later, high/ultra only)** — 2–4
     `PointLight`s with distance falloff near the player, or
     emissive pools painted on the ground under lamps. Do not add a
     point light per lamp (there are ~100 lamps).
  5. **Bloom for neon/signs/police bar** — see §3.8. This is what
     makes the sunset city glow instead of looking flat-orange.
- **Files:** `Lighting.ts`, `GameEngine.ts` (shadow update + follow),
  `Roads.ts` (lamp pools), `Police.ts`, `Buildings.ts` (neon trim).
- **Difficulty:** Low (shadow follow, blob shadows) → Medium
  (env map, bloom).
- **Performance risk:** Low for 1–3; Medium for bloom (fullscreen
  passes — gate by tier, §6); High for real point lights (do not do
  per-lamp lights).
- **Dependencies/assets:** none for 1–4; bloom needs `three/addons`
  (ships inside the `three` package — no new npm dependency, but a
  new import path and a render-loop change).

### 2.10 Reflections and materials

- **Current:** no env map, no reflections of any kind, no
  roughness/metalness variation, no clearcoat response. The ocean
  shader fakes glitter with a sine term.
- **Gap:** reflections are half the reference image: car paint
  reflecting the sky, windows reflecting the street, wet asphalt
  reflecting cars, building glass reflecting clouds. The game has
  none of these, so every surface reads matte.
- **Recommended upgrade:**
  1. **Env map (§3.1)** — the only reflection system the game
     needs for 90% of surfaces. One `PMREMGenerator` pass from the
     existing sky dome at startup; `scene.environment` set once.
  2. **Roughness variation** — canvas roughness maps on asphalt,
     facades and car paint (worn = shinier, dirty = rougher). Cheap,
     same draw calls.
  3. **Wet patches** — glossy dark planes (see 2.3.4).
  4. **Do NOT do planar reflections** (mirror render targets for
     the ocean or for car paint). They double the scene render cost
     and are the classic way to kill a browser game. The env map is
     the correct substitute.
- **Files:** `GameEngine.ts` (env map setup), `Lighting.ts` (sky
  source), `Buildings.ts`, `Roads.ts`, `Vehicle.ts`, `Environment.ts`.
- **Difficulty:** Low (env map + roughness maps).
- **Performance risk:** Low. PMREM is a one-time ~50–100 ms cost at
  startup; per-frame cost is ~0 (the env map is a texture lookup).
  Roughness maps add texture memory only.
- **Dependencies/assets:** none.

### 2.11 Environmental atmosphere

- **Current:** frozen sunset, flat gradient sky, no clouds, no haze
  variation, fog fixed per tier, ocean flat shader, no birds, no
  dust, no heat shimmer.
- **Gap:** the reference's atmosphere is *haze*: distant buildings
  dissolve into a pale sky, the sun has a glow, the air has depth.
  The game's sky is a saturated orange wall and the fog is a fixed
  salmon that does not match it (A8.21).
- **Recommended upgrade:**
  1. **Sky + fog harmonisation** — derive the fog colour from the
     sky shader's horizon colour at runtime (one uniform), and
     desaturate the sky gradient slightly (the current orange is
     more saturated than the reference's pale haze, and it fights
     every other colour in the scene). Keep the sunset — it is the
     game's identity — but make it a *soft* sunset.
  2. **Clouds** — 6–10 large soft billboards (canvas radial
     gradients) drifting slowly at high altitude, or a second
     gradient layer in the sky shader. Cheap, big mood win.
  3. **Birds** — 3–5 tiny dark "V" sprites circling the tower
     (the A-audit noted sky life is absent; birds are 1 draw call).
  4. **Day/night or time-of-day (NOT recommended now)** — A8.4
     notes the sunset is frozen. A full cycle is a large change
     (light rig, sky shader, fog, window lights, streetlight pools,
     and every emissive in the game). Park it as a post-transformation
     phase; the reference is daylight, but chasing daylight means
     re-lighting the whole game.
- **Files:** `Lighting.ts`, `GameEngine.ts` (fog), new `SkyLife.ts`
  or inside `Lighting.ts`.
- **Difficulty:** Low (fog/sky/clouds/birds).
- **Performance risk:** Negligible.
- **Dependencies/assets:** none.

### 2.12 Camera and visual effects

- **Current:** FOV 62, fixed 8.5 m chase, no speed pull-back, no FOV
  kick, no shake, no DoF, no vignette, no film grain, no motion
  blur. Cinematics are the only crafted framing.
- **Gap:** the reference is a *composed* image: a slightly high
  angle, a long lens feel, haze softening the distance, and a
  vignette pulling the eye to the intersection. The game's chase
  camera is functional but flat — same framing at 0 and at 137 km/h.
- **Recommended upgrade:**
  1. **Chase-camera feel** — speed-based distance pull-back
     (8.5 → 10.5 m) and FOV kick (62 → 66–68) at speed, subtle
     camera lag on turns, a tiny landing dip. All cheap (numbers in
     `GameEngine.ts`), and the A-audit already flagged the fixed
     distance as a nit.
  2. **Post-processing (high/ultra only)** — bloom (neon, signs,
     sun disc, police bar), a subtle vignette, and a slight
     saturation/contrast grade. Skip depth of field (expensive,
     and it fights gameplay readability) and skip motion blur.
  3. **Cinematic framing** — the A-audit §6 already covers shot
     variety; the graphics transformation should not re-do it, but
     the new lighting/env map automatically improves every
     cinematic for free.
- **Files:** `GameEngine.ts` (camera + post chain), `Cinematic.ts`
  (untouched), `src/styles/global.css` (vignette can be CSS, not a
  shader — cheaper).
- **Difficulty:** Low (camera feel, CSS vignette) → Medium (bloom
  chain).
- **Performance risk:** Low for 1; Medium for bloom (see §3.8 and
  §6 — gate by tier, measure on a real phone).
- **Dependencies/assets:** bloom needs `three/addons`
  (EffectComposer, UnrealBloomPass, OutputPass) — inside the `three`
  package, no new npm dependency.

### 2.13 UI presentation

- **Current:** system-ui font stack, no display typeface; flat dark
  pills and panels; menu is a CSS sky scene; no exit animations
  (A9.2), no Esc/backdrop close (A9.3), RangePanel ignores buy
  results (A9.4). HUD is functional and clean, but it looks like a
  web app, not a game.
- **Gap:** the reference's *signage* typography does the heavy
  lifting for realism, and the game's signage is Arial bold on a
  canvas. The game UI itself has no typographic identity: "VICE
  CITY STORIES" in system-ui bold is the first thing a player sees,
  and it is the least designed element in the product.
- **Recommended upgrade:**
  1. **Display typeface** — one licensed display font (e.g. a
     condensed sans in the spirit of the reference's signage, or a
     neon-script for the logo) loaded from a font file in `public/`
     (adds ~30–100 kB, one-time). Use it for the menu title, panel
     headings, money and wanted stars; keep system-ui for body text.
  2. **Menu art** — replace the CSS sky scene with a real render
     of the city (a screenshot from the improved build, or a live
     slow-orbit of the downtown) behind the title. The game will
     look better than any CSS drawing once §3–§5 land.
  3. **Panel polish** — exit animations, Esc/backdrop close (A9.2,
     A9.3 — already filed, fold them into this phase), a consistent
     accent colour, and a money/cash display that feels like a game
     HUD rather than a pill.
  4. **In-world signage typography** — more sign names, distinct
     fonts per sign (canvas fonts are free — use bold condensed for
     bars, script for cafés, block for garages), and larger, more
     legible street blades.
- **Files:** `src/components/MainMenu.tsx`, `SettingsPanel.tsx`,
  `MissionBoard.tsx`, `StoryBoard.tsx`, `GameCanvas.tsx`,
  `src/styles/global.css`, `Buildings.ts` (signs), `Roads.ts`
  (street blades).
- **Difficulty:** Low–Medium (font + CSS; no 3D work).
- **Performance risk:** Negligible (a font file; CSS animations are
  compositor-cheap).
- **Dependencies/assets:** one font file (open-licensed, e.g. OFL —
  see §4). No npm dependency.

---

## 3. Realistic rendering options for this Three.js architecture

Each option is judged on three axes: visual gain, implementation cost,
and runtime cost on the *existing* engine. "Do not recommend expensive
effects without estimating their performance cost" — the estimates
below are the audit's best judgement from the 9F perf baseline (152 /
247 / 308 draw calls, headless FPS unreadable, real-device FPS
unmeasured — see §6.1 for why the first phase must measure).

### 3.1 Environment maps (PMREM) — the highest-leverage change

- **What:** generate a `PMREMGenerator` environment map once at
  startup from the existing sky dome (or from `RoomEnvironment`),
  assign it to `scene.environment`. Every `MeshStandardMaterial` /
  `MeshPhysicalMaterial` in the scene then gets image-based lighting
  for free.
- **Gain:** the single biggest visual jump available. Car paint
  (clearcoat), glass (facades and car cabins), rims, the gold chain,
  neon trim and the ocean all start reflecting the sky instead of
  reading flat/dark. It also supplies the ambient/bounce term the
  hemisphere light currently fakes, so the whole city gets softer,
  more believable light.
- **Cost to implement:** Low — ~30 lines in `GameEngine.ts` /
  `Lighting.ts`, no new dependency (`PMREMGenerator` is core three).
  Then a material retune pass: most `metalness` values in the
  codebase were chosen *because* there was no env map (Traffic's
  near-zero metalness, glass at 0.9 reading black). With an env map,
  those values need re-tuning or the scene goes chrome-shiny.
- **Runtime cost:** one-time ~50–150 ms at startup for the PMREM
  pass (a 256² cubemap render); per-frame cost is effectively zero
  (a texture lookup in the existing shader). Memory: one 256²
  cubemap mip chain, ~2–4 MB.
- **Risk:** Low. The danger is over-shiny materials, which is a
  tuning problem, not an architecture problem. Gate: if the PMREM
  pass is too slow on low tier, generate it at 128² or skip the env
  map on low tier entirely (materials fall back to their current
  look).
- **Verdict: do this first, before any geometry or texture work.**

### 3.2 PBR materials and physically correct lighting

- **What:** the engine already uses `MeshStandardMaterial` /
  `MeshPhysicalMaterial` with ACES tone mapping — the PBR *plumbing*
  is there. What is missing is PBR *content*: no roughness maps, no
  metalness maps, no normal maps, and light intensities chosen by
  eye. `renderer.useLegacyLights` is not set anywhere (three 0.187
  defaults to physically correct), so the sun intensity 2.4 and hemi
  1.25 are already in physical units.
- **Gain:** Medium–High, but only *after* §3.1. Without an env map,
  PBR tuning is pushing on a rope.
- **Cost:** Low–Medium — a systematic retune of the ~40 material
  definitions, plus canvas-generated roughness maps (§3.3).
- **Runtime cost:** ~0 (same shaders, more texture lookups).
- **Verdict:** fold into the env-map phase; do not do it alone.

### 3.3 Texture maps and material maps (procedural v2)

- **What:** upgrade the canvas-texture generator from colour-only
  128×256 maps to a small procedural texture system: each surface
  gets a colour map (512²), a roughness map (same canvas, greyscale),
  and optionally a normal map derived from height (a cheap
  Sobel on the canvas, or a normal map painted directly for brick
  courses / panel seams). Surfaces: facades (5 styles), asphalt,
  sidewalk, sand, boardwalk, grass, car paint (flake noise),
  character clothing.
- **Gain:** High for facades and roads — the two surfaces the player
  looks at most. Grime, wear, panel seams and roughness variation
  are what make a surface read as real rather than painted.
- **Cost:** Medium — a new `Textures.ts` module (~300–500 lines)
  with a seeded generator per surface, replacing the one-off
  `makeFacadeTexture` / `makeSandTexture` / `makeBoardTexture`
  functions. The batching must keep sharing one material per
  texture, or draw calls rise.
- **Runtime cost:** texture memory. 512² RGBA × ~20 maps ≈ 20 MB
  (plus mipmaps ≈ 27 MB). Acceptable on desktop and on modern
  phones; on low tier, cap at 256² (≈ 5 MB). Load time is CPU canvas
  work at startup (~100–300 ms total, measurable in G0).
- **Verdict:** the second phase, immediately after the env map. Do
  not buy or download textures before proving the procedural system
  — the current canvas textures are already the right *pattern*,
  they are just too small and too flat.

### 3.4 High-quality original 3D models (glTF)

- **What:** replace the procedural builders with loaded glTF models
  for cars, characters, trees, or street furniture.
- **Gain:** High for cars and characters (the two things the player
  looks at up close), Medium for trees, Low for buildings (the
  procedural city is already well-batched; a glTF building is a
  worse deal than a better procedural one).
- **Cost:** High. A glTF pipeline means: a loader (`GLTFLoader`
  from `three/addons` — inside the three package), an asset
  directory in `public/`, async loading with the existing loading
  screen, LOD or impostors for distant cars, memory accounting, and
  a fallback if a model fails to load. Each model also needs a
  licence check (§4). The existing procedural animation system
  (walk cycles, wheel spin, steering) would need adapters for rigged
  models.
- **Runtime cost:** a single hero car at 50k triangles is fine; 20
  traffic cars at 50k each is 1M triangles and 20+ draw calls — too
  much without LOD and instancing, which glTF does not give you for
  free. Budget: hero cars ≤ 30k triangles, traffic ≤ 8k, trees ≤ 2k.
- **Verdict:** last resort for cars/characters, after the procedural
  detail passes (§2.4, §2.5) have been measured. Never for buildings.

### 3.5 Better character models and animation rigs

- **What:** a rigged, skinned protagonist (and optionally NPC
  variants) with a real walk/run/idle animation set, replacing the
  procedural box rig.
- **Gain:** Medium–High in cinematics (the only place the character
  is large in frame); Low in gameplay (8.5 m chase, the current rig
  reads fine).
- **Cost:** High — rigging, skinning, animation sourcing or
  authoring, retargeting, and a compatibility layer so the existing
  procedural systems (outfits, staged actors, combat poses) keep
  working. The A-audit §1–§2 already covers animation quality on the
  current rig; a new rig does not fix the findings, it replaces the
  system they were filed against.
- **Runtime cost:** skinning is per-vertex CPU/GPU work; 28 skinned
  NPCs on a phone is a real risk. The protagonist alone is fine.
- **Verdict:** do the cheap detail pass on the current rig first
  (§2.5.1–2); revisit a rigged model only if cinematics still read
  as toys after the env map and lighting land.

### 3.6 Ambient occlusion

- **Options, cheapest first:**
  1. **Blob shadows** — a dark radial-gradient plane under the
     player, each NPC, each car and each streetlight pole. ~0 GPU
     cost, 1 instanced draw call, and it fixes the "floating" read
     immediately. **Do this.**
  2. **Baked AO in textures** — darken the base of facades, under
     awnings and around windows in the canvas texture itself. Free
     (it is paint, not computation). **Do this with the texture v2
     pass.**
  3. **SSAO (screen-space ambient occlusion)** — `SSAOPass` from
     `three/addons`. Real contact darkening in every corner. Cost:
     a fullscreen depth/normal pass + blur, roughly +2–4 ms/frame on
     desktop, +6–12 ms on a phone — too much for low/medium tiers,
     borderline on high. **High/ultra only, and only after measuring
     in G0.** It is the most expensive effect in this audit per unit
     of visual gain, and the first thing to cut if the frame budget
     is tight.
- **Verdict:** blobs + baked AO everywhere; SSAO as an ultra-only
  experiment, never a default.

### 3.7 Shadow quality and cascaded shadows

- **Current:** one 2048² shadow map, ±100 m frustum, PCFSoft, manual
  update. The frustum is the problem, not the resolution.
- **Options:**
  1. **Follow the player** (recommended) — re-centre the frustum on
     the camera target. Same cost as now, shadows everywhere the
     player is. One shadow map, one render. **Do this in G1.**
  2. **Raise the map to 4096² on ultra** — sharper shadows, +4×
     memory (64 MB for a 4096² depth map) and a slower shadow render.
     Only if the follow-camera still leaves visible acne/aliasing.
  3. **Cascaded shadow maps (CSM)** — 3–4 cascades covering near to
     far with different resolutions. This is the AAA answer, and it
     is the wrong answer for this game: it multiplies the shadow
     render by the cascade count, needs `three/addons` CSM or a
     hand-rolled split, and the city is only 380 m across — a
     following single frustum covers it. **Do not do CSM.**
  4. **Contact shadows / blob shadows** — see §3.6.1. They cover the
     cases a single sun shadow cannot (under cars, in doorways).
- **Verdict:** follow-camera + PCFSoft, keep 2048², add blobs. No CSM.

### 3.8 Tone mapping, colour grading, fog and atmosphere

- **Current:** ACES, exposure 1.05, fixed salmon fog, flat gradient
  sky. ACES is the right choice and should stay.
- **Options:**
  - **Exposure per tier / per time:** a small exposure lift on low
    tier (where shadows are off and the image flattens) — a number
    change, free.
  - **Colour grade:** a fullscreen grade pass (lift/gamma/gain +
    saturation) via `OutputPass` + a custom shader, or — cheaper —
    bake the grade into the sky shader and the material colours.
    A full grade pass costs one fullscreen quad (~0.5 ms); do it
    only if the post chain exists for bloom anyway.
  - **Fog:** derive fog colour from the sky horizon uniform at
    runtime (one line), and consider `FogExp2` for a softer distance
    falloff. FogExp2 is a one-word change with a real atmosphere
    payoff; test it against the current linear fog in G1.
  - **Bloom:** `UnrealBloomPass` (threshold ~0.85, strength ~0.35,
    radius ~0.4) so neon trim, signs, the sun disc, the beacon and
    the police bar glow. Cost: 2–3 fullscreen blur passes,
    roughly +1.5–3 ms desktop, +4–8 ms mobile. **High/ultra only,
    off on low/medium.** This is the single post effect worth its
    cost, because the game's identity is neon at sunset.
  - **Vignette:** do it in CSS (`radial-gradient` overlay), not in
    a shader — free, and it survives the post chain being off.
- **Verdict:** keep ACES; harmonise fog/sky; add bloom on high/ultra
  only; vignette in CSS. No other grade pass until the post chain
  exists.

### 3.9 Anti-aliasing

- **Current:** MSAA via `antialias: true` on medium/high/ultra,
  off on low. MSAA is the right choice for this scene (hard
  geometric edges, no heavy shader aliasing) and it is already on.
- **Options:** FXAA/SMAA as a post pass would be *worse* than the
  MSAA already in use (blurrier, and it costs a fullscreen pass).
  TAA would need motion vectors and a history buffer — too much for
  this codebase. **Do not change AA.** The one gap is low tier
  (no AA at all); the cheap fix is raising low-tier pixelRatio to
  1.25 on devices that can afford it, or accepting jagged edges on
  the battery-saver tier.
- **Verdict:** no change.

### 3.10 Level of detail and distance-based optimisation

- **Current:** none. No `THREE.LOD`, no distance culling beyond
  frustum culling, no impostors. Building counts are the only
  distance lever (fewer buildings on low tier), and they are chosen
  once at startup.
- **Options, cheapest first:**
  1. **Distance-based visibility for detail meshes** — balconies,
     rooftop props, street furniture and signs hide beyond ~120 m
     (they are sub-pixel at that distance anyway). Implementation:
     one `visible` toggle per instanced mesh per frame, or three
     distance buckets built at startup. Cost: ~0 GPU, a few lines.
     **Do this.**
  2. **`THREE.LOD` for hero objects** — the 4 player cars and the
     Beacon Tower get a low-poly LOD beyond ~60 m. Cost: Medium
     (each LOD level is a second geometry to author/maintain).
     Worth it only if the glTF route is taken; the procedural cars
     are already low-poly.
  3. **Impostors for distant buildings** — flat textured quads
     beyond ~250 m. The city is only 380 m across and the fog
     already hides the far side; impostors buy almost nothing here.
     **Do not do this.**
  4. **Occlusion culling** — the city is an open grid with no
     interior spaces; frustum culling already does most of the work.
     **Do not do this.**
- **Verdict:** distance toggles for detail meshes only. The existing
  batching + frustum culling is the right architecture for this
  scene; LOD is a solution to a problem the game does not have.

### 3.11 Instancing and draw-call management

- **Current:** the best-engineered part of the renderer. Buildings
  are merged per material (~25 draw calls), roads are merged per
  material, dashes/crosswalks/lights/bulbs/palms/trees/benches/
  umbrellas/balconies/rooftops are `InstancedMesh`, NPCs are ~14
  instanced draw calls for 28 pedestrians, traffic is instanced per
  part. Baseline: **152 / 247 / 308 draw calls**.
- **Rule for the whole transformation:** every new visual feature
  must arrive as a merged batch or an `InstancedMesh`, never as one
  mesh per object. A street-furniture pass that adds 200 meshes is a
  regression; the same pass as 4 instanced meshes is free.
- **Budget (see §6):** high tier must stay under ~400 draw calls;
  ultra under ~500; low under ~200. Any phase that breaches its
  budget stops and re-batches before it ships.
- **Verdict:** the architecture is sound. The transformation adds
  *content* through the existing batching, it does not replace the
  batching.

### 3.12 What is NOT recommended

- **Ray tracing / path tracing:** not available in WebGL without a
  compute path; irrelevant for a real-time browser game.
- **Planar reflections:** double render cost; the env map is the
  substitute.
- **Real-time global illumination:** no WebGL GI exists at this
  scale; baked lightmaps would need a UV2 pass over the whole city
  and would break the procedural layout.
- **Cascaded shadow maps:** see §3.7 — overkill for a 380 m city.
- **Volumetric fog / light shafts:** a fullscreen raymarch is
  5–15 ms on desktop and unusable on mobile; fake it with the
  fog colour and a sun-glow sprite.
- **Photogrammetry / scanned assets:** heavy, inconsistently lit,
  and a licensing minefield for a student project.
- **Replacing Three.js with another engine:** the engine is not the
  bottleneck. The bottleneck is content and the missing env map.

---

## 4. Asset strategy — how to get original assets

**The rule, restated:** no asset from GTA or any other game, no
ripped model, no screenshot traced into a texture, no copied logo or
brand name. The reference's "FF BURGERS" and "Fire" billboard are
examples of *what a sign looks like*, not assets to reproduce. Every
route below produces original work.

### 4.1 What the game already proves

The current game is 100% procedural and original — every texture is
drawn on a canvas at runtime, every model is built from primitives.
That is not a limitation to escape; it is the asset strategy's
foundation. The procedural route has already produced a coherent city
at zero asset cost and zero licensing risk, and the audit's first three
phases (§5: G1–G3) need no external asset at all. **Do not buy assets
before the procedural upgrades are measured** — a bought car model
will still look flat without the env map, and a bought building
texture will still look flat without roughness variation.

### 4.2 Free / openly licensed assets (use with attribution where required)

| Asset class | Sources (verify licence per file) | Notes |
|---|---|---|
| Fonts | Google Fonts (OFL): e.g. a condensed sans for signage, a script for the logo | One font file in `public/`, ~30–100 kB. OFL allows redistribution. |
| Textures | Poly Haven (CC0): asphalt, concrete, brick, sand, grass; ambientCG (CC0) | CC0 = no attribution needed. Use as *reference* for the procedural generator, or as real maps if the pipeline (§3.3) supports loading them. A 1k texture is ~1–4 MB — budget it (§6). |
| 3D models (props) | Kenney (CC0): street props, trees, cars (low-poly); Quaternius (CC-BY): low-poly vehicles/characters; Poly Pizza (CC0, via Sketchfab) | Low-poly packs match the game's current style; they are a *density* source (benches, bins, hydrants), not a realism source. Attribution required for CC-BY — keep a `docs/asset-credits.md`. |
| 3D models (hero) | Sketchfab CC-BY / CC0 filtered search; CGTrader free section | Verify per-model licence, poly count and rig. A "free" model with a non-commercial licence is unusable if the game is ever commercialised — check before importing, not after. |
| HDRIs / env maps | Poly Haven HDRIs (CC0) | One 1k HDRI (~2–5 MB) as an alternative env-map source to the procedural sky PMREM. The sky-derived env map (§3.1) is free and matches the sunset; an HDRI is only needed if the sky PMREM looks wrong. |
| Sound | — | Out of scope for this audit. |

### 4.3 Original procedural assets (the default route)

This is where most of the transformation lives, and it is the safest
route:

- **Buildings:** facade texture v2 (§3.3) + facade depth (§2.2) —
  canvas-drawn, seeded, zero licensing, zero download.
- **Cars:** detail pass on the extruded-profile builder (§2.4) —
  original designs, already proven.
- **Characters:** detail pass on the box rig (§2.5) + accessory
  instancing (§2.6) — original.
- **Trees and plants:** palm rebuild + hedges + planters (§2.8) —
  procedural geometry.
- **Street furniture:** signs, benches, bins, hydrants, planters,
  bollards (§2.1/2.3) — procedural boxes/cylinders with canvas
  textures.
- **Signs and storefronts:** expand the 6 canvas sign names to ~20,
  add street blades, billboards with original canvas illustration
  (§2.2/2.13).
- **Road and sidewalk textures:** canvas texture v2 (§2.3/§3.3).

Procedural assets have three properties bought assets do not: they
cost no download, they match the art direction by construction, and
they can be regenerated at any resolution for any tier.

### 4.4 Custom-created assets (when procedural is not enough)

- **Billboard art:** 3–5 original illustrations (sunset skyline, a
  surf brand, a fictional cola, a concert poster). Commission or draw
  in a vector tool, export as PNG, load as a texture. This is the one
  place a human artist beats a canvas generator, because a billboard
  is *supposed* to look like designed art.
- **Hero car / hero character (only if §2.4/§2.5 prove insufficient):**
  commission a single original low-poly model, or build it in Blender
  (free) from the existing procedural design as a reference. A Blender
  model built from the game's own car spec is original by
  construction and avoids every licensing question.
- **Display font:** see §4.2 — one OFL font file.

### 4.5 What not to do

- Do not download a "GTA V car pack" or any ripped game asset, even
  from a site that hosts it. The licence is void and the asset will
  not match the art direction anyway.
- Do not use AI-generated textures or models as a shortcut without
  checking their licence and their consistency — a generated asphalt
  texture that does not tile will look worse than the current flat
  colour, and a generated car will not share the game's proportions.
- Do not import a 200k-triangle "realistic" model and hope LOD fixes
  it. Poly budget first (§6), model second.
- Do not put assets in the repo without a licence note. Every
  external file gets a line in `docs/asset-credits.md` (source, licence,
  date, what it is used for).

---

## 5. Phased implementation roadmap (dependency order)

**How to read this:** each phase is independently shippable and
independently reversible (the game stays playable after every phase).
A phase starts only after the previous phase's completion criteria
pass live in a real browser, with the regression tests listed. No
phase changes mission, story, cash, save or progression logic. No
phase adds an npm dependency. Phases G1–G3 need no external asset.
The roadmap assumes the G0 baseline is measured first — without it,
every later perf claim is a guess.

### Phase G0 — Measurement baseline (no visual change)

- **Visual improvement:** none (deliberately). This phase buys the
  numbers every later phase is judged against.
- **Work:** a perf harness script (draw calls, triangles, texture
  memory, heap, FPS on desktop + one real phone if available) run
  against the current build at all four tiers; a screenshot set
  (spawn, downtown intersection, beach, tower plaza, night-free
  sunset, 390 px) saved as the before-set; a draw-call budget
  written down (§6).
- **Files likely to change:** new `docs/graphics-baseline.md` and
  QA scripts under `~/workspace/qa-shots/` only. No game file.
- **Assets:** none.
- **Difficulty:** Low.
- **Performance risk:** none.
- **Regression tests:** the existing suites (qa81, qa85-mobile,
  the Phase 1/2 verification scripts) run green on the untouched
  build — proving the harness measures the right thing.
- **Completion criteria:** a written baseline (draw calls, triangles,
  FPS, heap, load time per tier) and a before-screenshot set; the
  numbers are the acceptance gate for every later phase.

### Phase G1 — Lighting foundation (env map, shadow follow, sky/fog)

- **Visual improvement:** the single biggest jump. Paint, glass,
  rims and neon start reflecting the sky; shadows exist wherever
  the player is; the sky and fog stop fighting each other.
- **Work:** PMREM env map from the sky dome at startup
  (`scene.environment`); material retune (metalness/roughness
  values chosen for no-env-map get re-tuned); shadow camera follows
  the player; fog colour derived from the sky horizon uniform;
  exposure per tier.
- **Files:** `GameEngine.ts`, `Lighting.ts`, `Vehicle.ts`,
  `Traffic.ts`, `Buildings.ts` (material values only), `Quality.ts`
  (exposure/fog per tier).
- **Assets:** none.
- **Difficulty:** Low–Medium (the PMREM call is 30 lines; the
  retune is the work — ~40 material definitions to re-check by eye).
- **Performance risk:** Low (one-time PMREM ~50–150 ms; per-frame ~0).
  Risk is over-shiny materials, caught by the screenshot set.
- **Regression tests:** qa81 + qa85-mobile green; screenshot
  comparison (before/after at the 6 baseline spots, desktop + 390 px);
  heap delta 0 over 5 cinematic cycles (9F method); no new console
  errors.
- **Completion criteria:** car paint and glass visibly reflect the
  sky in the downtown screenshot; shadows present at the tower and
  the beach; fog and horizon match; draw calls unchanged; load time
  +<200 ms.

### Phase G2 — Texture system v2 (procedural maps with roughness)

- **Visual improvement:** surfaces stop looking painted. Facades get
  grime, panel seams and roughness variation; asphalt gets wear and
  patch repairs; sidewalks get joints and stains.
- **Work:** a `Textures.ts` module: seeded canvas generator producing
  colour + roughness maps (512² high/ultra, 256² low/medium) for
  facades (5 styles), asphalt, sidewalk, sand, boardwalk, grass.
  Baked AO at facade bases and under awnings. Replace the one-off
  texture functions.
- **Files:** new `src/game/Textures.ts`; `Buildings.ts`,
  `Roads.ts`, `World.ts`, `Environment.ts` (texture calls only).
- **Assets:** none (procedural). Poly Haven CC0 textures are the
  *reference* for what the generator should produce, not an import.
- **Difficulty:** Medium (~300–500 lines, and the batching must keep
  one material per texture).
- **Performance risk:** Low (same draw calls; +~20 MB texture memory
  at 512², +~5 MB at 256² — gate by tier).
- **Regression tests:** qa81 + qa85-mobile green; texture memory
  measured per tier; screenshot comparison (facade close-up, road
  close-up, beach).
- **Completion criteria:** a facade close-up shows seams, grime and
  varied roughness; asphalt shows wear near wheel lines; no texture
  seams or stretching visible at 8.5 m chase distance; draw calls
  unchanged.

### Phase G3 — Buildings v2 (facade depth, storefronts, billboards)

- **Visual improvement:** buildings gain depth — recessed windows,
  a distinct ground floor, setbacks on towers, rooftop plant, and
  3–5 original billboards. The downtown screenshot stops reading as
  slabs.
- **Work:** window insets as instanced shallow boxes; ground-floor
  band (glass + door + sign) as a separate batched box; 2–3 setback
  steps on downtown towers (layout data change); billboard objects
  with original canvas art on downtown/coastal roofs; sign names
  expanded 6 → ~20.
- **Files:** `Buildings.ts`, `CityGenerator.ts` (setback data),
  `Merge.ts` (batching — extend, not replace), `World.ts`
  (collision boxes — facade depth changes the footprint by the inset
  amount; the collision box must grow to match, as the storefront
  already does).
- **Assets:** billboard art (original canvas illustration — 3–5
  images, drawn for this game).
- **Difficulty:** High (touches batching and collision; the
  storefront precedent shows the pattern).
- **Performance risk:** Medium — budget +30–60 draw calls at high
  tier, gated by the §6 budget. If it breaches, cut the window
  insets first (they are the most expensive per unit of gain).
- **Regression tests:** qa81 + qa85-mobile green; building-collision
  tests (the Phase 2 test-13 method: player and GT stop at the
  tower and at a storefront); draw-call count per tier; screenshot
  comparison.
- **Completion criteria:** a downtown street-level screenshot shows
  recessed windows, a glass ground floor and a billboard; the player
  still stops at the shop front, not inside it; draw calls within
  budget.

### Phase G4 — Roads, signs and street furniture (density pass)

- **Visual improvement:** the street stops being empty. Signs,
  furniture, parked cars, hedges and markings fill every frame —
  the reference's density, built from instancing.
- **Work:** marking kit (arrows, STOP lines, hatching, parking
  bays) from one atlas texture; street signs (STOP, street blades,
  parking, one-way) as instanced meshes; street furniture
  (benches, bins, hydrants, planters, bollards) as instanced meshes;
  parked cars along avenues (static, instanced); hedges along
  sidewalks and parks.
- **Files:** `Roads.ts`, new `StreetFurniture.ts` (or inside
  `Roads.ts` / `Vegetation.ts` — one home, not three),
  `Vegetation.ts` (hedges), `Traffic.ts` (parked cars),
  `CityGenerator.ts` (furniture placement data).
- **Assets:** none (procedural).
- **Difficulty:** Low–Medium (all instancing work the codebase
  already does well).
- **Performance risk:** Low (+6–10 draw calls if instanced;
  this is the phase that must not be done as one-mesh-per-object).
- **Regression tests:** qa81 + qa85-mobile green; collision tests
  (furniture must not block the player or the car — furniture is
  visual only, or its collision boxes are added explicitly and
  tested); draw-call count per tier.
- **Completion criteria:** the downtown intersection screenshot
  shows signs, furniture and parked cars in frame; the player can
  still walk and drive every street; draw calls within budget.

### Phase G5 — Vegetation rebuild (palms, hedges, grass)

- **Visual improvement:** the single-cone palm — the most visibly
  fake object in the game — becomes a real palm; hedges and planters
  finish the street edge.
- **Work:** palm rebuild (curved trunk + 8–10 bent frond planes,
  2 instanced meshes); hedge boxes with a displaced top; planters;
  grass tufts on park lawns; optional frond sway shader (gated by
  tier, judged on a real device).
- **Files:** `Vegetation.ts` (all of it), `Quality.ts` (palm counts).
- **Assets:** none (procedural).
- **Difficulty:** Medium (the frond bend is the fiddly part).
- **Performance risk:** Low–Medium (+2–3 draw calls; sway shader
  negligible).
- **Regression tests:** qa81 + qa85-mobile green; screenshot
  comparison (beach + avenue palms at close range and at 50 m);
  sway judged on a real device if enabled.
- **Completion criteria:** a palm close-up shows separate fronds
  with droop; the beach screenshot no longer has a green triangle
  dominating the frame; draw calls within budget.

### Phase G6 — Vehicles v2 (detail pass + traffic variety)

- **Visual improvement:** cars gain panel gaps, grilles, mirrors,
  light clusters with depth, interiors visible through the glass,
  and number plates; traffic stops looking like clones.
- **Work:** detail pass on the existing extruded-profile builder
  (inset boxes, merged by material); 2–3 more traffic body variants
  + colour variation; wheel v2 (sidewall ring, 5-spoke rim, brake
  disc); brake-light brightening and reverse light (A8.7).
- **Files:** `Vehicle.ts`, `VehicleCatalog.ts`, `Traffic.ts`,
  `MissionVehicle.ts`, `Police.ts`.
- **Assets:** none (procedural). glTF is explicitly *not* in this
  phase — it is a decision point after G6 is measured (see §3.4).
- **Difficulty:** Medium.
- **Performance risk:** Low (same draw calls, more batched boxes).
- **Regression tests:** qa81 + qa85-mobile green; the Phase 2
  wheel tests (spin ratio 2.93–2.94 rad/m, freeze when parked);
  garage preview renders all four cars; screenshot comparison
  (car close-up, traffic jam).
- **Completion criteria:** a car close-up shows panel gaps, a
  grille and a mirror; the garage preview still works; traffic
  variety is visible in one intersection screenshot.

### Phase G7 — Characters (detail pass, accessories, density)

- **Visual improvement:** the protagonist gains a face, fingers,
  clothing detail and an outfit texture; NPCs gain accessories and
  silhouette variety; crossings look busy.
- **Work:** face + fingers + pocket/drawstrings on the existing rig;
  hoodie/tee canvas texture; 3–4 accessory instanced meshes
  (backpack, bag, phone, hat variants); 2–3 more archetypes;
  pedestrian density raise (18 → 24 default, 28 → 36 busy) gated
  by the perf budget; crossing-group clustering.
- **Files:** `Character.ts`, `CharacterAnimation.ts`, `Outfits.ts`,
  `NPC.ts`, `PedestrianPaths.ts`, `Quality.ts`,
  `CinematicStaging.ts` (inherits the rig upgrade).
- **Assets:** none (procedural). A rigged glTF character is
  explicitly *not* in this phase (see §3.5).
- **Difficulty:** Low–Medium.
- **Performance risk:** Low (detail pass); Medium for the density
  raise on low tier (gate by tier).
- **Regression tests:** qa81 + qa85-mobile green; the Phase 2
  collision tests (walk-in min 1.10 m, drive-in min, NPC resume,
  no jitter); dialogue/cinematic regression (the Phase 1 tests);
  screenshot comparison (cinematic close-up, crossing).
- **Completion criteria:** a cinematic close-up shows a face and
  clothing detail; a crossing screenshot shows 8+ pedestrians with
  visible variety; collision behaviour unchanged.

### Phase G8 — Atmosphere and post (bloom, clouds, sky life)

- **Visual improvement:** neon and signs glow, the sun has a halo,
  clouds drift, birds circle the tower — the sunset city finally
  looks like evening rather than a flat orange render.
- **Work:** `EffectComposer` + `UnrealBloomPass` (threshold ~0.85,
  strength ~0.35) + `OutputPass`, **high/ultra only**; CSS vignette
  (all tiers, free); clouds as drifting billboards; birds as 1
  instanced draw call; sun-glow sprite.
- **Files:** `GameEngine.ts` (post chain + tier gating),
  `Lighting.ts` (clouds/birds/sun glow), `src/styles/global.css`
  (vignette), `Quality.ts` (post on/off per tier).
- **Assets:** none.
- **Difficulty:** Medium (the post chain is a render-loop change;
  the composer must not break the existing manual shadow updates
  or the cinematic camera).
- **Performance risk:** Medium–High — the most expensive phase per
  frame (+1.5–3 ms desktop, +4–8 ms mobile for bloom). This is the
  phase most likely to be cut or gated harder after measurement.
- **Regression tests:** qa81 + qa85-mobile green; FPS measured per
  tier with bloom on/off; screenshot comparison (neon at dusk,
  police bar at night-free sunset); no new console errors.
- **Completion criteria:** neon trim, signs and the beacon visibly
  glow on high tier; FPS stays above the §6 floor on high tier;
  low/medium tiers are pixel-identical to before (post off).

### Phase G9 — UI presentation (typography, menu, panels)

- **Visual improvement:** the game gets a typographic identity;
  the menu shows the improved city; panels animate and close
  properly.
- **Work:** one OFL display font in `public/`; menu background
  replaced with a live slow-orbit of the downtown (or a screenshot
  from the G8 build); exit animations + Esc/backdrop close (A9.2,
  A9.3); RangePanel buy-result handling (A9.4); signage typography
  variety (distinct canvas fonts per sign type).
- **Files:** `src/components/MainMenu.tsx`, `SettingsPanel.tsx`,
  `MissionBoard.tsx`, `StoryBoard.tsx`, `GameCanvas.tsx`,
  `src/styles/global.css`, `Buildings.ts` (signs), `Roads.ts`
  (street blades).
- **Assets:** one OFL font file (~30–100 kB) + a licence line in
  `docs/asset-credits.md`.
- **Difficulty:** Low–Medium (no 3D work).
- **Performance risk:** Negligible.
- **Regression tests:** qa81 + qa85-mobile green; panel open/close
  tests (Esc, backdrop, exit animation completes); 390 px menu
  layout.
- **Completion criteria:** the menu title uses the display font;
  the menu background is the city, not a CSS drawing; every panel
  closes with Esc and with a backdrop click; no layout overflow at
  390 px.

### What the roadmap deliberately does NOT include

- **Day/night cycle** — a full re-light of the game (A8.4). Park it
  until after G9; the reference is daylight, but the game's identity
  is sunset, and a cycle is a project of its own.
- **glTF hero models** — a decision point after G6/G7 are measured,
  not a scheduled phase. If the procedural detail passes read as
  good enough in the screenshot comparisons, skip glTF entirely.
- **CSM, planar reflections, SSAO by default, volumetric fog,
  ray tracing** — see §3.12. Each was evaluated and rejected on
  cost/benefit for this architecture.
- **Any gameplay, story, mission, save or progression change** —
  out of scope for the whole transformation. The visual layer is
  replaced underneath systems that do not move.

### Retained vs replaced (summary)

| System | Fate |
|---|---|
| Engine, renderer, camera, input, game loop | Retained; post chain added alongside, not instead |
| Batching (`GeometryBatch` + `InstancedMesh`) | Retained and extended — the rule for all new content |
| City layout data (`CityGenerator.ts`) | Retained; extended with setbacks/furniture data |
| Lighting rig (2 lights) | Retained; env map added, shadow camera follows player |
| Quality tiers + auto step-down | Retained; extended with post on/off and texture caps |
| Vehicle builder (extruded profiles) | Retained; detail pass on top |
| Character rig (procedural) | Retained; detail pass on top |
| NPC / traffic systems | Retained; accessories, variants and density on top |
| Story, dialogue, cinematics, missions, combat, garage, shop | Untouched — they inherit the visual upgrade for free |
| Building geometry (unit box) | Replaced in stages (G2 texture, G3 depth) |
| Road/sidewalk surfaces | Replaced in stages (G2 texture, G4 markings/signs) |
| Vegetation (palms/trees) | Replaced (G5) |
| Sky shader | Retained; harmonised with fog, clouds added (G1/G8) |
| Ocean shader | Retained; revisited only if it still reads flat after G1 |
| UI styling | Replaced in stages (G9); UI logic untouched |

---

## 6. Performance requirements

### 6.1 The measurement gap (state it plainly)

The audit could not measure real FPS: headless Chromium with
SwiftShader reads 1 FPS, which is not a measurement (9F said the
same). Draw calls are the only hard numbers (152 / 247 / 308), and
they are a proxy, not a frame time. **Phase G0 exists because every
perf claim in this section is an estimate until a real device is
measured.** The numbers below are budgets to hold the phases to, not
measurements of the current game.

### 6.2 Budgets (the numbers each phase must stay inside)

| Metric | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Draw calls (target ceiling) | ≤ 200 | ≤ 300 | ≤ 400 | ≤ 500 |
| Triangles (rough ceiling) | ≤ 400k | ≤ 800k | ≤ 1.5M | ≤ 2.5M |
| Texture memory | ≤ 16 MB | ≤ 32 MB | ≤ 64 MB | ≤ 96 MB |
| Pixel ratio | 1 | 1.5 | 2 | 2 |
| Shadows | off | 1024² | 2048² | 2048² |
| Post (bloom) | off | off | on | on |
| SSAO | off | off | off | experiment only |
| Target FPS (desktop GPU) | 30 | 45 | 60 | 60 |
| Target FPS (modern phone) | 30 | 30 | — | — |

Current baseline for reference: 152 / 247 / 308 draw calls, 0 MB heap
growth over 5 cinematic cycles, bundle 1,148.94 kB JS / 312.43 kB
gzip, `dist/` 1.2 MB, zero image assets. The transformation's
headroom is roughly +100 draw calls at high tier and +50–80 MB of
texture/model memory before the game stops being a light web page
and starts being a heavy download.

### 6.3 Desktop performance

- **The game will run well on a desktop.** The current draw-call
  count is low for a 3D game, the batching is disciplined, and the
  most expensive proposed changes (env map, roughness maps, shadow
  follow, blob shadows, instancing) cost ~0 per frame. A desktop
  with any discrete GPU from the last 8 years, or any Apple Silicon
  Mac, should hold 60 FPS at high tier after G1–G7. Bloom (G8) is
  the only phase that can break that, and it is gated to high/ultra
  with a measured FPS floor.
- **Hardware floor (honest):** integrated graphics (Intel UHD /
  older AMD APUs) should target medium at 30–45 FPS; anything below
  that is low tier. The auto step-down already handles this, but it
  only steps *down* — a player who starts on low and buys a better
  machine must raise the preset manually, which is correct behaviour.

### 6.4 390 px mobile compatibility

- **Mobile is the constraint that decides the whole
  transformation.** The 390 px layout is already clean (qa85-mobile:
  no overflow, dialogue panel 370 wide, choices work). The risk is
  not layout — it is GPU and memory.
- **Low tier must remain the safe fallback:** no shadows, no AA, no
  post, 256² textures, 28 buildings, 12 palms, and the density
  raises in G4/G7 gated off on low. A phone that can only run low
  tier must still get the *gameplay* — the transformation must never
  make low tier unplayable.
- **Modern phones (A14 / Snapdragon 865 and newer, 6 GB RAM):**
  medium at 30 FPS is realistic after G1–G7; high is a stretch and
  should be offered, not defaulted. Bloom on a phone is +4–8 ms —
  that is the difference between 30 FPS and 20 FPS, so it stays off
  on mobile unless measured otherwise.
- **Touch controls** are unaffected by the graphics work (they are
  DOM, not 3D), but the screenshot comparison in every phase must
  include a 390 px shot — a texture or a sign that reads at 1280 px
  can turn to noise at 390 px.

### 6.5 Low / medium / high presets (what each tier gets after the transformation)

| Feature | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Env map | off (or 128²) | 256² | 256² | 256² |
| Texture resolution | 256² | 256² | 512² | 512² |
| Facade depth (G3) | off | on | on | on |
| Street furniture (G4) | sparse | on | on | on |
| Palm rebuild (G5) | on | on | on | on |
| Vehicle/character detail (G6/G7) | on | on | on | on |
| Density raises (G4/G7) | off | on | on | on |
| Bloom (G8) | off | off | on | on |
| SSAO | off | off | off | experiment |
| Shadow map | off | 1024² | 2048² | 2048² |
| Shadow follow | — | on | on | on |

The principle: **geometry and texture upgrades ship on every tier**
(they are cheap); **per-frame effects are tier-gated** (they are not).

### 6.6 Asset loading and memory

- **Loading:** all current textures are generated at runtime
  (canvas), so there is no download and no async texture loading.
  The texture v2 pass (G2) adds ~100–300 ms of canvas work at
  startup — measure it in G0 and split it across frames if it
  exceeds 300 ms. glTF models (if ever taken) would be the first
  real downloads: each model loads async behind the existing loading
  screen, with a procedural fallback if it fails.
- **Memory:** the current game holds ~0 MB of texture memory
  (canvas textures are tiny). The transformation's memory is
  dominated by G2 textures (20 MB at 512²) and any glTF models
  (2–10 MB each). Total budget: under 100 MB of GPU-visible assets
  on high tier. The heap baseline (0 MB growth over 5 cinematic
  cycles, 9F) must be re-checked after every phase — a texture or
  model leak would show up there first.
- **Progressive loading:** the city is built synchronously at
  startup today. If G3/G4 push startup past ~2 s on a phone, split
  the build: core city first, furniture/vegetation in a second
  idle-callback pass. Do not build this until G0 measures a problem.

### 6.7 Draw calls, shadows, LOD and culling (summary)

- **Draw calls:** the budget table in §6.2 is the contract. Every
  phase's completion criteria include a draw-call count per tier.
- **Shadows:** one following 2048² map (G1). No CSM. Shadow render
  cost is one extra scene render at the shadow resolution — the
  existing `autoUpdate = false` discipline (re-render only on
  change) keeps it cheap while driving, and it re-renders every
  frame while the camera moves, which is correct.
- **LOD:** distance toggles for detail meshes only (§3.10). No
  `THREE.LOD`, no impostors, no occlusion culling — the scene does
  not need them.
- **Culling:** frustum culling stays default-on; instanced meshes
  stay `frustumCulled = false` (they span the city). If a future
  instanced set is spatially clustered (e.g. parked cars per avenue),
  split it per cluster so culling can work — a one-line change per
  set, worth doing in G4.

### 6.8 Realistic hardware requirements (after the full transformation)

| Tier | Desktop GPU (rough) | Phone (rough) | Expected experience |
|---|---|---|---|
| Low | Intel UHD / any iGPU | Any smartphone from ~2019 | Playable 30 FPS, no shadows/post, flat-ish but complete |
| Medium | GTX 1050 / M1 | A14 / Snapdragon 865, 6 GB | 30–45 FPS, shadows, full density, no bloom |
| High | GTX 1660 / RTX 2060 / M1 Pro | A16 / Snapdragon 8 Gen 2, 8 GB | 60 FPS desktop, bloom on, full detail |
| Ultra | RTX 3070+ / M2 Pro+ | — (not offered on phones) | 60 FPS, 2048² shadows, bloom, SSAO experiment |

These are estimates, not benchmarks — G0's job is to replace them
with measurements on the hardware available.

---

## 7. Honest assessment — what is achievable, and the safest route

### 7.1 What the reference really is

The reference image is a frame from a AAA open-world game with a
budget in the hundreds of millions of dollars, hundreds of artists,
and a custom engine. No browser game built from procedural primitives
will be indistinguishable from it, and this audit does not claim
otherwise. What *is* achievable is the reference's *effect* at
gameplay distance: a dense, sunlit street where paint reflects the
sky, signs glow, palms have fronds, and every surface has texture.
A player driving at 100 km/h will not be able to tell the difference
between that and the reference. A player standing still and staring
at a wall will. That is the honest bar.

### 7.2 What is achievable with the current architecture

- **High confidence:** the env map (§3.1), the texture v2 pass
  (§3.3), facade depth (§2.2), road/sign/furniture density (§2.1,
  §2.3, §2.4), the palm rebuild (§2.8), shadow follow (§3.7), sky/fog
  harmonisation (§2.11) and the UI typography (§2.13). These are all
  extensions of systems the codebase already does well (batching,
  instancing, canvas textures, seeded generation). None of them
  requires a new dependency, a new pipeline, or a gameplay change.
  Together they are ~70% of the visible gap to the reference.
- **Medium confidence:** bloom on high/ultra (§3.8) — it depends on
  the measured frame budget, and it may end up desktop-only. Vehicle
  and character detail passes (§2.4, §2.5) — the geometry is easy,
  but judging "good enough" is subjective and needs the screenshot
  comparisons to decide.
- **Low confidence / do not promise:** glTF hero models (§3.4),
  a rigged character (§3.5), SSAO by default (§3.6), a day/night
  cycle (§2.11.4). Each is a project of its own with licensing,
  pipeline or performance risks that the current architecture does
  not absorb cheaply. They are decision points after G6/G7, not
  commitments now.

### 7.3 The safest route (the audit's recommendation)

1. **G0 first.** Measure. Without a baseline, every later decision
   is an argument about taste instead of a decision about numbers.
2. **G1 second, alone.** Ship the env map + shadow follow + sky/fog
   as one phase and stop. Re-screenshot the six baseline spots. If
   the jump is as big as this audit predicts, the rest of the roadmap
   gets easier to judge — and if it is not, the project has spent one
   phase finding out, not six.
3. **G2, then G4, then G5** — textures, density, palms. These are the
   three cheapest phases with the largest visible return, and none of
   them touches collision or gameplay.
4. **G3, G6, G7** — facade depth, vehicles, characters. These touch
   collision (G3) and the most-looked-at models (G6/G7), so they go
   after the cheap wins are banked.
5. **G8, G9 last** — bloom and UI. Bloom is the riskiest per-frame
   cost and UI is the most subjective; both benefit from everything
   before them being finished (bloom needs the neon to exist; the
   menu background needs the improved city to photograph).
6. **After every phase: play the game.** The regression suites
   (qa81, qa85-mobile, Phase 1/2 verifications) prove the game still
   works; the screenshot comparisons prove it looks better. A phase
   that passes the suites but looks worse in the screenshots has
   failed its completion criteria.

### 7.4 The two decisions only Sachi can make

- **Sunset or daylight?** The game is a frozen sunset; the reference
  is bright daylight with haze. The audit recommends keeping the
  sunset (it is the game's identity, and the env map + bloom make a
  sunset glow in a way daylight cannot), with a softer, less
  saturated sky. But if she wants the reference's daylight, that is
  a re-light of the whole game and belongs before G1, not after it —
  because the env map is derived from the sky.
- **How far to go?** G1–G5 are the safe, high-return core. G6–G9
  are polish. glTF and a day/night cycle are separate projects.
  The stopping points are real: after G1, after G5, and after G9.
  Each is a shippable game.

### 7.5 What this audit did not do

- No game file was edited. No build was run. No dependency was
  added. No asset was downloaded. No push, no deploy.
- No live FPS was measured (headless reads 1 FPS — not a
  measurement). Real-device measurement is Phase G0's job.
- The reference image was not copied, traced, or used as a texture
  source. Its logos, brand names and artwork appear in this document
  only as descriptions of what the image contains.
- The previous audit's findings (A8.x environment, A9.x UI) were
  cited, not re-derived, except where this audit's live screenshots
  confirmed them independently (the single-cone palm, the flat sky,
  the bare ground, the near-black car glass).

---

## Appendix — evidence index

- **Current-state screenshots (this audit):**
  `~/workspace/qa-shots/qa/p2gfx-current-downtown.png` —
  downtown intersection, High tier. Flat orange sky, beige slab
  buildings, bare ground, cone palms, flat asphalt, orange traffic
  car, blocky protagonist.
  `~/workspace/qa-shots/qa/p2gfx-current-beach.png` — beach
  boardwalk. Giant cone palm, flat sand bands, flat blue ocean,
  pink umbrella cone, boardwalk planks. (Tier badge reads Low —
  headless auto step-down artifact.)
- **Reference image (user-supplied):**
  `~/workspace/user/media_library/image/image-35eff46d.png` —
  AAA intersection, used as a quality/density target only.
- **Prior audit:** `docs/animation-visual-audit.md` — §8
  environment (A8.1–A8.21), §9 UI (A9.1–A9.9), §10 mobile.
- **Key source files inspected:** `src/game/GameEngine.ts`
  (renderer §373, camera §390, step-down §2515),
  `src/game/Lighting.ts` (sky, sun, shadows),
  `src/game/Quality.ts` (tiers), `src/game/Buildings.ts`,
  `src/game/CityGenerator.ts`, `src/game/Roads.ts`,
  `src/game/Vegetation.ts`, `src/game/Environment.ts`,
  `src/game/World.ts`, `src/game/Vehicle.ts`,
  `src/game/VehicleCatalog.ts`, `src/game/Traffic.ts`,
  `src/game/MissionVehicle.ts`, `src/game/Character.ts`,
  `src/game/CharacterAnimation.ts`, `src/game/NPC.ts`,
  `src/game/Police.ts`, `src/game/Merge.ts`,
  `src/components/MainMenu.tsx`, `src/styles/global.css`,
  `package.json` (three 0.187, React 19, Vite 8; no addons imports).
- **QA scripts from this audit:**
  `~/workspace/qa-shots/vcs-p2gfx-capture.mjs` (the two screenshots).
- **Open questions for Sachi (not blockers for the audit):**
  1. Sunset or daylight as the target lighting direction?
  2. Stop after G1, after G5, or go the full roadmap to G9?
  3. Is a real phone available for G0 measurement, or is desktop
     the only measurement device?
  4. Any objection to a single OFL display font file in `public/`?
