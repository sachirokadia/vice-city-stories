import * as THREE from 'three';
import type { Track } from './Buildings';
import { mulberry32 } from './CityGenerator';
import type { CityLayout, Face, Plot } from './CityGenerator';
import type { QualitySettings } from './Quality';
import type { BuildingBox } from './World';

const FACES: Array<{ face: Face; angle: number }> = [
  { face: 'south', angle: 0 }, { face: 'east', angle: Math.PI / 2 },
  { face: 'north', angle: Math.PI }, { face: 'west', angle: -Math.PI / 2 },
];

const STYLES = {
  downtown: { walls: [0x8b989f, 0xa5a9a4, 0x777b80], trim: 0x53646b, floor: 3.65, ground: 4.8, bay: 2.7 },
  coastal: { walls: [0xd7b7a3, 0xb1c2bc, 0xe0d5bc], trim: 0xebe1cc, floor: 3.15, ground: 3.95, bay: 3.65 },
  commercial: { walls: [0x966d58, 0xc7b8a1, 0xa98c75, 0xb0a79a], trim: 0xd3c6ac, floor: 3.2, ground: 4.0, bay: 3.9 },
  residential: { walls: [0xd7c2aa, 0xaab4a5, 0xc29d86, 0xc2c6ad], trim: 0xe6dbc7, floor: 3, ground: 3.15, bay: 3.7 },
  industrial: { walls: [0x8f9591, 0xb4997c, 0x9da5a4], trim: 0x586469, floor: 3.2, ground: 4.6, bay: 5.0 },
  park: { walls: [0xc7bead], trim: 0xe6dbc7, floor: 3, ground: 3.15, bay: 3.7 },
};

const BUSINESS_NAMES = ['CAFÉ AZUL', 'SUNSET RECORDS', 'COSTA BAKERY', 'DAYBREAK HOTEL', 'HARBOR SUPPLY', 'PALM COURT'];

function businessSign(name: string, index: number, track: Track): THREE.MeshBasicMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 56;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = ['#234243', '#5d312a', '#344e58'][index % 3];
  ctx.fillRect(0, 0, 256, 56);
  ctx.strokeStyle = '#e5d8b6';
  ctx.strokeRect(4, 4, 248, 48);
  ctx.fillStyle = '#f4e8cc';
  ctx.font = 'bold 23px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 29, 232);
  const map = track(new THREE.CanvasTexture(canvas));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return track(new THREE.MeshBasicMaterial({ map }));
}

interface Instances {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  placements: Array<{ matrix: THREE.Matrix4; color: number }>;
  castShadow: boolean;
}

