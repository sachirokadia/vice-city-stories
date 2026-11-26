# Vice City Stories — Phase 1

A browser-based 3D open-world action game — foundation build.
React + TypeScript + Vite + Three.js (direct, no React Three Fiber).
**No physics engine in Phase 1** — movement is kinematic with simple
building collision; a real physics engine arrives in a later phase.

## Run it

```bash
npm install
npm run dev        # development server → http://localhost:5173
npm run build      # production build (tsc + vite)
npm run preview    # serve the production build → http://localhost:4173
```

## Detailed world and vehicle fleet (26 November 2026)

A researched coastal block, ten textured world GLBs and notes on 25 primary
sources are included in `public/world-v2`. **Explore Ocean Drive** on the main
menu starts free roam beside the four imported buildings and the active car.
Normal Play also loads those buildings. Kai, June and Lena use the delivered
V3 character models; alternate player outfits retain their original visuals.

Four civilian cars and two police vehicles now use Fleet V3 models with curved
panels, rounded trim, transparent glazing and independent wheel assemblies.
Their budgets range from 102,052 to 116,788 triangles. Garage previews use the
same models as the active car. Police use detailed instanced models within 85 m
and the lighter original fleet beyond that distance. Vehicle ownership and
campaign progression still apply.

Open `/world-v2/fleet.html` for all six vehicle previews, a before/after GT
comparison and GLB downloads; `/world-v2/world-v2.html` has the coastal study.
See [scope and validation](docs/world-v2-research-and-assets.md) and
[generation tools](tools/world-v2/README.md). Production compilation and actual
game-module CPU checks pass. Current fleet GPU performance and Unity runtime
integration remain unverified. Saved preview images are CPU renders of the
delivered meshes, not game screenshots.

## What Phase 1 includes

- **Full-screen 3D canvas** — `GameEngine` (`src/game/GameEngine.ts`)
  owns the renderer, scene, camera and game loop. React owns only the UI.
- **Game loop with proper cleanup** — `start()` / `stop()` / `dispose()`
  cancels the animation frame, removes every listener and disposes the
  renderer. Safe under React StrictMode double-mount.
- **Third-person camera** — orbit follow camera: mouse drag or pointer-lock
  look on desktop, drag on touch, scroll-wheel zoom.
- **World** (`src/game/World.ts`) — procedural sunset city: ground plane
  with roads, a grid of buildings with lit windows and neon roof trim,
  palms, a spawn-plaza ring, and the Beacon Tower landmark at the north
  end of the avenue — visible from spawn, so there is always somewhere
  to walk toward.
- **Lighting** (`src/game/Lighting.ts`) — gradient sky dome (deep blue
  overhead to warm sunset horizon), low sun disc, hemisphere fill and a
  shadow-casting directional sun.
- **Player** (`src/game/Player.ts`) — stylised character mesh,
  camera-relative WASD/arrow movement, sprint, walk-cycle leg swing.
  Kinematic: the player is pushed out of building footprints with a
  circle-vs-box test, so it can never walk through a wall.
- **Loading screen** — real staged loading: WebGL probe, device-quality
  detection, warm-up. A helpful fallback screen appears if WebGL is
  unavailable.
- **Cinematic main menu** — original neon-sunset skyline (pure CSS/SVG),
  animated sun and clouds, subtitle "An Open World Adventure".
  Three working buttons: **Play** enters the 3D city, **Settings** opens
  the settings panel, **About** shows the game's description.
- **Settings** (`src/game/Settings.ts`, saved to localStorage) — graphics
  quality (Auto / Low / Medium / High / Ultra), shadows on/off, show FPS
  on/off, invert look. Quality applies on next entry; shadows and invert
  apply live, including from the in-game pause menu.
- **HUD** — live FPS (measured from real frame times), quality badge,
  pause/resume, quit-to-menu.
- **Mobile** — virtual joystick + look-drag area + RUN button, safe-area
  aware, no page scroll or horizontal overflow.
- **Adaptive quality** (`src/game/Quality.ts`) — Low / Medium / High /
  Ultra from cores, memory, touch and screen size; the engine steps a
  tier down if FPS stays below ~28. Simulation step is capped at 0.1s so
  slow devices get choppy rather than slow-motion movement.

## Structure

```
src/
  App.tsx                  phase machine: loading -> menu -> playing
  main.tsx
  styles/
    global.css             all styling (menu, HUD, panels, touch controls)
  components/
    LoadingScreen.tsx      MainMenu.tsx  GameCanvas.tsx
    SettingsPanel.tsx      AboutPanel.tsx
    TouchControls.tsx      (joystick + look drag)
  game/
    GameEngine.ts          renderer, loop, camera, cleanup, adaptive quality
    World.ts               ground, roads, buildings, palms, Beacon Tower
    Lighting.ts            sky dome, sun, hemisphere + directional lights
    Player.ts              kinematic movement + building collision
    Input.ts               shared keyboard / joystick / look state
    Quality.ts             device detection + quality tiers
    Settings.ts            persisted game settings
```

## Verified (19 Nov 2026, headless Chromium, production build)

Production build passes (`tsc + vite`, 790 KB JS). Tested live at
desktop 1280×800 and mobile 390×844, zero console/page errors:
menu → Settings (quality/shadows/FPS changes saved to localStorage) →
About → Play → 3D city renders; movement measured from the live engine
(W 6s moves the player forward; walking into a building stops exactly
at its edge, player radius 0.6); pause → Settings → Resume; quit to
menu; mobile joystick present, no horizontal overflow. Screenshots in
`qa/` (menu-desktop, gameplay-desktop, gameplay-mobile).

Known limits of the test environment: the headless test browser renders
in software (SwiftShader, ~2 FPS), so the game looks slow there — on
any real GPU it runs at full speed. The HUD FPS readout is honest about
this (it shows 2 FPS in that environment). A debug handle
`window.__vcsEngine` is exposed for automated checks.

## Phase 2 — the city (19 Nov 2026)

The prototype environment is now a full Miami-inspired coastal city,
built from a coherent street grid — no random scattering:

- **Districts** (`src/game/CityGenerator.ts`): 5 north-south avenues ×
  6 east-west streets; downtown skyscrapers in the north, commercial
  blocks with storefronts in the centre, residential blocks with
  balconies in the south, beachfront hotels along the east, two green
  parks. The x = 0 avenue runs from the spawn plaza to the Beacon
  Tower plaza at the north end.
- **Buildings** (`src/game/Buildings.ts`): 5 facade styles (glass,
  brick, pastel, hotel, concrete) as shared canvas textures that tile
  to a fixed real-world window size; storefronts with awnings and
  lit signs (CAFÉ AZUL, SURF SHOP, TACO BAR, NEON BAR…); balconies,
  rooftop AC units and water towers as InstancedMeshes; dark roof caps
  and neon roof trim on the skyline.
- **Roads** (`src/game/Roads.ts`): asphalt streets, sidewalks, curbs,
  edge lines, instanced lane dashes and crosswalk stripes at every
  intersection, ~150 instanced streetlights, and traffic signals at
  6 major intersections whose lights cycle green/red every 5 seconds.
- **Waterfront** (`src/game/Environment.ts` + `Vegetation.ts`): sandy
  beach, boardwalk promenade with a railing, palms, coloured beach
  umbrellas, and an ocean with a small animated shader (rolling waves,
  foam at the waterline, sun glitter). The player stops at the water's
  edge — the ocean is a collision wall.
- **Performance**: 72 buildings on High (28 Low / 48 Medium / 96 Ultra);
  measured on the production build: **282 draw calls, ~66k triangles**.
  Shared geometries/materials/textures throughout, instancing for all
  repeated props, adaptive quality untouched (steps down if FPS stays
  below ~28). Bundle 811 KB JS.
- **Preserved**: player, controls (WASD/arrows, Shift sprint, mouse
  look, mobile joystick), camera, collision (re-verified: walking into
  a building stops exactly at its edge + player radius; ocean wall
  verified at x = 187.4), menu, Settings, About, pause, HUD.

Verified live in headless Chromium (desktop 1280×800 + mobile
390×844, zero console/page errors). Screenshots in `qa/`
(gameplay-desktop, gameplay-street, gameplay-beach, gameplay-park,
gameplay-mobile). Known limit: the headless test browser renders in
software (~1–2 FPS), so the game looks slow there and the adaptive
quality steps down to Low; on any real GPU it runs at full speed.

## Phase 3 — vehicles and driving (19 Nov 2026)

One drivable sports car, the original "Velocity GT" in glossy red,
parked on the main avenue just north of spawn, facing the Beacon
Tower — visible the moment you press Play.

- **The car** (`src/game/Vehicle.ts`): extruded side-profile body
  (not a box), glass cabin, four wheels with rims, headlights,
  glowing taillight strip, grille, bumpers, mirrors, spoiler,
  exhausts. Clearcoat paint, metalness/roughness tuned for sunset.
- **Enter / exit**: walk up to the car and a prompt appears —
  press **E** on desktop, or the ENTER button on mobile. The
  character hides, the camera eases into a chase view. Press E
  again (or EXIT on mobile) and you step out beside the car, which
  stops dead — never mid-roll. Entering twice is impossible: the
  prompt only exists while walking.
- **Driving**: arcade kinematic model, no physics engine. W/S
  accelerate and brake/reverse, A/D steer with authority that falls
  as speed rises, Space is a handbrake (strong decel + livelier
  tail). Top speed ~137 km/h, reverse ~36 km/h. Wheels spin with
  speed, front wheels visibly steer.
- **Collision**: two circles (front/rear axle) against the same
  building boxes the player uses, plus the world bounds and ocean
  wall. A hit bumps the car and halves its speed — no teleporting,
  no passing through walls. The parked car is solid to the walking
  player too.
- **Camera**: chase camera behind the car with a smooth blend on
  enter/exit, mouse drag orbits around the car, scroll zooms, and a
  clip-avoidance pass pulls the camera in if a building would block
  it.
- **HUD**: live speedometer (km/h, real velocity), gear (R/N/D),
  car name, exit button. Mobile gets steering buttons, GAS, BRAKE,
  handbrake and EXIT instead of the joystick while driving; the
  joystick returns on exit.
- **Performance**: measured at spawn on High — **345 draw calls,
  ~69k triangles** (Phase 2 was 282 / ~66k; the car costs ~35
  calls). No new lights, no physics engine, bundle 811 KB.

Verified live in headless Chromium (desktop + mobile, zero console
errors): approach, enter, accelerate (28–70 km/h measured), brake
to a stop, reverse (gear R), steering (heading arcs the right way),
handbrake, building collision (stops exactly at the wall + car
radius), exit, mobile GAS hold (67 km/h) and EXIT. Screenshots in
`qa/` (gameplay-car-spawn, gameplay-driving,
gameplay-mobile-driving). Known limit: the headless test browser
renders in software (~1 FPS), so everything moves in slow motion
there and the adaptive quality steps down; on a real GPU it runs
at full speed.

**Also fixed in this phase (a real Phase 1 bug, caught while
placing the car):** W used to walk the character *toward* the
camera — position probes never showed it, because they don't show
screen direction. Walking is now camera-relative (W walks away
from the camera, into the screen) and the spawn camera now looks
north up the avenue, so the car and the Beacon Tower are in the
opening shot.

## Phase 3.5 — performance optimization (19 Nov 2026)

No rebuild, no features removed. The city looks identical —
screenshots in `qa/` (gameplay-spawn-optimized,
gameplay-driving-optimized) match the pre-optimization shots
pixel for pixel in layout, signs, lighting and landmarks.

### What was slow, and what changed

**Root cause, measured first:** the scene held **499 meshes**,
which meant **345 draw calls** per frame at spawn on High — and
the shadow pass re-drew the **151 shadow casters** a second time,
every frame, whether anything moved or not. Buildings alone were
~300 separate meshes (one per facade, roof, trim and shop front).

- **Merged static geometry** (`src/game/Merge.ts`, new): a
  `GeometryBatch` helper merges static boxes/planes per material
  into one draw call. Buildings went from ~300 meshes to ~25,
  road planes 84 → 4, block pads 28 → 1, car detail boxes 15 → 4,
  traffic signals 54 meshes → 3 (poles + heads merged, 36 bulbs as
  one `InstancedMesh` whose colour flips with the phase). The look
  is unchanged — same boxes, same materials, just merged.
- **Shadow map on demand** (`GameEngine.ts`): the shadow map is
  no longer re-rendered every frame. The player and the car are
  the only moving shadow casters, so it re-renders only when one
  of them moves more than 0.6 units — standing still costs no
  shadow pass at all.
- **No per-frame allocations**: the camera math and the car's
  axle-collision path now use reused scratch vectors instead of
  allocating `Vector3`s every frame.
- **Presets apply live**: picking Low / Medium / High / Ultra in
  Settings now rebuilds the city at that tier immediately, keeping
  the player and the car exactly where they are. It used to need a
  re-entry. The auto step-down (sustained low FPS) now waits 15
  seconds between downgrades and never steps back up on its own,
  so it can't flap.

### Measured results (same spawn view, same test browser)

| | Before | After |
|---|---|---|
| Draw calls (High) | 345 | **72** (−79%) |
| Meshes in scene | 499 | **81** |
| Shadow casters | 151 | **33** |
| Triangles (High / Medium / Low) | ~69k | **56,092 / 53,784 / 35,348** |
| Steady-state render time | — | **1.4–7.6 ms/frame** |

### The honest FPS note

The 1 FPS in the screenshots is the headless test browser: it has
no GPU and renders in software (SwiftShader). Its frame cadence
stays around 1–2 seconds per frame no matter how cheap the scene
is, so **no real FPS number can be measured there** — and the
50–60 desktop / 30–45 mobile targets can only be confirmed on real
hardware. What the numbers above do prove is that the work per
frame dropped by ~80%: on your 16 GB PC with a real GPU, the game
now has far more headroom than before. (One test-env quirk: the
auto step-down still fires in the software renderer, and each tier
change costs a multi-second stall there while shaders recompile —
on a real GPU that is a brief hitch, and on a real PC it likely
never fires at all.)

All 12 spec tests re-verified live on desktop + mobile with zero
console errors: menu, city, walking, enter, driving, steering,
braking, reverse, handbrake, collision (stops exactly at the wall),
exit, mobile controls, presets, pause. Production build passes.

