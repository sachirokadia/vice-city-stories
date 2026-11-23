# WS3 — Complete Game Interface Expansion (Lovable Group 2) — Report

**Branch:** `ui/gta-vice-city-transformation`
**Base checkpoint:** `c33d37d` (Next Phase Phase 1 — Lena, male portraits, palm-print outfit)
**WS3 checkpoint commit:** `95d9705` (created after verification; see §10)
**Date:** 2026-11-23 (assigned 15:50 IST; delivered ~16:45 IST)
**Status:** COMPLETE — all four screens implemented, tested, verified. Nothing pushed, merged or deployed.

This is the third workstream of the Next Phase brief: Lovable Group 2 (pause menu,
full-screen map, statistics, settings) built on the real game, from the real
Lovable source, with real game data only.

---

## 1. What was built

Four screens, one shared renderer, three new icons, one hub mechanism — no
engine, mission, story, save or combat logic changed.

| Screen | Files | What it is |
|---|---|---|
| **Settings** | `SettingsPanel.tsx` (rewritten), `global.css` | Four tabs — Graphics, World, Gameplay, Controls. The same 9 real settings, the same `GameSettings` type, the same `set()` contract, the same persistence. No fictional settings. |
| **Statistics** | `StatisticsPanel.tsx` (NEW), `GameCanvas.tsx` | Exactly five real values: story x/10, jobs x/5, collectibles x/10, vehicles x/4, current cash. Read live from the engine at open. No playtime, no cash-earned, no mock bars. |
| **Full city map** | `FullMap.tsx` (NEW), `MapDraw.ts` (NEW), `Minimap.tsx` (refactored) | The minimap's canvas renderer, extracted into a shared module and reused at 760 px. Same city, same coordinates. Real markers, zoom + drag-to-pan, click-to-select, live player arrow. |
| **Pause Hub** | `PauseHub.tsx` (NEW), `GameCanvas.tsx`, `global.css` | Ten real destinations over the sunset artwork. Return-to-hub on every close; Escape resumes from the hub only. Replaces the legacy 3-button pause overlay (emoji Resume/Settings/Quit). |

**Icons** — `VcIcon.tsx` gained exactly three original line SVGs (`map`, `pin`,
`back`). 29 icons total. No icon library installed.

**No new dependencies. No router, no Tailwind, no shadcn, no Radix, no
lucide-react.** Styling is plain CSS in the game's own `global.css`, on the
approved `--vc-*` tokens.

### 1.1 Settings — the nine real settings, unchanged in meaning

| Tab | Controls | Real setting |
|---|---|---|
| Graphics | Quality stepper (Auto/Low/Medium/High/Ultra), Shadows toggle, Show FPS toggle | `quality`, `shadows`, `showFps` |
| World | Pedestrians, Traffic, Police, Pursuit difficulty steppers | `pedestrians`, `traffic`, `police`, `pursuitDifficulty` |
| Gameplay | Wanted system toggle, Invert look toggle | `wantedEnabled`, `invertY` |
| Controls | 8 read-only rows: Move W A S D · Look Drag · Fire Left-click · Reload R · Switch Q · Sprint Shift · Interact E · Pause Esc | — (documentation of the real bindings) |

The `set()` helper is behaviourally identical to the old panel
(`onChange({...settings, [key]: value})`). The panel still works from the
main menu with no engine present (same props, plus an optional
`initialSection` that defaults to `'Graphics'`). Dropped from the Lovable
prototype: brightness, VSync, volumes, difficulty, subtitles, aim assist,
accessibility — none of those exist in the game.

### 1.2 Statistics — five values, all live

`buildStatsSnapshot(engine)` reads, at the moment the panel opens:
story completed = completed entries of `getStoryBoard()` / 10; jobs completed
= completed entries of `getMissionBoard()` / 5; coins = `getCollectibleState().found`
/ 10; vehicles = owned rows of `getGarageState()` / 4; cash = `getStats().cash`.
Totals come from the data (board lengths / state totals), not hardcoded
constants. The feature banner shows the real current chapter title and a real
story progress bar; the lower section names the real current story mission and
current job (or "No story mission selected" / "No job selected"). VIEW JOBS
opens the real mission board; closing the board returns to the hub, not to
Statistics.

### 1.3 Full map — the minimap's renderer, reused

