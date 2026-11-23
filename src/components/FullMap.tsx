/**
 * FullMap — the full-screen city map. It draws the SAME city as the
 * minimap (the shared renderer in `../game/MapDraw`, same layout, same
 * north-up coordinate system), at a larger canvas, with real markers:
 *
 * - Beacon Tower, Sunset Garage, Sunset Mart (the base landmarks)
 * - Sunset Range, Sprint start
 * - All ten Sunset Coins (dimmed once collected)
 * - The active story mission (teal diamond) and active job mission
 *   (yellow diamond), from the live board state
 * - The player arrow (white, ringed — unmistakable)
 *
 * Nothing here is invented: every marker is a real world coordinate
 * from the game's own data. Zoom (CSS transform, 0.92–1.14) and
 * drag-to-pan are real controls; clicking a marker (or a row in the
 * sidebar list) selects it and shows its real name, world
 * coordinates and one-line description.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { GameEngine } from '../game/GameEngine';
import type { QualitySettings } from '../game/Quality';
import { generateLayout } from '../game/CityGenerator';
import { COLLECTIBLE_DEFS } from '../game/Collectibles';
import { RANGE_RACK } from '../game/Range';
import { SPRINT_START } from '../game/Sprint';
import { MISSION_DEFS } from '../game/MissionDefinitions';
import { STORY_MISSIONS } from '../game/StoryDefinitions';
import {
  MAP_SIZE_FULL,
  drawCityBase,
  drawMapMarker,
  drawPlayerArrow,
  worldToMap,
} from '../game/MapDraw';
import type { MapMarkerTone } from '../game/MapDraw';
import { VcIcon } from './ui/VcIcon';

const S = MAP_SIZE_FULL;
const ZOOM_MIN = 0.92;
const ZOOM_MAX = 1.14;
const ZOOM_STEP = 0.04;

type LocationKind =
  | 'tower'
  | 'garage'
  | 'store'
  | 'range'
  | 'sprint'
  | 'coin'
  | 'mission-story'
  | 'mission-job';

interface MapLocation {
  id: string;
  name: string;
  kind: LocationKind;
  x: number;
  z: number;
  detail: string;
  /** Coins only: whether this one is already collected. */
  found?: boolean;
  /** Marker tone on the canvas (undefined = drawn by the base layer). */
  tone?: MapMarkerTone;
}

const KIND_DOT: Record<LocationKind, string> = {
  tower: 'legend-dot--tower',
  garage: 'legend-dot--garage',
  store: 'legend-dot--store',
  range: 'legend-dot--range',
  sprint: 'legend-dot--sprint',
  coin: 'legend-dot--coin',
  'mission-story': 'legend-dot--mission-story',
  'mission-job': 'legend-dot--mission-job',
};

interface FullMapProps {
  engineRef: RefObject<GameEngine | null>;
  quality: QualitySettings | null;
  onBack: () => void;
}

