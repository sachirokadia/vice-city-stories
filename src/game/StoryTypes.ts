/**
 * Story campaign types — Phase 9B.
 *
 * A story mission is a definition (static data) plus a runtime
 * state machine in StoryCampaign.ts, mirroring the job-mission
 * split (MissionTypes / MissionManager). The story reuses the
 * seven existing objective types and adds four of its own:
 * dialogue (9C replaces the 9B stub with the real dialogue
 * system), defeat and defend (9E, built on the existing enemy
 * and contract-objective systems), and collect (9B, a reach
 * check plus a visible prop).
 *
 * Nothing here imports Three.js or React, so the main menu can
 * read campaign progress without starting the engine — the same
 * rule as MissionProgress.ts.
 */
import type { FollowParams } from './MissionTypes';

/** Objective types a story mission can use. */
export type StoryObjectiveType =
  | 'reach'
  | 'interact'
  | 'enterVehicle'
  | 'checkpoint'
  | 'deliver'
  | 'follow'
  | 'evade'
  | 'dialogue' // 9B: stubbed as an interact that shows one line; 9C: real dialogue
  | 'defeat' // 9E: defeat N enemies in a named encounter
  | 'defend' // 9E: keep a protected objective alive
  | 'collect'; // 9B: pick up an item at a point (reach + prop)

export interface StoryObjectiveDef {
  id: string;
  type: StoryObjectiveType;
  /** Shown in the HUD while this objective is current. */
  text: string;
  /** World position the objective points at (x, z). */
  target: { x: number; z: number };
  /** Completion radius around the target, in world units. */
  radius: number;
  /** Seconds added to the timer when a checkpoint is hit. */
  timeBonus?: number;
  /** Flash shown in the HUD when this objective completes. */
  flashText?: string;
  /** Distance-band rules — only for 'follow' objectives. */
  follow?: FollowParams;
  /** Completing this objective snapshots the run (restore point). */
  checkpoint?: boolean;
  /** Dialogue objective: the dialogue id (used by 9C). */
  dialogueId?: string;
  /** Dialogue objective: the cinematic played first, once per
   * run, before the dialogue opens (9D). */
  cinematicId?: string;
  /** Dialogue objective: the one line shown by the 9B stub. */
  line?: string;
  /** Dialogue objective (9E): this objective IS the mission-accept
   * step — it auto-advances on retry/replay, and only objectives
   * marked accept are auto-skipped. Mid-mission dialogues leave
   * this unset so the player talks to the character again. */
  accept?: boolean;
  /** Defeat objective: the encounter id whose enemies count. */
  encounterId?: string;
  /** Defeat objective: how many enemies to defeat. */
  count?: number;
  /** Defend objective: the protected objective's position/health. */
  objective?: { x: number; z: number; maxHealth: number };
  /** Defend objective (9E): the wave encounter ids, in order. */
  waves?: string[];
  /** Enter-vehicle objective (9E): only counts when this vehicle
   * id is the selected car. Unset = any car. */
  vehicleId?: string;
  /** Collect objective (9E): while the flag is unset, the HUD
   * hides distance/bearing for this objective — the player is
   * told a neighbourhood, not an address. */
  distanceGatedByFlag?: string;
}

export interface StoryPrereq {
  /** A story mission id that must be completed first. */
  mission?: string;
  /** A job mission id that must be completed first. */
  jobMission?: string;
  /** The player must hold at least this much cash. */
  cash?: number;
  /** The player must own this car id. */
  vehicle?: string;
  /** This campaign flag must be set. */
  flag?: string;
}

export interface StoryMissionDef {
  id: string;
  chapterId: string;
  title: string;
  /** One line for the HUD card and the story board. */
  description: string;
  giver: string;
  /** Where the mission marker stands while it is available. */
  startMarker: { x: number; z: number };
  /** Distance at which the mission is discovered. */
  discoveryRadius: number;
  /** Seconds on the clock once the mission is accepted. 0 = untimed. */
  timeLimit: number;
  /** Virtual cash awarded on completion. */
  reward: number;
  /** Id of the story mission that must be completed first. */
  unlockAfter?: string;
  /** Extra prerequisites (all must hold). */
  prerequisites?: StoryPrereq[];
  /** Heat set on the wanted system when the mission is accepted. */
  startHeat?: number;
  /** Campaign flags set when this mission completes. */
  setsFlags?: string[];
  /** Car granted (and selected) when this mission completes —
   * a deterministic reward, not a dialogue event, so a skipped
   * cinematic can never lose it (9E). Idempotent: owning it
   * already is a no-op. */
  grantsVehicle?: string;
  /** Outfit granted when this mission completes — ownership only,
   * never auto-equipped (9E). Idempotent. */
  grantsOutfit?: string;
  /** Cinematic played from the mission-complete screen's Continue
   * button, after the reward is banked (9E: Chapter 2 outro). */
  outroCinematicId?: string;
  /** Finale outro, chosen by the ending flag (9E): played from
   * the complete screen instead of outroCinematicId. */
  outroCinematicIds?: { mara: string; june: string };
  /** Main objectives in order. */
  objectives: StoryObjectiveDef[];
  /** Optional objectives, tracked in parallel — they never block
   * completion, and each pays its bonus once per save. */
  optional?: StoryObjectiveDef[];
  /** Cash bonus per optional objective completed (once each). */
  optionalReward?: number;
}