## Phase 4 — realistic playable character (19 Nov 2026)

The pink capsule is gone. The player is now an original
articulated protagonist built from Three.js geometry — no copied
model, no external asset. Screenshots in `qa/`:
`character-front.png`, `character-back.png`,
`character-sprint.png`, `character-mobile-walk.png`.

### The character

~1.85 tall, natural proportions: detailed face (eyes, brows,
nose, mouth, ears, short dark hair), grey hoodie over a cream
tee, gold chain, dark cargo trousers, sneakers with white soles.
Every limb hangs off a named pivot, so the animation system can
pose it. Static face parts are merged per material, so the whole
figure is ~22 meshes.

### Why no downloaded GLB

The licensed models actually obtainable here were the wrong
character entirely: **CesiumMan** (CC-BY 4.0, a plain grey
mannequin with one walk animation) and **RiggedFigure** (a
wooden mannequin) from the Khronos glTF samples, and the three.js
npm package ships no character models at all. A Mixamo character
(free with an Adobe account) is the upgrade path if a
mocap-quality rig is wanted later — hand over the GLB and it
wires into the same rig slots.

### Animation

`src/game/CharacterAnimation.ts` — a procedural state machine
(idle / walk / run / sprint) driven by the character's **actual**
speed: the displacement the collision system allowed, not the
keys held. Pushing against a wall stops the legs instead of
sliding in place. The gait phase advances by stride length, so
foot placement matches ground speed. Every joint eases toward
its target pose, so starts, stops and state changes blend
instead of snapping. Turning leans the torso into the turn.
Idle has breathing and a slow weight shift.

Two small movement changes support the animation: speed now
eases toward its target (25 u/s²) instead of snapping, which
makes the run state genuinely reachable on the way between walk
(6) and sprint (10.5) and makes stopping a deceleration rather
than a dead stop — and diagonal movement is now the same speed
as straight movement (it used to be 41% faster). Steady-state
speeds, collision and boundaries are unchanged.

### Measured

- Walk: leg swing ±0.5 rad, torso lean −0.05, arms opposite.
- Run: observed during sprint deceleration, lean −0.13.
- Sprint: leg swing ±0.95 rad, lean −0.2.
- Wall push: stops at the wall + 0.6 and the legs return to
  idle while W is still held.
- Draw calls: Low 69 → 86 (+17 for the character); still 74%
  below the pre-3.5 baseline of 345.
- All 16 spec tests passed live on desktop + mobile, zero
  console errors (see the final report for the list).

### Limitations, stated plainly

Stylised, not photorealistic: the face is simple geometry that
reads at close range but has no texture detail, and there is no
motion-captured animation — the cycles are procedural. The run
state only appears during acceleration/deceleration between walk
and sprint, because the game has no sustained mid speed.

## Phase 5A — living city: pedestrian NPCs (19 Nov 2026)

The city has people in it now. Screenshots in `qa/`:
`pedestrians-street.png`, `pedestrians-closeup.png`.

### The crowd

Twelve original pedestrian archetypes — different skin tones,
hairstyles (short, long, bun, cap), clothing colours, skirts,
body types and walking speeds — all procedural, no copied
characters. They are rendered as 16 InstancedMeshes, one per
body part (head, 4 hair/cap variants, torso, arms, thighs,
shins, shoes, skirt, face), so 28 pedestrians cost about 16
draw calls total. Per-instance colour carries the variety;
per-instance scale carries the body types.

### Behaviour

NPCs walk a graph of real sidewalks, crosswalks, the beach
boardwalk and the Beacon Tower plaza (`PedestrianPaths.ts`),
built from the same street grid as the city — they can never
leave it, so they can never walk through a building or off the
map. Each one picks a distant destination and heads for it,
idles there for a few seconds, then picks another. They cross
roads only on crosswalks. They notice the player (their head
turns toward you), step aside when you walk into their path,
yield when you get very close, and step aside earlier when you
sprint at them. When the Velocity GT approaches a crossing
they hurry across — or wait at the curb if they haven't
started crossing yet. They slow down and drift aside for each
other instead of walking through each other.

A fixed pool of 28 is recycled around the player: anyone
further than 85 units away respawns in a ring 55–75 units out,
preferring spots behind the camera, so the crowd never thins
out and never accumulates. The population is configurable in
Settings — Off / Few (10) / Normal (18) / Busy (28) — and it
applies live, in the city.

### Measured

- 18 active by default, 0 inside buildings, 18/18 on paths,
  3 on crosswalks in one sample.
- Sidestep: 0.58 units lateral when the player stood in the
  path. Glance: head turned −0.36 rad toward the player.
  Hurry: 1.1 → 1.87 units/s (×1.7) when the car approached.
- Recycle: after teleporting across the map, all 18 were
  57–64 units away, count unchanged.
- Draw calls: 92 → 108 on the main pass (+16 for the crowd);
  161 on frames that refresh the shadow map. NPC shadows
  refresh at most twice a second, so the Phase 3.5 shadow win
  survives.
- All 14 spec checks passed live on desktop + mobile, zero
  console errors. QA caught and fixed one real bug: the first
  version had no shin geometry, so the shoes floated below the
  knees.

### Limitations, stated plainly

Stylised like the protagonist — procedural walk cycles, simple
faces. The wait-at-the-curb reaction is implemented but wasn't
captured live in the 1 FPS test browser (the hurry reaction
was), and a single NPC turning through one intersection wasn't
captured either — the evidence for turning is that all 18 stay
on the graph over a whole session, which a straight-line
walker couldn't do.

## Phase 5B — original city traffic (19 Nov 2026)

The city has traffic now. Screenshots in `qa/`:
`traffic-intersection.png`, `traffic-closeup.png`,
`traffic-street.png`.

### The fleet

Six original procedural vehicle categories — sedan, SUV, taxi
(with roof sign), sports car, delivery van and city bus — all
built from Three.js geometry, no copied vehicles. Each has its
own silhouette, proportions, cabin glass, bumpers and paint
colours. They are rendered as 8 draw calls for the whole fleet:
one instanced mesh per body category (vertex colours + per-
instance paint), one shared wheel mesh (spinning, steering
front wheels) and one shared light mesh (white headlights, red
taillights that brighten when braking). A fixed pool of 20 is
recycled around the player: anyone further than 90 units away
respawns in a ring 55–75 units out, preferring spots behind
the camera. Density is configurable in Settings — Off / Low
(8) / Medium (14) / High (20) — and it applies live.

### The AI

Vehicles follow a directed lane graph (`TrafficPaths.ts`)
built from the real street grid — right-hand traffic, one lane
per direction, stop lines 8 units before every intersection,
straight/left/right choices at each one, U-turns at the city
boundary. A vehicle can never leave the graph, so it can never
drive through a building, onto a sidewalk or off the map. They
ease their speed, slow for turns, keep a gap behind the car
ahead, and yield at unsignalised intersections when another
vehicle is already in the crossing.

