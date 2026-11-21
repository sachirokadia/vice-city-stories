# Vice City Stories — UI Transformation Audit (Phase 0)

**Status:** Audit only. No redesign implemented. Awaiting approval before Phase 1.
**Branch:** `ui/gta-vice-city-transformation` (from release `053e76d`)
**Date:** 2026-11-22
**Screenshots:** `~/workspace/qa-shots/ui-audit/` — 17 desktop (1280×800) + 7 mobile (390×844), zero console/page errors on every run.

---

## 1. Screen inventory

Every screen, menu, modal, HUD element, overlay, notification and interaction in the current frontend, with its trigger and state.

### 1.1 App phases (App.tsx owns only this)

| Phase | What shows | Trigger |
|---|---|---|
| `loading` | LoadingScreen — progress bar + status text | App mount, until engine assets ready |
| `menu` | MainMenu — full-screen sunset scene, title, 5 actions, control hints, quality chip | After loading; also on Quit to menu |
| `playing` | GameCanvas — 3D scene + all in-game UI below | Play / Continue |

### 1.2 Main menu (MainMenu.tsx)

- Title "VICE CITY STORIES" + subtitle "An Open World Adventure" + tagline.
- Actions: **Play** (pink gradient, primary), **Story**, **Missions**, **Settings**, **About**.
- Status line: "Enter the city · free-roam foundation · Chapter 1 · 0 of 10 done" (live: reads mission + story progress from saves).
- Control hints row (WASD / mouse / Shift / touch), quality chip.
- Settings opens SettingsPanel as an overlay; About opens AboutPanel as an overlay. Both close back to the menu.
- Footer: "An original foundation. Not affiliated with any existing game."

### 1.3 Gameplay HUD (always rendered while `playing`, hidden when `hudHidden`)

`hudHidden = paused || cinematic !== null` hides the top HUD, prompts and touch controls.

| Element | Component | Position | Notes |
|---|---|---|---|
| Title + mode chip | GameCanvas inline | Top-left | "VICE CITY / Stories · free roam" |
| FPS chip | GameCanvas inline | Top-right | Shows live FPS; quality chip next to it |
| Quality chip | GameCanvas inline | Top-right | e.g. "Low — battery saver" |
| Coin/collectible chip | GameCanvas inline | Top-right | 🪙 `n / 10` Sunset Coins |
| Cash | — | **Nowhere in free roam** | Cash appears only in MissionHUD/StoryHUD `.mission-cash`, board headers and panel `garage-cash`. No persistent cash display. |
| Missions button | GameCanvas inline | Top-right | Opens MissionBoard |
| Story button | GameCanvas inline | Top-right | Opens StoryBoard |
| Outfits button | GameCanvas inline | Top-right | Opens OutfitsPanel |
| Pause button | GameCanvas inline | Top-right | Opens pause overlay |
| Mission objective card | MissionHUD | Left, below title | Yellow accent; title, objective text, distance + inline-rotated direction arrow, reward |
| Story objective card | StoryHUD | Left, below title | Teal accent; same shape as MissionHUD |
| Health bar | CombatHUD | Bottom-right | Thin green bar + ♥; **health only — no armour exists anywhere** |
| Weapon + ammo | CombatHUD | Bottom-right | Weapon name, big `mag / reserve`, reload + switch hints |
| Crosshair | CombatHUD | Centre | Simple `+` |
| Speedometer | GameCanvas inline | Bottom-right (driving) | Bare "0 km/h" + pink gear pill (`N`) + "E · Exit car" pill. **No dial/gauge.** |
| Wanted stars | GameCanvas inline | Top-centre | 5 stars + "POLICE PURSUIT"; escape progress fill when fleeing |
| Surrender prompt | GameCanvas inline | Bottom-centre | "Cornered — press [F] to surrender" (red kbd box) when arrest is imminent |
| Interaction prompt | GameCanvas inline | Bottom-centre | "E · Enter car" / "E · Talk" etc., from `nearVehicle` / `nearInteractable` / `nearGarage` |
| Keyboard hint line | GameCanvas inline | Bottom | "WASD to move · drag to look · left-click to fire · R reload · Q switch · Shift to sprint" |
| Menu pill | GameCanvas inline | Bottom-right | "✕ Menu" |
| Sprint HUD | SprintHUD | Centre | Timer, progress, plus its own complete/fail screens |
| Encounter banner | EncounterHUD | Top-centre | Enemy-encounter banner + 5 s toasts |
| Contract banner | ContractHUD | Top-centre | Contract banner + objective fill + 5 s toasts |
| Touch controls | TouchControls | Bottom-left / bottom-right | Joystick + FIRE / RUN / switch / reload buttons (touch only) |
| Notifications | — | **No shared system** | Only EncounterHUD/ContractHUD 5 s toasts exist; everything else is a panel or a prompt. |

**Does not exist:** minimap (no component, no canvas, no engine minimap output), pause map, statistics screen, save/load UI (saves are automatic localStorage), armour display, persistent cash display.

### 1.4 Boards and panels (all pause the engine)

Opening any board/panel calls `engine.stop()` + `setPaused(true)`; closing calls `engine.start()` + `setPaused(false)`.

| Screen | Component | Trigger | Content |
|---|---|---|---|
| Mission board | MissionBoard (153 lines) | Missions button | 5 job missions (sequential unlock), COMBAT CONTRACTS section, Select moves the world marker only — the board never starts a run |
| Story board | StoryBoard (98 lines) | Story button | 3 chapters, 10 story missions, ending/blocked state; reuses MissionBoard classes with `story-*` teal modifiers |
| Garage | GaragePanel (302 lines) | Drive into garage / Garage entrance | 3D VehiclePreview turntable, 4 cars, stat bars, 10 paint swatches, 3 upgrade tracks, Buy with shortfall feedback |
| Shop (Sunset Mart) | ShopPanel (103 lines) | Mart entrance (43,24) | Water $10 / Snack $20 / Energy $35 |
| Outfits | OutfitsPanel (151 lines) | Outfits button | 4 outfits + crew-jacket (story reward, `unlockOnly`); CharacterPreview 3D turntable |
| Collection | CollectionPanel (60 lines) | (via HUD coin chip) | 10 Sunset Coins, read-only list |
| Range (Sunset Range) | RangePanel (131 lines) | Weapon rack (156,−90) | Vanguard Carbine $1,200 buy, ammo restock, session/all-time accuracy |
| Settings | SettingsPanel (225 lines) | Menu or pause | 9 live controls (see §2) |
| About | AboutPanel (44 lines) | Menu | Static text — **stale copy, see §3.5** |
| Pause | GameCanvas inline | Pause button / Esc | "Paused / The city waits for you." + Resume / Settings / Quit to menu only |

