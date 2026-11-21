/**
 * The traffic lane graph: one directed lane per road direction,
 * derived from the same street grid as CityGenerator (avenues at
 * x = -120..120, streets at z = -150..150, roads 10 wide, so each
 * lane centreline sits 2.5 units off the road centreline — right-hand
 * traffic).
 *
 * A vehicle never leaves the graph, so it can never drive through a
 * building, onto a sidewalk, or off the map: every node is on a
 * lane, every edge is a legal move (continue along the lane, or
 * straight / left / right at an intersection). Stop-line nodes carry
 * the intersection they guard, so the AI can stop at red lights and
 * yield at unsignalised crossings. Lane ends U-turn into the
 * opposite lane at the city boundary.
 */
import { AVENUES, STREETS } from './PedestrianPaths';
import { CITY_HALF, mulberry32 } from './CityGenerator';
import { SIGNAL_SPOTS } from './Roads';

export interface LaneNode {
  x: number;
  z: number;
  /** Travel direction (forward = (sin h, cos h)). */
  heading: number;
  /** Neighbour node indices. At a stop line: [straight, left, right]. */
  edges: number[];
  /** Present when this node is the stop line before an intersection. */
  stopLine?: {
    cx: number;
    cz: number;
    approach: 'avenue' | 'street';
    /** True at the 6 intersections that have traffic signals. */
    signal: boolean;
  };
}

export interface LaneGraph {
  nodes: LaneNode[];
}

/** Lane centreline offset from a road centreline (right-hand traffic). */
export const LANE_OFFSET = 2.5;
/** Stop line distance before an intersection centre. */
export const STOP_DIST = 8;
/** Lane start/end, just inside the city boundary. */
const LANE_END = CITY_HALF - 5; // 185

const isSignal = (a: number, s: number): boolean =>
  SIGNAL_SPOTS.some(([x, z]) => x === a && z === s);

