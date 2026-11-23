/**
 * The dialogue runtime — Phase 9C.
 *
 * A tiny state machine, modelled on the mission manager's shape:
 * idle → open → (advance | choose) → open … → closed. It holds
 * no React and no Three.js state: it walks a dialogue graph
 * from StoryDialogue.ts, fires events through the engine, and
 * reports the current node for the panel to render.
 *
 * Rules (9A §4.3):
 * - The engine is paused while a dialogue is open (the engine
 *   owns that; this runtime only reports open/closed).
 * - `advance()` and `choose()` are the only ways forward. Both
 *   move exactly one step per call, and calls within 120 ms of
 *   the previous transition are ignored — one physical press
 *   can never double-advance, even if the key and the button
 *   both fire.
 * - `skip()` jumps to the end node, fires that node's event,
 *   and closes. Skipping never skips the event. A node with
 *   visible choices cannot be skipped (9E): the decision is
 *   the point, and jumping past it would fire the end event
 *   without the player ever choosing.
 * - Every event fires exactly once: a node is entered once per
 *   run, its event fires on entry, and a choice's event (and
 *   its setsFlag) fires when the choice is picked. A second
 *   call after the state has moved on is a no-op, because the
 *   runtime only acts on the current node.
 * - Invalid or missing references never crash the game: a
 *   missing dialogue, a missing node, or a dialogue with
 *   validation errors logs an error and the dialogue does not
 *   start (or closes, if it is already open).
 * - Conditions: a node whose flag is not set is skipped and
 *   its `next` is followed (at most 10 hops, then the dialogue
 *   closes defensively); a choice whose flag is not set is
 *   hidden from the player. The end node never has a condition
 *   (the validator enforces it), so a dialogue always ends.
 */
import { getDialogue, validateStoryDialogues } from './StoryDialogue';
import type {
  DialogueChoice,
  DialogueDef,
  DialogueEvent,
  DialogueLine,
  DialogueValidation,
} from './StoryDialogue';
import { storyCharacter } from './StoryCharacters';

/** What the panel renders, reported on every transition. */
export interface DialogueState {
  open: boolean;
  dialogueId: string;
  nodeId: string;
  /** Speaker id (e.g. 'mara') — the panel uses it for the
   * portrait; the display name is `speaker`. */
  speakerId: string;
  speaker: string;
  speakerColor: string;
  speakerInitial: string;
  text: string;
  /** Null = Continue button; otherwise the visible choices. */
  choices: Array<{ text: string }> | null;
  canSkip: boolean;
  /** '3 / 7' when the dialogue is linear, null when it branches. */
  progress: { node: number; total: number } | null;
}

export interface DialogueDeps {
  /** Is this campaign flag set? (drives conditions.) */
  hasFlag: (flag: string) => boolean;
  /** Carry out a dialogue event (engine-owned). */
  onEvent: (event: DialogueEvent) => void;
  /** The dialogue closed — the engine resumes here. */
  onClose: () => void;
  /** The state changed — report it to React here. */
  onReport: () => void;
}

export interface DialogueHandle {
  start: (dialogueId: string) => boolean;
  advance: () => void;
  choose: (index: number) => void;
  skip: () => void;
  getState: () => DialogueState | null;
  isOpen: () => boolean;
  validateAll: () => DialogueValidation;
  dispose: () => void;
}

/** One physical press must never advance twice. */
const TRANSITION_FLOOR_MS = 120;
/** A runaway condition chain (or a cycle) closes the dialogue. */
const MAX_VISITS = 50;
const MAX_CONDITION_HOPS = 10;

