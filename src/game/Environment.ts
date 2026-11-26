/**
 * The waterfront: sand, boardwalk promenade with a railing, and the
 * ocean — a large plane with a small vertex/fragment shader so the
 * water gently rolls and the shore foams. The shader is cheap
 * (48x48 segments, two sine waves) and its clock is advanced by
 * World.update, which the engine calls every frame.
 */
import * as THREE from 'three';
import type { CityLayout } from './CityGenerator';
import { CITY_HALF, mulberry32 } from './CityGenerator';
import type { Track } from './Buildings';
import { GeometryBatch, composeMatrix } from './Merge';

function makeSandTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e6cf9e';
  ctx.fillRect(0, 0, 256, 256);
  const random = mulberry32(2301);
  for (let i = 0; i < 4100; i++) {
    const v = random();
    ctx.fillStyle = v < 0.5 ? 'rgba(190,160,110,0.5)' : 'rgba(255,240,200,0.5)';
    ctx.fillRect(random() * 256, random() * 256, 2, 2);
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(11, 73);
  return tex;
}

function makeBoardTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#9a7b52';
  ctx.fillRect(0, 0, 128, 256);
  for (let x = 0; x < 128; x += 16) {
    ctx.fillStyle = x % 32 === 0 ? '#8a6b44' : '#a8895f';
    ctx.fillRect(x, 0, 14, 256);
    ctx.fillStyle = 'rgba(60,40,20,0.6)';
    ctx.fillRect(x + 14, 0, 2, 256);
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 38);
  return tex;
}