### 1.5 Story, dialogue and cinematics

| Screen | Component | Notes |
|---|---|---|
| Dialogue | DialoguePanel (245 lines) | Bottom-anchored; typewriter 28 ms/char + punctuation pauses; portrait medallion = a letter ("M"); name plate; two-tap Continue; choices only after the line is fully shown; Esc refused at choice nodes; remount per node via `key={nodeId}` |
| Cinematic | CinematicOverlay (89 lines) | Letterbox bars, title card, narration, shot dots, Skip; Esc gated on `!dialogueOpen`; **does NOT pause the engine** (camera keeps moving) |
| Mission complete | MissionCompleteScreen (50 lines) | Reward presentation |
| Mission failed | MissionFailedScreen (43 lines) | Reason-derived failure lines |
| Story complete | StoryCompleteScreen (50 lines) | Outro-then-continue: `playStoryOutro(outro, () => continueStoryMission())` with fallback |
| Story failed | StoryFailedScreen (60 lines) | Failure presentation |
| Busted | BustedScreen (25 lines) | Full-screen "BUSTED", single Respawn action; clears wanted |
| Taken down | DownedScreen (30 lines) | Full-screen "TAKEN DOWN", single Respawn action; does NOT clear wanted |

### 1.6 Screenshots captured

Desktop (1280×800) in `~/workspace/qa-shots/ui-audit/`: `01-loading` (actually shows the menu — loading is too brief to catch), `02-menu`, `03-settings-menu`, `04-about-menu`, `05-hud-foot`, `06-hud-drive`, `07-wanted`, `08-mission-board`, `09-story-board`, `10-dialogue`, `11-garage`, `12-shop`, `13-outfits`, `14-collection`, `15-range`, `16-pause`, `17-busted`.

Mobile (390×844, touch) in the same folder: `mobile-01-menu`, `mobile-02-hud-foot`, `mobile-03-mission-board`, `mobile-04-story-board`, `mobile-05-dialogue`, `mobile-06-garage`, `mobile-07-pause`.

Two capture notes (both settled, not defects):
- **Range panel looks washed-out in `15-range.png`.** Proven a headless-rendering artifact, not a contrast defect: a dedicated probe read the computed styles live — the panel background is `rgba(18,10,36,0.94)` and its own opacity is `1`, but the parent `.garage-overlay` was stuck at computed opacity `0` because the `busted-in` entrance animation (0.6 s, `both` fill, `from { opacity: 0 }`) had not advanced in the throttled headless compositor after 5 s. On a real device at 60 FPS the animation completes in 0.6 s and the panel is dark. See §3.6 — the animation is still a real robustness finding for Phase 1.
- **`17-busted.png` is the arrest in progress, not the BUSTED screen.** The player is cornered (hands up, red arrest ring, police car alongside, 5 stars lit, "Hands up — stand down" prompt). The BUSTED overlay itself did not appear within the 120 s poll (police approach too slowly at headless sim rates). qa81 already proves the arrest cycle works; the BustedScreen component is fully inventoried in §2.
- **`mobile-03-mission-board.png` is ghosted** (same `busted-in` animation artifact — the board is faintly visible over the live scene). The desktop `08-mission-board.png` shows the same component correctly; the mobile board is not separately broken.

---

## 2. Component and file map

### 2.1 Scale

| Layer | Files | Lines |
|---|---|---|
| Components (`src/components/`, 29 files) | 29 | 3,987 |
| App + main + global.css | 3 | 1,315 |
| **Frontend total** | **32** | **5,302** |
| Engine (`src/game/`, incl. GameEngine.ts 2,784) | 61 | 21,628 |

### 2.2 Composition root — GameCanvas.tsx (988 lines)

`GameCanvas.tsx` is the composition root for **all** in-game UI. It:

- Creates the single `GameEngine` and sets `window.__vcsEngine` (debug handle only — **no other component touches it or imports GameEngine**, grep-verified).
- Subscribes to **17 engine callbacks**: `onReady`, `onFps`, `onQualityChange`, `onDrive`, `onWanted`, `onArrest`, `onMission`, `onStory`, `onDialogue` (also `setPaused(s !== null)`), `onCinematic` (**does NOT pause** — engine keeps running for the camera), `onGarageEnter`, `onShopEnter`, `onSprint`, `onCombat`, `onRangeEnter`, `onDowned`, `onEncounter`, `onContract`.
- Conditionally renders every other component.
- Owns the pause protocol: opening any board/panel → `engine.stop()` + `setPaused(true)`; closing → `engine.start()` + `setPaused(false)`.
- Owns `hudHidden = paused || cinematic !== null`, which hides the top HUD, prompts and touch controls.
- Renders the pause overlay only when `paused && !downed && !dialogue && !cinematic && !showSettings && !showBoard && !showStoryBoard && !showGarage && !showShop && !showOutfits && !showCollection && !showRange`, containing only Resume / Settings / Quit to menu.
- Owns all inline HUD chrome (title chip, FPS/quality/coin chips, top-right buttons, wanted stars, surrender + interaction prompts, keyboard hint line, speedometer, Menu pill).

### 2.3 Panels are controlled views

No panel owns gameplay state. Every action flows: component → GameCanvas wrapper → engine method → `refreshX()` via an engine `getXState()` getter. Action contracts return `{ ok, reason }` with reason strings `insufficient`, `already-owned`, `maxed`, `already`, `not-owned`, `too-fast`, `unavailable`. **This callback contract is the single most important thing the redesign must not break.**

### 2.4 Component map

