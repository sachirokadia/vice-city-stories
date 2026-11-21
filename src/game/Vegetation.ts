/**
 * Vegetation and street furniture: palms along the promenade and
 * avenues, trees and benches in the parks, beach umbrellas.
 * Everything repeated is an InstancedMesh.
 */
import * as THREE from 'three';
import type { QualitySettings } from './Quality';
import type { CityLayout } from './CityGenerator';
import { CITY_HALF, mulberry32 } from './CityGenerator';
import type { Track } from './Buildings';

export function buildVegetation(
  group: THREE.Group,
  layout: CityLayout,
  quality: QualitySettings,
  track: Track,
): void {
  const rand = mulberry32(777);
  const dummy = new THREE.Object3D();
  const setInst = (inst: THREE.InstancedMesh, xf: THREE.Matrix4[]) => {
    xf.forEach((m, i) => inst.setMatrixAt(i, m));
    group.add(inst);
  };

  // --- Palms: promenade row + avenue rows (capped by quality) ---------
  const palmXf: THREE.Matrix4[] = [];
  for (let z = -CITY_HALF + 10; z < CITY_HALF; z += 14) {
    dummy.position.set(134.5, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    palmXf.push(dummy.matrix.clone());
  }
  const avenuePalms: THREE.Matrix4[] = [];
  for (const sx of layout.streetsX) {
    for (let z = -CITY_HALF + 20; z < CITY_HALF; z += 36) {
      // Keep the spawn plaza clear — a palm next to spawn hangs its
      // leaves straight over the opening camera shot.
      if (Math.hypot(sx + 8.6, z - 8) < 16) continue;
      dummy.position.set(sx + 8.6, 0, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      avenuePalms.push(dummy.matrix.clone());
    }
  }
  // Shuffle the avenue palms deterministically and take the budget.
  for (let i = avenuePalms.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [avenuePalms[i], avenuePalms[j]] = [avenuePalms[j], avenuePalms[i]];
  }
  palmXf.push(...avenuePalms.slice(0, Math.max(0, quality.palmCount)));

  if (palmXf.length > 0) {
    const trunkGeo = track(new THREE.CylinderGeometry(0.16, 0.24, 4.6, 6));
    const trunkMat = track(new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 }));
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmXf.length);
    palmXf.forEach((m, i) => {
      const p = new THREE.Matrix4().copy(m);
      p.setPosition(new THREE.Vector3(m.elements[12], 2.3, m.elements[14]));
      trunks.setMatrixAt(i, p);
    });
    trunks.castShadow = true;
    group.add(trunks);
    const leafGeo = track(new THREE.ConeGeometry(2.1, 2.8, 7));
    const leafMat = track(new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.85 }));
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, palmXf.length);
    palmXf.forEach((m, i) => {
      const p = new THREE.Matrix4().copy(m);
      p.setPosition(new THREE.Vector3(m.elements[12], 5.4, m.elements[14]));
      leaves.setMatrixAt(i, p);
    });
    leaves.castShadow = true;
    group.add(leaves);
  }

  // --- Parks: grass, trees, benches ------------------------------------
  const grassMat = track(new THREE.MeshStandardMaterial({ color: 0x4a8f4a, roughness: 1 }));
  const treeTrunkXf: THREE.Matrix4[] = [];
  const treeTopXf: THREE.Matrix4[] = [];
  const benchXf: THREE.Matrix4[] = [];
  for (const park of layout.parks) {
    const grass = new THREE.Mesh(
      track(new THREE.PlaneGeometry(park.maxX - park.minX, park.maxZ - park.minZ)),
      grassMat,
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(park.cx, 0.025, park.cz);
    grass.receiveShadow = true;
    group.add(grass);
    const prand = mulberry32(1000 + Math.floor(park.cx * 10 + park.cz));
    for (let i = 0; i < 9; i++) {
      const x = park.minX + 6 + prand() * (park.maxX - park.minX - 12);
      const z = park.minZ + 6 + prand() * (park.maxZ - park.minZ - 12);
      dummy.position.set(x, 1.4, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      treeTrunkXf.push(dummy.matrix.clone());
      dummy.position.set(x, 3.4, z);
      dummy.updateMatrix();
      treeTopXf.push(dummy.matrix.clone());
    }
    for (let i = 0; i < 4; i++) {
      dummy.position.set(park.cx - 8 + i * 5, 0.45, park.cz + 8);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      benchXf.push(dummy.matrix.clone());
    }
  }
  if (treeTrunkXf.length > 0) {
    const trunks = new THREE.InstancedMesh(
      track(new THREE.CylinderGeometry(0.2, 0.3, 2.8, 6)),
      track(new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 })),
      treeTrunkXf.length,
    );
    setInst(trunks, treeTrunkXf);
    trunks.castShadow = true;
    const tops = new THREE.InstancedMesh(
      track(new THREE.IcosahedronGeometry(2.2, 0)),
      track(new THREE.MeshStandardMaterial({ color: 0x3f8f3f, roughness: 0.9 })),
      treeTopXf.length,
    );
    setInst(tops, treeTopXf);
    tops.castShadow = true;
  }
  if (benchXf.length > 0) {
    const benches = new THREE.InstancedMesh(
      track(new THREE.BoxGeometry(2.2, 0.9, 0.7)),
      track(new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 })),
      benchXf.length,
    );
    setInst(benches, benchXf);
    benches.castShadow = true;
  }

  // --- Beach umbrellas (instanced, coloured canopies) -------------------
  const umbrellaCount = quality.tier === 'low' ? 8 : 16;
  const poleXf: THREE.Matrix4[] = [];
  const canopyXf: THREE.Matrix4[] = [];
  const colors = [0xff6b6b, 0x35c4ff, 0xffd166, 0xff6ec7, 0x2ec4b6];
  for (let i = 0; i < umbrellaCount; i++) {
    const x = layout.beachStartX + 6 + rand() * 42;
    const z = -CITY_HALF + 20 + rand() * (CITY_HALF * 2 - 40);
    dummy.position.set(x, 1.1, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleXf.push(dummy.matrix.clone());
    dummy.position.set(x, 2.4, z);
    dummy.updateMatrix();
    canopyXf.push(dummy.matrix.clone());
  }
  if (poleXf.length > 0) {
    const poles = new THREE.InstancedMesh(
      track(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6)),
      track(new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.7 })),
      poleXf.length,
    );
    setInst(poles, poleXf);
    const canopies = new THREE.InstancedMesh(
      track(new THREE.ConeGeometry(2.2, 0.9, 10)),
      track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })),
      canopyXf.length,
    );
    canopyXf.forEach((m, i) => {
      canopies.setMatrixAt(i, m);
      canopies.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    });
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    canopies.castShadow = true;
    group.add(canopies);
  }
}
