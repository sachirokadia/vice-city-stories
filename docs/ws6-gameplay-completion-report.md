# WS6 — Gameplay Completion & Character Systems

**Branch:** `ui/gta-vice-city-transformation`
**Starting commit:** `156e151` (WS5 checkpoint; production `main` at `b68b7c1`)
**Final commit:** `3f258c6` (merge to main; checkpoint `5c645be`)
**Build:** `index-B9LExE1Q.js`, 1,198,811 B — byte-identical to the WS5
build (no game code changed in WS6 unless a defect is found)
**TypeScript:** clean (`npx tsc --noEmit`)
**Date:** 2026-11-23

---

## 1. Starting branch and commit

- `git checkout ui/gta-vice-city-transformation` — HEAD `156e151`, up to
  date with `origin/ui/gta-vice-city-transformation`.
- Verified in history: `b68b7c1` (WS5 docs follow-up), `742e3f6` (WS5
  merge), `156e151` (WS5 checkpoint), `f199a42` (WS4 merge).
- Remote verified: origin HEAD `b68b7c1`, UI branch `156e151`.
- Working tree clean except the 7 untracked WS1–WS4 report docs.
- SSH to GitHub had been wiped again by a VM replacement (`/root/.ssh/`
  empty — same failure as 2026-10-11, 2026-11-01 and WS4); restored
  from `/home/hatch/.ssh/` and re-verified (`ssh -T git@github.com` →
  "Hi sachirokadia!").
- No empty "starting checkpoint" commit was created — the baseline IS
  `156e151` (WS2/WS5 precedent).
- WS1–WS5 work confirmed present before any edit. Read before editing:
  `docs/ws5-gameplay-and-world-polish-report.md`,
  `docs/ws5-natural-gameplay-checklist.md`, WS1 and WS2 reports.

## 2. Files modified and added

**Modified (1 doc, correction only):**
- `docs/ws5-natural-gameplay-checklist.md` — the "Shared setup" build
  line named the old production build (`f199a42` /
  `index-5UWogofC.js`); corrected to `b68b7c1` /
  `index-B9LExE1Q.js`, with a pointer to the new short checklist.

**Added (3 docs):**
- `docs/ws6-natural-mission-completion.md` — short player-facing
  checklist for 2.1 and 2.4 (both BLOCKED pending a human run).
- `docs/ws6-character-and-cinematic-regression.md` — cinematic
  regression results (see §6).
- `docs/ws6-gameplay-completion-report.md` — this report.

**No game-logic, mission, dialogue, save-format, engine or UI files
were touched in WS6.** No new libraries. The production build is
byte-identical to WS5 (`index-B9LExE1Q.js`, 1,198,811 B). The Lena
guard change and the police officer were NOT implemented — both are
approval-gated proposals below (§4, §5).

## 3. Mission 2.1 / 2.4 status — BLOCKED (no defect found)

Both missions remain **BLOCKED** for natural verification — no human
playthrough exists yet. This is unchanged from WS5 and is not a code
problem.

**Re-verified for WS6:** the mission code is unchanged since WS5 (the
production build is byte-identical). WS5's code verification stands:
2.1 unlocks after 1.3 SIGNAL LOST, marker (62.5, −150), 150 s, follow
band 8–35 m, sedan route 500 m; 2.4 unlocks after 2.3 DOCKSIDE TROUBLE,
marker (−6, 30), 180 s, start heat 45 (wanted level 3), evade completes
at wanted level 0. No missing control, confusing objective, broken
trigger or progression blocker was found. No game code was changed.

**Checklist work done in WS6:** the WS5 checklist was long and its
setup section named the wrong production build. It is replaced for
players by the short version in
`docs/ws6-natural-mission-completion.md` (setup, controls, 5 steps for
2.1, 4 steps for 2.4, "Done when" lines, evidence to capture, report-back
instructions). The full code-verified detail stays in the WS5 document.

**What still needs Sachi:** play 2.1 and 2.4 on the live site with
ordinary input and report back (cash before/after, time, screenshots).
Until she does, both stay BLOCKED. Nothing in WS6 simulates this.

## 4. Lena cinematic — DEFERRED, approval gate (proposal below)

**Status: NOT implemented. Awaiting Sachi's explicit approval of the
exact change below.**

