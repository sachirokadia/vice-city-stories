/**
 * City layout: one coherent street grid, split into districts.
 * Everything is deterministic (seeded) so the city looks the same
 * every run, and the layout is data — the builders in Buildings.ts,
 * Roads.ts, Vegetation.ts and Environment.ts only draw what it says.
 *
 * Map (x east, z south, units are metres-ish):
 *   - North-south avenues at x = -120, -60, 0, 60, 120
 *   - East-west streets at z = -150, -90, -30, 30, 90, 150
 *   - Roads are 10 wide with 3-wide sidewalks; blocks sit 8 units
 *     back from each street centreline.
 *   - Beach: sand x 138..196, ocean from x 196 east. Promenade
 *     boardwalk x 128..138. The x = 0 avenue runs from the spawn
 *     plaza south straight up to the Beacon Tower plaza in the north.
 */
import { overlapsCoastalLot } from './CoastalDistrictLayout';

export type District = 'downtown' | 'commercial' | 'residential' | 'coastal' | 'industrial' | 'park';

export interface Block {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
  district: District;
}

export type Face = 'north' | 'south' | 'east' | 'west';

export interface Plot {
  /** Building centre. */
  x: number;
  z: number;
  /** Footprint. */
  w: number;
  d: number;
  /** Height. */
  h: number;
  district: District;
  /** The side that faces its nearest street (storefronts/balconies). */
  face: Face;
}

export interface CityLayout {
  streetsX: number[];
  streetsZ: number[];
  blocks: Block[];
  parks: Block[];
  plots: Plot[];
  /** Northern plaza holding the Beacon Tower (x, z). */
  towerPos: { x: number; z: number };
  /** Where the sand starts (east edge) and where the water starts. */
  beachStartX: number;
  waterStartX: number;
}

export const ROAD_HALF = 5;
export const SIDEWALK = 3;
export const BLOCK_INSET = ROAD_HALF + SIDEWALK; // 8
export const CITY_HALF = 190;

/**
 * The Sunset Garage — the one physical garage in the city, on the
 * residential block south-east of the spawn plaza (avenue x = 0 to
 * x = 60, street z = 30 to z = 90). The building fronts the z = 30
 * street: the roller door faces north, the entrance marker sits on
 * the apron in front of it, and the parking bay is on the street
 * itself so a selected car can be driven straight away.
 */
export const GARAGE_FOOTPRINT = { minX: 12, maxX: 32, minZ: 45, maxZ: 59 };
export const GARAGE_CENTRE = { x: 22, z: 52 };
export const GARAGE_HEIGHT = 7;
export const GARAGE_ENTRANCE = { x: 22, z: 40 };
export const GARAGE_PARKING = { x: 22, z: 30, heading: Math.PI / 2 };

/**
 * Sunset Mart — the one convenience store, on the commercial block
 * north-east of the spawn plaza (avenue x = 0 to x = 60, street
 * z = -30 to z = 30). The building fronts the z = 30 street: the
 * glass door faces south, the entrance marker sits on the sidewalk
 * in front of it, and the player walks in through the E prompt.
 */
export const STORE_FOOTPRINT = { minX: 34, maxX: 52, minZ: 8, maxZ: 22 };
export const STORE_CENTRE = { x: 43, z: 15 };
export const STORE_HEIGHT = 6;
export const STORE_ENTRANCE = { x: 43, z: 24 };

/** Deterministic pseudo-random so the city looks the same every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function districtFor(cx: number, cz: number): District {
  // Two park blocks, fixed so they are easy to find.
  if (cx > -120 && cx < -60 && cz > 30 && cz < 90) return 'park';
  if (cx > 60 && cx < 120 && cz > -90 && cz < -30) return 'park';
  if (cz < -90) return 'downtown';
  if (cx >= 60 && cz < 90) return 'coastal';
  if (cz < 30) return 'commercial';
  if (cx < -60 && cz > 90) return 'industrial';
  return 'residential';
}

function heightFor(district: District, rand: () => number): number {
  switch (district) {
    case 'downtown':
      return 26 + rand() * 38; // skyscrapers; a few push past 60
    case 'coastal':
      return 13 + rand() * 15; // beachfront hotels
    case 'commercial':
      return 9 + rand() * 13;
    case 'residential':
      return 6 + rand() * 7;
    case 'industrial':
      return 6 + rand() * 3;
    default:
      return 8;
  }
}

/** Which side of a plot faces its nearest street. */
function faceFor(x: number, z: number, streetsX: number[], streetsZ: number[]): Face {
  let best = Infinity;
  let face: Face = 'south';
  for (const sx of streetsX) {
    const d = Math.abs(x - sx);
    if (d < best) {
      best = d;
      face = x < sx ? 'east' : 'west';
    }
  }
  for (const sz of streetsZ) {
    const d = Math.abs(z - sz);
    if (d < best) {
      best = d;
      face = z < sz ? 'south' : 'north';
    }
  }
  return face;
}

