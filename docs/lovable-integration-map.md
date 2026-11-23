# Lovable Frontend → Vice City Stories — Integration Map

Produced 2026-11-22 from a read-only inspection of both repos. No Lovable code has been copied, built, or run yet.

## Sources

- **Game:** `~/workspace/vice-city-stories/`, branch `ui/gta-vice-city-transformation`, HEAD `5d28869` (Phase 2). Production `main` = `053e76d`.
- **Lovable:** `~/workspace/lovable-vcs-frontend/` (cloned from `sachirokadia/pixel-perfect-replica`, HEAD `4507d56`). Kept separate and unchanged.
- **Lovable docs read:** `INTEGRATION_HANDOFF.md`, `GAME_UI_INTEGRATION_MAP.md`, `AGENTS.md` (prototype boundary: visual prototype only, must not replace the engine or its persistence).

## What the Lovable repo actually is

- TanStack Start + React 19 + Vite + **Tailwind v4** + shadcn/Radix + **lucide-react**. Bun lockfile. `npm run build` = `vite build`.
- Game UI lives in three files only: `src/components/game/GamePrototype.tsx` (navigation shell + local demo state), `src/components/game/GameScreens.tsx` (18 screens, 1,965 lines), `src/components/game/GameControls.tsx` (shared primitives). The other ~45 `src/components/ui/*` files are stock shadcn components the game screens do **not** use.
- `src/lib/game-data.ts` holds **all mock fixtures** — every number, name, price, and location is demo data, not real game data.
- `src/styles.css` (939 lines) is a Tailwind v4 entry (`@import "tailwindcss"`, `@theme inline`, `tw-animate-css`) plus custom semantic tokens and all screen CSS.
- One image asset: `src/assets/vice-city-sunset.png` (original generated sunset art, used as menu / map / cinematic / range / about background).

## Dependency verdict (do not blindly copy package.json)

| Lovable dependency | Game verdict |
|---|---|
| TanStack Router / Start | **Do not adopt.** The game has no routing; navigation is React state in GameCanvas (panel flags + pause protocol). Lovable's `navigate(screen)` maps to the game's existing panel state. |
| Tailwind v4 + tw-animate-css | **Do not adopt.** The game build is plain CSS (`global.css` + `tokens.css`). Port the Lovable screen CSS to plain CSS (strip Tailwind directives, keep the class rules). |
| shadcn / Radix | **Do not adopt.** The game screens don't use them; the game's Vc primitives cover the same roles. |
| lucide-react | **Do not adopt (recommendation).** The game has its own original VcIcon set (23 icons). Extend VcIcon with the handful of missing glyphs instead of adding a dependency. Alternative (her call): install lucide-react and map `GameIcon` onto it. |
| React 19 / TypeScript / Vite | Already the game's stack. No change. |
| Fonts Bebas Neue + Inter | **Already in the game** (Phase 1, self-hosted in `public/fonts`). No new fonts. |

## Design tokens — they are the same palette

Lovable uses oklch; the game uses hex. They describe the same identity (Lovable pink `oklch(0.73 0.21 5)` ≈ game `#ff5e8a`; amber `0.87/83` ≈ `#ffd27a`; teal `0.78/184` ≈ `#2dd4bf`; cash-green `0.83/139` ≈ `#9be15d`; danger `0.68/26` ≈ `#ff4d3d`; violet `0.3/292` ≈ `#2b1e5e`; ink `0.16/294` ≈ `#120a24`). **No token conflict.** Lovable adds worth adopting into `tokens.css`: `--gradient-pink` (pink→deep-pink), `--shadow-neon`, panel gradients, map colours (water/island/district/road/highlight), lavender, and the `2px` radius scale. The game's `--vc-*` tokens stay canonical.

## Screen-by-screen mapping