export default function FullMap({ engineRef, quality, onBack }: FullMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  const layout = useMemo(() => (quality ? generateLayout(quality) : null), [quality]);

  // Real markers, read once from the live game state when the map opens
  // (the engine is stopped while the map is up, so nothing moves).
  const locations = useMemo<MapLocation[]>(() => {
    const engine = engineRef.current;
    const list: MapLocation[] = [
      {
        id: 'tower',
        name: 'Beacon Tower',
        kind: 'tower',
        x: 0,
        z: -172,
        detail: 'The city’s northern landmark — the tower plaza.',
      },
      {
        id: 'garage',
        name: 'Sunset Garage',
        kind: 'garage',
        x: 22,
        z: 52,
        detail: 'Buy, paint and upgrade your cars.',
      },
      {
        id: 'store',
        name: 'Sunset Mart',
        kind: 'store',
        x: 43,
        z: 15,
        detail: 'Snacks and supplies — Water, Snack, Energy.',
      },
      {
        id: 'range',
        name: 'Sunset Range',
        kind: 'range',
        x: RANGE_RACK.x,
        z: RANGE_RACK.z,
        detail: 'Target practice — buy and try weapons.',
        tone: 'range',
      },
      {
        id: 'sprint',
        name: 'Sprint Start',
        kind: 'sprint',
        x: SPRINT_START.x,
        z: SPRINT_START.z,
        detail: 'Sunset Sprint — the timed run starts here.',
        tone: 'sprint',
      },
    ];
    if (engine) {
      try {
        const collected = engine.getCollectibleState();
        for (const def of COLLECTIBLE_DEFS) {
          const found = collected.items.find((i) => i.id === def.id)?.found ?? false;
          list.push({
            id: `coin-${def.id}`,
            name: def.name,
            kind: 'coin',
            x: def.x,
            z: def.z,
            detail: `${def.area} — ${found ? 'already collected.' : 'not collected yet.'}`,
            found,
            tone: found ? 'coin-found' : 'coin',
          });
        }
        const storyBoard = engine.getStoryBoard();
        const storyEntries = storyBoard.chapters.flatMap((c) => c.entries);
        const storyEntry =
          storyEntries.find((e) => e.active) ?? storyEntries.find((e) => e.selected) ?? null;
        if (storyEntry) {
          const def = STORY_MISSIONS.find((m) => m.id === storyEntry.id);
          if (def) {
            list.push({
              id: `mission-story-${def.id}`,
              name: def.title,
              kind: 'mission-story',
              x: def.startMarker.x,
              z: def.startMarker.z,
              detail: `Story mission — ${def.giver}.`,
              tone: 'mission-story',
            });
          }
        }
        const missionBoard = engine.getMissionBoard();
        const jobEntry =
          missionBoard.entries.find((e) => e.active) ??
          missionBoard.entries.find((e) => e.selected) ??
          null;
        if (jobEntry) {
          const def = MISSION_DEFS.find((m) => m.id === jobEntry.id);
          if (def) {
            list.push({
              id: `mission-job-${def.id}`,
              name: def.title,
              kind: 'mission-job',
              x: def.startMarker.x,
              z: def.startMarker.z,
              detail: `Job — ${def.giver}, $${def.reward.toLocaleString('en-US')}.`,
              tone: 'mission-job',
            });
          }
        }
      } catch {
        /* engine mid-dispose — the base locations still render */
      }
    }
    return list;
  }, [engineRef]);

  const selected = locations.find((l) => l.id === selectedId) ?? null;
  const coinsFound = locations.filter((l) => l.kind === 'coin' && l.found).length;
  const coinsTotal = locations.filter((l) => l.kind === 'coin').length;

  // Redraw on the same 120 ms cadence as the minimap (the player arrow
  // is live; nothing else moves while the map is open). No React state
  // is set per frame — the draw is imperative.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const draw = () => {
      if (!layout) return;
      drawCityBase(ctx, layout, S);
      for (const loc of locations) {
        if (loc.tone) drawMapMarker(ctx, { x: loc.x, z: loc.z, tone: loc.tone }, S);
      }
      // Highlight ring around the selected marker.
      if (selected) {
        const p = worldToMap(selected.x, selected.z, S);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.u, p.v, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const engine = engineRef.current;
      if (!engine) return;
      try {
        const stats = engine.getStats();
        drawPlayerArrow(ctx, stats.position.x, stats.position.z, stats.heading, S, true);
      } catch {
        /* engine mid-dispose */
      }
    };
    draw();
    const id = window.setInterval(draw, 120);
    return () => window.clearInterval(id);
  }, [layout, locations, selected, engineRef]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    setPan({ x: drag.panX + dx, y: drag.panY + dy });
  };
  const onPointerUp = () => {
    if (dragRef.current?.moved) suppressClickRef.current = true;
    dragRef.current = null;
  };

  // Click-to-select lives on the WRAP, not the canvas: the wrap
  // captures the pointer for drag-to-pan, which retargets the
  // subsequent click to the wrap — a canvas onClick would never fire.
  // A drag suppresses the click that follows it (see onPointerUp).
  const onWrapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    // getBoundingClientRect already accounts for the zoom/pan transform.
    const u = ((e.clientX - rect.left) / rect.width) * S;
    const v = ((e.clientY - rect.top) / rect.height) * S;
    let best: MapLocation | null = null;
    let bestD = 16;
    for (const loc of locations) {
      const p = worldToMap(loc.x, loc.z, S);
      const d = Math.hypot(p.u - u, p.v - v);
      if (d < bestD) {
        bestD = d;
        best = loc;
      }
    }
    if (best) setSelectedId(best.id);
  };

  return (
    <div className="panel-overlay" role="dialog" aria-modal="true" aria-label="City map">
      <div className="panel panel--map map-screen">
        <div className="map-screen__top">
          <div>
            <p className="eyebrow">WORLD OVERVIEW</p>
            <h2 className="map-title">VICE CITY</h2>
            <p className="map-subtitle">
              {locations.length} locations · {coinsFound} of {coinsTotal} coins found · north is up
            </p>
          </div>
          <button type="button" className="panel-close" onClick={onBack} aria-label="Close map">
            ✕
          </button>
        </div>

        <div className="map-layout">
          <div
            className="map-wrap"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onWrapClick}
          >
            <div
              className="map-transform"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              <canvas
                ref={canvasRef}
                width={S}
                height={S}
                className="map-canvas"
                role="img"
                aria-label="Full city map — north is up"
              />
            </div>
          </div>

          <aside className="map-sidebar" aria-label="Map details">
            <div className="map-sidebar__heading">
              <span className="map-selected-icon">
                <VcIcon name="pin" size={17} />
              </span>
              <div>
                <p className="eyebrow">{selected ? 'SELECTED LOCATION' : 'TAP A MARKER'}</p>
                <h3>{selected ? selected.name : 'Vice City'}</h3>
              </div>
            </div>
            <p className="map-sidebar__copy">
              {selected
                ? selected.detail
                : 'Every marker is a real place in the city. Tap one on the map, or pick it from the list.'}
            </p>
            {selected && (
              <div className="map-coordinates">
                <span>WORLD COORDS</span>
                <b>
                  X {selected.x} · Z {selected.z}
                </b>
              </div>
            )}

            <div className="map-locations" role="list" aria-label="Locations">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  role="listitem"
                  className={`map-location-row${loc.id === selectedId ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(loc.id)}
                >
                  <i className={`legend-dot ${KIND_DOT[loc.kind]}`} aria-hidden="true" />
                  <span>{loc.name}</span>
                  {loc.kind === 'coin' && loc.found && <VcIcon name="check" size={13} />}
                </button>
              ))}
            </div>

            <div className="map-legend" aria-label="Map legend">
              {(
                [
                  ['player', 'Player'],
                  ['mission-story', 'Story mission'],
                  ['mission-job', 'Job'],
                  ['garage', 'Garage'],
                  ['store', 'Mart'],
                  ['range', 'Range'],
                  ['sprint', 'Sprint'],
                  ['coin', 'Coin'],
                ] as Array<[LocationKind | 'player', string]>
              ).map(([kind, label]) => (
                <span key={label}>
                  <i className={`legend-dot ${kind === 'player' ? 'legend-dot--player' : KIND_DOT[kind as LocationKind]}`} />
                  {label}
                </span>
              ))}
            </div>

            <div className="map-zoom">
              <button
                type="button"
                className="hud-button"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
              >
                −
              </button>
              <span aria-label={`Zoom ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="hud-button"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
              >
                +
              </button>
            </div>

            <button type="button" className="play-button map-back" onClick={onBack}>
              <VcIcon name="back" size={15} />
              <span>Back</span>
            </button>
          </aside>
        </div>

        <p className="screen-footer">
          <span>DRAG TO PAN · TAP A MARKER FOR DETAILS</span>
          <span>THE MAP IS THE REAL CITY — SAME STREETS AS THE MINIMAP</span>
        </p>
      </div>
    </div>
  );
}
