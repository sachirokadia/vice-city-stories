/**
 * The Sunset Garage panel: buy cars, pick the active one, repaint
 * it, and upgrade its engine, acceleration and handling — all with
 * the mission cash balance. The panel is a controlled view over
 * the engine's garage state: every action goes through the engine
 * (which owns the cash and the persistence) and the parent
 * refreshes the state it passes back in.
 */
import { useState } from 'react';
import VehiclePreview from './VehiclePreview';
import type { GarageUiState, GarageVehicleRow, UpgradeKind } from '../game/GarageProgress';
import { PAINT_PRICE } from '../game/GarageProgress';
import { PAINT_COLORS, paintName } from '../game/VehicleCatalog';

interface GaragePanelProps {
  state: GarageUiState;
  onBuy: (id: string) => { ok: boolean; reason?: string };
  onSelect: (id: string) => boolean;
  onPaint: (id: string, hex: number) => { ok: boolean; reason?: string };
  onUpgrade: (id: string, kind: UpgradeKind) => { ok: boolean; reason?: string };
  onClose: () => void;
}

const KIND_LABEL: Record<string, string> = {
  sports: 'SPORTS',
  sedan: 'SEDAN',
  coupe: 'COUPE',
  suv: 'SUV',
};

function hexCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function statBar(value: number, max: number): React.CSSProperties {
  return { width: `${Math.max(4, Math.min(100, (value / max) * 100))}%` };
}

const UPGRADE_META: Array<{ kind: UpgradeKind; label: string; stat: (r: GarageVehicleRow) => string }> = [
  {
    kind: 'engine',
    label: 'Engine',
    stat: (r) => `${Math.round(r.stats.topSpeed * 3.6)} km/h`,
  },
  {
    kind: 'accel',
    label: 'Acceleration',
    stat: (r) => `${r.stats.accel.toFixed(1)} m/s²`,
  },
  {
    kind: 'handling',
    label: 'Handling',
    stat: (r) => `${r.stats.handling.toFixed(2)}×`,
  },
];

function nextStat(kind: UpgradeKind, row: GarageVehicleRow): string {
  const s = row.stats;
  if (kind === 'engine') return `${Math.round((s.topSpeed + 3) * 3.6)} km/h`;
  if (kind === 'accel') return `${(s.accel + 2.5).toFixed(1)} m/s²`;
  return `${(s.handling + 0.08).toFixed(2)}×`;
}

function failMessage(reason: string | undefined, row: GarageVehicleRow): string {
  switch (reason) {
    case 'insufficient':
      return `Not enough cash for the ${row.spec.name}. Run more missions.`;
    case 'already-owned':
      return `You already own the ${row.spec.name}.`;
    case 'maxed':
      return 'That upgrade is already at its maximum.';
    case 'already':
      return `The ${row.spec.name} is already that colour.`;
    case 'not-owned':
      return `Buy the ${row.spec.name} first.`;
    default:
      return 'That did not go through — try again.';
  }
}

