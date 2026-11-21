/**
 * The Sunset Garage — the one physical garage in the city. An
 * original low wide workshop building on the residential block
 * south-east of the spawn plaza: charcoal facade, a ribbed roller
 * door facing the street, a gold "SUNSET GARAGE" sign, a neon
 * strip, a concrete apron, and a cyan marker at the entrance.
 * Built once per world build (it survives quality rebuilds like
 * the rest of the city) and hands back its collision box, so the
 * player and the cars stop at its walls.
 */
import * as THREE from 'three';
import type { BuildingBox } from './World';
import type { Track } from './Buildings';
import {
  GARAGE_CENTRE,
  GARAGE_ENTRANCE,
  GARAGE_FOOTPRINT,
  GARAGE_HEIGHT,
} from './CityGenerator';

function makeFacadeTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2e3440';
  ctx.fillRect(0, 0, 256, 128);
  // Horizontal panel seams.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  for (let y = 16; y < 128; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  // A few warm lit windows on the upper floor.
  for (let x = 12; x < 244; x += 28) {
    ctx.fillStyle = Math.random() < 0.5 ? '#ffd27a' : 'rgba(12,18,34,0.9)';
    ctx.fillRect(x, 18, 16, 12);
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDoorTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3a4152';
  ctx.fillRect(0, 0, 128, 128);
  // Ribbed roller door.
  for (let y = 0; y < 128; y += 12) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y, 128, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, y + 3, 128, 2);
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#141824';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 84);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SUNSET GARAGE', 256, 50);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface GarageHandle {
  /** The building's collision box (the apron is walkable). */
  box: BuildingBox;
}

/** Build the garage into the world group. */
export function buildGarage(group: THREE.Group, track: Track): GarageHandle {
  const { minX, maxX, minZ, maxZ } = GARAGE_FOOTPRINT;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = GARAGE_CENTRE.x;
  const cz = GARAGE_CENTRE.z;
  const h = GARAGE_HEIGHT;
  const northFace = minZ; // the face on the street side

  // --- Main building: one box, panelled facade texture ---
  const facade = new THREE.Mesh(
    track(new THREE.BoxGeometry(w, h, d)),
    track(
      new THREE.MeshStandardMaterial({
        map: makeFacadeTexture(track),
        roughness: 0.85,
        metalness: 0.1,
      }),
    ),
  );
  facade.position.set(cx, h / 2, cz);
  facade.castShadow = true;
  facade.receiveShadow = true;
  group.add(facade);

  // --- Roof cap ---
  const roof = new THREE.Mesh(
    track(new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4)),
    track(new THREE.MeshStandardMaterial({ color: 0x1c2029, roughness: 0.95 })),
  );
  roof.position.set(cx, h + 0.15, cz);
  roof.castShadow = true;
  group.add(roof);

  // --- Roller door on the north face ---
  const door = new THREE.Mesh(
    track(new THREE.BoxGeometry(12, 5, 0.2)),
    track(
      new THREE.MeshStandardMaterial({
        map: makeDoorTexture(track),
        roughness: 0.7,
        metalness: 0.3,
      }),
    ),
  );
  door.position.set(cx, 2.5, northFace - 0.05);
  door.castShadow = true;
  group.add(door);

  // --- Sign above the door, facing the street (north = -Z) ---
  const sign = new THREE.Mesh(
    track(new THREE.PlaneGeometry(14, 2.6)),
    track(new THREE.MeshBasicMaterial({ map: makeSignTexture(track) })),
  );
  sign.position.set(cx, h - 0.6, northFace - 0.15);
  sign.rotation.y = Math.PI;
  group.add(sign);

  // --- Neon strip under the sign ---
  const neon = new THREE.Mesh(
    track(new THREE.BoxGeometry(14, 0.18, 0.1)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0xffd23e,
        emissive: 0xffb300,
        emissiveIntensity: 1.6,
      }),
    ),
  );
  neon.position.set(cx, h - 2.1, northFace - 0.15);
  group.add(neon);

  // --- Concrete apron in front of the door (walkable) ---
  const apron = new THREE.Mesh(
    track(new THREE.PlaneGeometry(w, 12)),
    track(new THREE.MeshStandardMaterial({ color: 0x4a4454, roughness: 0.95 })),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(cx, 0.03, northFace - 6);
  apron.receiveShadow = true;
  group.add(apron);

  // --- Tire stack beside the door ---
  const tireMat = track(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }));
  const tireGeo = track(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 14));
  for (let i = 0; i < 3; i++) {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(minX + 1.6, 0.15 + i * 0.32, northFace - 1.2);
    tire.castShadow = true;
    group.add(tire);
  }

  // --- Entrance marker: a cyan beam + ground ring (2 draw calls) ---
  const beamMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x35c4ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const beam = new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 0.5, 14, 12, 1, true)), beamMat);
  beam.position.set(GARAGE_ENTRANCE.x, 7, GARAGE_ENTRANCE.z);
  group.add(beam);
  const ringMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x35c4ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    }),
  );
  const ring = new THREE.Mesh(track(new THREE.RingGeometry(1.4, 1.8, 32)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(GARAGE_ENTRANCE.x, 0.06, GARAGE_ENTRANCE.z);
  group.add(ring);

  return { box: { minX, maxX, minZ, maxZ, maxY: GARAGE_HEIGHT } };
}
