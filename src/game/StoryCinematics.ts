/**
 * Story cinematics — the data. Chapter 1 in Phase 9D;
 * Chapters 2–3 in Phase 9E.
 *
 * Three short intros, one per Chapter 1 mission, each played
 * once — at the marker, before the mission's dialogue opens.
 * Every camera position is a real, open place in the existing
 * city (roads, the beach, the west park, the spawn plaza):
 * no shot sits inside a building footprint, and the staged
 * character stands 2 m from the marker so they never clip
 * into the player standing on it.
 *
 * - Mara's office (66, 6): sidewalk east of the x = 60 avenue.
 *   The player approaches from the west (spawn), so Mara is
 *   staged at (68, 6) facing west (-PI/2).
 * - Rico's dock (-126, 156): the south-west corner of the
 *   x = -120 avenue / z = 150 street. The player comes down
 *   the avenue from the north, so Rico is staged at (-124, 156)
 *   facing north (PI).
 * - June's van (-90, 60): centre of the west park (open
 *   ground). The player approaches from the east, so June is
 *   staged at (-88, 60) facing east (PI/2).
 *
 * The mission-accept event stays in the 9C dialogue that
 * follows each cinematic — a skip can never skip the accept.
 * Each cinematic's first shot sets one flavour flag (seen the
 * intro), so the event path is exercised and testable.
 *
 * 9E adds eleven more: seven mission intros (one per Chapter
 * 2–3 mission, including the phone-call establishing scene
 * for HOLD THE LINE, which stages nobody), the Chapter 2
 * outro, the five-shot finale (whose last shot opens the
 * ending-choice dialogue), and the two branch outros. Camera
 * positions were probe-verified clear (qa85-probe, 20 Nov 2026).
 */
import type { CinematicDef, CinematicEvent } from './CinematicTypes';
import { getDialogue } from './StoryDialogue';
import { STORY_CHARACTERS } from './StoryCharacters';

export const CINE_FIRST_LIGHT: CinematicDef = {
  id: 'cine-first-light',
  title: 'FIRST LIGHT',
  chapter: 'Chapter 1',
  stage: [{ characterId: 'mara', pos: [68, 6], heading: -Math.PI / 2 }],
  shots: [
    {
      id: 'wide-avenue',
      duration: 4,
      pos: { kind: 'point', pos: [60, 5, 42] },
      lookAt: { kind: 'point', pos: [0, 4, -120] },
      posEnd: { kind: 'point', pos: [60, 4, 30] },
      lookAtEnd: { kind: 'point', pos: [0, 4, -140] },
      narration: 'Sunset City. One package. Sixty seconds.',
      event: { type: 'setFlag', flag: 'saw-first-light-intro', value: true },
    },
    {
      id: 'mara-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [58, 2.2, 12] },
      lookAt: { kind: 'point', pos: [67, 1.5, 6] },
      posEnd: { kind: 'point', pos: [60, 2.0, 10] },
      lookAtEnd: { kind: 'point', pos: [67, 1.5, 6] },
      narration: 'Mara Voss runs the packages. She doesn\u2019t do late.',
    },
    {
      id: 'gt-tower',
      duration: 3,
      pos: { kind: 'point', pos: [-4, 1.8, 10] },
      lookAt: { kind: 'point', pos: [0, 1.2, -2] },
      posEnd: { kind: 'point', pos: [-2, 1.6, 6] },
      lookAtEnd: { kind: 'point', pos: [0, 2, -30] },
      narration: 'The road runs north. The tower is waiting.',
    },
  ],
};