The traffic lights are the existing ones (`Roads.ts`) — the AI
reads their live phase, it does not keep a second timer. Cars
stop ~5 units before the stop line on red and move again on
green; the cross direction proceeds while the avenue is red.
They stop for pedestrians on crosswalks (and NPCs now hurry
across or wait at the curb for AI cars too, not just the
player's car), brake for the player standing in the road, and
follow the Velocity GT — parked or driven — queuing behind it
and resuming when it moves away. Two cars that touch get
nudged apart, never teleported.

### Measured

- 14 active by default, all 6 categories present, 0 off-lane,
  0 inside buildings in two samples; 12/14 moving at spawn.
- Red lights: 2 cars observed stopped ~5.4 units before the
  stop line on red; 1 of them resumed (0 → 2.7) on green; the
  signal phase flipped 4 times in 3 minutes; 11 different cars
  observed moving on the cross streets while the avenue was red.
- Turns: 11 of 14 cars turned through an intersection in 2
  minutes.
- Pedestrians: an SUV waited 15 seconds at a crosswalk while
  an NPC crossed 7–8 units ahead of it.
- Player car: a sedan braked 8.55 → 0 behind the parked
  Velocity GT and resumed to 8.06 when it moved away; biggest
  position jump between polls 1.8 units — no teleporting.
- Player on foot: a van braked 5.16 → 0.36 for the player
  standing in the road and resumed to 7.37 when they stepped
  aside.
- Recycle: after teleporting across the map, all 14 cars were
  55–66 units away, count unchanged.
- Draw calls: 108 → 116 on the main pass (+8 for the whole
  fleet); 175 on frames that refresh the shadow map. Traffic
  shadows refresh with the NPC 2/s timer.
- All 16 spec checks passed live on desktop + mobile, zero
  console errors. QA caught and fixed one real bug: the first
  version's paint was near-black on the shadow side at sunset
  (metalness + dark colours), so the cars read as black slabs —
  metalness is now 0.05 and the palette is mid-tones.

### Limitations, stated plainly

Stylised like the rest of the game — procedural box-built
cars, simple steering, no indicators, no horns, no parking.
Cars do not change lanes to overtake a slow vehicle ahead;
they queue behind it. A car that enters an intersection just
as the light turns red clears it rather than stopping inside.
The player can still drive the Velocity GT through an AI car
if they ram it head-on — the AI car gets nudged out of the
overlap, but there is no full collision between the two cars
yet. No police, wanted levels or missions — those are later
phases.

## Phase 6A — police AI and wanted system (19 Nov 2026)

The city has police now — and a reason to run from them.
Screenshots in `qa/`: `police-closeup.png`,
`police-street.png`, `police-roadblock.png`,
`police-search.png`, `police-mobile.png`.

### The fleet

Two original procedural police vehicles — a black-and-white
sedan and SUV with a push bar, white doors and roof, and a
flashing red/blue light bar — all built from Three.js
geometry, no copied police models or textures, no text
decals. Rendered instanced like the traffic fleet: 2 body
meshes, 1 shared wheel mesh (spinning, steering front
wheels), 1 shared light mesh (headlights, brake lights) and
1 light-bar mesh — 5 draw calls for up to 6 units. The bar
alternates red/blue every 0.4 s while a unit is on duty
(pursue / search / roadblock); patrolling units run dark. A
fixed pool of 6 is recycled around the player, in a ring
75–95 units out — deliberately outside the sight range, so a
hidden player stays hidden. Police activity is configurable
in Settings — Off / Low (2) / Normal (4) / High (6) — and it
applies live, as do pursuit difficulty (Easy / Normal /
Hard) and the wanted-system toggle.

### The wanted system

Heat 0–100, five stars at 10 / 25 / 45 / 70 / 90. Offences
are detected from the live game state: hitting a pedestrian
(+25, car or on foot at speed), hitting an AI vehicle with
the Velocity GT (+12, oriented overlap), sustained reckless
speed over 28 u/s for 2 s (+8), running a red light at a
signalised intersection (+8). No weapons, no combat, and no
vehicle-stealing trigger — stealing an AI vehicle is not a
feature of this game. The status machine is pursuit while
any police unit can see the player (distance + a building
midpoint line-of-sight check), search once unseen for 6
seconds (police drive to the last known spot and wander the
nearby roads, heat decays, the escape timer runs), and clear
when the timer finishes (14 + 4 s per star) without a
re-detection. The level never drops to zero mid-search — the
timer, not the heat, is what clears it.

### The police AI

Patrol follows the same lane graph as traffic — random
turns, stops at red lights, yields, keeps a gap, stops for
pedestrians on crosswalks and for the player on foot. On a
wanted level the nearest units are assigned to pursue: they
navigate the graph greedily toward the player (or a cut-off
point ahead of them, so they spread out instead of stacking),
run red lights slowly instead of stopping, and keep a gap
behind the player's car instead of ramming it. Pursuit speed
is 15 + 1.5 u/s per star, scaled by difficulty — the Velocity
GT (38) can outrun them, which is the point. On foot they
close in and hold about 9 units away. At 3+ stars two units
form a roadblock across the road ahead of the player; it
dissolves when the player reaches it (both join the pursuit),
when the wanted level drops below 3, or when the player
stays far away. One roadblock at a time, never the whole
city. Units further than 120 from the player update at half
rate. NPCs hurry across and wait at the curb for police cars
too.

### HUD

A wanted pill sits top-centre when the level is above zero:
five stars (gold filled, grey empty), PURSUIT or SEARCHING —
STAY HIDDEN, and an escape progress bar while searching. It
matches the existing HUD pills and works on mobile.

### Measured

- Spawn: 4 active by default (Normal), both kinds, all
  patrolling; 0 off-lane, 0 inside buildings.
- Patrol: 3 of 4 units turned through intersections in 3
  minutes; a patrol unit observed stopped at the stop line
  (−2.5, 82) for intersection (0, 90) while the avenue was
  red.
- Wanted: heat 10 / 25 / 45 / 70 / 90 → levels 1–5, HUD
  stars matching at every level; toggle off clears it.
- Real offences (no debug hook): ramming an AI SUV at 20
  u/s raised heat 0 → 12, level 1, 1 pursuer assigned;
  sustained 33.9 u/s raised heat 0 → 8 (speeding).
- Pursuit (car): 2 pursuers chased the GT for a full minute
  (12/12 polls) and again for 50 s (10/10 samples) while it
  accelerated 3 → 35.5 u/s; they fell behind as it outran
  them and recycled into the 75–95 ring to keep the chase
  alive. No teleporting — biggest gap changes are the GT
  pulling away.
- Pursuit (foot): a unit closed to 5.8 units of the player
  on foot within 5 s and held at ~9–10.
- Search and escape: after breaking line of sight, SEARCH
  began at 60 s with last known (0, 8) — the exact spot the
  player was last seen — and the level cleared at 199 s with
  the escape bar advancing 0 → 0.97.
- Roadblock: at 3 stars, 2 units parked across the avenue
  at intersection (0, −30), 27 units ahead of the GT,
  headings perpendicular to the road; all 4 units back on
  patrol 8 s after the wanted level cleared.
- Settings: Off → 0, Low → 2, High → 6, Normal → 4,
  applied live; difficulty and the wanted toggle apply live.
- Regressions: traffic 14/20, pedestrians 18/28, walk /
  drive / exit all work; mobile 390 px: joystick present,
  2 wanted stars, no horizontal overflow.
- Draw calls: 116 → 121 on the main pass (+5 for the whole
  police fleet); 180 on frames that refresh the shadow map.
- All 17 spec checks passed live on desktop + mobile, zero
  console errors.

QA caught and fixed two real bugs: the red-light check had
the avenue/street heading test backwards (a green light
would have counted as running a red), and the white roof
panel was built inside the glass cabin, so the cars read as
black slabs from behind — the roof now sits on top of the
cabin and the body is a lighter charcoal.

### Limitations, stated plainly

Stylised like the rest of the game — procedural box-built
cars, no indicators, no horns, no parking. There is no
busted/arrested state: a pursuit only ends by escape, so a
player who never breaks line of sight stays wanted. Police
stop for pedestrians on crosswalks (same code as traffic's
verified stop), but that specific stop was not isolated in a
clean live observation for police — the lane and building
avoidance was measured directly. Distant pursuers recycle
near the player (same as traffic and pedestrians), so a chase
never fully dies by distance alone. The red-light and
pedestrian-hit offences are implemented but were not
triggered live in QA (the car-hit and speeding offences
were); the level thresholds were verified through the debug
heat hook. The wanted HUD slightly overlaps the FPS chip on
a 390 px screen — readable, but the spacing is tight. No
missions, weapons or multiplayer — those are later phases.

## Phase 6B — police enforcement, arrest & busted system (19 Nov 2026)

Getting caught now has consequences — and a way out. Screenshots
in `qa/`: `arrest-prompt.png`, `hands-up.png`,
`busted-screen.png`, `busted-mobile.png`, `busted-car.png`.

### Interception

Pursuit aim is now a real interception: the lead pursuer targets
where the Velocity GT will be when it gets there (lead time from
real distance and pursuit speed), and the next two take flanking
points either side of that intercept point, so the units spread
around the player's car instead of stacking behind it. On foot
the player is slower than the police, so every pursuer chases
directly. Everything still runs on the lane graph — no unit is
placed inside a building or another vehicle, and no unit
teleports to the player; the recycle ring (75–95) still sits
outside sight range, so escape stays possible. The GT at full
throttle (38) still outruns the police (22.5 at 5 stars), so
interceptions mostly happen when the player slows or stops —
which is when the arrest prompt appears.

### The arrest

A surrender prompt appears when the police have genuinely caught
up. On foot: a pursuer within 7 units while walking slowly, or
within 3.5 even at a sprint. In the car: the GT effectively
stopped with two police units within 12, or one right on the
bumper within 6. The prompt clears the moment the conditions
break — run away or drive off and pursuit continues, no arrest.
Standing still next to a pursuer that can see you for 3 seconds
is a catch: the arrest starts by itself (auto-arrest, line of
sight gated, so no arrest through walls). There is no arrest
while driving at speed, and no arrest while the police have lost
you (search mode).

Surrendering locks the controls, plays an original procedural
hands-up animation (both arms overhead, built on the existing
character rig — no new model), and the nearest police unit drives
up and stops by the player. After 2.8 seconds the BUSTED screen
fades in: a dark red vignette over the frozen city, a big BUSTED
title in the game's own voice, and one way out — Respawn. The
"officers" are the police vehicles themselves approaching; there
are no separate walking officer models in this phase.

### Respawn

Respawn returns the protagonist to the original spawn (0, 0, 8),
the Velocity GT to its parking spot (0, 0, −2, heading north),
wanted heat and stars to zero, all police to patrol, roadblocks
dissolved, and the camera to the normal walk view. Traffic and
pedestrians are untouched — they never stopped. Wanted and police
are actually reset the moment BUSTED appears (behind the screen);
respawn only moves the pieces back. If the wanted system is
disabled in Settings, no prompt and no arrest can ever start.

### Controls

Desktop: F to surrender when cornered. Mobile: a SURRENDER
button in the same centred prompt slot (lifted clear of the
speedo and pedals on small screens), and the Respawn button on
the BUSTED screen. No new settings were needed — Police Count,
Pursuit Difficulty and the wanted toggle all govern the arrest
exactly as they govern the pursuit.

### Measured

- Foot interception: prompt at 5 s, nearest pursuer 6.1 units,
  line of sight confirmed.
- Car interception: 3 of 12 samples had a pursuer ahead of the
  GT (lead points 29.5, 26 and 8.5 ahead in the early samples);
  closest approach 14.3; the GT then outran them, as designed.
- Foot surrender: F → hands up in 5 s → BUSTED 5 s later; the
  arrest unit stopped right by the player.
- Car surrender: stopped, prompt at 5 s (first run) and 85 s
  (re-run, after the police had to close 80 units — see below);
  F → the player exits the car on foot → hands up → BUSTED.
- Escape: prompt cleared 5 s after flooring it, wanted level
  still 5, pursuit continuing, no arrest.
- Auto-arrest: standing still with no keys pressed, a pursuer
  stopped at 5.9 units with line of sight — the arrest started
  by itself at 35 s, BUSTED 25 s later.
- Busted screen: visible on desktop and mobile, title BUSTED,
  Respawn button (desktop and 390 px, no horizontal overflow).
- Respawn (every run): player (0, 8), mode walk, wanted 0/0
  clear, GT (0, −2) heading π speed 0, all 4 police patrol,
  traffic 14/20, pedestrians 18/28, walking works again.
- Wanted disabled + heat 90: no prompt in the DOM, wanted
  level 0, arrest state none.
- Draw calls: 111 on mobile Low at the BUSTED screen — the
  arrest adds no meshes and no lights (the light bar already
  existed), so the Phase 3.5 budget is unchanged.
- All 16 spec checks passed live on desktop + mobile, zero
  console errors.

QA caught and fixed one real bug: vehicle speed is signed, so
a GT reversing at −5.6 counted as "stopped" and the surrender
prompt fired while the car was still moving backwards. Both
speed checks now use the absolute value.

### Limitations, stated plainly

Stylised like the rest of the game — the "officers" are the
police cars, not walking characters; there is no handcuff or
pat-down animation, just hands up and the BUSTED screen. The
auto-arrest needs a pursuer to have pulled up within 6 units of
a stationary player; a player who keeps moving is never
auto-arrested, which is the point, but it means the catch only
happens to a player who stops. The line-of-sight gate was
verified on the positive side (sees=true at the auto-arrest);
a blocked-sight negative case was not captured live, because
pursuers navigate to the player's side of any building. After
a long high-speed chase the police can take ~8 sim-seconds to
close back in on a stopped GT (85 s real in the slow headless
browser, ~8 s on a real PC) — the prompt only appears once
they arrive. No weapons, no combat, no missions — those are
later phases.

## Phase 7A — mission system (19 Nov 2026)

The city finally has something to do in it. Screenshots in
`qa/`: `mission-marker.png`, `mission-complete.png`,
`mission-mobile.png`, `mission-failed.png`.

### Architecture

Missions are data, not engine code. The engine never knows what
a mission is — it feeds live game state to the manager and
renders what the manager reports.

- `MissionTypes.ts` — the contract: objective types, mission
  definitions, runtime states, the HUD state the engine renders.
- `MissionDefinitions.ts` — the missions themselves. Every
  coordinate is a real place, read off the world code (spawn,
  avenue/street grid, the tower plaza).
- `MissionTriggers.ts` — the pure condition checks per
  objective type (reach / interact / enterVehicle / checkpoint /
  deliver), so a new objective type never touches the manager.
- `MissionManager.ts` — the state machine (idle → available →
  active → complete / failed), the timer, checkpoints, cash,
  and the one 3D marker.
- `MissionHUD.tsx` — the mission card (title, cash, objective,
  direction arrow, live distance, countdown, abandon).
- `MissionCompleteScreen.tsx` / `MissionFailedScreen.tsx` —
  the reward and failure overlays.

### The first mission: BEACON RUN

A fictional contact, Mara Voss, needs a package at Beacon
Tower. Five objectives, in order:

1. Find the mission marker — a yellow beam, ring and floating
   diamond on the sidewalk just north of spawn (6, 14).
2. Accept the job (E on desktop, START on mobile).
3. Get in the Velocity GT (the marker moves to the car).
4. Pass the halfway checkpoint at the x = 0 / z = −90
   intersection — worth +15 seconds.
5. Deliver to Beacon Tower (0, −165) before the 60-second
   clock runs out. Reward: $500.

Cash is virtual and local, persisted in localStorage, paid
exactly once per completion — the state machine makes a second
payment impossible without a new run. Replay is built in:
Continue returns the mission to available, Replay restarts it
immediately.

### Integration

- **Arrest:** getting busted mid-mission fails it (reason
  "busted"). The BUSTED screen shows first; the failure screen
  follows on respawn. No reward is paid, and respawning never
  duplicates one.
- **Pause:** the timer only ticks while the game loop runs, so
  pausing freezes it for free.
- **Cancel:** an Abandon button in the mission card returns
  the mission to available with no penalty.
- **Markers:** one group of three meshes (beam, ring, diamond),
  created once and repositioned per objective — nothing is
  created per frame, the meshes cast no shadows, and the marker
  never blocks the enter/surrender prompts (the accept prompt
  takes the same centred slot, and only when the player is at
  the marker).

### Measured

- Discovery: available at spawn, marker (6, 14), distance 8m,
  card in the DOM.
- Start: reach the marker → "Press E to start BEACON RUN" →
  E → active, 60 s on the clock, marker moves to the GT.
- Cancel: Abandon → available, marker home, cash 0.
- Full run: marker → accept → GT → checkpoint at z = −84
  (+15 s, clock 56 → 70, "CHECKPOINT +15s" flash) → tower at
  z = −158 → MISSION COMPLETE, +$500, cash $500.
- Cash persists across a reload ($500 after a fresh page load).
- Timer failure: forced to 3 s → failed at 35 s, MISSION
  FAILED with the right reason, cash 0; Retry → active again
  with a full 60 s.
- Pause: 60 s before, 60 s after 10 s paused, 59 s after 5 s
  resumed — the clock freezes exactly.
- Arrest: mission active, heat 90, standing still → auto-arrest
  → busted at 70 s → mission failed (reason "busted"), cash
  unchanged; the failure screen waits for the BUSTED screen to
  clear and appears on respawn; player (0, 8), mode walk,
  police all patrol, traffic 14/20, pedestrians 18/28.
- Mobile (390 px): card at (14, 140), no overflow; START button
  (93, 475) tapped → active; Abandon → available; joystick
  present.
- Navigation arrow: verified in two staged cases (target
  south-east of a north-looking camera → +123.7°, target
  west-southwest → −153.4°) and in the exact mobile scenario
  (target north-west → −20.6°, arrow up-left) — the arrow
  points where the objective is.
- Draw calls: 185–187 at spawn (6A measured 180 on a Medium
  shadow-refresh frame — the gap is tier/auto-step-down
  variation; the marker itself is exactly 3 meshes, no shadows,
  no per-frame allocation).
- Build passes; zero console errors in every run.

QA caught and fixed one real bug, in the 6B arrest code (not
the mission code): the auto-arrest distance (6) was tighter
than the foot-prompt distance (7), so a pursuer that stopped at
6.5 showed the prompt forever and a stationary player was
never caught. The auto-arrest now uses 7, matching the prompt
— a pursuer inside the prompt range that sits there for 3 s
while the player is near-stationary is a catch.

### Limitations, stated plainly

- One mission only. The architecture takes a list of
  definitions, but only BEACON RUN is defined — the next
  missions are new data, not new engine code.
- The timer is generous (60 s for a ~15 s drive) — it is a
  first mission, not a hard one.
- The direction arrow is a 2D compass arrow in the HUD, not a
  3D path or minimap — it points at the objective, it does not
  draw the route.
- The marker is visible from anywhere (the beam is 60 units
  tall) — that is deliberate, it is the discovery affordance.
- No weapons, no combat, no multiplayer, no new story
  characters — those stay out of this phase.

## Phase 7B — four missions, progression, mission board (19 Nov 2026)

The mission system from 7A now has a campaign: four new
missions, a sequential unlock chain, persistent progress, and
a mission board to pick jobs from. Screenshots in `qa/`:
`mission-board.png`, `mission-board-mobile.png`,
`mission2-complete.png`, `mission3-complete.png`,
`mission4-complete.png`, `mission5-hideout.png`,
`mission5-complete.png`, `mission-mobile-hud.png`.

### Architecture

- `MissionProgress.ts` — progress persistence: localStorage
  `vice-city-stories.missions.v1` (`{ completed: string[],
  selected: string | null }`), the unlock check, the cash
  balance, and the board rows the UI renders. No three.js
  dependency — the menu board reads it directly.
- `MissionVehicle.ts` — the tail target: a dedicated teal
  sedan with a purple roof beacon (7 meshes, castShadow on
  body/cabin only). It drives the real traffic lane graph
  node-to-node at 11 u/s, stops at the existing red lights,
  turns 70% straight / random at stop lines, and parks when
  its 500-unit route is done. Visible only while the tail
  mission is selected.
- `MissionBoard.tsx` — the board overlay, used in both the
  main menu (new "☰ Missions" button) and in-game (new
  "☰ Missions" button in the HUD; opening it pauses the game,
  closing it resumes). Each row shows the name, kind chip,
  reward, description, giver, and badges (✓ Completed /
  ● Active now / ◆ Selected / 🔒 Locked — finish {previous}),
  with Select / ↻ Replay / Selected ✓ / Running now.
- New objective types in `MissionTriggers.ts`: `follow` (a
  distance band with lock-on, too-close and too-far clocks)
  and `evade` (completes when the wanted level reaches 0).
- `MissionManager.ts` — now holds the selected definition
  (defaulting to the first mission and persisting that choice,
  so a fresh player always has BEACON RUN selected), the
  unlock chain, `selectMission`, the target vehicle handle,
  `startHeat` (applied on accept), untimed missions
  (`timeLimit: 0` — no clock at all, HUD shows no timer), and
  per-objective `flashText`.
- `Traffic.ts` brakes for the target car the same way it
  brakes for the Velocity GT, and the engine passes the target
  into the crowd / police / wanted avoidance lists — NPCs wait
  for it, police yield to it, and ramming it counts as a car
  hit (+12 heat). No traffic AI pool changes.

### The unlock chain

BEACON RUN → MIDNIGHT DELIVERY → LOST CONNECTION →
DON'T LOSE THEM → NO WAY OUT. Each mission unlocks only when
the previous one is completed; progress and cash persist in
localStorage. Selecting a mission moves the world marker to
it; the player still accepts at the marker.

### The four new missions

**MIDNIGHT DELIVERY — $750, Rico Hale.** Pick up a crate at
the south-west dock (−114, 144), get in the GT, deliver to the
beach (165, 90). 120 s on the clock.

**LOST CONNECTION — $600, June Park.** An exploration job
with no timer: find three clues — west park (−90, 60),
east park (90, −60), boardwalk (133, 30) — each flashing
"CLUE FOUND — n of 3", then return to June Park (−6, −30).
Done entirely on foot.

**DON'T LOSE THEM — $1,000, Vic Marino.** A tail job: the
teal sedan waits on the x = 60 avenue at the z = −150 street.
Get in the GT and follow it — stay 8–35 m behind to lock on.
Closer than 5 m for 3 s and the target makes you ("spotted");
further than 45 m for 5 s after lock-on and the tail is over
("lost"). The target drives a 500-unit lane-graph route, then
parks; close the last gap and the job completes. 150 s.

**NO WAY OUT — $1,500, Dana Cole.** An escape job: accepting
it sets the wanted heat to 45 (level 3) through the existing
wanted system — no second wanted system. Reach the beach
hideout (180, −30), then stay hidden until the heat dies
down. 180 s. If the player disabled wanted in settings, no
police come and the evade completes as soon as the hideout is
reached.

### Measured

- Board (menu): 5 entries in order with kinds and rewards
  ($500 / $750 / $600 / $1,000 / $1,500); BEACON RUN unlocked
  with an enabled Select button; the other four locked with
  the right prerequisite names; cash $0.
- Board (in-game, after BEACON RUN): BEACON RUN ✓ Completed
  with ↻ Replay; MIDNIGHT DELIVERY unlocked; the rest still
  locked; the board overlay shows and the pause overlay stays
  hidden behind it.
- Selection + persistence: selecting MIDNIGHT DELIVERY
  switches the HUD to it with the marker at the dock; after a
  reload the board shows BEACON RUN ✓ Completed, MIDNIGHT
  DELIVERY ✓ Completed + ◆ Selected, LOST CONNECTION
  unlocked, and the cash at $1,250.
- MIDNIGHT DELIVERY: accept → forced timer 3 s → failed
  "timer" with the right failure line → Retry → active 120 s
  → Abandon → available → re-accept → GT → staged drive east
  along the z = 90 street → beach (GT at 162, 90) → MISSION
  COMPLETE +$750, cash $1,250.
- LOST CONNECTION: accept → no timer in the DOM → three clue
  flashes in order, mode walk throughout → return → MISSION
  COMPLETE +$600, cash $1,850.
- DON'T LOSE THEM: target parked at its start (draw calls
  133 at spawn with the target car on the road); accept →
  GT → lock-on at 21 m ("Stay 8–35 m behind the target") →
  too close → failed "spotted" ("The target made you — the
  tail is blown.") → Retry → the mission restarts and, once
  the player walks back to the marker, lands on "Get in the
  Velocity GT" without another accept → too far after lock-on
  → failed "lost" ("The target slipped away — the tail is
  over.") → route shortened with the QA hook to 490/500 →
  target parks, GT closes the gap → MISSION COMPLETE +$1,000,
  cash $2,850.
- NO WAY OUT: accept → wanted level 3, heat 45, pursuit →
  GT → hideout → "Stay hidden until the heat dies down"
  ("Wanted level 3 — stay out of sight") → pursuit / search
  cycles → heat clears at ~188 s real → MISSION COMPLETE
  +$1,500, cash $4,350.
- Mobile (390 px): board opens from the HUD with all five
  entries and correct locks, no horizontal overflow
  (scrollWidth 390 with the board open and in-mission);
  closing the board resumes the game; START tap at the marker
  → active, 60 s.
- Regression: BEACON RUN still completes end-to-end (+$500,
  cash $500); draw calls 126 at spawn (6A: 121 — the marker
  is +3, the rest is run-to-run variation); zero console
  errors in every run.

QA caught and fixed two real bugs, both in the mission code
this time:

1. **Retry / replay stalled the mission.** `retry` and
   `replay` reset the objectives to the reach step, which
   completes on its own — but the next step, the accept
   objective, can only complete through the E press, which
   requires the mission to be 'available'. A retried mission
   sat at the accept step forever, with no way forward. The
   manager now skips the accept step while 'active' (the job
   is already accepted) — verified live: after a retry, walking
   back to the marker lands the mission on "Get in the
   Velocity GT" with no extra input. The 7A tests never caught
   this because they always cancelled and re-accepted after a
   retry instead of continuing from it.
2. **Escape heat never applied on keyboard.** The E-key
   handler called the manager's `tryInteract()` directly,
   bypassing the engine wrapper that applies `startHeat` — so
   NO WAY OUT completed with no police at all (the evade
   objective saw wanted level 0 immediately). Only the
   touch START button used the wrapper. The E handler now
   goes through the wrapper — verified live: accept sets heat
   45, level 3, pursuit.

### Limitations, stated plainly

- The unlock chain is sequential only — no branching, no
  optional order, no mission that needs another mission's
  reward.
- The sustained real tail was attempted twice and the test
  driver lost the target both times: a straight-line autopilot
  at 1 FPS wedges on buildings and traffic, and the reverse-out
  recovery only made the gap worse. The follow mechanics are
  all verified live (lock-on, band hints, both fail paths, the
  target driving its lane-graph route, completion when it
  parks) and the completion was verified with the route
  shortened by the QA hook — but a full 500-unit real follow
  has not been driven end-to-end in the test browser. A human
  following the visible teal car along the road has the GT's
  38 u/s against the target's 11, so the mission is
  completable; the test driver is the limit, not the game.
- The M2 and M5 drives were staged (the GT placed on the
  destination street before driving) — the deliver / reach
  triggers, timers and rewards were tested live, and the
  cross-city drive is BEACON RUN's proven path, but the full
  route from spawn was not driven for those two.
- With wanted disabled in settings, NO WAY OUT's evade
  completes as soon as the hideout is reached — no police
  come. That is the documented behaviour, not a bug, but it
  makes the last mission trivial for a player who turned
  wanted off.
- The target car can still be rear-ended by the player; the
  traffic brakes for it, but there is no full collision
  physics between the GT and the target.
- No weapons, no combat, no multiplayer, no new story
  characters — those stay out of this phase.

## Phase 7C — vehicle ownership, garage & customisation (19 Nov 2026)

Mission cash now has somewhere to go: four ownable cars, one
physical garage in the city, and paint + upgrades that change
how each car actually drives. Screenshots in `qa/`:
`garage-exterior.png`, `garage-panel.png`,
`garage-panel-shadow.png`, `garage-vortex-selected.png`,
`garage-vortex-drive.png`, `garage-mobile.png`.

### Architecture

- `VehicleCatalog.ts` — the ownership model's data: one spec
  per car (name, kind, price, base top speed / acceleration /
  handling, body dimensions, spoiler style, factory paint, home
  parking spot) and the 10-colour paint palette. No three.js
  dependency.
- `GarageProgress.ts` — garage persistence: localStorage
  `vice-city-stories.garage.v1` (`{ owned: string[], selected:
  string, paint: { [id]: hex }, upgrades: { [id]: { engine,
  accel, handling } } }`), with defensive loads (unknown ids
  dropped, selection falls back to the Velocity GT, levels
  clamped 0–3). The Velocity GT is owned from the start.
- `Vehicle.ts` — the car builder is now spec-driven: the
  extruded side profile, glasshouse, wheels, lights and spoiler
  are all computed from the spec, so the four cars are
  visually distinct builds from the same architecture rather
  than one mesh recoloured. `buildVehicleMesh(spec, paint)` is
  exported for the garage preview. Top speed, acceleration and
  steering authority come from the spec + upgrade levels
  (`setTuning` / `getTuning` on the handle; `setPaint`
  repaints the live car), so an upgrade changes the real
  numbers the update loop drives on. The GT at level 0 is
  exactly the Phase 3 car (38 m/s, 16 accel, 1.00 handling).
- `Garage.ts` — the physical garage: a charcoal workshop
  building with a ribbed roller door, a gold "SUNSET GARAGE"
  sign, a neon strip, a concrete apron and a tire stack, plus
  a cyan beam + ring marker at the entrance (2 draw calls).
  `CityGenerator.ts` reserves its footprint (x 12–32, z
  45–59, on the residential block south-east of spawn) and
  filters generated plots out of it at every quality tier;
  `World.ts` builds it and adds its walls to the collision
  boxes.
- `MissionManager.ts` — `getCash()` / `spendCash(amount)`:
  the garage spends through the manager because the manager
  holds the cash balance in memory; a garage write straight
  to localStorage would have gone stale on the next mission
  payout. `spendCash` returns false and spends nothing when
  the balance is short.
- `GameEngine.ts` — owns the garage state, `nearGarage`
  (within 4.5 units of the door, on foot), and the E-key
  priority (mission accept → garage door → car). `garageBuy`
  / `garageSelect` / `garagePaint` / `garageUpgrade` enforce
  ownership, cash and level caps, persist, and apply live.
  Selecting a car despawns the old one and spawns the new one
  at the garage parking bay (22, 30, heading east); the GT
  keeps its original spot (0, −2). Respawn restores the
  selected car to its home spot. Quality-preset rebuilds
  recreate the selected car with its paint and upgrades.
- `GaragePanel.tsx` + `VehiclePreview.tsx` — the panel in the
  game's gold/dark style: four vehicle cards, a live 3D
  turntable preview (its own small renderer, disposed on
  close), stat bars, 10 paint swatches ($150 a repaint), and
  three upgrade rows with level pips and before → after
  stats. Opening it pauses the game; closing resumes.
  `GameCanvas.tsx` wires the door prompt (E on desktop, an
  Enter Garage button on touch) and the panel.

### The four cars

| Car | Kind | Price | Top speed | Accel | Handling |
| --- | --- | --- | --- | --- | --- |
| Velocity GT | sports | owned | 38 m/s (137 km/h) | 16.0 | 1.00 |
| Shadow LX | sedan | $2,000 | 34 m/s (122 km/h) | 12.0 | 0.85 |
| Vortex RS | coupe | $3,500 | 42 m/s (151 km/h) | 19.0 | 1.15 |
| Trailhawk X | SUV | $2,800 | 32 m/s (115 km/h) | 13.0 | 0.80 |

The Shadow LX is a long low sedan with a lip spoiler; the
Vortex RS a wide low coupe with a big wing; the Trailhawk X
a tall boxy SUV on big wheels (0.46 radius, +0.12 ride
height) with a roof rack.

### Upgrades (max level 3 each)

- Engine: +3 m/s top speed per level — $400 / $800 / $1,400.
- Acceleration: +2.5 m/s² per level — $300 / $600 / $1,000.
- Handling: +0.08 steering authority per level — $300 / $600
  / $1,000.
- Paint: any palette colour, $150 a repaint.

A fully upgraded Vortex RS runs 51 m/s (184 km/h), 26.5
m/s² and 1.39× handling.

### Verified (19 Nov 2026, headless Chromium, production build)

- Garage entry: walking to the door sets `nearGarage`, the
  prompt shows, E opens the panel and pauses the game; the
  building, gold sign, roller door and cyan beam read clearly
  from the street (`garage-exterior.png`).
- Purchases: Shadow LX bought for exactly $2,000 (cash
  $5,000 → $3,000); a second buy returns `already-owned` and
  spends nothing; Vortex RS at $3,500 with $3,000 in the bank
  returns `insufficient`, spends nothing, and its Buy button
  is disabled with "need $500 more". Ownership and cash
  survive a reload.
- Selection: picking the Vortex RS spawns it at the garage
  bay (22, 30) heading east and despawns the GT — exactly one
  player vehicle group in the scene. Re-selecting the GT
  returns it to (0, −2) heading north with the Phase 3 tuning
  (38 / 16 / 1.00).
- Paint & upgrades: repainting the Vortex Neon Pink costs
  $150 and persists; engine / accel / handling L1s cost $400
  / $300 / $300 and change the live tuning (42 / 19 / 1.15 →
  45 / 21.5 / 1.23); a fourth engine purchase returns
  `maxed`; after a reload the fully upgraded Vortex still
  reads 51 / 21.5 / 1.23 with the Neon Pink paint.
- Upgrades change real driving: the base Vortex reached 149
  km/h north up the avenue (its 151 km/h ceiling); the same
  car with engine L3 + accel/handling L1 reached 178 km/h
  (its 184 km/h ceiling).
- Regression: the GT still enters and drives; BEACON RUN
  completes end-to-end (+$500, cash $5,000 → $5,500, and
  MIDNIGHT DELIVERY unlocks on the board); traffic 14 active
  and police 4 active; a level-5 pursuit ends in the arrest
  prompt, F surrenders, BUSTED shows, and respawn restores
  the player to (0, 0, 8) and the GT to (0, −2) with wanted
  cleared.
- Mobile 390px: the garage opens from the touch button, the
  panel fits with no horizontal overflow (scrollWidth 390),
  the Trailhawk X buys by tap ($5,000 → $2,200), and the game
  resumes on close.
- Zero console errors across all runs. Draw calls at spawn
  193 (7B measured 126; the garage adds ~10 meshes and the
  count varies run to run — earlier runs measured up to 196).

### Known limitations

- The garage is a single building with one entrance; there
  is no interior to walk into — the panel is the garage.
- The player car and traffic cars do not collide with each
  other (unchanged from Phase 3); ramming still counts as a
  wanted offence.
- With wanted disabled in settings, NO WAY OUT's evade
  completes as soon as the hideout is reached (unchanged from
  7B).
- No weapons, no combat, no multiplayer — those stay out of
  this phase.

## Phase 7D — living city & world interactions (19 Nov 2026)

### Architecture

- Interaction registry (`src/game/Interactables.ts`): one registry of
  named interactables — `{ id, name, x, z, radius, prompt, available(),
  onInteract() }`. The engine asks it for the nearest available entry
  each frame; E priority is mission → garage → registered interactable
  → vehicle, and the touch button uses the same path as the keyboard.
  No two prompts overlap in the city (store, garage and mission
  marker are all >20 units apart), so the chain is verified by
  construction plus separate cases.
- The store, outfits, collectibles and sprint are separate modules
  with their own versioned localStorage namespaces, so a failure in
  one cannot corrupt cash, missions or the garage.

### The store: Sunset Mart

- Original storefront on the commercial block (avenue 0–60 /
  street −30–30): footprint x 34–52, z 8–22, centre (43,15), glass
  door facing south onto the z=30 street, entrance marker (43,24).
  The interior is genuinely visible through the glass (shelves,
  instanced goods, counter), not a texture. Sign: "SUNSET MART /
  OPEN 24 HOURS", striped awning, red vending machine.
- Shop inventory (keepsakes — no hunger or stamina, per spec):
  Water $10, Snack $20, Energy Drink $35 ("Sunset Buzz"). Buys go
  through the shared cash (`missions.spendCash`), so the balance
  can never go stale. A repeat buy within 500 ms is refused
  (`too-fast`), not charged twice; insufficient cash is refused
  (`insufficient`).

### Outfits

- Four looks on the same protagonist — same face, same rig, same
  walk — applied as material colour swaps plus hood/chain
  visibility: Street Hoodie (default, owned), Casual Streetwear
  $300 (teal jacket, jeans, red shoes), Beach Day $250 (coral
  shirt, bare arms and legs, khaki shorts, sandals, hood off),
  Night Out $500 (all black, white shirt, hood and chain off). A
  live 3D turntable preview shows the selected look before buying.

### Collectibles: Sunset Coins

- Ten spinning gold coins with ground rings, all on walkable
  ground: Beacon Tower plaza, two downtown intersections, west
  park (heart + pond), east park (heart + grove), the beach dune,
  the boardwalk, and a residential corner. Walk over one on foot
  to pick it up (radius 2); a gold burst marks the pickup. A 🪙
  chip in the top bar shows the count and opens the collection
  screen.

### The Sunset Sprint

- A foot race down the boardwalk (x=133): start marker at the
  south end (133,90), five checkpoints north to (133,−60),
  35-second limit, $150 on completion. The gold beam-and-ring
  marker moves to the next checkpoint. Fails on the timer, on
  climbing into a car, or on being arrested. Best time and
  completions persist; Retry just dismisses the result screen —
  the next run starts at the start marker (no teleport).

### Persistence

- `vice-city-stories.inventory.v1` (water/snack/energy counts),
  `vice-city-stories.outfits.v1` (owned + selected),
  `vice-city-stories.collectibles.v1` (collected ids),
  `vice-city-stories.sprint.v1` (best time + completions). All
  versioned, all loaded defensively. Cash, missions and the garage
  are untouched.

### Verified (19 Nov 2026, headless Chromium, production build)

- Build passes (tsc + vite). Zero console/page errors across all
  runs.
- Store: collision box present (a teleported player is pushed out
  to the edge); prompt "Enter Sunset Mart"; shop opens; buys
  water/snack/energy ($5,000 → $4,935); a repeat buy within 500 ms
  refused, no double charge; $5 cash refuses a $10 buy; cash +
  inventory persist across reload; E near the GT still enters the
  car.
- Outfits: all four bought and worn; the live character's material
  colours verified in the world (teal #0e7c7b, coral #ff7a5c, black
  #1c1c22); hood hidden on Beach Day (26 → 25 visible meshes),
  hood + chain hidden on Night Out (→ 24); duplicate buy refused;
  selection persists across reload.
- Collectibles: 3 coins picked up by walking over them, counter
  3/10, no double count on re-walking a collected coin, collection
  screen lists all ten with found/missing states, persists across
  reload.
- Sprint: full run through all five checkpoints, +$150, best time
  + completions saved; timer fail and car fail both verified with
  their own screens; dismiss returns to idle.
- Regression: BEACON RUN end-to-end (+$500); garage buy/select
  (Shadow LX $2,000); wanted level 5 pursuit; arrest on foot
  (prompt after the pursuer loops the block — 290 s of test-browser
  time, about 29 s of game time) → F → BUSTED → respawn at
  (0,0,8) with the GT home; traffic 14 and pedestrians 18 active
  at spawn; draw calls 203 at spawn (7C: 193).
- Mobile 390px: shop, outfits and sprint all open from the touch
  button; no horizontal overflow. The top bar now wraps to two rows
  so Missions, Outfits and Pause all stay on screen (the 7D chips
  had pushed Pause off the edge — fixed and re-verified).

### Known limitations

- No natural E-priority overlaps exist in the city, so the priority
  chain is verified by construction and separate cases, not by a
  staged overlap.
- Shop items are keepsakes — no hunger, stamina or usable effect.
- The sprint has no route arrow; the gold marker is the only guide,
  and retry means walking back to the start marker.
- A pursuer that overshoots a stationary player on foot must loop
  the block on the lane graph before it can close in — at 5 stars
  the foot arrest took about 29 s of game time to trigger. On a
  real GPU that is seconds of play, but a stationary player waits
  for the loop.
- No weapons, no combat, no multiplayer — those stay out of
  this phase.

## Phase 8A — combat foundations & weapon system (19 Nov 2026)

Two original, fictional weapons, a target range on the north
beach, and the combat foundation: health, firing, reload and
switching. No hostile NPC faction — the range targets are the
only thing to shoot at in this phase. Note: the Phase 7 scope
note said "no weapons/combat"; this phase explicitly introduces
combat foundations, so the latest spec wins. The spec's Step 3
was cut off mid-sentence, so it was completed as the natural
reading: firing mechanics, hit detection, target feedback and
reload.

### Weapons

- **Palm 9** — compact sidearm, owned from the start. Damage 25,
  semi-auto, 0.3 s between shots, 12-round magazine, 1.4 s
  reload, 45 m effective range, light rounds, $0. Starting
  reserve 60.
- **Vanguard Carbine** — tactical carbine, $1,200 at the range's
  weapon rack. Damage 18, automatic, 0.11 s between shots,
  30-round magazine, 2.2 s reload, 80 m effective range,
  carbine rounds. Starting reserve 120.
- Each weapon is a simple procedural model (gunmetal + one
  accent colour) parented to the protagonist's right elbow, so
  it follows the hand through the walk cycle. No real-world
  weapon names, models or branding.
- Ownership, the equipped weapon and the reserve persist in
  `vice-city-stories.weapons.v1`. Magazines are session state:
  switching weapons refills the new weapon's magazine to full;
  the reserve is what persists. Reload draws from the reserve;
  the rack restocks the reserve for free.
- Range totals (hits / shots) persist in
  `vice-city-stories.range.v1`.

### Sunset Range

- On the empty north beach: firing line (165,−95) shooting
  north; six ring targets in three rows at 15 m / 30 m / 45 m
  (x 160/170, z −110/−125/−140). A hit knocks the board flat
  backward; it pops back up after 3 s. A sand backstop berm
  closes the lane at z −152.
- The sidearm's 45 m range is measured from the camera, which
  sits about 8.5 m behind the player, so the sidearm reaches
  the first two rows and the carbine reaches all three.
- Weapon rack at (156,−90): the E prompt "Open Sunset Range"
  opens the range panel — buy/equip either weapon, restock
  ammo, and see session + all-time accuracy. A canvas sign
  ("SUNSET RANGE / TARGET PRACTICE · EST. 1986") faces south.
- Hit testing is analytical (ray vs sphere / AABB / ground
  plane), no Raycaster. The shot ray runs from the camera
  through the crosshair; tested objects are range targets,
  building footprints and the ground only.

### Combat

- Health 100, shown as a bar bottom-left; regenerates 10/s
  after 5 s without damage. Nothing in this phase damages the
  player, so the health-0 case is unreachable — `damage()` is
  a foundation method for a later phase.
- Firing: left mouse (hold for the carbine, click per shot for
  the sidearm), R reload, 1/2 select a weapon, Q cycle. Touch:
  FIRE (hold), RELOAD and SWITCH buttons. Muzzle flash,
  a tracer line, weapon kick and a gold ✕ hit marker.
- Firing is refused while driving, while a panel is open, while
  a sprint is running, and during arrest / surrender / busted.
  Emptying a magazine starts an auto-reload.
- The walk camera now keeps its orbit around the player but
  pushes the look target 6 m ahead along the camera's forward,
  so the crosshair clears the protagonist's back and can sit
  on a target. The character sits in the lower-middle of the
  frame; movement math is untouched. Recoil adds up to 0.035
  rad of pitch to the walk camera only.

### Verified (19 Nov 2026, headless Chromium, production build)

- Weapons: sidearm starts 12/60, first aimed shot hits and
  knocks the near-left target down, target resets after 3 s;
  manual reload 10→12 drawing 2 from reserve; emptying the
  magazine auto-reloads 0→12 drawing 12; carbine buy $1,200
  (cash 5,000→3,800), equip swaps the model on the hand,
  auto-fire hold fires 5 rounds and drops the far-left target;
  sidearm at the far target fires but does not hit (range
  limit); restock refills the reserve to 60; cash and range
  totals (5 hits / 20 shots) persist across reload; zero
  console errors.
- Locks: no shots while driving, during a sprint, with the
  range panel open, or during an arrest prompt; surrender →
  BUSTED → respawn restores health 100 and firing. Range
  panel buy/equip/restock all work through the panel's own
  buttons. Quality-preset change keeps the weapon attached.
- Mobile 390px: crosshair, ammo and health all render, FIRE /
  RELOAD / SWITCH all work (tap FIRE fires), the range panel
  opens from the touch interact button, no horizontal overflow.
  One real layout bug caught and fixed: the SWITCH button
  overlapped the health bar's number on mobile — the health
  bar now sits above the buttons.
- Regression: BEACON RUN end-to-end (+$500, cash 5,000→5,500,
  complete screen); shop water buy ($10, inventory water 1);
  outfit buy + select (casual-streetwear $300, selected);
  coin pickup (0→1); sprint complete (+$150, cash 5,340);
  garage buy + select (Shadow LX $2,000, selected, cash
  3,340); 5-star arrest → busted → respawn; zero console
  errors; draw calls 136–214 at spawn (tier-dependent).

### Known limitations

- Step 3 of the spec was truncated, so firing, hit detection,
  target feedback and reload are the implemented reading — say
  so if it meant something else.
- Pedestrians and traffic are not hittable in this phase.
- Nothing damages the player yet, so health is a foundation
  only.
- Bullet blocking uses building footprint boxes with a fixed
  30 m height, so a shot over a low roof can stop a little
  early (tracer only). (Fixed in Phase 8B: every box now
  carries its real `maxY`.)
- Magazines reset to full when switching weapons; only the
  reserve persists. (Fixed in Phase 8B: per-weapon magazines
  persist.)

## Phase 8B — enemy AI & combat encounters (19 Nov 2026)

Enemy NPCs and two controlled combat encounters, built on the
Phase 8A weapon system. No rebuild; all missions, cash,
garage, vehicles, outfits, inventory, collectibles and sprint
progress preserved; no save data reset; ordinary pedestrians
and traffic stay non-hostile; no deployment or GitHub push.

### Enemy variations (original, procedural)

- **Yard Enforcer** — health 100, speed 2.2, detection 28 m,
  attack range 22 m, cooldown 1.8 s, damage 10, bandana.
- **Lot Runner** — health 60, speed 3.2, detection 32 m,
  attack range 18 m, cooldown 1.4 s, damage 7, cap.
- **Northgate Lookout** — health 80, speed 2.6, detection 36 m,
  attack range 26 m, cooldown 2.2 s, damage 12, beanie.
- Each is ~12 meshes (legs, torso + vest, head + headgear,
  arms, an original "scrap rifle" in the right hand) with a
  stride-matched gait. Defeated enemies fall flat and fade
  out after 4 s; they take no further damage.

### AI state machine

PATROL (local route) → IDLE → INVESTIGATE (moves toward a
gunshot or last known player position, looks around 3 s, then
back to patrol) → ALERT (0.5 s delay on detection) → ENGAGE
(0.4 s wind-up, then a tracer + damage only if the player is
still in range with line of sight) → SEEK COVER (below 40%
health, 4 s stay, 8 s cooldown) → SEARCH (last known position,
4 s) → DEFEATED. Movement is kinematic with circle-vs-AABB
push-out, so enemies never cross buildings; a 45 m leash
stops them following the player across the city; dormant
encounters cost nothing (enemies invisible, not updated).
Line of sight is a 2D segment-vs-AABB test with a 1.5 m eye
height, so a 1.2 m rack does not block but a 2.5 m berm and
2 m cover objects do.

### Encounter zones

- **South Beach** — centre (165,150), radius 18 m, gold
  boundary ring + "SOUTH BEACH · CREW TURF" sign. 3 enemies.
- **North Dunes** — centre (165,−170), radius 18 m, gold ring
  + "NORTH DUNES · CREW TURF" sign. 3 enemies.
- Both sit on open beach (no mission objective, garage, shop
  or range inside). Entering on foot triggers the fight;
  leaving mid-fight deactivates and resets it, so the player
  can always walk away. No more than 3 active enemies per
  encounter.

### Cover

3 cover objects per encounter (crate stacks / sandbag walls,
~2 m tall, 3.6 m wide) — real collision boxes, so they block
movement and line of sight. Cover points sit on all 4 faces
of each object; the AI picks one where the object stands
between the point and the player, and leaves it when the
player moves.

### Player damage and defeat

Enemy attacks deal their def's damage (7–12) with a 600 ms
damage-immunity window, so three enemies firing at once
cannot delete the player's health in one frame. A red
vignette flashes on damage. Health regenerates 10/s after
5 s without damage. Health 0 is **TAKEN DOWN** (orange
DownedScreen, "Get back up" button) — a separate outcome
from BUSTED: defeat does **not** clear wanted heat, arrest
does. Respawn restores health 100 at the spawn plaza and
resets the active encounter. No damage while a panel is
open, at the shooting range (within 30 m of the firing
line), or while downed.

### Rewards and persistence

First completion per encounter: **+$250 cash** (through the
mission manager, the single cash source) + free ammo
restock. Replays are allowed after a **3-minute wall-clock
cooldown** and pay **ammo only, no cash** — no farming.
Records persist in a new key `vice-city-stories.encounters.v1`
(`{ completed, lastCompletedAt }`), separate from mission
progress.

### Wanted integration

Defeating an enemy in a public encounter adds **+8 heat**;
firing inside an active encounter adds **+4 heat once per
activation**. Range shots add no heat. Police stay a separate
system that simply reacts to the heat — they pursue after an
encounter ends. No second wanted system, no duplicated police
logic.

### Phase 8A limitations fixed

1. **Per-weapon magazines persist** — `mags` now lives in
   `vice-city-stories.weapons.v1`; switching no longer
   refills. An 8A save without `mags` loads every weapon full.
2. **Accurate building obstruction** — `BuildingBox` gained
   optional `maxY`; all 84 boxes carry their real height
   (plots, tower 54, garage 7, shop 6, range berm 2.5 /
   rack 1.2 / sign 3, water wall 30). The bullet ray uses
   `box.maxY ?? 30`.
3. **Regen responds to real damage** — enemies now actually
   call `damage()`; verified live (70 → 100 after 60 s).
4. **Weapon attachment** — re-verified visually in the
   encounter screenshots; the weapon stays in hand while
   walking and firing.

### How it was verified (live, headless Chromium, 19 Nov 2026)

- qa76: South Beach trigger (3 active, all alert on entry);
  detection alert → engage; enemy attack 100 → 90 (−10 =
  Yard Enforcer); player shot hits (100 → 75); defeat
  (50 → 25 → 0, via cover at 25); cover observed (Lot
  Runner at health 10); search observed (enemy behind the
  north crates). Zero console errors. Draw calls 95 with
  enemies active (Low tier in the QA browser).
- qa76b/qa76c: patrol (0.8–1.1 m in 12 s real at QA sim
  speed); investigate — one real bug found and fixed: Combat
  passed the **camera** position to `onShot` and the camera
  sits 8.5 m behind the player, so a 38 m shot fell outside
  the 40 m hearing radius; the engine now uses the player's
  position. Full investigate cycle verified (shot 5 m away →
  all 3 investigate → target returns to patrol).
- qa77: building heights 84/84 carry `maxY`; South Beach
  first completion (+$250, cash 5,000→5,250, cooling,
  completedOnce); persistence across reload (cash 5,250,
  cooldown counting down); wanted after encounters (level 1,
  heat 20, pursuit, one police unit pursuing); range safety
  (2 aimed shots, heat 0 → 0); player defeat (downed overlay
  → respawn, health 100, back at (0,8)); regen (70 → 100);
  per-weapon magazines (sidearm 9 → 6 after 3 shots, carbine
  30 → 28 after 2, sidearm still 6 on switching back,
  persisted `{palm-9: 6, vanguard-carbine: 28}`).
- qa77b: South Beach replay cleared with **cash unchanged**
  (5,000 → 5,000, ammo only). North Dunes first completion
  failed twice in the clear loop — a test-timing artefact,
  not a game bug: the QA browser's ~1 FPS sim speed let
  enemies move ~2.8 m between aim and fire, and the sidearm's
  0.3 s sim cooldown is ~3.5 s real there, so shots were
  refused or went stale.
- qa77d (diagnostic): per-shot log proved the shooting works
  at North Dunes (hits at aim miss 0.002; a shot refused by
  the cooldown; a miss on a cover-moving enemy) and the
  completion logic is sound.
- qa77e/qa77f: North Dunes first completion verified — cash
  5,000 → 5,250, status cooling, completedOnce, toast
  "NORTH DUNES CLEARED — +$250 · ammo restocked", banner
  "⚠ NORTH DUNES — 3 hostiles left". A direct manual call to
  the engine's private `updateEncounters` completed it
  instantly, proving the logic; the automatic tick just
  needed more frames (the QA browser renders ~1 frame per
  2–3 s real), so the test now waits 10 s after the defeat.
- qa78 regression: encounters dormant at spawn, 0 enemies
  active, pedestrians 18, traffic 14; BEACON RUN end-to-end
  (cash 12,000→12,500); mission board lists all 5 with the
  correct unlock chain; shop water ($10, inventory water 1);
  outfit buy + select (casual-streetwear $300, selected);
  coin 0→1; sprint complete (+$150); garage buy + select all
  three cars (Shadow LX $2,000, Vortex RS $3,500, Trailhawk X
  $2,800; all 4 owned, cash 4,040); arrest → busted →
  respawn (wanted cleared); draw calls 224 at spawn, 108 at
  end; zero console errors. One test-aim miss: the qa78 range
  shot used yaw only (no pitch correction), so it fired but
  missed — hit detection itself was proven in qa73/qa74/qa77.
- qa78m mobile 390px: crosshair, ammo, health, FIRE /
  RELOAD / SWITCH all visible (health clear of the buttons);
  tap FIRE fires (shots 0→1); encounter banner visible
  ("⚠ SOUTH BEACH — 3 hostiles left"); scrollWidth 390, no
  overflow; zero console errors.

### Known limitations

- The North Dunes "failure" in qa77b/qa77c was a QA-browser
  timing artefact (slow sim speed), not a game bug — the
  completion is verified in qa77e. On a real machine the aim
  and the shot land in the same frame, so enemies do not get
  ~3 s to walk away between aim and fire.
- Line of sight is a 2D footprint test with a 1.5 m eye
  threshold, not a true 3D raycast; a tall thin object can
  block a shot its top would not, and vice versa.
- Enemy hit test is a chest sphere (radius 0.55), not
  per-limb; a shot past an outstretched arm still counts.
- Investigate's give-up leg was verified via a close shot
  (qa76c); at a real-shot distance (38 m) the enemy was
  still walking toward the shot position when the poll ended
  — correct behaviour, just slow at QA sim speed.
- On mobile the encounter banner (top centre) overlaps the
  quality chip / coin counter in the top HUD row — cosmetic
  only; the banner stays readable and no button is blocked.
- Pedestrians and traffic remain non-hittable, by design.

## Phase 8C — combat contracts & advanced encounters (19 Nov 2026)

Two optional combat contracts, listed in a new COMBAT
CONTRACTS section of the mission board. They do not touch
the five-mission unlock chain.

- DOCKSIDE TROUBLE — from Rook Calloway, at the South Docks
  (0,170), radius 18. Elimination: defeat 3 hostiles (Yard
  Enforcer, Lot Runner, Northgate Lookout). Reward $800.
- HOLD THE LINE — from Mara Voss, at Mid-Beach (165,0),
  radius 18. Defense: three waves against a supply beacon.
  Wave 1: Runner + Enforcer; wave 2: Lookout + Runner +
  Enforcer; wave 3: Enforcer + Enforcer + Lookout. 8 s
  recovery between waves. Reward $1,200.

Flow: accept from the board, then step inside the gold ring
on foot to start. Leaving the ring mid-fight resets the
attempt (back to accepted, wave 1). Abandon from the HUD
returns the contract to dormant. TAKEN DOWN during a
contract, or the beacon reaching 0 health, fails it — both
are re-acceptable immediately, no cooldown. First clear
pays full cash through MissionManager plus an ammo restock;
replays after a 180 s wall-clock cooldown pay ammo only.
State persists in `vice-city-stories.contracts.v1`
(`{completed, lastCompletedAt}`); the range stays safe and
both 8B encounter reward rules are unchanged. Wanted: +8
heat per enemy defeated, +4 once per activation for firing
inside an active contract.

Protected objective: a supply crate with a pulsing orange
beacon at (165,0), health 100, a visible bar in the HUD.
Enemies within 4 m attack it for 4 damage per hit; the
beacon flashes red on a hit, goes dark and tips over at 0,
and resets to full on retry. It cannot be damaged outside
its active contract.

Line of sight (Step 5): upgraded from the 2D footprint test
to a full 3D segment-vs-AABB slab test against the real
collision boxes (buildings + cover + the beacon itself),
reusing real `maxY` heights. A 1.2 m range rack no longer
blocks sight; 2 m cover and buildings do. Enemy eye height
is 1.5 × enemy height, player chest 1.2. The test runs only
for enemies that are active and within detection range.
When an enemy cannot see the player it advances on the
objective instead of searching blindly. Bullet blocking was
already 3D since 8B.

Wave manager: `Contracts.ts` owns the wave clock. Defense
enemies are pre-spawned dormant (one encounter id per wave);
one wave activates at a time, at most 3 active per
contract. A wave clears only when every enemy in it is
defeated; the next wave starts after the 8 s recovery.
Failure, abandonment, leaving or completion clears all
encounter state, so no enemy leaks into free roam.

Contract HUD (left, under the mission card; bottom on
mobile): name, reward, objective line, hostiles left, wave
n/3 plus the recovery countdown, the beacon health bar, and
an Abandon button. It hides while a panel is open and when
no contract is accepted or active. Completion/failure
toasts name the contract and the cash (only on a first
clear).

New files: `src/game/Contracts.ts` (definitions, zone
rings/signs/cover, objective visual, status machine, wave
clock, objective health, persistence), `src/components/
ContractHUD.tsx`. Modified: `Enemies.ts` (3D LOS,
`onObjectiveDamage`, `setObjective`/`clearObjective`,
advance-on-objective in patrol/engage), `GameEngine.ts`
(contracts handle, `contractShotHeat`, `getContractState`,
`acceptContract`, `abandonContract`, `completeContract`,
`failContract`, `resetContractEnemies`, `updateContracts`,
respawn/quality/dispose wiring), `MissionBoard.tsx`
(contracts section), `GameCanvas.tsx` (ContractHUD wiring),
`global.css` (contract HUD + board section styles).

Verified live (qa79e, qa80, qa80b, qa81, qa81m/qa81m2,
headless Chromium, production build, zero console errors):
DOCKSIDE TROUBLE clears end-to-end (cash 5000→5800, cooling
180 s, toast, persistence across reload, replay blocked
during cooldown); HOLD THE LINE clears all three waves
(wave 1 → 8 s recovery → wave 2 → wave 3, cash 5000→6200);
the beacon takes real damage (100→96 while a north enemy
advanced on it, blocked from seeing the player by the
beacon itself); destroying the beacon fails the contract and
resets it to 100 on retry; TAKEN DOWN fails the contract and
respawn returns to free roam; abandon and leaving the ring
both reset cleanly with no leftover enemies; the 2 m crate
blocks an enemy's sight (it stayed idle/patrol, never
alert/engage); BEACON RUN, shop, outfit, coin, sprint,
garage (all 4 cars), both 8B encounters (+$250 each),
weapon switching with per-weapon magazines, and the arrest
cycle all still work; mobile 390 px shows both HUDs with no
overflow and the touch FIRE button fires. Draw calls 146 at
spawn, 232 with a contract active, 112 at the end of the
regression run.

Known limitations: LOS is an analytical segment-vs-AABB
test against collision boxes, not a Three.js Raycaster
against meshes; the enemy hit test remains a chest sphere;
the dockside zone has buildings at its edge on the Ultra
tier (spawns and cover are nudged clear at creation); the
first qa79 clear run failed on a test bug (a bare tryFire
silently no-ops inside the sidearm's 0.3 s sim cooldown —
about 3.5 s real at QA speed; the robust retry-until-shots-
increment version cleared it, and qa79d proved 6/6 hits);
repeated aimed shots from a fixed spot at Mid-Beach clip
the 1.6 m beacon box, so the QA wave clears used
damageEnemy after one real shooting kill — in real play the
player repositions for a clear lane. Not deployed; no
multiplayer.

## Phase 9B — story campaign core, Chapter 1 (19–20 Nov 2026)

Story mode, built beside the job missions rather than inside
them. A new `StoryCampaign` handle sits next to `missions` in
the engine, with its own definitions, progress, board and HUD,
and its own save key `vice-city-stories.story.v1`. The five
job missions, the two contracts, the garage, the economy, the
combat and all existing save data are untouched.

Chapter 1, "The Wrong Package", is playable end to end:
1.1 FIRST LIGHT (Mara Voss, (66,6), 60 s, $500) — talk to
Mara, get in the Velocity GT, pass the halfway checkpoint
(0,−90, +15 s), deliver to Beacon Tower (0,−165). 1.2
DOCKSIDE STATIC (Rico Hale, (−126,156), 120 s, $750,
startHeat 10) — crate to the beach (165,90), then evade to
the hideout (180,−30). 1.3 SIGNAL LOST (June Park, (−90,60),
untimed, $600) — collect three clues (east park (90,−60),
boardwalk (133,30), tower (0,−165)) and return to June, plus
an optional fourth clue at the garage door (22,40, +$100,
once per save). Sequential unlock; chapter completes when
its last mission does. Rewards go through the single shared
cash balance; completing a mission sets its flags
(mara-trust, package-was-wrong, ledger-found, june-trust).

One global active activity: a job, a story mission or a
contract can never run at once. The per-tick guard
(`applyActivityGuard`) blocks each subsystem while a
different one is active, and the accept path checks the
guard live (`tryMissionInteract` / `tryStoryInteract`
re-read `getActiveActivity()`), because a contract flips to
active late in the tick, after the per-tick guard has run —
a one-tick window that let a second start slip through
until the live check closed it. Contracts accept from the
board while another activity runs, but their zone start is
refused until it ends.

Checkpoints are session-only snapshots taken when a
checkpoint-flagged objective completes, storing the next
objective index, player and vehicle positions and headings,
time left, collected and defeated ids, and flags. Three
bugs were caught by QA and fixed: the snapshot was taken
before the index advanced, so retrying re-completed the
checkpoint objective and paid its time bonus twice; the
player position came from the (stale) player handle while
driving, teleporting the retry back to where the player got
in the car; and the heading came from camYaw, which does
not track the car's facing (it read 0 while the car faced
north), sending the retry driving south. The snapshot now
uses the vehicle position and a new `vehicleHeading` field
on the mission context while driving. The garage clue was
moved from the building centre (22,52) to the door (22,40):
collision pushes a player teleported inside the garage to
(22,44.4), 7.6 m from the clue and outside its 6 m radius.

Dialogue objectives are a stub in 9B (one line shown as a
flash on E); `defeat` / `defend` / `follow` types exist but
are not evaluated until 9E. Encounters (8B) sit outside the
global guard by design. Checkpoints do not persist across
reloads.

Verified live (qa82, 19–20 Nov, zero console errors):
Part A — 1.1 end to end, +$500 exactly, flags saved.
Part B — forced timer failure after the checkpoint, retry
restores the deliver objective, the checkpoint time and the
checkpoint position, then completes for +$500 exactly once.
Part C — all five guard directions (job→story, story→job,
job→contract, story→contract, contract→story/job blocked
flags). Part D — 1.3 end to end, optional garage clue +$100,
downed failure, checkpoint retry keeps 2 clues, completion
+$700 total (600 + 100), replay pays $0 for the garage clue
again. Regression (qa81): BEACON RUN, shop, outfits, coins,
sprint, garage, range, carbine, both encounters (+$250 each),
both contracts, arrest → busted → clean respawn, zero
console errors. Mobile 390 px: story board (358 px wide)
and story HUD (250 px) fit with no horizontal overflow.
Not deployed; no multiplayer.

## Phase 9C — reusable story dialogue system (20 Nov 2026)

The 9B dialogue stub is now a real data-driven system. Dialogue
content lives in `StoryDialogue.ts`, separate from presentation:
three conversations for Chapter 1, each a graph of nodes with a
speaker, text, up to three player choices, optional branching,
flag conditions, and events that fire on node entry. A validator
runs once at construction and checks that every id is unique,
every next/choice target resolves, exactly one end node exists,
the end node carries an event and no condition/next/choices,
no node has both a next and choices, and every speaker is a
known character; unreachable nodes are warnings, the rest are
errors that refuse the dialogue. The runtime (`Dialogue.ts`)
supports start, advance, choice, skip and end, with a 120 ms
transition floor so a double press can only ever advance one
step, a bounded condition-skip chain, and an exactly-once rule
for events — the end node's `completeObjective` event is what
accepts the mission, and a second call is a no-op. The panel
(`DialoguePanel.tsx`) is a bottom-anchored teal card in the
game's own style: portrait medallion with the speaker's initial
in their character colour, name plate, typewriter reveal
(~33 ms/char, first press completes the line, second advances),
numbered choice buttons that appear only once the line is fully
revealed, Skip (Esc), and a Continue button. The engine pauses
while a dialogue is open, so timers cannot tick and no other
activity can start; `GameEngine.start()` also clears stale
one-shot input queues, so an E pressed mid-dialogue cannot
fire on resume. E at a story marker now opens the
conversation instead of accepting instantly, and the mission
accepts only when the end node's event fires; if a dialogue
fails to start, the campaign falls back to the 9B accept-plus-
flash behaviour. Dialogue plays on first accept only — retry
and replay skip the conversation, as in 9B.

Chapter 1 conversations: Mara (`mara-first-light`) introduces
the package and the 60-second tower run; her second line offers
three choices, and asking "What's in the package?" sets the
flavour flag `mara-asked-package`. Rico (`rico-dockside-static`)
develops the dockside mystery; asking "Watching? Who?" sets
`rico-asked-watcher`. June (`june-signal-lost`) develops the
ledger discovery; her fourth line has two conditional variants
that appear only when the matching choice flag was set earlier
in the save — the Mara callback line when `mara-asked-package`,
the Rico callback line when `rico-asked-watcher` — and asking
about her source sets `june-asked-source`. Choice flags are
flavour only and persist once set; progression flags
(mara-trust, package-was-wrong, ledger-found, june-trust) are
still set only by mission completion, and all dialogue state
persists in the existing story save key — no new save keys,
no migrations. Events are limited to the five 9C types
(setFlag, giveCash, startStoryMission, completeObjective,
setWanted); cinematics, spawnEncounter, giveVehicle and
giveOutfit are deliberately left for 9D/9E.

One real bug was caught by QA and fixed: the Missions HUD
button stayed visible and clickable during dialogue, because
the engine stops but GameCanvas's React `paused` state was
never set — opening the board over a conversation and closing
it would have resumed the engine mid-dialogue. Dialogue now
drives the same `paused` flag as panels, so every HUD button,
prompt and HUD hides while a conversation is open.

Verified live (qa83, 20 Nov, zero console errors): Part A —
1.1 end to end through the full Mara conversation, double
advance moves exactly one node, choice 2 sets
`mara-asked-package`, end event accepts with 60 s on the
clock, checkpoint retry skips the dialogue, +$500 exactly.
Part B — 1.3 end to end with Skip mid-typewriter (dialogue
closes, mission active, ledger-found not set), +$600, reload
keeps all six flags and pays nothing twice. Part C — guard:
second interact while open is a no-op, advance/choice on a
choice node ignored, invalid choice index ignored, stale E
cleared on resume, unknown dialogue id refused, validator
reports no errors and no warnings. Part D — 1.2 end to end
through the Rico conversation, choice 1 sets
`rico-asked-watcher`, startHeat 10 applies on accept, beach
delivery, hideout, evade clears, +$750 exactly. Part E —
June's conditional lines appear with both choice flags and
are skipped without them. Regression (qa81): BEACON RUN,
shop, outfits, coins, sprint, garage, range, carbine, both
encounters (+$250 each), DOCKSIDE contract active, arrest →
busted → clean respawn, zero console errors. Mobile 390 px:
dialogue panel 370 px wide (10–380 of 390), no horizontal
overflow, touch Start button opens the conversation, choices
tap through to the right branch. Not deployed; no multiplayer.

## Phase 9D — reusable cinematic system (20 Nov 2026)

Chapter 1 now opens with a short skippable cinematic before
each conversation. The system is data-driven: a cinematic is
a list of shots in `StoryCinematics.ts`, each with a camera
position and look-at target, optional end poses for drift,
a duration, an optional narration line, an optional dialogue
to open mid-shot, and an optional gameplay event — the same
five event types as dialogue (setFlag, giveCash,
startStoryMission, completeObjective, setWanted), so one
event vocabulary serves both systems. A validator mirrors
the dialogue one: duplicate ids, empty shot lists,
non-positive durations, unresolvable refs, a shot following
a character that is not staged in the same cinematic, and
an unknown dialogue id are errors that refuse the scene;
a `completeObjective` event inside a cinematic and a scene
that stages nobody are warnings. The runtime
(`Cinematic.ts`) plays shots in sequence, blends 0.8 s
between shots and 1.2 s in from the live gameplay camera,
interpolates each shot's pose with a smoothstep over its
duration, and fires each shot's event exactly once on shot
entry. It reuses the existing orbit/chase camera — there
is no second camera. While a scene plays, the engine keeps
ticking so the camera can move, but gameplay is frozen:
player and vehicle, police, wanted, arrest, missions, the
activity guard, story, collectibles, combat, sprint,
enemies, encounters, contracts and the downed check are all
gated off, look drags and every one-shot input queue are
discarded each tick, and all five try* interact paths
refuse. Crowd, traffic, the range, ocean and signals keep
moving, so the city stays alive behind the letterbox.
`updateCamera` applies the cinematic pose directly while
a scene is active and remembers it; on close, the normal
path blends back from that pose to the live orbit/chase
pose over 0.8 s, with camYaw/camPitch untouched throughout,
so the camera resumes exactly where the player left it.

Character staging (`CinematicStaging.ts`) builds a staged
actor from the shared `createCharacter` rig, recolours it
from a per-character palette in `StoryCharacters.ts` (Mara
teal, Rico rust, June violet), names it `staged-<id>`, and
animates it with the existing `CharacterAnimation` (idle
breathing; an optional walk-to is supported). Actors stand
2 m from their marker so they never clip the player, and
are fully disposed on cleanup — about 22 meshes each,
temporary only, no permanent draw calls. The engine
`tick()` calls `cinematic.update(dt)` early and the
overlay (`CinematicOverlay.tsx`) renders letterbox bars,
a title card on shot 0, narration keyed by shot, progress
dots, and a Skip button (hidden while a dialogue is open;
Esc is gated the same way). Skip fires every unfired shot
event in order and then cleans up, so a skip can never
skip a story event; it is refused while a dialogue is
open, with a console warning. Cleanup is one idempotent
path for complete, skip and dispose: staged actors are
disposed, state clears, `onComplete` fires exactly once
(never on dispose). The campaign plays the cinematic
first on E at a story marker (Pattern A) and opens the
9C dialogue when it ends, complete or skipped — so the
mission still accepts only through the dialogue's end
event. The intro plays on first accept only, tracked per
run and cleared on reset/cancel/continue/dismiss/select,
so checkpoint retry and replay never replay it. Pattern B
(dialogue inside a shot) is supported too: a shot's
dialogue pauses the scene, the engine stops while it is
open, and the scene resumes when it closes.

Chapter 1 scenes: FIRST LIGHT (`cine-first-light`, Mara
staged at (68,6)) — wide avenue, Mara medium, GT and
tower, narration "Sunset City. One package. Sixty
seconds.", event `saw-first-light-intro`. DOCKSIDE STATIC
(`cine-dockside-static`, Rico at (−124,156)) — wide
docks, Rico medium, dock street, event
`saw-dockside-intro`. SIGNAL LOST (`cine-signal-lost`,
June at (−88,60)) — wide park, June medium, then a close
shot that opens the narrative-only dialogue
`june-cine-signal-lost` (two lines, end event sets the
flavour flag `june-cine-seen`), event `saw-signal-intro`.
All camera poses sit in probe-verified open places
(roads, spawn plaza, west park). A QA hook,
`cinematic.setTimeScale(n)` (0.1–20, default 1),
multiplies dt inside `update()`; it exists because QA
sim time runs at ~5–15% of real time.

QA found no game bugs in 9D, but three test-script
mistakes were caught and fixed along the way: choices
clicked before the typewriter finished (choices render
only once the line is fully revealed), the 1.2 beach
drive cutting diagonally through buildings (waypointed
along roads; the police-wedge fallback stays), and a
skip attempted on shot 2 of `cine-signal-lost` — which
is the embedded-dialogue shot, so the dialogue opens on
entry and a skip there is correctly refused; the test
now skips at shot 1. Two more were found in the 9C
regression helper: it returned at the first open
dialogue, which for 1.3 is the embedded one, and then
skipped the main dialogue while waiting for it — it now
waits for the scene to end first and only skips a
dialogue seen while the scene is still active.

Verified live (qa84 A–E + B2, mobile, 20 Nov, zero
console errors): Part A — 1.1 natural play, camera
moves between shots, staged Mara present then gone,
intro flag set, dialogue follows, checkpoint retry,
+$500 exactly, restore blend finishes with camYaw
unchanged. Part B — 1.2 skip at shot 1, intro flag
still set, Rico dialogue opens, mission active with
heat 10. Part B2 — 1.3 skip at shot 1, embedded
dialogue never opens (`june-cine-seen` false), main
dialogue opens, all three clues, +$600, cash 6350
exactly. Part C — embedded dialogue inside the scene:
engine stops, Skip hidden, skip refused while open,
flag set, scene resumes, main dialogue follows, mission
active. Part D — guard: no second accept, no HUD
buttons but Menu, no Start button or prompt, camYaw
frozen, stale E cleared by the next tick, dialogue
completes to active. Part E — forced failure, checkpoint
retry restores obj 4 with 70 s and no cinematic replay,
+$500 once, replay restarts at the reach objective and
the dialogue objective auto-skips with no cinematic and
no dialogue. Regression (qa81): BEACON RUN, shop,
outfits, coins, sprint, garage, range, carbine, both
encounters (+$250 each), contract active, arrest →
busted → clean respawn, zero console errors. Regression
(qa83 A, B, D): 1.1 end to end with the cinematic in
front, double-advance guard, choice flags, 1.3 skip
accepts with reload persistence, Rico choice 1 sets
`rico-asked-watcher` with heat 10 (the 1.2 beach drive
hit the known autopilot wedge, as in qa84 B's first
attempts — the dialogue and accept are proven, the
drive is 9B territory already covered). Mobile 390 px:
touch Start opens the scene, letterbox/narration/Skip
fit inside 390 with no horizontal overflow, Skip tap
opens the Mara dialogue, panel 370 px. Not deployed;
no multiplayer.

## Phase 9E — story campaign expansion: Chapters 2 and 3 (20 Nov 2026)

Chapter 1 is untouched — same story, rewards, flags,
dialogue, cinematics and progression. Chapters 2 and 3
extend the existing campaign, not a second system.

Chapter 2, TWO CREWS, ONE CITY, four sequential
missions. 2.1 TAIL SPIN ($1,000, Vic Marino): a new
follow objective — stay 8–35 m behind the teal sedan
for 500 m of its route, too close for 3 s and it spots
you, too far for 5 s after locking on and it is gone.
2.2 HOLD THE LINE ($1,200, Mara Voss): a defend
objective reusing the HOLD THE LINE contract's beacon
and cover — three waves against the supply beacon at
(165,0), 100 HP, 8 s recovery between waves — and it
grants the crew-jacket outfit, a story-only unlock the
shop can never sell. 2.3 DOCKSIDE TROUBLE ($800, Rook
Calloway): a defeat objective against the three
dockside hostiles, with a real choice — take Rook's
job (+$200 on the spot, `took-rooks-job`) or refuse it
(`refused-rook`). The choice changes the closing
dialogue and, in 3.1, how much June's contact tells
you: exact spots with distances shown on the HUD when
you refused, neighbourhoods only with distances hidden
when you took the job. 2.4 THE LONG WAY OUT ($1,500,
Dana Cole): a timed evade run at heat 45 to the
hideout at (180,−30), closing with the chapter outro
cinematic.

Chapter 3, THE LEDGER, three sequential missions. 3.1
DEAD DROP ($900, Milo): three collects — west park,
garage door, tower — gated by the Rook choice above,
closing with Lena Ortiz. 3.2 CRANE'S NEST ($2,000,
June Park with Theo Ashford): reach the warehouse,
defeat two nests of three, collect the ledger,
return — with a checkpoint between the nests, and the
mission grants the Vortex RS (no purchase, no
prerequisite car). 3.3 SUNSET RUN ($2,500, Mara Voss):
120 s at heat 70, deliver the ledger to Beacon Tower
in the Vortex RS, then the finale: a five-shot
cinematic with a dialogue inside it, and a choice
between two endings — give the ledger to Mara or to
June. Each ending has its own final dialogue and
outro cinematic, both complete the campaign, the
ending persists in the save and shows on the board,
and replaying 3.3 can flip it. Campaign total:
$11,750 plus the crew-jacket outfit and the Vortex RS.

