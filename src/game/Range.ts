/**
 * The Sunset Range — a target-practice range on the north beach
 * (original design, in the game's own style: sand, a berm
 * backstop, ring targets and a weapon rack — no copied range from
 * any reference screenshot).
 *
 * Layout: the firing line is at (165,-95), shooting north. Six
 * ring targets stand in three rows — 15 m, 30 m and 45 m out —
 * so the sidearm (40 m range) reaches the first two rows and the
 * carbine (80 m) reaches all three. A hit knocks a target flat;
 * it pops back up after 3 s. The weapon rack at (156,-90) is the
 * range's interactable: buy the carbine, restock ammo.
 *
 * Hit testing is analytical (ray vs sphere per target), so it is
 * exact and cheap — no Raycaster against merged city geometry.
 * The range lives on the scene (not in the world handle), so a
 * quality rebuild never wipes the targets out; its collision
 * boxes are re-registered by the engine after a rebuild.
 */
import * as THREE from 'three';
import type { BuildingBox } from './World';

export interface TargetDef {
  id: string;
  x: number;
  z: number;
  /** Distance from the firing line, in metres. */
  distance: number;
}

export const TARGET_DEFS: TargetDef[] = [
  { id: 'near-left', x: 160, z: -110, distance: 15 },
  { id: 'near-right', x: 170, z: -110, distance: 15 },
  { id: 'mid-left', x: 160, z: -125, distance: 30 },
  { id: 'mid-right', x: 170, z: -125, distance: 30 },
  { id: 'far-left', x: 160, z: -140, distance: 45 },
  { id: 'far-right', x: 170, z: -140, distance: 45 },
];

export const RANGE_LINE = { x: 165, z: -95 };
export const RANGE_RACK = { x: 156, z: -90 };
export const RANGE_SIGN = { x: 174, z: -92 };

const TARGET_RADIUS = 0.6;
const RESET_SECONDS = 3;

export interface TargetState {
  id: string;
  down: boolean;
}

export interface RangeHandle {
  update: (dt: number) => void;
  /** Nearest standing target the ray hits within maxDist, or null. */
  hitTest: (
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
  ) => { id: string; point: THREE.Vector3; dist: number } | null;
  knockDown: (id: string) => void;
  getTargetStates: () => TargetState[];
  collisionBoxes: () => BuildingBox[];
  dispose: () => void;
}

