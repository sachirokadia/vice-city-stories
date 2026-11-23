/**
 * Street props: trash bins, bus-stop shelters, utility poles and low
 * park hedges. All repeated things are InstancedMeshes or one merged
 * batch — a handful of draw calls for the whole set.
 *
 * Placement rules (so props never fight gameplay):
 * - Everything sits on sidewalks or block corners, never in a lane,
 *   a crosswalk, the spawn plaza, or a garage/store entrance.
 * - Props have no collision box (like palms and lamps): the game's
 *   collision is buildings-only, and these are all at the sidewalk
 *   edge, out of the main walking line.
 */
import * as THREE from 'three';
import type { QualitySettings } from './Quality';
import type { CityLayout } from './CityGenerator';
import { CITY_HALF } from './CityGenerator';
import type { Track } from './Buildings';
import { GeometryBatch, composeMatrix } from './Merge';

export function buildStreetProps(
  group: THREE.Group,
  layout: CityLayout,
  quality: QualitySettings,
  track: Track,
): void {
  const dummy = new THREE.Object3D();
  const detailed = quality.tier !== 'low';
  const nearSpawn = (x: number, z: number): boolean => Math.hypot(x, z - 8) < 16;
  const nearEntrance = (x: number, z: number): boolean =>
    Math.hypot(x - 22, z - 40) < 6 || Math.hypot(x - 43, z - 24) < 6;

  // --- Trash bins (instanced cylinders, sidewalk edge) -----------------
  const binXf: THREE.Matrix4[] = [];
  for (const sx of layout.streetsX) {
    for (let z = -CITY_HALF + 18; z < CITY_HALF; z += 40) {
      for (const side of [-7.5, 7.5]) {
        const x = sx + side;
        if (nearSpawn(x, z) || nearEntrance(x, z) || z < -158) continue;
        dummy.position.set(x, 0.45, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        binXf.push(dummy.matrix.clone());
      }
    }
  }
  if (binXf.length > 0) {
    const bins = new THREE.InstancedMesh(
      track(new THREE.CylinderGeometry(0.32, 0.28, 0.9, 8)),
      track(new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 0.85, metalness: 0.2 })),
      binXf.length,
    );
    binXf.forEach((m, i) => bins.setMatrixAt(i, m));
    bins.castShadow = true;
    group.add(bins);
  }

  // --- Bus-stop shelters (4 intersections, merged frame + roof) -------
  // One shelter per corner: two posts, a roof slab, a bench and a sign
  // pole. The frame and roof are single merged meshes (2 draw calls).
  const shelterSpots: Array<[number, number, number]> = [
    [0, -30, Math.PI],
    [0, 30, 0],
    [60, -30, Math.PI / 2],
    [-60, 30, -Math.PI / 2],
  ];
  const frameBatch = new GeometryBatch();
  const roofBatch = new GeometryBatch();
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  const benchBatch = new GeometryBatch();
  for (const [ix, iz, ry] of shelterSpots) {
    // Corner of the block, 1 m inside the pad edge.
    const cx = ix + 9 * Math.cos(ry);
    const cz = iz + 9 * Math.sin(ry);
    // Posts (two) + roof + bench, oriented to face the street.
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    // Local +x runs along the shelter front; rotate the offsets.
    const along = (d: number): [number, number] => [cx + cos * d, cz + sin * d];
    const [p1x, p1z] = along(-1.4);
    const [p2x, p2z] = along(1.4);
    frameBatch.add(unitBox, composeMatrix(p1x, 1.2, p1z, 0, 0.14, 2.4, 0.14));
    frameBatch.add(unitBox, composeMatrix(p2x, 1.2, p2z, 0, 0.14, 2.4, 0.14));
    roofBatch.add(unitBox, composeMatrix(cx, 2.55, cz, ry, 3.4, 0.14, 1.5));
    benchBatch.add(unitBox, composeMatrix(cx, 0.45, cz, ry, 2.6, 0.18, 0.55));
    benchBatch.add(unitBox, composeMatrix(cx, 0.22, cz, ry, 0.14, 0.45, 0.5));
  }
  const frameMat = track(new THREE.MeshStandardMaterial({ color: 0x2e2e36, roughness: 0.6, metalness: 0.5 }));
  const roofMat = track(new THREE.MeshStandardMaterial({ color: 0x274b6d, roughness: 0.7 }));
  const benchMat = track(new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }));
  for (const [batch, mat] of [
    [frameBatch, frameMat],
    [roofBatch, roofMat],
    [benchBatch, benchMat],
  ] as const) {
    const geo = batch.build();
    if (!geo) continue;
    const mesh = new THREE.Mesh(track(geo), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // --- Utility poles (residential streets, instanced) ------------------
  if (detailed) {
    const poleXf: THREE.Matrix4[] = [];
    const armXf: THREE.Matrix4[] = [];
    for (let x = -CITY_HALF + 16; x < CITY_HALF; x += 30) {
      const z = 90 + (Math.floor(x / 30) % 2 === 0 ? -7.5 : 7.5);
      if (nearSpawn(x, z)) continue;
      dummy.position.set(x, 3.4, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleXf.push(dummy.matrix.clone());
      dummy.position.set(x, 6.4, z);
      dummy.updateMatrix();
      armXf.push(dummy.matrix.clone());
    }
    for (let z = -CITY_HALF + 16; z < CITY_HALF; z += 30) {
      const x = -120 + (Math.floor(z / 30) % 2 === 0 ? -7.5 : 7.5);
      dummy.position.set(x, 3.4, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleXf.push(dummy.matrix.clone());
      dummy.position.set(x, 6.4, z);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      armXf.push(dummy.matrix.clone());
    }
    if (poleXf.length > 0) {
      const poles = new THREE.InstancedMesh(
        track(new THREE.CylinderGeometry(0.09, 0.12, 6.8, 6)),
        track(new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.95 })),
        poleXf.length,
      );
      poleXf.forEach((m, i) => poles.setMatrixAt(i, m));
      poles.castShadow = true;
      group.add(poles);
      const arms = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(2.2, 0.12, 0.12)),
        track(new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.95 })),
        armXf.length,
      );
      armXf.forEach((m, i) => arms.setMatrixAt(i, m));
      group.add(arms);
    }
  }

  // --- Park hedges: low borders with a gap on each side for entry -----
  // WS5: the 0.5 m WS4 hedges read as dark patches in the grass, so
  // they are now 0.9 m tall and 0.7 m thick in a lighter green, with
  // a clipped-top trim strip in a still lighter green — a deliberate
  // landscaped edge, not a wall. The gaps sit mid-side so the
  // collectibles inside stay reachable.
  const hedgeMat = track(new THREE.MeshStandardMaterial({ color: 0x3e7a37, roughness: 1 }));
  const hedgeTrimMat = track(new THREE.MeshStandardMaterial({ color: 0x7fb84e, roughness: 1 }));
  const hedgeBatch = new GeometryBatch();
  const hedgeTrimBatch = new GeometryBatch();
  for (const park of layout.parks) {
    const w = park.maxX - park.minX;
    const d = park.maxZ - park.minZ;
    const gap = 8; // entry gap, centred on each side
    const seg = (w - gap) / 2;
    // North + south edges (along x), with a centre gap.
    hedgeBatch.add(unitBox, composeMatrix(park.minX + seg / 2, 0.45, park.minZ, 0, seg, 0.9, 0.7));
    hedgeBatch.add(unitBox, composeMatrix(park.maxX - seg / 2, 0.45, park.minZ, 0, seg, 0.9, 0.7));
    hedgeBatch.add(unitBox, composeMatrix(park.minX + seg / 2, 0.45, park.maxZ, 0, seg, 0.9, 0.7));
    hedgeBatch.add(unitBox, composeMatrix(park.maxX - seg / 2, 0.45, park.maxZ, 0, seg, 0.9, 0.7));
    hedgeTrimBatch.add(unitBox, composeMatrix(park.minX + seg / 2, 0.94, park.minZ, 0, seg, 0.14, 0.74));
    hedgeTrimBatch.add(unitBox, composeMatrix(park.maxX - seg / 2, 0.94, park.minZ, 0, seg, 0.14, 0.74));
    hedgeTrimBatch.add(unitBox, composeMatrix(park.minX + seg / 2, 0.94, park.maxZ, 0, seg, 0.14, 0.74));
    hedgeTrimBatch.add(unitBox, composeMatrix(park.maxX - seg / 2, 0.94, park.maxZ, 0, seg, 0.14, 0.74));
    // East + west edges (along z), with a centre gap.
    const segZ = (d - gap) / 2;
    hedgeBatch.add(unitBox, composeMatrix(park.minX, 0.45, park.minZ + segZ / 2, 0, 0.7, 0.9, segZ));
    hedgeBatch.add(unitBox, composeMatrix(park.minX, 0.45, park.maxZ - segZ / 2, 0, 0.7, 0.9, segZ));
    hedgeBatch.add(unitBox, composeMatrix(park.maxX, 0.45, park.minZ + segZ / 2, 0, 0.7, 0.9, segZ));
    hedgeBatch.add(unitBox, composeMatrix(park.maxX, 0.45, park.maxZ - segZ / 2, 0, 0.7, 0.9, segZ));
    hedgeTrimBatch.add(unitBox, composeMatrix(park.minX, 0.94, park.minZ + segZ / 2, 0, 0.74, 0.14, segZ));
    hedgeTrimBatch.add(unitBox, composeMatrix(park.minX, 0.94, park.maxZ - segZ / 2, 0, 0.74, 0.14, segZ));
    hedgeTrimBatch.add(unitBox, composeMatrix(park.maxX, 0.94, park.minZ + segZ / 2, 0, 0.74, 0.14, segZ));
    hedgeTrimBatch.add(unitBox, composeMatrix(park.maxX, 0.94, park.maxZ - segZ / 2, 0, 0.74, 0.14, segZ));
  }
  const hedgeGeo = hedgeBatch.build();
  if (hedgeGeo) {
    const hedges = new THREE.Mesh(track(hedgeGeo), hedgeMat);
    hedges.castShadow = true;
    hedges.receiveShadow = true;
    group.add(hedges);
  }
  const hedgeTrimGeo = hedgeTrimBatch.build();
  if (hedgeTrimGeo) {
    const hedgeTrim = new THREE.Mesh(track(hedgeTrimGeo), hedgeTrimMat);
    hedgeTrim.receiveShadow = true;
    group.add(hedgeTrim);
  }
}
