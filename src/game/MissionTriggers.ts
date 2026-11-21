/**
 * Mission triggers — the pure condition checks for each objective
 * type. The manager owns the state machine; this module only
 * answers "is this objective done yet, given the live game state?"
 * so a new objective type never has to touch the manager.
 *
 * Positional objectives are pure functions of the game state.
 * The 'follow' objective is stateful — it keeps its own timers
 * in the scratch object the manager owns and passes in — so the
 * evaluation itself stays here, next to the other triggers.
 */
import type { FollowParams, ObjectiveType } from './MissionTypes';
import type { WantedStatus } from './Wanted';

export interface TriggerContext {
  playerPos: { x: number; z: number };
  /** The player's on-foot speed (for future trigger types). */
  playerSpeed: number;
  driving: boolean;
  vehiclePos: { x: number; z: number };
  vehicleSpeed: number;
  /** Current wanted level (0 = clean) — for 'evade'. */
  wantedLevel: number;
  wantedStatus: WantedStatus;
}

const dist2d = (
  ax: number, az: number,
  bx: number, bz: number,
): number => Math.hypot(ax - bx, az - bz);

/**
 * Positional objectives (reach / checkpoint / deliver) complete
 * when the player — or their car, while driving — is inside the
 * radius. The interact objective is completed by tryInteract, not
 * by polling, so it is never true here. 'follow' and 'evade' have
 * their own evaluators below.
 */
export function evaluateTrigger(
  type: ObjectiveType,
  target: { x: number; z: number },
  radius: number,
  ctx: TriggerContext,
): boolean {
  switch (type) {
    case 'reach':
    case 'checkpoint':
    case 'deliver': {
      const px = ctx.driving ? ctx.vehiclePos.x : ctx.playerPos.x;
      const pz = ctx.driving ? ctx.vehiclePos.z : ctx.playerPos.z;
      return dist2d(px, pz, target.x, target.z) <= radius;
    }
    case 'enterVehicle':
      return ctx.driving;
    case 'evade':
      return ctx.wantedLevel === 0;
    case 'interact':
    case 'follow':
      return false;
  }
}

/** Distance from the player (or their car) to a target point. */
export function distanceTo(
  target: { x: number; z: number },
  ctx: TriggerContext,
): number {
  const px = ctx.driving ? ctx.vehiclePos.x : ctx.playerPos.x;
  const pz = ctx.driving ? ctx.vehiclePos.z : ctx.playerPos.z;
  return dist2d(px, pz, target.x, target.z);
}

/** Per-objective scratch state for a 'follow' objective, owned by
 * the manager and reset when the objective starts. */
export interface FollowScratch {
  /** True once the player has been inside the band at least once. */
  lockedOn: boolean;
  /** Seconds spent under minDist (continuous). */
  tooClose: number;
  /** Seconds spent over maxDist while locked on (continuous). */
  tooFar: number;
}

export function createFollowScratch(): FollowScratch {
  return { lockedOn: false, tooClose: 0, tooFar: 0 };
}

export type FollowResult =
  | { status: 'in-progress' }
  | { status: 'done' }
  | { status: 'failed'; reason: 'lost' | 'spotted' };

/**
 * The tail: the player (in the car — on foot they cannot keep up)
 * must stay inside [minDist, maxDist] of the target while it
 * drives its route. The objective completes when the target has
 * covered its route and the player is inside the band. Too close
 * for too long and the target makes the tail ('spotted'); too far
 * for too long after locking on and it is gone ('lost'). Before
 * the first lock-on there is no too-far failure — the player is
 * still catching up.
 */
export function evaluateFollow(
  params: FollowParams,
  targetPos: { x: number; z: number },
  targetTravelled: number,
  ctx: TriggerContext,
  scratch: FollowScratch,
  dt: number,
): FollowResult {
  const px = ctx.driving ? ctx.vehiclePos.x : ctx.playerPos.x;
  const pz = ctx.driving ? ctx.vehiclePos.z : ctx.playerPos.z;
  const d = dist2d(px, pz, targetPos.x, targetPos.z);

  if (d < params.minDist) {
    scratch.tooClose += dt;
    scratch.tooFar = 0;
    if (scratch.tooClose >= params.tooCloseSeconds) {
      return { status: 'failed', reason: 'spotted' };
    }
  } else if (d > params.maxDist) {
    scratch.tooClose = 0;
    // The too-far clock only runs while the target is still
    // driving away. Once it has parked at its destination, the
    // player closes the gap on their own time (the mission timer
    // is the only pressure left).
    if (scratch.lockedOn && targetTravelled < params.routeLength) {
      scratch.tooFar += dt;
      if (scratch.tooFar >= params.tooFarSeconds) {
        return { status: 'failed', reason: 'lost' };
      }
    }
  } else {
    scratch.lockedOn = true;
    scratch.tooClose = 0;
    scratch.tooFar = 0;
  }

  if (targetTravelled >= params.routeLength && d <= params.maxDist) {
    return { status: 'done' };
  }
  return { status: 'in-progress' };
}
