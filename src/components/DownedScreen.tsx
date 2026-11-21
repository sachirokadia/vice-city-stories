/**
 * The combat-defeat screen: a dark vignette over the frozen city,
 * a big TAKEN DOWN title in the game's own voice (no copied GTA
 * branding, typography or artwork), and one way out — get back up.
 *
 * This is a different outcome from BUSTED: the player was beaten
 * by a hostile crew, not arrested. The wanted level is NOT
 * cleared — the police are still a problem when the player gets
 * back up.
 */
interface DownedScreenProps {
  /** Back on the streets: spawn, health, and the encounter reset. */
  onRespawn: () => void;
}

export default function DownedScreen({ onRespawn }: DownedScreenProps) {
  return (
    <div className="downed-overlay" role="dialog" aria-label="Taken down in combat">
      <div className="downed-vignette" aria-hidden="true" />
      <div className="downed-content">
        <h2 className="downed-title">TAKEN DOWN</h2>
        <p className="downed-message">The crew got the better of you.</p>
        <p className="downed-sub">Your wanted level stands — the police are still out there.</p>
        <button type="button" className="play-button downed-respawn" onClick={onRespawn}>
          ↻&nbsp; Get back up
        </button>
      </div>
    </div>
  );
}