| Component | Lines | Role / contract |
|---|---|---|
| `App.tsx` | 116 | Phase only (`loading \| menu \| playing`) + shared `GameSettings` (`loadSettings` / `saveSettings`) |
| `main.tsx` | 10 | Renders `<App/>` in StrictMode, imports the single stylesheet |
| `GameCanvas.tsx` | 988 | Composition root — see §2.2 |
| `MainMenu.tsx` | 171 | Bypasses the engine; reads saves **directly** (`loadMissionProgress`, `buildBoardState`, `loadCashBalance`, `trySelectMissionInProgress`, `loadStoryProgress`, `buildStoryBoardState`, `trySelectStoryMissionInProgress`). A redesign must keep those exact calls. |
| `LoadingScreen.tsx` | 21 | Pure view: progress + status props |
| `SettingsPanel.tsx` | 225 | 9 live controls, native selects/checkboxes, exact `GameSettings` keys + `{...settings, [key]: value}` contract |
| `AboutPanel.tsx` | 44 | Static text; "Version 0.1.0 — Foundation" |
| `MissionBoard.tsx` | 153 | Select only moves the world marker; includes COMBAT CONTRACTS section |
| `StoryBoard.tsx` | 98 | Reuses MissionBoard classes + `story-*` teal modifiers; shows ending/blocked state |
| `DialoguePanel.tsx` | 245 | Typewriter — see §6 MUST-NOT-DISTURB |
| `CinematicOverlay.tsx` | 89 | Letterbox, title card, narration, shot dots, Skip; Esc gated on `!dialogueOpen` |
| `StoryCompleteScreen.tsx` | 50 | Outro-then-continue sequencing — MUST-NOT-DISTURB |
| `StoryFailedScreen.tsx` | 60 | Failure presentation |
| `MissionCompleteScreen.tsx` | 50 | Reward presentation |
| `MissionFailedScreen.tsx` | 43 | Reason-derived failure lines |
| `GaragePanel.tsx` | 302 | 3D VehiclePreview turntable, stat bars, paint swatches, 3 upgrade tracks, disabled Buy with "(need $X more)" |
| `VehiclePreview.tsx` | 101 | Own small Three.js scene using `buildVehicleMesh` directly, with dispose logic — MUST-NOT-DISTURB |
| `CharacterPreview.tsx` | 114 | Own small Three.js scene using `createCharacter` + `applyOutfit` directly, with dispose logic — MUST-NOT-DISTURB |
| `ShopPanel.tsx` | 103 | Silently swallows the `too-fast` reason (engine 500 ms double-click guard) |
| `RangePanel.tsx` | 131 | 9.4 disabled-Buy-with-shortfall feedback |
| `OutfitsPanel.tsx` | 151 | Reuses garage layout; `crew-jacket` is `unlockOnly` story reward |
| `CollectionPanel.tsx` | 60 | Read-only |
| `CombatHUD.tsx` | 82 | Crosshair, weapon/mag/reserve, health bar (health only, no armour) |
| `EncounterHUD.tsx` | 68 | Banner + 5 s toasts |
| `ContractHUD.tsx` | 110 | Banner + objective fill + 5 s toasts |
| `SprintHUD.tsx` | 85 | Timer/progress + its own complete/fail screens |
| `MissionHUD.tsx` | 61 | Objective card + inline-rotated direction arrow |
| `StoryHUD.tsx` | 82 | Same shape as MissionHUD, teal accent |
| `TouchControls.tsx` | 245 | **Writes directly into the shared mutable engine `InputState`** (joystick/moveX/moveY/handbrake, `addLook(input, dx*1.6, dy*1.6)`, pointer-capture try/catch) — MUST-NOT-DISTURB |
| `BustedScreen.tsx` | 25 | Full-screen, single Respawn; clears wanted |
| `DownedScreen.tsx` | 30 | Full-screen, single Respawn; does NOT clear wanted |

### 2.5 Styling — global.css (1,189 lines, ONE file, no CSS modules)

- **Only 6 tokens** in `:root`: `--pink #ff5e8a`, `--pink-deep #ff2e7a`, `--amber #ffd27a`, `--violet #2b1e5e`, `--ink #120a24`, `--paper #fff3e2`. Most colours are hardcoded hex. Top counts: `#ffd23e` ×33, `#fff3e2` ×19, `#9be15d` ×14, `#2dd4bf` ×12, `#ff5a3c` ×6, `#ff4d3d` ×6, `#35c4ff` ×4.
- **Font: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` only.** No display font, no Google Fonts, no `@font-face`.
- **Three duplicated overlay families**: `.panel-overlay` + `.panel` (Settings/About); `.garage-overlay` + `.garage-panel` (Garage/Shop/Outfits/Range/Collection — panel bg `rgba(18,10,36,0.94)`, yellow border `rgba(255,210,62,0.55)`); `.mission-board-overlay` + `.mission-board` (Mission/Story boards — overlay `rgba(12,4,10,0.72)` + blur 2px, panel `rgba(18,10,36,0.92)`).
- **Button families (no shared Button component):** `.play-button` (pink gradient), `.menu-button`, `.hud-button`, `.garage-action`, `.mission-board-button`, `.panel-close`, `.panel-done`, `.drive-btn`, `.combat-btn`. No shared Button / Modal / Panel React components.
- **Radius:** `border-radius: 999px` ×42 (pill-heavy), `50%` ×13. **Blur:** `backdrop-filter` ×9 (weak 2px on overlays). **Breakpoints:** exactly one `@media (max-width: 640px)` (~120 lines of repositioning: hides `.hud-hint`, lifts speedo/prompts above touch pedals) + `prefers-reduced-motion`. **Z-index:** implicit — JSX order + scattered values (HUD 5, prompts 6, overlays 8, dialogue 9); no layer tokens.
- **Iconography:** emoji/text glyphs everywhere (🪙 ☰ 📖 👕 ⚙ ⓘ ▶ ✕ ★ ♥ ⚠ ⇄ ⟳ ✋ 🔒 💧 🍫 ⚡). No icon font/SVG icon set. The only SVG artwork is MainMenu's inline skyline. `public/icons.svg` is an **unused Vite-template leftover** (bluesky/discord/github/x symbols, zero references in `src/` or `index.html`); `public/favicon.svg` is the only used public asset.
- **Inline styles** exist only for: loading-bar width, combat reload/health widths, wanted escape fill, mission arrow rotation, contract objective fill, dialogue speaker colours, garage stat-bar widths, paint swatch colour, joystick knob transform.
- **Entrance animation:** `busted-in` (opacity 0→1, 0.6 s, `both` fill) is applied to all six overlay families (lines 248, 275, 423, 672, 833, 940). See §3.6.
- **Accent language that already works and should be formalized:** job missions = yellow (`#ffd23e`), story = teal (`#2dd4bf`), danger/arrest = red/pink, cash = green (`#9be15d`).