### The problem (re-confirmed in the current code)

- `GameEngine.openCinematic` (`GameEngine.ts:1598`) refuses whenever
  `getActiveActivity() !== 'none'`.
- `getActiveActivity()` (`GameEngine.ts:1425`) returns `'story'` when
  `this.story.getHudState().state === 'active'`.
- Lena's `talk-lena` is objective 5 of DEAD DROP (`story-dead-drop`,
  `StoryDefinitions.ts:593`, `dialogueId: 'lena-dead-drop'`,
  `cinematicId: 'cine-lena-dead-drop'`). The mission is already
  `'active'` by then (accepted at `talk-milo`), so the cinematic is
  refused silently and `StoryCampaign.openMissionDialogue`
  (`StoryCampaign.ts:679`) falls through to the dialogue directly —
  which is why Lena's dialogue and portrait work and no console error
  appears.
- DEAD DROP has `timeLimit: 0` (`StoryDefinitions.ts:541`), so no
  mission timer runs during the ~6.5 s cinematic.
- Only two callers of `openCinematic` exist in `src/`: the campaign
  dialogue path (via the deps wiring at `GameEngine.ts:643`) and
  `playStoryOutro` (`GameEngine.ts:1650`, passes no options — its guard
  already passes because the mission is `'complete'`).

### Exact proposed change (scoped carve-out)

**`src/game/GameEngine.ts` — `openCinematic` (line 1598):**

```ts
openCinematic(
  cinematicId: string,
  onDone: () => void,
  opts?: { storyMissionId?: string },
): boolean {
  if (this.disposed) return false;
  if (this.cinematic.isActive()) return false;
  if (this.dialogue.isOpen()) return false;
  if (this.getActiveActivity() !== 'none') {
    // Scoped carve-out: a story mission's own dialogue cinematic may
    // play while that mission — and only that mission — is active,
    // and only on the dialogue objective that carries this cinematic.
    const allowed =
      opts?.storyMissionId !== undefined &&
      this.getActiveActivity() === 'story' &&
      this.story.getHudState().missionId === opts.storyMissionId &&
      this.story.getCurrentObjective()?.type === 'dialogue' &&
      this.story.getCurrentObjective()?.cinematicId === cinematicId;
    if (!allowed) return false;
  }
  const ok = this.cinematic.start(cinematicId);
  if (!ok) return false;
  this.cinematicOnDone = onDone;
  this.reportCinematic();
  return true;
}
```

**`src/game/StoryCampaign.ts`:**
- Line 122 (deps interface): `openCinematic: (cinematicId: string,
  onDone: () => void, opts?: { storyMissionId?: string }) => boolean;`
- Line 643 (engine wiring): pass `opts` through —
  `openCinematic: (cinematicId, onDone, opts) =>
  engine.openCinematic(cinematicId, onDone, opts)`.
- Line 686 (call site in `openMissionDialogue`): pass the owning
  mission id — `deps.openCinematic(obj.cinematicId, () => { … },
  { storyMissionId: def.id })`. (`def.id` is already in scope in the
  campaign closure.)
- New campaign accessor (interface ~line 199 + implementation):
  `getCurrentObjective: () => StoryObjectiveDef | undefined`, returning
  `currentObjective()`. Needed because `StoryHudState`
  (`StoryTypes.ts:204`) carries `missionId` and `objectiveIndex` but
  NOT the objective's type or `cinematicId` — the engine cannot check
  the objective from the HUD state alone. This is the one refinement
  over the WS5 sketch, which assumed the HUD state carried it.

**What does NOT change:** the guard itself stays — jobs, contracts and
every other activity still refuse exactly as before. `playStoryOutro`
is untouched. The existing `onDone` callback (lines 686–695) still
re-checks the objective and state before opening the dialogue.
`cinematicPlayedRun` (line 313, cleared on mission reset) still
prevents double-play. No save-format change (no new state is stored).

### Risks

- The gate gains one case. A wrong `storyMissionId` could let a
  cinematic play during the wrong mission — mitigated by the
  mission-id + objective-type + cinematic-id checks (three conditions,
  not one). Today only one objective in the whole game can satisfy
  them (`talk-lena` in `story-dead-drop`); no other mission has a
  mid-mission cinematic.
