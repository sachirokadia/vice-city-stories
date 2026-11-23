/**
 * Shared toast — transient feedback for real game events (purchase
 * success, insufficient funds, wanted level up, collectible found).
 * Ported from the Lovable frontend's Toast treatment: fixed
 * top-centre glass panel, tone variants, icon in a bordered square.
 * The text is always a real game outcome — never a mock value.
 *
 * Entrance is transform-only (see tokens.css): the toast slides in
 * from above; its base opacity is always 1, so a stalled animation
 * can never leave it invisible. Auto-dismiss (~3.4s) is owned by
 * GameCanvas. pointer-events: none — a toast never blocks input.
 */
import { VcIcon } from './ui/VcIcon';

export type ToastTone = 'success' | 'danger' | 'amber';

export interface ToastData {
  message: string;
  tone: ToastTone;
}

const TONE_ICON: Record<ToastTone, 'check' | 'warning' | 'spark'> = {
  success: 'check',
  danger: 'warning',
  amber: 'spark',
};

export default function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div className={`vc-toast vc-toast--${toast.tone}`} role="status" aria-live="polite">
      <span className="vc-toast__icon">
        <VcIcon name={TONE_ICON[toast.tone]} size={16} />
      </span>
      <span className="vc-toast__message">{toast.message}</span>
    </div>
  );
}
