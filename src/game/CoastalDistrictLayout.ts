import type { BuildingBox } from './World';

/** Detailed buildings front the west sidewalk of the existing coastal avenue. */
export const COASTAL_BUILDINGS = [
  { id: 'ocean-view-v2', name: 'Ocean View Apartments', x: 105, z: -120, width: 24, depth: 14, height: 21.34 },
  { id: 'harbor-exchange-v2', name: 'Harbor Exchange', x: 105, z: 0, width: 18, depth: 14, height: 33.83 },
  { id: 'sunset-market-v2', name: 'Sunset Corner Market', x: 106.5, z: 60, width: 18, depth: 11, height: 11.99 },
  { id: 'marina-house-v2', name: 'Marina House', x: 105, z: 120, width: 20, depth: 14, height: 18.19 },
] as const;

export const OCEAN_DRIVE_ENTRY = { x: 114.5, z: 78 };
export const OCEAN_DRIVE_PARKING = { x: 117.5, z: 78, heading: 0 };

export function coastalCollisionBoxes(): BuildingBox[] {
  return COASTAL_BUILDINGS.map(b => ({
    minX: b.x - b.depth / 2 - .2, maxX: b.x + b.depth / 2 + .2,
    minZ: b.z - b.width / 2 - .2, maxZ: b.z + b.width / 2 + .2, maxY: b.height,
  }));
}

export function overlapsCoastalLot(x: number, z: number, width: number, depth: number): boolean {
  return coastalCollisionBoxes().some(b =>
    x + width / 2 > b.minX - 1 && x - width / 2 < b.maxX + 1 &&
    z + depth / 2 > b.minZ - 1 && z - depth / 2 < b.maxZ + 1,
  );
}
