/**
 * Garage persistence — what the player owns and how their cars are
 * set up. Kept in its own module with no Three.js dependency, next
 * to MissionProgress.ts, and stored under its own key so a garage
 * write can never clobber mission progress or the cash balance.
 *
 * Stored shape:
 *   { owned: string[], selected: string,
 *     paint: { [vehicleId]: hex }, upgrades: { [vehicleId]: { engine, accel, handling } } }
 * - owned: ids the player has bought (the Velocity GT is always in
 *   here — it is owned from the start).
 * - selected: the active vehicle (the one that spawns in the world).
 * - paint: a repaint per vehicle; absent means the factory colour.
 * - upgrades: per-vehicle levels, each 0..3.
 *
 * Loads are defensive: unknown ids are dropped, a missing or
 * unknown selection falls back to the Velocity GT, levels are
 * clamped, and a corrupt or unreadable save returns the fresh
 * defaults instead of throwing.
 */
import { VEHICLE_SPECS, VELOCITY_GT_ID, getVehicleSpec } from './VehicleCatalog';
import type { VehicleSpec } from './VehicleCatalog';

const GARAGE_KEY = 'vice-city-stories.garage.v1';

export type UpgradeKind = 'engine' | 'accel' | 'handling';

export interface VehicleUpgrades {
  engine: number;
  accel: number;
  handling: number;
}

export interface GarageState {
  owned: string[];
  selected: string;
  paint: Record<string, number>;
  upgrades: Record<string, VehicleUpgrades>;
}

export const MAX_UPGRADE_LEVEL = 3;

/** One repaint, any owned car, any palette colour. */
export const PAINT_PRICE = 150;

/** Price to go from level n to n+1 (index n). */
export const UPGRADE_PRICES: Record<UpgradeKind, number[]> = {
  engine: [400, 800, 1400],
  accel: [300, 600, 1000],
  handling: [300, 600, 1000],
};

/** Price of the next level, or null when the upgrade is maxed. */
export function getUpgradePrice(kind: UpgradeKind, level: number): number | null {
  const prices = UPGRADE_PRICES[kind];
  return level >= 0 && level < prices.length ? prices[level] : null;
}

export interface EffectiveStats {
  topSpeed: number;
  accel: number;
  handling: number;
}

/** What the car actually drives like: base spec + upgrade levels. */
export function effectiveStats(spec: VehicleSpec, upgrades: VehicleUpgrades): EffectiveStats {
  return {
    topSpeed: spec.topSpeed + 3 * upgrades.engine,
    accel: spec.accel + 2.5 * upgrades.accel,
    handling: spec.handling + 0.08 * upgrades.handling,
  };
}

const ZERO_UPGRADES: VehicleUpgrades = { engine: 0, accel: 0, handling: 0 };

export function emptyUpgrades(): VehicleUpgrades {
  return { ...ZERO_UPGRADES };
}

function clampLevel(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(n)));
}

function validUpgrades(raw: unknown): VehicleUpgrades {
  if (typeof raw !== 'object' || raw === null) return emptyUpgrades();
  const r = raw as Record<string, unknown>;
  return {
    engine: clampLevel(r.engine),
    accel: clampLevel(r.accel),
    handling: clampLevel(r.handling),
  };
}

export function defaultGarageState(): GarageState {
  return { owned: [VELOCITY_GT_ID], selected: VELOCITY_GT_ID, paint: {}, upgrades: {} };
}

export function loadGarageState(): GarageState {
  try {
    const raw = window.localStorage.getItem(GARAGE_KEY);
    if (raw === null) return defaultGarageState();
    const parsed = JSON.parse(raw) as Partial<GarageState>;
    const known = new Set(VEHICLE_SPECS.map((s) => s.id));
    const owned = Array.isArray(parsed.owned)
      ? parsed.owned.filter((id): id is string => typeof id === 'string' && known.has(id))
      : [];
    if (!owned.includes(VELOCITY_GT_ID)) owned.unshift(VELOCITY_GT_ID);
    const selected =
      typeof parsed.selected === 'string' && owned.includes(parsed.selected)
        ? parsed.selected
        : VELOCITY_GT_ID;
    const paint: Record<string, number> = {};
    if (typeof parsed.paint === 'object' && parsed.paint !== null) {
      for (const [id, hex] of Object.entries(parsed.paint)) {
        if (
          known.has(id) &&
          typeof hex === 'number' &&
          Number.isFinite(hex) &&
          hex >= 0 &&
          hex <= 0xffffff
        ) {
          paint[id] = Math.floor(hex);
        }
      }
    }
    const upgrades: Record<string, VehicleUpgrades> = {};
    if (typeof parsed.upgrades === 'object' && parsed.upgrades !== null) {
      for (const [id, u] of Object.entries(parsed.upgrades)) {
        if (known.has(id)) upgrades[id] = validUpgrades(u);
      }
    }
    return { owned, selected, paint, upgrades };
  } catch {
    return defaultGarageState();
  }
}

export function saveGarageState(state: GarageState): void {
  try {
    window.localStorage.setItem(GARAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the garage still works for the session */
  }
}

export function isOwned(state: GarageState, id: string): boolean {
  return state.owned.includes(id);
}

export function paintFor(state: GarageState, spec: VehicleSpec): number {
  return state.paint[spec.id] ?? spec.defaultPaint;
}

export function upgradesFor(state: GarageState, id: string): VehicleUpgrades {
  return state.upgrades[id] ?? emptyUpgrades();
}

/** The UI state the garage panel renders: one row per vehicle. */
export interface GarageVehicleRow {
  spec: VehicleSpec;
  owned: boolean;
  selected: boolean;
  paint: number;
  upgrades: VehicleUpgrades;
  stats: EffectiveStats;
  nextUpgradePrice: Record<UpgradeKind, number | null>;
}

export interface GarageUiState {
  cash: number;
  vehicles: GarageVehicleRow[];
}

export function buildGarageUiState(state: GarageState, cash: number): GarageUiState {
  return {
    cash,
    vehicles: VEHICLE_SPECS.map((spec) => {
      const upgrades = upgradesFor(state, spec.id);
      return {
        spec,
        owned: isOwned(state, spec.id),
        selected: state.selected === spec.id,
        paint: paintFor(state, spec),
        upgrades,
        stats: effectiveStats(spec, upgrades),
        nextUpgradePrice: {
          engine: getUpgradePrice('engine', upgrades.engine),
          accel: getUpgradePrice('accel', upgrades.accel),
          handling: getUpgradePrice('handling', upgrades.handling),
        },
      };
    }),
  };
}

/** The spec of the currently selected vehicle (always valid). */
export function selectedSpec(state: GarageState): VehicleSpec {
  return getVehicleSpec(state.selected) ?? VEHICLE_SPECS[0];
}
