/**
 * City collectibles — ten "Sunset Coins" hidden in plain sight
 * across the city. Each is a spinning gold coin with a small
 * ground ring; walking over one on foot collects it, plays a
 * short gold burst, and records it exactly once.
 *
 * Stored shape: { collected: string[] } under its own key, so a
 * collectible write can never clobber mission progress, the cash
 * balance, or the garage save. The collection screen reads the
 * same list, so found and missing items are always in sync.
 */
import * as THREE from 'three';

export interface CollectibleDef {
  id: string;
  name: string;
  area: string;
  x: number;
  z: number;
}

export const COLLECTIBLE_DEFS: CollectibleDef[] = [
  { id: 'beacon-plaza', name: 'Beacon Token', area: 'Downtown', x: 10, z: -160 },
  { id: 'downtown-crossroads', name: 'Crossroads Token', area: 'Downtown', x: 60, z: 30 },
  { id: 'north-junction', name: 'Junction Token', area: 'Downtown', x: -60, z: -30 },
  { id: 'west-park-heart', name: 'West Park Token', area: 'West Park', x: -90, z: 60 },
  { id: 'west-park-pond', name: 'Pondside Token', area: 'West Park', x: -70, z: 80 },
  { id: 'east-park-heart', name: 'East Park Token', area: 'East Park', x: 90, z: -60 },
  { id: 'east-park-grove', name: 'Grove Token', area: 'East Park', x: 110, z: -40 },
  { id: 'beach-dune', name: 'Dune Token', area: 'Beach', x: 165, z: 90 },
  { id: 'boardwalk-mid', name: 'Boardwalk Token', area: 'Boardwalk', x: 133, z: 30 },
  { id: 'residential-corner', name: 'Corner Token', area: 'Residential', x: 60, z: 90 },
];

export const COLLECT_RADIUS = 2;

export interface CollectibleRow {
  id: string;
  name: string;
  area: string;
  found: boolean;
}

export interface CollectibleState {
  found: number;
  total: number;
  items: CollectibleRow[];
}

const COLLECTIBLES_KEY = 'vice-city-stories.collectibles.v1';

export function loadCollectedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(COLLECTIBLES_KEY);
    if (raw === null) return new Set();
    const parsed = JSON.parse(raw) as { collected?: unknown };
    const known = new Set(COLLECTIBLE_DEFS.map((c) => c.id));
    if (!Array.isArray(parsed.collected)) return new Set();
    return new Set(
      parsed.collected.filter((id): id is string => typeof id === 'string' && known.has(id)),
    );
  } catch {
    return new Set();
  }
}

export function saveCollectedIds(collected: Set<string>): void {
  try {
    window.localStorage.setItem(
      COLLECTIBLES_KEY,
      JSON.stringify({ collected: [...collected] }),
    );
  } catch {
    /* storage unavailable — the count still works for the session */
  }
}

export interface CollectiblesHandle {
  /** Animate the coins and collect any the player walks over on foot. */
  update: (dt: number, playerPos: THREE.Vector3, onFoot: boolean) => string[];
  /** The collection-screen state (found / missing per item). */
  getState: () => CollectibleState;
  dispose: () => void;
}

/**
 * One gold coin per collectible (spinning, bobbing, no shadow —
 * they are small and numerous), plus a short gold burst that
 * plays where a coin was just picked up.
 */
export function createCollectibles(scene: THREE.Scene): CollectiblesHandle {
  const collected = loadCollectedIds();
  const group = new THREE.Group();
  group.name = 'collectibles';
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose(): void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  const coinGeo = track(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20));
  const coinMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffd23e,
      emissive: 0xaa7700,
      emissiveIntensity: 0.9,
      metalness: 0.8,
      roughness: 0.25,
    }),
  );
  const ringGeo = track(new THREE.RingGeometry(0.7, 0.95, 24));
  const ringMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
  );

  const coins = new Map<string, THREE.Group>();
  for (const def of COLLECTIBLE_DEFS) {
    const coin = new THREE.Group();
    coin.position.set(def.x, 1.1, def.z);
    const disc = new THREE.Mesh(coinGeo, coinMat);
    disc.rotation.x = Math.PI / 2 - 0.35;
    coin.add(disc);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.04;
    coin.add(ring);
    coin.visible = !collected.has(def.id);
    group.add(coin);
    coins.set(def.id, coin);
  }

  // --- Discovery burst: 8 gold shards + an expanding ring, shown
  // for 0.6 s where a coin was collected, then hidden again. ---
  const burst = new THREE.Group();
  burst.visible = false;
  const shardGeo = track(new THREE.TetrahedronGeometry(0.16));
  const shardMat = track(
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 1 }),
  );
  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(shardGeo, shardMat);
    burst.add(s);
    shards.push(s);
  }
  const burstRing = new THREE.Mesh(
    track(new THREE.RingGeometry(0.9, 1.1, 32)),
    track(
      new THREE.MeshBasicMaterial({
        color: 0xffd23e,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
    ),
  );
  burstRing.rotation.x = -Math.PI / 2;
  burst.add(burstRing);
  group.add(burst);
  let burstT = 1;
  const burstDirs = shards.map((_, i) => {
    const a = (i / shards.length) * Math.PI * 2;
    return { x: Math.cos(a), z: Math.sin(a) };
  });

  scene.add(group);
  let time = 0;

  return {
    update: (dt, playerPos, onFoot) => {
      time += dt;
      const picked: string[] = [];
      for (const def of COLLECTIBLE_DEFS) {
        const coin = coins.get(def.id);
        if (!coin || !coin.visible) continue;
        // Spin + bob, each coin on its own phase.
        coin.rotation.y += dt * 2;
        coin.position.y = 1.1 + Math.sin(time * 2 + def.x) * 0.15;
        if (!onFoot) continue;
        const d = Math.hypot(playerPos.x - def.x, playerPos.z - def.z);
        if (d < COLLECT_RADIUS) {
          coin.visible = false;
          collected.add(def.id);
          saveCollectedIds(collected);
          burst.position.set(def.x, 0.4, def.z);
          burst.visible = true;
          burstT = 0;
          picked.push(def.id);
        }
      }
      if (burst.visible) {
        burstT += dt;
        const k = Math.min(1, burstT / 0.6);
        for (let i = 0; i < shards.length; i++) {
          const s = shards[i];
          const dir = burstDirs[i];
          s.position.set(dir.x * k * 2.2, 0.4 + k * 1.6, dir.z * k * 2.2);
          s.rotation.x += dt * 6;
          s.rotation.y += dt * 5;
        }
        const scale = 0.5 + k * 3;
        burstRing.scale.set(scale, scale, 1);
        const mat = burstRing.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.9 * (1 - k);
        (shardMat as THREE.MeshBasicMaterial).opacity = 1 - k;
        if (k >= 1) burst.visible = false;
      }
      return picked;
    },
    getState: () => ({
      found: collected.size,
      total: COLLECTIBLE_DEFS.length,
      items: COLLECTIBLE_DEFS.map((d) => ({
        id: d.id,
        name: d.name,
        area: d.area,
        found: collected.has(d.id),
      })),
    }),
    dispose: () => {
      scene.remove(group);
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* already disposed */
        }
      }
    },
  };
}