### 2.6 Engine communication (frontend ↔ game)

- Single `GameEngine` instance, created in GameCanvas. All state flows through the 17 callbacks in §2.2 and the `getXState()` getters.
- Save keys (13, all `vice-city-stories.*.v1`): cash, collectibles, contracts, encounters, garage, inventory, missions, outfits, range, settings, sprint, story, weapons. MainMenu reads saves directly; everything else goes through the engine.
- Debug handle `window.__vcsEngine` (GameCanvas only). Private fields via bracket access in QA harnesses only.

---

## 3. Current design weaknesses

Grounded in the screenshots + the CSS/component facts above. Ordered by impact on the "premium open-world game" bar.

### 3.1 Typography — no display voice (HIGH)

The entire game is set in generic system sans. The menu title "VICE CITY STORIES" is bold system-ui with "Stories" in italic gold — it reads as a landing page, not a game logo. There is no display font, no letterspaced small-caps treatment, no typographic hierarchy beyond size + weight. Every panel title, HUD label and button uses the same voice, so nothing feels authored.

### 3.2 Pill-heavy, dashboard-shaped panels (HIGH)

`border-radius: 999px` appears 42 times. Buttons, chips, badges, selects and cards are all pills or uniformly rounded rectangles. The mission/story boards, shop, collection and outfits are lists of dark rounded cards with pill badges and pill buttons — the visual language of a web dashboard, not a game interface. The garage is the strongest screen (real 3D turntable) but its list cards are the same generic dark rectangles, and the car sits small in a large dark preview box with dead space around it.

### 3.3 No shared design system (HIGH)

One 1,189-line stylesheet, 6 tokens, hardcoded hex everywhere, three duplicated overlay families, eight button families, no shared Button/Modal/Panel/Chip components, no z-index layer tokens, one breakpoint. Every screen was styled independently, so spacing, borders, blur and motion are inconsistent — e.g. overlay blur is 2px on boards but absent elsewhere, panel backgrounds are 0.92 vs 0.94 opacity for no reason, and the pause overlay is a different treatment again.

### 3.4 HUD is under-designed and incomplete (HIGH)

- **No minimap.** The single biggest HUD gap for an open-world game — no spatial orientation, no marker sense beyond a small rotating arrow.
- **No persistent cash display** in free roam; cash only appears inside mission cards and panel headers.
- **No armour** (health only).
- **Speedometer is bare text** ("0 km/h" + a pink "N" pill) — no dial, no gauge, no sense of speed.
- **Wanted stars are a small top-centre pill** — readable but understated; the pursuit state deserves a more prominent, unmistakable treatment.
- **Top-right cluster crowds the screen**: FPS chip + quality chip + coin chip + 4 buttons in one row; on mobile (390px) it wraps across rows and crowds the top.
- **Keyboard hints leak onto touch**: the bottom hint line ("WASD to move · drag to look · R reload · Q switch") and the ammo block's "R reload · Q switch" still show on touch devices; the dialogue panel shows "E / Space to continue" on mobile. Touch should get touch-appropriate hints or none.
- **Mission HUD text is cramped**: in `17-busted.png` the objective card's lines crowd and the distance labels sit tight against the objective text. Readable, but the card needs breathing room and a clearer hierarchy.

### 3.5 Menu and panels read as web pages (MEDIUM)

- **Menu (02 / mobile-01):** pleasant sunset gradient + sun + flat SVG skyline, but the composition is a centred landing page: title, tagline, pill buttons, hint pills, quality pill, footer disclaimer. The "Enter the city · free-roam foundation · Chapter 1 · 0 of 10 done" line sits low-contrast over the skyline; on mobile it clips and wraps behind the About button. "Stories" in italic gold is low-contrast where it crosses the sun. The scene is static — no animated background detail beyond the CSS sun/cloud drift.
- **Settings (03):** a clean but generic web form — native `<select>` dropdowns and pink square checkboxes, label + description rows. Nothing about it says "game settings".
- **About (04):** a generic text modal. **Content is stale**: it says "This is the Phase 1 foundation" and "Missions, vehicles, and the stories of the people who live here are still to come" — but the release has all 10 missions, all vehicles and the full 3-chapter story. The copy must be updated as part of the transformation (content update, no gameplay change). It also still says "Version 0.1.0 — Foundation".
- **Shop (12):** three emoji rows (💧/🍫/⚡) with yellow "Buy — $X" pills — the thinnest screen in the game.
- **Collection (14):** ten identical rows; "Not found yet" is grey text with a hollow circle — found vs not-found has almost no visual distinction, and the panel is a long scrolling list with the footer note cut off.
- **Pause (16 / mobile-07):** clean but only three actions (Resume / Settings / Quit). No map, story, missions, stats or controls reachable from pause — the pause menu is a dead end, not a hub.

### 3.6 Entrance animation is fragile (MEDIUM — real robustness finding)

All overlays use `animation: busted-in 0.6s ease-out both` with `from { opacity: 0 }`. With `both` fill, the `from` state applies before the animation runs; if the animation does not advance (throttled compositor, background tab, very low frame rate), the overlay can sit at opacity 0 or partial opacity and the panel is invisible or ghosted. Proven live in the headless harness: after 5 s the range overlay's computed opacity was still `0` while the panel itself was dark and opaque — the parent was the problem. This is what ghosted `15-range.png` and `mobile-03-mission-board.png`. On a real 60 FPS device the fade completes in 0.6 s, so players do not see this — but the design system should make the base state visible (opacity 1) and treat the fade as a progressive enhancement, so a panel can never be invisible because an animation stalled.

### 3.7 Emoji iconography (MEDIUM)

