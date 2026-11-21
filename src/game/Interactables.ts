/**
 * The world-interaction registry — one central place where world
 * objects register themselves as interactable, so the engine can
 * find the nearest valid one, show only its prompt, and fire its
 * callback exactly once per E press.
 *
 * An entry is available when its `available()` says so (the store
 * is always open; the sprint start is closed while a sprint is
 * running). The registry never decides priority — the engine's
 * E chain does that (mission, then garage, then the nearest
 * registered interactable, then the car).
 */
export interface InteractableDef {
  /** Unique id, e.g. 'sunset-mart'. */
  id: string;
  /** Display name for the prompt, e.g. 'Sunset Mart'. */
  name: string;
  /** World position (x east, z south). */
  x: number;
  z: number;
  /** How close the player must be (units). */
  radius: number;
  /** The prompt verb, e.g. 'Enter Sunset Mart'. */
  prompt: string;
  /** Whether interaction is available right now. */
  available: () => boolean;
  /** What happens on E / the touch button. */
  onInteract: () => void;
}

export interface NearestInteractable {
  id: string;
  name: string;
  prompt: string;
}

export class InteractionRegistry {
  private entries = new Map<string, InteractableDef>();

  register(def: InteractableDef): void {
    this.entries.set(def.id, def);
  }

  unregister(id: string): void {
    this.entries.delete(id);
  }

  /** The closest available entry within its radius, or null. */
  nearest(x: number, z: number): NearestInteractable | null {
    let best: InteractableDef | null = null;
    let bestD = Infinity;
    for (const e of this.entries.values()) {
      if (!e.available()) continue;
      const d = Math.hypot(x - e.x, z - e.z);
      if (d < e.radius && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best ? { id: best.id, name: best.name, prompt: best.prompt } : null;
  }

  /** Fire one entry's callback (false when it is not available). */
  interact(id: string): boolean {
    const e = this.entries.get(id);
    if (!e || !e.available()) return false;
    e.onInteract();
    return true;
  }
}