export const CINE_DOCKSIDE_STATIC: CinematicDef = {
  id: 'cine-dockside-static',
  title: 'DOCKSIDE STATIC',
  chapter: 'Chapter 1',
  stage: [{ characterId: 'rico', pos: [-124, 156], heading: Math.PI }],
  shots: [
    {
      id: 'wide-docks',
      duration: 4,
      pos: { kind: 'point', pos: [-120, 5, 128] },
      lookAt: { kind: 'point', pos: [-126, 2, 156] },
      posEnd: { kind: 'point', pos: [-120, 4, 138] },
      lookAtEnd: { kind: 'point', pos: [-126, 2, 158] },
      narration: 'The south docks. After dark, the crates move themselves.',
      event: { type: 'setFlag', flag: 'saw-dockside-intro', value: true },
    },
    {
      id: 'rico-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [-122, 2.2, 146] },
      lookAt: { kind: 'point', pos: [-125, 1.5, 156] },
      posEnd: { kind: 'point', pos: [-123, 2.0, 149] },
      lookAtEnd: { kind: 'point', pos: [-125, 1.5, 156] },
      narration: 'Rico Hale moves crates. He doesn\u2019t open them.',
    },
    {
      id: 'dock-street',
      duration: 3,
      pos: { kind: 'point', pos: [-140, 2.5, 150] },
      lookAt: { kind: 'point', pos: [-90, 2, 150] },
      posEnd: { kind: 'point', pos: [-132, 2.2, 150] },
      lookAtEnd: { kind: 'point', pos: [-80, 2, 150] },
      narration: 'Someone\u2019s been watching the crate. Don\u2019t ask who.',
    },
  ],
};

export const CINE_SIGNAL_LOST: CinematicDef = {
  id: 'cine-signal-lost',
  title: 'SIGNAL LOST',
  chapter: 'Chapter 1',
  stage: [{ characterId: 'june', pos: [-88, 60], heading: Math.PI / 2 }],
  shots: [
    {
      id: 'wide-park',
      duration: 4,
      pos: { kind: 'point', pos: [-72, 8, 78] },
      lookAt: { kind: 'point', pos: [-90, 2, 60] },
      posEnd: { kind: 'point', pos: [-76, 6, 72] },
      lookAtEnd: { kind: 'point', pos: [-90, 2, 60] },
      narration: 'Three clues. Three landmarks. One source, gone quiet.',
      event: { type: 'setFlag', flag: 'saw-signal-intro', value: true },
    },
    {
      id: 'june-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [-80, 2.2, 66] },
      lookAt: { kind: 'point', pos: [-89, 1.5, 60] },
      posEnd: { kind: 'point', pos: [-82, 2.0, 64] },
      lookAtEnd: { kind: 'point', pos: [-89, 1.5, 60] },
      narration: 'June Park hears everything. Tonight, her source went quiet.',
    },
    {
      id: 'june-close',
      duration: 3,
      pos: { kind: 'point', pos: [-84, 2.4, 56] },
      lookAt: { kind: 'point', pos: [-88, 1.5, 60] },
      posEnd: { kind: 'point', pos: [-85, 2.2, 57] },
      lookAtEnd: { kind: 'point', pos: [-88, 1.5, 60] },
      dialogueId: 'june-cine-signal-lost',
    },
  ],
};

// The full list lives at the end of the file, after every
// definition — a `const` array cannot reference defs declared
// below it.

export const CINE_TAIL_SPIN: CinematicDef = {
  id: 'cine-tail-spin',
  title: 'TAIL SPIN',
  chapter: 'Chapter 2',
  stage: [{ characterId: 'vic', pos: [64.5, -150], heading: 0 }],
  shots: [
    {
      id: 'wide-avenue',
      duration: 4,
      pos: { kind: 'point', pos: [60, 5, -110] },
      lookAt: { kind: 'point', pos: [60, 2, -150] },
      posEnd: { kind: 'point', pos: [60, 4, -122] },
      lookAtEnd: { kind: 'point', pos: [60, 2, -150] },
      narration: 'North avenue. One sedan. Five hundred metres of road.',
      event: { type: 'setFlag', flag: 'saw-tail-spin-intro', value: true },
    },
    {
      id: 'vic-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [58, 2.2, -144] },
      lookAt: { kind: 'point', pos: [64.5, 1.5, -150] },
      posEnd: { kind: 'point', pos: [60, 2.0, -146] },
      lookAtEnd: { kind: 'point', pos: [64.5, 1.5, -150] },
      narration: 'Vic Marino knows every car in the city. He doesn\u2019t forget one.',
    },
    {
      id: 'sedan-avenue',
      duration: 3,
      pos: { kind: 'point', pos: [66, 2, -140] },
      lookAt: { kind: 'point', pos: [62.5, 1, -150] },
      posEnd: { kind: 'point', pos: [65, 1.8, -143] },
      lookAtEnd: { kind: 'point', pos: [62.5, 1, -150] },
      narration: 'Teal sedan, purple light on the roof. Follow it — don\u2019t crowd it.',
    },
  ],
};

