/**
 * Game settings — the single source of truth for the Settings panel.
 * Persisted in localStorage, read by App at startup, applied by the
 * engine when a game session starts. Every option does something real:
 * quality picks the render tier, shadows toggles shadow mapping,
 * showFps toggles the HUD counter, invertY flips look direction.
 */
import type { QualityTier } from './Quality';
import type { PedestrianChoice } from './NPC';
import type { TrafficChoice } from './Traffic';
import type { PoliceChoice, PursuitDifficulty } from './Police';

export type QualityChoice = 'auto' | QualityTier;

export interface GameSettings {
  quality: QualityChoice;
  shadows: boolean;
  showFps: boolean;
  invertY: boolean;
  /** Pedestrian population: off / few (10) / normal (18) / busy (28). */
  pedestrians: PedestrianChoice;
  /** Traffic density: off / low (8) / medium (14) / high (20). */
  traffic: TrafficChoice;
  /** Police activity: off / low (2) / normal (4) / high (6). */
  police: PoliceChoice;
  /** How fast and far the police pursue. */
  pursuitDifficulty: PursuitDifficulty;
  /** The wanted system: offences raise stars, police pursue. */
  wantedEnabled: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'auto',
  shadows: true,
  showFps: true,
  invertY: false,
  pedestrians: 'normal',
  traffic: 'medium',
  police: 'normal',
  pursuitDifficulty: 'normal',
  wantedEnabled: true,
};

const STORAGE_KEY = 'vice-city-stories.settings.v1';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      quality: parsed.quality ?? DEFAULT_SETTINGS.quality,
      shadows: parsed.shadows ?? DEFAULT_SETTINGS.shadows,
      showFps: parsed.showFps ?? DEFAULT_SETTINGS.showFps,
      invertY: parsed.invertY ?? DEFAULT_SETTINGS.invertY,
      pedestrians: parsed.pedestrians ?? DEFAULT_SETTINGS.pedestrians,
      traffic: parsed.traffic ?? DEFAULT_SETTINGS.traffic,
      police: parsed.police ?? DEFAULT_SETTINGS.police,
      pursuitDifficulty: parsed.pursuitDifficulty ?? DEFAULT_SETTINGS.pursuitDifficulty,
      wantedEnabled: parsed.wantedEnabled ?? DEFAULT_SETTINGS.wantedEnabled,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode) — settings still apply this session */
  }
}
