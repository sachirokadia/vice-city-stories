interface BustedScreenProps {
  /** Back on the streets: spawn, GT, wanted and police all reset. */
  onRespawn: () => void;
}

/**
 * The arrest screen: a dark red vignette over the frozen city,
 * a big BUSTED title in the game's own voice (no copied GTA
 * branding, typography or artwork), and one way out — respawn.
 */
export default function BustedScreen({ onRespawn }: BustedScreenProps) {
  return (
    <div className="busted-overlay" role="dialog" aria-label="Busted by the police">
      <div className="busted-vignette" aria-hidden="true" />
      <div className="busted-content">
        <h2 className="busted-title">BUSTED</h2>
        <p className="busted-message">The Vice City police have you in custody.</p>
        <p className="busted-sub">Your wanted level is cleared — but the city remembers.</p>
        <button type="button" className="play-button busted-respawn" onClick={onRespawn}>
          ↻&nbsp; Respawn
        </button>
      </div>
    </div>
  );
}