- If the cinematic fails to start (`cinematic.start` returns false),
  the existing fall-through opens the dialogue directly — same as
  today, no stuck state.
- Skip / Esc exit goes through the existing `closeCinematic` path,
  which fires `onDone` and restores the camera and control — unchanged.

### Regression tests (to run if approved)

1. Lena DEAD DROP run end-to-end (drops → Lena cinematic plays →
   dialogue → complete, cash 5,900).
2. All 13 other cinematics still play at mission start.
3. A job mission active still refuses a story cinematic.
4. `cinematicPlayedRun` still prevents a second play on re-pressing E.
5. Skip + Esc exit restores control and the mission continues.
6. Save/load across the Lena objective; checkpoint retry.
7. qa81 green.

**Result: DEFERRED — waiting for Sachi's approval of this exact
change. No engine code was changed in WS6.**

## 5. On-foot police officer — investigation + recommendation

**Status: NOT implemented. Feasible as a small dedicated workstream —
not a major AI rewrite. Needs Sachi's go-ahead as its own piece of
work (new character art, not a fix).**

### Systems inspected (current code)

- `Arrest.ts` (225 lines): states none → prompt → surrendering
  (2.8 s, `SURRENDER_DURATION`) → busted. Prompt on foot: nearest
  pursuer ≤ 7 m (3.5 m even at sprint), player slow, wanted > 0,
  status PURSUIT. Auto-arrest: pursuer < 7 m, sees the player, player
  near-stationary (< 2 m/s) for 3 s. `arrestSlot` = the unit sent to
  approach; `wasDriving` recorded. The module tracks only vehicle
  slots — it has no officer concept.
- `Police.ts` (1,038 lines): `MAX_UNITS = 6`, vehicles only
  (InstancedMesh bodies/wheels/lights/bars), road-graph movement,
  patrol / pursue / search / roadblock states. `setArrestTarget`
  directs one unit to approach a point and stop near it (the arrest
  approach).
- Engine (`GameEngine.ts:2384`): on entering `'surrendering'` the
  engine exits the vehicle if driving, locks the player hands-up
  (`setSurrendered(true)`), and calls
  `police.setArrestTarget({ x, z, slot: arrest.arrestSlot })` — the
  police car drives up and stops by the player. On `'busted'`:
  `wanted.reset()` + `police.resetToPatrol()`.
- `CharacterDesign.ts` (53 lines): only `heightScale`,
  `shoulderScale`, `hipScale`, `hairStyle`, `skirt`, `hoops`,
  `sunglasses`, `chain`, `hood`, `portraitAsset`. **No cap, badge,
  belt or uniform exists.**
- `NPC.ts` / `PedestrianPaths.ts`: the crowd walks fixed sidewalk
  paths (counts by setting: off/few/normal/busy), with a `dispose()`
  that frees its InstancedMeshes. There is **no free pathfinding /
  steering** — nothing in the game walks from point A to point B
  on demand.
- Quality rebuild (`GameEngine.ts:906–911`): the player object is
  recreated and the surrender lock is re-applied from the arrest
  state. Any scene-parented officer mesh would be destroyed by the
  rebuild and need re-creation from the same state.

### The proposal (minimum viable officer)

1. **Minimum viable:** spawn exactly when the arrest state enters
   `'surrendering'` (by choice with F, or by auto-arrest), at the
   arresting unit's stop point — beside the player, offset ~1.5 m
   toward the road/car so it never clips the player or the GT — facing
   the player. One officer max (guard on a spawned flag + `arrestSlot`).
   Idle pose only, for the 2.8 s surrender, then despawn.
2. **Model and animations:** new `police` design entry in
   `CharacterDesign`/`Character.ts` — dark navy uniform palette, cap,
   badge (small chest plate), belt (waist band). New box/cylinder
   geometry, same rig as every other character. Animation: existing
   idle from `CharacterAnimation.ts` only. No walk, no approach, no
   escort, no new animation system.
3. **Spawn/despawn:** spawn trigger is the `'surrendering'`
   transition in the engine (next to the `setArrestTarget` call).
   Despawn on `'busted'`, respawn (`arrest.reset()`), wanted-clear,
   wanted-disabled, or quality rebuild — re-created from the arrest
   state if still surrendering, the same pattern as the player
   surrender lock. **Never spawn at `'prompt'`** — the player can
   still flee, and an officer who vanishes when they run would look
   broken. Works for foot and car-boxed arrests alike (the engine
   already exits the vehicle before the approach).
