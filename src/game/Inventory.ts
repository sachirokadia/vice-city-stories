/**
 * The convenience store's inventory — what the player has bought
 * at Sunset Mart. Items are collectibles for now: no hunger or
 * stamina mechanics, just a count per item that persists.
 *
 * Stored shape: { water: number, snack: number, energy: number }.
 * Kept under its own key so a shop write can never clobber mission
 * progress, the cash balance, or the garage save.
 */
export type ShopItemId = 'water' | 'snack' | 'energy';

export interface ShopItemDef {
  id: ShopItemId;
  name: string;
  description: string;
  price: number;
}

export const SHOP_ITEMS: ShopItemDef[] = [
  { id: 'water', name: 'Water', description: 'Cold bottled water. Straight from the chiller.', price: 10 },
  { id: 'snack', name: 'Snack', description: 'A salty crunch bar. Keeps the night going.', price: 20 },
  { id: 'energy', name: 'Energy Drink', description: 'Sunset Buzz — sweet, fizzy, and far too strong.', price: 35 },
];

export function getShopItem(id: string): ShopItemDef | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

export interface InventoryState {
  water: number;
  snack: number;
  energy: number;
}

const INVENTORY_KEY = 'vice-city-stories.inventory.v1';

export function defaultInventory(): InventoryState {
  return { water: 0, snack: 0, energy: 0 };
}

function clampCount(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, Math.floor(n)));
}

export function loadInventory(): InventoryState {
  try {
    const raw = window.localStorage.getItem(INVENTORY_KEY);
    if (raw === null) return defaultInventory();
    const parsed = JSON.parse(raw) as Partial<InventoryState>;
    return {
      water: clampCount(parsed.water),
      snack: clampCount(parsed.snack),
      energy: clampCount(parsed.energy),
    };
  } catch {
    return defaultInventory();
  }
}

export function saveInventory(state: InventoryState): void {
  try {
    window.localStorage.setItem(INVENTORY_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the inventory still works for the session */
  }
}
