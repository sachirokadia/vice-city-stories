/**
 * VcIcon — original inline-SVG icon set for the Vice City Stories UI.
 *
 * Line icons on a 24×24 grid, 2px stroke, round caps/joins, currentColor.
 * No emoji anywhere in the interface. Add new icons here (one place) and
 * reference them by name — never paste raw SVG into a screen component.
 */

export type VcIconName =
  | 'play'
  | 'settings'
  | 'missions'
  | 'story'
  | 'outfits'
  | 'cash'
  | 'health'
  | 'weapon'
  | 'star'
  | 'close'
  | 'lock'
  | 'check'
  | 'arrow'
  | 'info'
  | 'pause'
  | 'chevron-right'
  | 'clock'
  | 'warning'
  | 'car'
  | 'coin'
  | 'reload'
  | 'switch'
  | 'circle';

const PATHS: Record<VcIconName, React.ReactNode> = {
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  missions: (
    <>
      <path d="M8.5 6h12M8.5 12h12M8.5 18h12" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  story: (
    <>
      <path d="M2 3.5h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
      <path d="M22 3.5h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
    </>
  ),
  outfits: (
    <path d="M8.5 4 4 6.5 2 10.5l3 1.5L6 11v10h12V11l1 1 3-1.5L20 6.5 15.5 4a3 3 0 0 1-7 0z" />
  ),
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M5.5 9.5h.01M18.5 14.5h.01" />
    </>
  ),
  health: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  weapon: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" />
    </>
  ),
  star: (
    <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  arrow: <path d="M12 19V5M5 12l7-7 7 7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 16v-5M12 8h.01" />
    </>
  ),
  pause: <path d="M9.5 5v14M14.5 5v14" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 22 20H2z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </>
  ),
  car: (
    <>
      <path d="M4 16 5.5 9.5A2 2 0 0 1 7.4 8h9.2a2 2 0 0 1 1.9 1.5L20 16" />
      <path d="M3 16h18v3.5h-2.5M3 16v3.5h2.5" />
      <path d="M6.5 19.5h.01M17.5 19.5h.01" />
      <path d="M7 12.5h10" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
    </>
  ),
  reload: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.3" />
      <path d="M21 3.5V9h-5.5" />
    </>
  ),
  switch: (
    <>
      <path d="M4 7h13l-3.5-3.5M20 17H7l3.5 3.5" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="8" />,
};

export interface VcIconProps {
  name: VcIconName;
  /** px, default 18 */
  size?: number;
  className?: string;
  /** Extra inline style (e.g. transform: rotate(...) for the arrow). */
  style?: React.CSSProperties;
}

export function VcIcon({ name, size = 18, className, style }: VcIconProps) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