4. **Does he genuinely participate?** Honestly, thinly — and that must
   be stated. He is the visible arresting officer at the scene for
   the 2.8 s surrender, standing where the arrest happens and facing
   the player, the same way the police car participates by driving up
   and stopping. He does not approach, restrain, escort, or affect
   timing (arrest timing is unchanged: 2.8 s). This is not the
   prohibited decorative officer: he appears only as part of an actual
   arrest, at the arrest location, and disappears with it. But if
   Sachi wants a walking approach or an escort, that needs steering
   that does not exist — a separate major workstream, not this one.
5. **Collision and pathfinding:** none needed. Player movement is
   locked during surrender (`setSurrendered(true)`), and the officer
   spawns in place — no walk, no pathfinding (none exists to reuse:
   pedestrians follow fixed paths). Pedestrians do not collide with
   the player, and neither would the officer; the spawn offset keeps
   him clear of the player and the car.
6. **Performance and memory:** one `Character` group (~10–15 box
   meshes, same as a staged cinematic character) — roughly +10 draw
   calls for 2.8 s only, zero when not arresting. No new textures
   (procedural colours), no new WebGL context, no per-frame
   allocations (static pose). Disposed with the arrest (same dispose
   pattern as the crowd).
7. **Risks to the existing arrest system:** the arrest module itself
   is untouched — the officer is a visual-only layer driven off the
   existing state transitions. Risks are the rebuild re-creation, the
   spawn offset (must not clip player/car), and the single-officer
   guard. Regression: arrest cycle, auto-arrest, car-boxed arrest,
   respawn, quality-change mid-surrender, qa81.

**Recommendation:** feasible as a small dedicated workstream
(character art + lifecycle, one focused session) — not a major AI
rewrite, and not a WS6 add-on. The vehicle-based police and arrest
system stays fully intact either way. **No police code was written
in WS6.**

## 6. Cinematic and character regression

**Verdict: no regression — all 8 staged cinematics verified on the WS6
baseline.** Full matrix in
`docs/ws6-character-and-cinematic-regression.md` (logs
`~/workspace/qa-shots/ws6-cine{,2,3}.log`, shots in
`~/workspace/qa-shots/ui-ws6/`).

- Lifecycle (direct play, no mission active): all 7 cinematics start,
  go active, skip, and exit cleanly (`stillActive: false`).
- Staged actors: Rico (−124, 156, jacket `9a5b1e`), Vic (64.5, −150,
  `7c5a3a`), Rook (2, 166, `3f4a2a`), Silas (2, −160, `3b3b48`),
  Theo (−86, 60, `57534e`) + June (−88, 60, `6d5bd0`) staged together,
  Milo (135, 90, `b45309`), Lena (140, 30, `7f2d26` + hair `5e2f1a`) —
  all with the correct narration at shot 1 and 0 staged actors left
  after exit.
- Silas note (designed, not a defect): `cine-finale` shot 4 opens the
  embedded choice dialogue; `skip()` correctly refuses while dialogue
  is open (Pattern B, `Cinematic.ts:280`). The lifecycle run confirms
  the same cinematic skips cleanly when no dialogue is open.
- Ferris: no cinematic registered (never staged) — nothing to verify,
  not a failure. None created.
- Console errors `[]` in every cinematic run.

## 7. Performance measurements

- **Draw calls:** 265 at spawn on high tier (WS5, unchanged — build
  byte-identical). Mobile low tier: 136 (WS5, unchanged).
- **Bundle:** `index-B9LExE1Q.js`, 1,198,811 B / gzip ~327 kB
  (identical to WS5 — no code changed).
- **FPS:** not measurable headlessly (0–4 FPS in SwiftShader; the tier
  steps down high → medium → Low mid-run — the known headless
  artifact, not a defect). Sachi's AMD Radeon numbers (spawn 60 /
  downtown 55 / beach 60) remain the only real-hardware FPS record.

## 8. TypeScript and production build results

- `npx tsc --noEmit`: **clean**.
- `npm run build`: **`index-B9LExE1Q.js`, 1,198,811 B** (built in
  1.12 s) — byte-identical to the WS5 build. Preview server on 4173
  verified serving `index-B9LExE1Q.js`.

