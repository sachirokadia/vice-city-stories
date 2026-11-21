/**
 * Story definitions — the data. Chapter 1 only in Phase 9B
 * (Chapters 2–3 land in 9E).
 *
 * Every coordinate is a real place in the existing city, read off
 * the world code and verified clear by a probe run (qa9b-probe,
 * 19 Nov 2026):
 *
 * - Mara's office (66, 6): sidewalk east of the x = 60 avenue in
 *   the commercial block — clear, 5.3 m from the nearest building,
 *   24.7 m from the Sunset Mart. Distinct from every job marker.
 * - Rico's dock (-126, 156): the south-west corner of the x = -120
 *   avenue / z = 150 street — clear, 10.3 m from the nearest
 *   building, 17 m from the MIDNIGHT DELIVERY marker.
 * - June's van (-90, 60): centre of the west park — clear, 41.9 m
 *   from the nearest building.
 * - Clues: east park (90, -60), boardwalk (133, 30), Beacon Tower
 *   plaza (0, -165) — all proven clear by the existing
 *   LOST CONNECTION mission. The optional fourth clue is at the
 *   garage (22, 52).
 *
 * The routes reuse the job missions' proven paths (BEACON RUN,
 * MIDNIGHT DELIVERY, LOST CONNECTION) with a story frame, a
 * dialogue stub, checkpoints, and — in 1.2 — an evade tail.
 * The story missions are separate definitions; the five job
 * missions are untouched.
 */
import type { StoryChapterDef, StoryMissionDef } from './StoryTypes';

/** Chapter 1, mission 1: a delivery run to Beacon Tower. */
export const FIRST_LIGHT: StoryMissionDef = {
  id: 'story-first-light',
  chapterId: 'chapter-1',
  title: 'FIRST LIGHT',
  description: 'Mara Voss has a package for Beacon Tower. Sixty seconds.',
  giver: 'Mara Voss',
  startMarker: { x: 66, z: 6 },
  discoveryRadius: 25,
  timeLimit: 60,
  reward: 500,
  setsFlags: ['mara-trust'],
  objectives: [
    {
      id: 'find-mara',
      type: 'reach',
      text: 'Find Mara Voss',
      target: { x: 66, z: 6 },
      radius: 4,
    },
    {
      id: 'talk-mara',
      type: 'dialogue',
      text: 'Talk to Mara Voss',
      target: { x: 66, z: 6 },
      radius: 4,
      dialogueId: 'mara-first-light',
      cinematicId: 'cine-first-light',
      accept: true,
      line: 'Package for Beacon Tower. Sixty seconds. Don\u2019t be late.',
    },
    {
      id: 'enter-gt',
      type: 'enterVehicle',
      text: 'Get in the Velocity GT',
      target: { x: 0, z: -2 },
      radius: 3.6,
    },
    {
      id: 'checkpoint-mid',
      type: 'checkpoint',
      text: 'Pass the halfway checkpoint',
      target: { x: 0, z: -90 },
      radius: 8,
      timeBonus: 15,
      checkpoint: true,
    },
    {
      id: 'deliver',
      type: 'deliver',
      text: 'Deliver the package to Beacon Tower',
      target: { x: 0, z: -165 },
      radius: 12,
    },
  ],
};

/**
 * Chapter 1, mission 2: a night delivery with a tail. Rico's crate
 * is the same package from 1.1 — and someone is watching it.
 */