export function createDialogue(deps: DialogueDeps): DialogueHandle {
  const validation = validateStoryDialogues();
  if (validation.errors.length > 0) {
    for (const err of validation.errors) {
      console.error(`[dialogue] ${err}`);
    }
  }
  for (const warn of validation.warnings) {
    console.warn(`[dialogue] ${warn}`);
  }

  let current: DialogueDef | null = null;
  let node: DialogueLine | null = null;
  let visits = 0;
  let lastTransitionAt = 0;
  let disposed = false;

  /** Choices the player can see right now (conditions applied). */
  const visibleChoices = (line: DialogueLine): DialogueChoice[] => {
    const all = line.choices ?? [];
    return all.filter((c) => !c.condition || deps.hasFlag(c.condition));
  };

  const buildState = (): DialogueState | null => {
    if (!current || !node) return null;
    const speaker = storyCharacter(node.speaker);
    const choices = visibleChoices(node);
    const linear = current.nodes.every(
      (n) => (n.choices?.length ?? 0) === 0,
    );
    return {
      open: true,
      dialogueId: current.id,
      nodeId: node.id,
      speakerId: node.speaker,
      speaker: speaker.name,
      speakerColor: speaker.color,
      speakerInitial: speaker.initial,
      text: node.text,
      choices: choices.length > 0 ? choices.map((c) => ({ text: c.text })) : null,
      // A choice node cannot be skipped (9E): the decision is
      // the point — skipping would fire the end event without
      // the player ever choosing. The panel hides Skip here.
      canSkip: choices.length === 0,
      progress: linear ? { node: visits, total: current.nodes.length } : null,
    };
  };

  const report = (): void => {
    deps.onReport();
  };

  const close = (): void => {
    if (!current) return;
    current = null;
    node = null;
    report();
    deps.onClose();
  };

  /** Enter a node: resolve conditions, fire its event, report. */
  const enterNode = (id: string): void => {
    if (!current) return;
    let target = current.nodes.find((n) => n.id === id);
    if (!target) {
      console.error(`[dialogue] node '${id}' does not exist in '${current.id}' — closing`);
      close();
      return;
    }
    // A conditioned node that does not apply is skipped: follow
    // its `next` (bounded, so a bad chain closes instead of looping).
    let hops = 0;
    while (target.condition && !deps.hasFlag(target.condition)) {
      if (!target.next || hops >= MAX_CONDITION_HOPS) {
        console.error(
          `[dialogue] conditioned node '${target.id}' has nowhere to go — closing`,
        );
        close();
        return;
      }
      hops += 1;
      const next = current.nodes.find((n) => n.id === target?.next);
      if (!next) {
        console.error(`[dialogue] node '${target.next}' does not exist in '${current.id}' — closing`);
        close();
        return;
      }
      target = next;
    }
    node = target;
    visits += 1;
    if (visits > MAX_VISITS) {
      console.error(`[dialogue] too many nodes in one run — closing`);
      close();
      return;
    }
    // The node's event fires on entry, exactly once per visit.
    if (node.event) deps.onEvent(node.event);
    report();
  };

  const tooSoon = (): boolean =>
    performance.now() - lastTransitionAt < TRANSITION_FLOOR_MS;

  return {
    start(dialogueId: string): boolean {
      if (disposed || current) return false;
      const def = getDialogue(dialogueId);
      if (!def) {
        console.error(`[dialogue] unknown dialogue '${dialogueId}'`);
        return false;
      }
      const hasErrors = validation.errors.some((e) =>
        e.startsWith(`dialogue '${dialogueId}'`),
      );
      if (hasErrors) {
        console.error(`[dialogue] '${dialogueId}' has validation errors — refusing to start`);
        return false;
      }
      current = def;
      node = null;
      visits = 0;
      lastTransitionAt = 0;
      enterNode(def.start);
      return current !== null;
    },

    advance(): void {
      if (!current || !node || tooSoon()) return;
      // A node with choices waits for a pick, never a Continue.
      if (visibleChoices(node).length > 0) return;
      if (node.end === true) {
        lastTransitionAt = performance.now();
        close();
        return;
      }
      if (!node.next) {
        console.error(`[dialogue] node '${node.id}' has no next — closing`);
        close();
        return;
      }
      lastTransitionAt = performance.now();
      enterNode(node.next);
    },

    choose(index: number): void {
      if (!current || !node || tooSoon()) return;
      const choices = visibleChoices(node);
      const choice = choices[index];
      if (!choice) return;
      lastTransitionAt = performance.now();
      // The choice's flag is set first, then its event — the
      // event sees the flag already set.
      if (choice.setsFlag) {
        deps.onEvent({ type: 'setFlag', flag: choice.setsFlag, value: true });
      }
      if (choice.event) deps.onEvent(choice.event);
      enterNode(choice.next);
    },

    skip(): void {
      if (!current || tooSoon()) return;
      // A choice node cannot be skipped (9E): jumping to the
      // end would fire its event without the player ever
      // choosing — the finale's ending, Rook's job. The panel
      // hides Skip here, but the runtime refuses too, so a
      // keyboard skip cannot bypass a decision either.
      if (node && visibleChoices(node).length > 0) return;
      lastTransitionAt = performance.now();
      // Jump to the end node, fire its event, and close. The
      // event is never skipped, so the mission still continues.
      const end = current.nodes.find((n) => n.end === true);
      if (end?.event) deps.onEvent(end.event);
      close();
    },

    getState: buildState,

    isOpen: () => current !== null,

    validateAll: () => validation,

    dispose(): void {
      disposed = true;
      current = null;
      node = null;
    },
  };
}
