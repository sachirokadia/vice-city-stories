# Phase 9A — Story Mode Architecture Proposal

**Project:** Vice City Stories (`~/workspace/vice-city-stories`)
**Date:** 19 Nov 2026
**Status:** Design only. No implementation code was written, and no
existing project file was modified. Awaiting approval before Phase 9B.

**One-line summary:** a separate Story Campaign system that sits
*beside* the existing five job missions and the two combat contracts —
same world, same engine, same cash — with three original chapters,
ten story missions, a data-driven dialogue system, and a cheap
camera-only cinematic player. Everything is additive: the five
missions, the contracts, the encounters, the garage, the shop, the
range and all save data keep working exactly as they do today.

**On the reference images:** the screenshots sent with this phase are
GTA-style reference art. Nothing from them is copied — no GTA
characters, storylines, maps, logos or dialogue. The campaign below
is original: new characters, new plot, new dialogue, built on this
game's own city, systems and locations.

---

## 1. Current-system inspection findings

Verified against the actual code on 19 Nov 2026 (not from memory).
Line numbers are from the files as they stand today.

### 1.1 The mission system (the template the story reuses)

- **`src/game/MissionTypes.ts`** — the data contract. A mission is a
  `MissionDef`: `id`, `title`, `description`, `kind`
  (`delivery | exploration | tail | escape`), `giver` (a string, not a
  character), `startMarker`, `discoveryRadius`, `timeLimit` (0 =
  untimed), `reward`, `unlockAfter`, optional `startHeat`, and an
  ordered `objectives` list. Objective types today:
  `reach | interact | enterVehicle | checkpoint | deliver | follow |
  evade`. Each objective has `id`, `type`, `text`, `target {x, z}`,
  `radius`, optional `timeBonus` / `flashText`, and `follow` params
  for tail jobs. Runtime state is
  `idle → available → active → complete / failed`, with
  `MissionFailReason` of `timer | busted | cancelled | lost |
  spotted`. The HUD contract is `MissionHudState` (title, objective
  text, distance, bearing, time left, cash, reward, flash, prompt,
  marker, hint), reported ~10×/s. The engine never reads mission
  internals — it renders what `getHudState()` reports.
- **`src/game/MissionDefinitions.ts`** — the five job missions, all
  data. Unlock chain: BEACON RUN → MIDNIGHT DELIVERY → LOST
  CONNECTION → DON'T LOSE THEM → NO WAY OUT. Givers: Mara Voss
  ($500), Rico Hale ($750), June Park ($600), Vic Marino ($1,000),
  Dana Cole ($1,500). Every coordinate is a real place in the city
  (spawn (0,0,8), Beacon Tower (0,−172), south-west dock (−114,144),
  west park (−90,60), east park (90,−60), boardwalk (133,30), beach
  hideout (180,−30)).
- **`src/game/MissionManager.ts`** — the runtime. Owns the 3D marker
  (one group of three meshes: 60-unit beam, ground ring, floating
  diamond — created once, repositioned per objective), the timer,
  the objective walk, and the tail target vehicle
  (`MissionVehicle.ts`, a teal sedan that drives the lane graph and
  exists only while the tail mission is selected). Public handle:
  `update`, `tryInteract`, `cancel`, `retry`, `replay`,
  `continueAfterComplete`, `dismissFailed`, `getHudState`,
  `getSelectedDef`, `selectMission`, `getBoardState`, `getCash`,
  `spendCash`, `addCash`, `getTargetVehiclePos`, plus two QA hooks.
  Cash is the single source of truth here: the garage, shop and
  contracts all spend through `missions.spendCash()` / `addCash()`.
  Arrest mid-mission fails the mission (`busted`).
- **`src/game/MissionProgress.ts`** — persistence for the job
  missions: key `vice-city-stories.missions.v1`, shape
  `{completed: string[], selected: string | null}`. Cash is a
  separate key, `vice-city-stories.cash.v1` (bare integer string).
  Loads are defensive (`try/catch` + validation, fall back to
  defaults). The main menu reads the board without starting the
  engine, so this module has no Three.js dependency.

### 1.2 Combat contracts (the closest analogue to story missions)

- **`src/game/Contracts.ts`** (624 lines) — two optional contracts
  (DOCKSIDE TROUBLE, elimination, $800; HOLD THE LINE, defense,
  $1,200) in a separate COMBAT CONTRACTS section of the mission
  board. A contract is accepted from the board, then the player
  walks into a gold ring to start. Leaving the ring resets the
  attempt; abandoning returns it to dormant; TAKEN DOWN or the
  beacon reaching 0 health fails it. First clear pays full cash
  plus an ammo restock; replays after a 180 s wall-clock cooldown
  pay ammo only. State lives under its own key,
  `vice-city-stories.contracts.v1` (`{completed, lastCompletedAt}`),
  and cash always goes through the mission manager. Waves are
  pre-spawned dormant encounters, one activated at a time, 8 s
  recovery between waves, max 3 active per contract. The protected
  objective is a supply crate + pulsing beacon, 100 HP, 4 damage
  per enemy hit within 4 m.
- **`src/game/Encounters.ts`** — the two 8B zones (South Beach,
  North Dunes), same reward/cooldown shape as contracts, key
  `vice-city-stories.encounters.v1`.

### 1.3 The engine (what a story system plugs into)

- **`src/game/GameEngine.ts`** (2,014 lines) — one class, created
  once per session by `GameCanvas.tsx`. It owns every subsystem
  handle (`missions`, `contracts`, `encounters`, `enemies`,
  `combat`, `wanted`, `police`, `arrest`, `crowd`, `traffic`,
  `vehicle`, `player`, `sprint`, `collectibles`, `range`,
  `garage`, `shop`, `outfits`, `inventory`) and drives them from
  a single `tick()` (dt capped at 0.1). Tick order that matters
  for the story: input queues → player/vehicle update → crowd /
  traffic / police / wanted / arrest → missions → collectibles /
  range / combat / sprint → enemies → encounters → contracts →
  HUD reporting (~10 Hz). The engine exposes `window.__vcsEngine`
  for QA.
- **`EngineCallbacks`** (`GameEngine.ts:101–130`) is the bridge to
  React: `onReady`, `onFps`, `onQualityChange`, `onError`,
  `onDrive`, `onWanted`, `onArrest`, `onMission`, `onGarageEnter`,
  `onShopEnter`, `onSprint`, `onCombat`, `onRangeEnter`,
  `onDowned`, `onEncounter`, `onContract`. Any new system state
  (dialogue lines, cinematic progress, story HUD) reaches the UI
  by adding one callback here — this is the established pattern.
- **Engine pause:** `engine.stop()` / `start()` freezes the
  `requestAnimationFrame` loop. Every panel (mission board, shop,
  garage, range) already pauses the engine while open. HUDs do
  not pause. A dialogue box or a cinematic reuses this pause.
- **E-key priority chain** (`GameEngine.ts:1519–1531`, consumed
  once per frame): mission accept → garage entrance → nearest
  registered interactable → enter/exit car. F is surrender, R
  reload, Q / 1 / 2 weapon switch. Touch buttons call the same
  `try*` methods, so keyboard and touch behave identically.
- **`src/game/Interactables.ts`** (70 lines) — a central registry.
  Entries are `{id, name, x, z, radius, prompt, available(),
  onInteract()}`. Registered today: `sunset-mart` (43,24),
  `sunset-sprint` (133,90), `sunset-range` (156,−90). The registry
  never decides priority — the engine's E chain does. Story
  walk-up triggers (a character to talk to, a dead drop to pick
  up) register here.
- **Camera** (`GameEngine.ts:1827–1873`): third-person orbit
  (`camYaw`, `camPitch` clamped −0.1…1.1 on foot, 0.05…1.0
  driving, `camDistance` 4.5–14 via wheel). `updateCamera(dt)`
  lerps between a walk position (6 m look-ahead) and a chase
  position, and eases walk↔drive. The only camera-animation
  primitive is that lerp plus weapon recoil pitch. There are no
  keyframes, no paths, no tween helper, no camera-cut API.
- **Markers** are Three.js meshes, not sprites: the mission
  marker (beam + ring + diamond), contract/encounter gold rings
  + canvas-texture signs, the beacon ring. No floating text
  labels exist.

### 1.4 Enemies, wanted, arrest (the story's conflict systems)

- **`src/game/Enemies.ts`** (739 lines) — 3 enemy variants
  (`EnemyDefs.ts`: Yard Enforcer 100 HP/10 dmg, Lot Runner 60
  HP/7 dmg, Northgate Lookout 80 HP/12 dmg) with an 8-state AI
  (patrol / idle / investigate / alert / engage / cover / search /
  defeated). Leash 45 units, windup 0.4 s, cover below 40%
  health. 3D line of sight is an exported
  `hasLineOfSight(ax, ay, az, bx, by, bz, buildings)` — a
  segment-vs-AABB slab test against real collision boxes. The
  handle exposes `spawnEncounter`, `activateEncounter`,
  `deactivateEncounter`, `resetEncounter`, `setObjective` /
  `clearObjective` (defense), `damageEnemy`, `hitTargets`,
  `enemyStates`, `onPlayerShot`. The context carries
  `onEnemyDefeated(id, encounterId)` and `onObjectiveDamage`.
  Story 'defeat' and 'defend' objectives subscribe to these
  existing callbacks — no new enemy architecture.
- **`src/game/Wanted.ts`** — heat 0–100, levels at
  [10, 25, 45, 70, 90]; offences ped-hit +25, car-hit +12,
  speeding +8, red-light +8, 1.5 s offence cooldown;
  pursuit → search after 6 s unseen; heat decays 1.5/s while
  searching. Public: `getState`, `reset`, `setHeat`, `addHeat`.
  NO WAY OUT already proves a mission can set heat on accept
  (`startHeat: 45`).
