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
import { GeometryBatch } from './Merge';

function makeSandTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e6cf9e';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const v = Math.random();
    ctx.fillStyle = v < 0.5 ? 'rgba(190,160,110,0.5)' : 'rgba(255,240,200,0.5)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 12);
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
  tex.repeat.set(1, 24);
  return tex;
}

export function buildEnvironment(
  group: THREE.Group,
  layout: CityLayout,
  track: Track,
): { update: (dt: number) => void } {
  // --- Sand ------------------------------------------------------------
  const sandW = layout.waterStartX - layout.beachStartX;
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
  const railTop = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.14, CITY_HALF * 2)), railMat);
  railTop.position.set(layout.beachStartX - 0.4, 1.05, 0);
  group.add(railTop);
  const railMid = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.1, CITY_HALF * 2)), railMat);
  railMid.position.set(layout.beachStartX - 0.4, 0.55, 0);
  group.add(railMid);
  const postGeo = track(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 6));
  const postCount = Math.floor((CITY_HALF * 2) / 6);
  const posts = new THREE.InstancedMesh(postGeo, railMat, postCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < postCount; i++) {
    dummy.position.set(layout.beachStartX - 0.4, 0.52, -CITY_HALF + i * 6);
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
          // Two gentle rolling waves; local x is east-west, y north-south.
          p.z += sin(p.x * 0.08 + uTime * 0.9) * 0.35
               + sin(p.y * 0.05 - uTime * 0.6) * 0.3
               + sin((p.x + p.y) * 0.03 + uTime * 0.4) * 0.25;
          vPos = p.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vPos;
        void main() {
          // vPos.x: -122 at the shore, +122 far out east.
          float shore = smoothstep(-122.0, -60.0, vPos.x);
          vec3 shallow = vec3(0.16, 0.62, 0.62);
          vec3 deep = vec3(0.05, 0.23, 0.42);
          vec3 col = mix(shallow, deep, shore);
          // Moving foam band at the waterline.
          float foamLine = sin(vPos.y * 0.12 + uTime * 1.2) * 4.0;
          float foam = smoothstep(6.0, 0.0, abs(vPos.x + 122.0 + foamLine));
          col = mix(col, vec3(0.95, 0.98, 0.95), foam * 0.7);
          // Sun glitter.
          float glit = sin(vPos.x * 0.9 + uTime * 2.0) * sin(vPos.y * 0.7 - uTime * 1.4);
          col += vec3(0.10, 0.08, 0.05) * smoothstep(0.92, 1.0, glit);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  const ocean = new THREE.Mesh(track(new THREE.PlaneGeometry(244, 440, 48, 48)), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(layout.waterStartX + 122, 0.35, 0);
  group.add(ocean);

  return {
    update: (dt: number) => {
      uniforms.uTime.value += dt;
    },
  };
}
