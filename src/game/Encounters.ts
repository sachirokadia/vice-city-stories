/**
 * Encounter zones — the Phase 8B controlled combat locations.
 *
 * Two zones on the open beach (the only large open ground that
 * is not a mission objective, the garage, the shop or the range):
 *
 * - South Beach (165, 150): open sand, 60 m south of the
 *   MIDNIGHT DELIVERY beach point.
 * - North Dunes (165, -170): open sand, 18 m north of the
 *   range's backstop berm (the range itself stays safe).
 *
 * Each zone has a visible boundary (a gold ring + a sign), three
 * enemies, a clear completion condition (defeat all three), a
 * reward, and a reset/replay rule. The boundary is a trigger,
 * not a wall — the player can walk out at any time, and leaving
 * mid-fight resets the encounter so each attempt is fresh.
 *
 * Rewards: the first completion pays $250 cash plus a free ammo
 * restock. Replays (after a 3-minute cooldown) pay ammo only —
 * no cash, so the encounters cannot be farmed. The completion
 * record lives under its own key, separate from mission
 * progress, and the cash always goes through the mission
 * manager (the single cash source of truth).
 */
import * as THREE from 'three';
import type { BuildingBox } from './World';
import type { CoverPoint, EnemySpawnDef } from './Enemies';

export interface EncounterDef {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  /** Cash for the FIRST completion (replays pay none). */
  rewardCash: number;
  /** Enemy spawns: variant, home, patrol route. */
  spawns: EnemySpawnDef[];
  /** Cover objects: centre, half-width, half-depth (2 m tall). */
  cover: Array<{ x: number; z: number; hw: number; hd: number; kind: 'crates' | 'sandbags' }>;
  signText: string;
}

export const ENCOUNTER_DEFS: EncounterDef[] = [
  {
    id: 'south-beach',
    name: 'South Beach',
    x: 165,
    z: 150,
    radius: 18,
    rewardCash: 250,
    spawns: [
      { variant: 'yard-enforcer', x: 158, z: 145, patrol: [{ x: 158, z: 145 }, { x: 162, z: 152 }, { x: 156, z: 156 }] },
      { variant: 'lot-runner', x: 171, z: 155, patrol: [{ x: 171, z: 155 }, { x: 168, z: 147 }, { x: 174, z: 150 }] },
      { variant: 'northgate-lookout', x: 165, z: 141, patrol: [{ x: 165, z: 141 }, { x: 160, z: 148 }, { x: 170, z: 144 }] },
    ],
    cover: [
      { x: 156, z: 150, hw: 1.8, hd: 0.6, kind: 'crates' },
      { x: 174, z: 148, hw: 1.8, hd: 0.6, kind: 'sandbags' },
      { x: 165, z: 160, hw: 1.8, hd: 0.6, kind: 'crates' },
    ],
    signText: 'SOUTH BEACH · CREW TURF',
  },
  {
    id: 'north-dunes',
    name: 'North Dunes',
    x: 165,
    z: -170,
    radius: 18,
    rewardCash: 250,
    spawns: [
      { variant: 'northgate-lookout', x: 158, z: -175, patrol: [{ x: 158, z: -175 }, { x: 162, z: -168 }, { x: 156, z: -166 }] },
      { variant: 'yard-enforcer', x: 171, z: -165, patrol: [{ x: 171, z: -165 }, { x: 168, z: -173 }, { x: 174, z: -170 }] },
      { variant: 'lot-runner', x: 165, z: -178, patrol: [{ x: 165, z: -178 }, { x: 160, z: -172 }, { x: 170, z: -176 }] },
    ],
    cover: [
      { x: 156, z: -170, hw: 1.8, hd: 0.6, kind: 'sandbags' },
      { x: 174, z: -172, hw: 1.8, hd: 0.6, kind: 'crates' },
      { x: 165, z: -160, hw: 1.8, hd: 0.6, kind: 'sandbags' },
    ],
    signText: 'NORTH DUNES · CREW TURF',
  },
];

export type EncounterStatus = 'dormant' | 'active' | 'complete' | 'cooling';

export interface EncounterState {
  id: string;
  name: string;
  status: EncounterStatus;
  /** Enemies still standing in the active encounter. */
  remaining: number;
  /** True when the first-completion cash has been paid. */
  completedOnce: boolean;
  /** Seconds until a replay is available (0 when ready). */
  cooldownLeft: number;
}

export interface EncountersHandle {
  /** Collision boxes for the cover objects (join the world list). */
  collisionBoxes: () => BuildingBox[];
  /** Cover points for the enemy AI (one per face of each object). */
  coverPoints: (id: string) => CoverPoint[];
  /** The encounter the player is standing in, if any. */
  encounterAt: (x: number, z: number) => EncounterDef | null;
  getState: () => EncounterState[];
  /** True when this encounter has ever been completed. */
  hasCompleted: (id: string) => boolean;
  /** Mark an encounter complete and return whether the cash reward applies. */
  markComplete: (id: string) => boolean;
  /** Reset an encounter to dormant (enemies respawn fresh). */
  reset: (id: string) => void;
  /** The engine's trigger: the player entered / left the zone. */
  setActive: (id: string, active: boolean) => void;
  /** Seconds until the encounter can be replayed. */
  cooldownLeft: (id: string) => number;
  update: (dt: number) => void;
  dispose: () => void;
}

const ENCOUNTERS_KEY = 'vice-city-stories.encounters.v1';
const REPLAY_COOLDOWN = 180; // 3 minutes between completions

interface EncounterSave {
  completed: Record<string, boolean>;
  lastCompletedAt: Record<string, number>;
}

