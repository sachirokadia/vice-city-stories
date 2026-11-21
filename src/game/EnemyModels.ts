/**
 * Enemy models — three original procedural figures, built from
 * Three.js geometry in the same style as the protagonist but
 * visibly different: different builds, clothing colours, headgear
 * (bandana / cap / beanie) and a simple "scrap rifle" in the
 * right hand. No copied characters or assets.
 *
 * Each model is a Group with named limb pivots so the AI can
 * drive a stride-matched walk cycle (the same pattern as the
 * pedestrian crowd): hips swing the legs, shoulders swing the
 * arms, the body bobs. The whole figure is ~12 meshes, so three
 * active enemies cost ~36 draw calls.
 */
import * as THREE from 'three';
import type { EnemyDef } from './EnemyDefs';
import type { Track } from './Character';

export interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  /** The rifle's muzzle (the tracer starts here). */
  muzzle: THREE.Object3D;
}

export interface EnemyModel {
  group: THREE.Group;
  rig: EnemyRig;
  /** Materials the hit flash recolours (torso + arms). */
  flashMats: THREE.MeshStandardMaterial[];
}

export function createEnemyModel(def: EnemyDef, track: Track): EnemyModel {
  const root = new THREE.Group();
  root.name = `enemy-${def.id}`;
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const skin = track(new THREE.MeshStandardMaterial({ color: def.skin, roughness: 0.6 }));
  const topMat = track(new THREE.MeshStandardMaterial({ color: def.top, roughness: 0.85 }));
  const bottomMat = track(new THREE.MeshStandardMaterial({ color: def.bottom, roughness: 0.9 }));
  const shoeMat = track(new THREE.MeshStandardMaterial({ color: def.shoes, roughness: 0.7 }));
  const accentMat = track(new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.6 }));
  const gearMat = track(new THREE.MeshStandardMaterial({ color: def.headgearColor, roughness: 0.9 }));
  const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.5 }));
  const gunMat = track(new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.4 }));

  const h = def.height;
  const w = def.width;
  const add = (
    parent: THREE.Group | THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    castShadow = true,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = castShadow;
    parent.add(m);
    return m;
  };

  // --- Legs: hip pivot -> thigh, shoe at the bottom ---
  const makeLeg = (side: number): THREE.Group => {
    const hip = new THREE.Group();
    hip.name = side < 0 ? 'legL' : 'legR';
    hip.position.set(side * 0.11 * w, 0.92 * h, 0);
    body.add(hip);
    add(hip, track(new THREE.CapsuleGeometry(0.08 * w, 0.32 * h, 4, 10)), bottomMat, 0, -0.22 * h, 0);
    add(hip, track(new THREE.BoxGeometry(0.13 * w, 0.09, 0.3)), shoeMat, 0, -0.5 * h, 0.05, false);
    return hip;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // --- Torso: a jacket box + a vest plate in the accent colour ---
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.set(0, 0.95 * h, 0);
  body.add(torso);
  add(torso, track(new THREE.BoxGeometry(0.44 * w, 0.55 * h, 0.26)), topMat, 0, 0.28 * h, 0);
  add(torso, track(new THREE.BoxGeometry(0.3 * w, 0.36 * h, 0.04)), accentMat, 0, 0.3 * h, 0.14, false);

  // --- Head: sphere + headgear + two dark eyes ---
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.62 * h, 0);
  torso.add(head);
  add(head, track(new THREE.SphereGeometry(0.14 * h, 16, 12)), skin, 0, 0.06 * h, 0);
  if (def.headgear === 'bandana') {
    const band = add(head, track(new THREE.TorusGeometry(0.145 * h, 0.03, 8, 16)), gearMat, 0, 0.08 * h, 0, false);
    band.rotation.x = Math.PI / 2;
    add(head, track(new THREE.BoxGeometry(0.08, 0.16, 0.02)), gearMat, -0.1, 0.02 * h, -0.12, false);
  } else if (def.headgear === 'cap') {
    add(head, track(new THREE.CylinderGeometry(0.14 * h, 0.15 * h, 0.06, 12)), gearMat, 0, 0.14 * h, 0, false);
    add(head, track(new THREE.BoxGeometry(0.16, 0.02, 0.12)), gearMat, 0, 0.12 * h, 0.15, false);
  } else {
    const beanie = add(head, track(new THREE.SphereGeometry(0.15 * h, 12, 8)), gearMat, 0, 0.11 * h, -0.01);
    beanie.scale.set(1.02, 0.7, 1.02);
  }
  for (const s of [-1, 1]) {
    add(head, track(new THREE.SphereGeometry(0.018, 8, 6)), darkMat, s * 0.05, 0.07 * h, 0.12, false);
  }

  // --- Arms: shoulder pivot -> upper arm + forearm + hand ---
  const makeArm = (side: number): THREE.Group => {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? 'armL' : 'armR';
    shoulder.position.set(side * 0.27 * w, 0.5 * h, 0);
    torso.add(shoulder);
    add(shoulder, track(new THREE.CapsuleGeometry(0.06 * w, 0.2 * h, 4, 10)), topMat, 0, -0.16 * h, 0);
    add(shoulder, track(new THREE.CapsuleGeometry(0.05 * w, 0.18 * h, 4, 10)), skin, 0, -0.36 * h, 0);
    return shoulder;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // --- Scrap rifle: a receiver, a barrel and a grip, held in the
  // right hand and pointing forward (local +z, like the player). ---
  const rifle = new THREE.Group();
  rifle.name = 'rifle';
  rifle.position.set(0, -0.42 * h, 0.06);
  armR.add(rifle);
  add(rifle, track(new THREE.BoxGeometry(0.07, 0.1, 0.42)), gunMat, 0, 0, 0.1);
  add(rifle, track(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8)), gunMat, 0, 0.01, 0.42).rotation.x = Math.PI / 2;
  add(rifle, track(new THREE.BoxGeometry(0.05, 0.14, 0.05)), darkMat, 0, -0.1, 0, false);
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, 0.01, 0.58);
  rifle.add(muzzle);

  return {
    group: root,
    rig: { root, body, head, legL, legR, armL, armR, muzzle },
    flashMats: [topMat],
  };
}
