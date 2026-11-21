/**
 * Sunset Mart — the one convenience store in the city, on the
 * commercial block north-east of the spawn plaza. An original low
 * shopfront: cream tile, a teal sign band reading "SUNSET MART",
 * a striped awning, big glass windows with the interior genuinely
 * visible behind them (shelves, goods, counter, warm light), a
 * glass door, a red vending machine, and a gold marker at the
 * entrance. Built once per world build and hands back its
 * collision box, so the player and the cars stop at its walls.
 */
import * as THREE from 'three';
import type { BuildingBox } from './World';
import type { Track } from './Buildings';
import {
  STORE_CENTRE,
  STORE_ENTRANCE,
  STORE_FOOTPRINT,
  STORE_HEIGHT,
} from './CityGenerator';

function makeSignTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0e3a3a';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 84);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 46px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SUNSET MART', 256, 42);
  ctx.fillStyle = '#7fd4c1';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('OPEN 24 HOURS', 256, 76);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAwningTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#0e7c7b' : '#f5f0e6';
    ctx.fillRect(i * 32, 0, 32, 64);
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Glass with painted mullion bars, so the front reads as windows. */
function makeGlassTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 128);
  // A faint warm tint for the glass itself.
  ctx.fillStyle = 'rgba(255, 240, 200, 0.14)';
  ctx.fillRect(0, 0, 256, 128);
  // Mullion bars: dark frames dividing the front into panes.
  ctx.fillStyle = 'rgba(20, 28, 34, 0.95)';
  for (let x = 0; x <= 256; x += 64) ctx.fillRect(x - 3, 0, 6, 128);
  ctx.fillRect(0, 0, 256, 6);
  ctx.fillRect(0, 122, 256, 6);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeVendingTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#c23b2e';
  ctx.fillRect(0, 0, 128, 128);
  // Lit front: rows of drinks.
  ctx.fillStyle = '#bfe8ff';
  ctx.fillRect(14, 14, 100, 76);
  const cols = ['#ff5fa2', '#ffd23e', '#35c4ff', '#7fd4c1', '#ff7a5c', '#9b7fd4'];
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = cols[(r * 5 + i) % cols.length];
      ctx.fillRect(20 + i * 19, 22 + r * 24, 12, 18);
    }
  }
  ctx.fillStyle = '#f5f0e6';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DRINKS', 64, 112);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface ShopHandle {
  /** The building's collision box. */
  box: BuildingBox;
}

