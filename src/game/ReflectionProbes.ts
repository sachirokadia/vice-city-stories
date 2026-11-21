/**
 * G1.2 Stage 1 — one static downtown reflection probe.
 *
 * The sky PMREM (G1.1) lights the scene with a smooth sunset gradient,
 * which reads as a global warm lift, not as reflections. This probe
 * captures the actual city — towers, streets, ground, sky — from one
 * fixed point downtown, PMREMs it once at boot, and assigns it to the
 * Velocity GT's paint and glass only. The sky PMREM stays as
 * scene.environment for everything else (the hybrid from
 * docs/city-reflection-design.md).
 *
 * The bake runs in the GameEngine factory right after buildWorld,
 * when the scene holds only the lighting group and the world group:
 * nothing dynamic exists yet (no player, vehicles, crowd, traffic,
 * police, markers), so there is nothing to hide. The capture nulls
 * scene.environment + fog and disables tone mapping, so the probe
 * holds the city lit by direct lights only — no env-in-env recursion,
 * no orange fog haze, no double tone mapping.
 *
 * Stage 1 scope: ONE 128x128 probe, downtown (0, 2, -120), GT paint +
 * glass only. No other vehicles, no building materials, no re-bake on
 * preset switch (the downtown skyline is intact at every tier).
 */
import * as THREE from 'three';
import type { VehicleHandle } from './Vehicle';

/** Downtown probe position: avenue x = 0, between streets z = -90 and z = -150, 2 m up. */
export const DOWNTOWN_PROBE_POSITION = new THREE.Vector3(0, 2, -120);
/** Probe capture resolution (per cube face). 128 is enough: the paint (roughness 0.3) and glass (0.12) blur it anyway. */
export const PROBE_SIZE = 128;

export interface BakedProbe {
  /** The PMREM'd CubeUV render target — this is what gets assigned as an envMap. Own it: dispose when done. */
  target: THREE.WebGLRenderTarget;
  /** How long the bake took (ms), CubeCamera + PMREM together. */
  ms: number;
}

/**
 * Capture the scene from `position` into a PMREM'd environment map.
 * The caller must ensure the scene holds only what should be
 * reflected (at boot: the static city + sky). Restores every renderer
 * / scene setting it touches, even on failure.
 */
export function bakeCityProbe(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  position: THREE.Vector3,
): BakedProbe {
  const t0 = performance.now();
  const prevToneMapping = renderer.toneMapping;
  const prevFog = scene.fog;
  const prevEnvironment = scene.environment;
  try {
    // Linear capture: no tone mapping (it would be applied twice —
    // once here, once at final output), no fog haze, no env light
    // (the probe must hold direct-lit city, not env-lit city).
    renderer.toneMapping = THREE.NoToneMapping;
    scene.fog = null;
    scene.environment = null;
    const cubeRT = new THREE.WebGLCubeRenderTarget(PROBE_SIZE, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    const cubeCamera = new THREE.CubeCamera(0.5, 900, cubeRT);
    cubeCamera.position.copy(position);
    cubeCamera.update(renderer, scene);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromCubemap(cubeRT.texture);
    pmrem.dispose();
    cubeRT.dispose();
    return { target, ms: performance.now() - t0 };
  } finally {
    renderer.toneMapping = prevToneMapping;
    scene.fog = prevFog;
    scene.environment = prevEnvironment;
  }
}

/**
 * Assign a probe texture to a vehicle's paint + glass. A null texture
 * clears the assignment (the materials fall back to scene.environment).
 * needsUpdate is set because the envMap presence changes the program.
 */
export function assignProbeToVehicle(
  vehicle: VehicleHandle,
  texture: THREE.Texture | null,
): void {
  for (const mat of [vehicle.paintMat, vehicle.glassMat]) {
    mat.envMap = texture;
    mat.needsUpdate = true;
  }
}