export function generateLayout(): CityLayout {
  const rand = mulberry32(20261119);
  const streetsX = [-120, -60, 0, 60, 120];
  const streetsZ = [-150, -90, -30, 30, 90, 150];
  const blocks: Block[] = [];

  // Blocks between neighbouring streets, plus the edge strips out to
  // the city boundary (where the tower plaza and beach sit).
  const xs = [-CITY_HALF, ...streetsX, CITY_HALF];
  const zs = [-CITY_HALF, ...streetsZ, CITY_HALF];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const minX = xs[i] + (i === 0 ? 0 : BLOCK_INSET);
      const maxX = xs[i + 1] - (i + 1 === xs.length - 1 ? 0 : BLOCK_INSET);
      const minZ = zs[j] + (j === 0 ? 0 : BLOCK_INSET);
      const maxZ = zs[j + 1] - (j + 1 === zs.length - 1 ? 0 : BLOCK_INSET);
      if (maxX - minX < 12 || maxZ - minZ < 12) continue;
      // The easternmost strip is beach/promenade, not buildings.
      if (minX >= 128) continue;
      // The northern edge strip holds the tower plaza, not buildings.
      if (maxZ <= -158) continue;
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      blocks.push({ minX, maxX, minZ, maxZ, cx, cz, district: districtFor(cx, cz) });
    }
  }

  const parks = blocks.filter((b) => b.district === 'park');
  const plots: Plot[] = [];
  const order: Record<District, number> = { downtown: 0, coastal: 1, commercial: 2, residential: 3, industrial: 3, park: 4 };
  const developed = blocks.filter(b => b.district !== 'park').sort((a, b) => order[a.district] - order[b.district]);
  for (const block of developed) {
    const bw = block.maxX - block.minX;
    const bd = block.maxZ - block.minZ;
    // Downtown keeps one big tower per block; every other district
    // splits a block into up to four smaller buildings, so the streets
    // feel built-up instead of one slab on a bare concrete pad.
    const perSide = block.district === 'downtown' ? 1 : 2;
    const cols = bw > 26 ? perSide : 1;
    const rows = bd > 26 ? perSide : 1;
    const gap = 4;
    const pw = (bw - gap * (cols + 1)) / cols;
    const pd = (bd - gap * (rows + 1)) / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // Vary the footprint a little so no two buildings match.
        const w = pw * (0.72 + rand() * 0.26);
        const d = pd * (0.72 + rand() * 0.26);
        const x = block.minX + gap + pw / 2 + c * (pw + gap) + (rand() - 0.5) * 2;
        const z = block.minZ + gap + pd / 2 + r * (pd + gap) + (rand() - 0.5) * 2;
        plots.push({
          x,
          z,
          w,
          d,
          h: heightFor(block.district, rand),
          district: block.district,
          face: faceFor(x, z, streetsX, streetsZ),
        });
      }
    }
  }

  // The garage takes its own plot: no generated building may
  // overlap its footprint (with a 2-unit margin), so the garage
  // is never hidden inside another building at any quality tier.
  const garageClear = (p: Plot): boolean =>
    p.x + p.w / 2 < GARAGE_FOOTPRINT.minX - 2 ||
    p.x - p.w / 2 > GARAGE_FOOTPRINT.maxX + 2 ||
    p.z + p.d / 2 < GARAGE_FOOTPRINT.minZ - 2 ||
    p.z - p.d / 2 > GARAGE_FOOTPRINT.maxZ + 2;
  // The store takes its own plot too, for the same reason.
  const storeClear = (p: Plot): boolean =>
    p.x + p.w / 2 < STORE_FOOTPRINT.minX - 2 ||
    p.x - p.w / 2 > STORE_FOOTPRINT.maxX + 2 ||
    p.z + p.d / 2 < STORE_FOOTPRINT.minZ - 2 ||
    p.z - p.d / 2 > STORE_FOOTPRINT.maxZ + 2;
  const keptPlots = plots.filter((p) => {
    const podium = p.district === 'downtown' ? 1.1 : 1;
    return garageClear(p) && storeClear(p) && !overlapsCoastalLot(p.x, p.z, p.w * podium, p.d * podium);
  });

  return {
    streetsX,
    streetsZ,
    blocks,
    parks,
    plots: keptPlots,
    towerPos: { x: 0, z: -172 },
    beachStartX: 138,
    waterStartX: 196,
  };
}
