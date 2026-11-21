/**
 * Procedural animation state machine for the protagonist.
 *
 * States: idle (breathing, weight shift), walk, run, sprint.
 * The pose is computed from the character's ACTUAL speed — the
 * displacement the collision system allowed, not the keys held —
 * so pushing against a wall stops the legs instead of sliding.
 * The gait phase advances by stride length, so foot placement
 * matches ground speed and sliding stays small. Every joint eases
 * toward its target pose, which is what makes idle -> walk ->
 * run -> stop smooth instead of snappy. Turning leans the torso
 * into the turn and counter-rotates the head.
 */
import type { CharacterRig } from './Character';

export type AnimState = 'idle' | 'walk' | 'run' | 'sprint';

interface Pose {
  legL: number;
  legR: number;
  kneeL: number;
  kneeR: number;
  armL: number;
  armR: number;
  elbowL: number;
  elbowR: number;
  torsoX: number;
  torsoY: number;
  torsoZ: number;
  headX: number;
  headY: number;
  bodyY: number;
  armOut: number;
}

const IDLE_POSE: Pose = {
  legL: 0,
  legR: 0,
  kneeL: 0.06,
  kneeR: 0.06,
  armL: 0,
  armR: 0,
  elbowL: -0.15,
  elbowR: -0.15,
  torsoX: 0,
  torsoY: 0,
  torsoZ: 0,
  headX: 0,
  headY: 0,
  bodyY: 0,
  armOut: 0.1,
};

const GAIT: Record<'walk' | 'run' | 'sprint', {
  stride: number;
  leg: number;
  arm: number;
  knee: number;
  elbow: number;
  lean: number;
  bob: number;
  twist: number;
}> = {
  walk: { stride: 1.35, leg: 0.5, arm: 0.4, knee: 0.8, elbow: 0.3, lean: 0.05, bob: 0.025, twist: 0.06 },
  run: { stride: 1.9, leg: 0.8, arm: 0.65, knee: 1.2, elbow: 0.9, lean: 0.13, bob: 0.045, twist: 0.12 },
  sprint: { stride: 2.3, leg: 1.0, arm: 0.85, knee: 1.5, elbow: 1.1, lean: 0.2, bob: 0.055, twist: 0.16 },
};

const HANDSUP_POSE: Pose = {
  legL: 0,
  legR: 0,
  kneeL: 0.06,
  kneeR: 0.06,
  // Both arms up overhead, slightly out — hands up.
  armL: -2.7,
  armR: -2.7,
  elbowL: -0.25,
  elbowR: -0.25,
  torsoX: 0.05,
  torsoY: 0,
  torsoZ: 0,
  headX: -0.1,
  headY: 0,
  bodyY: 0,
  armOut: 0.3,
};

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export class CharacterAnimation {
  state: AnimState = 'idle';

  private rig: CharacterRig;
  private phase = 0;
  private time = 0;
  private pose: Pose = { ...IDLE_POSE };

  constructor(rig: CharacterRig) {
    this.rig = rig;
  }

  /**
   * Drive the pose from actual movement. `speed` is metres/second
   * really travelled, `sprint` is the Shift key, `turnRate` is
   * radians/second of body yaw.
   */
  update(dt: number, speed: number, sprint: boolean, turnRate: number): void {
    this.time += dt;
    const moving = speed > 0.4;
    const next: AnimState = !moving
      ? 'idle'
      : sprint && speed > 8.5
        ? 'sprint'
        : speed > 7
          ? 'run'
          : 'walk';
    this.state = next;

    let target: Pose;
    if (next === 'idle') {
      const b = Math.sin(this.time * 1.6);
      target = {
        ...IDLE_POSE,
        torsoX: -0.012 * b,
        torsoZ: 0.02 * Math.sin(this.time * 0.4),
        headY: 0.12 * Math.sin(this.time * 0.5),
        headX: 0.03 * Math.sin(this.time * 0.8 + 1),
        armL: 0.04 * b,
        armR: 0.04 * Math.sin(this.time * 1.6 + 0.6),
        bodyY: 0.004 * b,
      };
    } else {
      const g = GAIT[next];
      // Stride-matched phase: one full cycle covers 2 strides.
      this.phase += (dt * Math.PI * speed) / g.stride;
      const p = this.phase;
      const s = Math.sin(p);
      const c = Math.cos(p);
      target = {
        legL: g.leg * s,
        legR: -g.leg * s,
        kneeL: g.knee * Math.max(0, -c),
        kneeR: g.knee * Math.max(0, c),
        armL: -g.arm * s,
        armR: g.arm * s,
        elbowL: -(g.elbow + 0.25 * Math.max(0, -s)),
        elbowR: -(g.elbow + 0.25 * Math.max(0, s)),
        torsoX: -g.lean,
        torsoY: g.twist * s,
        torsoZ: 0.05 * s + clamp(turnRate * 0.05, -0.1, 0.1),
        headX: 0.04,
        headY: clamp(-turnRate * 0.08, -0.15, 0.15),
        bodyY: g.bob * Math.abs(c),
        armOut: next === 'walk' ? 0.12 : 0.18,
      };
    }

    // Ease every joint toward its target — this is the transition
    // system: stops, starts and state changes all blend smoothly.
    const k = Math.min(1, dt * 10);
    const cur = this.pose;
    (Object.keys(target) as Array<keyof Pose>).forEach((key) => {
      cur[key] += (target[key] - cur[key]) * k;
    });
    this.apply();
  }

  /**
   * Hands-up surrender pose: eases every joint to the raised-arms
   * pose and holds it. The gait phase does not advance, so the
   * legs stay planted while the arms go up.
   */
  updateSurrender(dt: number): void {
    this.time += dt;
    const k = Math.min(1, dt * 6);
    const cur = this.pose;
    (Object.keys(HANDSUP_POSE) as Array<keyof Pose>).forEach((key) => {
      cur[key] += (HANDSUP_POSE[key] - cur[key]) * k;
    });
    this.apply();
  }

  private apply(): void {
    const r = this.rig;
    const p = this.pose;
    r.legL.rotation.x = p.legL;
    r.legR.rotation.x = p.legR;
    r.kneeL.rotation.x = p.kneeL;
    r.kneeR.rotation.x = p.kneeR;
    r.armL.rotation.x = p.armL;
    r.armR.rotation.x = p.armR;
    r.armL.rotation.z = p.armOut;
    r.armR.rotation.z = -p.armOut;
    r.elbowL.rotation.x = p.elbowL;
    r.elbowR.rotation.x = p.elbowR;
    r.torso.rotation.x = p.torsoX;
    r.torso.rotation.y = p.torsoY;
    r.torso.rotation.z = p.torsoZ;
    r.head.rotation.x = p.headX;
    r.head.rotation.y = p.headY;
    r.body.position.y = p.bodyY;
  }
}
