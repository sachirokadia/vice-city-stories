/**
 * Story progress — what persists for the campaign, under its own
 * key, separate from every existing save. Kept in this small
 * module with no Three.js dependency so the main menu can read
 * the story board without starting the engine — the same rule as
 * MissionProgress.ts.
 *
 * Stored shape (version 1):
 * {
 *   version: 1,
 *   chapters: { [chapterId]: { unlocked, completed } },
 *   missions: { [missionId]: { completed, optionalDone, bestTime } },
 *   current: { chapterId, missionId } | null,
 *   flags: { [flag]: boolean },
 *   ending: 'mara' | 'june' | null
 * }
 *
 * Loads are defensive (try/catch + validation, fall back to a
 * fresh progress object). Unknown mission/chapter ids are ignored,
 * so a later phase can add chapters without breaking old saves.
 * New fields fall back to defaults.
 */
import { STORY_CHAPTERS, STORY_MISSIONS } from './StoryDefinitions';
import type { StoryBoardState, StoryProgress } from './StoryTypes';

const PROGRESS_KEY = 'vice-city-stories.story.v1';

export { PROGRESS_KEY as STORY_PROGRESS_KEY };

export function loadStoryProgress(): StoryProgress {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (raw === null) return freshStoryProgress();
    const parsed = JSON.parse(raw) as Partial<StoryProgress>;
    const progress = freshStoryProgress();
    if (parsed.version === 1) {
      if (parsed.chapters && typeof parsed.chapters === 'object') {
        for (const [id, v] of Object.entries(parsed.chapters)) {
          if (
            v &&
            typeof v === 'object' &&
            typeof (v as { unlocked?: unknown }).unlocked === 'boolean' &&
            typeof (v as { completed?: unknown }).completed === 'boolean'
          ) {
            progress.chapters[id] = {
              unlocked: (v as { unlocked: boolean }).unlocked,
              completed: (v as { completed: boolean }).completed,
            };
          }
        }
      }
      if (parsed.missions && typeof parsed.missions === 'object') {
        for (const [id, v] of Object.entries(parsed.missions)) {
          if (v && typeof v === 'object') {
            const completed =
              typeof (v as { completed?: unknown }).completed === 'boolean'
                ? (v as { completed: boolean }).completed
                : false;
            const optionalDone = Array.isArray(
              (v as { optionalDone?: unknown }).optionalDone,
            )
              ? ((v as { optionalDone: unknown[] }).optionalDone.filter(
                  (x): x is string => typeof x === 'string',
                ) as string[])
              : [];
            const bestTime =
              typeof (v as { bestTime?: unknown }).bestTime === 'number'
                ? (v as { bestTime: number }).bestTime
                : null;
            progress.missions[id] = { completed, optionalDone, bestTime };
          }
        }
      }
      if (
        parsed.current &&
        typeof parsed.current === 'object' &&
        typeof (parsed.current as { chapterId?: unknown }).chapterId ===
          'string' &&
        typeof (parsed.current as { missionId?: unknown }).missionId ===
          'string'
      ) {
        progress.current = {
          chapterId: (parsed.current as { chapterId: string }).chapterId,
          missionId: (parsed.current as { missionId: string }).missionId,
        };
      }
      if (parsed.flags && typeof parsed.flags === 'object') {
        for (const [k, v] of Object.entries(parsed.flags)) {
          if (typeof v === 'boolean') progress.flags[k] = v;
        }
      }
      if (parsed.ending === 'mara' || parsed.ending === 'june') {
        progress.ending = parsed.ending;
      }
      // Reconciliation (9E): a save written before Chapters 2–3
      // existed has no record for them — their fresh defaults
      // say locked. Derive the unlock from what the save
      // proves: a chapter unlocks when the previous chapter is
      // complete, and a chapter that was unlocked stays
      // unlocked. Nothing stored is ever downgraded.
      for (const [i, chapter] of STORY_CHAPTERS.entries()) {
        if (i === 0) continue;
        const prev = STORY_CHAPTERS[i - 1];
        const prevDone = prev.missions.every(
          (m) => progress.missions[m.id]?.completed === true,
        );
        const stored = progress.chapters[chapter.id];
        progress.chapters[chapter.id] = {
          unlocked: stored?.unlocked === true || prevDone,
          completed: chapter.missions.every(
            (m) => progress.missions[m.id]?.completed === true,
          ),
        };
      }
      // Chapter 1 too: a chapter is complete exactly when all its
      // missions are (that is the only way complete() ever marks
      // one). A stored `completed` with incomplete missions is a
      // corrupted save, not a downgrade.
      for (const chapter of STORY_CHAPTERS) {
        const stored = progress.chapters[chapter.id];
        if (stored) {
          stored.completed = chapter.missions.every(
            (m) => progress.missions[m.id]?.completed === true,
          );
        }
      }
    }
    return progress;
  } catch {
    return freshStoryProgress();
  }
}