/**
 * The phone call: Mara is on the phone, not on the beach, so
 * this cinematic stages nobody — establishing shots only.
 * The validator warns about that; the warning is expected.
 */
export const CINE_HOLD_LINE: CinematicDef = {
  id: 'cine-hold-line',
  title: 'HOLD THE LINE',
  chapter: 'Chapter 2',
  shots: [
    {
      id: 'wide-beach',
      duration: 4,
      pos: { kind: 'point', pos: [150, 6, 20] },
      lookAt: { kind: 'point', pos: [165, 2, 0] },
      posEnd: { kind: 'point', pos: [152, 5, 12] },
      lookAtEnd: { kind: 'point', pos: [165, 2, 0] },
      narration: 'Mid-beach. The beacon is all that stands between the crew and the stash.',
      event: { type: 'setFlag', flag: 'saw-hold-line-intro', value: true },
    },
    {
      id: 'beacon-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [156, 2.5, 8] },
      lookAt: { kind: 'point', pos: [165, 1.2, 0] },
      posEnd: { kind: 'point', pos: [158, 2.2, 5] },
      lookAtEnd: { kind: 'point', pos: [165, 1.2, 0] },
      narration: 'One crate, one beacon, one courier. Three waves.',
    },
    {
      id: 'sand-road',
      duration: 3,
      pos: { kind: 'point', pos: [175, 2.5, -10] },
      lookAt: { kind: 'point', pos: [165, 2, 0] },
      posEnd: { kind: 'point', pos: [172, 2.2, -6] },
      lookAtEnd: { kind: 'point', pos: [165, 2, 0] },
      narration: 'They come from the sand and the road. Hold the line.',
    },
  ],
};

export const CINE_DOCKSIDE_TROUBLE: CinematicDef = {
  id: 'cine-dockside-trouble',
  title: 'DOCKSIDE TROUBLE',
  chapter: 'Chapter 2',
  // (2, 166), not (2, 170): the dockside crates nudge to
  // (3.94, 170), and a stage at (2, 170) stands 0.14 m from
  // the crate face — his shoulder clips it. Four metres north
  // of the marker is clear and still reads as "at the docks".
  stage: [{ characterId: 'rook', pos: [2, 166], heading: Math.PI }],
  shots: [
    {
      id: 'wide-docks',
      duration: 4,
      pos: { kind: 'point', pos: [-40, 6, 150] },
      lookAt: { kind: 'point', pos: [0, 2, 170] },
      posEnd: { kind: 'point', pos: [-30, 5, 152] },
      lookAtEnd: { kind: 'point', pos: [0, 2, 170] },
      narration: 'The south docks. Rook\u2019s docks — until tonight.',
      event: { type: 'setFlag', flag: 'saw-dockside-trouble-intro', value: true },
    },
    {
      id: 'rook-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [-6, 2.2, 162] },
      lookAt: { kind: 'point', pos: [2, 1.5, 166] },
      posEnd: { kind: 'point', pos: [-4, 2.0, 164] },
      lookAtEnd: { kind: 'point', pos: [2, 1.5, 166] },
      narration: 'Rook Calloway. Freelancer. Amused. Always amused.',
    },
    {
      id: 'crates-docks',
      duration: 3,
      pos: { kind: 'point', pos: [10, 2.5, 164] },
      lookAt: { kind: 'point', pos: [0, 1.5, 170] },
      posEnd: { kind: 'point', pos: [8, 2.2, 166] },
      lookAtEnd: { kind: 'point', pos: [0, 1.5, 170] },
      narration: 'Three hostiles. His crates for cover. His price on the table.',
    },
  ],
};

