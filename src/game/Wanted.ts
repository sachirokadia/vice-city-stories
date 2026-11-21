/**
 * The wanted system: a five-star heat model, no weapons, no combat.
 *
 * Heat (0–100) rises with offences and falls while the player stays
 * hidden. The level is read off the heat; the status is a separate
 * state machine: PURSUIT while any police unit can see the player,
 * SEARCH once they have been unseen for a while (police drive to the
 * last known spot and look around), CLEAR when the escape timer runs
 * out without a re-detection. The level never drops to zero mid-
 * search — the timer, not the heat, is what clears it.
 *
 * Offences (all detected from the live game state, nothing invented):
 * - hitting a pedestrian with the car, or shoving into one on foot
 * - hitting an AI vehicle with the Velocity GT
 * - sustained reckless speed (> 28 u/s, ~100 km/h, for 2 s)
 * - running a red light at a signalised intersection
 * Stealing an AI vehicle is not a feature of this game, so it has no
 * trigger here.
 */
import type * as THREE from 'three';
import { SIGNAL_SPOTS } from './Roads';

export type WantedStatus = 'clear' | 'pursuit' | 'search';

export interface WantedState {
  level: number; // 0–5
  heat: number; // 0–100
  status: WantedStatus;
  /** 0–1, only meaningful while searching. */
  escapeProgress: number;
  lastKnown: { x: number; z: number } | null;
  seen: boolean;
}

export interface WantedContext {
  playerPos: THREE.Vector3;
  playerSpeed: number;
  driving: boolean;
  vehiclePos: THREE.Vector3;
  vehicleSpeed: number;
  vehicleHeading: number;
  npcs: Array<{ x: number; z: number }>;
  aiVehicles: Array<{ x: number; z: number; heading: number; speed: number }>;
  avenueGreen: boolean;
  /** The police module's visibility verdict for this frame. */
  seen: boolean;
  enabled: boolean;
}

export interface WantedHandle {
  update: (dt: number, ctx: WantedContext) => WantedState;
  getState: () => WantedState;
  /** Full reset: heat 0, status clear, every timer and memory cleared. */
  reset: () => void;
  /** QA / debug hook: set the heat directly (also sets the status). */
  setHeat: (heat: number) => void;
  /** Add heat from a named source (an encounter defeat, a
   * gunshot in public). Respects the offence cooldown and starts
   * a pursuit when the heat crosses a level. */
  addHeat: (amount: number) => void;
}

/** Heat at which each level starts (index = level). */
const LEVEL_HEAT = [0, 10, 25, 45, 70, 90];
const HEAT_PED_HIT = 25;
const HEAT_CAR_HIT = 12;
const HEAT_SPEEDING = 8;
const HEAT_RED_LIGHT = 8;
const OFFENSE_COOLDOWN = 1.5; // between any two offences
const SPEEDING_SPEED = 28; // ~100 km/h
const SPEEDING_HOLD = 2; // seconds above the limit before it counts
const UNSEEN_TO_SEARCH = 6; // seconds unseen before search mode
const HEAT_DECAY_SEARCH = 1.5; // heat per second while searching

const levelFromHeat = (heat: number): number => {
  let level = 0;
  for (let i = 1; i < LEVEL_HEAT.length; i++) {
    if (heat >= LEVEL_HEAT[i]) level = i;
  }
  return level;
};

const escapeDuration = (level: number): number => 14 + 4 * level;

