/**
 * Combat contracts — Phase 8C optional jobs on the mission board.
 *
 * Two contracts, separate from the five story missions (whose
 * unlock chain is untouched):
 *
 * - DOCKSIDE TROUBLE (elimination, South Docks (0,170)): defeat
 *   all three designated enemies. $800. Fails when the player
 *   is TAKEN DOWN or abandons it.
 * - HOLD THE LINE (defense, mid-beach (165,0)): defend a
 *   supply beacon against three waves. $1,200. Fails when the
 *   player is TAKEN DOWN or the beacon is destroyed.
 *
 * A contract is accepted from the mission board, then the player
 * travels to its zone — entering the zone starts the fight.
 * Leaving mid-fight resets it (fresh attempt, back to
 * "accepted"); abandoning from the HUD returns it to dormant.
 * The first completion pays full cash plus a free ammo restock;
 * replays (after a 3-minute cooldown) pay ammo only, so the
 * contracts cannot be farmed. Records live under their own key,
 * separate from mission progress, and cash always goes through
 * the mission manager (the single cash source of truth).
 *
 * Waves (HOLD THE LINE) spawn from different directions around
 * the zone and advance on the beacon when the player is not
 * visible; an 8 s recovery separates waves. Enemies are the
 * existing 8B system — each wave is its own encounter id, so
 * the engine activates one wave at a time and the usual
 * per-encounter activation / reset machinery applies.
 */
import * as THREE from 'three';
import type { BuildingBox } from './World';
import type { CoverPoint, EnemySpawnDef } from './Enemies';

export interface ContractWaveDef {
  /** The encounter id the engine spawns / activates for this wave. */
  encounterId: string;
  enemies: EnemySpawnDef[];
}

export interface ContractDef {
  id: string;
  name: string;
  giver: string;
  description: string;
  kind: 'elimination' | 'defense';
  x: number;
  z: number;
  radius: number;
  /** Human-readable place name for the HUD ("South Docks"). */
  location: string;
  /** Cash for the FIRST completion (replays pay none). */
  rewardCash: number;
  /** Elimination: the three designated enemies. */
  spawns: EnemySpawnDef[];
  /** Defense: one entry per wave. */
  waves: ContractWaveDef[];
  /** Cover objects: centre, half-width, half-depth (2 m tall). */
  cover: Array<{ x: number; z: number; hw: number; hd: number; kind: 'crates' | 'sandbags' }>;
  signText: string;
  /** Defense only: the protected objective's position. */
  objective?: { x: number; z: number };
}

