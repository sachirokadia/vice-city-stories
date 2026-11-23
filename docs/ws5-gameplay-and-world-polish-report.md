# WS5 — Gameplay Verification, World Polish & Deferred Features

**Branch:** `ui/gta-vice-city-transformation`
**Starting commit:** `c1b53ae` (WS4 checkpoint; production `main` at `a1f0b4c`)
**Final commit:** _to be filled after the checkpoint commit_
**Build:** `index-B9LExE1Q.js`, 1,198,811 B (WS4: 1,198,166 B — **+645 B**)
**TypeScript:** clean (`npx tsc --noEmit`)
**Date:** 2026-11-23

---

## 1. Starting branch and commit

- `git checkout ui/gta-vice-city-transformation` — HEAD `c1b53ae`, up to date
  with `origin/ui/gta-vice-city-transformation`.
- Verified in history: `f199a42` (WS4 production merge), `c1b53ae` (WS4),
  `95d9705` (WS3), `c33d37d` (character Phase 1), `10dadfe` (3.2 fix).
- Remote verified: origin HEAD `a1f0b4c`, UI branch `c1b53ae`.
- Working tree clean except the 7 untracked WS1–WS4 report docs.
- SSH to GitHub had been wiped again by a VM replacement (`/root/.ssh/`
  empty); restored from `/home/hatch/.ssh/` and re-verified
  (`ssh -T git@github.com` → "Hi sachirokadia!").
- No empty "starting checkpoint" commit was created — the baseline IS
  `c1b53ae` (WS2 precedent: an empty commit would fabricate a checkpoint).
- WS1–WS4 work confirmed present before any edit: `MapDraw.ts`,
  `FullMap.tsx`, `PauseHub.tsx`, `StatisticsPanel.tsx`, `StreetProps.ts`,
  `PalmPrintTexture.ts`, `CharacterDesign.ts` (shoulder hair), the 3.2 fix
  line in `StoryCampaign.ts:473`, `CINE_LENA_DEAD_DROP` registered.

## 2. Files modified and added

**Modified (5):**
- `src/game/StreetProps.ts` — park hedges taller/lighter + clipped-top trim.
- `src/game/Environment.ts` — dunes taller + deeper tone; rocks bigger +
  cooler grey.
- `src/game/Buildings.ts` — downtown podium 4 → 5 m + dark cornice band;
  parapet rims 0.7 → 1.0 m high, 0.35 → 0.45 thick.
- `src/game/Lighting.ts` — clouds 8 → 12, larger, more opaque, wider sky band.
- `src/game/Vegetation.ts` — shrubs taller + lighter green; palm crown-width
  variety via a dedicated seeded RNG (main `rand()` sequence untouched).

**Added (2 docs):**
- `docs/ws5-natural-gameplay-checklist.md` — human-playtest instructions for
  2.1 and 2.4 (both BLOCKED pending a real human run).
- `docs/ws5-gameplay-and-world-polish-report.md` — this report.

**No game-logic, mission, dialogue, save-format, engine or UI-contract
files were touched.** No new libraries. No new draw calls except +1 (the
hedge trim mesh).

## 3. Mission 2.1 verification status — BLOCKED (no defect found)

**TAIL SPIN** (`StoryDefinitions.ts:275–347`): unlockAfter
`story-signal-lost`; start marker (62.5, −150); time limit 150 s; reward
$1,000; sets flag `warehouse-found`; unlocks 2.2 HOLD THE LINE.

Objectives: find-vic (reach, r4) → talk-vic (dialogue + `cine-tail-spin`,
accept) → enter-car (GT (0, −2), r3.6) → tail-sedan (follow, band 8–35 m,
too-close 3 s, too-far 5 s, route 500 m) → reach-warehouse (reach,
(120, −150), r12).

Trigger rules verified from `MissionTriggers.evaluateFollow`: done iff the
sedan covers 500 m while the player is inside the band; "spotted" iff
under 8 m for 3 continuous sim-s; "lost" iff over 35 m for 5 continuous
sim-s after first lock-on. The sedan drives at ~11 m/s; the GT tops out
at ~137 km/h. The 150 s limit covers the ~45–60 s minimum drive with
room to spare.

