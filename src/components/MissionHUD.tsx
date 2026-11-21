import type { MissionHudState } from '../game/MissionTypes';

interface MissionHudProps {
  mission: MissionHudState;
  onAbandon: () => void;
}

/**
 * The mission card: title, cash, current objective with a
 * direction arrow and live distance, the countdown, and the
 * abandon button. Renders only while a mission is available or
 * running — the complete / failed screens take over after that.
 */
export default function MissionHUD({ mission, onAbandon }: MissionHudProps) {
  if (mission.state !== 'available' && mission.state !== 'active') return null;
  const urgent = mission.timeLeft !== null && mission.timeLeft <= 15;
  const minutes = mission.timeLeft === null ? 0 : Math.floor(mission.timeLeft / 60);
  const seconds = mission.timeLeft === null ? 0 : mission.timeLeft % 60;
  return (
    <div className="mission-hud" aria-label={`Mission ${mission.title}`}>
      <div className="mission-header">
        <span className="mission-title">{mission.title}</span>
        <span className="mission-cash" aria-label={`Cash $${mission.cash}`}>
          ${mission.cash}
        </span>
      </div>
      <div className="mission-giver">From {mission.giver} · reward ${mission.reward}</div>
      <div className="mission-objective">
        {mission.bearing !== null && mission.distance !== null && (
          <span
            className="mission-arrow"
            aria-hidden="true"
            style={{ transform: `rotate(${mission.bearing}rad)` }}
          >
            ▲
          </span>
        )}
        <span className="mission-objective-text">{mission.objectiveText}</span>
        {mission.distance !== null && (
          <span className="mission-distance">{mission.distance}m</span>
        )}
      </div>
      <div className="mission-progress">
        Objective {Math.min(mission.objectiveIndex + 1, mission.objectiveCount)} /{' '}
        {mission.objectiveCount}
      </div>
      {mission.timeLeft !== null && (
        <div className={`mission-timer${urgent ? ' urgent' : ''}`} aria-label="Time left">
          ⏱ {minutes}:{String(seconds).padStart(2, '0')}
        </div>
      )}
      {mission.flash && <div className="mission-flash">{mission.flash.text}</div>}
      {mission.hint && <div className="mission-hint">{mission.hint}</div>}
      {mission.state === 'active' && (
        <button type="button" className="mission-abandon" onClick={onAbandon}>
          ✕ Abandon mission
        </button>
      )}
    </div>
  );
}