export const DOCKSIDE_STATIC: StoryMissionDef = {
  id: 'story-dockside-static',
  chapterId: 'chapter-1',
  title: 'DOCKSIDE STATIC',
  description: 'Rico Hale has a crate for the beach. Someone is watching it.',
  giver: 'Rico Hale',
  unlockAfter: 'story-first-light',
  startMarker: { x: -126, z: 156 },
  discoveryRadius: 25,
  timeLimit: 120,
  reward: 750,
  setsFlags: ['package-was-wrong'],
  // Level 1 (heat 10) — enough police to matter, easy to lose.
  startHeat: 10,
  objectives: [
    {
      id: 'find-rico',
      type: 'reach',
      text: 'Find Rico Hale',
      target: { x: -126, z: 156 },
      radius: 4,
    },
    {
      id: 'talk-rico',
      type: 'dialogue',
      text: 'Talk to Rico Hale',
      target: { x: -126, z: 156 },
      radius: 4,
      dialogueId: 'rico-dockside-static',
      cinematicId: 'cine-dockside-static',
      accept: true,
      line: 'Crate\u2019s for the beach. Don\u2019t open it. Don\u2019t ask.',
    },
    {
      id: 'enter-gt',
      type: 'enterVehicle',
      text: 'Get in the Velocity GT',
      target: { x: 0, z: -2 },
      radius: 3.6,
    },
    {
      id: 'deliver-beach',
      type: 'deliver',
      text: 'Deliver the crate to the beach',
      target: { x: 165, z: 90 },
      radius: 10,
      checkpoint: true,
    },
    {
      id: 'reach-hideout',
      type: 'reach',
      text: 'Reach the beach hideout',
      target: { x: 180, z: -30 },
      radius: 12,
    },
    {
      id: 'evade',
      type: 'evade',
      text: 'Lose the tail, then stay hidden until the heat dies down',
      target: { x: 180, z: -30 },
      radius: 12,
    },
  ],
};

/**
 * Chapter 1, mission 3: exploration, on foot, untimed. June's
 * source left three clues around the city — and a fourth, for
 * anyone who looks harder.
 */
export const SIGNAL_LOST: StoryMissionDef = {
  id: 'story-signal-lost',
  chapterId: 'chapter-1',
  title: 'SIGNAL LOST',
  description: 'Three clues, three landmarks. Find them all and report back.',
  giver: 'June Park',
  unlockAfter: 'story-dockside-static',
  startMarker: { x: -90, z: 60 },
  discoveryRadius: 25,
  timeLimit: 0,
  reward: 600,
  setsFlags: ['ledger-found', 'june-trust'],
  objectives: [
    {
      id: 'find-june',
      type: 'reach',
      text: 'Find June Park',
      target: { x: -90, z: 60 },
      radius: 4,
    },
    {
      id: 'talk-june',
      type: 'dialogue',
      text: 'Take the case from June Park',
      target: { x: -90, z: 60 },
      radius: 4,
      dialogueId: 'june-signal-lost',
      cinematicId: 'cine-signal-lost',
      accept: true,
      line: 'Three clues, three landmarks. My source left them for us.',
    },
    {
      id: 'clue-east-park',
      type: 'collect',
      text: 'Search the east park for a clue',
      target: { x: 90, z: -60 },
      radius: 8,
      flashText: 'CLUE FOUND — 1 of 3',
    },
    {
      id: 'clue-boardwalk',
      type: 'collect',
      text: 'Search the boardwalk for a clue',
      target: { x: 133, z: 30 },
      radius: 8,
      flashText: 'CLUE FOUND — 2 of 3',
      checkpoint: true,
    },
    {
      id: 'clue-tower',
      type: 'collect',
      text: 'Search Beacon Tower for a clue',
      target: { x: 0, z: -165 },
      radius: 8,
      flashText: 'CLUE FOUND — 3 of 3',
    },
    {
      id: 'return',
      type: 'reach',
      text: 'Return to June Park',
      target: { x: -90, z: 60 },
      radius: 4,
    },
  ],
  optional: [
    {
      id: 'clue-garage',
      type: 'collect',
      text: 'Search the garage for a fourth clue',
      // The garage door (22,40), not the building centre (22,52):
      // the centre is inside the solid garage footprint, and
      // collision pushes the player to (22,44.4) — 7.6 m away,
      // outside a 6 m radius, so the clue could never be taken.
      target: { x: 22, z: 40 },
      radius: 6,
      flashText: 'EXTRA CLUE FOUND',
    },
  ],
  optionalReward: 100,
};

export const CHAPTER_1: StoryChapterDef = {
  id: 'chapter-1',
  title: 'The Wrong Package',
  description:
    'A courier, a package, and three people who each know one piece of the truth.',
  missions: [FIRST_LIGHT, DOCKSIDE_STATIC, SIGNAL_LOST],
};

