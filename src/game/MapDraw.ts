/**
 * MapDraw — the ONE city renderer both maps use.
 *
 * The minimap and the full-screen map draw the same city from the same
 * deterministic layout (`generateLayout`, the layout the engine builds
 * the 3D city from), on the same north-up coordinate system:
 * u = (x + CITY_HALF) / (2·CITY_HALF) · size, v = (z + CITY_HALF) /
 * (2·CITY_HALF) · size. North (−z) is up, west (−x) is left. Heading h
 * has forward (sin h, cos h) in (x, z), so the up-pointing player
 * arrow is rotated by (π − h).
 *
 * Everything here is parameterised by canvas size: at 360 the output
 * is pixel-identical to the old minimap (radii, font and line widths
 * are defined at 360 and scaled by size / 360). The full map calls the
 * same functions with a larger canvas, so the two maps can never drift
 * apart geographically — a marker at world (22, 52) is at the same
 * relative spot on both.
 */
import {
  CITY_HALF,
  GARAGE_CENTRE,
  ROAD_HALF,
  STORE_CENTRE,
} from './CityGenerator';
import type { CityLayout } from './CityGenerator';

/** Internal canvas resolution of the minimap (CSS scales it down). */
export const MAP_SIZE_MINI = 360;
/** Internal canvas resolution of the full-screen map. */
export const MAP_SIZE_FULL = 760;

/** World → canvas px (north up) for a canvas of the given size. */
export function worldToMap(x: number, z: number, size: number): { u: number; v: number } {
  return {
    u: ((x + CITY_HALF) / (2 * CITY_HALF)) * size,
    v: ((z + CITY_HALF) / (2 * CITY_HALF)) * size,
  };
}

/**
 * The city itself: dark ground, water + beach (east), the real avenue /
 * street grid, the real blocks and parks, the three landmark dots
 * (Beacon Tower gold, Sunset Garage pink, Sunset Mart teal) and the
 * north tick. No player, no mission markers — those are drawn on top
 * by the caller, so the base is identical on both maps.
 */
