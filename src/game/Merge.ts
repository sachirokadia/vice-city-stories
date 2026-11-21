/**
 * GeometryBatch — merge many static copies of one geometry into a
 * single draw call.
 *
 * The city was built as one Mesh per building part (~300 meshes for
 * the buildings alone, ~500 in the whole scene). Every mesh is a draw
 * call — and the shadow pass draws the casters a second time. Batching
 * the static parts by material keeps the exact same look with a
 * fraction of the draw calls. Only static geometry goes in a batch:
 * anything that moves (player, car wheels, ocean) stays separate.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class GeometryBatch {
  private items: THREE.BufferGeometry[] = [];

  /** Add one transformed copy of `geo` (the geometry is cloned). */
  add(geo: THREE.BufferGeometry, matrix: THREE.Matrix4): void {
    const g = geo.clone();
    g.applyMatrix4(matrix);
    this.items.push(g);
  }

  /** Add a copy from an Object3D's current transform. */
  addObject(geo: THREE.BufferGeometry, obj: THREE.Object3D): void {
    obj.updateMatrix();
    this.add(geo, obj.matrix);
  }

  get count(): number {
    return this.items.length;
  }

  /** Merge everything into one geometry, or null when empty. */
  build(): THREE.BufferGeometry | null {
    if (this.items.length === 0) return null;
    const merged = mergeGeometries(this.items, false);
    for (const g of this.items) g.dispose();
    this.items = [];
    return merged;
  }
}

/** Compose a transform matrix from position / rotation / scale. */
export function composeMatrix(
  x: number,
  y: number,
  z: number,
  ry: number,
  sx: number,
  sy: number,
  sz: number,
  rx = 0,
): THREE.Matrix4 {
  const obj = new THREE.Object3D();
  obj.position.set(x, y, z);
  obj.rotation.order = 'YXZ';
  obj.rotation.set(rx, ry, 0);
  obj.scale.set(sx, sy, sz);
  obj.updateMatrix();
  return obj.matrix;
}
