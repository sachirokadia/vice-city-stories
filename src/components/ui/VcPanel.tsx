import type { ReactNode } from 'react';
import { VcButton } from './VcButton';
import { VcIcon } from './VcIcon';

export interface VcOverlayProps {
  /** Accessible name for the dialog region. */
  label: string;
  /** Optional: clicking the dimmed backdrop calls this. Panels that must
   *  be closed explicitly (gameplay panels) omit it. */
  onBackdropClick?: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * VcOverlay — the one dimming overlay for the whole game.
 * Base state is opacity 1; the fade is a CSS enhancement only (see
 * tokens.css) so a panel can never be invisible because an animation
 * stalled. Stacking comes from --vc-z-overlay.
 */
export function VcOverlay({ label, onBackdropClick, className, children }: VcOverlayProps) {
  const cls = ['vc-overlay'];
  if (className) cls.push(className);
  return (
    <div
      className={cls.join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onBackdropClick ? (e) => {
        if (e.target === e.currentTarget) onBackdropClick();
      } : undefined}
    >
      {children}
    </div>
  );
}

export interface VcPanelProps {
  /** Panel title (display type). Also used as the accessible label. */
  title?: string;
  subtitle?: string;
  /** Shows the ✕ close button; required for dismissible panels. */
  onClose?: () => void;
  /** Extra class for panel-width/accent variants (e.g. vc-panel--story). */
  className?: string;
  children: ReactNode;
}

/**
 * VcPanel — the one panel for the whole game. One surface, one border,
 * one header shape. Screens compose their content inside; they never
 * hand-roll their own overlay, header or close button.
 */
export function VcPanel({ title, subtitle, onClose, className, children }: VcPanelProps) {
  const cls = ['vc-panel'];
  if (className) cls.push(className);
  return (
    <VcOverlay label={title ?? 'Panel'}>
      <div className={cls.join(' ')}>
        {title || onClose ? (
          <div className="vc-panel-head">
            <div className="vc-panel-titles">
              {title ? <h2 className="vc-panel-title">{title}</h2> : null}
              {subtitle ? <p className="vc-panel-subtitle">{subtitle}</p> : null}
            </div>
            {onClose ? (
              <VcButton
                variant="ghost"
                size="sm"
                className="vc-panel-close"
                onClick={onClose}
                aria-label="Close"
              >
                <VcIcon name="close" size={16} />
              </VcButton>
            ) : null}
          </div>
        ) : null}
        <div className="vc-panel-body">{children}</div>
      </div>
    </VcOverlay>
  );
}
