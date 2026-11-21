/**
 * Weapon definitions and ownership — the data layer of the
 * combat foundation (Phase 8A). Each weapon is an original,
 * fictional game item: no reproduced models, names or branding
 * from existing games.
 *
 * Stored shape: { owned: string[], equipped: string, reserve:
 * { [id]: number } } under its own key, so a weapon write can
 * never clobber mission progress, the cash balance, the garage
 * save, or any Phase 7D save. Magazines are session state (a
 * reload refills from the reserve); the reserve persists.
 */

export type WeaponId = 'palm-9' | 'vanguard-carbine';
export type WeaponCategory = 'sidearm' | 'carbine';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  /** Damage per hit (matters for hostile targets in a later phase;
   * range targets fall on any hit). */
  damage: number;
  /** Seconds between shots. */
  fireInterval: number;
  /** Shot spread in radians (random angular deviation per shot). */
  spread: number;
  /** Hold to fire (true) or one shot per press (false). */
  auto: boolean;
  magSize: number;
  reloadSeconds: number;
  /** Metres: a shot past this distance cannot hit a target. */
  range: number;
  ammoType: string;
  /** 0 = owned from the start; otherwise the cash price. */
  price: number;
  description: string;
}

export const WEAPON_DEFS: WeaponDef[] = [
  {
    id: 'palm-9',
    name: 'Palm 9',
    category: 'sidearm',
    damage: 25,
    fireInterval: 0.3,
    spread: 0.008,
    auto: false,
    magSize: 12,
    reloadSeconds: 1.4,
    range: 45,
    ammoType: 'light rounds',
    price: 0,
    description: 'A compact sidearm. Balanced, forgiving, and light — the one to learn on.',
  },
  {
    id: 'vanguard-carbine',
    name: 'Vanguard Carbine',
    category: 'carbine',
    damage: 18,
    fireInterval: 0.11,
    spread: 0.005,
    auto: true,
    magSize: 30,
    reloadSeconds: 2.2,
    range: 80,
    ammoType: 'carbine rounds',
    price: 1200,
    description: 'A tactical carbine. Sustained automatic fire, a bigger magazine, and the reach for the far targets.',
  },
];

export function getWeapon(id: string): WeaponDef | undefined {
  return WEAPON_DEFS.find((w) => w.id === id);
}

/** Starting reserve ammo per weapon (refilled free at the range rack). */
export const START_RESERVE: Record<WeaponId, number> = {
  'palm-9': 60,
  'vanguard-carbine': 120,
};

export interface WeaponState {
  owned: WeaponId[];
  equipped: WeaponId;
  reserve: Record<WeaponId, number>;
  /** Rounds currently in each weapon's magazine. Since 8B every
   * weapon keeps its own magazine when switching (8A refilled the
   * new weapon to full); the magazines persist with the rest. */
  mags: Record<WeaponId, number>;
}

export const WEAPONS_KEY = 'vice-city-stories.weapons.v1';

const DEFAULT_MAGS: Record<WeaponId, number> = {
  'palm-9': 12,
  'vanguard-carbine': 30,
};

const DEFAULT_STATE: WeaponState = {
  owned: ['palm-9'],
  equipped: 'palm-9',
  reserve: { ...START_RESERVE },
  mags: { ...DEFAULT_MAGS },
};

export function loadWeaponState(): WeaponState {
  try {
    const raw = window.localStorage.getItem(WEAPONS_KEY);
    if (raw === null) {
      return { ...DEFAULT_STATE, reserve: { ...START_RESERVE }, mags: { ...DEFAULT_MAGS } };
    }
    const parsed = JSON.parse(raw) as Partial<WeaponState>;
    const known = new Set(WEAPON_DEFS.map((w) => w.id));
    const owned = Array.isArray(parsed.owned)
      ? (parsed.owned.filter((id): id is WeaponId => typeof id === 'string' && known.has(id as WeaponId)) as WeaponId[])
      : [];
    if (!owned.includes('palm-9')) owned.unshift('palm-9');
    const equipped =
      typeof parsed.equipped === 'string' && owned.includes(parsed.equipped as WeaponId)
        ? (parsed.equipped as WeaponId)
        : 'palm-9';
    const reserve: Record<WeaponId, number> = { ...START_RESERVE };
    if (parsed.reserve && typeof parsed.reserve === 'object') {
      for (const def of WEAPON_DEFS) {
        const v = (parsed.reserve as Record<string, unknown>)[def.id];
        if (typeof v === 'number' && Number.isFinite(v)) {
          reserve[def.id] = Math.max(0, Math.min(999, Math.floor(v)));
        }
      }
    }
    // Magazines are new in 8B: an 8A save has none, so a weapon
    // whose magazine is unknown starts full (the 8A behaviour).
    const mags: Record<WeaponId, number> = { ...DEFAULT_MAGS };
    if (parsed.mags && typeof parsed.mags === 'object') {
      for (const def of WEAPON_DEFS) {
        const v = (parsed.mags as Record<string, unknown>)[def.id];
        if (typeof v === 'number' && Number.isFinite(v)) {
          mags[def.id] = Math.max(0, Math.min(def.magSize, Math.floor(v)));
        }
      }
    }
    return { owned, equipped, reserve, mags };
  } catch {
    return { ...DEFAULT_STATE, reserve: { ...START_RESERVE }, mags: { ...DEFAULT_MAGS } };
  }
}

export function saveWeaponState(state: WeaponState): void {
  try {
    window.localStorage.setItem(WEAPONS_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — the session still works */
  }
}