export function buildLaneGraph(): LaneGraph {
  const nodes: LaneNode[] = [];
  const byKey = new Map<string, number>();
  const addNode = (x: number, z: number, heading: number, stopLine?: LaneNode['stopLine']): number => {
    const key = `${x},${z}`;
    const existing = byKey.get(key);
    if (existing !== undefined) return existing;
    const i = nodes.length;
    byKey.set(key, i);
    nodes.push({ x, z, heading, edges: [], stopLine });
    return i;
  };
  const link = (a: number, b: number): void => {
    if (a === b) return;
    if (!nodes[a].edges.includes(b)) nodes[a].edges.push(b);
  };

  interface Pt {
    x: number;
    z: number;
    stopLine?: LaneNode['stopLine'];
  }
  // One lane = an ordered list of points in travel order. The
  // consecutive links give the lane; turn edges are added after.
  const lanes: Array<{ pts: Pt[]; heading: number }> = [];
  for (const a of AVENUES) {
    // Northbound: x = a + 2.5, travel z +185 -> -185.
    const nb: Pt[] = [{ x: a + LANE_OFFSET, z: LANE_END }];
    for (let i = 0; i < STREETS.length; i++) {
      const s = STREETS[STREETS.length - 1 - i];
      nb.push({
        x: a + LANE_OFFSET,
        z: s + STOP_DIST,
        stopLine: { cx: a, cz: s, approach: 'avenue', signal: isSignal(a, s) },
      });
      nb.push({ x: a + LANE_OFFSET, z: s - STOP_DIST });
      if (i < STREETS.length - 1) {
        nb.push({ x: a + LANE_OFFSET, z: (s + STREETS[STREETS.length - 2 - i]) / 2 });
      }
    }
    nb.push({ x: a + LANE_OFFSET, z: -LANE_END });
    lanes.push({ pts: nb, heading: Math.PI });
    // Southbound: x = a - 2.5, travel z -185 -> +185.
    const sb: Pt[] = [{ x: a - LANE_OFFSET, z: -LANE_END }];
    for (let i = 0; i < STREETS.length; i++) {
      const s = STREETS[i];
      sb.push({
        x: a - LANE_OFFSET,
        z: s - STOP_DIST,
        stopLine: { cx: a, cz: s, approach: 'avenue', signal: isSignal(a, s) },
      });
      sb.push({ x: a - LANE_OFFSET, z: s + STOP_DIST });
      if (i < STREETS.length - 1) {
        sb.push({ x: a - LANE_OFFSET, z: (s + STREETS[i + 1]) / 2 });
      }
    }
    sb.push({ x: a - LANE_OFFSET, z: LANE_END });
    lanes.push({ pts: sb, heading: 0 });
  }
  for (const s of STREETS) {
    // Eastbound: z = s + 2.5, travel x -185 -> +185.
    const eb: Pt[] = [{ x: -LANE_END, z: s + LANE_OFFSET }];
    for (let i = 0; i < AVENUES.length; i++) {
      const a = AVENUES[i];
      eb.push({
        x: a - STOP_DIST,
        z: s + LANE_OFFSET,
        stopLine: { cx: a, cz: s, approach: 'street', signal: isSignal(a, s) },
      });
      eb.push({ x: a + STOP_DIST, z: s + LANE_OFFSET });
      if (i < AVENUES.length - 1) {
        eb.push({ x: (a + AVENUES[i + 1]) / 2, z: s + LANE_OFFSET });
      }
    }
    eb.push({ x: LANE_END, z: s + LANE_OFFSET });
    lanes.push({ pts: eb, heading: Math.PI / 2 });
    // Westbound: z = s - 2.5, travel x +185 -> -185.
    const wb: Pt[] = [{ x: LANE_END, z: s - LANE_OFFSET }];
    for (let i = 0; i < AVENUES.length; i++) {
      const a = AVENUES[AVENUES.length - 1 - i];
      wb.push({
        x: a + STOP_DIST,
        z: s - LANE_OFFSET,
        stopLine: { cx: a, cz: s, approach: 'street', signal: isSignal(a, s) },
      });
      wb.push({ x: a - STOP_DIST, z: s - LANE_OFFSET });
      if (i < AVENUES.length - 1) {
        wb.push({ x: (a + AVENUES[AVENUES.length - 2 - i]) / 2, z: s - LANE_OFFSET });
      }
    }
    wb.push({ x: -LANE_END, z: s - LANE_OFFSET });
    lanes.push({ pts: wb, heading: -Math.PI / 2 });
  }

  // Consecutive links along each lane.
  for (const lane of lanes) {
    const idxs = lane.pts.map((p) => addNode(p.x, p.z, lane.heading, p.stopLine));
    for (let i = 0; i < idxs.length - 1; i++) link(idxs[i], idxs[i + 1]);
  }
  // U-turns at the city boundary: a lane's end links into the
  // opposite lane's start on the same road.
  const nodeAt = (x: number, z: number): number => byKey.get(`${x},${z}`)!;
  for (const a of AVENUES) {
    link(nodeAt(a + LANE_OFFSET, -LANE_END), nodeAt(a - LANE_OFFSET, -LANE_END));
    link(nodeAt(a - LANE_OFFSET, LANE_END), nodeAt(a + LANE_OFFSET, LANE_END));
  }
  for (const s of STREETS) {
    link(nodeAt(LANE_END, s + LANE_OFFSET), nodeAt(LANE_END, s - LANE_OFFSET));
    link(nodeAt(-LANE_END, s - LANE_OFFSET), nodeAt(-LANE_END, s + LANE_OFFSET));
  }
  // Turn edges at every stop line. The straight edge is already
  // edges[0] from the consecutive links; left and right append
  // after it, so edges = [straight, left, right].
  for (const a of AVENUES) {
    for (const s of STREETS) {
      // Northbound approach.
      link(nodeAt(a + LANE_OFFSET, s + STOP_DIST), nodeAt(a - STOP_DIST, s - LANE_OFFSET)); // left (west)
      link(nodeAt(a + LANE_OFFSET, s + STOP_DIST), nodeAt(a + STOP_DIST, s + LANE_OFFSET)); // right (east)
      // Southbound approach.
      link(nodeAt(a - LANE_OFFSET, s - STOP_DIST), nodeAt(a + STOP_DIST, s + LANE_OFFSET)); // left (east)
      link(nodeAt(a - LANE_OFFSET, s - STOP_DIST), nodeAt(a - STOP_DIST, s - LANE_OFFSET)); // right (west)
      // Eastbound approach.
      link(nodeAt(a - STOP_DIST, s + LANE_OFFSET), nodeAt(a + LANE_OFFSET, s - STOP_DIST)); // left (north)
      link(nodeAt(a - STOP_DIST, s + LANE_OFFSET), nodeAt(a - LANE_OFFSET, s + STOP_DIST)); // right (south)
      // Westbound approach.
      link(nodeAt(a + STOP_DIST, s - LANE_OFFSET), nodeAt(a - LANE_OFFSET, s + STOP_DIST)); // left (south)
      link(nodeAt(a + STOP_DIST, s - LANE_OFFSET), nodeAt(a + LANE_OFFSET, s - STOP_DIST)); // right (north)
    }
  }
  return { nodes };
}

/** A random lane node in a ring around a point, preferring ones outside the camera's forward cone. */
export function randomRingLaneNode(
  graph: LaneGraph,
  rand: () => number,
  x: number,
  z: number,
  minR: number,
  maxR: number,
  camForward?: { x: number; z: number },
): number {
  const ring: number[] = [];
  const behind: number[] = [];
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    const dx = n.x - x;
    const dz = n.z - z;
    const d = Math.hypot(dx, dz);
    if (d < minR || d > maxR) continue;
    ring.push(i);
    if (camForward) {
      const dot = (dx * camForward.x + dz * camForward.z) / (d || 1);
      if (dot < 0.2) behind.push(i);
    }
  }
  const pool = behind.length > 0 ? behind : ring;
  if (pool.length === 0) return randomFarLaneNode(graph, rand, x, z, minR);
  return pool[Math.floor(rand() * pool.length)];
}

/** A random lane node at least `minDist` from a point. */
export function randomFarLaneNode(
  graph: LaneGraph,
  rand: () => number,
  x: number,
  z: number,
  minDist: number,
): number {
  let pick = 0;
  for (let tries = 0; tries < 12; tries++) {
    const i = Math.floor(rand() * graph.nodes.length);
    const n = graph.nodes[i];
    if (Math.hypot(n.x - x, n.z - z) >= minDist) return i;
    pick = i;
  }
  return pick;
}

/** Seeded random for traffic (same city, same traffic, every run). */
export function trafficRandom(): () => number {
  return mulberry32(20261119);
}
