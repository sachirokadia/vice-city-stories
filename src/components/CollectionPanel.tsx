/**
 * The collection screen: all ten Sunset Coins, which ones the
 * player has found and which are still out there, grouped by area.
 * A coin is found once and stays found — the list reads the same
 * save the world writes, so it can never drift.
 */
import type { CollectibleState } from '../game/Collectibles';

interface CollectionPanelProps {
  state: CollectibleState;
  onClose: () => void;
}

export default function CollectionPanel({ state, onClose }: CollectionPanelProps) {
  return (
    <div className="garage-overlay" role="dialog" aria-label="Sunset Coin collection">
      <div className="garage-panel collection-panel">
        <div className="garage-header">
          <div>
            <h2 className="garage-title">Sunset Coins</h2>
            <p className="garage-sub">
              Ten coins hidden across the city. Walk over one to pick it up.
            </p>
          </div>
          <div className="garage-cash" aria-label={`${state.found} of ${state.total} coins found`}>
            🪙 {state.found} / {state.total}
          </div>
        </div>

        <ul className="collection-list" aria-label="Collectibles">
          {state.items.map((item) => (
            <li
              key={item.id}
              className={`collection-item${item.found ? ' found' : ''}`}
            >
              <span className="collection-icon" aria-hidden="true">
                {item.found ? '🪙' : '○'}
              </span>
              <span className="collection-info">
                <span className="collection-name">{item.name}</span>
                <span className="collection-area">{item.area}</span>
              </span>
              <span className="collection-status">{item.found ? '✓ Found' : 'Not found yet'}</span>
            </li>
          ))}
        </ul>

        <p className="garage-note">
          {state.found === state.total
            ? 'Every coin in the city is yours. Nice hunting.'
            : 'Coins spin gold on the sidewalk, in the parks, on the beach and the boardwalk — keep an eye out.'}
        </p>

        <button type="button" className="hud-button garage-close" onClick={onClose}>
          Close collection
        </button>
      </div>
    </div>
  );
}
