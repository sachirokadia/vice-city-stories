# Phase 9F QA Checklist — Full Campaign QA, Polish and Stability

Scope: verify, polish, fix genuine defects only. No rebuild, no new
systems, no new story content, no push, no deploy.

## 0. Baseline (before any change)
- [ ] Working tree inspected; no git repo; production build passes.
- [ ] Save keys enumerated (13 keys, all `vice-city-stories.*.v1`).
- [ ] All 3 chapters, 10 story missions, 5 job missions, 2 contracts intact.

## 1. Complete campaign playthrough (real browser, Playwright)
- [ ] Fresh save: 1.1 FIRST LIGHT end to end (dialogue branches, cinematic, checkpoint, retry, $500).
- [ ] Fresh save: 1.2 DOCKSIDE STATIC end to end (cinematic, heat 10, evade, $750).
- [ ] Fresh save: 1.3 SIGNAL LOST end to end (embedded dialogue, 3 clues + optional garage clue, $600, Ch2 unlock).
- [ ] Ch1-complete save: 2.1 TAIL SPIN (follow spotted/lost, $1,000).
- [ ] 2.2 HOLD THE LINE (3 waves, beacon health, crew-jacket, $1,200).
- [ ] 2.3 DOCKSIDE TROUBLE take branch ($800 + $200, flags).
- [ ] 2.3 DOCKSIDE TROUBLE refuse branch (flags, 3.1 tip gating).
- [ ] 2.4 THE LONG WAY OUT (heat 45, hideout, outro, $1,500, Ch3 unlock).
- [ ] 3.1 DEAD DROP both branches (distances shown/hidden, $900).
- [ ] 3.2 CRANE'S NEST (2 nests, checkpoint retry, ledger, Vortex RS, $2,000).
- [ ] 3.3 SUNSET RUN ending Mara (heat 70, Vortex RS, deliver, finale, outro, $2,500).
- [ ] 3.3 SUNSET RUN ending June (same, ending June).
- [ ] Replay flip June -> Mara (cash +$2,500 once, ending flips, Vortex RS once).
- [ ] Sections played vs controlled-state setup documented honestly.

## 2. Story continuity and narrative polish (static audit + in-game)
- [ ] No placeholders, duplicate lines, broken text, missing speakers.
- [ ] No character refers to an event that has not happened yet.
- [ ] Earlier choices reflected in later dialogue (Rook, Mara/Rico flags).
- [ ] Conditional lines fire under the right conditions only.
- [ ] Mission intros explain the task; endings connect to the next mission.
- [ ] Both endings feel complete and distinct.
- [ ] Cinematic narration and dialogue do not contradict each other.
- [ ] Fixes are minimal wording changes only; no rewrites.

## 3. Mission clarity and fairness
- [ ] 1.2: hideout text says the tail must be lost before heat clears.
- [ ] 2.1: follow band + spotted/lost rules explained in dialogue/HUD.
- [ ] 2.2: wave progress + beacon health readable in HUD.
- [ ] 2.3: take/refuse decision + immediate consequences clear.
- [ ] 2.4: wanted level + escape conditions understandable.
- [ ] 3.1: known vs hidden drop locations distinction clear.
- [ ] 3.2: two locations, ledger collection, checkpoint communicated.
- [ ] 3.3: timer, heat, Vortex RS requirement, final decision communicated.
- [ ] Failure conditions understandable and fair; no artificial easing.

## 4. Endings, replay, rewards
- [ ] Both endings reachable through the intended decision.
- [ ] Both final cinematics + dialogues play.
- [ ] Both complete the campaign; ending persists after reload.
- [ ] Board shows the correct current ending.
- [ ] Replay finale consistent; switching endings duplicates nothing.
- [ ] Vortex RS + crew jacket stay owned; earlier progression intact.
- [ ] UI makes clear a finale replay replaces the displayed ending.

## 5. Save and reload audit (7 situations)
- [ ] (1) Fresh game. (2) Ch1 complete / Ch2 unlocked. (3) Ch2 complete / Ch3 unlocked.
- [ ] (4) Ch3 complete, June ending. (5) Ch3 complete, Mara ending.
- [ ] (6) Incomplete mission progress. (7) Optional choice flags already set.
- [ ] Defensive load: no cash lost, no duplicated rewards, no flags lost, no unlock regress.
- [ ] Reload does not restart cinematics/dialogues incorrectly.
- [ ] Malformed / missing optional fields do not crash (old-save + corrupted-key probes).
- [ ] Real user progress never touched (test saves only).

