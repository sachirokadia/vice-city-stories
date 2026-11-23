/**
 * Story characters — the dialogue-facing registry (Phase 9C).
 *
 * A speaker id resolves to a display name, a name-plate colour
 * and an initial for the portrait medallion. This is the small
 * end of the StoryCharacters plan in the 9A proposal; the
 * cinematic half (palettes, stage positions, poses) arrives
 * with 9D and will extend this file, not replace it.
 *
 * Nothing here imports Three.js or React, so dialogue data can
 * be read (and validated) without starting the engine.
 */

import type { CharacterDesign } from './CharacterDesign';

export interface StoryCharacterInfo {
  id: string;
  /** Display name, as shown on the dialogue name plate. */
  name: string;
  /** Name-plate and medallion colour. */
  color: string;
  /** One letter for the portrait medallion. */
  initial: string;
  /** Procedural-model palette (9D staging): the colours the
   * shared character rig is recoloured with for this person.
   * Kai keeps the rig's defaults (grey hoodie, gold chain). */
  palette?: {
    jacket: string;
    shirt: string;
    trousers: string;
    hair: string;
    skin?: string;
  };
  /**
   * Visual identity (Phase 1): body proportions, hairstyle,
   * clothing silhouette and accessories. Omitted = the original
   * Kai build. Mara, June, Dana and Lena carry a design, and
   * every speaking male lead does too (Phase 2 character work).
   */
  design?: CharacterDesign;
}

