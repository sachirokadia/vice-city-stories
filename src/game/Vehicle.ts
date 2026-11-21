/**
 * Drivable cars — original procedural designs built from Three.js
 * geometry, one per vehicle spec (see VehicleCatalog.ts). The
 * Velocity GT keeps its exact Phase 3 shape and feel; the other
 * three are visually distinct builds from the same architecture:
 * the Shadow LX is a long low sedan with a lip spoiler, the Vortex
 * RS a wide low coupe with a big wing, the Trailhawk X a tall boxy
 * SUV on big wheels with a roof rack.
 *
 * Driving is an arcade kinematic model (no physics engine): smooth
 * acceleration, speed-sensitive steering, braking, reverse and a
 * handbrake. Collision is two circles (front/rear axle) against the
 * same building boxes the player uses, so the car can never pass
 * through a wall — it bumps and slows instead. Top speed,
 * acceleration and handling come from the spec + the garage's
 * upgrade levels, so every car drives differently and an upgrade
 * changes the real numbers, not just the display.
 */
import * as THREE from 'three';
import type { InputState } from './Input';
import { effectiveMove } from './Input';
import type { BuildingBox } from './World';
import { GeometryBatch, composeMatrix } from './Merge';
import type { VehicleSpec } from './VehicleCatalog';
import { VEHICLE_SPECS, VELOCITY_GT_ID } from './VehicleCatalog';
import type { EffectiveStats, VehicleUpgrades } from './GarageProgress';
import { effectiveStats, emptyUpgrades } from './GarageProgress';

export type Gear = 'R' | 'N' | 'D';

export interface VehicleHandle {
  group: THREE.Group;
  name: string;
  /** Spec id (e.g. 'velocity-gt') — the display name is `name`. */
  id: string;
  /** Per-vehicle paint + glass materials (Stage 1 probe assignment reads these). */
  paintMat: THREE.MeshPhysicalMaterial;
  glassMat: THREE.MeshStandardMaterial;
  position: THREE.Vector3;
  heading: number;
  speed: number;
  update: (dt: number, input: InputState, buildings: BuildingBox[]) => void;
  gear: () => Gear;
  speedKmh: () => number;
  /** Park the car: zero speed and straighten the wheels. */
  stop: () => void;
  /** Restore a speed (used when the world is rebuilt on a preset change). */
  setSpeed: (v: number) => void;
  /** Repaint the body (garage). */
  setPaint: (hex: number) => void;
  /** Apply new driving stats (garage upgrades). */
  setTuning: (tuning: EffectiveStats) => void;
  /** The driving stats this car is running on (QA + garage). */
  getTuning: () => EffectiveStats;
  dispose: () => void;
}

export interface VehicleOptions {
  spec?: VehicleSpec;
  /** Paint hex; defaults to the spec's factory colour. */
  paint?: number;
  upgrades?: VehicleUpgrades;
}

const MAX_REVERSE = 10;
const REVERSE_ACCEL = 10;
const BRAKE_DECEL = 26;
const HANDBRAKE_DECEL = 20;
const WHEELBASE = 2.75;
const CAR_RADIUS = 1.15; // per axle circle
const AXLE_OFFSET = 1.1;
const WORLD_BOUND = 195;

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(target, value + maxDelta);
  return Math.max(target, value - maxDelta);
}

