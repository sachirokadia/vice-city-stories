/**
 * Combat controller — the firing, reloading, switching, health
 * and feedback half of the Phase 8A combat foundation.
 *
 * How a shot works: the ray starts at the camera and runs through
 * the screen centre (the crosshair), with a small random spread
 * per weapon. The nearest of {range target, building box, ground
 * plane} wins; a target only counts when it is inside the
 * weapon's effective range. Everything is analytical (ray vs
 * sphere / AABB / plane), so there is no Raycaster cost and the
 * player's own body can never block a shot.
 *
 * Locks: the engine's `canFireNow` gates firing (on foot, no
 * arrest, no sprint running, engine running). Panels pause the
 * engine, so firing is dead while one is open; driving hides the
 * character and the weapon with it. Health exists now (100, regen
 * after 5 s calm) but nothing in 8A damages the player — damage
 * sources arrive with hostile NPCs in a later phase.
 *
 * Range totals (all-time hits / shots) persist under their own
 * key; the write is throttled to once a second so automatic fire
 * does not hammer localStorage.
 */
import * as THREE from 'three';
import { getWeapon, loadWeaponState, saveWeaponState, START_RESERVE, WEAPON_DEFS } from './Weapons';
import type { WeaponDef, WeaponId, WeaponState } from './Weapons';
import { createWeaponModel } from './WeaponModels';
import type { WeaponModel } from './WeaponModels';
import type { RangeHandle } from './Range';
import type { EnemyTarget } from './Enemies';
import type { BuildingBox } from './World';

export const MAX_HEALTH = 100;
const HEALTH_REGEN_DELAY = 5;
const HEALTH_REGEN_RATE = 10;
/** Brief immunity after taking a hit, so three enemies cannot
 * delete the player's health in a single frame (8B). */
const DAMAGE_IMMUNITY_MS = 600;
const RANGE_STATS_KEY = 'vice-city-stories.range.v1';

export interface CombatHudState {
  equipped: WeaponId;
  weaponName: string;
  mag: number;
  magSize: number;
  reserve: number;
  reloading: boolean;
  reloadProgress: number;
  health: number;
  maxHealth: number;
  canFire: boolean;
  /** performance.now() of the last hit, 0 when there has been none. */
  hitMarkerAt: number;
  shots: number;
  hits: number;
  accuracy: number;
  totalHits: number;
  totalShots: number;
}

export interface CombatContext {
  camera: THREE.PerspectiveCamera;
  getBuildings: () => BuildingBox[];
  range: RangeHandle;
  /** Engine locks: on foot, no arrest, no sprint, engine running. */
  canFireNow: () => boolean;
  /** Called after a shot / reload state change (HUD refresh). */
  onReport: () => void;
  /** Active, hittable enemies (8B). Absent when there are none. */
  getEnemies?: () => EnemyTarget[];
  /** A shot hit an enemy: the engine applies the damage. */
  onEnemyHit?: (id: string, damage: number) => void;
  /** A shot was fired (the enemy AI investigates the sound). */
  onShot?: (x: number, z: number) => void;
}

export interface CombatHandle {
  /** Camera recoil, 0..1 — the engine adds it to the pitch. */
  recoil: number;
  update: (dt: number) => void;
  /** A fresh press (mouse down / FIRE button down). */
  tryFire: () => void;
  setFiring: (held: boolean) => void;
  reload: () => void;
  switchWeapon: (id: WeaponId) => boolean;
  cycleWeapon: () => void;
  /** Mark a weapon owned (the engine pays the cash first). */
  addOwned: (id: WeaponId) => void;
  restockAmmo: () => void;
  damage: (amount: number) => void;
  healToFull: () => void;
  cancelReload: () => void;
  getHudState: () => CombatHudState;
  getWeaponState: () => WeaponState;
  /** Re-parent the weapon model after a quality rebuild. */
  reattachWeapon: (playerMesh: THREE.Group) => void;
  dispose: () => void;
}

interface RangeTotals {
  totalHits: number;
  totalShots: number;
}

function loadRangeTotals(): RangeTotals {
  try {
    const raw = window.localStorage.getItem(RANGE_STATS_KEY);
    if (raw === null) return { totalHits: 0, totalShots: 0 };
    const parsed = JSON.parse(raw) as Partial<RangeTotals>;
    return {
      totalHits: typeof parsed.totalHits === 'number' ? Math.max(0, Math.floor(parsed.totalHits)) : 0,
      totalShots: typeof parsed.totalShots === 'number' ? Math.max(0, Math.floor(parsed.totalShots)) : 0,
    };
  } catch {
    return { totalHits: 0, totalShots: 0 };
  }
}

