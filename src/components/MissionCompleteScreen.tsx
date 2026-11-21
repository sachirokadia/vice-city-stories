import type { MissionHudState } from '../game/MissionTypes';

interface MissionCompleteScreenProps {
  mission: MissionHudState;
  onContinue: () => void;
  onReplay: () => void;
}

/** The reward screen after a mission is finished. */
export default function MissionCompleteScreen({
  mission,
  onContinue,
  onReplay,
}: MissionCompleteScreenProps) {
  const doneLine =
    mission.kind === 'delivery'
      ? 'the delivery is made.'
      : mission.kind === 'exploration'
        ? 'the case is closed.'
        : mission.kind === 'tail'
          ? 'the tail is complete.'
          : 'you are in the clear.';
  return (
    <div className="mission-complete-overlay" role="dialog" aria-label="Mission complete">
      <div className="mission-complete-vignette" aria-hidden="true" />
      <div className="mission-complete-content">
        <h2 className="mission-complete-title">MISSION COMPLETE</h2>
        <p className="mission-complete-message">
          {mission.title} — {doneLine}
        </p>
        <p className="mission-complete-reward" aria-label={`Reward $${mission.reward}`}>
          +${mission.reward}
        </p>
        <p className="mission-complete-sub">Cash balance: ${mission.cash}</p>
        <div className="mission-complete-actions">
          <button
            type="button"
            className="play-button mission-complete-continue"
            onClick={onContinue}
          >
            Continue
          </button>
          <button type="button" className="hud-button mission-complete-replay" onClick={onReplay}>
            ↻ Replay
          </button>
        </div>
      </div>
    </div>
  );
}