export const CONTRACT_DEFS: ContractDef[] = [
  {
    id: 'contract-dockside',
    name: 'Dockside Trouble',
    giver: 'Rook Calloway',
    description: 'Clear the crew off the south docks. Three hostiles, no backup.',
    kind: 'elimination',
    x: 0,
    z: 170,
    radius: 18,
    location: 'South Docks',
    rewardCash: 800,
    spawns: [
      { variant: 'yard-enforcer', x: -7, z: 164, patrol: [{ x: -7, z: 164 }, { x: -3, z: 170 }, { x: -8, z: 175 }] },
      { variant: 'lot-runner', x: 7, z: 176, patrol: [{ x: 7, z: 176 }, { x: 3, z: 170 }, { x: 8, z: 165 }] },
      { variant: 'northgate-lookout', x: 2, z: 163, patrol: [{ x: 2, z: 163 }, { x: -2, z: 169 }, { x: 5, z: 167 }] },
    ],
    waves: [],
    cover: [
      { x: -7, z: 170, hw: 1.8, hd: 0.6, kind: 'crates' },
      { x: 7, z: 170, hw: 1.8, hd: 0.6, kind: 'sandbags' },
      { x: 0, z: 178, hw: 1.8, hd: 0.6, kind: 'crates' },
    ],
    signText: 'DOCKSIDE TROUBLE',
  },
  {
    id: 'contract-hold-line',
    name: 'Hold the Line',
    giver: 'Mara Voss',
    description: 'Defend the supply beacon on the mid-beach against three waves.',
    kind: 'defense',
    x: 165,
    z: 0,
    radius: 18,
    location: 'Mid-Beach',
    rewardCash: 1200,
    spawns: [],
    waves: [
      {
        encounterId: 'contract-hold-line-w1',
        enemies: [
          { variant: 'lot-runner', x: 165, z: -14, patrol: [{ x: 165, z: -14 }, { x: 165, z: -8 }] },
          { variant: 'yard-enforcer', x: 151, z: 0, patrol: [{ x: 151, z: 0 }, { x: 157, z: 0 }] },
        ],
      },
      {
        encounterId: 'contract-hold-line-w2',
        enemies: [
          { variant: 'northgate-lookout', x: 179, z: 0, patrol: [{ x: 179, z: 0 }, { x: 173, z: 0 }] },
          { variant: 'lot-runner', x: 165, z: 14, patrol: [{ x: 165, z: 14 }, { x: 165, z: 8 }] },
          { variant: 'yard-enforcer', x: 165, z: -14, patrol: [{ x: 165, z: -14 }, { x: 165, z: -8 }] },
        ],
      },
      {
        encounterId: 'contract-hold-line-w3',
        enemies: [
          { variant: 'yard-enforcer', x: 165, z: -14, patrol: [{ x: 165, z: -14 }, { x: 165, z: -8 }] },
          { variant: 'yard-enforcer', x: 165, z: 14, patrol: [{ x: 165, z: 14 }, { x: 165, z: 8 }] },
          { variant: 'northgate-lookout', x: 151, z: 0, patrol: [{ x: 151, z: 0 }, { x: 157, z: 0 }] },
        ],
      },
    ],
    cover: [
      { x: 157, z: 0, hw: 1.8, hd: 0.6, kind: 'sandbags' },
      { x: 173, z: 0, hw: 1.8, hd: 0.6, kind: 'crates' },
      { x: 165, z: 9, hw: 1.8, hd: 0.6, kind: 'sandbags' },
    ],
    signText: 'HOLD THE LINE',
    objective: { x: 165, z: 0 },
  },
];

export type ContractStatus = 'dormant' | 'accepted' | 'active' | 'cooling' | 'failed';

export interface ContractState {
  id: string;
  name: string;
  giver: string;
  description: string;
  kind: 'elimination' | 'defense';
  location: string;
  status: ContractStatus;
  reward: number;
  completedOnce: boolean;
  /** Seconds until a replay is available (0 when ready). */
  cooldownLeft: number;
  /** Defense: the wave being fought (1-based, 0 when not started). */
  wave: number;
  totalWaves: number;
  /** Defense: 'fighting' | 'recovery' | 'idle'. */
  waveState: 'idle' | 'fighting' | 'recovery';
  /** Seconds until the next wave spawns (recovery only). */
  recoveryLeft: number;
  /** Enemies still standing in the active contract. */
  remaining: number;
  /** Defense: the objective's health (0 when no objective). */
  objectiveHealth: number;
  objectiveMax: number;
  /** The global guard: true while a job or story mission runs,
   * so the contract cannot start. */
  blocked?: boolean;
}