export const CINE_LONG_WAY_OUT: CinematicDef = {
  id: 'cine-long-way-out',
  title: 'THE LONG WAY OUT',
  chapter: 'Chapter 2',
  stage: [{ characterId: 'dana', pos: [-4, 30], heading: Math.PI }],
  shots: [
    {
      id: 'street-wide',
      duration: 4,
      pos: { kind: 'point', pos: [0, 4, 8] },
      lookAt: { kind: 'point', pos: [-6, 2, 30] },
      posEnd: { kind: 'point', pos: [0, 3.5, 14] },
      lookAtEnd: { kind: 'point', pos: [-6, 2, 30] },
      narration: 'Dana Cole drives like the road owes her money. Tonight, it does.',
      event: { type: 'setFlag', flag: 'saw-long-way-out-intro', value: true },
    },
    {
      id: 'dana-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [-8, 2.2, 24] },
      lookAt: { kind: 'point', pos: [-4, 1.5, 30] },
      posEnd: { kind: 'point', pos: [-7, 2.0, 26] },
      lookAtEnd: { kind: 'point', pos: [-4, 1.5, 30] },
      narration: 'Ex-racer. One lesson, one favour. Brake later. Turn earlier.',
    },
    {
      id: 'escape-road',
      duration: 3,
      pos: { kind: 'point', pos: [0, 3, 42] },
      lookAt: { kind: 'point', pos: [60, 2, 30] },
      posEnd: { kind: 'point', pos: [0, 2.6, 40] },
      lookAtEnd: { kind: 'point', pos: [70, 2, 30] },
      narration: 'The beach hideout, east end. Don\u2019t stop till the heat dies.',
    },
  ],
};

/** Chapter 2 outro — played from the complete screen's Continue
 * after THE LONG WAY OUT. Dana at the hideout, dawn. */
export const CINE_CHAPTER2_OUTRO: CinematicDef = {
  id: 'cine-chapter2-outro',
  title: 'DAWN ON THE BEACH',
  chapter: 'Chapter 2',
  stage: [{ characterId: 'dana', pos: [178, -30], heading: -Math.PI / 2 }],
  shots: [
    {
      id: 'dawn-beach',
      duration: 4,
      pos: { kind: 'point', pos: [165, 4, -50] },
      lookAt: { kind: 'point', pos: [178, 2, -30] },
      posEnd: { kind: 'point', pos: [168, 3.5, -44] },
      lookAtEnd: { kind: 'point', pos: [178, 2, -30] },
      narration: 'Dawn on the beach. The heat is gone. The questions are not.',
      event: { type: 'setFlag', flag: 'saw-chapter2-outro', value: true },
    },
    {
      id: 'dana-dawn',
      duration: 3.5,
      pos: { kind: 'point', pos: [170, 2.2, -24] },
      lookAt: { kind: 'point', pos: [178, 1.5, -30] },
      posEnd: { kind: 'point', pos: [172, 2.0, -26] },
      lookAtEnd: { kind: 'point', pos: [178, 1.5, -30] },
      narration: 'Vera set you up, Kai. The package was never the job. You were.',
    },
    {
      id: 'pull-back',
      duration: 3,
      pos: { kind: 'point', pos: [160, 6, -10] },
      lookAt: { kind: 'point', pos: [180, 2, -30] },
      posEnd: { kind: 'point', pos: [158, 7, -6] },
      lookAtEnd: { kind: 'point', pos: [180, 2, -30] },
      narration: 'Chapter Two — complete. The ledger is still out there.',
    },
  ],
};

// ==========================================================================
// Chapter 3 — The Ledger (9E)
// ==========================================================================

