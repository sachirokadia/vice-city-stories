/**
 * The story campaign runtime — Phase 9B.
 *
 * A chapter/mission state machine that sits beside the job
 * missions in the engine, sharing the world, the cash and the
 * objective triggers, but with its own data, its own marker and
 * its own save key. Mirrors MissionManager.ts: the same state
 * names (idle → available → active → complete / failed), the same
 * objective walk, the same timer, the same board and HUD shape.
 *
 * Reuse, not duplication:
 * - The seven existing objective types are evaluated by
 *   MissionTriggers.evaluateTrigger. Only 'collect' (a reach
 *   check plus a per-run collected set) and the dialogue stub
 *   (an E-gated objective, like 'interact') are new, and they
 *   live in StoryTriggers.ts.
 * - Cash is the single shared balance — rewards go through the
 *   mission manager's addCash, never a second cash store.
 * - The timer, the checkpoint (+time bonus) and the evade
 *   (wantedLevel === 0) are the job missions' mechanics, reused
 *   as-is.
 * - 'defeat' / 'defend' / 'follow' (9E) are evaluated here
 *   from the enemy callbacks (defeated ids, via
 *   StoryTriggers.evaluateDefeat), the contract-objective
 *   beacon health, and the MissionVehicle tail — the same
 *   systems the job missions and contracts use, not copies.
 *   A defeat objective completes when the count is reached;
 *   a defend objective runs a wave machine (fighting /
 *   8 s recovery) over its wave encounter ids; a follow
 *   objective drives the story's own MissionVehicle instance.
 *
 * Idempotency (the events that must fire exactly once):
 * - complete(): the state flips to 'complete' BEFORE the reward
 *   is paid and the save is written, so a second call is a
 *   no-op. Retry never pays — only complete does.
 * - A checkpoint snapshot is taken once per objective, when
 *   that objective completes. Each objective completes once per
 *   run, so the snapshot is taken once.
 * - An optional objective pays its bonus only if its id is not
 *   already in the save's optionalDone list for this mission —
 *   once per save, across replays.
 *
 * Checkpoints: a snapshot (objective index, player + vehicle
 * position and heading, driving state, time left, collected
 * ids, flags) taken when an objective marked `checkpoint: true`
 * completes. Retrying from a checkpoint restores that snapshot
 * through the engine's teleport callback; the reward is not
 * touched, and nothing is re-paid.
 */
import * as THREE from 'three';
import type { MissionContext } from './MissionManager';
import {
  createFollowScratch,
  evaluateFollow,
  evaluateTrigger,
  distanceTo,
} from './MissionTriggers';
import type { FollowScratch } from './MissionTriggers';
import type { MissionVehicleHandle } from './MissionVehicle';
import {
  countDefeated,
  evaluateCollect,
  evaluateDefeat,
  isCheckpointValid,
  takeCheckpoint,
} from './StoryTriggers';
import { heatForWantedLevel } from './Wanted';
import {
  STORY_MISSIONS,
  storyChapterById,
  storyMissionById,
} from './StoryDefinitions';
import {
  buildStoryBoardState,
  isStoryMissionUnlocked,
  loadStoryProgress,
  saveStoryProgress,
} from './StoryProgress';
import type {
  StoryBoardState,
  StoryCheckpoint,
  StoryFailReason,
  StoryHudState,
  StoryMissionDef,
  StoryObjectiveDef,
  StoryProgress,
  StoryRuntimeState,
} from './StoryTypes';

/** The mission context, plus whether the player is downed. */
export interface StoryContext extends MissionContext {
  downed: boolean;
}

export interface StoryCampaignDeps {
  /** Pay a reward through the single shared cash balance. */
  addCash: (amount: number) => void;
  /** Read the single shared cash balance. */
  getCash: () => number;
  /**
   * Teleport the player (and the car, if driving) to a checkpoint.
   * The engine owns the player / vehicle handles and the mode.
   */
  teleport: (snap: {
    playerPos: { x: number; z: number };
    vehiclePos: { x: number; z: number } | null;
    driving: boolean;
    heading: number;
  }) => void;
  /**
   * Set the wanted heat directly (WS7). The engine guards it
   * with the player's wanted toggle, exactly like the dialogue
   * 'setWanted' event. Used by checkpoint restore (re-apply the
   * snapshot's wanted level) and by retry/replay (re-apply the
   * mission's startHeat, which the accept path would otherwise
   * never re-apply — the 2.4 busted-retry bypass).
   */
  setWanted: (heat: number) => void;
  /**
   * Open a dialogue (9C). Returns false when the dialogue
   * cannot start — the campaign then falls back to the 9B
   * behaviour (accept the mission, flash the one line).
   */
  openDialogue: (dialogueId: string) => boolean;
  /**
   * Play a cinematic (9D) before the dialogue. Returns false
   * when the cinematic cannot start — the campaign then falls
   * through to the dialogue. `onDone` fires when the cinematic
   * ends, complete or skipped; the campaign opens the dialogue
   * from it, so a skip never skips the conversation. `opts`
   * carries the owning mission id for the approved WS6
   * carve-out: a mission's own dialogue cinematic may play
   * while that mission is active (Lena's `talk-lena` only).
   */
  openCinematic: (
    cinematicId: string,
    onDone: () => void,
    opts?: { storyMissionId?: string },
  ) => boolean;
  /**
   * Combat system access (9E): the story's defeat/defend
   * objectives are evaluated against the live enemy system,
   * and the defense beacon is the contract objective's health.
   * The engine implements these from Enemies / Contracts.
   */
  combat: {
    /** Enemy ids belonging to an encounter (live state). */
    getEncounterEnemyIds: (encounterId: string) => string[];
    /** Spawn an encounter's enemies (dormant until activated). */
    activateEncounter: (encounterId: string) => void;
    /** Hide an encounter's enemies (they stop updating). */
    deactivateEncounter: (encounterId: string) => void;
    /** Revive an encounter's enemies to patrol / alive. */
    resetEncounter: (encounterId: string) => void;
    /** Enemies of this encounter attack this point (defense). */
    setObjective: (encounterId: string, x: number, z: number) => void;
    /** Clear an encounter's attack objective. */
    clearObjective: (encounterId: string) => void;
    /** The defense beacon's health, or null when there is none. */
    getObjectiveHealth: () => { health: number; max: number } | null;
    /** Restore the beacon to full health. */
    resetObjective: () => void;
  };
  /** The tail car for 2.1 (the story's own MissionVehicle
   * instance — a second one, so it never overlaps the job's). */
  followVehicle: MissionVehicleHandle;
  /**
   * Grant a car (9E): add it to the garage if not owned, then
   * select it. Returns the display name when newly granted,
   * null when already owned. Idempotent — replays never
   * duplicate the grant.
   */
  grantVehicle: (vehicleId: string) => string | null;
  /**
   * Grant an outfit (9E): ownership only, never auto-equipped.
   * Returns true when newly granted, false when already owned.
   */
  grantOutfit: (outfitId: string) => boolean;
  /** The selected garage car's id (for vehicleId objectives). */
  getSelectedVehicleId: () => string;
}

