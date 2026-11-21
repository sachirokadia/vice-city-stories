/**
 * The living city: a pedestrian crowd.
 *
 * Twelve original archetypes (different skin, hair, clothing,
 * body type, speed), all procedural — no copied characters.
 * Rendered as ~14 InstancedMeshes, one per body part, so 28
 * pedestrians cost ~14 draw calls total instead of ~28×10.
 * Per-instance colour carries the variety; per-instance scale
 * carries the body types.
 *
 * Behaviour: NPCs walk the sidewalk graph (PedestrianPaths),
 * pick a distant destination and head for it, cross roads only
 * on crosswalks, idle at destinations, step aside for the player,
 * yield when the player runs at them, and hurry across (or wait
 * at the curb) when the Velocity GT approaches. A fixed pool is
 * recycled around the player — NPCs never accumulate and never
 * pop in next to the camera.
 *
 * Animation is the same stride-matched gait as the protagonist
 * (phase advances by speed / stride), driven by actual speed.
 */
import * as THREE from 'three';
import {
  buildPedestrianGraph,
  nearestNode,
  randomFarNode,
  randomRingNode,
  crowdRandom,
} from './PedestrianPaths';
import type { PedestrianGraph } from './PedestrianPaths';
import { GeometryBatch, composeMatrix } from './Merge';

export type PedestrianChoice = 'off' | 'few' | 'normal' | 'busy';
export const PEDESTRIAN_COUNTS: Record<PedestrianChoice, number> = {
  off: 0,
  few: 10,
  normal: 18,
  busy: 28,
};
const MAX_NPCS = 28;

// Solid-body radii for the Phase 2 (3.1) collision pass. The
// player is radius 0.6 (Player.ts) and an NPC ~0.5, so two bodies
// on foot stay 1.1 m apart. A player car is two axle circles at
// +-AXLE_OFFSET along its heading (Vehicle.ts uses the same 1.1)
// with a 1.4 m radius (car half-width ~0.9 + NPC 0.5), which
// covers the whole footprint with a small margin.
const NPC_BODY_RADIUS = 0.5;
const PLAYER_BODY_RADIUS = 0.6;
const CAR_AXLE_OFFSET = 1.1;
const CAR_BODY_RADIUS = 1.4;

export interface CrowdContext {
  playerPos: THREE.Vector3;
  playerSpeed: number;
  vehiclePos: THREE.Vector3;
  vehicleSpeed: number;
  vehicleHeading: number;
  driving: boolean;
  camForward: { x: number; z: number };
  /** AI traffic cars (for NPC hurry / wait-at-curb reactions). */
  aiVehicles?: Array<{ x: number; z: number; speed: number; heading: number }>;
}

export interface CrowdHandle {
  /** Returns true when any NPC moved (shadow refresh hint). */
  update: (dt: number, ctx: CrowdContext) => boolean;
  setCount: (choice: PedestrianChoice) => void;
  activeCount: () => number;
  totalCount: () => number;
  npcPositions: () => Array<{ x: number; z: number; heading: number; headYaw: number; state: string; speed: number; onCrosswalk: boolean }>;
  dispose: () => void;
}

type HairStyle = 'short' | 'long' | 'bun' | 'cap';

interface Archetype {
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  top: number;
  bottom: number;
  shoes: number;
  skirt: boolean;
  height: number;
  width: number;
  cruise: number;
}

const SKINS = [0x8a5a3b, 0xc68863, 0xe8b98a, 0x6b4423, 0xd9a077];
const HAIRS = [0x1a1512, 0x4a2f1d, 0xc9a227, 0x9a9a9a, 0x7a2e1d];

