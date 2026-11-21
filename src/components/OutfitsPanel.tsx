/**
 * The outfits panel: four original looks for the protagonist,
 * with a live 3D preview of the selected one. Buying and wearing
 * go through the engine (which owns the cash, the persistence,
 * and the live character), and the parent refreshes the state it
 * passes back in.
 */
import { useState } from 'react';
import CharacterPreview from './CharacterPreview';
import type { OutfitRow, OutfitUiState } from '../game/GameEngine';

interface OutfitsPanelProps {
  state: OutfitUiState;
  onBuy: (id: string) => { ok: boolean; reason?: string };
  onSelect: (id: string) => boolean;
  onClose: () => void;
}

export default function OutfitsPanel({ state, onBuy, onSelect, onClose }: OutfitsPanelProps) {
  const initiallySelected = state.outfits.find((o) => o.selected) ?? state.outfits[0];
  const [viewId, setViewId] = useState(initiallySelected.def.id);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'ok' | 'error'>('ok');

  const row: OutfitRow = state.outfits.find((o) => o.def.id === viewId) ?? state.outfits[0];
  const def = row.def;

  const handleBuy = () => {
    const res = onBuy(def.id);
    if (res.ok) {
      setMessage(`${def.name} is yours — $${def.price.toLocaleString()} paid. Wear it from here.`);
      setMessageKind('ok');
    } else if (res.reason === 'insufficient') {
      setMessage(`Not enough cash for the ${def.name}. Run more missions.`);
      setMessageKind('error');
    } else if (res.reason === 'already-owned') {
      setMessage(`You already own the ${def.name}.`);
      setMessageKind('error');
    } else {
      setMessage('That did not go through — try again.');
      setMessageKind('error');
    }
  };

  const handleSelect = () => {
    if (onSelect(def.id)) {
      setMessage(`Wearing the ${def.name} now.`);
      setMessageKind('ok');
    } else {
      setMessage(`Buy the ${def.name} first.`);
      setMessageKind('error');
    }
  };

  return (
    <div className="garage-overlay" role="dialog" aria-label="Outfits">
      <div className="garage-panel">
        <div className="garage-header">
          <div>
            <h2 className="garage-title">Outfits</h2>
            <p className="garage-sub">Four looks, one protagonist. The face and the moves stay his.</p>
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

        <div className="garage-grid">
          <ul className="garage-list" aria-label="Outfits">
            {state.outfits.map((o) => (
              <li key={o.def.id}>
                <button
                  type="button"
                  className={`garage-card${o.def.id === viewId ? ' viewing' : ''}${o.selected ? ' selected' : ''}`}
                  onClick={() => {
                    setViewId(o.def.id);
                    setMessage(null);
                  }}
                  aria-pressed={o.def.id === viewId}
                >
                  <span className="garage-card-name">{o.def.name}</span>
                  <span className="garage-card-kind">
                    {o.selected
                      ? 'WORN NOW'
                      : o.owned
                        ? 'OWNED'
                        : o.def.unlockOnly
                          ? 'STORY REWARD'
                          : 'FOR SALE'}
                  </span>
                  <span className="garage-card-price">
                    {o.owned
                      ? (o.selected ? '● Wearing now' : '✓ Owned')
                      : o.def.unlockOnly
                        ? 'Earn it in the story'
                        : `$${o.def.price.toLocaleString()}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="garage-detail">
            <CharacterPreview outfit={def} />
            <h3 className="garage-detail-name">{def.name}</h3>
            <p className="garage-detail-desc">{def.description}</p>

            {row.owned ? (
              row.selected ? (
                <p className="garage-active-note">● You are wearing this now.</p>
              ) : (
                <button type="button" className="garage-action" onClick={handleSelect}>
                  Wear this outfit
                </button>
              )
            ) : def.unlockOnly ? (
              <p className="garage-active-note">
                Earned in the story — hold the beach in HOLD THE LINE (Chapter 2).
              </p>
            ) : (
              <button
                type="button"
                className="garage-action"
                onClick={handleBuy}
                disabled={state.cash < def.price}
              >
                Buy — ${def.price.toLocaleString()}
                {state.cash < def.price && ` (need $${(def.price - state.cash).toLocaleString()} more)`}
              </button>
            )}
            <p className="garage-note">
              {row.owned
                ? 'Wearing it changes the protagonist in the world at once — same face, same walk.'
                : 'Bought outfits are yours for good. Earn cash from missions.'}
            </p>
          </div>
        </div>

        <button type="button" className="hud-button garage-close" onClick={onClose}>
          Close outfits
        </button>
      </div>
    </div>
  );
}