export interface StoryCampaignHandle {
  update: (dt: number, ctx: StoryContext) => void;
  /** Accept (E) at the marker — the dialogue/interact step. */
  tryInteract: () => boolean;
  /**
   * A dialogue objective finished (its end node fired
   * `completeObjective`): accept the mission, if it is still
   * the available one — or advance past a mid-mission dialogue
   * (9E), if it is the active run's current objective.
   * Idempotent — a second call is a no-op, because the state
   * has already flipped or the objective has already advanced.
   */
  onDialogueComplete: (objectiveId: string) => void;
  /**
   * An enemy was defeated (9E): the engine forwards its
   * onEnemyDefeated callback here. The id is recorded only
   * when the active run's current objective is a defeat (or
   * a defense wave) for that encounter.
   */
  onEnemyDefeated: (enemyId: string, encounterId: string) => void;
  /** The tail car's live position (null unless 2.1 is selected). */
  getTargetVehiclePos: () => { x: number; z: number; heading: number; speed: number } | null;
  /** Set a campaign flag and persist it (dialogue events). */
  setFlag: (flag: string, value: boolean) => void;
  /** Is this campaign flag set? (dialogue conditions.) */
  hasFlag: (flag: string) => boolean;
  cancel: () => void;
  retry: () => void;
  /** Restore the latest checkpoint (false when there is none). */
  retryFromCheckpoint: () => boolean;
  /** WS7: resume from the persisted checkpoint after a reload
   * (false when there is no usable snapshot). */
  restoreSavedCheckpoint: () => boolean;
  replay: () => void;
  continueAfterComplete: () => void;
  dismissFailed: () => void;
  getHudState: () => StoryHudState;
  /** Current objective, for the engine's cinematic carve-out
   * check (WS6). Undefined when no objective is current. */
  getCurrentObjective: () => StoryObjectiveDef | undefined;
  getSelectedDef: () => StoryMissionDef;
  selectMission: (id: string) => boolean;
  getBoardState: () => StoryBoardState;
  /** Fail the active mission (the engine calls this when downed). */
  failDowned: () => void;
  /** The global guard: blocked while another activity is active. */
  setBlocked: (blocked: boolean) => void;
  /** QA hook: set the remaining time (active runs only). */
  debugSetTimeLeft: (seconds: number) => void;
  /** QA hook: set how far the tail car has driven (2.1). */
  debugSetFollowTravelled: (units: number) => void;
  dispose: () => void;
}

const DEFEND_RECOVERY_SECONDS = 8; // breather between defense waves

const MARKER_COLOR = 0x2dd4bf; // teal — job missions are yellow
const MARKER_SATIN = 0x99f6e4;

/** The teal story marker: beam + ring + floating diamond, the
 * same shape as the job-mission marker, recoloured. */
function createStoryMarker(scene: THREE.Scene): {
  group: THREE.Group;
  diamond: THREE.Mesh;
  ring: THREE.Mesh;
} {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 1.5, 100, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: MARKER_COLOR,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = 50;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.6, 32),
    new THREE.MeshBasicMaterial({
      color: MARKER_COLOR,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.65),
    new THREE.MeshBasicMaterial({ color: MARKER_SATIN }),
  );
  diamond.position.y = 3.2;
  group.add(beam, ring, diamond);
  scene.add(group);
  return { group, diamond, ring };
}