const ARCHETYPES: Archetype[] = [
  { skin: SKINS[1], hair: HAIRS[0], hairStyle: 'short', top: 0x5a5f66, bottom: 0x2e3138, shoes: 0x30343a, skirt: false, height: 1.0, width: 1.0, cruise: 1.5 },
  { skin: SKINS[2], hair: HAIRS[1], hairStyle: 'long', top: 0xc65a3c, bottom: 0x2a3550, shoes: 0x6b4423, skirt: false, height: 0.95, width: 0.92, cruise: 1.6 },
  { skin: SKINS[0], hair: HAIRS[0], hairStyle: 'short', top: 0x274156, bottom: 0x8a7a5a, shoes: 0x2e3138, skirt: false, height: 1.04, width: 1.08, cruise: 1.3 },
  { skin: SKINS[3], hair: HAIRS[0], hairStyle: 'bun', top: 0xd8b25a, bottom: 0x2e3138, shoes: 0x1a1210, skirt: true, height: 0.96, width: 0.94, cruise: 1.4 },
  { skin: SKINS[4], hair: HAIRS[3], hairStyle: 'short', top: 0x6b4a2f, bottom: 0x4a4a4a, shoes: 0x2e3138, skirt: false, height: 0.98, width: 1.12, cruise: 1.1 },
  { skin: SKINS[1], hair: HAIRS[2], hairStyle: 'long', top: 0x7a4a6b, bottom: 0x1a1a22, shoes: 0x30343a, skirt: true, height: 0.94, width: 0.9, cruise: 1.7 },
  { skin: SKINS[2], hair: HAIRS[1], hairStyle: 'cap', top: 0xe8e6e0, bottom: 0x1a1a22, shoes: 0x30343a, skirt: false, height: 1.02, width: 1.0, cruise: 1.5 },
  { skin: SKINS[0], hair: HAIRS[4], hairStyle: 'short', top: 0x8a2f2f, bottom: 0x2a3550, shoes: 0x2e3138, skirt: false, height: 1.06, width: 1.1, cruise: 1.4 },
  { skin: SKINS[3], hair: HAIRS[0], hairStyle: 'long', top: 0x3a6b4f, bottom: 0x2e3138, shoes: 0x6b4423, skirt: true, height: 0.97, width: 0.96, cruise: 1.5 },
  { skin: SKINS[2], hair: HAIRS[2], hairStyle: 'short', top: 0x2f6f6a, bottom: 0x8a7a5a, shoes: 0xe8e6e0, skirt: false, height: 0.92, width: 0.9, cruise: 1.8 },
  { skin: SKINS[4], hair: HAIRS[1], hairStyle: 'bun', top: 0x5a4a7a, bottom: 0x2e3138, shoes: 0x1a1210, skirt: false, height: 1.0, width: 0.98, cruise: 1.3 },
  { skin: SKINS[1], hair: HAIRS[0], hairStyle: 'cap', top: 0xd06a2a, bottom: 0x2a3550, shoes: 0xe8e6e0, skirt: false, height: 0.93, width: 0.92, cruise: 1.9 },
];

// Scratch objects — the per-frame matrix work must not allocate.
const _mRoot = new THREE.Matrix4();
const _mA = new THREE.Matrix4();
const _mB = new THREE.Matrix4();
const _mT = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