## 9. qa81 results

**16/16 assertions passed** — exit 0, ~19 min, log
`~/workspace/qa-shots/qa81-ws6.log`, console errors `[]`. The build is
byte-identical to WS5, so this is a re-verification of the same code on
the WS6 baseline, not a new code result.

| Check | Result |
|---|---|
| Draw calls at spawn | 265 |
| Contracts / encounters at spawn | both dormant |
| Enemies at spawn | 0 |
| Pedestrians / traffic | 18 / 14 |
| BEACON RUN | checkpoint (0.0, −92.1), delivery reached, cash 12500 ✓ |
| Shop water + outfit casual | ok; cash 12190 ✓ |
| Coins | 0 → 1 |
| Sprint | complete; cash 12340 ✓ |
| Garage | cash 4040; all 4 vehicles owned, Trailhawk-X selected ✓ |
| Range shot | shots 0 → 1 |
| Carbine | bought; mag 25 after 5 shots; palm 11, carbine 25 after switching back; cash 2840 ✓ |
| South Beach encounter | complete, +250 → 3090 ✓ |
| North Dunes encounter | complete, +250 → 3340 ✓ |
| Contract | active, remaining 3; draw calls 262 with contract active |
| Arrest cycle | reached busted: true; after respawn mode walk, wanted level 0 / heat 0 / clear ✓ |
| Draw calls at end | 126 |
| Console errors | `[]` |

## 10. Desktop and mobile screenshots / regression

- Desktop 1280×800 (WS3 script, log `ws3-ws6.log`): hub 10 rows, Esc
  resume, Settings 4 tabs, quality stepper Low → Medium → High,
  pedestrians Busy → Off, wanted toggle on/off, Controls 8 rows,
  statistics tiles match the live engine (0/10 · 0/5 · 0/10 · 1/4 ·
  $5,000), map 16 rows with all 7 pixel checks matching, zoom 100% →
  104% → 96%, pan changes transform, tower sidebar Beacon Tower X 0 ·
  Z −172, all four hub destinations open and return, top-bar map opens
  and returns, minimap tower/player pixels match, Lena portrait srcLen
  21422, palm-print buy $5,000 → $4,550 and duplicate →
  `already-owned` with cash unchanged, console `[]`.
- **Same-page reload line (known harness artifact, not a regression):**
  the script's final `page.reload()` shows quality `low` and
  pedestrians `busy` — the harness seed script re-runs on a same-page
  reload and re-seeds defaults. The proper fresh-page check
  (`vcs-ws3-persist.mjs`, log `ws3-persist-ws6.log`) passes exactly as
  in WS3/WS5: stored quality `high` / pedestrians `off` survive to a
  fresh page, engine tier `high`, console `[]`.
- Mobile 390×844 (WS3 script, log `ws3-mobile-ws6.log`): hub 10 rows;
  no horizontal overflow on hub, settings, statistics or map (all
  scrollWidth 390); stats tiles 0/10 · 0/5 · 0/10 · 1/4 · $5,000; map
  16 rows; Esc resumes the engine; console `[]`.
- Mobile draw calls (WS4 script, log `ws4-mobile-ws6.log`): **136 at
  spawn** (unchanged from WS5); no overflow at spawn, beach or hub;
  hub 10 rows; console `[]`.
- Cinematic regression: see §6 and
  `docs/ws6-character-and-cinematic-regression.md` — all 8 staged
  cinematics verified, console `[]`.
- Save/load: settings persistence verified via the fresh-page method
  (above); save integrity is covered by qa81's cash chain and the
  mission-board progression checks, both exact.

## 11. Console and WebGL status

- Console errors: `[]` in every WS6 harness run (qa81, cinematic
  lifecycle, cinematic staged v2/v3, WS3 desktop, WS3 persist, WS3
  mobile, WS4 mobile). No PAGEERROR. No WebGL errors.
- No missing assets. HUD, minimap, top bar, pause hub all render
  (verified in the regression runs).

## 12. Known limitations and deferred work

- 2.1 and 2.4 natural verification: **BLOCKED** — needs a human
  playthrough; short checklist delivered
  (`docs/ws6-natural-mission-completion.md`).
