/**
 * The protagonist — an original articulated character built from
 * Three.js geometry (no copied model, no external asset).
 *
 * Why procedural: the licensed GLBs actually obtainable here were
 * the wrong character entirely — CesiumMan (CC-BY 4.0, a plain
 * grey mannequin with one walk animation) and RiggedFigure (a
 * wooden mannequin), and the three.js npm package ships no
 * character models at all. A Mixamo character (free with an Adobe
 * account) is the upgrade path if a mocap-quality rig is wanted
 * later — hand me the GLB and it wires into the same rig slots.
 *
 * The figure is ~1.85 tall with natural proportions, a detailed
 * face (eyes, brows, nose, mouth, ears, short dark hair), a grey
 * hoodie over a cream tee, a gold chain, dark cargo trousers and
 * sneakers with white soles. Every limb hangs off a named pivot
 * so CharacterAnimation can pose it; static face parts are merged
 * per material so the whole character is ~22 meshes.
 */
import * as THREE from 'three';
import { GeometryBatch, composeMatrix } from './Merge';
import type { CharacterDesign } from './CharacterDesign';

export interface CharacterRig {
  root: THREE.Group;
  /** Inner group: bob and lean live here, not on the root. */
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group;
  kneeL: THREE.Group;
  legR: THREE.Group;
  kneeR: THREE.Group;
  armL: THREE.Group;
  elbowL: THREE.Group;
  armR: THREE.Group;
  elbowR: THREE.Group;
}

export type Track = <T extends { dispose(): void }>(r: T) => T;

/**
 * The materials an outfit recolours. Split per body part (thigh vs
 * shin, jacket vs sleeve) so an outfit can show shorts and bare
 * forearms without rebuilding the model.
 */
export interface CharacterMaterials {
  skin: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  jacket: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshStandardMaterial;
  shirt: THREE.MeshStandardMaterial;
  thigh: THREE.MeshStandardMaterial;
  shin: THREE.MeshStandardMaterial;
  shoe: THREE.MeshStandardMaterial;
  sole: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
}

/** The parts an outfit can hide: the hood and the gold chain. */
export interface CharacterParts {
  hood: THREE.Mesh;
  chain: THREE.Mesh;
}

/**
 * Build the character. `design` is optional and defaults to the
 * original build (Phase 1): every proportion, hair, clothing and
 * accessory choice falls back to Kai's geometry, so existing
 * callers that pass no design get the identical character.
 */
