/**
 * Police: original procedural patrol cars (sedan + SUV) with the
 * wanted system's pursuit, search and roadblock behaviour.
 *
 * Two original police vehicles — a black-and-white sedan and SUV
 * with a push bar and a flashing red/blue light bar — no copied
 * police models or textures, no text decals (the livery carries the
 * identity). Rendered instanced like the traffic fleet: 2 body
 * meshes, 1 shared wheel mesh, 1 shared light mesh, 1 light-bar
 * mesh — 5 draw calls for up to 6 units.
 *
 * AI: patrol follows the lane graph (random turns, stops at red
 * lights, yields, avoids traffic, pedestrians and the player's car).
 * On a wanted level, units are assigned to pursue: they navigate
 * the graph greedily toward the player (or a cut-off point ahead of
 * them), run red lights slowly instead of stopping, and keep a gap
 * instead of ramming. When the player breaks line of sight they
 * search the last known area; at 3+ stars two units form a
 * roadblock across the road ahead. Units far from the player update
 * at half rate. Nothing is created or destroyed per frame.
 */
import * as THREE from 'three';
import { buildLaneGraph, randomRingLaneNode, trafficRandom } from './TrafficPaths';
import type { LaneGraph } from './TrafficPaths';
import { AVENUES, STREETS } from './PedestrianPaths';
import type { BuildingBox } from './World';
import { GeometryBatch, composeMatrix } from './Merge';
import type { WantedStatus } from './Wanted';

export type PoliceChoice = 'off' | 'low' | 'normal' | 'high';
export const POLICE_COUNTS: Record<PoliceChoice, number> = {
  off: 0,
  low: 2,
  normal: 4,
  high: 6,
};
export type PursuitDifficulty = 'easy' | 'normal' | 'hard';

const MAX_UNITS = 6;
const DIFF_SPEED: Record<PursuitDifficulty, number> = { easy: 0.85, normal: 1, hard: 1.15 };
const DIFF_SIGHT: Record<PursuitDifficulty, number> = { easy: 45, normal: 55, hard: 65 };
/** Pursuers per wanted level (roadblock takes 2 more at 3+ stars). */
const PURSUERS_FOR_LEVEL = [0, 1, 2, 2, 3, 4];
const ROADBLOCK_MIN_LEVEL = 3;

export type PoliceUnitState = 'patrol' | 'pursue' | 'search' | 'roadblock';

export interface PoliceContext {
  playerPos: THREE.Vector3;
  playerSpeed: number;
  driving: boolean;
  vehiclePos: THREE.Vector3;
  vehicleSpeed: number;
  vehicleHeading: number;
  npcs: Array<{ x: number; z: number; onCrosswalk: boolean }>;
  aiVehicles: Array<{ x: number; z: number; heading: number; speed: number }>;
  buildings: BuildingBox[];
  avenueGreen: boolean;
  wanted: { level: number; status: WantedStatus; lastKnown: { x: number; z: number } | null };
  camForward: { x: number; z: number };
}

export interface PoliceUnitInfo {
  x: number;
  z: number;
  heading: number;
  speed: number;
  kind: string;
  state: PoliceUnitState;
  braking: boolean;
}

export interface NearestPursuer {
  slot: number;
  x: number;
  z: number;
  /** Distance to the player (or their car). */
  dist: number;
  /** The police module's line-of-sight verdict for this unit. */
  sees: boolean;
}

export interface PoliceHandle {
  /** Returns true when any unit moved (shadow refresh hint). */
  update: (dt: number, ctx: PoliceContext) => boolean;
  setCount: (choice: PoliceChoice) => void;
  setDifficulty: (d: PursuitDifficulty) => void;
  activeCount: () => number;
  totalCount: () => number;
  /** Active units (for NPC reactions and QA). */
  listUnits: () => PoliceUnitInfo[];
  /** Did any unit see the player this frame? */
  anySeesPlayer: () => boolean;
  /** Closest active pursuer, from the last update (null if none). */
  nearestPursuer: () => NearestPursuer | null;
  /**
   * Direct one unit to approach a point and stop near it (the
   * arrest approach). Null clears it. The slot is the unit to
   * send; pass null to let the module pick the nearest pursuer.
   */
  setArrestTarget: (target: { x: number; z: number; slot: number | null } | null) => void;
  /** All units back to patrol, roadblocks dissolved, no teleporting. */
  resetToPatrol: () => void;
  dispose: () => void;
}

interface PoliceSpec {
  key: 'sedan' | 'suv';
  length: number;
  width: number;
  bodyH: number;
  bodyY: number;
  cabinL: number;
  cabinW: number;
  cabinH: number;
  cabinY: number;
  cabinZ: number;
  wheelR: number;
  axle: number;
  lightY: number;
  lightBarY: number;
  cruiseMin: number;
  cruiseMax: number;
}

const BODY_BLACK = 0x23262e;
const DOOR_WHITE = 0xe8e8e8;
const GLASS = 0x12161c;
const TRIM = 0x1a1a20;

