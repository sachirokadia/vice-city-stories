/**
 * Character design — per-character visual identity (Phase 1).
 *
 * Plain data only: no Three.js import, so the dialogue registry
 * (StoryCharacters.ts) can carry designs without pulling in the
 * engine, and Character.ts can build from them without a cycle.
 *
 * Every field is optional. Omitted fields fall back to the
 * original Kai build exactly: male-proportioned torso, short
 * hair, trousers, hood and gold chain. The protagonist is never
 * given a design, so his appearance is unchanged by construction.
 *
 * Designs are configurable, not canonical: colours and choices
 * here are a starting direction from the Art Bible, revisable
 * by editing the character's entry in StoryCharacters.ts.
 */

export type HairStyle = 'short' | 'long' | 'bob' | 'bun' | 'shoulder';

export interface CharacterDesign {
  /** Overall height multiplier (root scale). Kai = 1. */
  heightScale?: number;
  /** Shoulder / chest width multiplier. Narrows the torso boxes
   * and pulls the arm pivots in. Kai = 1. */
  shoulderScale?: number;
  /** Hip / pelvis width multiplier. Narrows the pelvis box and
   * pulls the leg pivots in. Kai = 1. */
  hipScale?: number;
  /** Hairstyle geometry. Default 'short' (the original cap). */
  hairStyle?: HairStyle;
  /** Flared skirt over the pelvis instead of the trousers block.
   * The skirt takes the trousers colour; the legs below read as
   * tights in the same colour. */
  skirt?: boolean;
  /** Gold hoop earrings. */
  hoops?: boolean;
  /** Dark shades over the eyes. */
  sunglasses?: boolean;
  /** Gold chain visible. Default true. */
  chain?: boolean;
  /** Hood visible. Default true. */
  hood?: boolean;
  /**
   * Approved portrait asset (later): when set, the dialogue
   * portrait shows this image instead of rendering the model.
   * Never set to an unrelated concept image — the portrait must
   * be the actual character.
   */
  portraitAsset?: string;
}

/** The untouched original build, as an explicit design. */
export const DEFAULT_DESIGN: CharacterDesign = {};