- Lena cinematic: **DEFERRED** — exact proposal in §4, awaiting
  Sachi's approval of the scoped guard carve-out.
- On-foot police officer: **DEFERRED** — feasible small workstream
  proposal in §5 (4th deferral of the full feature; the minimum
  viable version is now fully specified).
- Desktop FPS re-measurement on real hardware: still outstanding.
- Touch drive joystick + vehicle enter/exit at 390 px: still untested.
- 9.4 RangePanel fix in a live browser: still unverified.

## 13. Git push and merge details

- WS6 checkpoint commit: `5c645be` — "WS6 gameplay completion: mission
  checklist, Lena proposal, police proposal, cinematic regression" —
  on branch `ui/gta-vice-city-transformation`, 4 files changed,
  +621/−2. The 7 older untracked reports stayed untracked (WS3/WS4/WS5
  precedent).
- Branch pushed to GitHub: remote `ui/gta-vice-city-transformation`
  verified at `5c645be1e373febb33b4435771b6e413f6019adf`.
- Merge to `main`: `--no-ff`, commit `3f258c6` — "Merge WS6 gameplay
  completion into main".
- `main` pushed: remote HEAD verified at
  `3f258c6e1dc06ec599431cef00934273fb8c83a1` (was `b68b7c1`).
- No force-push, no history rewrite, no direct modification of
  production. No game code changed in WS6, so the deployed bundle is
  unchanged (see §14).

## 14. Vercel deployment details

- Push to `main` (`3f258c6`) triggered a Production deployment on
  branch main, commit `3f258c6` — **status Ready** (verified via the
  Vercel dashboard, 2026-11-23 ~22:14–22:16 IST).
- Deployment ID: `5SQihcvcup1ks1WBcqBdsqTrQ2cq` (Production, Current,
  Latest), by sachirokadia. Created Mon 23 Nov 2026 ~22:14 IST, build
  duration 7 s. No waiting, no redeploy, no settings changed.
- Deployment domain:
  `vice-city-stories-3r94r5dpe-sachirokadia23-3354s-projects.vercel.app`;
  production domain: `vice-city-stories-sigma.vercel.app`.
- WS6 changed no game code, so this deployment serves the same bundle
  as WS5 (`index-B9LExE1Q.js`) — expected and confirmed in §15.

## 15. Live production verification

- Live site https://vice-city-stories-sigma.vercel.app/ verified in a
  cloud browser (2026-11-23 ~22:14–22:16 IST):
  - Loading screen ("Loading the city…", 15% → 100%) progressed
    normally, no startup error, no blank screen.
  - Main menu shows "VICE CITY — Stories · free roam" with PLAY,
    CONTINUE (Lv 1 · $0), MISSIONS, SETTINGS, HOW TO PLAY, and a "NEW:
    Press P to pause" note.
  - PLAY enters the 3D world: sunset city, lit buildings, streets,
    street lamps, trees, a green bus, a red car, the player character;
    "BEACON RUN" job panel (Mara Voss, $500, objective 1/5); full HUD
    — cash $0, health 100, minimap, weapon "Palm 9, 12/60".
  - **Bundle served: `index-B9LExE1Q.js`** — exactly as expected,
    unchanged from WS5 (confirmed by direct request to
    `/assets/index-B9LExE1Q.js`, which returns the JavaScript).
  - No console errors observed; no error overlay. The 6 FPS reading is
    the known cloud-browser artifact (HUD shows "Low — battery saver
    (manual)"), not a defect.

## 16. Final commit

**Final commit:** `3f258c6` — "Merge WS6 gameplay completion into main"
(checkpoint `5c645be` on `ui/gta-vice-city-transformation`).

- Production is now `3f258c6` at
  https://vice-city-stories-sigma.vercel.app/, serving
  `index-B9LExE1Q.js` (unchanged from WS5 — WS6 changed no game code).
- Report update: §10–§11 (regression, console) and §13–§16 were added
  after the deploy; committed as a docs-only follow-up on main (does
  not change the deployed bundle — the production code remains
  `3f258c6`, bundle `index-B9LExE1Q.js`).
- Working tree after release: clean except the 7 older untracked report
  docs (WS1/3.2/Next Phase/sprint/WS1-final/WS1-natural/WS2), which
  were deliberately not committed.