## 6. Checkpoints, activities, cleanup
- [ ] Retry from every checkpoint type (timer, defeat, defend, checkpoint).
- [ ] Abandon active story mission; fail + replay.
- [ ] Interrupt dialogue; skip cinematics at different points.
- [ ] Close panels during active gameplay.
- [ ] Walk/drive switching during relevant objectives.
- [ ] Arrest (BUSTED) and TAKEN DOWN during missions.
- [ ] Complete/abandon active encounters.
- [ ] One incompatible activity at a time; no stale timers.
- [ ] No enemy/tail car left active after cleanup; no duplicate rewards/events.
- [ ] Camera + controls restore; player/vehicle positions restore.
- [ ] Dialogue/cinematic events fire exactly once.

## 7. Performance and stability
- [ ] Draw calls: spawn, busy city, max active encounter, cinematic.
- [ ] Memory after repeated cinematic start/exit cycles.
- [ ] No undisposed staged character models; no listener accumulation.
- [ ] No hot-loop allocations of note; no console/page errors.
- [ ] No broken asset references; production build passes.

## 8. Mobile (390px) + desktop UI
- [ ] Main menu, Story Board + chapter progression, mission HUD.
- [ ] Dialogue panel + all choice nodes; cinematic letterbox + Skip.
- [ ] BUSTED + TAKEN DOWN screens; garage/shop/outfits/range/collect/sprint panels.
- [ ] Touch controls: walk, drive, dialogue, cinematics.
- [ ] No horizontal overflow, overlaps, unclickable buttons, clipped text.
- [ ] Known issue: cinematic header peeking below top letterbox bar on mobile.
- [ ] Visual identity preserved.

## 9. Existing-system regression
- [ ] 5 job missions, 2 contracts, pedestrians/traffic, police/wanted.
- [ ] Arrest + clean respawn; garage + upgrades; shop + outfits.
- [ ] Collectibles + sprint; range, Palm 9, Carbine; both encounters.
- [ ] Shared cash balance; mobile movement + driving.

## 10. Fix log (severity: Critical / High / Medium / Low)
- [ ] Every finding classified; Critical/High/Medium fixed in 9F.
- [ ] Low fixed only when safe and clearly worthwhile.
- [ ] No new features, chapters, characters, multiplayer, deps, or architecture changes.

### Findings (live, 2026-11-20)
- **GAME BUG #1 (Medium) — 2.2 HOLD THE LINE intro cinematic never plays.** `cine-hold-line` is defined and the 9E spec intended it as a mission intro, but the 2.2 `talk-mara-beach` objective in `StoryDefinitions.ts` has `dialogueId: 'mara-hold-line'` and NO `cinematicId`; the only intro trigger (`StoryCampaign.ts:672`) requires both. Every other story mission has an intro cinematic; 2.2 is the only one without. Live evidence: FRESH + CH1 final flags dumps both lack `saw-hold-line-intro` while every other `saw-*-intro` flag is present. **Direct live confirmation 2026-11-20 (cine22 probe, log `~/workspace/qa-shots/qa9f-cine22-probe.log`):** E at the beach marker (155,12) opened Mara's dialogue directly at node h1 (t+583 ms) with NO cinematic; `saw-hold-line-intro` false before and after. Positive control: E at Vic (62.5,-150) played `cine-tail-spin` (active t+1111 ms) and set `saw-tail-spin-intro`, so the probe detects intros. No console errors in either case.
- **GAME BUG #2 (Low) — replayed ending's outro does not record its `saw-ending-*` flag.** Repro: complete 3.3 with one ending, replay 3.3 with the other, read `vice-city-stories.story.v1` flags. Observed in BOTH playthroughs with roles reversed: FRESH (Mara first, June replay) → `saw-ending-mara: true`, `saw-ending-june` ABSENT; CH1 (June first, Mara replay) → `saw-ending-june: true`, `saw-ending-mara` ABSENT. The replay outro does play (active + ends, correct id) and the `ending-*` flags flip correctly and persist after reload. The `saw-ending-*` flags are only written by the two ending outros (shot 1 `setFlag` events, `StoryCinematics.ts:544,582`) and are never read for gating, so this is telemetry/continuity only. The event path (`Cinematic.ts` `enterShot` → `handleDialogueEvent` → `story.setFlag` → immediate save) is unconditional on paper, so the exact cause needs a live probe of the replay outro start.
- **Low — tail-spin narration vs route:** `cine-tail-spin` shot 1 says "Four hundred metres of road" but the follow `routeLength` is 500 m (`StoryDefinitions.ts`).
- **Low (cosmetic) — duplicate title:** Chapter 2 outro `cine-chapter2-outro` is titled 'THE LONG WAY OUT', same as the 2.4 mission intro cinematic.

