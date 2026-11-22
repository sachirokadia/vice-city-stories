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
import type { QualitySettings } from '../game/Quality';
import {
  CITY_HALF,
  GARAGE_CENTRE,
  ROAD_HALF,
  STORE_CENTRE,
  generateLayout,
} from '../game/CityGenerator';

/** Internal canvas resolution (CSS scales it down; 2x desktop size). */
const S = 360;
const HALF = CITY_HALF; // 190 — the city spans −190 … +190 on both axes.

/** World → canvas px (north up). */
function toMap(x: number, z: number): { u: number; v: number } {
  return {
    u: ((x + HALF) / (2 * HALF)) * S,
    v: ((z + HALF) / (2 * HALF)) * S,
  };
}

interface MinimapProps {
  /** Ref to the live engine (GameCanvas owns it). */
  engineRef: RefObject<GameEngine | null>;
  /** Current quality tier — only used to build the layout (streets and
   *  blocks are quality-independent; only building plots vary). */
  quality: QualitySettings | null;
}

export default function Minimap({ engineRef, quality }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The exact layout the engine built the city from (deterministic seed).
  const layout = useMemo(() => (quality ? generateLayout(quality) : null), [quality]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // --- Base: dark translucent ground ---
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(16, 9, 34, 0.88)';
      ctx.fillRect(0, 0, S, S);

      if (!layout) return;

      const scale = S / (2 * HALF); // px per world unit
      const roadW = ROAD_HALF * 2 * scale;

      // --- Water (east of the ocean wall) + beach sand ---
      const water = toMap(layout.waterStartX, 0);
      ctx.fillStyle = 'rgba(28, 84, 128, 0.9)';
      ctx.fillRect(water.u, 0, S - water.u, S);
      const beach = toMap(layout.beachStartX, 0);
      ctx.fillStyle = 'rgba(214, 178, 120, 0.55)';
      ctx.fillRect(beach.u, 0, water.u - beach.u, S);

      // --- Roads: the real avenue / street grid ---
      ctx.fillStyle = 'rgba(255, 243, 226, 0.16)';
      for (const sx of layout.streetsX) {
        const { u } = toMap(sx, 0);
        ctx.fillRect(u - roadW / 2, 0, roadW, S);
      }
      for (const sz of layout.streetsZ) {
        const { v } = toMap(0, sz);
        ctx.fillRect(0, v - roadW / 2, S, roadW);
      }

      // --- City blocks (the real blocks the buildings sit on) ---
      ctx.fillStyle = 'rgba(255, 243, 226, 0.10)';
      for (const b of layout.blocks) {
        const a = toMap(b.minX, b.minZ);
        const c = toMap(b.maxX, b.maxZ);
        ctx.fillRect(a.u, a.v, c.u - a.u, c.v - a.v);
      }

      // --- Parks (green) ---
      ctx.fillStyle = 'rgba(120, 200, 120, 0.28)';
      for (const p of layout.parks) {
        const a = toMap(p.minX, p.minZ);
        const c = toMap(p.maxX, p.maxZ);
        ctx.fillRect(a.u, a.v, c.u - a.u, c.v - a.v);
      }

      // --- Landmarks: Beacon Tower (north), Garage, Sunset Mart ---
      const tower = toMap(layout.towerPos.x, layout.towerPos.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(tower.u, tower.v, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(18, 10, 36, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const garage = toMap(GARAGE_CENTRE.x, GARAGE_CENTRE.z);
      ctx.fillStyle = '#ff5e8a';
      ctx.beginPath();
      ctx.arc(garage.u, garage.v, 3.5, 0, Math.PI * 2);
      ctx.fill();

      const store = toMap(STORE_CENTRE.x, STORE_CENTRE.z);
      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(store.u, store.v, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // --- North tick ---
      ctx.fillStyle = 'rgba(255, 243, 226, 0.75)';
      ctx.font = '700 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('N', S / 2, 6);

      // --- Player arrow (live position + heading) ---
      const engine = engineRef.current;
      if (!engine) return;
      let stats;
      try {
        stats = engine.getStats();
      } catch {
        return;
      }
      const p = toMap(stats.position.x, stats.position.z);
      ctx.save();
      ctx.translate(p.u, p.v);
      // Up-pointing arrow rotated by (π − heading) — see header.
      ctx.rotate(Math.PI - stats.heading);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(18, 10, 36, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(9, 9);
      ctx.lineTo(0, 4);
      ctx.lineTo(-9, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
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