export const CINE_DEAD_DROP: CinematicDef = {
  id: 'cine-dead-drop',
  title: 'DEAD DROP',
  chapter: 'Chapter 3',
  stage: [{ characterId: 'milo', pos: [135, 90], heading: -Math.PI / 2 }],
  shots: [
    {
      id: 'boardwalk-wide',
      duration: 4,
      pos: { kind: 'point', pos: [128, 4, 110] },
      lookAt: { kind: 'point', pos: [133, 2, 90] },
      posEnd: { kind: 'point', pos: [129, 3.5, 102] },
      lookAtEnd: { kind: 'point', pos: [133, 2, 90] },
      narration: 'The boardwalk. Three drops, three places, one kid who knows them all.',
      event: { type: 'setFlag', flag: 'saw-dead-drop-intro', value: true },
    },
    {
      id: 'milo-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [130, 2.2, 96] },
      lookAt: { kind: 'point', pos: [135, 1.2, 90] },
      posEnd: { kind: 'point', pos: [131, 2.0, 94] },
      lookAtEnd: { kind: 'point', pos: [135, 1.2, 90] },
      narration: 'Milo. Fourteen. Knows every shortcut and every rumour.',
    },
    {
      id: 'ocean-drops',
      duration: 3,
      pos: { kind: 'point', pos: [140, 2.5, 84] },
      lookAt: { kind: 'point', pos: [150, 2, 90] },
      posEnd: { kind: 'point', pos: [142, 2.2, 86] },
      lookAtEnd: { kind: 'point', pos: [155, 2, 90] },
      narration: 'West park, the garage, the tower. Grey packages. Don\u2019t open them.',
    },
  ],
};

export const CINE_CRANES_NEST: CinematicDef = {
  id: 'cine-cranes-nest',
  title: 'CRANE\u2019S NEST',
  chapter: 'Chapter 3',
  stage: [
    { characterId: 'june', pos: [-88, 60], heading: Math.PI / 2 },
    { characterId: 'theo', pos: [-86, 60], heading: Math.PI / 2 },
  ],
  shots: [
    {
      id: 'wide-park',
      duration: 4,
      pos: { kind: 'point', pos: [-72, 8, 78] },
      lookAt: { kind: 'point', pos: [-90, 2, 60] },
      posEnd: { kind: 'point', pos: [-76, 6, 72] },
      lookAtEnd: { kind: 'point', pos: [-90, 2, 60] },
      narration: 'The drops point to one place: Crane\u2019s warehouse, north end.',
      event: { type: 'setFlag', flag: 'saw-cranes-nest-intro', value: true },
    },
    {
      id: 'june-theo-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [-80, 2.2, 66] },
      lookAt: { kind: 'point', pos: [-88, 1.5, 60] },
      posEnd: { kind: 'point', pos: [-82, 2.0, 64] },
      lookAtEnd: { kind: 'point', pos: [-88, 1.5, 60] },
      narration: 'Six hostiles, one ledger. Theo\u2019s got the car ready.',
    },
    {
      id: 'north-road',
      duration: 3,
      pos: { kind: 'point', pos: [-90, 3, 40] },
      lookAt: { kind: 'point', pos: [0, 3, -150] },
      posEnd: { kind: 'point', pos: [-88, 2.8, 44] },
      lookAtEnd: { kind: 'point', pos: [0, 3, -150] },
      narration: 'Two groups of three. Clear them, take the ledger, come home.',
    },
  ],
};

