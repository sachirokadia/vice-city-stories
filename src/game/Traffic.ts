/**
 * City traffic: autonomous AI vehicles on the road network.
 *
 * Six original procedural categories (sedan, SUV, taxi, sports car,
 * delivery van, city bus), all built from Three.js geometry — no
 * copied vehicles. Rendering is instanced: one mesh per body
 * category (vertex colours + per-instance paint), one shared wheel
 * mesh and one shared light mesh for the whole fleet, so 20 cars
 * cost 8 draw calls. A fixed pool is recycled around the player;
 * nothing is created or destroyed per frame.
 *
 * AI: vehicles follow the directed lane graph (TrafficPaths), ease
 * their speed toward a target, slow for turns, stop at the existing
 * traffic signals (read live from Roads — no second light system),
 * yield at unsignalised intersections, keep a gap behind the car
 * ahead, stop for pedestrians on crosswalks, and brake for the
 * player's Velocity GT (parked or driven) and for the player on
 * foot. Two vehicles that touch get nudged apart — never teleported.
 */
import * as THREE from 'three';
import { buildLaneGraph, randomRingLaneNode, trafficRandom } from './TrafficPaths';
import type { LaneGraph } from './TrafficPaths';
import type { SignalState } from './Roads';
import { GeometryBatch, composeMatrix } from './Merge';

export type TrafficChoice = 'off' | 'low' | 'medium' | 'high';
export const TRAFFIC_COUNTS: Record<TrafficChoice, number> = {
  off: 0,
  low: 8,
  medium: 14,
  high: 20,
};
const MAX_VEHICLES = 20;

export interface TrafficContext {
  playerPos: THREE.Vector3;
  playerSpeed: number;
  driving: boolean;
  /** The Velocity GT — an obstacle whether parked or driven. */
  vehiclePos: THREE.Vector3;
  vehicleSpeed: number;
  vehicleHeading: number;
  /** Extra cars on the road (the mission target vehicle) —
   * traffic follows and brakes for them like for the GT. */
  extraVehicles?: Array<{ x: number; z: number; speed: number }>;
  npcs: Array<{ x: number; z: number; onCrosswalk: boolean }>;
  camForward: { x: number; z: number };
}

export interface TrafficVehicleInfo {
  x: number;
  z: number;
  heading: number;
  speed: number;
  category: string;
  braking: boolean;
}

export interface TrafficHandle {
  /** Returns true when any vehicle moved (shadow refresh hint). */
  update: (dt: number, ctx: TrafficContext) => boolean;
  setCount: (choice: TrafficChoice) => void;
  activeCount: () => number;
  totalCount: () => number;
  /** Active vehicles (for NPC reactions and QA). */
  listVehicles: () => TrafficVehicleInfo[];
  dispose: () => void;
}

interface CategorySpec {
  key: string;
  length: number;
  width: number;
  /** Body box: height and centre height. */
  bodyH: number;
  bodyY: number;
  /** Cabin (glass) box. */
  cabinL: number;
  cabinW: number;
  cabinH: number;
  cabinY: number;
  cabinZ: number;
  wheelR: number;
  axle: number;
  lightY: number;
  cruiseMin: number;
  cruiseMax: number;
  colors: number[];
  /** Extra boxes beyond body + cabin, as [w,h,d,x,y,z,colour]. */
  extras: Array<[number, number, number, number, number, number, number]>;
}

const PAINT = 0xffffff; // vertex white: the instance colour shows through
const GLASS = 0x12161c;
const TRIM = 0x1a1a20;
const BRIGHT = 0xffd23c;

