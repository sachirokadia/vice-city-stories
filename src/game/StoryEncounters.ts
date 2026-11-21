/**
 * Story combat encounters — Phase 9E.
 *
 * The story's fights reuse the enemy system (Enemies.ts) and the
 * contract-objective beacon (Contracts.ts); this file is only the
 * DATA for the story's encounters: spawn points, patrols and
 * cover, plus the cover meshes for the story-only zones.
 *
 * The story encounters are NEVER registered in the Encounters
 * zone module — they have no walk-in trigger. The campaign
 * activates them (dormant spawn → activate → fight) and only
 * the campaign deactivates them, so a fight cannot start by
 * accident and cannot leak enemies into free roam.
 *
 * Zones:
 * - story-dockside: the 2.3 elimination at the South Docks —
 *   same three spawns and cover as the DOCKSIDE TROUBLE
 *   contract (a different crew is holding the same docks).
 * - story-defend-w1..w3: the 2.2 defense waves on Mid-Beach —
 *   same composition and cover as the HOLD THE LINE contract;
 *   the cover meshes already exist from Contracts, so this
 *   file only computes the cover POINTS (no new meshes).
 * - story-nest-a / story-nest-b: the 3.2 warehouse-yard
 *   groups at (120, -150), two groups of three, with two
 *   crate cover objects on the sidewalk corners.
 *
 * Spawn/cover points are nudged clear of buildings the same
 * way contractSpawns does — the warehouse yard sits on a road
 * intersection, so the nudges rarely fire.
 */
import * as THREE from 'three';
import type { BuildingBox } from './World';
import type { CoverPoint, EnemySpawnDef } from './Enemies';

export interface StoryEncounterDef {
  /** Group id (a defense group's waves get their own ids). */
  id: string;
  kind: 'elimination' | 'defense';
  x: number;
  z: number;
  radius: number;
  /** Elimination: the designated enemies. */
  spawns: EnemySpawnDef[];
  /** Defense: one array of enemies per wave. */
  waves: EnemySpawnDef[][];
  /** Cover objects: centre, half-width, half-depth (2 m tall). */
  cover: Array<{ x: number; z: number; hw: number; hd: number; kind: 'crates' | 'sandbags' }>;
  /** False when the physical cover already exists in the scene
   * (the beach defense reuses the contract's cover). */
  buildCoverMeshes: boolean;
}

export const STORY_ENCOUNTER_DEFS: StoryEncounterDef[] = [
  {
    id: 'story-dockside',
    kind: 'elimination',
    x: 0,
    z: 170,
    radius: 18,
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
    buildCoverMeshes: true,
  },
  {
    id: 'story-defend',
    kind: 'defense',
    x: 165,
    z: 0,
    radius: 18,
    spawns: [],
    waves: [
      [
        { variant: 'lot-runner', x: 165, z: -14, patrol: [{ x: 165, z: -14 }, { x: 165, z: -8 }] },
        { variant: 'yard-enforcer', x: 151, z: 0, patrol: [{ x: 151, z: 0 }, { x: 157, z: 0 }] },
      ],
      [
        { variant: 'northgate-lookout', x: 179, z: 0, patrol: [{ x: 179, z: 0 }, { x: 173, z: 0 }] },
        { variant: 'lot-runner', x: 165, z: 14, patrol: [{ x: 165, z: 14 }, { x: 165, z: 8 }] },
        { variant: 'yard-enforcer', x: 165, z: -14, patrol: [{ x: 165, z: -14 }, { x: 165, z: -8 }] },
      ],
      [
        { variant: 'yard-enforcer', x: 165, z: -14, patrol: [{ x: 165, z: -14 }, { x: 165, z: -8 }] },
        { variant: 'yard-enforcer', x: 165, z: 14, patrol: [{ x: 165, z: 14 }, { x: 165, z: 8 }] },
        { variant: 'northgate-lookout', x: 151, z: 0, patrol: [{ x: 151, z: 0 }, { x: 157, z: 0 }] },
      ],
    ],
    cover: [
      { x: 157, z: 0, hw: 1.8, hd: 0.6, kind: 'sandbags' },
      { x: 173, z: 0, hw: 1.8, hd: 0.6, kind: 'crates' },
      { x: 165, z: 9, hw: 1.8, hd: 0.6, kind: 'sandbags' },
    ],
    buildCoverMeshes: false,
  },
  {
    id: 'story-nest-a',
    kind: 'elimination',
    x: 120,
    z: -150,
    radius: 18,
    spawns: [
      { variant: 'yard-enforcer', x: 120, z: -158, patrol: [{ x: 120, z: -158 }, { x: 120, z: -152 }] },
      { variant: 'lot-runner', x: 114, z: -150, patrol: [{ x: 114, z: -150 }, { x: 118, z: -150 }] },
      { variant: 'northgate-lookout', x: 126, z: -150, patrol: [{ x: 126, z: -150 }, { x: 122, z: -150 }] },
    ],
    waves: [],
    cover: [
      { x: 114, z: -156, hw: 1.8, hd: 0.6, kind: 'crates' },
      { x: 126, z: -144, hw: 1.8, hd: 0.6, kind: 'crates' },
    ],
    buildCoverMeshes: true,
  },
  {
    id: 'story-nest-b',
    kind: 'elimination',
    x: 120,
    z: -150,
    radius: 18,
    spawns: [
      { variant: 'yard-enforcer', x: 120, z: -142, patrol: [{ x: 120, z: -142 }, { x: 120, z: -148 }] },
      { variant: 'lot-runner', x: 126, z: -156, patrol: [{ x: 126, z: -156 }, { x: 122, z: -152 }] },
      { variant: 'northgate-lookout', x: 114, z: -144, patrol: [{ x: 114, z: -144 }, { x: 118, z: -148 }] },
    ],
    waves: [],
    cover: [
      { x: 114, z: -156, hw: 1.8, hd: 0.6, kind: 'crates' },
      { x: 126, z: -144, hw: 1.8, hd: 0.6, kind: 'crates' },
    ],
    buildCoverMeshes: false,
  },
];

