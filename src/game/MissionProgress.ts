/**
 * Mission progress — what persists between sessions, separate from
 * the cash balance (which has its own key). Kept in this small
 * module with no Three.js dependency so the main menu can read
 * the mission board without starting the engine.
 *
 * Stored shape: { completed: string[], selected: string | null }
 * - completed: ids of missions finished at least once (replayable,
 *   rewards pay again per run — the "once per completion" rule is
 *   enforced by the manager's state machine, not by this list).
 * - selected: the mission the world marker belongs to.
 */
import { MISSION_DEFS } from './MissionDefinitions';
import type { MissionBoardState } from './MissionTypes';

const PROGRESS_KEY = 'vice-city-stories.missions.v1';
const CASH_KEY = 'vice-city-stories.cash.v1';

export interface MissionProgress {
  completed: string[];
  selected: string | null;
}

const FALLBACK: MissionProgress = { completed: [], selected: null };

export function loadMissionProgress(): MissionProgress {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (raw === null) return { ...FALLBACK };
    const parsed = JSON.parse(raw) as Partial<MissionProgress>;
    const completed = Array.isArray(parsed.completed)
      ? parsed.completed.filter((id): id is string => typeof id === 'string')
      : [];
    const selected =
      typeof parsed.selected === 'string' &&
      MISSION_DEFS.some((d) => d.id === parsed.selected)
        ? parsed.selected
        : null;
    return { completed, selected };
  } catch {
    return { ...FALLBACK };
  }
}

export function saveMissionProgress(progress: MissionProgress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable — progress still works for the session */
  }
}

/** The virtual cash balance (same key the manager pays into). */
export function loadCashBalance(): number {
  try {
    const raw = window.localStorage.getItem(CASH_KEY);
    const n = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Pick a mission outside the engine (the main-menu board). Returns
 * the updated progress, or null when the mission is locked or
 * unknown. The engine picks the saved selection up when it starts.
 */
export function trySelectMissionInProgress(id: string): MissionProgress | null {
  const progress = loadMissionProgress();
  const def = MISSION_DEFS.find((d) => d.id === id);
  if (!def || !isMissionUnlocked(id, progress.completed)) return null;
  progress.selected = id;
  saveMissionProgress(progress);
  return progress;
}

/** A mission is unlocked when it has no prerequisite, or the
 * prerequisite mission has been completed. */
export function isMissionUnlocked(defId: string, completed: string[]): boolean {
  const def = MISSION_DEFS.find((d) => d.id === defId);
  if (!def) return false;
  return !def.unlockAfter || completed.includes(def.unlockAfter);
}

/**
 * The board the UI renders: one row per mission, in definition
 * order (which is the unlock chain). `selectedId` is the mission
 * the marker belongs to, `activeId` the one running right now.
 */
export function buildBoardState(
  progress: MissionProgress,
  cash: number,
  activeId: string | null,
): MissionBoardState {
  return {
    cash,
    entries: MISSION_DEFS.map((def) => {
      const prereq = def.unlockAfter
        ? MISSION_DEFS.find((d) => d.id === def.unlockAfter)
        : undefined;
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        kind: def.kind,
        giver: def.giver,
        reward: def.reward,
        unlocked: isMissionUnlocked(def.id, progress.completed),
        lockedBy: prereq ? prereq.title : null,
        completed: progress.completed.includes(def.id),
        selected: progress.selected === def.id,
        active: activeId === def.id,
      };
    }),
  };
}