export function buildEnvironment(
  group: THREE.Group,
  layout: CityLayout,
  track: Track,
): { update: (dt: number) => void } {
  // --- Sand ------------------------------------------------------------
  const sandW = layout.waterStartX - 8 - layout.beachStartX;
  const sand = new THREE.Mesh(
    track(new THREE.PlaneGeometry(sandW, CITY_HALF * 2 + 12)),
    track(new THREE.MeshStandardMaterial({ map: makeSandTexture(track), roughness: 1 })),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(layout.beachStartX + sandW / 2, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);

  // --- Promenade boardwalk + railing ------------------------------------
  const boardW = layout.beachStartX - 128;
  const board = new THREE.Mesh(
    track(new THREE.PlaneGeometry(boardW, CITY_HALF * 2)),
    track(new THREE.MeshStandardMaterial({ map: makeBoardTexture(track), roughness: 0.9 })),
  );
  board.rotation.x = -Math.PI / 2;
  board.position.set(128 + boardW / 2, 0.04, 0);
  board.receiveShadow = true;
  group.add(board);
  const railMat = track(new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.5, metalness: 0.6 }));
  const rail = new GeometryBatch();
  const deckDetails = new GeometryBatch();
  const box = track(new THREE.BoxGeometry());
  const openings = layout.streetsZ;
  const railX = layout.beachStartX - .4;
  let start = -CITY_HALF;
  for (const end of [...openings.map(z => z - 2.8), CITY_HALF]) {
    for (const y of [.56, 1.05]) rail.add(box, composeMatrix(railX, y, (start + end) / 2, 0, .082, .082, end - start));
    start = end + 5.6;
  }
  const stone = track(new THREE.MeshStandardMaterial({ color: 0xbab19d, roughness: .92 }));
  for (const z of openings) {
    // Level sand access at the end of every street.
    deckDetails.add(box, composeMatrix(134, .036, z, 0, 12, .07, 4.6));
    for (const side of [-1, 1]) rail.add(box, composeMatrix(railX, .56, z + side * 2.8, 0, .13, 1.12, .13));
  }
  for (const [batch, material] of [[rail, railMat], [deckDetails, stone]] as const) {
    const mesh = new THREE.Mesh(track(batch.build()!), material);
    mesh.receiveShadow = true; mesh.castShadow = batch === rail;
    group.add(mesh);
  }
  const postGeo = track(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 6));
  const postPositions = Array.from({ length: Math.floor(CITY_HALF * 2 / 6) }, (_, i) => -CITY_HALF + i * 6)
    .filter(z => openings.every(edge => Math.abs(z - edge) > 2.8));
  const posts = new THREE.InstancedMesh(postGeo, railMat, postPositions.length);
  const dummy = new THREE.Object3D();
  for (const [i, z] of postPositions.entries()) {
    dummy.position.set(railX, 0.52, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
  }
  group.add(posts);

  // --- WS4: dunes, rocks, lifeguard tower ------------------------------
  // Dunes: low ripples along the sand's west edge (near the boardwalk).
  // WS5: taller (up to ~0.85 m) and a deeper sand tone than the beach
  // plane, so they read as dune shapes instead of flat texture.
  const duneRand = mulberry32(20261123);
  const duneXf: THREE.Matrix4[] = [];
  for (let i = 0; i < 26; i++) {
    const x = layout.beachStartX + 3 + duneRand() * 10;
    const z = -CITY_HALF + 14 + duneRand() * (CITY_HALF * 2 - 28);
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, duneRand() * Math.PI, 0);
    dummy.scale.set(2.2 + duneRand() * 2.4, 0.45 + duneRand() * 0.4, 1.6 + duneRand() * 1.6);
    dummy.updateMatrix();
    duneXf.push(dummy.matrix.clone());
  }
  if (duneXf.length > 0) {
    const dunes = new THREE.InstancedMesh(
      track(new THREE.SphereGeometry(1, 10, 6)),
      track(new THREE.MeshStandardMaterial({ color: 0xcfa96e, roughness: 1 })),
      duneXf.length,
    );
    duneXf.forEach((m, i) => dunes.setMatrixAt(i, m));
    dunes.receiveShadow = true;
    group.add(dunes);
  }
  // Rocks: grey boulders at the waterline's north and south ends, plus
  // a few scattered on the sand. WS5: bigger (up to ~1.9 m) and a
  // cooler, darker grey, so they read as rocks from gameplay distance
  // instead of sand-coloured lumps.
  const rockXf: THREE.Matrix4[] = [];
  for (let i = 0; i < 8; i++) {
    const z = (i < 4 ? -1 : 1) * (CITY_HALF - 12 - duneRand() * 14);
    const x = layout.waterStartX - 4 - duneRand() * 4;
    const s = 0.9 + duneRand() * 1.0;
    dummy.position.set(x, 0.2 * s, z);
    dummy.rotation.set(duneRand() * Math.PI, duneRand() * Math.PI, 0);
    dummy.scale.set(s, s * 0.7, s);
    dummy.updateMatrix();
    rockXf.push(dummy.matrix.clone());
  }
  for (let i = 0; i < 6; i++) {
    const x = layout.beachStartX + 8 + duneRand() * 44;
    const z = -CITY_HALF + 20 + duneRand() * (CITY_HALF * 2 - 40);
    const s = 0.7 + duneRand() * 0.6;
    dummy.position.set(x, 0.15 * s, z);
    dummy.rotation.set(0, duneRand() * Math.PI, 0);
    dummy.scale.set(s, s * 0.65, s);
    dummy.updateMatrix();
    rockXf.push(dummy.matrix.clone());
  }
  if (rockXf.length > 0) {
    const rocks = new THREE.InstancedMesh(
      track(new THREE.IcosahedronGeometry(1, 0)),
      track(new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 1 })),
      rockXf.length,
    );
    rockXf.forEach((m, i) => rocks.setMatrixAt(i, m));
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    group.add(rocks);
  }
  // Lifeguard tower: four splayed legs, a cabin and a red roof, on the
  // sand south of the boardwalk mid (170, 60) — clear of the sprint
  // start (133, 90), the beach-dune coin (165, 90) and the boardwalk
  // coin (133, 30). No collision box (open sand, out of mission routes).
  // Two merged meshes (white frame, red roof/flag) — 2 draw calls.
  {
    const white = track(new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 }));
    const red = track(new THREE.MeshStandardMaterial({ color: 0xd63a2f, roughness: 0.7 }));
    const whiteBatch = new GeometryBatch();
    const redBatch = new GeometryBatch();
    const legGeo = track(new THREE.BoxGeometry(0.22, 3.4, 0.22));
    const cabinGeo = track(new THREE.BoxGeometry(2.4, 1.7, 2.2));
    const roofGeo = track(new THREE.BoxGeometry(2.9, 0.18, 2.7));
    const poleGeo = track(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6));
    const flagGeo = track(new THREE.PlaneGeometry(0.9, 0.55));
    const t = new THREE.Object3D();
    for (const [lx, lz] of [
      [-0.9, -0.9],
      [0.9, -0.9],
      [-0.9, 0.9],
      [0.9, 0.9],
    ] as const) {
      t.position.set(170 + lx * 1.15, 1.7, 60 + lz * 1.15);
      t.rotation.set(lz * 0.12, 0, -lx * 0.12);
      t.scale.set(1, 1, 1);
      whiteBatch.addObject(legGeo, t);
    }
    t.position.set(170, 4.1, 60);
    t.rotation.set(0, 0, 0);
    whiteBatch.addObject(cabinGeo, t);
    t.position.set(170, 5.6, 60);
    whiteBatch.addObject(poleGeo, t);
    t.position.set(170, 5.05, 60);
    redBatch.addObject(roofGeo, t);
    t.position.set(170.45, 5.9, 60);
    redBatch.addObject(flagGeo, t);
    for (const [batch, mat] of [
      [whiteBatch, white],
      [redBatch, red],
    ] as const) {
      const geo = batch.build();
      if (!geo) continue;
      const mesh = new THREE.Mesh(track(geo), mat);
      mesh.castShadow = true;
      group.add(mesh);
    }
  }

  // --- Ocean (animated shader) ------------------------------------------
  const uniforms = { uTime: { value: 0 } };
  const oceanMat = track(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vPos;
        void main() {
          vec3 p = position;
          // Small breakers at the beach and a longer swell offshore.
          float openSea = smoothstep(0.0, 30.0, p.x + 122.0);
          p.z += sin(p.x * .22 - uTime * 1.25 + p.y * .045) * mix(.035, .21, openSea)
               + sin(p.y * .055 - uTime * .65) * .10 * openSea;
          vPos = p.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vPos;
        void main() {
          // vPos.x: -122 at the shore, +122 far out east.
          float distanceToShore = vPos.x + 122.0;
          float shore = smoothstep(0.0, 71.0, distanceToShore);
          vec3 shallow = vec3(.16, .53, .49);
          vec3 deep = vec3(.035, .22, .36);
          vec3 col = mix(shallow, deep, shore);
          float ripple = sin(vPos.x * 1.35 + vPos.y * .31 + uTime * 1.3)
                       + .55 * sin(vPos.x * 2.85 - vPos.y * 1.21 + uTime * .73);
          col += vec3(.035, .07, .074) * ripple;
          float swell = sin(distanceToShore * 1.18 + .73 * sin(vPos.y * .31) + uTime * 1.31);
          float broken = smoothstep(-.7, .55, sin(vPos.y * 1.7 + vPos.x * 2.3) + .3 * ripple);
          float foam = smoothstep(.73, .99, swell) * (1.0 - smoothstep(2.0, 11.0, distanceToShore)) * broken;
          float lip = (1.0 - smoothstep(0.08, .9, distanceToShore)) * (.48 + .34 * broken);
          col = mix(col, vec3(.76, .91, .86), max(foam * .68, lip));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  const ocean = new THREE.Mesh(track(new THREE.PlaneGeometry(244, 440, 48, 48)), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(layout.waterStartX - 8 + 122, 0.105, 0);
  ocean.name = 'shoreline-water';
  group.add(ocean);

  return {
    update: (dt: number) => {
      uniforms.uTime.value += dt;
    },
  };
}
