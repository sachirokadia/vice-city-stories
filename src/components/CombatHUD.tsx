/**
 * Combat HUD: crosshair (centre, with a hit marker), and a single
 * bottom-right vitals cluster — weapon + ammo above, health below.
 * (Health used to sit bottom-left; it moved here so the minimap owns
 * the bottom-left corner.) Shown only while the player can actually
 * fire — on foot, no arrest, no sprint running, no panel open — so it
 * never promises a shot that the locks would refuse. A red vignette
 * flashes when the player takes damage (the health number drops at
 * the same time). No emoji — the heart is a VcIcon, the hit marker
 * is drawn SVG.
 */
import { useEffect, useRef, useState } from 'react';
import type { CombatHudState } from '../game/Combat';
import { VcIcon } from './ui/VcIcon';

interface CombatHUDProps {
  combat: CombatHudState;
}

export default function CombatHUD({ combat }: CombatHUDProps) {
  const showHit = combat.hitMarkerAt > 0 && performance.now() - combat.hitMarkerAt < 250;
  const healthPct = Math.round((combat.health / combat.maxHealth) * 100);
  const lowHealth = healthPct <= 30;
  // Health is a float (regen adds fractional amounts) — the HUD
  // shows a whole number.
  const healthShown = Math.round(combat.health);
  const [damageFlash, setDamageFlash] = useState(false);
  const prevHealth = useRef(combat.health);
  const flashTimer = useRef<number | null>(null);
  useEffect(() => {
    if (combat.health < prevHealth.current) {
      setDamageFlash(true);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setDamageFlash(false), 350);
    }
    prevHealth.current = combat.health;
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, [combat.health]);
  return (
    <>
      {damageFlash && <div className="combat-damage-flash" aria-hidden="true" />}
      <div className="combat-crosshair" aria-hidden="true">
        <span className="cross-dot" />
        <span className="cross-line cross-top" />
        <span className="cross-line cross-bottom" />
        <span className="cross-line cross-left" />
        <span className="cross-line cross-right" />
        {showHit && (
          <svg className="cross-hit" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        )}
      </div>

      <div className="combat-vitals">
        <div
          className="combat-ammo"
          aria-label={`${combat.weaponName}, ${combat.mag} of ${combat.magSize} in the magazine, ${combat.reserve} in reserve`}
        >
          <div className="combat-weapon">
            <VcIcon name="weapon" size={14} />
            <span>{combat.weaponName}</span>
          </div>
          <div className="combat-counts">
            <span className="combat-mag">{combat.mag}</span>
            <span className="combat-reserve">/ {combat.reserve}</span>
          </div>
          {combat.reloading ? (
            <div className="combat-reload">
              <span>RELOADING…</span>
              <div className="combat-reload-bar">
                <div style={{ width: `${Math.round(combat.reloadProgress * 100)}%` }} />
              </div>
            </div>
          ) : (
            <div className="combat-hint">R reload · Q switch</div>
          )}
        </div>

        <div
          className={`combat-health ${lowHealth ? 'low' : ''}`}
          aria-label={`Health ${healthShown} of ${combat.maxHealth}`}
        >
          <VcIcon name="health" size={16} className="combat-health-icon" />
          <div className="combat-health-bar">
            <div style={{ width: `${healthPct}%` }} />
          </div>
          <span className="combat-health-num">{healthShown}</span>
        </div>
      </div>
    </>
  );
}
