/**
 * Sunset Mart's shop panel: three items, the mission cash balance,
 * and the player's inventory counts. Every purchase goes through
 * the engine (which owns the cash and the persistence) and the
 * parent refreshes the state it passes back in. One click buys
 * once — the engine ignores a second tap on the same item within
 * 500 ms, so a double-click can never charge twice.
 */
import { useState } from 'react';
import type { ShopUiState } from '../game/GameEngine';

interface ShopPanelProps {
  state: ShopUiState;
  onBuy: (id: string) => { ok: boolean; reason?: string };
  onClose: () => void;
}

const ITEM_ICON: Record<string, string> = {
  water: '💧',
  snack: '🍫',
  energy: '⚡',
};

export default function ShopPanel({ state, onBuy, onClose }: ShopPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'ok' | 'error'>('ok');

  const handleBuy = (id: string) => {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    const res = onBuy(id);
    // A too-fast repeat is the engine swallowing an accidental
    // double-click: nothing to say, the first buy already landed.
    if (res.reason === 'too-fast') return;
    if (res.ok) {
      setMessage(`${item.name} bought — $${item.price}. Added to your inventory.`);
      setMessageKind('ok');
    } else if (res.reason === 'insufficient') {
      setMessage(`Not enough cash for the ${item.name}. Run more missions.`);
      setMessageKind('error');
    } else {
      setMessage('That did not go through — try again.');
      setMessageKind('error');
    }
  };

  return (
    <div className="garage-overlay" role="dialog" aria-label="Sunset Mart">
      <div className="garage-panel shop-panel">
        <div className="garage-header">
          <div>
            <h2 className="garage-title">Sunset Mart</h2>
            <p className="garage-sub">Open 24 hours. Snacks, drinks, and the good stuff.</p>
          </div>
          <div className="garage-cash" aria-label={`Cash balance $${state.cash}`}>
            💰 ${state.cash.toLocaleString()}
          </div>
        </div>

        {message && (
          <p className={`garage-message ${messageKind === 'error' ? 'garage-message-error' : ''}`} role="status">
            {message}
          </p>
        )}

        <ul className="shop-list" aria-label="Shop items">
          {state.items.map((item) => (
            <li key={item.id} className="shop-item">
              <span className="shop-item-icon" aria-hidden="true">
                {ITEM_ICON[item.id] ?? '🛍️'}
              </span>
              <span className="shop-item-info">
                <span className="shop-item-name">{item.name}</span>
                <span className="shop-item-desc">{item.description}</span>
                <span className="shop-item-owned">
                  In your bag: {state.inventory[item.id]}
                </span>
              </span>
              <button
                type="button"
                className="garage-action shop-buy"
                onClick={() => handleBuy(item.id)}
                disabled={state.cash < item.price}
              >
                Buy — ${item.price}
                {state.cash < item.price && ` (need $${item.price - state.cash} more)`}
              </button>
            </li>
          ))}
        </ul>

        <p className="garage-note">
          Items are keepsakes for now — no hunger or stamina, just something to carry.
          Bought items stay in your bag after a reload.
        </p>

        <button type="button" className="hud-button garage-close" onClick={onClose}>
          Close shop
        </button>
      </div>
    </div>
  );
}
