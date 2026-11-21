/**
 * Mission types — the data-driven contract for the mission system.
 * A mission is a definition (static data) plus a runtime state
 * machine in the manager. Nothing about a specific mission is
 * hardcoded into the engine; the engine only feeds the manager
 * live game state and renders what the manager reports.
 */

/** One step of a mission, in order. */
export type ObjectiveType =
  | 'reach' // walk/drive within radius of a point
  | 'interact' // press E / tap START within radius of a point
  | 'enterVehicle' // get into the Velocity GT
  | 'checkpoint' // drive through a point (may grant a time bonus)
  | 'deliver' // reach the destination point
  | 'follow' // tail the mission target vehicle in a distance band
  | 'evade'; // stay hidden until the wanted level clears

/** The kind of job, shown on the mission board. */
export type MissionKind = 'delivery' | 'exploration' | 'tail' | 'escape';

/** Distance-band rules for a 'follow' objective. */
export interface FollowParams {
  /** Stay at least this far from the target (units). */
  minDist: number;
  /** Stay at most this far from the target (units). */
  maxDist: number;
  /** Seconds under minDist before the tail is blown ('spotted'). */
  tooCloseSeconds: number;
  /** Seconds over maxDist (after first locking on) before the
   * target is lost ('lost'). */
  tooFarSeconds: number;
  /** How far the target drives (units along its route) before it
   * reaches its destination and the objective completes. */
  routeLength: number;
}

export interface MissionObjectiveDef {
  id: string;
  type: ObjectiveType;
  /** Shown in the HUD while this objective is current. */
  text: string;
  /** World position the objective points at (x, z). */
  target: { x: number; z: number };
  /** Completion radius around the target, in world units. */
  radius: number;
  /** Seconds added to the timer when a checkpoint is hit. */
  timeBonus?: number;
  /** Flash shown in the HUD when this objective completes
   * (e.g. "CLUE FOUND"). */
  flashText?: string;
  /** Distance-band rules — only for 'follow' objectives. */
  follow?: FollowParams;
}

export interface MissionDef {
  id: string;
  title: string;
  /** One line for the HUD card. */
  description: string;
  kind: MissionKind;
  /** Fictional contact who sent the job (no real person). */
  giver: string;
  /** Where the mission marker stands while it is available. */
  startMarker: { x: number; z: number };
  /** Distance at which the mission is discovered. */
  discoveryRadius: number;
  /** Seconds on the clock once the mission is accepted.
   * 0 = untimed (exploration jobs). */
  timeLimit: number;
  /** Virtual cash awarded on completion. */
  reward: number;
  /** Id of the mission that must be completed first; absent =
   * unlocked from the start. */
  unlockAfter?: string;
  /** Heat set on the wanted system when the mission is accepted
   * (only for escape jobs — a controlled wanted level). */
  startHeat?: number;
  /** Objectives in order — the mission is a walk through this list. */
  objectives: MissionObjectiveDef[];
}

/** Runtime state of the one mission the player can run. */
export type MissionRuntimeState =
  | 'idle' // not discovered yet
  | 'available' // discovered, marker waiting
  | 'active' // accepted, objectives running
  | 'complete' // finished, reward paid
  | 'failed'; // timer ran out, or the player was busted

export type MissionFailReason =
  | 'timer'
  | 'busted'
  | 'cancelled'
  | 'lost' // the tail target escaped
  | 'spotted' // the tail target noticed the player
  | null;

/**
 * Everything the HUD needs, reported ~10x a second. The engine
 * never reads mission internals directly — it renders this.
 */
export interface MissionHudState {
  state: MissionRuntimeState;
  missionId: string | null;
  title: string;
  description: string;
  kind: MissionKind;
  giver: string;
  /** Current objective text, or '' when there is none. */
  objectiveText: string;
  objectiveIndex: number;
  objectiveCount: number;
  /** Distance to the current objective, in world units. */
  distance: number | null;
  /** Bearing to the objective, radians relative to the camera. */
  bearing: number | null;
  /** Seconds left on the clock (null when no timer is running). */
  timeLeft: number | null;
  timeLimit: number;
  /** The player's virtual cash balance. */
  cash: number;
  reward: number;
  /** Transient flash message ("CHECKPOINT +15s"), with a timestamp. */
  flash: { text: string; at: number } | null;
  failedReason: MissionFailReason;
  /** The START prompt is showing (player at the marker). */
  prompt: 'accept' | null;
  /** Where the 3D marker currently stands (null = hidden). */
  marker: { x: number; z: number } | null;
  /** Extra live line under the objective (follow band, evade
   * status) — null when the current objective needs none. */
  hint: string | null;
}

/** One row of the mission board. */
export interface MissionBoardEntry {
  id: string;
  title: string;
  description: string;
  kind: MissionKind;
  giver: string;
  reward: number;
  unlocked: boolean;
  /** Title of the mission that unlocks this one (null when open). */
  lockedBy: string | null;
  completed: boolean;
  /** This is the mission the world marker currently belongs to. */
  selected: boolean;
  /** This mission is running right now. */
  active: boolean;
}

export interface MissionBoardState {
  entries: MissionBoardEntry[];
  cash: number;
}
