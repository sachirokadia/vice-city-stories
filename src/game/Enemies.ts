/**
 * Hostile NPCs — the Phase 8B enemy runtime.
 *
 * Enemies are separate entities from ordinary pedestrians: they
 * live in their own module, never join the crowd pool, and only
 * exist inside an encounter. At most three are active per
 * encounter, and only an activated encounter's enemies are
 * visible or updated — distant encounters cost nothing.
 *
 * The AI is a small state machine (patrol / idle / investigate /
 * alert / engage / cover / search / defeated) with smooth
 * transitions and no teleporting: every move is a kinematic
 * step with circle-vs-building collision, and a leash keeps an
 * enemy near its encounter instead of chasing the player across
 * the city.
 *
 * Line of sight is a 3D raycast against the city collision
 * geometry (a segment-vs-AABB slab test, reusing the real
 * building heights): a ray from the enemy's eye to the player's
 * chest is blocked by any box it crosses, so a low rack does
 * not block but a tall building or a 2 m cover object does.
 * Attacks are ranged: a 0.4 s wind-up, then a tracer and damage
 * only if the player is still in range with line of sight — so
 * there is no damage through solid buildings.
 *
 * A defense encounter can give its enemies an objective to
 * attack (Phase 8C HOLD THE LINE): when the player is not
 * visible, an objective enemy advances on the objective and
 * damages it instead of patrolling or searching.
 */
import * as THREE from 'three';
import { getEnemyDef } from './EnemyDefs';
import type { EnemyDef, EnemyVariantId } from './EnemyDefs';
import { createEnemyModel } from './EnemyModels';
import type { EnemyModel } from './EnemyModels';
import type { BuildingBox } from './World';

export type EnemyState =
  | 'patrol'
  | 'idle'
  | 'investigate'
  | 'alert'
  | 'engage'
  | 'cover'
  | 'search'
  | 'defeated';

export interface EnemyTarget {
  id: string;
  x: number;
  z: number;
  chestY: number;
  radius: number;
}

export interface EnemyInfo {
  id: string;
  variant: EnemyVariantId;
  name: string;
  encounterId: string;
  x: number;
  z: number;
  heading: number;
  health: number;
  maxHealth: number;
  state: EnemyState;
  active: boolean;
}

export interface CoverPoint {
  x: number;
  z: number;
  /** The building this point hides behind. */
  building: BuildingBox;
}

export interface EnemySpawnDef {
  variant: EnemyVariantId;
  x: number;
  z: number;
  /** Waypoints the enemy patrols (a local route). */
  patrol: Array<{ x: number; z: number }>;
}

export interface EnemiesContext {
  playerPos: THREE.Vector3;
  playerSpeed: number;
  mode: string;
  buildings: BuildingBox[];
  /** The player is in a safe activity (range, panel, menu...). */
  playerSafe: boolean;
  /** The player is down — enemies stop attacking. */
  playerDown: boolean;
  onPlayerDamage: (amount: number) => void;
  onEnemyDefeated: (id: string, encounterId: string) => void;
  /** An enemy reached the objective and hit it (8C). */
  onObjectiveDamage?: (amount: number) => void;
}

export interface EnemiesHandle {
  update: (dt: number, ctx: EnemiesContext) => void;
  spawnEncounter: (encounterId: string, defs: EnemySpawnDef[], cover: CoverPoint[]) => void;
  activateEncounter: (id: string) => void;
  deactivateEncounter: (id: string) => void;
  resetEncounter: (id: string) => void;
  /** Give an encounter's enemies an objective to attack (8C). */
  setObjective: (encounterId: string, x: number, z: number) => void;
  clearObjective: (encounterId: string) => void;
  damageEnemy: (id: string, amount: number) => boolean;
  hitTargets: () => EnemyTarget[];
  enemyStates: () => EnemyInfo[];
  onPlayerShot: (x: number, z: number) => void;
  dispose: () => void;
}

