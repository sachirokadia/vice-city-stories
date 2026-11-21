import type { GameSettings, QualityChoice } from '../game/Settings';
import type { PedestrianChoice } from '../game/NPC';
import type { TrafficChoice } from '../game/Traffic';
import type { PoliceChoice, PursuitDifficulty } from '../game/Police';

interface SettingsPanelProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

const QUALITY_OPTIONS: Array<{ value: QualityChoice; label: string }> = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'low', label: 'Low — battery saver' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'ultra', label: 'Ultra' },
];

const PEDESTRIAN_OPTIONS: Array<{ value: PedestrianChoice; label: string }> = [
  { value: 'off', label: 'Off — empty streets' },
  { value: 'few', label: 'Few — 10 pedestrians' },
  { value: 'normal', label: 'Normal — 18 pedestrians' },
  { value: 'busy', label: 'Busy — 28 pedestrians' },
];

const TRAFFIC_OPTIONS: Array<{ value: TrafficChoice; label: string }> = [
  { value: 'off', label: 'Off — empty roads' },
  { value: 'low', label: 'Low — 8 vehicles' },
  { value: 'medium', label: 'Medium — 14 vehicles' },
  { value: 'high', label: 'High — 20 vehicles' },
];

const POLICE_OPTIONS: Array<{ value: PoliceChoice; label: string }> = [
  { value: 'off', label: 'Off — no police' },
  { value: 'low', label: 'Low — 2 patrol cars' },
  { value: 'normal', label: 'Normal — 4 patrol cars' },
  { value: 'high', label: 'High — 6 patrol cars' },
];

const PURSUIT_OPTIONS: Array<{ value: PursuitDifficulty; label: string }> = [
  { value: 'easy', label: 'Easy — slower, shorter sight' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard — faster, sharper eyes' },
];

/**
 * Functional settings panel. Every control does something real:
 * quality picks the render tier (applies immediately, in-game),
 * shadows toggles shadow mapping live, FPS toggles the HUD
 * counter, invert look flips the camera. Saved to localStorage.
 */
export default function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="panel-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="panel">
        <div className="panel-head">
          <h2>Settings</h2>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <label className="setting-row">
          <span className="setting-label">
            <strong>Graphics quality</strong>
            <small>Auto picks a tier for your device. A manual choice applies immediately, in the city.</small>
          </span>
          <select
            className="setting-select"
            value={settings.quality}
            onChange={(e) => set('quality', e.target.value as QualityChoice)}
            aria-label="Graphics quality"
          >
            {QUALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="setting-row">
          <span className="setting-label">
            <strong>Pedestrians</strong>
            <small>How many people walk the sidewalks. Applies immediately, in the city.</small>
          </span>
          <select
            className="setting-select"
            value={settings.pedestrians}
            onChange={(e) => set('pedestrians', e.target.value as PedestrianChoice)}
            aria-label="Pedestrians"
          >
            {PEDESTRIAN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="setting-row">
          <span className="setting-label">
            <strong>Traffic</strong>
            <small>How many AI vehicles drive the roads. Applies immediately, in the city.</small>
          </span>
          <select
            className="setting-select"
            value={settings.traffic}
            onChange={(e) => set('traffic', e.target.value as TrafficChoice)}
            aria-label="Traffic"
          >
            {TRAFFIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="setting-row">
          <span className="setting-label">
            <strong>Police</strong>
            <small>How many patrol cars cruise the city. Applies immediately, in the city.</small>
          </span>
          <select
            className="setting-select"
            value={settings.police}
            onChange={(e) => set('police', e.target.value as PoliceChoice)}
            aria-label="Police"
          >
            {POLICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="setting-row">
          <span className="setting-label">
            <strong>Pursuit difficulty</strong>
            <small>How fast the police chase you, and how far away they can spot you.</small>
          </span>
          <select
            className="setting-select"
            value={settings.pursuitDifficulty}
            onChange={(e) => set('pursuitDifficulty', e.target.value as PursuitDifficulty)}
            aria-label="Pursuit difficulty"
          >
            {PURSUIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="setting-row">
          <span className="setting-label">
            <strong>Wanted system</strong>
            <small>Offences raise wanted stars and the police come after you. Off: police only patrol.</small>
          </span>
          <input
            type="checkbox"
            className="setting-toggle"
            checked={settings.wantedEnabled}
            onChange={(e) => set('wantedEnabled', e.target.checked)}
            aria-label="Wanted system"
          />
        </label>

        <label className="setting-row">
          <span className="setting-label">
            <strong>Shadows</strong>
            <small>Sun shadows on buildings and the player. Turning them off helps low-end phones.</small>
          </span>
          <input
            type="checkbox"
            className="setting-toggle"
            checked={settings.shadows}
            onChange={(e) => set('shadows', e.target.checked)}
            aria-label="Shadows"
          />
        </label>

        <label className="setting-row">
          <span className="setting-label">
            <strong>Show FPS</strong>
            <small>Show the frames-per-second counter in the top bar while playing.</small>
          </span>
          <input
            type="checkbox"
            className="setting-toggle"
            checked={settings.showFps}
            onChange={(e) => set('showFps', e.target.checked)}
            aria-label="Show FPS"
          />
        </label>

        <label className="setting-row">
          <span className="setting-label">
            <strong>Invert look (up / down)</strong>
            <small>Flip the vertical camera direction when dragging to look around.</small>
          </span>
          <input
            type="checkbox"
            className="setting-toggle"
            checked={settings.invertY}
            onChange={(e) => set('invertY', e.target.checked)}
            aria-label="Invert look"
          />
        </label>

        <button type="button" className="play-button panel-done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