// ==========================================================================
// Chapter 2 — Two Crews, One City (9E)
//
// The ledger exists. Two crews want it for opposite reasons, and
// Kai is now the person both of them have seen. New places are
// all existing city locations: the north avenue (Vic's tail), the
// mid-beach beacon (the defense), the South Docks (Rook's fight),
// the beach hideout (Dana's escape).
//
// Coordinates verified clear by probe (qa85-probe, 20 Nov 2026):
// - Vic's sedan lane (62.5, -150): on the northbound lane of the
//   x = 60 avenue, 12 m south of the job mission's tail start.
// - Beach marker (155, 12): sand, west of the beacon, clear.
// - Rook's dock (0, 170): same zone as the 8C contract.
// - Dana's corner (-6, 30): roadside, south of spawn.
// - Hideout (180, -30): proven by 1.2. Warehouse yard (120, -150):
//   road intersection, clear. Lena's clinic (140, 30): sand.
// ==========================================================================

/**
 * Chapter 2, mission 1: tail a sedan up the north avenue without
 * being spotted. The job mission's follow mechanics, re-skinned
 * for the story — and the sedan is Vera's.
 */
export const TAIL_SPIN: StoryMissionDef = {
  id: 'story-tail-spin',
  chapterId: 'chapter-2',
  title: 'TAIL SPIN',
  description: 'Vic Marino has a sedan that needs following. Don\u2019t get spotted.',
  giver: 'Vic Marino',
  unlockAfter: 'story-signal-lost',
  startMarker: { x: 62.5, z: -150 },
  discoveryRadius: 25,
  timeLimit: 150,
  reward: 1000,
  setsFlags: ['warehouse-found'],
  objectives: [
    {
      id: 'find-vic',
      type: 'reach',
      text: 'Find Vic Marino',
      target: { x: 62.5, z: -150 },
      radius: 4,
    },
    {
      id: 'talk-vic',
      type: 'dialogue',
      text: 'Talk to Vic Marino',
      target: { x: 62.5, z: -150 },
      radius: 4,
      dialogueId: 'vic-tail-spin',
      cinematicId: 'cine-tail-spin',
      accept: true,
      line: 'Sedan on the avenue. Follow it. Don\u2019t crowd it.',
    },
    {
      id: 'enter-car',
      type: 'enterVehicle',
      text: 'Get in a car',
      target: { x: 0, z: -2 },
      radius: 3.6,
    },
    {
      id: 'tail-sedan',
      type: 'follow',
      text: 'Follow the sedan to the warehouse',
      target: { x: 120, z: -150 },
      radius: 12,
      follow: {
        minDist: 8,
        maxDist: 35,
        tooCloseSeconds: 3,
        tooFarSeconds: 5,
        routeLength: 500,
      },
    },
    {
      id: 'reach-warehouse',
      type: 'reach',
      text: 'Reach the warehouse yard',
      target: { x: 120, z: -150 },
      radius: 12,
    },
  ],
};

/**
 * Chapter 2, mission 2: defend the mid-beach supply beacon
 * against three waves. Mara calls, not in person — the phone
 * pattern, so there is no staged character and no cinematic.
 * Completing it earns the crew jacket outfit.
 */
export const HOLD_THE_LINE_STORY: StoryMissionDef = {
  id: 'story-hold-line',
  chapterId: 'chapter-2',
  title: 'HOLD THE LINE',
  description: 'Northgate is coming for the beach stash. Keep the beacon standing.',
  giver: 'Mara Voss',
  unlockAfter: 'story-tail-spin',
  startMarker: { x: 155, z: 12 },
  discoveryRadius: 25,
  timeLimit: 0,
  reward: 1200,
  setsFlags: ['defended-the-beach'],
  grantsOutfit: 'crew-jacket',
  objectives: [
    {
      id: 'reach-beach',
      type: 'reach',
      text: 'Get to the beach',
      target: { x: 155, z: 12 },
      radius: 4,
    },
    {
      id: 'talk-mara-beach',
      type: 'dialogue',
      text: 'Answer Mara\u2019s call',
      target: { x: 155, z: 12 },
      radius: 4,
      cinematicId: 'cine-hold-line',
      dialogueId: 'mara-hold-line',
      accept: true,
      line: 'They\u2019re coming for the beacon. Hold the line.',
    },
    {
      id: 'defend-beacon',
      type: 'defend',
      text: 'Defend the supply beacon',
      target: { x: 165, z: 0 },
      radius: 18,
      objective: { x: 165, z: 0, maxHealth: 100 },
      waves: ['story-defend-w1', 'story-defend-w2', 'story-defend-w3'],
    },
    {
      id: 'talk-mara-after',
      type: 'dialogue',
      text: 'Call Mara back',
      target: { x: 165, z: 0 },
      radius: 6,
      dialogueId: 'mara-hold-line-after',
      line: 'Beacon\u2019s still standing. Now listen.',
    },
  ],
};

