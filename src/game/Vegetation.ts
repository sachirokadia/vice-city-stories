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
  // WS4: no two palms match now. Each palm gets its own height
  // (0.8–1.3x), a slight lean, a random yaw and — for a minority — a
  // short bushy variant. The trunk/leaf offsets are applied in the
  // palm's local space (after scale + lean), so the crown stays on
  // top of its own trunk.
  const palmBase: THREE.Matrix4[] = [];
  const shortPalmBase: THREE.Matrix4[] = [];
  const palmMatrix = (x: number, z: number, s: number): THREE.Matrix4 => {
    dummy.position.set(x, 0, z);
    // Lean up to ~4 degrees, yaw anywhere.
    dummy.rotation.set((rand() - 0.5) * 0.14, rand() * Math.PI * 2, (rand() - 0.5) * 0.14);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  };
  for (let z = -CITY_HALF + 10; z < CITY_HALF; z += 14) {
    // Promenade palms run tallest (the beachfront row).
    palmBase.push(palmMatrix(134.5, z, 1.05 + rand() * 0.25));
  }
  const avenuePalms: THREE.Matrix4[] = [];
  for (const sx of layout.streetsX) {
    for (let z = -CITY_HALF + 20; z < CITY_HALF; z += 36) {
      // Keep the spawn plaza clear — a palm next to spawn hangs its
      // leaves straight over the opening camera shot.
      if (Math.hypot(sx + 8.6, z - 8) < 16) continue;
      avenuePalms.push(palmMatrix(sx + 8.6, z, 0.8 + rand() * 0.45));
    }
  }
  // Shuffle the avenue palms deterministically and take the budget.
  for (let i = avenuePalms.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [avenuePalms[i], avenuePalms[j]] = [avenuePalms[j], avenuePalms[i]];
  }
  const keptAvenue = avenuePalms.slice(0, Math.max(0, quality.palmCount));
  // One in five kept avenue palms is the short bushy variant.
  for (const m of keptAvenue) {
    (rand() < 0.2 ? shortPalmBase : palmBase).push(m);
  }
  const palmXf = palmBase;
  const up = (m: THREE.Matrix4, y: number): THREE.Matrix4 =>
    m.clone().multiply(new THREE.Matrix4().makeTranslation(0, y, 0));
  // WS5 — crown-width variety: each palm's crown gets its own
  // horizontal spread (0.85–1.2x), so silhouettes differ even between
  // palms of the same height. A dedicated seeded RNG keeps the main
  // rand() sequence (and every other placement) untouched.
  const crownRand = mulberry32(20261123);
  const leafUp = (m: THREE.Matrix4, y: number): THREE.Matrix4 => {
    const w = 0.85 + crownRand() * 0.35;
    return up(m, y).multiply(new THREE.Matrix4().makeScale(w, 1, w));
  };

  if (palmXf.length > 0) {
    const trunkGeo = track(new THREE.CylinderGeometry(0.16, 0.24, 4.6, 6));
    const trunkMat = track(new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 }));
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmXf.length);
    palmXf.forEach((m, i) => trunks.setMatrixAt(i, up(m, 2.3)));
    trunks.castShadow = true;
    group.add(trunks);
    const leafGeo = track(new THREE.ConeGeometry(2.1, 2.8, 7));
    const leafMat = track(new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.85 }));
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, palmXf.length);
    palmXf.forEach((m, i) => leaves.setMatrixAt(i, leafUp(m, 5.4)));
    leaves.castShadow = true;
    group.add(leaves);
  }
  if (shortPalmBase.length > 0) {
    // Short bushy palms: squatter trunk, wider crown.
    const trunkGeo = track(new THREE.CylinderGeometry(0.14, 0.22, 3.0, 6));
    const trunkMat = track(new THREE.MeshStandardMaterial({ color: 0x7d6244, roughness: 0.9 }));
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, shortPalmBase.length);
    shortPalmBase.forEach((m, i) => trunks.setMatrixAt(i, up(m, 1.5)));
    trunks.castShadow = true;
    group.add(trunks);
    const leafGeo = track(new THREE.ConeGeometry(2.5, 2.2, 7));
    const leafMat = track(new THREE.MeshStandardMaterial({ color: 0x37935f, roughness: 0.85 }));
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, shortPalmBase.length);
    shortPalmBase.forEach((m, i) => leaves.setMatrixAt(i, leafUp(m, 3.4)));
    leaves.castShadow = true;
    group.add(leaves);
  }

  // --- Sidewalk shrubs: low planters along the avenues ----------------
  // One merged instanced set, placed on the sidewalk edge opposite the
  // palm rows so they never block a lane or a doorway. WS5: taller
  // and a lighter green, so they read as shrubs instead of dark
  // sidewalk stains.
  const shrubXf: THREE.Matrix4[] = [];
  for (const sx of layout.streetsX) {
    for (let z = -CITY_HALF + 26; z < CITY_HALF; z += 24) {
      if (Math.hypot(sx - 8.6, z - 8) < 14) continue; // spawn plaza clear
      dummy.position.set(sx - 8.6, 0.42, z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(0.9 + rand() * 0.5, 0.7 + rand() * 0.3, 0.9 + rand() * 0.5);
      dummy.updateMatrix();
      shrubXf.push(dummy.matrix.clone());
    }
  }
  if (shrubXf.length > 0) {
    const shrubs = new THREE.InstancedMesh(
      track(new THREE.IcosahedronGeometry(0.9, 0)),
      track(new THREE.MeshStandardMaterial({ color: 0x46a04e, roughness: 0.95 })),
      shrubXf.length,
    );
    setInst(shrubs, shrubXf);
    shrubs.castShadow = true;
  }

  // --- Beach dune grass: thin tufts scattered across the sand ---------
  const grassXf: THREE.Matrix4[] = [];
  const duneRand = mulberry32(4242);
  for (let i = 0; i < 90; i++) {
    const x = layout.beachStartX + 2 + duneRand() * 48;
    const z = -CITY_HALF + 12 + duneRand() * (CITY_HALF * 2 - 24);
    dummy.position.set(x, 0.5, z);
    dummy.rotation.set((duneRand() - 0.5) * 0.5, duneRand() * Math.PI, (duneRand() - 0.5) * 0.5);
    dummy.scale.set(0.7 + duneRand() * 0.9, 0.8 + duneRand() * 0.9, 0.7 + duneRand() * 0.9);
    dummy.updateMatrix();
    grassXf.push(dummy.matrix.clone());
  }
  if (grassXf.length > 0) {
    const tufts = new THREE.InstancedMesh(
      track(new THREE.ConeGeometry(0.55, 1.1, 5)),
      track(new THREE.MeshStandardMaterial({ color: 0x9aa860, roughness: 1 })),
      grassXf.length,
    );
    setInst(tufts, grassXf);
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
      // WS4: park trees vary in size (0.85–1.2x) instead of clones.
      const ts = 0.85 + prand() * 0.35;
      dummy.position.set(x, 1.4 * ts, z);
      dummy.rotation.set(0, prand() * Math.PI * 2, 0);
      dummy.scale.set(ts, ts, ts);
      dummy.updateMatrix();
      treeTrunkXf.push(dummy.matrix.clone());
      dummy.position.set(x, 3.4 * ts, z);
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
