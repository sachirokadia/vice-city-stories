# Phase 1 — Story-Lead Character Visual Identity: Final Report

**Project:** Vice City Stories (`~/workspace/vice-city-stories/`)
**Branch:** `ui/gta-vice-city-transformation` (from release `053e76d`, via Group 1 `d85d311`)
**Checkpoint commit:** `3141a78` — "Phase 1: story-lead character visual identity — Mara, June, Dana silhouettes + model-rendered dialogue portraits"
**Status:** VERIFIED — code committed locally. **No push, merge, deploy, or `main` change.**
**Date:** 2026-11-22

## What Phase 1 did

Mara Voss, June Park and Dana Cole got distinct, recognisable female silhouettes in the
existing 3D cinematics, and real portraits in the dialogue panels — rendered from their
actual configured 3D models, never from concept art. Kai is unchanged. No imported
models, no skeletons, no new animation dependencies. No story, dialogue, mission,
save-format or gameplay change of any kind.

| Character | Silhouette | Cinematic palette | Dialogue portrait |
|---|---|---|---|
| **Mara Voss** | Long dark hair, gold hoops, narrower shoulders, 0.98 height | Fuchsia `#c22e6e` (was teal `#1f8f7d`) | Long hair + fuchsia shoulders, teal border |
| **June Park** | Bob, dark skirt, narrowest shoulders, 0.96 height (shortest) | Violet `#6d5bd0` (unchanged) | Bob + violet top, violet border |
| **Dana Cole** | Bun, sunglasses, 0.99 height (tallest) | Navy `#1e3a5f` (unchanged) | Sunglasses + bun + navy, navy border |
| **Kai Reyes** | Unchanged | Unchanged | No portrait (player, 0 dialogue nodes) |

Designs live in a separate data-only config (`src/game/CharacterDesign.ts`), not in
hardcoded IDs in rendering code. Every design field is optional; omitting it builds the
original Kai rig exactly.

## 1. Dana — new vs old build

All three captures exist on both builds at identical steps (story board → marker
(−6, 33) → `accept` prompt → E → cinematic → Skip → dialogue → choices).

| Shot | New build (`ui-p1-after/`) | Old build `d85d311` (`ui-p1-before/`) |
|---|---|---|
| Cinematic | `dana-cinematic.png` — navy jacket, bun, next to Kai; subtitle "Dana Cole drives like the road owes her money. Tonight, it does." | `dana-cinematic.png` — same staging, male-proportioned rig, navy jacket |
| Dialogue | `dana-dialogue.png` — 64 px portrait, sunglasses + bun + navy, navy border; first line "Kai Reyes. You drive like a courier — careful, slow, polite. Tonight you drive like someone who's being hunted. Because you are." | `dana-dialogue.png` — blue "D" initial-letter medallion, no portrait |
| Choices | `dana-dialogue-choices.png` — 3 choices, speaker Dana Cole | `dana-dialogue-choices.png` — 3 choices, medallion |

Probe log (new build): `portrait: true, medallion: false, srcLen: 21618, speaker: "Dana Cole"`.
Probe log (old build): `portrait: false, medallion: true, srcLen: 0, speaker: "Dana Cole"`.

Dana's mission (`story-long-way-out`) unlocks after `story-dockside-trouble`, so the
capture seed completes Chapter 1 plus the Chapter 2 chain through dockside-trouble.
An earlier seed with Chapter 1 only left the mission locked — a harness seed error,
not a game defect; corrected and re-run.

## 2. Outfits — all five previews verified, old vs new

All five outfit previews were captured on both builds and checked against
`src/game/Outfits.ts`. Nothing changed between builds — that is the expected result:
Phase 1 does not touch outfits or `CharacterPreview`.

| # | Outfit | Price | Preview (new = old) | Notes |
|---|---|---|---|---|
| 0 | Street Hoodie | $0, worn now | `outfit-0.png` — grey hoodie, cream tee, dark cargo, gold chain | Kai's default, unchanged |
| 1 | Casual Streetwear | $300 | `outfit-1.png` — teal jacket, white tee, blue jeans, red sneakers; Buy — $300 | |
| 2 | Beach Day | $250 | `outfit-2.png` — coral open shirt, khaki shorts, bare legs, sandals; Buy — $250 | |
| 3 | Night Out | $500 | `outfit-3.png` — black blazer, white shirt, black trousers, no hood/chain; Buy — $500 | |
| 4 | Crew Jacket | story reward | `outfit-4.png` — Northgate teal jacket; "Earned in the story — hold the beach in HOLD THE LINE (Chapter 2)"; no Buy button | Unlock-only, never buyable |