function loadSave(): EncounterSave {
  try {
    const raw = window.localStorage.getItem(ENCOUNTERS_KEY);
    if (raw === null) return { completed: {}, lastCompletedAt: {} };
    const parsed = JSON.parse(raw) as Partial<EncounterSave>;
    return {
      completed: parsed.completed && typeof parsed.completed === 'object' ? parsed.completed : {},
      lastCompletedAt: parsed.lastCompletedAt && typeof parsed.lastCompletedAt === 'object' ? parsed.lastCompletedAt : {},
    };
  } catch {
    return { completed: {}, lastCompletedAt: {} };
  }
}

function saveSave(s: EncounterSave): void {
  try {
    window.localStorage.setItem(ENCOUNTERS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — the session still works */
  }
}

function makeSignTexture(text: string, track: <T extends { dispose: () => void }>(r: T) => T): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2e2a33';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#ff5e8a';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createEncounters(scene: THREE.Scene): EncountersHandle {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const group = new THREE.Group();
  group.name = 'encounters';
  scene.add(group);

  const save = loadSave();
  const boxes: BuildingBox[] = [];
  const coverByEncounter = new Map<string, CoverPoint[]>();

  const crateMat = track(new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.9 }));
  const crateMat2 = track(new THREE.MeshStandardMaterial({ color: 0x4a3f2a, roughness: 0.9 }));
  const sandMat = track(new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }));
  const ringMat = track(new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.6, transparent: true, opacity: 0.8 }));
  const postMat = track(new THREE.MeshStandardMaterial({ color: 0x3a352e, roughness: 0.9 }));

  for (const def of ENCOUNTER_DEFS) {
    // Boundary ring on the sand.
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(def.radius - 0.4, def.radius, 48)), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(def.x, 0.06, def.z);
    ring.receiveShadow = true;
    group.add(ring);

    // Sign on two posts, facing the city (west).
    const signTex = makeSignTexture(def.signText, track);
    const sign = new THREE.Mesh(
      track(new THREE.PlaneGeometry(7, 1.75)),
      track(new THREE.MeshBasicMaterial({ map: signTex })),
    );
    sign.position.set(def.x - def.radius - 1, 2.4, def.z);
    sign.rotation.y = Math.PI / 2; // faces west, toward the boardwalk
    group.add(sign);
    for (const dz of [-3, 3]) {
      const post = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 2.4, 0.18)), postMat);
      post.position.set(def.x - def.radius - 1, 1.2, def.z + dz);
      post.castShadow = true;
      group.add(post);
    }

    // Cover objects: 2 m tall, solid, with a cover point on each face.
    const points: CoverPoint[] = [];
    for (const c of def.cover) {
      const box: BuildingBox = {
        minX: c.x - c.hw, maxX: c.x + c.hw,
        minZ: c.z - c.hd, maxZ: c.z + c.hd,
        maxY: 2,
      };
      boxes.push(box);
      const mat = c.kind === 'crates' ? crateMat : sandMat;
      const mat2 = c.kind === 'crates' ? crateMat2 : sandMat;
      // Two stacked boxes read as a crate pile / sandbag wall.
      const lower = new THREE.Mesh(track(new THREE.BoxGeometry(c.hw * 2, 1.1, c.hd * 2)), mat);
      lower.position.set(c.x, 0.55, c.z);
      lower.castShadow = true;
      lower.receiveShadow = true;
      group.add(lower);
      const upper = new THREE.Mesh(track(new THREE.BoxGeometry(c.hw * 1.6, 0.9, c.hd * 1.6)), mat2);
      upper.position.set(c.x, 1.55, c.z);
      upper.castShadow = true;
      group.add(upper);
      // One cover point per face, 1.2 m out from the object.
      for (const [px, pz] of [
        [c.x - c.hw - 1.2, c.z],
        [c.x + c.hw + 1.2, c.z],
        [c.x, c.z - c.hd - 1.2],
        [c.x, c.z + c.hd + 1.2],
      ] as const) {
        points.push({ x: px, z: pz, building: box });
      }
    }
    coverByEncounter.set(def.id, points);
  }

  // Runtime status: the engine owns 'active' (it knows when the
  // player is inside); this module owns the saved record.
  const active = new Set<string>();

  return {
    collisionBoxes: () => boxes,
    coverPoints: (id) => coverByEncounter.get(id) ?? [],
    encounterAt: (x, z) => {
      for (const def of ENCOUNTER_DEFS) {
        if (Math.hypot(x - def.x, z - def.z) <= def.radius) return def;
      }
      return null;
    },
    getState: () =>
      ENCOUNTER_DEFS.map((def) => {
        const last = save.lastCompletedAt[def.id] ?? 0;
        const cooling = last > 0 && Date.now() - last < REPLAY_COOLDOWN * 1000;
        return {
          id: def.id,
          name: def.name,
          status: (active.has(def.id) ? 'active' : cooling ? 'cooling' : 'dormant') as EncounterStatus,
          remaining: 0, // the engine fills this in from the enemy states
          completedOnce: !!save.completed[def.id],
          cooldownLeft: cooling ? Math.ceil((REPLAY_COOLDOWN * 1000 - (Date.now() - last)) / 1000) : 0,
        };
      }),
    hasCompleted: (id) => !!save.completed[id],
    markComplete: (id) => {
      const first = !save.completed[id];
      save.completed[id] = true;
      save.lastCompletedAt[id] = Date.now();
      saveSave(save);
      active.delete(id);
      return first;
    },
    reset: (id) => {
      active.delete(id);
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
    update: () => {
      /* The cooldown is wall-clock based (Date.now), so nothing
       * needs to tick here; the method exists for symmetry. */
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

/** Let the engine mark an encounter active (its trigger lives in the tick). */
export function encounterDefById(id: string): EncounterDef | undefined {
  return ENCOUNTER_DEFS.find((d) => d.id === id);
}
