import { useState } from 'react';
import type { RangeUiState } from '../game/GameEngine';

interface RangePanelProps {
  state: RangeUiState;
  onBuy: (id: string) => { ok: boolean; reason?: string };
  onEquip: (id: string) => boolean;
  onRestock: () => void;
  onClose: () => void;
}

/**
 * Sunset Range panel (the weapon rack): buy and equip the two
 * weapons, restock ammo for free, and see the range score. Reuses
 * the garage overlay / panel styling, like the shop does.
 *
 * Buy/equip results are surfaced like the shop's (9.4 fix): an
 * unaffordable Buy is disabled with the shortfall shown, and a
 * failed click produces an inline message instead of silence.
 */
export default function RangePanel({ state, onBuy, onEquip, onRestock, onClose }: RangePanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'ok' | 'error'>('ok');

  const handleBuy = (id: string) => {
    const w = state.weapons.find((x) => x.id === id);
    if (!w) return;
    const res = onBuy(id);
    if (res.ok) {
      setMessage(`${w.name} bought — $${w.price.toLocaleString()}. Equip it to use it.`);
      setMessageKind('ok');
    } else if (res.reason === 'insufficient') {
      setMessage(`Not enough cash for the ${w.name}. Run more missions.`);
      setMessageKind('error');
    } else if (res.reason === 'already-owned') {
      setMessage(`You already own the ${w.name}.`);
      setMessageKind('error');
    } else {
      setMessage('That did not go through — try again.');
      setMessageKind('error');
    }
  };

  const handleEquip = (id: string) => {
    const w = state.weapons.find((x) => x.id === id);
    if (!w) return;
    const ok = onEquip(id);
    if (ok) {
      setMessage(`${w.name} equipped.`);
      setMessageKind('ok');
    } else {
      setMessage(`Could not equip the ${w.name} — try again.`);
      setMessageKind('error');
    }
  };
  return (
    <div className="garage-overlay" role="dialog" aria-label="Sunset Range">
      <div className="garage-panel range-panel">
        <h2 className="garage-title">Sunset Range</h2>
        <p className="garage-subtitle">
          Target practice on the north beach. Cash: ${state.cash.toLocaleString()}
        </p>
        <div className="range-stats">
          <span>
            Session: {state.hits}/{state.shots} hits ({Math.round(state.accuracy * 100)}%)
          </span>
          <span>
            All time: {state.totalHits}/{state.totalShots}
          </span>
        </div>
        {message && (
          <p className={`garage-message ${messageKind === 'error' ? 'garage-message-error' : ''}`} role="status">
            {message}
          </p>
        )}
        <ul className="shop-list">
          {state.weapons.map((w) => (
            <li key={w.id} className="shop-item">
              <div className="shop-item-info">
                <span className="shop-item-name">
                  {w.name}
                  {w.equipped ? ' · EQUIPPED' : ''}
                </span>
                <span className="shop-item-desc">{w.description}</span>
                <span className="shop-item-desc">
                  Damage {w.damage} · {w.auto ? 'Automatic' : 'Semi-auto'} · {w.magSize} rounds ·{' '}
                  {w.range} m · {w.ammoType} · Reserve {w.reserve}
                </span>
                {w.owned ? (
                  <span className="shop-item-owned">Owned</span>
                ) : (
                  <span className="shop-item-desc">Price ${w.price.toLocaleString()}</span>
                )}
              </div>
              {w.owned ? (
                <button
                  type="button"
                  className="garage-action shop-buy"
                  disabled={w.equipped}
                  onClick={() => handleEquip(w.id)}
                >
                  {w.equipped ? 'Equipped' : 'Equip'}
                </button>
              ) : (
                <button
                  type="button"
                  className="garage-action shop-buy"
                  onClick={() => handleBuy(w.id)}
                  disabled={state.cash < w.price}
                >
                  Buy ${w.price.toLocaleString()}
                  {state.cash < w.price && ` (need $${w.price - state.cash} more)`}
                </button>
              )}
            </li>
          ))}
        </ul>
        <button type="button" className="garage-action" onClick={onRestock}>
          Restock ammo — free
        </button>
        <p className="garage-subtitle">
          Six ring targets stand downrange: 15 m, 30 m and 45 m. The sidearm reaches the first
          two rows; the carbine reaches all three.
        </p>
        <button type="button" className="garage-action garage-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
