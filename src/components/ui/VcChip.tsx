import type { ReactNode } from 'react';
import { VcIcon, type VcIconName } from './VcIcon';

export type VcChipTone = 'default' | 'job' | 'story' | 'cash' | 'danger';
export type VcChipVariant = 'status' | 'count' | 'info';

export interface VcChipProps {
  variant?: VcChipVariant;
  tone?: VcChipTone;
  icon?: VcIconName;
  className?: string;
  children: ReactNode;
}

/**
 * VcChip — compact pill for counts, cash, status and short information.
 * Pills survive only here (and for tiny badges); panels and buttons use
 * the angular radius scale instead.
 */
export function VcChip({ variant = 'info', tone = 'default', icon, className, children }: VcChipProps) {
  const cls = ['vc-chip', `vc-chip--${variant}`, `vc-chip--${tone}`];
  if (className) cls.push(className);
  return (
    <span className={cls.join(' ')}>
      {icon ? <VcIcon name={icon} size={14} /> : null}
      <span className="vc-chip-label">{children}</span>
    </span>
  );
}