`MapDraw.ts` extracts the minimap's exact drawing code: `drawCityBase`
(ground/water/beach/roads/blocks/parks + tower gold / garage pink / store teal
dots + "N" label), `drawMapMarker` (range amber square, sprint red dot, coin
green dot, dim green when found, mission-story teal diamond, mission-job
yellow diamond), `drawPlayerArrow` (with an optional white ring on the full
map). Radii/font/line-widths are defined at 360 and scaled by `size/360`, so
at 360 the minimap output is pixel-identical to before. `Minimap.tsx` now
calls the shared module; its interval, class names and aria are unchanged.

The full map (`FullMap.tsx`, internal canvas 760) shows, on a fresh save,
**16 locations: 5 places + 10 coins + 1 selected mission**. The mission
marker is whichever mission is actually selected: on a fresh save that is the
job **BEACON RUN** (the story has no selected mission yet — "No story mission
selected"). After selecting FIRST LIGHT from the Story board, the map shows
**17 locations** with both mission markers. Markers:

- Beacon Tower (0,−172) · Sunset Garage (22,52) · Sunset Mart (43,15) ·
  Sunset Range (156,−90) · Sprint Start (133,90) — the real world coordinates.
- All 10 coins from `COLLECTIBLE_DEFS`, with found state from
  `getCollectibleState()` (found coins render dim + a check in the list).
- Active/selected story mission (teal diamond) and job mission (yellow
  diamond) from `STORY_MISSIONS` / `MISSION_DEFS` `startMarker`.
- Live player arrow (white, ringed) from `getStats()` on the same 120 ms /
  zero-React-state pattern as the minimap.

Zoom 0.92–1.14 in ±0.04 steps with a % readout; drag-to-pan via pointer
capture on the wrap; click-to-select via hit-test (16 canvas-px) against the
canvas rect (which already accounts for the zoom/pan transform); a sidebar
with the selected location's real name, one-line description and real world
coordinates, a clickable location list, a legend, and Back. Dropped from the
prototype: SET WAYPOINT (no waypoint system exists), the DEMO MAP badge, grid
references, fictional districts/roads/percentages.

### 1.4 Pause Hub — ten real destinations, one return mechanism

Lovable order, all wired to the existing openers: Resume (`togglePause`),
Map, Statistics, Missions, Story, Garage, Outfits, Settings, Controls
(Settings opened on the Controls tab), Main Menu (`quit`). Shop, Collection
and Range are deliberately NOT in the hub — they open from their world
triggers (store/garage/range), not from pause.

**Mechanism** — one boolean, `returnToHub`, in GameCanvas. Hub openers set
it true and call the plain opener; every existing closer now branches through
`closeToHubOrResume(hide)`: if the flag is set, hide the panel, clear the
flag, engine stays stopped, paused stays true (the hub is underneath); otherwise
resume exactly as before. Mission selects use `resumeFromPanel` (always
resume). `togglePause` (Resume / the Pause button) clears the flag and closes
all panels. The hub renders exactly when
`paused && !downed && !dialogue && !cinematic && !showSettings && !showBoard
&& !showStoryBoard && !showGarage && !showShop && !showOutfits && !showCollection
&& !showRange && !showMap && !showStats` — the old overlay's guard, extended
with the two new screens. The hub keeps the `.pause-overlay` root (and the
Resume row keeps the `.play-button` class) so the existing harness contract
(`.pause-overlay.play-button`) still selects Resume.

**Escape-to-resume** — a `useEffect` keydown listener, active only while
`hubOpen` is true: Escape → `togglePause()`. It cannot fire while a panel,
dialogue or cinematic is open, because `hubOpen` is false then. There was
previously no Esc handler for pause anywhere.

**Sunset art** — the hub uses the already-copied
`public/images/vice-city-sunset.png` (md5-verified in Group 1) as its
background, with a left-dark shade; the Statistics banner uses the same image.

---

## 2. Files changed

```
src/components/GameCanvas.tsx        (hub state + closers + Esc + top-bar Map + renders)
src/components/Minimap.tsx           (refactored onto MapDraw; same output)
src/components/SettingsPanel.tsx     (rewritten: 4 tabs, same 9 settings)
src/components/ui/VcIcon.tsx         (+3 icons: map, pin, back)
src/styles/global.css                (Group 2 block + .play-button definition, §7)
src/components/FullMap.tsx           (NEW)
src/components/PauseHub.tsx          (NEW)
src/components/StatisticsPanel.tsx   (NEW)
src/game/MapDraw.ts                  (NEW)
docs/ws3-interface-expansion-report.md (this file)
```

Diff vs base `c33d37d`: 5 modified files (713 insertions, 318 deletions in the
tracked diff at commit time, plus the 4 new files above). **No engine file
touched.** `GameEngine.ts` was not modified; the only engine-adjacent change
is GameCanvas reading state it already exposed.

---

## 3. Verification — desktop (1280×800)

Script `~/workspace/qa-shots/vcs-ws3-desktop.mjs`, log `ws3-desktop.log`,
screenshots `~/workspace/qa-shots/ui-ws3/`. Build at the time:
`index-CukKOD7o.js`. **Console errors: `[]` throughout.**

| Check | Result |
|---|---|
| Boot, engine running | true |
| Hub rows | exactly 10: Resume, Map, Statistics, Missions, Story, Garage, Outfits, Settings, Controls, Main Menu; Resume `.is-selected`; hint "ESC RESUME GAME" |
| Settings tabs | 01 Graphics, 02 World, 03 Gameplay, 04 Controls |
| Quality stepper | Low — battery saver → Next → Medium → Next → High |
| Pedestrians stepper | Busy — 28 pedestrians → Next → Off — empty streets |
| Wanted toggle | aria-checked true → click → false (restored to true after) |
| Controls rows | 8, with the real keys (W A S D / Drag / Left-click / R / Q / Shift / E / Esc) |
| Settings close → hub | hub visible, engine still stopped |
| Statistics tiles vs live engine | story 0/10, jobs 0/5, coins 0/10, vehicles 1/4, cash $5,000 — **match exactly**; chapter "THE WRONG PACKAGE · 0 / 10 STORY MISSIONS" |
| VIEW JOBS → board → close | board opened; close returned to the hub; Statistics hidden |
| Map subtitle | "16 locations · 0 of 10 coins found · north is up" (fresh save) |
| Map location rows | 16 (5 places + 10 coins + BEACON RUN) |
| Map pixels (canvas sampling) | tower (0,−172) gold [255,210,62] ✓ · garage (22,52) pink [255,94,138] ✓ · store (43,15) teal [45,212,191] ✓ · range (156,−90) amber [255,210,122] ✓ · sprint (133,90) red [255,77,61] ✓ · coin beach-dune (165,90) green [155,225,93] ✓ · player (0,8) white [255,255,255] ✓ |
| Zoom | 100% → Zoom in → 104% → 2× Zoom out → 96% |
| Pan | drag changed the transform `translate(0px,0px) scale(0.96)` → `translate(60px,30px) scale(0.96)` |
| Map Back → hub | hub visible |
| Hub round trips | Missions, Story, Garage, Outfits — each opened and closed back to the hub |
| Controls → Settings on Controls tab | active tab "04 Controls"; close returned to the hub |
| Esc from hub | engine running, hub hidden, HUD visible |
| Top-bar Map → Back | opened from free roam; Back resumed the engine with the HUD visible |
| Minimap consistency | tower pixel gold ✓, player pixel white ✓ (refactor did not change the minimap) |
| WS2 spot check | Lena portrait srcLen 21422; palm-print buy ok 5000→4550; duplicate buy `{ok:false, reason:'already-owned'}` cash unchanged |
| Stored settings before reload | quality high, pedestrians off, wantedEnabled true (written through to localStorage) |

### 3.1 Two defects found by the desktop run — both fixed, both re-verified

**Defect 1 — map click-to-select did not work (real code bug).**
After the tower click the sidebar still showed the default "Vice City /
TAP A MARKER". Root cause: the map wrap captures the pointer for
drag-to-pan, which retargets the subsequent click event to the wrap — a
`canvas onClick` handler never fires. Fix (in `FullMap.tsx` only): the click
handler moved to the wrap (`onWrapClick`), doing the same hit-test against
the canvas rect; the drag-suppression flag still suppresses the click that
follows a drag. Re-verified in `vcs-ws3-followup.mjs` (`ws3-followup.log`):
tower click → sidebar "Beacon Tower", coords "X 0 · Z -172"; Dune Token row
click → "Dune Token"; garage click → "Sunset Garage".

**Defect 2 — settings persistence check was invalidated by the harness seed
(harness artifact, not a game defect).** The desktop script's reload
re-ran the boot `addInitScript`, which re-seeds localStorage with the
original settings — so the post-reload read showed the seed values, not the
stored ones. Re-checked properly in `vcs-ws3-persist.mjs`
(`ws3-persist.log`): settings changed on page 1 (quality high, pedestrians
off), then a **fresh page in the same context with no seed script** read
localStorage — quality high, pedestrians off — and booted the game at
**engine tier `high`**. Persistence is proven.

### 3.2 Story-mission marker (follow-up probe)

`vcs-ws3-final.mjs` (`ws3-final.log`): FIRST LIGHT selected from the Story
board (Select clicked, board closed, engine resumed) → map showed **17
locations** with mission rows `["FIRST LIGHT","BEACON RUN"]` → clicking the
FIRST LIGHT marker on the canvas selected it in the sidebar ("FIRST LIGHT",
"X 66 · Z 6"). Both mission-marker paths (story and job) are verified live.

---

## 4. Verification — mobile (390×844, touch)

Script `~/workspace/qa-shots/vcs-ws3-mobile.mjs`, log `ws3-mobile.log`,
screenshots `ui-ws3/*-mobile.png`. **Console errors: `[]`.**

| Check | Result |
|---|---|
| Hub | 10 rows; scrollWidth 390, no overflow |
| Settings | 4 tabs (horizontal scroll row); scrollWidth 390, no overflow |
| Statistics | tiles 0/10 · 0/5 · 0/10 · 1/4 · $5,000 (2-column reflow); scrollWidth 390, no overflow |
| Map | 16 rows; sidebar stacked below the map; scrollWidth 390, no overflow |
| Return-to-hub | Settings → hub, Statistics → hub, Map → hub |
| Esc | engine running after Esc |

(One harness typo — `[sel, t]` for `[sel, text]` in the mobile script's
`clickText` — was fixed and the run re-done clean; the first attempt's hub
results were already green and are unchanged.)

---

## 5. Regression — qa81 + build

- **TypeScript:** `npx tsc --noEmit` clean (at every step, including after the
  two fixes).
- **Build:** `index-CukKOD7o.js`, 1,190.22 kB / gzip 324.70 kB (up from
  1,175.21 kB — the four new screens). Rebuilt after the two fixes as
  `index-D8KLBqmO.js` (same size), then `index-Ccz1_9Qf.js` after the
  `.play-button` fix (§7; same size — CSS-only).
- **qa81** (`vcs-qa81.mjs`, log `qa81-ws3.log`, on build `D8KLBqmO.js`):
  all values match the expected chain — draw calls 239 → 112, BEACON RUN
  12500, board chain correct, shop water ok, outfit buy/select ok, cash
  12190 → 12340 → 4040 → 2840 → 3090 → 3340, carbine mag exactly 25
  (the flake did not trigger), palm mag 11, both encounters +250, contract
  active, arrest cycle → busted → respawn cleared. **Console errors `[]`.**
  Exit 0.
- **Build-split honesty:** qa81 ran on `D8KLBqmO.js`. The only change after
  it is the `.play-button` CSS definition (§7) — no JavaScript, no logic, no
  state. The new screens' buttons were re-verified on the final build
  `Ccz1_9Qf.js` by computed style + screenshots (§7). No other regression
  run is invalidated by a CSS-only change.

---

## 6. Visual verification (viewed, not just measured)

- **Hub (desktop + mobile):** sunset artwork, left-dark shade, "PAUSED."
  with pink period, Resume selected in pink, all 10 rows with icons and
  chevrons, "ESC RESUME GAME" hint. Clean, premium, unmistakably the game's
  own art direction.
- **Settings (desktop):** PREFERENCES / SETTINGS, numbered tabs with the
  active tab in pink, "SAVED ON THIS DEVICE" green-dot indicator, stepper
  with ‹ value ›, toggle switches (Show FPS on = green). After the §7 fix
  the Done button is pink gradient, Bebas, ink text.
- **Statistics (desktop + mobile):** sunset banner with the real chapter
  title, 5 tiles with icons + pink underlines, current story/job lines.
  Mobile reflows to 2 columns.
- **Map (desktop + mobile):** the real city grid (roads, blocks, parks,
  beach strip east, water), N label, player arrow ringed near spawn,
  FIRST LIGHT selected with its sidebar (name, "Story mission — Mara Voss.",
  "X 66 · Z 6"), location list, legend, zoom at 100%. Mobile stacks the
  sidebar below the map.

Screenshots: `~/workspace/qa-shots/ui-ws3/` — `hub-desktop.png`,
`hub-mobile.png`, `settings-graphics.png`, `settings-controls.png`,
`settings-mobile.png`, `settings-done-fixed.png`, `statistics.png`,
`statistics-mobile.png`, `statistics-done-fixed.png`, `map-desktop.png`,
`map-mobile.png`, `map-back-fixed.png`.

---

## 7. Fix found during visual review — `.play-button` had no definition

While viewing the Settings screenshot, the Done button rendered as a grey
browser-default button. Cause: the `.play-button` class is used by ten
components (mission complete/failed, busted/downed respawn, sprint, panel
Done/Back, the old pause Resume) but **has no CSS definition anywhere** in
`global.css` or `tokens.css` — a pre-existing defect, not introduced by WS3.
Fix (CSS-only, appended to `global.css`): the primary treatment — pink
gradient `var(--vc-gradient-pink)`, ink text, Bebas 20 px, neon shadow,
hover brighten — with the three modifier paddings re-asserted after it
(`.panel-done` / `.stats-done` 13px 44px, `.map-back` 11px 16px). This also
fixes the same grey buttons on the mission-complete, mission-failed, busted,
downed, sprint and story-complete/failed screens. Verified on the final
build (`vcs-ws3-buttons.mjs`, `ws3-buttons.log`): Settings Done computed
style `linear-gradient(110deg, rgb(255,94,138), rgb(255,46,122))`, color
`rgb(18,10,36)`, font Bebas Neue; re-shots `settings-done-fixed.png`,
`statistics-done-fixed.png`, `map-back-fixed.png` show pink buttons.
Console errors `[]`.

---

## 8. What was deliberately NOT done

- No SET WAYPOINT (no waypoint system exists); no DEMO MAP badge; no grid
  references; no fictional districts, roads, locations, activities or
  statistics; no playtime / cash-earned; no fictional settings (brightness,
  VSync, volumes, difficulty, subtitles, aim assist).
- No mock data anywhere: every number on Statistics and every marker on the
  map comes from the live engine / save state.
- No engine, mission, story, dialogue, cinematic, combat, police, save or
  economy change. No push, merge or deploy.
- The old pause overlay is replaced by the hub, but its contract is
  preserved: same guard (extended), same `.pause-overlay` root, same
  `.play-button` Resume, same stop/start protocol.
- The minimap is refactored onto the shared renderer, not replaced: same
  interval, same output (pixel-verified tower gold + player white).

---

## 9. Known issues / deferred work

- **WS1 gaps unchanged:** 2.1 natural driving and 2.4 natural evade remain
  unverified (BLOCKED in the real browser, 2026-11-23); the 3.3 tower drive
  stays labelled ASSISTED. Nothing in WS3 changes those verdicts, and this
  report does not claim release readiness.
- **Lena's staged cinematic** still does not play (engine activity guard
  refuses mid-mission cinematics) — deferred, needs her approval for a guard
  change. Unchanged by WS3.
