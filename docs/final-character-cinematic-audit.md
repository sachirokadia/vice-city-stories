# Final character & cinematic audit — WS7

**Date:** 2026-11-23
**Baseline:** main `80a4573` (Lena release) + WS7 fixes (save system,
2.4 retry heat, 2.1 marker — none of which touch character or
cinematic code)
**Status: VERIFIED** — by the WS6 re-verification (all 8 staged
cinematics) plus this audit's code checks. The Lena cinematic is
re-run on the final build in Phase 4; the other 7 cinematics'
code is byte-identical to the WS6-verified build.

---

## 1. Cinematics — lifecycle (WS6 re-verification)

Method (WS6, logs `~/workspace/qa-shots/ws6-cine{,2,3}.log`, shots
in `~/workspace/qa-shots/ui-ws6/`): direct play with no mission
active, QA hook `cinematic.setTimeScale(10)` to reach shot index 1
(medium shot), scene-graph probe of `staged-*` groups (name /
position / material colours vs the character palette), screenshot,
skip, verify 0 staged groups left. Console errors `[]` in every
run.

Each of the 7 direct-play cinematics: started `true`, active
`true`, skipped `true`, still active after skip `false`.

| Cinematic | Character | Result |
|---|---|---|
| `cine-dockside-static` | Rico at the dockside | ✓ |
| `cine-tail-spin` | Vic at the north avenue | ✓ |
| `cine-dockside-trouble` | Rook at the dockside | ✓ |
| `cine-finale` | Silas at Beacon Tower | ✓ |
| `cine-cranes-nest` | Theo + June at the warehouse | ✓ |
| `cine-dead-drop` | Milo at the sprint start | ✓ |
| `cine-lena-dead-drop` | Lena at the boardwalk clinic (direct-play control) | ✓ |

## 2. Staged-actor matrix (WS6)

| Character | Staged group | Position | Palette check | Narration (shot 1) | Exit |
|---|---|---|---|---|---|
| Rico | `staged-rico` | (−124, 156) | jacket `9a5b1e` ✓ | "Rico Hale moves crates. He doesn't open them." | 0 left |
| Vic | `staged-vic` | (64.5, −150) | jacket `7c5a3a` ✓ | "Vic Marino knows every car in the city. He doesn't forget one." | 0 left |
| Rook | `staged-rook` | (2, 166) | jacket `3f4a2a` ✓ | "Rook Calloway. Freelancer. Amused. Always amused." | 0 left |
| Silas | `staged-silas` | (2, −160) | jacket `3b3b48` ✓ | "Silas Crane. Ex port-authority. Polite. Slow. Precise." | see note |
| Theo | `staged-theo` | (−86, 60) | jacket `57534e` ✓ | "Six hostiles, one ledger. Theo's got the car ready." | 0 left |
| June | `staged-june` | (−88, 60) | jacket `6d5bd0` ✓ | staged together with Theo | 0 left |
| Milo | `staged-milo` | (135, 90) | jacket `b45309` ✓ | "Milo. Fourteen. Knows every shortcut and every rumour." | 0 left |
| Lena | `staged-lena` | (140, 30) | jacket `7f2d26`, hair `5e2f1a` ✓ | "Three drops delivered. She has seen what the packages do to people." | 0 left |

**Silas note (designed behaviour, not a defect):** `cine-finale`
shot 4 opens the embedded choice dialogue `silas-finale`;
`skip()` correctly refuses while a dialogue is open
(`Cinematic.ts:280`, Pattern B), so the staged-actor probe shows
the cinematic still active with 1 staged actor left. The lifecycle
run confirms the same cinematic starts and skips cleanly when the
dialogue is not open, and the finale was already verified
end-to-end in release playthroughs. The later rows of the staged
probe run (Theo/Milo/Lena) were blocked by the still-active Silas
scene in that run — a harness sequencing limit, not a game defect
— and were re-run cleanly on their own (log `ws6-cine3.log`).

**Framing:** medium shots are mostly rear three-quarter views by
shot design; palette + position + narration are the identity
evidence. No missing model, no wrong outfit or palette, no
duplicate or blank cinematic, no camera clipping observed. Every
cinematic exits to a clean scene (0 staged groups left, except the
Silas Pattern B case above).

## 3. Lena cinematic (WS6 carve-out — re-run in Phase 4)

