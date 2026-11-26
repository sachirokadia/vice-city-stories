import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { QualitySettings } from './Quality';
import { COASTAL_BUILDINGS } from './CoastalDistrictLayout';

export interface CoastalLoadStatus { loaded: number; failed: number; total: number }

export function disposeImportedModel(root: THREE.Object3D, borrowed: {
  materials?: ReadonlySet<THREE.Material>; textures?: ReadonlySet<THREE.Texture>;
} = {}): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (borrowed.materials?.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture && !borrowed.textures?.has(value)) textures.add(value);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  const images = new Set<unknown>();
  textures.forEach(t => { images.add(t.source.data); t.dispose(); });
  images.forEach(image => { if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close(); });
}

/** Batch opaque parts per material; retain transparent floor chunks for sorting. */
export function batchCoastalBuilding(root: THREE.Group): void {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh || Array.isArray(object.material)) return;
    object.castShadow = !object.material.transparent; object.receiveShadow = true;
    if (object.material.transparent) return;
    const bucket = buckets.get(object.material) ?? { geometries: [], meshes: [] };
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    bucket.geometries.push(geometry); bucket.meshes.push(object);
    buckets.set(object.material, bucket);
  });
  const removed = new Set<THREE.BufferGeometry>();
  for (const [material, bucket] of buckets) {
    const merged = mergeGeometries(bucket.geometries, false);
    bucket.geometries.forEach(g => g.dispose());
    if (!merged) continue;
    for (const old of bucket.meshes) { old.removeFromParent(); removed.add(old.geometry); }
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `coastal-batched-${material.name}`; mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  removed.forEach(g => g.dispose());
}

export function installCoastalDistrict(
  parent: THREE.Group, quality: QualitySettings, onProgress?: (status: CoastalLoadStatus) => void,
): { ready: Promise<CoastalLoadStatus>; dispose: () => void } {
  const group = new THREE.Group(); group.name = 'ocean-drive-detailed-buildings'; parent.add(group);
  const controller = new AbortController();
  const status: CoastalLoadStatus = { loaded: 0, failed: 0, total: COASTAL_BUILDINGS.length };
  let disposed = false;
  const fallbackMaterial = new THREE.MeshStandardMaterial({ color: '#c8baa1', roughness: .87 });
  const placeholders = COASTAL_BUILDINGS.map(b => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.depth, b.height, b.width), fallbackMaterial);
    mesh.name = `coastal-loading-${b.id}`; mesh.position.set(b.x, b.height / 2, b.z);
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  });
  const ready = (async () => {
    const loader = new GLTFLoader();
    const lowDetail = quality.tier === 'low' || quality.tier === 'medium';
    for (let i = 0; i < COASTAL_BUILDINGS.length; i++) {
      if (disposed) break;
      const b = COASTAL_BUILDINGS[i];
      try {
        // Serial decoding bounds peak memory; only the chosen LOD is downloaded.
        const url = `${import.meta.env?.BASE_URL ?? '/'}world-v2/models/${b.id}${lowDetail ? '-lod1' : ''}.glb`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Model download failed (${response.status})`);
        const gltf = await loader.parseAsync(await response.arrayBuffer(), '');
        if (disposed) { disposeImportedModel(gltf.scene); break; }
        batchCoastalBuilding(gltf.scene);
        gltf.scene.name = b.id; gltf.scene.userData.assetId = b.id;
        gltf.scene.userData.detail = lowDetail ? 'LOD1' : 'LOD0';
        gltf.scene.position.set(b.x, .01, b.z); gltf.scene.rotation.y = Math.PI / 2;
        group.add(gltf.scene); placeholders[i].removeFromParent(); placeholders[i].geometry.dispose(); status.loaded++;
      } catch (error) {
        if (disposed) break;
        status.failed++;
        console.warn(`[vcs] ${b.name} could not load; keeping its collision-safe fallback.`, error);
      }
      if (!disposed) onProgress?.({ ...status });
    }
    return { ...status };
  })();
  return { ready, dispose: () => {
    if (disposed) return;
    disposed = true; controller.abort(); group.removeFromParent(); disposeImportedModel(group);
    placeholders.forEach(mesh => mesh.geometry.dispose()); fallbackMaterial.dispose();
  } };
}