**No code defect was found** in the unlock chain, triggers, objectives,
vehicles, timers or completion conditions. The earlier headless failure
was a test-environment limitation (simulation at ~3% of real time,
harness steering), not a game defect — the WS1 verdict stands. No
mission difficulty, vehicle speed, timer or logic was changed.

**Natural status: BLOCKED.** No human playthrough has been performed.
The exact human-playtest checklist is in
`docs/ws5-natural-gameplay-checklist.md` (§2.1). Prior evidence remains
ASSISTED (WS1 harness rescue) and the cloud-browser attempt remains
BLOCKED (never reached the mission).

## 4. Mission 2.4 verification status — BLOCKED (no defect found)

**THE LONG WAY OUT** (`StoryDefinitions.ts:458–497`): unlockAfter
`story-dockside-trouble`; start marker (−6, 30); time limit 180 s;
reward $1,500; sets flag `vera-lied`; **startHeat 45 (wanted level 3)**;
outro `cine-chapter2-outro`; unlocks Chapter 3.

Objectives: find-dana (reach, r4) → talk-dana (dialogue +
`cine-long-way-out`, accept) → reach-hideout (reach (180, −30), r12,
checkpoint) → evade.

Evade rules verified from `MissionTriggers.evaluateTrigger` +
`Wanted.ts`: the evade objective completes when the wanted level reaches
0. PURSUIT while any unit sees the player → after 6 s unseen, SEARCH
(police drive to the last known spot) → escape timer `14 + 4 × level`
seconds (26 s at level 3) without re-detection → heat 0, status clear.
Heat decays 1.5/s during SEARCH. The 180 s limit comfortably covers the
natural sequence (find + talk ~30 s, drive to hideout ~20 s, hide 6 + 26 s).

**No code defect was found** in the escape, wanted-level, vehicle or
completion logic. The WS1 headless evade timeout was a re-detection (a
police unit spotted the player at escape progress 0.87 and reset the
timer) — the mechanic working as designed, not a defect. No `setHeat(0)`
or other shortcut was used or is needed. No mission logic was changed.

**Natural status: BLOCKED.** No human playthrough has been performed.
The exact human-playtest checklist is in
`docs/ws5-natural-gameplay-checklist.md` (§2.4). Prior evidence remains
ASSISTED (WS1: teleport to the hideout + `setHeat(0)`).

## 5. Natural versus assisted test evidence

| Test | Label | Evidence |
|---|---|---|
| 2.1 TAIL SPIN natural | **BLOCKED** | No human run yet; checklist written |
| 2.1 TAIL SPIN (WS1) | ASSISTED | Harness rescue (`debugSetFollowTravelled(500)` + teleport); cash 5,000 → 6,000 |
| 2.4 LONG WAY OUT natural | **BLOCKED** | No human run yet; checklist written |
| 2.4 LONG WAY OUT (WS1) | ASSISTED | Teleport to hideout + `setHeat(0)`; cash 8,000 → 9,500; outro played; Ch.3 unlocked |
| Cloud-browser attempt (2026-11-23) | BLOCKED | 4–5 FPS, tap-only keys; never reached 2.1 (BEACON RUN timed out) |
| 3.2 retry, 3.3 + endings + reload | VERIFIED (assisted drives) | WS1 final verification on the combined build; unchanged since |
| qa81 (WS5 build) | _see §11_ | _running at report draft time_ |

Nothing in this report converts assisted evidence into natural evidence.
A human playthrough is still required for 2.1 and 2.4; the checklist
gives the exact steps, expected states and evidence to capture.

## 6. Environmental improvements (Priority 2)

All verified visually in the running game at 1280×800
(script `~/workspace/qa-shots/vcs-ws5-polish.mjs`, log `ws5-polish2.log`,
screenshots `~/workspace/qa-shots/ui-ws5/01–08`, console errors `[]`).

