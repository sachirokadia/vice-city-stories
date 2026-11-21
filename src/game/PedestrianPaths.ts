/**
 * The pedestrian path graph: sidewalks, crosswalks, the beach
 * boardwalk and the Beacon Tower plaza, derived from the same
 * street grid as CityGenerator (avenues at x = -120..120, streets
 * at z = -150..150, roads 10 wide, sidewalks 3 wide, so the
 * sidewalk centreline sits 6.5 units off each road centreline).
 *
 * NPCs never leave the graph, so they can never walk through a
 * building or off the map — the graph only runs where feet belong.
 * Crosswalk edges are flagged so NPCs know when they are on the
 * road and can hurry when a car approaches.
 */
import { mulberry32 } from './CityGenerator';

export interface PathNode {
  x: number;
  z: number;
  /** Neighbour node indices. */
  edges: number[];
  /** True when the edge to that neighbour crosses a road. */
  crosswalk: boolean[];
}

export interface PedestrianGraph {
  nodes: PathNode[];
}

export const AVENUES = [-120, -60, 0, 60, 120];
export const STREETS = [-150, -90, -30, 30, 90, 150];
/** Sidewalk centreline offset from a road centreline. */
export const WALK_OFFSET = 6.5;
/** Boardwalk centreline (east of the coastal avenue). */
export const BOARDWALK_X = 133;

export function buildPedestrianGraph(): PedestrianGraph {
  const nodes: PathNode[] = [];
  const indexByKey = new Map<string, number>();
  const addNode = (x: number, z: number): number => {
    const key = `${x},${z}`;
    const existing = indexByKey.get(key);
    if (existing !== undefined) return existing;
    const i = nodes.length;
    indexByKey.set(key, i);
    nodes.push({ x, z, edges: [], crosswalk: [] });
    return i;
  };
  const link = (a: number, b: number, crosswalk: boolean): void => {
    if (a === b) return;
    const ia = nodes[a].edges.indexOf(b);
    if (ia === -1) {
      nodes[a].edges.push(b);
      nodes[a].crosswalk.push(crosswalk);
      nodes[b].edges.push(a);
      nodes[b].crosswalk.push(crosswalk);
      return;
    }
    // The two corner nodes across a road are consecutive on a
    // sidewalk line, so the sidewalk pass already linked them —
    // the crosswalk pass upgrades that edge to a road crossing.
    if (crosswalk) {
      nodes[a].crosswalk[ia] = true;
      nodes[b].crosswalk[nodes[b].edges.indexOf(a)] = true;
    }
  };

  // Corner + mid-block nodes on every sidewalk.
  for (const a of AVENUES) {
    for (const s of STREETS) {
      addNode(a - WALK_OFFSET, s - WALK_OFFSET);
      addNode(a + WALK_OFFSET, s - WALK_OFFSET);
      addNode(a - WALK_OFFSET, s + WALK_OFFSET);
      addNode(a + WALK_OFFSET, s + WALK_OFFSET);
    }
    for (let i = 0; i < STREETS.length - 1; i++) {
      const mid = (STREETS[i] + STREETS[i + 1]) / 2;
      addNode(a - WALK_OFFSET, mid);
      addNode(a + WALK_OFFSET, mid);
    }
  }
  for (const s of STREETS) {
    for (let i = 0; i < AVENUES.length - 1; i++) {
      const mid = (AVENUES[i] + AVENUES[i + 1]) / 2;
      addNode(mid, s - WALK_OFFSET);
      addNode(mid, s + WALK_OFFSET);
    }
  }
  // Boardwalk nodes (one per street + midpoints) and the plaza.
  for (const s of STREETS) addNode(BOARDWALK_X, s);
  for (let i = 0; i < STREETS.length - 1; i++) {
    addNode(BOARDWALK_X, (STREETS[i] + STREETS[i + 1]) / 2);
  }
  addNode(0, -172);

  // Sidewalk edges: consecutive nodes on the same sidewalk line.
  const linkLine = (lineNodes: number[]): void => {
    for (let i = 0; i < lineNodes.length - 1; i++) link(lineNodes[i], lineNodes[i + 1], false);
  };
  for (const a of AVENUES) {
    for (const side of [-WALK_OFFSET, WALK_OFFSET]) {
      const line = nodes
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => n.x === a + side)
        .sort((p, q) => p.n.z - q.n.z)
        .map(({ i }) => i);
      linkLine(line);
    }
  }
  for (const s of STREETS) {
    for (const side of [-WALK_OFFSET, WALK_OFFSET]) {
      const line = nodes
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => n.z === s + side)
        .sort((p, q) => p.n.x - q.n.x)
        .map(({ i }) => i);
      linkLine(line);
    }
  }
  const boardwalk = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.x === BOARDWALK_X)
    .sort((p, q) => p.n.z - q.n.z)
    .map(({ i }) => i);
  linkLine(boardwalk);

  // Crosswalks at every intersection: across each avenue (north
  // and south sides) and across each street (west and east sides).
  for (const a of AVENUES) {
    for (const s of STREETS) {
      const nw = indexByKey.get(`${a - WALK_OFFSET},${s - WALK_OFFSET}`)!;
      const ne = indexByKey.get(`${a + WALK_OFFSET},${s - WALK_OFFSET}`)!;
      const sw = indexByKey.get(`${a - WALK_OFFSET},${s + WALK_OFFSET}`)!;
      const se = indexByKey.get(`${a + WALK_OFFSET},${s + WALK_OFFSET}`)!;
      link(nw, ne, true);
      link(sw, se, true);
      link(nw, sw, true);
      link(ne, se, true);
    }
  }
  // Boardwalk connectors + plaza connectors.
  for (const s of STREETS) {
    const b = indexByKey.get(`${BOARDWALK_X},${s}`)!;
    const w1 = indexByKey.get(`${120 + WALK_OFFSET},${s - WALK_OFFSET}`);
    const w2 = indexByKey.get(`${120 + WALK_OFFSET},${s + WALK_OFFSET}`);
    if (w1 !== undefined) link(b, w1, false);
    if (w2 !== undefined) link(b, w2, false);
  }
  const plaza = indexByKey.get('0,-172')!;
  link(plaza, indexByKey.get(`${-WALK_OFFSET},-156.5`)!, false);
  link(plaza, indexByKey.get(`${WALK_OFFSET},-156.5`)!, false);

  return { nodes };
}

/** Nearest node to a point (linear scan — the graph is small). */
export function nearestNode(graph: PedestrianGraph, x: number, z: number): number {
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
}

/** A random node at least `minDist` from a point (tries a few). */
export function randomFarNode(
  graph: PedestrianGraph,
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

/**
 * A random node in a ring around a point, preferring ones outside
 * the camera's forward cone (so respawns happen behind the player
 * when possible). Falls back to any ring node.
 */
export function randomRingNode(
  graph: PedestrianGraph,
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
  if (pool.length === 0) return randomFarNode(graph, rand, x, z, minR);
  return pool[Math.floor(rand() * pool.length)];
}

/** Seeded random for the crowd (same city, same crowd, every run). */
export function crowdRandom(): () => number {
  return mulberry32(20261119);
}