/** Encounter ids the campaign activates, per def. */
export function storyEncounterIds(def: StoryEncounterDef): string[] {
  if (def.kind === 'defense') {
    return def.waves.map((_, i) => `${def.id}-w${i + 1}`);
  }
  return [def.id];
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

/** Validated spawn points for a story encounter (clear of buildings). */
export function storyEncounterSpawns(def: StoryEncounterDef, buildings: BuildingBox[]): EnemySpawnDef[] {
  return def.spawns.map((s) => {
    const p = nudgeToClear(s.x, s.z, def.x, def.z, buildings);
    return { ...s, x: p.x, z: p.z };
  });
}

/** Validated wave spawn points for a defense story encounter. */
export function storyEncounterWaveSpawns(def: StoryEncounterDef, waveIdx: number, buildings: BuildingBox[]): EnemySpawnDef[] {
  const w = def.waves[waveIdx];
  if (!w) return [];
  return w.map((s) => {
    const p = nudgeToClear(s.x, s.z, def.x, def.z, buildings);
    return { ...s, x: p.x, z: p.z };
  });
}

/** Cover points for a story encounter (four stand-off points per cover rect). */
function coverPointsFor(def: StoryEncounterDef, buildings: BuildingBox[]): CoverPoint[] {
  const points: CoverPoint[] = [];
  for (const c of def.cover) {
    const p = nudgeToClear(c.x, c.z, def.x, def.z, buildings);
    const box: BuildingBox = {
      minX: p.x - c.hw, maxX: p.x + c.hw,
      minZ: p.z - c.hd, maxZ: p.z + c.hd,
      maxY: 2,
    };
    for (const [px, pz] of [
      [p.x - c.hw - 1.2, p.z],
      [p.x + c.hw + 1.2, p.z],
      [p.x, p.z - c.hd - 1.2],
      [p.x, p.z + c.hd + 1.2],
    ] as const) {
      points.push({ x: px, z: pz, building: box });
    }
  }
  return points;
}

export interface StoryEncountersHandle {
  /** Collision boxes for the story cover meshes (re-added on quality rebuilds). */
  boxes: BuildingBox[];
  coverPoints: (encounterId: string) => CoverPoint[];
}

/**
 * Build the story cover meshes and compute cover points.
 * The defense waves reuse the contract's physical cover, so
 * their rects produce points only — no meshes, no boxes.
 */
export function createStoryEncounters(scene: THREE.Scene, buildings: BuildingBox[]): StoryEncountersHandle {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const group = new THREE.Group();
  group.name = 'story-encounters';
  scene.add(group);

  const boxes: BuildingBox[] = [];
  const coverByEncounter = new Map<string, CoverPoint[]>();

  const crateMat = track(new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.9 }));
  const crateMat2 = track(new THREE.MeshStandardMaterial({ color: 0x4a3f2a, roughness: 0.9 }));
  const sandMat = track(new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }));

  for (const def of STORY_ENCOUNTER_DEFS) {
    const points = coverPointsFor(def, buildings);
    for (const id of storyEncounterIds(def)) {
      coverByEncounter.set(id, points);
    }
    if (!def.buildCoverMeshes) continue;
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
    }
  }

  return {
    boxes,
    coverPoints: (id) => coverByEncounter.get(id) ?? [],
  };
}