export function createCharacter(
  track: Track,
  design: CharacterDesign = {},
): {
  group: THREE.Group;
  rig: CharacterRig;
  mats: CharacterMaterials;
  parts: CharacterParts;
} {
  const root = new THREE.Group();
  root.name = 'player';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const skin = track(new THREE.MeshStandardMaterial({ color: 0xc68863, roughness: 0.6 }));
  const hairMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.9 }));
  const hoodieMat = track(new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.85 }));
  const sleeveMat = track(new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.85 }));
  const teeMat = track(new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 }));
  const thighMat = track(new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.9 }));
  const shinMat = track(new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.9 }));
  const shoeMat = track(new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.7 }));
  const soleMat = track(new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.8 }));
  const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.5 }));
  const goldMat = track(
    new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.35, metalness: 0.75 }),
  );

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

  // --- Proportions (Phase 1): the design narrows the torso and
  // hips by parameterising box widths and pivot positions, never
  // by scaling a group — the head stays undistorted and the rig
  // pivots stay where the animation expects them.
  const shoulderScale = design.shoulderScale ?? 1;
  const hipScale = design.hipScale ?? 1;
  if (design.heightScale !== undefined && design.heightScale !== 1) {
    root.scale.setScalar(design.heightScale);
  }

  // --- Pelvis (trousers) ---
  const pelvis = add(body, track(new THREE.BoxGeometry(0.36 * hipScale, 0.2, 0.22)), thighMat, 0, 0.95, 0);

  // Skirt (Phase 1): a flared cone over the pelvis, in the
  // trousers colour; the pelvis block hides underneath it and
  // the legs below read as tights in the same colour.
  if (design.skirt) {
    pelvis.visible = false;
    add(body, track(new THREE.CylinderGeometry(0.21, 0.27, 0.32, 12)), thighMat, 0, 0.82, 0);
  }

  // --- Legs: hip pivot -> thigh, knee pivot -> shin + shoe + sole ---
  const makeLeg = (side: number): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.name = side < 0 ? 'legL' : 'legR';
    hip.position.set(side * 0.11 * hipScale, 0.95, 0);
    body.add(hip);
    add(hip, track(new THREE.CapsuleGeometry(0.085, 0.3, 4, 10)), thighMat, 0, -0.22, 0);
    const knee = new THREE.Group();
    knee.name = side < 0 ? 'kneeL' : 'kneeR';
    knee.position.set(0, -0.44, 0);
    hip.add(knee);
    add(knee, track(new THREE.CapsuleGeometry(0.07, 0.3, 4, 10)), shinMat, 0, -0.2, 0);
    add(knee, track(new THREE.BoxGeometry(0.13, 0.09, 0.3)), shoeMat, 0, -0.44, 0.05, false);
    add(knee, track(new THREE.BoxGeometry(0.14, 0.035, 0.32)), soleMat, 0, -0.49, 0.05, false);
    return { hip, knee };
  };
  const { hip: legL, knee: kneeL } = makeLeg(-1);
  const { hip: legR, knee: kneeR } = makeLeg(1);

  // --- Torso: hoodie, tee at the chest, hood, neck, chain ---
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.set(0, 0.98, 0);
  body.add(torso);
  // Two stacked boxes: wider chest, narrower waist — a jacket
  // with a shape, not one slab. (A four-sided cylinder was tried:
  // its diamond cross-section left the tee panel floating.)
  add(torso, track(new THREE.BoxGeometry(0.42 * shoulderScale, 0.34, 0.24)), hoodieMat, 0, 0.4, 0);
  add(torso, track(new THREE.BoxGeometry(0.38 * shoulderScale, 0.26, 0.22)), hoodieMat, 0, 0.13, 0);
  add(torso, track(new THREE.BoxGeometry(0.2 * shoulderScale, 0.34, 0.03)), teeMat, 0, 0.32, 0.135, false);
  const hood = add(torso, track(new THREE.SphereGeometry(0.14, 12, 8)), hoodieMat, 0, 0.56, -0.06);
  hood.scale.set(1.3, 0.55, 0.9);
  if (design.hood === false) hood.visible = false;
  add(torso, track(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 10)), skin, 0, 0.6, 0, false);
  // Waistband: breaks the jacket/trousers junction.
  add(torso, track(new THREE.BoxGeometry(0.38 * shoulderScale, 0.05, 0.24)), thighMat, 0, 0.0, 0, false);
  const chain = add(
    torso,
    track(new THREE.TorusGeometry(0.11, 0.015, 8, 20)),
    goldMat,
    0,
    0.6,
    0.02,
    false,
  );
  chain.rotation.x = Math.PI / 2 - 0.35;
  if (design.chain === false) chain.visible = false;

  // --- Head: sphere, hair cap, merged face parts ---
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.68, 0);
  torso.add(head);
  add(head, track(new THREE.SphereGeometry(0.14, 20, 16)), skin, 0, 0.06, 0);
  const hair = add(head, track(new THREE.SphereGeometry(0.145, 16, 12)), hairMat, 0, 0.11, -0.02);
  const hairStyle = design.hairStyle ?? 'short';
  if (hairStyle === 'bob') {
    // Chin-length bob: a wider, fuller cap with side panels.
    hair.scale.set(1.18, 0.95, 1.12);
    for (const s of [-1, 1]) {
      add(head, track(new THREE.BoxGeometry(0.05, 0.16, 0.06)), hairMat, s * 0.11, -0.02, 0.02);
    }
  } else {
    hair.scale.set(1.02, 0.8, 1.02);
  }
  if (hairStyle === 'long') {
    // Long hair: a back panel to mid-back (on the torso, so it
    // stays put when the head turns) plus two front strands.
    add(torso, track(new THREE.BoxGeometry(0.17, 0.5, 0.05)), hairMat, 0, 0.42, -0.14);
    for (const s of [-1, 1]) {
      add(head, track(new THREE.BoxGeometry(0.04, 0.24, 0.04)), hairMat, s * 0.11, -0.07, 0.08);
    }
  } else if (hairStyle === 'bun') {
    // A bun at the back-top of the head.
    add(head, track(new THREE.SphereGeometry(0.07, 10, 8)), hairMat, 0, 0.16, -0.1);
  } else if (hairStyle === 'shoulder') {
    // Shoulder-length: a back panel to the shoulders (on the
    // torso, so it stays put when the head turns) plus shorter
    // front strands — between the bob and the long style.
    add(torso, track(new THREE.BoxGeometry(0.17, 0.32, 0.05)), hairMat, 0, 0.48, -0.14);
    for (const s of [-1, 1]) {
      add(head, track(new THREE.BoxGeometry(0.04, 0.18, 0.04)), hairMat, s * 0.11, -0.05, 0.08);
    }
  }

  // Face parts are static relative to the head, so merge them per
  // material: two draw calls instead of seven.
  const sphereGeo = track(new THREE.SphereGeometry(0.02, 8, 6));
  const faceSkinBatch = new GeometryBatch();
  const faceDarkBatch = new GeometryBatch();
  // Nose + ears (skin).
  faceSkinBatch.add(
    track(new THREE.BoxGeometry(0.035, 0.055, 0.035)),
    composeMatrix(0, 0.05, 0.125, 0, 1, 1, 1),
  );
  for (const s of [-1, 1]) {
    faceSkinBatch.add(
      track(new THREE.BoxGeometry(0.02, 0.06, 0.04)),
      composeMatrix(s * 0.128, 0.06, 0, 0, 1, 1, 1),
    );
  }
  // Eyes + brows + mouth (dark).
  for (const s of [-1, 1]) {
    faceDarkBatch.add(sphereGeo, composeMatrix(s * 0.048, 0.075, 0.118, 0, 1, 1, 1));
    faceDarkBatch.add(
      track(new THREE.BoxGeometry(0.05, 0.012, 0.012)),
      composeMatrix(s * 0.048, 0.105, 0.12, 0, 1, 1, 1),
    );
  }
  faceDarkBatch.add(
    track(new THREE.BoxGeometry(0.06, 0.01, 0.012)),
    composeMatrix(0, -0.005, 0.12, 0, 1, 1, 1),
  );
  for (const [batch, mat] of [
    [faceSkinBatch, skin],
    [faceDarkBatch, darkMat],
  ] as const) {
    const geo = batch.build();
    if (!geo) continue;
    // Batch matrices are already in head-pivot space (the head
    // sphere's centre is at local y 0.06), so no offset here.
    head.add(new THREE.Mesh(track(geo), mat));
  }

  // Accessories (Phase 1): gold hoops and shades, from the design.
  if (design.hoops) {
    for (const s of [-1, 1]) {
      add(head, track(new THREE.TorusGeometry(0.028, 0.007, 8, 16)), goldMat, s * 0.135, 0.02, 0, false);
    }
  }
  if (design.sunglasses) {
    const shadesMat = track(
      new THREE.MeshStandardMaterial({ color: 0x0a0a0f, roughness: 0.15, metalness: 0.4 }),
    );
    add(head, track(new THREE.BoxGeometry(0.17, 0.05, 0.03)), shadesMat, 0, 0.075, 0.125, false);
  }

  // --- Arms: shoulder pivot -> upper arm, elbow pivot -> forearm + hand ---
  const makeArm = (side: number): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? 'armL' : 'armR';
    shoulder.position.set(side * 0.27 * shoulderScale, 0.48, 0);
    torso.add(shoulder);
    add(shoulder, track(new THREE.CapsuleGeometry(0.06, 0.2, 4, 10)), hoodieMat, 0, -0.16, 0);
    const elbow = new THREE.Group();
    elbow.name = side < 0 ? 'elbowL' : 'elbowR';
    elbow.position.set(0, -0.32, 0);
    shoulder.add(elbow);
    add(elbow, track(new THREE.CapsuleGeometry(0.055, 0.2, 4, 10)), sleeveMat, 0, -0.15, 0);
    add(elbow, track(new THREE.BoxGeometry(0.09, 0.12, 0.04)), skin, 0, -0.36, 0, false);
    return { shoulder, elbow };
  };
  const { shoulder: armL, elbow: elbowL } = makeArm(-1);
  const { shoulder: armR, elbow: elbowR } = makeArm(1);

  return {
    group: root,
    rig: { root, body, torso, head, legL, kneeL, legR, kneeR, armL, elbowL, armR, elbowR },
    mats: {
      skin,
      hair: hairMat,
      jacket: hoodieMat,
      sleeve: sleeveMat,
      shirt: teeMat,
      thigh: thighMat,
      shin: shinMat,
      shoe: shoeMat,
      sole: soleMat,
      gold: goldMat,
    },
    parts: { hood, chain },
  };
}