/**
 * Chapter 2, mission 3: the dockside fight — and the choice.
 * Rook offers his job on the spot ($200 now); refusing earns a
 * tip instead (the dead-drop locations in 3.1). Exactly one of
 * the two flags is set, by the dialogue choice.
 */
export const DOCKSIDE_TROUBLE_STORY: StoryMissionDef = {
  id: 'story-dockside-trouble',
  chapterId: 'chapter-2',
  title: 'DOCKSIDE TROUBLE',
  description: 'Rook Calloway has a job at the South Docks — and a price.',
  giver: 'Rook Calloway',
  unlockAfter: 'story-hold-line',
  startMarker: { x: 0, z: 170 },
  discoveryRadius: 25,
  timeLimit: 0,
  reward: 800,
  objectives: [
    {
      id: 'find-rook',
      type: 'reach',
      text: 'Find Rook Calloway',
      target: { x: 0, z: 170 },
      radius: 4,
    },
    {
      id: 'talk-rook',
      type: 'dialogue',
      text: 'Talk to Rook Calloway',
      target: { x: 0, z: 170 },
      radius: 4,
      dialogueId: 'rook-dockside-trouble',
      cinematicId: 'cine-dockside-trouble',
      accept: true,
      line: 'Three of theirs on my docks. You in, or you walking?',
    },
    {
      id: 'clear-docks',
      type: 'defeat',
      text: 'Clear the crew off the docks',
      target: { x: 0, z: 170 },
      radius: 18,
      encounterId: 'story-dockside',
      count: 3,
    },
    {
      id: 'talk-rook-after',
      type: 'dialogue',
      text: 'Talk to Rook Calloway',
      target: { x: 0, z: 170 },
      radius: 4,
      dialogueId: 'rook-dockside-after',
      line: 'Docks are clear. Now — about who hired them.',
    },
  ],
};

/**
 * Chapter 2, mission 4: the escape. Dana drives the lesson —
 * brake later, turn earlier, don't look back — and tells Kai
 * the truth about Vera. Level 3 heat (45) from the start.
 */
export const LONG_WAY_OUT: StoryMissionDef = {
  id: 'story-long-way-out',
  chapterId: 'chapter-2',
  title: 'THE LONG WAY OUT',
  description: 'Dana Cole has one escape lesson. The police have other ideas.',
  giver: 'Dana Cole',
  unlockAfter: 'story-dockside-trouble',
  startMarker: { x: -6, z: 30 },
  discoveryRadius: 25,
  timeLimit: 180,
  reward: 1500,
  setsFlags: ['vera-lied'],
  // Level 3 (heat 45) — roadblocks, but the route is short.
  startHeat: 45,
  outroCinematicId: 'cine-chapter2-outro',
  objectives: [
    {
      id: 'find-dana',
      type: 'reach',
      text: 'Find Dana Cole',
      target: { x: -6, z: 30 },
      radius: 4,
    },
    {
      id: 'talk-dana',
      type: 'dialogue',
      text: 'Talk to Dana Cole',
      target: { x: -6, z: 30 },
      radius: 4,
      dialogueId: 'dana-long-way-out',
      cinematicId: 'cine-long-way-out',
      accept: true,
      line: 'Brake later. Turn earlier. Don\u2019t look back.',
    },
    {
      id: 'reach-hideout',
      type: 'reach',
      text: 'Reach the beach hideout',
      target: { x: 180, z: -30 },
      radius: 12,
      checkpoint: true,
    },
    {
      id: 'evade',
      type: 'evade',
      text: 'Lose the tail, then stay hidden until the heat dies down',
      target: { x: 180, z: -30 },
      radius: 12,
    },
  ],
};

export const CHAPTER_2: StoryChapterDef = {
  id: 'chapter-2',
  title: 'Two Crews, One City',
  description:
    'The ledger exists, and two crews want it. Kai is the person both of them have seen.',
  missions: [TAIL_SPIN, HOLD_THE_LINE_STORY, DOCKSIDE_TROUBLE_STORY, LONG_WAY_OUT],
};