## 11. Close-out
- [ ] Production build re-verified; preview server stopped.
- [ ] README Phase 9F section; MEMORY.md entry; goal log entry.
- [ ] Final report (15 items); STOP — no push, no deploy, no next phase.

## Results — §1 Complete campaign playthrough (2026-11-20)
- **FRESH run #5 — COMPLETE** (exit 0, ~37 min; log `~/workspace/qa-shots/qa9f-playthrough-FRESH.log`): all 11 missions true; CONSOLE: none. Cash 0 → 14550 (Mara 12050, replay June 14550). 1.1 checkpoint retry restored obj 4 with timeLeft 70. 1.2 evade REAL. 2.1 follow RESCUED (driven 57.8 m, hook at gap 33.6 m). 2.4 evade TIMEOUT (heat decayed for real 65 → ~40 in 'search'; completed via `setHeat(0)` CONTROLLED SETUP). 3.2 checkpoint retry restored defeat B. 3.3 Mara + replay June, ending persists after reload, Vortex RS owned once.
- **CH1 run #2 — COMPLETE** (exit 0, ~26 min; log `~/workspace/qa-shots/qa9f-playthrough-CH1.log`): all 8 true; CONSOLE: none. Cash 5000 → 17400 (2.1 6000, 2.2 7200, 2.3 8000 REFUSE, 2.4 9500, 3.1 10400, 3.2 12400, 3.3 June 14900, replay Mara 17400). 2.1 follow RESCUED via chase-mode fix (see below). 2.4 evade TIMEOUT (same as FRESH). 3.1 REFUSE verified: Milo gives exact spots, distances SHOWN (225 m). Replay Mara +2500 once, ending persists after reload, all 10 missions + all 3 chapters complete.
- **Test-script fix (not a game bug): follow rescue race.** `evaluateFollow` (`MissionTriggers.ts:103`) completes the follow only when `travelled >= 500 AND d <= 35 m`; the debug hook sets travelled but the objective stays open if the sedan drives away, and the tooFar clock is frozen once travelled = 500, so the mission sits in limbo (completable but unfailable). CH1 run #1 hit this: hook at 33.2 m, car stopped, sedan to 187 m, objective stuck for minutes, run cascaded. Fix in the script: after the hook, keep chasing the sedan at full throttle until the objective advances (the sedan parks at the warehouse). CH1 run #2: rescue at 33.2 m, objective advanced, 2.1 complete.
- **Controlled-setup fallbacks used (logged in-run):** 1.2 evade beach drive (car wedged; teleport to (150,75) + short drive); 2.4 evade `setHeat(0)` after the 240 s wait expired (both runs); 2.1 follow hook + chase (both runs); enemy kills via engine `damageEnemy` (aiming at ~2 FPS is not a real shooting test; wave/defeat progression, beacon health, rewards, flags exercised for real).

## Results — §5 Save audit (2026-11-20; log `~/workspace/qa-shots/qa9f-saveaudit.log`, exit 0)
- S1 fresh: Ch1 unlocked, cash 0, no cinematic/dialogue auto-start, board opens, no console errors.
- S2 Ch1 complete: Ch2 unlocked, cash 5750, flags kept, board opens, no errors.
- S3 Ch2 complete: Ch3 unlocked, cash 10150, 3.1 available / 3.2–3.3 locked, no errors.
- S4 June ending: ending june, persists after reload, cash 17050, all complete, no errors.
- S5 Mara ending: ending mara, persists after reload, cash 17050, all complete, no errors.
- S6 incomplete (2.1 current, not done): boots clean, 2.1 available, 2.2 locked, no auto-restart, no errors.
- S7 optional flags (took-rooks-job, mara-asked-package, rico-asked-watcher): preserved, no errors.
- M1 `{version:1}` only → fresh defaults (Ch1 unlocked), no crash. M2 unknown chapter-99 → ignored, normal board, no crash. M3 corrupted JSON → fresh defaults, no crash. M4 9D-era save (chapters record only chapter-1) → reconciliation derives Ch2 unlock from Ch1 completion, no crash. M5 current → unknown mission id → boots, def stays 1.1, no crash. M6 cash key missing → cash 0, story intact, no crash. M7 empty-string story key → fresh defaults, no crash. M8 missions null → no crash, board opens, playable from 1.1; cosmetic mismatch only: chapter-1 shows completed (from the chapters record) while all its missions show incomplete (missions null) — malformed-save-only display inconsistency, no data loss.
- No cash lost, no duplicated rewards, no flags lost, no unlock regress in any case; reload never restarts a cinematic or dialogue.