Preview `aria-label`s were also verified per row
("Street Hoodie preview", "Casual Streetwear preview", "Beach Day preview",
"Night Out preview", "Crew Jacket preview"). Three outfit shots (1, 2, 4) timed out on
the first pass because the preview's own render loop saturates the headless
SwiftShader compositor; re-shot with a 60 s timeout — all five landed.

## 3. Kai — old vs new at identical angles

Same camera, same rotation convention, same spawn (0, 0, 8), both builds:

| Angle | Rotation | New build | Old build | Verdict |
|---|---|---|---|---|
| Front | `0` | `kai-front.png` | `kai-front.png` | Identical — grey hoodie, cream tee, gold chain |
| Side | `π/2` | `kai-side.png` | `kai-side.png` | Identical |
| Rear | `π` | `kai-rear.png` | `kai-rear.png` | Identical — hood, dark cargo |
| Three-quarter | `π/4` | `kai-threequarter.png` | `kai-threequarter.png` | Identical |

Only traffic and pedestrian positions differ between the shots (live world, not
a model change). Kai's model, palettes and all five outfits are unchanged.

## 4. Chapter 1 — story regression

**What passed on the new build (headless, real browser):**

- **qa81 GREEN** — all 16 assertions matched: draw calls 239 at spawn; BEACON RUN
  cash 12500; board unlock chain correct; shop water ok; outfit buy/select casual ok;
  cash 12190; coins 0→1; sprint complete, cash 12340; garage cash 4040, all 4
  vehicles owned, Trailhawk selected; range shot fired; carbine buy ok, **carbine
  magazine exactly 25** (the known flake did not trigger), palm mag 11, cash 2840;
  both encounters +250 (3090, 3340); contract active; arrest cycle → busted →
  respawn with heat cleared; draw calls at end 112. **Console errors: `[]`.**
  Log: `~/workspace/qa-shots/qa81-p1.log`.
- **Story opening regression (P1 harness)** — FIRST LIGHT (1.1), SIGNAL LOST (1.3)
  and THE LONG WAY OUT (2.3) each driven end to end on the new build: story board
  select → marker → `accept` prompt → E → cinematic → Skip → dialogue opens with
  the correct first line → choices render (3 each) → dialogue closes → mission
  cancelled cleanly. All three leads, desktop 1280×800 and mobile 390×844
  (touch context, `scrollWidth` 390, no overflow). **Zero console errors in every
  run** (`p1-after.log`, `p1-fixup.log`, `p1-before.log`, `p1-before-fixup.log`
  all grep-clean for PAGE ERROR).
- **Before-build baseline** — the same harness on `d85d311` confirms the old
  behaviour it replaces: medallion `true`, portrait `false` for all three leads,
  lifecycle counter absent (`null` — expected, it is new code).

**What did NOT pass — stated plainly, not hidden:**

- **Full campaign playthrough (CH1 mode: 2.1–3.3, June ending, replay-flip to
  Mara) stopped at 2.1 TAIL SPIN.** Log `~/workspace/qa-shots/qa9f-p1-ch1.log`:
  the follow-drive timed out after 234 s (sedan distance grew to 95.7 m, travelled
  523 m; cash stayed 5000 vs 6000 expected). Final verdict in the log:
  `RESULTS: {"2.1":false}`, `CONSOLE: none`.
- This is the **known headless limitation**, ruled by Sachi on 2026-11-22:
  2.1 is completable in the real game; the headless sedan pulls away at ~7% sim
  rate. It blocked the same playthrough at Phase 2 as well, and it is **not a
  Phase 1 regression** — Phase 1 touches no mission logic, vehicle speeds or
  difficulty, and the release-time CH1 run on the identical story code completed
  all 8 checks. The full campaign playthrough needs the real game (or a lucky
  headless retry) to re-confirm; nothing in this phase gives a reason to expect
  a different result there.

## 5. Portraits — verification, caching and cleanup

Portraits are rendered once per lead from the actual configured character model
(`CharacterPortrait.tsx`): one shared offscreen 256×256 WebGL renderer, the
character built with its design + palette, one frame rendered, `toDataURL('image/png')`,
character disposed immediately, result cached in a module-level `Map` per speaker.
The component is a plain `<img>` afterwards; a `portraitAsset` override can accept
approved portrait assets later. Dialogue layout, speaker names, text, typewriter
and choices are untouched.

| Lead | Portrait data URL length | Distinct image | Lifecycle (`window.__vcsPortraits`) |
|---|---|---|---|
| Mara | 23,158 chars | yes | `renders: 1, cacheHits: 296` |
| June | 22,574 chars | yes | `renders: 1, cacheHits: 378` |
| Dana | 21,618 chars | yes | `renders: 1, cacheHits: 412` |
| Mobile (Mara) | 23,158 chars (same render) | — | `renders: 1, cacheHits: 285` |