New systems, all reusing existing ones. The campaign
gains three evaluators — defeat (polling the encounter
system's live enemy ids against the callback-fed
defeated set, so a dormant enemy never counts),
defend (an in-campaign wave machine: fighting, 8 s
recovery, beacon destroyed fails the mission) and
follow (driving the campaign's own MissionVehicle
through the existing follow evaluator) — plus
mid-mission dialogues that complete objectives through
the dialogue-complete path, and vehicle/outfit grants
that are idempotent (a replayed grant never duplicates
a car or an outfit). Cleanup on cancel, retry, replay,
complete and fail deactivates and resets the mission's
encounters, clears wave objectives, resets the beacon
and stops the tail car, so no run leaks state into the
next. One global active activity still holds. The
dialogue skip guard: Skip is refused at any choice
node (panel hides the button, Esc is gated, the
runtime refuses too), so a consequential choice —
Rook's job, the finale — can never be skipped past.
The same save key (`vice-city-stories.story.v1`) is
kept; loading reconciles old saves, so a 9D-era
Chapter-1-complete save unlocks Chapter 2 without
resetting cash, garage, outfits, inventory,
collectibles, jobs, contracts or combat.

Verified live (20 Nov, zero console errors): probe —
dialogue and cinematic validation clean, a seeded
9D-era save unlocks Chapter 2 with Chapter 3 locked,
all markers, spawns and staged points clear of
buildings, story encounters dormant at spawn. qa85
A–E — TAIL SPIN follow with spotted/lost failures,
HOLD THE LINE all three waves plus the beacon-destroyed
failure path, DOCKSIDE TROUBLE both branches ($200
only on take, refused-tip line only on refuse), THE
LONG WAY OUT at heat 45 with the chapter outro on
Continue. qa86 A–E — DEAD DROP both branches
(distances shown on refuse, hidden on take), CRANE'S
NEST checkpoint retry restoring the second nest,
Vortex RS granted and selected, SUNSET RUN ending
Mara, ending June, and the replay flip: June, then
replay to Mara, cash 7500 → 10000 (+$2,500 exactly
once), ending flipped in the save, Vortex RS still
owned once. Two test bugs found on the way: the
replay looked for the Vortex RS at the garage bay
while the June run had left it at the tower (the
player got busted on foot at heat 70), and the first
E press after the board sequence takes ~3.6 s to clear
at 2 FPS in the test browser — both fixed in the
tests, no game change. Mobile 390 px: all three
chapter headings and all ten missions on the board,
no overflow, touch Start reads "Start TAIL SPIN",
cinematic and dialogue fit, Skip hidden at the Vic
choice node. Regressions (qa83 A–E, qa84 A–E, qa81):
Chapter 1 dialogue, all cinematics, jobs, shop,
outfits, coins, sprint, garage, range, carbine, both
encounters, contracts, arrest → busted → clean
respawn — all green after two more test fixes (the
checkpoint-retry click raced the failed overlay
rendering; the choice click landed before the choices
rendered). Draw calls: 152 at spawn (9D: 148),
247 with a contract active (9D: 237), 112 at end
(unchanged) — no permanent increase. One pre-existing
wart surfaced, not a 9E change: in 1.2, parking at
the hideout while the tail keeps sight never clears
the heat, so the timer runs out — the tail has to be
lost first (the mission does complete end to end,
$5750, proven by the instrumented run). Not deployed;
no multiplayer.