const ENEMY_RADIUS = 0.5;
const LEASH_DIST = 45; // never follow the player further than this from home
const ALERT_DELAY = 0.5; // spotting pause before engaging
const WINDUP = 0.4; // seconds the enemy aims before firing
const COVER_HEALTH = 0.4; // drop below 40% health and the enemy seeks cover
const COVER_STAY = 4; // seconds in cover before re-engaging
const COVER_COOLDOWN = 8; // seconds before the same enemy seeks cover again
const SEARCH_TIME = 4; // seconds looking around the last known position
const INVESTIGATE_TIME = 3;
const DEFEATED_FADE = 4; // seconds before a fallen enemy fades out
const OBJECTIVE_ATTACK_RANGE = 4; // how close an enemy must be to hit the objective
const OBJECTIVE_DAMAGE = 4; // objective health lost per enemy hit

interface Enemy {
  id: string;
  def: EnemyDef;
  encounterId: string;
  model: EnemyModel;
  x: number;
  z: number;
  heading: number;
  health: number;
  state: EnemyState;
  stateT: number;
  patrol: Array<{ x: number; z: number }>;
  patrolIdx: number;
  homeX: number;
  homeZ: number;
  lastKnown: { x: number; z: number } | null;
  lastSeenAt: number;
  coverPoint: CoverPoint | null;
  coverCooldown: number;
  attackCooldown: number;
  windup: number;
  phase: number;
  speed: number;
  flashT: number;
  defeatedAt: number;
  active: boolean;
  visible: boolean;
  investigatePos: { x: number; z: number } | null;
  /** A defense objective this enemy advances on (8C, null otherwise). */
  objective: { x: number; z: number } | null;
  tracer: THREE.Line;
  tracerMat: THREE.LineBasicMaterial;
  tracerAt: number;
}

const _v = new THREE.Vector3();

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** 3D segment vs AABB (slab test): true when the segment crosses the box. */
function segmentHitsBox(
  ax: number, ay: number, az: number, bx: number, by: number, bz: number, box: BuildingBox,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  let tmin = 0;
  let tmax = 1;
  for (const [o, d, mn, mx] of [
    [ax, dx, box.minX, box.maxX],
    [ay, dy, 0, box.maxY ?? 30],
    [az, dz, box.minZ, box.maxZ],
  ] as const) {
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return false;
      continue;
    }
    let t1 = (mn - o) / d;
    let t2 = (mx - o) / d;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** Eye height of an enemy (roughly head height, from its scale). */
function eyeY(e: { def: EnemyDef }): number {
  return 1.5 * e.def.height;
}

/** True when a 3D ray from (ax,ay,az) to (bx,by,bz) crosses no building. */
export function hasLineOfSight(
  ax: number, ay: number, az: number, bx: number, by: number, bz: number, buildings: BuildingBox[],
): boolean {
  for (const b of buildings) {
    if (segmentHitsBox(ax, ay, az, bx, by, bz, b)) return false;
  }
  return true;
}

/** Push a circle out of every building box it overlaps. */
function resolveCircle(
  x: number, z: number, r: number, buildings: BuildingBox[],
): { x: number; z: number } {
  let nx = x;
  let nz = z;
  for (const b of buildings) {
    const cx = clamp(nx, b.minX, b.maxX);
    const cz = clamp(nz, b.minZ, b.maxZ);
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      nz = cz + (dz / d) * r;
    } else {
      // Centre inside the box: push out along the smallest axis.
      const left = nx - b.minX;
      const right = b.maxX - nx;
      const top = nz - b.minZ;
      const bottom = b.maxZ - nz;
      const m = Math.min(left, right, top, bottom);
      if (m === left) nx = b.minX - r;
      else if (m === right) nx = b.maxX + r;
      else if (m === top) nz = b.minZ - r;
      else nz = b.maxZ + r;
    }
  }
  return { x: nx, z: nz };
}

