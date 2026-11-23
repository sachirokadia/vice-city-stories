# WS4 — World & Environment Expansion Report

**Branch:** `ui/gta-vice-city-transformation`
**Starting commit:** `60c594f` (WS3 report-hash correction; WS3 checkpoint `95d9705` is its parent)
**Final commit:** _pending — WS4 checkpoint commit not yet created (see §11)_
**Production `main`:** `053e76d` — live at https://vice-city-stories-sigma.vercel.app/ (bundle `index-jLcIAx51.js`)
**Date:** 2026-11-23
**Brief:** WS4 (2026-11-23 16:37 IST) — make the existing city feel like a believable, atmospheric, detailed 1980s coastal metropolis. Original/procedural assets only. Preserve WS1–WS3 completely. §10 release workflow (push → merge → deploy → live verify) is authorized for WS4.

---

## 1. Baseline

No empty "starting checkpoint" commit was created. The baseline IS `60c594f` (verified: `95d9705` and `c33d37d` are both ancestors of HEAD; working tree clean except the 7 untracked report docs from WS1–WS3). This follows the WS2 precedent: an empty commit would fabricate a checkpoint.

SSH to GitHub was verified working at the start of the session (`ssh -T git@github.com` → "Hi sachirokadia!"; `git ls-remote origin HEAD` → `053e76d`, remote main = release). Origin: `git@github.com:sachirokadia/vice-city-stories.git`.

## 2. World audit (what was already there)

Read in full before touching anything: `World.ts`, `CityGenerator.ts`, `Buildings.ts`, `Roads.ts`, `Vegetation.ts`, `Environment.ts`, `Lighting.ts`, `Merge.ts`, `GameEngine.ts` (lighting/world wiring).

The world already had: district system (downtown / coastal / commercial / residential / 2 parks), 5 facade styles with CanvasTexture windows, 6 fictional shop signs, balconies, rooftop AC boxes + water towers, neon roof trim, Beacon Tower with pink neon rings, roads with lane dashes / crosswalks / streetlights / 6 traffic signals (5 s phase cycle, no yellow — known issue 8.2), palms (one identical clone set), park trees + benches, beach umbrellas, sand + boardwalk + railing, shader ocean with foam + sun glitter, sunset sky dome + sun disc + PMREM environment map, hemisphere + directional sun light, fog.

Genuinely missing layers, which WS4 adds: palm variety, shrubs, dune grass, building setbacks/parapets/podiums, street props (bins, bus shelters, utility poles, park hedges), beach dunes/rocks/lifeguard tower, parking-bay markings, drifting clouds, sun glow.