const SPECS: PoliceSpec[] = [
  {
    key: 'sedan', length: 4.4, width: 1.9, bodyH: 0.55, bodyY: 0.45,
    cabinL: 2.2, cabinW: 1.7, cabinH: 0.5, cabinY: 0.95, cabinZ: -0.2,
    wheelR: 0.36, axle: 1.42, lightY: 0.5, lightBarY: 1.24,
    cruiseMin: 8, cruiseMax: 10,
    // extras are added in buildBodyGeometry below.
  },
  {
    key: 'suv', length: 4.8, width: 2.0, bodyH: 0.7, bodyY: 0.55,
    cabinL: 2.8, cabinW: 1.8, cabinH: 0.55, cabinY: 1.15, cabinZ: -0.1,
    wheelR: 0.38, axle: 1.5, lightY: 0.6, lightBarY: 1.5,
    cruiseMin: 7, cruiseMax: 9,
  },
];

const ACCEL = 5;
const BRAKE = 13;

const _mRoot = new THREE.Matrix4();
const _mA = new THREE.Matrix4();
const _mB = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

const lerpAngle = (a: number, b: number, t: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const angleDiff = (a: number, b: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const zeroMat = (out: THREE.Matrix4): THREE.Matrix4 => {
  _v.set(0, -10, 0);
  _q.identity();
  _s.set(0, 0, 0);
  return out.compose(_v, _q, _s);
};

interface PoliceUnit {
  active: boolean;
  spec: PoliceSpec;
  slot: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  cruise: number;
  node: number;
  next: number;
  wheelSpin: number;
  steer: number;
  braking: boolean;
  state: PoliceUnitState;
  /** Goal point for pursue/search navigation. */
  goalX: number;
  goalZ: number;
  /** Accumulated dt for the half-rate far update. */
  pendingDt: number;
  /** How long this unit has sat at its roadblock spot. */
  roadblockTimer: number;
}

export function createPolice(
  scene: THREE.Scene,
  choice: PoliceChoice,
  difficulty: PursuitDifficulty,
  getSignals: () => { isAvenueGreen: () => boolean },
): PoliceHandle {
  const graph: LaneGraph = buildLaneGraph();
  const rand = trafficRandom();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const group = new THREE.Group();
  group.name = 'police';
  let diff: PursuitDifficulty = difficulty;
  let frame = 0;
  let seenThisFrame = false;
  let time = 0;
  let roadblock: { cx: number; cz: number; units: number[] } | null = null;
  let roadblockCooldown = 0;
  /** The unit sent to approach the player for an arrest. */
  let arrestTarget: { x: number; z: number; slot: number } | null = null;
  /** Closest active pursuer from the last update. */
  let lastNearest: NearestPursuer | null = null;

  // --- Body geometry: black body, white doors + roof, glass cabin,
  // push bar, light-bar base. Forward is +Z, like the traffic fleet.
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  const bodyMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.05 }),
  );
  const addColoredBox = (
    batch: GeometryBatch,
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    hex: number,
  ): void => {
    const g = unitBox.clone();
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color(hex);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    batch.add(g, composeMatrix(x, y, z, 0, w, h, d));
    g.dispose();
  };
  const bodyMeshes: THREE.InstancedMesh[] = [];
  for (const spec of SPECS) {
    const batch = new GeometryBatch();
    addColoredBox(batch, spec.width, spec.bodyH, spec.length, 0, spec.bodyY, 0, BODY_BLACK);
    addColoredBox(batch, spec.cabinW, spec.cabinH, spec.cabinL, 0, spec.cabinY, spec.cabinZ, GLASS);
    // White doors + roof: the black-and-white livery. The roof
    // panel sits on TOP of the glass cabin (its top face) — the
    // first version put it at body height, inside the cabin, and
    // the cars read as black slabs from behind.
    const doorL = spec.key === 'suv' ? 2.6 : 2.2;
    const doorH = spec.key === 'suv' ? 0.5 : 0.4;
    addColoredBox(batch, 0.06, doorH, doorL, -spec.width / 2 - 0.01, spec.bodyY + 0.05, 0, DOOR_WHITE);
    addColoredBox(batch, 0.06, doorH, doorL, spec.width / 2 + 0.01, spec.bodyY + 0.05, 0, DOOR_WHITE);
    addColoredBox(batch, spec.cabinW, 0.05, spec.cabinL, 0, spec.cabinY + spec.cabinH / 2 + 0.02, 0, DOOR_WHITE);
    // Push bar on the nose.
    addColoredBox(batch, spec.width - 0.3, 0.32, 0.08, 0, 0.35, spec.length / 2 + 0.02, TRIM);
    // Light-bar base on the roof (the flashing halves sit on it).
    addColoredBox(batch, 1.3, 0.06, 0.35, 0, spec.cabinY + spec.cabinH / 2 + 0.075, 0, TRIM);
    const geo = track(batch.build()!);
    const mesh = new THREE.InstancedMesh(geo, bodyMat, MAX_UNITS);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    bodyMeshes.push(mesh);
  }

  // --- Wheels: same shared mesh as the traffic fleet.
  const wheelBatch = new GeometryBatch();
  const tireGeo = track(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = track(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10));
  rimGeo.rotateZ(Math.PI / 2);
  const paintPart = (geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry => {
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color(hex);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  };
  wheelBatch.add(paintPart(tireGeo, 0x141414), composeMatrix(0, 0, 0, 0, 1, 1, 1));
  wheelBatch.add(paintPart(rimGeo, 0xc8ccd2), composeMatrix(0, 0, 0, 0, 1, 1, 1));
  const wheelGeo = track(wheelBatch.build()!);
  const wheelMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8 }));
  const wheelMesh = new THREE.InstancedMesh(wheelGeo, wheelMat, MAX_UNITS * 4);
  wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wheelMesh.frustumCulled = false;
  group.add(wheelMesh);

  // --- Lights: headlights + taillights, as in traffic.
  const lightGeo = track(new THREE.BoxGeometry(0.32, 0.12, 0.06));
  const lightMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const lightMesh = new THREE.InstancedMesh(lightGeo, lightMat, MAX_UNITS * 4);
  lightMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lightMesh.frustumCulled = false;
  group.add(lightMesh);

  // --- Light bar: 2 instances per unit (left red, right blue).
  // MeshBasicMaterial + instance colour: the flash is a colour swap,
  // no extra lights, no extra draw calls.
  const barGeo = track(new THREE.BoxGeometry(0.58, 0.14, 0.32));
  const barMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const barMesh = new THREE.InstancedMesh(barGeo, barMat, MAX_UNITS * 2);
  barMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  barMesh.frustumCulled = false;
  group.add(barMesh);
  scene.add(group);

  const units: PoliceUnit[] = [];
  let targetCount = POLICE_COUNTS[choice];

  const chooseNextPatrol = (u: PoliceUnit): void => {
    const node = graph.nodes[u.node];
    if (node.edges.length === 1) {
      u.next = node.edges[0];
      return;
    }
    const r = rand();
    u.next = r < 0.55 ? node.edges[0] : r < 0.75 ? node.edges[1] : node.edges[2];
  };

  /** Greedy navigation: the edge whose end node is closest to the goal. */
  const chooseNextToward = (u: PoliceUnit, gx: number, gz: number): void => {
    const node = graph.nodes[u.node];
    let best = node.edges[0];
    let bestD = Infinity;
    for (const e of node.edges) {
      const n = graph.nodes[e];
      const d = (n.x - gx) * (n.x - gx) + (n.z - gz) * (n.z - gz);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    u.next = best;
  };

  const placeAtNode = (u: PoliceUnit, nodeIdx: number): void => {
    const n = graph.nodes[nodeIdx];
    u.x = n.x;
    u.z = n.z;
    u.node = nodeIdx;
    u.heading = n.heading;
    u.speed = u.cruise * 0.5;
    u.wheelSpin = 0;
    u.steer = 0;
    u.braking = false;
    u.pendingDt = 0;
    chooseNextPatrol(u);
  };

  const nearestNode = (x: number, z: number): number => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < graph.nodes.length; i++) {
      const n = graph.nodes[i];
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const zeroSlot = (slot: number): void => {
    zeroMat(_mA);
    for (const mesh of bodyMeshes) mesh.setMatrixAt(slot, _mA);
    for (let k = 0; k < 4; k++) {
      wheelMesh.setMatrixAt(slot * 4 + k, _mA);
      lightMesh.setMatrixAt(slot * 4 + k, _mA);
    }
    barMesh.setMatrixAt(slot * 2, _mA);
    barMesh.setMatrixAt(slot * 2 + 1, _mA);
  };

  for (let i = 0; i < MAX_UNITS; i++) {
    const spec = SPECS[i % SPECS.length];
    const u: PoliceUnit = {
      active: i < targetCount,
      spec,
      slot: i,
      x: 0, z: 0, heading: 0, speed: 0,
      cruise: spec.cruiseMin + rand() * (spec.cruiseMax - spec.cruiseMin),
      node: 0, next: 0,
      wheelSpin: 0, steer: 0, braking: false,
      state: 'patrol',
      goalX: 0, goalZ: 0,
      pendingDt: 0,
      roadblockTimer: 0,
    };
    let startNode = 0;
    for (let tries = 0; tries < 20; tries++) {
      const idx = Math.floor(rand() * graph.nodes.length);
      const n = graph.nodes[idx];
      const d = Math.hypot(n.x - 0, n.z - 8);
      if (d > 12 && d < 60) {
        startNode = idx;
        break;
      }
      startNode = idx;
    }
    placeAtNode(u, startNode);
    units.push(u);
    zeroSlot(i);
  }

  const seesPlayer = (u: PoliceUnit, ctx: PoliceContext): boolean => {
    const px = ctx.driving ? ctx.vehiclePos.x : ctx.playerPos.x;
    const pz = ctx.driving ? ctx.vehiclePos.z : ctx.playerPos.z;
    const d = Math.hypot(px - u.x, pz - u.z);
    if (d > DIFF_SIGHT[diff]) return false;
    if (d < 18) return true;
    // Line of sight: if the midpoint sits inside a building, the
    // view is blocked. One box test per unit, not a raycast.
    const mx = (u.x + px) / 2;
    const mz = (u.z + pz) / 2;
    for (const b of ctx.buildings) {
      if (mx > b.minX - 0.5 && mx < b.maxX + 0.5 && mz > b.minZ - 0.5 && mz < b.maxZ + 0.5) {
        return false;
      }
    }
    return true;
  };

  const update = (dt: number, ctx: PoliceContext): boolean => {
    frame++;
    time += dt;
    if (roadblockCooldown > 0) roadblockCooldown -= dt;
    let moved = false;
    const avenueGreen = getSignals().isAvenueGreen();
    const px = ctx.driving ? ctx.vehiclePos.x : ctx.playerPos.x;
    const pz = ctx.driving ? ctx.vehiclePos.z : ctx.playerPos.z;
    const level = ctx.wanted.level;
    const status = ctx.wanted.status;

    // ---- Visibility (drives the wanted status machine) ----
    seenThisFrame = false;
    for (const u of units) {
      if (!u.active) continue;
      if (seesPlayer(u, ctx)) {
        seenThisFrame = true;
        break;
      }
    }

    // ---- Assign roles for this frame ----
    const active = units.filter((u) => u.active);
    const roadblockUnits = roadblock ? roadblock.units : [];
    const free = active.filter((u) => !roadblockUnits.includes(u.slot));
    let pursuers = 0;
    if (level > 0) {
      pursuers = Math.min(PURSUERS_FOR_LEVEL[level], free.length);
    }
    // Nearest units take the pursuit (or the search); the rest patrol.
    const byDist = [...free].sort(
      (a, b) => (a.x - px) * (a.x - px) + (a.z - pz) * (a.z - pz) - ((b.x - px) * (b.x - px) + (b.z - pz) * (b.z - pz)),
    );
    free.forEach((u) => {
      const rank = byDist.indexOf(u);
      if (level > 0 && rank < pursuers) {
        u.state = status === 'search' ? 'search' : 'pursue';
      } else if (u.state !== 'roadblock') {
        u.state = 'patrol';
      }
    });

    // Closest active pursuer, for the arrest module (surrender
    // prompt, caught detection, officer approach).
    lastNearest = null;
    for (const u of free) {
      if (u.state !== 'pursue') continue;
      const d = Math.hypot(u.x - px, u.z - pz);
      if (!lastNearest || d < lastNearest.dist) {
        lastNearest = { slot: u.slot, x: u.x, z: u.z, dist: d, sees: seesPlayer(u, ctx) };
      }
    }

    // ---- Roadblock: at 3+ stars, two units block the road ahead ----
    if (roadblock) {
      const rb = roadblock;
      const playerDist = Math.hypot(px - rb.cx, pz - rb.cz);
      if (level < ROADBLOCK_MIN_LEVEL) {
        dissolveRoadblock();
      } else if (playerDist < 18) {
        // The player reached the block: both units join the pursuit.
        for (const slot of rb.units) {
          const u = units[slot];
          u.state = 'pursue';
          u.node = nearestNode(u.x, u.z);
          chooseNextToward(u, px, pz);
        }
        roadblock = null;
        roadblockCooldown = 15;
      } else if (playerDist > 120) {
        for (const slot of rb.units) units[slot].roadblockTimer += dt;
        if (rb.units.every((s) => units[s].roadblockTimer > 10)) dissolveRoadblock();
      } else {
        for (const slot of rb.units) units[slot].roadblockTimer = 0;
      }
    } else if (
      level >= ROADBLOCK_MIN_LEVEL &&
      ctx.driving &&
      roadblockCooldown <= 0 &&
      free.length >= 2
    ) {
      const aheadX = px + Math.sin(ctx.vehicleHeading) * 50;
      const aheadZ = pz + Math.cos(ctx.vehicleHeading) * 50;
      let bestA = -1;
      let bestS = -1;
      let bestD = Infinity;
      for (const a of AVENUES) {
        for (const s of STREETS) {
          const d = Math.hypot(a - aheadX, s - aheadZ);
          if (d < bestD) {
            bestD = d;
            bestA = a;
            bestS = s;
          }
        }
      }
      if (bestD < 30) {
        // Two patrol units, farthest from the player, take the block.
        const cands = [...free]
          .filter((u) => u.state === 'patrol')
          .sort(
            (a, b) =>
              (b.x - px) * (b.x - px) + (b.z - pz) * (b.z - pz) -
              ((a.x - px) * (a.x - px) + (a.z - pz) * (a.z - pz)),
          );
        if (cands.length >= 2) {
          // Avenue travel (north/south) is |cos h| ≈ 1, street
          // travel (east/west) is |sin h| ≈ 1 — forward is (sin h,
          // cos h). The block spans the road the player is on.
          const alongAvenue = Math.abs(Math.cos(ctx.vehicleHeading)) > 0.7;
          const spots: Array<{ x: number; z: number; h: number }> = alongAvenue
            ? [
                { x: bestA - 2.5, z: bestS + 8, h: Math.PI / 2 },
                { x: bestA + 2.5, z: bestS - 8, h: -Math.PI / 2 },
              ]
            : [
                { x: bestA + 8, z: bestS - 2.5, h: 0 },
                { x: bestA - 8, z: bestS + 2.5, h: Math.PI },
              ];
          const taken = cands.slice(0, 2);
          taken.forEach((u, k) => {
            u.state = 'roadblock';
            u.x = spots[k].x;
            u.z = spots[k].z;
            u.heading = spots[k].h;
            u.speed = 0;
            u.node = nearestNode(u.x, u.z);
            u.roadblockTimer = 0;
          });
          roadblock = { cx: bestA, cz: bestS, units: taken.map((u) => u.slot) };
        }
      }
    }

    function dissolveRoadblock(): void {
      if (!roadblock) return;
      for (const slot of roadblock.units) {
        const u = units[slot];
        u.state = 'patrol';
        u.node = nearestNode(u.x, u.z);
        u.speed = 0;
        chooseNextPatrol(u);
      }
      roadblock = null;
      roadblockCooldown = 15;
    }

    // ---- Move every unit ----
    for (const u of units) {
      if (!u.active) continue;
      // Distance-based updates: far units tick every other frame,
      // with the skipped dt accumulated so the motion stays correct.
      const distToPlayer = Math.hypot(u.x - px, u.z - pz);
      if (distToPlayer > 120 && frame % 2 === 1) {
        u.pendingDt += dt;
        continue;
      }
      const stepDt = dt + u.pendingDt;
      u.pendingDt = 0;
      if (u.state === 'roadblock') continue; // parked across the road

      const spec = u.spec;
      // Goals: intercept the player, or the search area. While
      // driving, the lead pursuer aims at where the GT will be when
      // it gets there (lead time from real distance and pursuit
      // speed), and the next two take flanking points either side
      // of that intercept point, so the units spread around the
      // player's car instead of stacking behind it. On foot the
      // player is slower than the police, so every pursuer chases
      // directly. The arrest unit drives to its assigned point.
      let gx = px;
      let gz = pz;
      if (arrestTarget && u.slot === arrestTarget.slot) {
        gx = arrestTarget.x;
        gz = arrestTarget.z;
      } else if (u.state === 'pursue') {
        const rank = byDist.indexOf(u);
        if (ctx.driving) {
          const pursuitSpeed = (15 + 1.5 * level) * DIFF_SPEED[diff];
          const lead = THREE.MathUtils.clamp(distToPlayer / Math.max(4, pursuitSpeed), 0, 3);
          const ix = px + Math.sin(ctx.vehicleHeading) * ctx.vehicleSpeed * lead;
          const iz = pz + Math.cos(ctx.vehicleHeading) * ctx.vehicleSpeed * lead;
          const perpX = Math.cos(ctx.vehicleHeading);
          const perpZ = -Math.sin(ctx.vehicleHeading);
          if (rank === 0) {
            gx = ix;
            gz = iz;
          } else if (rank === 1) {
            gx = ix - perpX * 12;
            gz = iz - perpZ * 12;
          } else if (rank === 2) {
            gx = ix + perpX * 12;
            gz = iz + perpZ * 12;
          }
        }
      } else if (u.state === 'search' && ctx.wanted.lastKnown) {
        gx = ctx.wanted.lastKnown.x;
        gz = ctx.wanted.lastKnown.z;
      }
      u.goalX = gx;
      u.goalZ = gz;

      const target = graph.nodes[u.next];
      const dx = target.x - u.x;
      const dz = target.z - u.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const targetHeading = Math.atan2(dx, dz);
      const turn = angleDiff(u.heading, targetHeading);
      const uturn = Math.abs(turn) > 2.2;
      const turnRate = uturn ? 6 : 3.2;
      u.heading = lerpAngle(u.heading, targetHeading, Math.min(1, stepDt * turnRate));
      const targetSteer = THREE.MathUtils.clamp(-turn * 0.5, -0.5, 0.5);
      u.steer += (targetSteer - u.steer) * Math.min(1, stepDt * 6);

      let desired = u.cruise;
      let held = false;
      if (u.state === 'pursue') {
        desired = (15 + 1.5 * level) * DIFF_SPEED[diff];
        // On foot, close in and hold position near the player. The
        // arrest unit comes closer still — it stops right by the
        // player for the arrest.
        const holdDist = arrestTarget && u.slot === arrestTarget.slot ? 4.5 : 9;
        if (!ctx.driving && distToPlayer < holdDist) desired = 0;
      } else if (u.state === 'search') {
        desired = 11;
      }
      if (Math.abs(turn) > 0.35) desired = Math.min(desired, u.cruise * 0.55);
      if (uturn) desired = Math.min(desired, 3.5);

      // ---- Signals: patrol and search obey them; pursuit slows
      // through a red instead of stopping (a real pursuit does).
      if (target.stopLine) {
        const sl = target.stopLine;
        if (sl.signal) {
          const green = sl.approach === 'avenue' ? avenueGreen : !avenueGreen;
          if (!green) {
            if (u.state === 'pursue') {
              desired = Math.min(desired, u.cruise * 0.6);
            } else if (dist < 4 && u.speed > 4) {
              /* proceed */
            } else {
              desired = dist < 6 ? 0 : Math.min(desired, 4);
              if (dist < 6) held = true;
            }
          } else if (dist < 16) {
            desired = Math.min(desired, u.cruise * 0.75);
          }
        } else if (u.state !== 'pursue') {
          if (dist < 16) desired = Math.min(desired, u.cruise * 0.7);
          if (dist < 14) {
            const occupied =
              units.some((o) => o.active && o !== u && Math.abs(o.x - sl.cx) < 7 && Math.abs(o.z - sl.cz) < 7) ||
              ctx.aiVehicles.some((o) => Math.abs(o.x - sl.cx) < 7 && Math.abs(o.z - sl.cz) < 7) ||
              (Math.abs(ctx.vehiclePos.x - sl.cx) < 7 && Math.abs(ctx.vehiclePos.z - sl.cz) < 7);
            if (occupied) {
              desired = 0;
              held = true;
            }
          }
        }
      }

      const fx = Math.sin(u.heading);
      const fz = Math.cos(u.heading);
      const aheadOf = (
        ox: number, oz: number, halfLen: number,
      ): { d: number; lat: number } | null => {
        const tx = ox - u.x;
        const tz = oz - u.z;
        const d = Math.hypot(tx, tz);
        if (d < 0.001) return { d, lat: 0 };
        const ahead = (tx * fx + tz * fz) / d;
        if (ahead < 0.7) return null;
        const lat = Math.abs(tx * fz - tz * fx);
        return { d: d - halfLen, lat };
      };
      // The car ahead (AI traffic, another police unit, the GT).
      const follow = (info: { d: number; lat: number } | null, speed: number): void => {
        if (!info || info.lat > 2.0) return;
        const stopGap = spec.length / 2 + 1.2;
        const followGap = stopGap + 4;
        if (info.d < stopGap) desired = 0;
        else if (info.d < followGap) desired = Math.min(desired, speed + 1.5);
      };
      for (const o of ctx.aiVehicles) follow(aheadOf(o.x, o.z, 2.2), o.speed);
      for (const o of units) {
        if (!o.active || o === u) continue;
        follow(aheadOf(o.x, o.z, o.spec.length / 2), o.speed);
      }
      {
        const info = aheadOf(ctx.vehiclePos.x, ctx.vehiclePos.z, 2.2);
        if (info && info.lat <= 2.0) {
          const stopGap = spec.length / 2 + 1.2;
          const followGap = stopGap + 4;
          if (info.d < stopGap) desired = 0;
          else if (info.d < followGap) desired = Math.min(desired, ctx.vehicleSpeed + 1.5);
        }
      }
      // The player on foot, standing in the road.
      if (!ctx.driving) {
        const info = aheadOf(ctx.playerPos.x, ctx.playerPos.z, 0.6);
        if (info && info.lat <= 2.2 && info.d < 7) desired = 0;
      }
      // Pedestrians on crosswalks ahead.
      for (const npc of ctx.npcs) {
        if (!npc.onCrosswalk) continue;
        const info = aheadOf(npc.x, npc.z, 0.5);
        if (!info || info.lat > 2.2) continue;
        if (info.d < 8) desired = 0;
        else if (info.d < 13) desired = Math.min(desired, 3);
      }

      const prevSpeed = u.speed;
      if (desired < u.speed) u.speed = Math.max(desired, u.speed - BRAKE * stepDt);
      else u.speed = Math.min(desired, u.speed + ACCEL * stepDt);
      u.braking = u.speed < prevSpeed - 0.01 || desired === 0;
      u.x += Math.sin(u.heading) * u.speed * stepDt;
      u.z += Math.cos(u.heading) * u.speed * stepDt;
      if (u.speed > 0.05) {
        moved = true;
        u.wheelSpin += (u.speed * stepDt) / spec.wheelR;
      }

      // Arrive at the target node: pick the next edge — unless held
      // at a red light, or still searching this node.
      if (dist < 1.8 && !held) {
        u.node = u.next;
        if (u.state === 'pursue' || u.state === 'search') {
          // Search: when the unit reaches the last-known area, wander
          // nearby roads instead of sitting on the spot.
          if (u.state === 'search' && ctx.wanted.lastKnown) {
            const lk = ctx.wanted.lastKnown;
            if (Math.hypot(u.x - lk.x, u.z - lk.z) < 12) {
              const wander = randomRingLaneNode(graph, rand, lk.x, lk.z, 5, 30, ctx.camForward);
              const wn = graph.nodes[wander];
              u.goalX = wn.x;
              u.goalZ = wn.z;
              chooseNextToward(u, wn.x, wn.z);
            } else {
              chooseNextToward(u, u.goalX, u.goalZ);
            }
          } else {
            chooseNextToward(u, u.goalX, u.goalZ);
          }
        } else {
          chooseNextPatrol(u);
        }
      }

      // Recycle far-away units around the player (never accumulate),
      // and anything that slipped past the city boundary. The ring
      // sits OUTSIDE the sight range (55–65), so a hidden player
      // stays hidden — recycling into eyeshot would make escape
      // impossible. Roadblock units are placed deliberately and
      // never recycled.
      const dxP = u.x - px;
      const dzP = u.z - pz;
      if (dxP * dxP + dzP * dzP > 100 * 100 || Math.abs(u.x) > 192 || Math.abs(u.z) > 192) {
        placeAtNode(u, randomRingLaneNode(graph, rand, px, pz, 75, 95, ctx.camForward));
        if (u.state !== 'patrol') u.state = 'patrol';
      }
    }

    // Nudge apart any police units (or police vs traffic) that touch.
    for (let i = 0; i < MAX_UNITS; i++) {
      const a = units[i];
      if (!a.active) continue;
      for (let j = i + 1; j < MAX_UNITS; j++) {
        const b = units[j];
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const minD = a.spec.length / 2 + b.spec.length / 2 - 1.5;
        const d2 = dx * dx + dz * dz;
        if (d2 >= minD * minD || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = ((minD - d) / 2) * 0.5;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
      for (const o of ctx.aiVehicles) {
        const dx = a.x - o.x;
        const dz = a.z - o.z;
        const minD = 2.2 + a.spec.length / 2 - 1.0;
        const d2 = dx * dx + dz * dz;
        if (d2 < minD * minD && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (minD - d) * 0.5;
          a.x += (dx / d) * push;
          a.z += (dz / d) * push;
        }
      }
    }

    // ---- Write the instance matrices ----
    const phase = Math.floor(time / 0.4) % 2 === 0;
    for (const u of units) {
      const spec = u.spec;
      const kindIdx = SPECS.indexOf(spec);
      if (!u.active) continue;
      _e.set(0, u.heading, 0, 'YXZ');
      _q.setFromEuler(_e);
      _v.set(u.x, 0, u.z);
      _s.set(1, 1, 1);
      _mRoot.compose(_v, _q, _s);
      bodyMeshes[kindIdx].setMatrixAt(u.slot, _mRoot);

      const wheelScale = spec.wheelR / 0.36;
      const halfW = spec.width / 2 - 0.1;
      let k = 0;
      for (const [wx, wz, front] of [
        [-halfW, spec.axle, true],
        [halfW, spec.axle, true],
        [-halfW, -spec.axle, false],
        [halfW, -spec.axle, false],
      ] as const) {
        _mA.copy(_mRoot);
        _mB.makeTranslation(wx, spec.wheelR, wz);
        _mA.multiply(_mB);
        _e.set(0, front ? u.steer : 0, 0);
        _q.setFromEuler(_e);
        _mB.makeRotationFromQuaternion(_q);
        _mA.multiply(_mB);
        _e.set(u.wheelSpin, 0, 0);
        _q.setFromEuler(_e);
        _mB.makeRotationFromQuaternion(_q);
        _mA.multiply(_mB);
        _mB.makeScale(wheelScale, wheelScale, wheelScale);
        _mA.multiply(_mB);
        wheelMesh.setMatrixAt(u.slot * 4 + k, _mA);
        k++;
      }

      const lightX = spec.width * 0.32;
      const lightSpots: Array<[number, number, number, boolean]> = [
        [-lightX, spec.lightY, spec.length / 2 + 0.01, false],
        [lightX, spec.lightY, spec.length / 2 + 0.01, false],
        [-lightX, spec.lightY + 0.05, -spec.length / 2 - 0.01, true],
        [lightX, spec.lightY + 0.05, -spec.length / 2 - 0.01, true],
      ];
      for (let li = 0; li < 4; li++) {
        const [lx, ly, lz, tail] = lightSpots[li];
        _mA.copy(_mRoot);
        _mB.makeTranslation(lx, ly, lz);
        _mA.multiply(_mB);
        lightMesh.setMatrixAt(u.slot * 4 + li, _mA);
        if (tail) _c.setRGB(u.braking ? 1 : 0.4, 0.06, 0.06);
        else _c.setRGB(1, 0.95, 0.75);
        lightMesh.setColorAt(u.slot * 4 + li, _c);
      }

      // Light bar: red left, blue right, alternating while the unit
      // is on duty (pursue / search / roadblock). Patrolling units
      // run dark.
      const onDuty = u.state !== 'patrol';
      for (let side = 0; side < 2; side++) {
        _mA.copy(_mRoot);
        _mB.makeTranslation(side === 0 ? -0.3 : 0.3, spec.lightBarY + 0.06, 0);
        _mA.multiply(_mB);
        barMesh.setMatrixAt(u.slot * 2 + side, _mA);
        const redSide = side === 0;
        const lit = onDuty && (phase ? redSide : !redSide);
        if (redSide) _c.setRGB(lit ? 1 : 0.25, 0.06, 0.06);
        else _c.setRGB(0.05, lit ? 0.55 : 0.12, lit ? 1 : 0.3);
        barMesh.setColorAt(u.slot * 2 + side, _c);
      }
    }
    for (const mesh of bodyMeshes) mesh.instanceMatrix.needsUpdate = true;
    wheelMesh.instanceMatrix.needsUpdate = true;
    lightMesh.instanceMatrix.needsUpdate = true;
    barMesh.instanceMatrix.needsUpdate = true;
    if (lightMesh.instanceColor) lightMesh.instanceColor.needsUpdate = true;
    if (barMesh.instanceColor) barMesh.instanceColor.needsUpdate = true;
    return moved;
  };

  return {
    update,
    setCount: (nextChoice: PoliceChoice) => {
      targetCount = POLICE_COUNTS[nextChoice];
      for (let i = 0; i < MAX_UNITS; i++) {
        const u = units[i];
        if (i < targetCount && !u.active) {
          u.active = true;
          u.state = 'patrol';
          placeAtNode(u, randomRingLaneNode(graph, rand, 0, 8, 15, 55));
        } else if (i >= targetCount) {
          u.active = false;
          u.state = 'patrol';
          zeroSlot(i);
        }
      }
      // An arrest unit switched off mid-approach: clear the target
      // so no dangling slot is chased.
      if (arrestTarget && !units[arrestTarget.slot].active) arrestTarget = null;
      if (roadblock) {
        // A roadblock unit was switched off: dissolve properly so the
        // other one is not left parked across the road forever.
        const slots = [...roadblock.units];
        roadblock = null;
        for (const slot of slots) {
          const u = units[slot];
          if (!u.active) continue;
          u.state = 'patrol';
          u.node = nearestNode(u.x, u.z);
          u.speed = 0;
          chooseNextPatrol(u);
        }
        roadblockCooldown = 15;
      }
      for (const mesh of bodyMeshes) mesh.instanceMatrix.needsUpdate = true;
      wheelMesh.instanceMatrix.needsUpdate = true;
      lightMesh.instanceMatrix.needsUpdate = true;
      barMesh.instanceMatrix.needsUpdate = true;
    },
    setDifficulty: (d: PursuitDifficulty) => {
      diff = d;
    },
    activeCount: () => units.filter((u) => u.active).length,
    totalCount: () => MAX_UNITS,
    listUnits: () =>
      units
        .filter((u) => u.active)
        .map((u) => ({
          x: +u.x.toFixed(2),
          z: +u.z.toFixed(2),
          heading: +u.heading.toFixed(2),
          speed: +u.speed.toFixed(2),
          kind: u.spec.key,
          state: u.state,
          braking: u.braking,
        })),
    anySeesPlayer: () => seenThisFrame,
    nearestPursuer: () => (lastNearest ? { ...lastNearest } : null),
    setArrestTarget: (target) => {
      if (!target) {
        arrestTarget = null;
        return;
      }
      let slot = target.slot;
      if (slot === null || !units[slot] || !units[slot].active) {
        // No slot given (or it went inactive): send the nearest
        // active pursuer to the point instead.
        let best = -1;
        let bestD = Infinity;
        for (const u of units) {
          if (!u.active || u.state !== 'pursue') continue;
          const d = (u.x - target.x) * (u.x - target.x) + (u.z - target.z) * (u.z - target.z);
          if (d < bestD) {
            bestD = d;
            best = u.slot;
          }
        }
        if (best < 0) return; // no pursuer to send
        slot = best;
      }
      arrestTarget = { x: target.x, z: target.z, slot };
    },
    resetToPatrol: () => {
      arrestTarget = null;
      roadblockCooldown = 0;
      if (roadblock) {
        const slots = [...roadblock.units];
        roadblock = null;
        for (const slot of slots) {
          const u = units[slot];
          u.state = 'patrol';
          u.node = nearestNode(u.x, u.z);
          u.speed = 0;
          chooseNextPatrol(u);
        }
      }
      for (const u of units) {
        if (!u.active) continue;
        u.state = 'patrol';
        u.node = nearestNode(u.x, u.z);
        chooseNextPatrol(u);
      }
    },
    dispose: () => {
      scene.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.InstancedMesh) obj.dispose();
      });
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