| # | Lovable screen | Game component | Verdict |
|---|---|---|---|
| 1 | MenuScreen | `MainMenu.tsx` (Phase 1, approved) | **Keep Phase 1 structure.** Adopt: sunset-art background, brand lockup, bottomline (location + cash), progress block styling. Reject: fictional time/location copy ("TUESDAY · 9:42 PM", "VICE CITY, 1986"), demo cash, shortcuts row (demo-only links). |
| 2 | GameplayScreen (HUD) | GameCanvas + Mission/Story/Combat/Sprint/Encounter/Contract HUDs + Minimap (Phase 2) | **Mostly done in Phase 2.** Adopt: shared toast system (NEW — game has none), mission-notice styling, vehicle-HUD progress bar, player-HUD layout. Keep real data sources. |
| 3 | CityMap (mini) | `Minimap.tsx` (Phase 2, real) | **Keep Phase 2.** Lovable's is circular + fictional. Phase 2's chamfered square is deliberate (a circle clips city corners) and draws the real city. |
| 4 | MapScreen (full map) | **Does not exist** | **New build.** Lovable layout is portable (map + sidebar: selected location, legend, zoom, waypoint button) but geometry must be real: `generateLayout(quality)` + player position/heading + real markers (garage, store, mission, coins). Biggest new piece in Group 2. |
| 5 | PauseScreen | Pause overlay in `GameCanvas.tsx` (legacy: Resume/Settings/Quit) | **Phase 3 scope.** Adopt Lovable's 10-link hub (Resume, Map, Statistics, Missions, Story, Garage, Outfits, Settings, Controls, Main Menu) — but opening a board from pause must return to pause, not resume; the pause protocol needs care. |
| 6 | StatisticsScreen | **Does not exist** | **New build, reduced.** Real data only: story x/10, jobs x/5, coins x/10, vehicles x/4, current cash. **Omit** playtime and cash-earned — the engine tracks neither. |
| 7 | StoryScreen | `StoryBoard.tsx` | Adopt the chapter-list + detail layout. Real data: real chapter/mission names (FIRST LIGHT, DOCKSIDE STATIC, SIGNAL LOST, TAIL SPIN…), real states, existing selection callbacks. |
| 8 | MissionBoardScreen | `MissionBoard.tsx` | Adopt the job-list + detail layout. Real data: BEACON RUN $500, MIDNIGHT DELIVERY $750, LOST CONNECTION $600, DON'T LOSE THEM $1,000, NO WAY OUT $1,500. |
| 9 | DialogueScreen | `DialoguePanel.tsx` (**must not disturb** typewriter) | Adopt the visual frame (portrait card + copy panel + choices). Keep the typewriter logic exactly. Portrait: Lovable's is a CSS placeholder ("L" initial); the game has no character portraits — use speaker name/initial or omit art. Reject fictional Lena Vale content. |
| 10 | Cinematic frame | `CinematicOverlay.tsx` | Adopt frame styling (letterbox + top bar) only. Esc gating stays. |
| 11 | GarageScreen | `GaragePanel.tsx` + `VehiclePreview.tsx` | Adopt the showcase + details layout (price, stats, paint, upgrades, buy). Keep the real 3D VehiclePreview — do **not** use Lovable's SVG VehicleArt as the vehicle. Real prices ($0/$2,000/$3,500/$2,800), paint $150, upgrades ≤3. Reject fictional prices ($45k/$68k/$52k) and derived acceleration. |
| 12 | ShopScreen | `ShopPanel.tsx` | Layout is portable (categories + product list + detail), but the real Mart has 3 items in 1 category (Water $10, Snack $20, Energy $35). Adopt detail-panel styling; do not invent categories or the fictional items (Service Pistol, SMG, armor…). |
| 13 | OutfitsScreen | `OutfitsPanel.tsx` + `CharacterPreview.tsx` | Adopt layout. Keep the real 3D CharacterPreview — do **not** use Lovable's CSS CharacterIllustration. Real outfits/prices (teal $300, coral $250, black $500, default owned). Reject the $2,500 unlock. |
| 14 | CollectionScreen | `CollectionPanel.tsx` | Adopt the coin-grid + feature-panel layout. Real data: 10 Sunset Coins, real found state from save. |
| 15 | RangeScreen | `RangePanel.tsx` | Adopt the top summary bar (targets/accuracy/time) + bottom weapon-bar styling. Keep the real range logic (3D shooting, weapon rack, carbine $1,200). Lovable's click-target interaction does **not** map. |
| 16 | SprintScreen | `SprintHUD.tsx` | Adopt the sprint HUD styling (time/position/checkpoints bar) for the running HUD. Keep real checkpoint logic. Real reward $150, not $1,800. |
| 17 | SettingsScreen | `SettingsPanel.tsx` | Adopt the sectioned layout + slider/toggle/stepper styling for the **real** settings only (quality, shadows, showFps, invertY, pedestrians, traffic, police, pursuitDifficulty, wantedEnabled). **Omit** Lovable's fictional settings (brightness, motion blur, VSync, resolution, film grain, depth of field, volumes, subtitles, aim assist, difficulty, reduce flashes, high-contrast, text size). |
| 18 | AboutScreen | `AboutPanel.tsx` (Phase 1, accurate copy) | Adopt the art + facts layout. Lovable's fact list matches the real game (3 chapters, 10 missions, 2 endings, 5 jobs, 4 cars, wanted system, range & sprint, 10 coins, mart + outfits). Keep Phase 1's accurate copy. Sunset art fits here. |
| 19 | StoryCompleteScreen | `StoryCompleteScreen.tsx` + `MissionCompleteScreen.tsx` | Adopt styling (check mark, MISSION COMPLETE, name, reward, return buttons). Real mission name + real reward. |
| 20 | EventStatesScreen | `BustedScreen.tsx` + `DownedScreen.tsx` | Adopt the tone system (success/danger/amber) + preview layout for the real busted/downed screens. |
| — | Toast (GamePrototype) | **Does not exist** | **New shared toast system.** Port Lovable's Toast (fixed top-centre, tone variants, 3.4s auto-dismiss). Genuinely useful — the game has no shared toast; purchases/mission events use inline feedback. |

