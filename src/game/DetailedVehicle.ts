import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeImportedModel } from './CoastalDistrict';

const MODELS: Record<string, string> = {
  'velocity-gt': 'velocity-gt-detailed-v3', 'shadow-lx': 'shadow-lx-detailed-v3',
  'vortex-rs': 'vortex-rs-detailed-v3', 'trailhawk-x': 'trailhawk-x-detailed-v3',
};

/** Replace only the active car's visual; retain the real driving, garage and collision code. */
export function installDetailedVehicle(
  group: THREE.Group, id: string, paint: THREE.MeshPhysicalMaterial, glass: THREE.MeshStandardMaterial,
  onReady?: () => void,
): { ready: Promise<void>; bounds: () => { halfWidth: number; halfLength: number } | null;
  update: (distance: number, radius: number, steer: number) => void; dispose: () => void } {
  const controller = new AbortController();
  const original = [...group.children];
  let disposed = false, model: THREE.Group | undefined;
  let dimensions: { halfWidth: number; halfLength: number } | null = null;
  const spins: THREE.Object3D[] = [], front: THREE.Object3D[] = [];
  const ready = (async () => {
    if (!MODELS[id]) return;
    try {
      const response = await fetch(`${import.meta.env?.BASE_URL ?? '/'}world-v2/models/${MODELS[id]}.glb`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Vehicle model download failed (${response.status})`);
      const loaded = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
      if (disposed) { disposeImportedModel(loaded.scene); return; }
      model = loaded.scene; model.name = `detailed-${id}`;
      const box = new THREE.Box3().setFromObject(model);
      dimensions = { halfWidth: Math.max(Math.abs(box.min.x), Math.abs(box.max.x)),
        halfLength: Math.max(Math.abs(box.min.z), Math.abs(box.max.z)) };
      const replacedMaterials = new Set<THREE.Material>();
      model.traverse(object => {
        if (object.name === 'WheelSpin' || object.name.startsWith('WheelSpin_')) spins.push(object);
        if (object.name.startsWith('Wheel_Front_')) front.push(object);
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = object.receiveShadow = true;
        if (Array.isArray(object.material)) return;
        if (object.material.name.includes('Clearcoat') && !object.material.name.includes('Glass')) {
          paint.roughness = .24; paint.clearcoat = 1; paint.clearcoatRoughness = .1;
          replacedMaterials.add(object.material); object.material = paint;
        } else if (object.material instanceof THREE.MeshStandardMaterial && object.material.name.includes('Glass')) {
          object.material.envMap = glass.envMap; object.material.needsUpdate = true; object.castShadow = false;
        }
      });
      replacedMaterials.forEach(m => m.dispose());
      original.forEach(object => { object.visible = false; });
      group.add(model); group.userData.detailedVisual = MODELS[id]; onReady?.();
    } catch (error) {
      if (!disposed) console.warn(`[vcs] Detailed ${id} could not load; preserving its working original model.`, error);
    }
  })();
  return { ready, bounds: () => dimensions, update: (distance, radius, steer) => {
    spins.forEach(wheel => { wheel.rotation.x += distance / radius; });
    front.forEach(wheel => { wheel.rotation.y = -steer; });
  }, dispose: () => {
    if (disposed) return;
    disposed = true; controller.abort();
    if (model) {
      model.removeFromParent();
      const borrowedTextures = new Set<THREE.Texture>();
      if (paint.envMap) borrowedTextures.add(paint.envMap);
      if (glass.envMap) borrowedTextures.add(glass.envMap);
      disposeImportedModel(model, { materials: new Set([paint]), textures: borrowedTextures });
    }
  } };
}
