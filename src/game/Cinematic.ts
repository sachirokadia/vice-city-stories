/**
 * The cinematic runtime — Phase 9D.
 *
 * A tiny state machine, modelled on the dialogue runtime's
 * shape: idle → playing (shot 0 … shot N) → closed. It holds
 * no React state: it walks a cinematic from StoryCinematics.ts,
 * interpolates the existing camera through target transforms,
 * fires shot events through the engine, and reports the current
 * shot for the overlay to render.
 *
 * Rules:
 * - One camera only. The runtime never touches the camera
 *   directly: each tick it hands the engine a pose (position +
 *   look-at), and the engine's updateCamera applies it. Normal
 *   walking / driving camera behaviour is untouched outside
 *   cinematics, and the engine blends back to it on exit.
 * - The clock is sim time (dt from the tick, capped as usual),
 *   so shots are frame-rate independent. A QA-only time scale
 *   (setTimeScale) fast-forwards the clock without changing
 *   the shot / event / staging code path.
 * - Shot poses interpolate start → end with a smoothstep, and
 *   each shot blends in from the previous shot's end pose (or
 *   the live camera pose, for shot 0) — no snaps at entries
 *   or shot changes.
 * - Events fire once, on shot entry. Skipping fires every
 *   unfired shot event in order first — a skip never skips a
 *   story event. A shot's dialogue opens through the engine
 *   (which stops the tick, as for any dialogue); the cinematic
 *   clock freezes with it and resumes when the dialogue closes.
 *   The skip control is hidden while a dialogue is open, so a
 *   cinematic can never be skipped out from under its own
 *   dialogue.
 * - Cleanup is one idempotent path (complete, skip, or
 *   dispose): staged characters are removed and disposed, the
 *   state clears, and onComplete fires exactly once.
 * - Invalid or missing references never crash the game: an
 *   unknown cinematic, a validation error, or a missing
 *   follow target logs and the cinematic does not start (or
 *   falls back to the world origin for that pose).
 */
import * as THREE from 'three';
import { getCinematic, validateStoryCinematics } from './StoryCinematics';
import type { CinematicDef, CinematicEvent, CinematicState, CinematicTargetRef } from './CinematicTypes';
import { createStagedActor } from './CinematicStaging';
import type { StagedActor } from './CinematicStaging';

export interface CinematicDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  getPlayerPos: () => THREE.Vector3;
  getVehiclePos: () => THREE.Vector3;
  /** Is a dialogue open right now? (skip is refused then.) */
  isDialogueOpen: () => boolean;
  /** Open a dialogue during a shot (engine-owned, pauses the tick). */
  openDialogue: (dialogueId: string) => boolean;
  /** Carry out a shot event (engine-owned). */
  onEvent: (event: CinematicEvent) => void;
  /** The cinematic ended — complete or skipped. The engine resumes here. */
  onComplete: () => void;
  /** The state changed — report it to React here. */
  onReport: () => void;
}

export interface CinematicHandle {
  start: (cinematicId: string) => boolean;
  /** Advance the clock one tick (called by the engine). */
  update: (dt: number) => void;
  /** Skip: fire every unfired shot event, then clean up. */
  skip: () => void;
  /** The current camera pose (position + look-at). */
  getCameraPose: () => { position: THREE.Vector3; target: THREE.Vector3 };
  getState: () => CinematicState | null;
  isActive: () => boolean;
  validateAll: () => { errors: string[]; warnings: string[] };
  /** QA/debug only: multiply the cinematic clock (default 1). */
  setTimeScale: (scale: number) => void;
  dispose: () => void;
}

/** Blend from the previous pose into a new shot, in seconds. */
const SHOT_BLEND_S = 0.8;
/** The first shot blends in from the live gameplay camera. */
const ENTRY_BLEND_S = 1.2;

const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Scratch vectors — no allocations per frame. */
const _entryPos = new THREE.Vector3();
const _entryTarget = new THREE.Vector3();
const _prevPos = new THREE.Vector3();
const _prevTarget = new THREE.Vector3();
const _shotStartPos = new THREE.Vector3();
const _shotStartTarget = new THREE.Vector3();
const _shotEndPos = new THREE.Vector3();
const _shotEndTarget = new THREE.Vector3();
const _posePos = new THREE.Vector3();
const _poseTarget = new THREE.Vector3();
const _pose = { position: _posePos, target: _poseTarget };

