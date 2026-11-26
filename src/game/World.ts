/**
 * The city itself — now assembled from the Phase 2 modules:
 * CityGenerator (the street grid + districts), Buildings, Roads,
 * Vegetation and Environment (beach + ocean). This file only owns the
 * base ground, the block pads, the spawn plaza and the tower plaza,
 * and wires the builders together.
 *
 * All geometry is procedural and original — no copied assets.
 * No physics engine: the world hands the player a list of building
 * footprints (axis-aligned boxes) for simple kinematic collision.
 * Sky and lights live in Lighting.ts.
 */
import * as THREE from 'three';
import type { QualitySettings } from './Quality';
import { generateLayout, CITY_HALF } from './CityGenerator';
import { buildBeaconTower } from './Buildings';
import { buildCityArchitecture } from './CityArchitecture';
import type { Track } from './Buildings';
import { buildRoads } from './Roads';
import type { SignalState } from './Roads';
import { buildVegetation } from './Vegetation';
import { buildEnvironment } from './Environment';
import { buildStreetProps } from './StreetProps';
import { buildGarage } from './Garage';
import { buildShop } from './Shop';
import { GeometryBatch, composeMatrix } from './Merge';
import { coastalCollisionBoxes } from './CoastalDistrictLayout';
import { installCoastalDistrict } from './CoastalDistrict';
import type { CoastalLoadStatus } from './CoastalDistrict';

export interface BuildingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Top of the solid, in metres. Absent = unknown (the combat
   * ray falls back to 30, the tallest ordinary building). */
  maxY?: number;
}

export interface WorldHandle {
  ready: Promise<CoastalLoadStatus>;
  group: THREE.Group;
  /** Building footprints for kinematic collision (player circle vs box). */
  buildings: BuildingBox[];
  /** Live traffic-signal state (the same system the bulbs show). */
  signals: SignalState;
  /** Per-frame world animation (ocean, traffic lights). */
  update: (dt: number) => void;
  /** Call to dispose geometries/materials and remove the group. */
  dispose: () => void;
}

function makeGroundTexture(track: Track): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2e2a33';
  ctx.fillRect(0, 0, 512, 512);
  // Subtle asphalt noise.
  for (let i = 0; i < 2600; i++) {
    const v = 38 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${v},${v - 2},${v + 6})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // Sidewalk grid lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  const tex = track(new THREE.CanvasTexture(c));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene: THREE.Scene, quality: QualitySettings, onAssets?: (status: CoastalLoadStatus) => void): WorldHandle {
  const group = new THREE.Group();
  group.name = 'vice-city';
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  const layout = generateLayout();

  // ---- Base ground (under everything) ----
  const groundTex = makeGroundTexture(track);
  const ground = new THREE.Mesh(
    track(new THREE.PlaneGeometry(CITY_HALF + 20 + layout.waterStartX - 8, CITY_HALF * 2 + 40)),
    track(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 })),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = (layout.waterStartX - 8 - CITY_HALF - 20) / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  // ---- Block pads: parcels read as concrete between the streets ----
  // Separate land use visually while batching each surface.
  const padSurfaces = {
    paving: { batch: new GeometryBatch(), color: 0x8f887a },
    garden: { batch: new GeometryBatch(), color: 0x697453 },
    service: { batch: new GeometryBatch(), color: 0x797c75 },
  };
  const padGeo = track(new THREE.PlaneGeometry(1, 1));
  for (const block of layout.blocks) {
    if (block.district === 'park') continue; // grass goes in Vegetation
    const use = block.district === 'residential' ? 'garden' : block.district === 'industrial' ? 'service' : 'paving';
    padSurfaces[use].batch.add(
      padGeo,
      composeMatrix(block.cx, 0.02, block.cz, 0, block.maxX - block.minX, block.maxZ - block.minZ, 1, -Math.PI / 2),
    );
  }
  for (const surface of Object.values(padSurfaces)) {
    const geometry = surface.batch.build();
    if (!geometry) continue;
    const pads = new THREE.Mesh(track(geometry), track(new THREE.MeshStandardMaterial({ color: surface.color, roughness: .94 })));
    pads.receiveShadow = true;
    group.add(pads);
  }

  // ---- The city itself, from the Phase 2 modules ----
  const buildings = buildCityArchitecture(group, layout, quality, track);
  buildings.push(...coastalCollisionBoxes());
  const coastalDistrict = installCoastalDistrict(group, quality, onAssets);
  const roads = buildRoads(group, layout, quality, track);
  buildVegetation(group, layout, quality, track);
  buildStreetProps(group, layout, quality, track);
  const env = buildEnvironment(group, layout, track);

  // ---- The Sunset Garage: one physical garage, south-east of spawn.
  // Its walls are solid; the apron in front is walkable. ----
  buildings.push(buildGarage(group, track).box);

  // ---- Sunset Mart: the convenience store, north-east of spawn.
  // Its walls are solid; the door is reached from the sidewalk. ----
  buildings.push(buildShop(group, track).box);

  // ---- Beacon Tower plaza (north end of the x = 0 avenue) ----
  const plazaMat = track(new THREE.MeshStandardMaterial({ color: 0x4a4454, roughness: 0.95 }));
  const towerPad = new THREE.Mesh(track(new THREE.PlaneGeometry(30, 26)), plazaMat);
  towerPad.rotation.x = -Math.PI / 2;
  towerPad.position.set(layout.towerPos.x, 0.02, layout.towerPos.z);
  towerPad.receiveShadow = true;
  group.add(towerPad);
  buildings.push(buildBeaconTower(group, layout.towerPos.x, layout.towerPos.z, track));

  // ---- Spawn plaza marker: a thin ring, not a filled disc ----
  const plaza = new THREE.Mesh(
    track(new THREE.RingGeometry(3.2, 3.7, 40)),
    track(new THREE.MeshStandardMaterial({ color: '#ff5e8a', roughness: 0.7, transparent: true, opacity: 0.75 })),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.05, 8);
  plaza.receiveShadow = true;
  group.add(plaza);

  // ---- The water's edge is a wall: the player stops at the beach ----
  buildings.push({
    minX: layout.waterStartX - 8,
    maxX: layout.waterStartX + 240,
    minZ: -CITY_HALF - 40,
    maxZ: CITY_HALF + 40,
    maxY: 30,
  });

  scene.add(group);

  return {
    ready: coastalDistrict.ready,
    group,
    buildings,
    signals: roads.signals,
    update: (dt: number) => {
      env.update(dt);
      roads.update?.(dt);
    },
    dispose: () => {
      coastalDistrict.dispose();
      scene.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj instanceof THREE.InstancedMesh) obj.dispose();
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
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
