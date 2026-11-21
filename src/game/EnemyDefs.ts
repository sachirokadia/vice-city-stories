/**
 * Enemy definitions — the data layer of the Phase 8B hostile NPC
 * system. Three original variations, all fictional: no reproduced
 * characters, names or designs from existing games.
 *
 * Enemies are separate entities from ordinary pedestrians (they
 * never share the crowd pool, and pedestrians never become
 * hostile). An encounter owns up to three of them at a time.
 */

export type EnemyVariantId = 'yard-enforcer' | 'lot-runner' | 'northgate-lookout';

export interface EnemyDef {
  id: EnemyVariantId;
  /** The name the encounter HUD shows. */
  name: string;
  health: number;
  /** Metres per second while moving (patrol is slower, see Enemies). */
  speed: number;
  /** Metres: closer than this with line of sight, the enemy spots the player. */
  detectionRange: number;
  /** Metres: inside this with line of sight, the enemy can shoot. */
  attackRange: number;
  /** Seconds between attacks. */
  attackCooldown: number;
  /** Health the player loses per enemy hit. */
  damage: number;
  /** Body scale (1 = protagonist height). */
  height: number;
  width: number;
  skin: number;
  top: number;
  bottom: number;
  shoes: number;
  accent: number;
  /** 'bandana' | 'cap' | 'beanie' — the headgear the model wears. */
  headgear: 'bandana' | 'cap' | 'beanie';
  headgearColor: number;
}

export const ENEMY_DEFS: EnemyDef[] = [
  {
    id: 'yard-enforcer',
    name: 'Yard Enforcer',
    health: 100,
    speed: 2.2,
    detectionRange: 28,
    attackRange: 22,
    attackCooldown: 1.8,
    damage: 10,
    height: 1.06,
    width: 1.18,
    skin: 0x8a5a3b,
    top: 0x3a3f46,
    bottom: 0x2e3138,
    shoes: 0x1a1210,
    accent: 0xc0392b,
    headgear: 'bandana',
    headgearColor: 0xc0392b,
  },
  {
    id: 'lot-runner',
    name: 'Lot Runner',
    health: 60,
    speed: 3.2,
    detectionRange: 32,
    attackRange: 18,
    attackCooldown: 1.4,
    damage: 7,
    height: 0.96,
    width: 0.94,
    skin: 0xc68863,
    top: 0x2f6f6a,
    bottom: 0x1a1a22,
    shoes: 0xe8e6e0,
    accent: 0x35c4ff,
    headgear: 'cap',
    headgearColor: 0x2f6f6a,
  },
  {
    id: 'northgate-lookout',
    name: 'Northgate Lookout',
    health: 80,
    speed: 2.6,
    detectionRange: 36,
    attackRange: 26,
    attackCooldown: 2.2,
    damage: 12,
    height: 1.1,
    width: 1.0,
    skin: 0xe8b98a,
    top: 0x6b5a4a,
    bottom: 0x2a3550,
    shoes: 0x30343a,
    accent: 0xd8b25a,
    headgear: 'beanie',
    headgearColor: 0x4a4a4a,
  },
];

export function getEnemyDef(id: string): EnemyDef | undefined {
  return ENEMY_DEFS.find((d) => d.id === id);
}
