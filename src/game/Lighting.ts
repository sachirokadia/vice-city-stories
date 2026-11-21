/**
 * Lighting — everything that makes the city read as a warm
 * Miami-inspired sunset: a gradient sky dome, a low sun disc,
 * hemisphere fill and a shadow-casting directional sun.
 * No physics, no gameplay — just light.
 */
import * as THREE from 'three';
import type { QualitySettings } from './Quality';

export interface LightingHandle {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Sky-only scene (dome + sun disc) for the PMREM environment map. */
  environmentScene: THREE.Scene;
  setShadows: (enabled: boolean) => void;
  dispose: () => void;
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