// ==========================================================================
// Chapter 3 — The Ledger (9E)
//
// The dead drops lead to the warehouse, the warehouse leads to
// the ledger, and the ledger leads to a choice at Beacon Tower:
// burn it with Mara, or publish it with June. Both endings are
// real — each has its own dialogue, its own outro cinematic, and
// the same $2,500.
//
// 3.1's distance gating: the drop distances show only if the
// player refused Rook's job (the tip). If they took the job,
// the HUD names the neighbourhood and hides the distance.
// ==========================================================================

/** Chapter 3, mission 1: collect the three dead drops. */
export const DEAD_DROP: StoryMissionDef = {
  id: 'story-dead-drop',
  chapterId: 'chapter-3',
  title: 'DEAD DROP',
  description: 'Milo knows where the drops are. Finding them is the job.',
  giver: 'Milo',
  unlockAfter: 'story-long-way-out',
  startMarker: { x: 133, z: 90 },
  discoveryRadius: 25,
  timeLimit: 0,
  reward: 900,
  setsFlags: ['drops-collected'],
  objectives: [
    {
      id: 'find-milo',
      type: 'reach',
      text: 'Find Milo',
      target: { x: 133, z: 90 },
      radius: 4,
    },
    {
      id: 'talk-milo',
      type: 'dialogue',
      text: 'Talk to Milo',
      target: { x: 133, z: 90 },
      radius: 4,
      dialogueId: 'milo-dead-drop',
      cinematicId: 'cine-dead-drop',
      accept: true,
      line: 'Three drops. I know where. You\u2019re slow, though.',
    },
    {
      id: 'drop-park',
      type: 'collect',
      text: 'Search the west park for a dead drop',
      target: { x: -90, z: 60 },
      radius: 8,
      flashText: 'DEAD DROP FOUND — 1 of 3',
      distanceGatedByFlag: 'refused-rook',
    },
    {
      id: 'drop-garage',
      type: 'collect',
      text: 'Search the garage for a dead drop',
      // The garage door (22,40), not the building centre — see 1.3.
      target: { x: 22, z: 40 },
      radius: 8,
      flashText: 'DEAD DROP FOUND — 2 of 3',
      checkpoint: true,
      distanceGatedByFlag: 'refused-rook',
    },
    {
      id: 'drop-tower',
      type: 'collect',
      text: 'Search Beacon Tower for a dead drop',
      target: { x: 0, z: -165 },
      radius: 8,
      flashText: 'DEAD DROP FOUND — 3 of 3',
      distanceGatedByFlag: 'refused-rook',
    },
    {
      id: 'talk-lena',
      type: 'dialogue',
      text: 'Check in with Lena Ortiz',
      target: { x: 140, z: 30 },
      radius: 4,
      dialogueId: 'lena-dead-drop',
      line: 'You look like the drops found you first.',
    },
  ],
};

/**
 * Chapter 3, mission 2: take the ledger from Crane's warehouse.
 * Two groups of three, then the ledger itself. Theo has the
 * Vortex RS ready — it is granted (and selected) on completion,
 * so the finale's drive can ask for it by name. There is no
 * vehicle prerequisite: a hard requirement would lock the
 * mission before the gift dialogue could ever run.
 */