/** A collectible prop: a small glowing case on a ground ring. */
function createCollectProp(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  const caseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.32, 0.38),
    new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.85,
      metalness: 0.3,
      roughness: 0.4,
    }),
  );
  caseMesh.position.y = 0.16;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.95, 24),
    new THREE.MeshBasicMaterial({
      color: MARKER_COLOR,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(caseMesh, ring);
  scene.add(group);
  return group;
}

export function createStoryCampaign(
  scene: THREE.Scene,
  deps: StoryCampaignDeps,
): StoryCampaignHandle {
  let progress: StoryProgress = loadStoryProgress();
  let def: StoryMissionDef = STORY_MISSIONS[0];
  let state: StoryRuntimeState = 'idle';
  let objectiveIndex = 0;
  let timeLeft = 0;
  let runTime = 0;
  let flash: { text: string; at: number } | null = null;
  let failedReason: StoryFailReason = null;
  let blocked = false;
  /** Collect ids done in this run (main + optional). */
  const collectedIds = new Set<string>();
  /** Defeated enemy ids in this run (for 'defeat', 9E). */
  const defeatedIds = new Set<string>();
  /** Optional objective ids done in this run. */
  const optionalDoneRun = new Set<string>();
  /** Dialogue objectives whose cinematic already played in
   * this run — the intro plays on first accept only, like the
   * dialogue (a retry restarts past the accept step anyway). */
  const cinematicPlayedRun = new Set<string>();
  /** Defense wave machine (9E): which wave is being fought,
   * whether it is fighting or in the 8 s recovery, and how
   * much recovery is left. */
  let defendWave = 0;
  let defendWaveState: 'fighting' | 'recovery' = 'fighting';
  let defendRecoveryLeft = 0;
  /** Follow scratch (9E): the tail's band timers, owned here
   * and reset when the follow objective starts. */
  let followScratch: FollowScratch = createFollowScratch();
  /** The objective id the run last entered — the enter hook
   * (combat activation, tail start) runs once per objective. */
  let enteredObjectiveId = '';
  /** Latest checkpoint snapshot, or null. */
  let checkpoint: StoryCheckpoint | null = null;
  /** Campaign flags as they stood when this run started. */
  let flagsAtStart: Record<string, boolean> = { ...progress.flags };
  /** The most recent context, so tryInteract can check distance
   * without a per-frame argument (same pattern as the mission
   * manager). */
  let lastCtx: StoryContext | null = null;

  // --- The marker, and the collect props for the current mission.
  const marker = createStoryMarker(scene);
  let collectProps = new Map<string, THREE.Group>();

  const clearCollectProps = (): void => {
    for (const g of collectProps.values()) {
      scene.remove(g);
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    collectProps = new Map();
  };

  /** Build one prop per collect objective (main + optional). */
  const rebuildCollectProps = (): void => {
    clearCollectProps();
    const all = [...def.objectives, ...(def.optional ?? [])];
    for (const obj of all) {
      if (obj.type !== 'collect') continue;
      const prop = createCollectProp(scene);
      prop.position.set(obj.target.x, 0, obj.target.z);
      prop.visible = false;
      collectProps.set(obj.id, prop);
    }
  };

  /** Tear down every combat objective of the current mission:
   * deactivate + reset its encounters, clear the defense
   * beacon and its attack objectives, stop the tail car, and
   * reset the wave machine and follow scratch. Called on
   * cancel / retry / replay / complete / fail, and before a
   * checkpoint restore re-enters the current objective fresh.
   * Enemies of already-finished groups stay deactivated — the
   * run only ever evaluates the current objective. */
  const resetCombatState = (): void => {
    for (const obj of def.objectives) {
      if (obj.type === 'defeat' && obj.encounterId) {
        deps.combat.deactivateEncounter(obj.encounterId);
        deps.combat.resetEncounter(obj.encounterId);
      }
      if (obj.type === 'defend' && obj.waves) {
        for (const waveId of obj.waves) {
          deps.combat.deactivateEncounter(waveId);
          deps.combat.resetEncounter(waveId);
          deps.combat.clearObjective(waveId);
        }
        deps.combat.resetObjective();
      }
    }
    defendWave = 0;
    defendWaveState = 'fighting';
    defendRecoveryLeft = 0;
    followScratch = createFollowScratch();
    deps.followVehicle.stop();
  };

  /** Start one defense wave: fresh enemies, attacking the beacon. */
  const startDefendWave = (index: number): void => {
    const obj = currentObjective();
    if (!obj || obj.type !== 'defend' || !obj.waves || !obj.objective) return;
    const waveId = obj.waves[index];
    if (!waveId) return;
    deps.combat.resetEncounter(waveId);
    deps.combat.setObjective(waveId, obj.objective.x, obj.objective.z);
    deps.combat.activateEncounter(waveId);
    defendWaveState = 'fighting';
  };

  /** Run once when an objective becomes current: activate its
   * combat, or start its tail. Other types need no setup. */
  const enterObjective = (obj: StoryObjectiveDef): void => {
    if (obj.type === 'defeat' && obj.encounterId) {
      deps.combat.resetEncounter(obj.encounterId);
      deps.combat.activateEncounter(obj.encounterId);
    } else if (obj.type === 'defend' && obj.waves && obj.objective) {
      defendWave = 0;
      defendWaveState = 'fighting';
      defendRecoveryLeft = 0;
      deps.combat.resetObjective();
      startDefendWave(0);
    } else if (obj.type === 'follow') {
      followScratch = createFollowScratch();
      deps.followVehicle.reset();
      deps.followVehicle.start();
    }
  };

  const setFlash = (text: string): void => {
    flash = { text, at: performance.now() };
  };

  /** The current main objective, or undefined past the end. */
  const currentObjective = () => def.objectives[objectiveIndex];

  /** Position the marker at the current objective's target. */
  const placeMarker = (): void => {
    const obj = currentObjective();
    if (obj && state !== 'complete' && state !== 'failed') {
      marker.group.position.set(obj.target.x, 0, obj.target.z);
      marker.group.visible = true;
    } else {
      marker.group.visible = false;
    }
  };

  /** Which collect props are visible right now. Only while the
   * mission is active — a prop must not be collectible before
   * the run starts. */
  const updateCollectProps = (): void => {
    for (const [id, prop] of collectProps) {
      const isCurrentMain =
        currentObjective()?.type === 'collect' &&
        currentObjective()?.id === id;
      const isOptionalPending =
        (def.optional ?? []).some((o) => o.id === id) &&
        !optionalDoneRun.has(id);
      prop.visible =
        state === 'active' &&
        (isCurrentMain || isOptionalPending) &&
        !collectedIds.has(id);
    }
  };

  /** Reset the run to the mission's start (retry / replay). */
  const resetRun = (): void => {
    objectiveIndex = 0;
    timeLeft = def.timeLimit;
    runTime = 0;
    flash = null;
    failedReason = null;
    collectedIds.clear();
    defeatedIds.clear();
    optionalDoneRun.clear();
    cinematicPlayedRun.clear();
    enteredObjectiveId = '';
    checkpoint = null;
    flagsAtStart = { ...progress.flags };
    resetCombatState();
    placeMarker();
    updateCollectProps();
  };

  /** Take a checkpoint snapshot from the live run state. While
   * driving, the player handle's position is stale — it stays
   * where the player entered the car — so the snapshot's player
   * position is the vehicle's position: the player rides in
   * the car, and the retry must put them back in it, at the
   * checkpoint, not at the spot they got in. The heading, too,
   * is the car's heading while driving: camYaw does not track
   * the car's facing (it read 0 while the car faced north),
   * and snapshotting it sent the retry driving south. */
  const snapshotCheckpoint = (ctx: StoryContext): void => {
    const pos = ctx.driving
      ? { x: ctx.vehiclePos.x, z: ctx.vehiclePos.z }
      : { x: ctx.playerPos.x, z: ctx.playerPos.z };
    const heading = ctx.driving ? ctx.vehicleHeading : ctx.camYaw;
    checkpoint = takeCheckpoint(
      def.id,
      objectiveIndex,
      pos,
      heading,
      ctx.driving,
      ctx.driving
        ? { x: ctx.vehiclePos.x, z: ctx.vehiclePos.z }
        : null,
      ctx.driving ? ctx.vehicleHeading : null,
      timeLeft,
      collectedIds,
      defeatedIds,
      progress.flags,
      ctx.wantedLevel,
      runTime,
      // WS7 fix (2026-11-24): a checkpoint taken while replaying an
      // already-completed mission must restore after a reload —
      // without the flag the restore guard below refused it as a
      // stale snapshot for a finished mission.
      progress.missions[def.id]?.completed === true,
    );
    // WS7: persist the snapshot so a reload mid-mission resumes
    // here. One write, on the story save's single write path —
    // old saves (no checkpoint field) are unaffected.
    progress.checkpoint = checkpoint;
    saveStoryProgress(progress);
  };

  /** Advance past the current objective, taking a checkpoint if
   * it is marked as one. The snapshot is taken AFTER the index
   * advances, so the restore point is the NEXT objective — if
   * it were taken before, retrying would land the player on the
   * checkpoint objective itself, re-complete it, and grant the
   * time bonus a second time. Returns false when the objective
   * list is exhausted (the mission is done). */
  const advanceObjective = (ctx: StoryContext): boolean => {
    const obj = currentObjective();
    const isCheckpoint = obj?.checkpoint === true;
    objectiveIndex += 1;
    if (isCheckpoint) {
      snapshotCheckpoint(ctx);
      // Checkpoints with a time bonus already flash the bonus;
      // the rest get a plain saved notice, so the player knows
      // the retry point moved (9F M4).
      if (obj.timeBonus === undefined) setFlash('CHECKPOINT SAVED');
    }
    if (objectiveIndex >= def.objectives.length) {
      complete();
      return false;
    }
    placeMarker();
    return true;
  };

  /** Complete the mission. Guarded: only an active run can
   * complete, and the state flips BEFORE the reward is paid,
   * so a second call is a no-op and retry can never re-pay. */
  const complete = (): void => {
    if (state !== 'active') return;
    state = 'complete';
    failedReason = null;
    timeLeft = 0;
    flash = null;
    deps.addCash(def.reward);
    // Grants (9E): deterministic rewards, applied at complete
    // so a skipped cinematic or dialogue can never lose them.
    // Idempotent — the engine no-ops when already owned, so
    // replays never duplicate them.
    const vehicleName = def.grantsVehicle
      ? deps.grantVehicle(def.grantsVehicle)
      : null;
    if (vehicleName) setFlash(`${vehicleName.toUpperCase()} UNLOCKED`);
    if (def.grantsOutfit && deps.grantOutfit(def.grantsOutfit)) {
      setFlash('CREW JACKET UNLOCKED — wear it from the Outfits panel');
    }
    const rec = progress.missions[def.id] ?? {
      completed: false,
      optionalDone: [],
      bestTime: null,
    };
    rec.completed = true;
    if (rec.bestTime === null || runTime < rec.bestTime) {
      rec.bestTime = runTime;
    }
    progress.missions[def.id] = rec;
    for (const flag of def.setsFlags ?? []) progress.flags[flag] = true;
    // The finale choice sets exactly one ending flag; the
    // surviving flag is the ending. A replay can change it.
    if (progress.flags['ending-mara'] === true) progress.ending = 'mara';
    else if (progress.flags['ending-june'] === true) progress.ending = 'june';
    // Chapter completion + unlock the next chapter.
    const chapter = storyChapterById(def.chapterId);
    if (chapter) {
      const allDone = chapter.missions.every(
        (m) => progress.missions[m.id]?.completed === true,
      );
      if (allDone) {
        progress.chapters[def.chapterId] = {
          unlocked: true,
          completed: true,
        };
        const idx = STORY_MISSIONS.findIndex((m) => m.id === def.id);
        const next = STORY_MISSIONS[idx + 1];
        if (next && next.chapterId !== def.chapterId) {
          progress.chapters[next.chapterId] = {
            unlocked: true,
            completed: false,
          };
        }
      }
    }
    // WS7: the run is over — the persisted checkpoint must not
    // survive it, or a later reload would resurrect this run.
    progress.checkpoint = null;
    saveStoryProgress(progress);
    resetCombatState();
    marker.group.visible = false;
    for (const prop of collectProps.values()) prop.visible = false;
  };

  const fail = (reason: StoryFailReason): void => {
    if (state !== 'active') return;
    state = 'failed';
    failedReason = reason;
    flash = null;
    resetCombatState();
    marker.group.visible = false;
    for (const prop of collectProps.values()) prop.visible = false;
    // WS7: the persisted checkpoint is deliberately NOT cleared
    // here. The fail screen offers retry-from-checkpoint, and a
    // reload from that screen must still resume at the
    // checkpoint. Every exit from 'failed' (retry / replay /
    // dismissFailed / selectMission) clears it instead.
  };

  /** Restore a checkpoint: state, objective, timer, collected
   * items, flags, wanted level and position — but never the
   * reward. The combat state is torn down first, then the current
   * objective re-enters fresh on the next tick (its encounter
   * re-activates; earlier groups stay deactivated).
   *
   * WS7: the wanted level is restored from the snapshot, not
   * left at whatever the live heat happens to be. Without this,
   * a 2.4 retry after getting busted would land on the evade
   * objective with heat already 0 (the engine resets heat on
   * 'busted') and complete instantly — the same bypass the
   * persisted resume would have had. The snapshot's level is
   * the checkpoint's truth, in-session and after a reload.
   * runTime is likewise restored, so bestTime still covers the
   * whole run after a checkpoint retry. */
  const restoreCheckpoint = (): boolean => {
    if (!isCheckpointValid(checkpoint, def.objectives.length)) return false;
    const snap = checkpoint as StoryCheckpoint;
    objectiveIndex = snap.objectiveIndex;
    timeLeft = snap.timeLeft;
    runTime = snap.runTime;
    flash = null;
    failedReason = null;
    collectedIds.clear();
    for (const id of snap.collectedIds) collectedIds.add(id);
    defeatedIds.clear();
    for (const id of snap.defeatedIds) defeatedIds.add(id);
    progress.flags = { ...snap.flags };
    deps.setWanted(heatForWantedLevel(snap.wantedLevel));
    // Props for already-collected items stay hidden; the rest
    // come back.
    updateCollectProps();
    resetCombatState();
    // The re-entry hook in the update loop only fires when the
    // objective id changes, so a retry to the SAME objective
    // must clear the tracker — otherwise the current objective
    // never re-enters and its encounter stays deactivated
    // (3.2 CRANE'S NEST: nest-b could never be damaged after a
    // checkpoint retry). The next tick re-enters the restored
    // objective fresh; earlier groups stay deactivated.
    enteredObjectiveId = '';
    // The engine moves the player (and the car, if driving).
    deps.teleport({
      playerPos: snap.playerPos,
      vehiclePos: snap.vehiclePos,
      driving: snap.driving,
      heading: snap.playerHeading,
    });
    state = 'active';
    placeMarker();
    return true;
  };

  const isAvailable = (): boolean => state === 'available';

  /** Accept the mission: the run starts here. The state flips
   * before any side effect, so a double-press cannot
   * double-start — and a second onDialogueComplete is a no-op
   * for the same reason. */
  const acceptMission = (): void => {
    state = 'active';
    timeLeft = def.timeLimit;
    runTime = 0;
    flagsAtStart = { ...progress.flags };
    objectiveIndex += 1;
    // WS7: a fresh run starts here — any persisted checkpoint
    // from an earlier run must not survive it (the boundaries
    // should already have cleared it; this is the backstop).
    progress.checkpoint = null;
    saveStoryProgress(progress);
    placeMarker();
  };

  /**
   * Open a dialogue objective — accept step or mid-mission
   * (9E). A cinematic objective plays its intro first (9D),
   * once per run. When it ends — complete or skipped — the
   * dialogue opens from its completion callback, so a skip
   * never skips the conversation (or the accept). If the
   * cinematic cannot start, fall through to the dialogue.
   * The callback re-checks the run is still at this objective:
   * a Pattern B cinematic opens its embedded dialogue during
   * the scene, and when that dialogue completes the objective
   * (the finale), nothing must open a second time.
   */
  const openMissionDialogue = (obj: StoryObjectiveDef): boolean => {
    if (obj.dialogueId && obj.cinematicId && !cinematicPlayedRun.has(obj.id)) {
      cinematicPlayedRun.add(obj.id);
      const dialogueId = obj.dialogueId;
      const line = obj.line;
      const objectiveId = obj.id;
      if (
        deps.openCinematic(
          obj.cinematicId,
          () => {
            const current = currentObjective();
            if (!current || current.type !== 'dialogue' || current.id !== objectiveId)
              return;
            if (state !== 'available' && state !== 'active') return;
            if (!deps.openDialogue(dialogueId)) {
              if (state === 'available') {
                acceptMission();
                if (line) setFlash(line);
              }
            }
          },
          // Approved WS6 carve-out: this mission's own dialogue
          // cinematic may play while the mission is active.
          { storyMissionId: def.id },
        )
      ) {
        return true;
      }
    }
    if (obj.dialogueId && deps.openDialogue(obj.dialogueId)) return true;
    // The dialogue could not start. The accept flow falls back
    // to the 9B behaviour (accept now, flash the one line); a
    // mid-mission dialogue just stays open for another press.
    if (state === 'available') {
      acceptMission();
      if (obj.line) setFlash(obj.line);
      return true;
    }
    return false;
  };

  const buildState = (): StoryHudState => {
    const obj = state === 'available' || state === 'active' ? currentObjective() : undefined;
    const chapter = storyChapterById(def.chapterId);
    // Distance + arrow bearing to the current objective, from the
    // last context (same as the job-mission HUD). A follow
    // objective points at the tail car, not at its destination.
    let distance: number | null = null;
    let bearing: number | null = null;
    if (obj && lastCtx) {
      const px = lastCtx.driving ? lastCtx.vehiclePos.x : lastCtx.playerPos.x;
      const pz = lastCtx.driving ? lastCtx.vehiclePos.z : lastCtx.playerPos.z;
      let tx = obj.target.x;
      let tz = obj.target.z;
      if (obj.type === 'follow') {
        const car = deps.followVehicle.getState();
        tx = car.x;
        tz = car.z;
      }
      distance = Math.hypot(tx - px, tz - pz);
      const dx = tx - px;
      const dz = tz - pz;
      let b = lastCtx.camYaw + Math.PI - Math.atan2(dx, dz);
      while (b > Math.PI) b -= Math.PI * 2;
      while (b < -Math.PI) b += Math.PI * 2;
      bearing = b;
      // 3.1's distance gating (9E): without the tip, the HUD
      // names the neighbourhood and hides the distance.
      if (obj.distanceGatedByFlag && !progress.flags[obj.distanceGatedByFlag]) {
        distance = null;
        bearing = null;
      }
    }
    let hint: string | null = null;
    if (state === 'active' && obj?.type === 'evade' && lastCtx) {
      hint =
        lastCtx.wantedLevel > 0
          ? `Wanted level ${lastCtx.wantedLevel} — break line of sight to lose the tail`
          : 'The heat is off — hold on';
    }
    if (state === 'active' && obj?.type === 'defeat' && obj.encounterId) {
      const ids = deps.combat.getEncounterEnemyIds(obj.encounterId);
      hint = `Hostiles down: ${countDefeated(defeatedIds, ids)}/${obj.count ?? ids.length}`;
    }
    if (state === 'active' && obj?.type === 'defend' && obj.waves) {
      const health = deps.combat.getObjectiveHealth();
      if (health) {
        hint =
          defendWaveState === 'recovery'
            ? `Beacon ${health.health}/${health.max} · Next wave in ${Math.ceil(defendRecoveryLeft)}s`
            : `Beacon ${health.health}/${health.max} · Wave ${defendWave + 1}/${obj.waves.length}`;
      }
    }
    if (state === 'active' && obj?.type === 'follow' && obj.follow) {
      hint = `Stay ${obj.follow.minDist}–${obj.follow.maxDist}m behind the sedan — too close and he spots you, too far and you lose him`;
    }
    if (blocked && (state === 'available' || state === 'active')) {
      hint = 'Finish your current job or contract first';
    }
    // The E prompt: the accept step, or a mid-mission dialogue
    // the player is standing next to (9E).
    const nearDialogue =
      state === 'active' &&
      obj?.type === 'dialogue' &&
      !obj.accept &&
      lastCtx !== null &&
      !lastCtx.driving &&
      lastCtx.arrestState !== 'busted' &&
      distanceTo(obj.target, lastCtx) <= obj.radius + 0.6;
    return {
      state,
      missionId: def.id,
      chapterId: def.chapterId,
      chapterTitle: chapter?.title ?? '',
      title: def.title,
      description: def.description,
      giver: def.giver,
      objectiveText: obj ? obj.text : '',
      objectiveIndex,
      objectiveCount: def.objectives.length,
      distance: distance === null ? null : Math.round(distance),
      bearing,
      timeLeft:
        state === 'active' && def.timeLimit > 0
          ? Math.max(0, Math.ceil(timeLeft))
          : null,
      timeLimit: def.timeLimit,
      cash: deps.getCash(),
      reward: def.reward,
      flash,
      failedReason,
      prompt:
        !blocked &&
        ((state === 'available' &&
          (obj?.type === 'interact' || obj?.type === 'dialogue')) ||
          nearDialogue)
          ? 'accept'
          : null,
      promptLabel:
        state === 'available' &&
        (obj?.type === 'interact' || obj?.type === 'dialogue')
          ? `Start ${def.title}`
          : nearDialogue && obj
            ? obj.text
            : null,
      marker:
        state === 'available' || state === 'active'
          ? { x: def.startMarker.x, z: def.startMarker.z }
          : null,
      hint,
      optional: (def.optional ?? []).map((o) => ({
        id: o.id,
        text: o.text,
        done: optionalDoneRun.has(o.id),
      })),
      hasCheckpoint: checkpoint !== null,
      blocked,
      outroCinematicId:
        state === 'complete'
          ? def.outroCinematicIds
            ? progress.ending === 'june'
              ? def.outroCinematicIds.june
              : def.outroCinematicIds.mara
            : (def.outroCinematicId ?? null)
          : null,
      ending: progress.ending,
    };
  };

  // The mission the progress points at is the selected one.
  const initial = progress.current?.missionId
    ? storyMissionById(progress.current.missionId)
    : undefined;
  if (initial) def = initial;
  // The tail car is visible only while 2.1 is selected.
  deps.followVehicle.reset();
  deps.followVehicle.setVisible(def.id === 'story-tail-spin');
  rebuildCollectProps();
  placeMarker();

  return {
    update(dt: number, ctx: StoryContext): void {
      lastCtx = ctx;
      // Discovery: walking within range of the start marker
      // makes the mission available (the story marker is the
      // teal one; the job marker is a separate, yellow one).
      if (state === 'idle') {
        const dist = Math.hypot(
          ctx.playerPos.x - def.startMarker.x,
          ctx.playerPos.z - def.startMarker.z,
        );
        if (
          dist <= def.discoveryRadius &&
          isStoryMissionUnlocked(def.id, progress)
        ) {
          state = 'available';
          objectiveIndex = 0;
          placeMarker();
        }
      }

      // In the available state, a 'reach' first objective
      // completes on proximity (the player walked to the giver).
      if (state === 'available') {
        const obj = currentObjective();
        if (obj?.type === 'reach') {
          if (
            evaluateTrigger(
              'reach',
              obj.target,
              obj.radius,
              ctx,
            )
          ) {
            objectiveIndex += 1;
            placeMarker();
          }
        }
      }

      if (state !== 'active') return;

      runTime += dt;

      // Failure: the timer, an arrest, or going down.
      if (def.timeLimit > 0) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
          timeLeft = 0;
          fail('timer');
          return;
        }
      }
      if (ctx.arrestState === 'busted') {
        fail('busted');
        return;
      }
      if (ctx.downed) {
        fail('downed');
        return;
      }

      // Objective-enter hook (9E): the first tick on a new
      // objective starts its combat or its tail.
      const obj = currentObjective();
      if (!obj) {
        complete();
        return;
      }
      if (obj.id !== enteredObjectiveId) {
        enteredObjectiveId = obj.id;
        enterObjective(obj);
      }

      // An 'interact' / accept-'dialogue' objective is already
      // accepted (tryInteract advanced past it); a retry
      // restarts at the reach objective, so skip past the
      // accept step here. Mid-mission dialogues (9E, no
      // `accept`) are NOT skipped — the player talks to the
      // character again, via E.
      if (
        (obj.type === 'interact' || obj.type === 'dialogue') &&
        obj.accept === true
      ) {
        objectiveIndex += 1;
        placeMarker();
        return;
      }

      // The tail car drives only while its objective is current;
      // the marker tracks the car, not the destination.
      if (obj.type === 'follow') {
        deps.followVehicle.update(dt, ctx.avenueGreen);
        const car = deps.followVehicle.getState();
        marker.group.position.set(car.x, 0, car.z);
        marker.group.visible = true;
      }

      // Optional objectives run in parallel and never block
      // completion. Each pays its bonus once per save.
      for (const opt of def.optional ?? []) {
        if (optionalDoneRun.has(opt.id)) continue;
        if (opt.type === 'collect') {
          if (
            evaluateCollect(
              opt.id,
              opt.target,
              opt.radius,
              collectedIds,
              ctx,
            )
          ) {
            collectedIds.add(opt.id);
            optionalDoneRun.add(opt.id);
            const rec = progress.missions[def.id] ?? {
              completed: false,
              optionalDone: [],
              bestTime: null,
            };
            if (!rec.optionalDone.includes(opt.id)) {
              rec.optionalDone.push(opt.id);
              deps.addCash(def.optionalReward ?? 0);
              saveStoryProgress(progress);
            }
            if (opt.flashText) setFlash(opt.flashText);
          }
        }
      }

      // The current main objective.
      if (obj.type === 'collect') {
        if (
          evaluateCollect(obj.id, obj.target, obj.radius, collectedIds, ctx)
        ) {
          collectedIds.add(obj.id);
          if (obj.flashText) setFlash(obj.flashText);
          advanceObjective(ctx);
        }
      } else if (obj.type === 'defeat' && obj.encounterId) {
        // 9E: the count comes from the enemy callbacks — the
        // engine forwards each defeat to onEnemyDefeated, and
        // the ids come from the live enemy state. An empty id
        // list means the encounter has not spawned yet: never
        // advance on it.
        const ids = deps.combat.getEncounterEnemyIds(obj.encounterId);
        if (
          ids.length > 0 &&
          evaluateDefeat(obj.count ?? ids.length, defeatedIds, ids)
        ) {
          advanceObjective(ctx);
        }
      } else if (obj.type === 'defend' && obj.objective && obj.waves) {
        // 9E: the wave machine. The beacon's health is the
        // contract objective's health; a wave clears when every
        // enemy of its encounter is defeated, then an 8 s
        // recovery runs before the next wave.
        const health = deps.combat.getObjectiveHealth();
        if (health && health.health <= 0) {
          fail('objective-destroyed');
          return;
        }
        if (defendWaveState === 'recovery') {
          defendRecoveryLeft -= dt;
          if (defendRecoveryLeft <= 0) {
            defendWave += 1;
            startDefendWave(defendWave);
          }
        } else {
          const waveId = obj.waves[defendWave];
          const ids = waveId
            ? deps.combat.getEncounterEnemyIds(waveId)
            : [];
          if (
            waveId &&
            ids.length > 0 &&
            evaluateDefeat(ids.length, defeatedIds, ids)
          ) {
            if (defendWave >= obj.waves.length - 1) {
              advanceObjective(ctx);
            } else {
              defendWaveState = 'recovery';
              defendRecoveryLeft = DEFEND_RECOVERY_SECONDS;
              setFlash(`WAVE ${defendWave + 1} CLEAR — next wave incoming`);
            }
          }
        }
      } else if (obj.type === 'follow' && obj.follow) {
        // 9E: the tail, evaluated against the story car's live
        // position and travelled distance (same helper as the
        // job mission's tail).
        const car = deps.followVehicle.getState();
        const result = evaluateFollow(
          obj.follow,
          { x: car.x, z: car.z },
          car.travelled,
          ctx,
          followScratch,
          dt,
        );
        if (result.status === 'done') {
          deps.followVehicle.stop();
          advanceObjective(ctx);
        } else if (result.status === 'failed') {
          deps.followVehicle.stop();
          fail(result.reason);
          return;
        }
      } else if (obj.type === 'enterVehicle') {
        // 9E: a vehicleId objective only counts in the named car.
        const ok =
          evaluateTrigger(obj.type, obj.target, obj.radius, ctx) &&
          (!obj.vehicleId || deps.getSelectedVehicleId() === obj.vehicleId);
        if (ok) advanceObjective(ctx);
      } else if (
        obj.type === 'reach' ||
        obj.type === 'checkpoint' ||
        obj.type === 'deliver' ||
        obj.type === 'evade'
      ) {
        if (evaluateTrigger(obj.type, obj.target, obj.radius, ctx)) {
          if (obj.type === 'checkpoint' && obj.timeBonus) {
            timeLeft += obj.timeBonus;
            setFlash(`CHECKPOINT +${obj.timeBonus}s`);
          }
          advanceObjective(ctx);
        }
      }
      // 'dialogue' (mid-mission, 9E) is completed by
      // onDialogueComplete, never by polling — like 'interact'.

      updateCollectProps();
      // The marker diamond bobs and spins, as on the job marker.
      marker.diamond.position.y =
        3.2 + Math.sin(performance.now() / 350) * 0.18;
      marker.diamond.rotation.y = performance.now() / 600;
    },

    tryInteract(): boolean {
      const obj = currentObjective();
      if (!obj) return false;
      if (blocked) return false;
      if (!lastCtx) return false;
      if (lastCtx.arrestState === 'busted') return false;
      if (lastCtx.driving) return false;
      if (distanceTo(obj.target, lastCtx) > obj.radius + 0.6) return false;
      // Mid-mission dialogue (9E): the player talks to a
      // character again while the run is active. The accept
      // flag distinguishes it from the accept step.
      if (state === 'active' && obj.type === 'dialogue' && !obj.accept) {
        return openMissionDialogue(obj);
      }
      if (!isAvailable()) return false;
      if (obj?.type !== 'interact' && obj?.type !== 'dialogue') return false;
      // A dialogue objective opens the conversation (9C) — the
      // mission accepts only when the dialogue's end node fires
      // `completeObjective`. If the dialogue cannot start
      // (missing id, bad data), fall back to the 9B behaviour:
      // accept now and flash the one line.
      if (obj.type === 'dialogue' && obj.dialogueId) {
        return openMissionDialogue(obj);
      }
      acceptMission();
      return true;
    },

    cancel(): void {
      if (state !== 'active') return;
      state = 'available';
      objectiveIndex = 0;
      timeLeft = def.timeLimit;
      runTime = 0;
      collectedIds.clear();
      defeatedIds.clear();
      optionalDoneRun.clear();
      cinematicPlayedRun.clear();
      enteredObjectiveId = '';
      checkpoint = null;
      // WS7: abandoning the run clears the persisted checkpoint.
      progress.checkpoint = null;
      saveStoryProgress(progress);
      resetCombatState();
      placeMarker();
    },

    retry(): void {
      // Restart from the beginning. No reward is paid here —
      // only complete() pays, and only once per run.
      progress.flags = { ...flagsAtStart };
      state = 'active';
      resetRun();
      // WS7: a fresh run starts here — clear the persisted
      // checkpoint, and re-apply the mission's startHeat. The
      // update loop skips the accept dialogue on a retry, so the
      // accept path would otherwise never re-apply it: a 2.4
      // retry after getting busted would otherwise reach the
      // evade objective with heat 0 and complete instantly.
      progress.checkpoint = null;
      saveStoryProgress(progress);
      if (def.startHeat !== undefined) deps.setWanted(def.startHeat);
    },

    retryFromCheckpoint(): boolean {
      if (!checkpoint) return false;
      return restoreCheckpoint();
    },

    /**
     * WS7: resume a run from the persisted checkpoint after a
     * reload. Called once by the engine after the player enters
     * the world. Returns false (and leaves everything exactly
     * as a fresh boot) when there is no usable snapshot: the
     * mission then starts at objective 0, as it always has.
     * A snapshot that fails validation is cleared from the save
     * so a corrupt snapshot is not retried on every boot.
     * Never resumes mid-cinematic or mid-dialogue: snapshots
     * are only ever taken at objective boundaries, and the
     * restored objective is never an accept dialogue.
     */
    restoreSavedCheckpoint(): boolean {
      if (state !== 'idle') return false;
      const snap = progress.checkpoint;
      if (!snap) return false;
      const failClosed = (): boolean => {
        progress.checkpoint = null;
        saveStoryProgress(progress);
        return false;
      };
      const missionDef = storyMissionById(snap.missionId);
      if (!missionDef) return failClosed();
      if (!isCheckpointValid(snap, missionDef.objectives.length))
        return failClosed();
      // The snapshot must belong to the mission the save says is
      // current, and that mission must not already be complete —
      // unless the snapshot was taken during a replay of it
      // (WS7 fix, 2026-11-24: a replayed run's checkpoint was
      // refused and deleted on reload because the mission read
      // completed, so replays never resumed mid-run).
      if (progress.current?.missionId !== snap.missionId) return failClosed();
      if (
        progress.missions[snap.missionId]?.completed === true &&
        snap.replay !== true
      )
        return failClosed();
      // The restored objective must not be an accept dialogue:
      // the accept step is past by construction, and resuming
      // onto it would re-run the accept (and its startHeat).
      const target = missionDef.objectives[snap.objectiveIndex];
      if (
        target &&
        (target.type === 'dialogue' || target.type === 'interact') &&
        target.accept === true
      )
        return failClosed();
      // Invariant (verified 2026-11-23): no mid-mission dialogue
      // contains a giveCash event — the only one is Rook's k3a
      // node in 2.3's accept dialogue, and 2.3 has no checkpoint.
      // If a future mission adds one, this restore must refuse
      // snapshots landing on that dialogue.
      if (def.id !== snap.missionId) def = missionDef;
      // WS7 FIX (verified 2026-11-24): restoreCheckpoint() reads
      // the LIVE in-session checkpoint, which is null on a fresh
      // boot — without this assignment every persisted resume
      // failed validation here and failClosed() DELETED the
      // snapshot it was supposed to restore. The persisted
      // snapshot becomes the live checkpoint first.
      checkpoint = snap;
      const ok = restoreCheckpoint();
      if (!ok) return failClosed();
      setFlash('CHECKPOINT RESTORED');
      return true;
    },

    replay(): void {
      if (state !== 'complete' && state !== 'failed') return;
      state = 'active';
      resetRun();
      // WS7: same as retry() — a fresh run, so clear the
      // persisted checkpoint and re-apply the startHeat.
      progress.checkpoint = null;
      saveStoryProgress(progress);
      if (def.startHeat !== undefined) deps.setWanted(def.startHeat);
    },

    continueAfterComplete(): void {
      if (state !== 'complete') return;
      state = 'available';
      objectiveIndex = 0;
      timeLeft = def.timeLimit;
      enteredObjectiveId = '';
      cinematicPlayedRun.clear();
      // WS7: leaving the complete screen ends the run.
      progress.checkpoint = null;
      saveStoryProgress(progress);
      placeMarker();
    },

    dismissFailed(): void {
      if (state !== 'failed') return;
      state = 'available';
      objectiveIndex = 0;
      timeLeft = def.timeLimit;
      collectedIds.clear();
      defeatedIds.clear();
      optionalDoneRun.clear();
      cinematicPlayedRun.clear();
      enteredObjectiveId = '';
      // WS7: closing the fail screen without retrying ends the
      // run — the persisted checkpoint goes with it.
      progress.checkpoint = null;
      saveStoryProgress(progress);
      resetCombatState();
      placeMarker();
    },

    getHudState: buildState,

    getCurrentObjective: () => currentObjective(),

    getSelectedDef: () => def,

    selectMission(id: string): boolean {
      const next = storyMissionById(id);
      if (!next) return false;
      if (state === 'active') return false;
      if (!isStoryMissionUnlocked(id, progress)) return false;
      def = next;
      progress.current = { chapterId: def.chapterId, missionId: def.id };
      // WS7: picking another mission ends any run — its
      // persisted checkpoint goes with it.
      progress.checkpoint = null;
      saveStoryProgress(progress);
      state = 'idle';
      objectiveIndex = 0;
      timeLeft = def.timeLimit;
      flash = null;
      failedReason = null;
      collectedIds.clear();
      defeatedIds.clear();
      optionalDoneRun.clear();
      cinematicPlayedRun.clear();
      enteredObjectiveId = '';
      checkpoint = null;
      resetCombatState();
      deps.followVehicle.reset();
      deps.followVehicle.setVisible(def.id === 'story-tail-spin');
      rebuildCollectProps();
      placeMarker();
      return true;
    },

    getBoardState: () =>
      buildStoryBoardState(
        progress,
        deps.getCash(),
        state === 'active' ? def.id : null,
        blocked,
      ),

    failDowned(): void {
      fail('downed');
    },

    onDialogueComplete(objectiveId: string): void {
      // Accept flow: only the available run's current dialogue
      // objective can complete this way. After the accept the
      // state is 'active', so a second event — a replayed node,
      // a double skip — is a no-op. A dialogue for another
      // objective (or a free-roam conversation, later)
      // completes nothing here.
      if (state === 'available') {
        const obj = currentObjective();
        if (obj?.type !== 'dialogue' || obj.id !== objectiveId) return;
        acceptMission();
        return;
      }
      // Mid-mission dialogue (9E): advance past the objective.
      // Guarded the same way — the run must still be active at
      // that dialogue — so a replayed node or a double skip is
      // a no-op. Mid-mission dialogues are never checkpoint
      // objectives, so advancing with the last context is safe.
      if (state === 'active') {
        const obj = currentObjective();
        if (obj?.type !== 'dialogue' || obj.id !== objectiveId) return;
        if (lastCtx) advanceObjective(lastCtx);
      }
    },

    onEnemyDefeated(enemyId: string, encounterId: string): void {
      // Only the active run's current defeat / defense
      // objective records a defeat. A defeat outside it (an
      // 8B encounter the player walked into mid-mission) is
      // not the story's business.
      if (state !== 'active') return;
      const obj = currentObjective();
      if (!obj) return;
      if (obj.type === 'defeat' && obj.encounterId === encounterId) {
        defeatedIds.add(enemyId);
      } else if (obj.type === 'defend' && obj.waves?.includes(encounterId)) {
        defeatedIds.add(enemyId);
      }
    },

    getTargetVehiclePos: () => {
      if (def.id !== 'story-tail-spin') return null;
      const s = deps.followVehicle.getState();
      return { x: s.x, z: s.z, heading: s.heading, speed: s.speed };
    },

    setFlag(flag: string, value: boolean): void {
      progress.flags[flag] = value;
      saveStoryProgress(progress);
    },

    hasFlag(flag: string): boolean {
      return progress.flags[flag] === true;
    },

    setBlocked(next: boolean): void {
      blocked = next;
    },

    debugSetTimeLeft(seconds: number): void {
      if (state === 'active') timeLeft = seconds;
    },

    debugSetFollowTravelled(units: number): void {
      deps.followVehicle.debugSetTravelled(units);
    },

    dispose(): void {
      scene.remove(marker.group);
      marker.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      clearCollectProps();
    },
  };
}
