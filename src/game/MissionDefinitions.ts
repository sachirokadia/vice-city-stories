/**
 * Mission definitions — the data. Every coordinate below is a real
 * place in the existing city, read off the world code:
 *
 * - Spawn is (0, 0, 8); the Velocity GT parks at (0, 0, −2).
 * - Avenues run north/south at x = −120, −60, 0, 60, 120; streets
 *   run east/west at z = −150, −90, −30, 30, 90, 150.
 * - Roads are 10 wide (ROAD_HALF 5) with 3-unit sidewalks, so
 *   buildings start 8 units from a road centreline (BLOCK_INSET).
 * - Beacon Tower stands at (0, −172) on a 30×26 plaza; the x = 0
 *   avenue dead-ends there, and a car wedges at about z = −162.
 * - Two park blocks: west, centre (−90, 60); east, centre (90, −60).
 * - The beach starts at x = 138 (boardwalk at x = 133) and the
 *   ocean wall blocks cars at x ≥ 188 — open sand in between.
 *
 * Unlock chain (in list order): BEACON RUN → MIDNIGHT DELIVERY →
 * LOST CONNECTION → DON'T LOSE THEM → NO WAY OUT.
 */
import type { MissionDef } from './MissionTypes';

/** The first mission: a delivery run up the avenue to the tower. */
export const BEACON_RUN: MissionDef = {
  id: 'beacon-run',
  title: 'BEACON RUN',
  description: 'A package has to reach Beacon Tower before the window closes.',
  kind: 'delivery',
  giver: 'Mara Voss',
  // On the sidewalk east of the x = 0 avenue, just north of spawn:
  // 8.5 units from the spawn point, clear of every building.
  startMarker: { x: 6, z: 14 },
  discoveryRadius: 25,
  // 180 units up the avenue at ~25 u/s is under 10 s of driving;
  // 60 s leaves room for a new player to find the car and the road.
  timeLimit: 60,
  reward: 500,
  objectives: [
    {
      id: 'find-marker',
      type: 'reach',
      text: 'Find the mission marker',
      target: { x: 6, z: 14 },
      radius: 4,
    },
    {
      id: 'accept',
      type: 'interact',
      text: 'Accept the job from Mara Voss',
      target: { x: 6, z: 14 },
      radius: 4,
    },
    {
      id: 'enter-gt',
      type: 'enterVehicle',
      text: 'Get in the Velocity GT',
      // The marker follows the car for this objective.
      target: { x: 0, z: -2 },
      radius: 3.6,
    },
    {
      id: 'checkpoint-mid',
      type: 'checkpoint',
      text: 'Pass the halfway checkpoint',
      // The x = 0 avenue crosses the z = −90 street here.
      target: { x: 0, z: -90 },
      radius: 8,
      timeBonus: 15,
    },
    {
      id: 'deliver',
      type: 'deliver',
      text: 'Deliver the package to Beacon Tower',
      // 7 units south of the tower centre, on the plaza; a car
      // wedges at about z = −162, well inside this radius.
      target: { x: 0, z: -165 },
      radius: 12,
    },
  ],
};

/**
 * Mission 2: a night delivery. Pick a package up at the south-west
 * loading dock, get the GT, and run it to the beach before the
 * clock runs out.
 */
export const MIDNIGHT_DELIVERY: MissionDef = {
  id: 'midnight-delivery',
  title: 'MIDNIGHT DELIVERY',
  description: 'A crate waits at the south-west dock. Run it to the beach.',
  kind: 'delivery',
  giver: 'Rico Hale',
  unlockAfter: 'beacon-run',
  // Sidewalk east of the x = −120 avenue, just north of the
  // z = 150 street — the loading dock corner.
  startMarker: { x: -114, z: 144 },
  discoveryRadius: 25,
  // On foot to the dock (~120 units from spawn), back to the car,
  // then ~200 units of driving to the beach: 120 s is a fair run.
  timeLimit: 120,
  reward: 750,
  objectives: [
    {
      id: 'find-package',
      type: 'reach',
      text: 'Find the package at the dock',
      target: { x: -114, z: 144 },
      radius: 4,
    },
    {
      id: 'accept',
      type: 'interact',
      text: 'Pick up the package from Rico Hale',
      target: { x: -114, z: 144 },
      radius: 4,
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
      text: 'Deliver the package to the beach',
      // Open sand east of the boardwalk, clear of the ocean wall
      // at x = 188 and of every building.
      target: { x: 165, z: 90 },
      radius: 10,
    },
  ],
};

/**
 * Mission 3: exploration, on foot, untimed. A contact lost her
 * signal — three clues are scattered around the city, one per
 * landmark, then back to the giver.
 */
