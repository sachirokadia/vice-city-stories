/**
 * The combat-contract HUD: the accepted / active contract's name,
 * objective, enemies left, wave and objective health, plus an
 * Abandon button. It also toasts a completion (with the cash only
 * on the first completion — replays pay ammo, not cash) or a
 * failure. It disappears when no contract is accepted or active.
 */
import { useEffect, useRef, useState } from 'react';
import type { ContractState } from '../game/Contracts';
import { VcIcon } from './ui/VcIcon';

interface ContractHUDProps {
  contracts: ContractState[];
  onAbandon: () => void;
}

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ContractHUD({ contracts, onAbandon }: ContractHUDProps) {
  const [toast, setToast] = useState<string | null>(null);
  const prevRef = useRef<ContractState[]>(contracts);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    for (const cur of contracts) {
      const before = prev.find((p) => p.id === cur.id);
      if (!before) continue;
      if (before.status === 'active' && cur.status === 'cooling') {
        const first = !before.completedOnce;
        setToast(
          `${cur.name.toUpperCase()} COMPLETE — ${first ? `+$${cur.reward} · ` : ''}ammo restocked`,
        );
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 5000);
      } else if (before.status === 'active' && cur.status === 'failed') {
        setToast(`${cur.name.toUpperCase()} FAILED — the contract is back on the board`);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 5000);
      }
    }
    prevRef.current = contracts;
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [contracts]);

  const shown = contracts.find((c) => c.status === 'active' || c.status === 'accepted');
  const cooling = contracts.filter((c) => c.status === 'cooling');

  return (
    <div className="contract-hud" aria-live="polite">
      {shown && (
        <div className="contract-panel" role="status">
          <div className="contract-row">
            <span className="contract-name">{shown.name.toUpperCase()}</span>
            <span className="contract-reward">${shown.reward}</span>
          </div>
          <div className="contract-objective">
            {shown.status === 'accepted'
              ? shown.blocked
                ? `Finish your current job or story mission first — then head to ${shown.location}`
                : `Head to ${shown.location} — step inside the ring to start`
              : shown.kind === 'elimination'
                ? 'Defeat all designated hostiles'
                : 'Defend the supply beacon'}
          </div>
          {shown.status === 'active' && (
            <div className="contract-row">
              <span className="contract-count">
                {shown.remaining} {shown.remaining === 1 ? 'hostile' : 'hostiles'} left
              </span>
              {shown.kind === 'defense' && shown.totalWaves > 0 && (
                <span className="contract-wave">
                  Wave {Math.max(1, shown.wave)}/{shown.totalWaves}
                  {shown.waveState === 'recovery' && shown.recoveryLeft > 0
                    ? ` · next in ${shown.recoveryLeft}s`
                    : ''}
                </span>
              )}
            </div>
          )}
          {shown.status === 'active' && shown.kind === 'defense' && shown.objectiveMax > 0 && (
            <div className="contract-objective-bar" aria-label={`Beacon health ${shown.objectiveHealth} of ${shown.objectiveMax}`}>
              <div
                className="contract-objective-fill"
                style={{ width: `${Math.max(0, (shown.objectiveHealth / shown.objectiveMax) * 100)}%` }}
              />
              <span className="contract-objective-text">
                Beacon {shown.objectiveHealth}/{shown.objectiveMax}
              </span>
            </div>
          )}
          <button type="button" className="contract-abandon" onClick={onAbandon}>
            <VcIcon name="close" size={13} />
            <span>Abandon contract</span>
          </button>
        </div>
      )}
      {toast && <div className="contract-toast">{toast}</div>}
      {cooling.map((c) => (
        <div key={c.id} className="contract-cooling">
          {c.name} — replay in {formatCooldown(c.cooldownLeft)}
        </div>
      ))}
    </div>
  );
}
