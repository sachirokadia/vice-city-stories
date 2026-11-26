/**
 * Minimap — a north-up, full-city map drawn on canvas from the REAL city
 * layout (`generateLayout`, the same deterministic layout the engine builds
 * the 3D city from), with a live player arrow.
 *
 * Mapping (world → map, linear, no distortion): north (−z) is up, west
 * (−x) is left. u = (x + CITY_HALF) / (2·CITY_HALF) · S,
 * v = (z + CITY_HALF) / (2·CITY_HALF) · S. Heading h has forward
 * (sin h, cos h) in (x, z); on the map that is (sin h, cos h) in (u, v),
 * so the up-pointing arrow is rotated by (π − h).
 *
 * The canvas is redrawn on a 120 ms interval from `engine.getStats()`
 * (position + heading). No React state is set per frame — the draw is
 * imperative, so the HUD never re-renders for the minimap. The interval
 * is cheap (a 360px canvas, ~60 rects) and stops with the component.
 *
 * Shape is a softly chamfered square (not a circle): a circle would clip
 * the city's corners — the beach and the tower plaza live at the edges —
 * while the chamfer keeps the whole layout visible.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { GameEngine } from '../game/GameEngine';
import { generateLayout } from '../game/CityGenerator';
import {
  MAP_SIZE_MINI,
  drawCityBase,
  drawPlayerArrow,
} from '../game/MapDraw';

/** Internal canvas resolution (CSS scales it down; 2x desktop size). */
const S = MAP_SIZE_MINI;

interface MinimapProps {
  /** Ref to the live engine (GameCanvas owns it). */
  engineRef: RefObject<GameEngine | null>;
}

export default function Minimap({ engineRef }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The exact layout the engine built the city from (deterministic seed).
  const layout = useMemo(generateLayout, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // The city base is shared with the full-screen map (MapDraw) —
      // same layout, same coordinates, same colours.
      drawCityBase(ctx, layout, S);

      // --- Player arrow (live position + heading) ---
      const engine = engineRef.current;
      if (!engine) return;
      let stats;
      try {
        stats = engine.getStats();
      } catch {
        return;
      }
      drawPlayerArrow(ctx, stats.position.x, stats.position.z, stats.heading, S);
    };

    draw();
    const id = window.setInterval(draw, 120);
    return () => window.clearInterval(id);
  }, [layout, engineRef]);

  return (
    <div className="vc-minimap" role="img" aria-label="City minimap — north is up">
      <canvas ref={canvasRef} width={S} height={S} className="vc-minimap-canvas" />
    </div>
  );
}