function makeTargetTexture(track: <T extends { dispose(): void }>(r: T) => T): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e8ddc4';
  ctx.fillRect(0, 0, 128, 128);
  const rings: Array<[number, string]> = [
    [60, '#b33a2e'],
    [48, '#e8ddc4'],
    [36, '#b33a2e'],
    [24, '#e8ddc4'],
    [12, '#2e2a33'],
  ];
  for (const [r, colour] of rings) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(64, 64, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(track: <T extends { dispose(): void }>(r: T) => T): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2e2a33';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#d8a24a';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 172);
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SUNSET RANGE', 256, 78);
  ctx.fillStyle = '#e8ddc4';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('TARGET PRACTICE · EST. 1986', 256, 140);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRange(scene: THREE.Scene): RangeHandle {
  const group = new THREE.Group();
  group.name = 'sunset-range';
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  const sandMat = track(new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 1 }));
  const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x3a352f, roughness: 0.9 }));
  const woodMat = track(new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 }));
  const steelMat = track(new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.5 }));
  const targetTex = makeTargetTexture(track);
  const signTex = makeSignTexture(track);

  const add = (
    parent: THREE.Group | THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // ---- Backstop berm: the sand wall the targets stand in front of ----
  add(group, track(new THREE.BoxGeometry(32, 2.6, 2)), sandMat, 165, 1.3, -152);
  add(group, track(new THREE.BoxGeometry(32, 0.4, 2.2)), darkMat, 165, 2.7, -152);

  // ---- Targets: post + a ring board on a fall pivot ----
  interface TargetRuntime {
    def: TargetDef;
    pivot: THREE.Group;
    centre: THREE.Vector3;
    down: boolean;
    downAt: number;
  }
  const targets: TargetRuntime[] = [];
  const boardGeo = track(new THREE.CylinderGeometry(TARGET_RADIUS, TARGET_RADIUS, 0.06, 24));
  const boardMat = track(new THREE.MeshStandardMaterial({ map: targetTex, roughness: 0.85 }));
  const postGeo = track(new THREE.BoxGeometry(0.09, 1.5, 0.09));
  for (const def of TARGET_DEFS) {
    add(group, postGeo, woodMat, def.x, 0.75, def.z);
    const pivot = new THREE.Group();
    pivot.position.set(def.x, 1.45, def.z);
    group.add(pivot);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.rotation.x = Math.PI / 2; // face south, toward the firing line
    board.castShadow = true;
    pivot.add(board);
    targets.push({
      def,
      pivot,
      centre: new THREE.Vector3(def.x, 1.45, def.z),
      down: false,
      downAt: 0,
    });
  }

  // ---- Firing line: a painted strip on the sand ----
  const line = add(group, track(new THREE.PlaneGeometry(8, 0.35)), track(new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.9 })), RANGE_LINE.x, 0.04, RANGE_LINE.z);
  line.rotation.x = -Math.PI / 2;
  line.receiveShadow = true;

  // ---- Weapon rack: a table with two silhouette rifles + a sign ----
  add(group, track(new THREE.BoxGeometry(2.4, 0.08, 1)), woodMat, RANGE_RACK.x, 0.9, RANGE_RACK.z);
  for (const [lx, lz] of [[-1.1, -0.4], [1.1, -0.4], [-1.1, 0.4], [1.1, 0.4]] as const) {
    add(group, track(new THREE.BoxGeometry(0.08, 0.9, 0.08)), woodMat, RANGE_RACK.x + lx, 0.45, RANGE_RACK.z + lz);
  }
  // Two rifle silhouettes lying on the table (dark boxes, no detail).
  add(group, track(new THREE.BoxGeometry(0.06, 0.05, 0.9)), steelMat, RANGE_RACK.x - 0.4, 0.97, RANGE_RACK.z);
  add(group, track(new THREE.BoxGeometry(0.06, 0.05, 0.7)), steelMat, RANGE_RACK.x + 0.5, 0.97, RANGE_RACK.z + 0.1);

  // ---- Range sign on two posts, facing the approach from the south ----
  for (const s of [-1.6, 1.6]) {
    add(group, track(new THREE.BoxGeometry(0.12, 2.2, 0.12)), woodMat, RANGE_SIGN.x + s, 1.1, RANGE_SIGN.z);
  }
  add(
    group,
    track(new THREE.BoxGeometry(3.6, 1.3, 0.08)),
    track(new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.85 })),
    RANGE_SIGN.x,
    2.0,
    RANGE_SIGN.z,
  );
  // The box's +z face carries the sign texture and faces south,
  // toward the approach from the beach.

  // ---- Sandbags by the firing line ----
  add(group, track(new THREE.BoxGeometry(1.6, 0.4, 0.6)), sandMat, 158, 0.2, -93);
  add(group, track(new THREE.BoxGeometry(1.2, 0.4, 0.6)), sandMat, 172, 0.2, -93);

  scene.add(group);

  const boxes: BuildingBox[] = [
    { minX: 149, maxX: 181, minZ: -154, maxZ: -150, maxY: 2.5 }, // backstop berm
    { minX: RANGE_RACK.x - 1.3, maxX: RANGE_RACK.x + 1.3, minZ: RANGE_RACK.z - 0.6, maxZ: RANGE_RACK.z + 0.6, maxY: 1.2 }, // rack
    { minX: RANGE_SIGN.x - 1.9, maxX: RANGE_SIGN.x + 1.9, minZ: RANGE_SIGN.z - 0.2, maxZ: RANGE_SIGN.z + 0.2, maxY: 3 }, // sign
  ];

  let elapsed = 0;
  return {
    update: (dt: number) => {
      elapsed += dt;
      for (const t of targets) {
        // Fall flat when hit, pop back up after 3 s. The pivot
        // eases so the fall reads instead of snapping.
        const targetRot = t.down ? -Math.PI / 2 : 0;
        t.pivot.rotation.x += (targetRot - t.pivot.rotation.x) * Math.min(1, dt * 8);
        if (t.down && elapsed - t.downAt > RESET_SECONDS) {
          t.down = false;
        }
      }
    },
    hitTest: (origin, dir, maxDist) => {
      let best: { id: string; point: THREE.Vector3; dist: number } | null = null;
      for (const t of targets) {
        if (t.down) continue;
        // Ray vs sphere: |origin + t*dir - centre|^2 = r^2.
        const ox = origin.x - t.centre.x;
        const oy = origin.y - t.centre.y;
        const oz = origin.z - t.centre.z;
        const b = ox * dir.x + oy * dir.y + oz * dir.z;
        const c = ox * ox + oy * oy + oz * oz - TARGET_RADIUS * TARGET_RADIUS;
        const disc = b * b - c;
        if (disc < 0) continue;
        const d = -b - Math.sqrt(disc);
        if (d < 0 || d > maxDist) continue;
        if (best && d >= best.dist) continue;
        best = {
          id: t.def.id,
          point: new THREE.Vector3(origin.x + dir.x * d, origin.y + dir.y * d, origin.z + dir.z * d),
          dist: d,
        };
      }
      return best;
    },
    knockDown: (id: string) => {
      const t = targets.find((x) => x.def.id === id);
      if (!t || t.down) return;
      t.down = true;
      t.downAt = elapsed;
    },
    getTargetStates: () => targets.map((t) => ({ id: t.def.id, down: t.down })),
    collisionBoxes: () => boxes,
    dispose: () => {
      scene.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* already disposed */
        }
      }
    },
  };
}
