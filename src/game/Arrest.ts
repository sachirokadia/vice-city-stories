/**
 * Arrest: the surrender / caught / BUSTED flow on top of the wanted
 * system. No weapons, no combat — the player is never forced down
 * while moving fast; an arrest only happens when the police have
 * genuinely caught up and the player surrenders, or when a pursuer
 * has sat right on top of a stationary player for three seconds.
 *
 * States: none -> prompt -> surrendering -> busted.
 * - prompt: a surrender opportunity is showing. On foot it needs a
 *   pursuer close by (within 7 while walking slowly, or within 3.5
 *   even at a sprint — they have caught you). In the car it needs
 *   the GT stopped (under 2 u/s) with at least 2 police units
 *   within 12 — boxed in. The prompt clears the moment the
 *   conditions break (run away, drive off, wanted clears), and a
 *   5 s cooldown stops it flickering back on.
 * - surrendering: the player chose to surrender (F, or the
 *   SURRENDER button). Movement locks, the hands-up pose plays,
 *   the nearest police unit drives up and stops by the player.
 *   Lasts 2.8 s, then BUSTED.
 * - busted: the arrest is complete. The engine resets the wanted
 *   level and the police the moment this state is entered; this
 *   module just holds the state until respawn() clears it.
 *
 * The auto-arrest (caught) path only fires on foot, with a pursuer
 * within 6 units for 3 s while the player is near-stationary and
 * the unit can actually see them (the police module's line-of-
 * sight verdict, which already blocks on buildings). There is no
 * arrest through walls: the pursuer is a car on the road graph,
 * and the player can never stand inside a building.
 */
import type * as THREE from 'three';
import type { WantedStatus } from './Wanted';
import type { PoliceUnitState } from './Police';

export type ArrestState = 'none' | 'prompt' | 'surrendering' | 'busted';

export interface ArrestContext {
  enabled: boolean;
  wantedLevel: number;
  wantedStatus: WantedStatus;
  driving: boolean;
  playerPos: THREE.Vector3;
  playerSpeed: number;
  vehiclePos: THREE.Vector3;
  vehicleSpeed: number;
  /** Closest active pursuer, from the police module's last update. */
  nearestPursuer: {
    slot: number;
    x: number;
    z: number;
    dist: number;
    sees: boolean;
  } | null;
  /** Active police units (for the car-boxed check). */
  policeUnits: Array<{ x: number; z: number; state: PoliceUnitState }>;
}

export interface ArrestHandle {
  update: (dt: number, ctx: ArrestContext) => ArrestState;
  /** Start the surrender sequence (F / SURRENDER button). */
  trySurrender: () => boolean;
  getState: () => ArrestState;
  /** Slot of the unit sent to approach the player (null if none). */
  arrestSlot: number | null;
  /** Was the player driving when the surrender started? */
  wasDriving: boolean;
  /** Clear everything (respawn / wanted disabled). */
  reset: () => void;
}

/** Pursuer within this distance shows the prompt on foot. */
const PROMPT_FOOT_DIST = 7;
/** This close, the prompt shows even while the player sprints. */
const PROMPT_FOOT_CAUGHT_DIST = 3.5;
/** Above this speed on foot, the prompt needs the caught distance. */
const PROMPT_FOOT_MAX_SPEED = 4;
/** The prompt clears once the pursuer is this far away. */
const PROMPT_CLEAR_DIST = 10;
/** Car: boxed in means this many units this close, GT stopped. */
const PROMPT_CAR_UNITS = 2;
const PROMPT_CAR_DIST = 12;
const PROMPT_CAR_MAX_SPEED = 2;
/** Above this speed the car prompt clears (the player drove off). */
const PROMPT_CAR_ESCAPE_SPEED = 8;
/** Cooldown after a prompt clears before it can show again. */
const PROMPT_COOLDOWN = 5;
/** Auto-arrest: pursuer this close, player near-stationary, seen.
 * Same distance as the foot prompt (7): a pursuer that has pulled
 * up inside the prompt range and sat there is a catch, not a
 * drive-by. The old value (6) left a dead band — the prompt showed
 * with a unit at 6.5 and the auto-arrest could never fire, so a
 * stationary player was never caught (caught by Phase 7A QA). */
const AUTO_ARREST_DIST = 7;
const AUTO_ARREST_MAX_SPEED = 2;
const AUTO_ARREST_HOLD = 3; // seconds
/** Hands-up sequence length before the BUSTED screen. */
const SURRENDER_DURATION = 2.8;

