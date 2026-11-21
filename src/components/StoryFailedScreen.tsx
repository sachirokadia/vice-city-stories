import type { StoryHudState } from '../game/StoryTypes';

interface StoryFailedScreenProps {
  story: StoryHudState;
  onRetry: () => void;
  onRetryCheckpoint: () => void;
  onClose: () => void;
}

/** The failure screen after a story mission is lost. */
export default function StoryFailedScreen({
  story,
  onRetry,
  onRetryCheckpoint,
  onClose,
}: StoryFailedScreenProps) {
  const reason =
    story.failedReason === 'timer'
      ? 'The window closed — the run ran out of time.'
      : story.failedReason === 'busted'
        ? 'The police caught you mid-story.'
        : story.failedReason === 'downed'
          ? 'You were taken down mid-story.'
          : story.failedReason === 'objective-destroyed'
            ? 'The objective was destroyed.'
            : story.failedReason === 'target-escaped'
              ? 'The target slipped away.'
              : story.failedReason === 'lost'
                ? 'The target slipped away — the tail is over.'
                : story.failedReason === 'spotted'
                  ? 'The target made you — the tail is blown.'
                  : 'The story mission ended.';
  return (
    <div className="mission-failed-overlay story-failed-overlay" role="dialog" aria-label="Story mission failed">
      <div className="mission-failed-vignette" aria-hidden="true" />
      <div className="mission-failed-content">
        <h2 className="mission-failed-title">STORY FAILED</h2>
        <p className="mission-failed-message">{story.title}</p>
        <p className="mission-failed-sub">{reason}</p>
        <div className="mission-failed-actions">
          {story.hasCheckpoint && (
            <button
              type="button"
              className="play-button mission-failed-retry story-failed-retry-checkpoint"
              onClick={onRetryCheckpoint}
            >
              ↻ Retry from checkpoint
            </button>
          )}
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