export function drawCityBase(
  ctx: CanvasRenderingContext2D,
  layout: CityLayout,
  size: number,
): void {
  // Radii / font / line widths are defined at the minimap's 360px and
  // scale up for the full map, so proportions stay the same.
  const k = size / MAP_SIZE_MINI;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(16, 9, 34, 0.88)';
  ctx.fillRect(0, 0, size, size);

  const pxPerUnit = size / (2 * CITY_HALF);
  const roadW = ROAD_HALF * 2 * pxPerUnit;

  // --- Water (east of the ocean wall) + beach sand ---
  const water = worldToMap(layout.waterStartX, 0, size);
  ctx.fillStyle = 'rgba(28, 84, 128, 0.9)';
  ctx.fillRect(water.u, 0, size - water.u, size);
  const beach = worldToMap(layout.beachStartX, 0, size);
  ctx.fillStyle = 'rgba(214, 178, 120, 0.55)';
  ctx.fillRect(beach.u, 0, water.u - beach.u, size);

  // --- Roads: the real avenue / street grid ---
  ctx.fillStyle = 'rgba(255, 243, 226, 0.16)';
  for (const sx of layout.streetsX) {
    const { u } = worldToMap(sx, 0, size);
    ctx.fillRect(u - roadW / 2, 0, roadW, size);
  }
  for (const sz of layout.streetsZ) {
    const { v } = worldToMap(0, sz, size);
    ctx.fillRect(0, v - roadW / 2, size, roadW);
  }

  // --- City blocks (the real blocks the buildings sit on) ---
  ctx.fillStyle = 'rgba(255, 243, 226, 0.10)';
  for (const b of layout.blocks) {
    const a = worldToMap(b.minX, b.minZ, size);
    const c = worldToMap(b.maxX, b.maxZ, size);
    ctx.fillRect(a.u, a.v, c.u - a.u, c.v - a.v);
  }

  // --- Parks (green) ---
  ctx.fillStyle = 'rgba(120, 200, 120, 0.28)';
  for (const p of layout.parks) {
    const a = worldToMap(p.minX, p.minZ, size);
    const c = worldToMap(p.maxX, p.maxZ, size);
    ctx.fillRect(a.u, a.v, c.u - a.u, c.v - a.v);
  }

  // --- Landmarks: Beacon Tower (north), Garage, Sunset Mart ---
  const tower = worldToMap(layout.towerPos.x, layout.towerPos.z, size);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(tower.u, tower.v, 5 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(18, 10, 36, 0.9)';
  ctx.lineWidth = 2 * k;
  ctx.stroke();

  const garage = worldToMap(GARAGE_CENTRE.x, GARAGE_CENTRE.z, size);
  ctx.fillStyle = '#ff5e8a';
  ctx.beginPath();
  ctx.arc(garage.u, garage.v, 3.5 * k, 0, Math.PI * 2);
  ctx.fill();

  const store = worldToMap(STORE_CENTRE.x, STORE_CENTRE.z, size);
  ctx.fillStyle = '#2dd4bf';
  ctx.beginPath();
  ctx.arc(store.u, store.v, 3.5 * k, 0, Math.PI * 2);
  ctx.fill();

  // --- North tick ---
  ctx.fillStyle = 'rgba(255, 243, 226, 0.75)';
  ctx.font = `700 ${Math.round(13 * k)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('N', size / 2, 6 * k);
}

/** Marker tones for the full map (the three base landmarks are already
 *  drawn by drawCityBase; these are the markers drawn on top). */
export type MapMarkerTone =
  | 'range'
  | 'sprint'
  | 'coin'
  | 'coin-found'
  | 'mission-story'
  | 'mission-job';

export interface MapMarker {
  x: number;
  z: number;
  tone: MapMarkerTone;
}

/** One marker, drawn at its real world position. Diamonds mark missions
 *  (teal = story, yellow = job); the range is an amber square, the
 *  sprint a red dot, coins green dots (dimmed once collected). */
export function drawMapMarker(
  ctx: CanvasRenderingContext2D,
  marker: MapMarker,
  size: number,
): void {
  const k = size / MAP_SIZE_MINI;
  const p = worldToMap(marker.x, marker.z, size);
  ctx.save();
  switch (marker.tone) {
    case 'range': {
      ctx.fillStyle = '#ffd27a';
      const s = 7 * k;
      ctx.fillRect(p.u - s / 2, p.v - s / 2, s, s);
      break;
    }
    case 'sprint': {
      ctx.fillStyle = '#ff4d3d';
      ctx.beginPath();
      ctx.arc(p.u, p.v, 4 * k, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'coin': {
      ctx.fillStyle = '#9be15d';
      ctx.beginPath();
      ctx.arc(p.u, p.v, 3.5 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(18, 10, 36, 0.9)';
      ctx.lineWidth = 1.5 * k;
      ctx.stroke();
      break;
    }
    case 'coin-found': {
      ctx.fillStyle = 'rgba(155, 225, 93, 0.35)';
      ctx.beginPath();
      ctx.arc(p.u, p.v, 3 * k, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mission-story':
    case 'mission-job': {
      const r = 7 * k;
      ctx.fillStyle = marker.tone === 'mission-story' ? '#2dd4bf' : '#ffd23e';
      ctx.strokeStyle = 'rgba(18, 10, 36, 0.95)';
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      ctx.moveTo(p.u, p.v - r);
      ctx.lineTo(p.u + r, p.v);
      ctx.lineTo(p.u, p.v + r);
      ctx.lineTo(p.u - r, p.v);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/**
 * The live player arrow (white, dark outline) at the real position,
 * rotated by (π − heading). On the full map a soft ring is drawn
 * around it so the player is unmistakable among the markers.
 */
export function drawPlayerArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  z: number,
  heading: number,
  size: number,
  withRing = false,
): void {
  const k = size / MAP_SIZE_MINI;
  const p = worldToMap(x, z, size);
  if (withRing) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5 * k;
    ctx.beginPath();
    ctx.arc(p.u, p.v, 17 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(p.u, p.v);
  // Up-pointing arrow rotated by (π − heading) — see header.
  ctx.rotate(Math.PI - heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(18, 10, 36, 0.95)';
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(0, -13 * k);
  ctx.lineTo(9 * k, 9 * k);
  ctx.lineTo(0, 4 * k);
  ctx.lineTo(-9 * k, 9 * k);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
