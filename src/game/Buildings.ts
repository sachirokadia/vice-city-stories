import * as THREE from 'three';
import type { BuildingBox } from './World';

export type Track = <T extends { dispose(): void }>(resource: T) => T;

/** The Beacon Tower: blue cylinder, neon rings, glowing beacon. */
export function buildBeaconTower(
  group: THREE.Group,
  x: number,
  z: number,
  track: Track,
): BuildingBox {
  const mat = track(new THREE.MeshStandardMaterial({ color: 0x2b6cb0, roughness: 0.5, metalness: 0.3 }));
  const tower = new THREE.Mesh(track(new THREE.CylinderGeometry(5, 7, 52, 16)), mat);
  tower.position.set(x, 26, z);
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const ringMat = track(
    new THREE.MeshStandardMaterial({ color: 0xff5fa2, emissive: 0xff2e88, emissiveIntensity: 1.4 }),
  );
  for (const y of [14, 30, 46]) {
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(6.2, 0.35, 8, 32)), ringMat);
    ring.position.set(x, y, z);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }
  const beacon = new THREE.Mesh(
    track(new THREE.SphereGeometry(2, 16, 12)),
    track(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd27a, emissiveIntensity: 3 })),
  );
  beacon.position.set(x, 54, z);
  group.add(beacon);
  return { minX: x - 8, maxX: x + 8, minZ: z - 8, maxZ: z + 8, maxY: 54 };
}
