import type { StoryBoardState } from '../game/StoryTypes';

interface StoryBoardProps {
  board: StoryBoardState;
  /** Pick a mission (or replay a completed one). */
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * The story board: the campaign, chapter by chapter, with each
 * mission's giver, reward and status. Selecting a mission moves
 * the teal marker to it — the player still accepts it at the
 * marker, so the board never starts a run by itself. While
 * another activity is running, selection is still allowed but
 * the note explains that the mission cannot be accepted yet.
 */
export default function StoryBoard({ board, onSelect, onClose }: StoryBoardProps) {
  return (
    <div className="mission-board-overlay story-board-overlay" role="dialog" aria-label="Story board">
      <div className="mission-board story-board">
        <div className="mission-board-header">
          <h2 className="mission-board-title">VICE CITY STORIES</h2>
          <span className="mission-board-cash" aria-label={`Cash $${board.cash}`}>
            ${board.cash}
          </span>
        </div>
        <p className="mission-board-sub">
          The story campaign — play it in order, one chapter at a time. Pick a mission and the
          teal marker in the city moves to it.
        </p>
        {board.ending && (
          <p className="story-board-ending">
            Campaign complete — ending: {board.ending === 'mara' ? 'Mara' : 'June'}. Replaying Sunset Run can change it.
          </p>
        )}
        {board.blocked && (
          <p className="story-board-blocked">
            A job or contract is running — finish it first, then accept a story mission.
          </p>
        )}
        {board.chapters.map((chapter) => (
          <div key={chapter.id} className="story-board-chapter">
            <h3 className="mission-board-section-title story-board-chapter-title">
              CHAPTER {chapter.id.replace('chapter-', '')} — {chapter.title.toUpperCase()}
            </h3>
            <p className="mission-board-sub">{chapter.description}</p>
            <ul className="mission-board-list">
              {chapter.entries.map((entry) => (
                <li
                  key={entry.id}
                  className={`mission-board-entry story-board-entry${entry.selected ? ' selected' : ''}${entry.completed ? ' completed' : ''}${!entry.unlocked ? ' locked' : ''}`}
                >
                  <div className="mission-board-row">
                    <span className="mission-board-name">{entry.title}</span>
                    <span className="mission-board-kind">STORY</span>
                    <span className="mission-board-reward">${entry.reward}</span>
                  </div>
                  <p className="mission-board-desc">{entry.description}</p>
                  <p className="mission-board-giver">From {entry.giver}</p>
                  <div className="mission-board-status">
                    {entry.completed && <span className="mission-board-badge done">✓ Completed</span>}
                    {entry.active && <span className="mission-board-badge active">● Active now</span>}
                    {entry.selected && !entry.active && (
                      <span className="mission-board-badge selected">◆ Selected</span>
                    )}
                    {!entry.unlocked && (
                      <span className="mission-board-badge locked">
                        🔒 Locked — finish {entry.lockedBy ?? 'the previous mission'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mission-board-button story-board-button"
                    disabled={!entry.unlocked || entry.active || entry.selected}
                    onClick={() => onSelect(entry.id)}
                  >
                    {entry.active
                      ? 'Running now'
                      : entry.selected
                        ? 'Selected ✓'
                        : entry.completed
                          ? '↻ Replay'
                          : 'Select'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button type="button" className="hud-button mission-board-close story-board-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
