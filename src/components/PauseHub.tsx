/**
 * PauseHub — the pause screen. Ten real destinations, every one of
 * which opens an existing panel or screen; no dead buttons, no links
 * to screens that do not exist. The sunset artwork is the game's own
 * copied sunset image; there is no fictional footer date or district.
 *
 * Resume keeps the `.play-button` class the harnesses select
 * (`.pause-overlay.play-button`). The hub itself keeps the
 * `.pause-overlay` root, so the pause guard and the HUD-visibility
 * rules are unchanged.
 */
import { VcIcon } from './ui/VcIcon';
import type { VcIconName } from './ui/VcIcon';

interface PauseHubProps {
  onResume: () => void;
  onMissions: () => void;
  onStory: () => void;
  onGarage: () => void;
  onOutfits: () => void;
  onSettings: () => void;
  onControls: () => void;
  onMap: () => void;
  onStats: () => void;
  onQuit: () => void;
}

export default function PauseHub({
  onResume,
  onMissions,
  onStory,
  onGarage,
  onOutfits,
  onSettings,
  onControls,
  onMap,
  onStats,
  onQuit,
}: PauseHubProps) {
  const items: Array<{ label: string; icon: VcIconName; onClick: () => void; selected?: boolean }> = [
    { label: 'Resume', icon: 'play', onClick: onResume, selected: true },
    { label: 'Map', icon: 'map', onClick: onMap },
    { label: 'Statistics', icon: 'gauge', onClick: onStats },
    { label: 'Missions', icon: 'missions', onClick: onMissions },
    { label: 'Story', icon: 'story', onClick: onStory },
    { label: 'Garage', icon: 'car', onClick: onGarage },
    { label: 'Outfits', icon: 'outfits', onClick: onOutfits },
    { label: 'Settings', icon: 'settings', onClick: onSettings },
    { label: 'Controls', icon: 'weapon', onClick: onControls },
    { label: 'Main Menu', icon: 'back', onClick: onQuit },
  ];

  return (
    <div className="pause-overlay pause-hub" role="dialog" aria-label="Paused">
      <img
        className="pause-screen__art"
        src="/images/vice-city-sunset.png"
        alt="Palm trees and the city at dusk"
      />
      <div className="pause-screen__shade" aria-hidden="true" />
      <section className="pause-panel">
        <p className="eyebrow">VICE CITY STORIES</p>
        <h1>
          PAUSED<span>.</span>
        </h1>
        <div className="pause-list">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={item.selected ? 'is-selected' : ''}
              onClick={item.onClick}
            >
              <VcIcon name={item.icon} size={16} />
              <span>{item.label}</span>
              <VcIcon name="chevron-right" size={16} />
            </button>
          ))}
        </div>
        <p className="pause-hint">
          <kbd>ESC</kbd> RESUME GAME
        </p>
      </section>
    </div>
  );
}