/** The extruded side profile: the car's silhouette, front = +x. */
function buildBodyShape(spec: VehicleSpec): THREE.Shape {
  const L = spec.length;
  const H = spec.bodyHeight;
  const s = new THREE.Shape();
  if (spec.boxy) {
    // Tall, flat, near-vertical — an SUV, not a sports car.
    s.moveTo(0, 0.15);
    s.lineTo(0, H * 0.9);
    s.lineTo(L * 0.12, H);
    s.lineTo(L * 0.78, H);
    s.lineTo(L * 0.93, H * 0.72);
    s.lineTo(L, H * 0.5);
    s.lineTo(L, 0.16);
    s.lineTo(L, 0.14);
    s.lineTo(0, 0.14);
    s.closePath();
    return s;
  }
  // Sleek curved profile (the GT's, scaled to this car's size).
  const sx = L / 4.42;
  const sy = H / 0.68;
  s.moveTo(0, 0.15 * sy);
  s.lineTo(0, 0.55 * sy);
  s.quadraticCurveTo(0.3 * sx, 0.68 * sy, 0.7 * sx, 0.67 * sy);
  s.lineTo(1.5 * sx, 0.64 * sy);
  s.lineTo(2.7 * sx, 0.58 * sy);
  s.quadraticCurveTo(3.6 * sx, 0.5 * sy, 4.1 * sx, 0.36 * sy);
  s.quadraticCurveTo(4.42 * sx, 0.28 * sy, 4.42 * sx, 0.16 * sy);
  s.lineTo(4.42 * sx, 0.14 * sy);
  s.lineTo(0, 0.14 * sy);
  s.closePath();
  return s;
}

/** The glasshouse: narrower than the body, sitting on its top. */
function buildCabinShape(spec: VehicleSpec): THREE.Shape {
  const L = spec.length;
  const H = spec.bodyHeight;
  const base = H - 0.08;
  const top = base + spec.cabinHeight;
  const start = L * spec.cabinStart;
  const end = L * spec.cabinEnd;
  const slope = 0.4;
  const s = new THREE.Shape();
  s.moveTo(start, base);
  s.lineTo(start + slope, top);
  s.lineTo(end - slope, top);
  s.lineTo(end, base);
  s.closePath();
  return s;
}

export interface VehicleMesh {
  group: THREE.Group;
  spinGroups: THREE.Group[];
  steerPivots: THREE.Group[];
  paintMat: THREE.MeshPhysicalMaterial;
  glassMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

/**
 * G1.2 crown prototype (Velocity GT only) — crowned side panels.
 *
 * The body's side panels are the two flat cap faces of the extrusion:
 * one normal each, no interior vertices, so the Stage 1 probe reads as
 * one uniform colour per panel. This replaces each flat cap with a
 * low-density crowned grid whose normals vary continuously across the
 * panel (sky at the top edge, towers mid-panel, road at the bottom).
 *
 * Width budget (the explicit approval): maximum width 1.76 m -> 1.79 m,
 * i.e. 0.03 m of total width — so the per-side crown peak is 0.015 m.
 * The investigation called this a "3 cm crown": that is the total across
 * both sides. A 0.03 m per-side crown would make the car 1.82 m wide and
 * exceed the approved budget, so it is NOT used here.
 */
const SIDE_CROWN_M = 0.015;
/** Crown grid: 6 columns along the car's length, 4 rows up its height (24 quads = 48 tris per side). */
const CROWN_COLS = 6;
const CROWN_ROWS = 4;
/** Tolerance when recognising the flat side-cap triangles (car-space x at the cap plane). */
const CAP_EPS = 0.005;

/** The body outline as a polygon in car space (z = length, y = height). */
function bodyOutlinePoints(shape: THREE.Shape, spec: VehicleSpec): Array<{ z: number; y: number }> {
  // getPoints(12) matches the extrusion's own curve subdivision (default curveSegments 12).
  return shape.getPoints(12).map((p) => ({ z: p.x - spec.length / 2, y: p.y + spec.rideHeight }));
}

/**
 * Top and bottom of the outline at a given length position, by scanning
 * the polygon edges with a vertical line. Returns [bottom, top].
 */
function outlineTopBottom(pts: Array<{ z: number; y: number }>, z: number): [number, number] {
  let top = -Infinity;
  let bottom = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const zMin = Math.min(a.z, b.z);
    const zMax = Math.max(a.z, b.z);
    if (z < zMin || z > zMax) continue;
    if (zMax - zMin < 1e-9) {
      // Vertical edge: contributes both endpoints when the column sits on it.
      top = Math.max(top, a.y, b.y);
      bottom = Math.min(bottom, a.y, b.y);
    } else {
      const t = (z - a.z) / (b.z - a.z);
      const y = a.y + t * (b.y - a.y);
      top = Math.max(top, y);
      bottom = Math.min(bottom, y);
    }
  }
  return [bottom, top];
}

