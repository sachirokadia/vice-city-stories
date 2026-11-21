import type { StoryHudState } from '../game/StoryTypes';

interface StoryCompleteScreenProps {
  story: StoryHudState;
  onContinue: () => void;
  onReplay: () => void;
}

/** The reward screen after a story mission is finished. */
export default function StoryCompleteScreen({
  story,
  onContinue,
  onReplay,
}: StoryCompleteScreenProps) {
  return (
    <div className="mission-complete-overlay story-complete-overlay" role="dialog" aria-label="Story mission complete">
      <div className="mission-complete-vignette" aria-hidden="true" />
      <div className="mission-complete-content">
        <h2 className="mission-complete-title">STORY COMPLETE</h2>
        <p className="mission-complete-message">
          {story.chapterTitle} — {story.title}
        </p>
        <p className="mission-complete-reward" aria-label={`Reward $${story.reward}`}>
          +${story.reward}
        </p>
        <p className="mission-complete-sub">Cash balance: ${story.cash}</p>
        {story.ending && (
          <p className="mission-complete-sub">
            Ending: {story.ending === 'mara' ? 'Mara — the city keeps its secrets' : 'June — the city learns the truth'}
          </p>
        )}
        {story.ending && (
          <p className="mission-complete-sub">Replaying Sunset Run can change the ending.</p>
        )}
        <div className="mission-complete-actions">
          <button
            type="button"
            className="play-button mission-complete-continue story-complete-continue"
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
