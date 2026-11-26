/**
 * The player: the original articulated protagonist (see
 * Character.ts) driven by a procedural animation state machine
 * (see CharacterAnimation.ts).
 *
 * Movement is kinematic on purpose — Phase 1 has no physics
 * engine. The character walks on the flat ground plane and is
 * pushed out of building footprints with a circle-vs-box test,
 * so it can never walk through a wall. A real physics engine
 * (gravity, jumping, vehicles) arrives in a later phase.
 */
import * as THREE from 'three';
import type { InputState } from './Input';
import { effectiveMove } from './Input';
import type { BuildingBox } from './World';
import { createCharacter } from './Character';
import { CharacterAnimation } from './CharacterAnimation';
import { applyOutfit } from './Outfits';
import type { OutfitDef } from './Outfits';
import { DEFAULT_OUTFIT_ID } from './Outfits';
import { installDetailedCharacter } from './DetailedCharacter';

export interface PlayerHandle {
  visualReady: Promise<void>;
  mesh: THREE.Group;
  update: (dt: number, cameraYaw: number, input: InputState) => void;
  position: THREE.Vector3;
  /** Hands-up lock: movement stops and the surrender pose plays. */
  setSurrendered: (surrendered: boolean) => void;
  /** Downed (defeated in combat): input ignored, the figure lies
   * flat. Separate from surrender — arrest and combat defeat are
   * different outcomes. */
  setDowned: (downed: boolean) => void;
  /** Recolour the live protagonist to an outfit (face, rig and animation untouched). */
  applyOutfit: (outfit: OutfitDef) => void;
  dispose: () => void;
}

const WALK_SPEED = 6;
const SPRINT_SPEED = 10.5;
const PLAYER_RADIUS = 0.6;
const WORLD_BOUND = 195;

export function createPlayer(
  scene: THREE.Scene,
  spawn: THREE.Vector3,
  buildings: BuildingBox[],
): PlayerHandle {
  // --- Mesh: the articulated protagonist (Character.ts) ---
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const { group, rig, mats, parts } = createCharacter(track);
  const animation = new CharacterAnimation(rig);
  const detailed = installDetailedCharacter(group, rig, 'kai');

  scene.add(group);

  const position = new THREE.Vector3(spawn.x, 0, spawn.z);
  group.position.copy(position);
  const prevPosition = position.clone();
  // Speed eases toward its target instead of snapping: the
  // character accelerates and decelerates, and the animation
  // machine's run state is genuinely reachable on the way
  // between walk (6) and sprint (10.5) instead of defined but
  // never seen. Steady-state speeds are unchanged.
  let currentSpeed = 0;
  const ACCEL = 25; // units/second^2
  let surrendered = false;
  let downed = false;

  /** Push the position out of any building box it overlaps. */
  const resolveCollisions = (p: THREE.Vector3): void => {
    for (const b of buildings) {
      const cx = THREE.MathUtils.clamp(p.x, b.minX, b.maxX);
      const cz = THREE.MathUtils.clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq >= PLAYER_RADIUS * PLAYER_RADIUS) continue;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        p.x = cx + (dx / dist) * PLAYER_RADIUS;
        p.z = cz + (dz / dist) * PLAYER_RADIUS;
      } else {
        // Centre is inside the box: push out along the smallest penetration.
        const pushLeft = p.x - b.minX;
        const pushRight = b.maxX - p.x;
        const pushUp = p.z - b.minZ;
        const pushDown = b.maxZ - p.z;
        const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (min === pushLeft) p.x = b.minX - PLAYER_RADIUS;
        else if (min === pushRight) p.x = b.maxX + PLAYER_RADIUS;
        else if (min === pushUp) p.z = b.minZ - PLAYER_RADIUS;
        else p.z = b.maxZ + PLAYER_RADIUS;
      }
    }
    p.x = THREE.MathUtils.clamp(p.x, -WORLD_BOUND, WORLD_BOUND);
    p.z = THREE.MathUtils.clamp(p.z, -WORLD_BOUND, WORLD_BOUND);
  };

  return {
    visualReady: detailed.ready,
    mesh: group,
    position,
    setSurrendered: (next: boolean) => {
      surrendered = next;
      if (!next) currentSpeed = 0;
    },
    setDowned: (next: boolean) => {
      downed = next;
      // Lie flat on the back (rotation.x only — the heading lives
      // on rotation.y, which the update keeps writing).
      group.rotation.x = next ? -Math.PI / 2 : 0;
      if (!next) currentSpeed = 0;
    },
    applyOutfit: (outfit: OutfitDef) => {
      detailed.setEnabled(outfit.id === DEFAULT_OUTFIT_ID);
      applyOutfit(mats, parts, outfit);
      // Alternate purchased outfits retain their original geometry and print support.
      detailed.setEnabled(outfit.id === DEFAULT_OUTFIT_ID);
    },
    update: (dt: number, cameraYaw: number, input: InputState) => {
      // Downed: flat on the ground, input ignored, no pose.
      if (downed) {
        currentSpeed = 0;
        prevPosition.copy(position);
        return;
      }
      // Surrendered: hands up, feet planted — input is ignored and
      // the pose plays instead of the gait machine.
      if (surrendered) {
        currentSpeed = 0;
        prevPosition.copy(position);
        animation.updateSurrender(dt);
        detailed.update();
        return;
      }
      const move = effectiveMove(input);
      // Camera-relative: W walks away from the camera (into the
      // screen), D strafes to the camera's right. (The old vz sign
      // made W walk toward the camera — position probes never showed
      // it, but on screen the character walked at the viewer.)
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      const dx = move.x * cos - move.y * sin;
      const dz = -move.x * sin - move.y * cos;
      const mag = Math.hypot(dx, dz);
      const targetSpeed =
        mag > 0.01 ? (move.sprint ? SPRINT_SPEED : WALK_SPEED) * Math.min(1, mag) : 0;
      const step = ACCEL * dt;
      currentSpeed =
        targetSpeed > currentSpeed
          ? Math.min(targetSpeed, currentSpeed + step)
          : Math.max(targetSpeed, currentSpeed - step);
      const vx = mag > 0.01 ? (dx / mag) * currentSpeed : 0;
      const vz = mag > 0.01 ? (dz / mag) * currentSpeed : 0;

      position.x += vx * dt;
      position.z += vz * dt;
      resolveCollisions(position);
      group.position.copy(position);

      // Animation runs on ACTUAL velocity — the displacement the
      // collision system allowed — so pushing against a wall stops
      // the legs instead of sliding in place.
      const actualSpeed =
        dt > 0 ? Math.hypot(position.x - prevPosition.x, position.z - prevPosition.z) / dt : 0;
      prevPosition.copy(position);

      let turnRate = 0;
      if (Math.hypot(vx, vz) > 0.4) {
        const targetYaw = Math.atan2(vx, vz);
        // Shortest-angle turn toward movement direction.
        let diff = targetYaw - group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const applied = diff * Math.min(1, dt * 12);
        group.rotation.y += applied;
        turnRate = dt > 0 ? applied / dt : 0;
      }
      animation.update(dt, actualSpeed, move.sprint, turnRate);
      detailed.update();
    },
    dispose: () => {
      detailed.dispose();
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