const CATEGORIES: CategorySpec[] = [
  {
    key: 'sedan', length: 4.4, width: 1.9, bodyH: 0.55, bodyY: 0.45,
    cabinL: 2.2, cabinW: 1.7, cabinH: 0.5, cabinY: 0.95, cabinZ: -0.2,
    wheelR: 0.36, axle: 1.42, lightY: 0.5, cruiseMin: 8, cruiseMax: 11,
    colors: [0x3a5a8a, 0x8a8f96, 0x8a3a3a, 0x2f8a7a, 0xd8d4cc],
    extras: [
      [1.9, 0.16, 0.15, 0, 0.28, 2.2, TRIM], // front bumper
      [1.9, 0.16, 0.15, 0, 0.28, -2.2, TRIM], // rear bumper
      [0.9, 0.12, 0.05, 0, 0.45, 2.21, TRIM], // grille
    ],
  },
  {
    key: 'suv', length: 4.8, width: 2.0, bodyH: 0.7, bodyY: 0.55,
    cabinL: 2.8, cabinW: 1.8, cabinH: 0.55, cabinY: 1.15, cabinZ: -0.1,
    wheelR: 0.38, axle: 1.5, lightY: 0.6, cruiseMin: 7, cruiseMax: 10,
    colors: [0x3a3f4a, 0x8a8f96, 0x4a6b3a, 0x8a6a3a],
    extras: [
      [2.0, 0.18, 0.15, 0, 0.32, 2.4, TRIM],
      [2.0, 0.18, 0.15, 0, 0.32, -2.4, TRIM],
      [0.08, 0.06, 2.4, -0.7, 1.46, -0.1, TRIM], // roof rails
      [0.08, 0.06, 2.4, 0.7, 1.46, -0.1, TRIM],
    ],
  },
  {
    key: 'taxi', length: 4.4, width: 1.9, bodyH: 0.55, bodyY: 0.45,
    cabinL: 2.2, cabinW: 1.7, cabinH: 0.5, cabinY: 0.95, cabinZ: -0.2,
    wheelR: 0.36, axle: 1.42, lightY: 0.5, cruiseMin: 9, cruiseMax: 12,
    colors: [0xf2b234],
    extras: [
      [1.9, 0.16, 0.15, 0, 0.28, 2.2, TRIM],
      [1.9, 0.16, 0.15, 0, 0.28, -2.2, TRIM],
      [0.5, 0.14, 0.28, 0, 1.28, 0, BRIGHT], // roof sign
    ],
  },
  {
    key: 'sports', length: 4.5, width: 1.95, bodyH: 0.42, bodyY: 0.38,
    cabinL: 1.7, cabinW: 1.6, cabinH: 0.38, cabinY: 0.78, cabinZ: -0.3,
    wheelR: 0.34, axle: 1.45, lightY: 0.42, cruiseMin: 11, cruiseMax: 14,
    colors: [0xd21026, 0xf28c1a, 0x1a6fd2, 0xd8d4cc],
    extras: [
      [1.95, 0.14, 0.15, 0, 0.24, 2.25, TRIM],
      [1.95, 0.14, 0.15, 0, 0.24, -2.25, TRIM],
      [1.7, 0.04, 0.3, 0, 0.82, -2.1, TRIM], // spoiler
      [0.08, 0.16, 0.08, -0.5, 0.72, -2.1, TRIM],
      [0.08, 0.16, 0.08, 0.5, 0.72, -2.1, TRIM],
    ],
  },
  {
    key: 'van', length: 5.2, width: 2.1, bodyH: 1.9, bodyY: 1.05,
    cabinL: 0, cabinW: 0, cabinH: 0, cabinY: 0, cabinZ: 0,
    wheelR: 0.38, axle: 1.7, lightY: 0.75, cruiseMin: 6, cruiseMax: 9,
    colors: [0xd8d4cc, 0x3a5a8a, 0x8a8f96, 0x6b7a8a],
    extras: [
      [1.9, 0.5, 0.06, 0, 1.5, 2.61, GLASS], // windshield
      [0.06, 0.5, 2.0, -1.06, 1.5, 0.6, GLASS], // side windows
      [0.06, 0.5, 2.0, 1.06, 1.5, 0.6, GLASS],
      [2.1, 0.18, 0.15, 0, 0.3, 2.6, TRIM],
      [2.1, 0.18, 0.15, 0, 0.3, -2.6, TRIM],
    ],
  },
  {
    key: 'bus', length: 9, width: 2.5, bodyH: 2.4, bodyY: 1.35,
    cabinL: 0, cabinW: 0, cabinH: 0, cabinY: 0, cabinZ: 0,
    wheelR: 0.45, axle: 3.2, lightY: 1.0, cruiseMin: 5, cruiseMax: 8,
    colors: [0x2a7a4a, 0x3a5a8a, 0xd8b25a, 0xa03a3a],
    extras: [
      [2.3, 0.7, 0.06, 0, 1.9, 4.51, GLASS], // windshield
      [0.06, 0.6, 7.5, -1.26, 1.9, 0, GLASS], // side windows
      [0.06, 0.6, 7.5, 1.26, 1.9, 0, GLASS],
      [1.2, 0.3, 0.06, 0, 2.3, 4.52, BRIGHT], // destination sign
      [2.5, 0.2, 0.15, 0, 0.3, 4.5, TRIM],
      [2.5, 0.2, 0.15, 0, 0.3, -4.5, TRIM],
    ],
  },
];

