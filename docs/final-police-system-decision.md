# Final police system decision — WS7

**Date:** 2026-11-23
**Baseline:** main `80a4573` (Lena release), UI branch `ui/gta-vice-city-transformation`
**Decision: DEFER — final.** No on-foot police officer ships in the release.
This is the final engineering decision for the feature, not another
unexplained deferral: the full feasibility assessment is below, with
the exact minimal scope recorded in case the decision is ever
overridden.

---

## 1. What the game has today (verified)

- Police are **vehicles only**. `Police.ts` drives up to 6 units
  (`MAX_UNITS = 6`) on the lane graph: pursuit, search, roadblocks
  (level 3+, two units spanning the road 50 m ahead of the player),
  and the arrest approach.
- Arrest is a timed state machine (`Arrest.ts`):
  `none → prompt → surrendering (SURRENDER_DURATION = 2.8 s) → busted`.
  On `surrendering` the engine exits the vehicle if driving, locks
  the player in the hands-up pose (`Player.ts setSurrendered`), and
  drives the nearest pursuer to a stop point (`holdDist = 4.5` m from
  the player on foot). On `busted` the engine resets wanted heat and
  pursuit and shows the BUSTED screen, followed by a respawn
  teleport.
- The wanted system is frozen while `surrendering`/`busted`
  (`GameEngine.ts`: no `wanted.update` in those states), and the
  player is input-locked. The arrest outcome is owned entirely by
  the `Arrest.ts` timer — nothing during `surrendering` reads any
  external input.

## 2. The five feasibility questions

### 2.1 Can it be implemented using existing systems?

**The idle-only officer: yes. The participating officer: no.**

Existing and reusable:

| Capability | Source |
|---|---|
| Spawn an articulated character at a position, facing a heading | `CinematicStaging.ts createStagedActor` — builds a `createCharacter` rig, recolours it from the story palette, places it in the scene |
| Idle animation (breathing, weight shift) | `CharacterAnimation.ts` — `idle` state, `IDLE_POSE`; staged actors already use it |
| Walk gait (stride-matched) | `CharacterAnimation.ts` — `GAIT` table for walk/run/sprint |
| Straight-line walk to a point | `CinematicStaging.ts walkTo` — 1.4 m/s, yaw eased toward target |
| Clean spawn/despawn + disposal | `CinematicStaging.ts dispose()` — removes the group and disposes every tracked resource |
| Arrest lifecycle hooks | `GameEngine.ts` — `surrendering` / `busted` transitions, `respawn()` |
| Arresting-unit identity + position | `Arrest.ts arrestSlot` + `Police.ts listUnits()` / `setArrestTarget` |
| Player locked during the window | `Player.ts setSurrendered` + engine interaction blocks |

Missing, and not buildable from anything that exists:

- **Cap / badge / belt / uniform geometry: none exists.**
  `CharacterDesign.ts` offers only `heightScale`, `shoulderScale`,
  `hipScale`, `hairStyle`, `skirt`, `hoops`, `sunglasses`, `chain`,
  `hood`, `portraitAsset`. `Character.ts` builds no cap, badge,
  belt or uniform piece. A navy recolour is possible through the
  existing palette, but the identifying uniform *geometry* is new
  work.
- **No `police` character entry.** `StoryCharacters.ts` has no
  police/officer entry; `storyCharacter(id)` falls back to Kai.
  Without a new registry entry, `createStagedActor(scene, 'police', …)`
  would build a grey-hoodie Kai clone.