/** Build the store into the world group. */
export function buildShop(group: THREE.Group, track: Track): ShopHandle {
  const { minX, maxX, minZ, maxZ } = STORE_FOOTPRINT;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = STORE_CENTRE.x;
  const cz = STORE_CENTRE.z;
  const h = STORE_HEIGHT;
  const southFace = maxZ; // the face on the street side (z = 30)

  const wallMat = track(
    new THREE.MeshStandardMaterial({ color: 0xe8ddc8, roughness: 0.9 }),
  );
  const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.85 }));

  // --- Floor slab ---
  const floor = new THREE.Mesh(
    track(new THREE.BoxGeometry(w, 0.15, d)),
    track(new THREE.MeshStandardMaterial({ color: 0x4a4454, roughness: 0.95 })),
  );
  floor.position.set(cx, 0.07, cz);
  floor.receiveShadow = true;
  group.add(floor);

  // --- Back + side walls (the front is glass, not a wall) ---
  const back = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, 0.3)), wallMat);
  back.position.set(cx, h / 2, minZ + 0.15);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, h, d)), wallMat);
    side.position.set(cx + s * (w / 2 - 0.15), h / 2, cz);
    side.castShadow = true;
    side.receiveShadow = true;
    group.add(side);
  }

  // --- Roof slab ---
  const roof = new THREE.Mesh(
    track(new THREE.BoxGeometry(w + 0.6, 0.3, d + 0.6)),
    track(new THREE.MeshStandardMaterial({ color: 0x1c2029, roughness: 0.95 })),
  );
  roof.position.set(cx, h + 0.15, cz);
  roof.castShadow = true;
  group.add(roof);

  // --- Low bulkhead under the windows (front, south face) ---
  const bulk = new THREE.Mesh(track(new THREE.BoxGeometry(w, 0.9, 0.25)), darkMat);
  bulk.position.set(cx, 0.45, southFace - 0.12);
  bulk.castShadow = true;
  group.add(bulk);

  // --- Glass front: two window panes flanking the door ---
  const glassMat = track(
    new THREE.MeshBasicMaterial({
      map: makeGlassTexture(track),
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  const paneW = (w - 2.4) / 2;
  for (const s of [-1, 1]) {
    const pane = new THREE.Mesh(track(new THREE.PlaneGeometry(paneW, h - 0.9)), glassMat);
    pane.position.set(cx + s * (1.2 + paneW / 2), 0.9 + (h - 0.9) / 2, southFace - 0.12);
    group.add(pane);
  }

  // --- Glass door in the centre of the front ---
  const door = new THREE.Mesh(
    track(new THREE.PlaneGeometry(2.4, h - 0.9)),
    track(
      new THREE.MeshBasicMaterial({
        color: 0x9fd8e8,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      }),
    ),
  );
  door.position.set(cx, 0.9 + (h - 0.9) / 2, southFace - 0.12);
  group.add(door);
  const handle = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.08, 1.1, 0.08)),
    track(new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.3, metalness: 0.8 })),
  );
  handle.position.set(cx + 0.9, 1.6, southFace - 0.2);
  group.add(handle);

  // --- Interior: warm ceiling light, shelves with goods, counter ---
  const light = new THREE.Mesh(
    track(new THREE.PlaneGeometry(w - 2, d - 2)),
    track(
      new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.9 }),
    ),
  );
  light.rotation.x = Math.PI / 2;
  light.position.set(cx, h - 0.4, cz);
  group.add(light);
  const shelfMat = track(new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.85 }));
  for (const s of [-1, 1]) {
    const shelf = new THREE.Mesh(track(new THREE.BoxGeometry(5.5, 2.2, 0.9)), shelfMat);
    shelf.position.set(cx + s * 4.2, 1.1, cz - 2.5);
    group.add(shelf);
  }
  // Goods: one instanced mesh, colourful, in front of the shelves.
  const goodsGeo = track(new THREE.BoxGeometry(0.32, 0.42, 0.3));
  const goodsMat = track(new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  const goods = new THREE.InstancedMesh(goodsGeo, goodsMat, 24);
  const palette = [0xff5fa2, 0xffd23e, 0x35c4ff, 0x7fd4c1, 0xff7a5c, 0x9b7fd4];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let gi = 0;
  for (const s of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        dummy.position.set(cx + s * 4.2 - 2.4 + i * 0.96, 0.6 + row * 1.0, cz - 2.0);
        dummy.updateMatrix();
        goods.setMatrixAt(gi, dummy.matrix);
        goods.setColorAt(gi, col.setHex(palette[gi % palette.length]));
        gi++;
      }
    }
  }
  goods.instanceMatrix.needsUpdate = true;
  if (goods.instanceColor) goods.instanceColor.needsUpdate = true;
  group.add(goods);
  const counter = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 1.1, 0.9)), shelfMat);
  counter.position.set(cx + 5.5, 0.55, cz + 3.5);
  group.add(counter);

  // --- Sign band above the front, facing the street (south = +Z) ---
  const sign = new THREE.Mesh(
    track(new THREE.PlaneGeometry(14, 2.6)),
    track(new THREE.MeshBasicMaterial({ map: makeSignTexture(track) })),
  );
  sign.position.set(cx, h - 0.6, southFace + 0.15);
  group.add(sign);

  // --- Striped awning over the front ---
  const awning = new THREE.Mesh(
    track(new THREE.PlaneGeometry(w, 1.6)),
    track(
      new THREE.MeshStandardMaterial({
        map: makeAwningTexture(track),
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    ),
  );
  awning.rotation.x = -Math.PI / 2 + 0.5;
  awning.position.set(cx, h - 2.2, southFace + 0.7);
  awning.castShadow = true;
  group.add(awning);

  // --- Vending machine east of the door ---
  const vend = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.2, 2.2, 0.9)),
    track(
      new THREE.MeshStandardMaterial({
        map: makeVendingTexture(track),
        roughness: 0.6,
      }),
    ),
  );
  vend.position.set(maxX - 1.4, 1.1, southFace + 0.6);
  vend.castShadow = true;
  group.add(vend);

  // --- Entrance marker: a gold beam + ground ring (2 draw calls) ---
  const beamMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const beam = new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 0.5, 14, 12, 1, true)), beamMat);
  beam.position.set(STORE_ENTRANCE.x, 7, STORE_ENTRANCE.z);
  group.add(beam);
  const ringMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    }),
  );
  const ring = new THREE.Mesh(track(new THREE.RingGeometry(1.4, 1.8, 32)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(STORE_ENTRANCE.x, 0.06, STORE_ENTRANCE.z);
  group.add(ring);

  return { box: { minX, maxX, minZ, maxZ, maxY: STORE_HEIGHT } };
}