Every icon is an emoji or text glyph (🪙 ☰ 📖 👕 ⚙ ⓘ ▶ ✕ ★ ♥ ⚠ ⇄ ⟳ ✋ 🔒 💧 🍫 ⚡). Emoji render inconsistently across platforms, carry no consistent weight or alignment, and cap the polish ceiling — the shop's 💧/🍫/⚡ rows and the HUD's 🪙/👕/☰ buttons are the clearest examples. A small original inline-SVG icon set is needed.

### 3.8 Mobile specifics (MEDIUM)

- Top HUD cluster wraps and crowds (see §3.4).
- Menu status line clips behind the About button; control hints include desktop-only WASD/mouse lines.
- Dialogue shows a keyboard hint on touch ("E / Space to continue").
- Touch drive joystick + vehicle enter/exit at 390px is **untested** (known gap from the release — must not be claimed).
- Otherwise mobile is in good shape: no horizontal overflow, joystick + FIRE/RUN/switch/reload well-sized, garage adapts to a clean 2-column grid, boards and dialogue are readable.

### 3.9 What is already good (keep it)

- The yellow/teal/red/green accent coding (jobs / story / danger / cash) is clear and consistent — formalize it, don't replace it.
- The garage's real 3D turntable preview and the outfits' character preview are genuinely game-like — enlarge and polish, don't redesign away.
- The dialogue panel is one of the best screens (bottom-anchored, teal border, name plate, typewriter) — polish the typography and the portrait medallion, keep the layout and behaviour.
- The sunset palette itself (pink/amber/violet/ink/paper) is the right identity — the problem is execution (pills, system font, emoji), not the colours.

---

## 4. Proposed visual system

A single coherent system, applied through shared tokens and components — not per-screen styling. All new work is original; no Rockstar logos, artwork, screens or assets.

### 4.1 Typography

| Role | Face | Use |
|---|---|---|
| Display | **Bebas Neue** (condensed, tall, cinematic — evokes neon signage without copying any game font), self-hosted via `@font-face` | Menu title, panel titles, BUSTED / mission-complete headlines, chapter cards |
| UI / body | **Inter** (clean, highly legible at small sizes), self-hosted, system-ui fallback | Buttons, HUD labels, body text, lists |
| Mono / numerals | Tabular-nums via Inter (`font-variant-numeric: tabular-nums`) | Cash, speed, ammo, timers — numbers must not jitter |

Hierarchy: display for titles only (never body); UI semibold for labels; regular for body. Letterspaced small caps (0.14–0.2 em) for eyebrows/kickers ("AN OPEN WORLD ADVENTURE", "CHAPTER 1 — THE WRONG PACKAGE"). Minimum body 14px desktop / 13px mobile; HUD labels 12–13px semibold.

### 4.2 Colour — formalized tokens

Keep the existing palette; give it names and stop hardcoding hex.

| Token | Value | Use |
|---|---|---|
| `--vc-ink` | `#120a24` | Deep charcoal base |
| `--vc-violet` | `#2b1e5e` | Panel violet |
| `--vc-pink` | `#ff5e8a` | Primary accent (Play, CTAs) |
| `--vc-pink-deep` | `#ff2e7a` | Pink gradient end |
| `--vc-amber` | `#ffd27a` | Warm highlight, sunset |
| `--vc-paper` | `#fff3e2` | Primary text |
| `--vc-job` | `#ffd23e` | Job missions (yellow) |
| `--vc-story` | `#2dd4bf` | Story (teal) |
| `--vc-cash` | `#9be15d` | Cash (green) |
| `--vc-danger` | `#ff4d3d` | Danger / arrest / fail |
| `--vc-surface` | `rgba(18,10,36,0.92)` | Panel background |
| `--vc-surface-strong` | `rgba(18,10,36,0.96)` | Modal background |
| `--vc-overlay` | `rgba(12,4,10,0.72)` | Dimming overlay |
| `--vc-border` | `rgba(255,210,62,0.45)` | Default panel border (yellow-tinted) |
| `--vc-border-story` | `rgba(45,212,191,0.5)` | Story panel border |
| `--vc-text-dim` | `rgba(255,243,226,0.62)` | Secondary text |
| `--vc-text-faint` | `rgba(255,243,226,0.38)` | Tertiary / disabled text |

Accent discipline: pink for primary actions, yellow for jobs, teal for story, green for cash, red for danger. Never more than one saturated accent per screen region; the sunset scene stays the hero.

### 4.3 Geometry, surfaces, depth

- **Angular over pill:** panels and cards use a small radius (10–14px) with a 2px chamfered corner treatment on primary panels (via `clip-path` or a corner accent), not 999px pills. Pills survive only for small chips/badges (FPS, cash, counts).
- **Glass surfaces:** panel `background: var(--vc-surface)`, `backdrop-filter: blur(10px)`, 1px border in the accent-tinted token, shadow `0 18px 50px rgba(0,0,0,0.55)`. Overlay dim `var(--vc-overlay)` + `blur(6px)`.
- **Depth:** one shadow scale (sm/md/lg), one border scale, one blur scale — all tokens, no per-screen values.

### 4.4 Components (new shared primitives — React, in `src/components/ui/`)

| Primitive | Replaces |
|---|---|
| `VcButton` (primary / ghost / danger / chip) | `.play-button`, `.menu-button`, `.hud-button`, `.garage-action`, `.mission-board-button`, `.panel-done`, `.drive-btn`, `.combat-btn` |
| `VcPanel` + `VcOverlay` (one overlay family, title + close slot) | `.panel-overlay/.panel`, `.garage-overlay/.garage-panel`, `.mission-board-overlay/.mission-board` |
| `VcChip` (count, cash, status) | Ad-hoc coin/FPS/quality pills |
| `VcStatBar` | Garage stat bars, wanted escape fill, contract fill |
| `VcToast` (shared notification) | EncounterHUD/ContractHUD ad-hoc 5 s toasts |
| `VcIcon` (original inline-SVG set: play, settings, missions, story, outfits, cash, health, weapon, star, close, lock, check, arrow) | All emoji/text glyphs |
| `VcTabs` | Pause-menu sections, board tabs |

