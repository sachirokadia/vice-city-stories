import { useEffect } from 'react';
import type { CinematicState } from '../game/CinematicTypes';

interface CinematicOverlayProps {
  cinematic: CinematicState;
  /** A dialogue is open inside the scene: hide the skip control
   * (the conversation finishes first, then the skip works again). */
  dialogueOpen: boolean;
  onSkip: () => void;
}

/**
 * The cinematic overlay — Phase 9D.
 *
 * Letterbox bars top and bottom, a title card on the first
 * shot, the current shot's narration as a subtitle, shot
 * progress dots, and a Skip button. It is a cinema frame
 * around the live 3D scene, not a slideshow: the camera is
 * moving behind it.
 *
 * The overlay owns Esc while mounted (gated on !dialogueOpen,
 * so it can never skip out from under a conversation inside
 * the scene). The Skip button is a real button, so touch
 * works the same as a mouse. The container ignores pointer
 * events — only the button is clickable — so a tap on the
 * letterbox can never swallow a game input.
 */
export default function CinematicOverlay({
  cinematic,
  dialogueOpen,
  onSkip,
}: CinematicOverlayProps) {
  useEffect(() => {
    if (dialogueOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogueOpen, onSkip]);

  return (
    <div className="cinematic-overlay" aria-label={`Cinematic: ${cinematic.title}`}>
      <div className="cinematic-bar cinematic-bar-top" aria-hidden="true" />
      <div className="cinematic-bar cinematic-bar-bottom" aria-hidden="true" />

      {cinematic.shotIndex === 0 && (
        <div className="cinematic-title" key={cinematic.cinematicId}>
          {cinematic.chapter && <div className="cinematic-chapter">{cinematic.chapter}</div>}
          <div className="cinematic-title-text">{cinematic.title}</div>
        </div>
      )}

      {cinematic.narration && (
        <div className="cinematic-narration" key={`${cinematic.cinematicId}-${cinematic.shotIndex}`}>
          {cinematic.narration}
        </div>
      )}

      <div className="cinematic-progress" aria-label={`Shot ${cinematic.shotIndex + 1} of ${cinematic.shotCount}`}>
        {Array.from({ length: cinematic.shotCount }, (_, i) => (
          <span
            key={i}
            className={i === cinematic.shotIndex ? 'cinematic-dot on' : 'cinematic-dot'}
          />
        ))}
      </div>

      {!dialogueOpen && (
        <button
          type="button"
          className="cinematic-skip"
          onClick={(e) => {
            e.currentTarget.blur();
            onSkip();
          }}
        >
          Skip ▸▸
        </button>
      )}
    </div>
  );
}