export function createEnemies(scene: THREE.Scene): EnemiesHandle {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const group = new THREE.Group();
  group.name = 'enemies';
  scene.add(group);

  const enemies: Enemy[] = [];
  const coverByEncounter = new Map<string, CoverPoint[]>();
  let elapsed = 0;
  let idCounter = 0;
  // The defeat callback comes from the per-frame context; the
  // latest one is kept so damageEnemy can report a defeat even
  // when it is called from the combat module, not the tick.
  let onEnemyDefeated: ((id: string, encounterId: string) => void) | null = null;

  const makeTracer = (): { line: THREE.Line; mat: THREE.LineBasicMaterial } => {
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = track(new THREE.LineBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.9 }));
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.frustumCulled = false;
    group.add(line);
    return { line, mat };
  };

  const setState = (e: Enemy, next: EnemyState): void => {
    if (e.state === next) return;
    e.state = next;
    e.stateT = 0;
    if (next === 'cover') e.coverCooldown = COVER_COOLDOWN;
  };

  /** Pick a cover point that hides the enemy from the player. */
  const pickCover = (e: Enemy, px: number, pz: number, buildings: BuildingBox[]): CoverPoint | null => {
    const points = coverByEncounter.get(e.encounterId) ?? [];
    let best: CoverPoint | null = null;
    let bestD = Infinity;
    for (const p of points) {
      if (e.coverPoint && p.x === e.coverPoint.x && p.z === e.coverPoint.z) continue;
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      if (d > 30 || d > bestD) continue;
      // The point only counts as cover if the building stands
      // between it and the player (3D: the point is at ground
      // level, the player at chest height).
      if (!segmentHitsBox(p.x, 0, p.z, px, 1.2, pz, p.building)) continue;
      // And the enemy must be able to reach it without crossing a building.
      if (!hasLineOfSight(e.x, eyeY(e), e.z, p.x, 0, p.z, buildings)) continue;
      best = p;
      bestD = d;
    }
    return best;
  };

  const moveToward = (
    e: Enemy, tx: number, tz: number, dt: number, speed: number, buildings: BuildingBox[],
  ): boolean => {
    const dx = tx - e.x;
    const dz = tz - e.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) return true;
    const targetHeading = Math.atan2(dx, dz);
    e.heading = lerpAngle(e.heading, targetHeading, Math.min(1, dt * 6));
    const nx = e.x + Math.sin(e.heading) * speed * dt;
    const nz = e.z + Math.cos(e.heading) * speed * dt;
    const resolved = resolveCircle(nx, nz, ENEMY_RADIUS, buildings);
    e.x = resolved.x;
    e.z = resolved.z;
    e.speed = speed;
    return false;
  };

  const updatePose = (e: Enemy, dt: number): void => {
    const rig = e.model.rig;
    const walking = e.speed > 0.05 && e.state !== 'defeated';
    if (walking) e.phase += (dt * Math.PI * e.speed) / 1.1;
    const p = e.phase;
    const s = Math.sin(p);
    const k = Math.min(1, dt * 10);
    const aiming = e.state === 'engage' || e.state === 'alert' || e.windup > 0;
    const tLegL = walking ? 0.45 * s : 0;
    const tLegR = walking ? -0.45 * s : 0;
    const tArmL = walking ? -0.35 * s : 0;
    // The right arm holds the rifle: level when aiming, swinging when walking.
    const tArmR = aiming ? -1.25 : walking ? 0.35 * s : 0;
    rig.legL.rotation.x += (tLegL - rig.legL.rotation.x) * k;
    rig.legR.rotation.x += (tLegR - rig.legR.rotation.x) * k;
    rig.armL.rotation.x += (tArmL - rig.armL.rotation.x) * k;
    rig.armR.rotation.x += (tArmR - rig.armR.rotation.x) * k;
    rig.body.position.y += ((walking ? 0.03 * Math.abs(Math.cos(p)) : 0) - rig.body.position.y) * k;
    // Fallen enemies lie flat; the fall eases over a third of a second.
    const targetRot = e.state === 'defeated' ? -Math.PI / 2 : 0;
    rig.root.rotation.x += (targetRot - rig.root.rotation.x) * Math.min(1, dt * 6);
    // Hit flash: the jacket glows red briefly.
    if (e.flashT > 0) {
      e.flashT -= dt;
      for (const m of e.model.flashMats) m.emissive.setHex(0xaa1100);
      if (e.flashT <= 0) for (const m of e.model.flashMats) m.emissive.setHex(0x000000);
    }
    e.speed = 0;
  };

  const fireAtPlayer = (e: Enemy, ctx: EnemiesContext): void => {
    const px = ctx.playerPos.x;
    const pz = ctx.playerPos.z;
    const dist = Math.hypot(px - e.x, pz - e.z);
    if (dist > e.def.attackRange + 2) return;
    if (!hasLineOfSight(e.x, eyeY(e), e.z, px, 1.2, pz, ctx.buildings)) return;
    // Tracer from the rifle's muzzle to the player's chest.
    e.model.rig.muzzle.getWorldPosition(_v);
    const pos = e.tracer.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, _v.x, _v.y, _v.z);
    pos.setXYZ(1, px, 1.2, pz);
    pos.needsUpdate = true;
    e.tracer.visible = true;
    e.tracerMat.opacity = 0.9;
    e.tracerAt = elapsed;
    ctx.onPlayerDamage(e.def.damage);
  };

  /** An objective enemy advances on its objective and hits it (8C). */
  const advanceOnObjective = (e: Enemy, dt: number, ctx: EnemiesContext): void => {
    const obj = e.objective;
    if (!obj || !ctx.onObjectiveDamage) return;
    const dist = Math.hypot(obj.x - e.x, obj.z - e.z);
    if (dist <= OBJECTIVE_ATTACK_RANGE) {
      // In range: hold position and shoot the objective.
      e.heading = lerpAngle(e.heading, Math.atan2(obj.x - e.x, obj.z - e.z), Math.min(1, dt * 8));
      if (e.attackCooldown <= 0) {
        if (e.windup <= 0) e.windup = WINDUP;
        e.windup -= dt;
        if (e.windup <= 0) {
          e.model.rig.muzzle.getWorldPosition(_v);
          const pos = e.tracer.geometry.getAttribute('position') as THREE.BufferAttribute;
          pos.setXYZ(0, _v.x, _v.y, _v.z);
          pos.setXYZ(1, obj.x, 1.0, obj.z);
          pos.needsUpdate = true;
          e.tracer.visible = true;
          e.tracerMat.opacity = 0.9;
          e.tracerAt = elapsed;
          ctx.onObjectiveDamage(OBJECTIVE_DAMAGE);
          e.attackCooldown = e.def.attackCooldown;
          e.windup = 0;
        }
      }
      return;
    }
    moveToward(e, obj.x, obj.z, dt, e.def.speed, ctx.buildings);
  };

  const update = (dt: number, ctx: EnemiesContext): void => {
    elapsed += dt;
    onEnemyDefeated = ctx.onEnemyDefeated;
    for (const e of enemies) {
      if (!e.active) continue;
      e.stateT += dt;
      e.coverCooldown = Math.max(0, e.coverCooldown - dt);
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);

      const px = ctx.playerPos.x;
      const pz = ctx.playerPos.z;
      const distToPlayer = Math.hypot(px - e.x, pz - e.z);
      const homeDist = Math.hypot(e.x - e.homeX, e.z - e.homeZ);
      const canSee =
        !ctx.playerSafe &&
        !ctx.playerDown &&
        ctx.mode === 'walk' &&
        distToPlayer <= e.def.detectionRange &&
        hasLineOfSight(e.x, eyeY(e), e.z, px, 1.2, pz, ctx.buildings);
      if (canSee) {
        e.lastKnown = { x: px, z: pz };
        e.lastSeenAt = elapsed;
      }

      // Tracer fade.
      if (e.tracer.visible) {
        const age = elapsed - e.tracerAt;
        if (age > 0.12) e.tracer.visible = false;
        else e.tracerMat.opacity = 0.9 * (1 - age / 0.12);
      }

      switch (e.state) {
        case 'defeated': {
          if (elapsed - e.defeatedAt > DEFEATED_FADE && e.visible) {
            e.visible = false;
            e.model.group.visible = false;
          }
          break;
        }
        case 'patrol': {
          if (canSee) {
            setState(e, 'alert');
            break;
          }
          // An objective enemy advances on its objective instead
          // of walking a local route.
          if (e.objective) {
            advanceOnObjective(e, dt, ctx);
            break;
          }
          const wp = e.patrol[e.patrolIdx];
          if (moveToward(e, wp.x, wp.z, dt, e.def.speed * 0.5, ctx.buildings)) {
            e.patrolIdx = (e.patrolIdx + 1) % e.patrol.length;
            if (Math.random() < 0.3) setState(e, 'idle');
          }
          break;
        }
        case 'idle': {
          if (canSee) {
            setState(e, 'alert');
            break;
          }
          if (e.stateT > 2 + Math.random() * 2) setState(e, 'patrol');
          break;
        }
        case 'investigate': {
          if (canSee) {
            setState(e, 'alert');
            break;
          }
          if (!e.investigatePos) {
            setState(e, 'patrol');
            break;
          }
          if (moveToward(e, e.investigatePos.x, e.investigatePos.z, dt, e.def.speed * 0.7, ctx.buildings)) {
            // Arrived: look around, then give up.
            e.heading += dt * 0.8;
            if (e.stateT > INVESTIGATE_TIME) setState(e, 'patrol');
          }
          break;
        }
        case 'alert': {
          // Face the player, then engage.
          e.heading = lerpAngle(e.heading, Math.atan2(px - e.x, pz - e.z), Math.min(1, dt * 8));
          if (e.stateT >= ALERT_DELAY) setState(e, 'engage');
          break;
        }
        case 'engage': {
          if (e.health < e.def.health * COVER_HEALTH && e.coverCooldown <= 0) {
            const cover = pickCover(e, px, pz, ctx.buildings);
            if (cover) {
              e.coverPoint = cover;
              setState(e, 'cover');
              break;
            }
          }
          if (!canSee) {
            // Lost the player: an objective enemy goes back to
            // its objective instead of searching the streets.
            if (e.objective) {
              advanceOnObjective(e, dt, ctx);
              break;
            }
            if (elapsed - e.lastSeenAt > 2) {
              setState(e, 'search');
              break;
            }
          } else if (distToPlayer <= e.def.attackRange) {
            // In range: hold position and shoot.
            e.heading = lerpAngle(e.heading, Math.atan2(px - e.x, pz - e.z), Math.min(1, dt * 8));
            if (e.attackCooldown <= 0) {
              if (e.windup <= 0) e.windup = WINDUP;
              e.windup -= dt;
              if (e.windup <= 0) {
                fireAtPlayer(e, ctx);
                e.attackCooldown = e.def.attackCooldown;
                e.windup = 0;
              }
            }
          } else if (homeDist < LEASH_DIST) {
            // Out of range: close in, but never past the leash.
            moveToward(e, px, pz, dt, e.def.speed, ctx.buildings);
          } else {
            setState(e, 'search');
          }
          break;
        }
        case 'cover': {
          if (!e.coverPoint) {
            setState(e, 'engage');
            break;
          }
          const arrived = moveToward(e, e.coverPoint.x, e.coverPoint.z, dt, e.def.speed, ctx.buildings);
          if (arrived) {
            // Peek at the player; leave early if the cover no
            // longer hides the enemy from where the player stands.
            e.heading = lerpAngle(e.heading, Math.atan2(px - e.x, pz - e.z), Math.min(1, dt * 4));
            const stillCovered = segmentHitsBox(e.x, 0, e.z, px, 1.2, pz, e.coverPoint.building);
            if (!stillCovered && canSee) {
              setState(e, 'engage');
              break;
            }
            if (e.stateT > COVER_STAY) setState(e, 'engage');
          }
          break;
        }
        case 'search': {
          if (canSee) {
            setState(e, 'alert');
            break;
          }
          const target = e.lastKnown ?? { x: e.homeX, z: e.homeZ };
          if (moveToward(e, target.x, target.z, dt, e.def.speed * 0.7, ctx.buildings)) {
            e.heading += dt * 0.6;
            if (e.stateT > SEARCH_TIME) setState(e, 'patrol');
          }
          break;
        }
      }

      // Write the model's transform.
      e.model.group.position.set(e.x, 0, e.z);
      e.model.group.rotation.y = e.heading;
      updatePose(e, dt);
    }
  };

  const handle: EnemiesHandle = {
    update,
    spawnEncounter: (encounterId, defs, cover) => {
      coverByEncounter.set(encounterId, cover);
      for (const d of defs) {
        const def = getEnemyDef(d.variant);
        if (!def) continue;
        const model = createEnemyModel(def, track);
        model.group.visible = false;
        group.add(model.group);
        const { line, mat } = makeTracer();
        const e: Enemy = {
          id: `enemy-${++idCounter}`,
          def,
          encounterId,
          model,
          x: d.x,
          z: d.z,
          heading: Math.random() * Math.PI * 2,
          health: def.health,
          state: 'patrol',
          stateT: 0,
          patrol: d.patrol.length > 0 ? d.patrol : [{ x: d.x, z: d.z }],
          patrolIdx: 0,
          homeX: d.x,
          homeZ: d.z,
          lastKnown: null,
          lastSeenAt: -Infinity,
          coverPoint: null,
          coverCooldown: 0,
          attackCooldown: 0,
          windup: 0,
          phase: Math.random() * Math.PI * 2,
          speed: 0,
          flashT: 0,
          defeatedAt: 0,
          active: false,
          visible: false,
          investigatePos: null,
          objective: null,
          tracer: line,
          tracerMat: mat,
          tracerAt: 0,
        };
        model.group.position.set(e.x, 0, e.z);
        model.group.rotation.y = e.heading;
        enemies.push(e);
      }
    },
    activateEncounter: (id) => {
      for (const e of enemies) {
        if (e.encounterId !== id || e.state === 'defeated') continue;
        e.active = true;
        e.visible = true;
        e.model.group.visible = true;
      }
    },
    deactivateEncounter: (id) => {
      for (const e of enemies) {
        if (e.encounterId !== id) continue;
        e.active = false;
        e.visible = false;
        e.model.group.visible = false;
        e.tracer.visible = false;
      }
    },
    resetEncounter: (id) => {
      for (const e of enemies) {
        if (e.encounterId !== id) continue;
        e.health = e.def.health;
        e.x = e.homeX;
        e.z = e.homeZ;
        e.heading = Math.random() * Math.PI * 2;
        e.state = 'patrol';
        e.stateT = 0;
        e.patrolIdx = 0;
        e.lastKnown = null;
        e.coverPoint = null;
        e.coverCooldown = 0;
        e.attackCooldown = 0;
        e.windup = 0;
        e.flashT = 0;
        e.defeatedAt = 0;
        e.investigatePos = null;
        e.model.group.rotation.x = 0;
        e.model.group.position.set(e.x, 0, e.z);
        for (const m of e.model.flashMats) m.emissive.setHex(0x000000);
        e.tracer.visible = false;
      }
    },
    setObjective: (encounterId, x, z) => {
      for (const e of enemies) {
        if (e.encounterId !== encounterId) continue;
        e.objective = { x, z };
      }
    },
    clearObjective: (encounterId) => {
      for (const e of enemies) {
        if (e.encounterId !== encounterId) continue;
        e.objective = null;
      }
    },
    damageEnemy: (id, amount) => {
      const e = enemies.find((n) => n.id === id);
      if (!e || e.state === 'defeated' || !e.active) return false;
      e.health = Math.max(0, e.health - amount);
      e.flashT = 0.15;
      if (e.health <= 0) {
        e.state = 'defeated';
        e.stateT = 0;
        e.defeatedAt = elapsed;
        e.tracer.visible = false;
        onEnemyDefeated?.(e.id, e.encounterId);
      }
      return true;
    },
    hitTargets: () =>
      enemies
        .filter((e) => e.active && e.state !== 'defeated')
        .map((e) => ({
          id: e.id,
          x: e.x,
          z: e.z,
          chestY: 1.2 * e.def.height,
          radius: 0.55,
        })),
    enemyStates: () =>
      enemies.map((e) => ({
        id: e.id,
        variant: e.def.id,
        name: e.def.name,
        encounterId: e.encounterId,
        x: +e.x.toFixed(2),
        z: +e.z.toFixed(2),
        heading: +e.heading.toFixed(2),
        health: e.health,
        maxHealth: e.def.health,
        state: e.state,
        active: e.active,
      })),
    onPlayerShot: (x, z) => {
      for (const e of enemies) {
        if (!e.active || e.state === 'defeated') continue;
        if (e.state !== 'patrol' && e.state !== 'idle') continue;
        const d = Math.hypot(x - e.x, z - e.z);
        if (d > 40) continue;
        e.investigatePos = { x, z };
        setState(e, 'investigate');
      }
    },
    dispose: () => {
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
  return handle;
}