## Phase 9F — full campaign QA, polish and stability (20 Nov 2026)

No rebuild, no new systems, no new chapters, missions,
characters, multiplayer or dependencies. This phase
verifies the whole campaign as built through 9E, fixes
what the verification finds, and stops. Critical, High
and Medium findings were fixed; Low findings only when
safe and clearly worthwhile. All existing content and
saves are protected — no destructive migrations, no
save resets.

Story continuity audit first: every dialogue line,
cinematic narration, definition, HUD string and board
label, read against the character bible and the
chapter flow. Sixteen findings, none Critical: six
High, five Medium, five Low. What passed clean — no
placeholders, no duplicated lines, no missing speakers,
no premature naming of the ledger, Vera, Northgate,
the Vortex RS, the crew jacket or Silas, all
conditional branches reachable, the Rook and finale
flags exactly-one, both endings complete and distinct.

The fixes. High: Dana's line in 2.4 credited Vera
with hiring Kai — Mara hired him in 1.1, so the line
now says Vera set up the package job; Rook's refuse
choice no longer presumes Vera's money before the
reveal; Milo's refuse-branch line now gives the exact
drop spots, matching the HUD that shows distances in
that branch; both evade objectives (1.2 and 2.4) and
the evade hint now say to lose the tail first, and
Dana's and Rico's lines say the same — the wording
around the known 1.2 wart, the mechanic unchanged;
the follow hint and Vic's line warn about losing the
tail, not just being spotted; both ending narrations
name the ledger, not the package. Medium: the
never-introduced "Kings" are gone from Mara's 3.3
intro, which now states the two-minute clock; June's
line pays off with the ledger's location, not the
undelivered package reveal; the first-light
cinematic narration no longer duplicates Mara's line;
objectives that advance a checkpoint now flash
CHECKPOINT SAVED (only 1.1's checkpoint keeps its
CHECKPOINT +15s flash); the board and the complete
screen now say replaying Sunset Run can change the
ending. Low: the finale narration, the sunset-run
narration, Vic introducing Sana at the food truck,
and a dead flag (`june-asked-source`) removed. One
Low deliberately not fixed: the `target-escaped`
branch in the failed screen is unreachable — the
campaign only ever fails with timer, busted, downed,
objective-destroyed, lost or spotted — but it is
harmless as a defensive branch.