export const CRANES_NEST: StoryMissionDef = {
  id: 'story-cranes-nest',
  chapterId: 'chapter-3',
  title: 'CRANE\u2019S NEST',
  description: 'The ledger is in Crane\u2019s warehouse. Six hostiles are in the way.',
  giver: 'June Park',
  unlockAfter: 'story-dead-drop',
  startMarker: { x: -90, z: 60 },
  discoveryRadius: 25,
  timeLimit: 0,
  reward: 2000,
  setsFlags: ['ledger-in-hand'],
  grantsVehicle: 'vortex-rs',
  objectives: [
    {
      id: 'find-june-2',
      type: 'reach',
      text: 'Find June Park',
      target: { x: -90, z: 60 },
      radius: 4,
    },
    {
      id: 'talk-june-2',
      type: 'dialogue',
      text: 'Talk to June Park',
      target: { x: -90, z: 60 },
      radius: 4,
      dialogueId: 'june-cranes-nest',
      cinematicId: 'cine-cranes-nest',
      accept: true,
      line: 'Six of them, one ledger. Theo\u2019s got the car ready.',
    },
    {
      id: 'reach-warehouse',
      type: 'reach',
      text: 'Reach the warehouse yard',
      target: { x: 120, z: -150 },
      radius: 12,
    },
    {
      id: 'clear-nest-a',
      type: 'defeat',
      text: 'Clear the first group',
      target: { x: 120, z: -150 },
      radius: 18,
      encounterId: 'story-nest-a',
      count: 3,
      checkpoint: true,
    },
    {
      id: 'clear-nest-b',
      type: 'defeat',
      text: 'Clear the second group',
      target: { x: 120, z: -150 },
      radius: 18,
      encounterId: 'story-nest-b',
      count: 3,
    },
    {
      id: 'take-ledger',
      type: 'collect',
      text: 'Take the ledger',
      target: { x: 128, z: -156 },
      radius: 6,
      flashText: 'LEDGER SECURED',
    },
    {
      id: 'return-van',
      type: 'reach',
      text: 'Return to June\u2019s van',
      target: { x: -90, z: 60 },
      radius: 4,
    },
  ],
};

/**
 * Chapter 3, mission 3: the finale. Drive the Vortex RS to
 * Beacon Tower under level 4 heat (70), then face Silas Crane.
 * The ending is chosen inside the finale dialogue, as a choice
 * node — skipping is refused there, so the decision cannot be
 * skipped past. Both endings pay $2,500 and complete the
 * campaign; the chosen one persists in the save.
 */
export const SUNSET_RUN: StoryMissionDef = {
  id: 'story-sunset-run',
  chapterId: 'chapter-3',
  title: 'SUNSET RUN',
  description: 'The ledger goes to Beacon Tower. So does Silas Crane.',
  giver: 'Mara Voss',
  unlockAfter: 'story-cranes-nest',
  startMarker: { x: 66, z: 6 },
  discoveryRadius: 25,
  timeLimit: 120,
  reward: 2500,
  setsFlags: ['campaign-complete'],
  // Level 4 (heat 70) — the whole city is looking.
  startHeat: 70,
  outroCinematicIds: { mara: 'cine-ending-mara', june: 'cine-ending-june' },
  objectives: [
    {
      id: 'find-mara-3',
      type: 'reach',
      text: 'Find Mara Voss',
      target: { x: 66, z: 6 },
      radius: 4,
    },
    {
      id: 'talk-mara-3',
      type: 'dialogue',
      text: 'Talk to Mara Voss',
      target: { x: 66, z: 6 },
      radius: 4,
      dialogueId: 'mara-sunset-run',
      cinematicId: 'cine-sunset-run',
      accept: true,
      line: 'Tower. Sunset. Bring the ledger — and don\u2019t stop.',
    },
    {
      id: 'enter-rs',
      type: 'enterVehicle',
      text: 'Get in the Vortex RS',
      target: { x: 0, z: -2 },
      radius: 3.6,
      vehicleId: 'vortex-rs',
    },
    {
      id: 'deliver-tower',
      type: 'deliver',
      text: 'Deliver the ledger to Beacon Tower',
      target: { x: 0, z: -165 },
      radius: 12,
    },
    {
      id: 'talk-silas',
      type: 'dialogue',
      text: 'Face Silas Crane',
      target: { x: 0, z: -165 },
      radius: 6,
      dialogueId: 'silas-finale',
      cinematicId: 'cine-finale',
    },
  ],
};

export const CHAPTER_3: StoryChapterDef = {
  id: 'chapter-3',
  title: 'The Ledger',
  description:
    'The dead drops point to the warehouse. The warehouse holds the ledger. The ledger holds the city.',
  missions: [DEAD_DROP, CRANES_NEST, SUNSET_RUN],
};

export const STORY_CHAPTERS: StoryChapterDef[] = [CHAPTER_1, CHAPTER_2, CHAPTER_3];

/** All story missions, in chapter order. */
export const STORY_MISSIONS: StoryMissionDef[] = STORY_CHAPTERS.flatMap(
  (c) => c.missions,
);

export function storyMissionById(id: string): StoryMissionDef | undefined {
  return STORY_MISSIONS.find((m) => m.id === id);
}

export function storyChapterById(id: string): StoryChapterDef | undefined {
  return STORY_CHAPTERS.find((c) => c.id === id);
}
