/**
 * Procedural weapon models — built from boxes and cylinders in
 * the game's own style (no copied models or branding). Each model
 * is built with its barrel along local +z and its grip at the
 * origin, so it can be parented to the protagonist's right elbow
 * at the hand position and it follows the arm through the walk
 * cycle. The muzzle anchor is where flashes and tracers start.
 */
import * as THREE from 'three';
import type { WeaponId } from './Weapons';

export type Track = <T extends { dispose(): void }>(r: T) => T;

export interface WeaponModel {
  group: THREE.Group;
  /** Anchor at the barrel tip. */
  muzzle: THREE.Object3D;
}

function gunmetal(track: Track): THREE.MeshStandardMaterial {
  return track(
    new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.6 }),
  );
}

function gripMat(track: Track): THREE.MeshStandardMaterial {
  return track(new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.85 }));
}

function accentMat(track: Track, hex: number): THREE.MeshStandardMaterial {
  return track(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0.3 }));
}

function box(
  group: THREE.Group,
  track: Track,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

/** Compact sidearm — small, balanced, beginner-friendly. */
function buildSidearm(track: Track): WeaponModel {
  const group = new THREE.Group();
  group.name = 'weapon-palm-9';
  const metal = gunmetal(track);
  const grip = gripMat(track);
  const accent = accentMat(track, 0xd8a24a);
  // Grip: the hand wraps this; it sits at the group's origin.
  const gripMesh = box(group, track, grip, 0.05, 0.13, 0.07, 0, -0.05, -0.01);
  gripMesh.rotation.x = 0.18;
  // Slide + barrel along +z.
  box(group, track, metal, 0.045, 0.045, 0.24, 0, 0.02, 0.08);
  // Amber sight stripe and front sight.
  box(group, track, accent, 0.02, 0.012, 0.2, 0, 0.048, 0.08);
  box(group, track, metal, 0.012, 0.02, 0.012, 0, 0.05, 0.19);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 0.21);
  group.add(muzzle);
  return { group, muzzle };
}

/** Tactical carbine — longer, automatic, built for the far targets. */
function buildCarbine(track: Track): WeaponModel {
  const group = new THREE.Group();
  group.name = 'weapon-vanguard-carbine';
  const metal = gunmetal(track);
  const grip = gripMat(track);
  const accent = accentMat(track, 0x2e8b8b);
  // Stock (behind the grip), receiver, handguard, barrel.
  box(group, track, grip, 0.06, 0.09, 0.18, 0, 0, -0.22);
  box(group, track, metal, 0.06, 0.09, 0.34, 0, 0.01, 0);
  box(group, track, metal, 0.07, 0.07, 0.26, 0, 0.01, 0.22);
  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 10)), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, 0.42);
  barrel.castShadow = true;
  group.add(barrel);
  // Magazine, angled forward; grip; teal accent stripe + sight.
  const mag = box(group, track, grip, 0.05, 0.16, 0.08, 0, -0.1, 0.05);
  mag.rotation.x = 0.12;
  box(group, track, grip, 0.05, 0.1, 0.06, 0, -0.06, -0.1);
  box(group, track, accent, 0.02, 0.012, 0.3, 0, 0.062, 0.05);
  box(group, track, metal, 0.012, 0.025, 0.012, 0, 0.065, 0.32);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 0.58);
  group.add(muzzle);
  return { group, muzzle };
}

export function createWeaponModel(id: WeaponId, track: Track): WeaponModel {
  return id === 'vanguard-carbine' ? buildCarbine(track) : buildSidearm(track);
}
