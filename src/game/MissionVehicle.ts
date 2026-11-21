/**
 * The mission target vehicle for DON'T LOSE THEM — a dedicated
 * car that never touches the traffic AI. It is a plain procedural
 * teal sedan with a purple roof beacon (so the player can tell it
 * apart from traffic), and it drives the existing lane graph
 * node-to-node: it can never leave a road, drive through a
 * building, or go off the map. It stops at red lights on the
 * existing signals, prefers to go straight, and turns at random
 * at intersections.
 *
 * States: parked at its start node until the tail begins, then
 * driving its route until it has covered `routeLength` units.
 * The manager owns when it drives and when it resets.
 */
import * as THREE from 'three';
import { buildLaneGraph } from './TrafficPaths';
import type { LaneGraph } from './TrafficPaths';
import { mulberry32 } from './CityGenerator';

export interface MissionVehicleState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** Units travelled along the route since the tail began. */
  travelled: number;
  driving: boolean;
}

export interface MissionVehicleHandle {
  update: (dt: number, avenueGreen: boolean) => boolean;
  /** Park at the start node, travelled reset. */
  reset: () => void;
  /** Begin the route (from the parked start). */
  start: () => void;
  /** Stop where the car is (it has reached its destination). */
  stop: () => void;
  /** QA hook: set how far along its route the car has driven. */
  debugSetTravelled: (units: number) => void;
  getState: () => MissionVehicleState;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

const TARGET_SPEED = 11; // u/s — the GT (38) catches it easily
const ACCEL = 8; // u/s^2, easing toward the desired speed
const WHEEL_RADIUS = 0.34; // matches the wheel geometry below
const START = { x: 62.5, z: -150 }; // northbound lane, avenue x = 60

/**
 * Create the tail car. The job mission's sedan starts at (62.5,
 * -150); the story's (9E) starts 12 m south on the same lane,
 * (62.5, -138), so the two cars never overlap when both missions
 * are selected. The group name is distinct for the same reason.
 */
export function createMissionVehicle(
  scene: THREE.Scene,
  opts?: { start?: { x: number; z: number }; name?: string },
): MissionVehicleHandle {
  const startPoint = opts?.start ?? START;
  const groupName = opts?.name ?? 'mission-target-vehicle';
  const graph: LaneGraph = buildLaneGraph();
  const rand = mulberry32(20261119);

  // --- The car: one group, 7 meshes, no shadows on the wheels ---
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const group = new THREE.Group();
  group.name = groupName;
  const paint = track(
    new THREE.MeshStandardMaterial({ color: 0x0ea5a5, roughness: 0.45, metalness: 0.05 }),
  );
  const glass = track(
    new THREE.MeshStandardMaterial({ color: 0x1a2a33, roughness: 0.15, metalness: 0.3 }),
  );
  const body = new THREE.Mesh(track(new THREE.BoxGeometry(1.8, 0.65, 4.4)), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(track(new THREE.BoxGeometry(1.6, 0.55, 2.2)), glass);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  const beacon = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.5, 0.16, 0.3)),
    track(new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.9 })),
  );
  beacon.position.set(0, 1.45, -0.2);
  const wheelGeo = track(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.24, 12));
  const wheelMat = track(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 }));
  // A light rim disc on each wheel (same trick as the traffic
  // wheels): the dark tyre alone is rotationally near-invisible,
  // the pale rim makes the spin read. The rim is a child of the
  // wheel, so it inherits the spin with no per-frame work.
  const rimGeo = track(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 10));
  const rimMat = track(new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.8 }));
  const wheels: THREE.Mesh[] = [];
  for (const [wx, wz] of [
    [-0.85, 1.45],
    [0.85, 1.45],
    [-0.85, -1.45],
    [0.85, -1.45],
  ] as const) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.34, wz);
    wheel.add(new THREE.Mesh(rimGeo, rimMat));
    wheels.push(wheel);
    group.add(wheel);
  }
  group.add(body, cabin, beacon);
  group.visible = false;
  scene.add(group);

  // --- Lane-graph driving ---
  // Nearest node to the start point (a stop-line node on the
  // northbound lane of avenue 60).
  let startNode = 0;
  {
    let best = Infinity;
    for (let i = 0; i < graph.nodes.length; i++) {
      const n = graph.nodes[i];
      const d = Math.hypot(n.x - startPoint.x, n.z - startPoint.z);
      if (d < best) {
        best = d;
        startNode = i;
      }
    }
  }
  let node = startNode;
  let next = graph.nodes[node].edges[0] ?? node;
  let pos = new THREE.Vector3(graph.nodes[node].x, 0, graph.nodes[node].z);
  let heading = graph.nodes[node].heading;
  let speed = 0;
  let travelled = 0;
  let driving = false;
  // Accumulated wheel rotation (radians), applied to each wheel's
  // rotation.x. The sedan never reverses, but the accumulation is
  // sign-correct anyway: a negative step would unwind it.
  let wheelSpin = 0;

  const pickNext = (from: number): number => {
    const edges = graph.nodes[from].edges;
    if (edges.length === 0) return from;
    if (edges.length === 1) return edges[0];
    // Stop-line node: edges = [straight, left, right]. Straight
    // most of the time, a turn otherwise.
    return rand() < 0.7 ? edges[0] : edges[1 + Math.floor(rand() * (edges.length - 1))];
  };

  const isRed = (nodeIndex: number, avenueGreen: boolean): boolean => {
    const sl = graph.nodes[nodeIndex].stopLine;
    if (!sl || !sl.signal) return false;
    return sl.approach === 'avenue' ? !avenueGreen : avenueGreen;
  };

  const update = (dt: number, avenueGreen: boolean): boolean => {
    if (!driving) {
      if (speed > 0) {
        speed = Math.max(0, speed - ACCEL * dt);
      }
      return false;
    }
    const target = graph.nodes[next];
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    // Ease the speed: stop at a red light, cruise otherwise.
    let desired = TARGET_SPEED;
    if (isRed(next, avenueGreen)) {
      desired = Math.min(TARGET_SPEED, Math.max(0, (dist - 0.5) / 2));
    }
    speed += Math.sign(desired - speed) * Math.min(Math.abs(desired - speed), ACCEL * dt);
    const step = speed * dt;
    if (step >= dist) {
      // Arrive at the node, then take the next edge.
      travelled += dist;
      wheelSpin += dist / WHEEL_RADIUS;
      pos.set(target.x, 0, target.z);
      node = next;
      next = pickNext(node);
      heading = graph.nodes[node].heading;
    } else if (step > 0) {
      pos.x += (dx / dist) * step;
      pos.z += (dz / dist) * step;
      travelled += step;
      wheelSpin += step / WHEEL_RADIUS;
      // Face the direction of travel, eased so turns sweep.
      const want = Math.atan2(dx, dz);
      let diff = want - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading += diff * Math.min(1, dt * 6);
    }
    // Spin the wheels by the distance actually covered this
    // frame — the same rule as the player car (Vehicle.ts) and
    // traffic: rotation.x spins the cylinder about its axle
    // (rotation.z = PI/2 fixed), and the sign matches forward
    // motion. No spin when stationary (step 0) or parked.
    for (const wheel of wheels) wheel.rotation.x = wheelSpin;
    group.position.copy(pos);
    group.rotation.y = heading;
    return speed > 0.05;
  };

  return {
    update,
    reset: () => {
      node = startNode;
      next = graph.nodes[node].edges[0] ?? node;
      pos.set(graph.nodes[node].x, 0, graph.nodes[node].z);
      heading = graph.nodes[node].heading;
      speed = 0;
      travelled = 0;
      driving = false;
      wheelSpin = 0;
      for (const wheel of wheels) wheel.rotation.x = 0;
      group.position.copy(pos);
      group.rotation.y = heading;
    },
    start: () => {
      driving = true;
    },
    stop: () => {
      driving = false;
    },
    debugSetTravelled: (units: number) => {
      travelled = Math.max(0, units);
    },
    getState: () => ({
      x: pos.x,
      z: pos.z,
      heading,
      speed,
      travelled,
      driving,
    }),
    setVisible: (visible: boolean) => {
      group.visible = visible;
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