| Item | Change | Result |
|---|---|---|
| Park hedges | 0.5 → 0.9 m tall, 0.5 → 0.7 thick, colour `0x2c5a34` → `0x3e7a37`, + lighter clipped-top trim (`0x7fb84e`, +1 draw call) | Reads as a deliberate landscaped edge now; still subtle at 20 m distance, clear up close. Shot 01. |
| Sidewalk shrubs | Taller (0.55–0.8 → 0.7–1.0), colour `0x3a7d44` → `0x46a04e` | Clearly readable as shrubs on the sidewalks. Shots 06, 07, 08. |
| Palm silhouette | Crown-width variety 0.85–1.2× per palm (dedicated seeded RNG; main placement sequence untouched) | Crowns differ visibly between palms. Shots 05, 08. Note: a wide crown can briefly cover the top of the frame when the player walks directly under it on the boardwalk — momentary, natural for a canopy. |
| Beach rocks | Bigger (waterline 0.5–1.4 → 0.9–1.9 m; sand 0.35–0.85 → 0.7–1.3 m), colour `0x8a8578` → `0x6b6f75` (cooler, darker grey) | Read as grey rocks from gameplay distance now, not sand-coloured lumps. Shot 03. |
| Dunes | Taller (0.3–0.5 → 0.45–0.85 m), colour `0xd9c193` → `0xcfa96e` (deeper than the sand plane) | Dune mounds read clearly as pale ovals on the sand. Shots 05, `cine2-lena.png`, `cine2-milo.png`. |
| Dune grass | (unchanged in WS5) | The WS4 cones read very clearly now against the deeper dunes — slightly cone-like, acceptable beach texture. |
| Downtown podium | 4 → 5 m tall + dark cornice band at the plinth top (roof batch, no new draw call, no collision change) | Still subtle from street level — the cornice does not read at distance against busy facades. The setback crowns remain the clearer downtown feature. Shot 06. Honest limitation, not claimed as a big win. |
| Parapet rims | 0.7 → 1.0 m high, 0.35 → 0.45 thick | Still not distinctly visible from street level (rooftop detail). Honest limitation. |
| Clouds | 8 → 12 instances, opacity 0.5 → 0.62, width 90–160 → 110–190, height 34–60 → 40–68, altitude band 95–150 → 85–160 | Soft clouds clearly visible in the sky from the street and the beach. Shots 05, `cine2-theo-june-medium.png`. |
| Sun / sunset | Unchanged (fixed sunset preserved) | Sun disc + glow previously confirmed at the tower plaza (WS4 shot 16); the sun staying hidden behind towers from spawn is physically plausible and was not treated as a defect. |

**Harness note (fixed during WS5):** the first polish run's screenshots
lagged one step behind — `engine.stop()` freezes rendering, so a
teleport issued *after* `stop()` never appears in the screenshot. The
script was fixed to teleport while running, poll
`renderer.info.render.frame` until a new frame lands, *then* stop and
shoot. Lesson recorded for future harnesses.

**Draw calls:** 265 at spawn on high tier (WS4: 264, **+1** — the hedge
trim mesh, as budgeted). Scene children 20. Clouds probe: 12 instances,
visible. Hedge-trim mesh confirmed in the scene graph.

**Unconfirmed observation (carried from WS4, still not a defect):** the
green bus was again seen angled across the road at the (0, 30)
intersection (shot 06). At 1–4 FPS the traffic AI barely moves, so a bus
mid-turn looks parked across the lanes. Not a confirmed defect.

## 7. Lena cinematic findings and result — DEFERRED (technical proposal)