## Mock data that must never enter the game

- Cash $12,400 / earned $28,750; playtime 12:34:56; wanted 2 stars; health 82; ammo 30/120; speed 72 MPH.
- Fictional missions: Neon Welcome, The Long Way Home, A Favor in Pink, Southbound, Loose Ends, The Art of the Deal, No Turning Back, A City Divided, The Other Side, Last Call. Fictional jobs: Midnight Delivery $1,800, Harbor Heat $2,400, Pink Slip $3,200, Quiet Hours $2,100, High Tide $2,800.
- Fictional vehicle prices ($45,000/$68,000/$52,000) and stats (86/72/78 etc.).
- Fictional shop items/prices, outfits + $2,500 unlock, sprint reward $1,800, range score/time, dialogue reward +$1,250.
- Fictional map locations/percentages (Ocean Drive 24/27, Vice Point 72/22, Little Havana 38/61, Downtown 63/46, Marina 79/67, Sunset Keys 21/78) and fictional road geometry.
- Fictional settings defaults (brightness 72%, volumes, etc.) and fictional time/location copy (Tuesday 9:42 PM, 1986, Friday August 14).

## Real data sources (already verified in the game)

Cash → `getStats().cash` / `vice-city-stories.cash.v1`. Missions → `MissionManager` / `buildBoardState`. Story → `StoryCampaign` / `buildStoryBoardState`. Vehicles → `Garage` / `getGarageState()`. Health/ammo → `CombatHUD` combat state. Wanted → `Wanted` (heat 0–100, levels at 10/25/45/70/90). Speed → `getStats().speedKmh` / gear. Collectibles → `Collectibles` / collection save. Settings → `GameSettings` contract. All 17 GameCanvas callbacks, `hudHidden`, pause protocol, panel `{ok,reason}` contracts, DialoguePanel typewriter, CinematicOverlay Esc gating, StoryComplete outro, TouchControls InputState, VehiclePreview/CharacterPreview lifecycle — all preserved.

## Integration order (per the brief)

- **Group 1 — Gameplay:** HUD restyle onto Lovable's layout + shared toast (new) + vehicle/player HUD polish. Minimap stays Phase 2 (real).
- **Group 2 — Navigation:** Pause hub (Phase 3 scope), full-screen map (new, real geometry), statistics (new, reduced), settings restyle (real settings only).
- **Group 3 — Campaign:** Story board, mission board, dialogue frame, cinematic frame, mission completion.
- **Group 4 — Activities:** Garage, shop, outfits, collection, range, sprint.
- **Group 5 — Remaining:** Main menu refinement (sunset art + bottomline), About, notifications (toast covers it), busted/downed, mobile refinements.

## Assets

- `vice-city-sunset.png` (Lovable's original generated art) is the one asset to copy into the game's `public/` for menu/map/cinematic/range/about backgrounds — pending size/licence check and her approval.
- Lovable's `VehicleArt` (SVG car) and `CharacterIllustration` (CSS character) are **not** adopted — the game has real 3D previews.
- Lovable's `CityMap` SVG (fictional island/roads) is **not** adopted — the real map comes from `generateLayout`.

## Open questions for her

1. **Build verification:** the Lovable repo needs `npm install` + `vite build` to confirm it builds independently. That runs its code — needs her explicit go-ahead (see the risk note in the report).
2. **Icons:** extend VcIcon (no new dependency) or install lucide-react?
3. **Sunset art:** copy `vice-city-sunset.png` into the game for menu/about/cinematic backgrounds?
4. **Full map + statistics:** both are new screens (not redesigns). Confirm they're wanted as part of this integration.
5. **Pause hub:** opening boards/garage from pause is Phase 3 scope — confirm the 10-link hub is the target, or a smaller pause (Resume/Settings/Quit + Map/Stats).
