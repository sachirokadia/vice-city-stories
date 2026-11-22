import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { InputState } from '../game/Input';
import { addLook } from '../game/Input';
import { VcIcon } from './ui/VcIcon';

interface TouchControlsProps {
  input: InputState;
  onSprintChange: (sprint: boolean) => void;
  /** When true, the joystick is replaced by driving controls. */
  driving?: boolean;
  onExitVehicle?: () => void;
}

/**
 * Mobile controls: a virtual joystick (left) and a look-drag
 * area (right) while walking; steering buttons, pedals, handbrake
 * and exit while driving. Rendered only on touch devices. Writes
 * straight into the shared input state the engine reads each frame.
 */
export default function TouchControls({ input, onSprintChange, driving, onExitVehicle }: TouchControlsProps) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const lookRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const updateJoystick = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2 - 8;
    let dx = (clientX - cx) / max;
    let dy = (clientY - cy) / max;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    input.joyX = dx;
    input.joyY = dy;
    input.joyActive = true;
    setKnob({ x: dx * 34, y: dy * 34 });
  };

  const endJoystick = () => {
    pointerIdRef.current = null;
    input.joyX = 0;
    input.joyY = 0;
    input.joyActive = false;
    setKnob({ x: 0, y: 0 });
    setActive(false);
  };

  const onJoyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // A failed capture must never swallow the input itself.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer — the drag still works without capture */
    }
    pointerIdRef.current = e.pointerId;
    setActive(true);
    updateJoystick(e.clientX, e.clientY);
  };
  const onJoyMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    updateJoystick(e.clientX, e.clientY);
  };

  const onLookDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer — the drag still works without capture */
    }
    lookRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onLookMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const l = lookRef.current;
    if (!l || l.id !== e.pointerId) return;
    addLook(input, (e.clientX - l.x) * 1.6, (e.clientY - l.y) * 1.6);
    lookRef.current = { id: l.id, x: e.clientX, y: e.clientY };
  };
  const onLookUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lookRef.current?.id === e.pointerId) lookRef.current = null;
  };

  // --- Driving buttons: held sets feed straight into input state ---
  const steerHeld = useRef<Set<'left' | 'right'>>(new Set());
  const pedalHeld = useRef<Set<'gas' | 'brake'>>(new Set());
  const applySteer = () => {
    input.moveX = steerHeld.current.has('right') ? 1 : steerHeld.current.has('left') ? -1 : 0;
  };
  const applyPedal = () => {
    input.moveY = pedalHeld.current.has('gas') ? 1 : pedalHeld.current.has('brake') ? -1 : 0;
  };
  const holdProps = (onDown: () => void, onUp: () => void) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* no active pointer — the hold still works without capture */
      }
      onDown();
    },
    onPointerUp: onUp,
    onPointerCancel: onUp,
    onPointerLeave: onUp,
  });

  return (
    <>
      <div
        className="touch-look"
        aria-hidden="true"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />
      {driving ? (
        <div className="touch-controls drive-controls">
          <div className="drive-steer">
            <button
              type="button"
              className="drive-btn steer-btn"
              aria-label="Steer left"
              {...holdProps(
                () => {
                  steerHeld.current.add('left');
                  applySteer();
                },
                () => {
                  steerHeld.current.delete('left');
                  applySteer();
                },
              )}
            >
              ◀
            </button>
            <button
              type="button"
              className="drive-btn steer-btn"
              aria-label="Steer right"
              {...holdProps(
                () => {
                  steerHeld.current.add('right');
                  applySteer();
                },
                () => {
                  steerHeld.current.delete('right');
                  applySteer();
                },
              )}
            >
              ▶
            </button>
          </div>
          <div className="drive-pedals">
            <button
              type="button"
              className="drive-btn gas-btn"
              aria-label="Hold to accelerate"
              {...holdProps(
                () => {
                  pedalHeld.current.add('gas');
                  applyPedal();
                },
                () => {
                  pedalHeld.current.delete('gas');
                  applyPedal();
                },
              )}
            >
              GAS
            </button>
            <button
              type="button"
              className="drive-btn brake-btn"
              aria-label="Hold to brake or reverse"
              {...holdProps(
                () => {
                  pedalHeld.current.add('brake');
                  applyPedal();
                },
                () => {
                  pedalHeld.current.delete('brake');
                  applyPedal();
                },
              )}
            >
              BRAKE
            </button>
            <button
              type="button"
              className="drive-btn handbrake-btn"
              aria-label="Hold for handbrake"
              {...holdProps(
                () => {
                  input.handbrake = true;
                },
                () => {
                  input.handbrake = false;
                },
              )}
            >
              <VcIcon name="pause" size={20} />
            </button>
            <button type="button" className="drive-btn exit-btn" aria-label="Exit vehicle" onClick={onExitVehicle}>
              EXIT
            </button>
          </div>
        </div>
      ) : (
        <div className="touch-controls">
          <div
            ref={baseRef}
            className={`joystick ${active ? 'active' : ''}`}
            onPointerDown={onJoyDown}
            onPointerMove={onJoyMove}
            onPointerUp={endJoystick}
            onPointerCancel={endJoystick}
            role="application"
            aria-label="Move joystick"
          >
            <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
          <button
            type="button"
            className="sprint-button"
            aria-label="Hold to sprint"
            onPointerDown={() => onSprintChange(true)}
            onPointerUp={() => onSprintChange(false)}
            onPointerCancel={() => onSprintChange(false)}
            onPointerLeave={() => onSprintChange(false)}
          >
            RUN
          </button>
        </div>
      )}
    </>
  );
}
