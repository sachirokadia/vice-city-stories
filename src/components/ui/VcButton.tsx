import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { VcIcon, type VcIconName } from './VcIcon';

export type VcButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type VcButtonSize = 'sm' | 'md' | 'lg';

export interface VcButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VcButtonVariant;
  size?: VcButtonSize;
  /** Optional leading icon (rendered before the label). */
  icon?: VcIconName;
  /** Optional trailing icon (rendered after the label, e.g. a chevron). */
  trailingIcon?: VcIconName;
  children: ReactNode;
}

/**
 * VcButton — the one button for the whole game.
 * primary = pink gradient CTA; secondary = dark glass with border;
 * ghost = transparent; danger = red. All variants share typography,
 * dimensions, hover/active/focus-visible/disabled states.
 */
export function VcButton({
  variant = 'secondary',
  size = 'md',
  icon,
  trailingIcon,
  children,
  className,
  type = 'button',
  ...rest
}: VcButtonProps) {
  const cls = ['vc-button', `vc-button--${variant}`, `vc-button--${size}`];
  if (className) cls.push(className);
  return (
    <button type={type} className={cls.join(' ')} {...rest}>
      {icon ? <VcIcon name={icon} size={size === 'lg' ? 20 : 17} /> : null}
      <span className="vc-button-label">{children}</span>
      {trailingIcon ? (
        <VcIcon name={trailingIcon} size={size === 'lg' ? 18 : 15} className="vc-button-trailing" />
      ) : null}
    </button>
  );
}