Two findings from the live QA run. Bug #1 (Medium):
the 2.2 HOLD THE LINE intro cinematic
(`cine-hold-line`) was fully defined and its
`saw-hold-line-intro` flag existed, but the
`talk-mara-beach` objective carried no
`cinematicId`, so the accept trigger — which needs
both a cinematic and a dialogue — opened Mara's
dialogue directly and the scene could never play.
Fixed with one field in `StoryDefinitions.ts`. Bug
#2, as reported, was a replayed ending's outro not
recording its `saw-ending-*` flag — the live probe
refuted it: the flag was read before the outro
played, not after. Replaying 3.3 to the June ending
and letting the outro finish sets `saw-ending-june`
and keeps `saw-ending-mara`, and both survive a
reload. Two more small fixes from the same run: the
tail-spin narration said four hundred metres for a
500 m route; the chapter-2 outro shared its title
with the 2.4 mission. And two polish fixes: the top
HUD bar (title, FPS and quality chips, coins) now
hides during cinematics instead of peeking below the
letterbox bar at 390 px, and a corrupted save with
`missions: null` can no longer show a chapter
complete while its missions are not — chapter
completion is now derived from the missions for
every chapter, while unlocks keep the never-downgrade
rule.

Verified live (20 Nov, zero console errors). Two
full playthroughs in a real browser: fresh save, all
ten missions, finale Mara then replay to June, cash
0 → 14,550; Chapter-1-complete save, Rook refused,
finale June then replay to Mara, cash 5,000 →
17,400. Save audit: seven situations (fresh, each
chapter complete, both endings, mid-mission reload)
and eight malformed saves (missing version, unknown
chapter, corrupted JSON, 9D-era save, unknown
current mission, missing cash key, empty story key,
`missions: null`) — all boot clean with no crash
and no lost progress. Checkpoints and cleanup:
timer-fail retry restores the checkpoint and the
clock, 3.2 retry restores the second nest, beacon
destruction fails and retries at full health and
wave one, abandoning a mission clears its tail car
and enemies with no double reward, cinematic skips
land in the right dialogues, the one-activity lock
holds, TAKEN DOWN during 2.3 fails cleanly with no
enemies left standing. Performance: 152 draw calls
at spawn, 247 downtown, 308 at most during a 2.2
defend wave; five cinematic start/exit cycles leave
heap delta 0 MB and no staged meshes behind.
Regression (qa81 as-is): jobs, shop, outfits, coin,
sprint, garage, range, carbine, both encounters,
contracts, arrest → busted → clean respawn — all
green. Mobile 390 px: the cinematic header fix
verified (no HUD bar during the scene, no
overflow), shop, range and sprint panels open and
close cleanly with no overflow, garage and outfits
render cleanly, BUSTED fills the viewport and
respawns. Verified after the fixes, again live: the
2.2 intro plays, its flag sets, Mara's dialogue
opens at h1, accepting starts the defend objective
at Beacon 100/100 Wave 1/3.