export interface StoryChapterDef {
  id: string;
  title: string;
  description: string;
  /** Missions in order. */
  missions: StoryMissionDef[];
}

/** Runtime state of a story mission — same shape as the job missions. */
export type StoryRuntimeState =
  | 'idle'
  | 'available'
  | 'active'
  | 'complete'
  | 'failed';

export type StoryFailReason =
  | 'timer'
  | 'busted'
  | 'cancelled'
  | 'downed'
  | 'objective-destroyed'
  | 'target-escaped'
  | 'lost'
  | 'spotted'
  | null;

/**
 * A checkpoint snapshot: everything needed to resume a run
 * exactly where it was. Taken when an objective marked
 * `checkpoint: true` completes. WS7: the snapshot is also
 * persisted on the v1 story save (an additive optional field),
 * so a reload mid-mission resumes at the checkpoint instead of
 * restarting the mission. `missionId` identifies the run the
 * snapshot belongs to; `wantedLevel` is the wanted LEVEL (0-5,
 * not heat) at the checkpoint, so an evade objective cannot
 * auto-complete on resume; `runTime` is the elapsed run time,
 * so bestTime still covers the whole run after a restore.
 */
export interface StoryCheckpoint {
  missionId: string;
  objectiveIndex: number;
  playerPos: { x: number; z: number };
  playerHeading: number;
  driving: boolean;
  vehiclePos: { x: number; z: number } | null;
  vehicleHeading: number | null;
  timeLeft: number;
  /** Ids of 'collect' objectives already done in this run. */
  collectedIds: string[];
  /** Ids of defeated enemies (for 'defeat' objectives, 9E). */
  defeatedIds: string[];
  /** Campaign flags as they stood at the checkpoint. */
  flags: Record<string, boolean>;
  /** Wanted level (0-5) at the checkpoint. */
  wantedLevel: number;
  /** Elapsed run time (seconds) at the checkpoint. */
  runTime: number;
  /** True when the snapshot was taken during a replay of an
   * already-completed mission. A replayed run's checkpoint must
   * still restore after a reload, even though the mission reads
   * completed — without this flag the restore guard refused it
   * (WS7 fix, 2026-11-24). Absent on pre-fix snapshots, which
   * keep the old behaviour. */
  replay?: boolean;
}

/** What persists for the campaign, under its own key. */
export interface StoryProgress {
  version: 1;
  chapters: Record<string, { unlocked: boolean; completed: boolean }>;
  missions: Record<
    string,
    { completed: boolean; optionalDone: string[]; bestTime: number | null }
  >;
  current: { chapterId: string; missionId: string } | null;
  flags: Record<string, boolean>;
  ending: 'mara' | 'june' | null;
  /** WS7: latest checkpoint snapshot of the active run, or null.
   * Absent on old saves — exactly today's behaviour. Cleared at
   * every run boundary (complete / fail-exit / retry / replay /
   * cancel / select / accept), so a stale snapshot can never
   * resurrect an old run. */
  checkpoint?: StoryCheckpoint | null;
}

/**
 * Everything the story HUD needs, reported ~10x a second.
 * Mirrors MissionHudState, plus the chapter and the optional
 * objectives.
 */
export interface StoryHudState {
  state: StoryRuntimeState;
  missionId: string | null;
  chapterId: string | null;
  chapterTitle: string;
  title: string;
  description: string;
  giver: string;
  objectiveText: string;
  objectiveIndex: number;
  objectiveCount: number;
  distance: number | null;
  bearing: number | null;
  timeLeft: number | null;
  timeLimit: number;
  cash: number;
  reward: number;
  flash: { text: string; at: number } | null;
  failedReason: StoryFailReason;
  prompt: 'accept' | null;
  /** The E-prompt action phrase, e.g. "Start FIRST LIGHT" or
   * "Talk to Mara Voss" (9E: mid-mission dialogue prompts). */
  promptLabel: string | null;
  marker: { x: number; z: number } | null;
  hint: string | null;
  /** Optional objectives and whether each is done in this run. */
  optional: Array<{ id: string; text: string; done: boolean }>;
  /** A checkpoint exists, so "Retry from checkpoint" is offered. */
  hasCheckpoint: boolean;
  /** The global guard blocks accepting while another activity runs. */
  blocked: boolean;
  /** The outro cinematic to play from the complete screen, when
   * the completed mission has one (9E). */
  outroCinematicId: string | null;
  /** The ending recorded when the campaign is complete. */
  ending: 'mara' | 'june' | null;
}

/** One row of the story board. */
export interface StoryBoardEntry {
  id: string;
  chapterId: string;
  title: string;
  description: string;
  giver: string;
  reward: number;
  unlocked: boolean;
  lockedBy: string | null;
  completed: boolean;
  selected: boolean;
  active: boolean;
}

export interface StoryBoardChapter {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  completed: boolean;
  entries: StoryBoardEntry[];
}

export interface StoryBoardState {
  chapters: StoryBoardChapter[];
  cash: number;
  /** The global guard blocks accepting while another activity runs. */
  blocked: boolean;
  ending: 'mara' | 'june' | null;
}