/**
 * One crowned side panel as an indexed BufferGeometry (shared vertices,
 * smooth normals). `side` is +1 for the right (+X) panel, -1 for the
 * left. The grid conforms to the outline: each column's rows run from
 * the outline's bottom to its top at that length, so every boundary
 * vertex sits exactly on the original outline at the cap plane. The
 * crown is zero at every boundary (sin(pi*u) * sin(pi*v)) and peaks at
 * the panel centre, so the panel meets the existing bevel with no seam.
 * Winding is opposite per side so both panels face outward (verified by
 * the QA probe: panel normals must average to +/-X).
 */
function buildCrownPanel(
  outline: Array<{ z: number; y: number }>,
  spec: VehicleSpec,
  side: 1 | -1,
): THREE.BufferGeometry {
  const capX = spec.width / 2; // the cap plane (maximum width before the crown)
  const zMin = -spec.length / 2;
  const zMax = spec.length / 2;
  const cols = CROWN_COLS;
  const rows = CROWN_ROWS;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const z = zMin + u * (zMax - zMin);
      const [yBottom, yTop] = outlineTopBottom(outline, z);
      const y = yBottom + v * (yTop - yBottom);
      const crown = SIDE_CROWN_M * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      positions.push(side * (capX + crown), y, z);
      uvs.push(u, v);
    }
  }
  const stride = cols + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * stride + i;
      const b = j * stride + i + 1;
      const c = (j + 1) * stride + i + 1;
      const d = (j + 1) * stride + i;
      if (side === 1) index.push(a, c, b, a, d, c);
      else index.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Replace the two flat side-cap surfaces of an extruded body with
 * crowned panels, and return the merged body geometry (one mesh, one
 * material, zero new draw calls). The original flat cap triangles are
 * removed, not left underneath (leaving them would z-fight with the
 * panels). The bevel, walls, cabin and details are untouched: only
 * triangles whose three vertices all carry the flat side normal at the
 * cap plane are removed. The panels are built indexed with smooth
 * normals, then de-indexed for the merge — the smooth normals were
 * averaged while the vertices were shared, so de-indexing keeps them.
 * The input geometry is not mutated and not disposed here (the caller
 * owns it via track()).
 */
function replaceBodyCapsWithCrown(
  bodyGeo: THREE.BufferGeometry,
  shape: THREE.Shape,
  spec: VehicleSpec,
): THREE.BufferGeometry {
  const pos = bodyGeo.attributes.position as THREE.BufferAttribute;
  const nor = bodyGeo.attributes.normal as THREE.BufferAttribute;
  const uv = bodyGeo.attributes.uv as THREE.BufferAttribute;
  const triCount = pos.count / 3;
  const capX = spec.width / 2;
  const keptPos: number[] = [];
  const keptNor: number[] = [];
  const keptUv: number[] = [];
  let removed = 0;
  for (let t = 0; t < triCount; t++) {
    let isCap = true;
    for (let k = 0; k < 3; k++) {
      const vi = t * 3 + k;
      const nx = nor.getX(vi);
      const ny = nor.getY(vi);
      const nz = nor.getZ(vi);
      const x = pos.getX(vi);
      if (
        !(Math.abs(nx) > 0.99 && Math.abs(ny) < 0.01 && Math.abs(nz) < 0.01 &&
          Math.abs(Math.abs(x) - capX) < CAP_EPS)
      ) {
        isCap = false;
        break;
      }
    }
    if (isCap) {
      removed++;
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const vi = t * 3 + k;
      keptPos.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
      keptNor.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
      keptUv.push(uv.getX(vi), uv.getY(vi));
    }
  }
  // Tripwire: if no cap triangle was found, the panels would sit on top
  // of the flat caps and z-fight. Warn loudly instead of failing silent.
  if (removed === 0) console.warn('[vcs] crown: no flat cap triangles found, panels added over the caps');
  const outline = bodyOutlinePoints(shape, spec);
  const panelR = buildCrownPanel(outline, spec, 1).toNonIndexed();
  const panelL = buildCrownPanel(outline, spec, -1).toNonIndexed();
  const sources = [
    {
      position: new Float32Array(keptPos),
      normal: new Float32Array(keptNor),
      uv: new Float32Array(keptUv),
    },
    ...[panelR, panelL].map((p) => ({
      position: (p.attributes.position as THREE.BufferAttribute).array as Float32Array,
      normal: (p.attributes.normal as THREE.BufferAttribute).array as Float32Array,
      uv: (p.attributes.uv as THREE.BufferAttribute).array as Float32Array,
    })),
  ];
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const itemSize = name === 'uv' ? 2 : 3;
    let total = 0;
    for (const s of sources) total += s[name].length;
    const arr = new Float32Array(total);
    let offset = 0;
    for (const s of sources) {
      arr.set(s[name], offset);
      offset += s[name].length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }
  panelR.dispose();
  panelL.dispose();
  return merged;
}

