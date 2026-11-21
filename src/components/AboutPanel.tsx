interface AboutPanelProps {
  onClose: () => void;
}

/** Short original description of the game — no copied text or branding. */
export default function AboutPanel({ onClose }: AboutPanelProps) {
  return (
    <div className="panel-overlay" role="dialog" aria-modal="true" aria-label="About Vice City Stories">
      <div className="panel">
        <div className="panel-head">
          <h2>About the game</h2>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close about">
            ✕
          </button>
        </div>
        <div className="about-body">
          <p>
            <strong>Vice City Stories</strong> is an original browser-based 3D open-world game set in a
            fictional coastal city, where the sun is always setting over the bay and the neon never
            quite turns off.
          </p>
          <p>
            This is the Phase 1 foundation: you can walk the avenues, look up at the Beacon Tower,
            and watch the city glow at dusk. Missions, vehicles, and the stories of the people who
            live here are still to come — the streets are ready for them.
          </p>
          <p>
            <strong>How to play:</strong> WASD or arrow keys to move, mouse drag to look, scroll to
            zoom, Shift to sprint. On touch screens, use the left joystick and drag the right side
            of the screen to look around.
          </p>
          <p className="about-meta">
            Version 0.1.0 — Foundation · Built with React, TypeScript, Vite and Three.js.
            <br />
            An original work. Not affiliated with, or a copy of, any existing game.
          </p>
        </div>
        <button type="button" className="play-button panel-done" onClick={onClose}>
          Back
        </button>
      </div>
    </div>
  );
}