Honest limits, stated plainly. The headless test
browser runs sim time at roughly a tenth of real
time, so the two playthroughs used named
controlled-setup fallbacks: the 2.1 follow used the
debug hook, the 2.4 evade finished via `setHeat(0)`
after the heat decayed for real for 240 s without
reaching zero, 1.2 used a beach-drive teleport, and
enemy kills used `damageEnemy` — aiming at 2 FPS
is not a shooting test. The pre-existing 1.2 wart
stands: parking at the hideout while the tail keeps
sight never clears the heat; the wording now says
to lose the tail first. The carbine magazine
occasionally reads 26 after five shots, a
pre-existing flake, not a regression. FPS reads 1
in headless SwiftShader and is not a real
measurement; draw calls are the metric. TAKEN DOWN
at 390 px was not observed within 300 s — the
desktop path is proven, the mobile overlay itself
is untested. Real-device and real slow-network
first load remain unverified. Not deployed; no
multiplayer.

## Phase 2 — vehicle wheels + pedestrian collision (20 Nov 2026)

Fixes exactly two audit findings, 2.1 and 3.1, nothing else.
No mission, story, cash, save or progression logic changed; no
new dependencies; no physics engine; not pushed, not deployed.

**2.1 — mission sedan wheels spin.** `MissionVehicle.ts` moved
the car but never touched its wheels. The fix accumulates
`wheelSpin += distance / 0.34` from the distance actually
covered each frame (node arrival and partial step alike) and
applies it as each wheel's `rotation.x` — the same rule as the
player car and traffic, sign-correct for forward motion (the
sedan never reverses by construction). Each wheel also gained
a pale rim disc (the traffic wheels' trick), a child of the
wheel so it inherits the spin with no per-frame work: the
plain dark tyre alone is rotationally near-invisible. One fix
covers both sedans — the job mission's and story 2.1's — since
both are `createMissionVehicle` instances. `reset()` zeroes the
spin. Verified live in the real 2.1 follow: 41.9 m of path
produced 122.9 rad of rotation, ratio 2.93 rad/m against the
2.94 expected; wheels keep spinning through a turn (heading
3.14 → 4.08 rad, +4.77 rad in the window) and freeze when the
sedan parks (1253.4 rad held); 2.1 still completes with cash
exactly +$1,000 (5,000 → 6,000); traffic untouched
(`Traffic.ts` unmodified, 12/14 cars driving).

**3.1 — pedestrians are solid.** Nothing pushed NPCs out of
the player or their car before: the player could stand inside
a pedestrian (0.00 m) and the GT could drive through one
(0.51 m). The fix lives in `NPC.ts`, in the crowd update
after the NPC's own movement, and moves only the NPC — the
player and the car are treated as immovable, so it can never
block the player, change vehicle speed or handling, or fight
the world collision. On foot the NPC is pushed out of a
1.1 m circle (player 0.6 + NPC 0.5); driving, out of two axle
circles at ±1.1 m along the car's heading (the same offset
`Vehicle.ts` uses) with a 1.4 m radius. The NPC's state, node
and target are untouched and its node-seeking walk re-anchors
it next frame, so a push can never strand it. Verified live:
walk into an NPC from behind, front and side — minimum
distance exactly 1.10 m in all three, contact in each; drive
into one at 21.6 m/s — minimum 1.48 m; the pushed NPC resumes
walking (0.96 m in 5 s, state walk); no jitter (max step
0.60 m between samples); the player walks past, advancing
11.4 m through the encounter. Building collision still works
(player and GT both stop at the Beacon Tower without passing
through). Scope is the player on foot and the player-driven
car only — AI traffic cars, police cars and the mission sedan
still pass through NPCs (their hurry / wait reactions dodge
most contact). At very high speed a single-frame visual clip
remains possible in headless timing, though the push-out
resolves the overlap the same frame.

