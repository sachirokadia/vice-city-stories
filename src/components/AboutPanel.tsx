import { VcButton } from './ui/VcButton';
import { VcPanel } from './ui/VcPanel';

interface AboutPanelProps {
  onClose: () => void;
}

/** Accurate description of the released game — no stale Phase 1 claims. */
export default function AboutPanel({ onClose }: AboutPanelProps) {
  return (
    <VcPanel
      title="About the game"
      subtitle="An original browser-based 3D open-world game."
      onClose={onClose}
    >
      <p>
        <strong>Vice City Stories</strong> is set in a fictional coastal city where the sun is
        always setting over the bay and the neon never quite turns off. Walk the avenues, look up
        at the Beacon Tower, and make the streets yours.
      </p>
      <p>
        <strong>The story:</strong> a three-chapter campaign — ten missions across two crews,
        with two endings. Courier jobs, dockside trouble, a tower run at sunset, and a final
        job that decides who the city belongs to.
      </p>
      <p>
        <strong>The city:</strong> five job missions and combat contracts, four drivable cars
        with a garage for paint and upgrades, a police wanted system, weapons and the Sunset
        Range, ten hidden Sunset Coins, the Sunset Sprint, the Sunset Mart, and four outfits.
      </p>
      <p>
        <strong>How to play:</strong> WASD or arrow keys to move, mouse drag to look, scroll to
        zoom, Shift to sprint. On touch screens, use the left joystick and drag the right side
        of the screen to look around.
      </p>
      <p className="vc-about-meta">
        Built with React, TypeScript, Vite and Three.js.
        <br />
        An original work. Not affiliated with, or a copy of, any existing game.
      </p>
      <VcButton variant="primary" onClick={onClose} className="vc-about-back">
        Back
      </VcButton>
    </VcPanel>
  );
}
