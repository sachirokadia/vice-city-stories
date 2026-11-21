/**
 * The Sunset Sprint HUD: a countdown timer and checkpoint count
 * while a run is live, a completion screen with the time and the
 * $150 reward, and a failure screen with the reason. "Run again"
 * and "Retry" both dismiss the screen — the next run starts at
 * the gold marker on the south end of the boardwalk.
 */
import { SPRINT_REWARD } from '../game/Sprint';
import type { SprintHudState } from '../game/Sprint';

interface SprintHUDProps {
  sprint: SprintHudState;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const whole = Math.floor(s);
  const tenths = Math.floor((s - whole) * 10);
  return `${whole}.${tenths}s`;
}

export default function SprintHUD({ sprint, onClose }: SprintHUDProps) {
  if (sprint.status === 'running') {
    return (
      <div className="sprint-hud" role="status" aria-label="Sunset Sprint in progress">
        <div className="sprint-title">SUNSET SPRINT</div>
        <div className="sprint-timer">{formatTime(sprint.timeLeft)}</div>
        <div className="sprint-checkpoints">
          Checkpoint {Math.min(sprint.checkpointIndex + 1, sprint.checkpointsTotal)} /{' '}
          {sprint.checkpointsTotal}
        </div>
        <div className="sprint-hint">Follow the gold marker up the boardwalk</div>
      </div>
    );
  }

  if (sprint.status === 'complete') {
    return (
      <div className="sprint-screen" role="dialog" aria-label="Sunset Sprint complete">
        <h2 className="sprint-screen-title">Sprint complete!</h2>
        <p className="sprint-screen-text">
          {sprint.lastTime !== null && (
            <>
              Finished in <strong>{formatTime(sprint.lastTime)}</strong>
              {sprint.bestTime !== null && (
                <>
                  {' '}· best <strong>{formatTime(sprint.bestTime)}</strong>
                </>
              )}
              <br />
            </>
          )}
          <strong>+${SPRINT_REWARD}</strong> earned
          {sprint.completions > 1 && <> · {sprint.completions} runs finished</>}.
        </p>
        <button type="button" className="play-button" onClick={onClose}>
          Run again
        </button>
        <p className="garage-note">Head back to the gold marker at the south end of the boardwalk to start again.</p>
      </div>
    );
  }

  if (sprint.status === 'failed') {
    const reason =
      sprint.failedReason === 'time'
        ? 'The timer ran out.'
        : sprint.failedReason === 'vehicle'
          ? 'You climbed into a car — the sprint is on foot.'
          : 'You were arrested mid-run.';
    return (
      <div className="sprint-screen" role="dialog" aria-label="Sunset Sprint failed">
        <h2 className="sprint-screen-title">Sprint failed</h2>
        <p className="sprint-screen-text">{reason}</p>
        <button type="button" className="play-button" onClick={onClose}>
          Retry
        </button>
        <p className="garage-note">Head back to the gold marker at the south end of the boardwalk to start again.</p>
      </div>
    );
  }

  return null;
}