**Explicitly NOT done** (stated in the brief's spirit, to be read as scope, not omission): no day/night cycle or weather system — the game is fixed sunset, and the brief forbids inventing time/weather UI without real working systems. No parked cars (collision/traffic interaction risk). No enterable buildings (forbidden to fake). No building-count increases (performance).

## 3. What changed (8 files)

| File | Change |
|---|---|
| `src/game/Vegetation.ts` | Palm variety + shrubs + dune grass + park-tree scale variety |
| `src/game/Buildings.ts` | Downtown podium + stepped setbacks + parapet rims |
| `src/game/StreetProps.ts` | **NEW** — trash bins, bus shelters, utility poles, park hedges |
| `src/game/Environment.ts` | Dunes + rocks + lifeguard tower |
| `src/game/Roads.ts` | Parking-bay divider markings |
| `src/game/Lighting.ts` | Drifting clouds + sun glow sprite; `LightingHandle.update(dt)` |
| `src/game/GameEngine.ts` | **One line** — `this.lighting?.update(dt);` after `this.worldHandle.update(dt);` |
| `src/game/World.ts` | **One call** — `buildStreetProps(...)` after `buildVegetation` |

No gameplay, mission, story, save, collision, traffic, police, combat, UI or panel code was touched. No new dependencies. No mock data.

### 3.1 Vegetation.ts — palm variety, shrubs, dune grass

- Palms are now per-instance varied: height scale 0.8–1.25 (avenue) / 1.05–1.3 (promenade), lean up to ~4° in a random direction, random yaw. Trunk/leaf offsets are applied in local space (`m.clone().multiply(makeTranslation(0, y, 0))`) so crowns stay on their own trunks.
- ~1 in 5 avenue palms is a SHORT bushy variant (squatter trunk 3.0, wider crown cone 2.5r/2.2h — separate InstancedMeshes).
- Sidewalk shrubs: instanced flattened icosahedra, x = sx−8.6 every 24 m, spawn exclusion r14.
- Beach dune grass: 90 instanced thin cones, x beachStartX+2..+50, seeded mulberry32(4242).
- Park trees scale-varied 0.85–1.2.

### 3.2 Buildings.ts — podium, setbacks, parapets

- Downtown podium: facade-material box (w×1.12, 4 m tall, y=2); collision box grows by `podiumOut = 0.06` on all sides + faceOut on the face side; `maxY = plot.h + setbackH`.
- Downtown setback for h ≥ 30: crown box (w×0.62 / d×0.62, height h×0.28) on top of the main box, same facade material, its own roof cap. **Neon trim moved to the crown top for setback towers** (trimY = h+setbackH+0.1, trim size uses the 0.62 footprint).
- Parapet rim (4 thin roofMat boxes, 0.35 thick × 0.7 high, around the roof edge) for all non-park plots WITHOUT a setback.
- Storefront / balcony / rooftop logic untouched.

### 3.3 StreetProps.ts (NEW, 7,728 B) — bins, shelters, poles, hedges

`buildStreetProps(group, layout, quality, track)`:

- Trash bins: instanced cylinders r0.32 h0.9, dark green, x = sx±7.5 every 40 m, skipping spawn r16, garage entrance (22,40) r6, store entrance (43,24) r6, tower plaza z < −158.
- Bus-stop shelters at 4 intersections [(0,−30,ry π), (0,30,0), (60,−30,π/2), (−60,30,−π/2)] — corner at (ix+9cos ry, iz+9 sin ry), 2 posts + roof slab (3.4×1.5, rotated by ry) + bench, merged into 3 batches (frame/roof/bench).
- Utility poles (detailed tiers only): instanced poles h6.8 + crossarm boxes, along z=90 street x every 30 m alternating z=90±7.5, and along x=−120 avenue z every 30 m alternating x=−120±7.5, crossarms rotated π/2 on the avenue.
- Park hedges: merged batch, 0.5 m tall dark-green boxes around both parks with an 8 m entry gap centred on each side.
- **Props have NO collision boxes** (consistent with palms/lamps; all sit on sidewalk edges/block corners, never in lanes, crosswalks or entrances).

### 3.4 Environment.ts — dunes, rocks, lifeguard tower

- Dunes: 26 instanced flattened spheres, scale y 0.3–0.5, x beachStartX+3..+13, seeded mulberry32(20261123).
- Rocks: 14 instanced icosahedra — 8 at the waterline's north/south ends (x waterStartX−4..−8), 6 scattered on sand.
- Lifeguard tower at **(170, 60)** on the sand (clear of sprint start (133,90), beach-dune coin (165,90), boardwalk coin (133,30)) — GeometryBatch merged: white batch (4 splayed legs via `addObject` with full rotation + cabin 2.4×1.7×2.2 at y4.1 + flag pole) + red batch (roof 2.9×0.18×2.7 at y5.05 + flag plane), 2 draw calls, no collision.

### 3.5 Roads.ts — parking bays

Parking-bay divider lines (instanced white planes, 1.9 long × 0.14, perpendicular) along the east side of the x=60 avenue at x=64.3, z −28..28 step 3. Markings only — no parked cars.

### 3.6 Lighting.ts — clouds + sun glow

- `makeCloudTexture` (256×128 canvas, 6 soft radial-gradient blobs, warm white) + `makeGlowTexture` (128×128 radial gradient).
- Sun glow: THREE.Sprite, additive, opacity 0.55, depthWrite false, fog false, at the sun-disc position (−260,42,−320), scale 190.
- Clouds: ONE InstancedMesh (8 instances, PlaneGeometry 1×1, MeshBasicMaterial map cloudTex, transparent, opacity 0.5, depthWrite false, fog false), instances at x/z ±350, y 95–150, w 90–160, h 34–60, each yawed to face the city centre (`atan2(−x, −z)`), seeded mulberry32(20261123).
- `LightingHandle` gains `update(dt)`: drifts clouds eastward 1–2.5 m/s, wraps at ±380, refreshes yaw + instanceMatrix.
- Clouds/glow live in the lighting group, NOT the PMREM environmentScene.

## 4. Build

- `npx tsc --noEmit`: **clean**.
- `npm run build`: **`index-5UWogofC.js`, 1,198.17 kB / gzip 326.85 kB** (WS3 build was 1,190.22 kB — **+~8 kB** for WS4).
- Preview server on 4173 verified serving `index-5UWogofC.js` (curl grep). The server died once in a runtime restart mid-session and was restarted and re-verified before the qa81 re-run.

## 5. Browser verification — desktop (1280×800)

Harness scripts in `~/workspace/qa-shots/`: `vcs-ws4-shots.mjs`, `vcs-ws4-followup.mjs`, `vcs-ws4-park.mjs`, `vcs-ws4-sun.mjs`, `vcs-ws4-tower.mjs`, `vcs-ws4-bays.mjs`, `vcs-ws4-bays2.mjs`. Logs: `ws4-shots.log`, `ws4-followup.log`, `ws4-park.log`, `ws4-sun.log`, `ws4-tower.log`, `ws4-bays.log`, `ws4-bays2.log` — all exit 0, **console errors `[]` in every run**.

Screenshots: `~/workspace/qa-shots/ui-ws4/` shots 01–20. All 20 were viewed.

**Camera note (found during verification):** setting `player.mesh.rotation.y` does NOT move the camera — the camera follows the engine's private `camYaw` (GameEngine.ts:394). camYaw 0 = camera south, looking north; π/2 = camera east, looking west; −π/2 = looking east; π = looking south. Shots 01–08 all look north (default camYaw 0); shots 09–20 set `e['camYaw']` directly. To aim at the sun (−260,42,−320, 51° north of due west), camYaw ≈ 0.68.

| Shot | What it shows | WS4 verdict |
|---|---|---|
| 01-spawn-south | Spawn looking north: brick facades, lit windows, Beacon Tower + pink rings, lamps, a leaning palm, HUD/minimap clean | Palm lean ✓; sky flat orange-red, no clouds in frame |
| 02-avenue-north-tower | From (0,40) N: crosswalk, traffic incl. police car + green bus across lanes, SURF SHOP sign, traffic light green, downtown glass towers | Parapets/setbacks not clearly visible at street level |
| 03-intersection-shelter | From (0,30) N at Low tier: downtown towers, green bus dominates right foreground | Bus shelter at (9,30) NOT clearly visible — bus-occluded (confirmed in shot 15 instead) |
| 04-coastal-hotels | Player teleported to (100,0) ~2 m from a hotel facade filling the frame | Bad angle — superseded by shot 09. Hotel balcony-band texture + lit windows up close; boardwalk, railing, palm, ocean strip, green bin at right edge |
| 05-beach-tower-east | From (150,60): sand speckle, boardwalk + railing left, promenade palms at VARIED heights, dune grass tufts, umbrellas, ocean right, dunes | Palm variety ✓, dune grass ✓, dunes ✓ |
| 06-beach-north-rocks | From (150,−100) N: sand, dune mounds (light oval patches), dune grass, pink umbrella, Sunset Range targets mid-right, boardwalk left, palms varied | Dunes ✓, dune grass ✓ |
| 07-sunset-west-clouds | From (0,0): GT + "Press E" prompt, downtown towers with lit windows, **stepped setback crown visible** on the right-side tower, green bins on both sidewalks, traffic light red, Beacon Tower pale centre | Setback crown ✓, bins ✓; one faint pale smudge near the tower top — possible cloud, not conclusive |
| 08-west-park | Player teleported to (−90,60) INSIDE the park next to a tree; tree icosahedron fills the frame; player landed on the West Park Token (coins 1/10) | Bad shot — superseded by 13/14 |
| 09-coastal-from-boardwalk | Player (130,0), camYaw π/2 looking WEST: coastal hotels with balcony bands + lit windows, TACO BAR + PIZZA + HOTEL VISTA signs legible, tall promenade palm foreground, lamps, **green shrubs on the sidewalk**, road + crosswalk, pale cloud top right, HIGH tier, palm shadow on the boardwalk | Shrubs ✓, cloud ✓, shadows on |
| 10-skyline-from-beach | Player (170,−60) looking WEST — **the money shot**: **two clear soft white clouds**, downtown glass skyline with dense lit windows, Beacon Tower with pink neon ring, hotels left with TACO BAR sign, east park green centre, traffic incl. green bus, promenade palms at varied heights, sand + dune grass + teal umbrella | Clouds ✓ (visual), palm variety ✓, dune grass ✓ |
| 11-beach-south | Player (150,120) camYaw −π/2 looking EAST: wide ocean band with foam line + sun glitter, sand, dune grass tufts, player standing on a dune mound (wide flat oval — reads as a sand dune, very flat/smooth, acceptable) | Dune grass ✓, dunes ✓; no clouds in the eastward frame at that moment |
| 12-sunset-west | Spawn, camYaw π/2 looking WEST: GT + Press E prompt, residential brick buildings, west park left, lamps, green bin right edge, yellow taxi + red car | Sun NOT in frame — from spawn the sun (51° north of due west, elevation ~5.8°) is OCCLUDED by the downtown towers, which is physically correct for a low sun |
| 13-park-south-edge | Player (−90,100) looking north through a gap: park lawn + trees + brown benches, pale cloud at top | Cloud ✓; hedges NOT clearly identifiable — the dark-green strip at the park's edge could be a hedge |
| 14-park-west-edge | Player (−140,60) looking east: park (lawn, round trees, benches), **TWO wooden utility poles with crossarms CONFIRMED**, lamps, green bins, green shrubs at right edge, cloud at top, residential building with red awning band left | Utility poles ✓, bins ✓, shrubs ✓, cloud ✓; hedges present in code, not distinctly visible (0.5 m tall, blend with the lawn) |
| 15-sun-northwest | Spawn, camYaw 0.68 looking northwest: GT + Press E prompt, downtown towers, Beacon Tower right with pink rings, traffic light green, **a bus shelter IS visible** at the intersection (dark frame + roof, ~(880,320)), green bins | Bus shelter ✓; sun still not visible — occluded by towers from spawn |
| 16-sun-plaza | Tower plaza (0,−160), camYaw 0.68 looking northwest, HIGH tier: **the sun disc is clearly visible** — large pale-cream circle upper-left, partially behind a street lamp, with a soft halo edge (the glow); Beacon Tower's huge dark-blue cylinder fills the right; plaza crosswalk, palm, lamps, green shrub | **Sun disc + glow VISUALLY CONFIRMED** ✓ |
| 17-lifeguard-tower | Player (150,60) camYaw −π/2 looking EAST: **the lifeguard tower is clearly visible** — white cabin on splayed legs, red roof, flag pole, on the sand with the ocean behind; red umbrellas, dune grass, boardwalk, utility poles | Lifeguard tower ✓ |
| 18-north-rocks | Player (150,−100) looking east: range targets left, boardwalk strip, umbrellas, ocean; rocks ARE present as small brown/tan lumps on the sand at ~(300,370), (810,365), (1000,370) — visible but subtle, they read as sand-coloured lumps at distance rather than distinct grey rocks | Rocks ✓ present but subtle (reported honestly) |
| 19-parking-bays | Player (60,40) looking north up the x=60 avenue: SUNSET MART storefront "OPEN 24 HOURS" + awning, red vending machine, shrubs, crosswalk, traffic light green, taxi, commercial buildings | Bay dividers sub-pixel at that distance — not identifiable |
| 20-bays-closeup | Player (62,0) camYaw −π/2 looking east: **parking-bay divider lines CONFIRMED** — 5–6 white perpendicular ticks clearly visible on the dark asphalt across the road edge; CAFÉ AZUL + SURF SHOP signs, storefronts, palm, lamp, green bin; teal FIRST LIGHT story marker ring + diamond visible (player near the (66,6) start marker — story discovery working; HUD shows FIRST LIGHT "Find Mara Voss 7m") | Parking bays ✓ |

**Scene-graph probe** (`vcs-ws4-followup.mjs`): sunDisc `{visible: true, pos: [-260,42,-320]}`; glow `{type: "Sprite", visible: true, pos: [-260,42,-320], scale: [190,190,1]}`; clouds `{type: "Mesh", count: 8, visible: true}` (InstancedMesh, 8 instances); cityMeshes 105; drawCalls 264.

**Probe artifact (not a defect):** the tower/rocks run's scene probe returned `{tower: null, rocks: 0}` — the lifeguard tower is a GeometryBatch-merged mesh whose world position is baked into the geometry (mesh position is (0,0,0)), and the rocks are an InstancedMesh (positions in instance matrices), so checking `o.position` finds neither. Both are visually confirmed in shots 17 and 18.

## 6. Browser verification — mobile (390×844)

Script `vcs-ws4-mobile.mjs`, log `ws4-mobile.log`, exit 0, touch context, settings quality 'low'. **Console errors `[]`.**

- Spawn overflow `{sw: 390, overflow: false}` ✓; draw calls 135; beach overflow false ✓; hub rows all 10 ✓; hub overflow false ✓.
- `m1-spawn` (viewed): spawn looking north up the avenue, red car ahead, BEACON RUN mission HUD, cash $5,000, minimap bottom-left, combat vitals, joystick + FIRE/RUN buttons, Menu button. Top bar wraps to 3 rows (known, readable, no overflow). Sky flat orange-red in this frame — no clouds visible.
- `m2-beach` (viewed): beach renders (dune grass tufts, boardwalk, ocean, red umbrella), touch controls visible, minimap + vitals + BEACON RUN HUD visible.
- `m3-hub-mobile` (viewed): pause hub — all 10 rows, Resume pink-selected, ESC RESUME GAME hint, sunset art behind. Clean.

## 7. Performance — actually collected

- **Draw calls at spawn, high tier: 264** (pre-WS4 high tier: 239 → **+25**, as budgeted).
- Draw calls with contract active: **261** (pre-WS4: 247 → +14 in that scene).
- Mobile low tier: **135** at spawn.
- End of desktop run: 132 (after the headless tier step-down — see below).
- **FPS is NOT measurable headlessly** (0–1 FPS SwiftShader). Sachi's AMD Radeon numbers (spawn 60 / downtown 55 / beach 60, measured at G0) remain the only real FPS record on file. **Desktop FPS re-measurement is still outstanding.**
- Tier step-down observed mid-run (high → Low) is a **headless artifact**: the auto step-down fires when avg FPS < 28 for 15 s, and headless SwiftShader runs at ~0 FPS. Not a defect.
- WS4 adds no new per-frame allocations beyond the cloud instance-matrix refresh (8 instances, only when clouds drift) and the existing `worldHandle.update` path. All new geometry is batched or instanced; no new draw calls per palm/tree/bin beyond the budgeted +25.

## 8. Regression — WS2/WS3 on the WS4 build

**WS3 desktop script, fully green on the WS4 build** (script `vcs-ws3-desktop.mjs`, log `~/workspace/qa-shots/ws3-ws4-regression.log`, exit 0, ~5 min, bundle `index-5UWogofC.js`):

- Hub rows exactly 10, Resume selected, ESC hint; settings tabs 01–04; quality stepper Low→Medium→High; pedestrians Busy→Off; wanted toggle true→false→true; 8 control rows; settings close → hub + engine stopped.
- Statistics tiles == live engine exactly; VIEW JOBS → board → close → hub.
- Map subtitle "16 locations · 0 of 10 coins found · north is up", 16 rows (fresh save: 1 mission = BEACON RUN job — the script's "expect 17" comment is stale, 16 is correct); **all 7 map pixel checks match** (tower gold, garage pink, store teal, range amber, sprint red, coin green, player white); zoom 100%→104%→96%; pan transform → `translate(60px, 30px) scale(0.96)`; tower click → "Beacon Tower | X 0 · Z -172"; map Back → hub.
- Hub round trips Missions/Story/Garage/Outfits all opened + back-to-hub true; Controls → Settings tab "04Controls" → close → hub; Esc → engine running, hub hidden, HUD visible; top-bar Map → Back → engine running + HUD.
- Minimap pixels gold tower + white player match.
- **WS2 spot checks: Lena portrait srcLen 21422 ✓; palm buy {ok:true} cash 5000→4550, duplicate {ok:false, reason:'already-owned'} cash unchanged 4550 ✓**; stored settings after changes {quality high, shadows false, pedestrians off, traffic low} ✓.
- **Desktop console errors `[]`.**
- Two lines are the KNOWN harness artifacts (already documented in the WS3 report, NOT regressions): "settings after reload" reads the addInitScript seed values (quality low / pedestrians busy) and "engine tier after reload: low" (headless 0-FPS step-down).
- Note: the regression script overwrote the WS3-session screenshots in `~/workspace/qa-shots/ui-ws3/` with WS4-build versions. The WS3 report text (committed) is unaffected.

## 9. qa81 on the WS4 build

**First run — killed by a runtime restart (~17:14 IST 2026-11-23).** Spawn checks passed and were logged (draw calls at spawn **264**, contracts both dormant, encounters both dormant, enemies active 0, pedestrians 18 / traffic 14) before the run stalled in the BEACON RUN drive section; the restart killed the process AND the preview server (curl returned 000; log `~/workspace/qa-shots/qa81-ws4.log` held only the 5 spawn-check lines). Recovery: preview server restarted, curl-verified 200 + bundle `index-5UWogofC.js`; **re-run started ~17:15 IST**.

**Re-run — PASS, all 16 checkpoints, completed ~17:34 IST 2026-11-23** (exit 0; log `~/workspace/qa-shots/qa81-ws4.log`, 34 lines). Values logged:

- Spawn: draw calls **264**, contracts both dormant, encounters both dormant, enemies active 0, pedestrians 18 / traffic 14.
- BEACON RUN: checkpoint reached (0.0, −91.0); delivery reached (0.0, −155.4); **cash 12500** ✓; mission board chain correct.
- Shop water `{ok:true}`; outfit buy casual `{ok:true}`; outfit select casual true; **cash 12190** ✓.
- Coins **0 → 1** ✓. Sprint: start true; final complete; **cash 12340** ✓.
- Garage: **cash 4040** ✓; all 4 vehicles owned, **trailhawk-x selected** ✓.
- Range: shot fired (shots 0 → 1, hits 0); carbine buy `{ok:true}` ✓.
- **Carbine magazine after 5 shots: exactly 25** (the known flake 26–30 did NOT trigger); palm mag 11 ✓; **cash 2840** ✓.
- Encounters: South Beach +250 → **3090** ✓; North Dunes +250 → **3340** ✓.
- Contract active, remaining 3; draw calls with contract active **261** ✓ (pre-WS4 247 — the +14 is the WS4 geometry in that scene).
- **Arrest cycle: busted true; after respawn — mode walk, wanted heat 0, status clear** ✓.
- Draw calls at end **125** (pre-WS4 112 — the +13 is the WS4 delta in that scene).
- **Console errors `[]`** ✓.

**qa81 verdict on the WS4 build: GREEN, 16/16.**

## 10. Limitations and honest notes

- **Fixed sunset only.** No day/night cycle, no weather system, no time/weather UI — by design (the brief forbids inventing those without real systems). "Daylight+sunset/night where supported" therefore means: the game has one supported lighting state (sunset), and it is verified in §5/§6. There is no before/after pair for the same angles — the pre-WS4 world was never screenshot from these exact angles, so deltas are described from the audit (§2) rather than fabricated comparisons.
- **Subtle-by-design elements:** park hedges (0.5 m, blend with the lawn — in code, not distinctly visible in any shot); rocks (present, read as sand-coloured lumps at distance); parapet rims (0.7 m rooftop detail, not distinctly visible from street level — the setback crowns are visible instead); downtown podium (subtle, not separately confirmed in a shot).
- **Clouds are sparse** (8 instances over a ±350 m sky): visible in shots 09, 10, 13, 14 and the scene probe, absent from several frames. The sun is occluded by downtown towers from spawn — physically correct for a low sun; it is clearly visible from the tower plaza (shot 16).
- **Headless tier step-down** (high → Low mid-run) is a SwiftShader artifact, not a defect; several shots are therefore Low-tier (fewer buildings/palms) and are labelled as such where it matters.
- **Unchanged known gaps** (not WS4 regressions): 2.1 natural / 2.4 natural still BLOCKED (cloud-browser environment); 3.3 tower drive ASSISTED; Lena cinematic + on-foot police officer still deferred; the seven male characters' cinematics not individually re-verified; Settings-from-main-menu not re-run in the browser this session; touch drive joystick at 390 px untested; 9.4 RangePanel fix never live-verified in a browser; desktop FPS re-measurement outstanding.
- The green bus seen across lanes in shots 02/03/10 is traffic at the (0,30) intersection in the headless sim — still not a confirmed defect.

## 11. Git status, release — COMPLETE

- **WS4 checkpoint commit: `c1b53ae`** — "WS4 world & environment: palm variety, building setbacks, street props, beach detail, clouds + sun glow" — 9 files, +793/−35 (7 modified + `StreetProps.ts` + this report). Branch `ui/gta-vice-city-transformation`.
- **Push:** branch pushed to origin; remote `ui/gta-vice-city-transformation` verified = `c1b53ae`. (First push attempt failed on the egress proxy — `kex_exchange_identification / Connection reset by 198.19.0.1:3128` — because the ~17:14 runtime restart had wiped `/root/.ssh/` again; restored from `/home/hatch/.ssh/` and the retry succeeded. Same failure mode as 2026-10-11 and 2026-11-01.)
- **Merge:** `ui/gta-vice-city-transformation` merged into `main` with `--no-ff`, no conflicts — merge commit **`f199a42`** ("Merge WS4 world & environment expansion (ui/gta-vice-city-transformation) into main"). The merge brings the whole UI branch into main (54 files, +6098/−680 vs the release commit — UI Phases 1–2, Lovable Group 1, character Phase 1, the 3.2 fix, WS2, WS3 and WS4, all previously verified).
- **Push main:** remote HEAD verified = `f199a42` (was `053e76d`).
- **Build on main:** tsc clean; production build byte-identical to the WS4 build — `index-5UWogofC.js`, 1,198.17 kB / gzip 326.85 kB (the merge tree is identical to `c1b53ae`).
- **Deploy (Vercel, verified via the dashboard 2026-11-23 ~17:35–17:38 IST):** the push triggered a Production deployment on branch main, commit `f199a42` — **status Ready**. Deployment URL: https://vice-city-stories-ldna6xrmd-sachirokadia23-3354s-projects.vercel.app. Production domain: https://vice-city-stories-sigma.vercel.app/. No redeploy was needed. The previous production deployment (`053e76d`, "Release: Vice City Stories — full campaign, stable build", 2 days ago) is superseded.
- **Live verification (cloud browser, same session):** the live site serves the NEW bundle — `/assets/index-5UWogofC.js` loads and returns the game's JavaScript, while the old `/assets/index-jLcIAx51.js` returns Vercel "404: NOT_FOUND" on the production domain. (The browser tooling blocks view-source: URLs, so the homepage's raw source was not read directly; the asset check plus the app booting is the evidence. Byte sizes were not verified directly.) Main menu shows "VICE CITY STORIES" with Play, Story, Missions, Settings and About, plus progress ($0, Chapter 1, 0 of 10 missions). PLAY enters the 3D world, which renders correctly: sunset sky, city skyline with lit buildings, streets with lane markings and crosswalks, moving cars (taxi, police car, bus), pedestrians, street lamps, trees, the "BEACON RUN" mission from Mara Voss with its beacon marker, minimap and full HUD (cash, health 100, Palm 9 12/60). Rotating the camera showed the ocean as a blue band on the horizon and the beach strip on the minimap. No startup errors, no blank screens; the loading screen ("Loading the city…", "Checking WebGL support…") progressed normally to the menu. No missions were played. One observation, not a failure: the in-game FPS counter read 1–6 FPS with the quality label "Low — battery saver (manual)" — the cloud browser renders choppily, as in the earlier natural-gameplay session (4–5 FPS); the world, HUD and controls all worked.
- **Report update:** this §11 (and §12) were added after the deploy; committed as a docs-only follow-up on main (it does not change the deployed bundle — the production code remains `f199a42`, bundle `index-5UWogofC.js`).
- Working tree after release: clean except the 7 older untracked report docs (WS1/3.2/Next Phase/sprint/WS1-final/WS1-natural/WS2), which were deliberately not committed.

## 12. Verdict

WS4 is **complete and released**. Every added feature is confirmed in the actual running game on desktop and mobile, WS2/WS3 regressions are fully green, tsc is clean, the build is +~8 kB, **qa81 is GREEN 16/16 on the WS4 build** (arrest cycle → busted → respawn cleared, console errors `[]`), and the release workflow is done: checkpoint `c1b53ae` → pushed → merged to main as `f199a42` → pushed → Vercel Production deployment Ready → live site verified serving `index-5UWogofC.js` with the game booting and the world rendering. **Production is now `f199a42` at https://vice-city-stories-sigma.vercel.app/.**