- **`src/game/Arrest.ts`** — none → prompt → surrendering →
  busted (F key / SURRENDER button, 2.8 s). `respawn()` restores
  the player (0,0,8), the GT home, and resets wanted/police.
  Combat defeat is separate: **TAKEN DOWN** (`DownedScreen.tsx`,
  orange, does not clear wanted).

### 1.5 Characters (what exists, and the gap)

- **`src/game/Character.ts`** (239 lines) — one original
  procedural protagonist (~1.85 tall, ~22 meshes): grey hoodie
  over cream tee, gold chain, dark cargo trousers, sneakers.
  `CharacterRig` has named pivots (root, body, torso, head,
  legL/R, kneeL/R, armL/R, elbowL/R) so `CharacterAnimation`
  can pose it. `CharacterMaterials` (10 recolourable materials)
  is how outfits recolour the model without rebuilding it.
  `CharacterParts` lets the hood and chain hide.
- **`src/game/Player.ts`** (188 lines) — kinematic controller
  (no physics engine): walk 6 u/s, sprint 10.5 u/s, accel
  25 u/s², camera-relative WASD, circle-vs-AABB collision
  (radius 0.6), world clamp ±195. Animation runs on actual
  displacement speed. Special poses: `setSurrendered`
  (hands-up) and `setDowned` (lies flat).
- **`src/game/CharacterAnimation.ts`** — `AnimState =
  'idle' | 'walk' | 'run' | 'sprint'`; gait phase by stride
  length; joints ease toward target poses; turning leans the
  torso. `updateSurrender(dt)` is a separate pose path.
- **`src/game/NPC.ts`** — 12 original pedestrian archetypes,
  pooled (0/10/18/28 by settings), walking `PedestrianPaths`.
  They have no names, no dialogue, no interaction — ambient
  crowd only.
- **Named characters today are strings only.** The only names in
  the game are `giver` fields: Mara Voss, Rico Hale, June Park,
  Vic Marino, Dana Cole (missions) and Rook Calloway (contracts).
  There is no NPC dialogue system, no character entity with a
  name in the world, no giver NPC model, and no conversation UI.
  Givers appear only as "From {name}" text on the board and HUD.

### 1.6 HUD / panels (the presentation pattern)

- All rendering is React state in **`src/components/
  GameCanvas.tsx`**, fed by the engine callbacks (~10 Hz).
  Panels pause the engine; HUDs do not. The pattern per
  component is the same: a small props interface, a `return
  null` gate, and CSS classes in `global.css`.
- `MissionBoard.tsx` — all five missions in unlock order (kind
  badge, reward, giver, locked-by), cash, plus the COMBAT
  CONTRACTS section. Opens via `openBoard()` (pauses the
  engine); closes via `.mission-board-close` or selecting a
  mission. The ☰ Missions button only opens — it is not a
  toggle.
- `MissionHUD.tsx` — mission card: title, cash, current
  objective + direction arrow + live distance, countdown
  (urgent ≤ 15 s), objective n/m, hint line, flash message,
  Abandon button. Renders only while the mission is
  `available` or `active`; complete/failed screens take over.
- `ContractHUD.tsx` — accepted/active contract: name, reward,
  objective, hostiles left, wave n/3 + recovery countdown,
  beacon health bar, Abandon button; completion/failure toasts.
  `EncounterHUD.tsx` — zone banner + cleared toast + cooldown
  chips. `CombatHUD.tsx` — crosshair, hit marker, weapon/ammo,
  health bar, damage vignette. `SprintHUD.tsx` — countdown,
  checkpoints, result screen.
- `BustedScreen.tsx` / `DownedScreen.tsx` — full-screen
  overlays. `MissionCompleteScreen.tsx` /
  `MissionFailedScreen.tsx` — reward and failure screens.
  `GaragePanel`, `ShopPanel`, `RangePanel`, `OutfitsPanel`,
  `CollectionPanel` — the five panels. `TouchControls.tsx` —
  mobile joystick + buttons. Drive HUD (speedometer + gear) and
  the wanted pill are inline in `GameCanvas.tsx`.
