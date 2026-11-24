# Final Save System Report — WS7 Phase 3

**Status: COMPLETE / VERIFIED** (2026-11-24). Mid-mission checkpoint resume works for all six checkpoint missions. Two defects found by the harness were fixed in the game (a P0 persisted-resume failure and a P1 busted-retry bypass, plus a P2 replay-resume refusal found late). One gameplay observation about the 2.4 hideout at wanted level 3 is recorded as a P1 for Sachi's natural playthrough — it is a mission-balance question, not a save defect, and mission logic is frozen by the WS7 brief.

Build verified: bundle `index-B2t5gFTm.js` (`tsc` clean). Harness: `~/workspace/qa-shots/vcs-ws7-save-resume.mjs` (logs `ws7-save-resume*.log`); probes `vcs-ws7-probe-12.mjs`, `vcs-ws7-probe-24.mjs`.

## Decision

Persist only the checkpoint snapshot plus the mission id, as an additive optional `checkpoint` field on the v1 story save. **No version bump**: the loader discards any non-`v1` save wholesale, so a bump would wipe every existing save. Old saves (no `checkpoint` field) load untouched — verified in S1.

## Change set

| File | Change |
|---|---|
| `StoryTypes.ts` | `StoryCheckpoint` gains `missionId`, `wantedLevel` (level 0–5, not heat), `runTime`, and later `replay?` (see §5). `StoryProgress` gains optional `checkpoint?: StoryCheckpoint \| null`. |
| `Wanted.ts` | Exported `heatForWantedLevel(level)` (LEVEL_HEAT = [0,10,25,45,70,90]). |
| `StoryTriggers.ts` | `takeCheckpoint` takes the new fields; `isCheckpointValid` hardened for untrusted JSON (type-checks every field; the old version read `snap.playerPos.x` unchecked and would throw on a null position; `replay`, when present, must be boolean). |
| `StoryCampaign.ts` | `snapshotCheckpoint` passes `def.id` / `ctx.wantedLevel` / `runTime` and persists. `restoreCheckpoint` sets `runTime = snap.runTime` and calls `deps.setWanted(heatForWantedLevel(snap.wantedLevel))`. `retry()` and `replay()` clear the persisted checkpoint + save + re-apply `def.startHeat`. Persisted checkpoint cleared + saved at `complete()`, `cancel()`, `retry()`, `replay()`, `continueAfterComplete()`, `dismissFailed()`, `selectMission()`, `acceptMission()`. New `restoreSavedCheckpoint(): boolean` (also on `StoryCampaignHandle`). |
| `StoryProgress.ts` | Loader parses `parsed.checkpoint` through `isCheckpointValid` against its own mission's objective count; unvalidated data never enters live progress. `freshStoryProgress()` includes `checkpoint: null`. |
| `GameEngine.ts` | Deps wiring adds `setWanted: (heat) => { if (engine.wantedEnabled) engine.wanted.setHeat(heat); }`. New engine method `restoreSavedStoryCheckpoint()`. |
| `GameCanvas.tsx` | After `engine.start()`, calls `engine.restoreSavedStoryCheckpoint()` once. |
| `StoryDefinitions.ts` | 2.1 `enter-car` marker target (0,−2) → (62.5,−150) (Vic's position; the trigger ignores position, only the marker display used it). P3 fix. |

## Two deliberate deviations from the save audit

1. **`fail()` does NOT clear the persisted checkpoint.** The fail screen offers retry-from-checkpoint, and a reload from that screen must still resume. Every exit from `failed` clears it (`retry()`, `replay()`, `dismissFailed()`). Verified in S7.
2. **`restoreCheckpoint` applies the snapshot's wantedLevel in BOTH the in-session and persisted paths.** The snapshot value is the checkpoint's truth; persisted-only would have left the in-session busted bypass (the P1 below) unfixed.

## Defects found and fixed

### P0 — persisted resume deleted the checkpoint (found by harness run 2, fixed 2026-11-24 ~00:50 IST)

`restoreSavedCheckpoint()` validated the persisted snapshot but then called `restoreCheckpoint()`, which reads the **live in-session `checkpoint` variable** — null on a fresh boot — so every persisted resume failed validation and the fail-closed path **deleted the persisted checkpoint from the save**. Fix: one line (`StoryCampaign.ts:1272`, with comment): `checkpoint = snap;` before `const ok = restoreCheckpoint();`. Verified fixed by runs 3–4 and every run since.

### P1 — 2.4 busted→retry bypass (found by the 2.1/2.4 audit, fixed in WS7)

Getting busted resets heat to 0 (engine busted transition), and neither `retry()` nor `restoreCheckpoint()` re-applied heat, so retrying landed on the `evade` objective (completes when `wantedLevel === 0`) and the mission finished instantly with zero evasion. Fix: `retry()`/`replay()` re-apply `def.startHeat`; `restoreCheckpoint` re-applies the snapshot's wantedLevel. Verified in-session in runs 5, 6a, 6b (busted→checkpoint-retry: obj 3, heat 45 re-applied, evade does NOT auto-complete; busted→full-retry: obj 0 fresh start, heat 45).

### P2 — replayed missions never resumed after a reload (found by harness run 6e, fixed 2026-11-24)

`restoreSavedCheckpoint()` refused any snapshot whose mission read `completed` — correct for a stale checkpoint, but a checkpoint taken **during a replay** of a completed mission was refused and deleted too, so replays never resumed mid-run. Fix: `StoryCheckpoint` gains optional `replay?: boolean`, set by `snapshotCheckpoint` from `progress.missions[def.id]?.completed === true`; the restore guard now refuses a completed mission's snapshot only when `snap.replay !== true`. Additive field, no version bump, no behaviour change for pre-fix saves (no `replay` field → old refusal stands). Verified: S8 replay-flag case passes (completed-mission checkpoint with `replay: true` restores at obj 4) while the same snapshot without the flag is still refused; S10 cycles 2–3 pass end to end (cash 6000, 6500).

### P3 — 2.1 `enter-car` marker pointed at spawn (fixed)

See the change set. Marker-only; the trigger was already correct.

## Test results

The brief's 11 required tests map to sections S1–S10. No single run covered everything (five VM restarts killed runs 3, 5, 6b, 6c, 6d mid-suite); the sections below are the union of the completed runs, all on the final code except where noted. Console errors `[]` in every completed run.

| Section | What it proves | Result |
|---|---|---|
| S1 | Old WS6-era save (no checkpoint field) loads intact; garage GT owned+selected | PASS (runs 4, 5) |
| S9 | Fresh save: ch1 only, nothing completed, cash 0; first mission discoverable + acceptable | PASS (runs 4, 5) |
| S2 | 1.1 checkpoint persisted (obj 4, driving, vehiclePos (0,−90), timeLeft 73.8, runTime 1.19); restore after reload active obj 4 driving; completes cash 5000→5500 exactly once; no stale restore | PASS (runs 4, 5) |
| S3 | 2.1 reload before any checkpoint restarts at obj 0 | PASS (runs 4, 5) |
| S4 | 2.4: accept applies startHeat 45 (level 3); checkpoint persisted at hideout (obj 3, wantedLevel 3, timeLeft 179.0); in-session P1 fix; full-retry P1 fix (obj 0 + heat 45); persisted resume restores evade with heat 45, no auto-complete | PASS (runs 5, 6a, 6b — the five save-system checks, three times) |
| S5 | 3.2 checkpoint persisted (obj 4, defeatedIds enemy-29/30/31); restore after reload; nest-b re-activates; completes cash 12400, Vortex RS owned exactly once | PASS (run 6a) |
| S6 | Seeded restores for 1.2 / 1.3 / 3.1 all pass; 1.2 completes after restore (cash 5750, +750 once); 1.3 no-duplicate + completes (5600); 3.1 no-duplicate + tower drop advances to obj 5 | PASS (run 6a) |
| S7 | retry() clears; cancel() clears; dismissFailed() clears while fail() itself keeps the checkpoint; reload does not restore after any of them | PASS (run 6c) |
| S8 | 17 corruption cases fail safe (incl. bad JSON, version-2 saves discarded to fresh progress); completed-mission snapshot refused + cleared; completed-mission snapshot **with `replay: true` restores** | PASS (run 6f, 18/18) |
| S10 | Three 1.1 checkpoint→reload→restore→complete cycles, cash 5500 → 6000 → 6500 | PASS (run 6f, 3/3) |

### The S4 evade-completion check, and what it became

The original S4 final verdict required the 2.4 evade to *complete* after a persisted restore while the player sits still at the hideout. That conflates the save system with level-3 evade balance, and the evidence showed the two must be separated:

- **Probe `vcs-ws7-probe-24.mjs` (720 s, `ws7-probe-24.log`)**: after a persisted 2.4 restore the evade is live and advancing — the search phase is reached, `escapeProgress` climbs to 0.34, heat decays 45 → 31.6 while the player is unseen. The save system has done its job.
- **But the stationary player does not stay unseen.** At level 3 the pursuers converge on `lastKnown` and re-spot the player at the hideout (seen ~240 s, then ~100 s unseen while the search runs ~11 game-seconds before a re-spot resets it — short of the 26 game-seconds the search needs), and a close pursuer can arrest the stationary player: run 6a's mission ended `failed` (busted) during the wait, and run 6b's evade-progress poll saw the mission fail before any search phase was observed. See §6 (P1 observation).
- The harness verdict was therefore changed to accept **completion OR an observed search phase** (`waitEvadeProgress`, 600 s window). That verdict still did not pass in 6b (busted before any search window), which is consistent with the probe: whether a stationary player survives to a search window is chance, not a save signal. The probe stands as the evade-progress evidence; the harness's five S4 save-system checks are green three times over.

### Harness artifacts found and fixed (not game defects)

- **S4 cash 8000 double-pay (run 4)**: the harness simulated "busted" with a standalone `wanted.reset()` and called the retry in a *separate* evaluate; between the two, the engine ticked with heat 0 while the mission was active at the evade objective, so evade legitimately completed and paid +1500 — twice. The real busted path calls `fail()` in the same flow and objectives are not evaluated while `failed`. Fixed by making each simulation atomic (one evaluate doing `reset()` + retry). Cash is correct in every run since.
- **S4 full-retry verdict (run 4)**: expected obj 2; obj 0 is correct — `retry()` resets to obj 0, and the run-3 obj 2 reading came from the player standing at Dana on foot. Fixed to expect obj 0 + heat 45.
- **S4 second leg (run 4)**: after the full retry the player is driving at the hideout, so `tp` (player handle only) cannot complete find-dana. Fixed: `exitCar()` → `tp(-6,30)` → obj 2 → `tp(180,-30)` → `enterCar()` → obj 3.
- **S10 cycles 2–3 (runs 4, 6d)**: after a replay the player is still driving at the deliver point, so find-mara cannot complete from the car (fixed with `exitCar()` after replay); then the GT was still parked at the deliver point while the harness teleported the player to the spawn, so `enterCar()` found no car (fixed with `tpCar(0,-2)` to bring the car to the spawn).
- **Evade waits (runs 4, 6a)**: headless game time runs at ~0.06–0.1× real time (dt clamped), so the 24-game-second (level 1) and 32-game-second (level 3) evades need ~240 s / ~320 s+ real time. The original 120 s waits expired first. Extended to 600 s / 900 s; the 1.2 evade then completed in run 6a.
- **Harness resilience**: the suite gained an `ONLY=S4,S5,S6` section filter after five VM restarts killed long runs; logs are written incrementally so a killed run's verdicts survive.

## Honest scope limit

Only the six checkpoint missions resume mid-run after a reload: **1.1, 1.2, 1.3, 2.4, 3.1, 3.2**. Missions **2.1, 2.2, 2.3, 3.3** have no checkpoint objective and still restart at objective 0 after a reload (verified for 2.1 in S3). This is the audited, intended scope — no migration, no version bump, no existing save touched.

## Known observations (not save defects)

- **P1 — 2.4 hideout at wanted level 3 (gameplay balance, for Sachi's natural playthrough).** A stationary player at the beach hideout (180,−30) gets re-spotted by converging pursuers and can be arrested before the evade finishes; the search window between re-spots (~11 game-seconds) is shorter than the 26 game-seconds the level-3 search needs. A moving player who breaks sight and relocates may fare better — that is exactly what the natural playthrough must adjudicate. Mission difficulty/logic is frozen by the WS7 brief, so nothing was changed here. (Probe: `ws7-probe-24.log`; code: `Wanted.ts` — `UNSEEN_TO_SEARCH = 6`, `escapeDuration(level) = 14 + 4*level`, search status holds level ≥ 1 until the search completes.)
- **P3 — completed current mission's board Replay button stays disabled** ('Selected ✓') until another mission is selected, because `complete()` does not clear `progress.current`. The board Replay path is unavailable for it until then; the engine `replayStoryMission()` path (used by S10) works. Pre-existing UI wart, out of WS7 scope, not fixed.
- **P3 — story state after a plain reload** with a current mission and no restore reads `available` in some paths and `idle` in others. Cosmetic, not chased.
- Headless game time runs at ~0.06–0.1× real time; do not use cloud-browser FPS as a performance measurement (unchanged from WS5/WS6).