export function createWanted(): WantedHandle {
  let heat = 0;
  let status: WantedStatus = 'clear';
  let lastKnown: { x: number; z: number } | null = null;
  let lastSeenPos: { x: number; z: number } | null = null;
  let unseenTimer = 0;
  let escapeTimer = 0;
  let escapeTotal = 1;
  let offenseCooldown = 0;
  let speedingTimer = 0;
  let redLightCooldown = 0;
  let prevVehiclePos: { x: number; z: number } | null = null;
  let seenNow = false;

  const addHeat = (amount: number): void => {
    heat = Math.min(100, heat + amount);
    if (levelFromHeat(heat) > 0 && status === 'clear') {
      status = 'pursuit';
      unseenTimer = 0;
      escapeTimer = 0;
    }
  };

  const getState = (): WantedState => {
    const level =
      status === 'search'
        ? Math.max(1, levelFromHeat(heat))
        : levelFromHeat(heat);
    return {
      level,
      heat: Math.round(heat * 10) / 10,
      status,
      escapeProgress:
        status === 'search' && escapeTotal > 0
          ? Math.min(1, 1 - escapeTimer / escapeTotal)
          : 0,
      lastKnown: lastKnown ? { ...lastKnown } : null,
      seen: seenNow,
    };
  };

  const update = (dt: number, ctx: WantedContext): WantedState => {
    seenNow = ctx.seen;
    if (offenseCooldown > 0) offenseCooldown -= dt;
    if (redLightCooldown > 0) redLightCooldown -= dt;

    if (!ctx.enabled) {
      heat = 0;
      status = 'clear';
      lastKnown = null;
      lastSeenPos = null;
      unseenTimer = 0;
      escapeTimer = 0;
      return getState();
    }

    // ---- Offence detection (only while the wanted system is on) ----
    const canOffend = offenseCooldown <= 0;
    // Hitting a pedestrian: with the car, or shoving into one on foot
    // at a run. NPCs sidestep, so a contact at speed is a real hit.
    if (canOffend) {
      const px = ctx.driving ? ctx.vehiclePos.x : ctx.playerPos.x;
      const pz = ctx.driving ? ctx.vehiclePos.z : ctx.playerPos.z;
      const speed = ctx.driving ? ctx.vehicleSpeed : ctx.playerSpeed;
      const minSpeed = ctx.driving ? 3 : 2;
      const hitDist = ctx.driving ? 2.6 : 1.3;
      if (speed > minSpeed) {
        for (const n of ctx.npcs) {
          if (Math.hypot(n.x - px, n.z - pz) < hitDist) {
            addHeat(HEAT_PED_HIT);
            offenseCooldown = OFFENSE_COOLDOWN;
            break;
          }
        }
      }
    }
    // Hitting an AI vehicle with the Velocity GT: oriented overlap —
    // the distance from the player's centre to the other car's centre
    // line (along its heading) must be inside both half-lengths.
    if (canOffend && ctx.driving && ctx.vehicleSpeed > 4) {
      const px = ctx.vehiclePos.x;
      const pz = ctx.vehiclePos.z;
      for (const o of ctx.aiVehicles) {
        const fx = Math.sin(o.heading);
        const fz = Math.cos(o.heading);
        const dx = px - o.x;
        const dz = pz - o.z;
        const along = dx * fx + dz * fz;
        const lat = Math.abs(dx * fz - dz * fx);
        // Other cars are 4.4–9 long; use a conservative half-length.
        if (Math.abs(along) < 4.5 && lat < 1.6) {
          addHeat(HEAT_CAR_HIT);
          offenseCooldown = OFFENSE_COOLDOWN;
          break;
        }
      }
    }
    // Reckless driving: sustained speed over the limit.
    if (ctx.driving && ctx.vehicleSpeed > SPEEDING_SPEED) {
      speedingTimer += dt;
      if (speedingTimer > SPEEDING_HOLD && offenseCooldown <= 0) {
        addHeat(HEAT_SPEEDING);
        offenseCooldown = 5;
        speedingTimer = 0;
      }
    } else {
      speedingTimer = 0;
    }
    // Running a red light: the car enters a signalised intersection
    // box from outside while its approach is red.
    if (ctx.driving && redLightCooldown <= 0 && prevVehiclePos) {
      for (const [cx, cz] of SIGNAL_SPOTS) {
        const inNow =
          Math.abs(ctx.vehiclePos.x - cx) < 12 && Math.abs(ctx.vehiclePos.z - cz) < 12;
        const inBefore =
          Math.abs(prevVehiclePos.x - cx) < 12 && Math.abs(prevVehiclePos.z - cz) < 12;
        if (!inNow || inBefore) continue;
        // Heading convention: forward = (sin h, cos h), so travel
        // along an avenue (north/south) is |cos h| ≈ 1 and along a
        // street (east/west) is |sin h| ≈ 1.
        const alongAvenue = Math.abs(Math.cos(ctx.vehicleHeading)) > 0.7;
        const alongStreet = Math.abs(Math.sin(ctx.vehicleHeading)) > 0.7;
        const red =
          (alongAvenue && !ctx.avenueGreen) || (alongStreet && ctx.avenueGreen);
        if (red) {
          addHeat(HEAT_RED_LIGHT);
          redLightCooldown = 5;
          break;
        }
      }
    }
    prevVehiclePos = { x: ctx.vehiclePos.x, z: ctx.vehiclePos.z };

    // ---- Status machine ----
    const level = levelFromHeat(heat);
    if (level === 0 && status !== 'search') {
      status = 'clear';
      lastKnown = null;
      lastSeenPos = null;
      unseenTimer = 0;
      escapeTimer = 0;
      return getState();
    }

    const playerPos = ctx.driving ? ctx.vehiclePos : ctx.playerPos;
    if (ctx.seen) {
      lastSeenPos = { x: playerPos.x, z: playerPos.z };
      unseenTimer = 0;
      if (status !== 'pursuit') {
        status = 'pursuit';
        escapeTimer = 0;
      }
    } else if (status === 'pursuit') {
      unseenTimer += dt;
      if (unseenTimer >= UNSEEN_TO_SEARCH) {
        status = 'search';
        lastKnown = lastSeenPos
          ? { ...lastSeenPos }
          : { x: playerPos.x, z: playerPos.z };
        escapeTotal = escapeDuration(level);
        escapeTimer = escapeTotal;
      }
    } else if (status === 'search') {
      heat = Math.max(0, heat - HEAT_DECAY_SEARCH * dt);
      escapeTimer -= dt;
      if (escapeTimer <= 0) {
        heat = 0;
        status = 'clear';
        lastKnown = null;
        lastSeenPos = null;
        unseenTimer = 0;
        escapeTimer = 0;
      }
    }
    return getState();
  };

  return {
    update,
    getState,
    reset: () => {
      heat = 0;
      status = 'clear';
      lastKnown = null;
      lastSeenPos = null;
      unseenTimer = 0;
      escapeTimer = 0;
      escapeTotal = 1;
      offenseCooldown = 0;
      speedingTimer = 0;
      redLightCooldown = 0;
      prevVehiclePos = null;
      seenNow = false;
    },
    setHeat: (next: number) => {
      heat = Math.max(0, Math.min(100, next));
      if (levelFromHeat(heat) > 0 && status === 'clear') {
        status = 'pursuit';
        unseenTimer = 0;
        escapeTimer = 0;
      } else if (heat === 0) {
        status = 'clear';
        lastKnown = null;
        escapeTimer = 0;
      }
    },
    addHeat: (amount: number) => {
      if (amount <= 0 || offenseCooldown > 0) return;
      addHeat(amount);
      offenseCooldown = OFFENSE_COOLDOWN;
    },
  };
}