## Results — §7 Performance (2026-11-20; log `~/workspace/qa-shots/qa9f-perf.log`, exit 0; run 1 + re-run after a test-script fix)
- Spawn: **152 draw calls** (133k triangles, 898 meshes, heap ~20 MB) — matches 9E. Downtown (0,30): **247**; downtown (60,-30): 224. Avenue drive: 165–217 across samples.
- Max active encounter (2.2 defend wave 1, re-run): phone dialogue opened, Skip accepted, wave spawned in ~5 s real with 2 active defend enemies (alert → engage); **308 draw calls** (212k triangles) with the wave active. (Run 1's section 3 was invalid — the wave never started because the script pressed E once with no pre-E discovery wait; fixed with the robust pre-E wait + E retries and re-run once. The 150-call "wave" sample from run 1 was a wave-less beach and is discarded.)
- Cinematic 5 start/exit cycles: heap delta **0 MB**, mesh delta −7, staged meshes left **[]** (none leaked); activity 'none' after each reset. No console/page errors anywhere. FPS reads 1 throughout — headless SwiftShader software rendering, not a game measurement; draw calls are the meaningful metric.

## Results — §8 Mobile (390px) + desktop UI (2026-11-20; log `~/workspace/qa-shots/qa9f-mobile.log`, exit 0; screenshots in `~/workspace/vice-city-stories/qa/`)
- §1 cinematic header (KNOWN ISSUE — CONFIRMED LIVE): with the cinematic actually playing (run 1 measured gameplay, not a cinematic — bare E, overlay false; fixed with the pre-E discovery wait), top bar 0–44 px, bottom bar 800–844 px, cinematic title centred at 376–468 px, narration 768–790 px, Skip button 56–100 px, no horizontal overflow. But the gameplay HUD header ("VICE CITY / Stories · free roam", 2 FPS pill, "Low — battery saver" pill, 0/10 coin counter) stays visible DURING the cinematic and peeks below the top letterbox bar — visible in `qa9f-mobile-cinematic-header.png` (the "roam" line sits below the 44 px bar). The cinematic's own title is fine; the HUD header is the peeking element.
- §2 BUSTED at 390px: overlay appeared (full viewport 0,0–390,844, "BUSTED — The Vice City police have you in custody…"), no horizontal overflow, Respawn tapped, mode walk after dismiss, no console errors. **This is live corroboration of the cleanup-F resolution: the BUSTED overlay fires.**
- §3 TAKEN DOWN at 390px: mission started (intro cinematic played, Rook dialogue opened, Skip accepted, 3 hostiles active), player stood by them, but the takedown did NOT trigger within 180 s real (player health reads null — no accessor). The takedown path itself is proven on desktop (cleanup G: 'downed' at t+150 s + full cleanup); the 390px overlay layout remains untested. Not a game bug — a test time-box limit (enemy DPS at ~2 FPS sim rate is slow; desktop took 150 s).
- §4 panels at 390px: garage opens, no overflow, closes ✓. Outfits panel OPENS and renders cleanly (Street Hoodie worn, Casual $300, Beach $250, Night $500, Crew Jacket story reward, character preview, "Close outfits" button — see `qa9f-mobile-outfits.png`); the script's selector missed it (panel class has no "outfit") and Escape did not close it, so the still-open panel blocked the shop/range E presses — shop/range/sprint NOT tested (test-script artifact, not a game bug). No overflow anywhere measured, no console errors.
- §5 desktop menu (1280px): title "VICE CITY Stories", buttons Play / Story / Missions / Settings / About ✓ (`qa9f-desktop-menu.png`).
- qa85-mobile.mjs as-is re-run: NOT run in the wrap-up (the qa9f-mobile script covers its 390px ground plus the new checks).

## Results — §9 Existing-system regression (2026-11-20; log `~/workspace/qa-shots/qa81-9f.log`, exit 0, as-is)
- Spawn 152 draw calls; both contracts dormant; both encounters dormant; 0 active enemies; 18 pedestrians; 14 traffic. BEACON RUN complete (cash 12500). Shop water buy ok; outfit buy/select ok (cash 12190). Collectible coin 0→1; sprint complete (cash 12340). Garage purchases (cash 4040, Trailhawk X selected). Range shot fired; carbine bought (cash 2840). South Beach encounter complete (+250, cash 3090, cooling); North Dunes complete (+250, cash 3340, cooling). Contract active (remaining 3); draw calls with contract active 247. **Arrest cycle reached busted: true**; after respawn mode walk, wanted cleared (level 0, heat 0). Draw calls at end 112. Console errors: none.
- Known pre-existing flake reappears (not new): carbine mag reads 26 after 5 shots instead of 25 (also 26 after switching back).
- Cleanup-F corroboration: qa81's arrest cycle reaching BUSTED end-to-end confirms the BUSTED path works; the cleanup-F miss was the 180 s wait window (arrest reached 'surrendering' at t+165 s, 2.8 sim-s ≈ 19 s real to BUSTED).

## Results — §6 Checkpoints / cleanup (2026-11-20; log `~/workspace/qa-shots/qa9f-cleanup-ALL.log`, exit 0, ~22 min)
- A1 1.1 timer failure → checkpoint retry restores active obj 4, timeLeft 70 (60 − used + 15 bonus). A2 3.2 defeat checkpoint retry restores obj 4 (defeat B); nest A 0 ACTIVE / nest B 3 active after restore — the earlier "nestA: 3 alive" reading was dormant enemies (enemyStates() counts dormant as alive); the restore correctly deactivates the cleared group (StoryCampaign: "earlier groups stay deactivated"), and the FRESH playthrough already proved 3.2 completes by clearing only nest B after the retry. A3 beacon destroyed → failed 'objective-destroyed' → retry restores active defend, Beacon 100/100, Wave 1/3.
- B1 abandon 2.1 follow mid-run → story 'available', activity 'none', follow car parked (travelled 0), no active enemies, wanted clear. B2 abandon 2.3 defeat mid-fight → 3 active story enemies cleared to 0, activity 'none'; re-accept via E works; no double reward (cash stays 5200 — the $200 take bonus was granted once at first accept).
- C Esc in dialogue = skip-to-end BY DESIGN (DialoguePanel.tsx:28, skip button aria-label "Skip conversation (Escape)"): Esc at m1 closed the dialogue and accepted the mission (active, obj 2, timer running). The script's "reopen via E: false" is expected — there is no dialogue to reopen once the mission is active at a drive objective. No bug.
- D1 skip 1.1 cinematic at shot 1 → dialogue m1 opens, `saw-first-light-intro: true` (skip fires unfired shot events, per Cinematic.ts). D2 skip 1.2 cinematic at shot 2 → dialogue r1 opens, `saw-dockside-intro: true`.
- E board closed mid-mission → mission stays active; one-activity lock holds (try job / try story / select other story mission all refused, story still active after).
- F BUSTED during timed 1.1: **RESOLVED — wait-window artifact, not a game bug.** The arrest DID progress: snapshots show none (t+25–125 s) → 'prompt' (t+145 s) → 'surrendering' (t+165 s); the 180 s wait ended with the story still active (timeLeft 40) and no BUSTED overlay. The arrest state machine (`Arrest.ts:8,159-161`) is unconditional: surrendering lasts 2.8 SIM-seconds, then BUSTED. At the observed sim rate (timeLeft 44→41 over 20 s real ≈ 15%), 2.8 sim-s ≈ 19 s real, so BUSTED would fire around t+184 s — ~4 s past the window. The bust was in flight when the window closed. No crash, no console errors.
- G TAKEN DOWN during 2.3 defeat: observed at t+150 s real (player standing by the 3 hostiles) → story failed, reason 'downed'; cleanup snapshot shows enemiesActive 0, storyEnemiesActive 0, activity 'none', mode walk, engine running. Encounter cleaned up.
- All sections: CONSOLE: none (11 sections).