const ACCEL = 4.5;
const BRAKE = 12;

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

interface TrafficVehicle {
  active: boolean;
  spec: CategorySpec;
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
}

export function createTraffic(
  scene: THREE.Scene,
  choice: TrafficChoice,
  getSignals: () => SignalState,
): TrafficHandle {
  const graph: LaneGraph = buildLaneGraph();
  const rand = trafficRandom();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const group = new THREE.Group();
  group.name = 'traffic';

  // --- Body geometry per category: one merged mesh, vertex colours
  // carry paint (white, tinted by the instance colour), glass and
  // trim. Forward is +Z, matching the player's car convention.
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  const bodyMat = track(
    // Near-zero metalness: with no environment map, metalness turns
    // paint black on the shadow side at sunset. The protagonist's
    // NPCs use the same dielectric paint and read clearly.
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.05 }),
  );
  const addColoredBox = (
    batch: GeometryBatch,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
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
  for (const spec of CATEGORIES) {
    const batch = new GeometryBatch();
    addColoredBox(batch, spec.width, spec.bodyH, spec.length, 0, spec.bodyY, 0, PAINT);
    if (spec.cabinL > 0) {
      addColoredBox(batch, spec.cabinW, spec.cabinH, spec.cabinL, 0, spec.cabinY, spec.cabinZ, GLASS);
    }
    for (const [w, h, d, x, y, z, hex] of spec.extras) {
      addColoredBox(batch, w, h, d, x, y, z, hex);
    }
    const geo = track(batch.build()!);
    const mesh = new THREE.InstancedMesh(geo, bodyMat, MAX_VEHICLES);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false; // instances span the whole city
    group.add(mesh);
    bodyMeshes.push(mesh);
  }

  // --- Wheels: one shared mesh (tire + rim, vertex colours), 4
  // instances per vehicle. Scale per instance carries the size.
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
  const wheelMesh = new THREE.InstancedMesh(wheelGeo, wheelMat, MAX_VEHICLES * 4);
  wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wheelMesh.frustumCulled = false;
  group.add(wheelMesh);

  // --- Lights: one shared mesh, 4 instances per vehicle (2 head,
  // 2 tail). Instance colour carries the state: warm white headlights,
  // dim red tail, bright red when braking.
  const lightGeo = track(new THREE.BoxGeometry(0.32, 0.12, 0.06));
  const lightMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const lightMesh = new THREE.InstancedMesh(lightGeo, lightMat, MAX_VEHICLES * 4);
  lightMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lightMesh.frustumCulled = false;
  group.add(lightMesh);
  scene.add(group);

  const vehicles: TrafficVehicle[] = [];
  let targetCount = TRAFFIC_COUNTS[choice];

  const chooseNext = (v: TrafficVehicle): void => {
    const node = graph.nodes[v.node];
    if (node.edges.length === 1) {
      v.next = node.edges[0];
      return;
    }
    // Stop-line node: edges = [straight, left, right].
    const r = rand();
    v.next = r < 0.55 ? node.edges[0] : r < 0.75 ? node.edges[1] : node.edges[2];
  };

  const placeAtNode = (v: TrafficVehicle, nodeIdx: number): void => {
    const n = graph.nodes[nodeIdx];
    v.x = n.x;
    v.z = n.z;
    v.node = nodeIdx;
    v.heading = n.heading;
    v.speed = v.cruise * 0.5;
    v.wheelSpin = 0;
    v.steer = 0;
    v.braking = false;
    chooseNext(v);
  };

  const zeroSlot = (slot: number): void => {
    zeroMat(_mA);
    for (const mesh of bodyMeshes) mesh.setMatrixAt(slot, _mA);
    for (let k = 0; k < 4; k++) {
      wheelMesh.setMatrixAt(slot * 4 + k, _mA);
      lightMesh.setMatrixAt(slot * 4 + k, _mA);
    }
  };

  for (let i = 0; i < MAX_VEHICLES; i++) {
    const spec = CATEGORIES[i % CATEGORIES.length];
    const v: TrafficVehicle = {
      active: i < targetCount,
      spec,
      slot: i,
      x: 0, z: 0, heading: 0, speed: 0,
      cruise: spec.cruiseMin + rand() * (spec.cruiseMax - spec.cruiseMin),
      node: 0, next: 0,
      wheelSpin: 0, steer: 0, braking: false,
    };
    // Opening fleet: spread around the spawn plaza, not on top of it.
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
    placeAtNode(v, startNode);
    vehicles.push(v);
    // Per-instance paint colour (variety lives here).
    const colorIdx = Math.floor(i / CATEGORIES.length) % spec.colors.length;
    _c.setHex(spec.colors[colorIdx]);
    bodyMeshes[CATEGORIES.indexOf(spec)].setColorAt(i, _c);
    zeroSlot(i);
  }
  for (const mesh of bodyMeshes) {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** Is any active vehicle (or the player's car) inside an intersection box? */
  const intersectionOccupied = (cx: number, cz: number, self: TrafficVehicle, ctx: TrafficContext): boolean => {
    for (const o of vehicles) {
      if (!o.active || o === self) continue;
      if (Math.abs(o.x - cx) < 7 && Math.abs(o.z - cz) < 7) return true;
    }
    return Math.abs(ctx.vehiclePos.x - cx) < 7 && Math.abs(ctx.vehiclePos.z - cz) < 7;
  };

  const update = (dt: number, ctx: TrafficContext): boolean => {
    let moved = false;
    const avenueGreen = getSignals().isAvenueGreen();

    for (const v of vehicles) {
      if (!v.active) continue;
      const spec = v.spec;
      const target = graph.nodes[v.next];
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const targetHeading = Math.atan2(dx, dz);
      const turn = angleDiff(v.heading, targetHeading);
      const uturn = Math.abs(turn) > 2.2;
      const turnRate = uturn ? 6 : 3.2;
      v.heading = lerpAngle(v.heading, targetHeading, Math.min(1, dt * turnRate));
      // Steering angle for the front wheels, from the turn rate.
      const targetSteer = THREE.MathUtils.clamp(-turn * 0.5, -0.5, 0.5);
      v.steer += (targetSteer - v.steer) * Math.min(1, dt * 6);

      let desired = v.cruise;
      let held = false;
      // Turning (and U-turns at the city edge) slow the car.
      if (Math.abs(turn) > 0.35) desired = Math.min(desired, v.cruise * 0.55);
      if (uturn) desired = Math.min(desired, 3.5);

      // ---- Traffic signals / intersection behaviour ----
      if (target.stopLine) {
        const sl = target.stopLine;
        if (sl.signal) {
          const green = sl.approach === 'avenue' ? avenueGreen : !avenueGreen;
          if (!green) {
            // Too close and too fast to stop: run it (a real driver
            // would), otherwise stop before the line.
            if (dist < 4 && v.speed > 4) {
              /* proceed */
            } else {
              desired = dist < 6 ? 0 : Math.min(desired, 4);
              if (dist < 6) held = true;
            }
          } else if (dist < 16) {
            desired = Math.min(desired, v.cruise * 0.75);
          }
        } else {
          if (dist < 16) desired = Math.min(desired, v.cruise * 0.7);
          if (dist < 14 && intersectionOccupied(sl.cx, sl.cz, v, ctx)) {
            desired = 0;
            held = true;
          }
        }
      }

      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      // Ahead check: returns distance and lateral offset of an object
      // in front of this vehicle, or null when it is not ahead.
      const aheadOf = (
        ox: number,
        oz: number,
        halfLen: number,
      ): { d: number; lat: number } | null => {
        const tx = ox - v.x;
        const tz = oz - v.z;
        const d = Math.hypot(tx, tz);
        if (d < 0.001) return { d, lat: 0 };
        const ahead = (tx * fx + tz * fz) / d;
        if (ahead < 0.7) return null;
        const lat = Math.abs(tx * fz - tz * fx);
        return { d: d - halfLen, lat };
      };

      // ---- The car ahead (AI or the player's Velocity GT) ----
      // aheadOf already subtracts the leader's half-length, so the
      // gap is measured from the leader's bumper to this car's centre.
      for (const o of vehicles) {
        if (!o.active || o === v) continue;
        const info = aheadOf(o.x, o.z, o.spec.length / 2);
        if (!info || info.lat > 2.0) continue;
        const stopGap = spec.length / 2 + 1.2;
        const followGap = stopGap + 4;
        if (info.d < stopGap) {
          desired = 0;
        } else if (info.d < followGap) {
          desired = Math.min(desired, o.speed + 1.5);
        }
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
      // ---- The mission target car, when it is on the road ----
      for (const o of ctx.extraVehicles ?? []) {
        const info = aheadOf(o.x, o.z, 2.2);
        if (!info || info.lat > 2.0) continue;
        const stopGap = spec.length / 2 + 1.2;
        const followGap = stopGap + 4;
        if (info.d < stopGap) desired = 0;
        else if (info.d < followGap) desired = Math.min(desired, o.speed + 1.5);
      }
      // ---- The player on foot, standing in the road ----
      if (!ctx.driving) {
        const info = aheadOf(ctx.playerPos.x, ctx.playerPos.z, 0.6);
        if (info && info.lat <= 2.2 && info.d < 7) desired = 0;
      }
      // ---- Pedestrians on crosswalks ahead ----
      for (const npc of ctx.npcs) {
        if (!npc.onCrosswalk) continue;
        const info = aheadOf(npc.x, npc.z, 0.5);
        if (!info || info.lat > 2.2) continue;
        if (info.d < 8) desired = 0;
        else if (info.d < 13) desired = Math.min(desired, 3);
      }

      // Ease speed (no snapping) and roll forward.
      const prevSpeed = v.speed;
      if (desired < v.speed) v.speed = Math.max(desired, v.speed - BRAKE * dt);
      else v.speed = Math.min(desired, v.speed + ACCEL * dt);
      v.braking = v.speed < prevSpeed - 0.01 || desired === 0;
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      if (v.speed > 0.05) {
        moved = true;
        v.wheelSpin += (v.speed * dt) / spec.wheelR;
      }

      // Arrive at the target node: pick the next edge — unless held
      // at a red light (the target stays the stop line until green).
      if (dist < 1.8 && !held) {
        v.node = v.next;
        chooseNext(v);
      }

      // Recycle far-away vehicles around the player (never accumulate),
      // and anything that slipped past the city boundary.
      const dxP = v.x - ctx.playerPos.x;
      const dzP = v.z - ctx.playerPos.z;
      if (dxP * dxP + dzP * dzP > 90 * 90 || Math.abs(v.x) > 192 || Math.abs(v.z) > 192) {
        placeAtNode(v, randomRingLaneNode(graph, rand, ctx.playerPos.x, ctx.playerPos.z, 55, 75, ctx.camForward));
      }
    }

    // Two vehicles that touch get nudged apart — a bump, never a
    // teleport. Also keeps a ramming player car from driving
    // straight through an AI car.
    for (let i = 0; i < MAX_VEHICLES; i++) {
      const a = vehicles[i];
      if (!a.active) continue;
      for (let j = i + 1; j < MAX_VEHICLES; j++) {
        const b = vehicles[j];
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const minD = a.spec.length / 2 + b.spec.length / 2 - 1.5;
        const d2 = dx * dx + dz * dz;
        if (d2 >= minD * minD || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = ((minD - d) / 2) * 0.5;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
      }
      // The player's car is solid even when parked: push the AI
      // car out of the overlap.
      {
        const dx = a.x - ctx.vehiclePos.x;
        const dz = a.z - ctx.vehiclePos.z;
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
    for (const v of vehicles) {
      const spec = v.spec;
      const catIdx = CATEGORIES.indexOf(spec);
      if (!v.active) continue;
      _e.set(0, v.heading, 0, 'YXZ');
      _q.setFromEuler(_e);
      _v.set(v.x, 0, v.z);
      _s.set(1, 1, 1);
      _mRoot.compose(_v, _q, _s);
      bodyMeshes[catIdx].setMatrixAt(v.slot, _mRoot);

      // Wheels: local offset, steer (front), then spin.
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
        _e.set(0, front ? v.steer : 0, 0);
        _q.setFromEuler(_e);
        _mB.makeRotationFromQuaternion(_q);
        _mA.multiply(_mB);
        _e.set(v.wheelSpin, 0, 0);
        _q.setFromEuler(_e);
        _mB.makeRotationFromQuaternion(_q);
        _mA.multiply(_mB);
        _mB.makeScale(wheelScale, wheelScale, wheelScale);
        _mA.multiply(_mB);
        wheelMesh.setMatrixAt(v.slot * 4 + k, _mA);
        k++;
      }

      // Lights: 2 head (warm white), 2 tail (red, bright when braking).
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
        lightMesh.setMatrixAt(v.slot * 4 + li, _mA);
        if (tail) _c.setRGB(v.braking ? 1 : 0.4, 0.06, 0.06);
        else _c.setRGB(1, 0.95, 0.75);
        lightMesh.setColorAt(v.slot * 4 + li, _c);
      }
    }
    for (const mesh of bodyMeshes) mesh.instanceMatrix.needsUpdate = true;
    wheelMesh.instanceMatrix.needsUpdate = true;
    lightMesh.instanceMatrix.needsUpdate = true;
    if (lightMesh.instanceColor) lightMesh.instanceColor.needsUpdate = true;
    return moved;
  };

  return {
    update,
    setCount: (nextChoice: TrafficChoice) => {
      targetCount = TRAFFIC_COUNTS[nextChoice];
      for (let i = 0; i < MAX_VEHICLES; i++) {
        const v = vehicles[i];
        if (i < targetCount && !v.active) {
          v.active = true;
          placeAtNode(v, randomRingLaneNode(graph, rand, 0, 8, 15, 55));
        } else if (i >= targetCount) {
          v.active = false;
          zeroSlot(i);
        }
      }
      for (const mesh of bodyMeshes) mesh.instanceMatrix.needsUpdate = true;
      wheelMesh.instanceMatrix.needsUpdate = true;
      lightMesh.instanceMatrix.needsUpdate = true;
    },
    activeCount: () => vehicles.filter((v) => v.active).length,
    totalCount: () => MAX_VEHICLES,
    listVehicles: () =>
      vehicles
        .filter((v) => v.active)
        .map((v) => ({
          x: +v.x.toFixed(2),
          z: +v.z.toFixed(2),
          heading: +v.heading.toFixed(2),
          speed: +v.speed.toFixed(2),
          category: v.spec.key,
          braking: v.braking,
        })),
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
