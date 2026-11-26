/**
 * Device performance detection.
 * Picks a rendering tier once at startup, and lets the engine
 * step down a tier at runtime if the frame rate stays low.
 * No user data is collected — only coarse hardware hints the
 * browser already exposes (cores, memory, touch, screen size).
 */

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface QualitySettings {
  tier: QualityTier;
  label: string;
  pixelRatio: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  palmCount: number;
  fogNear: number;
  fogFar: number;
}

const SETTINGS: Record<QualityTier, Omit<QualitySettings, 'tier' | 'label'>> = {
  low: {
    pixelRatio: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    palmCount: 12,
    fogNear: 60,
    fogFar: 220,
  },
  medium: {
    pixelRatio: 1.5,
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    palmCount: 28,
    fogNear: 80,
    fogFar: 300,
  },
  high: {
    pixelRatio: 2,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    palmCount: 48,
    fogNear: 100,
    fogFar: 380,
  },
  ultra: {
    pixelRatio: 2,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    palmCount: 64,
    fogNear: 120,
    fogFar: 460,
  },
};

const LABELS: Record<QualityTier, string> = {
  low: 'Low — battery saver',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
};

/**
 * Detects the right tier for this device — or honours an explicit
 * choice from Settings (`'auto'` means detect). A forced tier still
 * caps pixel ratio at the device's own ratio.
 */
export function detectQuality(choice: 'auto' | QualityTier = 'auto'): QualitySettings {
  const isMobile =
    typeof window !== 'undefined' &&
    (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 0 && window.innerWidth < 900));
  const cores = navigator.hardwareConcurrency ?? 4;
  // deviceMemory is Chrome-only; undefined elsewhere.
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const dpr = window.devicePixelRatio ?? 1;

  let tier: QualityTier;
  if (choice !== 'auto') {
    tier = choice;
  } else if (isMobile) {
    tier = cores >= 8 && memory >= 6 && dpr <= 2.5 ? 'medium' : 'low';
  } else if (cores >= 8 && memory >= 8) {
    tier = 'ultra';
  } else if (cores >= 4 && memory >= 4) {
    tier = 'high';
  } else {
    tier = 'medium';
  }

  return {
    tier,
    label: choice === 'auto' ? LABELS[tier] : `${LABELS[tier]} (manual)`,
    ...SETTINGS[tier],
    pixelRatio: Math.min(window.devicePixelRatio || 1, SETTINGS[tier].pixelRatio),
  };
}

export function settingsForTier(tier: QualityTier): QualitySettings {
  return {
    tier,
    label: LABELS[tier],
    ...SETTINGS[tier],
    pixelRatio: Math.min(window.devicePixelRatio || 1, SETTINGS[tier].pixelRatio),
  };
}

/** One step down, or null when already at the floor. */
export function stepDown(tier: QualityTier): QualityTier | null {
  if (tier === 'ultra') return 'high';
  if (tier === 'high') return 'medium';
  if (tier === 'medium') return 'low';
  return null;
}
