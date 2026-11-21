# G1.1 — Velocity GT Bodywork Reflection Investigation (AUDIT ONLY)

**Status: investigation complete, no source files changed. Stage 1 (downtown probe, GT paint + glass) is intact and untouched by this audit.**

**Prototype implemented 2026-11-21 (see [Results](#results--crown-prototype-implemented-2026-11-21) at the end): the 3 cm crowned side-panel prototype was built in `Vehicle.ts` only, GT-gated, and verified live. The vertical reflection gradient is real and measurable (probe-on top-to-bottom spread +18 R, probe-off flat). No push, no deploy, no Stage 2.**

**Cabin-glass prototype 2026-11-21 (see [Cabin results](#results--cabin-glass-crown-prototype-2026-11-21-implemented-measured-reverted)): implemented in `Vehicle.ts` only, measured live, and REVERTED in the same session — the crown was geometrically correct (cabin 28→72 tris, 0 cap tris, 54 distinct normals) but produced zero measurable or visible change, because the glass material (#0e1418, metalness 0.9) reflects ≈0.5–1% of the environment. The geometry is not the bottleneck; a material change would be needed. Nothing of the cabin crown remains in the code; the body crown is intact.**

**Glass material investigation 2026-11-21 (see [Material results](#results--cabin-glass-material-investigation-2026-11-21-variants-screened-none-clearly-passes-original-restored)): three variants screened against the baseline by runtime override (no production code touched during screening). Best is V3 (dielectric, #2a3438, roughness 0.05) — measurable gradient [9,4,2] under the probe vs [0,0,0] baseline — but no variant is visually meaningful at gameplay distance (the cabin still looks black; no recognisable detail). V3 was implemented GT-gated only to check its garage preview (fine — dark glass with a specular highlight), then reverted; the original material is restored exactly. No variant selected. Do not re-attempt without a new decision on a lighter tint, a brighter probe/environment, or a different reflection approach.**

**Short answer: yes, a minimal curvature prototype is technically worthwhile — but only if it adds curvature to the side panels themselves. Smoothing normals or tuning the material cannot fix this, because the side panels have exactly one normal each and no interior vertices. The smallest prototype is a low-density crowned side panel (4×6 grid, ~3 cm crown) merged into the existing body geometry, GT-gated, zero new draw calls.**

## 1. Exact files and functions responsible

All GT geometry lives in one file. No other file builds the car.

| File | Function / area | Role |
|---|---|---|
| `src/game/Vehicle.ts` | `buildBodyShape(spec)` (~line 84) | The body's side silhouette (the 2D profile that gets extruded). Sleek branch for the GT (non-`boxy`): 3 quadratic curves + straight segments, in a normalised 4.42 × 0.68 space scaled by `sx = L/4.42`, `sy = H/0.68`. |
| `src/game/Vehicle.ts` | `buildCabinShape(spec)` (~line 117) | The glasshouse profile: a trapezoid with straight lines only (sloped windshield, flat roof, sloped rear). |
| `src/game/Vehicle.ts` | `buildVehicleMesh(spec, paintHex)` (~line 144) | Builds the whole car: body extrusion, cabin extrusion, wheels, and the merged detail batches. Returns `VehicleMesh` (`group`, `paintMat`, `glassMat`, `dispose`). |
| `src/game/Vehicle.ts` | `createVehicle(scene, position, heading, options)` (~line 336) | Adds the mesh to the scene and attaches the kinematic driving behaviour (steering, collision, wheel spin). Geometry is not touched here. |
| `src/game/VehicleCatalog.ts` | `VEHICLE_SPECS` — the Velocity GT entry | The GT's dimensions: length 4.42, width 1.76, bodyHeight 0.68, cabinStart 0.26, cabinEnd 0.67, cabinHeight 0.4, wheelRadius 0.36, tireWidth 0.28, rideHeight 0, spoiler `'wing'`, defaultPaint `0xd21026`, home (0, −2, π). |
| `src/game/ReflectionProbes.ts` | `assignProbeToVehicle` | Assigns the Stage 1 probe to `paintMat` + `glassMat`. Not investigated for change — it already works; the limitation is the geometry it is assigned to. |
| `src/game/Merge.ts` | `GeometryBatch`, `composeMatrix` | Merges the detail boxes into one mesh per material (used for lights, bumpers, mirrors, spoiler). Relevant to the draw-call budget (§6). |

## 2. Current geometry structure and counts

Measured live in the browser (read-only harness `~/workspace/qa-shots/vcs-g1-bodywork-measure.mjs` → `g1-bodywork-measure.json`, zero console errors). The GT group is **15 meshes, 2,824 vertices, 1,276 triangles** in total.

### The body — one extruded silhouette, not separate panels

There are **no separate door, hood, roof, fender or bumper meshes**. The entire body is a single `THREE.ExtrudeGeometry` (one mesh, one material):

```ts
new THREE.ExtrudeGeometry(buildBodyShape(spec), {
  depth: W - 0.1,            // 1.66 m
  bevelEnabled: true,
  bevelThickness: 0.05,      // 5 cm
  bevelSize: 0.05,           // 5 cm
  bevelSegments: 2,
  steps: 1,
})
```

- **Body mesh: 1,500 vertices, 500 triangles, non-indexed.** Bounding box 1.76 (W) × 0.631 (H) × 4.52 (L — the 4.42 m silhouette plus 0.05 m of bevel at each end).
- **The side panels are the two cap faces of the extrusion** (the triangulated silhouette, one per side). Measured: **80 cap triangles total, 40 per side**, with exactly **one normal each** — `(1, 0, 0)` on the right, `(−1, 0, 0)` on the left. The caps sit at x = ±0.88 m, the car's maximum width.
- **The caps have no interior vertices.** ExtrudeGeometry triangulates the silhouette with earcut: the cap is spanned by triangles between outline vertices only. There is nothing inside the panel to bend, tilt, or smooth.
- **The bevel is a 5 cm rounded edge around the cap perimeter, in 2 segments.** It is the only place the side of the car changes normal — and it is a thin band, not the panel.
- **The top surfaces are the swept outline** (hood, beltline, trunk, nose, bottom): each straight segment is one flat strip with one normal; each quadratic curve is subdivided into ~12 flat strips (three.js `curveSegments` default 12), so the hood already has a stepped normal gradient — which is why the Stage 1 front-low shot showed the hood reflecting the sky while the sides stayed flat.
- **The cabin is a second, smaller extrusion** (glass): **84 vertices, 28 triangles.** Its side faces are flat trapezoids — **4 cap triangles total, 2 per side, one normal each**. Its windshield, roof and rear window are flat strips. Bbox 1.46 × 0.446 × 1.891 m, sitting on the body top (base y 0.584, top y 1.03).

### Everything else (for completeness)

| Part | Meshes | Triangles | Notes |
|---|---|---|---|
| Body (paint) | 1 | 500 | The subject of this audit. |
| Cabin (glass) | 1 | 28 | Flat trapezoid sides; the sharpest reflector on the car (roughness 0.12). |
| Wheels: 4 tires + 4 rims | 8 | 512 | Cylinders (20 / 12 segments) — already curved, already show variation. |
| Details (merged, one mesh per material) | 5 | 224 | Headlights 24, taillight 12, trim (bumpers, grille, mirrors, handles, spoiler struts) 108, paint wing spoiler 12, exhausts 80. |
| **Total** | **15** | **1,276** | |

Paint is applied to **two meshes**: the body (500 tris) and the wing-spoiler box (12 tris) — both share the single `paintMat` (MeshPhysicalMaterial, metalness 0.55, roughness 0.3, clearcoat 1, clearcoatRoughness 0.1). The probe is assigned to the *material*, so both meshes sample it. The wing's flat top reflects the sky uniformly — correct for a wing, and not a candidate for curvature.

## 3. Root cause — why the reflections read as uniform colour

The environment reflection a surface shows is, to first order, a function of its **surface normal** (plus view direction and roughness). The probe contains the right content — the Stage 1 chrome sphere proves it (recognisable tower, sky, ground). The car cannot display it, for one measured reason:

**Each side panel has exactly one normal, over ~2.2 m² of visible area.**

Measured on the live body geometry (1,500 vertices):

- **190 distinct normals** exist in the body — so the body is not short of normal directions in general. But they are all in the bevel and the swept top surfaces.
- **Flat side caps: 240 vertices (16% of the body) with normal (±1, 0, 0), forming 80 triangles.** By area, the caps are the dominant side-view surface: from the side, the car you see is ~90% cap and ~10% bevel band. The cap samples exactly one environment direction — the dark towers across the street — and renders as one uniform dark maroon. There is no gradient, no band, no shape to recognise, because there is no normal variation for the environment map to respond to.
- **Bevel-like vertices: 924 (61.6%)** — but these are the thin 5 cm edge band and the curved profile walls. Vertex count is misleading here: the bevel is vertex-dense and area-poor. Its gradient is real (the top-normal buckets show the 2 bevel steps at ~22° and ~67°: `(0.92, 0.38, …)` and `(0.38, 0.92, …)`), but it is 5 cm wide — a shoulder highlight, not a panel reflection.
- **The cabin repeats the pattern at smaller scale:** 4 cap triangles, one normal per side, on the sharpest reflector on the car (glass, roughness 0.12). The glasshouse sides are flat mirrors pointed at the towers.
- **The hood is the control case that proves the diagnosis.** Its quadratic profile is subdivided into ~12 flat strips with different normals, and the Stage 1 front-low shot *did* show the hood responding to the sky (green +13.7, blue +9.0). Where the geometry has normal variation, the probe reads. Where it has one normal, it does not.

So the Stage 1 result is fully explained: the probe is correct, the assignment is correct, and the car's largest visible surfaces are geometrically incapable of showing variation. **This is a geometry limitation, not a material, probe, or assignment limitation.**

## 4. Comparison of the proposed approaches

| Approach | What changes | Visual effect | Triangles | Draw calls | Silhouette / dimensions | Risk |
|---|---|---|---|---|---|---|
| **A. Smooth the bevel** — `bevelSegments` 2 → 4 (body), 1 → 2 (cabin). Same 5 cm band, more steps. | Normals only; no new surfaces. | The 5 cm shoulder band becomes a smooth gradient (sky → towers) instead of a 2-step band. A brighter, cleaner edge highlight. The main panel stays uniform. | +~175 tris per added segment ring on the body (the bevel is already ~70% of the body's 500 tris). 2 → 4 ≈ +350 tris on the body (+70% of the body, +27% of the car, ~+0.2% of the scene). | 0 | None (same bevel size/thickness). | Very low. But a partial fix by construction: it cannot make the *panel* readable, only its edge. |
| **B. Crown the side panels** — replace each flat cap with a low-density crowned grid (peak ~3 cm at panel centre, zero at the outline), merged into the body geometry. | Geometry: the caps gain interior vertices + a smooth outward bulge. Normals vary continuously across the panel. | The panel shows a vertical gradient — sky at the top edge, towers mid-panel, road at the bottom — the reference-image look. The panel becomes readable. | **Net +16 to +160 tris** (a 4×6 grid replaces the 80 cap tris with 96; 6×8 with 192). Cheaper than A, because it *replaces* the caps instead of multiplying the bevel. | 0, **if merged** into the body geometry (required — as separate meshes it would be +2). | +3 cm max width at the panel centre (1.76 → 1.79 m, +1.7%) if the boundary stays at the current cap plane; see §5 for the silhouette-exact variant. Length, height, proportions otherwise unchanged. | Medium. The cap replacement must meet the bevel exactly at the outline (no seam/gap) and keep the panel inside the body. Reversible (delete the panel code, the extrusion returns). |
| **C. Subdivide the caps without displacing them** (add interior vertices, keep them flat). | Geometry: interior vertices only. | **None.** Flat is flat — more vertices with the same normal reflect identically. This is not an independent fix; it is the prerequisite step inside B. Listed only to be explicit: do not do this alone. | +~100 tris, no visual return. | 0 | None. | Low, but pointless alone. |
| **D. Material roughness only** — paint 0.3 → 0.15–0.2, and/or metalness 0.55 → 0.8. | Material parameters only. | Sharper, more mirror-like reflection of the *same single direction* — the panel becomes a crisper uniform colour, and darker (it would mirror the dark towers more faithfully). No structure appears, because there is no normal variation to reveal. The clearcoat (1.0, roughness 0.1) already supplies the sharpest reflection the material can; it is uniform on the flat panel today. | 0 | 0 | None. | Low, but the wrong lever: it cannot create recognisable reflections, and on the current flat panels it would likely make the sides look darker, not better. Worth revisiting *after* B, as a finishing touch. |
| **E. Widen the bevel** — `bevelSize` 0.05 → 0.12 (with more segments). | A wider shoulder band. | A wider gradient band (12 cm) — more visible than A, still edge-only. | Similar to A, scaled. | 0 | **Fails the constraint:** bevelSize expands the silhouette outline — the car becomes ~7 cm longer and taller at the band (4.52 → 4.66 m). Not recommended. | Medium; rejected on dimensions. |
| **F. More curve subdivisions** — `curveSegments` 12 → 24 (profile curves). | Smoother hood/roof gradient. | The hood's stepped gradient becomes smooth. The sides are unaffected (the caps are not curves). | +~72 tris. | 0 | None. | Very low, but solves a problem the car does not have — the hood already reads. Optional companion to B, not a fix on its own. |

**Reading the table:** A is the cheapest real improvement and the safest first step, but it is edge-only by geometry. B is the only approach that makes the *panels* readable, and it is cheaper in triangles than A. D is not the primary limitation and should not be tried first. E is rejected. C alone does nothing. F is optional polish for the hood.

## 5. Recommended smallest reversible prototype

**Prototype B (crowned side panels) + A (bevel smoothing) together, GT only, in that order of measurement — but build them as two separable steps so each can be judged alone.**

### Step 1 — Bevel smoothing (the nearly-free step)

- Body: `bevelSegments` 2 → 4. Cabin: `bevelSegments` 1 → 2.
- One-number change each, in `buildVehicleMesh` (`Vehicle.ts`). No dimension change, no new meshes, no silhouette change.
- Measure with the existing Stage 1 harness (side probe-off/on + chrome sphere): expect the shoulder highlight to smooth out and brighten slightly; expect the main panel to stay uniform (this step is *predicted* to be insufficient on its own — that prediction is part of the test).

### Step 2 — Crowned side panels (the actual fix)

- Replace each flat cap with a crowned grid, **gated to the GT** (`spec.id === VELOCITY_GT_ID`) so the other three vehicles are byte-identical.
- Grid: **4×6 per side** (5×7 = 35 vertices per side; 96 triangles replacing the 80 cap triangles — net +16 tris). If the gradient reads too coarse at the panel's long edges, go to 6×8 (net +112 tris); do not go denser — the paint's roughness 0.3 blurs the environment anyway, so a coarse normal field is enough.
- Crown function: offset along ±X = `crown * sin(π·u) * sin(π·v)`, where u runs along the car's length and v along its height, both 0 at the panel outline and 1 at the centre. **Crown peak 0.03 m (3 cm)** at the panel centre, zero at the outline — so the panel meets the existing bevel exactly, with no seam and no gap.
- Normals: computed smooth across the grid (shared vertices, `computeVertexNormals` on the panel geometry), so the normal varies continuously: tilted up near the top edge (sky), level mid-panel (towers), tilted down near the bottom edge (road).
- Merge: the two crowned panels are merged into the body's single BufferGeometry (same technique as the existing `GeometryBatch` merges), keeping **one body mesh, one material, zero new draw calls**. The extrusion's own cap triangles for the GT are removed as part of the same build step.
- Keep the bevel, the swept top surfaces, the cabin, the wheels and all details exactly as they are. Keep the probe, its position, and both materials exactly as they are.

### Silhouette note (stated plainly, because the constraint matters)

The caps sit at the car's maximum width (x = ±0.88 m). A 3 cm crown peaked at the panel centre makes the maximum width 1.79 m (+1.7%) at the doors' mid-height, with length, height, wheelbase and every proportion otherwise unchanged. The outline you see from any normal distance is the same; the car is 3 cm wider at one point on each door. Collision, handling and wheel placement do not read the mesh at all (§7), so nothing functional changes.

The silhouette-exact variant exists — recess the panel outline to x = ±0.85 m and crown out to the current ±0.88 m — but it requires rebuilding the bevel to meet the recessed rim, which is more invasive than the 3 cm crown for no visible benefit. Recommend the 3 cm crown, and let Sachi decide whether the +1.7% width needs the stricter variant.

### What the prototype must prove (acceptance)

Run the Stage 1 harness (`vcs-g1-stage1.mjs`) unchanged, plus the chrome sphere:

- The side car-box delta (probe off → on) must show **structure, not just a level shift**: the panel's upper band brighter (sky) and lower band darker (road/towers) — measurable as a vertical gradient in the car-box pixels, not a single mean.
- The chrome sphere still shows recognisable city content (regression check on the probe).
- The panel's centre must not read as a visible bulge in the side screenshot (the 3 cm crown at 4.42 m length is a 1:147 rise — far below what the eye reads as a shape change).
- Zero console errors; qa81 green; draw calls unchanged.

If Step 2 fails the acceptance test, revert it (delete the panel code — the extrusion returns) and keep Step 1; the investigation's finding stands either way.

## 6. Estimated geometry / performance impact

For the recommended prototype (Step 1 + Step 2, 4×6 crown grid):

| Item | Before | After | Change |
|---|---|---|---|
| Body triangles | 500 | ~846 (500 + ~350 bevel + 16 net crown) | +~346 (+69% of the body) |
| Car triangles (total) | 1,276 | ~1,622 | +~346 (+27% of the car) |
| Scene triangles | ~150,000–216,000 (G0 max) | +346 | **+~0.2% of the scene** — not measurable in frame time |
| Body vertices | 1,500 | ~1,900 | +~400 (mostly bevel rings) |
| Draw calls (car) | 15 | 15 | **0** (panels merged into the body mesh) |
| GPU memory (geometry) | ~90 KB for the car (2,824 verts) | ~+25 KB | Negligible |
| Boot time | Probe bake unchanged | Unchanged (no new textures, no new passes) | 0 |
| Per-frame cost | — | 0 new passes, ~350 more small triangles | Not measurable |

The honest framing: the body-relative percentages look large (+69%) because the body is small (500 tris). The scene-relative cost (+0.2%) is the number that matters, and it is negligible. If the bevel step alone is judged too costly in triangles, Step 2 without Step 1 costs only **+16 tris net** — the crown is the cheap part; the bevel smoothing is the expensive part. That is a genuine option: crown only, skip the bevel.

## 7. Confirmation — collision, proportions, handling unchanged

Verified by code inspection (`Vehicle.ts`, `createVehicle` / `update`):

- **Collision is analytic, not mesh-based.** The car collides as two circles — `CAR_RADIUS = 1.15` m per axle, `AXLE_OFFSET = 1.1` m — resolved against the building AABBs in `resolveCircle`. It reads only `pos` and `heading`. No mesh vertex, normal, or bounding box is ever consulted. A geometry change cannot affect collision, and the 3 cm crown is far inside the 1.15 m circle radius anyway.
- **Handling is kinematic from the spec + upgrades.** Steering, acceleration, top speed and the `WHEELBASE = 2.75` m yaw model read `tuning` (spec + garage upgrades) and input only. The mesh is purely visual; `update` writes `group.position` / `group.rotation.y` and spins the wheels. Nothing in the driving model depends on the body geometry.
- **Wheel placement is spec-driven.** Axles at `axleZ = L * 0.32`, wheels at `wheelX = W / 2 - 0.08` — computed from the spec's length/width, not from the body mesh. The crown does not move the wheels, the arches (there are no arch cutouts — the wheels sit below the body), or the suspension (there is none — kinematic model).
- **Proportions / identity.** Length 4.42 m, height, wheelbase, cabin position, spoiler, paint, and the side silhouette outline are all unchanged. The only dimensional change is the +3 cm crown peak at the doors' mid-height (§5). The garage 3D preview renders through the same `buildVehicleMesh`, so the preview and the game stay consistent automatically.
- **Other vehicles.** The prototype is gated to `VELOCITY_GT_ID`. The Shadow LX, Vortex RS and Trailhawk X share `buildVehicleMesh` but take the un-gated path, so their geometry is byte-identical. (Note: the bevel step, if applied un-gated, would touch all four — gate it too, or accept that it is a shared-architecture improvement. Recommend gating both steps to the GT for this prototype.)

## 8. Exact files that would need modification (future implementation)

| File | Change | Scope |
|---|---|---|
| `src/game/Vehicle.ts` — `buildVehicleMesh` | Step 1: `bevelSegments` 2 → 4 (body), 1 → 2 (cabin), GT-gated. Step 2: GT-gated crowned side panels replacing the extrusion's cap triangles, merged into the body geometry; smooth normals via `computeVertexNormals`. | The only production file that changes. |
| `src/game/Vehicle.ts` — `buildBodyShape` | No change expected. The silhouette outline is reused as the crown panel's boundary. | — |
| `src/game/Merge.ts` | No change expected (existing `GeometryBatch` / merge utilities are reused); only if a new merge helper is needed for the panel merge. | — |
| `src/game/VehicleCatalog.ts` | No change (dimensions unchanged; the 3 cm crown is a build-time constant in `Vehicle.ts`, not a spec field — unless Sachi wants it tunable per car, in which case a `sideCrown` spec field is the clean place). | — |
| `src/game/ReflectionProbes.ts`, `src/game/GameEngine.ts` | **No change.** Probe, position, assignment, and lifecycle stay exactly as Stage 1. | — |
| `~/workspace/qa-shots/vcs-g1-stage1.mjs` (+ a crown-acceptance check) | Reuse unchanged for the before/after; add the vertical-gradient check inside the car box (§5). Not `src/`. | QA only |

**Not changing:** probe, materials, other vehicles, collision, handling, saves, story, missions, UI, draw-call count, dependencies.

## Recommendation

**Yes — the minimal curvature prototype is technically worthwhile.** The investigation proves the limitation is geometric and specific: two flat caps, one normal each, no interior vertices, covering the car's dominant visible area. Nothing else in the chain is broken — the probe is correct, the assignment is correct, the material is capable — so geometry is the only lever left, and the crown is the smallest geometry change that addresses it.

**Change first:**

1. **The body side panels** (both sides) — the crowned grid, 4×6, 3 cm peak. They are the largest paint surface, the ones in every screenshot, and the ones the Stage 1 result was judged on.
2. **The bevel** (2 → 4 segments) — as the companion step, for a smooth shoulder highlight. Do it in the same prototype but measure it separately, so its contribution is known.
3. **The cabin glass sides second** — same crown technique on the trapezoid, in a follow-up, not the first prototype. The glass is the sharpest reflector on the car, so the payoff there is high, but the body sides are the complaint and the proof.

**Remain untouched:** the side silhouette outline, length, height, wheelbase, wheels, arches, spoiler, cabin shape, all details, the probe and its position, both materials (no roughness change in the prototype), the other three vehicles, collision, handling, saves, and the draw-call count.

**If the prototype fails its acceptance test** (§5), revert the crown, keep the bevel smoothing if it helped, and the conclusion is that the GT's reflections need the full curved-bodywork rebuild (G6) — not more probes.

---

## Results — crown prototype implemented (2026-11-21)

**Scope kept exactly as approved.** Only `src/game/Vehicle.ts` changed (no bevel smoothing, no cabin curvature, no probe/GameEngine change, no other vehicle, no push, no deploy, no Stage 2). The prototype was implemented, verified live, and stopped for review.

### The width reconciliation (read this first)

The approval stated two numbers that do not reconcile as written: a "3 cm maximum outward crown" and a "maximum width increase from 1.76 m to 1.79 m (+1.7%)". A 3 cm crown **per side** would make the car 1.82 m wide (+3.4%), exceeding the stated width. The width figure is the explicit acceptance, so it governs: **the crown peak is 0.015 m (1.5 cm) per side, 0.03 m total, giving a maximum width of exactly 1.79 m**. The audit's "3 cm crown" is the total across both sides. This is recorded as the constant `SIDE_CROWN_M = 0.015` in `Vehicle.ts`, with a comment stating the reconciliation. If a stronger effect is wanted, the 3 cm-per-side variant (1.82 m) is a new decision, not a silent change.

### What was built

- `buildVehicleMesh` now hoists the body shape to a variable and, **only when `spec.id === VELOCITY_GT_ID`**, passes the extruded body through `replaceBodyCapsWithCrown(bodyGeo, bodyShape, spec)`.
- The replacement: the 80 flat cap triangles are removed (not left underneath — leaving them would z-fight), and two crowned grids (6 columns along the length × 4 rows up the height, 48 triangles per side) are merged into the body geometry. The grids are built indexed with shared vertices, `computeVertexNormals()` gives smooth normals, and they are de-indexed for the merge (the smooth normals were averaged while the vertices were shared, so de-indexing keeps them). The crown is `0.015 · sin(πu) · sin(πv)` — zero at every boundary, peak at the panel centre — so each panel meets the existing bevel exactly on the original outline. Winding is opposite per side so both panels face outward (verified live: the panel normals average to ±X).
- The bevel, cabin, hood, roof, spoiler, wheels, details, materials, probe, and the other three vehicles are untouched. The garage 3D preview (`VehiclePreview.tsx:60`) and the live vehicle both call `buildVehicleMesh`, so they share the geometry by construction.

### Exact geometry changes (measured live)

| Item | Before (Stage 1) | After (crown) | Change |
|---|---|---|---|
| Body triangles | 500 | 516 | **+16 net** (80 caps removed, 96 panel tris added) |
| Body vertices | 1,500 | 1,548 | +48 (288 panel verts de-indexed, 240 cap verts removed) |
| Car triangles (total) | 1,276 | 1,292 | +16 |
| Car meshes | 15 | 15 | 0 |
| Max width | 1.76 m (±0.88) | **1.79 m (±0.895)** | +0.03 m total, as approved |
| Flat cap triangles remaining | 80 | **0** (correct |x|-gated test) | −80 |
| Panel normal tilt (max) | — | \|ny\| 0.063 (≈3.6°), \|nz\| 0.014 | The normals now vary across the panel |
| Bevel | 924 mixed-normal verts | 1,060 (the +136 are panel verts with \|ny\|>0.05, counted by the same bucket — the bevel geometry itself is byte-identical, only the cap tris were removed) | 0 (untouched) |

**The 92 vs 96 panel-triangle count, explained.** A live probe counts 92 panel triangles with a vertex clearly crowned (|x| > 0.881) out of 96 panel triangles. The other 4 are the panels' **corner triangles**: at the four corners of each panel the crown is zero at all three vertices (the crown function is zero on the whole boundary), so those triangles lie flat in the original cap plane. They are the panel's own edge triangles — not leftover flat caps (all 80 original caps were removed) — and they share only the outline edge with the bevel, so there is no overlapping coplanar area and no z-fighting. This is correct geometry, not a defect.

### Acceptance test — the vertical gradient (the deciding measurement)

Measured live at the Stage 1 side camera (player (2.5, −2), camYaw π/2, pitch 0.32, dist 4), sampling the visible panel at three heights (bottom / centre / top, local z = 0, max crown) with a 9×9-pixel median, player mesh hidden so nothing occludes the panel:

| Panel height | Probe OFF (sky env only) | Probe ON (downtown probe) |
|---|---|---|
| Bottom (v = 0.15) | [183, 0, 17] | [70, 0, 1] |
| Centre (v = 0.5) | [183, 0, 17] | [78, 0, 1] |
| Top (v = 0.85) | [183, 0, 17] | [88, 0, 3] |
| **Top − bottom spread** | **[0, 0, 0]** | **[+18, 0, +2]** |

**The acceptance test passes.** With the probe off, the panel is perfectly uniform at all three heights (spread zero) — a flat panel under a uniform env. With the probe on, the panel is **monotonic from bottom to top** (70 → 78 → 88 in R): the top reflects the brighter sky, the bottom the darker road/towers, a +18 R spread (≈23% brighter at the top). A flat panel under the same probe would be uniform (as Stage 1 showed); the spread exists only because the crown varies the normals. The chrome sphere still shows recognisable city content (verified in the re-run).

**Honest limit:** the effect is real but subtle. +18 R on a dark red base is a smooth lightening toward the roofline, visible in the seam close-up as a gentle vertical gradient, not a dramatic mirror. The mean car-box delta is essentially unchanged (side −25.6 R vs Stage 1's −26.3 R; rear-low −13.0 vs −12.9) — the crown redistributes the reflection within the panel rather than changing its average, which is exactly what a curvature change should do. The front-low delta changed more ([+0.1, +1.7, +3.3] vs Stage 1's [−10.9, +13.7, +9.0]), but the probe-OFF values also differ between runs there (G 18.5 → 31.7), so that angle is background/camera noise, not the crown — the side and rear-low OFF values match Stage 1 almost exactly, so those two angles are the comparable ones.

### Visual check

- **No visible bulge.** The 1.5 cm crown over a 4.42 m panel is a 1:147 rise; in normal gameplay views the door reads as flat, and the seam close-up (`qa/g1-crown-seam-closeup.png`) shows a smooth panel with no deformation.
- **No cracks or shading artifacts at the bevel boundaries.** The close-up shows the panel meeting the bevel/roof cleanly on all four edges, with smooth shading (no faceting from the 4×6 grid). The panel boundary lies exactly on the original outline by construction; the only deviation is the chord-vs-curve difference along the top edge (worst ≈8 mm on the hood curve), which is not visible at gameplay distance.
- **Garage preview** (`qa/g1-crown-garage-preview.png`): the panel opened and the GT renders correctly on the turntable with its shape, spoiler, and proportions intact. (Harness note: in headless the E key / interact flag can take longer than an 8 s wait to open the panel because the sim runs at 5–15% of real time — the panel opened on a later attempt and via a direct `tryGarageEnter()` call, and via a real E keypress. This is a slow-sim timeout, not a game defect; in real play the player walks up over many frames and E works.)
- **Before/after side shots** (`qa/g1-s1-gt-side-probeon.png` → `qa/g1-crown-gt-side-probeon.png`): identical camera and lighting; the car is the same dark maroon, with the panel now carrying the measured vertical gradient instead of a single uniform tone.

### Other vehicles, presets, garage gate — all unchanged

- Shadow LX, Vortex RS, Trailhawk X (via `garageSelect`): caps intact (80 / 80 / 14 cap triangles), max |x| exactly W/2 (0.92 / 0.95 / 0.975 — no crown), body triangle counts unchanged (500 / 500 / 104). GT back via `garageSelect('velocity-gt')`: crown present again (516 tris, max |x| 0.895).
- Presets (re-run): same probe target, no re-bake, probe re-applied after Low/Medium/High, shadows correct (Low off, Medium/High on), sky env intact.
- Garage gate: Vortex gets no probe (envMap null), GT gets it back.
- Probe: target alive, texture ≠ sky env, mapping 301, 256×256, `probeMs` 13,463 ms in SwiftShader (a software number, not a desktop number). Heap flat at 20.7 MB.

### Draw calls — honest numbers

| Vantage | Stage 1 | Crown (this run) |
|---|---|---|
| Low downtown | 109 constant | **109 constant** (identical) |
| High spawn | 152 constant | **min 152, max 224–239** (varies by run/session) |
| qa81 spawn | 152 | **152** |

The Low downtown figure is identical (109 = 109), and the High spawn **minimum** is 152 in every run including the crown build — the Stage 1 baseline appears in the crown build too. The higher readings (224, 239) are the main-pass frustum count varying between sessions (the scene has 860 individual meshes; which of them fall in the camera frustum depends on the exact settled camera and the dynamic content). The crown adds **zero meshes** (GT still 15 meshes, body still 1 mesh), so it cannot add draw calls by construction; a shadow-toggle test (shadow map disabled in-page) changed nothing (224 with and without shadows), ruling out the shadow pass as the cause. The variation is frustum/session noise, not a crown regression — but it is reported here as a range rather than a single number because the runs genuinely differ.

### Build, regression, errors

- `npx tsc --noEmit`: **clean.** `npm run build`: **passes** — index JS 1,153,136 B (1,153.14 kB; +2,086 B vs Stage 1), gzip 311,513 B (304.21 kB).
- **qa81: green** (exit 0, zero console errors). BEACON RUN completes (cash 12,500), shop/outfit/coins/sprint/garage all work, both encounters clear (+250 each), contract activates, arrest → BUSTED → respawn clears wanted. The only anomaly is the **pre-existing carbine-magazine flake** (27 vs expected 25 after 5 shots — seen in Stage 1 and 9F, unrelated to vehicle geometry).
- **Zero browser console errors** in every run (crown-measure, re-run, debug, garage, seam, qa81).

### Verdict

**The prototype passes its acceptance test.** The crown makes the Stage 1 probe visibly readable as a vertical gradient on the GT's side panels (top brighter from the sky, bottom darker from the road), with zero new draw calls, zero geometry defects, no other vehicle touched, and the full regression green. The effect at the approved 1.5 cm-per-side crown is subtle (+18 R) rather than dramatic. Two honest options for the next decision:

1. **Keep the 1.5 cm crown** — the gradient is real, the car keeps its silhouette, and the panel now responds to the city instead of reading as one flat tone.
2. **Authorise the 3 cm-per-side crown (max width 1.82 m, +3.4%)** — it would roughly double the normal tilt (≈7° vs ≈3.6°) and the gradient, at the cost of exceeding the width budget approved here. That is a new decision, not a silent change.

The cabin glass (the sharpest reflector on the car) remains the highest-payoff follow-up, as the audit recommended — it was not touched in this prototype, per the scope.

---

## Results — cabin-glass crown prototype (2026-11-21): implemented, measured, REVERTED

**Scope kept exactly as approved.** Only `src/game/Vehicle.ts` was changed (GT-gated cabin crown; the body crown, bevel, windshield/rear glass, glass material, probe, other vehicles, and all unrelated systems untouched; no bevel smoothing, no Stage 2, no push, no deploy). The prototype was implemented, measured live, and **reverted in the same session** because it produced no meaningful visual improvement — as the task itself instructed ("If the glass curvature does not produce a meaningful visual improvement, revert it"). The reverted build is byte-identical in size to the body-crown build (1,153,136 B), and the cabin geometry is verified back to its exact pre-prototype values.

### Before — inspection and baseline (flat cabin)

Live inspection confirmed the audit: the cabin is one ExtrudeGeometry, **84 verts / 28 tris**, cap plane at |x| = **0.73** ((W−0.36)/2 + bevel 0.03), **4 flat cap triangles** (2 per side, one normal each), 18 distinct normals. The windshield, rear glass, and roof are present as distinct surfaces (6 verts each in their normal buckets: windshield ny>0.3/nz>0.3, rear glass ny>0.3/nz<−0.3, roof ny≈1). The body crown is intact (516 tris, 0.895).

Baseline gradient (side view, player (2.5,−2), camYaw π/2, pitch 0.32, dist 4, player hidden; 9×9 median at y = 0.68 / 0.80 / 0.92 on the visible cabin side panel):

| Panel height | Probe OFF (sky env only) | Probe ON (downtown probe) |
|---|---|---|
| Bottom (y = 0.68) | [2, 1, 0] | [0, 0, 0] |
| Centre (y = 0.80) | [2, 1, 0] | [0, 0, 0] |
| Top (y = 0.92) | [2, 1, 0] | [0, 0, 0] |
| **Top − bottom spread** | **[0, 0, 0]** | **[0, 0, 0]** |

The glass is essentially **black** in both states. That is the finding that decides this prototype (see Root cause below).

### What was built (then reverted)

- The cabin cap is a **trapezoid** (four corners: front-bottom, front-top, rear-top, rear-bottom), so the panel was a **bilinear patch** between the bottom edge and the top edge (u along the bottom, v interpolating to the top) — not the vertical-line grid used for the body, which would have collapsed to degenerate triangles at the trapezoid's pointed front/rear corners. The four boundary edges lie exactly on the original trapezoid outline, and the crown (same 1.5 cm peak as the body, sin(πu)·sin(πv)) is zero on all of them, so the panel met the bevel with no seam.
- Grid **4 columns × 3 rows per side** (12 quads, 24 tris per side), shared vertices, `computeVertexNormals()`, opposite winding per side, GT-gated by spec id, merged into the one cabin mesh (glass material unchanged).
- The body crown code was **not touched** (the cabin helpers were separate functions; the body's `buildCrownPanel`/`replaceBodyCapsWithCrown` are byte-identical).

### Measured geometry (while the crown was in)

| Item | Before (flat) | With crown | Change |
|---|---|---|---|
| Cabin triangles | 28 | 72 | **+44 net** (4 caps removed, 48 panel tris added) |
| Cabin vertices | 84 | 216 | +132 |
| Cabin max \|x\| (vertex) | 0.73 | 0.743 | +0.013 (see note) |
| Flat cap triangles remaining | 4 | **0** | −4 |
| Distinct normals | 18 | 54 | normals now vary across the panel |
| Windshield / rear glass / roof verts | 6 / 6 / 6 | 6 / 6 / 6 | **unchanged** |
| Body triangles / max width | 516 / 0.895 | 516 / 0.895 | **unchanged** |
| Car meshes | 15 | 15 | 0 (zero new draw calls; spawn draw calls 152) |
| Other vehicles' cabins | 28 tris, caps intact | 28 tris, caps intact | unchanged (Shadow LX 0.77, Vortex RS 0.80, Trailhawk X 0.825) |

Note on max |x|: the vertex maximum is 0.743, not 0.745, because the 3-row grid has no row at v = 0.5 (rows are v = 0, 1/3, 2/3, 1), so the highest grid vertex sits at crown 0.015·sin(π/3) ≈ 0.013. The interpolated surface peaks at ≈0.745 near the panel centre. Either way the cabin (1.46–1.49 m) is narrower than the body, so the car's 1.79 m maximum width is unaffected.

### Acceptance test — the gradient (the deciding measurement)

Measured with the same harness, same camera, same sample points, before and after the crown:

| | Probe OFF spread | Probe ON spread |
|---|---|---|
| Before (flat cabin) | [0, 0, 0] | [0, 0, 0] |
| **After (crowned cabin)** | **[0, 0, 0]** | **[0, 0, 0]** |

**No change at all.** The pixel values are identical before and after the crown at every height in both states (probe off [2,1,0] everywhere, probe on [0,0,0] everywhere). The before/after screenshots are visually identical — the cabin is a solid black trapezoid in both, with no bulge, no crack, and no visible gradient. The crown is geometrically correct (normals vary, 54 distinct normals, caps removed, panel present) but it has **zero visible effect**.

### Root cause — the glass material, not the geometry

The cabin glass material is `MeshStandardMaterial` colour **#0e1418**, metalness **0.9**, roughness 0.12. For a metal, the reflectance at normal incidence (F0) is essentially the base colour: #0e1418 in linear space is ≈ (0.004, 0.006, 0.008), so the glass reflects roughly **0.5–1% of the environment** — the reflected probe is scaled to ≈0–2 out of 255, i.e. black. The crown changes *which* env direction is reflected, but every direction is scaled to ≈0, so the result is still black. The probe assignment is confirmed working (glassMat.envMap is the probe target; toggling it changes the value by 2, from [2,1,0] to [0,0,0]) — the probe is fine, the geometry is fine, the material is the limiter. **No amount of curvature can make this glass show a reflection.** The body's paint works because its base colour is bright red (#d21026) with metalness 0.55, so its F0 is large enough to carry the env.

### Revert

Per the task's instruction, the cabin crown was **reverted in the same session**. The cabin helpers (`buildCabinCrownPanel`, `replaceCabinCapsWithCrown`, `CABIN_CROWN_COLS/ROWS`) and the GT-gated cabin call were removed; the cabin construction is back to the plain extrusion. Verification of the revert: cabin **84 verts / 28 tris / max |x| 0.73 / 4 cap tris / 18 distinct normals** (exact pre-prototype values), body **516 tris / 0.895** intact, probe intact, zero console errors. `npx tsc --noEmit` clean; `npm run build` passes (index 1,153,136 B — the body-crown build's size exactly). **qa81 green** (exit 0, zero console errors; BEACON RUN completes, cash 12,500; arrest → BUSTED → respawn; only the pre-existing carbine-mag flake, 27 vs 25). One harness note: in the revert run the probe-OFF samples were taken before the headless camera had settled (screen positions (666, 416–425) instead of (622, 595–621), spread [8,4,3]) — those three samples missed the glass and landed on the sky/buildings; the two consistent runs (before and after) both gave probe-OFF [2,1,0] at all heights, and the probe-ON measurement is identical ([0,0,0]) across all three runs.

### Verdict

**The cabin-glass crown does not work — not because the geometry is wrong, but because the glass material cannot show a reflection.** The prototype was implemented correctly and reverted correctly; nothing of it remains in the code. The body crown (approved, 1.5 cm/side) is the only crown in the build, and it stays. The honest next step, if the cabin glass is to show the city at all, is a **material** change (a lighter glass base colour, so F0 carries the env) — that is a separate decision, out of this prototype's scope, which explicitly kept the glass material unchanged. Do not re-attempt the cabin crown without first changing the glass material; the geometry is not the bottleneck.

---

## Results — cabin-glass MATERIAL investigation (2026-11-21): variants screened, none clearly passes, original restored

**Scope kept exactly as approved.** No cabin geometry changes (the crown was correctly reverted and stays reverted). The body crown (1.5 cm/side) is preserved. No other vehicles, no lighting/exposure/tone-mapping changes, no probe changes, no Stage 2, no push, no deploy. The variants were screened by overriding the GT's `glassMat` at runtime in the harness (a fresh per-vehicle material instance, so the other three vehicles were untouched and a reload restores the original); **no production code was changed during screening**. The best candidate (V3) was then implemented GT-gated in `Vehicle.ts` only to check its garage preview, and **reverted in the same session** because it does not clearly pass. The final code is byte-identical to the body-crown build (1,153,136 B, same bundle hash).

### Original material (confirmed from code, not assumed)

`src/game/Vehicle.ts:369-371` — `MeshStandardMaterial({ color: 0x0e1418, metalness: 0.9, roughness: 0.12 })`. The cabin mesh uses this `glassMat`; the `VehicleHandle` exposes it. Probe assignment (`ReflectionProbes.ts:85-93`, `assignProbeToVehicle`) sets `envMap` on both `paintMat` and `glassMat`; null clears it (falls back to `scene.environment`). Confirmed live at boot: colour #0e1418, metalness 0.9, roughness 0.12, envMap is the probe.

### Variants tested

| Variant | Colour | Metalness | Roughness | Idea |
|---|---|---|---|---|
| **V0 baseline** | #0e1418 | 0.9 | 0.12 | Current material |
| **V1 lighter metal tint** | #2a3438 | 0.9 | 0.12 | Lighten the metal's F0, same metalness/roughness |
| **V2 dielectric glass** | #0e1418 | 0.0 | 0.12 | Glass is a dielectric, not a metal — F0 rises from ≈0.01 to 0.04 (≈4× reflectivity) while the near-black diffuse keeps it dark |
| **V3 dielectric + lighter + sharper** | #2a3438 | 0.0 | 0.05 | Combines the dielectric F0 with a lighter tint and a sharper reflection |

All four are dark tinted charcoal (none is grey or white). The material class was not changed (MeshStandardMaterial throughout, as the task specified colour/metalness/roughness only).

### Pixel measurements (same camera, lighting, position, probe for every variant)

Side view (player (2.5,−2), camYaw π/2, pitch 0.32, dist 4, player hidden); 9×9 median at y = 0.68 (bottom) / 0.80 (centre) / 0.92 (top) on the visible cabin side panel. Spread = top − bottom (R, G, B).

| Variant | Probe OFF (sky env only) — bottom / centre / top | Probe ON (downtown probe) — bottom / centre / top | Probe-ON spread |
|---|---|---|---|
| **V0 baseline** | [2,1,0] / [2,1,0] / [2,1,0] | [0,0,0] / [0,0,0] / [0,0,0] | **[0,0,0]** |
| **V1 lighter metal** | [14,8,3] / [14,8,3] / [14,8,3] | [0,0,0] / [0,0,0] / [2,1,0] | [2,1,0] |
| **V2 dielectric** | [25,11,4] / [25,11,4] / [25,11,4] | [1,0,0] / [2,1,0] / [4,2,1] | [3,2,1] |
| **V3 dielectric + lighter + sharper** | [36,21,11] / [36,21,11] / [36,21,11] | [6,4,3] / [7,4,3] / [15,8,5] | **[9,4,2]** |

Two things the table shows plainly. First, **the probe makes the glass darker than the sky env does** in every variant (e.g. V3: OFF [36,21,11] vs ON [6–15]) — because the probe's downtown content at the glass's horizontal reflection direction is dark towers, while the sky env is a bright sunset gradient. So the probe does not brighten the glass; it darkens it and adds a vertical gradient. Second, **the gradient grows with the dielectric + lighter + sharper direction** (V0 0 → V1 2 → V2 3 → V3 9 in R), and V3's gradient is correctly directed (top brighter from the sky, bottom darker from the towers/road). But the absolute values under the probe are still very dark (V3: 6 → 15 out of 255).

Harness note: V0's probe-ON measurement in this run was taken before the headless camera had settled (screen positions (666, 416–425) instead of (622, 595–621), spread [11,4,3]) — those samples missed the glass and landed on the sky/buildings. V0's true probe-ON values ([0,0,0] at all heights, spread [0,0,0]) are taken from the three consistent runs before this one (cabin before/after/revert), which all used the same settled camera. V1–V3's measurements in this run are all at the settled positions (622, 595–621) and are reliable.

### Visual judgement (the deciding evidence)

All four side-view screenshots show the cabin as a **black trapezoid at gameplay distance** — V0, V1, V2, and V3 are visually indistinguishable in the gameplay view. V3's measured gradient (6 → 15) is a dark-on-dark subtlety, not recognisable environmental detail: no building, sky band, or horizon is distinguishable in the glass, and the cabin does not read as reflective. It does still read as dark tinted glass (V3's sky-env value [36,21,11] is a dark warm charcoal, not grey plastic), and there are no seams or shading defects in any variant. But **no variant produces a visually meaningful reflection at normal gameplay distance**, so none clearly passes the acceptance criteria.

The garage preview (V3, implemented GT-gated in code to check it): the panel opened and the GT renders correctly on the turntable — the cabin is dark with a bright specular highlight from the preview's studio lighting, reading as glass rather than grey plastic, with no defects. The garage view is fine; it does not rescue the gameplay result, because the acceptance criteria require the reflection to be visible at normal gameplay distance.

### Why the magnitude is capped (the honest limit)

The reflectivity (F0) of a dielectric is 0.04 — that is the physical ceiling for glass, and it is what V2/V3 use. The downtown probe's content is dark (towers), so 4% of a dark env is still dark. Raising F0 further would require metalness with a light base colour (a grey/white metal mirror), which would violate the "still dark tinted glass" criterion. Lowering roughness further would sharpen the reflection but not brighten it. **Within the constraint "still dark tinted glass", no material variation can make the dark downtown probe visibly reflective on this glass.** The probe and the tint are both dark; their product is dark. A visibly reflective cabin would need either a lighter glass tint (breaking the dark-glass look) or a brighter probe/environment (a different problem).

### Rollback — original restored

V3 is the best variant and the material direction is right (dielectric, lighter, sharper), but it does **not clearly pass** the acceptance criteria (no reflection detail visible at gameplay distance), so per the task's rollback rules it was **not selected permanently**. The temporary GT-gated V3 code was reverted in the same session; the glass material is back to the original exactly (`#0e1418, metalness 0.9, roughness 0.12`). Verification of the revert: `npx tsc --noEmit` clean; `npm run build` passes (index 1,153,136 B, same bundle hash as the body-crown build); **qa81 green** (exit 0, zero console errors; BEACON RUN completes, cash 12,500; arrest → BUSTED → respawn; only the pre-existing carbine-mag flake, 30 vs 25 this run — the flake varies 26–30 across runs). Zero console errors in every run (screening, garage, qa81). Draw calls unchanged by construction (no meshes added; the screening harness read 100 at the side-view vantage, which is a frustum count, not the spawn figure — do not compare it to the 152 spawn baseline). The other three vehicles were verified unchanged (their glass is #0e1418 / 0.9 / 0.12 in the gating check, and the runtime override never touched their material instances).

### Verdict

**No glass material variant clearly passes.** V3 (dielectric + lighter charcoal #2a3438 + roughness 0.05) is reported as a **candidate for review** — it is the best of the four, its gradient is real and correctly directed, and it still reads as dark tinted glass — but it does not produce a visually meaningful reflection at gameplay distance, so it is **not** selected. The original material is restored. If the cabin glass is ever to show the city recognisably, the change would have to be outside this investigation's constraints: a lighter glass tint (accepting a less-dark look), a brighter probe/environment, or a different reflection approach. Do not re-attempt the cabin crown or another material sweep without a new decision on one of those.