export const CINE_SUNSET_RUN: CinematicDef = {
  id: 'cine-sunset-run',
  title: 'SUNSET RUN',
  chapter: 'Chapter 3',
  stage: [{ characterId: 'mara', pos: [68, 6], heading: -Math.PI / 2 }],
  shots: [
    {
      id: 'wide-avenue',
      duration: 4,
      pos: { kind: 'point', pos: [60, 5, 42] },
      lookAt: { kind: 'point', pos: [0, 4, -120] },
      posEnd: { kind: 'point', pos: [60, 4, 30] },
      lookAtEnd: { kind: 'point', pos: [0, 4, -140] },
      narration: 'Sunset City. One ledger. Seventy heat.',
      event: { type: 'setFlag', flag: 'saw-sunset-run-intro', value: true },
    },
    {
      id: 'mara-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [58, 2.2, 12] },
      lookAt: { kind: 'point', pos: [67, 1.5, 6] },
      posEnd: { kind: 'point', pos: [60, 2.0, 10] },
      lookAtEnd: { kind: 'point', pos: [67, 1.5, 6] },
      narration: 'Mara Voss sends you to the tower. She doesn\u2019t do goodbyes.',
    },
    {
      id: 'rs-garage',
      duration: 3,
      pos: { kind: 'point', pos: [16, 2.5, 36] },
      lookAt: { kind: 'point', pos: [22, 1.5, 30] },
      posEnd: { kind: 'point', pos: [18, 2.2, 34] },
      lookAtEnd: { kind: 'point', pos: [22, 1.5, 30] },
      narration: 'The Vortex RS. Fastest in the city — and it\u2019s yours.',
    },
  ],
};

/** The finale — five shots, the last of which opens the
 * ending-choice dialogue (Pattern B). Silas at the tower.
 * He stands at (2, -160), not (2, -165): the tower's
 * collision box runs to z = -164, and (2, -165) is inside
 * it. The dialogue target stays (0, -165) r6 — the player
 * reaches Silas at 5.4 m, inside the radius. */
export const CINE_FINALE: CinematicDef = {
  id: 'cine-finale',
  title: 'SUNSET RUN',
  chapter: 'Chapter 3',
  stage: [{ characterId: 'silas', pos: [2, -160], heading: Math.PI }],
  shots: [
    {
      id: 'wide-tower',
      duration: 4,
      pos: { kind: 'point', pos: [0, 6, -120] },
      lookAt: { kind: 'point', pos: [0, 3, -165] },
      posEnd: { kind: 'point', pos: [0, 5, -132] },
      lookAtEnd: { kind: 'point', pos: [0, 3, -165] },
      narration: 'Beacon Tower. Sunset. The ledger, and the man who wants it.',
      event: { type: 'setFlag', flag: 'saw-finale-intro', value: true },
    },
    {
      id: 'silas-medium',
      duration: 3.5,
      pos: { kind: 'point', pos: [-6, 2.2, -158] },
      lookAt: { kind: 'point', pos: [2, 1.5, -160] },
      posEnd: { kind: 'point', pos: [-4, 2.0, -160] },
      lookAtEnd: { kind: 'point', pos: [2, 1.5, -160] },
      narration: 'Silas Crane. Ex port-authority. Polite. Slow. Precise.',
    },
    {
      id: 'tower-city',
      duration: 3,
      pos: { kind: 'point', pos: [12, 3, -158] },
      lookAt: { kind: 'point', pos: [0, 4, -120] },
      posEnd: { kind: 'point', pos: [10, 2.8, -160] },
      lookAtEnd: { kind: 'point', pos: [0, 4, -120] },
      narration: 'He never appears until the end. He only ever watches.',
    },
    {
      id: 'silas-close',
      duration: 3,
      pos: { kind: 'point', pos: [-2, 2, -160] },
      lookAt: { kind: 'point', pos: [2, 1.6, -160] },
      posEnd: { kind: 'point', pos: [-1, 1.9, -161] },
      lookAtEnd: { kind: 'point', pos: [2, 1.6, -160] },
      narration: 'Two offers. One choice. He only makes them once.',
    },
    {
      id: 'the-choice',
      duration: 3,
      pos: { kind: 'point', pos: [4, 2.2, -158] },
      lookAt: { kind: 'point', pos: [2, 1.5, -160] },
      posEnd: { kind: 'point', pos: [3, 2.0, -159] },
      lookAtEnd: { kind: 'point', pos: [2, 1.5, -160] },
      dialogueId: 'silas-finale',
    },
  ],
};

/** Ending: Mara — the ledger burns. Played from the complete
 * screen after the finale, when `ending-mara` is set. */