export default function GaragePanel({ state, onBuy, onSelect, onPaint, onUpgrade, onClose }: GaragePanelProps) {
  const initiallySelected = state.vehicles.find((v) => v.selected) ?? state.vehicles[0];
  const [viewId, setViewId] = useState(initiallySelected.spec.id);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'ok' | 'error'>('ok');

  const row = state.vehicles.find((v) => v.spec.id === viewId) ?? state.vehicles[0];
  const spec = row.spec;

  const showOk = (text: string) => {
    setMessage(text);
    setMessageKind('ok');
  };
  const showError = (text: string) => {
    setMessage(text);
    setMessageKind('error');
  };

  const handleBuy = () => {
    const res = onBuy(spec.id);
    if (res.ok) {
      showOk(`${spec.name} is yours — $${spec.price.toLocaleString()} paid.`);
      setViewId(spec.id);
    } else {
      showError(failMessage(res.reason, row));
    }
  };

  const handleSelect = () => {
    if (onSelect(spec.id)) {
      showOk(`${spec.name} is ready — find it at the garage parking bay.`);
    } else {
      showError(failMessage('not-owned', row));
    }
  };

  const handlePaint = (hex: number) => {
    const res = onPaint(spec.id, hex);
    if (res.ok) {
      showOk(`${spec.name} repainted ${paintName(hex)} — $${PAINT_PRICE} paid.`);
    } else {
      showError(failMessage(res.reason, row));
    }
  };

  const handleUpgrade = (kind: UpgradeKind) => {
    const res = onUpgrade(spec.id, kind);
    if (res.ok) {
      const label = UPGRADE_META.find((m) => m.kind === kind)?.label ?? kind;
      showOk(`${spec.name} ${label} upgraded to level ${row.upgrades[kind] + 1}.`);
    } else {
      showError(failMessage(res.reason, row));
    }
  };

  return (
    <div className="garage-overlay" role="dialog" aria-label="Sunset Garage">
      <div className="garage-panel">
        <div className="garage-header">
          <div>
            <h2 className="garage-title">Sunset Garage</h2>
            <p className="garage-sub">Buy cars, make them yours, drive them out.</p>
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
          <ul className="garage-list" aria-label="Vehicles">
            {state.vehicles.map((v) => (
              <li key={v.spec.id}>
                <button
                  type="button"
                  className={`garage-card${v.spec.id === viewId ? ' viewing' : ''}${v.selected ? ' selected' : ''}`}
                  onClick={() => {
                    setViewId(v.spec.id);
                    setMessage(null);
                  }}
                  aria-pressed={v.spec.id === viewId}
                >
                  <span className="garage-card-name">{v.spec.name}</span>
                  <span className="garage-card-kind">{KIND_LABEL[v.spec.kind]}</span>
                  <span className="garage-card-price">
                    {v.owned ? (v.selected ? '● Active now' : '✓ Owned') : `$${v.spec.price.toLocaleString()}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="garage-detail">
            <VehiclePreview spec={spec} paint={row.paint} />
            <h3 className="garage-detail-name">{spec.name}</h3>
            <p className="garage-detail-desc">{spec.description}</p>

            <div className="garage-stats" aria-label="Performance">
              <div className="garage-stat">
                <span className="garage-stat-label">Top speed</span>
                <span className="garage-stat-value">{Math.round(row.stats.topSpeed * 3.6)} km/h</span>
                <span className="garage-stat-bar">
                  <span className="garage-stat-fill" style={statBar(row.stats.topSpeed, 55)} />
                </span>
              </div>
              <div className="garage-stat">
                <span className="garage-stat-label">Acceleration</span>
                <span className="garage-stat-value">{row.stats.accel.toFixed(1)} m/s²</span>
                <span className="garage-stat-bar">
                  <span className="garage-stat-fill" style={statBar(row.stats.accel, 30)} />
                </span>
              </div>
              <div className="garage-stat">
                <span className="garage-stat-label">Handling</span>
                <span className="garage-stat-value">{row.stats.handling.toFixed(2)}×</span>
                <span className="garage-stat-bar">
                  <span className="garage-stat-fill" style={statBar(row.stats.handling, 1.5)} />
                </span>
              </div>
            </div>

            {row.owned ? (
              <>
                <div className="garage-section">
                  <h4 className="garage-section-title">
                    Paint — ${PAINT_PRICE} a repaint · now {paintName(row.paint)}
                  </h4>
                  <div className="garage-swatches" role="group" aria-label="Paint colours">
                    {PAINT_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        className={`garage-swatch${c.hex === row.paint ? ' current' : ''}`}
                        style={{ backgroundColor: hexCss(c.hex) }}
                        onClick={() => handlePaint(c.hex)}
                        aria-label={`Paint ${c.name} for $${PAINT_PRICE}`}
                        title={`${c.name} — $${PAINT_PRICE}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="garage-section">
                  <h4 className="garage-section-title">Upgrades — max level 3</h4>
                  <ul className="garage-upgrades">
                    {UPGRADE_META.map((m) => {
                      const level = row.upgrades[m.kind];
                      const price = row.nextUpgradePrice[m.kind];
                      return (
                        <li key={m.kind} className="garage-upgrade">
                          <span className="garage-upgrade-name">{m.label}</span>
                          <span className="garage-upgrade-pips" aria-label={`Level ${level} of 3`}>
                            {[1, 2, 3].map((n) => (
                              <span key={n} className={n <= level ? 'pip on' : 'pip'}>
                                ●
                              </span>
                            ))}
                          </span>
                          <span className="garage-upgrade-stat">
                            {m.stat(row)}
                            {price !== null && <> → {nextStat(m.kind, row)}</>}
                          </span>
                          {price === null ? (
                            <span className="garage-upgrade-max">MAX</span>
                          ) : (
                            <button
                              type="button"
                              className="garage-upgrade-button"
                              onClick={() => handleUpgrade(m.kind)}
                              disabled={state.cash < price}
                            >
                              ${price.toLocaleString()}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="garage-note">
                    Upgrades change how the car actually drives — top speed, acceleration and steering.
                  </p>
                </div>

                {row.selected ? (
                  <p className="garage-active-note">● This is your active car.</p>
                ) : (
                  <button type="button" className="garage-action" onClick={handleSelect}>
                    Select — drive this car
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="garage-action"
                onClick={handleBuy}
                disabled={state.cash < spec.price}
              >
                Buy — ${spec.price.toLocaleString()}
                {state.cash < spec.price && ` (need $${(spec.price - state.cash).toLocaleString()} more)`}
              </button>
            )}
            <p className="garage-note">
              {row.owned
                ? 'Select it to drive it out — the old car goes back to the garage.'
                : 'Bought cars are yours for good. Earn cash from missions.'}
            </p>
          </div>
        </div>

        <button type="button" className="hud-button garage-close" onClick={onClose}>
          Close garage
        </button>
      </div>
    </div>
  );
}