const rotY = (m: THREE.Matrix4, ry: number): THREE.Matrix4 => {
  _e.set(0, ry, 0);
  _q.setFromEuler(_e);
  _mT.makeRotationFromQuaternion(_q);
  return m.multiply(_mT);
};
const rotX = (m: THREE.Matrix4, rx: number): THREE.Matrix4 => {
  _e.set(rx, 0, 0);
  _q.setFromEuler(_e);
  _mT.makeRotationFromQuaternion(_q);
  return m.multiply(_mT);
};
const rotZ = (m: THREE.Matrix4, rz: number): THREE.Matrix4 => {
  _e.set(0, 0, rz);
  _q.setFromEuler(_e);
  _mT.makeRotationFromQuaternion(_q);
  return m.multiply(_mT);
};
const translate = (m: THREE.Matrix4, x: number, y: number, z: number): THREE.Matrix4 => {
  _mT.makeTranslation(x, y, z);
  return m.multiply(_mT);
};
const composeRoot = (
  out: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  ry: number,
  w: number,
  h: number,
): THREE.Matrix4 => {
  _e.set(0, ry, 0, 'YXZ');
  _q.setFromEuler(_e);
  _v.set(x, y, z);
  _s.set(w, h, w);
  return out.compose(_v, _q, _s);
};
const zeroMat = (out: THREE.Matrix4): THREE.Matrix4 => {
  _v.set(0, -10, 0);
  _q.identity();
  _s.set(0, 0, 0);
  return out.compose(_v, _q, _s);
};
const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));
const lerpAngle = (a: number, b: number, t: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

interface NPC {
  active: boolean;
  arch: Archetype;
  x: number;
  z: number;
  heading: number;
  speed: number;
  phase: number;
  node: number;
  next: number;
  /** Node we came from — the route picker won't U-turn into it. */
  prev: number;
  target: number;
  state: 'walk' | 'idle' | 'wait';
  idleT: number;
  waitT: number;
  sideT: number;
  sideDir: number;
  sideAmt: number;
  headYaw: number;
  onCrosswalk: boolean;
  // Smoothed pose (same easing pattern as the protagonist).
  legL: number;
  legR: number;
  kneeL: number;
  kneeR: number;
  armL: number;
  armR: number;
  bob: number;
}

export function createCrowd(scene: THREE.Scene, choice: PedestrianChoice): CrowdHandle {
  const graph: PedestrianGraph = buildPedestrianGraph();
  const rand = crowdRandom();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const group = new THREE.Group();
  group.name = 'pedestrians';

  const partMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }));
  const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.5 }));

  // Geometries with the pivot baked in (limbs hang down from it).
  const headGeo = track(new THREE.SphereGeometry(0.13, 12, 10));
  const hairShortGeo = track(new THREE.SphereGeometry(0.135, 10, 8));
  hairShortGeo.scale(1.02, 0.8, 1.02);
  hairShortGeo.translate(0, 0.05, -0.015);
  const hairLongBatch = new GeometryBatch();
  hairLongBatch.add(track(new THREE.SphereGeometry(0.135, 10, 8)), composeMatrix(0, 0.05, -0.015, 0, 1.02, 0.8, 1.02));
  hairLongBatch.add(track(new THREE.BoxGeometry(0.2, 0.32, 0.07)), composeMatrix(0, -0.08, -0.1, 0, 1, 1, 1));
  const hairLongGeo = track(hairLongBatch.build()!);
  const hairBunBatch = new GeometryBatch();
  hairBunBatch.add(track(new THREE.SphereGeometry(0.135, 10, 8)), composeMatrix(0, 0.05, -0.015, 0, 1.02, 0.8, 1.02));
  hairBunBatch.add(track(new THREE.SphereGeometry(0.05, 8, 6)), composeMatrix(0, 0.1, -0.12, 0, 1, 1, 1));
  const hairBunGeo = track(hairBunBatch.build()!);
  const capBatch = new GeometryBatch();
  capBatch.add(track(new THREE.CylinderGeometry(0.14, 0.15, 0.06, 12)), composeMatrix(0, 0.1, 0, 0, 1, 1, 1));
  capBatch.add(track(new THREE.BoxGeometry(0.16, 0.02, 0.12)), composeMatrix(0, 0.08, 0.14, 0, 1, 1, 1));
  const capGeo = track(capBatch.build()!);
  const torsoGeo = track(new THREE.BoxGeometry(0.42, 0.55, 0.24));
  const armGeo = track(new THREE.CapsuleGeometry(0.055, 0.2, 4, 8));
  armGeo.translate(0, -0.16, 0);
  const legGeo = track(new THREE.CapsuleGeometry(0.075, 0.3, 4, 8));
  legGeo.translate(0, -0.22, 0);
  const shoeGeo = track(new THREE.BoxGeometry(0.12, 0.08, 0.28));
  const skirtGeo = track(new THREE.CylinderGeometry(0.19, 0.27, 0.45, 10));
  const faceBatch = new GeometryBatch();
  const eyeGeo = track(new THREE.SphereGeometry(0.018, 8, 6));
  for (const s of [-1, 1]) {
    faceBatch.add(eyeGeo, composeMatrix(s * 0.048, 0.015, 0.112, 0, 1, 1, 1));
  }
  faceBatch.add(track(new THREE.BoxGeometry(0.055, 0.009, 0.012)), composeMatrix(0, -0.065, 0.108, 0, 1, 1, 1));
  const faceGeo = track(faceBatch.build()!);

  const makeInstanced = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean): THREE.InstancedMesh => {
    const m = new THREE.InstancedMesh(geo, mat, MAX_NPCS);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = shadow;
    m.frustumCulled = false; // instances span the whole city
    group.add(m);
    return m;
  };
  const headMesh = makeInstanced(headGeo, partMat, true);
  const hairShortMesh = makeInstanced(hairShortGeo, partMat, true);
  const hairLongMesh = makeInstanced(hairLongGeo, partMat, true);
  const hairBunMesh = makeInstanced(hairBunGeo, partMat, true);
  const capMesh = makeInstanced(capGeo, partMat, true);
  const torsoMesh = makeInstanced(torsoGeo, partMat, true);
  const armLMesh = makeInstanced(armGeo, partMat, true);
  const armRMesh = makeInstanced(armGeo, partMat, true);
  const legLMesh = makeInstanced(legGeo, partMat, true);
  const legRMesh = makeInstanced(legGeo, partMat, true);
  // Shins: the leg mesh is the thigh only — without these the shoes
  // float below the knees with a gap in between (caught in QA).
  const shinLMesh = makeInstanced(legGeo, partMat, true);
  const shinRMesh = makeInstanced(legGeo, partMat, true);
  const shoeLMesh = makeInstanced(shoeGeo, partMat, false);
  const shoeRMesh = makeInstanced(shoeGeo, partMat, false);
  const skirtMesh = makeInstanced(skirtGeo, partMat, true);
  const faceMesh = makeInstanced(faceGeo, darkMat, false);
  scene.add(group);

  const npcs: NPC[] = [];
  let targetCount = PEDESTRIAN_COUNTS[choice];

  const placeAtNode = (npc: NPC, nodeIdx: number): void => {
    const n = graph.nodes[nodeIdx];
    npc.x = n.x;
    npc.z = n.z;
    npc.node = nodeIdx;
    npc.next = nodeIdx;
    npc.prev = nodeIdx;
    npc.target = randomFarNode(graph, rand, n.x, n.z, 50);
    npc.state = 'walk';
    npc.idleT = 0;
    npc.waitT = 0;
    npc.sideT = 0;
    npc.sideAmt = 0;
    npc.heading = rand() * Math.PI * 2;
    npc.speed = 0;
  };

  for (let i = 0; i < MAX_NPCS; i++) {
    const arch = ARCHETYPES[i % ARCHETYPES.length];
    const npc: NPC = {
      active: i < targetCount,
      arch,
      x: 0, z: 0, heading: 0, speed: 0, phase: rand() * Math.PI * 2,
      node: 0, next: 0, prev: 0, target: 0,
      state: 'walk', idleT: 0, waitT: 0, sideT: 0, sideDir: 1, sideAmt: 0,
      headYaw: 0, onCrosswalk: false,
      legL: 0, legR: 0, kneeL: 0, kneeR: 0, armL: 0, armR: 0, bob: 0,
    };
    // Opening crowd: spread around the spawn plaza, not on top of it.
    const startNode = (() => {
      for (let tries = 0; tries < 20; tries++) {
        const idx = Math.floor(rand() * graph.nodes.length);
        const n = graph.nodes[idx];
        const d = Math.hypot(n.x - 0, n.z - 8);
        if (d > 12 && d < 55) return idx;
      }
      return nearestNode(graph, 0, 8);
    })();
    placeAtNode(npc, startNode);
    npcs.push(npc);
    // Per-instance colours (variety lives here, not in new materials).
    _c.setHex(arch.skin);
    headMesh.setColorAt(i, _c);
    _c.setHex(arch.hair);
    hairShortMesh.setColorAt(i, _c);
    hairLongMesh.setColorAt(i, _c);
    hairBunMesh.setColorAt(i, _c);
    capMesh.setColorAt(i, _c);
    _c.setHex(arch.top);
    torsoMesh.setColorAt(i, _c);
    armLMesh.setColorAt(i, _c);
    armRMesh.setColorAt(i, _c);
    _c.setHex(arch.bottom);
    legLMesh.setColorAt(i, _c);
    legRMesh.setColorAt(i, _c);
    shinLMesh.setColorAt(i, _c);
    shinRMesh.setColorAt(i, _c);
    skirtMesh.setColorAt(i, _c);
    _c.setHex(arch.shoes);
    shoeLMesh.setColorAt(i, _c);
    shoeRMesh.setColorAt(i, _c);
  }
  for (const m of [headMesh, hairShortMesh, hairLongMesh, hairBunMesh, capMesh, torsoMesh, armLMesh, armRMesh, legLMesh, legRMesh, shinLMesh, shinRMesh, shoeLMesh, shoeRMesh, skirtMesh]) {
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  /** Pick the next edge: mostly the one that gets closest to the destination. */
  const chooseNext = (npc: NPC): void => {
    const node = graph.nodes[npc.node];
    const target = graph.nodes[npc.target];
    let best = -1;
    let bestD = Infinity;
    for (let e = 0; e < node.edges.length; e++) {
      const ni = node.edges[e];
      if (ni === npc.prev && node.edges.length > 1) continue; // don't U-turn
      const n = graph.nodes[ni];
      const d = (n.x - target.x) * (n.x - target.x) + (n.z - target.z) * (n.z - target.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    // A little wander so the crowd doesn't march in lockstep.
    if (rand() < 0.18 || best === -1) {
      best = Math.floor(rand() * node.edges.length);
    }
    npc.next = node.edges[best];
    npc.onCrosswalk = node.crosswalk[best];
  };

  const update = (dt: number, ctx: CrowdContext): boolean => {
    let moved = false;
    const actorPos = ctx.driving ? ctx.vehiclePos : ctx.playerPos;
    const actorSpeed = ctx.driving ? ctx.vehicleSpeed : ctx.playerSpeed;
    // Threat cars: the player's Velocity GT when driven, plus every
    // AI traffic car moving faster than a crawl. NPCs hurry across
    // or wait at the curb for any of them.
    const threatCars: Array<{ x: number; z: number; speed: number; fx: number; fz: number }> = [];
    if (ctx.driving && ctx.vehicleSpeed > 3) {
      threatCars.push({
        x: ctx.vehiclePos.x,
        z: ctx.vehiclePos.z,
        speed: ctx.vehicleSpeed,
        fx: Math.sin(ctx.vehicleHeading),
        fz: Math.cos(ctx.vehicleHeading),
      });
    }
    for (const v of ctx.aiVehicles ?? []) {
      if (v.speed > 3) {
        threatCars.push({ x: v.x, z: v.z, speed: v.speed, fx: Math.sin(v.heading), fz: Math.cos(v.heading) });
      }
    }

    for (let i = 0; i < MAX_NPCS; i++) {
      const npc = npcs[i];
      if (!npc.active) {
        zeroMat(_mA);
        headMesh.setMatrixAt(i, _mA);
        hairShortMesh.setMatrixAt(i, _mA);
        hairLongMesh.setMatrixAt(i, _mA);
        hairBunMesh.setMatrixAt(i, _mA);
        capMesh.setMatrixAt(i, _mA);
        torsoMesh.setMatrixAt(i, _mA);
        armLMesh.setMatrixAt(i, _mA);
        armRMesh.setMatrixAt(i, _mA);
        legLMesh.setMatrixAt(i, _mA);
        legRMesh.setMatrixAt(i, _mA);
        shinLMesh.setMatrixAt(i, _mA);
        shinRMesh.setMatrixAt(i, _mA);
        shoeLMesh.setMatrixAt(i, _mA);
        shoeRMesh.setMatrixAt(i, _mA);
        skirtMesh.setMatrixAt(i, _mA);
        faceMesh.setMatrixAt(i, _mA);
        continue;
      }

      // Recycle far-away NPCs around the player (never accumulate).
      const dxP = npc.x - ctx.playerPos.x;
      const dzP = npc.z - ctx.playerPos.z;
      if (dxP * dxP + dzP * dzP > 85 * 85) {
        placeAtNode(npc, randomRingNode(graph, rand, ctx.playerPos.x, ctx.playerPos.z, 55, 75, ctx.camForward));
      }

      const arch = npc.arch;
      let desiredSpeed = 0;
      let hurrying = false;

      // ---- Reactions ----
      const toActorX = actorPos.x - npc.x;
      const toActorZ = actorPos.z - npc.z;
      const actorDist = Math.hypot(toActorX, toActorZ) || 0.001;
      const aheadX = Math.sin(npc.heading);
      const aheadZ = Math.cos(npc.heading);
      const actorAhead = (toActorX * aheadX + toActorZ * aheadZ) / actorDist;
      // Glance at the player when they are close and in front.
      const glanceTarget =
        !ctx.driving && actorDist < 4 && actorAhead > 0.2
          ? clamp(Math.atan2(toActorX, toActorZ) - npc.heading, -0.6, 0.6)
          : 0;
      npc.headYaw += (glanceTarget - npc.headYaw) * Math.min(1, dt * 6);

      // Cars: hurry across, or wait at the curb before crossing.
      for (const car of threatCars) {
        const carToNpcX = npc.x - car.x;
        const carToNpcZ = npc.z - car.z;
        const carDist = Math.hypot(carToNpcX, carToNpcZ);
        const approaching = (carToNpcX * car.fx + carToNpcZ * car.fz) / (carDist || 1) > 0.3;
        if (npc.onCrosswalk && carDist < 10 && approaching) hurrying = true;
        if (!npc.onCrosswalk && npc.state === 'walk' && carDist < 8 && approaching) {
          const node = graph.nodes[npc.node];
          const nextIsCrosswalk =
            node.edges.includes(npc.next) &&
            node.crosswalk[node.edges.indexOf(npc.next)];
          if (nextIsCrosswalk && npc.waitT <= 0) npc.waitT = 1.2;
        }
      }

      // The player: step aside, or yield and wait when very close.
      if (!ctx.driving) {
        const closing = actorSpeed > 0.5 && actorAhead > 0.3;
        if (actorDist < 1.3 && closing) {
          npc.waitT = Math.max(npc.waitT, 0.7);
        } else if (actorDist < (actorSpeed > 8 ? 5 : 2.4) && actorAhead > 0.2 && npc.sideT <= 0) {
          npc.sideT = actorSpeed > 8 ? 1.4 : 1.0;
          // Step to the side away from the player.
          const cross = aheadX * toActorZ - aheadZ * toActorX;
          npc.sideDir = cross > 0 ? -1 : 1;
        }
      }
      if (npc.sideT > 0) {
        npc.sideT -= dt;
        npc.sideAmt = Math.sin(Math.min(1, Math.max(0, npc.sideT / 1.4)) * Math.PI) * 0.9;
      } else {
        npc.sideAmt *= Math.max(0, 1 - dt * 4);
      }

      // ---- State machine ----
      if (npc.waitT > 0) {
        npc.waitT -= dt;
        npc.state = 'wait';
        desiredSpeed = 0;
      } else if (npc.state === 'idle') {
        npc.idleT -= dt;
        desiredSpeed = 0;
        if (npc.idleT <= 0) {
          npc.target = randomFarNode(graph, rand, npc.x, npc.z, 50);
          npc.state = 'walk';
          chooseNext(npc);
        }
      } else {
        // Walking toward `next`.
        const target = graph.nodes[npc.next];
        const dx = target.x - npc.x;
        const dz = target.z - npc.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
          npc.prev = npc.node;
          npc.node = npc.next;
          if (npc.node === npc.target) {
            npc.state = 'idle';
            npc.idleT = 2 + rand() * 6;
            desiredSpeed = 0;
          } else {
            chooseNext(npc);
          }
        } else {
          const targetHeading = Math.atan2(dx, dz);
          npc.heading = lerpAngle(npc.heading, targetHeading, Math.min(1, dt * 8));
          desiredSpeed = arch.cruise * (hurrying ? 1.7 : 1);
          // Lateral sidestep, perpendicular to heading.
          const stepX = Math.cos(npc.heading) * npc.sideDir * npc.sideAmt * dt * 2;
          const stepZ = -Math.sin(npc.heading) * npc.sideDir * npc.sideAmt * dt * 2;
          npc.x += (Math.sin(npc.heading) * desiredSpeed * dt) + stepX;
          npc.z += (Math.cos(npc.heading) * desiredSpeed * dt) + stepZ;
          if (desiredSpeed > 0.05) moved = true;
        }
      }

      // NPC-NPC: slow down and drift aside instead of walking
      // through each other (cheap O(n^2), n <= 28).
      if (desiredSpeed > 0) {
        for (let j = 0; j < MAX_NPCS; j++) {
          if (j === i) continue;
          const other = npcs[j];
          if (!other.active) continue;
          const ox = other.x - npc.x;
          const oz = other.z - npc.z;
          const od = ox * ox + oz * oz;
          if (od < 1.0 && od > 1e-6) {
            const aheadOther = (ox * aheadX + oz * aheadZ) / Math.sqrt(od);
            if (aheadOther > 0.5) {
              desiredSpeed *= 0.55;
              npc.x -= Math.cos(npc.heading) * 0.35 * dt;
              npc.z += Math.sin(npc.heading) * 0.35 * dt;
              break;
            }
          }
        }
      }

      // Solid-body collision vs the player / their car (Phase 2,
      // 3.1). Only the NPC is ever moved — the player and the car
      // are treated as immovable actors, so this can never block
      // the player, change vehicle speed or handling, or fight the
      // world collision. The NPC's node-seeking walk re-anchors
      // it to the sidewalk graph on the next frame, so a push can
      // never strand it. Its state, node and target are untouched:
      // the push-out is a last resort for the cases the dodge
      // reactions miss (from behind, idle, waiting at the curb).
      // Scope: the player on foot and the player-driven car only —
      // AI traffic cars, police cars and the mission sedan still
      // pass through NPCs (their hurry / wait reactions dodge
      // most contact, and their motion is not owned here).
      if (ctx.driving) {
        const fx = Math.sin(ctx.vehicleHeading);
        const fz = Math.cos(ctx.vehicleHeading);
        // Right vector of the car (perpendicular to its heading),
        // for the exact-overlap fallback.
        const rx = Math.cos(ctx.vehicleHeading);
        const rz = -Math.sin(ctx.vehicleHeading);
        for (const s of [1, -1] as const) {
          const cx = ctx.vehiclePos.x + fx * CAR_AXLE_OFFSET * s;
          const cz = ctx.vehiclePos.z + fz * CAR_AXLE_OFFSET * s;
          const ddx = npc.x - cx;
          const ddz = npc.z - cz;
          const d2 = ddx * ddx + ddz * ddz;
          if (d2 < CAR_BODY_RADIUS * CAR_BODY_RADIUS) {
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              const push = (CAR_BODY_RADIUS - d) / d;
              npc.x += ddx * push;
              npc.z += ddz * push;
            } else {
              npc.x += rx * CAR_BODY_RADIUS;
              npc.z += rz * CAR_BODY_RADIUS;
            }
          }
        }
      } else {
        const r = PLAYER_BODY_RADIUS + NPC_BODY_RADIUS;
        const ddx = npc.x - ctx.playerPos.x;
        const ddz = npc.z - ctx.playerPos.z;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < r * r) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = (r - d) / d;
            npc.x += ddx * push;
            npc.z += ddz * push;
          } else {
            // Exactly on top of the player: shove sideways along
            // the NPC's own perpendicular.
            npc.x += Math.cos(npc.heading) * r;
            npc.z += -Math.sin(npc.heading) * r;
          }
        }
      }

      // Ease speed (no snapping) and advance the gait phase by
      // stride, so feet match the ground.
      npc.speed += (desiredSpeed - npc.speed) * Math.min(1, dt * 6);
      if (npc.speed > 0.05) {
        npc.phase += (dt * Math.PI * npc.speed) / 1.2;
      }
      const p = npc.phase;
      const s = Math.sin(p);
      const c = Math.cos(p);
      const walking = npc.speed > 0.05;
      const k = Math.min(1, dt * 10);
      const tLegL = walking ? 0.5 * s : 0;
      const tLegR = walking ? -0.5 * s : 0;
      const tKneeL = walking ? 0.8 * Math.max(0, -c) : 0.06;
      const tKneeR = walking ? 0.8 * Math.max(0, c) : 0.06;
      const tArmL = walking ? -0.4 * s : 0;
      const tArmR = walking ? 0.4 * s : 0;
      const tBob = walking ? 0.02 * Math.abs(c) : 0.004 * Math.sin(performance.now() * 0.0016 + i);
      npc.legL += (tLegL - npc.legL) * k;
      npc.legR += (tLegR - npc.legR) * k;
      npc.kneeL += (tKneeL - npc.kneeL) * k;
      npc.kneeR += (tKneeR - npc.kneeR) * k;
      npc.armL += (tArmL - npc.armL) * k;
      npc.armR += (tArmR - npc.armR) * k;
      npc.bob += (tBob - npc.bob) * k;

      // ---- Write the instance matrices ----
      const h = arch.height;
      const w = arch.width;
      composeRoot(_mRoot, npc.x, npc.bob, npc.z, npc.heading, w, h);

      // Head (+ hair / cap / face share the head matrix).
      _mA.copy(_mRoot);
      translate(_mA, 0, 1.62 * h, 0);
      rotY(_mA, npc.headYaw);
      headMesh.setMatrixAt(i, _mA);
      faceMesh.setMatrixAt(i, _mA);
      const hairMesh =
        arch.hairStyle === 'short'
          ? hairShortMesh
          : arch.hairStyle === 'long'
            ? hairLongMesh
            : arch.hairStyle === 'bun'
              ? hairBunMesh
              : capMesh;
      hairMesh.setMatrixAt(i, _mA);
      zeroMat(_mB);
      for (const m of [hairShortMesh, hairLongMesh, hairBunMesh, capMesh]) {
        if (m !== hairMesh) m.setMatrixAt(i, _mB);
      }

      // Torso (slight forward lean + breathing scale when idle).
      _mA.copy(_mRoot);
      translate(_mA, 0, 1.15 * h, 0);
      rotX(_mA, walking ? -0.04 : -0.01);
      torsoMesh.setMatrixAt(i, _mA);

      // Skirt (zero scale when the archetype wears trousers).
      if (arch.skirt) {
        _mA.copy(_mRoot);
        translate(_mA, 0, 0.72 * h, 0);
        skirtMesh.setMatrixAt(i, _mA);
      } else {
        skirtMesh.setMatrixAt(i, zeroMat(_mB));
      }

      // Arms.
      _mA.copy(_mRoot);
      translate(_mA, -0.26 * w, 1.42 * h, 0);
      rotX(_mA, npc.armL);
      rotZ(_mA, 0.1);
      armLMesh.setMatrixAt(i, _mA);
      _mA.copy(_mRoot);
      translate(_mA, 0.26 * w, 1.42 * h, 0);
      rotX(_mA, npc.armR);
      rotZ(_mA, -0.1);
      armRMesh.setMatrixAt(i, _mA);

      // Legs: hip pivot -> knee pivot -> shoe.
      _mA.copy(_mRoot);
      translate(_mA, -0.11 * w, 0.92 * h, 0);
      rotX(_mA, npc.legL);
      legLMesh.setMatrixAt(i, _mA);
      _mB.copy(_mA);
      translate(_mB, 0, -0.44 * h, 0);
      rotX(_mB, npc.kneeL);
      shinLMesh.setMatrixAt(i, _mB);
      translate(_mB, 0, -0.42 * h, 0.05);
      shoeLMesh.setMatrixAt(i, _mB);
      _mA.copy(_mRoot);
      translate(_mA, 0.11 * w, 0.92 * h, 0);
      rotX(_mA, npc.legR);
      legRMesh.setMatrixAt(i, _mA);
      _mB.copy(_mA);
      translate(_mB, 0, -0.44 * h, 0);
      rotX(_mB, npc.kneeR);
      shinRMesh.setMatrixAt(i, _mB);
      translate(_mB, 0, -0.42 * h, 0.05);
      shoeRMesh.setMatrixAt(i, _mB);
    }

    for (const m of [headMesh, hairShortMesh, hairLongMesh, hairBunMesh, capMesh, torsoMesh, armLMesh, armRMesh, legLMesh, legRMesh, shinLMesh, shinRMesh, shoeLMesh, shoeRMesh, skirtMesh, faceMesh]) {
      m.instanceMatrix.needsUpdate = true;
    }
    return moved;
  };

  return {
    update,
    setCount: (nextChoice: PedestrianChoice) => {
      targetCount = PEDESTRIAN_COUNTS[nextChoice];
      for (let i = 0; i < MAX_NPCS; i++) {
        const npc = npcs[i];
        if (i < targetCount && !npc.active) {
          npc.active = true;
          placeAtNode(npc, randomRingNode(graph, rand, 0, 8, 15, 55));
        } else if (i >= targetCount) {
          npc.active = false;
        }
      }
    },
    activeCount: () => npcs.filter((n) => n.active).length,
    totalCount: () => MAX_NPCS,
    npcPositions: () =>
      npcs
        .filter((n) => n.active)
        .map((n) => ({ x: +n.x.toFixed(2), z: +n.z.toFixed(2), heading: +n.heading.toFixed(2), headYaw: +n.headYaw.toFixed(2), state: n.state, speed: +n.speed.toFixed(2), onCrosswalk: n.onCrosswalk })),
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
