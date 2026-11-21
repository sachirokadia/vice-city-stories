/**
 * The encounter banner: the active zone's name and how many
 * hostiles are still standing, plus a short "cleared" toast when
 * a zone is completed (with the cash only on the first
 * completion — replays pay ammo, not cash).
 */
import { useEffect, useRef, useState } from 'react';
import type { EncounterState } from '../game/Encounters';

interface EncounterHUDProps {
  encounters: EncounterState[];
}

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function EncounterHUD({ encounters }: EncounterHUDProps) {
  const [toast, setToast] = useState<string | null>(null);
  const prevRef = useRef<EncounterState[]>(encounters);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    for (const cur of encounters) {
      const before = prev.find((p) => p.id === cur.id);
      if (!before) continue;
      // Active -> cooling means the zone was just completed.
      if (before.status === 'active' && cur.status === 'cooling') {
        const first = !before.completedOnce;
        setToast(
          `${cur.name.toUpperCase()} CLEARED — ${first ? '+$250 · ' : ''}ammo restocked`,
        );
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 5000);
      }
    }
    prevRef.current = encounters;
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [encounters]);

  const active = encounters.find((e) => e.status === 'active');
  const cooling = encounters.filter((e) => e.status === 'cooling');

  return (
    <div className="encounter-hud" aria-live="polite">
      {active && (
        <div className="encounter-banner" role="status">
          <span className="encounter-warning">⚠</span>
          <span className="encounter-name">{active.name.toUpperCase()}</span>
          <span className="encounter-count">
            {active.remaining} {active.remaining === 1 ? 'hostile' : 'hostiles'} left
          </span>
        </div>
      )}
      {toast && <div className="encounter-toast">{toast}</div>}
      {cooling.map((e) => (
        <div key={e.id} className="encounter-cooling">
          {e.name} — replay in {formatCooldown(e.cooldownLeft)}
        </div>
      ))}
    </div>
  );
}
