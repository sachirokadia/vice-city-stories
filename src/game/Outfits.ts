/**
 * Outfits — six original looks for the same protagonist model.
 * An outfit is a recolour of the character's existing materials
 * plus two visibility toggles (hood, gold chain): the face, body,
 * rig and animations are never touched, so the character moves
 * exactly the way it always did.
 *
 * Stored shape: { owned: string[], selected: string } under its
 * own key, so an outfit write can never clobber mission progress,
 * the cash balance, or the garage save.
 */
import type { CharacterMaterials, CharacterParts } from './Character';
import { getPalmPrintTexture } from './PalmPrintTexture';

export interface OutfitDef {
  id: string;
  name: string;
  description: string;
  /** Purchase price; 0 means owned from the start. */
  price: number;
  jacket: number;
  sleeve: number;
  shirt: number;
  thigh: number;
  shin: number;
  shoe: number;
  sole: number;
  /** Gold chain visible. */
  chain: boolean;
  /** Hood visible. */
  hood: boolean;
  /**
   * Procedural fabric print on the jacket/sleeve materials.
   * 'palm' paints the shared palm-print texture over the
   * jacket colour; omitted = flat colour as before.
   */
  shirtTexture?: 'palm';
  /**
   * Unlock-only (9E): never buyable — earned from the story
   * (the crew jacket, for holding the beach in 2.2). The panel
   * shows an unlock note instead of a Buy button, and the
   * engine refuses to sell it.
   */
  unlockOnly?: boolean;
}

export const DEFAULT_OUTFIT_ID = 'default-hoodie';

export const OUTFIT_DEFS: OutfitDef[] = [
  {
    id: 'default-hoodie',
    name: 'Street Hoodie',
    description: 'The look he started with — grey hoodie, cream tee, dark cargo, gold chain.',
    price: 0,
    jacket: 0x5a5f66,
    sleeve: 0x5a5f66,
    shirt: 0xd8d2c4,
    thigh: 0x2e3138,
    shin: 0x2e3138,
    shoe: 0x30343a,
    sole: 0xe8e6e0,
    chain: true,
    hood: true,
  },
  {
    id: 'casual-streetwear',
    name: 'Casual Streetwear',
    description: 'Teal jacket, white tee, blue jeans, red sneakers. Everyday Vice City.',
    price: 300,
    jacket: 0x0e7c7b,
    sleeve: 0x0e7c7b,
    shirt: 0xf2f2f2,
    thigh: 0x2f4d7a,
    shin: 0x2f4d7a,
    shoe: 0xc23b2e,
    sole: 0xe8e6e0,
    chain: true,
    hood: true,
  },
  {
    id: 'beach-day',
    name: 'Beach Day',
    description: 'Coral open shirt, khaki shorts, bare legs, sandals. Built for the boardwalk.',
    price: 250,
    jacket: 0xff7a5c,
    sleeve: 0xc68863,
    shirt: 0xf5f0e6,
    thigh: 0xc9a86a,
    shin: 0xc68863,
    shoe: 0x6b4a2f,
    sole: 0x8a6a44,
    chain: true,
    hood: false,
  },
  {
    id: 'night-out',
    name: 'Night Out',
    description: 'Black blazer, white shirt, black trousers, black shoes. No hood, no chain.',
    price: 500,
    jacket: 0x1c1c22,
    sleeve: 0x1c1c22,
    shirt: 0xf5f5f5,
    thigh: 0x14141a,
    shin: 0x14141a,
    shoe: 0x0f0f12,
    sole: 0x2a2a30,
    chain: false,
    hood: false,
  },
  {
    id: 'palm-print',
    name: 'Palm Print',
    description: 'Turquoise palm-print open shirt, cream trousers, gold chain. Sunset City, wearable.',
    price: 450,
    jacket: 0x0e7c7b,
    sleeve: 0x0e7c7b,
    shirt: 0xf2ead8,
    thigh: 0xf2ead8,
    shin: 0xf2ead8,
    shoe: 0xf5f5f5,
    sole: 0xe8e6e0,
    chain: true,
    hood: false,
    shirtTexture: 'palm',
  },
  {
    id: 'crew-jacket',
    name: 'Crew Jacket',
    description: 'Northgate teal jacket, earned for holding the beach in HOLD THE LINE. The crew knows what it means.',
    price: 0,
    jacket: 0x0f766e,
    sleeve: 0x0f766e,
    shirt: 0x26262a,
    thigh: 0x2e3138,
    shin: 0x2e3138,
    shoe: 0x30343a,
    sole: 0xe8e6e0,
    chain: true,
    hood: false,
    unlockOnly: true,
  },
];

export function getOutfit(id: string): OutfitDef | undefined {
  return OUTFIT_DEFS.find((o) => o.id === id);
}

export interface OutfitState {
  owned: string[];
  selected: string;
}

const OUTFITS_KEY = 'vice-city-stories.outfits.v1';

export function defaultOutfitState(): OutfitState {
  return { owned: [DEFAULT_OUTFIT_ID], selected: DEFAULT_OUTFIT_ID };
}

export function loadOutfitState(): OutfitState {
  try {
    const raw = window.localStorage.getItem(OUTFITS_KEY);
    if (raw === null) return defaultOutfitState();
    const parsed = JSON.parse(raw) as Partial<OutfitState>;
    const known = new Set(OUTFIT_DEFS.map((o) => o.id));
    const owned = Array.isArray(parsed.owned)
      ? parsed.owned.filter((id): id is string => typeof id === 'string' && known.has(id))
      : [];
    if (!owned.includes(DEFAULT_OUTFIT_ID)) owned.unshift(DEFAULT_OUTFIT_ID);
    const selected =
      typeof parsed.selected === 'string' && owned.includes(parsed.selected)
        ? parsed.selected
        : DEFAULT_OUTFIT_ID;
    return { owned, selected };
  } catch {
    return defaultOutfitState();
  }
}

export function saveOutfitState(state: OutfitState): void {
  try {
    window.localStorage.setItem(OUTFITS_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — outfits still work for the session */
  }
}

/** Recolour the live character to an outfit (face, rig and animation untouched). */
export function applyOutfit(
  mats: CharacterMaterials,
  parts: CharacterParts,
  outfit: OutfitDef,
): void {
  mats.jacket.color.setHex(outfit.jacket);
  mats.sleeve.color.setHex(outfit.sleeve);
  mats.shirt.color.setHex(outfit.shirt);
  mats.thigh.color.setHex(outfit.thigh);
  mats.shin.color.setHex(outfit.shin);
  mats.shoe.color.setHex(outfit.shoe);
  mats.sole.color.setHex(outfit.sole);
  // Fabric print: the shared palm texture on jacket/sleeve for
  // the Palm Print outfit, cleared for every other outfit so a
  // print can never leak onto a flat-colour look. needsUpdate
  // only when the map actually changes.
  const palm = outfit.shirtTexture === 'palm' ? getPalmPrintTexture() : null;
  for (const m of [mats.jacket, mats.sleeve]) {
    if (m.map !== palm) {
      m.map = palm;
      m.needsUpdate = true;
    }
  }
  parts.hood.visible = outfit.hood;
  parts.chain.visible = outfit.chain;
}