export function createCinematic(deps: CinematicDeps): CinematicHandle {
  const validation = validateStoryCinematics();
  if (validation.errors.length > 0) {
    for (const err of validation.errors) {
      console.error(`[cinematic] ${err}`);
    }
  }
  for (const warn of validation.warnings) {
    console.warn(`[cinematic] ${warn}`);
  }

  let current: CinematicDef | null = null;
  let shotIndex = 0;
  let shotElapsed = 0;
  let blendT = 0;
  let blendSeconds = ENTRY_BLEND_S;
  let timeScale = 1;
  let disposed = false;
  const firedEvents = new Set<string>();
  const warnedTargets = new Set<string>();
  let staged: StagedActor[] = [];

  const report = (): void => {
    deps.onReport();
  };

  /** Resolve a target ref into a world position. */
  const resolveRef = (ref: CinematicTargetRef, out: THREE.Vector3): void => {
    switch (ref.kind) {
      case 'point':
        out.set(ref.pos[0], ref.pos[1], ref.pos[2]);
        return;
      case 'player': {
        const p = deps.getPlayerPos();
        out.set(p.x + (ref.offset?.[0] ?? 0), (ref.offset?.[1] ?? 1.5), p.z + (ref.offset?.[2] ?? 0));
        return;
      }
      case 'vehicle': {
        const v = deps.getVehiclePos();
        out.set(v.x + (ref.offset?.[0] ?? 0), (ref.offset?.[1] ?? 1.4), v.z + (ref.offset?.[2] ?? 0));
        return;
      }
      case 'character': {
        const actor = staged.find((a) => a.characterId === ref.id);
        if (!actor) {
          const key = `character:${ref.id}`;
          if (!warnedTargets.has(key)) {
            warnedTargets.add(key);
            console.warn(`[cinematic] staged character '${ref.id}' is not in this scene — using the origin`);
          }
          out.set(0, 1.5, 0);
          return;
        }
        const g = actor.group.position;
        out.set(g.x + (ref.offset?.[0] ?? 0), 1.5 + (ref.offset?.[1] ?? 0), g.z + (ref.offset?.[2] ?? 0));
        return;
      }
    }
  };

  /** The pose the camera should hold right now. */
  const computePose = (): void => {
    if (!current) return;
    const shot = current.shots[shotIndex];
    if (!shot) return;
    resolveRef(shot.pos, _shotStartPos);
    resolveRef(shot.lookAt, _shotStartTarget);
    if (shot.posEnd) resolveRef(shot.posEnd, _shotEndPos);
    else _shotEndPos.copy(_shotStartPos);
    if (shot.lookAtEnd) resolveRef(shot.lookAtEnd, _shotEndTarget);
    else _shotEndTarget.copy(_shotStartTarget);
    const t = smooth(shotElapsed / shot.duration);
    _posePos.copy(_shotStartPos).lerp(_shotEndPos, t);
    _poseTarget.copy(_shotStartTarget).lerp(_shotEndTarget, t);
    // Blend in from the previous shot's end pose (or the live
    // gameplay camera, for shot 0) — this is what makes entries
    // and shot changes smooth instead of snapping.
    const b = smooth(blendT);
    _posePos.lerpVectors(_prevPos, _posePos, b);
    _poseTarget.lerpVectors(_prevTarget, _poseTarget, b);
  };

  /** One idempotent exit path for every ending: complete, skip,
   * or dispose. Staged characters are removed and disposed, the
   * state clears, and onComplete fires exactly once (never on
   * dispose — the engine is going away with it). */
  const cleanup = (reason: 'completed' | 'skipped' | 'disposed'): void => {
    if (!current) return;
    for (const actor of staged) actor.dispose();
    staged = [];
    firedEvents.clear();
    current = null;
    report();
    if (reason !== 'disposed') deps.onComplete();
  };

  /** Enter a shot: reset its clock, blend in from the previous
   * pose, fire its event once, open its dialogue if it has one. */
  const enterShot = (index: number): void => {
    if (!current) return;
    const shot = current.shots[index];
    if (!shot) {
      cleanup('completed');
      return;
    }
    // Blend from the pose the camera holds right now: the
    // previous shot's end pose (update() just computed it), or
    // the live gameplay camera for shot 0 (start() captured it).
    _prevPos.copy(_posePos);
    _prevTarget.copy(_poseTarget);
    shotIndex = index;
    shotElapsed = 0;
    blendT = 0;
    blendSeconds = index === 0 ? ENTRY_BLEND_S : SHOT_BLEND_S;
    if (shot.event && !firedEvents.has(shot.id)) {
      firedEvents.add(shot.id);
      deps.onEvent(shot.event);
    }
    if (shot.dialogueId) deps.openDialogue(shot.dialogueId);
    report();
  };

  return {
    start(cinematicId: string): boolean {
      if (disposed || current) return false;
      const def = getCinematic(cinematicId);
      if (!def) {
        console.error(`[cinematic] unknown cinematic '${cinematicId}'`);
        return false;
      }
      const hasErrors = validation.errors.some((e) =>
        e.startsWith(`cinematic '${cinematicId}'`),
      );
      if (hasErrors) {
        console.error(`[cinematic] '${cinematicId}' has validation errors — refusing to start`);
        return false;
      }
      // Capture the live gameplay camera pose: shot 0 blends in
      // from here, so the scene never snaps out of the game.
      _entryPos.copy(deps.camera.position);
      const dir = new THREE.Vector3();
      deps.camera.getWorldDirection(dir);
      _entryTarget.copy(deps.camera.position).addScaledVector(dir, 8);
      _prevPos.copy(_entryPos);
      _prevTarget.copy(_entryTarget);
      _posePos.copy(_entryPos);
      _poseTarget.copy(_entryTarget);
      current = def;
      firedEvents.clear();
      warnedTargets.clear();
      staged = (def.stage ?? []).map((a) =>
        createStagedActor(deps.scene, a.characterId, a.pos, a.heading, {
          walkTo: a.action?.kind === 'walk' ? a.action.to : undefined,
          walkSpeed: a.action?.kind === 'walk' ? a.action.speed : undefined,
        }),
      );
      enterShot(0);
      return current !== null;
    },

    update(dt: number): void {
      if (!current || disposed || dt <= 0) return;
      // Staged characters keep acting (idle breathing, walks)
      // while the scene plays.
      for (const actor of staged) actor.update(dt);
      shotElapsed += dt * timeScale;
      blendT = Math.min(1, blendT + (dt * timeScale) / blendSeconds);
      computePose();
      if (shotElapsed >= current.shots[shotIndex].duration) {
        if (shotIndex + 1 < current.shots.length) {
          enterShot(shotIndex + 1);
        } else {
          cleanup('completed');
        }
      }
    },

    skip(): void {
      if (!current || disposed) return;
      // Never skip out from under an open dialogue: the
      // conversation finishes first, then the skip works again.
      if (deps.isDialogueOpen()) {
        console.warn('[cinematic] skip refused while a dialogue is open');
        return;
      }
      // Fire every shot event that has not fired yet, in order.
      for (const shot of current.shots) {
        if (shot.event && !firedEvents.has(shot.id)) {
          firedEvents.add(shot.id);
          deps.onEvent(shot.event);
        }
      }
      cleanup('skipped');
    },

    getCameraPose(): { position: THREE.Vector3; target: THREE.Vector3 } {
      computePose();
      return _pose;
    },

    getState(): CinematicState | null {
      if (!current) return null;
      const shot = current.shots[shotIndex];
      return {
        active: true,
        cinematicId: current.id,
        title: current.title,
        chapter: current.chapter ?? null,
        shotIndex,
        shotCount: current.shots.length,
        narration: shot?.narration ?? null,
        shotElapsed,
        shotDuration: shot?.duration ?? 0,
      };
    },

    isActive: () => current !== null,

    validateAll: () => validation,

    setTimeScale(scale: number): void {
      timeScale = Math.min(20, Math.max(0.1, scale));
    },

    dispose(): void {
      disposed = true;
      cleanup('disposed');
    },
  };
}
