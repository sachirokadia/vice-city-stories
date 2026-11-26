import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeImportedModel } from './CoastalDistrict';

interface DrawUnit {
  slot: number; kind: 'sedan' | 'suv'; x: number; z: number; heading: number;
  wheelSpin: number; steer: number; onDuty: boolean; phase: boolean; distance: number;
}
interface Part {
  mesh: THREE.InstancedMesh;
  wheel: boolean;
  placements: Array<{ front: boolean; spinning: boolean; pivot: THREE.Matrix4; scale: THREE.Matrix4; local: THREE.Matrix4 }>;
  emergency: 'red' | 'blue' | null;
}

/** Detailed near vehicles share geometry/materials; the existing five-call fleet is their far LOD. */
export function installDetailedPolice(parent: THREE.Group, capacity: number) {
  const group = new THREE.Group(); group.name = 'detailed-police-fleet'; parent.add(group);
  const abort = new AbortController(), kinds = new Map<'sedan' | 'suv', Part[]>();
  const sources: THREE.Group[] = [], ownMaterials: THREE.Material[] = [];
  let disposed = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const root = new THREE.Matrix4(), work = new THREE.Matrix4(), rotation = new THREE.Matrix4();
  const color = new THREE.Color();
  const ready = (async () => {
    for (const kind of ['sedan', 'suv'] as const) {
      if (disposed) break;
      try {
        const response = await fetch(`${import.meta.env?.BASE_URL ?? '/'}world-v2/models/police-${kind}-detailed-v3.glb`, { signal: abort.signal });
        if (!response.ok) throw new Error(`Police model download failed (${response.status})`);
        const source = (await new GLTFLoader().parseAsync(await response.arrayBuffer(), '')).scene;
        if (disposed) { disposeImportedModel(source); break; }
        source.updateMatrixWorld(true); sources.push(source);
        const buckets = new Map<string, Part>();
        source.traverse(object => {
          if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
          let pivot: THREE.Object3D | null = object.parent, spinning = false;
          while (pivot && !pivot.name.startsWith('Wheel_')) {
            if (pivot.name === 'WheelSpin' || pivot.name.startsWith('WheelSpin_')) spinning = true;
            pivot = pivot.parent;
          }
          const wheel = pivot !== null;
          const key = wheel ? `${pivot!.name.endsWith('Left') ? 'left' : 'right'}:${spinning}:${object.material.uuid}` : object.uuid;
          let part = buckets.get(key);
          if (!part) {
            let material = object.material;
            const emergency = material.name === 'Emergency_Red' ? 'red' : material.name === 'Emergency_Blue' ? 'blue' : null;
            if (emergency) {
              material = new THREE.MeshBasicMaterial({ color: (object.material as THREE.MeshStandardMaterial).color, toneMapped: false });
              ownMaterials.push(material);
            }
            const mesh = new THREE.InstancedMesh(object.geometry, material, capacity * (wheel ? 2 : 1));
            mesh.name = `police-${kind}-${object.name}`;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
            mesh.castShadow = !material.transparent && !emergency; mesh.receiveShadow = true;
            for (let i = 0; i < mesh.count; i++) {
              mesh.setMatrixAt(i, zero);
              if (emergency) mesh.setColorAt(i, color.setScalar(.12));
            }
            group.add(mesh); part = { mesh, wheel, placements: [], emergency }; buckets.set(key, part);
          }
          if (pivot) {
            const position = new THREE.Vector3(), orientation = new THREE.Quaternion(), size = new THREE.Vector3();
            pivot.matrixWorld.decompose(position, orientation, size);
            part.placements.push({ front: pivot.name.includes('Front'), spinning,
              pivot: new THREE.Matrix4().compose(position, orientation, new THREE.Vector3(1, 1, 1)),
              scale: new THREE.Matrix4().makeScale(size.x, size.y, size.z),
              local: pivot.matrixWorld.clone().invert().multiply(object.matrixWorld) });
          } else {
            part.placements.push({ front: false, spinning: false, pivot: new THREE.Matrix4(), scale: new THREE.Matrix4(), local: object.matrixWorld.clone() });
          }
        });
        kinds.set(kind, [...buckets.values()]);
      } catch (error) {
        if (!disposed) console.warn(`[vcs] Detailed police ${kind} could not load; retaining the working instanced vehicle.`, error);
      }
    }
  })();
  const hide = (slot: number) => {
    for (const parts of kinds.values()) for (const part of parts) {
      part.mesh.setMatrixAt(slot * (part.wheel ? 2 : 1), zero);
      if (part.wheel) part.mesh.setMatrixAt(slot * 2 + 1, zero);
    }
  };
  return { ready, hide,
    render: (unit: DrawUnit): boolean => {
      hide(unit.slot);
      const parts = kinds.get(unit.kind);
      if (!parts || unit.distance > 85 || disposed) return false;
      root.makeRotationY(unit.heading); root.setPosition(unit.x, 0, unit.z);
      for (const part of parts) {
        for (const placement of part.placements) {
          work.copy(root).multiply(placement.pivot);
          if (part.wheel && placement.front) work.multiply(rotation.makeRotationY(unit.steer));
          if (placement.spinning) work.multiply(rotation.makeRotationX(unit.wheelSpin));
          work.multiply(placement.scale).multiply(placement.local);
          const index = part.wheel ? unit.slot * 2 + (placement.front ? 0 : 1) : unit.slot;
          part.mesh.setMatrixAt(index, work);
          if (part.emergency) {
            const lit = unit.onDuty && (unit.phase === (part.emergency === 'red'));
            part.mesh.setColorAt(index, color.setScalar(lit ? 2.5 : .12));
          }
        }
      }
      return true;
    },
    flush: () => {
      for (const parts of kinds.values()) for (const part of parts) {
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose: () => {
      if (disposed) return; disposed = true; abort.abort(); group.removeFromParent();
      for (const parts of kinds.values()) for (const part of parts) part.mesh.dispose();
      ownMaterials.forEach(m => m.dispose()); sources.forEach(source => disposeImportedModel(source));
      kinds.clear();
    },
  };
}