/**
 * The car as a mesh only (no physics) — the garage's 3D preview
 * renders this in its own small scene. createVehicle builds the
 * same mesh and adds the driving behaviour around it.
 */
export function buildVehicleMesh(spec: VehicleSpec, paintHex: number): VehicleMesh {
  const group = new THREE.Group();
  group.name = spec.id;
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  const L = spec.length;
  const W = spec.width;
  const H = spec.bodyHeight;
  const rh = spec.rideHeight;

  const paintMat = track(
    new THREE.MeshPhysicalMaterial({
      color: paintHex,
      metalness: 0.55,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    }),
  );
  const glassMat = track(
    new THREE.MeshStandardMaterial({ color: 0x0e1418, metalness: 0.9, roughness: 0.12 }),
  );
  const trimMat = track(new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.6, metalness: 0.4 }));
  const tireMat = track(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }));
  const rimMat = track(new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.25 }));
  const headMat = track(
    new THREE.MeshStandardMaterial({ color: 0xfff8d8, emissive: 0xfff3c0, emissiveIntensity: 2 }),
  );
  const tailMat = track(
    new THREE.MeshStandardMaterial({ color: 0x7a0d0d, emissive: 0xff2020, emissiveIntensity: 1.8 }),
  );

  // --- Body: extruded side profile (front = +Z after the rotation) ---
  const bodyShape = buildBodyShape(spec);
  const bodyGeo = track(
    new THREE.ExtrudeGeometry(bodyShape, {
      depth: W - 0.1,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
      steps: 1,
    }),
  );
  bodyGeo.rotateY(-Math.PI / 2);
  bodyGeo.translate((W - 0.1) / 2, rh, -L / 2);
  // G1.2 crown prototype — Velocity GT only: replace the two flat side
  // caps with crowned grids (max width 1.76 -> 1.79 m, see SIDE_CROWN_M).
  // Every other vehicle keeps the plain extrusion. The original geometry
  // stays tracked for disposal; the replacement is tracked too.
  const finalBodyGeo =
    spec.id === VELOCITY_GT_ID ? track(replaceBodyCapsWithCrown(bodyGeo, bodyShape, spec)) : bodyGeo;
  const body = new THREE.Mesh(finalBodyGeo, paintMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // --- Cabin: extruded glasshouse, narrower than the body ---
  const cabinGeo = track(
    new THREE.ExtrudeGeometry(buildCabinShape(spec), {
      depth: W - 0.36,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 1,
      steps: 1,
    }),
  );
  cabinGeo.rotateY(-Math.PI / 2);
  cabinGeo.translate((W - 0.36) / 2, rh, -L / 2);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.castShadow = true;
  group.add(cabin);

  // --- Wheels: steer pivots up front, all four spin with speed ---
  const tireGeo = track(new THREE.CylinderGeometry(spec.wheelRadius, spec.wheelRadius, spec.tireWidth, 20));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = track(
    new THREE.CylinderGeometry(spec.wheelRadius * 0.58, spec.wheelRadius * 0.58, spec.tireWidth + 0.02, 12),
  );
  rimGeo.rotateZ(Math.PI / 2);
  const spinGroups: THREE.Group[] = [];
  const steerPivots: THREE.Group[] = [];
  const axleZ = L * 0.32;
  const wheelX = W / 2 - 0.08;
  for (const [x, z, front] of [
    [-wheelX, axleZ, true],
    [wheelX, axleZ, true],
    [-wheelX, -axleZ, false],
    [wheelX, -axleZ, false],
  ] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(x, spec.wheelRadius, z);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    spin.add(tire, rim);
    pivot.add(spin);
    group.add(pivot);
    spinGroups.push(spin);
    if (front) steerPivots.push(pivot);
  }

  // --- Details: lights, grille, mirrors, spoiler, exhausts ---
  // Batched by material: one merged mesh per material.
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  const detailBatches = new Map<THREE.Material, GeometryBatch>();
  const detailBatchFor = (mat: THREE.Material): GeometryBatch => {
    let b = detailBatches.get(mat);
    if (!b) {
      b = new GeometryBatch();
      detailBatches.set(mat, b);
    }
    return b;
  };
  const addDetail = (
    mat: THREE.Material,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ): void => {
    detailBatchFor(mat).add(unitBox, composeMatrix(x, y, z, 0, w, h, d));
  };
  const frontZ = L / 2 + 0.03;
  const rearZ = -L / 2 - 0.03;
  addDetail(headMat, 0.34, 0.1, 0.06, -W * 0.31, H * 0.75 + rh, frontZ);
  addDetail(headMat, 0.34, 0.1, 0.06, W * 0.31, H * 0.75 + rh, frontZ);
  addDetail(tailMat, W * 0.68, 0.09, 0.06, 0, H * 0.85 + rh, rearZ);
  addDetail(trimMat, W * 0.51, 0.14, 0.05, 0, 0.34 + rh, frontZ);
  addDetail(trimMat, W * 0.97, 0.16, 0.12, 0, 0.2 + rh, frontZ); // front bumper
  addDetail(trimMat, W * 0.97, 0.16, 0.12, 0, 0.2 + rh, rearZ); // rear bumper
  if (spec.spoiler === 'wing') {
    addDetail(paintMat, W * 0.85, 0.05, 0.3, 0, H + 0.16 + rh, rearZ + 0.2);
    addDetail(trimMat, 0.08, 0.18, 0.08, -0.5, H + 0.06 + rh, rearZ + 0.2);
    addDetail(trimMat, 0.08, 0.18, 0.08, 0.5, H + 0.06 + rh, rearZ + 0.2);
  } else if (spec.spoiler === 'lip') {
    addDetail(paintMat, W * 0.8, 0.04, 0.18, 0, H + 0.02 + rh, rearZ + 0.12);
  } else if (spec.spoiler === 'rack') {
    // Roof rails + one cross bar, on top of the glasshouse.
    const rackY = H + spec.cabinHeight + 0.03 + rh;
    addDetail(trimMat, 0.06, 0.06, L * 0.5, -W * 0.3, rackY, 0);
    addDetail(trimMat, 0.06, 0.06, L * 0.5, W * 0.3, rackY, 0);
    addDetail(trimMat, W * 0.6, 0.05, 0.06, 0, rackY, L * 0.2);
  }
  addDetail(trimMat, 0.16, 0.1, 0.08, -(W / 2 + 0.06), H + 0.24 + rh, L * 0.16); // mirrors
  addDetail(trimMat, 0.16, 0.1, 0.08, W / 2 + 0.06, H + 0.24 + rh, L * 0.16);
  addDetail(trimMat, 0.16, 0.03, 0.03, -(W / 2 + 0.01), H * 0.9 + rh, -L * 0.07); // door handles
  addDetail(trimMat, 0.16, 0.03, 0.03, W / 2 + 0.01, H * 0.9 + rh, -L * 0.07);
  const exhaustGeo = track(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10));
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaustBatch = new GeometryBatch();
  for (const x of [-0.35, 0.35]) {
    exhaustBatch.add(exhaustGeo, composeMatrix(x, 0.2 + rh, rearZ - 0.04, 0, 1, 1, 1));
  }
  for (const [mat, b] of detailBatches) {
    const geo = b.build();
    if (!geo) continue;
    group.add(new THREE.Mesh(track(geo), mat));
  }
  const exhaustMerged = exhaustBatch.build();
  if (exhaustMerged) group.add(new THREE.Mesh(track(exhaustMerged), rimMat));

  return {
    group,
    spinGroups,
    steerPivots,
    paintMat,
    glassMat,
    dispose: () => {
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

export function createVehicle(
  scene: THREE.Scene,
  position: THREE.Vector3,
  heading: number,
  options: VehicleOptions = {},
): VehicleHandle {
  const spec = options.spec ?? VEHICLE_SPECS.find((s) => s.id === VELOCITY_GT_ID) ?? VEHICLE_SPECS[0];
  const paint = options.paint ?? spec.defaultPaint;
  const upgrades = options.upgrades ?? emptyUpgrades();
  const mesh = buildVehicleMesh(spec, paint);
  const { group, spinGroups, steerPivots } = mesh;

  scene.add(group);
  const pos = new THREE.Vector3(position.x, 0, position.z);
  group.position.copy(pos);
  group.rotation.y = heading;

  // Driving stats: spec + garage upgrades. The GT at level 0 is
  // exactly the Phase 3 car (38 m/s, 16 accel, 1.00 handling).
  let tuning: EffectiveStats = effectiveStats(spec, upgrades);
  let speed = 0;
  let steer = 0;

  // Reused scratch vectors: the collision path allocates nothing.
  const axleVec = new THREE.Vector3();
  const pushVec = new THREE.Vector3();
  /** Push one axle circle out of a building box; returns the push in
   * a reused vector, or null when clear. */
  const resolveCircle = (c: THREE.Vector3, buildings: BuildingBox[]): THREE.Vector3 | null => {
    for (const b of buildings) {
      const cx = THREE.MathUtils.clamp(c.x, b.minX, b.maxX);
      const cz = THREE.MathUtils.clamp(c.z, b.minZ, b.maxZ);
      const dx = c.x - cx;
      const dz = c.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq >= CAR_RADIUS * CAR_RADIUS) continue;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        return pushVec.set(cx + (dx / dist) * CAR_RADIUS - c.x, 0, cz + (dz / dist) * CAR_RADIUS - c.z);
      }
      // Centre inside the box: push out along the smallest penetration.
      const pushLeft = c.x - b.minX;
      const pushRight = b.maxX - c.x;
      const pushUp = c.z - b.minZ;
      const pushDown = b.maxZ - c.z;
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) return pushVec.set(b.minX - CAR_RADIUS - c.x, 0, 0);
      if (min === pushRight) return pushVec.set(b.maxX + CAR_RADIUS - c.x, 0, 0);
      if (min === pushUp) return pushVec.set(0, 0, b.minZ - CAR_RADIUS - c.z);
      return pushVec.set(0, 0, b.maxZ + CAR_RADIUS - c.z);
    }
    return null;
  };

  const handle: VehicleHandle = {
    group,
    name: spec.name,
    id: spec.id,
    paintMat: mesh.paintMat,
    glassMat: mesh.glassMat,
    position: pos,
    heading,
    speed: 0,
    update: (dt: number, input: InputState, buildings: BuildingBox[]) => {
      const move = effectiveMove(input);
      const throttle = THREE.MathUtils.clamp(move.y, -1, 1);
      const steerInput = THREE.MathUtils.clamp(move.x, -1, 1);
      const handbrake = input.handbrake;
      const absSpeed = Math.abs(speed);

      // Steering authority falls as speed rises — a parked car turns
      // sharply, a fast car barely does. Handling scales it.
      const maxSteer = (0.55 * tuning.handling) / (1 + absSpeed * 0.055);
      const targetSteer = steerInput * maxSteer * (handbrake ? 1.5 : 1);
      const steerRate = steerInput !== 0 ? 5 : 8;
      steer += (targetSteer - steer) * Math.min(1, dt * steerRate);

      if (handbrake) {
        speed = approach(speed, 0, HANDBRAKE_DECEL * dt);
      } else if (throttle > 0) {
        if (speed < -0.5) speed = approach(speed, 0, BRAKE_DECEL * dt);
        else speed += tuning.accel * throttle * (1 - Math.max(0, speed) / tuning.topSpeed) * dt;
      } else if (throttle < 0) {
        if (speed > 0.5) speed = approach(speed, 0, BRAKE_DECEL * dt);
        else speed += REVERSE_ACCEL * throttle * (1 - Math.abs(Math.min(0, speed)) / MAX_REVERSE) * dt;
      } else {
        speed = approach(speed, 0, 1.5 * dt);
      }
      speed = THREE.MathUtils.clamp(speed, -MAX_REVERSE, tuning.topSpeed);

      // The minus sign is the steering: with forward = (sin h, cos h),
      // a left turn (steer < 0) must increase the heading.
      const drift = handbrake && absSpeed > 6 ? 1.3 : 1;
      const yawRate = (-speed / WHEELBASE) * Math.tan(steer) * drift;
      handle.heading += yawRate * dt;

      const fx = Math.sin(handle.heading);
      const fz = Math.cos(handle.heading);
      pos.x += fx * speed * dt;
      pos.z += fz * speed * dt;

      // Two-circle collision (front + rear axle) — bumps slow the car.
      // Reused temp vectors: no allocation inside the hot loop.
      let hit = false;
      for (const s of [1, -1]) {
        axleVec.set(pos.x + fx * AXLE_OFFSET * s, 0, pos.z + fz * AXLE_OFFSET * s);
        const push = resolveCircle(axleVec, buildings);
        if (push) {
          pos.add(push);
          hit = true;
        }
      }
      if (hit) speed *= 0.5;
      const clampedX = THREE.MathUtils.clamp(pos.x, -WORLD_BOUND, WORLD_BOUND);
      const clampedZ = THREE.MathUtils.clamp(pos.z, -WORLD_BOUND, WORLD_BOUND);
      if (clampedX !== pos.x || clampedZ !== pos.z) {
        pos.x = clampedX;
        pos.z = clampedZ;
        speed *= 0.5;
      }

      // Visuals.
      group.position.copy(pos);
      group.rotation.y = handle.heading;
      for (const s of spinGroups) s.rotation.x += (speed * dt) / spec.wheelRadius;
      // Front wheels point where the car is turning: left = +rotation.
      for (const p of steerPivots) p.rotation.y = -steer;
      handle.speed = speed;
    },
    gear: () => (speed > 0.5 ? 'D' : speed < -0.5 ? 'R' : 'N'),
    speedKmh: () => Math.round(Math.abs(speed) * 3.6),
    stop: () => {
      speed = 0;
      steer = 0;
      handle.speed = 0;
      for (const p of steerPivots) p.rotation.y = 0;
    },
    setSpeed: (v: number) => {
      speed = v;
      handle.speed = v;
    },
    setPaint: (hex: number) => {
      mesh.paintMat.color.setHex(hex);
    },
    setTuning: (next: EffectiveStats) => {
      tuning = { ...next };
    },
    getTuning: () => ({ ...tuning }),
    dispose: () => {
      scene.remove(group);
      mesh.dispose();
    },
  };
  return handle;
}
