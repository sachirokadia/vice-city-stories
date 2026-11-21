import type { MissionBoardState, MissionKind } from '../game/MissionTypes';
import type { ContractState } from '../game/Contracts';

interface MissionBoardProps {
  board: MissionBoardState;
  /** Pick a mission (or replay a completed one). */
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Combat contracts (Phase 8C), shown in their own section. */
  contracts?: ContractState[];
  /** Accept a combat contract. */
  onAcceptContract?: (id: string) => void;
}

const KIND_LABEL: Record<MissionKind, string> = {
  delivery: 'DELIVERY',
  exploration: 'EXPLORATION',
  tail: 'TAIL',
  escape: 'ESCAPE',
};

/**
 * The mission board: every job in the city, in unlock order, with
 * its type, reward, and status. Selecting a job moves the world
 * marker to it — the player still accepts it at the marker, so
 * the board never starts a run by itself.
 */
export default function MissionBoard({ board, onSelect, onClose, contracts, onAcceptContract }: MissionBoardProps) {
  return (
    <div className="mission-board-overlay" role="dialog" aria-label="Mission board">
      <div className="mission-board">
        <div className="mission-board-header">
          <h2 className="mission-board-title">MISSION BOARD</h2>
          <span className="mission-board-cash" aria-label={`Cash $${board.cash}`}>
            ${board.cash}
          </span>
        </div>
        <p className="mission-board-sub">
          Pick a job — the marker in the city moves to it. Finish one to unlock the next.
        </p>
        <ul className="mission-board-list">
          {board.entries.map((entry) => (
            <li
              key={entry.id}
              className={`mission-board-entry${entry.selected ? ' selected' : ''}${entry.completed ? ' completed' : ''}${!entry.unlocked ? ' locked' : ''}`}
            >
              <div className="mission-board-row">
                <span className="mission-board-name">{entry.title}</span>
                <span className="mission-board-kind">{KIND_LABEL[entry.kind]}</span>
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
                    🔒 Locked — finish {entry.lockedBy ?? 'the previous job'}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="mission-board-button"
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
        {contracts && contracts.length > 0 && (
          <>
            <h3 className="mission-board-section-title">COMBAT CONTRACTS</h3>
            <p className="mission-board-sub">
              Optional work — accept one, then step inside its ring to start. First clear pays
              full cash; replays pay ammo only.
            </p>
            <ul className="mission-board-list contract-board-list">
              {contracts.map((c) => (
                <li
                  key={c.id}
                  className={`mission-board-entry contract-board-entry${c.status === 'active' ? ' active' : ''}${c.status === 'accepted' ? ' selected' : ''}`}
                >
                  <div className="mission-board-row">
                    <span className="mission-board-name">{c.name}</span>
                    <span className="mission-board-kind">
                      {c.kind === 'defense' ? 'DEFENSE' : 'ELIMINATION'}
                    </span>
                    <span className="mission-board-reward">${c.reward}</span>
                  </div>
                  <p className="mission-board-desc">{c.description}</p>
                  <p className="mission-board-giver">
                    From {c.giver} · {c.location}
                  </p>
                  <div className="mission-board-status">
                    {c.status === 'active' && (
                      <span className="mission-board-badge active">● Running now</span>
                    )}
                    {c.status === 'accepted' && (
                      <span className="mission-board-badge selected">◆ Accepted — head to {c.location}</span>
                    )}
                    {c.status === 'cooling' && (
                      <span className="mission-board-badge">↻ Replay in {Math.floor(c.cooldownLeft / 60)}:{String(c.cooldownLeft % 60).padStart(2, '0')}</span>
                    )}
                    {c.status === 'failed' && (
                      <span className="mission-board-badge">✕ Failed — try again</span>
                    )}
                    {c.completedOnce && c.status !== 'cooling' && (
                      <span className="mission-board-badge done">✓ Cleared before</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mission-board-button"
                    disabled={
                      c.status === 'active' || c.status === 'accepted' || c.status === 'cooling'
                    }
                    onClick={() => onAcceptContract?.(c.id)}
                  >
                    {c.status === 'active'
                      ? 'Running now'
                      : c.status === 'accepted'
                        ? 'Accepted ✓'
                        : c.status === 'cooling'
                          ? 'Cooling down'
                          : c.completedOnce
                            ? '↻ Accept again'
                            : 'Accept'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className="hud-button mission-board-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