export function freshStoryProgress(): StoryProgress {
  const progress: StoryProgress = {
    version: 1,
    chapters: {},
    missions: {},
    current: null,
    flags: {},
    ending: null,
  };
  // Chapter 1 is open from the start; later chapters unlock by
  // completing the previous chapter's final mission.
  for (const [i, chapter] of STORY_CHAPTERS.entries()) {
    progress.chapters[chapter.id] = {
      unlocked: i === 0,
      completed: false,
    };
    for (const mission of chapter.missions) {
      progress.missions[mission.id] = {
        completed: false,
        optionalDone: [],
        bestTime: null,
      };
    }
  }
  return progress;
}

export function saveStoryProgress(progress: StoryProgress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable — progress still works for the session */
  }
}

/** Is this story mission unlocked (its unlock chain + prerequisites)? */
export function isStoryMissionUnlocked(
  id: string,
  progress: StoryProgress,
  opts?: {
    jobCompleted?: (jobId: string) => boolean;
    cash?: number;
    ownsVehicle?: (carId: string) => boolean;
  },
): boolean {
  const def = STORY_MISSIONS.find((m) => m.id === id);
  if (!def) return false;
  // The chapter must be unlocked.
  if (progress.chapters[def.chapterId]?.unlocked !== true) return false;
  // The previous mission in the chapter must be completed (unless
  // this is the first mission, or unlockAfter says otherwise).
  if (def.unlockAfter) {
    if (progress.missions[def.unlockAfter]?.completed !== true) return false;
  } else {
    const chapter = STORY_CHAPTERS.find((c) => c.id === def.chapterId);
    const idx = chapter?.missions.findIndex((m) => m.id === id) ?? -1;
    if (idx > 0) {
      const prev = chapter?.missions[idx - 1];
      if (prev && progress.missions[prev.id]?.completed !== true) return false;
    }
  }
  // Extra prerequisites, all of which must hold.
  for (const pre of def.prerequisites ?? []) {
    if (pre.mission && progress.missions[pre.mission]?.completed !== true)
      return false;
    if (
      pre.jobMission &&
      !(opts?.jobCompleted?.(pre.jobMission) ?? false)
    )
      return false;
    if (pre.cash !== undefined && (opts?.cash ?? 0) < pre.cash) return false;
    if (
      pre.vehicle &&
      !(opts?.ownsVehicle?.(pre.vehicle) ?? false)
    )
      return false;
    if (pre.flag && progress.flags[pre.flag] !== true) return false;
  }
  return true;
}

/** Select a story mission from the menu (persists the choice).
 * Returns the updated progress, or null when locked. */
export function trySelectStoryMissionInProgress(
  id: string,
): StoryProgress | null {
  const progress = loadStoryProgress();
  const def = STORY_MISSIONS.find((m) => m.id === id);
  if (!def || !isStoryMissionUnlocked(id, progress)) return null;
  progress.current = { chapterId: def.chapterId, missionId: def.id };
  saveStoryProgress(progress);
  return progress;
}

/** The mission that locks this one (for the board's "locked by" line). */
export function storyLockedBy(id: string): string | null {
  const def = STORY_MISSIONS.find((m) => m.id === id);
  if (!def) return null;
  if (def.unlockAfter) {
    return STORY_MISSIONS.find((m) => m.id === def.unlockAfter)?.title ?? null;
  }
  const chapter = STORY_CHAPTERS.find((c) => c.id === def.chapterId);
  const idx = chapter?.missions.findIndex((m) => m.id === id) ?? -1;
  if (idx > 0) return chapter?.missions[idx - 1]?.title ?? null;
  return null;
}

/** Build the story board state (chapters, entries, cash, guard). */
export function buildStoryBoardState(
  progress: StoryProgress,
  cash: number,
  activeMissionId: string | null,
  blocked: boolean,
): StoryBoardState {
  return {
    chapters: STORY_CHAPTERS.map((chapter) => {
      const ch = progress.chapters[chapter.id] ?? {
        unlocked: false,
        completed: false,
      };
      return {
        id: chapter.id,
        title: chapter.title,
        description: chapter.description,
        unlocked: ch.unlocked,
        completed: ch.completed,
        entries: chapter.missions.map((m) => {
          const rec = progress.missions[m.id] ?? {
            completed: false,
            optionalDone: [],
            bestTime: null,
          };
          return {
            id: m.id,
            chapterId: m.chapterId,
            title: m.title,
            description: m.description,
            giver: m.giver,
            reward: m.reward,
            unlocked: isStoryMissionUnlocked(m.id, progress),
            lockedBy: storyLockedBy(m.id),
            completed: rec.completed,
            selected: progress.current?.missionId === m.id,
            active: activeMissionId === m.id,
          };
        }),
      };
    }),
    cash,
    blocked,
    ending: progress.ending,
  };
}
