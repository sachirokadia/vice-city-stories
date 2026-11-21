import type { StoryHudState } from '../game/StoryTypes';

interface StoryHudProps {
  story: StoryHudState;
  onAbandon: () => void;
}

/**
 * The story HUD: the chapter, the mission title and cash, the
 * current objective with a direction arrow and live distance,
 * the countdown, the optional-objective checklist, and the
 * abandon button. Same layout as the job-mission HUD, teal
 * instead of yellow. Renders only while a story mission is
 * available or running — the complete / failed screens take
 * over after that.
 */
export default function StoryHUD({ story, onAbandon }: StoryHudProps) {
  if (story.state !== 'available' && story.state !== 'active') return null;
  const urgent = story.timeLeft !== null && story.timeLeft <= 15;
  const minutes = story.timeLeft === null ? 0 : Math.floor(story.timeLeft / 60);
  const seconds = story.timeLeft === null ? 0 : story.timeLeft % 60;
  const pendingOptional = story.optional.filter((o) => !o.done);
  const doneOptional = story.optional.filter((o) => o.done);
  return (
    <div className="mission-hud story-hud" aria-label={`Story mission ${story.title}`}>
      <div className="mission-header">
        <span className="mission-title">{story.title}</span>
        <span className="mission-cash" aria-label={`Cash $${story.cash}`}>
          ${story.cash}
        </span>
      </div>
      <div className="mission-giver">
        {story.chapterTitle} · From {story.giver} · reward ${story.reward}
      </div>
      <div className="mission-objective">
        {story.bearing !== null && story.distance !== null && (
          <span
            className="mission-arrow"
            aria-hidden="true"
            style={{ transform: `rotate(${story.bearing}rad)` }}
          >
            ▲
          </span>
        )}
        <span className="mission-objective-text">{story.objectiveText}</span>
        {story.distance !== null && (
          <span className="mission-distance">{story.distance}m</span>
        )}
      </div>
      <div className="mission-progress">
        Objective {Math.min(story.objectiveIndex + 1, story.objectiveCount)} /{' '}
        {story.objectiveCount}
      </div>
      {story.timeLeft !== null && (
        <div className={`mission-timer${urgent ? ' urgent' : ''}`} aria-label="Time left">
          ⏱ {minutes}:{String(seconds).padStart(2, '0')}
        </div>
      )}
      {story.optional.length > 0 && (
        <div className="story-hud-optional" aria-label="Optional objectives">
          {doneOptional.map((o) => (
            <div key={o.id} className="story-hud-optional-done">
              ✓ {o.text}
            </div>
          ))}
          {pendingOptional.map((o) => (
            <div key={o.id} className="story-hud-optional-pending">
              ○ {o.text}
            </div>
          ))}
        </div>
      )}
      {story.flash && <div className="mission-flash">{story.flash.text}</div>}
      {story.hint && <div className="mission-hint">{story.hint}</div>}
      {story.state === 'active' && (
        <button type="button" className="mission-abandon" onClick={onAbandon}>
          ✕ Abandon mission
        </button>
      )}
    </div>
  );
}
