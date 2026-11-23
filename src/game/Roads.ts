/**
 * The road network: asphalt streets, sidewalks, curbs, lane markings,
 * crosswalks, streetlights and traffic signals — all drawn from the
 * CityGenerator layout so roads and buildings always agree.
 * Markings, crosswalk stripes and streetlights are InstancedMeshes
 * (a handful of draw calls for hundreds of objects).
 */
import * as THREE from 'three';
import type { QualitySettings } from './Quality';
import type { CityLayout } from './CityGenerator';
import { CITY_HALF } from './CityGenerator';
import type { Track } from './Buildings';
import { GeometryBatch, composeMatrix } from './Merge';

export const SIGNAL_SPOTS: Array<[number, number]> = [
  [0, -30],
  [0, 30],
  [60, -30],
  [60, 30],
  [-60, -30],
  [-60, 30],
];

export interface SignalState {
  /** The 6 signalised intersections [x, z]. */
  spots: Array<[number, number]>;
  /**
   * True while the avenue (north-south) approaches have green.
   * The heads with ry=0 carry their bulbs on the south face, so
   * northbound avenue drivers see them; they show green in phase
   * A. The east-facing heads show green in phase B, for the street
   * approaches. One system: the traffic AI reads this, it never
   * keeps its own light timer.
   */
  isAvenueGreen: () => boolean;
}

