/**
 * Settings panel — four real sections, all nine real settings, no
 * invented options. The `set()` contract and the key names are
 * unchanged from the original panel: every control calls
 * `onChange({ ...settings, [key]: value })`, and persistence still
 * lives in the App (localStorage). The panel is a controlled view —
 * it never stores a setting itself.
 *
 * Sections: Graphics (quality stepper, shadows, FPS), World
 * (pedestrians, traffic, police, pursuit difficulty steppers),
 * Gameplay (wanted system, invert look), Controls (read-only key map,
 * taken from the real HUD hints). Fictional audio, subtitles, aim
 * assist, difficulty, brightness and display options are deliberately
 * absent — the game has no such systems.
 */
import { useEffect, useState } from 'react';
import type { GameSettings, QualityChoice } from '../game/Settings';
import type { PedestrianChoice } from '../game/NPC';
import type { TrafficChoice } from '../game/Traffic';
import type { PoliceChoice, PursuitDifficulty } from '../game/Police';
import { VcIcon } from './ui/VcIcon';

export type SettingsSection = 'Graphics' | 'World' | 'Gameplay' | 'Controls';

const SECTIONS: SettingsSection[] = ['Graphics', 'World', 'Gameplay', 'Controls'];

interface SettingsPanelProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
  /** Which tab opens first (the Pause Hub opens Controls directly). */
  initialSection?: SettingsSection;
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

/** A ‹ value › stepper over an option list — cycles in definition order. */
function Stepper<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const prev = () => onChange(options[(idx + options.length - 1) % options.length].value);
  const next = () => onChange(options[(idx + 1) % options.length].value);
  return (
    <div className="setting-stepper">
      <button type="button" aria-label={`Previous ${label}`} onClick={prev}>
        ‹
      </button>
      <b aria-label={label}>{options[idx].label}</b>
      <button type="button" aria-label={`Next ${label}`} onClick={next}>
        ›
      </button>
    </div>
  );
}

/** A switch that calls the same set() as the old checkbox did. */
function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <span>
        <b>{label}</b>
        <small>{description}</small>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <i aria-hidden="true" />
      </button>
    </div>
  );
}

/** The real key map, from the HUD hints — read-only. */
const CONTROL_ROWS: Array<{ action: string; keys: string; hint: string }> = [
  { action: 'Move', keys: 'W A S D', hint: 'Keyboard' },
  { action: 'Look around', keys: 'Drag', hint: 'Mouse / touch' },
  { action: 'Fire weapon', keys: 'Left-click', hint: 'Mouse / hold FIRE' },
  { action: 'Reload', keys: 'R', hint: 'Keyboard' },
  { action: 'Switch weapon', keys: 'Q', hint: 'Keyboard' },
  { action: 'Sprint', keys: 'Shift', hint: 'Keyboard' },
  { action: 'Interact · enter vehicle', keys: 'E', hint: 'Keyboard' },
  { action: 'Pause game', keys: 'Esc', hint: 'Keyboard' },
];

export default function SettingsPanel({ settings, onChange, onClose, initialSection }: SettingsPanelProps) {
  const [section, setSection] = useState<SettingsSection>(initialSection ?? 'Graphics');
  // The hub opens a specific tab (Controls); sync when the prop changes.
  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="panel-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="panel panel--settings">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PREFERENCES</p>
            <h2 className="settings-title">SETTINGS</h2>
          </div>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-tabs" aria-label="Settings sections">
            {SECTIONS.map((item, index) => (
              <button
                key={item}
                type="button"
                className={section === item ? 'is-active' : ''}
                aria-current={section === item ? 'true' : undefined}
                onClick={() => setSection(item)}
              >
                <span>0{index + 1}</span>
                {item}
                <VcIcon name="chevron-right" size={15} />
              </button>
            ))}
          </nav>

          <div className="settings-panel">
            <div className="settings-panel__top">
              <div>
                <span className="eyebrow">GAME OPTIONS</span>
                <h2>{section}</h2>
              </div>
              <span className="settings-local">
                <i aria-hidden="true" /> SAVED ON THIS DEVICE
              </span>
            </div>

            {section === 'Graphics' && (
              <>
                <div className="setting-row">
                  <span>
                    <b>Graphics quality</b>
                    <small>Auto picks a tier for your device. A manual choice applies immediately, in the city.</small>
                  </span>
                  <Stepper
                    options={QUALITY_OPTIONS}
                    value={settings.quality}
                    onChange={(v) => set('quality', v)}
                    label="Graphics quality"
                  />
                </div>
                <SettingToggle
                  label="Shadows"
                  description="Sun shadows on buildings and the player. Turning them off helps low-end phones."
                  checked={settings.shadows}
                  onChange={(v) => set('shadows', v)}
                />
                <SettingToggle
                  label="Show FPS"
                  description="Show the frames-per-second counter in the top bar while playing."
                  checked={settings.showFps}
                  onChange={(v) => set('showFps', v)}
                />
              </>
            )}

            {section === 'World' && (
              <>
                <div className="setting-row">
                  <span>
                    <b>Pedestrians</b>
                    <small>How many people walk the sidewalks. Applies immediately, in the city.</small>
                  </span>
                  <Stepper
                    options={PEDESTRIAN_OPTIONS}
                    value={settings.pedestrians}
                    onChange={(v) => set('pedestrians', v)}
                    label="Pedestrians"
                  />
                </div>
                <div className="setting-row">
                  <span>
                    <b>Traffic</b>
                    <small>How many AI vehicles drive the roads. Applies immediately, in the city.</small>
                  </span>
                  <Stepper
                    options={TRAFFIC_OPTIONS}
                    value={settings.traffic}
                    onChange={(v) => set('traffic', v)}
                    label="Traffic"
                  />
                </div>
                <div className="setting-row">
                  <span>
                    <b>Police</b>
                    <small>How many patrol cars cruise the city. Applies immediately, in the city.</small>
                  </span>
                  <Stepper
                    options={POLICE_OPTIONS}
                    value={settings.police}
                    onChange={(v) => set('police', v)}
                    label="Police"
                  />
                </div>
                <div className="setting-row">
                  <span>
                    <b>Pursuit difficulty</b>
                    <small>How fast the police chase you, and how far away they can spot you.</small>
                  </span>
                  <Stepper
                    options={PURSUIT_OPTIONS}
                    value={settings.pursuitDifficulty}
                    onChange={(v) => set('pursuitDifficulty', v)}
                    label="Pursuit difficulty"
                  />
                </div>
              </>
            )}

            {section === 'Gameplay' && (
              <>
                <SettingToggle
                  label="Wanted system"
                  description="Offences raise wanted stars and the police come after you. Off: police only patrol."
                  checked={settings.wantedEnabled}
                  onChange={(v) => set('wantedEnabled', v)}
                />
                <SettingToggle
                  label="Invert look"
                  description="Flip the vertical camera direction when dragging to look around."
                  checked={settings.invertY}
                  onChange={(v) => set('invertY', v)}
                />
              </>
            )}

            {section === 'Controls' && (
              <>
                {CONTROL_ROWS.map((row) => (
                  <div key={row.action} className="control-map-row">
                    <span>
                      <b>{row.action}</b>
                      <small>{row.hint}</small>
                    </span>
                    <kbd>{row.keys}</kbd>
                  </div>
                ))}
              </>
            )}

            <button type="button" className="play-button panel-done" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