export function createArrest(): ArrestHandle {
  let state: ArrestState = 'none';
  let promptCooldown = 0;
  let autoTimer = 0;
  let surrenderTimer = 0;
  let arrestSlot: number | null = null;
  let wasDriving = false;
  let lastCtx: ArrestContext | null = null;

  /**
   * Boxed in (car): two pursue/roadblock units within 12, or a
   * single pursuer right on the bumper (within `singleDist`). The
   * wider single distance is for the clear check, so the prompt
   * does not flicker at the boundary.
   */
  const carBoxed = (ctx: ArrestContext, singleDist: number): boolean => {
    let near = 0;
    for (const u of ctx.policeUnits) {
      if (u.state !== 'pursue' && u.state !== 'roadblock') continue;
      if (Math.hypot(u.x - ctx.vehiclePos.x, u.z - ctx.vehiclePos.z) < PROMPT_CAR_DIST) near++;
    }
    if (near >= PROMPT_CAR_UNITS) return true;
    const p = ctx.nearestPursuer;
    return !!p && p.dist < singleDist;
  };

  const promptConditions = (ctx: ArrestContext): boolean => {
    if (!ctx.enabled || ctx.wantedLevel === 0 || ctx.wantedStatus !== 'pursuit') return false;
    if (ctx.driving) {
      // Vehicle speed is signed (reverse is negative): "stopped"
      // means near-zero in either direction.
      return Math.abs(ctx.vehicleSpeed) <= PROMPT_CAR_MAX_SPEED && carBoxed(ctx, 6);
    }
    const p = ctx.nearestPursuer;
    if (!p) return false;
    if (p.dist > PROMPT_FOOT_DIST) return false;
    return ctx.playerSpeed < PROMPT_FOOT_MAX_SPEED || p.dist < PROMPT_FOOT_CAUGHT_DIST;
  };

  const promptCleared = (ctx: ArrestContext): boolean => {
    if (!ctx.enabled || ctx.wantedLevel === 0 || ctx.wantedStatus !== 'pursuit') return true;
    if (ctx.driving) {
      if (Math.abs(ctx.vehicleSpeed) > PROMPT_CAR_ESCAPE_SPEED) return true;
      return !carBoxed(ctx, 8);
    }
    const p = ctx.nearestPursuer;
    return !p || p.dist > PROMPT_CLEAR_DIST;
  };

  const startSurrender = (ctx: ArrestContext): void => {
    state = 'surrendering';
    surrenderTimer = 0;
    autoTimer = 0;
    wasDriving = ctx.driving;
    arrestSlot = ctx.nearestPursuer ? ctx.nearestPursuer.slot : null;
  };

  const update = (dt: number, ctx: ArrestContext): ArrestState => {
    lastCtx = ctx;
    if (state === 'busted') return state;
    if (state === 'surrendering') {
      surrenderTimer += dt;
      if (surrenderTimer >= SURRENDER_DURATION) state = 'busted';
      return state;
    }
    if (promptCooldown > 0) promptCooldown -= dt;
    if (state === 'prompt') {
      if (promptCleared(ctx)) {
        state = 'none';
        promptCooldown = PROMPT_COOLDOWN;
        autoTimer = 0;
        return state;
      }
      // Caught on foot: a pursuer sits on a stationary, visible
      // player for three seconds — the arrest starts by itself.
      if (!ctx.driving) {
        const p = ctx.nearestPursuer;
        if (
          p &&
          p.dist < AUTO_ARREST_DIST &&
          p.sees &&
          ctx.playerSpeed < AUTO_ARREST_MAX_SPEED
        ) {
          autoTimer += dt;
          if (autoTimer >= AUTO_ARREST_HOLD) {
            startSurrender(ctx);
            return state;
          }
        } else {
          autoTimer = 0;
        }
      }
      return state;
    }
    // state === 'none'
    if (promptCooldown <= 0 && promptConditions(ctx)) {
      state = 'prompt';
      autoTimer = 0;
    }
    return state;
  };

  return {
    update,
    trySurrender: () => {
      if (state !== 'prompt' || !lastCtx) return false;
      startSurrender(lastCtx);
      return true;
    },
    getState: () => state,
    get arrestSlot() {
      return arrestSlot;
    },
    get wasDriving() {
      return wasDriving;
    },
    reset: () => {
      state = 'none';
      promptCooldown = 0;
      autoTimer = 0;
      surrenderTimer = 0;
      arrestSlot = null;
      wasDriving = false;
      lastCtx = null;
    },
  };
}
