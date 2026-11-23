/**
 * Buildings: varied facades, storefronts, balconies, rooftop props and
 * the Beacon Tower landmark. Repeated things share geometry, materials
 * and textures; balconies / rooftop units are InstancedMeshes.
 * Returns the building footprints the player collides with.
 */
import * as THREE from 'three';
import type { QualitySettings } from './Quality';
import type { CityLayout, District, Plot } from './CityGenerator';
import type { BuildingBox } from './World';
import { GeometryBatch, composeMatrix } from './Merge';

export type Track = <T extends { dispose(): void }>(r: T) => T;

type FacadeStyle = 'glass' | 'brick' | 'pastel' | 'concrete' | 'hotel';

const STYLE_FOR: Record<District, FacadeStyle> = {
  downtown: 'glass',
  coastal: 'hotel',
  commercial: 'brick',
  residential: 'pastel',
  park: 'concrete',
};

function makeFacadeTexture(
  style: FacadeStyle,
  rand: () => number,
  track: Track,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const base =
    style === 'glass'
      ? '#2e5a80'
      : style === 'brick'
        ? '#9a6a52'
        : style === 'pastel'
          ? '#d8c9a8'
          : style === 'hotel'
            ? '#e8e2d2'
            : '#8a8580';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  if (style === 'hotel') {
    // Horizontal balcony bands instead of a plain window grid.
    for (let y = 16; y < 244; y += 30) {
      ctx.fillStyle = 'rgba(40,70,90,0.55)';
      ctx.fillRect(6, y, 116, 4);
      for (let x = 10; x < 118; x += 18) {
        const lit = rand() < 0.5;
        ctx.fillStyle = lit ? '#ffd27a' : 'rgba(16,30,48,0.9)';
        ctx.fillRect(x, y + 8, 11, 14);
      }
    }
  } else if (style === 'glass') {
    // Dense dark glass with warm lit panes.
    for (let y = 8; y < 248; y += 16) {
      for (let x = 6; x < 122; x += 14) {
        const lit = rand() < 0.42;
        ctx.fillStyle = lit ? '#ffcf7d' : 'rgba(8,18,34,0.9)';
        ctx.fillRect(x, y, 10, 11);
      }
    }
  } else {
    for (let y = 12; y < 244; y += 22) {
      for (let x = 10; x < 118; x += 18) {
        const lit = rand() < 0.32;
        ctx.fillStyle = lit ? '#ffd27a' : 'rgba(12,18,34,0.85)';
        ctx.fillRect(x, y, 11, 14);
      }
    }
    if (style === 'pastel') {
      // Awnings over the ground-floor windows.
      ctx.fillStyle = 'rgba(214,90,120,0.85)';
      ctx.fillRect(6, 224, 116, 8);
    }
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const SIGN_NAMES: Array<{ name: string; bg: string; fg: string }> = [
  { name: 'CAFÉ AZUL', bg: '#123a5c', fg: '#ffd27a' },
  { name: 'SURF SHOP', bg: '#0e6b6b', fg: '#ffffff' },
  { name: 'TACO BAR', bg: '#b8452a', fg: '#ffe9b0' },
  { name: 'NEON BAR', bg: '#3a1150', fg: '#ff6ec7' },
  { name: 'HOTEL VISTA', bg: '#274b6d', fg: '#cfe8ff' },
  { name: 'PIZZA', bg: '#7a2a1a', fg: '#ffd27a' },
];

function makeSignTexture(
  sign: { name: string; bg: string; fg: string },
  track: Track,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = sign.bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = sign.fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = sign.fg;
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sign.name, 128, 34);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Offset + rotation for something mounted on a plot's street-facing side. */
function faceTransform(plot: Plot): { dx: number; dz: number; ry: number } {
  const o = 0.45; // how far proud of the wall the fixture sits
  switch (plot.face) {
    case 'south':
      return { dx: 0, dz: plot.d / 2 + o, ry: 0 };
    case 'north':
      return { dx: 0, dz: -plot.d / 2 - o, ry: Math.PI };
    case 'east':
      return { dx: plot.w / 2 + o, dz: 0, ry: Math.PI / 2 };
    case 'west':
      return { dx: -plot.w / 2 - o, dz: 0, ry: -Math.PI / 2 };
  }
}

export function buildBuildings(
  group: THREE.Group,
  layout: CityLayout,
  quality: QualitySettings,
  rand: () => number,
  track: Track,
): { buildings: BuildingBox[] } {
  const buildings: BuildingBox[] = [];
  const detailed = quality.tier !== 'low';

  // --- Shared resources (one geometry, a handful of materials) --------
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  // Facades tile their texture roughly once per 14 units wide / 16 tall,
  // so windows stay the same real-world size on a shop and a tower
  // instead of stretching across the whole face.
  const facadeMats = new Map<string, THREE.MeshStandardMaterial>();
  const facadeFor = (style: FacadeStyle, w: number, h: number): THREE.MeshStandardMaterial => {
    const rx = THREE.MathUtils.clamp(Math.round(w / 14), 1, 3);
    const ry = THREE.MathUtils.clamp(Math.round(h / 16), 1, 3);
    const key = `${style}-${rx}x${ry}`;
    let m = facadeMats.get(key);
    if (!m) {
      const tex = makeFacadeTexture(style, rand, track);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(rx, ry);
      m = track(
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: style === 'glass' ? 0.32 : 0.85,
          metalness: style === 'glass' ? 0.55 : 0.05,
        }),
      );
      facadeMats.set(key, m);
    }
    return m;
  };
  const roofMat = track(new THREE.MeshStandardMaterial({ color: 0x2a2830, roughness: 0.95 }));
  const trimMat = track(
    new THREE.MeshStandardMaterial({ color: 0xff5fa2, emissive: 0xff2e88, emissiveIntensity: 0.9 }),
  );
  const trimMat2 = track(
    new THREE.MeshStandardMaterial({ color: 0x35c4ff, emissive: 0x1899ff, emissiveIntensity: 0.9 }),
  );
  const storeMat = track(new THREE.MeshStandardMaterial({ color: 0x2c2733, roughness: 0.6 }));
  const awningMat = track(new THREE.MeshStandardMaterial({ color: 0xd65a78, roughness: 0.8 }));
  const signMats = SIGN_NAMES.map((s) =>
    track(new THREE.MeshBasicMaterial({ map: makeSignTexture(s, track) })),
  );
  const balconyMat = track(new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.85 }));
  const rooftopMat = track(new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.9 }));
  const waterMat = track(new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 }));

  const signGeo = track(new THREE.PlaneGeometry(5.4, 1.35));
  const awningGeo = track(new THREE.PlaneGeometry(5.4, 1.1));

  // --- Batched static geometry: one draw call per material instead
  // of one per building part (~300 meshes became ~25). The look is
  // identical — same boxes, same materials, just merged. ---
  const facadeBatches = new Map<THREE.Material, GeometryBatch>();
  const facadeBatchFor = (mat: THREE.Material): GeometryBatch => {
    let b = facadeBatches.get(mat);
    if (!b) {
      b = new GeometryBatch();
      facadeBatches.set(mat, b);
    }
    return b;
  };
  const roofBatch = new GeometryBatch();
  const trimBatches = new Map<THREE.Material, GeometryBatch>();
  const trimBatchFor = (mat: THREE.Material): GeometryBatch => {
    let b = trimBatches.get(mat);
    if (!b) {
      b = new GeometryBatch();
      trimBatches.set(mat, b);
    }
    return b;
  };
  const storeBatch = new GeometryBatch();
  const awningBatch = new GeometryBatch();
  const signBatches = new Map<THREE.Material, GeometryBatch>();
  const signBatchFor = (mat: THREE.Material): GeometryBatch => {
    let b = signBatches.get(mat);
    if (!b) {
      b = new GeometryBatch();
      signBatches.set(mat, b);
    }
    return b;
  };

  const balconyXf: THREE.Matrix4[] = [];
  const rooftopXf: THREE.Matrix4[] = [];
  const towerXf: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  let signIdx = 0;
  for (const plot of layout.plots) {
    const style = STYLE_FOR[plot.district];
    const facadeMat = facadeFor(style, plot.w, plot.h);
    facadeBatchFor(facadeMat).add(
      unitBox,
      composeMatrix(plot.x, plot.h / 2, plot.z, 0, plot.w, plot.h, plot.d),
    );
    // WS4 — downtown podium: a wider ground-floor base (4 m tall) so
    // the towers read as buildings on a plinth, not slabs dropped on
    // the pad. The collision box grows to match it.
    const podium = plot.district === 'downtown';
    const podiumOut = podium ? 0.06 : 0;
    if (podium) {
      facadeBatchFor(facadeMat).add(
        unitBox,
        composeMatrix(plot.x, 2, plot.z, 0, plot.w * 1.12, 4, plot.d * 1.12),
      );
    }
    // WS4 — downtown setback: tall towers step in above ~70% of their
    // height (a second, narrower crown), so the skyline is stepped
    // instead of a row of identical flat-topped slabs.
    const setbackH = plot.district === 'downtown' && plot.h >= 30 ? plot.h * 0.28 : 0;
    if (setbackH > 0) {
      facadeBatchFor(facadeMat).add(
        unitBox,
        composeMatrix(plot.x, plot.h + setbackH / 2, plot.z, 0, plot.w * 0.62, setbackH, plot.d * 0.62),
      );
    }
    // Storefronts (below) stick out ~0.9 from the face side, so the
    // collision box grows by the same amount there — the player stops
    // at the shop front, not inside it.
    const faceOut =
      plot.district === 'commercial' || plot.district === 'coastal' ? 1.0 : 0;
    const halfW = plot.w / 2 + plot.w * podiumOut + (plot.face === 'west' ? faceOut : 0);
    const halfWPlus = plot.w / 2 + plot.w * podiumOut + (plot.face === 'east' ? faceOut : 0);
    const halfD = plot.d / 2 + plot.d * podiumOut + (plot.face === 'north' ? faceOut : 0);
    const halfDPlus = plot.d / 2 + plot.d * podiumOut + (plot.face === 'south' ? faceOut : 0);
    buildings.push({
      minX: plot.x - halfW,
      maxX: plot.x + halfWPlus,
      minZ: plot.z - halfD,
      maxZ: plot.z + halfDPlus,
      maxY: plot.h + setbackH,
    });

    // Dark roof cap: hides the window texture on the top face and
    // reads as a roof from the follow camera looking down.
    roofBatch.add(
      unitBox,
      composeMatrix(plot.x, plot.h + 0.08, plot.z, 0, plot.w + 0.1, 0.3, plot.d + 0.1),
    );
    // WS4 — parapet rim: four thin boxes around the roof edge (not
    // downtown — those get the setback crown instead). Reads as a
    // raised roofline from the street and from the follow camera.
    if (setbackH === 0 && plot.district !== 'park') {
      const pt = 0.35; // parapet thickness
      const ph = 0.7; // parapet height above the roof
      const px = plot.w / 2 - pt / 2;
      const pz = plot.d / 2 - pt / 2;
      roofBatch.add(unitBox, composeMatrix(plot.x - px, plot.h + ph / 2, plot.z, 0, pt, ph, plot.d));
      roofBatch.add(unitBox, composeMatrix(plot.x + px, plot.h + ph / 2, plot.z, 0, pt, ph, plot.d));
      roofBatch.add(unitBox, composeMatrix(plot.x, plot.h + ph / 2, plot.z - pz, 0, plot.w, ph, pt));
      roofBatch.add(unitBox, composeMatrix(plot.x, plot.h + ph / 2, plot.z + pz, 0, plot.w, ph, pt));
    }
    // Setback crown gets its own cap + neon trim.
    if (setbackH > 0) {
      roofBatch.add(
        unitBox,
        composeMatrix(plot.x, plot.h + setbackH + 0.08, plot.z, 0, plot.w * 0.62 + 0.1, 0.3, plot.d * 0.62 + 0.1),
      );
    }

    // Neon roof trim on the skyline buildings. On a setback tower the
    // trim rides the crown top, not the main roof (the main-roof slab
    // would be buried inside the setback).
    if (detailed && (plot.district === 'downtown' || plot.district === 'coastal')) {
      const trimY = plot.h + setbackH + 0.1;
      const trimW = setbackH > 0 ? plot.w * 0.62 + 0.3 : plot.w + 0.3;
      const trimD = setbackH > 0 ? plot.d * 0.62 + 0.3 : plot.d + 0.3;
      trimBatchFor(plot.district === 'downtown' ? trimMat : trimMat2).add(
        unitBox,
        composeMatrix(plot.x, trimY, plot.z, 0, trimW, 0.35, trimD),
      );
    }

    // Storefront on the street-facing side (commercial + coastal).
    if (plot.district === 'commercial' || plot.district === 'coastal') {
      const f = faceTransform(plot);
      const frontLen = plot.face === 'south' || plot.face === 'north' ? plot.w : plot.d;
      const sw = Math.min(frontLen * 0.8, 7);
      const facingNS = plot.face === 'south' || plot.face === 'north';
      storeBatch.add(
        unitBox,
        composeMatrix(
          plot.x + f.dx,
          1.4,
          plot.z + f.dz,
          0,
          facingNS ? sw : 0.9,
          2.8,
          facingNS ? 0.9 : sw,
        ),
      );
      // YXZ: yaw to face the street first, then tilt the top outward.
      awningBatch.add(
        awningGeo,
        composeMatrix(plot.x + f.dx, 3.1, plot.z + f.dz, f.ry, sw / 5.4, 1, 1, -0.5),
      );
      signBatchFor(signMats[signIdx % signMats.length]).add(
        signGeo,
        composeMatrix(plot.x + f.dx, 4.1, plot.z + f.dz, f.ry, sw / 5.4, 1, 1),
      );
      signIdx++;
    }

    // Balconies on residential / coastal fronts.
    if (detailed && (plot.district === 'residential' || plot.district === 'coastal')) {
      const f = faceTransform(plot);
      const floors = Math.min(2, Math.floor((plot.h - 3) / 3));
      const frontLen = plot.face === 'south' || plot.face === 'north' ? plot.w : plot.d;
      const n = Math.max(1, Math.min(3, Math.floor(frontLen / 5)));
      for (let fl = 0; fl < floors; fl++) {
        for (let i = 0; i < n; i++) {
          const along = frontLen / 2 - 2.2 - i * 5;
          const bx = plot.face === 'south' || plot.face === 'north' ? plot.x + along : plot.x + f.dx;
          const bz = plot.face === 'south' || plot.face === 'north' ? plot.z + f.dz : plot.z + along;
          dummy.position.set(bx, 3.6 + fl * 3, bz);
          dummy.rotation.set(0, f.ry, 0);
          dummy.scale.set(1.7, 0.16, 0.85);
          dummy.updateMatrix();
          balconyXf.push(dummy.matrix.clone());
        }
      }
    }

    // Rooftop props.
    if (detailed) {
      const units = plot.district === 'downtown' ? 2 : 1;
      for (let i = 0; i < units; i++) {
        dummy.position.set(plot.x + (rand() - 0.5) * (plot.w - 3), plot.h + 0.45, plot.z + (rand() - 0.5) * (plot.d - 3));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1.3, 0.9, 1.3);
        dummy.updateMatrix();
        rooftopXf.push(dummy.matrix.clone());
      }
      if (plot.district === 'residential' && rand() < 0.35) {
        dummy.position.set(plot.x + (rand() - 0.5) * (plot.w - 3), plot.h + 1.2, plot.z + (rand() - 0.5) * (plot.d - 3));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        towerXf.push(dummy.matrix.clone());
      }
    }
  }

  // --- Flush the batches: one mesh per material ---
  const addBatch = (batch: GeometryBatch, mat: THREE.Material, castShadow: boolean): void => {
    const geo = batch.build();
    if (!geo) return;
    const mesh = new THREE.Mesh(track(geo), mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  for (const [mat, b] of facadeBatches) addBatch(b, mat, true);
  addBatch(roofBatch, roofMat, false);
  for (const [mat, b] of trimBatches) addBatch(b, mat, false);
  addBatch(storeBatch, storeMat, true);
  addBatch(awningBatch, awningMat, false);
  for (const [mat, b] of signBatches) addBatch(b, mat, false);

  if (balconyXf.length > 0) {
    const geo = track(new THREE.BoxGeometry(1, 1, 1));
    const inst = new THREE.InstancedMesh(geo, balconyMat, balconyXf.length);
    balconyXf.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = true;
    group.add(inst);
  }
  if (rooftopXf.length > 0) {
    const geo = track(new THREE.BoxGeometry(1, 1, 1));
    const inst = new THREE.InstancedMesh(geo, rooftopMat, rooftopXf.length);
    rooftopXf.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = true;
    group.add(inst);
  }
  if (towerXf.length > 0) {
    const geo = track(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 10));
    const inst = new THREE.InstancedMesh(geo, waterMat, towerXf.length);
    towerXf.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = true;
    group.add(inst);
  }

  return { buildings };
}

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