export interface ContractsHandle {
  /** Collision boxes (cover objects + the objective). */
  collisionBoxes: () => BuildingBox[];
  /** Cover points for the enemy AI (one per face of each object). */
  coverPoints: (id: string) => CoverPoint[];
  /** The contract zone the player is standing in, if any. */
  contractAt: (x: number, z: number) => ContractDef | null;
  getState: () => ContractState[];
  hasCompleted: (id: string) => boolean;
  /** Accept a contract from the board (false when cooling / active). */
  accept: (id: string) => boolean;
  /** Abandon an accepted / active contract (back to dormant). */
  abandon: (id: string) => void;
  /** The player walked out mid-fight: back to accepted, fresh attempt. */
  leave: (id: string) => void;
  /** Mark complete and return whether the cash reward applies. */
  markComplete: (id: string) => boolean;
  markFailed: (id: string) => void;
  /** Reset a contract to dormant (fresh attempt). */
  reset: (id: string) => void;
  setActive: (id: string, active: boolean) => void;
  cooldownLeft: (id: string) => number;
  /** The active defense contract's objective position (null otherwise). */
  getObjective: () => { x: number; z: number } | null;
  /** The objective's health (null when no defense contract is active). */
  getObjectiveHealth: () => { health: number; max: number } | null;
  damageObjective: (amount: number) => void;
  resetObjective: () => void;
  /** The encounter id of the wave currently being fought. */
  currentWaveEncounterId: (contractId: string) => string | null;
  /** Every wave encounter id for a defense contract. */
  waveEncounterIds: (contractId: string) => string[];
  /** The elimination contract's encounter id. */
  eliminationEncounterId: (contractId: string) => string;
  /** Advance to the next wave; returns its encounter id (null when done). */
  advanceWave: (contractId: string) => string | null;
  /** Start the recovery countdown before the next wave. */
  startRecovery: (contractId: string) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

const CONTRACTS_KEY = 'vice-city-stories.contracts.v1';
const REPLAY_COOLDOWN = 180; // 3 minutes between completions
const RECOVERY_SECONDS = 8; // breather between defense waves
export const OBJECTIVE_MAX_HEALTH = 100;

interface ContractSave {
  completed: Record<string, boolean>;
  lastCompletedAt: Record<string, number>;
}

function loadSave(): ContractSave {
  try {
    const raw = window.localStorage.getItem(CONTRACTS_KEY);
    if (raw === null) return { completed: {}, lastCompletedAt: {} };
    const parsed = JSON.parse(raw) as Partial<ContractSave>;
    return {
      completed: parsed.completed && typeof parsed.completed === 'object' ? parsed.completed : {},
      lastCompletedAt: parsed.lastCompletedAt && typeof parsed.lastCompletedAt === 'object' ? parsed.lastCompletedAt : {},
    };
  } catch {
    return { completed: {}, lastCompletedAt: {} };
  }
}

function saveSave(s: ContractSave): void {
  try {
    window.localStorage.setItem(CONTRACTS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — the session still works */
  }
}

function makeSignTexture(text: string, track: <T extends { dispose: () => void }>(r: T) => T): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#241a10';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A spawn / cover point is clear when no building box contains it (1 m margin). */
function clearOfBuildings(x: number, z: number, buildings: BuildingBox[]): boolean {
  for (const b of buildings) {
    if (x > b.minX - 1 && x < b.maxX + 1 && z > b.minZ - 1 && z < b.maxZ + 1) return false;
  }
  return true;
}

/** Nudge a point toward the zone centre until it clears every building. */
function nudgeToClear(
  x: number, z: number, cx: number, cz: number, buildings: BuildingBox[],
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let i = 0; i < 12 && !clearOfBuildings(px, pz, buildings); i++) {
    px += (cx - px) * 0.25;
    pz += (cz - pz) * 0.25;
  }
  return clearOfBuildings(px, pz, buildings) ? { x: px, z: pz } : { x: cx, z: cz };
}

export function createContracts(scene: THREE.Scene, buildings: BuildingBox[]): ContractsHandle {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const group = new THREE.Group();
  group.name = 'contracts';
  scene.add(group);

  const save = loadSave();
  const boxes: BuildingBox[] = [];
  const coverByContract = new Map<string, CoverPoint[]>();

  const crateMat = track(new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.9 }));
  const crateMat2 = track(new THREE.MeshStandardMaterial({ color: 0x4a3f2a, roughness: 0.9 }));
  const sandMat = track(new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }));
  const ringMat = track(new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.6, transparent: true, opacity: 0.8 }));
  const postMat = track(new THREE.MeshStandardMaterial({ color: 0x3a352e, roughness: 0.9 }));

  // The defense objective: a supply crate with a glowing beacon.
  let beaconMat: THREE.MeshStandardMaterial | null = null;
  let beaconMesh: THREE.Mesh | null = null;
  let objectiveHealth = OBJECTIVE_MAX_HEALTH;
  let objectiveFlash = 0;
  let objectivePulse = 0;
  const holdLine = CONTRACT_DEFS.find((d) => d.kind === 'defense');
  if (holdLine?.objective) {
    const ox = holdLine.objective.x;
    const oz = holdLine.objective.z;
    const crate = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 1.2, 1.4)), track(new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.7, metalness: 0.3 })));
    crate.position.set(ox, 0.6, oz);
    crate.castShadow = true;
    crate.receiveShadow = true;
    group.add(crate);
    beaconMat = track(new THREE.MeshStandardMaterial({ color: 0xff8c2e, emissive: 0xff6a00, emissiveIntensity: 1.2, roughness: 0.4 }));
    beaconMesh = new THREE.Mesh(track(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 10)), beaconMat);
    beaconMesh.position.set(ox, 1.65, oz);
    group.add(beaconMesh);
    const objRing = new THREE.Mesh(track(new THREE.RingGeometry(1.8, 2.2, 40)), ringMat);
    objRing.rotation.x = -Math.PI / 2;
    objRing.position.set(ox, 0.06, oz);
    objRing.receiveShadow = true;
    group.add(objRing);
    boxes.push({ minX: ox - 0.8, maxX: ox + 0.8, minZ: oz - 0.8, maxZ: oz + 0.8, maxY: 1.6 });
  }

  for (const def of CONTRACT_DEFS) {
    // Boundary ring on the ground.
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(def.radius - 0.4, def.radius, 48)), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(def.x, 0.06, def.z);
    ring.receiveShadow = true;
    group.add(ring);

    // Sign on two posts, facing the city (west for the docks, west for the beach).
    const signTex = makeSignTexture(def.signText, track);
    const sign = new THREE.Mesh(
      track(new THREE.PlaneGeometry(7, 1.75)),
      track(new THREE.MeshBasicMaterial({ map: signTex })),
    );
    sign.position.set(def.x - def.radius - 1, 2.4, def.z);
    sign.rotation.y = Math.PI / 2;
    group.add(sign);
    for (const dz of [-3, 3]) {
      const post = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 2.4, 0.18)), postMat);
      post.position.set(def.x - def.radius - 1, 1.2, def.z + dz);
      post.castShadow = true;
      group.add(post);
    }

    // Cover objects, nudged clear of buildings (the dockside zone
    // has buildings at its edge on the Ultra tier).
    const points: CoverPoint[] = [];
    for (const c of def.cover) {
      const p = nudgeToClear(c.x, c.z, def.x, def.z, buildings);
      const box: BuildingBox = {
        minX: p.x - c.hw, maxX: p.x + c.hw,
        minZ: p.z - c.hd, maxZ: p.z + c.hd,
        maxY: 2,
      };
      boxes.push(box);
      const mat = c.kind === 'crates' ? crateMat : sandMat;
      const mat2 = c.kind === 'crates' ? crateMat2 : sandMat;
      const lower = new THREE.Mesh(track(new THREE.BoxGeometry(c.hw * 2, 1.1, c.hd * 2)), mat);
      lower.position.set(p.x, 0.55, p.z);
      lower.castShadow = true;
      lower.receiveShadow = true;
      group.add(lower);
      const upper = new THREE.Mesh(track(new THREE.BoxGeometry(c.hw * 1.6, 0.9, c.hd * 1.6)), mat2);
      upper.position.set(p.x, 1.55, p.z);
      upper.castShadow = true;
      group.add(upper);
      for (const [px, pz] of [
        [p.x - c.hw - 1.2, p.z],
        [p.x + c.hw + 1.2, p.z],
        [p.x, p.z - c.hd - 1.2],
        [p.x, p.z + c.hd + 1.2],
      ] as const) {
        points.push({ x: px, z: pz, building: box });
      }
    }
    coverByContract.set(def.id, points);
  }

  // Runtime state. The engine owns 'active' (it knows when the
  // player is inside); this module owns the saved record, the
  // wave clock and the objective's health.
  const status = new Map<string, ContractStatus>();
  const active = new Set<string>();
  const wave = new Map<string, number>();
  const waveState = new Map<string, 'idle' | 'fighting' | 'recovery'>();
  const recoveryLeft = new Map<string, number>();
  for (const def of CONTRACT_DEFS) {
    status.set(def.id, 'dormant');
    wave.set(def.id, 0);
    waveState.set(def.id, 'idle');
    recoveryLeft.set(def.id, 0);
  }

  const getStatus = (id: string): ContractStatus => {
    const last = save.lastCompletedAt[id] ?? 0;
    const cooling = last > 0 && Date.now() - last < REPLAY_COOLDOWN * 1000;
    if (active.has(id)) return 'active';
    const s = status.get(id) ?? 'dormant';
    if (s === 'dormant' && cooling) return 'cooling';
    return s;
  };

  return {
    collisionBoxes: () => boxes,
    coverPoints: (id) => coverByContract.get(id) ?? [],
    contractAt: (x, z) => {
      for (const def of CONTRACT_DEFS) {
        if (Math.hypot(x - def.x, z - def.z) <= def.radius) return def;
      }
      return null;
    },
    getState: () =>
      CONTRACT_DEFS.map((def) => {
        const last = save.lastCompletedAt[def.id] ?? 0;
        const cooling = last > 0 && Date.now() - last < REPLAY_COOLDOWN * 1000;
        return {
          id: def.id,
          name: def.name,
          giver: def.giver,
          description: def.description,
          kind: def.kind,
          location: def.location,
          status: getStatus(def.id),
          reward: def.rewardCash,
          completedOnce: !!save.completed[def.id],
          cooldownLeft: cooling ? Math.ceil((REPLAY_COOLDOWN * 1000 - (Date.now() - last)) / 1000) : 0,
          wave: wave.get(def.id) ?? 0,
          totalWaves: def.waves.length,
          waveState: waveState.get(def.id) ?? 'idle',
          recoveryLeft: Math.ceil(recoveryLeft.get(def.id) ?? 0),
          remaining: 0, // the engine fills this in from the enemy states
          objectiveHealth: def.kind === 'defense' ? objectiveHealth : 0,
          objectiveMax: def.kind === 'defense' ? OBJECTIVE_MAX_HEALTH : 0,
        };
      }),
    hasCompleted: (id) => !!save.completed[id],
    accept: (id) => {
      const def = CONTRACT_DEFS.find((d) => d.id === id);
      if (!def) return false;
      const last = save.lastCompletedAt[id] ?? 0;
      if (last > 0 && Date.now() - last < REPLAY_COOLDOWN * 1000) return false;
      const s = status.get(id) ?? 'dormant';
      if (s === 'accepted' || s === 'active') return false;
      status.set(id, 'accepted');
      wave.set(id, 0);
      waveState.set(id, 'idle');
      recoveryLeft.set(id, 0);
      if (def.kind === 'defense') objectiveHealth = OBJECTIVE_MAX_HEALTH;
      return true;
    },
    abandon: (id) => {
      status.set(id, 'dormant');
      active.delete(id);
      wave.set(id, 0);
      waveState.set(id, 'idle');
      recoveryLeft.set(id, 0);
      const def = CONTRACT_DEFS.find((d) => d.id === id);
      if (def?.kind === 'defense') objectiveHealth = OBJECTIVE_MAX_HEALTH;
    },
    leave: (id) => {
      active.delete(id);
      status.set(id, 'accepted');
      wave.set(id, 0);
      waveState.set(id, 'idle');
      recoveryLeft.set(id, 0);
      const def = CONTRACT_DEFS.find((d) => d.id === id);
      if (def?.kind === 'defense') objectiveHealth = OBJECTIVE_MAX_HEALTH;
    },
    markComplete: (id) => {
      const first = !save.completed[id];
      save.completed[id] = true;
      save.lastCompletedAt[id] = Date.now();
      saveSave(save);
      active.delete(id);
      status.set(id, 'dormant');
      wave.set(id, 0);
      waveState.set(id, 'idle');
      recoveryLeft.set(id, 0);
      return first;
    },
    markFailed: (id) => {
      active.delete(id);
      status.set(id, 'failed');
      wave.set(id, 0);
      waveState.set(id, 'idle');
      recoveryLeft.set(id, 0);
      const def = CONTRACT_DEFS.find((d) => d.id === id);
      if (def?.kind === 'defense') objectiveHealth = OBJECTIVE_MAX_HEALTH;
    },
    reset: (id) => {
      active.delete(id);
      status.set(id, 'dormant');
      wave.set(id, 0);
      waveState.set(id, 'idle');
      recoveryLeft.set(id, 0);
      const def = CONTRACT_DEFS.find((d) => d.id === id);
      if (def?.kind === 'defense') objectiveHealth = OBJECTIVE_MAX_HEALTH;
    },
    setActive: (id, isActive) => {
      if (isActive) active.add(id);
      else active.delete(id);
    },
    cooldownLeft: (id) => {
      const last = save.lastCompletedAt[id] ?? 0;
      if (last === 0) return 0;
      return Math.max(0, Math.ceil((REPLAY_COOLDOWN * 1000 - (Date.now() - last)) / 1000));
    },
    getObjective: () => {
      const def = CONTRACT_DEFS.find((d) => d.kind === 'defense');
      if (!def?.objective) return null;
      return active.has(def.id) ? { ...def.objective } : null;
    },
    getObjectiveHealth: () => {
      const def = CONTRACT_DEFS.find((d) => d.kind === 'defense');
      if (!def?.objective) return null;
      return active.has(def.id) ? { health: objectiveHealth, max: OBJECTIVE_MAX_HEALTH } : null;
    },
    damageObjective: (amount) => {
      if (objectiveHealth <= 0) return;
      objectiveHealth = Math.max(0, objectiveHealth - amount);
      objectiveFlash = 0.3;
    },
    resetObjective: () => {
      objectiveHealth = OBJECTIVE_MAX_HEALTH;
      objectiveFlash = 0;
      if (beaconMat) {
        beaconMat.emissive.setHex(0xff6a00);
        beaconMat.emissiveIntensity = 1.2;
      }
      if (beaconMesh) beaconMesh.rotation.x = 0;
    },
    currentWaveEncounterId: (contractId) => {
      const def = CONTRACT_DEFS.find((d) => d.id === contractId);
      if (!def || def.waves.length === 0) return null;
      const w = wave.get(contractId) ?? 0;
      if (w < 1 || w > def.waves.length) return null;
      return def.waves[w - 1].encounterId;
    },
    waveEncounterIds: (contractId) => {
      const def = CONTRACT_DEFS.find((d) => d.id === contractId);
      return def ? def.waves.map((w) => w.encounterId) : [];
    },
    eliminationEncounterId: (contractId) => contractId,
    advanceWave: (contractId) => {
      const def = CONTRACT_DEFS.find((d) => d.id === contractId);
      if (!def || def.waves.length === 0) return null;
      const next = (wave.get(contractId) ?? 0) + 1;
      if (next > def.waves.length) return null;
      wave.set(contractId, next);
      waveState.set(contractId, 'fighting');
      recoveryLeft.set(contractId, 0);
      return def.waves[next - 1].encounterId;
    },
    startRecovery: (contractId) => {
      waveState.set(contractId, 'recovery');
      recoveryLeft.set(contractId, RECOVERY_SECONDS);
    },
    update: (dt) => {
      // Recovery countdown (defense only).
      for (const def of CONTRACT_DEFS) {
        if (waveState.get(def.id) === 'recovery') {
          recoveryLeft.set(def.id, Math.max(0, (recoveryLeft.get(def.id) ?? 0) - dt));
        }
      }
      // The beacon pulses; a hit flashes it red.
      objectivePulse += dt;
      if (beaconMat) {
        if (objectiveFlash > 0) {
          objectiveFlash -= dt;
          beaconMat.emissive.setHex(0xdd1100);
          beaconMat.emissiveIntensity = 2.2;
        } else if (objectiveHealth <= 0) {
          beaconMat.emissive.setHex(0x000000);
          beaconMat.emissiveIntensity = 0;
        } else {
          beaconMat.emissive.setHex(0xff6a00);
          beaconMat.emissiveIntensity = 1.1 + 0.35 * Math.sin(objectivePulse * 2.4);
        }
      }
      if (beaconMesh && objectiveHealth <= 0) {
        beaconMesh.rotation.x = Math.min(beaconMesh.rotation.x + dt * 2, Math.PI / 2);
      }
    },
    dispose: () => {
      scene.remove(group);
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* already disposed */
        }
      }
    },
  };
}

/** Let the engine spawn a contract's enemies (its defs live here). */
export function contractDefById(id: string): ContractDef | undefined {
  return CONTRACT_DEFS.find((d) => d.id === id);
}

/** Validated spawn points for a contract (clear of buildings). */
export function contractSpawns(def: ContractDef, buildings: BuildingBox[]): EnemySpawnDef[] {
  return def.spawns.map((s) => {
    const p = nudgeToClear(s.x, s.z, def.x, def.z, buildings);
    return { ...s, x: p.x, z: p.z };
  });
}

/** Validated wave spawn points for a defense contract. */
export function contractWaveSpawns(def: ContractDef, waveIdx: number, buildings: BuildingBox[]): EnemySpawnDef[] {
  const w = def.waves[waveIdx];
  if (!w) return [];
  return w.enemies.map((s) => {
    const p = nudgeToClear(s.x, s.z, def.x, def.z, buildings);
    return { ...s, x: p.x, z: p.z };
  });
}
