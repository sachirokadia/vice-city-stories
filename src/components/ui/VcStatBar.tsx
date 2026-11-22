export type VcStatBarTone = 'default' | 'job' | 'story' | 'cash' | 'danger';

export interface VcStatBarProps {
  /** Current value. */
  value: number;
  /** Maximum value (default 100). */
  max?: number;
  /** Optional label shown to the left of the bar. */
  label?: string;
  /** Optional value text shown to the right (tabular numerals). */
  display?: string;
  tone?: VcStatBarTone;
  className?: string;
}

/**
 * VcStatBar — reusable progress/statistic bar. The fill width is the only
 * dynamic part; the meaning of the value stays with the caller (speed,
 * health, upgrade level, loading progress…).
 */
export function VcStatBar({ value, max = 100, label, display, tone = 'default', className }: VcStatBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const cls = ['vc-statbar', `vc-statbar--${tone}`];
  if (className) cls.push(className);
  return (
    <div className={cls.join(' ')}>
      {label ? <span className="vc-statbar-label">{label}</span> : null}
      <div
        className="vc-statbar-track"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className="vc-statbar-fill" style={{ width: `${pct}%` }} />
      </div>
      {display ? <span className="vc-statbar-value">{display}</span> : null}
    </div>
  );
}
