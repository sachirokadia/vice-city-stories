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

/** Build a checkpoint snapshot from the live run state. */
export function takeCheckpoint(
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
): StoryCheckpoint {
  return {
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
  };
}

/**
 * Validate a checkpoint before restoring it. A snapshot taken
 * for a different mission, or with an objective index past the
 * end of the list, is refused — the caller restarts the mission
 * instead. This is what makes a corrupt snapshot a restart
 * rather than a broken run.
 */
export function isCheckpointValid(
  snap: StoryCheckpoint | null,
  objectiveCount: number,
): snap is StoryCheckpoint {
  if (!snap) return false;
  if (!Number.isInteger(snap.objectiveIndex)) return false;
  if (snap.objectiveIndex < 0 || snap.objectiveIndex >= objectiveCount)
    return false;
  if (!Number.isFinite(snap.playerPos.x) || !Number.isFinite(snap.playerPos.z))
    return false;
  if (!Number.isFinite(snap.timeLeft) || snap.timeLeft < 0) return false;
  return true;
}