The Lena cinematic (`cine-lena-dead-drop`) plays while DEAD DROP
is active, through the approved guard carve-out: the activity guard
accepts only when the activity is `story` AND the HUD mission id
matches the cinematic's owning mission AND the current objective
is a `dialogue` objective whose `cinematicId` matches. Verified
end-to-end in WS6 (DEAD DROP: 3 drops, E at Lena, cinematic plays
while the mission is active, Esc → dialogue → complete, cash
5,000 → 5,900; job-active refusals, no double-play, checkpoint
retry, lifecycle all pass; qa81 16/16). Phase 4 re-runs this on
the final build. No rewrite without evidence of a defect.

## 4. Ferris — no cinematic (by design)

No cinematic is registered for Old Man Ferris (one finale dialogue
node, never staged). Nothing to verify; not a failure. No Ferris
cinematic was created — there is no existing design or story
requirement for one. Do not create one.

## 5. Duplicate playback, exit, control restore, cleanup

- **Duplicate playback:** per-run no-replay is by design —
  `cinematicPlayedRun` is cleared by `resetRun` (retry / replay /
  continue-after-complete) but NOT by `restoreCheckpoint`, so a
  mission's intro cinematic plays once per run and never repeats
  within that run. The second `openCinematic` while one is active
  returns `false` (verified in the Lena harness).
- **Exit:** every cinematic exits to a clean scene — 0 staged
  groups left (probe-verified for all 8 characters, except the
  Silas Pattern B case, which is a skip-refusal by design).
- **Control restore:** after a cinematic ends or is skipped, the
  engine hands control back to the player and the HUD returns
  (verified in the Lena lifecycle re-run: all 7 cinematics
  start/active/skip/clean; console `[]`).
- **Cleanup:** staged actors are disposed through
  `CinematicStaging.dispose()` — group removed from the scene,
  every tracked resource disposed. No staged group survives a
  cinematic in the probe runs.

## 6. Portraits

7 male portraits + Mara / June / Dana / Lena designs and portraits
were delivered in the character work (WS2). Portrait handles are
exposed for QA as `window.__vcsPortraits` /
`window.__vcsPortraitFor`. No portrait defect was found in WS6;
no portrait code changed since.

## 7. Palm Print outfit — code-verified (WS7)

`Outfits.ts` (`palm-print`): **$450**, turquoise palm-print open
shirt, cream trousers, gold chain, `shirtTexture: 'palm'` (the
shared palm texture is applied to jacket/sleeve via
`getPalmPrintTexture()`).

- **Price:** $450 (`Outfits.ts:114`).
- **Buy:** `GameEngine.outfitBuy` deducts through the mission
  manager's `spendCash`, pushes the id to `owned`, and saves.
- **Duplicate:** buying an owned outfit returns
  `{ ok: false, reason: 'already-owned' }` — no second charge, no
  duplicate entry. The panel surfaces the reason like the shop's.
- **Selection:** `outfitSelect` only accepts owned outfits,
  recolours the live protagonist at once
  (`player.applyOutfit(def)`), and saves. Selecting an unowned
  outfit returns `false`.
- **Unlock-only contrast:** the Crew Jacket (`crew-jacket`,
  price 0, `unlockOnly: true`) can never be bought —
  `outfitBuy` returns `{ ok: false, reason: 'unlock-only' }` —
  and is earned only by completing 2.2 HOLD THE LINE. The panel
  shows "Earn it in the story — hold the beach in HOLD THE LINE
  (Chapter 2)" instead of a Buy button.
- **Persistence:** `loadOutfitState` validates against known ids,
  forces the default hoodie owned, and only restores a `selected`
  outfit that is owned; `saveOutfitState` writes on every buy and
  select. Corrupt data falls back to the default outfit.
- **Panel:** `OutfitsPanel.tsx` shows OWNED / WORN NOW / FOR SALE
  / STORY REWARD states and the price; the detail view renders a
  live `CharacterPreview` in the outfit.

No outfit defect found. The Palm Print outfit was not live-verified
in a browser in this audit (code-verified only); a live buy/select
check is a one-minute manual step on the release build and is
listed as optional in the closeout report.

## 8. Known open items (character / cinematic)

- **No protagonist aim pose** (known, WS1 finding 1.2) — the
  protagonist has no aim pose for the shooting range. Cosmetic;
  deferred, not release-blocking.
- **Desktop FPS re-measurement on real hardware** — still
  outstanding; headless SwiftShader FPS (~1–4) is not a
  measurement. Sachi's earlier real-hardware record: spawn 60 /
  downtown 55 / beach 60 (AMD Radeon).