export const STORY_CHARACTERS: Record<string, StoryCharacterInfo> = {
  kai: { id: 'kai', name: 'Kai Reyes', color: '#ffd23e', initial: 'K' },
  mara: {
    id: 'mara',
    name: 'Mara Voss',
    color: '#2dd4bf',
    initial: 'M',
    palette: { jacket: '#c22e6e', shirt: '#d8d2c4', trousers: '#2e3138', hair: '#3a2a1a' },
    // Phase 1: long dark hair, gold hoops, fuchsia jacket — the
    // Art Bible direction. No hood, no chain: the hoops are her
    // jewellery now.
    design: { heightScale: 0.98, shoulderScale: 0.86, hipScale: 0.92, hairStyle: 'long', hoops: true, chain: false, hood: false },
  },
  rico: {
    id: 'rico',
    name: 'Rico Hale',
    color: '#f59e0b',
    initial: 'R',
    palette: { jacket: '#9a5b1e', shirt: '#26262a', trousers: '#33302a', hair: '#14100c' },
    // Phase 2 character work: tallest and broadest of the men,
    // hood up, gold chain — the dockside fixer who looks it.
    design: { heightScale: 1.02, shoulderScale: 1.05, hipScale: 1.0, hood: true, chain: true },
  },
  june: {
    id: 'june',
    name: 'June Park',
    color: '#a78bfa',
    initial: 'J',
    palette: { jacket: '#6d5bd0', shirt: '#e8e6e0', trousers: '#2e3138', hair: '#14100c' },
    // Phase 1: chin-length bob and a dark skirt — a different
    // silhouette from Mara's long hair and trousers, and the
    // shortest of the three leads.
    design: { heightScale: 0.96, shoulderScale: 0.84, hipScale: 0.94, hairStyle: 'bob', skirt: true, chain: false, hood: false },
  },
  // --- 9E: Chapter 2–3 cast ---------------------------------------------
  vic: {
    id: 'vic',
    name: 'Vic Marino',
    color: '#e2725b',
    initial: 'V',
    palette: { jacket: '#7c5a3a', shirt: '#e8e6e0', trousers: '#2e3138', hair: '#4a3728' },
    // Phase 2 character work: broad-shouldered, no hood, no
    // chain — a driver who dresses like one.
    design: { heightScale: 1.0, shoulderScale: 0.98, hipScale: 0.98, hood: false, chain: false },
  },
  dana: {
    id: 'dana',
    name: 'Dana Cole',
    color: '#38bdf8',
    initial: 'D',
    palette: { jacket: '#1e3a5f', shirt: '#f2f2f2', trousers: '#1c1c22', hair: '#14100c' },
    // Phase 1: hair in a bun, dark shades, navy jacket — the
    // tallest of the three leads, and the only one in shades.
    design: { heightScale: 0.99, shoulderScale: 0.88, hipScale: 0.9, hairStyle: 'bun', sunglasses: true, chain: false, hood: false },
  },
  rook: {
    id: 'rook',
    name: 'Rook Calloway',
    color: '#84cc16',
    initial: 'R',
    palette: { jacket: '#3f4a2a', shirt: '#26262a', trousers: '#33302a', hair: '#2a2018' },
    // Phase 2 character work: hood up, no chain, slightly
    // narrower hips — the quiet one at the dockside table.
    design: { heightScale: 1.01, shoulderScale: 1.0, hipScale: 0.96, hood: true, chain: false },
  },
  silas: {
    id: 'silas',
    name: 'Silas Crane',
    color: '#f43f5e',
    initial: 'S',
    palette: { jacket: '#3b3b48', shirt: '#e8e6e0', trousers: '#23232c', hair: '#6b6b6b' },
    // Phase 2 character work: narrow shoulders, no hood, no
    // chain — grey hair already in the palette; the antagonist
    // reads older and leaner than the crew.
    design: { heightScale: 1.0, shoulderScale: 0.94, hipScale: 0.96, hood: false, chain: false },
  },
  // Vera Kwan is named, never staged and never speaks — she hires
  // people and lies about the job, which is the whole story.
  vera: { id: 'vera', name: 'Vera Kwan', color: '#ec4899', initial: 'V' },
  theo: {
    id: 'theo',
    name: 'Theo Ashford',
    color: '#94a3b8',
    initial: 'T',
    palette: { jacket: '#57534e', shirt: '#26262a', trousers: '#33302a', hair: '#6b6b6b' },
    // Phase 2 character work: hood up, narrow shoulders, grey
    // hair in the palette — the mechanic, not a frontman.
    design: { heightScale: 0.99, shoulderScale: 0.92, hipScale: 0.94, hood: true, chain: false },
  },
  lena: {
    id: 'lena',
    name: 'Lena Ortiz',
    color: '#34d399',
    initial: 'L',
    palette: { jacket: '#7f2d26', shirt: '#f2ead8', trousers: '#2e3138', hair: '#5e2f1a' },
    // Phase 2 character work: shoulder-length dark auburn hair,
    // rust/burgundy jacket, cream top — a fourth female lead
    // silhouette, distinct from Mara (long hair, fuchsia),
    // June (bob, skirt, violet) and Dana (bun, shades, navy).
    design: { heightScale: 0.97, shoulderScale: 0.85, hipScale: 0.93, hairStyle: 'shoulder', chain: false, hood: false },
  },
  // Ferris speaks one line in the finale; he is never staged.
  ferris: {
    id: 'ferris',
    name: 'Old Man Ferris',
    color: '#a8a29e',
    initial: 'F',
    // Phase 2 character work: Ferris had no palette, so his
    // portrait would have rendered as a grey-hoodie Kai clone.
    // Muted stone jacket, white-grey hair — the oldest man in
    // the story. Dialogue-only; never staged, so this design
    // exists for his portrait alone.
    palette: { jacket: '#6b6259', shirt: '#e8e6e0', trousers: '#33302a', hair: '#d8d8d8' },
    design: { heightScale: 0.97, shoulderScale: 0.9, hipScale: 0.94, hood: false, chain: false },
  },
  milo: {
    id: 'milo',
    name: 'Milo',
    color: '#fb923c',
    initial: 'M',
    palette: { jacket: '#b45309', shirt: '#f5f0e6', trousers: '#2f4d7a', hair: '#14100c' },
    // Phase 2 character work: he is fourteen, so he is the
    // shortest and narrowest in the cast by a clear margin.
    design: { heightScale: 0.86, shoulderScale: 0.82, hipScale: 0.86, hood: true, chain: false },
  },
  // Sana is named only — her warning about Vera opens Chapter 2.
  sana: { id: 'sana', name: 'Sana', color: '#facc15', initial: 'S' },
};

/** Resolve a speaker id to its info; unknown ids fall back to Kai. */
export function storyCharacter(id: string): StoryCharacterInfo {
  return STORY_CHARACTERS[id] ?? STORY_CHARACTERS.kai;
}
