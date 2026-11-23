/**
 * GameEngine — owns everything Three.js.
 * React owns the UI; this class owns the canvas, the render loop,
 * the third-person camera and the world. Phase 1 has no physics
 * engine: movement is kinematic (see Player.ts).
 *
 * Lifecycle: `GameEngine.create(canvas, settings, cb)` -> `start()`
 * -> `dispose()`. Dispose cancels the loop, removes every listener
 * and disposes the renderer, so mounting twice (React StrictMode)
 * never leaks a second loop.
 */
import * as THREE from 'three';
import { buildWorld } from './World';
import type { WorldHandle } from './World';
import { createLighting } from './Lighting';
import type { LightingHandle } from './Lighting';
import { createPlayer } from './Player';
import type { PlayerHandle } from './Player';
import { createVehicle } from './Vehicle';
import type { VehicleHandle, Gear } from './Vehicle';
import { attachKeyboard, createInputState, addLook } from './Input';
import type { InputState } from './Input';
import { detectQuality, settingsForTier, stepDown } from './Quality';
import type { QualitySettings, QualityTier } from './Quality';
import type { GameSettings } from './Settings';
import { createCrowd } from './NPC';
import type { CrowdHandle, PedestrianChoice } from './NPC';
import { createTraffic } from './Traffic';
import type { TrafficHandle, TrafficChoice } from './Traffic';
import { createWanted } from './Wanted';
import type { WantedHandle, WantedState } from './Wanted';
import { createPolice } from './Police';
import type { PoliceHandle, PoliceChoice, PursuitDifficulty } from './Police';
import { createArrest } from './Arrest';
import type { ArrestHandle, ArrestState } from './Arrest';
import { createMissionManager } from './MissionManager';
import type { MissionManagerHandle } from './MissionManager';
import type { MissionBoardState, MissionHudState } from './MissionTypes';
import { GARAGE_ENTRANCE, STORE_ENTRANCE } from './CityGenerator';
import { getVehicleSpec, VELOCITY_GT_ID } from './VehicleCatalog';
import { bakeCityProbe, assignProbeToVehicle, DOWNTOWN_PROBE_POSITION } from './ReflectionProbes';
import { InteractionRegistry } from './Interactables';
import type { NearestInteractable } from './Interactables';
import { createCollectibles } from './Collectibles';
import type { CollectibleState, CollectiblesHandle } from './Collectibles';
import { createSprint, SPRINT_REWARD, SPRINT_START } from './Sprint';
import type { SprintHandle, SprintHudState, SprintStatus } from './Sprint';
import { getShopItem, loadInventory, saveInventory, SHOP_ITEMS } from './Inventory';
import type { InventoryState, ShopItemDef } from './Inventory';
import {
  getOutfit,
  loadOutfitState,
  OUTFIT_DEFS,
  saveOutfitState,
} from './Outfits';
import type { OutfitDef, OutfitState } from './Outfits';
import { createRange, RANGE_LINE, RANGE_RACK } from './Range';
import type { RangeHandle } from './Range';
import { createCombat } from './Combat';
import type { CombatHandle, CombatHudState } from './Combat';
import { createEnemies } from './Enemies';
import type { EnemiesHandle } from './Enemies';
import { createEncounters, ENCOUNTER_DEFS } from './Encounters';
import type { EncounterState, EncountersHandle } from './Encounters';
import {
  createContracts,
  CONTRACT_DEFS,
  contractSpawns,
  contractWaveSpawns,
} from './Contracts';
import type { ContractState, ContractsHandle } from './Contracts';
import { createMissionVehicle } from './MissionVehicle';
import type { MissionVehicleHandle } from './MissionVehicle';
import {
  createStoryEncounters,
  STORY_ENCOUNTER_DEFS,
  storyEncounterIds,
  storyEncounterSpawns,
  storyEncounterWaveSpawns,
} from './StoryEncounters';
import type { StoryEncountersHandle } from './StoryEncounters';
import { createStoryCampaign } from './StoryCampaign';
import type { StoryCampaignHandle } from './StoryCampaign';
import type { StoryBoardState, StoryHudState } from './StoryTypes';
import { createDialogue } from './Dialogue';
import type { DialogueHandle, DialogueState } from './Dialogue';
import type { DialogueEvent } from './StoryDialogue';
import { createCinematic } from './Cinematic';
import type { CinematicHandle } from './Cinematic';
import type { CinematicState } from './CinematicTypes';
import { getWeapon, WEAPON_DEFS } from './Weapons';
import type { WeaponId } from './Weapons';
import {
  buildGarageUiState,
  effectiveStats,
  getUpgradePrice,
  isOwned,
  loadGarageState,
  paintFor,
  PAINT_PRICE,
  saveGarageState,
  selectedSpec,
  upgradesFor,
} from './GarageProgress';
import type { GarageState, GarageUiState, UpgradeKind } from './GarageProgress';

/**
 * Low-tier ambient population cap (G0 finalisation).
 * Low exists for weak hardware, so while the tier is Low the ambient
 * crowd and traffic are capped at 'few' (10 pedestrians) and 'low'
 * (8 cars) — fewer NPCs to animate and cars to simulate. The cap
 * only ever lowers the requested choice, never raises it, and it
 * never rewrites the user's saved setting: the requested choice is
 * kept on the engine, so switching back to Medium or High restores
 * the full requested population. Mission-critical entities (story
 * characters, mission vehicles, encounter enemies) do not live in
 * the crowd/traffic systems, so the cap cannot touch them.
 */
const LOW_PEDESTRIAN_CAP: PedestrianChoice = 'few';
const LOW_TRAFFIC_CAP: TrafficChoice = 'low';
/**
 * G1.1 — how strongly the environment map lights the scene
 * (scene.environmentIntensity). 1.0 would roughly double the ambient
 * on top of the hemisphere light and wash out the sunset palette;
 * 0.55 keeps the paint/glass/metal reflections clearly visible
 * while the diffuse lift stays a soft bounce. Per-material
 * envMapIntensity stays at its default unless a screenshot says
 * otherwise.
 */
const ENVIRONMENT_INTENSITY = 0.55;
const PEDESTRIAN_ORDER: readonly PedestrianChoice[] = ['off', 'few', 'normal', 'busy'];
const TRAFFIC_ORDER: readonly TrafficChoice[] = ['off', 'low', 'medium', 'high'];

function capPedestrians(choice: PedestrianChoice, tier: QualityTier): PedestrianChoice {
  if (tier !== 'low') return choice;
  return PEDESTRIAN_ORDER[Math.min(PEDESTRIAN_ORDER.indexOf(choice), PEDESTRIAN_ORDER.indexOf(LOW_PEDESTRIAN_CAP))];
}

function capTraffic(choice: TrafficChoice, tier: QualityTier): TrafficChoice {
  if (tier !== 'low') return choice;
  return TRAFFIC_ORDER[Math.min(TRAFFIC_ORDER.indexOf(choice), TRAFFIC_ORDER.indexOf(LOW_TRAFFIC_CAP))];
}

export type DriveMode = 'walk' | 'drive';

export interface DriveHudState {
  mode: DriveMode;
  nearVehicle: boolean;
  nearGarage: boolean;
  /** The nearest registered interactable (store, sprint start), or null. */
  nearInteractable: NearestInteractable | null;
  collectibles: { found: number; total: number };
  speedKmh: number;
  gear: Gear;
  vehicleName: string;
}

export interface EngineCallbacks {
  onReady?: (quality: QualitySettings) => void;
  onFps?: (fps: number) => void;
  onQualityChange?: (quality: QualitySettings) => void;
  onError?: (message: string) => void;
  /** Driving HUD state, ~10x a second while it matters. */
  onDrive?: (state: DriveHudState) => void;
  /** Wanted HUD state, ~10x a second while it matters. */
  onWanted?: (state: WantedState) => void;
  /** Arrest state changes (prompt / surrendering / busted / none). */
  onArrest?: (state: ArrestState) => void;
  /** Mission HUD state, ~10x a second while it matters. */
  onMission?: (state: MissionHudState) => void;
  /** The player pressed E at the garage entrance. */
  onGarageEnter?: () => void;
  /** The player pressed E at the convenience store entrance. */
  onShopEnter?: () => void;
  /** Sprint HUD state, while a run is live or its result shows. */
  onSprint?: (state: SprintHudState) => void;
  /** Combat HUD state (weapon, ammo, health, hits), ~10x a second. */
  onCombat?: (state: CombatHudState) => void;
  /** The player pressed E at the range's weapon rack. */
  onRangeEnter?: () => void;
  /** The player was defeated in combat (health reached zero). */
  onDowned?: (downed: boolean) => void;
  /** Encounter HUD state (status, enemies left, cooldown), ~10x a second. */
  onEncounter?: (state: EncounterState[]) => void;
  /** Contract HUD state (status, wave, objective), ~10x a second. */
  onContract?: (state: ContractState[]) => void;
  /** Story HUD state (chapter, mission, objectives), ~10x a second. */
  onStory?: (state: StoryHudState) => void;
  /** Dialogue state (speaker, line, choices), on every transition. */
  onDialogue?: (state: DialogueState | null) => void;
  /** Cinematic state (shot, narration), on every transition. */
  onCinematic?: (state: CinematicState | null) => void;
}

/** What the shop panel renders: the catalogue, the cash, the inventory. */
export interface ShopUiState {
  cash: number;
  items: ShopItemDef[];
  inventory: InventoryState;
}

/** What the outfits panel renders: one row per outfit. */
export interface OutfitRow {
  def: OutfitDef;
  owned: boolean;
  selected: boolean;
}

export interface OutfitUiState {
  cash: number;
  outfits: OutfitRow[];
}

/** What the range panel renders: one row per weapon, the cash, the range stats. */
export interface RangeWeaponRow {
  id: WeaponId;
  name: string;
  category: string;
  damage: number;
  fireInterval: number;
  auto: boolean;
  magSize: number;
  reloadSeconds: number;
  range: number;
  ammoType: string;
  price: number;
  description: string;
  owned: boolean;
  equipped: boolean;
  reserve: number;
}

export interface RangeUiState {
  cash: number;
  weapons: RangeWeaponRow[];
  shots: number;
  hits: number;
  accuracy: number;
  totalHits: number;
  totalShots: number;
}

export interface EngineStats {
  fps: number;
  quality: QualitySettings;
  position: THREE.Vector3;
  /**
   * Facing heading (radians, forward = (sin h, cos h)): the vehicle's
   * heading while driving, the player's mesh facing while on foot.
   * Read-only — exposed for the HUD minimap's player arrow.
   */
  heading: number;
  mode: DriveMode;
  speedKmh: number;
  gear: Gear;
  nearVehicle: boolean;
  nearGarage: boolean;
  nearInteractable: NearestInteractable | null;
  collectibles: { found: number; total: number };
  sprint: SprintHudState | null;
  cash: number;
  inventory: InventoryState;
  outfitSelected: string;
  npcs: { active: number; total: number };
  traffic: { active: number; total: number };
  police: { active: number; total: number };
  wanted: WantedState;
  arrest: ArrestState;
  mission: MissionHudState | null;
  combat: CombatHudState | null;
  range: RangeUiState | null;
  /** Encounter zones (status, enemies left, replay cooldown). */
  encounters: EncounterState[];
  /** Combat contracts (status, wave, objective health). */
  contracts: ContractState[];
  /** The player is down (defeated in combat, not arrested). */
  downed: boolean;
}

const SPAWN = new THREE.Vector3(0, 0, 8);

// Scratch vectors for the camera math — the old version cloned
// ~6 Vector3s every frame.
const _walkTarget = new THREE.Vector3();
const _walkPos = new THREE.Vector3();
const _chaseTarget = new THREE.Vector3();
const _chasePos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camForward = new THREE.Vector3();

export class GameEngine {
  readonly input: InputState = createInputState();
  readonly quality: QualitySettings;