**Finding (confirmed from code, WS2's analysis holds):**
`GameEngine.openCinematic` (`GameEngine.ts:1598`) refuses whenever
`getActiveActivity() !== 'none'`. `getActiveActivity()` returns `'story'`
whenever a story mission's state is `'active'`. Lena's `talk-lena` is
objective 5 of DEAD DROP, which is already `'active'` by then (accepted
at `talk-milo`), so the cinematic is refused silently and
`openMissionDialogue` (`StoryCampaign.ts:679`) falls through to the
dialogue directly — which is why Lena's dialogue and portrait work and
no console error appears. Every other story cinematic plays at mission
start, when the state is `'available'` (Milo's `cine-dead-drop` played
exactly this way in the same runs).

**Verification added in WS5:** Lena's staged model itself is correct —
direct-playing `cine-lena-dead-drop` with no mission active stages
`staged-lena` at (140, 30) with jacket `7f2d26`, hair `5e2f1a`, shirt
`f2ead8`, and the medium shot (`cine2-lena.png`) shows her framed on
the boardwalk, clearly distinct from Mara/June/Dana. The def, the
staging, the camera shots and the model are all valid. Only the
in-mission trigger path is blocked.

**Why no narrow fix was implemented:** there is no zero-guard-change
solution that preserves the intended moment (cinematic immediately
before Lena's dialogue, mid-mission). The alternatives were examined:
- *A scoped carve-out in `openCinematic`* ("allow when the only active
  activity is the story mission that owns this cinematic and the current
  objective is the dialogue objective carrying this cinematicId") — this
  IS a change to the shared gate's behaviour, which the WS5 brief puts
  behind an approval boundary.
- *Moving the cinematic to the mission outro* (`outroCinematicId`, the
  `playStoryOutro` pattern) — architecturally clean (the guard passes
  when the mission is `'complete'`), but it changes the narrative moment
  (an introduction playing after the mission ends) and the mission
  definition. A design decision for Sachi, not a silent change.
- *A new "paused-for-cinematic" mission state* — a bigger lifecycle
  change with save/load implications. Worse than the carve-out.

**Proposal (for approval):** the scoped carve-out, exact shape:
- `GameEngine.openCinematic(cinematicId, onDone, opts?: { storyMissionId?: string })`.
- Accept when `getActiveActivity() === 'story'` AND
  `this.story.getHudState().missionId === opts.storyMissionId` AND the
  current objective is a `dialogue` objective whose `cinematicId` is the
  requested one. All other cases keep the current refusal.
- The existing `onDone` callback already re-checks the objective and
  state before opening the dialogue, and `cinematicPlayedRun` already
  prevents double-play — both hold unchanged.
- DEAD DROP has `timeLimit: 0`, so no mission timer runs during the
  ~6.5 s cinematic. No other mission has a mid-mission cinematic today,
  so the carve-out affects exactly one objective.
- Files: `src/game/GameEngine.ts` (openCinematic + the call site),
  `src/game/StoryCampaign.ts` (pass the mission id in `openMissionDialogue`).
- Risks: the gate gains one case; a wrong `storyMissionId` could let a
  cinematic play during the wrong mission — mitigated by the
  mission-id + objective-id checks. No change to the guard for jobs,
  contracts, or any other activity.
- Regression tests: (1) Lena DEAD DROP run end-to-end (drops → Lena
  cinematic plays → dialogue → complete, cash 5,900); (2) all 13 other
  cinematics still play at mission start; (3) a job mission active still
  refuses a story cinematic; (4) `cinematicPlayedRun` still prevents a
  second play on re-pressing E; (5) skip + Esc exit restores control;
  (6) qa81 green.

**Result: DEFERRED for Sachi's approval.** The def stays registered, so
the approved carve-out alone would activate it. No engine code was
changed.

## 8. On-foot police officer findings and result — DEFERRED (future workstream)

**System inspected:** `Arrest.ts` (full flow), `Police.ts` (vehicles
only), `Wanted.ts`, `CharacterDesign.ts`, `CinematicStaging.ts`,
`GameEngine.ts:906–911` (surrender lock re-applied on quality rebuilds).

**The arrest flow:** none → prompt → surrendering (2.8 s) → busted.
- Prompt (on foot): nearest pursuer within 7 m (3.5 m even at sprint),
  player slow, wanted level > 0, status PURSUIT. (In the car: GT stopped
  with ≥2 units within 12 m, or 1 unit within 6 m.)
- Auto-arrest: on foot, pursuer < 7 m, sees the player, player
  near-stationary (<2 m/s) for 3 s.
- Surrender (F / SURRENDER button): movement locks, hands-up pose, the
  nearest police unit drives up and stops by the player. 2.8 s → BUSTED.
- Busted: the engine resets wanted + police; respawn clears.

**Why it was deferred again (third deferral, same reasons, now fully
documented):**
1. **The window is 2.8 seconds.** An officer would be visible for under
   three seconds, only when the player actually surrenders or is
   auto-arrested — and most arrests happen boxed-in in the car, where
   the player is inside the GT.
2. **No cap/badge geometry exists** in `CharacterDesign` (hood/chain/
   sunglasses only). A believable officer needs new `Character.ts`
   geometry (cap, badge, belt) — a new character-art task, not a
   recolour.
3. **Lifecycle across quality rebuilds is unsolved.** The world rebuilds
   on quality change and the surrender lock is re-applied at
   `GameEngine.ts:906–911`; an officer mesh parented to the scene would
   be destroyed mid-surrender and need re-creation logic tied to that
   lock.
4. **A purely decorative officer violates the brief's own rule:** "Do
   not create an officer who is merely decorative but falsely appears to
   participate in arrest gameplay." An officer who stands still for
   2.8 s and vanishes is exactly that.
5. **Functional on-foot AI** (officer approaches, escorts, restrains)
   would need a new AI/movement system — a major workstream, explicitly
   out of scope for WS5.

**Proposal (future workstream):** (a) add cap + badge + belt geometry to
`CharacterDesign`/`Character.ts` with a `police` design entry (dark navy
uniform, cap, proportions of the existing rig); (b) spawn the officer
when the arrest state enters `'surrendering'` (or `'prompt'` for the
approach), positioned beside the arresting unit's stop point, facing the
player; (c) despawn on `'busted'`, respawn, wanted-clear, or quality
rebuild (re-create from the surrender lock state); (d) reuse the
existing rig/animation (idle only — no new AI); (e) regression: arrest
cycle, auto-arrest, car-boxed arrest, respawn, quality-change
mid-surrender, qa81. Estimated scope: a dedicated character + lifecycle
workstream, not a WS5 add-on. **No police code was written.**

## 9. Male cinematic verification matrix (Priority 6)

Method: direct-play each cinematic with no mission active (activity
`'none'`, so the engine guard passes), using the built-in QA
`setTimeScale(10)` hook to reach the character medium shot (shot index
1), probing the scene graph for the staged actor (group name, position,
jacket material colour vs the character palette), screenshotting the
medium shot, then skipping and verifying the staged actor is disposed
(no `staged-*` group left) and gameplay resumes. Scripts:
`~/workspace/qa-shots/vcs-ws5-cinematics.mjs` (v1),
`vcs-ws5-cinematics2.mjs` (v2), `vcs-ws5-cinematics3.mjs` (v3);
logs `ws5-cine.log`, `ws5-cine2.log`, `ws5-cine3.log`; screenshots
`~/workspace/qa-shots/ui-ws5/cine2-*.png`. Console errors `[]` throughout.

| Character | Cinematic | Staged actor | Jacket (palette) | Medium shot | Exit / cleanup |
|---|---|---|---|---|---|
| Rico | `cine-dockside-static` | `staged-rico` (−124, 156) | `9a5b1e` ✓ | Viewed — tall/broad, hood up, dockside crosswalk | Clean (inactive, 0 left) |
| Vic | `cine-tail-spin` | `staged-vic` (64.5, −150) | `7c5a3a` ✓ | Viewed — brown jacket, cream shirt, north avenue | Clean |
| Rook | `cine-dockside-trouble` | `staged-rook` (2, 166) | `3f4a2a` ✓ | Viewed — olive jacket by the crates, dockside | Clean |
| Silas | `cine-finale` | `staged-silas` (2, −160) | `3b3b48` ✓ | Viewed — grey-haired, dark jacket, framed by Beacon Tower | See note below |
| Theo | `cine-cranes-nest` | `staged-theo` (−86, 60) + `staged-june` (−88, 60) | `57534e` ✓ (+ June `6d5bd0` ✓) | Viewed — Theo + June together on the park lawn | Clean |
| Milo | `cine-dead-drop` | `staged-milo` (135, 90) | `b45309` ✓ | Viewed — orange jacket, clearly shortest, boardwalk | Clean |
| Lena (control) | `cine-lena-dead-drop` | `staged-lena` (140, 30) | `7f2d26` ✓ (+ hair `5e2f1a`, shirt `f2ead8`) | Viewed — rust jacket, auburn shoulder hair, boardwalk | Clean (direct-play only) |
| Old Man Ferris | — | — | — | **No cinematic exists.** 1 finale dialogue node, never staged. Not a failure — there is nothing to verify. | — |

**Silas note (designed behaviour, not a defect):** the v2 run skipped
`cine-finale` at shot 1, but the screenshot before the skip took ~30–60 s
(SwiftShader), during which the cinematic — still at 10× — had advanced
to shot 4, `the-choice`, which opens the embedded choice dialogue
`silas-finale`. `skip()` refuses while a dialogue is open
(`Cinematic.ts:280`, "Never skip out from under an open dialogue"), so
the cinematic stayed active with the dialogue open, and the next three
`openCinematic` calls were correctly refused (a cinematic was already
active). The v3 run re-did those three on a fresh page. The finale's
Pattern B lifecycle (dialogue opens at the last shot → choice → cinematic
ends) was already verified end-to-end in the release playthroughs (3.3
June/Mara endings, both outros played and ended). The v1 run also showed
the finale starting and skipping cleanly from shot 0.

**Also verified:** two-character staging works (Theo + June in one
scene); staged actors are disposed on skip (0 `staged-*` groups left in
every clean row — no leaks, no duplicates); no camera clipping in any
medium shot; the first shot of each cinematic is an establishing wide
(the character may be small or hidden behind a building there — e.g.
Rico's shot 0 — which is why the matrix screenshots the medium shot).

## 10. Performance measurements

- **Draw calls:** 265 at spawn on high tier (WS4: 264, +1 hedge trim).
  Mobile low tier: 136 at spawn (WS4: 135, +1 hedge trim — _see §13_).
- **Bundle:** `index-B9LExE1Q.js`, 1,198,811 B / gzip ~327 kB (WS4:
  1,198,166 B — **+645 B**).
- **FPS:** not measurable headlessly (0–4 FPS in SwiftShader; the tier
  steps down high → medium → Low mid-run — the known headless artifact,
  not a defect). Sachi's AMD Radeon numbers (spawn 60 / downtown 55 /
  beach 60) remain the only real-hardware FPS record. Desktop FPS
  re-measurement on her hardware is still outstanding.
- **Memory / disposal:** staged cinematic actors dispose cleanly (0 left
  after every skip); no new WebGL contexts (portraits still use the one
  shared offscreen renderer); no per-frame allocations added (all WS5
  changes are static geometry/material constants).
- **No optimisation was needed:** +1 draw call and +645 B do not justify
  sacrificing world quality.

## 11. TypeScript and production build results

- `npx tsc --noEmit`: **clean**.
- `npm run build`: **`index-B9LExE1Q.js`, 1,198,811 B** (built in 1.65 s).
  Preview server on 4173 verified serving `index-B9LExE1Q.js`.

## 12. qa81 results

**16/16 assertions passed** — exit 0, ~24.5 min, log
`~/workspace/qa-shots/qa81-ws5.log`, console errors `[]`.

| Check | Result |
|---|---|
| Draw calls at spawn | 265 (WS4: 264, +1 hedge trim) |
| Contracts at spawn | both dormant |
| Encounters at spawn | both dormant |
| Enemies at spawn | 0 |
| Pedestrians / traffic | 18 / 14 |
| BEACON RUN | checkpoint (0.0, −84.1), delivery (0.0, −153.3), cash 12500 ✓ |
| Mission board | beacon-run complete; midnight-delivery unlocked; rest locked ✓ |
| Shop water + outfit casual | ok; cash 12190 ✓ |
| Coins | 0 → 1 |
| Sprint | complete; cash 12340 ✓ |
| Garage | cash 4040; all 4 vehicles owned, Trailhawk-X selected ✓ |
| Range shot | shots 0 → 1 |
| Carbine | bought; mag 25 after 5 shots (no timing flake this run); palm 11, carbine 25 after switching back; cash 2840 ✓ |
| South Beach encounter | complete, +250 → 3090 ✓ |
| North Dunes encounter | complete, +250 → 3340 ✓ |
| Contract | active, remaining 3; draw calls 262 with contract active |
| Arrest cycle | reached busted: true; after respawn mode walk, wanted level 0 / heat 0 / clear ✓ |
| Draw calls at end | 126 |
| Console errors | `[]` |

## 13. Desktop and mobile screenshots

- Desktop 1280×800: `~/workspace/qa-shots/ui-ws5/01–08` (polish) +
  `cine2-*.png` (cinematics). All viewed; see §6 and §9.
- Mobile 390×844 (WS3 mobile script, log `ws3-mobile-ws5.log`): hub 10
  rows; no horizontal overflow on hub, settings, statistics or map
  (all scrollWidth 390); stats tiles 0/10 · 0/5 · 0/10 · 1/4 · $5,000;
  map 16 rows; Esc resumes the engine; console `[]`. Shots
  `hub-mobile`, `settings-mobile`, `statistics-mobile`, `map-mobile`
  in `~/workspace/qa-shots/`.
- Mobile draw calls (WS4 mobile script, log `ws4-mobile-ws5.log`):
  **136 at spawn** (WS4: 135, +1 hedge trim); no overflow at spawn,
  beach or hub; hub 10 rows; console `[]`. Shots `m1-spawn`,
  `m2-beach`, `m3-hub-mobile`.
- Console errors: `[]` in every WS5 harness run (polish ×2, cinematics
  v1/v2/v3, theo re-shoot, qa81, WS3 desktop, WS3 persist, WS3 mobile,
  WS4 mobile).

## 13b. WS3 desktop regression (log `ws3-ws5.log`)

All checks passed on the WS5 build: hub 10 rows, Esc resume, Settings
4 tabs, quality stepper Low → Medium → High, pedestrians Busy → Off,
wanted toggle on/off, Controls 8 rows, statistics tiles match the live
engine (0/10 · 0/5 · 0/10 · 1/4 · $5,000), map 16 rows with all 7
pixel checks matching (tower gold, garage pink, store teal, range
amber, sprint red, coin green, player white), zoom 100% → 104% →
96%, pan changes transform, tower sidebar shows Beacon Tower X 0 ·
Z −172, all four hub destinations open and return, top-bar map opens
and returns, minimap tower/player pixels match, Lena portrait srcLen
21422, palm-print buy $5,000 → $4,550 and duplicate →
`already-owned` with cash unchanged, console `[]`.

**One line needs an honest note, not a pass:** the script's final
same-page `page.reload()` check shows quality `low` and pedestrians
`busy` (the stored values) after reload. That is the known harness
artifact, not a regression: the harness seed script re-runs on a
same-page reload and re-seeds defaults. The proper fresh-page
persistence check (`vcs-ws3-persist.mjs`, log
`ws3-persist-ws5.log`) passes on the WS5 build exactly as in WS3 —
stored values quality `high` / pedestrians `off` survive to a fresh
page, engine tier `high`, console `[]`.

## 14. Console and WebGL status

- Console errors: `[]` in all WS5 runs. No PAGEERROR. No WebGL errors.
- No missing assets. HUD, minimap, top bar, pause hub all render (verified
  in the polish screenshots and the regression runs).

## 15. Known limitations and deferred work

- 2.1 and 2.4 natural verification: **BLOCKED** — needs a human
  playthrough; checklist delivered.
- Lena cinematic: **DEFERRED** — technical proposal in §7, awaiting
  Sachi's approval of the scoped guard carve-out.
- On-foot police officer: **DEFERRED** — future workstream proposal in
  §8 (third deferral).
- Podium cornice + parapet rims: improved on paper, still subtle from
  street level (§6) — a closer camera pass or stronger contrast would be
  needed to make them read, at the risk of visual clutter; left as is.
- Desktop FPS re-measurement on real hardware: still outstanding.
- Touch drive joystick + vehicle enter/exit at 390 px: still untested.
- 9.4 RangePanel fix in a live browser: still unverified.
- Seven male cinematics: now verified (matrix §9). Female leads'
  cinematics were verified in character Phase 1.
- Green bus angled across the road at (0, 30): observed a third time,
  still not a confirmed defect (likely a bus mid-turn frozen at 1–4 FPS).

## 16. Git push and merge details

_TO BE FILLED after the WS5 checkpoint commit, push, merge and main push._

## 17. Vercel deployment details

_TO BE FILLED after deployment._

## 18. Live production verification

_TO BE FILLED after the live check._

## 19. Final commit

_TO BE FILLED._