/** Keep the plan fixed at every quality. Small facade parts share instanced draws by district row. */
export function buildCityArchitecture(
  parent: THREE.Group, layout: CityLayout, quality: QualitySettings, track: Track,
): BuildingBox[] {
  const box = track(new THREE.BoxGeometry());
  const quad = track(new THREE.PlaneGeometry());
  const gableOutline = new THREE.Shape().moveTo(-.5, 0).lineTo(.5, 0).lineTo(0, 1).closePath();
  const gable = track(new THREE.ExtrudeGeometry(gableOutline, { depth: 1, bevelEnabled: false }).translate(0, 0, -.5));
  const masonry = track(new THREE.MeshStandardMaterial({ roughness: .91 }));
  const metal = track(new THREE.MeshStandardMaterial({ roughness: .63, metalness: .28 }));
  const glass = track(new THREE.MeshPhysicalMaterial({ roughness: .23, metalness: .14, clearcoat: .55, envMapIntensity: .5 }));
  const interior = track(new THREE.MeshStandardMaterial({ roughness: .8, color: 0xf4d5a0, emissive: 0x75471c, emissiveIntensity: .35 }));
  const signage = BUSINESS_NAMES.map((name, i) => businessSign(name, i, track));
  const batches = new Map<string, Instances>();
  const result: BuildingBox[] = [];
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  const closeDetail = quality.tier === 'high' || quality.tier === 'ultra';
  const trimDetail = quality.tier !== 'low';

  function place(plot: Plot, geometry: THREE.BufferGeometry, material: THREE.Material, color: number,
    x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0, roll = 0,
  ): void {
    const key = `${Math.floor(plot.z / 120)}:${geometry.id}:${material.id}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometry, material, placements: [], castShadow: material === masonry };
      batches.set(key, batch);
    }
    transform.position.set(x, y, z);
    transform.rotation.set(0, yaw, roll, 'YXZ');
    transform.scale.set(w, h, d);
    transform.updateMatrix();
    batch.placements.push({ matrix: transform.matrix.clone(), color });
  }

  for (const [id, plot] of layout.plots.entries()) {
    const style = STYLES[plot.district];
    const rand = mulberry32(6843 + id * 313);
    const wall = style.walls[Math.floor(rand() * style.walls.length)];
    const trim = style.trim;
    const tower = plot.district === 'downtown';
    const shop = plot.district === 'commercial' || plot.district === 'coastal';
    const home = plot.district === 'residential';
    const warehouse = plot.district === 'industrial';
    const floors = Math.max(1, Math.round((plot.h - style.ground) / style.floor));
    const height = style.ground + floors * style.floor;
    const podium = tower ? 1.1 : 1;
    const roofRise = home ? plot.w * .17 : 0;
    const put = (material: THREE.Material, color: number, x: number, y: number, z: number,
      w: number, h: number, d: number, yaw = 0, roll = 0,
    ) => place(plot, box, material, color, plot.x + x, y, plot.z + z, w, h, d, yaw, roll);

    result.push({
      minX: plot.x - plot.w * podium / 2, maxX: plot.x + plot.w * podium / 2,
      minZ: plot.z - plot.d * podium / 2, maxZ: plot.z + plot.d * podium / 2,
      maxY: height + (home ? roofRise : tower ? 1.7 : .65),
    });

    put(masonry, 0x9e9b8e, 0, .12, 0, plot.w * podium, .24, plot.d * podium);
    put(masonry, 0x616462, 0, height - .04, 0, plot.w, .24, plot.d);
    if (home) {
      place(plot, gable, masonry, wall, plot.x, height, plot.z, plot.w, roofRise, plot.d);
      const pitch = Math.atan2(roofRise, plot.w / 2);
      const tile = [0x775347, 0x564e4c, 0x926953][id % 3];
      for (const side of [-1, 1]) {
        put(masonry, tile, side * plot.w / 4, height + roofRise / 2, 0,
          Math.hypot(roofRise, plot.w / 2) + .42, .15, plot.d + .65, 0, -side * pitch);
      }
    } else {
      for (const side of [-1, 1]) {
        put(masonry, trim, 0, height + .26, side * (plot.d / 2 - .09), plot.w, .55, .18);
        put(masonry, trim, side * (plot.w / 2 - .09), height + .26, 0, .18, .55, plot.d - .36);
      }
      if (tower) put(masonry, 0x646b6e, -plot.w * .13, height + .65, 0, plot.w * .42, 1.4, plot.d * .42);
      if (trimDetail) {
        put(metal, 0x929994, plot.w * .23, height + .45, plot.d * .24, 1.65, .75, 1.0);
        put(metal, 0x525957, plot.w * .23, height + .84, plot.d * .24, 1.37, .07, .72);
      }
    }

    for (const { face, angle } of FACES) {
      const front = face === plot.face;
      const sideWall = face === 'east' || face === 'west';
      const width = sideWall ? plot.d : plot.w;
      const depth = (sideWall ? plot.w : plot.d) / 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const part = (material: THREE.Material, color: number, along: number, y: number, inset: number,
        w: number, h: number, d: number, geometry: THREE.BufferGeometry = box,
      ) => place(plot, geometry, material, color,
        plot.x + along * cos + inset * sin, y, plot.z - along * sin + inset * cos,
        w, h, d, angle);

      for (let level = 0; level <= floors; level++) {
        const ground = level === 0;
        const base = ground ? 0 : style.ground + (level - 1) * style.floor;
        const floorHeight = ground ? style.ground : style.floor;
        const shell = ground ? podium : 1;
        const facadeWidth = width * shell;
        const outer = depth * shell;
        const thickness = .25;
        const bays = Math.max(2, Math.round(facadeWidth / style.bay));
        const spacing = facadeWidth / bays;
        const shopFront = ground && front && (shop || tower);
        const loadingDoor = ground && front && warehouse;
        const sill = shopFront || loadingDoor ? .19 : ground ? .88 : tower ? .59 : .78;
        const head = floorHeight - (tower ? .52 : .63);
        const opening = spacing * (shopFront || loadingDoor || tower ? .83 : home ? .53 : .63);
        const bandTint = ground && !home ? trim : wall;

        // Continuous spandrels and individual piers surround a recessed opening.
        part(masonry, bandTint, 0, base + sill / 2, outer - thickness / 2, facadeWidth, sill, thickness);
        part(masonry, bandTint, 0, base + (head + floorHeight) / 2, outer - thickness / 2,
          facadeWidth, floorHeight - head, thickness);
        for (let bay = 0; bay <= bays; bay++) {
          const along = -facadeWidth / 2 + bay * spacing;
          const corner = bay === 0 || bay === bays;
          const pier = spacing - opening;
          part(masonry, bandTint, along + (corner ? (bay === 0 ? 1 : -1) * pier / 4 : 0),
            base + (head + sill) / 2, outer - thickness / 2, corner ? pier / 2 : pier, head - sill, thickness);
        }
        for (let bay = 0; bay < bays; bay++) {
          const along = -facadeWidth / 2 + (bay + .5) * spacing;
          const middle = base + (head + sill) / 2;
          const door = loadingDoor && bay % 2 === 0;
          const warmPane = rand() < (shopFront ? .47 : .12);
          const paneTint = tower ? [0x305566, 0x4b7180, 0x3e606e][bay % 3] : 0x405250;
          part(door ? metal : warmPane ? interior : glass, door ? 0x727a78 : warmPane ? 0xa48962 : paneTint,
            along, middle, outer - .224, opening + .015, head - sill + .015, 1, quad);
          if (trimDetail) {
            const frame = tower || warehouse ? 0x4b5859 : trim;
            for (const side of [-1, 1]) part(metal, frame, along + side * opening / 2,
              middle, outer - .18, .058, head - sill, 1, quad);
            if (!tower || ground) part(masonry, trim, along, base + sill, outer - .07, opening + .18, .08, .31);
            if (!door && (shopFront || closeDetail)) part(metal, frame, along,
              middle, outer - .19, .044, head - sill, 1, quad);
            if (door) {
              for (let seam = .28; seam < head - sill; seam += .28) {
                part(metal, 0x4b5353, along, base + sill + seam, outer - .213, opening, .029, 1, quad);
              }
            }
          }
        }
        if (front && !ground && (shop || home) && !warehouse && (closeDetail || level === 1)) {
          const balconyWidth = Math.min(width * .66, 8);
          part(masonry, trim, 0, base + .64, outer + .34, balconyWidth, .16, .95);
          part(metal, 0x495656, 0, base + 1.55, outer + .76, balconyWidth, .055, .07);
          const posts = closeDetail ? Math.ceil(balconyWidth / .48) : 4;
          for (let i = 0; i <= posts; i++) part(metal, 0x495656, (i / posts - .5) * balconyWidth,
            base + 1.13, outer + .76, .034, .84, .05);
          for (const side of [-1, 1]) part(metal, 0x495656, side * balconyWidth / 2,
            base + 1.55, outer + .38, .055, .07, .78);
        }
      }

      if (front && shop) {
        const sign = signage[id % signage.length];
        const signWidth = Math.min(5.8, width * .57);
        part(metal, 0x656761, 0, style.ground - .33, depth + .015, signWidth + .1, .66, .07);
        part(sign, 0xffffff, 0, style.ground - .33, depth + .056, signWidth, .57, 1, quad);
        part(masonry, id % 2 === 0 ? 0x576f64 : 0xa36f55, 0, style.ground - .79, depth + .45,
          signWidth + .6, .13, 1.05);
      }
      if (front && warehouse) {
        part(metal, 0x546061, 0, style.ground - .42, depth + .43, width * .8, .16, 1.06);
        part(signage[4], 0xffffff, 0, style.ground + .63, depth + .016, Math.min(5.1, width * .58), .53, 1, quad);
      }
    }
  }

  const district = new THREE.Group();
  district.name = 'city-architecture';
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.placements.length);
    batch.placements.forEach(({ matrix, color }, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, tint.setHex(color));
    });
    mesh.computeBoundingSphere();
    mesh.castShadow = batch.castShadow;
    mesh.receiveShadow = true;
    district.add(mesh);
  }
  parent.add(district);
  return result;
}
