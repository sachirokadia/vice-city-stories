import type { MissionHudState } from '../game/MissionTypes';

interface MissionFailedScreenProps {
  mission: MissionHudState;
  onRetry: () => void;
  onClose: () => void;
}

/** The failure screen after a mission is lost. */
export default function MissionFailedScreen({
  mission,
  onRetry,
  onClose,
}: MissionFailedScreenProps) {
  const reason =
    mission.failedReason === 'timer'
      ? 'The window closed — the job ran out of time.'
      : mission.failedReason === 'busted'
        ? 'The police caught you mid-job.'
        : mission.failedReason === 'lost'
          ? 'The target slipped away — the tail is over.'
          : mission.failedReason === 'spotted'
            ? 'The target made you — the tail is blown.'
            : 'The mission ended.';
  return (
    <div className="mission-failed-overlay" role="dialog" aria-label="Mission failed">
      <div className="mission-failed-vignette" aria-hidden="true" />
      <div className="mission-failed-content">
        <h2 className="mission-failed-title">MISSION FAILED</h2>
        <p className="mission-failed-message">{mission.title}</p>
        <p className="mission-failed-sub">{reason}</p>
        <div className="mission-failed-actions">
          <button type="button" className="play-button mission-failed-retry" onClick={onRetry}>
            ↻ Retry
          </button>
          <button type="button" className="hud-button mission-failed-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