export const CINE_ENDING_MARA: CinematicDef = {
  id: 'cine-ending-mara',
  title: 'THE CITY KEEPS ITS SECRETS',
  chapter: 'Chapter 3',
  shots: [
    {
      id: 'tower-dusk',
      duration: 4,
      pos: { kind: 'point', pos: [0, 5, -140] },
      lookAt: { kind: 'point', pos: [0, 2, -165] },
      posEnd: { kind: 'point', pos: [0, 4, -150] },
      lookAtEnd: { kind: 'point', pos: [0, 2, -165] },
      narration: 'The city keeps its secrets.',
      event: { type: 'setFlag', flag: 'saw-ending-mara', value: true },
    },
    {
      id: 'burn-dawn',
      duration: 3.5,
      pos: { kind: 'point', pos: [10, 4, -180] },
      lookAt: { kind: 'point', pos: [0, 3, -165] },
      posEnd: { kind: 'point', pos: [12, 5, -178] },
      lookAtEnd: { kind: 'point', pos: [0, 3, -165] },
      narration: 'Mara burns the ledger before dawn. The names turn to ash.',
    },
    {
      id: 'walk-home',
      duration: 3,
      pos: { kind: 'point', pos: [0, 8, -100] },
      lookAt: { kind: 'point', pos: [0, 2, -165] },
      posEnd: { kind: 'point', pos: [0, 10, -90] },
      lookAtEnd: { kind: 'point', pos: [0, 2, -165] },
      narration: 'Kai Reyes walks home. The ledger is gone. The debt is not.',
    },
  ],
};

/** Ending: June — the ledger publishes. Played from the
 * complete screen after the finale, when `ending-june` is set. */
export const CINE_ENDING_JUNE: CinematicDef = {
  id: 'cine-ending-june',
  title: 'THE CITY LEARNS THE TRUTH',
  chapter: 'Chapter 3',
  shots: [
    {
      id: 'tower-dusk',
      duration: 4,
      pos: { kind: 'point', pos: [0, 5, -140] },
      lookAt: { kind: 'point', pos: [0, 2, -165] },
      posEnd: { kind: 'point', pos: [0, 4, -150] },
      lookAtEnd: { kind: 'point', pos: [0, 2, -165] },
      narration: 'The city learns the truth.',
      event: { type: 'setFlag', flag: 'saw-ending-june', value: true },
    },
    {
      id: 'print-dawn',
      duration: 3.5,
      pos: { kind: 'point', pos: [10, 4, -180] },
      lookAt: { kind: 'point', pos: [0, 3, -165] },
      posEnd: { kind: 'point', pos: [12, 5, -178] },
      lookAtEnd: { kind: 'point', pos: [0, 3, -165] },
      narration: 'June prints every name. The docks, the crews, the whole ledger.',
    },
    {
      id: 'walk-home',
      duration: 3,
      pos: { kind: 'point', pos: [0, 8, -100] },
      lookAt: { kind: 'point', pos: [0, 2, -165] },
      posEnd: { kind: 'point', pos: [0, 10, -90] },
      lookAtEnd: { kind: 'point', pos: [0, 2, -165] },
      narration: 'Kai Reyes walks home. The ledger is out. The story is not.',
    },
  ],
};

export const STORY_CINEMATICS: CinematicDef[] = [
  CINE_FIRST_LIGHT,
  CINE_DOCKSIDE_STATIC,
  CINE_SIGNAL_LOST,
  CINE_TAIL_SPIN,
  CINE_HOLD_LINE,
  CINE_DOCKSIDE_TROUBLE,
  CINE_LONG_WAY_OUT,
  CINE_CHAPTER2_OUTRO,
  CINE_DEAD_DROP,
  CINE_CRANES_NEST,
  CINE_SUNSET_RUN,
  CINE_FINALE,
  CINE_ENDING_MARA,
  CINE_ENDING_JUNE,
];

export function getCinematic(id: string): CinematicDef | undefined {
  return STORY_CINEMATICS.find((c) => c.id === id);
}

export interface CinematicValidation {
  errors: string[];
  warnings: string[];
}

const EVENT_TYPES: ReadonlySet<string> = new Set([
  'setFlag',
  'giveCash',
  'startStoryMission',
  'completeObjective',
  'setWanted',
]);

