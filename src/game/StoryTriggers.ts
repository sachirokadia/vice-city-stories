/**
 * Story triggers — the condition checks for the story-only
 * objective types, plus the checkpoint snapshot helpers.
 *
 * The seven existing objective types (reach, interact,
 * enterVehicle, checkpoint, deliver, follow, evade) are evaluated
 * by MissionTriggers.evaluateTrigger — the story manager calls
 * that, it does not duplicate it. Only the types that do not
 * exist there live here:
 *
 * - 'collect': a reach check plus a per-run collected set. The
 *   distance test is evaluateTrigger('reach', ...) itself, so
 *   the only new logic is "not already collected".
 * - 'dialogue': completed by tryInteract (the 9B stub), never by
 *   polling — like 'interact' in MissionTriggers.
 * - 'defeat' / 'defend': evaluated by the story manager from
 *   the enemy callbacks (9E). Their helpers live here so the
 *   manager stays a state machine, not a calculator.
 *
 * Checkpoint snapshots are plain data copies (no functions, no
 * Three.js objects) so they can be compared and logged safely.
 */
import { evaluateTrigger } from './MissionTriggers';
import type { TriggerContext } from './MissionTriggers';
import type { StoryCheckpoint } from './StoryTypes';

/** A 'collect' objective completes when the player is in range
 * and this item has not been collected yet in this run. */
export function evaluateCollect(
  id: string,
  target: { x: number; z: number },
  radius: number,
  collectedIds: ReadonlySet<string>,
  ctx: TriggerContext,
): boolean {
  if (collectedIds.has(id)) return false;
  return evaluateTrigger('reach', target, radius, ctx);
}

/** How many enemies of an encounter have been defeated. */
export function countDefeated(
  defeatedIds: ReadonlySet<string>,
  encounterEnemyIds: string[],
): number {
  let n = 0;
  for (const id of encounterEnemyIds) {
    if (defeatedIds.has(id)) n++;
  }
  return n;
}

/** A 'defeat' objective completes when the count is reached. */
export function evaluateDefeat(
  count: number,
  defeatedIds: ReadonlySet<string>,
  encounterEnemyIds: string[],
): boolean {
  return countDefeated(defeatedIds, encounterEnemyIds) >= count;
}

/** Build a checkpoint snapshot from the live run state. WS7:
 * `missionId` / `wantedLevel` (level 0-5) / `runTime` are the
 * three fields the persisted resume needs on top of the
 * in-session snapshot. `replay` marks a snapshot taken during a
 * replay of an already-completed mission, so the persisted
 * restore can tell it apart from a stale checkpoint for a
 * finished mission (WS7 fix, 2026-11-24). */
export function takeCheckpoint(
  missionId: string,
  objectiveIndex: number,
  playerPos: { x: number; z: number },
  playerHeading: number,
  driving: boolean,
  vehiclePos: { x: number; z: number } | null,
  vehicleHeading: number | null,
  timeLeft: number,
  collectedIds: ReadonlySet<string>,
  defeatedIds: ReadonlySet<string>,
  flags: Record<string, boolean>,
  wantedLevel: number,
  runTime: number,
  replay: boolean,
): StoryCheckpoint {
  return {
    missionId,
    objectiveIndex,
    playerPos: { ...playerPos },
    playerHeading,
    driving,
    vehiclePos: vehiclePos ? { ...vehiclePos } : null,
    vehicleHeading,
    timeLeft,
    collectedIds: [...collectedIds],
    defeatedIds: [...defeatedIds],
    flags: { ...flags },
    wantedLevel,
    runTime,
    replay,
  };
}

/**
 * Validate a checkpoint before restoring it. A snapshot taken
 * for a different mission, or with an objective index past the
 * end of the list, is refused — the caller restarts the mission
 * instead. This is what makes a corrupt snapshot a restart
 * rather than a broken run.
 *
 * WS7: persisted snapshots are untrusted JSON, so every field
 * is type-checked here — the old version read `snap.playerPos.x`
 * unchecked, which throws on a null position. Mission identity
 * (does this snapshot belong to the current mission, and is
 * that mission unfinished) is checked by the restore entry
 * point, which knows the mission id; this helper only checks
 * the snapshot's own shape.
 */
export function isCheckpointValid(
  snap: unknown,
  objectiveCount: number,
): snap is StoryCheckpoint {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return false;
  const s = snap as Partial<StoryCheckpoint> & Record<string, unknown>;
  if (typeof s.missionId !== 'string' || s.missionId.length === 0) return false;
  if (!Number.isInteger(s.objectiveIndex)) return false;
  if (
    (s.objectiveIndex as number) < 0 ||
    (s.objectiveIndex as number) >= objectiveCount
  )
    return false;
  const pos = s.playerPos as { x?: unknown; z?: unknown } | null | undefined;
  if (!pos || typeof pos !== 'object') return false;
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return false;
  if (!Number.isFinite(s.playerHeading)) return false;
  if (typeof s.driving !== 'boolean') return false;
  const vPos = s.vehiclePos as { x?: unknown; z?: unknown } | null | undefined;
  if (s.driving) {
    if (!vPos || typeof vPos !== 'object') return false;
    if (!Number.isFinite(vPos.x) || !Number.isFinite(vPos.z)) return false;
    if (!Number.isFinite(s.vehicleHeading)) return false;
  } else if (vPos !== null && vPos !== undefined) {
    if (typeof vPos !== 'object') return false;
    if (!Number.isFinite(vPos.x) || !Number.isFinite(vPos.z)) return false;
  }
  if (!Number.isFinite(s.timeLeft) || (s.timeLeft as number) < 0) return false;
  if (
    !Array.isArray(s.collectedIds) ||
    !s.collectedIds.every((x) => typeof x === 'string')
  )
    return false;
  if (
    !Array.isArray(s.defeatedIds) ||
    !s.defeatedIds.every((x) => typeof x === 'string')
  )
    return false;
  const flags = s.flags as Record<string, unknown> | null | undefined;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return false;
  if (!Object.values(flags).every((v) => typeof v === 'boolean')) return false;
  if (
    !Number.isInteger(s.wantedLevel) ||
    (s.wantedLevel as number) < 0 ||
    (s.wantedLevel as number) > 5
  )
    return false;
  if (!Number.isFinite(s.runTime) || (s.runTime as number) < 0) return false;
  // WS7 fix (2026-11-24): the replay flag is optional (absent on
  // pre-fix snapshots) but must be a boolean when present.
  if (s.replay !== undefined && typeof s.replay !== 'boolean') return false;
  return true;
}