Rules: no new screen invents its own button/panel/chip; screens compose primitives. Existing class names are retired as screens migrate — one screen at a time, never a big-bang CSS rewrite.

### 4.5 Motion

- **Fix the entrance first:** base opacity `1` on every overlay/panel; the fade is an enhancement (`@keyframes vc-fade-in` on a wrapper, `backwards` fill only, 180–240 ms). A panel must never be invisible because an animation stalled. Respect `prefers-reduced-motion` by skipping the animation entirely (opacity stays 1).
- Transitions 150–300 ms, `ease-out`, on opacity/transform only. Menu transitions: cross-fade + slight rise (8px). HUD updates: no animation (state changes must read instantly). Wanted stars: pop-in scale on level change only.

### 4.6 Z-index layers (tokens, not scattered values)

| Layer | Value | Contents |
|---|---|---|
| HUD | 10 | Top bar, objective cards, speedo, prompts |
| Touch | 20 | TouchControls |
| Toasts | 30 | VcToast |
| Overlays | 40 | VcOverlay + panels, boards, pause |
| Dialogue | 50 | DialoguePanel |
| Cinematic | 60 | CinematicOverlay (topmost; letterbox over everything) |
| Busted / Downed | 70 | Full-screen fail states |

### 4.7 New screens (not redesigns — flagged as new work)

- **Minimap:** a new HUD element. Built from the **static city layout** (avenues x = −120/−60/0/60/120, streets z = −150/−90/−30/30/90/150, beach east, Beacon Tower north) rendered as a small canvas/SVG, with the player marker, active-mission marker and wanted state driven by **existing engine state** (`getStats()`, mission/story state). No engine changes, no new gameplay data.
- **Pause map:** the same city rendering at large size inside the pause menu, with mission/story markers. Same static layout + existing state.
- **Statistics screen:** computed from existing save/engine state (missions complete, cash earned, coins, contracts, encounters, time). No new tracking.
- **Save/load UI:** saves are automatic; the pause menu shows save status ("Progress saved automatically") and a Continue entry — no new save format, no manual save/load unless scoped separately.

---

## 5. Exact implementation sequence

Phases follow the commission. Each phase: implement → `npx tsc --noEmit` → `npm run build` → qa81 + relevant regressions → real-browser test of every redesigned interaction (desktop + 390px) → console check → screenshot comparison → fix regressions before proceeding. **No push or deploy at any phase without explicit approval.**

### Phase 1 — Design system + main menu