/**
 * Validate every cinematic definition. Errors refuse the
 * cinematic at runtime; warnings are advisory. Mirrors the
 * dialogue validator's shape so the two read the same way.
 */
export function validateStoryCinematics(): CinematicValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const def of STORY_CINEMATICS) {
    const tag = `cinematic '${def.id}'`;
    if (seen.has(def.id)) errors.push(`${tag} is defined twice`);
    seen.add(def.id);
    if (def.shots.length === 0) {
      errors.push(`${tag} has no shots`);
      continue;
    }
    const shotIds = new Set<string>();
    for (const shot of def.shots) {
      if (shotIds.has(shot.id)) errors.push(`${tag} shot '${shot.id}' is defined twice`);
      shotIds.add(shot.id);
      if (!(shot.duration > 0) || !Number.isFinite(shot.duration)) {
        errors.push(`${tag} shot '${shot.id}' has no positive duration`);
      }
      for (const [name, ref] of [
        ['pos', shot.pos],
        ['lookAt', shot.lookAt],
        ['posEnd', shot.posEnd],
        ['lookAtEnd', shot.lookAtEnd],
      ] as const) {
        if (!ref) continue;
        if (ref.kind === 'point') {
          if (
            ref.pos.length !== 3 ||
            ref.pos.some((v) => !Number.isFinite(v))
          ) {
            errors.push(`${tag} shot '${shot.id}' ${name} is not a finite [x, y, z]`);
          }
        } else if (ref.kind === 'character' && !STORY_CHARACTERS[ref.id]) {
          errors.push(`${tag} shot '${shot.id}' ${name} names unknown character '${ref.id}'`);
        } else if (
          ref.kind === 'character' &&
          !(def.stage ?? []).some((a) => a.characterId === ref.id)
        ) {
          // A follow target that is never staged resolves to the
          // origin at runtime — catch it here instead.
          errors.push(
            `${tag} shot '${shot.id}' ${name} follows '${ref.id}', who is not staged in this cinematic`,
          );
        }
        if (ref.kind !== 'point' && ref.offset !== undefined) {
          if (ref.offset.length !== 3 || ref.offset.some((v) => !Number.isFinite(v))) {
            errors.push(`${tag} shot '${shot.id}' ${name} offset is not a finite [x, y, z]`);
          }
        }
      }
      if (shot.dialogueId && !getDialogue(shot.dialogueId)) {
        errors.push(`${tag} shot '${shot.id}' names unknown dialogue '${shot.dialogueId}'`);
      }
      if (shot.event && !EVENT_TYPES.has((shot.event as CinematicEvent).type)) {
        errors.push(`${tag} shot '${shot.id}' has unknown event type '${(shot.event as CinematicEvent).type}'`);
      }
      if (shot.dialogueId && shot.event?.type === 'completeObjective') {
        warnings.push(
          `${tag} shot '${shot.id}' puts a mission-accept event inside a cinematic — ` +
            `a skip would fire it without the dialogue; keep accepts in the campaign dialogue`,
        );
      }
    }
    for (const actor of def.stage ?? []) {
      if (!STORY_CHARACTERS[actor.characterId]) {
        errors.push(`${tag} stages unknown character '${actor.characterId}'`);
      }
      if (
        actor.pos.length !== 2 ||
        actor.pos.some((v) => !Number.isFinite(v)) ||
        !Number.isFinite(actor.heading)
      ) {
        errors.push(`${tag} staged '${actor.characterId}' has a bad position or heading`);
      }
      if (actor.action?.kind === 'walk') {
        if (
          actor.action.to.length !== 2 ||
          actor.action.to.some((v) => !Number.isFinite(v))
        ) {
          errors.push(`${tag} staged '${actor.characterId}' has a bad walk target`);
        }
      }
    }
    if ((def.stage ?? []).length === 0) {
      warnings.push(`${tag} stages no characters — an establishing shot only`);
    }
  }
  return { errors, warnings };
}