- **One real render per lead, ever** (per page load). Every later dialogue node —
  including the typewriter's per-tick re-renders — is a cache hit, not a re-render.
- **No renderer recreation per dialogue line.** The shared renderer is created once
  (lazily, on first portrait); the counter proves it.
- **No leaked WebGL contexts.** DOM canvas count stays 1 during dialogue (game
  canvas only; the portrait renderer is offscreen and never in the DOM) and returns
  to 2 after close — the second canvas is the minimap remounting with the HUD,
  not a leak. The portrait `<img>` leaves the DOM when the dialogue closes
  (`portraitInDom: false` after close in every probe).
- **Fallback works.** Old build: no portrait element, medallion shown
  (`portrait: false, medallion: true`). New build: portrait shown, medallion gone
  (`portrait: true, medallion: false`) for all three leads, desktop and mobile.
- **Known framing note (not a defect, a decision for Sachi):** at 64 px the face
  occupies ~40% of the frame height — the portraits read more as hair-and-shoulders
  than faces. A tighter camera (z 1.5 → ~1.15, lookAt y ~1.55) would fix it; not
  changed without her call.

## 6. Final status

- **TypeScript:** `npx tsc --noEmit` — clean.
- **Build:** `npm run build` — passes, `dist/assets/index-Curi-_jk.js`
  **1,172.15 kB / gzip 319.31 kB** (Group 1 was 1,169.24 / 318.23; +2.9 kB for
  the new code, +0.11 kB of it the lifecycle stats counter).
- **qa81:** GREEN — all 16 values matched (see §4), console errors `[]`.
- **Console errors:** none in any verification run (qa81, P1 harness after/before,
  fix-ups, CH1 playthrough — `CONSOLE: none`).
- **Modified files (checkpoint `3141a78`, 9 files, 581 insertions, 19 deletions):**
  - `src/game/CharacterDesign.ts` (NEW) — data-only design config
  - `src/components/CharacterPortrait.tsx` (NEW) — shared-renderer portrait cache
  - `src/game/Character.ts` — `createCharacter(track, design)`, hair/skirt/accessories
  - `src/game/StoryCharacters.ts` — Mara/June/Dana designs + Mara fuchsia palette
  - `src/game/CinematicStaging.ts` — passes `info.design` (ordering fix for the
    `info`-before-use TS2448 caught by the first build)
  - `src/game/Dialogue.ts` — additive `speakerId`
  - `src/components/DialoguePanel.tsx` — portrait-or-medallion render
  - `src/styles/global.css` — `.dialogue-portrait-img`
  - `docs/character-roster-and-3d-asset-audit.md` — the read-only audit this phase builds on
- **Checkpoint commit:** `3141a78` on `ui/gta-vice-city-transformation`, local only.
  No push, merge, deploy, or `main` change. The report file itself is committed
  separately as `docs/phase-1-character-visual-identity-report.md`.
- **Not started:** Phase 2, Phase 3, Lovable Group 2 (still awaiting her Group 1 review).

## Screenshots

- New build: `~/workspace/qa-shots/ui-p1-after/` — 20 files: `mara/june/dana-{cinematic,dialogue,dialogue-choices}.png`, `kai-{front,side,rear,threequarter}.png`, `outfit-0..4.png`, `mobile-dialogue.png`, `mobile-dialogue-choices.png`.
- Old build (`d85d311`): `~/workspace/qa-shots/ui-p1-before/` — same 20 files at identical angles and steps.
- Logs: `~/workspace/qa-shots/p1-after.log`, `p1-fixup.log`, `p1-before.log`, `p1-before-fixup.log`, `qa81-p1.log`, `qa9f-p1-ch1.log`.
- Harness: `~/workspace/qa-shots/vcs-p1-shots.mjs`, `vcs-p1-fixup.mjs`.

## Architecture notes (for the next phase)

- `DialogueState` had no speaker id — the additive `speakerId` field is the only
  dialogue-system change, and it is what lets the portrait resolve per speaker.
- `DialoguePanel` remounts per node (`key={nodeId}`), so a live per-mount WebGL
  portrait renderer would churn contexts; the cached-still design exists because
  of that remount, and the lifecycle counter (`window.__vcsPortraits`, same
  debug-handle pattern as `window.__vcsEngine`) is the proof it holds.
- The before-build preview worktree (`~/workspace/vcs-before/`, at `d85d311`) was
  removed after the comparison; the preview servers on 4173/4174 were stopped.