- **No cinematic, cutscene, dialogue, letterbox, or camera-tween
  system exists.** A grep for those terms across `src/` returns
  exactly one hit: a comment in `MainMenu.tsx` ("Cinematic main
  menu — pure React/CSS, no Three.js"). Dialogue and cinematics
  must be built from scratch. The reusable pieces are the pause
  mechanism, the orbit camera + lerp, the callback/state-report
  bridge, the `CharacterRig` pivots (for staging characters in a
  scene), the `InteractionRegistry` (for walk-up triggers), and
  the mission/contract state-machine shapes as templates.

### 1.7 Persistence inventory (all 12 keys — verified by grep)

| Key | Owner | Contents |
|---|---|---|
| `vice-city-stories.settings.v1` | `Settings.ts` | quality, shadows, fps, invertY, pedestrians, traffic, police, pursuit difficulty, wanted toggle |
| `vice-city-stories.missions.v1` | `MissionProgress.ts` | `{completed: string[], selected: string \| null}` |
| `vice-city-stories.cash.v1` | `MissionProgress.ts` + `MissionManager.ts` | bare integer string — the shared cash balance |
| `vice-city-stories.garage.v1` | `GarageProgress.ts` | `{owned, selected, paint, upgrades}` (max level 3) |
| `vice-city-stories.inventory.v1` | `Inventory.ts` | `{water, snack, energy}` counts |
| `vice-city-stories.outfits.v1` | `Outfits.ts` | `{owned, selected}` outfit ids |
| `vice-city-stories.collectibles.v1` | `Collectibles.ts` | `{collected: string[]}` — the 10 Sunset Coins |
| `vice-city-stories.sprint.v1` | `Sprint.ts` | `{bestTime, completions}` |
| `vice-city-stories.weapons.v1` | `Weapons.ts` | `{owned, equipped, reserve, mags}` — per-weapon magazines since 8B |
| `vice-city-stories.range.v1` | `Combat.ts` | `{totalHits, totalShots}` — cumulative range accuracy |
| `vice-city-stories.encounters.v1` | `Encounters.ts` | `{completed, lastCompletedAt}` — 180 s replay cooldown |
| `vice-city-stories.contracts.v1` | `Contracts.ts` | `{completed, lastCompletedAt}` — 180 s replay cooldown |

Not persisted (all reset on reload): wanted heat/level, police
state, arrest state, player/vehicle position, health, mission
runtime state (active objectives/timer), contract wave and
objective health, enemy states. Every save is defensive
(`try/catch` + validation on load, plain JSON on save); no
migrations exist and new fields fall back to defaults.

---

## 2. Proposed story architecture

### 2.1 The shape: a sibling system, not a replacement

A new `StoryCampaign` handle lives in the engine **next to**
`missions`, not inside it. The five job missions and the two
contracts keep their own managers, keys, boards and HUDs, and
keep working. The story campaign is a parallel track that uses
the same world, the same cash, the same enemies, the same police
and the same interaction patterns — but its own data, its own
state machine, its own save key, and its own board.

The one hard rule: **only one mission runs at a time.** A job
mission and a story mission cannot both be `active`. The engine
holds a single "active mission" guard — accepting a story
mission while a job mission is active is refused (and vice
versa), with a one-line HUD note ("Finish or abandon your
current job first"). Contracts and encounters are different:
they are zone-triggered, not board-accepted, so they can stay
available during a story mission — but a story mission that
needs combat in the same place as an active encounter would
confuse the enemy accounting, so story combat zones are placed
away from the two 8B encounter zones and the two 8C contract
zones (see §6 for the locations).

### 2.2 Chapters, missions, prerequisites

- A **campaign** is an ordered list of **chapters**.
- A **chapter** is an ordered list of **missions** plus an
  intro cinematic and an outro cinematic.
- A **chapter unlocks** when the previous chapter's final
  mission is completed. Chapter 1 is open from the start — a
  new player can begin the story without finishing any job
  mission.
- A **mission unlocks** when the previous mission in its
  chapter is completed, **or** when its `prerequisites` are met.
  Prerequisites are a small, explicit list, evaluated against
  campaign progress and the shared game state:
  - `mission: <story-mission-id>` — that story mission completed
  - `chapter: <chapter-id>` — that chapter completed
  - `jobMission: <job-mission-id>` — that job mission completed
    (lets the story acknowledge the player's free-roam work
    without forcing it)
  - `cash: <amount>` — the player holds at least that much
  - `vehicle: <car-id>` — the player owns that car
  - `flag: <flag-name>` — a campaign flag is set (see §2.5)
  - `outfit: <outfit-id>` — the player owns that outfit
  In practice almost every story mission uses the simple
  sequential rule; prerequisites exist so one or two missions
  can branch (see the Rook choice in §6, mission 2.3) and so
  the finale can require a car the player may not own yet.
- **Main objectives** are the ordered list every mission walks,
  exactly like `MissionDef.objectives`. **Optional objectives**
  are a separate list: they are tracked in parallel, they do
  not block completion, and each one pays a small bonus (cash
  and/or a flag) when done. The HUD shows main objectives in
  the card and optional objectives as a smaller checklist
  underneath. Optional objectives are the replay hook: a
  mission replayed for its optional objectives is a reason to
  come back without re-grinding the story.

### 2.3 Mission runtime states (extends the mission pattern)

```
idle → available → active → complete / failed
                 ↘ checkpoint (resume point inside 'active')
```

Same four states as `MissionRuntimeState`, plus a **checkpoint**
concept inside `active`. Story missions are longer than the
five job missions (multi-step, with dialogue and combat), so a
single failure should not send the player back to the start.
A mission definition marks certain objectives as checkpoints
(`checkpoint: true`). Reaching one snapshots `{objectiveIndex,
playerPos, vehiclePos, timeLeft, flags}` in memory. On failure
the failure screen offers two buttons: **Retry from checkpoint**
(resume at the snapshot) and **Restart mission** (from the
beginning). Checkpoints are session-only, like all other
mission runtime state — quitting to the menu restarts the
mission from the beginning. That is a deliberate limit, stated
here so it is not a surprise later.

Failure reasons extend `MissionFailReason` with story-specific
values: `downed` (TAKEN DOWN), `objective-destroyed` (a
defense target reached 0), `target-escaped` (a tail/evade
target got away), `arrested` (alias of the existing `busted`,
kept distinct in the story HUD copy). Timer failure keeps the
existing `timer` reason.

### 2.4 New objective types (additive, on the existing pattern)

Story missions reuse the seven existing objective types
(`reach`, `interact`, `enterVehicle`, `checkpoint`, `deliver`,
`follow`, `evade`) and add four, all evaluated by extending
`MissionTriggers.ts` — the same place the existing types are
evaluated, so the trigger contract stays in one module:

| Type | Meaning | Built on |
|---|---|---|
| `dialogue` | Talk to a named character (walk up, press E, a dialogue node plays; the objective completes when the node ends) | `InteractionRegistry` + the new Dialogue system (§4) |
| `defeat` | Defeat N enemies in a named encounter/zone | `Enemies.onEnemyDefeated` (already exists) + an encounter id |
| `defend` | Keep a protected objective above 0 HP until the timer or wave count ends | `Contracts` objective pattern (100 HP, `onObjectiveDamage`) — generalised, not copied |
| `collect` | Pick up N items at named points (dead drops, evidence) | `Collectibles` pattern (proximity pickup + a small 3D prop) |

No new enemy, police, vehicle or physics work is needed for
any of these four. `defeat` and `defend` are the 8B/8C systems
with a story wrapper; `collect` is the Sunset Coin pattern
with a different prop; `dialogue` is the new Dialogue system.

### 2.5 Campaign flags (the story's memory)

A flat `Record<string, boolean>` in the campaign save. Flags
are set by dialogue choices, dialogue events, and mission
completions, and read by:

- **conditional dialogue** (a node or a choice only appears
  when a flag is set — §4),
- **prerequisites** (a mission or a choice requires a flag),
- **the finale** (which ending the player gets — §6, mission
  3.3),
- **giver lines** (a character's idle line changes after a flag
  is set, so the world remembers what the player did).

Flag names are namespaced and human-readable, e.g.
`met-rook`, `took-rooks-job`, `refused-rook`, `ledger-found`,
`crane-warned`, `june-trust`, `mara-trust`. Flags are never
set by the engine on its own — only by a dialogue event, a
mission completion, or an optional objective. That keeps the
flag list auditable: every flag has exactly one writer.

### 2.6 Rewards and economy

Story rewards go through the same single cash source of truth
(`missions.addCash()`), so the garage, shop and range all see
the money. First clear pays the full reward; replays pay the
full reward too — the same rule as the five job missions
(consistency beats a second economy). Optional objectives pay
their bonus once per mission per save (tracked in the save as
`optionalDone: string[]`), so they cannot be farmed by
replaying. Two story missions also grant non-cash rewards: a
car unlock (the finale requires the Vortex RS, and one
chapter-2 mission pays it as a reward if the player does not
already own it) and an outfit (a "crew jacket" outfit unlocked
by completing Chapter 2). Both go through the existing
garage/outfit progress modules — no new economy.

### 2.7 Where the story lives in the UI

- **Main menu:** a STORY button next to PLAY (the menu already
  has PLAY / SETTINGS / ABOUT; STORY opens the campaign board).
  The button shows the current chapter and mission ("Chapter 2
  — Two Crews, One City · 2 of 4 done") so the player can see
  progress without opening anything.
- **Story board:** a dedicated `StoryBoard.tsx` panel (not a
  section of the mission board — chapters need room for their
  own layout). It lists chapters in order, missions inside each
  chapter with their state (locked / available / complete /
  replayable), the giver, the reward, and the optional
  objectives. It pauses the engine, like every other panel.
- **Story HUD:** a `StoryHUD.tsx` that reuses the MissionHUD
  layout (title, cash, objective + arrow + distance, countdown,
  objective n/m, hint, flash, Abandon) and adds two lines: the
  chapter name and the optional-objective checklist. It renders
  only while a story mission is `available` or `active`, and the
  job-mission HUD hides while a story mission runs (and vice
  versa) — one mission card at a time, always.
- **World markers:** story missions reuse the existing mission
  marker (beam + ring + diamond) but in a different colour
  (teal, `0x2dd4bf`) so the player can tell a story marker from
  a job marker (yellow) at a glance. One marker exists at a
  time — the active mission's — because only one mission runs
  at a time.

---

## 3. Character bible

All original. No GTA characters, storylines or dialogue are
copied. Existing givers keep their names and their job-mission
roles, and the story gives them a past and a motive that fits
what they already do in the game.

### 3.1 The protagonist — Kai Reyes

- **Who:** 24, a courier. Six months ago he drove into the
  city in a beat-up sedan with a clean record and a debt he
  does not talk about. He now runs packages for anyone who
  pays, because driving is the one thing he is good at and
  the one thing nobody in this city asks questions about.
- **Look:** the existing protagonist model — grey hoodie over a
  cream tee, gold chain, dark cargo trousers. The chain is the
  one thing he owns that is not for sale; it was his
  grandfather's.
- **Motivation:** pay off the debt and build a legitimate life
  — a garage of his own, one day. He takes jobs because he
  needs the money, and he keeps taking them because he cannot
  say no to someone who needs help.
- **Flaw:** he cannot say no to a paying job, and he trusts
  people who pay on time. That is how the story starts.
- **Voice:** dry, short sentences, deflects with a joke when a
  question gets personal. He never talks about the debt.
- **Gameplay role:** the player. His driving skill is why
  everyone hires him; his anonymity is why everyone trusts
  him with things they should not.

### 3.2 Main allies

**Mara Voss** (existing — BEACON RUN giver, HOLD THE LINE
contract giver)
- **Who:** late 30s, runs a dispatch service from a rooftop
  office above the commercial block. She knows everyone in the
  city and owes no one. Every job in the game that pays on time
  passes through her phone.
- **Motivation:** the city runs on trust, and she is the person
  who keeps the trust. She takes a cut of every job and she
  earns it: she never sends a driver into something she would
  not drive herself.
- **Relationship to Kai:** his dispatcher and his first friend
  in the city. She gave him the Beacon Tower run on his first
  week and has sent him work ever since. She is the only person
  who knows about the debt, and the only person who has never
  asked him to explain it.
- **Story role:** the voice of the campaign. She gives the
  first mission, warns Kai when a job smells wrong, and offers
  the first ending in the finale. Her flag is `mara-trust`.
- **Voice:** calm, precise, never raises her voice. She
  answers a question with a better question.

**Rico Hale** (existing — MIDNIGHT DELIVERY giver)
- **Who:** 40s, a dockworker at the south-west loading dock
  who moves crates that are not on any manifest. He has worked
  the docks for twenty years and has never once been searched.
- **Motivation:** his daughter's school fees. Every crate he
  moves is a term paid for. He is not a criminal; he is a man
  with a bill and a forklift.
- **Relationship to Kai:** the man who taught Kai the dock
  roads. He trusts Kai because Kai has never once opened a
  crate.
- **Story role:** the first person who tells Kai the package
  was not what it seemed. He is the one who points Kai at
  June Park.
- **Voice:** tired, funny, swears at the forklift, never at
  people.

**June Park** (existing — LOST CONNECTION giver)
- **Who:** late 20s, a signal-hacker and freelance journalist
  who lost her source three weeks ago. She works out of a
  van with too many antennas, parked wherever the signal is
  best.
- **Motivation:** her source was feeding her the ledger — the
  record of who in the city is paid by whom. The source went
  quiet, and June needs to know whether they are dead or
  bought.
- **Relationship to Kai:** she hires him to find the clues her
  source left behind. She is the only person in the story who
  wants the truth for its own sake.
- **Story role:** the investigator. She decodes the ledger, and
  she offers the second ending in the finale. Her flag is
  `june-trust`.
- **Voice:** fast, precise, talks in lists of three. She
  finishes your sentence when you are slow.

**Dana Cole** (existing — NO WAY OUT giver)
- **Who:** 30s, a getaway driver and ex-racer who retired from
  racing the day she realised she was faster than the people
  chasing her. She drives a car she built herself and she does
  not lend it to anyone.
- **Motivation:** she is out of the life and she intends to
  stay out. She helps Kai because someone helped her get out,
  and she is paying it forward exactly once.
- **Relationship to Kai:** the person who teaches him how to
  lose a tail. She is not his friend; she is his instructor,
  and she is blunt about the difference.
- **Story role:** the escape specialist. She runs the evade
  mission and she is the one who gets Kai out of the city when
  the heat comes down.
- **Voice:** short, instructional, no wasted words. "Brake
  later. Turn earlier. Don't look back."

### 3.3 Rival groups

**The Northgate Crew**
- **Who:** the crew that controls the north docks and the beach
  rackets. Their foot soldiers are the three enemy variants
  already in the game — Yard Enforcer, Lot Runner, Northgate
  Lookout. They wear dark work clothes and they do not talk to
  strangers.
- **What they want:** the ledger. It names every official they
  pay, and if it comes out they lose the docks.
- **Leader:** Silas Crane (see §3.4).
- **Territory:** north docks, north beach, the Beacon Tower
  approach. They are the reason the north end of the city feels
  watched.

**The Harbor Kings**
- **Who:** the crew that controls the south docks. Older,
  quieter, richer. They do not fight in the street; they buy
  the street.
- **What they want:** the ledger too — not to publish it, to
  own it. Whoever holds the ledger holds the city's debts.
- **Fixer:** Vera Kwan (see §3.4).
- **Territory:** south docks, the commercial block, the marina.
  They are the reason the south end of the city feels expensive.

### 3.4 Antagonists

**Silas Crane** — head of the Northgate Crew
- **Who:** 50s, a former port-authority official who realised
  the docks were worth more than the salary. He now runs the
  north side with a ledger of his own: who he pays, who pays
  him, and what happens to people who forget.
- **Motivation:** order. He does not think of himself as a
  criminal; he thinks of himself as the person who keeps the
  docks working when the city cannot. The ledger threatens
  that order.
- **Method:** he does not threaten people. He offers them a
  choice, and then he makes sure they understand the price of
  the wrong one.
- **Story role:** the antagonist of Chapters 2 and 3. He never
  appears until the finale — his crew does his talking until
  then. That is deliberate: the player should hear his name a
  dozen times before they see his face.
- **Voice:** polite, slow, precise. He calls everyone by their
  full name.

**Vera Kwan** — fixer for the Harbor Kings
- **Who:** 40s, a lawyer who stopped practising law the day she
  realised contracts were worth more than verdicts. She hires
  Kai under false pretences in Chapter 2 and she is the one
  who set the whole story in motion.
- **Motivation:** she wants the ledger for her employers, and
  she wants it without a war. A quiet handover is cheaper than
  a street fight.
- **Method:** she hires people, she pays them well, and she
  lies to them about what the job is. She is very good at it.
- **Story role:** the false giver. The mission she gives Kai
  looks like a normal delivery and it is not. When Kai finds
  out, the player gets a choice (see §6, mission 2.3) — and
  that choice is the story's first branch.
- **Voice:** warm, professional, always on time. She remembers
  your name and your rate.

**Rook Calloway** (existing — DOCKSIDE TROUBLE contract giver)
- **Who:** 30s, a freelancer who works for whoever pays. He
  cleared the south docks for the Harbor Kings once, and he
  will do it again if the money is right. He has no crew, no
  territory, and no loyalty — which is why both sides hire him.
- **Motivation:** money, and the freedom that comes with not
  belonging to anyone.
- **Relationship to Kai:** a mirror. Rook is what Kai becomes
  if he keeps taking every paying job and never asks what is
  in the crate. Rook knows it, and it amuses him.
- **Story role:** the choice. In mission 2.3 he offers Kai a
  job — take it and the Harbor Kings owe Kai a favour
  (`took-rooks-job`), refuse it and Rook respects him for it
  (`refused-rook`). The flag changes dialogue in Chapter 3 and
  which of two routes the finale takes.
- **Voice:** amused, unbothered, always one step ahead of the
  conversation.

### 3.5 Supporting characters

**Theo Ashford** — garage mechanic, Sunset Garage
- **Who:** 50s, runs the garage. He has fixed every car in the
  city at least once and he remembers every one of them. He
  gives Kai the Vortex RS in Chapter 2 (see §2.6) and he is
  the person who tells Kai when a car is not worth saving.
- **Voice:** grease, patience, and one-line wisdom.

**Lena Ortiz** — street medic, boardwalk clinic
- **Who:** 30s, a nurse who runs a walk-in clinic off the
  boardwalk. She patches up drivers, dockworkers and anyone
  else who cannot afford a hospital. She is the reason Kai
  survives Chapter 3.
- **Voice:** brisk, kind, does not ask how you got hurt.

**Old Man Ferris** — Beacon Tower keeper
- **Who:** 70s, has kept the tower for forty years. He has
  seen every package, every driver and every lie that has
  passed through the plaza. He gives Kai one line in the
  finale that reframes the whole story.
- **Voice:** slow, certain, talks to the tower as much as to
  you.

**Milo** — 14, a kid who runs errands on the boardwalk
- **Who:** knows every shortcut, every unlocked gate and every
  rumour in the city. He is the player's source for the dead
  drops in mission 3.1.
- **Voice:** fast, breathless, always moving.

**Sana** — food-truck owner, boardwalk
- **Who:** hears everything because everyone eats. She is the
  person who tells Kai that Vera Kwan has been asking about
  him — the warning that starts Chapter 2.
- **Voice:** warm, direct, feeds you while she talks.

---

## 4. Dialogue architecture

### 4.1 The rule: data is data, presentation is presentation

Dialogue lives in `StoryDialogue.ts` (plain data, no React, no
Three.js). The runtime is `Dialogue.ts` (a small state machine,
no rendering). The panel is `DialoguePanel.tsx` (React, no game
logic). This is the same split as
MissionDefinitions / MissionManager / MissionHUD, and it exists
so a writer can add or change a conversation without touching
the engine or the UI.

### 4.2 The data shape

A **dialogue** is a graph of **nodes**. Each node is one beat:

```ts
interface DialogueLine {
  id: string;                 // unique within the dialogue, e.g. 'mara-intro-2'
  speaker: string;            // character id, e.g. 'mara' — resolved to a name + colour
  text: string;               // the line, plain text, one or two sentences
  choices?: DialogueChoice[]; // when present, the player picks; when absent, Continue
  next?: string;              // node id to go to when there are no choices
  condition?: string;         // flag that must be set for this node to be reachable
  event?: DialogueEvent;      // fired when this node is shown
  end?: boolean;              // this node ends the dialogue
}

interface DialogueChoice {
  text: string;               // the player's line, in Kai's voice
  next: string;               // node id
  condition?: string;         // flag that must be set for this choice to appear
  event?: DialogueEvent;      // fired when this choice is picked
  setsFlag?: string;          // flag set by picking this choice
}
```

A **dialogue event** is a plain object the engine already knows
how to carry out — nothing new is invented for dialogue:

```ts
type DialogueEvent =
  | { type: 'setFlag'; flag: string; value?: boolean }
  | { type: 'giveCash'; amount: number }          // via missions.addCash()
  | { type: 'startStoryMission'; missionId: string }
  | { type: 'completeObjective'; objectiveId: string } // for 'dialogue' objectives
  | { type: 'spawnEncounter'; encounterId: string }    // enemies, via Enemies
  | { type: 'setWanted'; heat: number }           // via wanted.setHeat()
  | { type: 'playCinematic'; sceneId: string }    // hands off to §5
  | { type: 'giveVehicle'; carId: string }        // via garage progress
  | { type: 'giveOutfit'; outfitId: string };     // via outfit progress
```

Conditions are flag names. A choice with a `condition` only
appears when that flag is set; a node with a `condition` is
skipped (its `next` is followed) when the flag is not set. That
is the whole conditional system — one flag check, in one place,
in the runtime. No scripting language, no expression parser.

### 4.3 The runtime (`Dialogue.ts`)

A tiny state machine, modelled on the mission manager's shape:

```
idle → open → (advance | choose) → open … → closed
```

Public handle:

```ts
interface DialogueHandle {
  start: (dialogueId: string, startNode?: string) => boolean;
  advance: () => void;            // Continue — next node, or close at 'end'
  choose: (index: number) => void;
  skip: () => void;               // jump to the end node, fire its event, close
  close: () => void;              // close without finishing (only from a safe point)
  getState: () => DialogueState | null;
  dispose: () => void;
}
```

State reported to React (via a new `onDialogue` callback,
§4.5) is:

```ts
interface DialogueState {
  open: boolean;
  speaker: string;        // display name
  speakerColor: string;   // the character's colour, for the name plate
  text: string;           // the current line
  choices: { text: string }[] | null;  // null = Continue button
  canSkip: boolean;
  progress: { node: number; total: number } | null; // '3 / 7' when known
}
```

Rules:

- The engine is **paused** while a dialogue is open (same
  `engine.stop()` the panels use). The world freezes, the
  player cannot move, and no timer runs. Dialogue never
  happens during a timed objective — a mission that needs a
  conversation puts the `dialogue` objective before the timer
  starts, or the timer is paused for the conversation (the
  mission definition says which; the default is that dialogue
  objectives are untimed).
- `advance()` and `choose()` are the only ways forward. Both
  are idempotent per press (no double-advance on a held key).
- `skip()` jumps to the end node, fires that node's event, and
  closes. It is always available, and it is the only way to
  leave a dialogue early — there is no close button on a
  dialogue that has not finished, because a half-finished
  conversation could leave a mission objective uncompletable.
  (The exception is the pause menu: quitting to the main menu
  closes the dialogue and abandons the mission, exactly like
  quitting mid-mission today.)
- If a dialogue's `next` points at a missing node, the runtime
  logs an error and closes the dialogue rather than crashing
  the game. Dialogue data is validated at build time by a
  small checker (every `next` and every choice target must
  resolve to a node in the same dialogue) — see §10.
- The runtime keeps no Three.js state. It does not move the
  camera and it does not stage characters. Staging is the
  cinematic system's job (§5); a plain dialogue (two people
  talking in the world) just opens the panel while the two
  character models stand where they already are.

### 4.4 The panel (`DialoguePanel.tsx`)

Bottom-anchored, above the touch controls, readable at desktop
and 390 px:

- A **name plate** (speaker name, in the character's colour)
  above a **text box** (the line, large enough to read at a
  glance).
- **Continue** (E / Space / Enter / tap) when the node has no
  choices. **Choice buttons** (1 / 2 / 3 keys, or tap) when it
  does — at most three choices per node, so the panel never
  overflows on mobile.
- A **Skip** button (Esc / tap) in the corner, always visible.
- A small **progress** indicator ("3 / 7") when the dialogue
  is linear, hidden when it branches (a branch has no
  meaningful total).
- The text appears with a short typewriter effect (about 30
  characters per second) and a press of Continue / E while the
  text is still typing completes the line instantly instead of
  advancing — the standard two-tap pattern, so a player never
  skips a line by accident.
- The panel is pointer-events: auto only on its buttons; the
  rest of the screen is inert while it is open. It never
  overlaps the health bar or the ammo counter — it sits in the
  same bottom band the sprint HUD uses, and the sprint HUD
  never shows during a dialogue.
- Colours, font sizes and the mobile layout follow the
  existing HUD classes in `global.css` (`.mission-hud`,
  `.contract-hud`). New classes are `.dialogue-panel`,
  `.dialogue-name`, `.dialogue-text`, `.dialogue-choices`,
  `.dialogue-choice`, `.dialogue-continue`, `.dialogue-skip`,
  `.dialogue-progress`.

### 4.5 Engine wiring (the small part)

- `GameEngine` gains a `dialogue` field (a `DialogueHandle`)
  and an `onDialogue` callback in `EngineCallbacks`.
- The `dialogue` objective type calls `dialogue.start(id)` when
  the player presses E at the marker, and completes when the
  dialogue closes.
- The E-key chain gains one entry at the top: if a dialogue is
  open, E advances it (it does not try to interact with the
  world). This is the only change to the E chain, and it is a
  guard, not a reorder.
- Dialogue events are handled by a single `handleDialogueEvent`
  method on the engine that switches on `event.type` and calls
  the existing subsystem methods. No event reaches into a
  subsystem's internals.
- The input system gains a dialogue mode: while a dialogue is
  open, WASD / mouse-look are ignored (the engine is paused
  anyway), and E / Space / Enter / 1 / 2 / 3 / Esc are routed
  to the dialogue handle. The routing lives in `GameCanvas`,
  next to the existing panel key handling — not in `Input.ts`,
  so the gameplay input map does not change.

### 4.6 Writing rules (so the dialogue stays good)

- Every line is one or two sentences. No monologues longer
  than three sentences in a single node — if a character has
  more to say, it is two nodes.
- Kai's choices are written in Kai's voice (dry, short, deflects
  with a joke). A choice that is out of character is a bug.
- No choice is a trap: a choice changes a flag, a line, or a
  reward — it never silently fails a mission or locks the
  player out of the story.
- Every dialogue has an end node, and every end node fires the
  event that lets the mission continue. A dialogue that ends
  without an event is a bug (the build-time checker catches it).
- Giver lines in the world (the "From Mara Voss" text) stay
  as they are. Dialogue is for conversations, not for replacing
  the mission board.

---

## 5. Cinematic architecture

### 5.1 The principle: drive the camera you already have

There is no cinematic system today, and the cheapest correct
one does not build a new camera. The engine already has an
orbit camera (`camYaw`, `camPitch`, `camDistance`) and an
`updateCamera(dt)` that lerps toward a target position. A
cinematic is a list of **shots**, and a shot is a target camera
transform plus a duration. The cinematic player sets the
target, the existing lerp does the move. A cut is a shot with
duration 0. A dolly is a shot with a long duration and a moving
target. That is the whole camera system.

### 5.2 The data shape

A **cinematic** is a scene: a list of shots, each optionally
carrying a dialogue node, and a list of staged characters.

```ts
interface CinematicShot {
  /** Camera target, in world space. */
  camera: { pos: { x: number; y: number; z: number }; lookAt: { x: number; y: number; z: number } };
  /** Seconds this shot lasts. 0 = cut to this framing instantly. */
  duration: number;
  /** Dialogue node to play during this shot (optional). */
  dialogue?: string;              // node id in StoryDialogue.ts
  /** Characters visible during this shot (by character id). */
  characters?: string[];
  transition?: 'cut' | 'fade';    // default 'cut'
}

interface CinematicDef {
  id: string;                     // e.g. 'intro-ch1'
  shots: CinematicShot[];
  /** Where the player stands when control returns. */
  returnTo: { x: number; z: number; heading: number };
  /** What happens when the scene ends. */
  onEnd?: DialogueEvent;          // usually 'startStoryMission'
  skippable: boolean;             // default true
}
```

Staged characters are defined in `StoryCharacters.ts`:

```ts
interface StoryCharacterDef {
  id: string;                     // e.g. 'mara'
  name: string;                   // display name
  color: string;                  // name-plate colour
  palette: CharacterMaterials;    // the 10 recolourable materials
  outfit: { hood: boolean; chain: boolean };
  height: number;                 // scale, 1 = protagonist height
  /** Where this character stands when staged in a scene. */
  stagePos: { x: number; z: number; heading: number };
  pose: 'idle' | 'talk' | 'lean' | 'arms-crossed';
}
```

Characters are built with the existing `createCharacter(track)`
— the same rig as the protagonist, recoloured through
`CharacterMaterials`. No new model code. A staged character is
a static figure: it stands, it idles, it turns its head toward
the speaker during a dialogue node. It does not walk, it does
not fight, and it is removed when the scene ends. At most four
staged characters per scene, so the draw-call cost stays small
(about four characters × ~22 meshes, and they are only alive
for the length of the scene).

### 5.3 The player (`Cinematics.ts`)

A small state machine, modelled on the dialogue runtime:

```
idle → playing → (shot advances) → playing … → done → idle
                 ↘ skip → done
                 ↘ interrupt (quit to menu) → cleanup → idle
```

Public handle:

```ts
interface CinematicHandle {
  play: (sceneId: string) => boolean;
  skip: () => void;
  update: (dt: number) => void;   // called from the engine tick while playing
  isPlaying: () => boolean;
  dispose: () => void;
}
```

Behaviour:

- **Start:** the engine pauses the world (`engine.stop()` for
  gameplay, but the render loop keeps running so the camera
  can move — see the note below), the player input is ignored,
  the HUD hides, the letterbox appears (two black bars, CSS),
  and the staged characters for shot 1 are placed.
- **Per frame:** the player advances the shot clock, lerps the
  camera toward the current shot's target (using the engine's
  existing lerp — the player writes `camYaw` / `camPitch` /
  `camDistance` and lets `updateCamera` do the work), and, if
  the shot carries a dialogue node, hands that node to the
  Dialogue system. When the shot's duration expires, the next
  shot begins.
- **End:** the `onEnd` event fires (usually starting the next
  story mission), the staged characters are removed, the
  letterbox fades, the camera is restored to the player's orbit
  position (saved at the start of the scene), the HUD returns,
  and the engine resumes. Control returns to the player at
  `returnTo`.
- **Skip:** Esc / Space / tap Skip jumps to the last shot,
  fades out, and runs the same end sequence. Skipping never
  skips the `onEnd` event — the story state is the same
  whether the player watched or skipped. That is a rule, not
  an accident.
- **Interruption safety:** every step of the end sequence is
  idempotent, and `dispose()` runs the full cleanup (restore
  camera, remove staged characters, hide the letterbox, resume
  the engine, clear the playing flag) even if the scene is
  abandoned halfway — for example, if the player quits to the
  main menu mid-scene. The cleanup is written once, in one
  place, and both the normal end and the interrupt path call
  it. There is no way to leave the game in "cinematic mode"
  with no cinematic running.

**The pause subtlety, stated plainly:** `engine.stop()` today
freezes the whole `requestAnimationFrame` loop, which would
freeze the camera too. A cinematic needs the render loop alive
while gameplay is frozen. The fix is a small one, and it is
the only engine-loop change in this proposal: split the loop
into two flags — `running` (the loop is alive and rendering)
and `simulating` (the world updates: player, traffic, police,
missions, timers). `stop()` sets both false (today's behaviour,
unchanged for panels). A cinematic sets `simulating` false and
`running` true, so the world freezes but the camera moves.
`start()` sets both true. This is a two-boolean change, and
every existing caller keeps working.

### 5.4 The overlay (`CinematicOverlay.tsx`)

- Two black bars (top and bottom, CSS, about 12% of the
  viewport height each) that slide in over 0.4 s. Pure CSS,
  no Three.js.
- A **Skip** button (bottom right, "Skip ⏭", Esc / tap) when
  the scene is skippable. Chapter intros are skippable; the
  finale's last 10 seconds are not (the scene is 30 seconds
  long and the skip appears after 5 seconds — the player can
  skip the setup but not the ending beat).
- A **subtitle line** at the bottom centre when a shot carries
  dialogue — the dialogue panel does not open during a
  cinematic; the line is rendered as a subtitle instead, so
  the letterbox framing is not broken by a panel. The subtitle
  uses the same typewriter effect as the dialogue panel.
- The overlay is `pointer-events: none` except the Skip button.

### 5.5 What a cinematic is not

- It is not a cutscene engine with a timeline editor. Shots
  are a list in a data file. There is no keyframe UI.
- It is not motion capture. Characters stand, idle, and turn
  their heads. They do not walk across the scene (if a
  character needs to move, the shot cuts to them already
  there — the oldest trick in cinema, and the cheapest).
- It is not a second camera system. It drives the one camera
  the game already has.
- It is not long. Chapter intros are 20–30 seconds (3–4
  shots). The finale is 45 seconds (5 shots). Total cinematic
  time across the whole campaign is under 4 minutes.

---

## 6. Three-chapter story outline

Ten missions, three chapters. Every mission lists its title,
purpose, giver/location, objectives, mechanics, characters,
success/failure, reward, and connections. Locations and
mechanics are all existing — no new world geometry, no new
systems. The five job missions and the two contracts are not
modified; the story missions below are new definitions that
happen to use the same places and the same objective types.

### Chapter 1 — "The Wrong Package" (3 missions)

The setup: Kai takes a delivery that is not what it seems, and
three people tell him three different pieces of the truth.

**1.1 — "First Light"** · giver Mara Voss · Beacon Tower
- *Purpose:* teach the player the story loop (dialogue →
  drive → deliver) and introduce Mara.
- *Objectives:* `dialogue` (Mara, at the rooftop office above
  the commercial block, (60,0)) → `enterVehicle` (the GT) →
  `checkpoint` (the z = −90 crossing, +15 s) → `deliver`
  (Beacon Tower plaza, (0,−165)).
- *Mechanics:* the BEACON RUN route, as a story mission with
  a dialogue intro and a checkpoint at the halfway mark. 60 s
  timer, starting when the dialogue ends.
- *Characters:* Mara Voss. *Success:* deliver the package.
  *Failure:* timer runs out, or BUSTED.
- *Reward:* $500. *Unlocks:* 1.2. *Sets flag:* `mara-trust`.

**1.2 — "Dockside Static"** · giver Rico Hale · south-west dock
- *Purpose:* the package was not what it seemed. Introduce
  Rico and the Northgate Crew.
- *Objectives:* `dialogue` (Rico, at the dock, (−114,144)) →
  `enterVehicle` → `deliver` (beach, (165,90)) → `evade`
  (a Northgate lookout has spotted the delivery; stay out of
  sight until the heat dies down).
- *Mechanics:* the MIDNIGHT DELIVERY route, extended with an
  `evade` tail (the NO WAY OUT pattern). On accept, wanted
  heat is set to 10 (level 1) — enough to matter, easy to lose.
- *Characters:* Rico Hale, a Northgate Lookout (as the
  spotter, not a fighter). *Success:* deliver, then lose the
  heat. *Failure:* timer, BUSTED, or TAKEN DOWN.
- *Reward:* $750. *Unlocks:* 1.3. *Sets flag:* `package-was-wrong`.

**1.3 — "Signal Lost"** · giver June Park · west park
- *Purpose:* the investigation. Introduce June and the ledger.
- *Objectives:* `dialogue` (June, at her van, (−90,60)) →
  `collect` (three clues: west park (−90,60), east park
  (90,−60), boardwalk (133,30)) → `reach` (return to June).
- *Mechanics:* the LOST CONNECTION exploration, with the
  clues as `collect` pickups (a small glowing case at each
  point) instead of plain `reach` triggers. Untimed.
- *Characters:* June Park. *Success:* all three clues found
  and returned. *Failure:* none (untimed, on foot) — the
  mission cannot fail except by BUSTED.
- *Reward:* $600. *Unlocks:* Chapter 2. *Sets flags:*
  `ledger-found`, `june-trust`. *Chapter 1 outro cinematic:*
  June decodes the first page of the ledger on her van's
  screen — the name "Silas Crane" appears. (20 s, 3 shots.)

### Chapter 2 — "Two Crews, One City" (4 missions)

The middle: Kai learns who wants the ledger, and that the
woman who hired him lied about the job.

**2.1 — "Tail Spin"** · giver Vic Marino · north avenue
- *Purpose:* follow the money. Introduce Vic.
- *Objectives:* `dialogue` (Vic, (62.5,−150)) →
  `enterVehicle` → `follow` (the teal sedan, 500-unit route,
  8–35 m band) → `reach` (the warehouse it stops at,
  (120,−150)).
- *Mechanics:* the DON'T LOSE THEM tail, as a story mission.
  150 s timer.
- *Characters:* Vic Marino. *Success:* follow the target to
  the warehouse. *Failure:* spotted, lost, timer, BUSTED.
- *Reward:* $1,000. *Unlocks:* 2.2. *Sets flag:* `warehouse-found`.

**2.2 — "Hold the Line"** · giver Mara Voss · Mid-Beach
- *Purpose:* the Northgate Crew comes for the stash. The
  first real fight.
- *Objectives:* `dialogue` (Mara, by phone — a dialogue node
  with no staged character, the phone-call pattern) →
  `defend` (the supply beacon at (165,0), 3 waves, 8 s
  recovery) → `dialogue` (Mara, after the last wave).
- *Mechanics:* the HOLD THE LINE defense (8C), as a story
  mission. The beacon is the same object (100 HP, 4 damage
  per hit). The waves are the same composition (2 / 3 / 3).
  The difference from the contract: it is a story mission, so
  it pays the story reward and it advances the plot.
- *Characters:* Mara Voss. *Success:* all three waves defeated
  with the beacon alive. *Failure:* TAKEN DOWN, or the beacon
  destroyed.
- *Reward:* $1,200 + the "crew jacket" outfit (see §2.6).
  *Unlocks:* 2.3. *Sets flag:* `defended-the-beach`.

**2.3 — "Dockside Trouble"** · giver Rook Calloway · South Docks
- *Purpose:* the choice. Rook offers Kai a job, and the
  player decides who Kai is.
- *Objectives:* `dialogue` (Rook, at the South Docks, (0,170))
  → **choice** (take Rook's job, or refuse it) → `defeat`
  (3 hostiles in the dock zone) → `dialogue` (Rook, after).
- *Mechanics:* the DOCKSIDE TROUBLE elimination (8C), as a
  story mission. The choice is a dialogue choice with two
  branches: taking the job sets `took-rooks-job` (and pays an
  extra $200 on the spot, from Rook), refusing sets
  `refused-rook` (and Rook gives Kai a tip instead — the
  location of the Chapter 3 dead drops, which makes mission
  3.1 easier). Both branches converge on the same fight, so
  the mission is completable either way.
- *Characters:* Rook Calloway, Vera Kwan (named in the
  dialogue — she is the one who hired Rook). *Success:* all
  three hostiles defeated. *Failure:* TAKEN DOWN.
- *Reward:* $800 (+ $200 if the player took Rook's job).
  *Unlocks:* 2.4. *Sets flag:* `took-rooks-job` **or**
  `refused-rook` (exactly one).
- *Note:* this mission is placed at the South Docks, away
  from the two 8B encounter zones and the two 8C contract
  zones, and it uses its own encounter id
  (`story-dockside`), so it cannot confuse the contract's
  enemy accounting.

**2.4 — "The Long Way Out"** · giver Dana Cole · beach hideout
- *Purpose:* the escape. Introduce Dana.
- *Objectives:* `dialogue` (Dana, (−6,30)) → `reach` (the
  beach hideout, (180,−30)) → `evade` (stay hidden until the
  heat dies down).
- *Mechanics:* the NO WAY OUT escape. On accept, wanted heat
  is set to 45 (level 3). 180 s timer.
- *Characters:* Dana Cole. *Success:* reach the hideout and
  wait out the heat. *Failure:* timer, BUSTED.
- *Reward:* $1,500. *Unlocks:* Chapter 3. *Sets flag:*
  `vera-lied` (Dana is the one who tells Kai that Vera Kwan
  set him up). *Chapter 2 outro cinematic:* Dana drives Kai
  out of the city at dawn, and Kai decides to come back for
  the ledger. (25 s, 3 shots.)

### Chapter 3 — "The Ledger" (3 missions)

The endgame: get the ledger, choose what happens to it.

**3.1 — "Dead Drop"** · giver Milo · boardwalk
- *Purpose:* gather the last pieces. Introduce Milo and Lena.
- *Objectives:* `dialogue` (Milo, on the boardwalk, (133,90))
  → `collect` (three dead drops: the west park (−90,60), the
  garage roof (22,45), the Beacon Tower plaza (0,−165)) →
  `dialogue` (Lena Ortiz, at the boardwalk clinic, (140,30),
  who patches Kai up).
- *Mechanics:* `collect` pickups, on foot, untimed, with
  police patrols in the area (the wanted system is live, but
  no heat is set — the player can choose to be careful or
  fast). If the player set `refused-rook` in 2.3, Milo gives
  the exact drop locations (the HUD shows distances); if they
  set `took-rooks-job`, Milo only gives the neighbourhoods
  (the HUD shows a search radius). Same mission, different
  information — that is what the flag buys.
- *Characters:* Milo, Lena Ortiz. *Success:* all three drops
  collected. *Failure:* BUSTED.
- *Reward:* $900. *Unlocks:* 3.2. *Sets flag:* `drops-collected`.

**3.2 — "Crane's Nest"** · giver June Park · north docks
- *Purpose:* the infiltration. The biggest combat mission in
  the game.
- *Objectives:* `dialogue` (June, at her van) → `reach` (the
  Northgate warehouse, (120,−150)) → `defeat` (6 hostiles in
  two groups of three, inside the warehouse yard) →
  `collect` (the ledger, on a desk inside the yard) →
  `reach` (get out, back to June's van).
- *Mechanics:* two `defeat` objectives back to back (each a
  fresh encounter id, `story-nest-a` and `story-nest-b`, so the
  enemy accounting stays clean), then a `collect`. The
  warehouse yard is the open ground at the north end of the
  x = 120 avenue, which is clear at every quality tier.
  *Prerequisite:* `vehicle: vortex-rs` — the player needs a
  fast car for the getaway in 3.3, and this mission is where
  the game makes sure they have one. If the player does not
  own the Vortex RS, Theo Ashford gives it to them at the
  start of this mission (a dialogue event, `giveVehicle`) —
  the garage already supports gifting a car, it just has not
  been used that way yet.
- *Characters:* June Park, Theo Ashford, Silas Crane (named
  in the dialogue, not present). *Success:* the ledger
  collected and Kai out alive. *Failure:* TAKEN DOWN, or
  BUSTED.
- *Reward:* $2,000. *Unlocks:* 3.3. *Sets flag:*
  `ledger-in-hand`.

**3.3 — "Sunset Run"** · giver Mara Voss · Beacon Tower
- *Purpose:* the finale. A drive, a choice, and two endings.
- *Objectives:* `dialogue` (Mara, at the rooftop office) →
  `enterVehicle` (the Vortex RS) → `deliver` (Beacon Tower
  plaza, (0,−165), 120 s timer, wanted heat set to 70 on
  accept — level 4, the hardest pursuit in the game) →
  `dialogue` (Silas Crane, at the tower — the final
  confrontation, a cinematic, not a fight).
- *Mechanics:* a timed delivery under pursuit (the BEACON RUN
  route at the highest heat the game sets), then a cinematic
  (45 s, 5 shots) in which Crane offers Kai a deal and the
  player chooses:
  - **Give the ledger to Mara** — she burns it. The city
    stays as it is, the crews stay in balance, and Kai keeps
    his dispatcher. Ending: "The city keeps its secrets."
  - **Give the ledger to June** — she publishes it. The crews
    fall, the officials named in it fall, and the city changes
    in ways nobody can predict. Ending: "The city learns the
    truth."
  The choice is a dialogue choice in the final cinematic.
  Both endings pay the reward and both mark the campaign
  complete. The save records which ending the player got
  (`ending: 'mara' | 'june'`), and the main menu shows it.
- *Characters:* Mara Voss, June Park, Silas Crane (present
  for the first time), Old Man Ferris (one line). *Success:*
  reach the tower, then choose. *Failure:* timer, BUSTED, or
  TAKEN DOWN on the drive.
- *Reward:* $2,500. *Unlocks:* the campaign is complete; all
  ten missions become replayable from the story board.
  *Sets flag:* `campaign-complete`.
- *Chapter 3 outro cinematic:* the ending the player chose,
  then a slow pull-back from Beacon Tower at sunset. (45 s,
  5 shots.)

### Chapter totals

| Chapter | Missions | Rewards | New mechanics used |
|---|---|---|---|
| 1 — The Wrong Package | 3 | $1,850 | dialogue, checkpoint, collect |
| 2 — Two Crews, One City | 4 | $4,500 + outfit | defend (story), defeat (story), dialogue choice |
| 3 — The Ledger | 3 | $5,400 | collect with flags, defeat ×2, finale choice |
| **Total** | **10** | **$11,750 + outfit** | |

The whole campaign is about 2–3 hours for a first playthrough,
and it reuses every system the game already has.

---

## 7. Proposed file structure

New files only, plus the small, listed changes to existing
files. No existing file is deleted, renamed or overwritten
beyond the edits below.

### 7.1 New files

| File | Responsibility |
|---|---|
| `src/game/StoryTypes.ts` | All story types: `StoryChapterDef`, `StoryMissionDef`, `StoryObjectiveDef` (extends the mission objective types with `dialogue`, `defeat`, `defend`, `collect`), `StoryProgress`, `StoryHudState`, `StoryBoardState`, `DialogueLine`, `DialogueChoice`, `DialogueEvent`, `CinematicDef`, `CinematicShot`, `StoryCharacterDef`, `StoryFailReason`. No Three.js, no React — pure types, so the menu can read progress without starting the engine (same rule as `MissionProgress.ts`). |
| `src/game/StoryDefinitions.ts` | The data: 3 chapters, 10 missions, all objectives, rewards, prerequisites, checkpoint marks, giver/location coordinates. Mirrors `MissionDefinitions.ts`. |
| `src/game/StoryDialogue.ts` | The data: every dialogue node in the campaign (about 60 nodes across 10 missions + the finale), with choices, conditions and events. Plain data, no logic. |
| `src/game/StoryProgress.ts` | Load/save for `vice-city-stories.story.v1` (see §8). Defensive load with validation, same pattern as `MissionProgress.ts`. Also builds the story board state (chapters, mission states, rewards) for the menu. |
| `src/game/StoryCampaign.ts` | The runtime: the chapter/mission state machine, the objective walk (reusing the trigger evaluators), the timer, checkpoints (snapshot + resume), prerequisites, flags, optional objectives, rewards (via `missions.addCash()`), and the HUD state. Modelled on `MissionManager.ts` — same shape, different data. Owns the teal story marker (beam + ring + diamond, recoloured). |
| `src/game/StoryCharacters.ts` | Character definitions for the 10 named story characters (palette, outfit, height, stage position, pose) and a small staging helper: `stageCharacter(id)` / `unstageAll()`, built on `createCharacter(track)`. No AI, no movement. |
| `src/game/Dialogue.ts` | The dialogue runtime: `start`, `advance`, `choose`, `skip`, `close`, `getState`. Node traversal, condition checks, event firing. No rendering, no Three.js. |
| `src/game/Cinematics.ts` | The cinematic player: `play`, `skip`, `update`, `isPlaying`, `dispose`. Shot clock, camera targeting (writes `camYaw`/`camPitch`/`camDistance` and lets the engine's `updateCamera` lerp), staged-character placement, letterbox signalling, idempotent cleanup. |
| `src/game/StoryTriggers.ts` | Evaluators for the four new objective types (`dialogue`, `defeat`, `defend`, `collect`), plus the checkpoint snapshot helper. Kept separate from `MissionTriggers.ts` so the existing trigger module does not change — the story manager calls both. (Alternative, noted for the implementer: fold these into `MissionTriggers.ts` if the team prefers one trigger module. The proposal keeps them separate to honour "do not modify existing gameplay systems".) |
| `src/components/DialoguePanel.tsx` | The dialogue UI: name plate, text box with typewriter effect, Continue / choice buttons, Skip, progress. Props: `{dialogue: DialogueState, onAdvance, onChoose, onSkip}`. |
| `src/components/CinematicOverlay.tsx` | The letterbox bars, the Skip button, and the subtitle line. Props: `{playing: boolean, skippable: boolean, subtitle: string \| null, onSkip}`. |
| `src/components/StoryBoard.tsx` | The campaign board: chapters, missions, states, givers, rewards, optional objectives, replay. Props: `{board: StoryBoardState, onSelect(id), onClose}`. Pauses the engine, like the mission board. |
| `src/components/StoryHUD.tsx` | The story mission HUD: chapter, mission, objectives + arrow + distance, countdown, objective n/m, optional-objective checklist, hint, flash, Abandon. Props: `{story: StoryHudState, onAbandon}`. Reuses the MissionHUD layout and classes. |

### 7.2 Modified files (the complete list — nothing else)

| File | Change | Size |
|---|---|---|
| `src/game/GameEngine.ts` | Add a `story` field (a `StoryCampaignHandle`), a `dialogue` field, a `cinematic` field; add `onStory`, `onDialogue`, `onCinematic` to `EngineCallbacks`; call `story.update` in the tick (same slot as `missions.update`, after it); add the single "active mission" guard; add `handleDialogueEvent`; add `startStoryMission` / `cancelStoryMission` / `retryStoryMission` methods mirroring the mission ones; split the loop into `running` / `simulating` flags (§5.3); route E to the dialogue handle when a dialogue is open (one guard at the top of the E chain). | ~150 lines added, ~10 changed |
| `src/components/GameCanvas.tsx` | Add `story`, `dialogue`, `cinematic` React state; wire the three new callbacks; render `StoryHUD`, `DialoguePanel`, `CinematicOverlay`, `StoryBoard`; hide the job-mission HUD while a story mission runs; add the STORY button handler. | ~80 lines |
| `src/components/MainMenu.tsx` | Add a STORY button (next to PLAY) showing current chapter/mission progress. | ~15 lines |
| `src/game/MissionTriggers.ts` | No change (the new objective types live in `StoryTriggers.ts`). Listed here to state that explicitly. | 0 |
| `src/game/Enemies.ts` | No change. The story uses the existing `onEnemyDefeated` callback and the existing `spawnEncounter` / `activateEncounter` / `resetEncounter` methods. Listed to state that explicitly. | 0 |
| `src/game/Contracts.ts` | No change. The story's `defend` objective generalises the beacon pattern in `StoryTriggers.ts`; the contract module is not touched. | 0 |
| `src/styles/global.css` | New classes: `.dialogue-panel`, `.dialogue-name`, `.dialogue-text`, `.dialogue-choices`, `.dialogue-choice`, `.dialogue-continue`, `.dialogue-skip`, `.dialogue-progress`, `.cinematic-bars`, `.cinematic-skip`, `.cinematic-subtitle`, `.story-board`, `.story-board-chapter`, `.story-board-entry`, `.story-hud`, `.story-hud-optional`. Mobile rules for each (390 px). | ~200 lines |
| `README.md` | Add a "Phase 9A" design section (a pointer to this document) and a "Phase 9B+" section when implementation lands. | a few lines |

### 7.3 What is deliberately not built

- No new 3D world geometry. Every story location is an
  existing place (tower, docks, parks, boardwalk, beach,
  garage, commercial block).
- No new enemy types, no new weapons, no new vehicles. The
  story uses the three enemy variants, the two weapons and the
  four cars that already exist.
- No new physics. Movement stays kinematic.
- No voice acting, no lip sync, no facial animation. Dialogue
  is text, and staged characters turn their heads.
- No branching story beyond the two flags in mission 2.3 and
  the two endings. The campaign is linear with two small
  branches — that is a scope decision, and it is what makes
  ten missions achievable.
- No multiplayer, no online features.

---

## 8. Compatibility and persistence strategy

### 8.1 The one new save key

```
vice-city-stories.story.v1
```

Shape:

```ts
interface StoryProgress {
  version: 1;
  chapters: Record<string, { unlocked: boolean; completed: boolean }>;
  missions: Record<string, {
    completed: boolean;
    optionalDone: string[];      // ids of optional objectives done (once each)
    bestTime: number | null;     // fastest completion, seconds, or null
  }>;
  current: { chapterId: string; missionId: string } | null;
  flags: Record<string, boolean>;
  ending: 'mara' | 'june' | null;
}
```

Load is defensive, exactly like `MissionProgress.ts`:
`try/catch`, validate every field, fall back to a fresh
progress object when the save is missing or corrupt, and
ignore unknown mission ids (so a future chapter can be added
without breaking old saves). No migration code is needed for
Phase 9B because the key is new; if a later phase adds a
field, it falls back to its default (the established pattern —
see the Weapons mags default in 8B).

### 8.2 Everything else is untouched

- All 12 existing keys keep their exact names, shapes and
  owners. No key is renamed, no field is added to an existing
  shape, no existing save is reset or migrated.
- Cash stays the single shared balance. Story rewards go
  through `missions.addCash()` and story spending (there is
  none, by design — the story never charges the player) would
  go through `missions.spendCash()`. The garage, shop, range
  and contracts see the same balance they always have.
- The five job missions keep their progress key, their unlock
  chain, their board and their HUD. The two contracts keep
  theirs. The two encounters keep theirs. A player who has
  finished all five job missions and both contracts opens the
  story with everything intact, and a player who has done
  none of them can still start Chapter 1.
- The `jobMission` prerequisite type (§2.2) reads the existing
  mission progress — it never writes to it.
- Checkpoints are session-only (in-memory). Quitting to the
  menu restarts the current story mission from the beginning,
  exactly like quitting mid-job-mission today.
- The `ending` field is the only story state shown on the main
  menu, and it is read-only there.

### 8.3 The mutual-exclusion rule, stated once more

Only one mission runs at a time. The engine enforces it: a
`startStoryMission` call returns false while a job mission is
`active`, and `selectMission` / `tryInteract` on the job side
return false while a story mission is `active`. The HUD tells
the player why in one line. This is the single most important
compatibility rule in the whole proposal, because it is what
keeps the marker, the HUD, the timer and the enemy accounting
from ever being owned by two systems at once.

---

## 9. Implementation phases

Phase 9A is this document. The work below is proposed, in
order, each phase independently verifiable before the next
begins. Nothing here is approved yet — 9B starts only after
the user says so.

**Phase 9B — Story foundation (campaign runtime, Chapter 1)**
- `StoryTypes.ts`, `StoryDefinitions.ts` (Chapter 1 only, 3
  missions), `StoryProgress.ts`, `StoryCampaign.ts`,
  `StoryTriggers.ts` (the `dialogue` type stubbed as a
  plain `interact` until 9C lands, so Chapter 1 is playable
  without the dialogue system).
- Engine wiring: the `story` handle, the `onStory` callback,
  the active-mission guard, the teal marker.
- `StoryBoard.tsx`, `StoryHUD.tsx`, the STORY menu button,
  the CSS.
- Verify: Chapter 1 plays end to end (all three missions),
  the five job missions and both contracts still work, the
  save key appears and survives a reload, the guard refuses
  a second active mission.

**Phase 9C — Dialogue**
- `StoryDialogue.ts` (Chapter 1 dialogue first, then the
  rest), `Dialogue.ts`, `DialoguePanel.tsx`.
- Wire the `dialogue` objective type properly (replace the 9B
  stub), wire the E-key guard and the input routing, wire
  dialogue events.
- Add the build-time dialogue checker (every `next` and every
  choice target resolves; every dialogue has an end node; every
  end node fires an event).
- Verify: every Chapter 1 conversation plays, choices set
  flags, conditional lines appear and disappear correctly,
  skip works, quitting mid-dialogue abandons cleanly.

**Phase 9D — Cinematics**
- `StoryCharacters.ts`, `Cinematics.ts`,
  `CinematicOverlay.tsx`, the `running` / `simulating` split
  in the engine loop.
- The three chapter intros/outros and the finale (the
  Chapter 1 outro first, as the test case).
- Verify: each scene plays, skips, and returns control; the
  camera restores exactly; quitting mid-scene cleans up;
  staged characters never leak into free roam (draw calls
  return to baseline after the scene).

**Phase 9E — Chapters 2 and 3**
- `StoryDefinitions.ts` (the remaining 7 missions),
  `StoryDialogue.ts` (the remaining dialogue), the Rook
  choice and the finale choice, the two endings, the Vortex RS
  gift, the crew-jacket outfit.
- Verify: each mission end to end, the Rook flag changes
  mission 3.1's information, both endings play and both are
  recorded in the save, the campaign completes and all ten
  missions become replayable.

**Phase 9F — Full QA and polish**
- Full regression (the 8C qa81 suite plus the story suite):
  all five job missions, both contracts, both encounters,
  garage, shop, range, sprint, collectibles, arrest, TAKEN
  DOWN, mobile 390 px.
- Story playthrough: all ten missions, both endings, every
  dialogue branch, every checkpoint retry, every failure
  reason, a reload mid-campaign.
- Performance: draw calls at spawn, with a story mission
  active, and during a cinematic (staged characters included).
- README update (Phase 9 section), MEMORY.md entry, goal log.

---

## 10. Risks and testing strategy

### 10.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dialogue trees grow out of control (too many branches, too many nodes) | Medium | High — the campaign becomes untestable | The data shape caps branches at 3 choices per node; every dialogue has one end node; the build-time checker rejects dangling links; the campaign is linear with exactly two branches (2.3 and the finale) |
| Camera takeover conflicts with the orbit camera (the camera never comes back, or comes back facing the wrong way) | Medium | High — the player loses control | The cinematic player saves the full camera state at the start and restores it in the single idempotent cleanup; the cleanup is called by the normal end, the skip path, and `dispose()`; QA checks the camera after every scene |
| Two missions active at once (marker/HUD/timer/enemy accounting owned by two systems) | Low | High — corrupts mission state | The single active-mission guard in the engine, enforced at both entry points; QA tries to start a story mission during a job mission and vice versa |
| Checkpoint snapshot is incomplete (the player resumes in a broken state — wrong position, dead enemies still counted, timer wrong) | Medium | Medium — a frustrating retry | The snapshot is deliberately small (objective index, positions, time left, flags) and enemies always reset to their spawn on a checkpoint retry; the snapshot is validated on load (a bad snapshot restarts the mission) |
| Staged characters leak into free roam (a character stands in the world after the scene ends) | Low | Medium — confusing, and costs draw calls | Staging is owned by the cinematic player; `unstageAll()` is part of the idempotent cleanup; QA reads the draw calls after every scene and compares with baseline |
| The `running` / `simulating` split breaks the existing pause behaviour (a panel no longer freezes the world, or the loop never resumes) | Low | High — breaks every panel | The split is two booleans; `stop()` sets both false (today's behaviour) and only the cinematic path sets them differently; every existing panel is re-tested in 9D |
| Story missions reuse contract/encounter zones and confuse the enemy accounting (an enemy counted for two systems) | Low | Medium — a mission that cannot complete | Story combat uses its own encounter ids (`story-dockside`, `story-nest-a`, `story-nest-b`) and its own zones, away from the 8B/8C zones; the accounting is per-encounter-id, so it cannot cross |
| Scope creep (more chapters, more branches, voice acting) | Medium | Medium — the phase never ends | The proposal fixes the scope at 3 chapters / 10 missions / 2 branches / under 4 minutes of cinematics; anything beyond that is a later phase, decided by the user |

### 10.2 Testing strategy

- **Unit-ish checks (in the browser, via `window.__vcsEngine`,
  the established QA pattern):** the story state machine
  (every state transition), the prerequisite evaluator (each
  type, true and false), the flag system (set, read, persist
  across reload), the dialogue runtime (every node reachable,
  every choice target resolves, skip, quit mid-dialogue).
- **Playthrough QA (headless Chromium, production build, the
  qa79–qa81 recipe):** each of the ten missions end to end,
  each failure reason, each checkpoint retry, both endings,
  the Rook choice both ways, a reload mid-campaign, and a
  replay of a completed mission.
- **Regression (the existing qa81 suite, re-run):** all five
  job missions, both contracts, both encounters, garage, shop,
  range, sprint, collectibles, arrest, TAKEN DOWN, and the
  unlock chain — proving the story did not break free roam.
- **Mobile 390 px:** the story board, the story HUD, the
  dialogue panel (choices tappable, text readable, no
  overflow), the cinematic overlay (letterbox + skip), and the
  touch FIRE button during a story combat mission.
- **Performance:** draw calls at spawn, with a story mission
  active, during a cinematic (staged characters), and after a
  cinematic (back to baseline). Target: no more than the 8C
  numbers (146 at spawn, 232 with a contract active).
- **Build-time checks (new, small):** a dialogue checker that
  runs in `npm run build` or as a pre-commit script — every
  `next` and choice target resolves to a node, every dialogue
  has an end node, every end node fires an event, every
  mission's `unlockAfter` / prerequisite resolves to a real
  mission. This is the cheapest way to catch the most likely
  story bug (a dangling link) before it reaches the browser.
- **Zero console errors** in every run, as in all previous
  phases. A story bug that throws is a failed phase, not a
  known limitation.

### 10.3 What "done" means for Phase 9

Phase 9 is done when: all ten story missions play end to end;
both endings play and are recorded; every dialogue branch is
reachable and every choice sets its flag; every cinematic
plays, skips, and returns control; the full regression suite
passes with zero console errors; mobile 390 px passes; and
the five job missions, both contracts, both encounters, and
all twelve existing save keys are untouched and working.
Not deployed, no GitHub push — the same as every phase before
it.

---

*End of proposal. Awaiting approval before Phase 9B.*
