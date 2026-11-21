# Animation & Visual Fidelity Audit — Vice City Stories

**Date:** 2026-11-20 · **Baseline:** Phase 9F complete (final planned verification; no rebuild, no push, no deploy) · **Scope:** audit only — no game file was modified, no system was rebuilt, redesigned, replaced, or removed; no dependency added; no gameplay, physics, control, mission, save-key, story, cash, or progression change was made. The only file created by this audit is this document. No push, no deploy, no publish.

**Method:** three parallel read-only code inspectors (categories 1–3, 4–7, 8–10) plus live observation in a real headless Chromium browser (desktop 1280×800 and mobile 390×844, touch) against the production build served by `vite preview` on port 4173. Every finding is labelled **observed live** (seen running in the browser, with numbers or a screenshot) or **code inspection only** (read from source; not yet watched live). Nothing in this document claims a browser test that was only a code read.

**How to read a finding:** each entry gives the exact file + location, what currently happens, what professional quality should feel/look like, whether the current implementation meets that standard, the specific improvement, the risk to gameplay / save data / performance / other systems, the priority (Critical / High / Medium / Low), and whether it is verifiable in a real browser or requires a real device. **Bugs** (something broken or inconsistent with the game's own rules) are separated from **gaps** (subjective visual/professional-standard improvements). **Already good** items are listed so nothing that works gets "fixed" by accident.

**Priority tally:** Critical **0** · High **14** · Medium **~48** · Low **~70** (including already-good items that need no action). No Critical findings — nothing in the game is unplayable, and no finding requires a save migration.

## Overall assessment

The game is in genuinely good shape for a procedurally built, original-asset open world. The strongest work is the player gait system (stride-matched, driven by actual displacement, so feet don't slide), the pedestrian reactions (glance / sidestep / yield / hurry / wait-at-curb), the enemy 8-state machine with real 3D line of sight and no damage through walls, police intercept/flanking geometry, the cinematic skip/event safety (a skip can never lose a story event), the dialogue skip guards and event-once semantics, the job-mission marker, traffic brake lights, the police light bar, coin/target feedback, and the defence-beacon telegraphing. The touch layer's core (pointer capture with per-pointer-id checks, safe-area handling, double-tap guards) is well engineered.

The systemic weaknesses are consistent across categories, which is why they read as one pattern rather than many small issues:

1. **No aim pose.** The character never raises the weapon; the barrel visibly disagrees with the crosshair mid-stride. This is the single most visible animation gap in combat.
2. **Police chases don't hold together at the top end.** A dead band stalls on-foot arrests (7–9 m), roadblocks can never form at wanted levels 4–5 on the default unit count, a roadblock dissolves 18 m early with its cars staggered 16 m apart, and pursuit top speed (16.5–22.5 m/s) can never catch the GT (38 m/s) on a straight.
3. **No exit animation anywhere.** Every screen and panel fades in and then vanishes instantly on close; Esc and backdrop-click close nothing; there is no keyboard pause.
4. **A frozen ambient world.** Static vegetation, sky, windows, neon, and a shadow frustum that ends mid-city (±100 m — the Beacon Tower and the beach get no shadows).
5. **An inconsistent marker system.** The story marker is ~3× fainter than the job marker and animates off the wall clock; sprint/garage/shop markers are completely static; the Range rack has no beam at all.
6. **Mobile layout is cramped at 390 px.** Driving controls shrink ~15% instead of fitting, many touch targets are 26–36 px (below the 44 px guidance), and scrollable panels may not scroll by touch (`touch-action: none` with no `pan-y` override).
7. **One real dialogue defect.** Completing a line with the typewriter's complete-line path regresses: the text visibly shrinks and re-types (7.1, High, panel-only fix).

Nothing here touches save data except one optional design decision (5.13, a bust count would be a new field defaulting to 0). No finding changes mission logic, cash, or progression unless explicitly flagged as a balance change (4.10, 4.11, 5.9, 5.12, 5.13).

## Live-observation evidence (this audit, real browser)

Observed live against the production build, 2026-11-20:

- **Player walk/sprint/turn:** player moves north up the avenue; two walk screenshots 2.5 s apart show different stride poses (mid-stride leg positions differ); sprint samples show the player covering ground; turning left changes heading and position. Gait visibly cycles. Screenshots: `qa/audit-walk-a.png`, `qa/audit-walk-b.png`, `qa/audit-sprint.png`, `qa/audit-idle.png`.
- **Vehicle (re-probe, after the first script's enter failed on distance):** E entered the car on the first attempt from 1.8 m; drive 0 → 1.6 → 10.77 → 13.89 m/s across samples, peaking at **25.47 m/s (92 km/h)**; steering left changed heading 3.14 → 3.84 rad; S braked from 25.47 m/s; exit returned to walk mode; console clean. Screenshot: `qa/audit-drive-b.png` (chase camera, 50 km/h, gear D, green traffic light, crosswalk, pedestrian at curb).
- **Cinematic 1.1 (`cine-first-light`):** entry blend confirmed numerically — camera swept from the gameplay pose (66, 4.8, 14.1) to the shot pose (60, 4.7, 38.8); intra-shot drift confirmed (z 38.8 → 30.0 over the shot); Skip advanced the cinematic to shot 1 (camera 58.6, 2.1, 11.4). Screenshot: `qa/audit-cine-b.png`.
- **Ocean:** shader time uniform advanced `uTime` 4.37 → 4.87 over 3 real seconds — the water animates.
- **Mobile 390 px:** menu renders 5 buttons with no horizontal overflow; touch inventory — joystick 118×118, knob 52×52, FIRE 76×76, RUN 76×76, switch/reload 58×58, touch-look area covering the right 55% of the screen; "Start FIRST LIGHT" prompt visible near Mara; garage opens via the touch "Enter Sunset Garage" button with no overflow (`scrollWidth` 390); console clean. Screenshot: `qa/audit-m-hud.png`.
- **Auto quality step-down works:** the HUD chip changed from "Medium" to "Low — battery saver" during the headless runs (1 FPS SwiftShader), as designed.
- **One console error observed once** (desktop run 1): `PAGEERROR: Failed to execute 'setPointerCapture' on 'Element': InvalidStateError`. Not reproduced in the later runs. Listed as finding L-1 (Low).
- **Not observed live in this run:** the dialogue typewriter and the 7.1 complete-line regression (the cinematic was still in shot 0/1 during the sampling window — headless sim time runs ~10% of real time, so a 4 s shot takes ~40 real seconds); weapon firing numbers (the probe used wrong accessors — `getCurrentWeapon`/`getMagazine`/`isAiming` do not exist; the real API is `getHudState`/`getWeaponState`). Both rest on code inspection plus the 9F live-verification record (dialogues were played end to end and weapons fired in 9F QA). They are labelled accordingly below and must be watched live before their fixes are called done.
- **Headless artefacts, not game defects:** one screenshot timed out at 30 s in run 1 (the run died; later runs used a 12 s guard and continued); FPS reads 1 in headless SwiftShader (not a real measurement).

---

## Category 1 — Player

### 1.1 [BUG — Medium] Defeat is an instant snap to lying flat, with no fall — code inspection only; verifiable in a real browser
- **File:** `src/game/Player.ts:111` (`setDowned` sets `group.rotation.x = -Math.PI / 2` in one frame); triggered from `src/game/GameEngine.ts:2367-2369` (health ≤ 0 → `setDowned(true)`).
- **Currently:** the standing character rotates −90° about X in one frame and lies rigidly flat; `update()` then ignores input. No fall, no easing, no settle.
- **Professional standard:** a 0.4–0.7 s fall — torso pitches with accelerating ease, knees give, body settles with a small bounce — so defeat reads as an event, not a pop.
- **Meets standard:** no.
- **Improvement:** ease `rotation.x` toward −π/2 over ~0.5 s (same easing pattern the file already uses for speed/pose), optionally with a slight forward pitch first. Purely cosmetic; `downed` state logic untouched.
- **Risk:** very low — isolated to `setDowned`; no gameplay, save, or performance impact.

### 1.2 [GAP — High] No aim pose — the character never raises the weapon — code inspection only; verifiable in a real browser
- **File:** `src/game/CharacterAnimation.ts` (no aim state; states are only `idle | walk | run | sprint`, `update()` at :106–165); `src/game/Combat.ts:315-322` (shot ray originates from the camera through the crosshair, not from the weapon).
- **Currently:** firing is hip-fire from third person. The right arm keeps swinging with the gait (arm swing ±0.4 walk / ±0.85 sprint, `CharacterAnimation.ts:64-66`) while the gun — parented to `elbowR` at `Combat.ts:260` — swings with it. The shot itself is accurate (camera ray), but the barrel visibly points wherever the arm swing puts it, which can be well away from the crosshair mid-stride.
- **Professional standard:** while firing or holding fire, the right arm locks forward toward the aim point (two-handed for the carbine), the torso squares slightly to the target, and the gait arm-swing is suppressed; the barrel and the crosshair agree.
- **Meets standard:** no.
- **Improvement:** add an `aim` pose target blended in when the fire button is held or recently fired (e.g. within 0.6 s of a shot): right arm forward, left arm supporting for the carbine, arm swing amplitude driven to ~0. No change to the ray, damage, or fire rate.
- **Risk:** low–medium — animation only, but it touches the pose targets in `CharacterAnimation.update()`; must not disturb the surrender pose path or the stride-matched gait.

### 1.3 [GAP — Medium] No reload animation — code inspection only; verifiable in a real browser
- **File:** `src/game/Combat.ts:273-292` (`startReload`/`finishReload` only flip flags and move ammo after `reloadSeconds` — 1.4 s Palm 9, 2.2 s carbine, `src/game/Weapons.ts:52,67`); HUD shows progress via `reloadProgress` (`Combat.ts:522`).
- **Currently:** reload is HUD-only. The weapon model does not dip, tilt, or move; no hand goes to it, no magazine is visible. The character keeps walking with the normal gait.
- **Professional standard:** the weapon dips/tilts, the left hand comes across, a short magazine-out/in beat plays inside the reload duration, then the weapon returns to ready.
- **Meets standard:** no.
- **Improvement:** drive a reload pose from `reloadProgress` (already computed): weapon dips ~25° and shifts toward the body mid-reload. No timing changes.
- **Risk:** low — visual only; reload timing and ammo logic untouched.

### 1.4 [GAP — Medium] No weapon-switch animation — code inspection only; verifiable in a real browser
- **File:** `src/game/Combat.ts:449-470` (`switchWeapon` disposes the old model and attaches the new one in the same frame via `attachModel`).
- **Currently:** the weapon swaps instantly — one frame it's a pistol, the next a carbine — with no lower/raise.
- **Professional standard:** a ~0.3 s lower-and-raise (or quick swap flourish) so the change reads as an action.
- **Meets standard:** no.
- **Improvement:** brief lower/raise driven by a switch timer; the model swap happens at the bottom of the motion.
- **Risk:** low — visual only; ownership/equipped state untouched.

### 1.5 [GAP — Medium] No damage flinch on the character — code inspection only; verifiable in a real browser
- **File:** `src/game/Combat.ts:486-494` (`damage()` only reduces `health`, with a 600 ms immunity window); feedback is only the red vignette flash in `src/components/CombatHUD.tsx:23-39` (350 ms, triggered on health drop) plus health regen (10/s after 5 s calm, `Combat.ts:36-37`).
- **Currently:** taking a hit changes no pose — the character keeps its gait exactly. The vignette is good, but the body gives no feedback.
- **Professional standard:** a short flinch — torso jerks back ~0.1 rad, head dips, gait stutters for ~0.2 s — so hits are felt in the character as well as the screen.
- **Meets standard:** partially (screen feedback exists; body feedback does not).
- **Improvement:** add a decaying flinch offset to torso/head pose on `damage()`; keep the vignette.
- **Risk:** very low — additive pose offset only.

### 1.6 [GAP — Medium] Vehicle entry/exit is an instant hide/teleport — code inspection only; verifiable in a real browser
- **File:** `src/game/GameEngine.ts:1938-1946` (`enterVehicle` sets `mode='drive'` and `player.mesh.visible=false` in one frame); `:1948-1978` (`exitVehicle` teleports the player to a candidate spot beside the car and re-shows the mesh).
- **Currently:** the character vanishes the instant E is pressed and reappears beside the car on exit. No walk-to-door, door-open, or get-in/out beat. What saves the feel is the camera: `camBlend` eases walk↔chase over `dt*3.5` with a smoothstep (`GameEngine.ts:2444-2448`), so the view never snaps.
- **Professional standard:** a 0.6–0.9 s entry (character steps to the door, fades/hides as the door would open) and exit (appears at the door, steps clear), or at minimum a short fade so the pop is invisible.
- **Meets standard:** no — mitigated by the good camera blend.
- **Improvement:** shortest safe version is a ~0.25 s fade of the character mesh on enter/exit; the fuller version is a scripted step-to-door. Either way the mode switch and E-queue timing must stay as they are.
- **Risk:** medium — touches interaction timing and the one-active-activity lock; a badly timed animation could delay or swallow the E press. Keep the mode switch instant and animate only the visuals.

### 1.7 [GAP — Low] Respawn is an instant teleport with no fade — code inspection only; verifiable in a real browser
- **File:** `src/game/GameEngine.ts:1870-1935` (`respawn()` resets position, heading, health, input in one frame); invoked directly by `BustedScreen`/`DownedScreen` (`src/components/GameCanvas.tsx:710,712`).
- **Currently:** the player blinks from the BUSTED/TAKEN DOWN screen back to the spawn plaza instantly.
- **Professional standard:** a 0.3–0.5 s fade to black and back across the respawn, so the teleport reads as a transition.
- **Meets standard:** no.
- **Improvement:** fade overlay in/out around the `respawn()` call. No change to spawn position, health, or state resets.
- **Risk:** very low — UI overlay only.

### 1.8 [BUG — Medium] The walking camera can clip inside buildings — code inspection only; verifiable in a real browser
- **File:** `src/game/GameEngine.ts:2484` — `avoidCameraClipping` is called only for `_chasePos` (the driving camera). The walking orbit camera (`_walkPos`, distance 8.5, `camDistance` at `:344`) has no collision handling at all.
- **Currently:** walking with your back to a building wall puts the orbit camera inside the building geometry; the view goes through walls.
- **Professional standard:** the orbit camera pulls in until it is outside every building, exactly as the chase camera already does.
- **Meets standard:** no (driving camera: yes; walking camera: no).
- **Improvement:** apply the same `avoidCameraClipping` pull-in to `_walkPos` before the walk/chase lerp. The helper already exists and is proven.
- **Risk:** low — camera only; no gameplay or save impact.

### 1.9 [GAP — Low] Sprint has no speed feedback beyond the gait — code inspection only; verifiable in a real browser
- **File:** `src/game/GameEngine.ts:2428-2501` (`updateCamera` — no FOV or shake anywhere; grep for `fov|FOV|shake` in `GameEngine.ts` and `GameCanvas.tsx` returns nothing).
- **Currently:** sprint is faster movement (10.5 vs 6 m/s, `Player.ts:36-37`) plus a bigger gait (leg 1.0, lean 0.2, bob 0.055, `CharacterAnimation.ts:66`). The camera is identical at walk and sprint speed.
- **Professional standard:** a subtle FOV widening (+2–4°) and/or a faint speed feel at sprint, so velocity is felt, not just measured.
- **Meets standard:** partially — the gait sells it; the camera does not.
- **Improvement:** ease FOV +3° while sprinting. Camera only.
- **Risk:** very low.

### 1.10 [GAP — Low] No strafe / backpedal pose; moving backward spins the character 180° — code inspection only; verifiable in a real browser
- **File:** `src/game/Player.ts:165-175` — the character always eases its heading toward the movement direction (`targetYaw = atan2(vx, vz)`), so pressing S turns the character around and it walks forward away from the camera.
- **Currently:** consistent with the camera-relative movement scheme, but there is no way to walk backward while facing the camera — the pose set has no strafe or backpedal.
- **Professional standard:** third-person shooters keep the character facing the camera while strafing/backpedaling, with dedicated sideways/backward leg cycles.
- **Meets standard:** no, but this is a design choice, not a defect.
- **Improvement:** only if an aim mode is added (see 1.2): while aiming, face the camera and strafe; otherwise leave as is.
- **Risk:** medium — changes movement feel and the turn system; do not do standalone.

### 1.11 [GOOD — no action] Gait, turns, idle, and surrender already meet a professional bar — observed live + code inspection
- **File:** `src/game/CharacterAnimation.ts:64-66` (distinct walk/run/sprint GAIT tables), `:130-135` (stride-matched phase: `phase += dt·π·speed / stride`, so feet match ground speed), `src/game/Player.ts:160-175` (animation driven by *actual* displacement, so pushing against a wall stops the legs instead of sliding in place), `:171` (heading eases at `dt*12` with shortest-angle wrap), `CharacterAnimation.ts:151` (torso leans into turns, head counter-rotates, both clamped), `:174-185` (hands-up surrender eases at `dt*6`, arms −2.7 rad overhead, gait frozen).
- **Currently:** idle breathes (torso ±0.012, head ±0.12, body ±0.004), walk/run/sprint are distinct and blend via per-joint easing (`k = dt*10`), turns lean the torso and counter-rotate the head, and the surrender pose is a proper eased pose, not a snap. **Observed live:** two walk screenshots 2.5 s apart show different stride poses; the character reads as walking, not sliding.
- **Meets standard:** yes — the strongest animation work in the game; no change needed.
- **Minor nits (Low, optional):** no foot IK, so feet can float a few cm at sprint bob extremes; the face is static (no blinking). Neither is worth touching in a polish pass.

### 1.12 [GOOD — no action] Firing feedback is solid at the weapon/camera level — code inspection only (not re-measured in this run; 9F live record covers firing)
- **File:** `src/game/Combat.ts:315-322` (camera-ray with per-weapon spread), `:443-460` (muzzle flash sprite 50 ms, tracer line fading over 90 ms, both from the real muzzle anchor), `:465-468` (weapon kick `−0.06·kick`, camera recoil pitch `0.035·recoil`, decays at `dt*8`/`dt*6`); `src/game/WeaponModels.ts` (barrel along +z, muzzle anchor at the tip).
- **Currently:** every shot has flash, tracer, kick, and camera recoil; the two weapons differ correctly (Palm 9 semi-auto 0.3 s, carbine auto 0.11 s, `Weapons.ts:52,67`).
- **Meets standard:** yes at the weapon/camera level; the gap is the character pose (see 1.2), not the shot feedback.

---

## Category 2 — Vehicles

### 2.1 [BUG — High] The mission sedan's wheels never spin — code inspection only; verifiable in a real browser
- **File:** `src/game/MissionVehicle.ts:37-48` (four wheel meshes built, `wheel.rotation.z = π/2` set once at build, pushed to a `wheels` array); `:92-131` (`update()` moves `group.position`, sets `group.rotation.y = heading`, and never touches `wheels` again).
- **Currently:** the 2.1 TAIL SPIN target sedan glides for 500 m with completely static wheels while the player's car (`Vehicle.ts:449` — `spinGroups.rotation.x += speed·dt / wheelRadius`) and every traffic car (`Traffic.ts:535,622` — `wheelSpin += speed·dt / wheelR`) spin theirs correctly.
- **Professional standard:** wheels rotate at `speed / wheelRadius`, exactly as the other two vehicle systems already do.
- **Meets standard:** no — an inconsistency inside the game's own systems, on screen for the whole of a story mission.
- **Improvement:** in `update()`, rotate each wheel by `speed·dt / 0.34` (wheel radius 0.34, `MissionVehicle.ts:35`). One-line-class fix, same pattern as `Vehicle.ts:449`.
- **Risk:** very low — visual only; the follow evaluator reads position/heading, never wheel rotation.

### 2.2 [GAP — Medium] No suspension or body motion on any car — code inspection only; verifiable in a real browser
- **File:** `src/game/Vehicle.ts:440-452` (`update()` sets only `group.position` x/z and `group.rotation.y`; `position.y` is always 0); `src/game/Traffic.ts:600-615` (traffic body matrix is heading + position only).
- **Currently:** cars are rigid slabs — no pitch under acceleration/braking, no roll into turns, no bounce over anything, no wheel-arch compression. The driving model itself is good (see 2.3), but the body never reacts to it.
- **Professional standard:** small damped pitch (brake dive, accel squat, ~1–2°) and roll into turns (~1–3°), plus a faint idle/body settle, so the car feels sprung rather than bolted to the ground plane.
- **Meets standard:** no.
- **Improvement:** derive pitch/roll from longitudinal/lateral acceleration and ease them onto the body group only — keep the collision circles on the un-pitched position. Traffic can reuse the same tiny roll from its turn rate.
- **Risk:** low — visual only, provided the body transform stays separate from the collision position (it already is: collision uses `pos`, visuals use `group`).

### 2.3 [GOOD — no action] Player-car driving model and wheel behaviour — observed live + code inspection
- **File:** `src/game/Vehicle.ts:397-399` (speed-sensitive steering: `maxSteer = 0.55·handling / (1 + speed·0.055)`, eased at rate 5/8), `:403-413` (brake 26, handbrake 20 with 1.3× drift yaw above 6 m/s, reverse capped at 10 m/s, top-speed falloff), `:417-418` (bicycle-model yaw rate `−speed/WHEELBASE·tan(steer)`), `:449` (wheel spin from speed/radius), `:451` (front steer pivots `rotation.y = −steer`), `:60-63` (reverse/brake constants), gear display `R/N/D`.
- **Currently:** correct arcade kinematics with real differentiation per car (spec + garage upgrades drive top speed, accel, handling). Wheels spin and steer correctly.
- **Observed live:** enter on first E from 1.8 m; 0 → 25.47 m/s (92 km/h); steering left changed heading 3.14 → 3.84 rad; S braked; exit returned to walk; chase camera stable at 50 km/h in the screenshot.
- **Meets standard:** yes.

### 2.4 [GOOD — no action] Traffic cars spin, steer, and signal braking — observed live + code inspection
- **File:** `src/game/Traffic.ts:535,622` (wheel spin), `:426` (steer eased at `dt*6`, clamped ±0.5), `:646` (tail-light colour brightens when braking: red 1.0 vs 0.4), `:530-538` (speed eases, `braking` flag set when decelerating).
- **Currently:** AI cars read as alive — wheels turn, front wheels steer into corners, brake lights flare.
- **Observed live:** traffic cars visible on the avenue in the walk/drive screenshots, with a green traffic light and a pedestrian waiting at the curb.
- **Meets standard:** yes.

### 2.5 [GAP — Low] The player's car has no brake-light feedback — code inspection only; verifiable in a real browser
- **File:** `src/game/Vehicle.ts:170,173` (headlight emissive 2.0, tail-light emissive 1.8 — constant, always on); contrast `Traffic.ts:646` (traffic tails brighten on braking).
- **Currently:** the player's tail lights never change — braking, reversing, and cruising all look identical from behind.
- **Professional standard:** tail lights brighten under braking and reverse lights show in reverse, matching the traffic system one metre away.
- **Meets standard:** no.
- **Improvement:** vary the tail material's `emissiveIntensity` with brake/reverse state (the material is a shared batched mesh, so this needs a per-car emissive control or a small separate brake-light mesh).
- **Risk:** low — visual only; note the batched-material wrinkle in implementation.

### 2.6 [GAP — Low] Collisions have no visual jolt — code inspection only; verifiable in a real browser
- **File:** `src/game/Vehicle.ts:430-438` (two axle-circle collision; on hit, `speed *= 0.5`).
- **Currently:** hitting a wall just halves the speed. No body jolt, no camera kick, no bounce.
- **Professional standard:** a short body jolt + tiny camera kick on impact, so the bump is felt.
- **Meets standard:** partially (the slowdown is correct; the feedback is absent).
- **Improvement:** on collision, add a one-shot pitch impulse and a small camera kick decaying over ~0.2 s.
- **Risk:** very low — additive only.

### 2.7 [GOOD — no action] Chase camera and entry/exit camera blend — observed live + code inspection
- **File:** `src/game/GameEngine.ts:2444-2487` (`camBlend` eases walk↔chase at `dt*3.5` with smoothstep, so entering/exiting never snaps), `:2040-2042` (drag orbits the chase camera, `chaseYawOffset` clamped ±1.4), `:2484,2503-2511` (`avoidCameraClipping` pulls the chase camera in until outside every building), `:2490-2499` (0.8 s exit blend from the last cinematic pose).
- **Currently:** the chase camera is the most polished camera in the game.
- **Observed live:** stable chase framing at 50 km/h in `qa/audit-drive-b.png`.
- **Meets standard:** yes. Minor nit (Low, optional): chase distance is fixed at 8.5 with no speed-based pull-back; the height is a fixed `2.0 + camPitch·3.2`.

### 2.8 [GAP — Low] No vehicle damage visuals — code inspection only; verifiable in a real browser
- **File:** `src/game/Vehicle.ts:430-438` (collision only slows the car; no damage state exists anywhere in the file).
- **Currently:** repeated wall impacts leave the car pristine.
- **Professional standard:** at minimum, cumulative cosmetic wear (smoke at heavy damage, or a dented state); many arcade games skip this entirely.
- **Meets standard:** acceptable for the genre; noted for completeness only.
- **Improvement:** none proposed for this pass; if ever added, keep it cosmetic and out of the save data.
- **Risk:** n/a.

---

## Category 3 — Pedestrians

### 3.1 [BUG — High] No physical collision: the player and the car can pass straight through pedestrians — code inspection only; verifiable in a real browser
- **File:** `src/game/NPC.ts` (no player/car collision resolution anywhere in the file); `src/game/GameEngine.ts:2145-2187` (the crowd is updated and its positions are fed to traffic/contracts, but nothing ever pushes an NPC out of the player or the car, and nothing pushes the player out of an NPC — `Player.ts` collision only tests building boxes).
- **Currently:** NPCs *react* — they step aside, yield, hurry, and wait at curbs (see 3.3) — but the reactions are advisory. Walk into an NPC that is mid-wait and you pass through them; drive the GT through a crossing NPC and the car passes through them. No bump, no stumble, no push-out.
- **Professional standard:** at minimum, a circle-vs-circle push-out so bodies are solid; ideally a small stumble/shove reaction when the car contacts one.
- **Meets standard:** no — this directly contradicts the game's own collision design (buildings and cars are solid for the player; the car is solid for traffic).
- **Improvement:** add NPC↔player and NPC↔car circle push-out in the crowd update (radius ~0.5 m), reusing the existing sidestep/wait reactions for the visual response. Keep it out of mission logic.
- **Risk:** medium — touches the crowd update and the car's path; must not fight the existing sidestep (`sideAmt`) or wait (`waitT`) logic, and must not let a pushed NPC leave the sidewalk graph. No save-data impact (NPCs are session-only, recycled from a pool).

### 3.2 [GOOD — no action] Gait, variety, and turning — observed live + code inspection
- **File:** `src/game/NPC.ts:532` (stride-matched phase `phase += dt·π·speed / 1.2`, same system as the protagonist), `:536-553` (leg 0.5 / knee 0.8 / arm 0.4 / bob 0.02, eased at `dt*10`), `:100-112` (12 archetypes: skin, hair style, top/bottom, skirt, height 0.92–1.06, width 0.9–1.12, cruise 1.1–1.9 m/s), `:501-505` (heading eases with `lerpAngle` at `dt*8`, no U-turns in route choice).
- **Currently:** the crowd walks believably, with visible variety and smooth cornering, at ~14 instanced draw calls for up to 28 pedestrians.
- **Observed live:** pedestrians visible on the sidewalks in the walk screenshots, standing and walking at curbs.
- **Meets standard:** yes.

### 3.3 [GOOD — no action] Reactions: glance, sidestep, yield, hurry, wait-at-curb — code inspection only; verifiable in a real browser
- **File:** `src/game/NPC.ts:423-427` (head glance at the player when close and in front, `headYaw` clamped ±0.6, eased `dt*6`), `:449-460` (step aside with a sine-envelope lateral move up to 0.9 m; yield-and-wait 0.7 s when the player closes inside 1.3 m), `:435,441` (hurry at 1.7× cruise on a crosswalk when a car approaches within 10 m; wait 1.2 s at the curb before crossing), `:515-524` (NPC–NPC avoidance: slow to 0.55× and drift 0.35 m/s aside when someone is <1 m ahead).
- **Currently:** the crowd is reactive in five distinct ways, all driven by real geometry (distances, approach angles, crosswalk state from `PedestrianPaths.ts`).
- **Meets standard:** yes — the strongest ambient-AI work in the game.
- **Minor nits (Low):** the glance only fires when the player is on foot and in front; there is no startle/flinch when a car passes close (they just hurry); idle NPCs never look around except via the glance.

### 3.4 [GAP — Low] Idle has no variety — code inspection only; verifiable in a real browser
- **File:** `src/game/NPC.ts:476-484` (idle state: `idleT` 2–8 s at a destination, `desiredSpeed = 0`); `:550` (idle pose is only a breathing bob, `0.004·sin`).
- **Currently:** an idle NPC just stands and breathes. No phone, no looking around, no chatting, no shifting weight.
- **Professional standard:** occasional idle variation — a head look-around, a weight shift, a phone-check pose — so a waiting crowd doesn't read as frozen.
- **Meets standard:** partially (the breathing bob keeps them alive; the behaviour is thin).
- **Improvement:** add a low-frequency idle behaviour (e.g. slow head yaw wander) reusing the existing `headYaw` channel. No new assets.
- **Risk:** very low — additive pose variation only.

### 3.5 [GAP — Low] NPCs vanish instantly when the crowd count is lowered — code inspection only; verifiable in a real browser
- **File:** `src/game/NPC.ts:575-590` (`setCount` deactivates NPCs immediately; inactive instances are zero-scaled via `zeroMat` in the update loop at `:340-356`).
- **Currently:** lowering the pedestrian setting pops NPCs out of existence in one frame. (The far-recycle at 85 m, `:399-403`, is well designed and does not pop near the camera.)
- **Professional standard:** a short fade/scale-down, or only despawn beyond a distance.
- **Meets standard:** partially (recycling is good; setting-change despawn is not).
- **Improvement:** when deactivating via `setCount`, prefer NPCs farthest from the player, or fade them over ~0.5 s.
- **Risk:** very low.

### 3.6 [GAP — Low] Possible shin/shoe clipping under skirt archetypes — code inspection only; verifiable in a real browser
- **File:** `src/game/NPC.ts:190-196` (skirt is a static cone at 0.72·h; legs swing beneath it with hip rotation ±0.5 rad and knee bend to 0.8 rad).
- **Currently:** three archetypes wear skirts over the same swinging legs; at full stride the shin/shoe may poke through the side of the static cone. This is a geometric possibility read from the numbers, not a confirmed visual defect.
- **Professional standard:** the skirt either follows the leg swing or is wide enough that the swing stays inside it.
- **Meets standard:** unconfirmed — needs a visual check.
- **Improvement:** widen the skirt cone slightly or damp the leg swing for skirt archetypes.
- **Risk:** very low — one constant.

### 3.7 [NOTE — no action] No running NPCs, by design — code inspection only
- **File:** `src/game/NPC.ts:432` (`desiredSpeed = arch.cruise * (hurrying ? 1.7 : 1)`) — maximum ~3.2 m/s, still the walk gait.
- **Currently:** even hurrying NPCs walk; there is no run cycle for the crowd.
- **Professional standard:** ambient crowds in open-world games rarely run except in panic states; the walk-only crowd is correct for this game.
- **Meets standard:** yes. No improvement proposed.

---

## Category 4 — Enemies

Baseline: 8-state machine (`patrol | idle | investigate | alert | engage | cover | search | defeated`, `Enemies.ts:36-44`); 3 variants (Yard Enforcer 100 HP/2.2 m/s, Lot Runner 60 HP/3.2 m/s, Northgate Lookout 80 HP/2.6 m/s, `EnemyDefs.ts:31-84`); procedural animation only — legs ±0.45 rad, aiming arm −1.25 rad, body bob 0.03 m, rigid fall to −π/2 eased at `dt*6`, hit = jacket emissive flash 0.15 s (`Enemies.ts:332-360`). No save interaction in `Enemies.ts`/`StoryEncounters.ts` — no save-migration risk from any enemy fix.

### 4.1 [BUG — Medium] Search/investigate timers count travel time, not look-around time — enemies often "search" for 0 seconds — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:475-489` (investigate), `:556-569` (search); constants `SEARCH_TIME = 4` ("seconds looking around"), `INVESTIGATE_TIME = 3` (`:123-124`). `stateT` starts on state entry, but the timeout check sits inside the arrived branch; travel at 0.7× speed to a spot up to ~36–40 m away takes 18–25 s, so the enemy arrives and instantly leaves for `patrol` with zero look-around.
- **Professional standard:** measure the look-around from arrival (separate `arrivedT`).
- **Meets standard:** no.
- **Improvement:** reset `stateT` on arrival via an `arrived` flag.
- **Risk:** low (timer logic only; enemies linger longer, which is the documented intent).

### 4.2 [BUG — Low] Idle duration re-rolled every frame, so idle almost always lasts ~2 s instead of 2–4 s — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:472`: `if (e.stateT > 2 + Math.random() * 2)`. Once `stateT` passes 2 s, each frame's fresh threshold is likely already below it.
- **Improvement:** roll once on entering `idle`, store in an `idleFor` field.
- **Risk:** none.

### 4.3 [BUG — Low] Aim wind-up persists across states and freezes mid-aim — an enemy can fire near-instantly after re-engaging — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:286-291` (`setState` never touches `windup`); it only decrements in the in-range branch of `engage` (`:517-527`) and is only cleared by `resetEncounter` (`:643-668`). A 0.05 s leftover survives LOS break → search → re-spot → alert → engage, or a cover detour.
- **Improvement:** reset `windup = 0` in `setState` when leaving `engage`, or whenever `canSee` is false.
- **Risk:** low (enemies marginally less lethal after interruptions).

### 4.4 [BUG — Low] `alert` ignores line of sight / safe / downed — an enemy commits to `engage` even if the player vanished during the 0.5 s spotting pause — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:491-495` never reads `canSee` (computed each tick, `:430-436`).
- **Improvement:** in `alert`, `if (!canSee) setState(e, 'search')`.
- **Risk:** low.

### 4.5 [BUG — Medium] On losing sight in `engage`, the enemy stands completely still for up to 2 s before searching — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:505-515`: no movement, no heading update in the ≤2 s grace window. Happens in nearly every fight.
- **Professional standard:** a guard who lost his target keeps moving toward the last known position; he does not freeze.
- **Meets standard:** no.
- **Improvement:** drop the 2 s gate or move toward `lastKnown` during the grace period.
- **Risk:** low–medium (enemies become more aggressive/persistent).

### 4.6 [BUG — Low] `DEFEATED_FADE` is not a fade — fallen enemies pop out of existence after 4 s — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:125` comment ("seconds before a fallen enemy fades out") vs `:442-447` (single-frame `visible = false`). The module header also promises "smooth transitions and no teleporting".
- **Improvement:** fade material opacity over ~1 s before hiding — with one caution: verify materials are not shared across enemies first (`EnemyModels.ts:143` shows per-model `flashMats`).
- **Risk:** low, with that caution.

### 4.7 [BUG — Medium] `damageEnemy` never agitates the victim — a shot enemy does not react to being shot — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:679-691` only reduces HP and sets the flash; the only hearing reaction is `onPlayerShot` (`:717-728`), which only flips `patrol`/`idle` enemies within 40 m. Gaps: a hit from beyond 40 m produces no reaction; enemies in `cover`/`search`/`engage` ignore gunshots entirely; an enemy in `cover` being shot stays in cover.
- **Professional standard:** being shot is the loudest possible signal — the victim turns toward the shooter.
- **Meets standard:** no.
- **Improvement:** agitate the victim in `damageEnemy` (set `lastKnown`, transition to `investigate`/`alert`) — requires carrying the shooter's position, which the current `damageEnemy(id, amount)` signature lacks.
- **Risk:** low–medium (difficulty uptick for long-range pot-shots).

### 4.8 [BUG — Low] Patrol waypoints are never validated against buildings — a bad waypoint stalls an enemy forever — code inspection only; verifiable in a real browser only by authoring a bad waypoint
- **File:** `src/game/StoryEncounters.ts:188-195` nudges spawns but passes the `patrol` array through unchanged; `src/game/Enemies.ts:449-466` advances only within 0.4 m, while collision pushes the enemy away every frame. Latent only — shipped waypoints are on open ground.
- **Improvement:** run each patrol point through the same `nudgeToClear` used for spawns.
- **Risk:** none (data-only).

### 4.9 [BUG (latent) — Low] `resetEncounter` does not restore `active`/visibility — code inspection only (caller audit)
- **File:** `src/game/Enemies.ts:643-668` resets health/position/state/timers but never touches `e.active`, `e.visible`, or `model.group.visible` — while the defeated-fade sets `model.group.visible = false`. Not live: every caller pairs reset with activate/deactivate (verified at `GameEngine.ts:935-936, 941-942, 1060-1061, 1065-1066, 1107-1108`; `StoryCampaign.ts:376-377, 381-382, 401-403, 411-412`).
- **Improvement:** restore visibility in `resetEncounter` or document the pairing in the `EnemiesHandle` interface (`Enemies.ts:99-113`).
- **Risk:** low.

### 4.10 [GAP — Medium] Enemy fire is guaranteed-hit — no accuracy roll, spread, or damage falloff — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:362-379`: after the 0.4 s wind-up it re-checks range and LOS, then unconditionally deals 7/10/12 damage. Only mitigation is the global 600 ms damage-immunity window (`Combat.ts:38, 500-512`).
- **Professional standard:** hit probability falling with distance/movement, or damage falloff.
- **Meets standard:** no.
- **Improvement:** distance-based miss chance (keep the tracer firing on a miss).
- **Risk:** medium (balance change; needs playtesting).

### 4.11 [GAP — Medium] "Take cover" is hide-only — enemies never shoot from cover, and never crouch — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:537-554`: cover case walks to a point, faces the player, leaves after 4 s — no firing branch; `updatePose` (`:332-360`) has no crouch pose, so the enemy stands at full height behind a 2 m crate.
- **Professional standard:** cover means shooting from behind something, low; a standing full-height figure behind a crate reads as hiding badly.
- **Meets standard:** no.
- **Improvement:** occasional aimed shots from cover (with existing wind-up) plus a crouch pose.
- **Risk:** low–medium (slightly higher lethality; must not shoot through its own cover — the existing segment test gives the pieces).

### 4.12 [GAP — Low] No flinch/stagger on hit and no death variation — hit = emissive flash only, death = rigid plank fall — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:332-360`.
- **Improvement:** short flinch (body pitch impulse decaying over ~0.15 s) and fall direction varied by hit direction; keep the 4 s hide timing unchanged.
- **Risk:** low (animation-only).

### 4.13 [GAP — Low] Enemy gunfire has a tracer but no muzzle flash (player weapons have one) — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:362-379` (tracer only, 0.12 s fade) vs `Combat.ts:~230-260` (player flash sprite, 50 ms). The enemy rig has a muzzle object (`EnemyModels.ts:135-137`) used only as tracer origin.
- **Improvement:** reuse the player's flash-sprite approach at the enemy muzzle.
- **Risk:** low.

### 4.14 [GAP — Low] Enemies have no separation or coordination — they can stack on each other and on the same cover point — code inspection only; verifiable in a real browser
- **File:** `src/game/Enemies.ts:314-330` (`moveToward` resolves buildings only); `:294-312` (`pickCover` excludes only the enemy's own current point).
- **Improvement:** small radial push between enemies closer than ~1 m (≤3 per encounter, trivial cost) and claim cover points per encounter.
- **Risk:** low.

### 4.15 [GAP — Low] Leash is only enforced on the engage-chase branch, and a driving player is invisible to enemies — code inspection only; verifiable in a real browser
- **File:** leash check only at `src/game/Enemies.ts:529-533`; `search`/`investigate`/`cover` move with no leash check. `canSee` requires `mode === 'walk'` (`:430-436`), so a player in a car is never spotted. Mitigating context: the player also cannot shoot from a car (`Combat.ts` header), so it is mutual disengagement, not an exploit.
- **Improvement:** clamp search/investigate targets to the leash radius; vehicle-presence investigation is a design decision, not a fix.
- **Risk:** low.

### 4C [GOOD — no action]
- Complete, reachable 8-state machine — every state is entered from a real transition; no dead state found.
- Real 3D line of sight (segment-vs-AABB slab test reusing true building heights, `Enemies.ts:166-196`), applied to spotting, firing, and cover validation.
- No damage through walls: `fireAtPlayer` re-validates range and LOS at the moment of firing after a 0.4 s dodgeable wind-up.
- Kinematic, teleport-free movement with circle-vs-building collision and a leash.
- Cheap dormancy: only activated encounters are visible/updated.
- Cover selection validated (within 30 m, building actually between point and player, reachable path).
- Defense-objective behaviour cleanly integrated (objective enemies advance and shoot the objective when the player is not visible).
- Story encounters data-only and leak-proof; spawns nudged clear; defense waves as separate encounter ids; mesh reuse (`story-nest-b` reuses `story-nest-a`'s meshes).
- Combat hit path sound (ray-vs-sphere chest test radius 0.55, buildings occlude, 600 ms global damage immunity prevents multi-enemy insta-kills).
- Defeat wiring thoughtful: +8 wanted heat on public kills, suppressed during story missions so a defense wave cannot spiral heat.

### 4D Does not exist (explicitly checked)
No take-cover crouch, suppression fire, flanking, grenades, melee, reloading, friendly fire, enemy vehicles, vehicle-vs-enemy collision, enemy voice/audio hooks, or ragdoll. No per-enemy accuracy model (4.10) and no aggro-on-damage (4.7).

---

## Category 5 — Police

Tick order: `police.update()` every non-cinematic frame using the previous frame's wanted state (`GameEngine.ts:2178-2194`, one frame of lag, acknowledged in a comment); `wanted.update()` frozen while surrendering/busted or in a cinematic (`GameEngine.ts:2199-2213`); `arrest.update()` on the fresh police verdict — surrender ejects the player from the car, sets the hands-up pose, dispatches the nearest unit (`GameEngine.ts:2219-2251`); BUSTED resets wanted + police (`GameEngine.ts:2244-2248`). `respawn()` (`GameEngine.ts:1870-1935`) resets arrest/wanted/police, returns player and vehicle to spawn/home, clears active contracts/encounters.

### 5.1 [BUG — High] On-foot pursuer stops outside surrender range — a stationary player can stalemate the police forever — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:660-665`: pursuer sets `desired = 0` once `distToPlayer < holdDist`, where `holdDist = 9` (4.5 only for the designated arrest unit, which exists only during surrender). The prompt needs `nearestPursuer.dist <= 7` (`PROMPT_FOOT_DIST`, `Arrest.ts:72`); auto-arrest needs `dist < 7` + speed < 2 + seen for 3 s (`Arrest.ts:93-95, 178-183`). A pursuer stopping cleanly at 7–9 m sits in a dead band: no prompt, no auto-arrest. Meanwhile `seesPlayer` returns `true` automatically under 18 m (`Police.ts:429-430`), so `Wanted.ts:231-238` keeps status at `pursuit`, the unseen timer never accrues, and the 6 s unseen → search → escape path can never start. Same class of dead band the code already fixed once for auto-arrest (`Arrest.ts:87-92`, Phase 7A QA); the 9 m hold reintroduces it one layer up. Braking overshoot may usually carry a unit inside 7 m, so it may not reproduce every time.
- **Professional standard:** a pursuer that has caught the player closes to arrest range; a chase that can neither catch nor lose the player is a stalemate.
- **Meets standard:** no.
- **Improvement:** hold at 5–6 m, or make a pursuer stationary within ~10 m of a stationary visible player creep to prompt range.
- **Risk:** low–medium (could make units nose up to the player more often; on-foot stop rule at `Police.ts:748-751` already stops at 7 m ahead of a pedestrian).
- **Verification:** stand still on foot at wanted level 1.

### 5.2 [BUG — High] Roadblocks can never form at wanted levels 4–5 on the default 4-unit police setting — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:43` (`PURSUERS_FOR_LEVEL = [0,1,2,2,3,4]`), `:470`, `:519-521, 549-560`: roadblock candidates come only from units in `patrol` state and require ≥2. At level 4, 3 of 4 default units are pursuers (1 patroller left); at level 5, all 4 are pursuers (0 left). The level-3+ roadblock feature effectively exists only at exactly level 3 on `normal` count; it works at 4–5 only on `high` (6 units).
- **Professional standard:** the headline level-3+ feature works at every level it is advertised for, on the default settings.
- **Meets standard:** no.
- **Improvement:** reserve 2 units for the roadblock before assigning pursuers at level ≥3, or let a roadblock pull one pursuer off pursuit.
- **Risk:** medium (fewer simultaneous pursuers when a block is up; interacts with 5.3).
- **Verification:** heat to level 4–5, normal count, no roadblock ever forms.

### 5.3 [BUG — High] A roadblock dissolves 18 m before the player reaches it, and its two cars are staggered 16 m apart — it never actually blocks the road — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:500-512` (dissolve when player within 18 m of the block centre); `:560-575` (spots at `(bestA ∓ 2.5, bestS ± 8)` — 16 m apart along the road, 5 m across; road half-width ~±5 m, `Roads.ts:65-66, 76-77`). The cars sit only ~8.4 m from the centre, so they pull away ~10 m before the player reaches the first car; a driver can slalom around the staggered cars. The comment says "the player reached the block"; 18 m is not reaching it.
- **Professional standard:** a roadblock is two cars side by side across the road that hold until contact or until the player is stopped in front of them.
- **Meets standard:** no.
- **Improvement:** place both cars at nearly the same longitudinal position side by side, and dissolve only on close contact (<5 m), on being rammed, or after the player has been stopped in front of it for several seconds.
- **Risk:** medium (parked cars become a real collision problem and the game has no police-car collision/damage model — see 5.12; ramming behaviour needs definition).
- **Verification:** drive at a level-3 roadblock.

### 5.4 [BUG — Medium] Roadblock units teleport to their spots — a visible pop, with no drive-in — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:566-575` (direct `u.x`/`u.z` assignment, `speed = 0`), choosing the farthest patrol units (`:549-558`), to a point ~50 m ahead of the player (`:522-523`). Choosing the farthest units mitigates on-screen pops but does not prevent them.
- **Professional standard:** units drive to their positions; a teleport is only invisible if the unit is provably off-screen.
- **Meets standard:** no.
- **Improvement:** drive assigned units to the spots (travel phase, "set" only on arrival), or require chosen units to be outside the camera frustum / beyond sight range before teleporting.
- **Risk:** low–medium.

### 5.5 [BUG — Medium] Line of sight is a single midpoint test — and under 18 m there is no line-of-sight test at all — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:425-440`: if `d < 18` the function returns `true` before the building test; beyond that, occlusion is tested only by checking whether the midpoint of the unit–player segment sits inside a building (0.5 m margin). No field-of-view cone — a unit sees 360°. A player hiding behind a building 15 m from a police car is "seen".
- **Professional standard:** sight is blocked by buildings at any distance; a midpoint sample is not a segment test.
- **Meets standard:** no.
- **Improvement:** remove the `<18 return true` shortcut (or keep a much smaller radius, e.g. <4 m) and test 2–3 sample points along the segment.
- **Risk:** low (a few more box tests per unit per frame; escaping gets easier — a tuning change).
- **Verification:** hide behind a building <18 m from a police car.

### 5.6 [BUG — Medium] No surrender or auto-arrest is possible while the wanted status is `search`, even with a police car next to the player — code inspection only; verifiable in a real browser
- **File:** `src/game/Arrest.ts:126` (prompt requires `wantedStatus === 'pursuit'`), `:141` (prompt clears when status ≠ `pursuit`), `:155-186` (auto-arrest only inside `prompt` state); `src/game/Wanted.ts:239-247` (6 s unseen → `search`, escape timer 18–34 s). A searching unit can idle beside a stationary player for the whole escape timer with no arrest path; the only way back is re-detection flipping status to `pursuit`.
- **Professional standard:** if a police car is next to you and can see you, you can surrender — whatever the internal status label says.
- **Meets standard:** no.
- **Improvement:** allow the prompt/auto-arrest in `search` when a unit is within foot/caught distances and can see the player, or make search units stop at a standoff distance.
- **Risk:** low–medium (interacts with 5.1 — fix the hold distance first).

### 5.7 [BUG — Medium] There is no auto-arrest in the car — a boxed-in, stopped player can sit forever — code inspection only; verifiable in a real browser
- **File:** `src/game/Arrest.ts:175-186` (auto-arrest gated on `!ctx.driving`); `:80-84, 128-130` (car prompt: speed ≤2, ≥2 units within 12 m, or one within 6 m). On foot, 3 s of a pursuer sitting on a stationary visible player auto-starts the surrender; in the car the same situation only shows the prompt, and it clears as soon as speed exceeds 8 (`Arrest.ts:141`).
- **Professional standard:** the arrest rules are symmetric — a boxed-in, stopped driver gets arrested just like a boxed-in pedestrian.
- **Meets standard:** no.
- **Improvement:** car auto-arrest timer (e.g. 4–5 s boxed-in and stopped).
- **Risk:** low–medium (could frustrate brief stops at a roadblock — the boxed-in condition must be strict).
- **Verification:** get boxed in, stop, wait 30 s.

### 5.8 [BUG — Low] `resetToPatrol()` is an incomplete reset — speed, timers and roadblock cooldown are left stale — code inspection only; verifiable in a real browser only via frame-level observation
- **File:** `src/game/Police.ts:1000-1015` vs `dissolveRoadblock()` (`:580-588`) and `placeAtNode()` (`:352-365`): it does not reset `u.speed` (units keep pursuit speed into patrol), `pendingDt`, `roadblockTimer`, or `goalX/goalZ`, and sets `roadblockCooldown = 0` instead of 15. Latent rather than live in practice (BUSTED/respawn reset wanted to 0 first).
- **Improvement:** zero those fields and set `roadblockCooldown = 15`.
- **Risk:** very low.

### 5.9 [GAP — High] Pursuit top speed is far below the player's cars — police can never catch the GT in a straight line — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:660-661`: `desired = (15 + 1.5 * level) * DIFF_SPEED[diff]` → 16.5 m/s at level 1, 22.5 m/s at level 5 on normal (19.1–25.9 on hard), vs GT 38 m/s, Vortex RS 42 m/s, Shadow LX 34 m/s (`VehicleCatalog.ts:64, 87, 110, 133`). Lead-intercept (`Police.ts:621-627`, clamped to 3 s) and flanking (`:628-638`, ±12 m) help at intersections, but on an open straight the player drives away; the recycle ring (`:797-802`, 75–95 m) keeps respawning units behind. No rubber-banding.
- **Professional standard:** a chase that can never close on a straight is not a chase — the pursuer should at least threaten, and the player should escape by out-driving, not by cruising.
- **Meets standard:** no.
- **Improvement:** raise pursuit speed (e.g. 20 + 2 × level, or a fraction of the player's current speed with a cap) and/or mild rubber-banding for the nearest pursuer. Retune alongside 5.2–5.3.
- **Risk:** medium (chase difficulty/escape balance).

### 5.10 [GAP — Medium] Pursuit navigation only replans at intersections — a pursuer commits to a full block in the wrong direction — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:640-653`, `:770-788` (next edge chosen only when `dist < 1.8` to the node); avenues/streets spaced 60 m (`PedestrianPaths.ts:28-29`). No reverse gear anywhere (speed never negative, `Police.ts:756-757`).
- **Improvement:** re-evaluate `chooseNextToward` on a short timer (~0.5 s) when in `pursue`; add a low-speed reverse when the target is >~150° behind and speed is near zero.
- **Risk:** medium (oscillation at intersections; reverse needs collision care).

### 5.11 [GAP — Medium] Turning is a heading-lerp with no speed-dependent model and no building collision — cars can cut corners and clip — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:648-655` (`turnRate = 6` for U-turns, else `3.2`, independent of speed); `:668-669` (turn >0.35 rad caps speed to ~55% of cruise; U-turn caps to 3.5 m/s); `:759-763` (position integrates along heading). `buildings` appears in `Police.ts` only at `:57, 431-439` (the sight test) — no building collision for police movement.
- **Improvement:** scale `turnRate` down with speed; add a cheap building AABB push-out (same test the player uses).
- **Risk:** low–medium.
- **Verification:** whether clipping is visible needs a real browser (watch pursuits through intersections at speed).

### 5.12 [GAP — Medium] Police cannot be rammed, damaged, PIT-manoeuvred or stopped — indestructible ghosts that only ever slow down — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:732-752` (police only reduce `desired` to 0 or match speed when something is ahead within a 2.0 m lateral corridor); `PoliceUnitState` has no damaged/disabled state (`Police.ts:46`); police units are not in the `aiVehicles` list passed to wanted (`GameEngine.ts:2184-2186`), so ramming a police car is not even a heat offence (`Wanted.ts:158-176`). The nudge-apart code (`Police.ts:805-841`) only separates police–police and police–traffic.
- **Professional standard:** contact with a police car has a consequence — a spin, a slow, a disabled unit, or at least heat.
- **Meets standard:** no.
- **Improvement:** contact/ramming mode at higher levels with a player spin/slow effect plus a simple disabled state — a feature, not a one-line fix.
- **Risk:** high (vehicle collision, player control, difficulty balance, arrest flow). Do not bundle into a QA pass.
- **Verification:** drive into a pursuer.

### 5.13 [GAP — Medium] BUSTED has no consequence — no fine, no lost cash, no failed mission, despite the screen saying "the city remembers" — code inspection only; verifiable in a real browser
- **File:** `src/components/BustedScreen.tsx:18`; `respawn()` (`GameEngine.ts:1870-1935`) never touches cash; only active contracts/encounters are cancelled (`:1883-1900`); job/story missions are not failed by the arrest path; no bust record exists anywhere.
- **Professional standard:** getting busted costs something — a fine, a failed mission, or at minimum a record — or the screen should not promise consequences.
- **Meets standard:** no.
- **Improvement:** decide the penalty (fine scaled to wanted level, or fail the active mission/contract), show it on the BUSTED screen, persist a bust count if the line is kept — a new save field, default 0. **This is a design decision, not just code, and the only finding in categories 4–7 that would touch save data.**
- **Risk:** medium (failure cost and mission-fail flows; needs a design decision).

### 5.14 [GAP — Low] The BUSTED screen's "frozen city" is not frozen — police and traffic keep moving behind the overlay — code inspection only; verifiable in a real browser
- **File:** `src/components/BustedScreen.tsx:7-9` (comment: "a dark red vignette over the frozen city") vs `GameEngine.ts:2178-2194` (`police.update()` runs in every non-cinematic frame including while `busted`; only wanted/arrest are frozen). Mostly cosmetic; world state also drifts while the player reads the screen.
- **Improvement:** pause the engine update loop while `arrest === 'busted'` (same mechanism as panels), or correct the comment.
- **Risk:** low (respawn button calls `engine.respawn()` directly, not via the loop).

### 5.15 [GAP — Low] The 4th pursuer (level 5) gets no flanking assignment and stacks on the player's position — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:621-638`: ranks 0/1/2 get intercept / −12 m / +12 m; rank ≥3 falls through to direct chase (`gx = px, gz = pz`).
- **Improvement:** add rank-3+ offsets, e.g. a rear slot at intercept −20 m along heading.
- **Risk:** very low.

### 5.16 [GAP — Low] No audio or sensory escalation — no siren, no radio, no spotlight — code inspection only (absence confirmed by grep); verifiable in a real browser — mobile-device check useful for audio levels
- **File:** grep for `siren` across `src/` returns zero hits; light-bar flashing is visual-only (`Police.ts:876-902`, alternating red/blue every 0.4 s, only when `state !== 'patrol'`).
- **Improvement:** looping siren tied to the nearest pursuer's distance/state, reusing the existing audio path if one exists.
- **Risk:** low–medium (audio asset + attenuation; must respect mute settings).

### 5.17 [GAP — Low] Surrender UI gives no warning that auto-arrest is counting down, and the BUSTED screen has no keyboard path — code inspection only; verifiable in a real browser (desktop browser suffices; touch parity best checked on a real device)
- **File:** `src/components/GameCanvas.tsx:686-708` (prompt says only "Cornered — press F to surrender"; no 3 s auto-arrest progress indicator, although `Arrest.ts:178-185` runs a 3 s `autoTimer`); `src/components/BustedScreen.tsx:11-22` (single button; no autofocus, no Enter-key handler, no stats line).
- **Improvement:** expose `autoTimer` progress to the HUD; add `autoFocus` + Enter handler on the BUSTED screen.
- **Risk:** very low (UI-only).

### 5.18 [GAP — Low] Wanted heat can hit 0 mid-search while the HUD still shows level 1 — the escape clock, not the heat, governs — code inspection only; verifiable in a real browser
- **File:** `src/game/Wanted.ts:83` (escape 14 + 4 × level = 18 s at level 1, 34 s at level 5); `:102-106` (level floored to `max(1, ...)` while `status === 'search'`); `:248-258` (heat decays 1.5/s during search; at level 1, 10 heat reaches 0 in ~7 s, but search runs the full 18 s). Intended behaviour per the header comment — but the HUD shows 1 star with 0 heat for up to ~11 s, which reads as a bug.
- **Improvement:** surface `escapeProgress` (`Wanted.ts:108-112`) in the wanted HUD during search (preferred — no behaviour change).
- **Risk:** very low (HUD-only).

### 5.19 [GAP — Low] Minor: `addHeat()` from combat can be silently swallowed by the offence cooldown — code inspection only; hard to verify in a browser without frame-perfect timing
- **File:** `src/game/Wanted.ts:281-285` (public `addHeat` returns early if `offenseCooldown > 0`); called from `GameEngine.ts:2347` (+8 on public enemy defeat) and `GameEngine.ts:632, 640` (+4 for shots in encounters/contracts). A traffic offence within the preceding 1.5 s drops a design-driven heat award entirely.
- **Improvement:** bypass the cooldown for design-driven heat, or a separate cooldown.
- **Risk:** very low.

### 5C [GOOD — no action]
- Intercept + flanking pursuit geometry (`Police.ts:621-638`): clamped (≤3 s) intercept point from real distance/speed; ranks 1–2 take ±12 m flanks — the reason pursuers spread instead of stacking.
- Red-light behaviour split by state (`Police.ts:678-700`): patrol/search stop at reds and yield at unsignalised junctions; pursuit slows to 60% through red instead of stopping.
- Civilian safety (`Police.ts:746-754`): police stop for the player on foot ahead (7 m) and for pedestrians on crosswalks (8 m stop / 13 m slow); proper stop gaps for traffic and each other.
- Recycle ring outside sight range (`Police.ts:797-802`): far units (>100 m) recycled to a 75–95 m ring, deliberately outside the 55–65 m sight range, so recycling cannot magically re-detect a hidden player.
- Far-unit half-rate updates with accumulated dt (`Police.ts:606-614`): units >120 m tick every other frame with skipped dt accumulated — motion stays correct while halving work.
- Roadblock lifecycle hygiene (`Police.ts:580-588`, `:921-956`): dissolve restores patrol + 15 s cooldown; `setCount` dissolves a roadblock properly if a unit is switched off mid-block; arrest-target clearing on deactivation.
- Arrest dead-band fix already in the code (`Arrest.ts:87-92`, Phase 7A QA catch); constants coherent, hysteresis handled (prompt 7 m / clear 10 m; car single-unit 6 m / clear 8 m).
- Surrender/BUSTED state hygiene in the engine: wanted frozen during surrender, no offences/arrests during cinematics, player ejected from the car on surrender, movement/interaction/combat gated on arrest state, BUSTED transition resets wanted + police exactly once.
- Light-bar discipline (`Police.ts:876-902`): red/blue alternation at 0.4 s, lit only while on duty; patrolling units run dark; cheap instance-colour swap, no extra lights.
- Search wandering (`Police.ts:772-785`): searchers pick a random ring node (5–30 m) on reaching the last-known area instead of sitting on it; `lastKnown` is the last *seen* position, so hiding after breaking sight genuinely works.

### 5D Does not exist (explicitly checked)
No police ramming/PIT/contact (5.12); no police damage/disable; no siren or police audio; no police on foot (the "officer approach" is the car driving to 4.5 m, `Police.ts:664`); no helicopter/air support; no fine, impound, or bust record (5.13); no police pursuit of NPCs/traffic — police only ever target the player.

---

## Category 6 — Cinematics

Mechanism: 14 cinematics, 44 shots (`StoryCinematics.ts:39-733`); every cinematic is 3 shots except the finale (5). Shot durations follow a rigid template: shot 1 = 4 s, shot 2 = 3.5 s, shot 3 = 3 s (10.5 s per intro; finale 16.5 s). One camera, fixed FOV 62 (`GameEngine.ts:390-395`). Intra-shot drift interpolates `pos→posEnd` and `lookAt→lookAtEnd` with a single smoothstep (`Cinematic.ts:90-93`, applied at `Cinematic.ts:175-180`). Shot changes blend 0.8 s (`SHOT_BLEND_S`, `Cinematic.ts:86`); shot 0 blends 1.2 s from the live gameplay camera pose (`ENTRY_BLEND_S`, `Cinematic.ts:88`; pose captured in `start()`, `Cinematic.ts:232-245`). Exit: `closeCinematic()` sets `cameraRestoreT = 0` (`GameEngine.ts:1494`); `updateCamera()` lerps back to the live walk/chase pose over 0.8 s with the same smoothstep (`GameEngine.ts:2488-2499`). `camYaw`/`camPitch` untouched during the scene, so the orbit resumes where it left off. Only 2 of 44 shots carry a `dialogueId` (`june-close`, `StoryCinematics.ts:140-147`; `the-choice`, `StoryCinematics.ts:515-525`); `enterShot()` calls `openDialogue()` (`Cinematic.ts:208`), the engine stops the RAF loop, freezing the cinematic clock until the dialogue closes. Skip fires every unfired shot event in order, then runs the single cleanup path (`Cinematic.ts:277-296`); skip is refused while a dialogue is open (`Cinematic.ts:283-287`; button hidden and Esc listener removed, `CinematicOverlay.tsx:37-47, 76-88`). Staging: 1–2 staged actors per cinematic (11 of 14 stage someone; `cine-hold-line` and both endings stage nobody); actors are the protagonist rig recoloured per palette, idle-breathing or optionally walking (`CinematicStaging.ts:37-124`); all disposed in the one cleanup path (`Cinematic.ts:178-188`). Overlay: letterbox bars `max(48px, 7vh)` (`global.css:571-576`), title card only on shot 0 (`CinematicOverlay.tsx:53-58`, CSS animation 3.2 s), narration subtitle with 0.5 s fade/slide (`global.css:596-606`), shot dots, Skip button; overlay fades in 0.4 s (`global.css:563-570`).

### 6.1 [BUG — Medium] Exit blend does not run "0.8 s after a cinematic ends" when a dialogue follows — the camera stays frozen at the last cinematic pose for the whole dialogue — code inspection only; verifiable in a real browser
- **File:** `src/game/GameEngine.ts:1492-1500` (`closeCinematic` sets `cameraRestoreT = 0`, then immediately calls `onDone?.()`); `:1406-1420` (`openDialogue` → `stop()` cancels the RAF loop); `:2488-2499` (restore blend only advances inside `updateCamera`, i.e. inside `tick()`). For the 11 mission intros, `onDone` opens the campaign dialogue (`StoryCampaign.ts:678-690`), which stops the engine before a single restore frame runs — `cameraRestoreT` sits at 0 for the entire dialogue (potentially 10–30 s of reading), and the 0.8 s blend only starts after the dialogue closes. The comment at `GameEngine.ts:2488-2490` ("for 0.8 s after a cinematic ends, the camera eases…") is therefore false for intros; true only for the outros, which have no following dialogue. Behaviour is inconsistent by caller.
- **Professional standard:** one consistent handoff — either the camera restores before the dialogue, or the frozen frame is the deliberate look and the comment says so.
- **Meets standard:** no (inconsistent by caller).
- **Improvement:** decide one behaviour — either run the 0.8 s restore *before* firing `onDone` (delay the dialogue by the blend), or document/keep the frozen-frame dialogue and change the comment (the frozen frame is arguably the nicer look). Do not just change the comment without a product decision.
- **Risk:** low (purely camera pose; `lastCinematicPos/Target` remain valid while frozen).
- **Verification:** play any mission intro and watch whether the camera moves during the following dialogue (it will not).

### 6.2 [BUG — Medium] After an embedded dialogue closes, its shot plays its full duration as a dead, silent static shot — code inspection only; verifiable in a real browser
- **File:** `src/game/Cinematic.ts:195-208` (`enterShot` opens the dialogue at shot entry, before any of that shot's time has elapsed); `:255-275` (`update` only advances `shotElapsed` while the tick runs); `GameEngine.ts:1406-1420, 1423-1430` (dialogue stops/restarts the loop). For `june-close` (3 s) and `the-choice` (3 s), the player reads the conversation, closes it — then watches a further full 3 s of the same static close-up with no narration (both shots have no `narration` field) and no dialogue, before the cinematic ends. The shot's duration is consumed *after* its content, not during it.
- **Professional standard:** when the dialogue is the shot's content, the shot ends with it (or holds briefly, ~0.5–1 s, not a full 3 s).
- **Meets standard:** no.
- **Improvement:** when a shot's dialogue closes, end that shot immediately (advance or complete) — e.g. set `shotElapsed = shot.duration` on dialogue close — or give dialogue shots a short post-dialogue hold (0.5–1 s) rather than the full 3 s.
- **Risk:** low–medium (touches the finale flow; the `onDone` guard in `StoryCampaign.ts:678-690` keys off objective state, not shot timing, so it should be unaffected — verify live).
- **Verification:** play `cine-signal-lost` and `cine-finale` to the last shot, close the dialogue, time the silent hold.

### 6.3 [BUG — Low] Entry and shot-change blends sweep the camera along an unchecked straight line — no collision guard, unlike the chase camera — code inspection only; verifiable in a real browser
- **File:** `src/game/Cinematic.ts:164-185` (`computePose` lerps position/target straight between poses); `:86-88` (blends 0.8 s / 1.2 s); `GameEngine.ts:2434-2441` (cinematic pose applied directly, no clipping check); contrast `GameEngine.ts:2485` + `2503-2512` (`avoidCameraClipping` applied only to the chase camera). Endpoints are hand-placed and claimed "probe-verified clear" (`StoryCinematics.ts:7-10`), but the *path* between them is never checked. The entry blend is the exposure: it lerps from wherever the live camera is (up to ~8.5 m behind the player at the marker, `GameEngine.ts:344`) to shot 0's pose, which can be 30–40 m away (e.g. `cine-first-light` shot 0 at `[60, 5, 42]`, `StoryCinematics.ts:50-57`). A straight line between two clear points can pass through a building. Shot-change blends are shorter (adjacent shots, a few metres apart) and lower-risk.
- **Improvement:** probe-verify the blend *segments* (not just endpoints) for all 14 cinematics (lower-risk), or add a cheap guard in the cinematic branch of `updateCamera` (reuse `avoidCameraClipping`).
- **Risk:** low if verification only; low–medium if a runtime clamp is added (it would alter authored framing if it ever fires).
- **Verification:** watch each cinematic entry for a frame passing through a wall/roof (needs all 14 intros; no real device needed).

### 6.4 [BUG — Low] `enterShot` ignores whether the embedded dialogue actually opened — a failed open loses the dialogue silently — code inspection only; verifiable in a real browser only by forcing a dialogue-start failure (QA hook), not by normal play
- **File:** `src/game/Cinematic.ts:208` (`if (shot.dialogueId) deps.openDialogue(shot.dialogueId);` — return value discarded); `GameEngine.ts:1406-1420` (`openDialogue` returns `false` when `dialogue.start` fails, and restarts the engine). Latent, not live: the validator (`StoryCinematics.ts:694-696`) makes this unlikely for the two shipped dialogue shots (both IDs exist, `StoryDialogue.ts:256, 747`). Impact differs by shot: for `june-cine-signal-lost` only a flavour conversation and its `june-cine-seen` flag would be lost; for `silas-finale` the choice is rescued because the campaign's `onDone` re-opens the same dialogue ID (`StoryDefinitions.ts:751-752`, `StoryCampaign.ts:678-690`).
- **Improvement:** check the return value at `Cinematic.ts:208`; on `false`, `console.error` and either end the shot early or let the cinematic complete so the campaign dialogue opens.
- **Risk:** very low (3-line guard; no happy-path behaviour change).

### 6.5 [GAP — Medium] One easing curve does everything — entry, drift, shot-change, and exit all use the identical smoothstep — code inspection only; verifiable in a real browser by feel
- **File:** `src/game/Cinematic.ts:90-93` (`smooth`); used for drift (`Cinematic.ts:175`) and blends (`Cinematic.ts:180`); exit restore re-implements the same curve inline (`GameEngine.ts:2495`), as does the walk/drive blend (`GameEngine.ts:2447`). Every camera move eases in *and* out symmetrically — one "floaty" feel.
- **Professional standard:** different moves get different curves — a push-in eases out, a settle eases in, a drift is near-linear.
- **Meets standard:** partially.
- **Improvement:** optional per-shot `ease` (`'smooth' | 'easeOut' | 'linear'`) on `CinematicShot` (`CinematicTypes.ts:36-58`), defaulting to current smoothstep so all 44 existing shots are unchanged unless authored otherwise.
- **Risk:** very low (additive, default-preserving).

### 6.6 [GAP — Medium] No hard cuts — every transition is a 0.8 s blend, and every shot is a slow drift; the edit has one tempo — code inspection only; verifiable in a real browser
- **File:** `src/game/Cinematic.ts:86` (0.8 s blend on every shot change, no cut option); `src/game/StoryCinematics.ts:39-733` (all 44 shots have `posEnd`/`lookAtEnd`, i.e. all drift; none hold still). 10.5 s intros read as one continuous slow float rather than edited coverage.
- **Professional standard:** an edit mixes cuts, holds, and drifts; a cut lands a beat, a hold lets a line breathe.
- **Meets standard:** no.
- **Improvement:** optional `transition: 'cut' | 'blend'` per shot (cut = `blendSeconds = 0`) and allow omitting `posEnd`/`lookAtEnd` for a deliberate hold — already supported (`Cinematic.ts:167-172` holds still when omitted) but no shipped shot uses it.
- **Risk:** low (additive; existing shots keep blend behaviour by default).

### 6.7 [GAP — Medium] "Medium" shots are framed as wides — the character occupies ~14% of frame height — code inspection only (distances computed from authored coordinates); verifiable in a real browser by screenshotting the medium shots — no real device required, but the 390 px mobile crop should be checked since nearer framing + letterbox changes the composition
- **File:** e.g. `mara-medium` (`StoryCinematics.ts:55-63`): camera `[58, 2.2, 12]` → subject `[67, 1.5, 6]`, distance ≈ 10.8 m; `rico-medium` ≈ 10 m; `vic-medium` ≈ 8.8 m; `june-medium` ≈ 10.8 m. Camera FOV 62 (`GameEngine.ts:390-395`): visible height at 10.8 m ≈ 13 m, so a ~1.85 m character is ~14% of frame height. Only the "close" shots (`silas-close` ≈ 4 m, `StoryCinematics.ts:499-506`; `june-close` ≈ 4–5 m) get near the character.
- **Professional standard:** a "medium" shot frames the character from roughly the waist up — the face and the performance are readable.
- **Meets standard:** no.
- **Improvement:** move the `*-medium` camera positions to ~3.5–5 m from the staged actor (and re-verify the positions are clear of buildings/props, per the header's own rule) — or rename them and accept wide coverage.
- **Risk:** low–medium (data-only; each moved camera must be re-verified clear; nearer cameras make the fixed-heading staging in 6.10 more noticeable).

### 6.8 [GAP — Low] No lens language at all: fixed FOV, no depth of field, no shake, no roll, no vignette in the cinematic frame — code inspection only (absence confirmed by reading + grep); FOV/vignette verifiable in a real browser; DOF perf would need a real low-end device to judge
- **File:** FOV fixed at construction (`GameEngine.ts:390-395`); `resize()` only updates aspect (`GameEngine.ts:2593-2599`); no `fov`, `focus`, `shake`, `roll`, or DOF code in `Cinematic.ts`, `StoryCinematics.ts`, or the cinematic branch of `GameEngine.ts:2434-2441` (verified by grep). The only vignettes in the codebase are damage/death/mission ones (`global.css:250, 277, 889, 942`), none cinematic.
- **Improvement:** optional per-shot `fov` (lerped like position, restored on exit) and a CSS cinematic vignette on the overlay; DOF (post-processing) is a bigger lift and should be a separate decision.
- **Risk:** low for FOV (must restore to 62 on exit/skip/dispose or the gameplay camera inherits the cinematic FOV); medium for DOF (new render pass, perf cost on low tiers).

### 6.9 [GAP — Low] Letterbox bars appear at full height instantly — only an opacity fade, no slide-in — code inspection only; verifiable in a real browser; the mobile bar height should be checked on a real device (390 px) since the slide + 44 px bar + narration at `bottom: 62px` (`global.css:1100`) is a tight stack
- **File:** `src/styles/global.css:563-576` (`.cinematic-overlay` animates `cinematic-in` 0.4 s, which is opacity-only, `global.css:567-570`); `.cinematic-bar` has fixed `height: max(48px, 7vh)` with no height/transform animation. On end the whole overlay unmounts with no exit animation at all.
- **Improvement:** animate bar height (or `translateY`) on mount; for exit, keep the overlay mounted ~0.4 s after `cinematic` state clears (an exiting class) before unmounting.
- **Risk:** very low (CSS/React-only). Note the mobile rule already shrinks bars to 44 px (`global.css:1098`), so the slide must be tested at 390 px.

### 6.10 [GAP — Low] Staging is static in every dimension the runtime already supports — walk, follow, and look-at targets are all unused — code inspection only (zero-use confirmed by grep/count); verifiable in a real browser once authored
- **File:** walk support exists (`CinematicStaging.ts:57-103`, `walkTo`/`walkSpeed`, default 1.4 m/s; `CinematicTypes.ts:66-71`) but **no** cinematic sets `action` (grep: zero `action:` entries). `CinematicTargetRef` supports `player` / `vehicle` / `character` live targets (`CinematicTypes.ts:24-30`, resolved every frame in `Cinematic.ts:133-162`), but **all 176** `pos`/`lookAt` refs in the data are `kind: 'point'`. Staged actors have a fixed heading for the whole scene (`CinematicStaging.ts:69-71`); they never turn toward the camera, the player, or each other.
- **Improvement:** author one walk-in (e.g. Dana in `cine-chapter2-outro`) and one `character`-follow shot to prove the paths, then expand — data authoring against already-built features, no code change.
- **Risk:** low (walk/follow code paths already validated: `StoryCinematics.ts:717-729` validates walk targets; `Cinematic.ts:147-162` falls back to origin for missing characters).

### 6.11 [GAP — Low] The overlay shows shot dots but no within-shot progress, even though the state already carries it — code inspection only; verifiable in a real browser
- **File:** `CinematicState` includes `shotElapsed` and `shotDuration` (`CinematicTypes.ts:98-105`); the overlay renders only dots (`CinematicOverlay.tsx:66-76`) and never reads those two fields.
- **Improvement:** render a thin progress bar from `shotElapsed / shotDuration` (or cumulative across shots) — prefer a CSS animation keyed to `shotDuration` over per-frame React state (re-render churn).
- **Risk:** very low if CSS-driven; low–medium if per-frame React state is added.

### 6.12 [GAP — Low] Minor dead code / warning noise — code inspection only
- **File:** `setTimeScale` (`Cinematic.ts:315-317`, clamps 0.1–20) has no caller anywhere in `src/`; `validateAll` likewise only defined, never called outside the constructor's own validation (`Cinematic.ts:113-121`). Validator warnings for "stages no characters" (`StoryCinematics.ts:730-732`) fire for `cine-hold-line` (acknowledged as expected in its comment, `StoryCinematics.ts:200-203`) and for both endings (no such comment) — expected establishing shots, but indistinguishable from a real omission in the console.
- **Improvement:** wire `setTimeScale` to a QA/debug affordance or remove it; add an explicit `establishingOnly: true` (or a comment) to the two endings.
- **Risk:** negligible.

### 6C [GOOD — no action]
- Entry and shot-change blends are correct and snap-free: shot 0 blends 1.2 s from the captured live camera pose (`Cinematic.ts:86-88, 232-245`); each later shot blends 0.8 s from the previous shot's *computed end pose* (`Cinematic.ts:197-205`), so no pop at entries or cuts. **Observed live:** the 1.1 entry blend swept the camera from (66, 4.8, 14.1) to (60, 4.7, 38.8) with no snap, and the intra-shot drift ran z 38.8 → 30.0.
- Skip never loses a story event: `skip()` fires every unfired shot event in order before cleanup (`Cinematic.ts:277-296`); the mission-accept event deliberately lives outside the cinematic in the following dialogue. **Observed live:** Skip advanced `cine-first-light` to shot 1.
- Skip cannot strand the finale choice: skipping `cine-finale` before its last shot skips the embedded `silas-finale` dialogue, but the campaign's `onDone` re-opens the same dialogue ID (`StoryDefinitions.ts:751-752`), and the `onDone` guard (`StoryCampaign.ts:678-690`) prevents a double-open. The June embedded dialogue *is* skippable, documented as intentional.
- Skip correctly refused during dialogue, in two layers: runtime refusal (`Cinematic.ts:283-287`) plus hidden button and removed Esc listener (`CinematicOverlay.tsx:37-47, 76-88`).
- One idempotent cleanup path; no leaks, no double-complete: `cleanup()` disposes staged actors, clears state, fires `onComplete` exactly once for complete/skip (never for dispose) (`Cinematic.ts:178-188`).
- Gameplay properly frozen and inputs discarded during a cinematic (`GameEngine.ts:2016-2030, 2059-2096, 2176-2311`); HUD hides (`GameCanvas.tsx:489, 857-863`).
- Validation thorough and fail-safe: duplicate IDs, non-finite coordinates, unstaged follow targets, unknown dialogues/events are errors that refuse the cinematic at runtime; missing targets fall back to origin with a warning rather than crashing.
- Staging positions show care: actors stand ~2 m from the marker facing the player's approach; comments record why each position was chosen and what was moved to avoid clipping (e.g. Rook moved to `(2, 166)` because `(2, 170)` clips a crate face, `StoryCinematics.ts:232-236`; Silas at `(2, -160)` because the tower collision runs to `z = -164`, `StoryCinematics.ts:467-473`).

---

## Category 7 — Dialogue

Mechanism: typewriter is a `setTimeout` chain (not interval/rAF) at `TYPEWRITER_MS = 33` (~30 chars/sec), `DialoguePanel.tsx:16, 49-71`. Runtime is a state machine in `Dialogue.ts` with a 120 ms transition floor (`TRANSITION_FLOOR_MS`, `Dialogue.ts:88`). Choices render only after the line finishes (`DialoguePanel.tsx:173`). Panel opens with `dialogue-in 0.25s ease-out` (`global.css:517-528`); there is no exit animation. Engine pauses while a dialogue is open (`GameEngine.ts:1406-1418, 1423-1429`).

### 7.1 [BUG — High] "Show line" (complete-line) regresses — the typewriter restarts and shrinks the text back after the player completes a line — code inspection only; directly verifiable in a real browser (desktop or mobile) — NOT observed live in this run (see live-evidence note)
- **File:** `src/components/DialoguePanel.tsx:49-77`: the typewriter effect keeps its character counter `i` in a closure local (`let i = 0`, line 54) and drives reveals with a chained `setTimeout` (`tick`, lines 58–65). `completeLine()` (lines 74–77) only calls `setShown(dialogue.text.length)` / sets `shownRef` — it does **not** update the closure's `i` and does **not** cancel the pending timer. The next scheduled tick (≤33 ms later) runs `i += 1; setShown(i)` with the stale small `i`, so the displayed text visibly collapses from the full line back to a few characters and re-types from there. The Continue label and hint flip back too (`typing` recomputes from `shown`, lines 43, 186–190). This contradicts the file's own documented two-tap pattern (`DialoguePanel.tsx:22-25`): first tap completes, second advances. Any player who completes a line and waits more than ~33 ms before pressing Continue again sees the line shrink and re-type, and their next press completes it *again* instead of advancing (extra press required).
- **Professional standard:** completing a line is final — the full line stays, and the next press advances.
- **Meets standard:** no. This is the only functional defect in Dialogue, and the highest-priority fix in this category.
- **Improvement:** in `completeLine`, cancel the pending timer and sync the closure counter — e.g. keep the timer id and `i` in refs, clear the timeout on complete, and set the ref counter to `len`; or make `tick` read `shownRef.current` instead of a stale closure `i`.
- **Risk:** very low (confined to `DialoguePanel.tsx`; runtime, events, saves untouched).
- **Verification:** open any dialogue, press E once mid-line, wait, watch the text.

### 7.2 [BUG — Medium] The whole panel replays its entrance animation on *every* line, because the root div is keyed by node — code inspection only; verifiable in a real browser
- **File:** `src/components/DialoguePanel.tsx:131-136` (`key={dialogue.nodeId}` on the `.dialogue-panel` div) + `global.css:517-528` (`animation: dialogue-in 0.25s ease-out both`, fade + `translateY(12px)`). React remounts the entire panel subtree on every node change, so the 0.25 s fade-and-rise entrance plays for every single line, not just when the conversation opens. It also destroys and recreates all DOM nodes each line (buttons included), so keyboard focus can never persist across lines. The typewriter reset is already handled by the effect deps (`[dialogue.nodeId, dialogue.text]`, line 71), so the `key` is redundant for that purpose.
- **Professional standard:** the panel enters once per conversation; only the text changes per line.
- **Meets standard:** no.
- **Improvement:** remove `key={dialogue.nodeId}` from the panel div (keep the effect deps as the typewriter reset); optionally add a lightweight `dialogue-line-in` fade on the text element only.
- **Risk:** low (purely presentational; no runtime, event, save, or gameplay logic depends on the remount; no other code queries panel DOM by identity).
- **Verification:** advance through any multi-line dialogue.

### 7.3 [GAP — Low] No closing transition — the panel vanishes instantly when a dialogue ends — code inspection only; verifiable in a real browser
- **File:** `src/components/GameCanvas.tsx:865-872` (`{dialogue && (<DialoguePanel ... />)}` — conditional mount/unmount, no exit wrapper) + `global.css:509-560` (only `dialogue-in` exists; repo-wide grep for `dialogue-out|dialogue-exit|dialogue-leave` returns nothing). On close, React unmounts the panel in the same frame the engine resumes (`GameEngine.ts:1423-1429`); no fade/slide-out. Opening gets 0.25 s ease-out; closing gets 0 ms.
- **Improvement:** keep the panel mounted for one exit-animation frame after `dialogue` becomes null (a `closing` state in `GameCanvas.tsx` or a CSS `dialogue-out` keyframe applied before unmount). Do not delay `closeDialogue()`/engine resume — animate the unmount only.
- **Risk:** low (must not gate the engine resume on the animation).

### 7.4 [GAP — Low] Speaker transitions are an instant swap — no portrait/name animation, and the "portrait" is a single initial letter — code inspection only; verifiable in a real browser
- **File:** `src/components/DialoguePanel.tsx:137-150` (portrait + name render) + `global.css:530-536` (`.dialogue-portrait`, `.dialogue-name` — no `transition` or `animation`) + `src/game/StoryCharacters.ts:29-35, 138-141` (speaker = `name` + `color` + `initial` only; `palette` exists for 3D staging but the panel never uses it). When the speaker changes (e.g. `JUNE_CRANES_NEST` flips June → Theo → June across nodes `e1/e2/e3`, `StoryDialogue.ts:591-627`), the medallion letter and name-plate colour swap instantly.
- **Improvement:** brief (~150 ms) crossfade/slide on the name plate and medallion when the speaker changes, keyed by speaker id; portrait art is optional.
- **Risk:** very low (CSS/React only).
- **Verification:** play `june-cranes-nest`, watch the e1→e2 speaker change.

### 7.5 [GAP — Low] Choice buttons pop in with no entrance animation or stagger — code inspection only; verifiable in a real browser
- **File:** `src/components/DialoguePanel.tsx:173-188` (choices render when `hasChoices && !typing`) + `global.css:544-553` (`.dialogue-choices`, `.dialogue-choice` — no `animation`/`transition`). The moment the typewriter finishes, all choice buttons appear in a single frame, fully formed.
- **Improvement:** quick (~120–180 ms) fade/slide-up, optionally staggered 30–50 ms per choice, via a `dialogue-choice-in` keyframe with per-button `animation-delay`.
- **Risk:** very low (CSS only).
- **Verification:** any choice node, e.g. `mara-first-light` m2.

### 7.6 [GAP — Low] Choice selection/hover feedback is a background-colour change only — no press state, transform, or sound — code inspection only; hover/press verifiable in a real browser; absence of sound established by the code grep
- **File:** `global.css:545-553` (`.dialogue-choice:hover` only changes `background` from `rgba(45,212,191,0.1)` to `0.22`; no `:active`, no `transform`, no `:focus-visible` specific to choices) + repo grep for audio/sound in the dialogue files returns nothing. Hover = slightly brighter teal background; click navigates immediately, so there is no selected/pressed state at all, no scale/translate press feedback, and no hover or confirm sound anywhere in the dialogue code. (Keyboard focus does get the global `button:focus-visible` 3 px amber outline, `global.css:32`.)
- **Improvement:** `.dialogue-choice:active { transform: scale(0.98); }` and a slightly stronger hover (border colour); sound only if a UI-sound utility already exists elsewhere — do not invent a new audio system.
- **Risk:** very low (CSS only).

### 7.7 [GAP — Low] Typewriter speed is a flat 33 ms/char with no punctuation pauses — the longest lines take ~7 s to reveal — code inspection only; timing verifiable in a real browser with a stopwatch on the Silas finale line
- **File:** `src/components/DialoguePanel.tsx:16` (`TYPEWRITER_MS = 33`, "About 30 characters per second, per the 9A proposal") + line lengths measured from source: longest line is Silas `s3` at 211 chars (~7.0 s), then Milo `o2` at 189 chars (~6.2 s), Mara `u2` at 170 chars (~5.6 s); 110 text nodes total. Every character, including commas, periods, and em-dashes, costs exactly 33 ms. The player can tap to complete, so this is wait-time, not a block.
- **Improvement (optional):** punctuation pause map in the tick (`.`/`!`/`?` +120 ms, `,`/`—` +60 ms) or drop to ~28 ms/char. Keep the complete-line path; fix 7.1 first, since it interacts with this timer.
- **Risk:** low (panel-only; do with 7.1).

### 7.8 [GAP — Low] Progress indicator ("n / total") is off by one on conditioned linear dialogues — code inspection only; verifiable in a real browser
- **File:** `src/game/Dialogue.ts:116-123` (`progress: linear ? { node: visits, total: current.nodes.length } : null`) + `:176-183` (`visits` increments only when a node is actually entered; conditioned-skipped nodes are bypassed without incrementing) + `src/game/StoryDialogue.ts:481-519` (`ROOK_DOCKSIDE_AFTER`: 4 nodes, `d2`/`d3` mutually exclusive conditioned nodes). In `rook-dockside-after`, the final node displays "3 / 4" even though it is the last line. Progress is `null` in the 12 of 15 dialogues that contain any choices, so this only surfaces in fully linear dialogues.
- **Improvement:** compute the denominator from the reachable path for the current flag state, or suppress `progress` when any node in the dialogue has a `condition` (safer).
- **Risk:** low (`Dialogue.ts` `buildState` only; no event/save impact).
- **Verification:** play `rook-dockside-after` on either branch.

### 7.9 [GAP — Medium] No screen-reader announcement of lines and no focus management when the panel opens — code inspection only; verifiable in a real browser with a screen reader (NVDA/VoiceOver); a real device is not required, but SR testing is the only way to confirm the fix
- **File:** `src/components/DialoguePanel.tsx:131-133` (`role="dialog"`, `aria-label` — present) + line 170 (`role="group"` on choices — present) + line 192 (hint is `aria-hidden="true"`) + line 171 (`<p className="dialogue-text">` — no `aria-live` anywhere in the file) + no `focus()` / `autoFocus` / `tabIndex` call in the component. A screen reader gets the dialog label and can Tab to the buttons, but the spoken line itself is never announced; focus is never moved into the panel when it opens (buttons blur themselves after click, lines 147–149/177–179/196–198, and 7.2's remount destroys focus each line), so keyboard users must Tab in from wherever focus was — though the 1/2/3 shortcuts work globally via the window keydown listener (lines 96–131).
- **Improvement:** visually-hidden `aria-live="polite"` element containing the full line text (not the progressively-sliced text), and move focus to the Continue button or first choice when a choice node appears. Do not put `aria-live` on the typing `<p>` itself (would spam announcements per character).
- **Risk:** low (panel-only; minor risk of double-announcement if combined with the remount — fix 7.2 first or test with a screen reader).

### 7.10 [GAP — Low] Choice keyboard shortcuts cover only Digit1–3; a fourth choice would be unreachable by keyboard (and Numpad/arrow keys don't work) — code inspection only; verifiable in a real browser by pressing 1/2/3 at a choice node; the 4-choice case is hypothetical (no such node exists)
- **File:** `src/components/DialoguePanel.tsx:120-130` (only `Digit1`/`Digit2`/`Digit3`; no `Numpad1–3`, no arrow-key navigation) + choice counts measured from source: max 3 choices per node (11 nodes with 3, 1 node with 2), so current content is fully covered. `validateStoryDialogues()` (`StoryDialogue.ts:813-921`) checks targets, reachability, and end-node rules, but never caps choice count — a writer adding a 4th choice would get a clickable button with no keyboard shortcut.
- **Improvement:** generalise the handler (`Digit1`–`Digit9` + `Numpad1`–`Numpad9`) or add a validator error for >3 choices (the general handler is the smaller change).
- **Risk:** very low.

### 7.11 [GAP — Low] `shownRef.current = shown` is assigned during render — code inspection only; not user-verifiable in a browser (internal code pattern)
- **File:** `src/components/DialoguePanel.tsx:44-46` (ref written as a render side effect so keyboard/click handlers can read live progress without re-subscribing per character, per the comment at lines 125–129). It works, but writing refs during render is a React anti-pattern and can behave unexpectedly under concurrent rendering.
- **Improvement:** move the assignment into a `useEffect`.
- **Risk:** very low (no user-visible behaviour change expected).

### 7C [GOOD — no action]
- Choices can never render before the line finishes — render gate `hasChoices && !typing` (`DialoguePanel.tsx:173`) *and* keyboard gate `shownRef.current >= dialogue.text.length` (`DialoguePanel.tsx:120-130`) agree.
- Skip cannot bypass a decision, twice over — panel hides Skip at choice nodes (`Dialogue.ts:127-131`, `canSkip: choices.length === 0`; `DialoguePanel.tsx:144-158`, Esc handler checks `canSkip` at lines 111–115) *and* the runtime refuses (`Dialogue.ts:237-243`). The finale choice and Rook's job are unskippable by keyboard or button.
- Double-advance guarded three ways — `e.repeat` ignored (`DialoguePanel.tsx:105`), 120 ms `TRANSITION_FLOOR_MS` (`Dialogue.ts:88, 196-197`), buttons blur after click (`DialoguePanel.tsx:147-149, 177-179, 196-198`).
- Two-tap Continue semantics correct in intent — first tap completes, second advances (`DialoguePanel.tsx:80-93`), label/hint switch to match (lines 186–190). Only 7.1 breaks the execution.
- No timer leak on unmount/node change — typewriter effect cleanup sets `alive = false` and clears the pending timeout (`DialoguePanel.tsx:66-69`); the timeout-chain design (comment, lines 49–51) is the right call.
- Dialogue data validated, not trusted — `validateStoryDialogues()` (`StoryDialogue.ts:813-921`) enforces exactly one end node, end node fires an event, no dead ends, all targets resolve, unknown speakers rejected; `Dialogue.ts:186-201` refuses to start a dialogue with validation errors. All 15 dialogues pass.
- Events fire exactly once, including on skip — node events fire on entry (`Dialogue.ts:181-182`), choice `setsFlag` fires before the choice event (`Dialogue.ts:224-232`), `skip()` fires the end node's event before closing (`Dialogue.ts:244-250`). `close()` is the single exit path (`Dialogue.ts:146-152`).
- Engine pause/resume wiring sound — `openDialogue` stops the loop and restarts it if start fails (`GameEngine.ts:1406-1418`); `closeDialogue` restarts and re-reports (`GameEngine.ts:1423-1429`); panel owns its keys while mounted; engine clears queued input on resume.
- Layout stability while typing — `.dialogue-text` has `min-height: 48px` (44 px mobile, `global.css:543, 1094`), so the panel doesn't jump as characters appear.
- Conditioned content works as designed — conditioned nodes skipped with a bounded 10-hop chain and defensive close (`Dialogue.ts:155-175`, `MAX_CONDITION_HOPS = 10`); conditioned choices hidden, not disabled; Rook/finale flags set exactly one of a pair and clear the other (`StoryDialogue.ts:440-470, 700-760`).

### 7D Does not exist (explicitly checked)
- No blinking continue indicator: the "▸" is static text (`DialoguePanel.tsx:189`); the only motion on the button is the shared `prompt-pulse` scale 1↔1.05, 1.6 s infinite (`global.css:556-560`, keyframes `1028-1031`). It pulses identically while typing and when ready — only the label changes.
- No speaker portrait animation or portrait image: no `transition`/`animation` on `.dialogue-portrait`/`.dialogue-name` (`global.css:530-536`); portrait is one initial letter (`StoryCharacters.ts:138-141`).
- No choice hover/click sound, no typewriter blip: zero audio/sound call sites in the dialogue files.
- No choice entrance, selection, or pressed state: no animation on `.dialogue-choices`/`.dialogue-choice`, no `:active` rule, no selected-choice styling.
- No closing/exit transition class: no `dialogue-out`/`dialogue-exit`/`dialogue-leave` anywhere (repo grep empty).
- No typewriter sound, punctuation pause, or per-speaker speed: flat 33 ms/char with no branching on character type (`DialoguePanel.tsx:58-65`).

---

## Category 8 — Environment

**Path correction:** the brief names `src/index.css`; that file does not exist. All styling is in `src/styles/global.css` (1,189 lines), imported at `src/main.tsx:3`. All CSS citations use the real path.

### 8.1 [GAP — Medium] Ocean — animated shader, but flat/unlit with a single foam line — code inspection only; verifiable in a real browser (visual + FPS on low tier)
- **File:** `src/game/Environment.ts:106-145` (vertex: 3 sines, amplitudes 0.35/0.30/0.25, speeds 0.9/0.6/0.4; fragment: shallow `0.16,0.62,0.62` → deep `0.05,0.23,0.42`, foam `smoothstep(6,0,abs(vPos.x+122+sin(vPos.y*0.12+uTime*1.2)*4))`, glitter `smoothstep(0.92,1.0,sin…)`); plane 244×440, 48×48 segments (`:138-141`); `uTime += dt` (`:145-147`), driven by `World.ts:172-174`.
- **Currently:** water rolls gently, foams only at the shoreline; flat `ShaderMaterial` gradient, no lighting, normals, specular, reflection, or breaking waves.
- **Observed live:** the shader clock advances (`uTime` 4.37 → 4.87 over 3 real seconds) — the water does move.
- **Professional standard:** sunset water should read as a lit surface — moving normal/specular sparkle, depth-based colour, foam that advances/retreats, wet-sand transition — while staying cheap.
- **Meets standard:** partially. Motion, shore gradient, glitter are genuinely good for a cheap stylised shader; flat unlit look and single static foam band are below professional quality.
- **Improvement:** add a cheap normal-perturbation/specular term to the existing shader and a second, slower foam band with varying width; no reflections or second ocean mesh.
- **Risk:** low — shader-only, no save/gameplay impact; small GPU cost, verify on low tier.

### 8.2 [BUG — High] Traffic-light yellow bulb defined but never lit; lights flip red↔green instantly, no yellow or all-red phase — code inspection only; verifiable in a real browser by watching one intersection ~15 s
- **File:** `src/game/Roads.ts:260-282` (`YELLOW_DIM = 0x554411` set at `:266/271` in both phases; `timer > 5` then `phaseA = !phaseA`, `applyPhase()`); `SIGNAL_SPOTS` 6 intersections at `:15-22`.
- **Currently:** every 5 s all 6 signalised intersections switch directly green→red and red→green. Middle bulb exists in the 36-bulb `InstancedMesh` but is permanently dim yellow. Traffic AI reads the same state via `isAvenueGreen()` (`:288-289`), so AI and bulbs agree — the defect is visual/logic, not a desync.
- **Professional standard:** 3-state cycle (green → yellow ~2 s → red → short all-red) so drivers/players can anticipate the change; instant flips read as broken.
- **Meets standard:** no.
- **Improvement:** add a yellow phase (e.g. 5 s green, 2 s yellow, 1 s all-red) to the same timer/state machine and expose it to `Traffic.ts` so cars already in the intersection clear it instead of stopping on yellow.
- **Risk:** low–medium — touches `Traffic.ts` stop-line logic (runs a red only if `dist < 4 && speed > 4`); a wrong yellow rule could cause stops mid-intersection. No save impact.

### 8.3 [GAP — Low] Only 6 of 30 intersections are signalised; the rest have no lights at all — code inspection only; verifiable in a real browser
- **File:** `src/game/Roads.ts:15-22` (6 spots: x ∈ {−60,0,60} × z ∈ {−30,30}); grid is 5 avenues × 6 streets (`CityGenerator.ts:144-145`), i.e. 30 intersections.
- **Currently:** 24 intersections unsignalised; traffic yields only via `intersectionOccupied()` checks in `Traffic.ts`.
- **Professional standard:** either signalise major avenues consistently or make unsignalised intersections legible (stop lines/signs).
- **Improvement:** add painted stop lines / small stop-sign props at unsignalised intersections, or extend signals to the downtown core only; do not signalise all 30 (draw/AI cost).
- **Risk:** low (static props); medium if more signals are added.

### 8.4 [NOTE — Low, subjective] No day/night cycle — sunset is frozen — code inspection only; verifiable in a real browser (observe over minutes — nothing changes)
- **File:** absent system — no day/night or time-of-day matches anywhere in `src/game/`. `src/game/Lighting.ts:59,74-89` sets one fixed sky (`#16265e/#ff7e5f/#feb47b`), fixed sun disc at `(-260,42,-320)`, fixed `DirectionalLight #ffc08a, 2.4` and `HemisphereLight 1.25`; no `update()` on the lighting handle.
- **Currently:** lighting, sky, fog (`Fog #e88a6b`, `:59`), shadows never change for the whole session.
- **Professional standard:** a sunset city either commits to a frozen golden-hour look (acceptable) or adds a slow cycle; a frozen look must then be polished (clouds, light variation) to avoid feeling dead.
- **Meets standard:** partially — frozen sunset is coherent and attractive, but the absence is a deliberate scope choice, not a bug.
- **Improvement:** none required unless scope changes. If added later, slow save-independent ambient cycle only, never tied to mission timers.
- **Risk:** N/A if left alone; high if added naively (marker readability, shadows, window lighting).

### 8.5 [GAP — Low] Sky, sun disc, clouds and birds are entirely static; no clouds or sky life exist — code inspection only; verifiable in a real browser
- **File:** `src/game/Lighting.ts:25-69` (sky dome `SphereGeometry(600,24,16)`, gradient shader with no `uTime` uniform; sun disc `CircleGeometry(26)` `MeshBasicMaterial #ffdf8a` at `:68-76`); no cloud/bird code in `src/game/`.
- **Currently:** fixed two-stop gradient sky; sun never moves, shimmers, or sets; sky empty above the skyline.
- **Professional standard:** even a frozen sunset benefits from a few slow-drifting clouds, haze bands, or distant birds.
- **Improvement:** add 4–8 cheap billboard/cloud sprites drifting slowly, or a subtle animated haze band in the existing sky shader; keep outside gameplay.
- **Risk:** very low — cosmetic only; keep draw calls minimal on low tier.

### 8.6 [GAP — Medium] Streetlights are fake — emissive bulbs only, no real light is cast — code inspection only; verifiable in a real browser; perf impact needs a real device on low tier
- **File:** `src/game/Roads.ts:196-214` (instanced poles + lamp spheres, `MeshStandardMaterial emissive 0xffd27a, emissiveIntensity 1.6`, no `PointLight`/`SpotLight` anywhere in `src/game/` — grep returns zero hits; only `DirectionalLight` + `HemisphereLight` in `Lighting.ts:74-77`).
- **Currently:** lamps glow visually but cast no light pool on road, sidewalk, or nearby cars/pedestrians.
- **Professional standard:** at dusk/sunset, streetlamps should pool light on the ground (real lights near the player, or a cheap fake light-disc decal under each lamp).
- **Improvement:** add a small additive ground-glow decal under each lamp, or 2–4 real `PointLight`s only around the player/camera; do not add a light per lamp.
- **Risk:** low for decals; medium for real lights (perf on mobile/low tier).

### 8.7 [GAP — Medium] Player vehicle headlights/taillights are constant — no brake brightening, no beam, no reverse light — code inspection only; verifiable in a real browser
- **File:** `src/game/Vehicle.ts:169-173` (`headMat emissive 0xfff3c0, intensity 2`; `tailMat emissive 0xff2020, intensity 1.8`, both constant); `Vehicle.ts` `update()` only spins wheels/steers and never touches either material.
- **Currently:** headlights glow the same parked or at 178 km/h; tail bar never brightens under braking or reversing — unlike AI traffic (see 8.8).
- **Professional standard:** the player's car — the most-looked-at vehicle — should brighten brake lights on braking/reverse and project at least a fake headlight cone/pool ahead.
- **Improvement:** modulate `tailMat.emissiveIntensity` on brake/reverse input in `Vehicle.update()` (same pattern as `Traffic.ts:646-648`) and add a cheap additive ground-cone ahead; no real `SpotLight` needed.
- **Risk:** low — visual only, no physics/save impact.

### 8.8 [GOOD — no action] AI traffic vehicle lights (headlights always on, brake-reactive tails, steering/spinning wheels) — observed live + code inspection
- **File:** `src/game/Traffic.ts:319-320,632-649` (one shared light mesh, 4 instances/vehicle; headlights constant warm white `RGB(1,0.95,0.75)`; tails `RGB(0.4,0.06,0.06)` dim, `RGB(1,0.06,0.06)` when `v.braking`; `braking = speed < prevSpeed − 0.01 || desired === 0` at `:530`); wheels steer/spin at `:600-630`.
- **Currently:** traffic reads correctly at a glance — brake lights flare when cars stop at lights, queue, or yield. Correct cheap pattern (instance-colour swap, no extra lights/draw calls).
- **Observed live:** traffic cars on the avenue in the walk/drive screenshots.
- **Meets standard:** yes. Optional only: turn indicators on turning vehicles.

### 8.9 [GOOD — no action] Police light bar alternates red/blue correctly, but only while on duty and with no glow — code inspection only; verifiable in a real browser
- **File:** `src/game/Police.ts:315-322,840,896-913` (`phase = Math.floor(time/0.4) % 2 === 0` → 0.4 s per side, 1.25 Hz alternating; lit side `RGB(1,0.06,0.06)` red / `RGB(0.05,0.55,1)` blue, unlit side dimmed; `onDuty = state !== 'patrol'`, patrolling units run dark; head/tail lights mirror traffic at `:878-895`).
- **Currently:** pursuing/searching/roadblock units flash red/blue at a believable rate; patrol units dark, a sensible design choice.
- **Meets standard:** mostly — timing and state-gating are good; visual lacks halo/ground spill.
- **Improvement (optional):** small additive glow sprite or ground decal alternating colour with the same 0.4 s phase; keep instanced/cheap.
- **Risk:** low, cosmetic only.

### 8.10 [GOOD — no action] Job-mission marker (beam + ring + diamond) with coherent pulse animation — observed live + code inspection
- **File:** `src/game/MissionManager.ts:126,159-208,386-404` (yellow `0xffd23e`; beam `CylinderGeometry(0.7,0.7,60)` opacity 0.26 additive, ring `RingGeometry(2.4,3.2)` opacity 0.85, diamond `OctahedronGeometry(1.0)` at y 4.5); animation at `:397-403` (diamond spins `dt*1.2`, bobs `4.5+sin(time*2)*0.4`, ring breathes `1+0.08*sin(time*3)`, beam opacity `0.22+0.08*sin(time*2)`); marker repositions to the current objective at `:386-394`.
- **Currently:** one clear, animated, always-visible guide following the active objective, tail car, or player's car for `enterVehicle`. Right pattern — tall beam for long-range visibility, ground ring for the exact spot, bobbing diamond, gentle pulse.
- **Observed live:** the big red mission ring is visible around the spawn area in the walk screenshots.
- **Meets standard:** yes.

### 8.11 [BUG (inconsistency) — Medium] Story marker is a weaker, inconsistent copy of the mission marker and animates off the wall clock — code inspection only; verifiable in a real browser (compare the two beams from the same distance)
- **File:** `src/game/StoryCampaign.ts:216-217,221-258,1076-1079` (teal `0x2dd4bf`, diamond `0x99f6e4`; beam `CylinderGeometry(0.5,1.5,100)` opacity **0.08** vs mission 0.26, ring opacity 0.5 vs 0.85, diamond `0.65` at y 3.2 vs 1.0 at 4.5; animation uses `performance.now()/350` and `/600`, not `dt`; no ring-pulse or beam-shimmer code).
- **Currently:** teal story beam is ~3× fainter than the yellow job beam and much harder to spot at distance; its diamond bobs/spins on wall-clock time (animates even when the game loop is paused/cinematic-frozen, phase unrelated to the job marker's `dt`-based pulse).
- **Professional standard:** two marker systems in one game should share one component with colour as the only difference, and animate from the same `dt` clock.
- **Meets standard:** no.
- **Improvement:** unify both markers into one builder (beam opacity ~0.22–0.26, same ring/diamond proportions, same `dt` pulse); keep only colour/size differences.
- **Risk:** low — visual only, no save/gameplay impact; reuses proven mission-marker values.

### 8.12 [GAP — Medium] Sprint, Garage and Shop entrance markers are completely static — no pulse, bob, or shimmer — code inspection only; verifiable in a real browser
- **File:** `Sprint.ts:125-155` (gold beam `0xffd23e` opacity 0.22, ring opacity 0.85, `group.visible` toggled only by `moveMarker()` — no `update()` animation of beam/ring at all); `Garage.ts:184-212` (cyan beam 14 m, opacity 0.22, ring opacity 0.8, built once, no update handle returned); `Shop.ts:278-306` (same gold beam/ring, built once, no update handle). `World.update()` (`World.ts:172-174`) only calls `env.update(dt)` + `roads.update(dt)`, so nothing ever animates these.
- **Currently:** three permanent landmarks sit frozen while the mission markers beside them pulse and bob; the Sprint marker's own comment (`Sprint.ts:118-121`) calls it "the same visual language as the mission marker" but it does not move.
- **Professional standard:** all persistent guide markers should share the same gentle idle pulse so the player learns one visual language.
- **Improvement:** give all three the mission marker's ring-breath (±8% at ~3 rad/s) and beam shimmer (±0.08 opacity at ~2 rad/s) via a tiny shared `update(dt)`; cheapest is to animate the shared materials in `World.update()`.
- **Risk:** low — visual only; Garage/Shop builders currently return only a collision box, so wiring an update needs small plumbing, not a redesign.

### 8.13 [GAP — Low] Spawn-plaza ring and encounter/contract zone rings are static decals with no pulse — code inspection only; verifiable in a real browser
- **File:** `World.ts:140-150` (spawn ring `RingGeometry(3.2,3.7)`, pink `#ff5e8a`, opacity 0.75, no animation); `Encounters.ts:192-197` and `Contracts.ts:331-336` (gold zone rings `RingGeometry(radius−0.4,radius)`, `MeshStandardMaterial #ffd166, opacity 0.8`, no animation); `Contracts.ts:322-325` objective ring identical.
- **Currently:** spawn marker and two combat-zone boundaries never breathe or shimmer, so they read as painted floor markings rather than live zones.
- **Professional standard:** zone boundaries should pulse gently (or brighten when the player is inside/near) to communicate "this is an active area".
- **Improvement:** slow opacity/scale pulse on zone rings (brighten while its zone is active); spawn ring optional.
- **Risk:** very low — cosmetic only.

### 8.14 [GOOD — no action] Collectible coins (spin + bob + burst) and Range targets (eased fall, 3 s reset) — code inspection only; verifiable in a real browser
- **File:** `Collectibles.ts:145-175,196-216` (coin spins `dt*2`, bobs `1.1+sin(time*2+def.x)*0.15`, ground ring opacity 0.55; pickup burst: 8 shards + expanding ring over 0.6 s, scale 0.5→3.5, opacity fades to 0; collect radius 2, on-foot only); `Range.ts:232-244` (target pivot eases toward flat at `dt*8`, pops back after `RESET_SECONDS = 3`).
- **Currently:** coins findable by motion + gold emissive (`emissive 0xaa7700, intensity 0.9`) without being noisy; targets fall and recover with a readable ease instead of snapping.
- **Meets standard:** yes. Optional only: pulse the coin ground ring in sync with the bob so the coin is visible when the disc is edge-on.

### 8.15 [GOOD — no action] Contract defence beacon pulse + hit flash + fall-over on destruction — code inspection only; verifiable in a real browser
- **File:** `Contracts.ts:303-325,574-592` (beacon cylinder, `emissive 0xff6a00, intensity 1.2`; `update()`: idle pulse `1.1+0.35*sin(objectivePulse*2.4)` ≈ 0.38 Hz; on hit `objectiveFlash = 0.3` s → emissive red `0xdd1100, intensity 2.2`; on destruction emissive → 0 and mesh topples `rotation.x → π/2 at dt*2`).
- **Currently:** objective communicates health state through light alone — pulsing orange = alive, red flash = taking damage, dark + fallen = destroyed. Exactly how a defend objective should telegraph state.
- **Meets standard:** yes.

### 8.16 [GAP — Medium] Vegetation and street furniture are entirely static — no palm/tree sway, no umbrella motion — code inspection only; verifiable in a real browser; sway amplitude comfort best judged on a real device at low tier
- **File:** `Vegetation.ts:1-175` (`buildVegetation()` returns `void`, no `update()`; palms = instanced trunk cylinders + cone leaves, trees = instanced cylinders + icosahedra, umbrellas = instanced poles + coloured cones, benches = instanced boxes — all matrices set once at build).
- **Currently:** in a beach city with an animated ocean, every palm, tree and umbrella is frozen; the ocean moves but nothing on land responds to wind.
- **Professional standard:** even a subtle vertex-shader sway (±2–3° on palm fronds, slower on trees) sells a living beachfront; fully static vegetation next to moving water is noticeable.
- **Improvement:** cheap shader-based sway (bend by height in the vertex shader) on palm-leaf and tree-top instanced meshes only; leave trunks/poles/benches rigid.
- **Risk:** low–medium — shader change on instanced meshes; keep amplitude small to avoid clipping through buildings; no save/gameplay impact.

### 8.17 [GAP — Medium (beacon pulse); Low (window flicker)] Building windows, neon trim, signs and the Beacon Tower beacon are baked/static — no flicker, no pulse, no life — code inspection only; verifiable in a real browser
- **File:** `Buildings.ts:47-96` (facade canvas textures with lit windows baked at build: glass 42%, others 32%, hotel 50% — random per texture, never changed after); `:174-182` (neon roof trim `emissive 0xff2e88/0x1899ff, intensity 0.9`, constant); `:115-136` (shop signs `MeshBasicMaterial`, constant); `:374-402` (Beacon Tower: 3 neon rings `emissiveIntensity 1.4`, top sphere `emissive 0xffd27a, intensity 3`, all constant, no rotation/pulse).
- **Currently:** skyline is a beautiful still photograph — no window flickers, no neon hum, and the city's landmark beacon (the namesake) does not pulse, rotate, or sweep.
- **Professional standard:** a landmark beacon should pulse or rotate slowly; a few windows/neon signs should flicker subtly so the city feels inhabited.
- **Improvement:** pulse the Beacon Tower sphere emissive (3 → ~2–4 at ~1 Hz) and slowly rotate its rings; optionally flicker a tiny subset of window textures — do not re-bake all facades per frame.
- **Risk:** low — emissive-only changes, no geometry/save impact.

### 8.18 [BUG — High] Shadow frustum covers only downtown — shadows vanish beyond ±100 m, including the Beacon Tower and the beach — code inspection only; verifiable in a real browser (walk/drive from spawn to the tower and watch shadows disappear); perf regression needs a real device
- **File:** `Lighting.ts:83-89` (`sun.shadow.camera left/right/top/bottom ±100, near 5, far 260`); tower plaza at `(0,−172)` (`CityGenerator.ts:239`), beach/ocean from x = 138 (`:240-241`), city half-extent 190 (`:40`); `Quality.ts:26-63` (shadow map 512–2048 by tier, but frustum size never changes with tier).
- **Currently:** buildings, palms, cars and the player cast shadows near spawn/downtown, but the same objects cast none at the tower plaza, the north beach, or the east coast — the shadow simply ends mid-city.
- **Professional standard:** the shadow frustum should follow the camera/player (or be large enough for the play area) so shadows do not pop in/out at an invisible boundary.
- **Meets standard:** no.
- **Improvement:** make the shadow camera follow the player/camera (update `sun.position`/`sun.target` per frame, or use a larger frustum with a lower map size on low tier); keep the map size tiered as now.
- **Risk:** medium — a moving shadow camera can cause shimmering/popping if not snapped to texel increments; perf cost rises with frustum size, so verify on low tier.

### 8.19 [GAP — Medium] HUD guidance is strong for missions but has no compass/minimap and no direction to encounters or interactables — code inspection only; verifiable in a real browser
- **File:** `MissionHUD.tsx:24-32` and `StoryHUD.tsx:27-36` (rotating `▲` bearing arrow + live distance in metres + `Objective n/N` + timer turning `urgent` at ≤15 s — good); `EncounterHUD.tsx:38-55` (banner shows zone name + hostiles remaining + 5 s cleared toast, but no bearing, distance, or 3D guidance to the zone); `SprintHUD.tsx:20-30` (timer + checkpoint count, hint "Follow the gold marker" — no bearing); `GameEngine.ts:649-682` (only 3 registered interactables: Sunset Mart, Sunset Sprint, Sunset Range, each radius 4.5; garage handled by a separate distance check at `:2108-2115`, not the registry).
- **Currently:** player always knows where the next mission/story objective is, but must find encounter zones, garage, shop and range by memory or by spotting their (often static, see 8.12) beams; no off-screen indicator or minimap for any of them.
- **Professional standard:** an open city needs either a minimap/compass or, at minimum, a bearing arrow for every active destination, not just missions.
- **Improvement:** add the same bearing-arrow + distance treatment to the active encounter zone and to the nearest interactable when no mission is active; a full minimap is a larger scope decision, not required here.
- **Risk:** low for HUD-only arrows (no 3D/world changes, no save impact); medium for a minimap (new system, perf).

### 8.20 [GAP — Medium] Sunset Range weapon rack has no 3D marker — the only interactable without a beam/ring — code inspection only; verifiable in a real browser (approach the north beach and look for a beam)
- **File:** `Range.ts:156-166` (rack is a table + two rifle silhouettes + sign at `(156,−90)`, no beam or ring mesh); `GameEngine.ts:675-682` (registered as `sunset-range`, radius 4.5, prompt "Open Sunset Range"); contrast `Garage.ts:184-212` and `Shop.ts:278-306` (both have a 14 m beam + ground ring at their entrances) and `Sprint.ts:125-155` (gold beam + ring).
- **Currently:** player can only discover the range by walking within 4.5 m of the rack and seeing the E prompt; unlike garage/shop/sprint, no tall beam is visible from across the beach.
- **Professional standard:** every interactable should carry the same beacon language so the player can spot it from distance.
- **Improvement:** add the same gold beam + ground ring used by shop/sprint at `RANGE_RACK (156,−90)`; reuse the shared marker builder from 8.11.
- **Risk:** very low — one static mesh pair, no gameplay/save impact.

### 8.21 [GAP — Low] Fog colour and range are fixed per tier and the sky dome sits outside the fog — distant city can read as washed-out against a sharp sky — code inspection only; verifiable in a real browser; horizon matching best judged on a real device screen
- **File:** `Lighting.ts:59` (`scene.fog = Fog(#e88a6b, fogNear, fogFar)`; `Quality.ts:32-63`: low 60/220, medium 80/300, high 100/380, ultra 120/460); `Lighting.ts:25-56` (sky dome radius 600, `fog: false` on its material); `GameEngine.ts:763-765` (fog near/far updated on quality change).
- **Currently:** fog correctly hides the far city edge, but the unfogged sky dome stays vivid behind it, so at long range fogged buildings meet a hard, unfogged horizon; on low tier (fogFar 220) the effect starts only 60 m out.
- **Professional standard:** fog colour should match the horizon colour of the sky shader at eye level, and the transition should be smooth enough that the player cannot see where fog ends.
- **Improvement:** tune the fog colour to the sky shader's horizon value at typical camera height, or add a matching haze band to the sky shader; do not change fog distances without re-checking marker visibility (beams are 60–100 m tall and must stay visible through fog).
- **Risk:** low — colour-only; verify marker beams remain visible at 200+ m on low tier.

---

## Category 9 — UI

### 9.1 [NOTE — Low] Stylesheet path is wrong in the task brief — no functional impact — code inspection only; verifiable in a real browser by confirming styles apply
- **File:** `src/main.tsx:3`, `src/styles/global.css` (whole file); `src/index.css` does not exist. All UI styling lives in the single 1,189-line `global.css`; only 4 `transition` declarations in the entire file (`global.css:67,138,348,1146`) and 11 `@keyframes` blocks.
- **Improvement:** none in code; correct the brief/path reference.
- **Risk:** none.

### 9.2 [BUG (latent) — Medium] No exit animation anywhere — every screen/panel vanishes instantly on close — code inspection only; verifiable in a real browser (open/close any panel)
- **File:** `src/styles/global.css:1152-1162` (`.panel-overlay`, `.panel` — no `animation`/`transition`), `:668-673` (`.garage-overlay` — enter-only `busted-in 0.6s`), `:419-424` (`.mission-board-overlay` — enter-only), `:974-981` (`.pause-overlay` — no animation at all), `:244-249,271-276,935-941` (busted/downed/mission-complete/failed overlays — enter-only `busted-in 0.6s ease-out both`), `:563-566` (`.cinematic-overlay` — enter-only `cinematic-in 0.4s`).
- **Currently:** all overlays mount with a 0.4–0.6 s opacity fade-in, then unmount instantly when dismissed (React conditional render, e.g. `GameCanvas.tsx:905-959`, `MainMenu.tsx:153-168`). No exit/fade-out class, no delayed unmount, no `transition` on any overlay or panel.
- **Professional standard:** symmetric enter/exit (typically 150–300 ms fade + slight scale/translate out) so closing never feels like a cut.
- **Meets standard:** no.
- **Improvement:** add a closing state (e.g. `closing` class + `setTimeout` unmount, or a transition on opacity) to `.panel-overlay`, `.garage-overlay`, `.mission-board-overlay`, `.pause-overlay`, and the complete/failed/busted/downed overlays.
- **Risk:** low — pure presentation; must keep the engine-resume timing in the `close*` handlers (`GameCanvas.tsx:233-239,303-309,356-362`) unchanged so gameplay does not resume late.

### 9.3 [BUG — High] No Escape key and no backdrop-click close on any panel, board, or end screen — only two overlays own Esc at all — code inspection only; verifiable in a real browser (press Esc with each panel open)
- **File:** `src/components/SettingsPanel.tsx:59-66`, `AboutPanel.tsx:8-15`, `GaragePanel.tsx:137-144`, `ShopPanel.tsx:48-49`, `OutfitsPanel.tsx:56-57`, `RangePanel.tsx:18-19`, `CollectionPanel.tsx:16-17`, `MissionBoard.tsx:30-31`, `StoryBoard.tsx:20-21` — none has an `onClick` on the overlay element or a `keydown` listener; the only Esc handlers in the UI are `DialoguePanel.tsx:99-104` (skip) and `CinematicOverlay.tsx:39-45` (skip). `src/game/Input.ts:90-140` has no `KeyP`/`Escape` pause binding, and `GameCanvas.tsx:544-546` exposes pause only via the HUD button.
- **Currently:** every panel closes only via its ✕ / Close / Done button (mouse/touch). Esc does nothing on Settings, About, Mission/Story boards, Garage, Shop, Outfits, Range, Collection, Pause, Mission/Story Complete/Failed, Busted, or Taken Down. Clicking the dimmed backdrop does nothing on any of them. There is also no keyboard pause at all.
- **Professional standard:** Esc closes the topmost modal/panel; backdrop click closes non-destructive panels; P or Esc pauses.
- **Meets standard:** no.
- **Improvement:** add one Esc/backdrop handler at the `GameCanvas` level (close topmost open panel; P toggles pause) plus Esc on the complete/failed/busted/downed screens (Enter to continue/retry). Keep Esc in Dialogue/Cinematic as-is to avoid double-handling. (Mobile angle: on touch there is no Esc at all, so backdrop-tap-to-close matters most there — see 10.12.)
- **Risk:** low–medium — must order handlers so Esc during a dialogue/cinematic still skips rather than closing a panel underneath; no save-data risk.

### 9.4 [BUG — High] `RangePanel` silently ignores buy/equip results and never disables an unaffordable Buy button — code inspection only; verifiable in a real browser with low cash at the Range
- **File:** `src/components/RangePanel.tsx:51-68` — `onClick={() => onBuy(w.id)}` discards the `{ ok, reason }` return; no `disabled` prop on the Buy button (contrast `ShopPanel.tsx:79-87`, `GaragePanel.tsx:278-286`, `OutfitsPanel.tsx:127-135`, which disable when `cash < price` and show a message). `src/game/GameEngine.ts:1191` confirms `rangeBuyWeapon` returns `{ ok, reason }`. `RangePanel.tsx:16-85` has no message state at all.
- **Currently:** a player with insufficient cash can click "Buy $1,200" (carbine) and nothing happens — no error, no feedback, no disabled state. Equip failures are likewise swallowed (`onEquip` return ignored, `:51-59`).
- **Professional standard:** unaffordable actions are disabled with the shortfall shown, or a failed click produces an inline error.
- **Meets standard:** no.
- **Improvement:** mirror `ShopPanel` — add `message`/`messageKind` state, disable Buy when `cash < price` with "(need $X more)", surface `insufficient`/`already-owned` reasons.
- **Risk:** very low — presentation + already-returned result value; no engine/save change.

### 9.5 [BUG (probable, needs browser confirmation) — Medium] Story-mission flash may never replay — no time-based expiry, unlike job missions — code inspection only; requires a real browser (trigger two story checkpoints in one run and watch the second flash)
- **File:** `src/game/StoryCampaign.ts:426-428` (`setFlash` stores `{ text, at: performance.now() }`); no comparison against `flash.at` anywhere in that file (grep for `flash.at`/`performance.now() - flash` returns nothing); flash is cleared only on reset/complete/fail (`:467,545,604,621,1184`). Contrast `src/game/MissionManager.ts:292` (`if (flash && time - flashAt > 2.5) flash = null`). Rendering: `src/components/StoryHUD.tsx:73` and `MissionHUD.tsx:52` render `<div className="mission-flash">` with no `key`; CSS `src/styles/global.css:397-407` (`mission-flash-in 2.4s ease-out both`, ending at `opacity: 0`).
- **Currently:** for job missions the flash node unmounts after 2.5 s, so the next flash remounts and its 2.4 s animation replays. For story missions the node can stay mounted past the animation's end (invisible, `opacity: 0` fill); a second flash with the same text (e.g. repeated "CHECKPOINT SAVED", `StoryCampaign.ts:527`) may not restart the animation because React reuses the node.
- **Professional standard:** transient flashes expire on a timer and replay reliably on every trigger.
- **Meets standard:** no (probable — mechanism confirmed, symptom needs a live check).
- **Improvement:** add the same 2.5 s expiry to `StoryCampaign` (or give the flash div `key={flash.at}`).
- **Risk:** very low — one timer/key change; no save or gameplay logic touched.

### 9.6 [BUG (probable, needs browser confirmation) — Medium] Contract/encounter toasts can be cancelled by unrelated state updates — code inspection only; requires a real browser (complete a contract/encounter and watch the toast while other HUD state ticks)
- **File:** `src/components/ContractHUD.tsx:27-49` and `EncounterHUD.tsx:25-44` — the effect depends on the whole `contracts`/`encounters` array and its cleanup (`:46-48` / `:41-43`) calls `window.clearTimeout(toastTimer.current)` on every re-run. The toast itself is set for 5000 ms (`:38,42` / `:37`).
- **Currently:** if the engine emits a new array (e.g. a countdown or remaining-count tick) while a 5 s toast is showing, the effect re-runs, the cleanup clears the pending timeout, and the body sets no new timer (no status transition occurred) — the toast can vanish early or never be dismissed on schedule. The toasts also have no enter/exit animation (`global.css:308-317,360-369` — no `animation`/`transition` on `.encounter-toast`, `.contract-toast`, `.encounter-cooling`, `.contract-cooling`).
- **Professional standard:** toast lifetime is owned by the toast, not by unrelated parent re-renders; toasts slide/fade in and out.
- **Meets standard:** no (probable — mechanism confirmed, symptom needs a live check).
- **Improvement:** move the timeout into a dedicated toast component keyed by toast text/id, or narrow the effect dependency to the status values; add a 0.25 s fade/slide animation.
- **Risk:** low — HUD-only; keep the 5 s duration and the first-clear cash/ammo wording unchanged.

### 9.7 [BUG — Medium] Bottom HUD bar is not gated by `hudHidden`, unlike the top bar — Menu button stays live during dialogue/cinematic — code inspection only; verifiable in a real browser (open a dialogue, click ✕ Menu)
- **File:** `src/components/GameCanvas.tsx:489` (`const hudHidden = paused || cinematic !== null`); `:515-551` top HUD wrapped in `{!hudHidden && …}`; `:584-597` bottom HUD (`<div className="hud hud-bottom">` with the hint and the `✕ Menu` quit button) is rendered unconditionally. `global.css:180-204` — `.hud { pointer-events: none }`, `.hud-quit { pointer-events: auto }`; `.cinematic-overlay` is `pointer-events: none` (`global.css:563-565`) except its Skip button.
- **Currently:** during a cinematic the quit button is deliberately reachable (comment `:373-379` calls it the escape hatch). During a dialogue, however, the dialogue panel (`z-index 9`, `global.css:517-519`) does not cover the bottom-right corner, so ✕ Menu remains clickable mid-conversation; `quit()` (`GameCanvas.tsx:474-478`) disposes the engine while dialogue state is open.
- **Professional standard:** a single HUD-visibility rule; quitting mid-dialogue either blocked or handled (dialogue dismissed first).
- **Meets standard:** no.
- **Improvement:** gate `.hud-bottom` (or at least the quit button) on `!dialogue`, keeping the cinematic escape hatch if intended; document the choice.
- **Risk:** low — one render condition; quitting itself is already safe (engine dispose), the risk is only a surprising mid-dialogue exit.

### 9.8 [GAP — Low] Health bar has no width transition — it jumps; low-health state has no persistent warning — code inspection only; verifiable in a real browser (take damage, drop below 30)
- **File:** `src/components/CombatHUD.tsx:18-19,70-79` — `healthPct` computed per render, inline `style={{ width: \`${healthPct}%\` }}`; `lowHealth = healthPct <= 30`. `src/styles/global.css:882-888,899` — `.combat-health-bar div` has no `transition` (only `.contract-objective-fill` `:348` and `.loading-bar-fill` `:67` have `width` transitions in the whole file). Damage feedback is a single 350 ms vignette: `CombatHUD.tsx:26-36` (timeout 350 ms) + `global.css:890-898` (`damage-flash 0.35s ease-out both`).
- **Currently:** health drops in discrete steps with no smoothing; at ≤30% the bar/icon only turn red (`global.css:887-888`) with no pulse, heartbeat vignette, or persistent indicator.
- **Professional standard:** health bar eases over ~0.2 s; low health pulses or holds a red vignette until healed.
- **Improvement:** add `transition: width 0.2s ease-out` to `.combat-health-bar div` and a slow pulse on `.combat-health.low`.
- **Risk:** negligible — CSS only.

### 9.9 [GAP — Low] Wanted stars pop in/out with no animation; escape bar has no smoothing and is hidden during pursuit — code inspection only; verifiable in a real browser (commit an offence, then hide until search)
- **File:** `src/components/GameCanvas.tsx:553-574` — 5 `★` spans (`:556-560`), class `wanted-star on` toggles instantly; `src/styles/global.css:214-222` — `.wanted-star.on` is a colour/glow swap only, no `transition`/`animation`; `.wanted-escape-fill` (`:222`) has no `transition` (inline width from `escapeProgress`, `GameCanvas.tsx:567-570`). Model: `src/game/Wanted.ts:64` (`LEVEL_HEAT = [0,10,25,45,70,90]`), `:83` (`escapeDuration = 14 + 4*level` s), `:553-574` renders the pill only when `wanted.level > 0`, and the escape bar only when `status === 'search'`.
- **Currently:** gaining/losing a star is an instant class swap; the pill itself appears/disappears instantly when heat crosses 10; the escape bar fills per engine callback with no CSS easing.
- **Professional standard:** a newly gained star scales/pops briefly; the pill fades in/out; the escape bar eases.
- **Improvement:** add a `star-pop` keyframe on `.wanted-star.on` (newly lit only), `transition: width 0.2s linear` on `.wanted-escape-fill`, and a 0.25 s fade on `.wanted-hud`.
- **Risk:** negligible — CSS only; no change to heat/level logic or saves.

### 9.10 [GAP — Low] Mission direction arrow snaps — no rotation transition; distance number has no tabular figures — code inspection only; verifiable in a real browser (drive in a curve toward a marker)
- **File:** `src/components/MissionHUD.tsx:29-37` and `StoryHUD.tsx:36-44` — arrow is `style={{ transform: \`rotate(${bearing}rad)\` }}`; `src/styles/global.css:388-391` — `.mission-arrow` has no `transition`. `global.css:393` — `.mission-distance` has no `font-variant-numeric` (contrast `.combat-mag` `:867` and `.speedo-value` `:1039`, which do).
- **Currently:** as bearing updates each render the ▲ jumps to the new angle instead of sweeping; the `NNNm` distance width jitters as digits change.
- **Professional standard:** `transition: transform 0.15–0.25s linear` on a compass arrow; tabular numerals for live distances.
- **Improvement:** add the transition and `font-variant-numeric: tabular-nums` to `.mission-distance`.
- **Risk:** negligible — CSS only.

### 9.11 [GAP — Low] Hit marker can linger or never show — it is computed at render time against `performance.now()`, not state-driven — code inspection only; verifiable in a real browser (land a single hit, then stand still)
- **File:** `src/components/CombatHUD.tsx:17` — `const showHit = combat.hitMarkerAt > 0 && performance.now() - combat.hitMarkerAt < 250;` — no state/timer clears it; it only changes on the next render. `global.css:855-859` — `.cross-hit` is a static gold ✕, no scale/fade animation.
- **Currently:** if no further `onCombat` update re-renders the HUD within 250 ms of a hit, the ✕ stays visible past its window; if the render lands late, it may never appear. The crosshair itself (`global.css:839-854`) is static — no spread, recoil, or reload feedback beyond the reload bar.
- **Professional standard:** hit marker as timed state (set on hit, cleared by a 200–250 ms timeout) with a quick scale/fade pop.
- **Improvement:** mirror the damage-flash pattern (`CombatHUD.tsx:23-36`): `useState` + timeout to show/clear the marker; add a 0.15 s pop keyframe.
- **Risk:** low — HUD-only; keep the 250 ms duration.

### 9.12 [GAP — Low] Weapon display has no low-ammo / empty-mag state and no switch animation — code inspection only; verifiable in a real browser (empty a magazine)
- **File:** `src/components/CombatHUD.tsx:49-68` — weapon name, `mag / reserve`, `RELOADING…` + reload bar (`global.css:870-875`, inline width, no transition), hint `R reload · Q switch`. No branch for `mag === 0`, no colour change, no ammo warning at any threshold.
- **Currently:** the only empty-magazine signal is the number `0`; nothing flashes, pulses, or prompts reload, and switching weapons (Q / `Input.ts` Digit1/Digit2/Q) swaps the name instantly.
- **Professional standard:** mag ≤25% or 0 turns amber/red and pulses; weapon name crossfades on switch.
- **Improvement:** add a `.combat-ammo.low` style at `mag === 0` (red pulse + "RELOAD" emphasis) and a 0.15 s fade on weapon change.
- **Risk:** negligible — HUD-only.

### 9.13 [BUG — Low] Dialogue panel re-animates on every line; typewriter itself is good — code inspection only; verifiable in a real browser (play any multi-line conversation)
- **File:** `src/components/DialoguePanel.tsx:11-12` (`TYPEWRITER_MS = 33`, ~30 chars/s), `:51-70` (timeout chain, restarts per node), `:82-88` (two-tap Continue: first tap completes the line, second advances), `:129-135` (`key={dialogue.nodeId}` on the panel root), `src/styles/global.css:517-528` (`.dialogue-panel` `animation: dialogue-in 0.25s ease-out both` — fade + 12px rise).
- **Currently:** because the whole panel is keyed by `nodeId`, the 0.25 s enter animation replays on every line, so the panel slides/fades for each of dozens of lines. The typewriter, two-tap Continue, choices-only-after-full-line (`:169`), and E/Space/Enter + 1/2/3 + Esc keys (`:90-120`) are all correct.
- **Professional standard:** panel enters once per conversation; only the text (and portrait/name) changes per line.
- **Improvement:** move `key={nodeId}` to the text element (or animate only `.dialogue-text`), keeping the panel static across lines. (Same defect as 7.2, listed here for the UI pass.)
- **Risk:** low — presentation; keep the typewriter reset on node change.

### 9.14 [GAP — Low] Cinematic letterbox bars appear instantly; title card can outlive a 3 s first shot; no exit fade — code inspection only; verifiable in a real browser (play any cinematic, including one with a 3 s first shot)
- **File:** `src/components/CinematicOverlay.tsx:50-51` (bars), `:53-58` (title only on `shotIndex === 0`), `:60-64` (narration keyed by `cinematicId-shotIndex`, so it re-animates per shot — good); `src/styles/global.css:563-570` (overlay `cinematic-in 0.4s` opacity only; `.cinematic-bar` `:571-576` has no animation), `:577-587` (`.cinematic-title` `cinematic-title 3.2s ease-out both`, fading to 0 at 100%), `:596-606` (narration `0.5s`). Shot durations in `src/game/StoryCinematics.ts:48-141` are 3–4 s (first shots 4 s, later 3.5 s/3 s).
- **Currently:** bars snap in with only the overlay's opacity fade; the title's 3.2 s fade fits a 4 s first shot but outlives a 3 s one (title still fading as shot 1 starts); when the cinematic ends the overlay unmounts instantly (`GameCanvas.tsx:857-863`).
- **Professional standard:** bars slide in from top/bottom (~0.4 s); title timed to the actual first-shot duration; 0.3 s fade-out on end.
- **Improvement:** animate bars with a translateY slide-in; drive the title duration from the first shot's duration; add an exit fade.
- **Risk:** low — overlay-only; do not change shot timing or skip semantics.

### 9.15 [GAP — Medium] Complete/Failed/Busted/Taken-Down screens: only an opacity fade, no keyboard, no reward count-up — code inspection only; verifiable in a real browser (finish/fail any mission, get busted, get taken down)
- **File:** `src/components/MissionCompleteScreen.tsx:24-48`, `StoryCompleteScreen.tsx:16-48`, `MissionFailedScreen.tsx:26-42`, `StoryFailedScreen.tsx:34-58`, `BustedScreen.tsx:13-24`, `DownedScreen.tsx:17-29` — none has a keydown handler, `autoFocus`, or a second animation; all share `global.css:935-941` / `:244-249,271-276` (`busted-in 0.6s ease-out both` — opacity only). Titles are static 44 px/64 px (`global.css:955-962,258-261,285-288`).
- **Currently:** screens fade in and sit static; the `+$reward` (`MissionCompleteScreen.tsx:31-33`) appears as a flat number with no count-up or pop; keyboard users must click Continue/Retry/Respawn. Close paths themselves are all present and correct (Continue + Replay; Retry + Close; Retry-from-checkpoint where `hasCheckpoint`; Respawn / Get back up).
- **Professional standard:** title scale/pop on entry, reward counts up, Enter continues/retries, Esc closes where a Close exists.
- **Improvement:** add a title pop keyframe + reward count-up (or at least a scale-in), `autoFocus` the primary button, and Enter/Esc handling. Note `MissionFailedScreen` is only shown when `arrest === 'none'` (`GameCanvas.tsx:840-846`) — a busted mid-mission correctly shows Busted instead.
- **Risk:** low — presentation + focus; keep the outro flow in `GameCanvas.tsx:815-838` (Continue → outro cinematic → `continueStoryMission`) untouched.

### 9.16 [GAP — Low] Pause overlay has no animation, no keyboard, and `togglePause` resume only clears two of seven panel flags — code inspection only; verifiable in a real browser (pause, resume)
- **File:** `src/styles/global.css:974-981` (`.pause-overlay` — no `animation`); `src/components/GameCanvas.tsx:961-975` (overlay: Resume / Settings / Quit to menu); `:209-221` (`togglePause` resume sets `setShowSettings(false); setShowBoard(false)` but not `showStoryBoard/showGarage/showShop/showOutfits/showCollection/showRange`); `:977-983` (Settings from pause closes back to the pause overlay — correct).
- **Currently:** pausing is a hard cut to a static screen; resuming from the overlay can only happen when no panel is open (condition `:961`), so the incomplete reset is latent rather than live — but the asymmetry is a trap for any future caller of `togglePause`.
- **Professional standard:** pause fades/slides in; Esc/P resumes; resume clears all transient panel flags.
- **Improvement:** add a 0.25 s fade to `.pause-overlay`; clear all `show*` flags in the resume branch.
- **Risk:** very low — the resume branch is currently unreachable with a panel open; no save impact.

### 9.17 [GAP — Low] Garage / Shop / Outfits feedback messages never auto-dismiss and have no animation — code inspection only; verifiable in a real browser (buy anything in Garage/Shop/Outfits)
- **File:** `src/components/GaragePanel.tsx:84-85,90-97,149-153` (message persists until the next action or a card click clears it, `:162-165`); `ShopPanel.tsx:25-26,60-64`; `OutfitsPanel.tsx:22-23,68-72`. No `setTimeout` clears them; `global.css:690-696` (`.garage-message`) has no animation/transition.
- **Currently:** a "…is yours" success stays on screen indefinitely while the player keeps browsing; a stale error can outlive the action that caused it (Garage clears on card switch; Shop/Outfits never clear except on the next buy/select).
- **Professional standard:** success toasts auto-dismiss in ~3 s; errors persist until the next action, with a fade.
- **Improvement:** auto-dismiss ok-messages after ~3 s (keep errors until next action); add a 0.2 s fade-in.
- **Risk:** negligible — local component state only.

### 9.18 [GAP — Low] Garage stat bars, wanted escape bar, and reload bar have no width transition — only the contract beacon bar animates — code inspection only; verifiable in a real browser (switch cars in the Garage)
- **File:** `src/styles/global.css:720` (`.garage-stat-fill` — no transition), `:222` (`.wanted-escape-fill` — no transition), `:875` (`.combat-reload-bar div` — no transition) vs `:348` (`.contract-objective-fill` — `transition: width 0.2s ease-out`, the only bar that animates) and `:67` (loading bar, 0.35 s). Setters: `GaragePanel.tsx:35-37,188,195,201` (inline widths), `GameCanvas.tsx:567-570`, `CombatHUD.tsx:62`.
- **Currently:** switching vehicles or buying an upgrade makes the Top speed / Acceleration / Handling bars jump to their new widths; the same jump applies to the escape and reload bars.
- **Professional standard:** all meter fills ease over 0.2–0.35 s, consistent across the game.
- **Improvement:** add `transition: width 0.2s ease-out` to the three fills.
- **Risk:** negligible — CSS only.

### 9.19 [GAP — Low] Two referenced CSS classes have no rules at all — unstyled by accident, not by design — code inspection only; verifiable in a real browser (open the Range; view a completed mission on the board)
- **File:** `src/components/RangePanel.tsx:21,75` uses `className="garage-subtitle"`; `src/components/MissionBoard.tsx:45` uses `mission-board-entry completed`. Grep of `src/styles/global.css` returns 0 matches for `.garage-subtitle` and 0 for `.mission-board-entry.completed` (also 0 for `.contract-board-list`, `.story-board-overlay`, `.story-board-close` — those three are harmless, since they only add classes already covered by shared rules).
- **Currently:** Range panel subtitles render with unstyled inherited text (no size/colour/spacing of their own); completed mission entries look identical to unselected ones except for the ✓ badge (`MissionBoard.tsx:55`).
- **Professional standard:** every class used in JSX has a rule, or the class is removed.
- **Improvement:** add `.garage-subtitle` (match `.garage-sub`, `global.css:684`) and a `.mission-board-entry.completed` treatment (e.g. subdued border/green tint).
- **Risk:** negligible — CSS only.

### 9.20 [BUG — Medium] About panel copy is stale — it describes a Phase 1 game that no longer exists — code inspection only; verifiable in a real browser (Menu → About)
- **File:** `src/components/AboutPanel.tsx:22-26` — "This is the Phase 1 foundation… Missions, vehicles, and the stories of the people who live here are still to come"; `:33` — "Version 0.1.0 — Foundation".
- **Currently:** the game now has 5 job missions, a 3-chapter story campaign, garage, shop, outfits, range, contracts, and encounters, but About still tells the player none of them exist.
- **Professional standard:** About reflects the shipped feature set and current version.
- **Meets standard:** no.
- **Improvement:** rewrite the two paragraphs to describe the current game; bump the version string.
- **Risk:** none.

### 9.21 [GAP — Low] Main menu and loading have enter motion only on the scenery — content, title, and panels mount instantly — code inspection only; verifiable in a real browser (reload, open Settings from the menu)
- **File:** `src/styles/global.css:83,89` (sun drift 14 s, clouds 21–34 s), `:51` (loading sun pulse 2.2 s), `:133-141` (play button hover 0.15 s), `:1142-1149` (menu buttons hover 0.15 s) — but `.menu-content`, `.menu-title`, `.menu-buttons` (`:112-152`) have no enter animation, and `.panel` / `.panel-overlay` (`:1152-1162`) have none either. `src/App.tsx:31-57` — loading progress is staged fixed steps (15→45→75→100 with 200/250/300/250 ms delays), not real asset progress; phase switches (`:77-115`) unmount instantly with no fade.
- **Currently:** Play/Settings/About/Missions/Story panels pop in over the animated sky with no fade/slide; loading→menu is a hard cut.
- **Professional standard:** menu content fades/slides in once (~0.4 s); loading fades out into the menu; progress reflects real work.
- **Improvement:** add a 0.4 s fade-rise to `.menu-content` and `.panel`, and a fade-out on the loading→menu transition. (The staged progress is acceptable for a game with no heavy async asset load; do not fake finer granularity.)
- **Risk:** negligible — CSS only.

### 9.22 [GAP — Low] `prefers-reduced-motion` is only partially honoured — code inspection only; verifiable in a real browser with reduced motion enabled (desktop browser setting suffices; no real device needed)
- **File:** `src/styles/global.css:1187-1189` — the media query disables only `.menu-sun, .menu-cloud, .loading-sun, .game-starting-spinner`. It does not disable `prompt-pulse` (used on every prompt button, `global.css:232,242,559,633,643,654,664,765,775,1016,1026`), `busted-in`, `mission-flash-in`, `dialogue-in`, `cinematic-in/title/narration-in`, `damage-flash`, or `sun-pulse` on the loading sun (covered) — and the continuously rotating 3D previews (`CharacterPreview.tsx:80-86`, `VehiclePreview.tsx:73-79`, `rotation.y += 0.008` per frame) are unaffected by CSS entirely.
- **Currently:** a user who asked for reduced motion still gets pulsing prompts, flashing damage vignettes, sliding dialogue, and spinning previews.
- **Professional standard:** the query disables or damps all non-essential animation, including JS-driven rotation.
- **Improvement:** extend the query to all keyframe animations (or set them to `none`/`opacity`-only) and gate the preview rotation on `matchMedia('(prefers-reduced-motion: reduce)')`.
- **Risk:** negligible — presentation/accessibility only.

### 9.23 [GAP — Low] Sprint HUD has no urgency state; sprint screens reuse the generic fade — code inspection only; verifiable in a real browser (run a sprint to its last seconds)
- **File:** `src/components/SprintHUD.tsx:24-36` — running HUD shows title, timer (tenths), checkpoints, hint; no colour/pulse change as `timeLeft` approaches 0 (contrast `MissionHUD.tsx:16,48` + `global.css:396`, where the timer turns red and pulses at ≤15 s). Complete/failed screens (`SprintHUD.tsx:38-82`) use `global.css:828-834` (`busted-in 0.6s` fade only).
- **Currently:** a sprint about to expire looks identical to a fresh one; the player gets no escalating signal.
- **Professional standard:** timer turns amber/red and pulses in the last ~5 s, matching the mission timer language.
- **Improvement:** add an `urgent` class at `timeLeft <= 5` reusing `.mission-timer.urgent`.
- **Risk:** negligible — HUD-only.

### 9.24 [NOTE — Low, subjective — not a bug] No dedicated inventory UI — the shop is the only place the player can see what they own — code inspection only; verifiable in a real browser (buy an item, leave the shop, look for it)
- **File:** `src/game/Inventory.ts:1-9,29-35` — inventory is explicitly "collectibles for now: no hunger or stamina mechanics, just a count per item"; `src/components/ShopPanel.tsx:75-77` shows "In your bag: N" per item and `:92-95` states items are keepsakes. No HUD element, panel, or key shows the inventory outside the shop.
- **Currently:** counts persist correctly (own key `vice-city-stories.inventory.v1`, `:35`, clamped 0–999, `:41-44`), but the player cannot check or use items without walking to Sunset Mart.
- **Professional standard:** either an inventory view (even read-only) or an explicit design statement that items are shop-only keepsakes.
- **Meets standard:** yes, as designed — the code is explicit that this is intentional, so this is a subjective gap, not a bug.
- **Improvement (optional):** add the three counts to the Collection panel or a small HUD chip; do not invent a use mechanic.
- **Risk:** very low — read-only display; no save change.

### 9.25 [GAP — Medium] Responsive rules are thorough, but two small-screen overlaps are only provable on a real device — code inspection only — requires a real device (or a real browser at 390 px with all three HUDs active); desktop emulation is not sufficient for the touch-control band
- **File:** `src/styles/global.css:1066-1136` (single `@media (max-width: 640px)` block) — mission/story HUD moved to `top: 180px` (`:1088-1090`), contract HUD to `bottom: 300px` (`:1105`), sprint HUD to `top: 180px` (`:1127`), wanted pill to `top: 100px` (`:1135`), `.hud-stats` wraps (`:1132`). `GameCanvas.tsx:553-574,576-582,614-620` — wanted pill, mission/story HUD, and contract HUD can all be visible at once.
- **Currently:** on a 390 px screen the mission card (top 180 px, ~200 px tall) and the contract panel (anchored 300 px from the bottom, ~150 px tall) are positioned by fixed offsets that can meet or overlap when both a mission and a contract are active; the wanted pill (top 100 px) and sprint HUD (top 180 px) share the same column. The offsets look reasoned, but no rule guarantees non-overlap.
- **Professional standard:** stacked HUD regions never overlap at the smallest supported width; verified on a real phone.
- **Improvement:** verify on a real 390 px device with mission + contract + wanted active simultaneously; if they collide, dock the contract panel below the mission card instead of by a fixed bottom offset.
- **Risk:** low — layout only; no gameplay/save impact.

### 9.26 [GOOD — no action]
- Wanted model and display are coherent: 5 stars from heat thresholds `Wanted.ts:64`, pursuit/search labels and the search-only escape bar (`GameCanvas.tsx:553-574`) match the state machine exactly.
- Dialogue interaction design is strong: 33 ms/char typewriter, two-tap Continue, choices gated until the line finishes, E/Space/Enter + 1/2/3 + Esc, portrait medallion + progress `n / total` (`DialoguePanel.tsx:11-12,51-70,82-88,90-120,147-151`).
- Mission flash timing is correctly matched: 2.5 s data expiry (`MissionManager.ts:292`) vs 2.4 s CSS fade (`global.css:397-407`).
- Damage feedback is well layered: 350 ms red vignette + simultaneous health-number drop (`CombatHUD.tsx:26-39`, `global.css:890-898`).
- Z-index layering is consistent and deliberate: HUD 4, damage flash 5, prompts 6, pause 7, overlays 8, dialogue/sprint screens 9, menu panels 10 (`global.css`, various).
- Shop double-buy protection is real: the engine ignores a second tap within 500 ms (`ShopPanel.tsx:6-7,32-34`).
- 3D previews rotate smoothly (`CharacterPreview.tsx:80-86`, `VehiclePreview.tsx:73-79`, `rotation.y += 0.008`/frame) and garage/outfit/collection panels all share one visual language with distinct accent colours (gold garage/shop, teal story/dialogue).

---

## Category 10 — Mobile

### 10.1 [BUG (layout) — High] Driving controls overflow / shrink at 390 px — code inspection only; verifiable in desktop emulation at 390 px width (layout/measuring), real device only for thumb feel
- **File:** `src/styles/global.css:1047-1064` (`.drive-controls`, `.drive-steer`, `.drive-pedals`, `.drive-btn` sizes) + `@media (max-width: 640px)` block `global.css:1066-1136` (contains no drive-button rule).
- **Currently:** designed widths — steer 2×64 px + 12 px gap = 140 px; pedals GAS 76 + BRAKE 68 + handbrake 56 + EXIT 56 + 3×10 px gaps = 286 px; plus 16 px side padding ×2 = 32 px. Total 458 px > 390 px viewport. No `flex-wrap`, no `flex-shrink: 0`, no ≤640 px shrink rule, so flex default `flex-shrink: 1` silently shrinks all six buttons ~15% (steer ≈54 px, handbrake/EXIT ≈47 px) instead of overflowing.
- **Professional standard:** driving cluster sized for the smallest supported width (390 px) with explicit ≤640 px sizes, or a two-row/compact layout; buttons keep designed size and ≥44 px targets.
- **Meets standard:** no.
- **Improvement:** add a ≤640 px rule shrinking drive buttons deliberately (e.g. steer 56 px, GAS 64 px, BRAKE 58 px, handbrake/EXIT 48 px, gaps 8 px) or move EXIT/handbrake to a second row; verify at 390 px.
- **Risk:** low — CSS-only, no save/gameplay logic touched; steering/pedal input values unchanged (binary ±1).

### 10.2 [POTENTIAL BUG — High] Scrollable panels may not scroll by touch — body `touch-action: none` with no `pan-y` override — code inspection only; must be verified on a real touch device (or mobile emulation with touch) — desktop mouse-wheel scrolling does not prove touch scrolling works
- **File:** `src/styles/global.css:28` (`body { touch-action: none; }`); scrollable panels `global.css:426-427` (`.mission-board`: `max-height: calc(100dvh - 48px); overflow-y: auto`), `global.css:675-676` (`.garage-panel`, same), `global.css:1157` (`.panel`: `max-height: 88dvh; overflow-y: auto`). No `touch-action: pan-y` anywhere in the codebase (grep: only `none` values, `global.css:28,160,908,986,993,1004,1051`).
- **Currently:** panels are correctly sized (`width: min(560/860px, calc(100vw - 32px))`) with vertical scroll, but the global `touch-action: none` on `body` is inherited up the gesture chain and no panel re-enables panning, so a touch-drag starting inside a long mission/garage list may be swallowed instead of scrolling.
- **Professional standard:** game canvas/joystick `touch-action: none`, but every scrollable sheet explicitly sets `touch-action: pan-y` so lists scroll natively on touch.
- **Meets standard:** unconfirmed — the CSS inheritance chain suggests touch scrolling may fail, but only a real touch device proves it.
- **Improvement:** add `touch-action: pan-y` to `.mission-board`, `.garage-panel`, `.panel` (and any other `overflow-y: auto` sheet).
- **Risk:** low — CSS-only; does not affect save data or engine; could change drag behaviour only inside panels.

### 10.3 [GAP — Medium] No joystick dead zone; joystick sets `joyActive` even at centre deflection — code inspection only; verifiable in desktop emulation (drag joystick a few px) and by feel on a real device
- **File:** `src/components/TouchControls.tsx:29-45` (`updateJoystick`: normalises to −1..1, clamps length >1, no dead-zone threshold; sets `input.joyActive = true` on every pointer-down) and `src/game/Input.ts:165-170` (`effectiveMove`: if `joyActive` returns `joyX/-joyY` verbatim, no dead zone).
- **Currently:** any sub-pixel deflection (thumb tremor, resting thumb) produces movement; no inner dead zone (~0.08–0.15 is standard) and no outer snap. Knob travel itself is sound: base 118 px, `max = width/2 − 8 = 51px`, knob offset `dx * 34` (`TouchControls.tsx:44`, knob 52 px in `global.css:993-996`), so full deflection is reachable 8 px inside the rim.
- **Professional standard:** small radial dead zone so the character stands still with a resting thumb; full deflection still reachable at the rim.
- **Improvement:** ignore `len < ~0.12` (zero the vector, keep `joyActive` true) in `updateJoystick` or `effectiveMove`.
- **Risk:** very low — input-only; no save/performance impact; tiny behaviour change (resting thumb no longer drifts).

### 10.4 [GAP — Medium] Fixed-position joystick — thumb must land exactly on the 118 px base; rest of left half is dead — code inspection only; verifiable in desktop emulation (tap outside the circle) and by feel on a real device
- **File:** `src/components/TouchControls.tsx:176-190` (joystick is a fixed `<div className="joystick">` at `global.css:989-996`: `left: 18px; bottom: calc(64px + env(safe-area-inset-bottom)); width/height: 118px`); `src/components/GameCanvas.tsx:894-903` mounts it whenever touch + engine, regardless of where the finger lands.
- **Currently:** movement only starts if `pointerdown` lands inside that 118 px circle. The left ~45% of the screen outside the circle is inert (`.touch-controls` is `pointer-events: none`, `global.css:987`), while the right 55% is the look area (`.touch-look`, `global.css:985-988`). No floating/dynamic joystick that spawns where the thumb lands.
- **Professional standard:** mobile action games use a floating joystick (base appears under the thumb anywhere in the left zone) or at least a generous hit area; a fixed 118 px target is easy to miss mid-chase.
- **Improvement:** make the joystick base follow the first touch in the left-bottom zone (floating joystick), or enlarge the invisible hit area around the base.
- **Risk:** low–medium — touch-input only; must keep the look-area/joystick pointer-id separation intact; no save impact.

### 10.5 [GAP — High (collective; individually Medium)] Many touch targets are below the ~44 px guidance, especially panel/HUD controls — code inspection only; verifiable in desktop emulation at 390 px (measuring rendered heights)
- **File:** `src/styles/global.css:1133-1134` (≤640 px: `.hud-chip { padding: 6px 9px; font-size: 11.5px }` ≈ 28 px tall; `.hud-button { padding: 8px 11px; font-size: 12px }` ≈ 32 px tall); `global.css:538-540` (`.dialogue-skip { padding: 5px 10px; font-size: 11.5px }` ≈ 26 px); `global.css:556-558` (`.dialogue-continue { padding: 8px 18px; font-size: 13px }` ≈ 35 px); `global.css:468-471` (`.mission-board-button { padding: 8px 18px; font-size: 13px }` ≈ 35 px); `global.css:408-410` (`.mission-abandon { padding: 6px 12px; font-size: 12px }` ≈ 28 px); `global.css:354-356` (`.contract-abandon { padding: 5px 11px; font-size: 12px }` ≈ 26 px); `global.css:741-743` (`.garage-upgrade-button { padding: 7px 14px; font-size: 13px }` ≈ 33 px); `global.css:724-727` (`.garage-swatch { width/height: 34px }`); `global.css:1165-1167` (`.panel-close { width/height: 36px }`). Panel close buttons (`GaragePanel.tsx:296`, `ShopPanel.tsx:97`, `StoryBoard.tsx:92`) all reuse the small `.hud-button`.
- **Currently:** primary in-game controls are correctly sized (joystick 118 px, RUN/FIRE 76 px, reload/switch 58 px, steer 64 px, GAS 76 px — `global.css:913-923,1000-1005,1056-1063`), but almost every secondary/close/choice target is 26–36 px tall.
- **Professional standard:** all tappable controls ≥44×44 px (WCAG 2.2 AA target size; Apple HIG 44 pt).
- **Meets standard:** no.
- **Improvement:** raise paddings/min-heights to 44 px for `.hud-button`/`.hud-chip` (≤640 px), `.dialogue-skip`, `.dialogue-continue`, `.mission-board-button`, abandon buttons, `.garage-upgrade-button`, `.panel-close`, and `.garage-swatch` (44 px with visual swatch inset).
- **Risk:** low — CSS-only; may push the ≤640 px HUD to wrap sooner (it already wraps, `global.css:1132`); no gameplay/save impact.

### 10.6 [GAP — Medium] Dialogue panel has no max-height / scroll — long lines + choices can clip on short viewports; panel itself is not tappable to advance — code inspection only; verifiable in desktop emulation (short/landscape viewport), real device for tap feel
- **File:** `src/styles/global.css:517-524` (`.dialogue-panel`: `position: absolute; bottom: 24px; width: min(640px, calc(100vw - 28px))`, no `max-height`/`overflow`); `global.css:1093` (≤640 px: `bottom: 12px; width: calc(100vw - 20px)`); `src/components/DialoguePanel.tsx:182-205` (advance only via the Continue button; no `onClick` on the panel/text); `DialoguePanel.tsx:75-90` (two-tap Continue: first tap completes the typewriter line, second advances).
- **Currently:** in portrait 390×844 the panel fits, but in landscape/short heights (~390 px tall) a long line + up to 3 choice buttons (`DialoguePanel.tsx:164-181`, `.dialogue-choice { padding: 10px 14px }`, `global.css:545-548`) can exceed the viewport with no scroll, potentially pushing choices off-screen. Advancing also requires hitting the ~35 px Continue button rather than tapping anywhere on the panel (the standard visual-novel pattern).
- **Professional standard:** dialogue sheet capped at ~70–80 dvh with internal scroll, and tap-anywhere (or on the text area) to advance/complete.
- **Improvement:** add `max-height: calc(100dvh - 120px); overflow-y: auto` to `.dialogue-panel` and an `onClick={handleAdvance}` on the panel body (excluding choice buttons).
- **Risk:** low — UI-only; must ensure a panel tap does not double-fire with the Continue button (button already blurs itself, `DialoguePanel.tsx:195-200`); no save impact.

### 10.7 [GAP — Low] No haptic / vibration feedback anywhere — code inspection only; requires a real device (emulation cannot verify vibration feel)
- **File:** grep for `vibrat|haptic` across `src/` and `index.html` returns nothing; no `navigator.vibrate` call in `TouchControls.tsx`, `GameCanvas.tsx`, or `Input.ts`.
- **Currently:** firing, taking damage, mission-complete, button presses, joystick hitting full deflection — none produce any vibration. Feedback is visual only (`:active { transform: scale(0.93/0.94) }` on `.combat-btn`/`.drive-btn`/`.sprint-button`, `global.css:911,1006,1054`; joystick `.active` pink border, `global.css:997`).
- **Professional standard:** light haptics on key events (fire, hit, pickup, UI confirm) with a settings toggle; `navigator.vibrate` guarded by feature detection.
- **Improvement:** add small `navigator.vibrate?.(10–30)` calls on FIRE, damage flash, mission complete, and panel button confirms, behind a settings toggle.
- **Risk:** very low — additive, no-op on unsupported devices; no save/performance impact.

### 10.8 [GAP — Medium] Safe-area insets used top/bottom only — left/right insets ignored; no landscape/orientation handling — code inspection only; left/right insets and landscape overlap require a real notched device (emulation can approximate the layout at 844×390)
- **File:** `env(safe-area-inset-*)` used only for top/bottom: `global.css:183,186,208,861,877,914,919,923,990,1001,1033,1047,1073,1076,1078,1105`; grep for `safe-area-inset-left/right` returns nothing. Only breakpoints: `@media (max-width: 640px)` (`global.css:1066`) and `prefers-reduced-motion` (`global.css:1187`); no `orientation`, `max-height`, or landscape query anywhere; no 390 px-specific query (390 px appears only in comments, `global.css:1097,1114,1129`).
- **Currently:** HUD side padding is fixed 14 px, joystick `left: 18px`, sprint/FIRE `right: 20px` — on a notched phone in landscape these can sit under the sensor housing/home indicator on the sides. In landscape (~390 px tall) the stacked HUD (wanted pill `top: 100px`, mission card `top: 180px`, contract card `bottom: 300px` at ≤640 px, `global.css:1071-1105`) will overlap, and panels are the only elements that scroll.
- **Professional standard:** `env(safe-area-inset-left/right)` on side-anchored HUD/controls, plus a landscape layout pass (or a rotate-device hint) for short viewports.
- **Improvement:** add `max(14px, env(safe-area-inset-left))` / right equivalents to `.hud`, joystick, sprint, drive/combat clusters; add a `@media (max-height: 500px)` rule collapsing HUD cards.
- **Risk:** low — CSS-only; no gameplay/save impact.

### 10.9 [GAP — Low] RUN (sprint) button has no pointer capture — sliding thumb off it cancels sprint; drive/FIRE buttons do capture — code inspection only; verifiable in desktop emulation (pointer drag off the button) and by feel on a real device
- **File:** `src/components/TouchControls.tsx:199-210` approx. (sprint `<button className="sprint-button">`: `onPointerDown/Up/Cancel/Leave` only, no `setPointerCapture`); contrast `TouchControls.tsx:111-124` (`holdProps` for drive buttons: `setPointerCapture` + Up/Cancel/Leave) and `GameCanvas.tsx:650-661` (FIRE: `setPointerCapture`, Up/Cancel/Leave).
- **Currently:** if the thumb drifts off RUN mid-hold, `onPointerLeave` fires `onSprintChange(false)`; sprint cannot be held while the thumb moves. It cannot stick on (leave always clears it), so this is a feel annoyance, not a stuck-input bug.
- **Professional standard:** hold-to-sprint captures the pointer like the other hold buttons so the hold survives thumb drift.
- **Improvement:** add the same `setPointerCapture` try/catch in the sprint button's `onPointerDown`.
- **Risk:** very low — one-line input change; no save impact.

### 10.10 [GAP — Medium] Touch detection is a one-time module-level check — hybrid touchscreen laptops always get touch UI; no toggle, no re-evaluation — code inspection only; verifiable in desktop emulation (touchscreen laptop / DevTools device mode)
- **File:** `src/components/GameCanvas.tsx:49-51` (`const IS_TOUCH = navigator.maxTouchPoints > 0 || 'ontouchstart' in window`, evaluated once at module load); used at `GameCanvas.tsx:587,590,622,670,688,716,738,760,787,882,894` to swap prompts, mount `TouchControls`, and show combat/drive buttons. Contrast `src/game/Quality.ts:80-83`, which defines mobile differently (`maxTouchPoints > 0 && window.innerWidth < 900`).
- **Currently:** any laptop with a touchscreen (very common on Windows) permanently shows the joystick, RUN, FIRE, drive buttons and touch wording even when playing with mouse/keyboard, with no setting to hide them; a device whose touch capability changes (docking, DevTools emulation toggle) is not re-detected without reload.
- **Professional standard:** detect coarse pointers (`matchMedia('(pointer: coarse)')` / `pointerdown` with `pointerType`), or offer a Controls toggle; keep the two mobile definitions consistent.
- **Improvement:** gate `TouchControls` on coarse-pointer media query or first touch event, and/or add a Settings toggle for touch controls.
- **Risk:** low — UI gating only; must not break phones (keep `maxTouchPoints` as fallback); no save impact.

### 10.11 [GAP — Low] No tap-highlight suppression and no `user-select: none` on touch controls — long-press can select button labels / flash grey on iOS — code inspection only; requires a real iOS/Android device to see the highlight/callout (emulation does not reproduce it faithfully)
- **File:** grep for `tap-highlight|user-select` in `src/styles/global.css` returns nothing; labels are plain text inside buttons (`RUN`, `GAS`, `BRAKE`, `EXIT`, `FIRE` in `TouchControls.tsx` and `GameCanvas.tsx:650-661`).
- **Currently:** on iOS Safari a tap shows the default grey tap highlight and a long hold on RUN/GAS can trigger text selection/callout, despite the game otherwise disabling scrolling/zoom (`index.html:6`, `global.css:20-28`).
- **Professional standard:** `-webkit-tap-highlight-color: transparent` and `user-select: none; -webkit-touch-callout: none` on game controls.
- **Improvement:** add both properties to `.touch-controls`, `.drive-controls`, `.combat-touch`, and `button` generally.
- **Risk:** very low — CSS-only.

### 10.12 [GAP — Low] Panels have no backdrop-tap or swipe-to-close — only a small Close button at the bottom of a scrollable sheet — code inspection only; verifiable in desktop emulation (tap backdrop does nothing today)
- **File:** `GaragePanel.tsx:296`, `ShopPanel.tsx:97`, `StoryBoard.tsx:92`, `MissionBoard.tsx:147` (close is a single `.hud-button` at the panel bottom); no `onClick` on `.garage-overlay`/`.mission-board-overlay` (`GaragePanel.tsx:150`, `StoryBoard.tsx:17`); grep for `Escape|onKeyDown` in Garage/Shop/Story/Mission/Outfits/Collection/Range/Settings panels returns nothing (only `DialoguePanel.tsx` and `CinematicOverlay.tsx` own Esc).
- **Currently:** on touch there is no keyboard Esc and no tap-outside-to-dismiss; closing requires scrolling to the bottom and hitting a ~32 px button (see 10.5). The close buttons do work and panels pause the engine while open (`GameCanvas.tsx:230-260` etc.), so nothing is unreachable — just slow. (This is the touch half of finding 9.3; the desktop Esc half is covered there.)
- **Professional standard:** tap the dimmed backdrop to close (with a guard against accidental taps), plus a ≥44 px close affordance.
- **Improvement:** add backdrop `onClick={onClose}` (stop propagation on the panel itself) and enlarge the close button to 44 px.
- **Risk:** low — UI-only; must ensure backdrop taps cannot fire through to game buttons beneath (overlay is `z-index: 8`, `global.css:672`, above touch controls at z-index 5).

### 10.13 [GAP — Low] Driving steering/throttle are binary on/off — no analog or ramp — code inspection only; feel can only be judged on a real device
- **File:** `src/components/TouchControls.tsx:100-110` (`applySteer`: `moveX = ±1 or 0`; `applyPedal`: `moveY = ±1 or 0`, driven by `Set` membership); `src/game/Input.ts:165-170` (`effectiveMove` passes drive `moveX/moveY` through unchanged).
- **Currently:** steering and pedals are digital switches — full lock / full throttle instantly, no partial steering for gentle curves, no throttle feathering. (Whether the engine smooths the step was not in the audited files; the input itself carries no magnitude.)
- **Professional standard:** mobile driving controls offer proportional input (analog stick for steering, pressure/position-sensitive pedal) or at least a steering ramp.
- **Improvement:** consider a steering slider/analog zone or a ramp in the engine's steering response; low priority versus the layout fixes above.
- **Risk:** medium if changed — touches vehicle handling feel and could affect mission/difficulty balance; keep keyboard behaviour identical.

### 10.14 [GAP — Low] TouchControls stay mounted under pause/panel overlays (not gated on `hudHidden`) — harmless but untidy — code inspection only; verifiable in desktop emulation (open a panel, confirm joystick is inert)
- **File:** `src/components/GameCanvas.tsx:894-903` (`{IS_TOUCH && engine && !dialogue && !cinematic && <TouchControls …/>}` — no `!paused` / `!hudHidden` check, unlike the HUD at `GameCanvas.tsx:455` where `hudHidden = paused || cinematic !== null`); `global.css:987` (`.touch-controls { z-index: 5 }`) vs overlays at z-index 7–10 (`global.css:672,965,1151`).
- **Currently:** while a board/garage/shop panel or the pause overlay is open, the joystick and buttons remain mounted underneath the overlay and are unreachable (overlay covers them), so no input leaks through — but they still render and hold pointer handlers.
- **Professional standard:** hide/disable touch controls whenever any modal is open, matching the HUD gating.
- **Improvement:** add `!hudHidden` to the mount condition for symmetry; verify panels still open/close correctly.
- **Risk:** very low — one condition; no save impact.

### 10.15 [GOOD — no action] Viewport, safe-area top/bottom, pointer handling, prompt placement, double-tap guards — observed live (layout) + code inspection
- **File:** `index.html:6` (`viewport: width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover` — correct for a full-screen game, prevents pinch/double-tap zoom); `src/styles/global.css:183,186,208,861,877,990,1001,1047` (systematic `env(safe-area-inset-top/bottom)` on HUD, joystick, sprint, combat, drive clusters); `src/components/TouchControls.tsx:57-70,74-93,111-124` (pointer capture with try/catch fallback, per-pointer-id checks for joystick and look-drag, so joystick + look + sprint/FIRE work simultaneously via separate pointers); `GameCanvas.tsx:650-661` (FIRE captures the pointer and stops on Up/Cancel/Leave); `ShopPanel.tsx:1-9` (engine ignores a second tap within 500 ms, so double-tap cannot double-charge); `global.css:1066-1136` (≤640 px pass lifts prompts/HUD clear of controls: enter prompt `bottom: 210px`, mission/garage/interact prompts `bottom: 300px`, speedo `bottom: 200px`, ammo `bottom: 250px`, health `bottom: 235px`, mission card `top: 180px / width: 250px`, HUD stats wrap to two rows); `CinematicOverlay.tsx:72-88` + `global.css:855-862` (Skip is a real button, `min-height: 44px`, container `pointer-events: none` so taps cannot swallow game input); `GameCanvas.tsx:2038` via `GameEngine.ts:2038` (touch look shares the engine look path, so the `invertY` setting applies to touch drag as well as mouse).
- **Currently:** the touch layer is well engineered at its core — no double-fire, no stuck-pointer (capture + id checks), safe-area respected where it matters most, and the ≤640 px rules deliberately keep prompts and HUD clear of the joystick/FIRE row.
- **Observed live:** at 390 px the joystick, FIRE, RUN, switch/reload buttons and HUD all render without overlap or horizontal overflow (`qa/audit-m-hud.png`); the garage opens via touch with no overflow.
- **Meets standard:** yes for these items. Layout claims verifiable in desktop emulation at 390 px, multi-touch feel requires a real device.

### 10.16 [GAP — Low] Look-drag sensitivity is a hardcoded constant with no user setting — code inspection only; feel requires a real device
- **File:** `src/components/TouchControls.tsx:86` (`addLook(input, dx * 1.6, dy * 1.6)`); `src/game/Input.ts:160-163` (`addLook` accumulates raw pixels); engine consumes at `GameEngine.ts:2042-2045` (`lookDX * 0.0042` rad/px, combined ≈0.0067 rad per dragged px). No sensitivity value in `src/game/Settings.ts` (only `invertY`, `showFps`, etc. per grep) and no sensitivity control in `SettingsPanel.tsx`.
- **Currently:** look speed is fixed for all players; a user who finds it too fast/slow has only the `invertY` toggle to change.
- **Professional standard:** a look-sensitivity slider (0.5×–2×) in Settings, applied to the touch multiplier.
- **Improvement:** add a `lookSensitivity` setting (default 1.0) multiplying the 1.6 factor.
- **Risk:** very low — additive setting; default preserves current feel; no save impact.

---

## Additional live observations from this audit (not in the code inspectors' scope)

### L-1 [BUG — Low] One console error observed once: `setPointerCapture` InvalidStateError — observed live (desktop run 1, once; not reproduced in later runs)
- **Evidence:** `PAGEERROR: Failed to execute 'setPointerCapture' on 'Element': InvalidStateError` in the first desktop observation run, during the mouse-click sections (weapon firing / panel interaction). Runs 2 and 3 reported no console errors.
- **Currently:** a pointer-capture call is made on an element that is not in a state to capture (typically a detached element, or a pointer that already ended). One occurrence, no visible breakage in that run.
- **Professional standard:** pointer capture is always guarded (try/catch or a state check) so a stray click can never throw.
- **Meets standard:** mostly — the touch code does guard capture with try/catch (`TouchControls.tsx:57-70,74-93,111-124`); the failing call site is elsewhere (likely a mouse/drag path in `GameCanvas.tsx`).
- **Improvement:** find the unguarded `setPointerCapture` call on the mouse/drag path and wrap it the same way the touch code is wrapped.
- **Risk:** very low. **Verification:** real browser (click-heavy play session, watch the console).

### L-2 [NOTE] Weapon firing was not re-measured numerically in this run
- The weapon probe in the first desktop script used accessors that do not exist (`getCurrentWeapon` / `getMagazine` / `isAiming`); the real API is `getHudState` / `getWeaponState`. Two mouse clicks were sent but their effect was not confirmed numerically. Firing feedback (1.12) rests on code inspection plus the 9F live record (weapons fired in qa81). Re-probe with the correct accessors before calling 1.2/1.3 done.

### L-3 [NOTE] Dialogue typewriter and the 7.1 regression were not observed live in this run
- The cinematic was still in shot 0/1 during the sampling window (headless sim time runs ~10% of real time, so a 4 s shot takes ~40 real seconds), so the dialogue never opened. 7.1 remains **code inspection only** and must be watched live (open any dialogue, press E once mid-line, wait) before its fix is called done.

### L-4 [NOTE] The first desktop script's vehicle section failed on test setup, not on the game
- The player was teleported 4 m from the car, outside the 3.6 m enter range, so E did nothing and the drive samples read speed 0. The re-probe (player 1.8 m from the car) entered on the first E and drove to 92 km/h. The game was not at fault.

---

## Prioritized improvement plan

### High — fix first (all low-to-medium risk; none touches save data)
| # | Finding | Risk |
|---|---------|------|
| 7.1 | Dialogue complete-line regression (text shrinks and re-types) | Very low |
| 2.1 | Mission sedan wheels never spin | Very low |
| 3.1 | Player/car pass through pedestrians | Medium |
| 1.2 | No aim pose; barrel disagrees with crosshair | Low–med |
| 5.1 | Police on-foot hold dead band (7–9 m stalemate) | Low–med |
| 5.2 | Roadblocks impossible at levels 4–5 on default police count | Medium |
| 5.3 | Roadblock dissolves 18 m early, cars staggered 16 m apart | Medium |
| 8.2 | Traffic-light yellow bulb never lit; instant red↔green flips | Low–med |
| 8.18 | Shadow frustum ends mid-city (±100 m) | Medium |
| 9.3 | No Esc / backdrop close on any panel; no keyboard pause | Low–med |
| 9.4 | RangePanel silently ignores buy/equip results | Very low |
| 10.1 | Driving controls shrink ~15% at 390 px | Low |
| 10.2 | Scrollable panels may not scroll by touch (potential) | Low |
| 10.5 | Many touch targets 26–36 px (below 44 px guidance) | Low |

### Medium — next
1.2 is already in High; the Medium set: 1.1 (defeat fall), 1.3/1.4/1.5 (reload / weapon-switch / damage flinch), 1.6 (entry/exit fade), 1.8 (walk camera clipping), 2.2 (suspension/body motion), 4.1 (search timers), 4.5 (LOS-loss freeze), 4.7 (damage aggro), 4.10 (enemy accuracy — balance), 4.11 (shoot from cover + crouch — balance), 5.4 (roadblock teleport), 5.5 (police LOS), 5.6 (arrest in `search`), 5.7 (car auto-arrest), 5.9 (pursuit speed — balance, do with 5.2/5.3), 5.10 (pursuit replan), 5.11 (police turning + building collision), 5.12 (ramming/PIT — feature, needs design decision), 5.13 (BUSTED consequences — needs design decision), 6.1 (cinematic exit blend vs dialogue — needs product decision), 6.2 (silent 3 s hold after embedded dialogue), 6.5 (easing variety), 6.6 (hard cuts + holds), 6.7 (medium-shot framing), 7.2 (dialogue panel replays entrance per line), 7.9 (screen-reader announcement / focus), 8.1 (ocean specular/second foam), 8.6 (streetlight ground glow), 8.7 (player brake lights), 8.11 (unify markers), 8.12 (animate sprint/garage/shop markers), 8.16 (vegetation sway), 8.17 (Beacon Tower pulse / window flicker), 8.19 (bearing arrows for encounters/interactables), 8.20 (Range beam), 9.2 (exit animations), 9.5 (story-flash expiry — probable), 9.6 (toast lifetime — probable), 9.7 (bottom-HUD gating), 9.15 (end-screen motion + keyboard), 9.20 (About copy), 9.25 (HUD overlap at 390 px — verify on device), 10.3 (joystick dead zone), 10.4 (floating joystick), 10.6 (dialogue max-height / tap-to-advance), 10.8 (safe-area left/right + landscape), 10.10 (touch detection gating).

### Low — polish / hygiene
1.7 (respawn fade), 1.9 (sprint FOV), 1.10 (strafe — only with 1.2), 2.5 (player brake lights), 2.6 (collision jolt), 2.8 (vehicle damage visuals — optional, none proposed), 3.4 (idle variety), 3.5 (NPC despawn fade), 3.6 (skirt clipping — unconfirmed), 4.2, 4.3, 4.4, 4.6, 4.8, 4.9, 4.12, 4.13, 4.14, 4.15, 5.8, 5.14, 5.15, 5.16, 5.17, 5.18, 5.19, 6.3, 6.4, 6.8 (FOV/vignette; DOF deferred), 6.9, 6.10, 6.11, 6.12, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.10, 7.11, 8.3, 8.4 (no action unless scope changes), 8.5, 8.13, 8.21, 9.1 (brief path only), 9.8, 9.9, 9.10, 9.11, 9.12, 9.13 (same as 7.2), 9.14, 9.16, 9.17, 9.18, 9.19, 9.21, 9.22, 9.23, 9.24 (optional, as designed), 10.7 (haptics), 10.9, 10.11, 10.12, 10.13 (analog drive — medium risk, last), 10.14, 10.16, L-1 (guard the `setPointerCapture` call site).

## Proposed implementation sequence

1. **7.1 + 7.7 together** (dialogue timer regression + typewriter pacing — they interact), then **7.2/9.13** (removing the remount also improves focus behaviour for 7.9), then CSS-only dialogue polish 7.3–7.6.
2. **2.1 + 3.1** — the two High bugs with the smallest blast radius (one-line wheel spin; NPC push-out, the only Medium-risk item in the High set — keep it out of mission logic).
3. **5.1 + 5.5** (police hold dead band + LOS) — small constant/logic changes that remove stalemates and through-wall detection.
4. **1.2** (aim pose) — gates 1.10; do before any strafe work. Then **1.1 + 2.2** (defeat fall + suspension) and the small animation set **1.3/1.4/1.5**, then **1.6** (entry/exit fade — keep the mode switch instant).
5. **5.2 + 5.3 + 5.9 together** — roadblock availability, roadblock actually blocking, pursuit speed: one balance pass; any one alone skews chases. Then **5.6 + 5.7** (complete the arrest rules) and **5.4** (roadblock drive-in).
6. **9.4 + 9.3** — RangePanel feedback, then the single Esc/backdrop/keyboard-pause handler at `GameCanvas` level (keep Esc in Dialogue/Cinematic as-is).
7. **10.2 + 10.1 + 10.5** — `touch-action: pan-y` on scrollable panels, deliberate ≤640 px drive-button sizes, 44 px touch targets; then **10.3 + 10.4** (joystick dead zone + floating joystick) and **10.6/10.8/10.10**.
8. **8.2 + 8.18** — traffic-light yellow phase (care with `Traffic.ts` stop logic) and the shadow frustum following the player (texel snapping; verify on low tier).
9. **Marker unification (8.11 + 8.12 + 8.20)** — one shared marker builder, `dt` clock, Range beam; then **8.19** (bearing arrows), **8.17** (Beacon Tower pulse), **8.16** (vegetation sway), **8.6/8.7** (streetlight glow, player brake lights), **8.1** (ocean specular/second foam).
10. **6.1 + 6.2** — cinematic→dialogue handoff (needs the product decision in 6.1 and a full finale live check after); **6.5 + 6.6 + 6.7 + 6.10** — additive/default-preserving cinematic data and easing work.
11. **4.1 + 4.5 + 4.7** (enemy search timers, LOS-loss freeze, damage aggro) — the three most visible AI-behaviour defects; all low-risk, no save impact. Then **4.10 + 4.11** (enemy accuracy, shooting from cover) — balance-affecting; playtest after.
12. **9.2 + 9.15 + 9.5 + 9.6 + 9.7** — exit animations, end-screen motion + keyboard, story-flash expiry, toast lifetime, bottom-HUD gating; **9.20** (About copy) any time.
13. **Low-risk cleanups** — everything in the Low list, in any order; 7.9 after 7.2, with screen-reader testing; 10.13 (analog drive) last.
14. **Design decisions, do not bundle into a QA pass:** 5.12 (ramming/PIT — high gameplay risk), 5.13 (BUSTED consequences — the only save-data decision in this audit), 6.1's product decision, 8.4 (day/night — scope change).

## Regression risks

- **Save data:** no finding touches save data, except 5.13 if a bust count is added (new field, default 0). Enemy fixes carry no save risk at all (`Enemies.ts`/`StoryEncounters.ts` never touch `localStorage`). The 13 `vice-city-stories.*.v1` keys are untouched by every other proposal.
- **Gameplay:** the sensitive seams are the cinematic→dialogue handoff (6.1, 6.2 — engine stop/start, `StoryCampaign` guard; verify the finale end-to-end live after any change), police chase balance (5.2/5.3/5.9 as one pass), enemy lethality (4.10, 4.11, 4.7 — playtest after), the arrest flow (5.6/5.7/5.12 interact), NPC push-out (3.1 — must not fight the sidestep/wait logic or push NPCs off the sidewalk graph), entry/exit timing (1.6 — keep the mode switch instant), and dialogue event-once semantics (any change to `Dialogue.ts` skip/choose paths must preserve them).
- **Performance:** no finding implies a perf cost except 8.18's larger/moving shadow frustum (verify on low tier; texel snapping), 8.6's real lights (use decals instead), 6.8's DOF option (deferred — new render pass), the per-frame-React alternative in 6.11 (avoid; use CSS), and enemy separation (4.14 — ≤3 enemies per encounter, trivial cost). Police LOS sampling (5.5) is a few extra box tests per unit per frame. The runtime allocates nothing per frame in cinematics (scratch vectors, `Cinematic.ts:96-107`).
- **Mobile:** verify 10.2 (touch scrolling), 10.7 (haptics), 10.8 (notched landscape), 10.11 (iOS tap highlight), 9.25 (HUD overlap at 390 px with all HUDs active), 8.18/8.6 perf on low tier — all on a real device. Everything else is verifiable in a real desktop browser at 390 px emulation.
- **Verification method for every finding above:** code inspection only, except the items labelled **observed live** in the live-evidence section. Findings 9.5, 9.6, and 10.2 are *probable/potential* bugs (mechanism confirmed in code) that still need a live browser or real-device check to confirm the symptom actually occurs.

## Verification matrix (what was actually seen live vs read in code)

| Area | Observed live in this audit | Code inspection only (needs a live watch before calling done) |
|---|---|---|
| Player gait / walk / sprint / turn | Yes — screenshots `audit-walk-a/b.png`, `audit-sprint.png` | Surrender pose, defeat fall (1.1), damage flinch (1.5), reload/switch (1.3/1.4) |
| Vehicles | Yes — re-probe: enter, 0→92 km/h, steering, brake, exit; `audit-drive-b.png` | Mission sedan wheels (2.1), suspension (2.2), brake lights (2.5), collision jolt (2.6) |
| Pedestrians | Yes — visible on sidewalks in screenshots | Reactions (3.3), pass-through (3.1), idle variety (3.4) |
| Enemies | No | All of category 4 (4.1–4.15) |
| Police | No | All of category 5 (5.1–5.19) |
| Cinematics | Partially — 1.1 entry blend, shot-0 drift, Skip to shot 1; `audit-cine-b.png` | 6.1 (frozen camera during dialogue), 6.2 (silent hold), 6.3 (blend paths), 6.7 (medium framing) |
| Dialogue | No — dialogue never opened in the sampling window | 7.1 (complete-line regression — highest-priority live check), 7.2, 7.7–7.10 |
| Environment | Partially — ocean `uTime` advances; traffic light green + crosswalk + pedestrian in screenshots | 8.2 (yellow phase), 8.18 (shadow boundary), 8.11/8.12 (marker animation) |
| UI | Partially — HUD, mission card, prompts render cleanly at desktop and 390 px | 9.3 (Esc), 9.4 (Range buy), 9.5/9.6 (flash/toast — probable), 9.7 (Menu during dialogue) |
| Mobile | Yes — joystick/FIRE/RUN sizes, no overflow, garage opens via touch; `audit-m-hud.png` | 10.1 (drive-button shrink), 10.2 (touch scrolling — real device), 10.3/10.4 (joystick feel) |

## Appendix — audit artefacts

- This report: `docs/animation-visual-audit.md` (the only file created by this audit).
- Browser observation scripts (in `~/workspace/qa-shots/`, not in the game repo): `audit-anim-desktop.mjs`, `audit-anim-desktop2.mjs`, `audit-anim-vehicle.mjs`, `audit-anim-mobile.mjs`; logs `audit-anim-desktop.log`, `audit-anim-desktop2.log`, `audit-anim-vehicle.log`, `audit-anim-mobile.log`.
- Screenshots (in `~/workspace/vice-city-stories/qa/`): `audit-idle.png`, `audit-walk-a.png`, `audit-walk-b.png`, `audit-sprint.png`, `audit-drive.png`, `audit-drive-a.png`, `audit-drive-b.png`, `audit-drive-exit.png`, `audit-fire.png`, `audit-cine-b.png`, `audit-m-menu.png`, `audit-m-hud.png`, `audit-m-prompt.png`, `audit-m-garage.png`. (Some screenshots timed out in headless runs and were not captured: `audit-cine-a.png`, `audit-dialogue.png`, `audit-ocean.png`, `audit-hud.png`.)
- Baseline: Phase 9F complete — 10 story missions, 2 endings, 13 save keys, production build 105 modules / index JS 1,147.94 kB / gzip 312.12 kB. No game file was modified by this audit; no push, no deploy.
- **Nothing in this audit is implemented.** Every improvement above waits for the user's review and approval.