  private canvas: HTMLCanvasElement;
  private cb: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private lighting!: LightingHandle;
  /** G1.1 — the PMREM render target behind scene.environment; disposed in dispose(). */
  private envMapTarget: THREE.WebGLRenderTarget | null = null;
  /** G1.1 — how long the one-time PMREM pass took at boot (ms). QA hook; null before creation. */
  envMapMs: number | null = null;
  /** G1.2 Stage 1 — the static downtown probe (128²), baked once at boot; disposed in dispose(). */
  private probeTarget: THREE.WebGLRenderTarget | null = null;
  /** G1.2 Stage 1 — how long the probe bake took at boot (ms). QA hook; null before creation / on failure. */
  probeMs: number | null = null;
  private worldHandle!: WorldHandle;
  private player!: PlayerHandle;
  private vehicle!: VehicleHandle;
  private crowd!: CrowdHandle;
  private traffic!: TrafficHandle;
  private wanted!: WantedHandle;
  private police!: PoliceHandle;
  private arrest!: ArrestHandle;
  private missions!: MissionManagerHandle;
  /** The story campaign: chapters and story missions, beside the
   * job missions, with its own data, marker and save key. */
  private story!: StoryCampaignHandle;
  /** The dialogue runtime: conversations, choices, story events. */
  private dialogue!: DialogueHandle;
  /** The cinematic runtime: shots, camera poses, staged cast. */
  private cinematic!: CinematicHandle;
  /** The callback the campaign passed to openCinematic — fired
   * once when the cinematic ends, so the dialogue opens next. */
  private cinematicOnDone: (() => void) | null = null;
  /** Camera pose the last cinematic frame held — the exit blend
   * starts here. cameraRestoreT = 1 means no blend is running. */
  private lastCinematicPos = new THREE.Vector3(0, 5, 18);
  private lastCinematicTarget = new THREE.Vector3(0, 1.5, 0);
  private cameraRestoreT = 1;
  /** A contract cannot start while a job or story mission runs
   * (the global guard — one active activity at a time). */
  private contractsBlocked = false;
  private collectibles!: CollectiblesHandle;
  private sprint!: SprintHandle;
  private range!: RangeHandle;
  private combat!: CombatHandle;
  private enemies!: EnemiesHandle;
  private encounters!: EncountersHandle;
  private contracts!: ContractsHandle;
  /** The story's combat encounters (9E): data + cover for the
   * dockside fight, the beach defense waves and the warehouse
   * yard. Never registered in the Encounters zone module. */
  private storyEncounters!: StoryEncountersHandle;
  /** The story's tail car (9E): its own MissionVehicle instance,
   * starting 12 m south of the job's sedan on the same lane. */
  private storyFollowVehicle!: MissionVehicleHandle;
  /** Combat defeat (health 0) — separate from the arrest/BUSTED flow. */
  private downed = false;
  /** Encounters where the public-gunshot heat was already applied this activation. */
  private encounterShotHeat = new Set<string>();
  /** Contracts where the public-gunshot heat was already applied this activation. */
  private contractShotHeat = new Set<string>();
  /** The world-interaction registry (store, sprint start). */
  private registry = new InteractionRegistry();
  private inventory: InventoryState = loadInventory();
  private outfits: OutfitState = loadOutfitState();
  /** Per-item last-purchase time: one click buys once, a double-click
   * on the same item within 500 ms is ignored (no accidental dupes). */
  private lastShopBuyAt: Record<string, number> = {};
  private lastSprintStatus: SprintStatus = 'idle';
  private garage: GarageState = loadGarageState();
  private lastArrestState: ArrestState = 'none';
  private wantedEnabled: boolean;
  private clock = new THREE.Clock();
  // Player speed for NPC reactions (displacement per tick).
  private prevPlayerPos = new THREE.Vector3(0, 0, 8);
  private lastShadowNpcAt = 0;
  private rafId = 0;
  private running = false;
  private disposed = false;
  private invertY: boolean;
  private detachKeyboard: () => void;
  private resizeObserver: ResizeObserver;
  private parent: HTMLElement | null;

  // Walk / drive state.
  mode: DriveMode = 'walk';
  nearVehicle = false;
  nearGarage = false;
  nearInteractable: NearestInteractable | null = null;
  /** 0 = walking camera, 1 = chase camera; eases between the two. */
  private camBlend = 0;
  /** Mouse-drag orbit offset around the car while driving. */
  private chaseYawOffset = 0;
  private lastHudReport = 0;

  // Third-person orbit state. camYaw 0 puts the camera south of the
  // player looking north — up the avenue toward the Beacon Tower and
  // the parked Velocity GT, so W walks away from the camera.
  private camYaw = 0;
  private camPitch = 0.32;
  private camDistance = 8.5;

  // Adaptive quality: step down if fps stays low.
  // Frame times (seconds), newest last — FPS is 1 / mean(dt),
  // which stays truthful even when a few frames are near-instant.
  private dtSamples: number[] = [];
  private lastFpsReport = 0;
  private lastDowngradeAt = 0;
  // Shadow map on demand: the player and the car are the only
  // moving shadow casters, so the shadow pass only re-renders when
  // one of them actually moved (see tick).
  private lastShadowAnchor = new THREE.Vector3(0, 0, 8);
  /** The user's requested ambient population (Settings). The Low cap never rewrites these. */
  private requestedPedestrians: PedestrianChoice;
  private requestedTraffic: TrafficChoice;
  /** The user's saved shadow preference (Settings toggle). Effective shadows = tier allows && this. Never rewritten by tier switches. */
  private shadowsRequested: boolean;

