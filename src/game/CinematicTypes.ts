/**
 * Cinematic types — Phase 9D.
 *
 * A cinematic is data: a sequence of shots, each with a camera
 * start pose, an optional end pose (the camera drifts between
 * them), a duration, an optional narration line, an optional
 * dialogue (played during the shot), an optional gameplay event
 * (fired once when the shot starts), and the characters staged
 * for the scene. The runtime (Cinematic.ts) walks the shots and
 * interpolates the existing camera — there is no second camera.
 *
 * Nothing here imports Three.js or React, so cinematic data can
 * be read and validated without starting the engine — the same
 * rule as StoryDialogue.ts.
 */
import type { DialogueEvent } from './StoryDialogue';

/** A 3D point in world coordinates. */
export type Vec3 = [number, number, number];

/**
 * Where a camera pose points. An absolute point, or a live
 * target: the player, the vehicle, or a staged character —
 * resolved every frame, so a walking staged character stays
 * in frame. Missing targets fall back to the world origin
 * (and are logged), never crash the scene.
 */
export type CinematicTargetRef =
  | { kind: 'point'; pos: Vec3 }
  | { kind: 'player'; offset?: Vec3 }
  | { kind: 'vehicle'; offset?: Vec3 }
  | { kind: 'character'; id: string; offset?: Vec3 };

/** A gameplay event fired once when a shot starts. The same
 * event vocabulary as dialogue (setFlag, giveCash, completeObjective,
 * setWanted, startStoryMission) — the engine routes both through
 * one handler, so an event means the same thing in either place. */
export type CinematicEvent = DialogueEvent;

/** One camera shot. */
export interface CinematicShot {
  id: string;
  /** Seconds on screen (sim time; frame-rate independent). */
  duration: number;
  /** Camera position at the start of the shot. */
  pos: CinematicTargetRef;
  /** What the camera looks at at the start of the shot. */
  lookAt: CinematicTargetRef;
  /** Camera position at the end of the shot (a slow push/dolly).
   * Omitted = the camera holds still for the shot. */
  posEnd?: CinematicTargetRef;
  /** Look-at at the end of the shot. Omitted = holds still. */
  lookAtEnd?: CinematicTargetRef;
  /** Narration line shown as a subtitle during the shot. */
  narration?: string;
  /** Dialogue opened during this shot. The cinematic clock
   * freezes while it is open (the engine stops, as for any
   * dialogue) and resumes when it closes. The dialogue is
   * narrative-only: it must never carry the mission-accept
   * event — that lives in the campaign dialogue that follows
   * the cinematic. */
  dialogueId?: string;
  /** Gameplay event fired once when the shot starts. Skipping
   * the cinematic fires every unfired shot event, in order —
   * a skip never skips a story event. */
  event?: CinematicEvent;
}

/** One character staged for the scene. */
export interface CinematicStageActor {
  /** Speaker id from StoryCharacters (also the palette). */
  characterId: string;
  /** World position (x, z on the ground plane; y is ignored). */
  pos: [number, number];
  /** Facing, radians — forward is (sin h, cos h), as everywhere. */
  heading: number;
  /** Idle (breathing) or a slow walk to a point, then idle. */
  action?: { kind: 'walk'; to: [number, number]; speed?: number };
}

/** A cinematic definition: id, title, shots, staged cast. */
export interface CinematicDef {
  id: string;
  /** Shown in the title card at the start (e.g. mission title). */
  title: string;
  /** Chapter label for the title card (e.g. 'Chapter 1'). */
  chapter?: string;
  shots: CinematicShot[];
  /** Characters present for the whole scene, removed on cleanup. */
  stage?: CinematicStageActor[];
}

/** What React renders, reported on every shot transition. */
export interface CinematicState {
  active: boolean;
  cinematicId: string;
  title: string;
  chapter: string | null;
  /** 0-based shot index. */
  shotIndex: number;
  shotCount: number;
  /** The current shot's narration line, if any. */
  narration: string | null;
  /** Seconds into the current shot. */
  shotElapsed: number;
  /** Seconds the current shot lasts. */
  shotDuration: number;
}