/** Ray vs axis-aligned box (slab test). Nearest t in [0, maxDist], or null. */
function rayBox(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  box: BuildingBox,
  maxDist: number,
): number | null {
  let tmin = 0;
  let tmax = maxDist;
  const axes: Array<{ o: number; d: number; min: number; max: number }> = [
    { o: origin.x, d: dir.x, min: box.minX, max: box.maxX },
    // Since 8B every box carries its real height (maxY); a box
    // without one falls back to 30, the tallest ordinary
    // building. A shot over a low roof now clears it instead of
    // stopping early.
    { o: origin.y, d: dir.y, min: 0, max: box.maxY ?? 30 },
    { o: origin.z, d: dir.z, min: box.minZ, max: box.maxZ },
  ];
  for (const a of axes) {
    if (Math.abs(a.d) < 1e-9) {
      if (a.o < a.min || a.o > a.max) return null;
      continue;
    }
    let t1 = (a.min - a.o) / a.d;
    let t2 = (a.max - a.o) / a.d;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** Ray vs sphere (an enemy's chest). Nearest t, or null. */
function raySphere(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  maxDist: number,
): number | null {
  const ox = origin.x - cx;
  const oy = origin.y - cy;
  const oz = origin.z - cz;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0 || t > maxDist) return null;
  return t;
}

function makeFlashTexture(track: <T extends { dispose(): void }>(r: T) => T): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255, 240, 180, 1)');
  g.addColorStop(0.4, 'rgba(255, 180, 60, 0.9)');
  g.addColorStop(1, 'rgba(255, 120, 20, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCombat(
  scene: THREE.Scene,
  playerMesh: THREE.Group,
  ctx: CombatContext,
): CombatHandle {
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  const state: WeaponState = loadWeaponState();
  const totals = loadRangeTotals();
  // Magazines live in the weapon state now (8B): each weapon
  // keeps its own count when switching, and the counts persist.
  const magOf = (id: WeaponId): number => state.mags[id] ?? 0;
  const setMag = (id: WeaponId, v: number): void => {
    state.mags[id] = Math.max(0, Math.min(getWeapon(id)?.magSize ?? 12, v));
    saveWeaponState(state);
  };
  let cooldown = 0;
  let firing = false;
  let reloading = false;
  let reloadElapsed = 0;
  let health = MAX_HEALTH;
  let lastDamageAt = -Infinity;
  let shots = 0;
  let hits = 0;
  let hitMarkerAt = 0;
  let kick = 0;
  let recoil = 0;
  let statsDirty = false;
  let lastStatsSave = 0;

  // --- Muzzle flash (a sprite, always camera-facing) ---
  const flash = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: makeFlashTexture(track),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    ),
  );
  flash.scale.set(0.55, 0.55, 1);
  flash.visible = false;
  scene.add(flash);
  let flashAt = -Infinity;

  // --- Tracer (one line, re-aimed per shot) ---
  const tracerGeo = track(new THREE.BufferGeometry());
  const tracerPos = new Float32Array(6);
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  const tracerMat = track(
    new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }),
  );
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  tracer.frustumCulled = false;
  scene.add(tracer);
  let tracerAt = -Infinity;

  // --- The weapon model, parented to the right hand ---
  let model: WeaponModel | null = null;
  // The player object is rebuilt on a quality change, so the mesh
  // the weapon hangs off is a mutable reference, not a constant.
  let playerMeshRef = playerMesh;
  const attachModel = (mesh: THREE.Group): void => {
    const elbow = mesh.getObjectByName('elbowR');
    if (!elbow) return;
    if (model) {
      // The old model leaves the scene with the old player; free
      // its geometry now (the Combat dispose pass tolerates a
      // second dispose of the same resources).
      model.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      model.group.removeFromParent();
    }
    const def = getWeapon(state.equipped);
    if (!def) return;
    model = createWeaponModel(def.id, track);
    model.group.position.set(0, -0.36, 0);
    elbow.add(model.group);
  };
  attachModel(playerMesh);

  const currentDef = (): WeaponDef => getWeapon(state.equipped) ?? WEAPON_DEFS[0];

  const saveTotals = (): void => {
    try {
      window.localStorage.setItem(RANGE_STATS_KEY, JSON.stringify(totals));
    } catch {
      /* storage unavailable — the session still works */
    }
    statsDirty = false;
    lastStatsSave = performance.now();
  };

  const startReload = (): void => {
    const def = currentDef();
    if (reloading || magOf(def.id) >= def.magSize || state.reserve[def.id] <= 0) return;
    reloading = true;
    reloadElapsed = 0;
    ctx.onReport();
  };

  const finishReload = (): void => {
    const def = currentDef();
    const need = def.magSize - magOf(def.id);
    const take = Math.min(need, state.reserve[def.id]);
    setMag(def.id, magOf(def.id) + take);
    state.reserve[def.id] -= take;
    saveWeaponState(state);
    reloading = false;
    ctx.onReport();
  };

  const _origin = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _muzzle = new THREE.Vector3();
  const _end = new THREE.Vector3();

  const fireOne = (def: WeaponDef): void => {
    // Ray through the crosshair, with the weapon's spread.
    ctx.camera.getWorldPosition(_origin);
    ctx.camera.getWorldDirection(_dir);
    _right.set(1, 0, 0).applyQuaternion(ctx.camera.quaternion);
    _up.set(0, 1, 0).applyQuaternion(ctx.camera.quaternion);
    const s = def.spread;
    _dir
      .addScaledVector(_right, (Math.random() - 0.5) * 2 * s)
      .addScaledVector(_up, (Math.random() - 0.5) * 2 * s)
      .normalize();

    const target = ctx.range.hitTest(_origin, _dir, def.range);
    let bestT = Infinity;
    let endKind: 'target' | 'building' | 'ground' | 'enemy' = 'ground';
    let endPoint: THREE.Vector3 | null = null;
    let hitEnemyId: string | null = null;
    if (target) {
      bestT = target.dist;
      endKind = 'target';
      endPoint = target.point;
    }
    // Enemies: a ray-sphere test at the chest. They only count
    // inside the weapon's range, and a building in front still
    // wins (the building test below runs against the same bestT).
    for (const e of ctx.getEnemies?.() ?? []) {
      const t = raySphere(_origin, _dir, e.x, e.chestY, e.z, e.radius, def.range);
      if (t !== null && t < bestT) {
        bestT = t;
        endKind = 'enemy';
        endPoint = null;
        hitEnemyId = e.id;
      }
    }
    for (const b of ctx.getBuildings()) {
      const t = rayBox(_origin, _dir, b, 200);
      if (t !== null && t < bestT) {
        bestT = t;
        endKind = 'building';
        endPoint = null;
        hitEnemyId = null;
      }
    }
    if (_dir.y < -1e-6) {
      const t = -_origin.y / _dir.y;
      if (t > 0 && t < bestT && t < 200) {
        bestT = t;
        endKind = 'ground';
        endPoint = null;
      }
    }
    if (endPoint === null) {
      _end.copy(_origin).addScaledVector(_dir, bestT === Infinity ? def.range : bestT);
      endPoint = _end;
    }

    shots++;
    totals.totalShots++;
    statsDirty = true;
    if (endKind === 'target' && target) {
      ctx.range.knockDown(target.id);
      hits++;
      totals.totalHits++;
      hitMarkerAt = performance.now();
    } else if (endKind === 'enemy' && hitEnemyId) {
      ctx.onEnemyHit?.(hitEnemyId, def.damage);
      hits++;
      totals.totalHits++;
      hitMarkerAt = performance.now();
    }
    // The shot itself is a sound nearby enemies investigate
    // (the camera sits just behind the player, so its position
    // is the shot's origin).
    ctx.onShot?.(_origin.x, _origin.z);
    setMag(def.id, magOf(def.id) - 1);
    cooldown = def.fireInterval;
    kick = 1;
    recoil = 1;

    // Muzzle flash + tracer from the weapon's muzzle.
    if (model) {
      model.muzzle.getWorldPosition(_muzzle);
      flash.position.copy(_muzzle);
      flash.visible = true;
      flashAt = performance.now();
      tracerPos[0] = _muzzle.x;
      tracerPos[1] = _muzzle.y;
      tracerPos[2] = _muzzle.z;
      tracerPos[3] = endPoint.x;
      tracerPos[4] = endPoint.y;
      tracerPos[5] = endPoint.z;
      (tracer.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      tracer.visible = true;
      tracerAt = performance.now();
    }

    if (magOf(def.id) <= 0 && state.reserve[def.id] > 0) startReload();
    ctx.onReport();
  };

  const handle: CombatHandle = {
    get recoil() {
      return recoil;
    },
    update: (dt: number) => {
      cooldown = Math.max(0, cooldown - dt);
      if (firing && currentDef().auto && ctx.canFireNow() && !reloading && cooldown <= 0) {
        if (magOf(currentDef().id) <= 0) startReload();
        else fireOne(currentDef());
      }
      if (reloading) {
        reloadElapsed += dt;
        if (reloadElapsed >= currentDef().reloadSeconds) finishReload();
      }
      // Health regen after 5 s without damage.
      if (health < MAX_HEALTH && performance.now() - lastDamageAt > HEALTH_REGEN_DELAY * 1000) {
        health = Math.min(MAX_HEALTH, health + HEALTH_REGEN_RATE * dt);
      }
      // Flash and tracer fade fast.
      if (flash.visible && performance.now() - flashAt > 50) flash.visible = false;
      if (tracer.visible) {
        const age = performance.now() - tracerAt;
        if (age > 90) tracer.visible = false;
        else tracerMat.opacity = 0.9 * (1 - age / 90);
      }
      // Weapon kick recovers; camera recoil decays.
      kick = Math.max(0, kick - dt * 8);
      recoil = Math.max(0, recoil - dt * 6);
      if (model) model.group.position.z = -0.06 * kick;
      // Persist range totals at most once a second.
      if (statsDirty && performance.now() - lastStatsSave > 1000) saveTotals();
    },
    tryFire: () => {
      if (!ctx.canFireNow() || reloading || cooldown > 0) return;
      const def = currentDef();
      if (magOf(def.id) <= 0) {
        startReload();
        return;
      }
      fireOne(def);
    },
    setFiring: (held: boolean) => {
      firing = held;
    },
    reload: () => {
      startReload();
    },
    switchWeapon: (id: WeaponId) => {
      if (!state.owned.includes(id) || id === state.equipped) return id === state.equipped;
      const def = getWeapon(id);
      if (!def) return false;
      state.equipped = id;
      saveWeaponState(state);
      // 8B: the new weapon keeps its own magazine (whatever is
      // left in it), it is not refilled to full on switching.
      cooldown = 0;
      reloading = false;
      firing = false;
      attachModel(playerMeshRef);
      ctx.onReport();
      return true;
    },
    cycleWeapon: () => {
      const idx = state.owned.indexOf(state.equipped);
      const next = state.owned[(idx + 1) % state.owned.length];
      handle.switchWeapon(next);
    },
    addOwned: (id: WeaponId) => {
      if (!state.owned.includes(id)) {
        state.owned.push(id);
        saveWeaponState(state);
      }
    },
    restockAmmo: () => {
      state.reserve = { ...START_RESERVE };
      saveWeaponState(state);
      ctx.onReport();
    },
    damage: (amount: number) => {
      if (amount <= 0) return;
      // Brief immunity after a hit, so several enemies firing at
      // once cannot delete the player's health in one frame.
      if (performance.now() - lastDamageAt < DAMAGE_IMMUNITY_MS) return;
      health = Math.max(0, health - amount);
      lastDamageAt = performance.now();
      ctx.onReport();
    },
    healToFull: () => {
      health = MAX_HEALTH;
      lastDamageAt = -Infinity;
      ctx.onReport();
    },
    cancelReload: () => {
      reloading = false;
      reloadElapsed = 0;
    },
    getHudState: (): CombatHudState => {
      const def = currentDef();
      return {
        equipped: state.equipped,
        weaponName: def.name,
        mag: magOf(def.id),
        magSize: def.magSize,
        reserve: state.reserve[def.id],
        reloading,
        reloadProgress: reloading ? Math.min(1, reloadElapsed / def.reloadSeconds) : 0,
        health,
        maxHealth: MAX_HEALTH,
        canFire: ctx.canFireNow(),
        hitMarkerAt,
        shots,
        hits,
        accuracy: shots > 0 ? hits / shots : 0,
        totalHits: totals.totalHits,
        totalShots: totals.totalShots,
      };
    },
    getWeaponState: () => ({ ...state, reserve: { ...state.reserve } }),
    reattachWeapon: (mesh: THREE.Group) => {
      playerMeshRef = mesh;
      attachModel(mesh);
    },
    dispose: () => {
      if (statsDirty) saveTotals();
      scene.remove(flash);
      scene.remove(tracer);
      if (model) model.group.removeFromParent();
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* already disposed */
        }
      }
    },
  };
  return handle;
}