  private constructor(
    canvas: HTMLCanvasElement,
    quality: QualitySettings,
    settings: GameSettings,
    cb: EngineCallbacks,
  ) {
    this.canvas = canvas;
    this.cb = cb;
    this.quality = quality;
    this.invertY = settings.invertY;
    this.wantedEnabled = settings.wantedEnabled;
    this.requestedPedestrians = settings.pedestrians;
    this.requestedTraffic = settings.traffic;
    this.shadowsRequested = settings.shadows;
    this.parent = canvas.parentElement;

    // Shadows render only where the tier allows them AND the user
    // wants them (see setShadows / applyQualityPreset). The tier's
    // value is never overwritten here: a saved shadows=true must not
    // re-enable them on Low, and a saved shadows=false must survive
    // a switch to High.

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1, false);
    this.renderer.shadowMap.enabled = quality.shadows && settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // The shadow map is NOT re-rendered every frame (see tick):
    // only the player and the car move, so it only re-renders when
    // one of them does. Standing still costs no shadow pass at all.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(
      62,
      (canvas.clientWidth || 1) / (canvas.clientHeight || 1),
      0.1,
      900,
    );
    this.camera.position.set(0, 5, 18);

    this.detachKeyboard = attachKeyboard(this.input);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    if (this.parent) this.resizeObserver.observe(this.parent);
    window.addEventListener('resize', this.resize);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
  }

  /** Synchronous factory — no physics WASM to initialise in Phase 1. */
  static create(
    canvas: HTMLCanvasElement,
    settings: GameSettings,
    cb: EngineCallbacks = {},
  ): GameEngine {
    const quality = detectQuality(settings.quality);
    const engine = new GameEngine(canvas, quality, settings, cb);
    try {
      engine.lighting = createLighting(engine.scene, quality);
      // G1.1 — environment map, generated ONCE from the sunset sky
      // and reused for the whole session. scene.environment lights
      // every standard/physical material (car paint, glass, rims,
      // metal) with the same sunset the player sees. It survives
      // quality rebuilds (only the world handle rebuilds, the scene
      // persists), costs no draw calls, and is never regenerated
      // per frame. far=1000: the sky dome sits at radius 600.
      {
        const t0 = performance.now();
        const pmrem = new THREE.PMREMGenerator(engine.renderer);
        const envRT = pmrem.fromScene(engine.lighting.environmentScene, 0, 0.1, 1000);
        engine.scene.environment = envRT.texture;
        engine.scene.environmentIntensity = ENVIRONMENT_INTENSITY;
        engine.envMapTarget = envRT;
        engine.envMapMs = performance.now() - t0;
        pmrem.dispose();
      }
      engine.worldHandle = buildWorld(engine.scene, quality);
      // G1.2 Stage 1 — one static downtown reflection probe (128²),
      // baked once at boot from the static city + sky. It runs here,
      // right after buildWorld, because the scene holds only the
      // lighting group and the world group at this point: nothing
      // dynamic exists yet (no player, vehicles, crowd, traffic,
      // police, markers), so there is nothing to hide from the
      // capture. The sky PMREM stays as scene.environment for
      // everything else. On failure the game continues with the sky
      // env only (probeTarget stays null).
      try {
        const baked = bakeCityProbe(engine.renderer, engine.scene, DOWNTOWN_PROBE_POSITION);
        engine.probeTarget = baked.target;
        engine.probeMs = baked.ms;
      } catch (err) {
        console.warn('[vcs] downtown probe bake failed, continuing with sky env only', err);
      }
      // The range lives on the scene (not in the world handle), so
      // a quality rebuild never wipes the targets out — but its
      // backstop, rack and sign are solid, so their boxes join the
      // collision list before the player is created.
      engine.range = createRange(engine.scene);
      engine.worldHandle.buildings.push(...engine.range.collisionBoxes());
      // The encounter zones live on the scene too (rings, signs,
      // cover objects). Their cover boxes are solid as well.
      engine.encounters = createEncounters(engine.scene);
      engine.worldHandle.buildings.push(...engine.encounters.collisionBoxes());
      // Enemies are spawned dormant (hidden, not updated) — an
      // encounter wakes them when the player walks into its zone.
      engine.enemies = createEnemies(engine.scene);
      for (const def of ENCOUNTER_DEFS) {
        engine.enemies.spawnEncounter(def.id, def.spawns, engine.encounters.coverPoints(def.id));
      }
      // Contracts live on the scene too (rings, signs, cover, the
      // beacon). Their enemies are pre-spawned dormant like the
      // encounter ones — each defense wave is its own encounter
      // id, so the engine activates one wave at a time.
      engine.contracts = createContracts(engine.scene, engine.worldHandle.buildings);
      engine.worldHandle.buildings.push(...engine.contracts.collisionBoxes());
      for (const def of CONTRACT_DEFS) {
        if (def.kind === 'elimination') {
          engine.enemies.spawnEncounter(
            def.id,
            contractSpawns(def, engine.worldHandle.buildings),
            engine.contracts.coverPoints(def.id),
          );
        } else {
          for (let w = 0; w < def.waves.length; w++) {
            const waveDef = def.waves[w];
            engine.enemies.spawnEncounter(
              waveDef.encounterId,
              contractWaveSpawns(def, w, engine.worldHandle.buildings),
              engine.contracts.coverPoints(def.id),
            );
            // Defense enemies advance on the beacon when the
            // player is not visible.
            if (def.objective) {
              engine.enemies.setObjective(waveDef.encounterId, def.objective.x, def.objective.z);
            }
          }
        }
      }
      engine.player = createPlayer(engine.scene, SPAWN, engine.worldHandle.buildings);
      // The story's combat encounters (9E): the dockside fight,
      // the beach defense waves and the warehouse yard. Their
      // enemies are pre-spawned dormant like the contract ones —
      // the campaign activates them, never a walk-in zone — and
      // the defense waves share the contract's beacon, so no
      // second objective mesh is built. The cover boxes join the
      // collision list (the defense waves reuse the contract's
      // physical cover, so they add none).
      engine.storyEncounters = createStoryEncounters(engine.scene, engine.worldHandle.buildings);
      engine.worldHandle.buildings.push(...engine.storyEncounters.boxes);
      for (const def of STORY_ENCOUNTER_DEFS) {
        if (def.kind === 'elimination') {
          engine.enemies.spawnEncounter(
            def.id,
            storyEncounterSpawns(def, engine.worldHandle.buildings),
            engine.storyEncounters.coverPoints(def.id),
          );
        } else {
          for (let w = 0; w < def.waves.length; w++) {
            const waveId = storyEncounterIds(def)[w];
            engine.enemies.spawnEncounter(
              waveId,
              storyEncounterWaveSpawns(def, w, engine.worldHandle.buildings),
              engine.storyEncounters.coverPoints(waveId),
            );
            // Defense enemies advance on the beacon when the
            // player is not visible (same objective as the
            // contract's Hold the Line).
            engine.enemies.setObjective(waveId, def.x, def.z);
          }
        }
      }
      // The active vehicle — the saved selection, or the Velocity
      // GT on a fresh save — parked at its home spot.
      engine.vehicle = engine.createActiveVehicle(
        engine.scene,
        engine.selectedHome().x,
        engine.selectedHome().z,
        engine.selectedHome().heading,
      );
      // G1.2 Stage 1 — the probe goes on the GT's paint + glass
      // when the GT is the active vehicle (any other selection keeps
      // the sky env). Re-applied after every vehicle rebuild.
      engine.applyProbeToActiveVehicle();
      // Pedestrians live on the scene, not in the world handle, so a
      // quality rebuild never wipes the crowd out.
      engine.crowd = createCrowd(engine.scene, capPedestrians(settings.pedestrians, quality.tier));
      // Traffic too — and its signal reader follows the world handle,
      // so a quality rebuild (new roads, new signal phase) is picked
      // up live without touching the fleet.
      engine.traffic = createTraffic(engine.scene, capTraffic(settings.traffic, quality.tier), () => engine.worldHandle.signals);
      // The wanted system is pure state (no scene objects); the
      // police fleet lives on the scene like the traffic does.
      engine.wanted = createWanted();
      engine.police = createPolice(
        engine.scene,
        settings.police,
        settings.pursuitDifficulty,
        () => engine.worldHandle.signals,
      );
      // Arrest is pure state (no scene objects).
      engine.arrest = createArrest();
      // Missions own their 3D marker on the scene; the definitions
      // are data, the engine only feeds the manager live state.
      engine.missions = createMissionManager(engine.scene);
      // The story's tail car (9E): its own MissionVehicle
      // instance, starting 12 m south of the job's sedan on the
      // same northbound lane, so the two cars never overlap.
      engine.storyFollowVehicle = createMissionVehicle(engine.scene, {
        start: { x: 62.5, z: -138 },
        name: 'story-target-vehicle',
      });
      // The story campaign: the same shape as the job missions
      // (its own marker, data, state machine and save key), fed
      // the same live state. Cash is the single shared balance,
      // so rewards go through the mission manager.
      engine.story = createStoryCampaign(engine.scene, {
        addCash: (amount) => engine.missions.addCash(amount),
        getCash: () => engine.missions.getCash(),
        teleport: (snap) => engine.teleportToCheckpoint(snap),
        openDialogue: (dialogueId) => engine.openDialogue(dialogueId),
        openCinematic: (cinematicId, onDone, opts) =>
          engine.openCinematic(cinematicId, onDone, opts),
        combat: {
          getEncounterEnemyIds: (encounterId) =>
            engine.enemies
              .enemyStates()
              .filter((e) => e.encounterId === encounterId)
              .map((e) => e.id),
          activateEncounter: (id) => engine.enemies.activateEncounter(id),
          deactivateEncounter: (id) => engine.enemies.deactivateEncounter(id),
          resetEncounter: (id) => engine.enemies.resetEncounter(id),
          setObjective: (id, x, z) => engine.enemies.setObjective(id, x, z),
          clearObjective: (id) => engine.enemies.clearObjective(id),
          // The contract's getObjectiveHealth returns null
          // unless the defense contract is active — the story
          // defense reads the same beacon through the defense
          // entry's state, which reports its health regardless.
          getObjectiveHealth: () => {
            const s = engine.contracts
              .getState()
              .find((d) => d.kind === 'defense');
            return s ? { health: s.objectiveHealth, max: s.objectiveMax } : null;
          },
          resetObjective: () => engine.contracts.resetObjective(),
        },
        followVehicle: engine.storyFollowVehicle,
        grantVehicle: (vehicleId) => engine.grantStoryVehicle(vehicleId),
        grantOutfit: (outfitId) => engine.grantStoryOutfit(outfitId),
        getSelectedVehicleId: () => engine.garage.selected,
      });
      // Dialogue: the conversation runtime. The engine pauses
      // while a dialogue is open (openDialogue stops the loop;
      // closeDialogue restarts it), so no timer runs and no
      // other activity can start mid-conversation.
      engine.dialogue = createDialogue({
        hasFlag: (flag) => engine.story.hasFlag(flag),
        onEvent: (event) => engine.handleDialogueEvent(event),
        onClose: () => engine.closeDialogue(),
        onReport: () => engine.reportDialogue(),
      });
      // Cinematic: the scene runtime. Unlike a dialogue, the
      // engine KEEPS ticking during a cinematic — the camera
      // has to move — but the tick freezes gameplay (see tick)
      // and hands the camera to the cinematic until it ends.
      engine.cinematic = createCinematic({
        scene: engine.scene,
        camera: engine.camera,
        getPlayerPos: () => engine.player.position,
        getVehiclePos: () => engine.vehicle.position,
        isDialogueOpen: () => engine.dialogue.isOpen(),
        openDialogue: (dialogueId) => engine.openDialogue(dialogueId),
        onEvent: (event) => engine.handleDialogueEvent(event),
        onComplete: () => engine.closeCinematic(),
        onReport: () => engine.reportCinematic(),
      });
      // Collectibles and the sprint live on the scene too, so a
      // quality rebuild never wipes them out.
      engine.collectibles = createCollectibles(engine.scene);
      engine.sprint = createSprint(engine.scene);
      // Combat: the weapon model hangs off the protagonist's right
      // hand; the shot ray runs through the crosshair. Firing is
      // gated by the engine's locks (on foot, no arrest, no sprint,
      // engine running) — panels pause the engine, so a panel open
      // means no firing, for free.
      engine.combat = createCombat(engine.scene, engine.player.mesh, {
        camera: engine.camera,
        getBuildings: () => engine.worldHandle.buildings,
        range: engine.range,
        canFireNow: () =>
          engine.mode === 'walk' &&
          engine.arrest.getState() === 'none' &&
          !engine.sprint.isRunning() &&
          !engine.downed &&
          engine.running &&
          !engine.disposed,
        onReport: () => engine.reportCombat(),
        getEnemies: () => engine.enemies.hitTargets(),
        onEnemyHit: (id, damage) => engine.enemies.damageEnemy(id, damage),
        onShot: () => {
          // The shot's sound comes from the player (the camera
          // sits 8.5 m behind them, so its position would shrink
          // the hearing radius by that much).
          engine.enemies.onPlayerShot(engine.player.position.x, engine.player.position.z);
          // Firing a weapon inside an active public encounter is
          // a visible offence: +4 heat, once per activation.
          // The range stays safe (no encounter is active there).
          const active = engine.encounters.getState().filter((s) => s.status === 'active');
          for (const s of active) {
            if (!engine.encounterShotHeat.has(s.id)) {
              engine.encounterShotHeat.add(s.id);
              engine.wanted.addHeat(4);
            }
          }
          // Same rule for an active combat contract.
          const activeContracts = engine.contracts.getState().filter((s) => s.status === 'active');
          for (const s of activeContracts) {
            if (!engine.contractShotHeat.has(s.id)) {
              engine.contractShotHeat.add(s.id);
              engine.wanted.addHeat(4);
            }
          }
        },
      });
      // The saved outfit, on the live protagonist from the start.
      engine.player.applyOutfit(
        getOutfit(engine.outfits.selected) ?? OUTFIT_DEFS[0],
      );
      // World interactables: the store entrance and the sprint
      // start. The registry only finds the nearest one; the
      // engine's E chain decides priority (mission, garage, then
      // the nearest registered interactable, then the car).
      engine.registry.register({
        id: 'sunset-mart',
        name: 'Sunset Mart',
        x: STORE_ENTRANCE.x,
        z: STORE_ENTRANCE.z,
        radius: 4.5,
        prompt: 'Enter Sunset Mart',
        available: () => true,
        onInteract: () => engine.cb.onShopEnter?.(),
      });
      engine.registry.register({
        id: 'sunset-sprint',
        name: 'Sunset Sprint',
        x: SPRINT_START.x,
        z: SPRINT_START.z,
        radius: 4.5,
        prompt: 'Start Sunset Sprint',
        available: () => !engine.sprint.isRunning(),
        onInteract: () => {
          if (engine.sprint.start()) engine.reportSprint();
        },
      });
      engine.registry.register({
        id: 'sunset-range',
        name: 'Sunset Range',
        x: RANGE_RACK.x,
        z: RANGE_RACK.z,
        radius: 4.5,
        prompt: 'Open Sunset Range',
        available: () => true,
        onInteract: () => engine.cb.onRangeEnter?.(),
      });
      engine.updateCamera(0);
      cb.onReady?.(quality);
    } catch (err) {
      engine.dispose();
      throw err instanceof Error ? err : new Error('Failed to start the game engine.');
    }
    return engine;
  }

  start(): void {
    if (this.running || this.disposed) return;
    // Inputs pressed while the engine was stopped (a panel open,
    // a dialogue running) must not fire on resume: the E that
    // advanced a dialogue would otherwise enter the nearest car
    // or open the nearest shop on the first frame back. The
    // one-shot queues are the only stale state — held keys
    // (WASD, Space) clear themselves on keyup.
    this.input.interactQueued = false;
    this.input.surrenderQueued = false;
    this.input.reloadQueued = false;
    this.input.switchToWeapon = null;
    this.input.cycleWeaponQueued = false;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running || this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      this.tick();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /** Live settings from the pause menu: shadows apply immediately. */
  setShadows(enabled: boolean): void {
    // The toggle is a preference, not the tier: shadows render only
    // where the tier allows them AND the user wants them. The tier's
    // value is never overwritten, so Low keeps shadows off no matter
    // what was saved, and switching tiers restores the preference.
    this.shadowsRequested = enabled;
    const effective = enabled && this.quality.shadows;
    this.renderer.shadowMap.enabled = effective;
    this.lighting.setShadows(effective);
    if (effective) this.renderer.shadowMap.needsUpdate = true;
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.material.needsUpdate = true;
    });
  }

  /**
   * Apply a graphics preset immediately — renderer settings live,
   * and the city rebuilds at the new tier (building/palm counts)
   * with the player and the car kept exactly where they were.
   * A manual preset change and the auto step-down both go through
   * here, so a downgrade can never leave a High city on a Low tier.
   */
  applyQualityPreset(tier: QualityTier): void {
    if (tier === this.quality.tier) return;
    const next = settingsForTier(tier);
    const wasDriving = this.mode === 'drive';
    const playerPos = this.player.position.clone();
    const vehiclePos = this.vehicle.position.clone();
    const vehicleHeading = this.vehicle.heading;
    const vehicleSpeed = this.vehicle.speed;

    this.player.dispose();
    this.vehicle.dispose();
    this.worldHandle.dispose();

    Object.assign(this.quality, next);
    // The Low cap lives on the effective population, not the saved
    // setting: re-apply it for the new tier so a switch to Low drops
    // the ambient crowd/traffic and a switch back restores them.
    this.crowd?.setCount(capPedestrians(this.requestedPedestrians, tier));
    this.traffic?.setCount(capTraffic(this.requestedTraffic, tier));
    this.renderer.setPixelRatio(next.pixelRatio);
    // Shadows follow the new tier AND the saved preference: switching
    // to High with shadows=false keeps them off; switching to Low
    // turns them off even with shadows=true saved.
    const shadowsOn = next.shadows && this.shadowsRequested;
    this.renderer.shadowMap.enabled = shadowsOn;
    this.lighting.setShadows(shadowsOn);
    this.lighting.sun.shadow.mapSize.set(next.shadowMapSize, next.shadowMapSize);
    if (this.lighting.sun.shadow.map) {
      this.lighting.sun.shadow.map.dispose();
      this.lighting.sun.shadow.map = null;
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = next.fogNear;
      this.scene.fog.far = next.fogFar;
    }
    this.worldHandle = buildWorld(this.scene, this.quality);
    // The range survives a rebuild (it lives on the scene), but the
    // fresh collision list does not carry its boxes — re-add them
    // before the player is created against that list.
    this.worldHandle.buildings.push(...this.range.collisionBoxes());
    // The encounter cover boxes are the same: scene-owned, but
    // their collision entries live on the fresh world list.
    this.worldHandle.buildings.push(...this.encounters.collisionBoxes());
    // And the contract cover boxes + the objective.
    this.worldHandle.buildings.push(...this.contracts.collisionBoxes());
    // And the story encounter cover boxes (9E).
    this.worldHandle.buildings.push(...this.storyEncounters.boxes);
    this.player = createPlayer(this.scene, playerPos, this.worldHandle.buildings);
    this.vehicle = this.createActiveVehicle(this.scene, vehiclePos.x, vehiclePos.z, vehicleHeading);
    this.vehicle.setSpeed(vehicleSpeed);
    // G1.2 Stage 1 — the probe texture survives the rebuild (it is
    // engine-owned), but the vehicle is new, so re-apply it when the
    // GT is the active vehicle. No re-bake in Stage 1.
    this.applyProbeToActiveVehicle();
    // The weapon model hung off the old protagonist; hang it off
    // the new one. The outfit is re-applied too — a rebuild used
    // to drop it back to the default hoodie.
    this.combat.reattachWeapon(this.player.mesh);
    this.player.applyOutfit(getOutfit(this.outfits.selected) ?? OUTFIT_DEFS[0]);
    if (wasDriving) this.player.mesh.visible = false;
    // A surrendered player keeps the hands-up lock across the
    // rebuild (the arrest state survives; the player object does not).
    // A mere prompt does not lock anything, so it is not re-applied.
    if (this.arrest) {
      const a = this.arrest.getState();
      if (a === 'surrendering' || a === 'busted') this.player.setSurrendered(true);
    }
    this.lastShadowAnchor.copy(wasDriving ? vehiclePos : playerPos);
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
    this.cb.onQualityChange?.(next);
  }

  setInvertY(invert: boolean): void {
    this.invertY = invert;
  }

  /** Pedestrian population applies live (Settings panel). */
  setPedestrianCount(choice: PedestrianChoice): void {
    this.requestedPedestrians = choice;
    this.crowd?.setCount(capPedestrians(choice, this.quality.tier));
  }

  /** Traffic density applies live (Settings panel). */
  setTrafficDensity(choice: TrafficChoice): void {
    this.requestedTraffic = choice;
    this.traffic?.setCount(capTraffic(choice, this.quality.tier));
  }

  /** Police activity applies live (Settings panel). */
  setPoliceCount(choice: PoliceChoice): void {
    this.police?.setCount(choice);
  }

  /** Pursuit difficulty applies live (Settings panel). */
  setPursuitDifficulty(difficulty: PursuitDifficulty): void {
    this.police?.setDifficulty(difficulty);
  }

  /** Wanted system toggle applies live (Settings panel). */
  setWantedEnabled(enabled: boolean): void {
    this.wantedEnabled = enabled;
    // Wanted off means no arrest either — clear any prompt or
    // sequence in progress rather than leaving it stranded.
    if (!enabled) this.arrest?.reset();
  }

  getStats(): EngineStats {
    const driving = this.mode === 'drive';
    const collectibleState = this.collectibles
      ? this.collectibles.getState()
      : { found: 0, total: 0, items: [] };
    return {
      fps: this.meanFps(),
      quality: this.quality,
      position: driving
        ? this.vehicle.position.clone()
        : this.player
          ? this.player.position.clone()
          : SPAWN.clone(),
      heading: driving
        ? this.vehicle.heading
        : this.player
          ? this.player.mesh.rotation.y
          : 0,
      mode: this.mode,
      speedKmh: this.vehicle ? this.vehicle.speedKmh() : 0,
      gear: this.vehicle ? this.vehicle.gear() : 'N',
      nearVehicle: this.nearVehicle,
      nearGarage: this.nearGarage,
      nearInteractable: this.nearInteractable,
      collectibles: { found: collectibleState.found, total: collectibleState.total },
      sprint: this.sprint ? this.sprint.getHudState() : null,
      cash: this.missions ? this.missions.getCash() : 0,
      inventory: { ...this.inventory },
      outfitSelected: this.outfits.selected,
      npcs: this.crowd
        ? { active: this.crowd.activeCount(), total: this.crowd.totalCount() }
        : { active: 0, total: 0 },
      traffic: this.traffic
        ? { active: this.traffic.activeCount(), total: this.traffic.totalCount() }
        : { active: 0, total: 0 },
      police: this.police
        ? { active: this.police.activeCount(), total: this.police.totalCount() }
        : { active: 0, total: 0 },
      wanted: this.wanted
        ? this.wanted.getState()
        : { level: 0, heat: 0, status: 'clear', escapeProgress: 0, lastKnown: null, seen: false },
      arrest: this.arrest ? this.arrest.getState() : 'none',
      mission: this.missions ? this.missions.getHudState() : null,
      combat: this.combat ? this.combat.getHudState() : null,
      range: this.combat && this.missions ? this.getRangeState() : null,
      encounters: this.getEncounterState(),
      contracts: this.getContractState(),
      downed: this.downed,
    };
  }

  /** Encounter HUD state, with the enemies still standing filled in. */
  getEncounterState(): EncounterState[] {
    const states = this.encounters ? this.encounters.getState() : [];
    if (!this.enemies) return states;
    const infos = this.enemies.enemyStates();
    return states.map((s) => ({
      ...s,
      remaining: infos.filter((e) => e.encounterId === s.id && e.state !== 'defeated' && e.active).length,
    }));
  }

  /** Encounter HUD state, ~10x a second while it matters. */
  private reportEncounter(): void {
    this.cb.onEncounter?.(this.getEncounterState());
  }

  /**
   * Encounter lifecycle, run every tick:
   * - Completion first: every enemy in an active encounter
   *   defeated → pay the reward (cash only on the first
   *   completion), restock the ammo, and put the zone to sleep.
   * - Trigger: walking into a zone (on foot, not downed, no
   *   arrest) wakes its enemies for a fresh attempt.
   * - Leave: walking out mid-fight ends the attempt and resets
   *   the encounter, so the player can always walk away.
   */
  private updateEncounters(): void {
    const states = this.encounters.getState();
    for (const s of states) {
      if (s.status !== 'active') continue;
      const infos = this.enemies.enemyStates().filter((e) => e.encounterId === s.id);
      if (infos.length > 0 && infos.every((e) => e.state === 'defeated')) {
        const def = ENCOUNTER_DEFS.find((d) => d.id === s.id);
        if (!def) continue;
        const first = this.encounters.markComplete(s.id);
        this.enemies.deactivateEncounter(s.id);
        this.encounterShotHeat.delete(s.id);
        if (first) this.missions.addCash(def.rewardCash);
        this.combat.restockAmmo();
        this.reportEncounter();
        this.reportDriveHud();
        this.reportCombat();
      }
    }
    const inZone = this.encounters.encounterAt(this.player.position.x, this.player.position.z);
    for (const s of this.encounters.getState()) {
      const isIn = inZone?.id === s.id;
      if (
        isIn &&
        s.status !== 'active' &&
        s.status !== 'cooling' &&
        this.mode === 'walk' &&
        !this.downed &&
        this.arrest.getState() === 'none'
      ) {
        this.encounters.setActive(s.id, true);
        this.enemies.resetEncounter(s.id);
        this.enemies.activateEncounter(s.id);
        this.encounterShotHeat.delete(s.id);
        this.reportEncounter();
      } else if (!isIn && s.status === 'active') {
        this.encounters.setActive(s.id, false);
        this.enemies.deactivateEncounter(s.id);
        this.enemies.resetEncounter(s.id);
        this.encounterShotHeat.delete(s.id);
        this.reportEncounter();
      }
    }
  }

  /** Contract HUD state, with the enemies still standing filled in. */
  getContractState(): ContractState[] {
    const states = this.contracts ? this.contracts.getState() : [];
    if (!this.enemies) return states;
    const infos = this.enemies.enemyStates();
    return states.map((s) => {
      const ids =
        s.kind === 'defense'
          ? this.contracts.waveEncounterIds(s.id)
          : [this.contracts.eliminationEncounterId(s.id)];
      return {
        ...s,
        blocked: this.contractsBlocked,
        remaining: infos.filter(
          (e) => ids.includes(e.encounterId) && e.state !== 'defeated' && e.active,
        ).length,
      };
    });
  }

  /** Contract HUD state, ~10x a second while it matters. */
  private reportContract(): void {
    this.cb.onContract?.(this.getContractState());
  }

  /** Accept a contract from the mission board (false when cooling / active). */
  acceptContract(id: string): boolean {
    const ok = this.contracts.accept(id);
    if (ok) this.reportContract();
    return ok;
  }

  /** Abandon the accepted / active contract (only one can run at a time). */
  abandonContract(): void {
    for (const s of this.contracts.getState()) {
      if (s.status !== 'accepted' && s.status !== 'active') continue;
      this.resetContractEnemies(s.id);
      this.contracts.abandon(s.id);
      this.contractShotHeat.delete(s.id);
    }
    this.reportContract();
  }

  /** Deactivate + reset every enemy belonging to a contract. */
  private resetContractEnemies(contractId: string): void {
    const def = CONTRACT_DEFS.find((d) => d.id === contractId);
    if (!def) return;
    const ids =
      def.kind === 'defense' ? def.waves.map((w) => w.encounterId) : [def.id];
    for (const id of ids) {
      this.enemies.deactivateEncounter(id);
      this.enemies.resetEncounter(id);
    }
    if (def.kind === 'defense') this.contracts.resetObjective();
  }

  private completeContract(id: string): void {
    const def = CONTRACT_DEFS.find((d) => d.id === id);
    if (!def) return;
    const first = this.contracts.markComplete(id);
    this.resetContractEnemies(id);
    this.contractShotHeat.delete(id);
    if (first) this.missions.addCash(def.rewardCash);
    this.combat.restockAmmo();
    this.reportContract();
    this.reportDriveHud();
    this.reportCombat();
  }

  private failContract(id: string): void {
    this.contracts.markFailed(id);
    this.resetContractEnemies(id);
    this.contractShotHeat.delete(id);
    this.reportContract();
  }

  /**
   * Contract lifecycle, run every tick (mirrors updateEncounters):
   * - Trigger: an accepted contract starts when the player walks
   *   into its zone (defense starts wave 1).
   * - Completion: elimination clears when all designated enemies
   *   are defeated; defense clears when the last wave is cleared.
   * - Waves: a cleared wave starts an 8 s recovery, then the
   *   next wave spawns from a different direction.
   * - Failure: the defense objective reaching zero health.
   * - Leave: walking out mid-fight ends the attempt and resets
   *   it to accepted, so the player can always walk away.
   */
  private updateContracts(): void {
    const states = this.contracts.getState();
    const infos = this.enemies.enemyStates();
    const inZone = this.contracts.contractAt(this.player.position.x, this.player.position.z);
    // The global guard: a contract cannot start while a job or
    // story mission is active. Accepting from the board is still
    // allowed — only the zone start is refused.
    const canStart =
      this.mode === 'walk' &&
      !this.downed &&
      this.arrest.getState() === 'none' &&
      !this.contractsBlocked;

    for (const s of states) {
      const def = CONTRACT_DEFS.find((d) => d.id === s.id);
      if (!def) continue;
      const isIn = inZone?.id === s.id;

      // Trigger: an accepted contract starts on entering its zone.
      if (s.status === 'accepted' && isIn && canStart) {
        this.contracts.setActive(s.id, true);
        this.contractShotHeat.delete(s.id);
        if (def.kind === 'elimination') {
          this.enemies.resetEncounter(def.id);
          this.enemies.activateEncounter(def.id);
        } else {
          const waveId = this.contracts.advanceWave(s.id);
          if (waveId) {
            this.enemies.resetEncounter(waveId);
            this.enemies.activateEncounter(waveId);
          }
        }
        this.reportContract();
        continue;
      }

      if (s.status !== 'active') continue;

      // Defense: the beacon was destroyed.
      if (def.kind === 'defense') {
        const obj = this.contracts.getObjectiveHealth();
        if (obj && obj.health <= 0) {
          this.failContract(s.id);
          continue;
        }
      }

      // Completion / wave progression.
      if (def.kind === 'elimination') {
        const all = infos.filter((e) => e.encounterId === def.id);
        if (all.length > 0 && all.every((e) => e.state === 'defeated')) {
          this.completeContract(s.id);
        }
      } else {
        const waveId = this.contracts.currentWaveEncounterId(s.id);
        if (waveId) {
          const waveEnemies = infos.filter((e) => e.encounterId === waveId);
          if (waveEnemies.length > 0 && waveEnemies.every((e) => e.state === 'defeated')) {
            if (s.wave >= s.totalWaves) {
              this.completeContract(s.id);
            } else if (s.waveState === 'fighting') {
              this.contracts.startRecovery(s.id);
              this.reportContract();
            }
          }
        }
        // Recovery expired: spawn the next wave.
        if (s.waveState === 'recovery' && s.recoveryLeft <= 0) {
          const nextId = this.contracts.advanceWave(s.id);
          if (nextId) {
            this.enemies.resetEncounter(nextId);
            this.enemies.activateEncounter(nextId);
            this.reportContract();
          }
        }
      }

      // Re-read: a completion / failure above already settled it.
      const fresh = this.contracts.getState().find((c) => c.id === s.id);
      if (!fresh || fresh.status !== 'active') continue;

      // Leave: walking out mid-fight ends the attempt (fresh on re-entry).
      if (!isIn) {
        this.contracts.setActive(s.id, false);
        this.resetContractEnemies(s.id);
        this.contracts.leave(s.id);
        this.contractShotHeat.delete(s.id);
        this.reportContract();
      }
    }
  }

  private reportDriveHud(): void {
    const collectibleState = this.collectibles
      ? this.collectibles.getState()
      : { found: 0, total: 0, items: [] };
    this.cb.onDrive?.({
      mode: this.mode,
      nearVehicle: this.nearVehicle,
      nearGarage: this.nearGarage,
      nearInteractable: this.nearInteractable,
      collectibles: { found: collectibleState.found, total: collectibleState.total },
      speedKmh: this.vehicle.speedKmh(),
      gear: this.vehicle.gear(),
      vehicleName: this.vehicle.name,
    });
    this.cb.onWanted?.(this.wanted.getState());
    this.cb.onMission?.(this.missions.getHudState());
  }

  /** Sprint HUD state, on change and while a run is live. */
  private reportSprint(): void {
    const state = this.sprint.getHudState();
    this.lastSprintStatus = state.status;
    this.cb.onSprint?.(state);
  }

  /** Combat HUD state (weapon, ammo, health, hits). */
  private reportCombat(): void {
    if (this.combat) this.cb.onCombat?.(this.combat.getHudState());
  }

  /** The range panel's state (weapons, cash, range stats). */
  getRangeState(): RangeUiState {
    const ws = this.combat.getWeaponState();
    const hud = this.combat.getHudState();
    return {
      cash: this.missions.getCash(),
      weapons: WEAPON_DEFS.map((def) => ({
        id: def.id,
        name: def.name,
        category: def.category,
        damage: def.damage,
        fireInterval: def.fireInterval,
        auto: def.auto,
        magSize: def.magSize,
        reloadSeconds: def.reloadSeconds,
        range: def.range,
        ammoType: def.ammoType,
        price: def.price,
        description: def.description,
        owned: ws.owned.includes(def.id),
        equipped: ws.equipped === def.id,
        reserve: ws.reserve[def.id],
      })),
      shots: hud.shots,
      hits: hud.hits,
      accuracy: hud.accuracy,
      totalHits: hud.totalHits,
      totalShots: hud.totalShots,
    };
  }

  /** Buy a weapon at the range rack: cash through the manager, ownership through combat. */
  rangeBuyWeapon(id: string): { ok: boolean; reason?: string } {
    if (this.disposed) return { ok: false, reason: 'unavailable' };
    const def = getWeapon(id);
    if (!def) return { ok: false, reason: 'unknown' };
    if (this.combat.getWeaponState().owned.includes(def.id)) {
      return { ok: false, reason: 'already-owned' };
    }
    if (!this.missions.spendCash(def.price)) return { ok: false, reason: 'insufficient' };
    this.combat.addOwned(def.id);
    return { ok: true };
  }

  /** Equip an owned weapon (live, on the protagonist at once). */
  rangeEquipWeapon(id: string): boolean {
    if (this.disposed) return false;
    return this.combat.switchWeapon(id as WeaponId);
  }

  /** Refill both weapons' reserves to their starting counts (free, at the rack). */
  rangeRestock(): void {
    if (this.disposed) return;
    this.combat.restockAmmo();
  }

  /** E on desktop, the ENTER/EXIT button on mobile. */
  tryInteract(): void {
    if (this.disposed) return;
    if (this.cinematic.isActive()) return;
    // A surrendered player cannot climb into the car mid-arrest.
    const a = this.arrest?.getState();
    if (a === 'surrendering' || a === 'busted') return;
    if (this.mode === 'walk' && this.nearVehicle) this.enterVehicle();
    else if (this.mode === 'drive') this.exitVehicle();
  }

  /** F on desktop, the SURRENDER button on mobile. */
  trySurrender(): void {
    if (this.disposed) return;
    this.arrest?.trySurrender();
  }

  /** Touch FIRE button: hold to fire (automatic weapons) / press per shot. */
  setCombatFiring(held: boolean): void {
    if (this.disposed) return;
    this.combat?.setFiring(held);
  }

  /** Touch FIRE button press: one shot (semi-automatic weapons). */
  fireCombatWeapon(): void {
    if (this.disposed) return;
    this.combat?.tryFire();
  }

  /** Touch RELOAD button. */
  reloadCombatWeapon(): void {
    if (this.disposed) return;
    this.combat?.reload();
  }

  /** Touch SWITCH button: cycle to the next owned weapon. */
  cycleCombatWeapon(): void {
    if (this.disposed) return;
    this.combat?.cycleWeapon();
  }

  /** E / START on the mission marker: accept the job. The guard
   * is checked live here, not just once per tick: a contract
   * flips to active late in the tick (updateContracts), after
   * applyActivityGuard has run, so a cached blocked flag alone
   * leaves a one-tick window where a second start slips
   * through. */
  tryMissionInteract(): boolean {
    if (this.disposed) return false;
    if (this.cinematic.isActive()) return false;
    const activity = this.getActiveActivity();
    if (activity === 'story' || activity === 'contract') return false;
    const accepted = this.missions.tryInteract();
    if (accepted) {
      // Escape jobs start with a controlled wanted level, on the
      // existing wanted system — never a second one. Respects the
      // player's wanted toggle: off means no police come.
      const def = this.missions.getSelectedDef();
      if (def.startHeat !== undefined && this.wantedEnabled) {
        this.wanted.setHeat(def.startHeat);
      }
    }
    return accepted;
  }

  /** Pick a mission from the board (false when locked or a run is active). */
  selectMission(id: string): boolean {
    if (this.disposed) return false;
    const ok = this.missions.selectMission(id);
    if (ok) this.reportDriveHud();
    return ok;
  }

  /** The mission board state (rows, cash, locks). */
  getMissionBoard(): MissionBoardState {
    return this.missions.getBoardState();
  }

  /**
   * The global guard: at most one of a job mission, a story
   * mission and a contract is active at a time. Each subsystem
   * is blocked only while a DIFFERENT one is active, so each
   * keeps its own behaviour — the guard only refuses a second
   * start.
   */
  private getActiveActivity(): 'none' | 'job' | 'story' | 'contract' {
    if (this.missions.getHudState().state === 'active') return 'job';
    if (this.story.getHudState().state === 'active') return 'story';
    if (this.contracts.getState().some((s) => s.status === 'active'))
      return 'contract';
    return 'none';
  }

  private applyActivityGuard(): void {
    const activity = this.getActiveActivity();
    this.missions.setBlocked(activity === 'story' || activity === 'contract');
    this.story.setBlocked(activity === 'job' || activity === 'contract');
    this.contractsBlocked = activity === 'job' || activity === 'story';
  }

  /** Accept a story mission at its teal marker (E). The guard
   * is checked live here, for the same one-tick reason as
   * tryMissionInteract: a contract can go active after the
   * per-tick guard has run. */
  tryStoryInteract(): boolean {
    if (this.disposed) return false;
    if (this.cinematic.isActive()) return false;
    const activity = this.getActiveActivity();
    if (activity === 'job' || activity === 'contract') return false;
    // Start heat applies only when the mission was available
    // before the press (9E): a mid-mission dialogue must not
    // re-apply it.
    const wasAvailable = this.story.getHudState().state === 'available';
    const accepted = this.story.tryInteract();
    if (accepted && wasAvailable) {
      // Story jobs start with a controlled wanted level, on the
      // existing wanted system — never a second one. Respects
      // the player's wanted toggle: off means no police come.
      const def = this.story.getSelectedDef();
      if (def.startHeat !== undefined && this.wantedEnabled) {
        this.wanted.setHeat(def.startHeat);
      }
    }
    return accepted;
  }

  /** Pick a story mission from the board (false when locked or a run is active). */
  selectStoryMission(id: string): boolean {
    if (this.disposed) return false;
    const ok = this.story.selectMission(id);
    if (ok) this.reportStory();
    return ok;
  }

  /** The story board state (chapters, rows, cash, locks). */
  getStoryBoard(): StoryBoardState {
    return this.story.getBoardState();
  }

  /** Story HUD state, ~10x a second while it matters. */
  private reportStory(): void {
    this.cb.onStory?.(this.story.getHudState());
  }

  /** Abandon the active story mission (back to available). */
  cancelStoryMission(): void {
    this.story.cancel();
    this.reportStory();
  }

  /** Restart the active / failed story mission from the beginning. */
  retryStoryMission(): void {
    this.story.retry();
    this.reportStory();
  }

  /** Restart from the latest checkpoint (false when there is none). */
  retryStoryMissionFromCheckpoint(): boolean {
    const ok = this.story.retryFromCheckpoint();
    if (ok) this.reportStory();
    return ok;
  }

  /** Replay a completed / failed story mission. */
  replayStoryMission(): void {
    this.story.replay();
    this.reportStory();
  }

  /** Leave the story complete screen (back to available). */
  continueStoryMission(): void {
    this.story.continueAfterComplete();
    this.reportStory();
  }

  /** Leave the story failed screen (back to available). */
  dismissStoryMissionFailed(): void {
    this.story.dismissFailed();
    this.reportStory();
  }

  /**
   * Open a dialogue (called by the story campaign when the
   * player accepts a dialogue objective). The engine pauses
   * while it is open — the world freezes, no timer runs, and
   * no other activity can start, because the tick never runs.
   * Returns true when a dialogue is showing afterwards (just
   * opened, or already open — a second E while the panel is
   * up must not fall through to the campaign's accept
   * fallback), false only when the dialogue cannot start.
   */
  openDialogue(dialogueId: string): boolean {
    if (this.disposed) return false;
    if (this.dialogue.isOpen()) return true;
    this.stop();
    const ok = this.dialogue.start(dialogueId);
    if (!ok) {
      this.start();
      return false;
    }
    this.reportDialogue();
    return true;
  }

  /** The dialogue closed (finished, skipped, or invalid data):
   * resume the engine and clear the panel. Every exit path
   * goes through here, so the game can never be left paused
   * with no dialogue running. */
  private closeDialogue(): void {
    if (this.disposed) return;
    this.start();
    this.reportDialogue();
    this.reportStory();
  }

  /** Carry out one dialogue event. Each event type maps to one
   * existing subsystem call — nothing new is invented here.
   * Events fire exactly once: the runtime enters each node
   * once per run, and the campaign's accept is itself guarded
   * (a second completeObjective is a no-op). */
  private handleDialogueEvent(event: DialogueEvent): void {
    if (this.disposed) return;
    switch (event.type) {
      case 'setFlag':
        this.story.setFlag(event.flag, event.value ?? true);
        this.reportStory();
        break;
      case 'giveCash':
        this.missions.addCash(event.amount);
        this.reportDriveHud();
        break;
      case 'completeObjective':
        this.story.onDialogueComplete(event.objectiveId);
        this.reportStory();
        break;
      case 'setWanted':
        if (this.wantedEnabled) this.wanted.setHeat(event.heat);
        break;
      case 'startStoryMission':
        this.story.selectMission(event.missionId);
        this.reportStory();
        break;
    }
  }

  /** Dialogue state, on every transition. */
  private reportDialogue(): void {
    this.cb.onDialogue?.(this.dialogue.getState());
  }

  /**
   * Play a cinematic (called by the story campaign before a
   * dialogue objective's conversation). Refuses when the game
   * is disposed, a cinematic or dialogue is already open, or
   * another activity is running — the campaign then falls
   * through to the dialogue. `onDone` fires exactly once when
   * the cinematic ends, complete or skipped.
   *
   * Scoped carve-out (approved WS6): when `opts.storyMissionId`
   * is given, the cinematic may play while that story mission —
   * and only that mission — is active, and only on the dialogue
   * objective that carries this cinematic. Every other active
   * activity still refuses. Today exactly one objective can
   * satisfy this (Lena's `talk-lena` in DEAD DROP).
   */
  openCinematic(
    cinematicId: string,
    onDone: () => void,
    opts?: { storyMissionId?: string },
  ): boolean {
    if (this.disposed) return false;
    if (this.cinematic.isActive()) return false;
    if (this.dialogue.isOpen()) return false;
    if (this.getActiveActivity() !== 'none') {
      const allowed =
        opts?.storyMissionId !== undefined &&
        this.getActiveActivity() === 'story' &&
        this.story.getHudState().missionId === opts.storyMissionId &&
        this.story.getCurrentObjective()?.type === 'dialogue' &&
        this.story.getCurrentObjective()?.cinematicId === cinematicId;
      if (!allowed) return false;
    }
    const ok = this.cinematic.start(cinematicId);
    if (!ok) return false;
    this.cinematicOnDone = onDone;
    this.reportCinematic();
    return true;
  }

  /**
   * The cinematic ended (complete or skipped): blend the camera
   * back to the orbit / chase view, clear the panel, and hand
   * control to the campaign's callback — which opens the
   * dialogue. Every exit path goes through here, so the game
   * can never be left in cinematic mode with no scene running.
   */
  private closeCinematic(): void {
    if (this.disposed) return;
    this.cameraRestoreT = 0;
    const onDone = this.cinematicOnDone;
    this.cinematicOnDone = null;
    this.reportCinematic();
    this.reportStory();
    onDone?.();
  }

  /** Skip the active cinematic (the Skip button / Esc). A no-op
   * when none is playing; the runtime refuses while a dialogue
   * is open inside the scene. */
  skipCinematic(): void {
    this.cinematic.skip();
  }

  /** Is a cinematic playing right now? (QA + UI gates.) */
  isCinematicActive(): boolean {
    return this.cinematic.isActive();
  }

  /**
   * Play a mission-complete outro cinematic (9E): the Chapter 2
   * outro and the two branch endings play from the complete
   * screen's Continue button, after the reward is banked. The
   * activity guard passes — the mission is 'complete', not
   * 'active' — and skipping is safe: the ending is already
   * recorded in the save. Returns false when the cinematic
   * cannot start, and the caller continues without it.
   */
  playStoryOutro(cinematicId: string, onDone: () => void): boolean {
    if (this.disposed) return false;
    return this.openCinematic(cinematicId, onDone);
  }

  /** Cinematic state, on every transition. */
  private reportCinematic(): void {
    this.cb.onCinematic?.(this.cinematic.getState());
  }

  /** Dialogue controls, for the panel (keyboard and touch). */
  dialogueAdvance(): void {
    if (this.disposed) return;
    this.dialogue.advance();
  }

  dialogueChoose(index: number): void {
    if (this.disposed) return;
    this.dialogue.choose(index);
  }

  dialogueSkip(): void {
    if (this.disposed) return;
    this.dialogue.skip();
  }

  isDialogueOpen(): boolean {
    return this.dialogue?.isOpen() ?? false;
  }

  /**
   * Teleport the player (and the car, if driving) to a checkpoint
   * snapshot. The checkpoint is taken from live state, so the
   * positions are always on open ground; the camera is re-aimed
   * so the first frame after the teleport already faces the
   * right way.
   */
  private teleportToCheckpoint(snap: {
    playerPos: { x: number; z: number };
    vehiclePos: { x: number; z: number } | null;
    driving: boolean;
    heading: number;
  }): void {
    this.player.position.set(snap.playerPos.x, 0, snap.playerPos.z);
    this.player.mesh.position.set(snap.playerPos.x, 0, snap.playerPos.z);
    this.player.mesh.rotation.y = snap.heading;
    if (snap.driving && snap.vehiclePos) {
      this.vehicle.position.set(snap.vehiclePos.x, 0, snap.vehiclePos.z);
      this.vehicle.group.position.set(
        snap.vehiclePos.x,
        0,
        snap.vehiclePos.z,
      );
      this.vehicle.group.rotation.y = snap.heading;
      this.vehicle.heading = snap.heading;
      this.vehicle.stop();
      this.mode = 'drive';
    } else {
      this.mode = 'walk';
    }
    this.camYaw = snap.heading;
    this.lastShadowAnchor.set(snap.playerPos.x, 0, snap.playerPos.z);
  }

  /** Abandon an active mission from the HUD. */
  cancelMission(): void {
    if (this.disposed) return;
    this.missions.cancel();
    this.reportDriveHud();
  }

  /** Restart a failed mission from the failure screen. */
  retryMission(): void {
    if (this.disposed) return;
    this.missions.retry();
    this.reportDriveHud();
  }

  /** Replay a completed mission from the completion screen. */
  replayMission(): void {
    if (this.disposed) return;
    this.missions.replay();
    this.reportDriveHud();
  }

  /** Continue after a completed mission (back to available). */
  continueMission(): void {
    if (this.disposed) return;
    this.missions.continueAfterComplete();
    this.reportDriveHud();
  }

  /** Dismiss a failed mission (back to available). */
  dismissMissionFailed(): void {
    if (this.disposed) return;
    this.missions.dismissFailed();
    this.reportDriveHud();
  }

  // ---- Garage: ownership, customisation, vehicle swapping ----------

  /** Where the selected vehicle parks: its spec's home spot. */
  private selectedHome(): { x: number; z: number; heading: number } {
    return selectedSpec(this.garage).home;
  }

  /** Build the selected vehicle with its saved paint + upgrades. */
  private createActiveVehicle(
    scene: THREE.Scene,
    x: number,
    z: number,
    heading: number,
  ): VehicleHandle {
    const spec = selectedSpec(this.garage);
    return createVehicle(scene, new THREE.Vector3(x, 0, z), heading, {
      spec,
      paint: paintFor(this.garage, spec),
      upgrades: upgradesFor(this.garage, spec.id),
    });
  }

  /**
   * G1.2 Stage 1 — assign the downtown probe to the active vehicle's
   * paint + glass, but ONLY when the active vehicle is the Velocity
   * GT. Any other selection keeps the sky env (its materials are
   * fresh, so there is nothing to clear). Called after every vehicle
   * (re)creation: factory, applyQualityPreset, garageSelect. A failed
   * or skipped bake (probeTarget null) is a silent no-op.
   */
  private applyProbeToActiveVehicle(): void {
    if (!this.probeTarget) return;
    if (this.vehicle.id !== VELOCITY_GT_ID) return;
    assignProbeToVehicle(this.vehicle, this.probeTarget.texture);
  }

  /** The garage panel's state (vehicles, ownership, cash). */
  getGarageState(): GarageUiState {
    return buildGarageUiState(this.garage, this.missions.getCash());
  }

  /**
   * Buy a vehicle: checks ownership and cash, deducts exactly once
   * through the mission manager (the single cash source of truth),
   * and persists. Returns why it failed, or ok.
   */
  garageBuy(id: string): { ok: boolean; reason?: string } {
    if (this.disposed) return { ok: false, reason: 'unavailable' };
    const spec = getVehicleSpec(id);
    if (!spec) return { ok: false, reason: 'unknown' };
    if (isOwned(this.garage, id)) return { ok: false, reason: 'already-owned' };
    if (!this.missions.spendCash(spec.price)) return { ok: false, reason: 'insufficient' };
    this.garage.owned.push(id);
    saveGarageState(this.garage);
    return { ok: true };
  }

  /**
   * Select an owned vehicle: the old car is returned to the garage
   * (despawned) and the new one spawns at the garage's parking bay.
   * The player is on foot at the garage when this happens.
   */
  garageSelect(id: string): boolean {
    if (this.disposed) return false;
    const spec = getVehicleSpec(id);
    if (!spec || !isOwned(this.garage, id)) return false;
    if (this.garage.selected === id) return true;
    this.garage.selected = id;
    saveGarageState(this.garage);
    const home = spec.home;
    this.vehicle.dispose();
    this.vehicle = this.createActiveVehicle(this.scene, home.x, home.z, home.heading);
    // G1.2 Stage 1 — assign the probe when the newly selected vehicle
    // is the GT; any other selection keeps the sky env.
    this.applyProbeToActiveVehicle();
    this.nearVehicle = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.reportDriveHud();
    return true;
  }

  /**
   * Grant a car from the story (9E): add it to the garage if not
   * owned, then select it with the same live swap as garageSelect
   * (the player is on foot when a mission completes). Returns the
   * display name when newly granted, null when already owned —
   * so a replay never duplicates the grant.
   */
  private grantStoryVehicle(vehicleId: string): string | null {
    const spec = getVehicleSpec(vehicleId);
    if (!spec) return null;
    if (isOwned(this.garage, vehicleId)) return null;
    this.garage.owned.push(vehicleId);
    this.garage.selected = vehicleId;
    saveGarageState(this.garage);
    const home = spec.home;
    this.vehicle.dispose();
    this.vehicle = this.createActiveVehicle(this.scene, home.x, home.z, home.heading);
    this.nearVehicle = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.reportDriveHud();
    return spec.name;
  }

  /**
   * Grant an outfit from the story (9E): ownership only, never
   * auto-equipped. Returns true when newly granted, false when
   * already owned.
   */
  private grantStoryOutfit(outfitId: string): boolean {
    const def = getOutfit(outfitId);
    if (!def) return false;
    if (this.outfits.owned.includes(outfitId)) return false;
    this.outfits.owned.push(outfitId);
    saveOutfitState(this.outfits);
    return true;
  }

  /** Repaint an owned vehicle ($150). Applies live when it is active. */
  garagePaint(id: string, hex: number): { ok: boolean; reason?: string } {
    if (this.disposed) return { ok: false, reason: 'unavailable' };
    const spec = getVehicleSpec(id);
    if (!spec || !isOwned(this.garage, id)) return { ok: false, reason: 'not-owned' };
    if (paintFor(this.garage, spec) === hex) return { ok: false, reason: 'already' };
    if (!this.missions.spendCash(PAINT_PRICE)) return { ok: false, reason: 'insufficient' };
    this.garage.paint[id] = hex;
    saveGarageState(this.garage);
    if (this.garage.selected === id) this.vehicle.setPaint(hex);
    return { ok: true };
  }

  /** Buy the next level of an upgrade (max 3). Applies live when active. */
  garageUpgrade(id: string, kind: UpgradeKind): { ok: boolean; reason?: string } {
    if (this.disposed) return { ok: false, reason: 'unavailable' };
    const spec = getVehicleSpec(id);
    if (!spec || !isOwned(this.garage, id)) return { ok: false, reason: 'not-owned' };
    const upgrades = upgradesFor(this.garage, id);
    const price = getUpgradePrice(kind, upgrades[kind]);
    if (price === null) return { ok: false, reason: 'maxed' };
    if (!this.missions.spendCash(price)) return { ok: false, reason: 'insufficient' };
    const next = { ...upgrades, [kind]: upgrades[kind] + 1 };
    this.garage.upgrades[id] = next;
    saveGarageState(this.garage);
    if (this.garage.selected === id) this.vehicle.setTuning(effectiveStats(spec, next));
    return { ok: true };
  }

  /** E at the garage entrance: open the garage (the panel pauses the game). */
  tryGarageEnter(): boolean {
    if (this.disposed) return false;
    if (this.cinematic.isActive()) return false;
    if (this.mode !== 'walk' || !this.nearGarage) return false;
    const a = this.arrest?.getState();
    if (a === 'surrendering' || a === 'busted') return false;
    this.cb.onGarageEnter?.();
    return true;
  }

  /**
   * E at a registered interactable (store, sprint start): fire the
   * nearest one's callback. Only on foot, never mid-arrest — the
   * same guards as the garage door.
   */
  tryInteractable(): boolean {
    if (this.disposed) return false;
    if (this.cinematic.isActive()) return false;
    if (this.mode !== 'walk' || !this.nearInteractable) return false;
    const a = this.arrest?.getState();
    if (a === 'surrendering' || a === 'busted') return false;
    return this.registry.interact(this.nearInteractable.id);
  }

  // ---- Shop: Sunset Mart --------------------------------------------

  /** The shop panel's state (catalogue, cash, inventory). */
  getShopState(): ShopUiState {
    return {
      cash: this.missions.getCash(),
      items: SHOP_ITEMS,
      inventory: { ...this.inventory },
    };
  }

  /**
   * Buy one shop item: checks the catalogue and cash, deducts
   * exactly once through the mission manager (the single cash
   * source of truth), and persists the inventory. A second tap on
   * the same item within 500 ms is ignored, not charged twice.
   */
  shopBuy(id: string): { ok: boolean; reason?: string } {
    if (this.disposed) return { ok: false, reason: 'unavailable' };
    const item = getShopItem(id);
    if (!item) return { ok: false, reason: 'unknown' };
    const now = performance.now();
    if (now - (this.lastShopBuyAt[id] ?? -Infinity) < 500) {
      return { ok: false, reason: 'too-fast' };
    }
    this.lastShopBuyAt[id] = now;
    if (!this.missions.spendCash(item.price)) return { ok: false, reason: 'insufficient' };
    this.inventory[item.id]++;
    saveInventory(this.inventory);
    return { ok: true };
  }

  // ---- Outfits ------------------------------------------------------

  /** The outfits panel's state (one row per outfit, cash). */
  getOutfitState(): OutfitUiState {
    return {
      cash: this.missions.getCash(),
      outfits: OUTFIT_DEFS.map((def) => ({
        def,
        owned: this.outfits.owned.includes(def.id),
        selected: this.outfits.selected === def.id,
      })),
    };
  }

  /** Buy an outfit: ownership + cash, deducted through the manager. */
  outfitBuy(id: string): { ok: boolean; reason?: string } {
    if (this.disposed) return { ok: false, reason: 'unavailable' };
    const def = getOutfit(id);
    if (!def) return { ok: false, reason: 'unknown' };
    // Unlock-only outfits (9E: the crew jacket) are earned from
    // the story, never bought — the panel shows an unlock note.
    if (def.unlockOnly) return { ok: false, reason: 'unlock-only' };
    if (this.outfits.owned.includes(id)) return { ok: false, reason: 'already-owned' };
    if (!this.missions.spendCash(def.price)) return { ok: false, reason: 'insufficient' };
    this.outfits.owned.push(id);
    saveOutfitState(this.outfits);
    return { ok: true };
  }

  /** Select an owned outfit: recolours the live protagonist at once. */
  outfitSelect(id: string): boolean {
    if (this.disposed) return false;
    const def = getOutfit(id);
    if (!def || !this.outfits.owned.includes(id)) return false;
    if (this.outfits.selected === id) return true;
    this.outfits.selected = id;
    saveOutfitState(this.outfits);
    this.player.applyOutfit(def);
    return true;
  }

  // ---- Collectibles + sprint ----------------------------------------

  /** The collection screen's state (found / missing per item). */
  getCollectibleState(): CollectibleState {
    return this.collectibles.getState();
  }

  /** Dismiss a finished sprint back to idle (the HUD buttons call this). */
  dismissSprint(): void {
    if (this.disposed) return;
    this.sprint.dismiss();
    this.reportSprint();
  }

  /**
   * Respawn after an arrest: the protagonist back at the original
   * spawn, the selected vehicle back at its home spot, wanted and
   * police reset, controls restored. Traffic and pedestrians are
   * untouched — they never stopped.
   */
  respawn(): void {
    if (this.disposed) return;
    this.arrest?.reset();
    this.wanted?.reset();
    this.police?.resetToPatrol();
    this.police?.setArrestTarget(null);
    // A combat defeat is cleared the same way: the player is back
    // on their feet, and any active encounter resets fresh.
    if (this.downed) {
      this.downed = false;
      this.player.setDowned(false);
      this.cb.onDowned?.(false);
    }
    for (const s of this.encounters.getState()) {
      if (s.status === 'active') {
        this.encounters.setActive(s.id, false);
        this.enemies.deactivateEncounter(s.id);
        this.enemies.resetEncounter(s.id);
        this.encounterShotHeat.delete(s.id);
      }
    }
    // An arrest during a contract ends the attempt the same way
    // walking out does (a TAKEN DOWN already failed it above).
    for (const s of this.contracts.getState()) {
      if (s.status === 'active') {
        this.contracts.setActive(s.id, false);
        this.resetContractEnemies(s.id);
        this.contracts.leave(s.id);
        this.contractShotHeat.delete(s.id);
      }
    }

    this.player.position.set(SPAWN.x, 0, SPAWN.z);
    this.player.mesh.position.set(SPAWN.x, 0, SPAWN.z);
    this.player.mesh.rotation.y = 0;
    this.player.setSurrendered(false);
    this.player.mesh.visible = true;

    const home = this.selectedHome();
    this.vehicle.position.set(home.x, 0, home.z);
    this.vehicle.group.position.set(home.x, 0, home.z);
    this.vehicle.heading = home.heading;
    this.vehicle.group.rotation.y = home.heading;
    this.vehicle.stop();
    this.vehicle.setSpeed(0);

    this.mode = 'walk';
    this.chaseYawOffset = 0;
    this.camBlend = 0;
    this.nearVehicle = false;
    this.prevPlayerPos.set(SPAWN.x, 0, SPAWN.z);
    this.lastShadowAnchor.copy(SPAWN);
    // A respawn is a clean slate for combat too: full health, no
    // reload in progress, finger off the trigger.
    this.combat?.healToFull();
    this.combat?.cancelReload();
    this.combat?.setFiring(false);
    this.input.moveX = 0;
    this.input.moveY = 0;
    this.input.sprint = false;
    this.input.handbrake = false;
    this.input.joyActive = false;
    this.input.joyX = 0;
    this.input.joyY = 0;
    this.renderer.shadowMap.needsUpdate = true;
    this.reportDriveHud();
  }

  private enterVehicle(): void {
    this.mode = 'drive';
    this.player.mesh.visible = false;
    this.chaseYawOffset = 0;
    this.input.moveX = 0;
    this.input.moveY = 0;
    this.renderer.shadowMap.needsUpdate = true;
    this.reportDriveHud();
  }

  private exitVehicle(): void {
    const h = this.vehicle.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const rx = Math.cos(h);
    const rz = -Math.sin(h);
    const c = this.vehicle.position;
    // Try the passenger side first, then the driver side, then
    // behind and in front of the car — first spot that is not inside
    // a building wins, so the player never spawns inside a wall.
    const candidates = [
      new THREE.Vector3(c.x + rx * 2.6, 0, c.z + rz * 2.6),
      new THREE.Vector3(c.x - rx * 2.6, 0, c.z - rz * 2.6),
      new THREE.Vector3(c.x - fx * 3.6, 0, c.z - fz * 3.6),
      new THREE.Vector3(c.x + fx * 3.6, 0, c.z + fz * 3.6),
    ];
    const inside = (p: THREE.Vector3): boolean =>
      this.worldHandle.buildings.some(
        (b) => p.x > b.minX - 0.8 && p.x < b.maxX + 0.8 && p.z > b.minZ - 0.8 && p.z < b.maxZ + 0.8,
      );
    const spot = candidates.find((p) => !inside(p)) ?? candidates[0];
    this.player.position.copy(spot);
    this.player.mesh.position.copy(spot);
    this.player.mesh.visible = true;
    this.vehicle.stop();
    this.mode = 'walk';
    this.lastShadowAnchor.copy(spot);
    this.renderer.shadowMap.needsUpdate = true;
    this.reportDriveHud();
  }

  /** While walking, the parked car is solid — push the player out. */
  private resolvePlayerCar(): void {
    const h = this.vehicle.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const c = this.vehicle.position;
    const p = this.player.position;
    for (const s of [1, -1]) {
      const cx = c.x + fx * 1.1 * s;
      const cz = c.z + fz * 1.1 * s;
      const dx = p.x - cx;
      const dz = p.z - cz;
      const dist = Math.hypot(dx, dz);
      const minDist = 1.15 + 0.6;
      if (dist < minDist && dist > 1e-6) {
        p.x = cx + (dx / dist) * minDist;
        p.z = cz + (dz / dist) * minDist;
      }
    }
  }

  private meanFps(): number {
    if (this.dtSamples.length === 0) return 0;
    const mean = this.dtSamples.reduce((a, b) => a + b, 0) / this.dtSamples.length;
    return mean > 0 ? Math.round(1 / mean) : 0;
  }

  // ---- Per-frame work -------------------------------------------------

  private tick(): void {
    // Measure the frame rate from the REAL delta, then cap the
    // simulation step: below 10 FPS the game gets choppy rather
    // than running in slow motion. (The old 0.05 cap made anything
    // under 20 FPS slow-mo, and faked the FPS readout at 20.)
    const rawDt = this.clock.getDelta();
    this.trackFps(rawDt);
    const dt = Math.min(rawDt, 0.1);
    // Cinematic mode: the engine keeps ticking so the camera can
    // move, but gameplay is frozen — the player cannot move, no
    // timer runs, no offence is committed, no mission advances.
    // Look drags and queued one-shot inputs are discarded here,
    // so nothing pressed during the scene fires afterwards.
    const inCinematic = this.cinematic.isActive();
    if (inCinematic) {
      this.input.lookDX = 0;
      this.input.lookDY = 0;
      this.input.interactQueued = false;
      this.input.surrenderQueued = false;
      this.input.reloadQueued = false;
      this.input.switchToWeapon = null;
      this.input.cycleWeaponQueued = false;
      this.cinematic.update(dt);
    }

    // Consume look deltas (mouse drag / pointer lock / touch drag).
    const lookDX = this.input.lookDX;
    const lookDY = this.input.lookDY;
    this.input.lookDX = 0;
    this.input.lookDY = 0;
    const pitchDelta = this.invertY ? -lookDY : lookDY;
    if (this.mode === 'drive') {
      // Drag orbits the chase camera around the car; vertical drag
      // raises / lowers it. The offset eases back toward centre.
      this.chaseYawOffset = THREE.MathUtils.clamp(this.chaseYawOffset - lookDX * 0.0042, -1.4, 1.4);
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + pitchDelta * 0.0032, 0.05, 1.0);
    } else {
      this.camYaw -= lookDX * 0.0042;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + pitchDelta * 0.0032, -0.1, 1.1);
    }

    // E to enter / exit — consumed once per frame. A mission
    // accept at the marker takes priority over the garage door,
    // which takes priority over the nearest registered
    // interactable (store, sprint start), which takes priority
    // over the car. The garage and interactable paths must go
    // through their try* methods (not the panel directly), so the
    // keyboard and the touch button behave the same way.
    // A story accept sits between the job-mission accept and the
    // garage: only one of the two can have a prompt showing at a
    // time (the global guard suppresses the other's).
    // Frozen during a cinematic: the input was already discarded
    // above, and no accept may start mid-scene.
    if (!inCinematic && this.input.interactQueued) {
      this.input.interactQueued = false;
      if (
        !this.tryMissionInteract() &&
        !this.tryStoryInteract() &&
        !this.tryGarageEnter() &&
        !this.tryInteractable()
      )
        this.tryInteract();
    }

    // F to surrender — consumed once per frame.
    if (!inCinematic && this.input.surrenderQueued) {
      this.input.surrenderQueued = false;
      this.trySurrender();
    }

    // R to reload, 1 / 2 to equip a weapon, Q to cycle — each
    // consumed once per frame.
    if (!inCinematic && this.input.reloadQueued) {
      this.input.reloadQueued = false;
      this.combat.reload();
    }
    if (!inCinematic && this.input.switchToWeapon) {
      const id = this.input.switchToWeapon as WeaponId;
      this.input.switchToWeapon = null;
      this.combat.switchWeapon(id);
    }
    if (!inCinematic && this.input.cycleWeaponQueued) {
      this.input.cycleWeaponQueued = false;
      this.combat.cycleWeapon();
    }

    if (!inCinematic && this.mode === 'drive') {
      this.vehicle.update(dt, this.input, this.worldHandle.buildings);
    } else if (!inCinematic) {
      this.player.update(dt, this.camYaw, this.input);
      this.resolvePlayerCar();
      // How close is the player to the car? (drives the ENTER prompt.)
      const wasNear = this.nearVehicle;
      this.nearVehicle =
        this.player.position.distanceTo(this.vehicle.position) < 3.6;
      if (wasNear !== this.nearVehicle) this.reportDriveHud();
      // And to the garage door? (drives the GARAGE prompt.)
      const wasNearGarage = this.nearGarage;
      this.nearGarage =
        Math.hypot(
          this.player.position.x - GARAGE_ENTRANCE.x,
          this.player.position.z - GARAGE_ENTRANCE.z,
        ) < 4.5;
      if (wasNearGarage !== this.nearGarage) this.reportDriveHud();
      // And to the nearest registered interactable? (drives its
      // prompt — store, sprint start — only the nearest shows.)
      const wasNearInteractable = this.nearInteractable;
      this.nearInteractable = this.registry.nearest(
        this.player.position.x,
        this.player.position.z,
      );
      if ((wasNearInteractable?.id ?? null) !== (this.nearInteractable?.id ?? null)) {
        this.reportDriveHud();
      }
    }
    // Pedestrians: player speed from displacement (same measure the
    // protagonist's animation uses), so NPCs react to real movement.
    const playerSpeed =
      dt > 0
        ? Math.hypot(
            this.player.position.x - this.prevPlayerPos.x,
            this.player.position.z - this.prevPlayerPos.z,
          ) / dt
        : 0;
    this.prevPlayerPos.copy(this.player.position);
    this.camera.getWorldDirection(_camForward);
    // The mission target car, when it is on the road: traffic
    // brakes for it, pedestrians wait for it, police yield to it,
    // and ramming it counts like any other car. It is never part
    // of the traffic pool itself. The story's tail car (9E) joins
    // the same list while 2.1 is selected.
    const missionTarget = this.missions.getTargetVehiclePos();
    const storyTarget = this.story.getTargetVehiclePos();
    const missionTargetList = [
      ...(missionTarget ? [missionTarget] : []),
      ...(storyTarget ? [storyTarget] : []),
    ];
    const crowdMoved = this.crowd.update(dt, {
      playerPos: this.player.position,
      playerSpeed,
      vehiclePos: this.vehicle.position,
      vehicleSpeed: this.vehicle.speed,
      vehicleHeading: this.vehicle.heading,
      driving: this.mode === 'drive',
      camForward: { x: _camForward.x, z: _camForward.z },
      // NPCs hurry / wait at the curb for police cars too.
      aiVehicles: [
        ...(this.traffic?.listVehicles() ?? []),
        ...(this.police?.listUnits() ?? []),
        ...missionTargetList,
      ],
    });
    // Traffic: reads the fresh NPC positions for its crosswalk
    // stops, and the player's car for following / braking.
    const trafficMoved = this.traffic.update(dt, {
      playerPos: this.player.position,
      playerSpeed,
      driving: this.mode === 'drive',
      vehiclePos: this.vehicle.position,
      vehicleSpeed: this.vehicle.speed,
      vehicleHeading: this.vehicle.heading,
      extraVehicles: missionTargetList,
      npcs: this.crowd.npcPositions(),
      camForward: { x: _camForward.x, z: _camForward.z },
    });
    // Police: pursues on the previous frame's wanted state, and
    // reports what it can see; the wanted module then consumes
    // that verdict. One frame of lag, invisible in play.
    // Frozen during a cinematic: a pursuer must not close in on
    // a player who cannot move, and no arrest may start mid-scene.
    const policeMoved = inCinematic
      ? false
      : this.police.update(dt, {
          playerPos: this.player.position,
          playerSpeed,
          driving: this.mode === 'drive',
          vehiclePos: this.vehicle.position,
          vehicleSpeed: this.vehicle.speed,
          vehicleHeading: this.vehicle.heading,
          npcs: this.crowd.npcPositions(),
          aiVehicles: [...(this.traffic?.listVehicles() ?? []), ...missionTargetList],
          buildings: this.worldHandle.buildings,
          avenueGreen: this.worldHandle.signals.isAvenueGreen(),
          wanted: this.wanted.getState(),
          camForward: { x: _camForward.x, z: _camForward.z },
        });
    // Wanted: offences from the live game state, then the
    // pursuit / search / clear machine. Frozen while the player is
    // surrendering or busted — no new offences and no status
    // changes mid-arrest. Frozen during a cinematic too.
    const arrestBefore = this.arrest.getState();
    if (!inCinematic && arrestBefore !== 'surrendering' && arrestBefore !== 'busted') {
      this.wanted.update(dt, {
        playerPos: this.player.position,
        playerSpeed,
        driving: this.mode === 'drive',
        vehiclePos: this.vehicle.position,
        vehicleSpeed: this.vehicle.speed,
        vehicleHeading: this.vehicle.heading,
        npcs: this.crowd.npcPositions(),
        aiVehicles: [...(this.traffic?.listVehicles() ?? []), ...missionTargetList],
        avenueGreen: this.worldHandle.signals.isAvenueGreen(),
        seen: this.police.anySeesPlayer(),
        enabled: this.wantedEnabled,
      });
    }
    // Arrest: prompt / auto-arrest / surrender countdown, on the
    // fresh police verdict. Frozen during a cinematic: the
    // previous state is carried, so no arrest can start or
    // finish mid-scene.
    const wantedNow = this.wanted.getState();
    const arrestState = inCinematic
      ? this.lastArrestState
      : this.arrest.update(dt, {
      enabled: this.wantedEnabled,
      wantedLevel: wantedNow.level,
      wantedStatus: wantedNow.status,
      driving: this.mode === 'drive',
      playerPos: this.player.position,
      playerSpeed,
      vehiclePos: this.vehicle.position,
      vehicleSpeed: this.vehicle.speed,
      nearestPursuer: this.police.nearestPursuer(),
      policeUnits: this.police.listUnits(),
    });
    if (arrestState !== this.lastArrestState) {
      if (arrestState === 'surrendering') {
        // The arrest starts, by choice or caught: out of the car,
        // hands up, and the nearest unit drives up to the player.
        if (this.mode === 'drive') this.exitVehicle();
        this.player.setSurrendered(true);
        this.police.setArrestTarget({
          x: this.player.position.x,
          z: this.player.position.z,
          slot: this.arrest.arrestSlot,
        });
      } else if (arrestState === 'busted') {
        // The arrest is complete: heat and pursuit end here, behind
        // the BUSTED screen. Respawn only moves the pieces back.
        this.wanted.reset();
        this.police.resetToPatrol();
      }
      this.lastArrestState = arrestState;
      this.cb.onArrest?.(arrestState);
    }
    // Missions: discovery, objectives, timer and the marker, on
    // the fresh arrest state. The timer only ticks while the loop
    // runs, so pausing freezes it for free. Frozen during a
    // cinematic: a mission must not advance while its intro plays.
    const targetMoved = inCinematic
      ? false
      : this.missions.update(dt, {
          playerPos: this.player.position,
          playerSpeed,
          driving: this.mode === 'drive',
          vehiclePos: this.vehicle.position,
          vehicleSpeed: this.vehicle.speed,
          vehicleHeading: this.vehicle.heading,
          arrestState,
          camYaw: this.camYaw,
          wantedLevel: wantedNow.level,
          wantedStatus: wantedNow.status,
          avenueGreen: this.worldHandle.signals.isAvenueGreen(),
        });
    // The global guard: one active activity at a time. Each
    // subsystem is blocked while a DIFFERENT one is active, so
    // a job, a story mission and a contract can never run at
    // once — but each keeps working on its own.
    if (!inCinematic) this.applyActivityGuard();
    // Story campaign: the same tick slot as the job missions,
    // right after it, on the same live state (plus downed).
    if (!inCinematic) {
      this.story.update(dt, {
        playerPos: this.player.position,
        playerSpeed,
        driving: this.mode === 'drive',
        vehiclePos: this.vehicle.position,
        vehicleSpeed: this.vehicle.speed,
        vehicleHeading: this.vehicle.heading,
        arrestState,
        camYaw: this.camYaw,
        wantedLevel: wantedNow.level,
        wantedStatus: wantedNow.status,
        avenueGreen: this.worldHandle.signals.isAvenueGreen(),
        downed: this.downed,
      });
    }
    // Collectibles: walked over on foot, once each — a pickup
    // refreshes the counter chip. Frozen during a cinematic.
    const picked = inCinematic
      ? []
      : this.collectibles.update(dt, this.player.position, this.mode === 'walk');
    if (picked.length > 0) this.reportDriveHud();
    // The range: targets fall and pop back up on their own timers.
    this.range.update(dt);
    // Combat: fire cooldown, auto-fire while held, reload timer,
    // health regen, flash / tracer fade, weapon kick. Frozen
    // during a cinematic.
    if (!inCinematic) this.combat.update(dt);
    // Sunset Sprint: timer, checkpoints, and the fail rules (a car
    // or an arrest ends the run). The reward is paid exactly once,
    // through the mission manager, on the frame it completes.
    // Frozen during a cinematic.
    const sprintEvent = inCinematic
      ? null
      : this.sprint.update(dt, {
          playerPos: this.player.position,
          driving: this.mode === 'drive',
          arrestState,
        });
    if (sprintEvent === 'complete') {
      this.missions.addCash(SPRINT_REWARD);
      this.reportSprint();
      this.reportDriveHud();
    } else if (sprintEvent === 'failed') {
      this.reportSprint();
    }
    // Enemies: the AI state machine, attacks and hit reactions.
    // The player is "safe" at the shooting range (within 30 m of
    // the firing line) — enemies never engage there, even if one
    // wanders close — and while downed. Frozen during a cinematic.
    const playerSafeAtRange =
      Math.hypot(this.player.position.x - RANGE_LINE.x, this.player.position.z - RANGE_LINE.z) <= 30;
    if (!inCinematic) {
      this.enemies.update(dt, {
        playerPos: this.player.position,
        playerSpeed,
        mode: this.mode,
        buildings: this.worldHandle.buildings,
        playerSafe: playerSafeAtRange,
        playerDown: this.downed,
        onPlayerDamage: (amount) => this.combat.damage(amount),
        onEnemyDefeated: (id, encounterId) => {
          // A public hostile defeat is a visible offence: +8 heat
          // — unless a story mission is active, whose heat is set
          // by design (startHeat), not by the body count. A story
          // defense would otherwise spiral to level 4–5 on its
          // own defeats. The campaign still records the defeat.
          if (this.story.getHudState().state !== 'active') {
            this.wanted.addHeat(8);
          }
          this.story.onEnemyDefeated(id, encounterId);
        },
        onObjectiveDamage: (amount) => this.contracts.damageObjective(amount),
      });
    }
    // Encounters: trigger on entering a zone, reset on leaving,
    // and complete when every enemy in the active zone is defeated.
    // Contracts: the same lifecycle, plus waves and the objective.
    // Both frozen during a cinematic.
    if (!inCinematic) {
      this.updateEncounters();
      this.contracts.update(dt);
      this.updateContracts();
    }
    // Combat defeat: health 0 is a separate outcome from arrest —
    // the player goes down where they stand, and getting back up
    // respawns them at the spawn plaza with the encounter reset.
    // Frozen during a cinematic (no damage source runs there).
    if (!inCinematic && !this.downed && this.combat.getHudState().health <= 0) {
      this.downed = true;
      this.player.setDowned(true);
      this.combat.setFiring(false);
      this.combat.cancelReload();
      // A contract fails when the player goes down.
      for (const s of this.contracts.getState()) {
        if (s.status === 'active') this.failContract(s.id);
      }
      // A story mission fails when the player goes down.
      this.story.failDowned();
      this.cb.onDowned?.(true);
    }
    this.worldHandle.update(dt);
    this.lighting?.update(dt);
    this.updateCamera(dt);
    // Shadow pass only when a moving caster moved: the player and
    // the car are the only dynamic casters, everything else is
    // static. Re-rendering the 150-caster shadow map every frame
    // was pure waste whenever the player stood still.
    if (this.quality.shadows) {
      const anchor = this.mode === 'drive' ? this.vehicle.position : this.player.position;
      if (anchor.distanceToSquared(this.lastShadowAnchor) > 0.36) {
        this.renderer.shadowMap.needsUpdate = true;
        this.lastShadowAnchor.copy(anchor);
      }
      // Pedestrians walk, traffic drives, police patrol and the
      // mission target car drives constantly, so their shadows
      // refresh on a slow timer (2/s) instead of every frame — a
      // shadow a half-second stale is invisible, a per-frame shadow
      // pass would undo the Phase 3.5 win.
      if (
        (crowdMoved || trafficMoved || policeMoved || targetMoved) &&
        performance.now() - this.lastShadowNpcAt > 500
      ) {
        this.renderer.shadowMap.needsUpdate = true;
        this.lastShadowNpcAt = performance.now();
      }
    }
    this.renderer.render(this.scene, this.camera);

    const now = performance.now();
    if (now - this.lastFpsReport > 500) {
      this.lastFpsReport = now;
      this.cb.onFps?.(this.getStats().fps);
    }
    if (now - this.lastHudReport > 100) {
      this.lastHudReport = now;
      this.reportDriveHud();
      this.reportStory();
      this.reportCombat();
      this.reportEncounter();
      this.reportContract();
      // The sprint timer counts down in real time while a run is
      // live, so the HUD gets a fresh state with each report.
      if (this.sprint.isRunning()) this.reportSprint();
      else if (this.sprint.getHudState().status !== this.lastSprintStatus) {
        this.reportSprint();
      }
    }
  }

  private updateCamera(dt: number): void {
    // Cinematic: the runtime owns the camera. The pose it hands
    // over is already interpolated (entry blend, shot drift,
    // shot-change blend), so it is applied directly — the walk /
    // chase math below never runs. The last pose is remembered
    // so the exit blend can start from it.
    if (this.cinematic.isActive()) {
      const pose = this.cinematic.getCameraPose();
      this.camera.position.copy(pose.position);
      this.camera.lookAt(pose.target);
      this.lastCinematicPos.copy(pose.position);
      this.lastCinematicTarget.copy(pose.target);
      return;
    }
    // Ease between the walking camera and the chase camera so
    // entering / exiting never snaps the view.
    const targetBlend = this.mode === 'drive' ? 1 : 0;
    this.camBlend += (targetBlend - this.camBlend) * Math.min(1, dt * 3.5);
    if (Math.abs(targetBlend - this.camBlend) < 0.001) this.camBlend = targetBlend;
    const t = this.camBlend * this.camBlend * (3 - 2 * this.camBlend);

    // Walking camera: orbit around the player. The camera position
    // stays on its orbit around the protagonist, but the look
    // target is pushed a few metres ahead of them along the
    // camera's forward — the crosshair sits at the screen centre,
    // so without this the shot ray (which runs through the centre)
    // would be stuck on the protagonist's back and could never
    // reach a target. The character now sits in the lower-middle
    // of the frame instead of dead centre; movement is untouched.
    const recoilPitch = this.mode === 'drive' ? 0 : this.combat ? this.combat.recoil * 0.035 : 0;
    _walkTarget.copy(this.player.position);
    _walkTarget.y += 2.1;
    _walkPos
      .set(
        Math.sin(this.camYaw) * Math.cos(this.camPitch + recoilPitch),
        Math.sin(this.camPitch + recoilPitch),
        Math.cos(this.camYaw) * Math.cos(this.camPitch + recoilPitch),
      )
      .multiplyScalar(this.camDistance)
      .add(_walkTarget);
    _walkPos.y = Math.max(_walkPos.y, 0.6);
    _walkTarget.x -= Math.sin(this.camYaw) * 6;
    _walkTarget.z -= Math.cos(this.camYaw) * 6;

    // Chase camera: behind the car, looking along its heading.
    const h = this.vehicle.heading + this.chaseYawOffset;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    _chaseTarget.copy(this.vehicle.position);
    _chaseTarget.y += 1.4;
    _chaseTarget.x += fx * 5;
    _chaseTarget.z += fz * 5;
    _chasePos.copy(this.vehicle.position);
    _chasePos.x -= fx * this.camDistance;
    _chasePos.z -= fz * this.camDistance;
    _chasePos.y = 2.0 + this.camPitch * 3.2;
    this.avoidCameraClipping(_chasePos, this.vehicle.position);

    _camPos.copy(_walkPos).lerp(_chasePos, t);
    _camTarget.copy(_walkTarget).lerp(_chaseTarget, t);
    // Exit blend: for 0.8 s after a cinematic ends, the camera
    // eases from the last cinematic pose to the live orbit /
    // chase pose instead of snapping back. camYaw / camPitch
    // were untouched during the scene, so the orbit resumes
    // exactly where the player left it.
    if (this.cameraRestoreT < 1) {
      this.cameraRestoreT = Math.min(1, this.cameraRestoreT + dt / 0.8);
      const e = this.cameraRestoreT * this.cameraRestoreT * (3 - 2 * this.cameraRestoreT);
      _camPos.lerpVectors(this.lastCinematicPos, _camPos, e);
      _camTarget.lerpVectors(this.lastCinematicTarget, _camTarget, e);
    }
    this.camera.position.copy(_camPos);
    this.camera.lookAt(_camTarget);
  }

  /** Pull the chase camera in until it is outside every building. */
  private avoidCameraClipping(pos: THREE.Vector3, anchor: THREE.Vector3): void {
    const inside = (p: THREE.Vector3): boolean =>
      this.worldHandle.buildings.some(
        (b) => p.x > b.minX - 0.6 && p.x < b.maxX + 0.6 && p.z > b.minZ - 0.6 && p.z < b.maxZ + 0.6,
      );
    for (let i = 0; i < 6 && inside(pos); i++) {
      pos.lerp(anchor, 0.25);
      pos.y = Math.max(pos.y, 1.2);
    }
  }

  private trackFps(rawDt: number): void {
    this.dtSamples.push(rawDt);
    if (this.dtSamples.length > 45) this.dtSamples.shift();
    if (this.dtSamples.length < 30) return;
    const avg = this.meanFps();
    const now = performance.now();
    // Sustained low FPS only: the mean is over the last 45 frames,
    // and at least 15 seconds must pass between downgrades, so a
    // single hitch can never trigger a cascade. One-way only — the
    // engine never steps back up on its own (that would flap); the
    // player raises the preset in Settings, which applies live.
    if (avg < 28 && now - this.lastDowngradeAt > 15000) {
      const next = stepDown(this.quality.tier);
      if (next) {
        this.lastDowngradeAt = now;
        this.applyQualityPreset(next);
      }
    }
  }

  // ---- Input: drag-to-orbit, pointer-lock mouse, wheel zoom -----------

  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private activePointerId: number | null = null;

  private onPointerDown = (e: PointerEvent): void => {
    // Touch look is handled by the HUD overlay; the canvas only
    // takes mouse drag / pointer lock here.
    if (e.pointerType !== 'mouse') return;
    this.dragging = true;
    this.activePointerId = e.pointerId;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.canvas.setPointerCapture(e.pointerId);
    // Desktop: click to lock the pointer for FPS-style mouse look.
    if (this.canvas.requestPointerLock && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
    // Left click while the pointer is already locked fires the
    // equipped weapon (the first click only locks the pointer).
    // The combat locks (on foot, no arrest, no sprint, running)
    // decide whether the shot actually goes off.
    if (e.button === 0 && document.pointerLockElement === this.canvas) {
      this.combat?.setFiring(true);
      this.combat?.tryFire();
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (document.pointerLockElement === this.canvas) {
      addLook(this.input, e.movementX, e.movementY);
      return;
    }
    if (!this.dragging || this.activePointerId !== e.pointerId) return;
    addLook(this.input, e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y);
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.activePointerId !== e.pointerId) return;
    this.dragging = false;
    this.activePointerId = null;
    if (e.pointerType === 'mouse' && e.button === 0) {
      this.combat?.setFiring(false);
    }
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  private onWheel = (e: WheelEvent): void => {
    this.camDistance = THREE.MathUtils.clamp(this.camDistance + e.deltaY * 0.01, 4.5, 14);
  };

  // ---- Resize ----------------------------------------------------------

  private resize = (): void => {
    if (this.disposed || !this.parent) return;
    const w = this.parent.clientWidth || 1;
    const h = this.parent.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  // ---- Cleanup: everything created in the constructor / create() ------

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.resize);
    this.resizeObserver.disconnect();
    this.detachKeyboard();
    this.player?.dispose();
    this.vehicle?.dispose();
    this.crowd?.dispose();
    this.traffic?.dispose();
    this.police?.dispose();
    this.missions?.dispose();
    this.dialogue?.dispose();
    this.cinematic?.dispose();
    this.collectibles?.dispose();
    this.sprint?.dispose();
    this.range?.dispose();
    this.combat?.dispose();
    this.enemies?.dispose();
    this.encounters?.dispose();
    this.contracts?.dispose();
    this.worldHandle?.dispose();
    this.lighting?.dispose();
    if (this.envMapTarget) {
      this.scene.environment = null;
      this.envMapTarget.dispose();
      this.envMapTarget = null;
    }
    // G1.2 Stage 1 — the downtown probe target. The vehicle holding
    // the assignment was already disposed above, so nothing live
    // references this texture anymore.
    if (this.probeTarget) {
      this.probeTarget.dispose();
      this.probeTarget = null;
    }
    this.scene.clear();
    this.renderer.dispose();
    // Release the GL context so a remount gets a fresh one.
    this.renderer.forceContextLoss();
  }
}

export type { QualityTier };
