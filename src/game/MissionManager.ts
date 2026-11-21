/**
 * MissionManager — the runtime state machine for missions.
 *
 * States: idle (undiscovered) -> available (marker waiting) ->
 * active (objectives running, timer ticking) -> complete / failed.
 * The definitions are data (MissionDefinitions.ts); this module
 * only walks the objective list, runs the timer and owns the 3D
 * marker. The engine feeds it live game state and renders what
 * getHudState() reports — nothing about a mission is hardcoded
 * into the engine.
 *
 * Phase 7B: the manager now runs any of the five missions. The
 * player picks one on the mission board; the marker belongs to
 * the selected mission. Progress (completed missions, the
 * selected mission) persists in localStorage; the unlock chain
 * is the definition order (each mission unlocks when the previous
 * one is completed). Cash is unchanged: virtual and local, paid
 * exactly once per completion.
 *
 * The 3D marker is one group of three meshes (beam, ground ring,
 * floating diamond), created once and repositioned per objective —
 * nothing is created or destroyed per frame, and the meshes cast
 * no shadows, so the Phase 3.5 budget is untouched.
 *
 * The tail mission owns one extra object: the dedicated target
 * vehicle (MissionVehicle.ts), a teal sedan with a purple roof
 * beacon that drives the lane graph. It exists only while the
 * tail mission is selected, parks at its start until the follow
 * objective begins, and never touches the traffic AI.
 */
import * as THREE from 'three';
import type { ArrestState } from './Arrest';
import { MISSION_DEFS } from './MissionDefinitions';
import {
  loadMissionProgress,
  saveMissionProgress,
  isMissionUnlocked,
  buildBoardState,
  loadCashBalance,
} from './MissionProgress';
import type { MissionProgress } from './MissionProgress';
import { createMissionVehicle } from './MissionVehicle';
import type { MissionVehicleHandle } from './MissionVehicle';
import {
  evaluateTrigger,
  distanceTo,
  evaluateFollow,
  createFollowScratch,
} from './MissionTriggers';
import type { FollowScratch, TriggerContext } from './MissionTriggers';
import type {
  MissionBoardState,
  MissionDef,
  MissionHudState,
  MissionRuntimeState,
} from './MissionTypes';
import type { WantedStatus } from './Wanted';

export interface MissionContext {
  playerPos: THREE.Vector3;
  playerSpeed: number;
  driving: boolean;
  vehiclePos: THREE.Vector3;
  vehicleSpeed: number;
  /** The car's facing (radians) — the direction it drives.
   * Distinct from camYaw: the chase camera's yaw does not
   * track the car's heading one-to-one. */
  vehicleHeading: number;
  arrestState: ArrestState;
  camYaw: number;
  /** Current wanted level (0 = clean) — for 'evade'. */
  wantedLevel: number;
  wantedStatus: WantedStatus;
  /** True while the avenue approach has the green light — the
   * target vehicle stops at red lights on the existing signals. */
  avenueGreen: boolean;
}

export interface MissionManagerHandle {
  /** Returns true when the mission target vehicle moved (the
   * engine uses it to refresh the shadow map). */
  update: (dt: number, ctx: MissionContext) => boolean;
  /** E / START while the accept prompt is showing. */
  tryInteract: () => boolean;
  /** The global guard: blocked while another activity is active. */
  setBlocked: (blocked: boolean) => void;
  /** Abandon an active mission (back to available, no penalty). */
  cancel: () => void;
  /** Restart after a failure (objectives + timer reset). */
  retry: () => void;
  /** Replay after a completion (objectives + timer reset). */
  replay: () => void;
  /** Continue after completion (back to available, ready to replay). */
  continueAfterComplete: () => void;
  /** Dismiss a failure (back to available). */
  dismissFailed: () => void;
  getHudState: () => MissionHudState;
  /** The mission the world marker currently belongs to. */
  getSelectedDef: () => MissionDef;
  /** Pick a mission from the board (false when locked or a run
   * is active). */
  selectMission: (id: string) => boolean;
  getBoardState: () => MissionBoardState;
  /** The shared cash balance (the garage spends from this too). */
  getCash: () => number;
  /**
   * Spend cash (garage purchases / upgrades). Returns false and
   * spends nothing when the balance is short — the manager's
   * in-memory cash is the single source of truth, so the garage
   * must go through here instead of writing localStorage itself.
   */
  spendCash: (amount: number) => boolean;
  /** Add cash (sprint rewards). The single source of truth, like spendCash. */
  addCash: (amount: number) => void;
  /** The tail target's live position, for the traffic / police /
   * crowd avoidance lists — null when it is not on the road. */
  getTargetVehiclePos: () => { x: number; z: number; heading: number; speed: number } | null;
  /** QA hook: set the remaining time directly. */
  debugSetTimeLeft: (seconds: number) => void;
  /** QA hook: set how far the tail target has driven. */
  debugSetTargetTravelled: (units: number) => void;
  dispose: () => void;
}

