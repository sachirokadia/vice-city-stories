/**
 * Sunset Sprint — one small optional beach activity, independent
 * of the story missions. The player starts at the marked point on
 * the boardwalk, runs north through five checkpoints, and finishes
 * at the north end for $150. No mission-chain dependency, no
 * vehicle allowed mid-run, replayable forever.
 *
 * The start point is a registered interactable (the engine owns
 * the registry); this module owns the run itself — timer,
 * checkpoints, the gold marker that always points at the next
 * checkpoint, and the best-time save.
 *
 * Stored shape: { bestTime: number | null, completions: number }
 * under its own key, so a sprint write can never clobber mission
 * progress, the cash balance, or the garage save.
 */
import * as THREE from 'three';

export const SPRINT_REWARD = 150;
export const SPRINT_TIME_LIMIT = 35;
/** Where the run starts — also the interactable's position. */
export const SPRINT_START = { x: 133, z: 90 };
/** Checkpoints in run order; the last one is the finish. */
export const SPRINT_CHECKPOINTS = [
  { x: 133, z: 60 },
  { x: 133, z: 30 },
  { x: 133, z: 0 },
  { x: 133, z: -30 },
  { x: 133, z: -60 },
];
export const SPRINT_CHECKPOINT_RADIUS = 4;

export type SprintStatus = 'idle' | 'running' | 'complete' | 'failed';

export interface SprintHudState {
  status: SprintStatus;
  checkpointIndex: number;
  checkpointsTotal: number;
  timeLeft: number;
  bestTime: number | null;
  completions: number;
  /** Why the last run failed, when it did. */
  failedReason: 'time' | 'vehicle' | 'busted' | null;
  /** Seconds the winning run took, when it just completed. */
  lastTime: number | null;
}

const SPRINT_KEY = 'vice-city-stories.sprint.v1';

export interface SprintSave {
  bestTime: number | null;
  completions: number;
}

export function loadSprintSave(): SprintSave {
  try {
    const raw = window.localStorage.getItem(SPRINT_KEY);
    if (raw === null) return { bestTime: null, completions: 0 };
    const parsed = JSON.parse(raw) as Partial<SprintSave>;
    return {
      bestTime:
        typeof parsed.bestTime === 'number' && Number.isFinite(parsed.bestTime)
          ? parsed.bestTime
          : null,
      completions:
        typeof parsed.completions === 'number' && Number.isFinite(parsed.completions)
          ? Math.max(0, Math.floor(parsed.completions))
          : 0,
    };
  } catch {
    return { bestTime: null, completions: 0 };
  }
}

export function saveSprintSave(save: SprintSave): void {
  try {
    window.localStorage.setItem(SPRINT_KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable — the sprint still works for the session */
  }
}

export interface SprintHandle {
  /** Start a run (false when one is already running). */
  start: () => boolean;
  /** Whether a run is in progress (drives the start prompt). */
  isRunning: () => boolean;
  /**
   * Advance the run. Returns 'complete' / 'failed' on the frame
   * the run ends, so the engine can pay the reward exactly once.
   */
  update: (
    dt: number,
    ctx: { playerPos: THREE.Vector3; driving: boolean; arrestState: string },
  ) => 'complete' | 'failed' | null;
  /** Dismiss a finished run back to idle (the HUD buttons call this). */
  dismiss: () => void;
  getHudState: () => SprintHudState;
  /** QA hook: set the remaining time directly. */
  debugSetTimeLeft: (seconds: number) => void;
  dispose: () => void;
}

/**
 * The marker: one gold beam + ground ring that sits on the next
 * checkpoint while a run is live, and hides otherwise. It is the
 * same visual language as the mission marker, in gold instead of
 * mission yellow — the player already knows what it means.
 */
export function createSprint(scene: THREE.Scene): SprintHandle {
  const save = loadSprintSave();
  let status: SprintStatus = 'idle';
  let checkpointIndex = 0;
  let timeLeft = SPRINT_TIME_LIMIT;
  let failedReason: SprintHudState['failedReason'] = null;
  let lastTime: number | null = null;

  const group = new THREE.Group();
  group.name = 'sprint-marker';
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const beamMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const beam = new THREE.Mesh(track(new THREE.CylinderGeometry(0.6, 0.6, 16, 12, 1, true)), beamMat);
  beam.position.y = 8;
  group.add(beam);
  const ringMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  const ring = new THREE.Mesh(track(new THREE.RingGeometry(2.6, 3.2, 32)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);
  group.visible = false;
  group.position.set(SPRINT_START.x, 0, SPRINT_START.z);
  scene.add(group);

  const moveMarker = () => {
    if (status !== 'running') {
      group.visible = false;
      return;
    }
    const cp = SPRINT_CHECKPOINTS[checkpointIndex];
    group.position.set(cp.x, 0, cp.z);
    group.visible = true;
  };

  return {
    start: () => {
      if (status === 'running') return false;
      status = 'running';
      checkpointIndex = 0;
      timeLeft = SPRINT_TIME_LIMIT;
      failedReason = null;
      lastTime = null;
      moveMarker();
      return true;
    },
    isRunning: () => status === 'running',
    update: (dt, ctx) => {
      if (status !== 'running') return null;
      // A foot race: climbing into a car ends it, and so does
      // getting arrested mid-run.
      if (ctx.driving) {
        status = 'failed';
        failedReason = 'vehicle';
        moveMarker();
        return 'failed';
      }
      if (ctx.arrestState === 'surrendering' || ctx.arrestState === 'busted') {
        status = 'failed';
        failedReason = 'busted';
        moveMarker();
        return 'failed';
      }
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        status = 'failed';
        failedReason = 'time';
        moveMarker();
        return 'failed';
      }
      const cp = SPRINT_CHECKPOINTS[checkpointIndex];
      const d = Math.hypot(ctx.playerPos.x - cp.x, ctx.playerPos.z - cp.z);
      if (d < SPRINT_CHECKPOINT_RADIUS) {
        checkpointIndex++;
        if (checkpointIndex >= SPRINT_CHECKPOINTS.length) {
          const runTime = SPRINT_TIME_LIMIT - timeLeft;
          lastTime = runTime;
          save.bestTime =
            save.bestTime === null ? runTime : Math.min(save.bestTime, runTime);
          save.completions++;
          saveSprintSave(save);
          status = 'complete';
          moveMarker();
          return 'complete';
        }
        moveMarker();
      }
      return null;
    },
    dismiss: () => {
      if (status === 'running') return;
      status = 'idle';
      failedReason = null;
      lastTime = null;
      moveMarker();
    },
    debugSetTimeLeft: (seconds: number) => {
      if (status === 'running') timeLeft = seconds;
    },
    getHudState: () => ({
      status,
      checkpointIndex,
      checkpointsTotal: SPRINT_CHECKPOINTS.length,
      timeLeft,
      bestTime: save.bestTime,
      completions: save.completions,
      failedReason,
      lastTime,
    }),
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
}