- **No walk steering.** The only free movement primitive is
  `walkTo`: straight-line interpolation with yaw easing — no
  collision, no obstacle avoidance, no building checks, no road
  awareness. The only graph-based walking is the NPC crowd, locked
  to the sidewalk graph (`PedestrianPaths.ts`: "NPCs never leave the
  graph"). An officer cannot walk from a road to an off-road player,
  around a car, or through a doorway using any existing system.
- **No restrain / escort / cuff / grab / point pose.**
  `CharacterAnimation.ts` has exactly `idle`, `walk`, `run`,
  `sprint` plus the player's own `HANDSUP_POSE` — no officer action.
- **No per-frame update driver outside cinematics.** Staged actors
  are driven by `Cinematic.ts`; outside a cinematic the engine
  would need a new `officer.update(dt)` call in its main loop.
- **No door-exit animation.** Nothing animates a figure leaving a
  vehicle; the officer would pop into existence at the car's stop
  point.

### 2.2 Can the officer genuinely participate in arrest gameplay?

**No. The only buildable version is a mannequin that watches a timer
it cannot influence.**

- **Approach:** impossible in-window. The window is 2.8 s; the only
  walk speed available is 1.4 m/s, covering ~3.9 m — and only in a
  collision-blind straight line. From the car's 4.5 m stop point
  the officer cannot even reliably reach the player before BUSTED.
- **Restrain:** no pose, no mechanic. Nothing for the officer to
  hold, cuff, or grab — the player's hands-up pose is already
  playing.
- **Escort:** nowhere to go. `busted` immediately resets wanted and
  pursuit and shows the BUSTED screen, followed by a respawn
  teleport. There is no walk-to-a-car / walk-to-a-station sequence
  to escort through.
- **Affect timing/outcome:** the only way would be to gate the
  `busted` transition on the officer (e.g. "busted only when the
  officer is within X of the player"). That is a *new* gameplay
  dependency with a real softlock risk: if the officer fails to
  arrive — spawned behind a building, across a road, or the car
  stopped far away — the arrest never completes and the player is
  locked hands-up forever. `Arrest.ts` currently has no such
  failure mode by design.
- The car's drive-up is the honest analogue: it is visible and
  thematic but mechanically inert, and it was worth building because
  it *arrives by driving* (existing pursuit AI). The officer would
  *appear by spawning* — a pop-in, not an arrival.

### 2.3 Can it be completed without a major AI rewrite?

**The idle-only version: yes. The participating version: no — it is
a new AI/lifecycle system.**

Idle-only, quantified: `Character.ts` cap/badge/belt geometry
(~30–50 lines + 3 optional fields in `CharacterDesign.ts`);
`StoryCharacters.ts` one new `police` entry (~10 lines);
`GameEngine.ts` officer field + spawn/update/despawn (~40–60
lines); one new harness script (~150 lines) or an extension of the
existing arrest checks. **Total: ~100–130 lines of game code +
tests; roughly half a focused session. Zero AI work.**

Participating, quantified: off-graph steering with collision (does
not exist — cars use the lane graph, NPCs use the sidewalk graph,
nothing free-steers a humanoid); new restrain/escort poses in
`CharacterAnimation.ts`; coupling the `busted` transition to
officer arrival in `Arrest.ts` with timeout/fallback logic to avoid
softlocks; placement fallback when `arrestSlot` is null (null when
there is no nearest pursuer, e.g. the car-boxed case where units
are `roadblock`, not `pursue`). That is multiple sessions of new
systems, not a polish task.

### 2.4 Can it be tested reliably in the headless harness?

**Yes for presence/lifecycle, no for visual readability.**

Observable through `window.__vcsEngine`: scene group
`staged-police` (naming is automatic); `arrest.getState()`,
`police.listUnits()`, `wanted.getState()`, draw calls. Testable:
no officer while `prompt`; group appears on the `surrendering`
transition within ~2 m of the arresting unit's stop point, facing
the player; position static across the 2.8 s window; group gone on
`busted`, after `respawn()`, and after wanted is disabled; survives
(or is re-created from arrest state across) a quality rebuild;
repeated arrests spawn exactly one officer, never two; draw calls
rise by ~22 only inside the window, then return to baseline;
console errors `[]`.

Not testable headlessly: whether the cap/badge actually *read* as
police (needs a screenshot + a human eye).

### 2.5 Performance / memory impact

- One staged character = ~22 individual meshes (`Character.ts`:
  "the whole character is ~22 meshes") → **~+22 draw calls while
  visible**. Against the WS5 baselines (desktop 265, mobile 136):
  desktop 265 → ~287 (+8%), mobile 136 → ~158 (+16%) — **for 2.8
  seconds only**, then back to baseline on despawn. For comparison:
  all 6 police cars cost 5 draw calls total, and the entire 28-NPC
  crowd costs ~16 instanced meshes. The officer is
  disproportionately expensive per figure because it is a fully
  articulated rig, not instanced — but the cost is transient.
- **No new textures, materials, shaders, or WebGL contexts.** All
  `MeshStandardMaterial` flat colours, same material set as the
  protagonist. Geometries/materials are created per character and
  freed by `dispose()` — no leak *if* dispose is called on every
  exit path (busted, respawn, wanted-disabled, rebuild, engine
  dispose). Missing any one path leaves a permanent navy mannequin
  standing in the city; that is the main implementation risk.
- Shadow: one more caster for 2.8 s; negligible. No per-frame
  allocation while the officer stands.

## 3. Decision

**DEFER — final for this release.**

The small, robust version is buildable, but it is a pop-in mannequin
that cannot approach, restrain, escort, or affect the outcome of an
arrest it only watches for 2.8 seconds — exactly the decorative
placeholder this project has refused to ship in WS2, WS5 and WS6 —
while the version that would genuinely participate needs off-graph
steering, new restrain/escort poses, and coupling the BUSTED
transition to the officer's arrival, which is a new AI and lifecycle
system with a real softlock risk if the officer ever fails to
arrive, and is therefore out of scope for a final closeout
workstream whose stated priority is completion, stability,
verification and release rather than new feature development.

No decorative officer is added. The arrest sequence ships as-is:
the pursuing car drives up and stops, the player surrenders, the
2.8 s countdown runs, BUSTED.

## 4. Minimal exact scope (if the decision is ever overridden)

- **Spawn trigger:** the `surrendering` transition only
  (`GameEngine.ts` ~2396–2405) — never at `prompt`. Position: the
  arresting unit's stop point from
  `police.listUnits()[arrest.arrestSlot]`, offset ~1.5 m toward the
  road, facing the player (`atan2`); fallback to the nearest active
  unit from `listUnits()` when `arrestSlot` is null.
- **Behaviour:** idle only — `CharacterAnimation.update(dt, 0, false, 0)`
  per frame. No walk, no approach, no restrain, no escort.
- **Despawn conditions (all mandatory):** `busted` transition,
  `respawn()`, wanted disabled, quality rebuild (re-create from
  arrest state), engine dispose. Every path must call the staged
  actor's `dispose()`.
- **Files to touch:** `CharacterDesign.ts` (3 optional fields:
  cap/badge/belt), `Character.ts` (cap/badge/belt geometry, ~30–50
  lines), `StoryCharacters.ts` (one `police` entry, navy palette),
  `GameEngine.ts` (officer field + spawn/update/despawn, ~40–60
  lines). `Arrest.ts`, `Police.ts`, `Wanted.ts`, `NPC.ts`,
  `PedestrianPaths.ts` untouched.
- **Explicitly out of scope:** walking approach, restraining,
  escorting, any change to the 2.8 s timer or the `busted`
  transition, any NPC/crowd reuse.

## 5. What was not verified in this assessment

- `StoryCharacters.ts` was not read in full (only grepped for
  police/officer entries and the `storyCharacter` fallback).
- A staged character's draw calls were not measured at runtime —
  the "~22 meshes" figure is the code comment at `Character.ts:18`,
  not a measurement.
- The engine's main update loop was not traced beyond the arrest
  block, so the exact insertion point for `officer.update(dt)` is
  "near the existing `police.update`/`arrest.update` calls", not a
  cited line.
