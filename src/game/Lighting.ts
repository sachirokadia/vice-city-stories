/**
 * Lighting — everything that makes the city read as a warm
 * Miami-inspired sunset: a gradient sky dome, a low sun disc,
 * hemisphere fill and a shadow-casting directional sun.
 * No physics, no gameplay — just light.
 */
import * as THREE from 'three';
import type { QualitySettings } from './Quality';
import { mulberry32 } from './CityGenerator';

export interface LightingHandle {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Sky-only scene (dome + sun disc) for the PMREM environment map. */
  environmentScene: THREE.Scene;
  setShadows: (enabled: boolean) => void;
  /** Advance the drifting clouds (no-op when there are none). */
  update: (dt: number) => void;
  dispose: () => void;
}

function makeCloudTexture(track: <T extends { dispose(): void }>(r: T) => T): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 128);
  // A cluster of soft white blobs — one puffy cloud per texture.
  const blobs: Array<[number, number, number]> = [
    [128, 78, 52],
    [88, 84, 38],
    [168, 84, 40],
    [60, 92, 28],
    [198, 92, 30],
    [128, 58, 30],
  ];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 236, 220, 0.85)');
    g.addColorStop(0.7, 'rgba(255, 220, 200, 0.4)');
    g.addColorStop(1, 'rgba(255, 220, 200, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlowTexture(track: <T extends { dispose(): void }>(r: T) => T): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255, 223, 138, 0.9)');
  g.addColorStop(0.35, 'rgba(255, 180, 110, 0.45)');
  g.addColorStop(1, 'rgba(255, 160, 90, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLighting(scene: THREE.Scene, quality: QualitySettings): LightingHandle {
  const group = new THREE.Group();
  group.name = 'lighting';
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  // ---- Sky: gradient dome, deep blue overhead to warm sunset horizon ----
  const skyGeo = track(new THREE.SphereGeometry(600, 24, 16));
  const skyMat = track(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#16265e') },
        mid: { value: new THREE.Color('#ff7e5f') },
        bottom: { value: new THREE.Color('#feb47b') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 col = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.65, h))
                              : mix(bottom, mid, smoothstep(-0.08, 0.18, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky-dome';
  group.add(sky);

  scene.fog = new THREE.Fog(new THREE.Color('#e88a6b'), quality.fogNear, quality.fogFar);

  // Low sun disc on the horizon (west, over the city — the ocean is
  // east, so the sun sets behind the skyline, as in Miami).
  const sunDisc = new THREE.Mesh(
    track(new THREE.CircleGeometry(26, 32)),
    track(new THREE.MeshBasicMaterial({ color: '#ffdf8a', fog: false })),
  );
  sunDisc.name = 'sun-disc';
  sunDisc.position.set(-260, 42, -320);
  sunDisc.lookAt(0, 42, 0);
  group.add(sunDisc);

  // Environment-map source (G1.1): a sky-only scene for PMREM. The
  // clones share geometry/material with the live sky — they are
  // never disposed here; the live sky's dispose covers the shared
  // resources. The engine renders this scene once through
  // PMREMGenerator and assigns the result to scene.environment, so
  // reflections show the same sunset the player sees.
  const environmentScene = new THREE.Scene();
  environmentScene.add(sky.clone());
  environmentScene.add(sunDisc.clone());

  // ---- Lights ----
  // A touch more fill than Phase 1: the bigger city read too dark
  // and too red once the buildings went up.
  const hemi = new THREE.HemisphereLight('#ffc49a', '#332a44', 1.25);
  group.add(hemi);

  const sun = new THREE.DirectionalLight('#ffc08a', 2.4);
  sun.position.set(-60, 55, -40);
  sun.castShadow = quality.shadows;
  sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  // Wider than Phase 1: the shadow frustum now covers the downtown
  // blocks around spawn, not just the plaza.
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004;
  group.add(sun);
  group.add(sun.target);

  // Sun glow: a soft additive halo around the sun disc, so the sunset
  // reads as a light source, not a flat yellow circle.
  const glow = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(track),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    ),
  );
  glow.name = 'sun-glow';
  glow.position.set(-260, 42, -320);
  glow.scale.set(190, 190, 1);
  group.add(glow);

  // WS4 — clouds: one InstancedMesh of soft billboards drifting
  // slowly eastward across the sky. They live in the lighting group
  // (not the PMREM environment scene), so they never affect
  // reflections. Eight instances, one draw call.
  const cloudCount = 8;
  const cloudGeo = track(new THREE.PlaneGeometry(1, 1));
  const cloudMat = track(
    new THREE.MeshBasicMaterial({
      map: makeCloudTexture(track),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      fog: false,
    }),
  );
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
  clouds.name = 'clouds';
  const cloudState: Array<{ x: number; y: number; z: number; w: number; h: number; speed: number }> = [];
  const cloudRand = mulberry32(20261123);
  const cloudDummy = new THREE.Object3D();
  // Each cloud is a vertical plane facing the city centre, so it reads
  // from anywhere the player stands. (A true camera billboard would
  // need the camera in the update loop; the centre-facing plane is
  // close enough at this distance, and the yaw is refreshed as the
  // cloud drifts.)
  const faceCentre = (s: { x: number; z: number }): number => Math.atan2(-s.x, -s.z);
  for (let i = 0; i < cloudCount; i++) {
    const s = {
      x: -350 + cloudRand() * 700,
      y: 95 + cloudRand() * 55,
      z: -350 + cloudRand() * 700,
      w: 90 + cloudRand() * 70,
      h: 34 + cloudRand() * 26,
      speed: 1 + cloudRand() * 1.5,
    };
    cloudState.push(s);
    cloudDummy.position.set(s.x, s.y, s.z);
    cloudDummy.rotation.set(0, faceCentre(s), 0);
    cloudDummy.scale.set(s.w, s.h, 1);
    cloudDummy.updateMatrix();
    clouds.setMatrixAt(i, cloudDummy.matrix);
  }
  group.add(clouds);

  scene.add(group);

  return {
    sun,
    hemi,
    environmentScene,
    setShadows: (enabled: boolean) => {
      sun.castShadow = enabled;
      if (!enabled && sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    },
    update: (dt: number) => {
      // Drift the clouds eastward; wrap around so the sky never runs out.
      for (let i = 0; i < cloudCount; i++) {
        const s = cloudState[i];
        s.x += s.speed * dt;
        if (s.x > 380) s.x = -380;
        cloudDummy.position.set(s.x, s.y, s.z);
        cloudDummy.rotation.set(0, faceCentre(s), 0);
        cloudDummy.scale.set(s.w, s.h, 1);
        cloudDummy.updateMatrix();
        clouds.setMatrixAt(i, cloudDummy.matrix);
      }
      clouds.instanceMatrix.needsUpdate = true;
    },
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
      if (scene.fog) scene.fog = null;
    },
  };
}
