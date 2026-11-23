# WS6 — Character & Cinematic Regression

**Build:** `index-B9LExE1Q.js` (byte-identical to WS5 — no character or
cinematic code changed in WS6; this is a re-verification on the WS6
baseline).
**Method:** direct play with no mission active, QA hook
`cinematic.setTimeScale(10)` to reach shot index 1 (medium shot),
scene-graph probe of `staged-*` groups (name / position / material
colours vs the character palette), screenshot, skip, verify 0 staged
groups left. Logs: `~/workspace/qa-shots/ws6-cine{,2,3}.log`; shots in
`~/workspace/qa-shots/ui-ws6/`. Console errors `[]` in every run.

## Lifecycle (all 7 direct-play cinematics)

Each: started `true`, active `true`, skipped `true`, still active after
skip `false`.

| Cinematic | Character | Result |
|---|---|---|
| `cine-dockside-static` | Rico at the dockside | ✓ |
| `cine-tail-spin` | Vic at the north avenue | ✓ |
| `cine-dockside-trouble` | Rook at the dockside | ✓ |
| `cine-finale` | Silas at Beacon Tower | ✓ |
| `cine-cranes-nest` | Theo + June at the warehouse | ✓ |
| `cine-dead-drop` | Milo at the sprint start | ✓ |
| `cine-lena-dead-drop` | Lena at the boardwalk clinic (direct-play control) | ✓ |

## Staged-actor matrix

| Character | Staged group | Position | Palette check | Narration (shot 1) | Exit |
|---|---|---|---|---|---|
| Rico | `staged-rico` | (−124, 156) | jacket `9a5b1e` ✓ | "Rico Hale moves crates. He doesn’t open them." | 0 left |
| Vic | `staged-vic` | (64.5, −150) | jacket `7c5a3a` ✓ | "Vic Marino knows every car in the city. He doesn’t forget one." | 0 left |
| Rook | `staged-rook` | (2, 166) | jacket `3f4a2a` ✓ | "Rook Calloway. Freelancer. Amused. Always amused." | 0 left |
| Silas | `staged-silas` | (2, −160) | jacket `3b3b48` ✓ | "Silas Crane. Ex port-authority. Polite. Slow. Precise." | see note |
| Theo | `staged-theo` | (−86, 60) | jacket `57534e` ✓ | "Six hostiles, one ledger. Theo’s got the car ready." | 0 left |
| June | `staged-june` | (−88, 60) | jacket `6d5bd0` ✓ | staged together with Theo | 0 left |
| Milo | `staged-milo` | (135, 90) | jacket `b45309` ✓ | "Milo. Fourteen. Knows every shortcut and every rumour." | 0 left |
| Lena | `staged-lena` | (140, 30) | jacket `7f2d26`, hair `5e2f1a` ✓ | "Three drops delivered. She has seen what the packages do to people." | 0 left |

**Silas note (designed behaviour, not a defect):** `cine-finale` shot 4
opens the embedded choice dialogue `silas-finale`; `skip()` correctly
refuses while a dialogue is open (`Cinematic.ts:280`, Pattern B), so
the staged-actor probe shows the cinematic still active with 1 staged
actor left. The lifecycle run above confirms the same cinematic starts
and skips cleanly when the dialogue is not open, and the finale was
already verified end-to-end in release playthroughs. The later rows of
the staged probe run (Theo/Milo/Lena) were blocked by the still-active
Silas scene in that run — a harness sequencing limit, not a game
defect — and were re-run cleanly on their own (log `ws6-cine3.log`).

**Ferris:** no cinematic is registered for Old Man Ferris (one finale
dialogue node, never staged). Nothing to verify; not a failure. No
Ferris cinematic was created — there is no existing design or story
requirement for one.

**Framing:** medium shots are mostly rear three-quarter views by shot
design; palette + position + narration are the identity evidence. No
missing model, no wrong outfit or palette, no duplicate or blank
cinematic, no camera clipping observed. Every cinematic exits to
gameplay with control restored and 0 staged actors left (except the
Silas dialogue case above, which is by design).

**Verdict: all 8 staged cinematics verified — no regression since WS5.**