const CASH_KEY = 'vice-city-stories.cash.v1';
const MARKER_YELLOW = 0xffd23e;
const TAIL_MISSION_ID = 'dont-lose-them';

export function createMissionManager(scene: THREE.Scene): MissionManagerHandle {
  const progress: MissionProgress = loadMissionProgress();
  // The saved selection, or the first mission when nothing is
  // saved (or the saved id no longer exists). A fresh player has
  // BEACON RUN selected from the start, and the board shows it.
  if (!progress.selected) {
    progress.selected = MISSION_DEFS[0].id;
    saveMissionProgress(progress);
  }
  let def: MissionDef =
    MISSION_DEFS.find((d) => d.id === progress.selected) ?? MISSION_DEFS[0];
  let state: MissionRuntimeState = 'idle';
  /** The global guard: blocked while a story mission or a
   * contract is active. Set by the engine each tick. */
  let blocked = false;
  let objectiveIndex = 0;
  let timeLeft = 0;
  let cash = loadCashBalance();
  let flash: { text: string; at: number } | null = null;
  let flashAt = -10;
  let time = 0;
  let lastCtx: MissionContext | null = null;
  let failedReason: MissionHudState['failedReason'] = null;
  let followScratch: FollowScratch = createFollowScratch();
  let followObjectiveId: string | null = null;

  // --- The tail target vehicle (only visible for its mission) ---
  const targetVehicle: MissionVehicleHandle = createMissionVehicle(scene);
  targetVehicle.setVisible(def.id === TAIL_MISSION_ID);

  // --- The 3D marker: beam + ground ring + floating diamond ---
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const markerGroup = new THREE.Group();
  markerGroup.name = 'mission-marker';
  const beam = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.7, 0.7, 60, 12, 1, true)),
    track(
      new THREE.MeshBasicMaterial({
        color: MARKER_YELLOW,
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  beam.position.y = 30;
  beam.castShadow = false;
  beam.frustumCulled = false;
  const ring = new THREE.Mesh(
    track(new THREE.RingGeometry(2.4, 3.2, 40)),
    track(
      new THREE.MeshBasicMaterial({
        color: MARKER_YELLOW,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.castShadow = false;
  ring.frustumCulled = false;
  const diamond = new THREE.Mesh(
    track(new THREE.OctahedronGeometry(1.0)),
    track(new THREE.MeshBasicMaterial({ color: MARKER_YELLOW })),
  );
  diamond.position.y = 4.5;
  diamond.castShadow = false;
  diamond.frustumCulled = false;
  markerGroup.add(beam, ring, diamond);
  markerGroup.position.set(def.startMarker.x, 0, def.startMarker.z);
  scene.add(markerGroup);

  const saveCash = (): void => {
    try {
      window.localStorage.setItem(CASH_KEY, String(cash));
    } catch {
      /* storage unavailable — cash still works for the session */
    }
  };

  const saveProgress = (): void => saveMissionProgress(progress);

  const isTailMission = (): boolean => def.id === TAIL_MISSION_ID;

  const currentObjective = () => def.objectives[objectiveIndex];

  const currentTarget = (): { x: number; z: number } | null => {
    if (state !== 'available' && state !== 'active') return null;
    const obj = currentObjective();
    if (!obj) return null;
    // The "get in the car" objective points at the car itself.
    if (obj.type === 'enterVehicle' && lastCtx) {
      return { x: lastCtx.vehiclePos.x, z: lastCtx.vehiclePos.z };
    }
    // The tail objective points at the moving target car.
    if (obj.type === 'follow') {
      const t = targetVehicle.getState();
      return { x: t.x, z: t.z };
    }
    return obj.target;
  };

  const resetTargetVehicle = (): void => {
    targetVehicle.reset();
    targetVehicle.setVisible(isTailMission());
  };

  const fail = (reason: 'timer' | 'busted' | 'lost' | 'spotted'): void => {
    state = 'failed';
    failedReason = reason;
    timeLeft = 0;
    flash = null;
    markerGroup.visible = false;
    resetTargetVehicle();
  };

  const complete = (): void => {
    state = 'complete';
    failedReason = null;
    timeLeft = 0;
    flash = null;
    cash += def.reward;
    saveCash();
    if (!progress.completed.includes(def.id)) {
      progress.completed.push(def.id);
      saveProgress();
    }
    markerGroup.visible = false;
    resetTargetVehicle();
  };

  const resetRun = (): void => {
    objectiveIndex = 0;
    timeLeft = def.timeLimit;
    flash = null;
    failedReason = null;
    followScratch = createFollowScratch();
    followObjectiveId = null;
    resetTargetVehicle();
  };

  const triggerCtx = (ctx: MissionContext): TriggerContext => ({
    playerPos: { x: ctx.playerPos.x, z: ctx.playerPos.z },
    playerSpeed: ctx.playerSpeed,
    driving: ctx.driving,
    vehiclePos: { x: ctx.vehiclePos.x, z: ctx.vehiclePos.z },
    vehicleSpeed: ctx.vehicleSpeed,
    wantedLevel: ctx.wantedLevel,
    wantedStatus: ctx.wantedStatus,
  });

  const update = (dt: number, ctx: MissionContext): boolean => {
    time += dt;
    lastCtx = ctx;
    if (flash && time - flashAt > 2.5) flash = null;

    // Discovery: walking up to the marker reveals the job.
    if (state === 'idle') {
      const d = Math.hypot(ctx.playerPos.x - def.startMarker.x, ctx.playerPos.z - def.startMarker.z);
      if (d <= def.discoveryRadius) state = 'available';
    }

    if (state === 'available') {
      // The first objective (reach the marker) completes on its own;
      // the second (accept) waits for the player's E / START.
      const obj = currentObjective();
      if (obj && obj.type === 'reach' && evaluateTrigger(obj.type, obj.target, obj.radius, triggerCtx(ctx))) {
        objectiveIndex++;
      }
    } else if (state === 'active') {
      // Arrested mid-mission: the mission fails. The BUSTED screen
      // shows first; the failure screen follows on respawn.
      if (ctx.arrestState === 'busted') {
        fail('busted');
      } else {
        // Untimed missions (timeLimit 0) have no clock at all.
        if (def.timeLimit > 0) {
          timeLeft -= dt;
          if (timeLeft <= 0) {
            fail('timer');
          }
        }
        if (state === 'active') {
          const obj = currentObjective();
          if (obj) {
            if (obj.type === 'follow' && obj.follow) {
              if (followObjectiveId !== obj.id) {
                followScratch = createFollowScratch();
                followObjectiveId = obj.id;
              }
              const t = targetVehicle.getState();
              const result = evaluateFollow(
                obj.follow,
                { x: t.x, z: t.z },
                t.travelled,
                triggerCtx(ctx),
                followScratch,
                dt,
              );
              if (result.status === 'done') {
                objectiveIndex++;
                if (objectiveIndex >= def.objectives.length) complete();
              } else if (result.status === 'failed') {
                fail(result.reason);
              }
            } else if (obj.type === 'interact') {
              // The accept step is a one-time gate while the
              // mission is 'available'. A retry or replay restarts
              // at the reach objective with the job already
              // accepted, so this step is already done — skip past
              // it. (evaluateTrigger never completes an interact
              // objective, so without this the mission stalls here
              // forever after any retry or replay.)
              objectiveIndex++;
              if (objectiveIndex >= def.objectives.length) complete();
            } else if (evaluateTrigger(obj.type, obj.target, obj.radius, triggerCtx(ctx))) {
              if (obj.type === 'checkpoint' && obj.timeBonus) {
                timeLeft += obj.timeBonus;
                flash = { text: `CHECKPOINT +${obj.timeBonus}s`, at: time };
                flashAt = time;
              } else if (obj.flashText) {
                flash = { text: obj.flashText, at: time };
                flashAt = time;
              }
              objectiveIndex++;
              if (objectiveIndex >= def.objectives.length) complete();
            }
          }
        }
      }
    }

    // The tail target drives only while the follow objective is
    // current. It parks (at its destination) once it has covered
    // its route — the player then closes the last gap on foot or
    // by car.
    let targetMoved = false;
    if (isTailMission()) {
      const obj = currentObjective();
      const following = state === 'active' && obj?.type === 'follow';
      const t = targetVehicle.getState();
      if (following && !t.driving) targetVehicle.start();
      if (following && obj?.follow && t.travelled >= obj.follow.routeLength) {
        targetVehicle.stop();
      }
      targetMoved = targetVehicle.update(dt, ctx.avenueGreen);
    }

    // Marker: stands at the current objective (or the start marker
    // before discovery), hidden once the run is over.
    const target = currentTarget();
    if (target) {
      markerGroup.visible = true;
      markerGroup.position.set(target.x, 0, target.z);
    } else {
      markerGroup.visible = state === 'idle';
      if (state === 'idle') markerGroup.position.set(def.startMarker.x, 0, def.startMarker.z);
    }

    // Idle marker animation: the diamond bobs and spins, the ring
    // breathes, the beam shimmers. Cheap transforms, no allocation.
    diamond.rotation.y += dt * 1.2;
    diamond.position.y = 4.5 + Math.sin(time * 2) * 0.4;
    const pulse = 1 + 0.08 * Math.sin(time * 3);
    ring.scale.set(pulse, pulse, 1);
    (beam.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.08 * Math.sin(time * 2);

    return targetMoved;
  };

  const getHudState = (): MissionHudState => {
    const obj = state === 'available' || state === 'active' ? currentObjective() : undefined;
    const target = currentTarget();
    let distance: number | null = null;
    let bearing: number | null = null;
    if (target && lastCtx) {
      distance = distanceTo(target, triggerCtx(lastCtx));
      // Arrow rotation for the HUD: 0 = straight ahead of the
      // camera, positive = clockwise (to the right).
      const dx = target.x - lastCtx.playerPos.x;
      const dz = target.z - lastCtx.playerPos.z;
      let b = lastCtx.camYaw + Math.PI - Math.atan2(dx, dz);
      while (b > Math.PI) b -= Math.PI * 2;
      while (b < -Math.PI) b += Math.PI * 2;
      bearing = b;
    }
    // The extra line under the objective: the follow band and its
    // live warnings, or the wanted level while hiding.
    let hint: string | null = null;
    if (state === 'active' && obj?.type === 'follow' && obj.follow) {
      if (followScratch.tooClose > 0) {
        hint = 'TOO CLOSE — back off!';
      } else if (followScratch.tooFar > 0) {
        hint = 'Falling behind — catch up!';
      } else if (!followScratch.lockedOn) {
        hint = `Get within ${obj.follow.maxDist} m to lock on`;
      } else {
        hint = `Stay ${obj.follow.minDist}–${obj.follow.maxDist} m behind the target`;
      }
    } else if (state === 'active' && obj?.type === 'evade' && lastCtx) {
      hint =
        lastCtx.wantedLevel > 0
          ? `Wanted level ${lastCtx.wantedLevel} — stay out of sight`
          : 'The heat is off — hold on';
    }
    const prompt =
      state === 'available' && obj?.type === 'interact' && !blocked
        ? ('accept' as const)
        : null;
    return {
      state,
      missionId: def.id,
      title: def.title,
      description: def.description,
      kind: def.kind,
      giver: def.giver,
      objectiveText: obj ? obj.text : '',
      objectiveIndex,
      objectiveCount: def.objectives.length,
      distance: distance === null ? null : Math.round(distance),
      bearing,
      timeLeft: state === 'active' && def.timeLimit > 0 ? Math.max(0, Math.ceil(timeLeft)) : null,
      timeLimit: def.timeLimit,
      cash,
      reward: def.reward,
      flash,
      failedReason,
      prompt,
      marker: target ? { ...target } : null,
      hint,
    };
  };

  return {
    update,
    tryInteract: () => {
      // Only the accept objective, only while available, only on
      // foot at the marker, never mid-arrest, never while the
      // global guard blocks (a story mission or a contract runs).
      if (state !== 'available') return false;
      if (blocked) return false;
      const obj = currentObjective();
      if (!obj || obj.type !== 'interact' || !lastCtx) return false;
      if (lastCtx.arrestState === 'surrendering' || lastCtx.arrestState === 'busted') return false;
      if (lastCtx.driving) return false;
      const d = Math.hypot(
        lastCtx.playerPos.x - obj.target.x,
        lastCtx.playerPos.z - obj.target.z,
      );
      if (d > obj.radius) return false;
      state = 'active';
      objectiveIndex++;
      timeLeft = def.timeLimit;
      flash = { text: 'MISSION STARTED', at: time };
      flashAt = time;
      return true;
    },
    cancel: () => {
      if (state !== 'active') return;
      state = 'available';
      objectiveIndex = 0;
      timeLeft = 0;
      flash = null;
      failedReason = null;
      followScratch = createFollowScratch();
      followObjectiveId = null;
      resetTargetVehicle();
    },
    retry: () => {
      if (state !== 'failed') return;
      state = 'active';
      resetRun();
    },
    replay: () => {
      if (state !== 'complete' && state !== 'failed') return;
      state = 'active';
      resetRun();
    },
    continueAfterComplete: () => {
      if (state !== 'complete') return;
      state = 'available';
      objectiveIndex = 0;
      timeLeft = 0;
      flash = null;
      resetTargetVehicle();
    },
    dismissFailed: () => {
      if (state !== 'failed') return;
      state = 'available';
      objectiveIndex = 0;
      timeLeft = 0;
      failedReason = null;
      resetTargetVehicle();
    },
    getHudState,
    getSelectedDef: () => def,
    selectMission: (id: string) => {
      if (state === 'active') return false;
      const next = MISSION_DEFS.find((d) => d.id === id);
      if (!next) return false;
      if (!isMissionUnlocked(id, progress.completed)) return false;
      if (next.id === def.id) return true;
      def = next;
      progress.selected = def.id;
      saveProgress();
      state = 'idle';
      objectiveIndex = 0;
      timeLeft = 0;
      flash = null;
      failedReason = null;
      followScratch = createFollowScratch();
      followObjectiveId = null;
      markerGroup.position.set(def.startMarker.x, 0, def.startMarker.z);
      resetTargetVehicle();
      return true;
    },
    getBoardState: () =>
      buildBoardState(progress, cash, state === 'active' ? def.id : null),
    getCash: () => cash,
    addCash: (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      cash += amount;
      saveCash();
    },
    spendCash: (amount: number) => {
      if (!Number.isFinite(amount) || amount < 0 || amount > cash) return false;
      cash -= amount;
      saveCash();
      return true;
    },
    getTargetVehiclePos: () => {
      if (!isTailMission()) return null;
      const t = targetVehicle.getState();
      return { x: t.x, z: t.z, heading: t.heading, speed: t.speed };
    },
    debugSetTimeLeft: (seconds: number) => {
      if (state === 'active') timeLeft = seconds;
    },
    debugSetTargetTravelled: (units: number) => {
      targetVehicle.debugSetTravelled(units);
    },
    setBlocked: (next: boolean) => {
      blocked = next;
    },
    dispose: () => {
      targetVehicle.dispose();
      scene.remove(markerGroup);
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
