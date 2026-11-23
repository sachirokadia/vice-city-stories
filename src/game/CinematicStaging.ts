/**
 * Cinematic staging — Phase 9D.
 *
 * A staged character is the same procedural rig as the
 * protagonist (Character.ts), recoloured with the character's
 * palette from StoryCharacters and driven by the same
 * animation machine (CharacterAnimation.ts): idle breathing
 * when still, a walk gait when walking to a point. Nothing is
 * duplicated per character — one rig, one palette, one
 * animation class — and every staged character is removed
 * from the scene and disposed when the cinematic cleans up,
 * so no temporary character ever adds a permanent draw call.
 */
import * as THREE from 'three';
import { createCharacter } from './Character';
import type { CharacterRig } from './Character';
import { CharacterAnimation } from './CharacterAnimation';
import { storyCharacter } from './StoryCharacters';

export interface StagedActor {
  characterId: string;
  group: THREE.Group;
  /** Advance the animation (and any walk-to movement). */
  update: (dt: number) => void;
  /** Remove from the scene and dispose every resource. */
  dispose: () => void;
}

export interface StageActorOptions {
  /** Slow walk to a point, then idle. Omitted = idle in place. */
  walkTo?: [number, number];
  /** Walk speed in m/s (default 1.4 — a slow cinematic stroll). */
  walkSpeed?: number;
}

const _to = new THREE.Vector3();

/** Build one staged character at a world position, facing a heading. */
export function createStagedActor(
  scene: THREE.Scene,
  characterId: string,
  pos: [number, number],
  heading: number,
  options: StageActorOptions = {},
): StagedActor {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const info = storyCharacter(characterId);
  // Phase 1: the character's design (proportions, hair, clothing,
  // accessories) goes into the build; no design = the original rig.
  const { group, rig, mats } = createCharacter(track, info.design);
  group.name = `staged-${characterId}`;
  // Recolour the shared rig with this character's palette.
  // Kai has no palette: he keeps the rig's defaults.
  const palette = info.palette;
  if (palette) {
    mats.jacket.color.set(palette.jacket);
    mats.sleeve.color.set(palette.jacket);
    mats.shirt.color.set(palette.shirt);
    mats.thigh.color.set(palette.trousers);
    mats.shin.color.set(palette.trousers);
    mats.hair.color.set(palette.hair);
    if (palette.skin) mats.skin.color.set(palette.skin);
  }
  group.position.set(pos[0], 0, pos[1]);
  group.rotation.y = heading;
  scene.add(group);

  const animation = new CharacterAnimation(rig);
  let walking = options.walkTo !== undefined;
  const target = options.walkTo
    ? _to.set(options.walkTo[0], 0, options.walkTo[1])
    : new THREE.Vector3();
  const speed = options.walkSpeed ?? 1.4;
  let disposed = false;

  return {
    characterId,
    group,
    update(dt: number): void {
      if (disposed || dt <= 0) return;
      if (walking) {
        const dx = target.x - group.position.x;
        const dz = target.z - group.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.05) {
          walking = false;
          animation.update(dt, 0, false, 0);
          return;
        }
        const step = Math.min(dist, speed * dt);
        const vx = (dx / dist) * step;
        const vz = (dz / dist) * step;
        group.position.x += vx;
        group.position.z += vz;
        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const applied = diff * Math.min(1, dt * 8);
        group.rotation.y += applied;
        const actualSpeed = dt > 0 ? step / dt : 0;
        animation.update(dt, actualSpeed, false, dt > 0 ? applied / dt : 0);
      } else {
        animation.update(dt, 0, false, 0);
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* already disposed */
        }
      }
    },
  };
}

/** Type-only re-export for the runtime (keeps rig details local). */
export type { CharacterRig };