**Scope:** tokens + primitives only, then the menu.
**Files:** new `src/styles/tokens.css` (tokens, layers, motion) + `src/components/ui/` (VcButton, VcPanel/VcOverlay, VcChip, VcIcon, VcStatBar); edit `src/styles/global.css` (retire old button/panel rules as they are replaced — keep un-migrated screens' rules until their phase); edit `src/components/MainMenu.tsx` (typography, layout, buttons, status line, hints, quality chip, animated background detail); edit `src/components/AboutPanel.tsx` (stale copy update — §3.5 — + new panel chrome); add fonts (`@font-face`, self-hosted woff2 in `public/fonts/`).
**Also in Phase 1:** fix the `busted-in` entrance (base opacity 1, `backwards` fill, §4.5) across all overlays — it is a one-line-per-family CSS change and it unblocks every later phase's screenshots.
**Stop line:** menu + about + design system only. HUD, boards, garage, shop, settings untouched. qa81 + menu screenshot comparison.

### Phase 2 — Gameplay HUD + minimap

**Scope:** all HUD chrome + the new minimap.
**Files:** edit `src/components/GameCanvas.tsx` (top bar, chips, buttons, wanted stars, prompts, speedometer, hint line — restructure only the JSX/CSS, keep every callback and the pause protocol intact); edit `src/components/CombatHUD.tsx`, `src/components/MissionHUD.tsx`, `src/components/StoryHUD.tsx`, `src/components/SprintHUD.tsx`, `src/components/EncounterHUD.tsx`, `src/components/ContractHUD.tsx` (typography, spacing, VcToast migration for the two banner toasts, persistent cash chip); new `src/components/Minimap.tsx` (static city canvas + player/mission markers from existing state); edit `src/components/TouchControls.tsx` **CSS only** (layout/spacing — do not touch the InputState mutation logic); edit `global.css` (HUD rules only).
**Stop line:** HUD + minimap only. Boards, panels, pause untouched. qa81 + drive/wanted HUD screenshots desktop + mobile.

### Phase 3 — Pause menu + map

**Scope:** pause becomes a hub.
**Files:** edit `src/components/GameCanvas.tsx` (pause overlay JSX only — add Map / Story / Missions / Statistics / Settings / Controls / Resume / Quit; keep the pause-rendering condition and the stop/start protocol intact); new `src/components/PauseMap.tsx` (large city rendering, same static layout as the minimap); new `src/components/StatsPanel.tsx` (from existing save/engine state); edit `src/components/SettingsPanel.tsx` (new chrome only — keep the 9 controls and the key contract); edit `global.css` (pause rules only).
**Stop line:** pause + map + stats + settings chrome only. Story/dialogue/mission screens untouched. qa81 + pause/map screenshots.

### Phase 4 — Story, dialogue and mission interfaces

**Scope:** story board, mission board, dialogue, cinematics, complete/fail screens, endings.
**Files:** edit `src/components/MissionBoard.tsx`, `src/components/StoryBoard.tsx` (VcPanel + VcButton + VcChip migration, typography, lock states); edit `src/components/DialoguePanel.tsx` **CSS + portrait medallion only** (replace the letter medallion with a small original portrait illustration; do NOT touch the typewriter timer/counter/choice logic, the `key={nodeId}` remount, or the Esc rule); edit `src/components/CinematicOverlay.tsx` (typography, title card, shot dots — keep the Esc gating and the no-pause behaviour); edit `src/components/MissionCompleteScreen.tsx`, `src/components/MissionFailedScreen.tsx`, `src/components/StoryCompleteScreen.tsx`, `src/components/StoryFailedScreen.tsx` (typography + reward presentation — keep the outro sequencing in StoryCompleteScreen); edit `src/components/BustedScreen.tsx`, `src/components/DownedScreen.tsx` (display typography, keep the single Respawn action and the wanted-clear difference).
**Stop line:** story/mission/dialogue/cinematic/complete/fail only. Garage/shop/outfits/range/collection untouched. qa81 + CH1 story regression (both endings) + dialogue/complete screenshots.

### Phase 5 — Garage, shop and customisation

**Scope:** garage, shop, outfits, range, collection.
**Files:** edit `src/components/GaragePanel.tsx` (enlarge the VehiclePreview, VcStatBar, paint swatches as VcChip swatches, upgrade tracks as VcButton rows — keep the buy/upgrade contracts and shortfall feedback); edit `src/components/ShopPanel.tsx`, `src/components/OutfitsPanel.tsx`, `src/components/RangePanel.tsx`, `src/components/CollectionPanel.tsx` (same primitives migration; keep the `too-fast` swallow in ShopPanel and the 9.4 shortfall feedback in RangePanel); `VehiclePreview.tsx` / `CharacterPreview.tsx` **CSS/container only** (larger preview area — do not touch the Three.js scenes or dispose logic).
**Stop line:** garage family only. Settings/mobile refinement is Phase 6. qa81 + garage/shop/outfits/range screenshots desktop + mobile.

### Phase 6 — Remaining screens, settings and mobile refinement

**Scope:** everything left + a mobile pass.
**Files:** edit `src/components/SettingsPanel.tsx` (if not finished in Phase 3 — replace native selects/checkboxes with Vc-styled controls, keep the key contract); edit `src/components/LoadingScreen.tsx` (display typography, progress bar as VcStatBar); global.css mobile breakpoint pass (top-cluster wrap, menu status line, touch-appropriate hints — hide keyboard hints on touch, show touch hints); remove dead CSS (old button/panel/overlay families, unused `public/icons.svg`); final `global.css` tidy (no new tokens).
**Stop line:** no new screens, no gameplay changes. qa81 + full mobile 390px screenshot set + desktop set.

### Phase 7 — Full visual and functional regression

**Scope:** verification only, no redesign.
- `npx tsc --noEmit` clean; `npm run build` passes.
- **qa81 GREEN** + **CH1 story regression** (all 8 checks, both endings, replay flip) + **qa9f save audit** + **qa9f perf** (desktop FPS re-measurement — the only on-record desktop FPS is Sachi's 60/55/60 from G0 and has not been re-measured since).
- Real-browser pass of **every** redesigned interaction (desktop + 390px): menu, settings, about, HUD on foot + driving, wanted, surrender, boards, dialogue (incl. a choice node), garage buy/paint/upgrade, shop buy, outfits, range buy, collection, pause + map + stats, mission complete/fail, story complete/fail, BUSTED + TAKEN DOWN, cinematic skip.
- Console errors: zero. Screenshot comparison against the §4 design target for every screen.
- Fix regressions before calling the phase done. **No push, no deploy without explicit approval.**

---

## 6. Risks to gameplay integration

### MUST-NOT-DISTURB (breaking any of these breaks the game, not just the look)

1. **GameCanvas callback map** — the 17 engine callbacks (§2.2). A redesign that drops, renames or reorders a subscription silently breaks a system. Keep the subscription block byte-identical in behaviour; only the rendered JSX around it changes.
2. **Pause protocol** — `engine.stop()` + `setPaused(true)` on open, `engine.start()` + `setPaused(false)` on close; `hudHidden = paused || cinematic !== null`; the pause overlay's long render condition. If a redesigned panel forgets to stop/start, the game runs behind a modal (or freezes after it closes).
3. **Panel `{ ok, reason }` contracts** — `insufficient`, `already-owned`, `maxed`, `already`, `not-owned`, `too-fast`, `unavailable`. Buy/upgrade/select feedback depends on these exact strings. Do not rename or swallow them (except ShopPanel's existing `too-fast` swallow, which is intentional).
4. **DialoguePanel typewriter** — 28 ms/char base, +120 ms after `./!/?`, +60 ms after `, / ; / : / — / …`; timer + counter in refs; two-tap Continue; choices only after the line is fully shown; Esc refused at choice nodes; remount per node via `key={nodeId}`. Phase 4 touches CSS + the portrait only.
5. **CinematicOverlay Esc gating** — Esc works only when `!dialogueOpen`; the overlay does NOT pause the engine. A redesign must not add a pause or change the Skip behaviour.
6. **StoryCompleteScreen outro sequencing** — `playStoryOutro(outro, () => continueStoryMission())` with fallback. If the continue call is lost, the story soft-locks after the finale.
7. **TouchControls direct InputState mutation** — joystick/moveX/moveY/handbrake, `addLook(input, dx*1.6, dy*1.6)`, pointer-capture try/catch. Phase 2 touches layout CSS only.
8. **Preview scenes' dispose logic** — VehiclePreview/CharacterPreview own small Three.js scenes using `buildVehicleMesh` / `createCharacter` + `applyOutfit`. Phase 5 touches the container size only; a leak or a removed dispose breaks the garage/outfits.
9. **MainMenu direct save reads** — `loadMissionProgress`, `buildBoardState`, `loadCashBalance`, `trySelectMissionInProgress`, `loadStoryProgress`, `buildStoryBoardState`, `trySelectStoryMissionInProgress`. Phase 1 keeps these exact calls; the status line must keep reading live progress.
10. **SettingsPanel key contract** — exact `GameSettings` keys + `{...settings, [key]: value}`. A restyled control that writes a wrong key silently drops a setting.
11. **ShopPanel `too-fast` swallow** — intentional (engine 500 ms double-click guard). Do not "fix" it into an error toast.
12. **RangePanel 9.4 feedback** — disabled Buy with shortfall text. The 9.4 fix was never live-verified in a browser; Phase 5 must verify it live, not assume it.
13. **Prompt conditions in GameCanvas** — `nearVehicle` / `nearInteractable` / `nearGarage` drive the interaction prompts. A HUD restructure must keep these conditions, not hardcode prompts.

### Other risks

- **Minimap / pause map are new UI, not redesigns.** They need the static city layout + existing engine state only. Risk is scope creep (adding live traffic/police dots would need engine output that does not exist) — Phase 2/3 scope is player + mission markers only.
- **Font loading:** self-hosted woff2 keeps the build offline-safe; a Google Fonts CDN link would make the menu depend on the network. Use `@font-face` + local files.
- **CSS migration risk:** retiring old classes screen-by-screen leaves dead CSS until Phase 6; a big-bang delete would break un-migrated screens. Keep the old rules until their screen migrates.
- **Mobile regression risk:** the single 640px breakpoint does a lot of repositioning. Every phase re-checks 390px; the Phase 6 mobile pass is the last line, not the first.
- **Save-format risk:** none — no phase touches save keys, mission definitions, campaign progression, vehicle physics, police AI or combat logic. The transformation is presentation only.

---

## 7. Baseline test results

All on branch `ui/gta-vice-city-transformation` at commit `053e76d` (identical source to the release).

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **Exit 0** (clean) |
| `npm run build` | **Passes** — `index-jLcIAx51.js` 1,153.91 kB / gzip 314.22 kB; CSS `index-C5hPDC_0.css` 43.82 kB / gzip 8.21 kB |
| qa81 (release run, same source) | **GREEN** (log `~/workspace/qa-shots/qa81-final.log`; carbine mag read 27 — known pre-existing flake) |
| CH1 story regression (release run, same source) | **COMPLETE, all 8 checks true** (2.1–3.3, June ending then replay-flip to Mara, cash 5,000→17,400, Vortex RS owned once, all 10 missions + 3 chapters complete after reload, console none; log `~/workspace/qa-shots/qa9f-final-ch1.log`) |
| UI audit screenshots (this phase) | Desktop 17 + mobile 7 captured; **zero console/page errors** on every run (logs `ui-audit-desktop.log`, `ui-audit-mobile.log`, `ui-recapture-range.log`, `ui-probe-range-css.log`) |
| Live build identity | Live bundle `index-jLcIAx51.js` SHA-256 `b5c1366c18099c17791aed9e6a73b92531ed92bdf8d90d58a3a583c8e6645b4f`, byte-identical (1,153,916 B) to the local release build |

**Not re-run on the UI branch** (same source as release, so not required for a Phase 0 baseline): qa81 was not re-executed on the branch — it was GREEN on this exact commit from the release run. It will be re-run at every implementation phase.

**Known gaps carried into the transformation (unchanged by it):** 9.4 RangePanel fix never live-verified in a browser; touch drive joystick + vehicle enter/exit at 390px untested; desktop FPS not re-measured since G0 (Sachi-measured 60/55/60); police issues 5.1/5.2/5.3/5.9, 9.3 no Esc/pause, 8.2 no yellow light, 8.18 shadow frustum, 1.2 evade wart + no aim pose — all out of scope for a presentation-only transformation.

---

## 8. Git branch and commit information

| Item | Value |
|---|---|
| Repository | `sachirokadia/vice-city-stories` (private) |
| Production branch | `main` — **untouched by this work** |
| Release baseline | `053e76d` — "Release: Vice City Stories — full campaign, stable build" (114 files) |
| UI branch | `ui/gta-vice-city-transformation` — created from `main` @ `053e76d` |
| Working tree at branch creation | Clean (verified before and after branching) |
| Remote `main` | Verified `053e76d` (`git ls-remote origin main`) |
| Changes on the UI branch so far | **None to game code.** This audit document only (to be committed as an audit-only commit). |
| Push / deploy | **Not done. Not to be done without explicit approval.** |

### Harness notes (for later phases)

- QA scripts live in `~/workspace/qa-shots/`: `vcs-ui-audit-shots.mjs` (desktop), `vcs-ui-audit-shots-mobile.mjs` (mobile 390×844 touch), `vcs-ui-recapture-range.mjs`, `vcs-ui-probe-play.mjs`, `vcs-ui-probe-range-css.mjs`; regression scripts `vcs-qa81.mjs`, `vcs-qa83.mjs`, `vcs-qa84.mjs`, `vcs-qa85.mjs`, `vcs-qa85-mobile.mjs`, `vcs-qa9f-playthrough.mjs [FRESH|CH1]`, `vcs-qa9f-saveaudit.mjs`, `vcs-qa9f-perf.mjs`.
- Headless SwiftShader boot takes 30–120 s (PMREM + probe + city build); use a 120 s engine wait, never 20–30 s.
- Playwright `waitForFunction` signature is `(fn, arg, options)` — pass `null` as the 2nd argument, `{ timeout }` as the 3rd.
- Panels fade in via `busted-in` (0.6 s nominal) but CSS animations crawl at 1–5 FPS headless — wait ≥1.2 s after a panel selector resolves before screenshotting, or panels capture ghosted (see §3.6 — Phase 1 fixes the underlying fragility).
- Panel selectors (verified): Settings `.panel-overlay[aria-label="Settings"]`, About `.panel-overlay[aria-label="About Vice City Stories"]`, boards `.mission-board` / `.story-board`, garage family `.garage-overlay` + `.garage-panel` (shop `.shop-panel`, outfits `.garage-overlay[aria-label="Outfits"]` — there is NO `.outfits-panel` class, collection `.collection-panel`, range `.range-panel`), dialogue `.dialogue-panel`, busted `.busted-overlay`, pause `.pause-overlay`. Close buttons: `.panel-close` (✕), `.mission-board-close` ("Close"), `.garage-close` ("Close garage").
- Dialogue close helper (needed before garage/pause steps): click Continue, or the first `.dialogue-choice` when choices show, until `.dialogue-panel` is gone (up to 20 iterations) — `cancelStoryMission()` alone does NOT close an open dialogue.
- Screenshots of a busy WebGL canvas can hang (30 s timeout): use `m.screenshot({ path, timeout: 30000 })` with one retry after a 2 s sleep, logging and continuing on failure.
- Sim time runs ~5–15% of real time: poll state, never fixed sleeps, after teleports; hold keys, never quick-press (except E: single verified press + polling); teleports set both the handle `position` and `mesh`/`group` position; while driving, triggers read the **vehicle** position; dialogue choices render only after the typewriter finishes.
- Preview server: `npx vite preview --port 4173 --host 127.0.0.1` from the project dir; stop with `fuser -k 4173/tcp`, **never `pkill -f`**.
