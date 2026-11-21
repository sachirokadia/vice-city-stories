import { useEffect, useRef, useState } from 'react';
import type { DialogueState } from '../game/Dialogue';

interface DialoguePanelProps {
  dialogue: DialogueState;
  onAdvance: () => void;
  onChoose: (index: number) => void;
  onSkip: () => void;
}

/**
 * Typewriter pacing (7.7): a 28 ms base interval — about 36
 * characters per second — plus a short pause after punctuation,
 * so sentences breathe instead of running flat. The longest line
 * in the game (211 chars) still reveals in roughly 6–7 s, and
 * the player can always tap to complete it instantly.
 */
const TYPEWRITER_MS = 28;
const SENTENCE_PAUSE_MS = 120;
const CLAUSE_PAUSE_MS = 60;

/** Extra pause after the character just revealed. */
function pauseAfter(ch: string): number {
  if (ch === '.' || ch === '!' || ch === '?') return SENTENCE_PAUSE_MS;
  if (ch === ',' || ch === ';' || ch === ':' || ch === '—' || ch === '…')
    return CLAUSE_PAUSE_MS;
  return 0;
}

/**
 * The dialogue panel — Phase 9C.
 *
 * Bottom-anchored, in the story HUD's teal: a portrait
 * medallion and name plate for the speaker, the line revealed
 * by a typewriter, choice buttons when the node offers them,
 * a Continue indicator, and a Skip button. It is a narrative
 * interface, not a chatbot: no input box, no history, one
 * line at a time.
 *
 * Two-tap Continue (the standard pattern): the first press
 * while the line is still typing completes it instantly; the
 * second advances. Choices appear only once the line is fully
 * shown. Keys: E / Space / Enter continue, 1 / 2 / 3 pick a
 * choice, Esc skips to the end of the conversation.
 *
 * The panel owns its keys while mounted. The engine is paused
 * underneath, so the gameplay key handler (Input.ts) never
 * fires a game action from these presses — and anything it
 * does queue is cleared by engine.start() on resume.
 */
export default function DialoguePanel({
  dialogue,
  onAdvance,
  onChoose,
  onSkip,
}: DialoguePanelProps) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  // 7.1: the timer id and the character counter live in refs, not
  // in the effect's closure. completeLine() must be able to cancel
  // the pending tick and sync the counter — with a closure-local
  // counter the stale tick fired <=33 ms after a complete and
  // re-typed the line from its old position, collapsing the full
  // text back to a few characters.
  const timerRef = useRef(0);
  const indexRef = useRef(0);
  const typing = shown < dialogue.text.length;
  const hasChoices = dialogue.choices !== null && dialogue.choices.length > 0;

  shownRef.current = shown;

  // Typewriter: reveal one character at a time, restarting on
  // every new node. A timeout chain (not an interval) so each
  // step can carry its own punctuation pause (7.7) and so there
  // is exactly one pending timer to cancel on complete (7.1).
  useEffect(() => {
    setShown(0);
    shownRef.current = 0;
    indexRef.current = 0;
    let alive = true;
    const len = dialogue.text.length;
    const tick = () => {
      if (!alive) return;
      indexRef.current += 1;
      const i = indexRef.current;
      setShown(i);
      shownRef.current = i;
      if (i < len) {
        timerRef.current = window.setTimeout(
          tick,
          TYPEWRITER_MS + pauseAfter(dialogue.text[i - 1]),
        );
      }
    };
    if (len > 0) timerRef.current = window.setTimeout(tick, TYPEWRITER_MS);
    return () => {
      alive = false;
      window.clearTimeout(timerRef.current);
    };
  }, [dialogue.nodeId, dialogue.text]);

  // Complete the line instantly (first tap while typing).
  // 7.1: cancel the pending tick AND sync the counter to the
  // full length. Without both, the stale tick re-types the line
  // from where it was and the next press completes it again
  // instead of advancing.
  const completeLine = () => {
    window.clearTimeout(timerRef.current);
    indexRef.current = dialogue.text.length;
    setShown(dialogue.text.length);
    shownRef.current = dialogue.text.length;
  };

  // Continue: first tap completes the line, second advances.
  // Buttons blur themselves after a click so a later Space /
  // Enter cannot re-trigger them (the runtime's 120 ms floor
  // is the second guard against a double advance).
  const handleAdvance = () => {
    if (shownRef.current < dialogue.text.length) {
      completeLine();
      return;
    }
    onAdvance();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleAdvance();
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        // Skip is hidden at choice nodes (9E): the runtime
        // refuses there too, so Esc cannot bypass a decision.
        if (dialogue.canSkip) onSkip();
        return;
      }
      // Choice keys work only once the line is fully shown —
      // the buttons do not exist before then, and neither
      // should the shortcut.
      if (
        hasChoices &&
        shownRef.current >= dialogue.text.length &&
        (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')
      ) {
        const idx = Number(e.code.slice(-1)) - 1;
        if (idx < (dialogue.choices?.length ?? 0)) {
          e.preventDefault();
          onChoose(idx);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // The handler reads the live state through refs and the
    // current props; re-attaching on every typed character
    // would churn the listener 30 times a second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogue.nodeId, hasChoices, dialogue.choices?.length]);

  return (
    <div
      className="dialogue-panel"
      role="dialog"
      aria-label={`Conversation with ${dialogue.speaker}`}
      key={dialogue.nodeId}
    >
      <div className="dialogue-head">
        <span
          className="dialogue-portrait"
          aria-hidden="true"
          style={{ color: dialogue.speakerColor, borderColor: dialogue.speakerColor }}
        >
          {dialogue.speakerInitial}
        </span>
        <span className="dialogue-name" style={{ color: dialogue.speakerColor }}>
          {dialogue.speaker}
        </span>
        {dialogue.progress && (
          <span className="dialogue-progress" aria-label={`Line ${dialogue.progress.node} of ${dialogue.progress.total}`}>
            {dialogue.progress.node} / {dialogue.progress.total}
          </span>
        )}
        {dialogue.canSkip && (
          <button
            type="button"
            className="dialogue-skip"
            onClick={(e) => {
              e.currentTarget.blur();
              onSkip();
            }}
            aria-label="Skip conversation (Escape)"
          >
            Skip ⏭
          </button>
        )}
      </div>

      <p className="dialogue-text">{dialogue.text.slice(0, shown)}</p>

      {hasChoices && !typing && dialogue.choices && (
        <div className="dialogue-choices" role="group" aria-label="Your response">
          {dialogue.choices.map((choice, i) => (
            <button
              key={`${dialogue.nodeId}-choice-${i}`}
              type="button"
              className="dialogue-choice"
              onClick={(e) => {
                e.currentTarget.blur();
                onChoose(i);
              }}
            >
              <span className="dialogue-choice-key" aria-hidden="true">
                {i + 1}
              </span>
              {choice.text}
            </button>
          ))}
        </div>
      )}

      {!hasChoices && (
        <div className="dialogue-foot">
          <span className="dialogue-hint" aria-hidden="true">
            E / Space to {typing ? 'show full line' : 'continue'}
          </span>
          <button
            type="button"
            className="dialogue-continue"
            onClick={(e) => {
              e.currentTarget.blur();
              handleAdvance();
            }}
          >
            {typing ? '▸ Show line' : 'Continue ▸'}
          </button>
        </div>
      )}
    </div>
  );
}