export const LOST_CONNECTION: MissionDef = {
  id: 'lost-connection',
  title: 'LOST CONNECTION',
  description: 'Three clues, three landmarks. Find them all and report back.',
  kind: 'exploration',
  giver: 'June Park',
  unlockAfter: 'midnight-delivery',
  // Sidewalk west of the x = 0 avenue at the z = −30 street.
  startMarker: { x: -6, z: -30 },
  discoveryRadius: 25,
  // Untimed: the walk is the job (about 600 units on foot).
  timeLimit: 0,
  reward: 600,
  objectives: [
    {
      id: 'find-marker',
      type: 'reach',
      text: 'Find June Park',
      target: { x: -6, z: -30 },
      radius: 4,
    },
    {
      id: 'accept',
      type: 'interact',
      text: 'Take the case from June Park',
      target: { x: -6, z: -30 },
      radius: 4,
    },
    {
      id: 'clue-west-park',
      type: 'reach',
      text: 'Search the west park for a clue',
      // Centre of the west park block.
      target: { x: -90, z: 60 },
      radius: 8,
      flashText: 'CLUE FOUND — 1 of 3',
    },
    {
      id: 'clue-east-park',
      type: 'reach',
      text: 'Search the east park for a clue',
      // Centre of the east park block.
      target: { x: 90, z: -60 },
      radius: 8,
      flashText: 'CLUE FOUND — 2 of 3',
    },
    {
      id: 'clue-boardwalk',
      type: 'reach',
      text: 'Search the boardwalk for a clue',
      // On the boardwalk, east edge of the city.
      target: { x: 133, z: 30 },
      radius: 8,
      flashText: 'CLUE FOUND — 3 of 3',
    },
    {
      id: 'return',
      type: 'reach',
      text: 'Return to June Park',
      target: { x: -6, z: -30 },
      radius: 4,
    },
  ],
};

/**
 * Mission 4: a tail. A target car waits on the x = 60 avenue at
 * the north end of the city; once the player is in the GT it
 * drives a 500-unit route through the streets. Stay 8–35 m back:
 * closer than 5 m for 3 s and the target makes the tail, further
 * than 45 m for 5 s after locking on and it is gone.
 */
export const DONT_LOSE_THEM: MissionDef = {
  id: 'dont-lose-them',
  title: "DON'T LOSE THEM",
  description: 'Tail the teal sedan across the city. Close, but never seen.',
  kind: 'tail',
  giver: 'Vic Marino',
  unlockAfter: 'lost-connection',
  // On the northbound lane of the x = 60 avenue, just south of
  // the z = −150 street — where the target car waits.
  startMarker: { x: 62.5, z: -150 },
  discoveryRadius: 25,
  // ~45 s of following at the target's pace, plus finding the
  // car and catching up: 150 s on the clock.
  timeLimit: 150,
  reward: 1000,
  objectives: [
    {
      id: 'find-target',
      type: 'reach',
      text: 'Find the target car',
      target: { x: 62.5, z: -150 },
      radius: 6,
    },
    {
      id: 'accept',
      type: 'interact',
      text: 'Take the tail job from Vic Marino',
      target: { x: 62.5, z: -150 },
      radius: 6,
    },
    {
      id: 'enter-gt',
      type: 'enterVehicle',
      text: 'Get in the Velocity GT',
      target: { x: 0, z: -2 },
      radius: 3.6,
    },
    {
      id: 'follow',
      type: 'follow',
      text: 'Follow the target car',
      // The marker tracks the moving target for this objective.
      target: { x: 62.5, z: -150 },
      radius: 6,
      follow: {
        minDist: 8,
        maxDist: 35,
        tooCloseSeconds: 3,
        tooFarSeconds: 5,
        routeLength: 500,
      },
    },
  ],
};

/**
 * Mission 5: a police escape. Accepting the job puts the player
 * on the wanted list at level 3 — the existing wanted system,
 * nothing second. Reach the beach hideout, then stay out of sight
 * until the heat dies down.
 */
export const NO_WAY_OUT: MissionDef = {
  id: 'no-way-out',
  title: 'NO WAY OUT',
  description: 'The heat is on. Reach the beach hideout and wait it out.',
  kind: 'escape',
  giver: 'Dana Cole',
  unlockAfter: 'dont-lose-them',
  // Sidewalk west of the x = 0 avenue at the z = 30 street.
  startMarker: { x: -6, z: 30 },
  discoveryRadius: 25,
  // ~180 units to the beach, then ~30 s of hiding while the
  // search timer runs out: 180 s on the clock.
  timeLimit: 180,
  reward: 1500,
  // Level 3 (heat 45) — enough police to matter, still escapable.
  startHeat: 45,
  objectives: [
    {
      id: 'find-marker',
      type: 'reach',
      text: 'Find Dana Cole',
      target: { x: -6, z: 30 },
      radius: 4,
    },
    {
      id: 'accept',
      type: 'interact',
      text: 'Take the job from Dana Cole',
      target: { x: -6, z: 30 },
      radius: 4,
    },
    {
      id: 'reach-hideout',
      type: 'reach',
      text: 'Reach the beach hideout',
      // Open sand, 60 units east of the nearest road — beyond
      // normal police sight (55) — and clear of the ocean wall.
      target: { x: 180, z: -30 },
      radius: 12,
    },
    {
      id: 'evade',
      type: 'evade',
      text: 'Stay hidden until the heat dies down',
      target: { x: 180, z: -30 },
      radius: 12,
    },
  ],
};

export const MISSION_DEFS: MissionDef[] = [
  BEACON_RUN,
  MIDNIGHT_DELIVERY,
  LOST_CONNECTION,
  DONT_LOSE_THEM,
  NO_WAY_OUT,
];