**Regression (all live, zero console errors everywhere):**
BEACON RUN completes (cash 12,500); the full qa81 suite is
green — shop, outfits, coins, sprint, garage (all four cars),
range, carbine, both encounters, contracts, arrest cycle to
BUSTED with a clean respawn; the Phase 1 dialogue fix is
intact (mid-typing complete holds at 81 chars, 10/10
samples); population settings scale (pedestrians 18 → 28,
traffic 14 → 20, all 28 NPCs walking); 390 px mobile clean
(no horizontal overflow, dialogue panel 370 wide, choices
work, Skip correctly hidden at choice nodes). `npx tsc
--noEmit` clean; build 1,148.94 kB / gzip 312.43 kB. The
carbine magazine occasionally reading 26 after five shots is
the pre-existing flake from 9F, unchanged. The 1.2 evade wart
is unchanged. Real-device and slow-network first load remain
unverified. Not deployed; no multiplayer.

## Scope note

Phases 7A–7D: the mission system, progression and board, the
five missions (BEACON RUN, MIDNIGHT DELIVERY, LOST
CONNECTION, DON'T LOSE THEM, NO WAY OUT), vehicle
ownership with the Sunset Garage and customisation, and the
living city (Sunset Mart, outfits, Sunset Coins, Sunset Sprint).
Phase 8A adds combat foundations: two original weapons, the
Sunset Range, health, firing, reload and switching. Phase 8B
adds enemy AI and two combat encounters (South Beach, North
Dunes), per-weapon magazines and accurate building obstruction
for bullet blocking. Phase 8C adds two optional combat
contracts (DOCKSIDE TROUBLE, HOLD THE LINE), a wave manager,
a protected objective with health, and full 3D raycast line
of sight. Phase 9B adds the story campaign core: Chapter 1
("The Wrong Package", three missions), the one-activity
guard, session checkpoints with retry, collect objectives
and once-per-save optional bonuses. Phase 9C replaces the
dialogue stub with a reusable data-driven dialogue system:
three Chapter 1 conversations with branching choices,
conditional lines and exactly-once events, typewriter UI,
and the engine paused while a conversation is open.
Phase 9D adds a reusable data-driven cinematic system:
three short skippable Chapter 1 scenes (FIRST LIGHT,
DOCKSIDE STATIC, SIGNAL LOST) with smooth camera
interpolation, staged characters, narration, dialogue
inside a shot, exactly-once shot events, and one
idempotent cleanup path — a skip never skips a story
event, and the intro plays on first accept only.
Chapters 2–3 in 9E.
No multiplayer or unrelated features.