export function buildRoads(
  group: THREE.Group,
  layout: CityLayout,
  quality: QualitySettings,
  track: Track,
): { update?: (dt: number) => void; signals: SignalState } {
  const roadMat = track(new THREE.MeshStandardMaterial({ color: 0x1b1920, roughness: 0.95 }));
  const walkMat = track(new THREE.MeshStandardMaterial({ color: 0x55505c, roughness: 0.95 }));
  const curbMat = track(new THREE.MeshStandardMaterial({ color: 0x8a8494, roughness: 0.9 }));
  const edgeMat = track(new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.8 }));
  const dashMat = track(new THREE.MeshStandardMaterial({ color: 0xf2b234, roughness: 0.8 }));
  const crossMat = track(new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.8 }));

  const roadGeo = track(new THREE.PlaneGeometry(1, 1));
  // One merged mesh per road material instead of ~84 separate planes.
  // The plane is rotated flat via the matrix (rx = -PI/2).
  const roadBatch = new GeometryBatch();
  const walkBatch = new GeometryBatch();
  const curbBatch = new GeometryBatch();
  const edgeBatch = new GeometryBatch();
  const addPlane = (batch: GeometryBatch, w: number, l: number, x: number, z: number, y: number): void => {
    batch.add(roadGeo, composeMatrix(x, y, z, 0, w, l, 1, -Math.PI / 2));
  };

  // --- Asphalt, sidewalks, curbs, edge lines ---------------------------
  for (const sx of layout.streetsX) {
    addPlane(roadBatch, 10, CITY_HALF * 2, sx, 0, 0.015);
    addPlane(walkBatch, 3, CITY_HALF * 2, sx - 6.5, 0, 0.03);
    addPlane(walkBatch, 3, CITY_HALF * 2, sx + 6.5, 0, 0.03);
    addPlane(curbBatch, 0.4, CITY_HALF * 2, sx - 8.2, 0, 0.035);
    addPlane(curbBatch, 0.4, CITY_HALF * 2, sx + 8.2, 0, 0.035);
    addPlane(edgeBatch, 0.15, CITY_HALF * 2, sx - 4.6, 0, 0.04);
    addPlane(edgeBatch, 0.15, CITY_HALF * 2, sx + 4.6, 0, 0.04);
  }
  // East-west streets: the plane's local X already runs along world X,
  // so no extra rotation — just swap the width/length.
  for (const sz of layout.streetsZ) {
    addPlane(roadBatch, CITY_HALF * 2, 10, 0, sz, 0.015);
    addPlane(walkBatch, CITY_HALF * 2, 3, 0, sz - 6.5, 0.03);
    addPlane(walkBatch, CITY_HALF * 2, 3, 0, sz + 6.5, 0.03);
    addPlane(curbBatch, CITY_HALF * 2, 0.4, 0, sz - 8.2, 0.035);
    addPlane(curbBatch, CITY_HALF * 2, 0.4, 0, sz + 8.2, 0.035);
    addPlane(edgeBatch, CITY_HALF * 2, 0.15, 0, sz - 4.6, 0.04);
    addPlane(edgeBatch, CITY_HALF * 2, 0.15, 0, sz + 4.6, 0.04);
  }
  for (const [batch, mat] of [
    [roadBatch, roadMat],
    [walkBatch, walkMat],
    [curbBatch, curbMat],
    [edgeBatch, edgeMat],
  ] as const) {
    const geo = batch.build();
    if (!geo) continue;
    const mesh = new THREE.Mesh(track(geo), mat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const dummy = new THREE.Object3D();
  const flat = (m: THREE.Object3D) => {
    m.rotation.set(-Math.PI / 2, 0, 0);
    m.updateMatrix();
  };

  // --- Lane dashes (instanced, centre of each street) ------------------
  const dashXf: THREE.Matrix4[] = [];
  const nearCross = (v: number, streets: number[]) => streets.some((s) => Math.abs(v - s) < 9);
  for (const sx of layout.streetsX) {
    for (let z = -CITY_HALF + 6; z < CITY_HALF - 6; z += 12) {
      if (nearCross(z, layout.streetsZ)) continue;
      dummy.position.set(sx, 0.045, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      flat(dummy);
      dummy.scale.set(0.28, 3, 1);
      dummy.updateMatrix();
      dashXf.push(dummy.matrix.clone());
    }
  }
  for (const sz of layout.streetsZ) {
    for (let x = -CITY_HALF + 6; x < CITY_HALF - 6; x += 12) {
      if (nearCross(x, layout.streetsX)) continue;
      dummy.position.set(x, 0.045, sz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      flat(dummy);
      dummy.scale.set(0.28, 3, 1);
      dummy.rotateZ(Math.PI / 2);
      dummy.updateMatrix();
      dashXf.push(dummy.matrix.clone());
    }
  }
  if (dashXf.length > 0) {
    const inst = new THREE.InstancedMesh(track(new THREE.PlaneGeometry(1, 1)), dashMat, dashXf.length);
    dashXf.forEach((m, i) => inst.setMatrixAt(i, m));
    group.add(inst);
  }

  // --- Crosswalks (instanced stripes at every intersection) ------------
  const crossXf: THREE.Matrix4[] = [];
  for (const sx of layout.streetsX) {
    for (const sz of layout.streetsZ) {
      for (const [ox, oz, alongX] of [
        [0, -6.5, true],
        [0, 6.5, true],
        [-6.5, 0, false],
        [6.5, 0, false],
      ] as const) {
        for (let i = -2; i <= 2; i++) {
          dummy.position.set(sx + ox + (alongX ? i * 1.1 : 0), 0.05, sz + oz + (alongX ? 0 : i * 1.1));
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          flat(dummy);
          dummy.scale.set(0.65, 2.6, 1);
          if (!alongX) dummy.rotateZ(Math.PI / 2);
          dummy.updateMatrix();
          crossXf.push(dummy.matrix.clone());
        }
      }
    }
  }
  if (crossXf.length > 0) {
    const inst = new THREE.InstancedMesh(track(new THREE.PlaneGeometry(1, 1)), crossMat, crossXf.length);
    crossXf.forEach((m, i) => inst.setMatrixAt(i, m));
    group.add(inst);
  }

  // --- WS4: parking bays (divider lines along the commercial avenue) ---
  // A marked parking strip on the east side of the x = 60 avenue, in
  // front of the shops (z -28..28). Markings only — no parked cars,
  // so no new collision or traffic interaction.
  const bayXf: THREE.Matrix4[] = [];
  for (let z = -28; z <= 28; z += 3) {
    dummy.position.set(64.3, 0.045, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    flat(dummy);
    dummy.scale.set(0.14, 1.9, 1);
    dummy.rotateZ(Math.PI / 2);
    dummy.updateMatrix();
    bayXf.push(dummy.matrix.clone());
  }
  if (bayXf.length > 0) {
    const bays = new THREE.InstancedMesh(track(new THREE.PlaneGeometry(1, 1)), crossMat, bayXf.length);
    bayXf.forEach((m, i) => bays.setMatrixAt(i, m));
    group.add(bays);
  }

  // --- Streetlights (instanced pole + lamp) -----------------------------
  const lightEvery = quality.tier === 'low' ? 2 : 1;
  const lightXf: THREE.Matrix4[] = [];
  let li = 0;
  const addLight = (x: number, z: number) => {
    if (li++ % lightEvery !== 0) return;
    dummy.position.set(x, 2.6, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lightXf.push(dummy.matrix.clone());
  };
  for (const sx of layout.streetsX) {
    for (let z = -CITY_HALF + 14; z < CITY_HALF; z += 28) addLight(sx + 6.8, z);
    for (let z = -CITY_HALF + 28; z < CITY_HALF; z += 28) addLight(sx - 6.8, z);
  }
  for (const sz of layout.streetsZ) {
    for (let x = -CITY_HALF + 14; x < CITY_HALF; x += 28) addLight(x, sz + 6.8);
    for (let x = -CITY_HALF + 28; x < CITY_HALF; x += 28) addLight(x, sz - 6.8);
  }
  if (lightXf.length > 0) {
    const poleGeo = track(new THREE.CylinderGeometry(0.09, 0.13, 5.2, 6));
    const poleMat = track(new THREE.MeshStandardMaterial({ color: 0x2e2e36, roughness: 0.6, metalness: 0.5 }));
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightXf.length);
    lightXf.forEach((m, i) => poles.setMatrixAt(i, m));
    poles.castShadow = true;
    group.add(poles);
    const lampGeo = track(new THREE.SphereGeometry(0.26, 8, 6));
    const lampMat = track(
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd27a, emissiveIntensity: 1.6 }),
    );
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lightXf.length);
    lightXf.forEach((m, i) => {
      const p = new THREE.Matrix4().copy(m);
      p.setPosition(new THREE.Vector3(m.elements[12], 5.3, m.elements[14]));
      lamps.setMatrixAt(i, p);
    });
    group.add(lamps);
  }

  // --- Traffic signals (6 major intersections, lights cycle) -----------
  // Poles + heads are merged (2 draw calls); the 36 bulbs are one
  // InstancedMesh whose per-instance colour flips with the phase —
  // the old version was 54 separate meshes with material swaps.
  const poleMat = track(new THREE.MeshStandardMaterial({ color: 0x2e2e36, roughness: 0.6, metalness: 0.5 }));
  const headMat = track(new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.5 }));
  const poleGeo = track(new THREE.CylinderGeometry(0.12, 0.16, 6.4, 6));
  const headGeo = track(new THREE.BoxGeometry(0.5, 1.3, 0.5));
  const bulbGeo = track(new THREE.SphereGeometry(0.17, 8, 6));
  const poleBatch = new GeometryBatch();
  const headBatch = new GeometryBatch();
  const bulbXf: THREE.Matrix4[] = [];
  // Per head: [red, yellow, green] bulb instance indices, in order.
  const headsA: number[] = [];
  const headsB: number[] = [];
  const dummySig = new THREE.Object3D();
  for (const [ix, iz] of SIGNAL_SPOTS) {
    poleBatch.add(poleGeo, composeMatrix(ix + 6.5, 3.2, iz + 6.5, 0, 1, 1, 1));
    for (const [ry, list] of [
      [0, headsA],
      [Math.PI / 2, headsB],
    ] as const) {
      headBatch.add(headGeo, composeMatrix(ix + 6.5, 6.6, iz + 6.5, ry, 1, 1, 1));
      list.push(bulbXf.length);
      for (let i = 0; i < 3; i++) {
        dummySig.position.set(
          ix + 6.5 + Math.sin(ry) * 0.26,
          6.6 + 0.42 - i * 0.42,
          iz + 6.5 + Math.cos(ry) * 0.26,
        );
        dummySig.rotation.set(0, 0, 0);
        dummySig.scale.set(1, 1, 1);
        dummySig.updateMatrix();
        bulbXf.push(dummySig.matrix.clone());
      }
    }
  }
  for (const [batch, mat, shadow] of [
    [poleBatch, poleMat, true],
    [headBatch, headMat, true],
  ] as const) {
    const geo = batch.build();
    if (!geo) continue;
    const mesh = new THREE.Mesh(track(geo), mat);
    mesh.castShadow = shadow;
    group.add(mesh);
  }
  const bulbMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbXf.length);
  bulbXf.forEach((m, i) => bulbs.setMatrixAt(i, m));
  group.add(bulbs);
  const RED_LIT = new THREE.Color(0xff2a2a);
  const RED_DIM = new THREE.Color(0x551111);
  const GREEN_LIT = new THREE.Color(0x2aff66);
  const GREEN_DIM = new THREE.Color(0x115522);
  const YELLOW_DIM = new THREE.Color(0x554411);
  let phaseA = true;
  let timer = 0;
  const applyPhase = () => {
    for (const base of headsA) {
      bulbs.setColorAt(base + 0, phaseA ? RED_DIM : RED_LIT);
      bulbs.setColorAt(base + 1, YELLOW_DIM);
      bulbs.setColorAt(base + 2, phaseA ? GREEN_LIT : GREEN_DIM);
    }
    for (const base of headsB) {
      bulbs.setColorAt(base + 0, phaseA ? RED_LIT : RED_DIM);
      bulbs.setColorAt(base + 1, YELLOW_DIM);
      bulbs.setColorAt(base + 2, phaseA ? GREEN_DIM : GREEN_LIT);
    }
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
  };
  applyPhase();
  const update = (dt: number) => {
    timer += dt;
    if (timer > 5) {
      timer = 0;
      phaseA = !phaseA;
      applyPhase();
    }
  };
  return {
    update,
    signals: {
      spots: SIGNAL_SPOTS,
      isAvenueGreen: () => phaseA,
    },
  };
}
