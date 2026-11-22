# Character Roster & 3D Asset Audit — Vice City Stories

**Date:** 2026-11-22
**Branch audited:** `ui/gta-vice-city-transformation` @ `d85d311` (Group 1: Lovable HUD restyle + shared toast)
**Production baseline:** `main` @ `053e76d` (unchanged by this audit)
**Reference:** [Character Art Bible](https://character-art-bible.lovable.app) — concept-only reference pack, 10 unique images
**Scope:** READ-ONLY audit. No game files, models, textures, animations, gameplay, or save data were modified. No push, merge, or deploy.

## Method

- Source audit of `src/game/Character.ts`, `CharacterAnimation.ts`, `Player.ts`, `NPC.ts`, `Police.ts`, `Enemies.ts`, `EnemyDefs.ts`, `EnemyModels.ts`, `StoryCharacters.ts`, `StoryDialogue.ts`, `StoryDefinitions.ts`, `StoryCinematics.ts`, `CinematicStaging.ts`, `Cinematic.ts`, `Outfits.ts`, `WeaponModels.ts`, `MissionVehicle.ts`, `Traffic.ts`, `Vehicle.ts`, `src/components/CharacterPreview.tsx`, `DialoguePanel.tsx`, `CinematicOverlay.tsx`.
- Asset search: `find public src` for `*.glb *.gltf *.fbx *.obj *.png *.jpg`; grep for `GLTFLoader|FBXLoader|OBJLoader|TextureLoader`.
- Live captures from the Group 1 production build served on the local preview server (see §7).
- Art Bible images downloaded and inspected individually (see §5).

## 1. Verified character roster

### 1.1 Playable protagonist

| ID | Name | Role | Source | 3D model |
|---|---|---|---|---|
| `kai` | Kai Reyes | Playable protagonist, all chapters + free roam | `src/game/Character.ts` (`createCharacter`), `src/game/Player.ts` | Yes — always in-world, procedural rig (~1.85 m, ~26 meshes). Speaks only through player dialogue *choices*; 0 `speaker:` nodes in `StoryDialogue.ts`. |

### 1.2 Named story characters (`src/game/StoryCharacters.ts`)

All 13 are defined with an id, display name, dialogue colour, and initial letter. None has a unique model: the 9 staged in cinematics all reuse the protagonist's `createCharacter` rig, recoloured by a `palette` (jacket/shirt/trousers/hair/skin hex only). Same male-proportioned body, face, hair shape, and height — only flat colours differ.

| ID | Name | Story role | Dialogue nodes | 3D appearance |
|---|---|---|---|---|
| `mara` | Mara Voss | Contact, Ch.1 + Ch.3 | 20 | Cinematic-only (`cine-first-light`, `cine-sunset-run`) |
| `rico` | Rico Hale | Contact, Ch.1 | 5 | Cinematic-only (`cine-dockside-static`) |
| `june` | June Park | Contact, Ch.1 + Ch.3 | 13 | Cinematic-only (`cine-signal-lost`, `cine-cranes-nest`) |
| `vic` | Vic Marino | Contact, Ch.2 | 5 | Cinematic-only (`cine-tail-spin`) |
| `dana` | Dana Cole | Contact, Ch.2 | 5 | Cinematic-only (`cine-long-way-out`, `cine-chapter2-outro`) |
| `rook` | Rook Calloway | Contact, Ch.2 | 10 | Cinematic-only (`cine-dockside-trouble`) |
| `silas` | Silas Crane | Antagonist, Ch.3 finale | 5 | Cinematic-only (`cine-finale`) |
| `theo` | Theo Ashford | Supporting, Ch.3 | 2 (no theo-named dialogue graph) | Cinematic-only (`cine-cranes-nest`, with June) |
| `milo` | Milo | Supporting, Ch.3 | 4 | Cinematic-only (`cine-dead-drop`) |
| `lena` | Lena Ortiz | Supporting, Ch.3 | 5 (`lena-dead-drop` graph) | **None — never staged in any cinematic** |
| `vera` | Vera Kwan | Named only; hires people, lies about the job | 0 | None — file comment: "never staged and never speaks" |
| `ferris` | Old Man Ferris | Finale one-liner | 1 | None — file comment: "never staged" |
| `sana` | Sana | Named only; warning about Vera opens Ch.2 | 0 | None |

Story characters reach the player through position markers (`find-mara`, `find-rico`, … in `StoryDefinitions.ts`) followed by dialogue. There is **no in-world character model standing at a marker outside cinematics**. `createStagedActor` is called only from `src/game/Cinematic.ts:254`. 12 cinematics total; `cine-hold-line` stages nobody (camera shots of beach/beacon only). 15 dialogue graphs (`STORY_DIALOGUES`, `StoryDialogue.ts:805`).

### 1.3 Civilian NPCs (`src/game/NPC.ts`, `ARCHETYPES`)

12 unnamed archetypes (index 0–11), rendered as 16 `InstancedMesh`es (head, 4 hair variants, torso, 2 arms, 2 thighs, 2 shins, 2 shoes, skirt, face). Per-instance colour + scale carry all variety. Pool max 28; counts off/few/normal/busy = 0/10/18/28 (Low tier caps at 10).

| # | Skin | Hair | Hair style | Top | Bottom | Skirt | Height | Cruise |
|---|---|---|---|---|---|---|---|---|
| 0 | `0xc68863` | `0x1a1512` | short | `0x5a5f66` | `0x2e3138` | no | 1.00 | 1.5 |
| 1 | `0xe8b98a` | `0x4a2f1d` | long | `0xc65a3c` | `0x2a3550` | no | 0.95 | 1.6 |
| 2 | `0x8a5a3b` | `0x1a1512` | short | `0x274156` | `0x8a7a5a` | no | 1.04 | 1.3 |
| 3 | `0x6b4423` | `0x1a1512` | bun | `0xd8b25a` | `0x2e3138` | yes | 0.96 | 1.4 |
| 4 | `0xd9a077` | `0x9a9a9a` | short | `0x6b4a2f` | `0x4a4a4a` | no | 0.98 | 1.1 |
| 5 | `0xc68863` | `0xc9a227` | long | `0x7a4a6b` | `0x1a1a22` | yes | 0.94 | 1.7 |
| 6 | `0xe8b98a` | `0x4a2f1d` | cap | `0xe8e6e0` | `0x1a1a22` | no | 1.02 | 1.5 |
| 7 | `0x8a5a3b` | `0x7a2e1d` | short | `0x8a2f2f` | `0x2a3550` | no | 1.06 | 1.4 |
| 8 | `0x6b4423` | `0x1a1512` | long | `0x3a6b4f` | `0x2e3138` | yes | 0.97 | 1.5 |
| 9 | `0xe8b98a` | `0xc9a227` | short | `0x2f6f6a` | `0x8a7a5a` | no | 0.92 | 1.8 |
| 10 | `0xd9a077` | `0x4a2f1d` | bun | `0x5a4a7a` | `0x2e3138` | no | 1.00 | 1.3 |
| 11 | `0xc68863` | `0x1a1512` | cap | `0xd06a2a` | `0x2a3550` | no | 0.93 | 1.9 |

Heights are scale factors on the ~1.85 m base (0.92–1.06 ≈ 1.6–1.85 m). 5 skin tones, 5 hair colours. States: walk/idle/wait; reactions: step aside, yield, hurry/wait at curbs, head-glance at the player. No names, no dialogue, no per-NPC rig (instanced matrix-driven limbs).

### 1.4 Enemy characters (`src/game/EnemyDefs.ts`, `EnemyModels.ts`, `Enemies.ts`)

| ID | Name | HP | Distinguisher | Speed | Detection |
|---|---|---|---|---|---|
| `yard-enforcer` | Yard Enforcer | 100 | Red bandana, 1.06×1.18 build | — | — |
| `lot-runner` | Lot Runner | 60 | Teal cap, fast | 3.2 m/s | — |
| `northgate-lookout` | Northgate Lookout | 80 | Grey beanie | — | 36 m (longest) |

17–18 meshes by direct count (file header says "~12"): legs (capsule + shoe), jacket box + accent vest plate, head sphere + headgear (bandana torus+tail / cap cylinder+brim / beanie sphere) + 2 eyes, 2 arms, scrap rifle (receiver + barrel + grip) in the right hand with a `muzzle` anchor. Heights: scale 0.96–1.1 × 1.85 m ≈ 1.78–2.04 m. Max 3 per encounter. Spawn groups (all 3 variants each): `south-beach` (165,150), `north-dunes` (165,−170) — free-roam; `story-dockside`, `story-defend` (7 enemies, HOLD THE LINE), `story-nest-a`, `story-nest-b`. AI states (8): `patrol | idle | investigate | alert | engage | cover | search | defeated`. No dialogue.

### 1.5 Police characters (`src/game/Police.ts`)

**No on-foot officer model exists.** Police are 2 vehicle variants only: black-and-white sedan (4.4 m) and SUV (4.8 m), push bar, flashing red/blue light bar; 5 `InstancedMesh`es for up to 6 units. Arrest = a police car approaches to 4.5 m; the protagonist surrenders hands-up. There is no officer figure in the arrest/surrender beat.

### 1.6 Vehicles — no driver figures anywhere

Zero matches for human/figure/person/occupant/seat/driver in `Traffic.ts` / `Vehicle.ts` (only a "real driver" comment, `Traffic.ts:440`). Player cars (`Vehicle.ts`), traffic cars, police cars, and the mission sedan (`MissionVehicle.ts`: teal, 7 meshes, purple roof beacon) all have **no driver figure**.

## 2. Existing 3D model inventory

### 2.1 Imported assets: none

- **Zero** matches for `GLTFLoader` / `FBXLoader` / `OBJLoader` / `TextureLoader` in `src/`.
- `find` over `public/` + `src/` returns exactly **one** image file: `public/images/vice-city-sunset.png` (menu/About/cinematic background, not a character asset).
- The only textures in code are `CanvasTexture`s for ground/buildings (`World.ts:48`, `Buildings.ts:29,98`).
- `Character.ts` header states the reason: obtainable licensed GLBs were the wrong character (CesiumMan/RiggedFigure); Mixamo is named as the future upgrade path.
- **Conclusion: 100% of characters are procedural Three.js geometry. 0 imported models, 0 character textures.**

### 2.2 Protagonist model (`Character.ts`, `createCharacter`)

~1.85 m tall, **~26 meshes by direct count** (file header says "~22"). 11 `MeshStandardMaterial`s.

| Part | Construction | Material / colour |
|---|---|---|
| Pelvis | box | trousers `0x2e3138` |
| Legs (each) | capsule thigh + capsule shin + shoe box + sole box | trousers / shoes `0x30343a` / soles `0xe8e6e0` |
| Torso | 2 stacked jacket boxes + tee panel + hood sphere + neck cylinder + waistband | hoodie `0x5a5f66`, tee `0xd8d2c4` |
| Gold chain | torus | gold `0xd8b25a`, metalness 0.75 |
| Head | sphere | skin `0xc68863` |
| Hair | hair-cap sphere | hair `0x1a1512` |
| Face | merged batches (nose+ears skin; eyes+brows+mouth dark `0x1a1210`) | flat, no face rig |

**Rig = 13 named `THREE.Group` pivots, no skeleton/bones:** root, body, torso, head, legL/R, kneeL/R, armL/R, elbowL/R. No face rig, no fingers, no facial animation.

### 2.3 Story-character models (`CinematicStaging.ts:51`)

The same `createCharacter` rig, recoloured via `palette` in `StoryCharacters.ts` (jacket/shirt/trousers/hair/skin hex only). Kai has no palette (keeps defaults). All 9 staged characters share the identical male-proportioned body, face, hair shape, and height.

### 2.4 Weapons (`WeaponModels.ts`, `createWeaponModel`)

Palm 9 sidearm + Vanguard Carbine, procedural boxes/cylinders with a muzzle anchor; parented to the protagonist's **right elbow pivot (`elbowR`)** by `Combat.ts:257–285` (`attachModel`), following the arm through the walk cycle. The enemy rifle is part of the enemy model, not a `WeaponModels` asset.

### 2.5 Outfits (`Outfits.ts`, 5 defs)

An outfit recolours 7 materials (jacket/sleeve/shirt/thigh/shin/shoe/sole) + hood/chain visibility only — face, skin, hair, rig, and animation are untouched.

| ID | Name | Price | What changes |
|---|---|---|---|
| `default-hoodie` | Street Hoodie | $0 (owned) | Default grey hoodie, cream tee, gold chain |
| `casual-streetwear` | Casual Streetwear | $300 | Teal jacket, red sneakers |
| `beach-day` | Beach Day | $250 | Coral shirt, shorts — sleeve/shin recoloured to skin tone for bare limbs, hood off |
| `night-out` | Night Out | $500 | Black blazer, no hood/chain |
| `crew-jacket` | Crew Jacket | Unlock-only | Earned in story 2.2 HOLD THE LINE, never buyable |

### 2.6 Character preview (`src/components/CharacterPreview.tsx`)

Own lightweight Three.js scene: `createCharacter` + `applyOutfit`, PerspectiveCamera 42° at (0, 1.5, 4.6) looking at (0, 1.0, 0), turntable auto-rotate `rotation.y += 0.008`/frame, hemi + 2 directional lights, dark disc + gold ring. Single fixed camera; **no user-controlled front/side/three-quarter stills** — angles come only from the rotation.

## 3. Animation inventory — procedural code, no clips or rigs

No `AnimationClip`, keyframes, skeleton, or mocap data anywhere in the repo. All animation is runtime procedural posing.

| Character | Mechanism | States |
|---|---|---|
| Protagonist (`CharacterAnimation.ts`) | `AnimState` = `idle \| walk \| run \| sprint`, driven by *actual* travelled speed (not keys held); stride-matched gait phase (`phase += dt·π·speed/stride`); sine leg/arm swings, knee/elbow bends, torso lean/twist, head counter-rotation, bob; all joints eased toward targets (`k = min(1, dt·10)`). Thresholds: idle ≤0.4 m/s, walk ≤7, run ≤8.5, sprint >8.5 + Shift. Idle = breathing/weight-shift/head-drift. `updateSurrender(dt)` = hands-up pose (arms −2.7 rad). Downed = `Player.ts` sets `group.rotation.x = −π/2` (not an animation state). | idle, walk, run, sprint, surrender, downed (pose) |
| Civilians (`NPC.ts`) | Same stride-matched pattern inline (leg 0.5, knee 0.8, arm 0.4, bob), eased; no run/sprint. | walk, idle, wait |
| Enemies (`Enemies.ts` `updatePose`) | Inline walk swing (leg 0.45); right arm levels to −1.25 rad when aiming; defeated = root rotation.x eases to −π/2 (falls flat, fades after 4 s); hit flash (jacket emissive red 0.15 s). | patrol, idle, investigate, alert, engage, cover, search, defeated |
| Staged cinematic actors (`CinematicStaging.ts`) | Same `CharacterAnimation` — idle breathing or slow walk-to-point (default 1.4 m/s), then idle. | idle, walk |
| **Missing** | No aim pose, no sitting/crouching, no gestures, no facial/lip-sync, no per-character walk variation; enemies share one walk cycle. | — |

## 4. Dialogue & cinematic presentation of characters

- **Dialogue** (`DialoguePanel.tsx:174–181`): a speaker is shown as a **coloured initial-letter medallion** (colour + initial from `StoryCharacters.ts`) beside the name and typewriter text. **No portraits exist** — no image, no 3D bust, no expression variation.
- **Cinematics** (`CinematicOverlay.tsx`): letterbox frame, title card, narration subtitles over the live 3D scene, shot dots, Skip. Staged actors are the recoloured `createCharacter` rigs standing in the world; there is no close-up portrait framing and no facial performance.

## 5. Character Art Bible — reference inventory

Source: https://character-art-bible.lovable.app — **concept references only**; the site itself marks every character-specific match "Awaiting roster verification". 11 source files, **10 unique images** (one duplicate). All artwork is unofficial visual material, not finished 3D models; no rigging or animation data is supplied.

| File | What it shows | Status |
|---|---|---|
| `visual_board_1.jpg` (1536×1024) | Sunset city scenes, interface studies, vehicles, characters, colour references | Direction board |
| `visual_board_2.jpg` (1672×941) | Wide board: city scenes, character references, interface details, palette cues | Direction board |
| `visual_board_3.jpg` (1672×941) | Collage connecting character, wardrobe, city, interface concepts | Direction board |
| `protagonist_portraits_3.jpg` (469×310) | Paired close portraits: man — short dark side-part, stubble, amber aviator sunglasses, turquoise palm-print open shirt, gold chain; woman — long dark wavy hair, gold hoop earrings, fuchsia top, gold necklace | Concept |
| `protagonist_portraits_2.jpg` (385×319) | Alternate crop of the same paired portraits | Concept |
| `character_and_outfit_panels_1.jpg` (737×297) | Wide interface strip: portrait crops, dialogue text, outfit panels, menu details. **Pixel-identical duplicate of `character_portraits_1.jpg`** — shown once. | Concept |
| `character_turnaround_2.jpg` (451×235) | Male figure, front/side/rear views + large portrait head: turquoise palm-print shirt, cream/beige trousers, white shoes; UI chrome ("Zoom LT RT", "Weapon", "Back") | Concept turnaround, not a rigging model sheet |
| `npc_lineup_3.jpg` (618×179) | Lineup of ~11 varied crowd figures (women/men, denim jackets, patterned shirts, suits, hats) on a pink backdrop; "DIALOGUE / CINEMATIC" + "CITY ENVIRONMENT" strips above | Crowd variety reference; individuals unidentified |
| `outfit_customisation_2.jpg` (351×235) | OUTFITS menu concept: 9 outfit swatches (white tee, blue patterned shirt, black jacket, grey shirt, suit, yellow shirt, brown jacket, grey suit, black suit) + full-body male preview in turquoise palm shirt + cream trousers | Clothing/menu concept |
| `dialogue_portrait_3.jpg` (434×225) | Close dialogue portrait: woman with long dark wavy hair, sunglasses, gold hoops, palm/sunset city backdrop; UI chrome ("Zoom LT RT", "FULL MAP") | Expression/framing reference |

Local copies for this audit: `~/workspace/qa-shots/art-bible/` (downloaded read-only from the site; not copied into the game repo).

## 6. Mapping table — actual character → Art Bible reference

Rule applied: **no Art Bible concept is assigned to a character unless the match is verified.** A shared colour or a similar shirt is not a verified match. Where no match exists, the cell says so.

| Actual character ID | Actual game role | Existing model / reference | Closest Art Bible reference | Visual differences | Missing assets | Recommended improvement |
|---|---|---|---|---|---|---|
| `kai` — Kai Reyes | Playable protagonist | Procedural rig, ~26 meshes; default grey hoodie over cream tee, gold chain, dark cargo trousers; §7 `char-protagonist-*.png`, `char-preview-turntable-*.png` | `character_turnaround_2.jpg` (male turnaround) + `protagonist_portraits_3.jpg` (male half) — **concept direction only, not a verified match** | Turnaround/portrait wear a turquoise palm-print open shirt + cream trousers; Kai wears a grey hoodie + dark trousers. Portrait has stubble, amber aviators, side-part hair; Kai's model has a hair-cap, no stubble, no sunglasses, flat merged face. Same ~1.85 m male silhouette and gold chain only. | Face detail (stubble, sunglasses as an accessory mesh), palm-print shirt texture (no textures exist), distinct hair shape | Phase 1: add per-outfit hair/face accessories on the existing rig (sunglasses mesh, stubble via face-batch colour); Phase 2: a palm-print shirt as a new outfit def (flat colours first, texture later) |
| `mara` — Mara Voss | Story contact, Ch.1 + Ch.3 (20 nodes, most dialogue) | Recoloured Kai rig in cinematics only; dialogue = pink initial medallion | `protagonist_portraits_3.jpg` (female half) + `dialogue_portrait_3.jpg` — **NOT a verified match** | The portraits show a woman with long dark wavy hair, gold hoops, fuchsia top; Mara's in-game model is the male-proportioned Kai rig with different flat colours, male hair-cap, no hoops, no fuchsia top. No portrait exists in-game. | Female body proportions, long-hair mesh, hoop-earring meshes, fuchsia-top outfit, a real dialogue portrait | Phase 1 (highest value): give Mara a distinct silhouette — long-hair variant + female-proportioned torso on the shared rig — and a portrait treatment to replace the initial medallion |
| `june` — June Park | Story contact, Ch.1 + Ch.3 (13 nodes) | Recoloured Kai rig in cinematics only; dialogue = initial medallion | `protagonist_portraits_3.jpg` (female half) — **NOT a verified match** | Same as Mara: portrait is a woman with long dark hair and hoops; June's model is the male rig recoloured. | Female proportions, long-hair mesh, distinct palette/wardrobe vs Mara, portrait | Phase 1, with Mara: distinct hair + wardrobe so Mara and June are distinguishable in cinematics |
| `dana` — Dana Cole | Story contact, Ch.2 (5 nodes) | Recoloured Kai rig in cinematics only; dialogue = initial medallion | `dialogue_portrait_3.jpg` — **NOT a verified match** | Portrait is a woman in sunglasses; Dana's model is the male rig recoloured, no sunglasses. | Female proportions, hair variant, sunglasses accessory, portrait | Phase 2: distinct silhouette + portrait, after Mara/June |
| `lena` — Lena Ortiz | Supporting, Ch.3 (5 nodes) | **No model at all**; dialogue = initial medallion | `protagonist_portraits_3.jpg` (female half) — **NOT a verified match** | No in-game appearance to compare; the portrait is a concept for a woman who does not exist in the game yet. | Entire 3D appearance + portrait | Phase 2: stage Lena (she speaks but never appears) — reuse the female silhouette work from Phase 1 |
| `rico`, `vic`, `rook`, `silas`, `theo`, `milo` | Story contacts / antagonist / supporting | Recoloured Kai rig in cinematics only; dialogue = initial medallion | `npc_lineup_3.jpg` (male figures) — **broad variety reference only, no per-character match** | Lineup figures wear suits, denim jackets, hats; in-game these characters differ only by flat jacket/shirt/trousers/hair colours on the identical rig. | Distinct hair styles, hats, body builds, portraits | Phase 3: per-character hair/hat/build variants on the shared rig; portraits after the leads |
| `vera`, `sana` | Named only (0 nodes) | No model, no dialogue | None — no concept assigned | — | Decision needed: model them or keep named-only deliberately | Phase 3: explicit decision; do not model by default |
| `ferris` — Old Man Ferris | Finale one-liner (1 node) | No model | None — no concept assigned | — | 3D appearance only if he is ever staged | Phase 3: only if staged |
| NPC archetypes 0–11 | Civilian crowd | Instanced meshes, 12 colour/hair/skirt/height variants | `npc_lineup_3.jpg` — **broad silhouette/wardrobe variety reference, individuals unidentified** | Lineup shows ~11 figures with suits, hats, varied tops; in-game archetypes are the same instanced body with colour/hair/skirt/scale variation, no hats (except 2 cap variants), no suits | Hat variants beyond caps, suit/top variety, per-NPC identity | Phase 3: extend archetype variety (hats, jacket variants) using the lineup as direction; keep instanced rendering |
| `yard-enforcer`, `lot-runner`, `northgate-lookout` | Hostile NPCs | Procedural, 17–18 meshes each; bandana/cap/beanie headgear, scrap rifle | None — no enemy concept in the Art Bible pack | — | Enemy-specific concept art, distinct builds beyond scale, aim/fire animation variety | Phase 3: concept pass for enemies; keep the existing rifle + headgear system |
| Police | Wanted/pursuit/arrest | Vehicles only — **no officer figure** | None — no police concept in the pack | — | Entire on-foot officer model + arrest-beat staging | Phase 2: build an on-foot officer (uniform variant of the shared rig + cap) for the arrest beat |
| Outfits (5 defs) | Protagonist wardrobe | Recolour-only outfit system | `outfit_customisation_2.jpg` — **menu/wardrobe direction, not a match** | Sheet shows 9 swatches; the game has 5 outfits. Sheet's preview figure wears the turquoise palm shirt — no in-game outfit matches it. | Palm-print shirt outfit, suit/blazer variants beyond Night Out, outfit preview stills | Phase 2: add the palm-print shirt as a 6th outfit def; keep the recolour-only system |

## 7. Available screenshots and their exact paths

Captured from the Group 1 build (`d85d311`) on the local preview server, desktop 1280×800 unless noted. **All are actual game models — no generated concept art was substituted.**

| File | Subject | Notes |
|---|---|---|
| `~/workspace/qa-shots/char-audit/char-protagonist-rear.png` | Kai Reyes, rear view, full-body (in-world) | Rotation.y = π (facing away from camera) |
| `~/workspace/qa-shots/char-audit/char-protagonist-front.png` | Kai Reyes, front view, full-body (in-world) | Rotation.y = 0 (facing camera) |
| `~/workspace/qa-shots/char-audit/char-protagonist-side.png` | Kai Reyes, side view, full-body (in-world) | Rotation.y = π/2 |
| `~/workspace/qa-shots/char-audit/char-protagonist-threequarter.png` | Kai Reyes, three-quarter view, full-body (in-world) | Rotation.y = π/4 |
| `~/workspace/qa-shots/char-audit/char-preview-turntable-a.png` | Kai Reyes, CharacterPreview (Outfits panel), turntable frame 1 | Isolated preview, dark disc + gold ring |
| `~/workspace/qa-shots/char-audit/char-preview-turntable-b.png` | Kai Reyes, CharacterPreview, turntable frame 2 | Same preview, later rotation |
| `~/workspace/qa-shots/char-audit/char-npc-street.png` | Civilian NPCs, street wide shot | One pedestrian visible mid-stride ahead of Kai; 4 NPC positions logged in `~/workspace/qa-shots/char-audit.log` (sidewalks at z=±36.5, walking 1.3–1.6 m/s) |
| `~/workspace/qa-shots/char-audit/char-npc-closeup.png` | Civilian NPC, close-up | Nearest NPC to the player; the NPC kept walking, so the frame is ~10 m out, not a detail close-up |
| `~/workspace/qa-shots/char-audit/char-police-car.png` | BUSTED screen + police sedan | Heat 90 → the police caught Kai during the slow poll loop; the poll-11 "clear" reading was the completed arrest, not police losing the player. Sedan with red/blue light bar beside Kai. Documents "vehicles only — no officer" |
| `~/workspace/qa-shots/char-audit/char-enemies-south-beach.png` | Enemies at South Beach (165,150), view from south | "SOUTH BEACH — 3 hostiles left" banner; one enemy (brown jacket, rifle) right in front of Kai. Kai is in the hands-up surrender pose — a harness artifact (the harness called `arrest.reset()` directly, bypassing the Respawn flow that clears the pose), not an aim pose and not a game defect |
| `~/workspace/qa-shots/char-audit/char-enemies-south-beach-b.png` | Enemies at South Beach, view from east | Second angle; one enemy at left with rifle raised; Kai's right arm still raised with the Palm 9 (left arm occluded by the head/torso at this angle); health 95 — an enemy hit landed |
| `~/workspace/qa-shots/char-audit/char-story-board.png` | Story board (Chapter 1 entries) | Context for the dialogue capture |
| `~/workspace/qa-shots/char-audit/char-dialogue-mara.png` | Mara Voss dialogue presentation | **Captured on the third attempt** (first two failed: board-entry click doesn't open dialogue; waiting at the marker doesn't either — the dialogue needs an E press after the reach objective, and a cinematic plays first). Teal "M" initial-letter medallion + "MARA VOSS" + Skip; first line: "Kai. You're on time for once. This package goes to Beacon Tower, and it goes now." No portrait — the gap, documented visually. |

Capture harness: `~/workspace/qa-shots/vcs-char-audit-shots.mjs`; log: `~/workspace/qa-shots/char-audit.log`. Console errors during capture: `[]`.

> Capture note: headless SwiftShader screenshots of the busy WebGL canvas intermittently time out at 30 s (first attempt, right after boot). The harness retries each shot 3× and continues; any shot that still fails after retries is re-attempted in a second pass with a longer settle time before the shot. No screenshot in this audit is a substitute or a mock — a failed capture is recorded as missing, not faked. **The dialogue capture took three attempts** (board-entry click doesn't open dialogue; waiting at the marker doesn't either — the dialogue needs an E press after the reach objective, and a cinematic plays first) **and landed on the third** (`~/workspace/qa-shots/vcs-char-dialogue-shot2.mjs`, log `~/workspace/qa-shots/char-dialogue2.log`). All 13 planned shots are now captured and verified.

## 8. Missing portraits, models, textures, animations

1. **Portraits: none exist.** Every dialogue speaker is an initial-letter medallion. Every cinematic is a wide 3D staging with subtitles. The Art Bible's `dialogue_portrait_3.jpg` and `protagonist_portraits_3.jpg` are the reference for what a portrait treatment could look like — they are targets, not matches.
2. **Distinct story-character models: none exist.** 9 staged characters share one male rig; only flat colours differ. Mara, June, and Dana are women played by a male-proportioned model.
3. **Lena Ortiz: no 3D appearance at all** despite 5 dialogue nodes. Vera, Sana: named only. Ferris: 1 line, no model.
4. **On-foot police officer: does not exist.** Police are cars only.
5. **Driver figures: none in any vehicle.**
6. **Textures: none for any character.** All surfaces are flat `MeshStandardMaterial` colours. No normal detail, no prints (including the Art Bible's signature palm print).
7. **Rigs/skeletons/animation clips: none.** 13 pivot groups, procedural posing only. No aim pose, gestures, sitting/crouching, facial/lip-sync, or per-character walk variation. The one raised-arms pose in the game is the hands-up surrender (`updateSurrender`, both arms −2.7 rad) — it is what the South Beach captures show (harness artifact: the capture reset the arrest directly instead of using the Respawn flow that clears the pose), not an aim pose.
8. **Per-NPC identity: none.** 12 anonymous archetypes; the runtime does not expose which archetype a given on-screen pedestrian is (`npcPositions()` returns position/heading/state only).
9. **Fixed reference stills: none.** The CharacterPreview is turntable-only; no front/side/three-quarter stills existed before this audit (§7).

## 9. Recommended implementation phases

**Phase 1 — Distinct silhouettes for the story leads (highest value, smallest scope).**
Work on the existing shared rig; no new pipeline. Give Mara, June, and Dana distinct silhouettes: long-hair mesh variants, female-proportioned torso/hip scaling, and distinct wardrobes so the three are distinguishable in cinematics. Add a portrait treatment (rendered bust or illustrated portrait) to replace the initial-letter medallion, starting with Mara (20 nodes). Keep the recolour/palette system — extend it with hair-style and proportion fields.

**Phase 2 — Fill the appearance gaps.**
Stage Lena Ortiz (she speaks but never appears) using the Phase 1 female silhouette work. Build an on-foot police officer (uniform variant of the shared rig + cap) for the arrest/surrender beat. Add the Art Bible's turquoise palm-print shirt as a 6th outfit def for Kai (flat colours first; a real print texture only when a texture pipeline exists). Extend the portrait treatment to June, Dana, and Lena.

**Phase 3 — Breadth and polish.**
Per-character hair/hat/build variants for Rico, Vic, Rook, Silas, Theo, and Milo; portraits for the remaining speakers. Decide Vera/Sana/Ferris explicitly (model or keep named-only — do not model by default). Extend NPC archetype variety (hats, jacket variants) using `npc_lineup_3.jpg` as direction, keeping instanced rendering. Concept pass for enemies. Only after Phases 1–3, evaluate imported/rigged assets (Mixamo GLB is the documented path in `Character.ts`) for animation variety — the procedural system is the correct base to keep, not replace.

**Explicitly out of scope for this audit:** character replacement, new character identities, gameplay or NPC AI changes, deployment, push/merge, production-branch changes.

## 10. Audit verdict

What actually exists is a **coherent, fully procedural character system with zero imported assets**: one well-built protagonist rig (~26 meshes, 13 pivots, 4-state procedural animation + surrender), 12 instanced civilian archetypes, 3 enemy variants with headgear and rifles, 5 recolour outfits, and a turntable preview — all working and verified live. The single biggest gap is that **the story cast has no visual identity**: 9 staged characters share one male body, the three female leads are played by that male rig, Lena speaks without ever appearing, and dialogue has no portraits. The Art Bible's strongest, most usable references are its female portraits and its turnaround — but neither is a verified match for any existing in-game character today, and the audit does not pretend otherwise. **Improve first: Phase 1 — distinct silhouettes + portraits for Mara, June, and Dana.**
