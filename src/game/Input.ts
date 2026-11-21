/**
 * Shared input state — the single bridge between React UI
 * (keyboard, touch joystick, look-drag) and the game engine.
 * The engine reads this every frame; React never touches Three.js.
 */

export interface InputState {
  /** WASD / arrows, as a -1..1 vector (x = strafe, y = forward). */
  moveX: number;
  moveY: number;
  /** Touch joystick vector, -1..1. Overrides keys while active. */
  joyX: number;
  joyY: number;
  joyActive: boolean;
  sprint: boolean;
  /** Space held — the handbrake while driving. */
  handbrake: boolean;
  /** Set on a fresh E press; the engine consumes it once per frame. */
  interactQueued: boolean;
  /** Set on a fresh F press (surrender); the engine consumes it once. */
  surrenderQueued: boolean;
  /** Set on a fresh R press (reload); the engine consumes it once. */
  reloadQueued: boolean;
  /** Set on a fresh 1 / 2 press; the engine consumes it once. */
  switchToWeapon: string | null;
  /** Set on a fresh Q press (cycle weapon); the engine consumes it once. */
  cycleWeaponQueued: boolean;
  /** Accumulated look delta (pixels) since the last frame consumed it. */
  lookDX: number;
  lookDY: number;
}

export function createInputState(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    joyX: 0,
    joyY: 0,
    joyActive: false,
    sprint: false,
    handbrake: false,
    interactQueued: false,
    surrenderQueued: false,
    reloadQueued: false,
    switchToWeapon: null,
    cycleWeaponQueued: false,
    lookDX: 0,
    lookDY: 0,
  };
}

const KEY_MAP: Record<string, { x: number; y: number }> = {
  KeyW: { x: 0, y: 1 },
  ArrowUp: { x: 0, y: 1 },
  KeyS: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * Attaches keyboard listeners. Returns a detach function.
 * Pointer-lock mouse-look is handled by the engine (it owns the canvas);
 * touch look is fed in by the HUD through `addLook`.
 */
export function attachKeyboard(input: InputState): () => void {
  const pressed = new Set<string>();

  const recompute = () => {
    let x = 0;
    let y = 0;
    for (const code of pressed) {
      const m = KEY_MAP[code];
      if (m) {
        x += m.x;
        y += m.y;
      }
    }
    const len = Math.hypot(x, y);
    input.moveX = len > 1 ? x / len : x;
    input.moveY = len > 1 ? y / len : y;
    input.sprint = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // Don't hijack typing in a form field.
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'KeyE' && !e.repeat) {
      // Enter / exit vehicle — queued once per press, never on repeat.
      input.interactQueued = true;
      return;
    }
    if (e.code === 'KeyF' && !e.repeat) {
      // Surrender to the police — queued once per press.
      input.surrenderQueued = true;
      return;
    }
    if (e.code === 'KeyR' && !e.repeat) {
      // Reload the equipped weapon — queued once per press.
      input.reloadQueued = true;
      return;
    }
    if (e.code === 'Digit1' && !e.repeat) {
      input.switchToWeapon = 'palm-9';
      return;
    }
    if (e.code === 'Digit2' && !e.repeat) {
      input.switchToWeapon = 'vanguard-carbine';
      return;
    }
    if (e.code === 'KeyQ' && !e.repeat) {
      // Cycle to the next owned weapon — queued once per press.
      input.cycleWeaponQueued = true;
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      input.handbrake = true;
      return;
    }
    if (KEY_MAP[e.code] || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
      pressed.add(e.code);
      recompute();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') input.handbrake = false;
    pressed.delete(e.code);
    recompute();
  };
  const onBlur = () => {
    pressed.clear();
    input.handbrake = false;
    recompute();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    pressed.clear();
    input.moveX = 0;
    input.moveY = 0;
    input.sprint = false;
    input.handbrake = false;
    input.interactQueued = false;
    input.surrenderQueued = false;
    input.reloadQueued = false;
    input.switchToWeapon = null;
    input.cycleWeaponQueued = false;
  };
}

export function addLook(input: InputState, dx: number, dy: number): void {
  input.lookDX += dx;
  input.lookDY += dy;
}

/** Effective movement vector for this frame (joystick wins while active). */
export function effectiveMove(input: InputState): { x: number; y: number; sprint: boolean } {
  if (input.joyActive) {
    return { x: input.joyX, y: -input.joyY, sprint: input.sprint };
  }
  return { x: input.moveX, y: input.moveY, sprint: input.sprint };
}
