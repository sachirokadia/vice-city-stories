import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { CharacterRig } from './Character';
import { disposeImportedModel } from './CoastalDistrict';

interface SharedActor { users: number; abort: AbortController; ready: Promise<THREE.Group> }
const actors = new Map<string, SharedActor>();
const supported = new Set(['kai', 'june', 'lena']);

function acquire(id: string): { ready: Promise<THREE.Group>; release: () => void } {
  let entry = actors.get(id);
  if (!entry) {
    const abort = new AbortController();
    const ready = (async () => {
      const response = await fetch(`${import.meta.env?.BASE_URL ?? '/'}world-v2/models/${id}-realism-v3.glb`, { signal: abort.signal });
      if (!response.ok) throw new Error(`Character download failed (${response.status})`);
      return (await new GLTFLoader().parseAsync(await response.arrayBuffer(), '')).scene;
    })();
    entry = { users: 0, abort, ready }; actors.set(id, entry);
  }
  const current = entry; current.users++;
  let released = false;
  return { ready: current.ready, release: () => {
    if (released) return; released = true; current.users--;
    if (current.users) return;
    if (actors.get(id) === current) actors.delete(id);
    current.abort.abort();
    void current.ready.then(disposeImportedModel, () => {});
  } };
}

/** Drive the delivered MakeHuman skeleton from the existing game's gait and surrender poses. */
export function installDetailedCharacter(parent: THREE.Group, rig: CharacterRig, id: string) {
  const originals: THREE.Mesh[] = [];
  parent.traverse(object => { if (object instanceof THREE.Mesh) originals.push(object); });
  let model: THREE.Object3D | undefined, disposed = false, enabled = true, originalsHidden = false;
  const originalVisibility = new Map<THREE.Mesh, boolean>();
  const bindings: Array<{ bone: THREE.Bone; pose: THREE.Group; rest: THREE.Quaternion }> = [];
  const lease = supported.has(id) ? acquire(id) : undefined;
  const syncVisibility = () => {
    if (!model) return;
    model.visible = enabled;
    if (enabled) {
      if (!originalsHidden) originals.forEach(mesh => originalVisibility.set(mesh, mesh.visible));
      originals.forEach(mesh => { mesh.visible = false; }); originalsHidden = true;
    } else if (originalsHidden) {
      originals.forEach(mesh => { mesh.visible = originalVisibility.get(mesh) ?? true; }); originalsHidden = false;
    }
  };
  const ready = (async () => {
    if (!lease) return;
    try {
      const source = await lease.ready;
      if (disposed) return;
      model = clone(source);
      model.name = `detailed-actor-${id}`;
      const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
      model.scale.multiplyScalar(1.85 / height);
      const slots: Array<[string, THREE.Group]> = [
        ['spine01', rig.torso], ['head', rig.head],
        ['upperleg01.L', rig.legL], ['upperleg01.R', rig.legR],
        ['lowerleg01.L', rig.kneeL], ['lowerleg01.R', rig.kneeR],
        ['upperarm01.L', rig.armL], ['upperarm01.R', rig.armR],
        ['lowerarm01.L', rig.elbowL], ['lowerarm01.R', rig.elbowR],
      ];
      for (const [name, pose] of slots) {
        const bone = model.getObjectByName(name) ?? model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
        if (bone instanceof THREE.Bone) bindings.push({ bone, pose, rest: bone.quaternion.clone() });
      }
      model.traverse(object => {
        if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
      });
      parent.add(model); parent.userData.detailedActor = id; syncVisibility();
    } catch (error) {
      if (!disposed) console.warn(`[vcs] Detailed ${id} could not load; preserving the animated original.`, error);
    }
  })();
  return { ready, setEnabled: (value: boolean) => { enabled = value; syncVisibility(); },
    update: () => {
      if (!model || !enabled) return;
      model.position.y = rig.body.position.y;
      bindings.forEach(({ bone, pose, rest }) => bone.quaternion.copy(rest).multiply(pose.quaternion));
    }, dispose: () => {
      if (disposed) return; disposed = true;
      if (model) {
        model.removeFromParent();
        model.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose(); });
      }
      lease?.release();
    } };
}