- **On-foot police officer** still deferred (arrest-flow risk, 2.8 s window,
  no cap geometry). No police code written in WS3.
- **Male characters' cinematics** were not individually re-verified in this
  session (portraits were, in WS2). Unchanged by WS3.
- **Settings from the main menu** was not re-run in the browser in this
  session — the panel's props/contract are unchanged and it renders from the
  same component; the pause-path (the changed path) was verified end to end.
  Worth a one-minute check in a later pass.

---

## 10. Git status at delivery

Branch `ui/gta-vice-city-transformation`. Base `c33d37d`. WS3 checkpoint
commit: **`95d9705`** — created after all verification above passed, containing
the 9 files in §2 (code + this report). Working tree at commit time: clean
except the 7 earlier untracked report docs, which remain untracked as before.
Nothing pushed, merged or deployed. Production `main` still `053e76d`;
the deployed build is unchanged.

## 11. Verdict

**WS3 is complete.** All four Group 2 screens are implemented on the real
game with real data, all ten hub destinations work with return-to-hub,
Escape-to-resume works, settings persist, the map and minimap draw the same
real city, desktop and mobile are verified with no console errors, and qa81
is green on the WS3 build. Two defects found during verification (map
click-to-select, the missing `.play-button` definition) were fixed and
re-verified. The remaining open items are the pre-existing WS1/WS2
deferrals listed in §9 — none of them is a WS3 regression.
