/**
 * Palm-print fabric texture — an original procedural pattern for
 * the Palm Print outfit (Phase 2 character work).
 *
 * No image asset, no copyrighted pattern: a 256×256 canvas is
 * painted once with white plus dark-teal palm fronds, and the
 * result is used as the `map` of the jacket/sleeve materials.
 * The material colour multiplies over the texture, so the white
 * base keeps the turquoise jacket colour and the fronds read
 * darker — the print is in the fabric, not a flat colour.
 *
 * Module-level cache: one texture for the life of the app. It is
 * a shared asset, never a per-character disposable, so it must
 * NOT be added to any track()/dispose list — the materials that
 * reference it are disposed by their owners, the texture lives on.
 */
import * as THREE from 'three';

let cached: THREE.CanvasTexture | null = null;

/** Deterministic pseudo-random (mulberry32) so the print is stable across loads. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintPalmPrint(): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const rand = rng(20261123);
  // ~16 fronds: a curved stem with short leaflets branching off.
  // Dark teal, near-opaque, so the print reads clearly against
  // the turquoise jacket colour it multiplies over — the first
  // version (0.55 alpha) read as faint mottling at preview scale.
  ctx.strokeStyle = 'rgba(6, 52, 50, 0.85)';
  ctx.lineCap = 'round';
  for (let f = 0; f < 16; f++) {
    const ox = rand() * size;
    const oy = rand() * size;
    const angle = rand() * Math.PI * 2;
    const len = 42 + rand() * 38;
    const bend = (rand() - 0.5) * 1.1;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const px = -dy;
    const py = dx;
    // Stem.
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.quadraticCurveTo(ox + dx * len * 0.5 + px * bend * len * 0.4, oy + dy * len * 0.5 + py * bend * len * 0.4, ox + dx * len, oy + dy * len);
    ctx.stroke();
    // Leaflets along the stem.
    ctx.lineWidth = 2.2;
    const leaflets = 7;
    for (let i = 1; i <= leaflets; i++) {
      const t = i / (leaflets + 1);
      const bx = ox + dx * len * t + px * bend * len * 0.4 * t * t;
      const by = oy + dy * len * t + py * bend * len * 0.4 * t * t;
      const ll = 12 + rand() * 8;
      const spread = 0.6 + rand() * 0.3;
      for (const s of [-1, 1]) {
        const lx = Math.cos(angle + s * spread);
        const ly = Math.sin(angle + s * spread);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + lx * ll, by + ly * ll);
        ctx.stroke();
      }
    }
  }
  // A few small dots to break the repeat.
  ctx.fillStyle = 'rgba(6, 52, 50, 0.5)';
  for (let d = 0; d < 24; d++) {
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 1.5 + rand() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/** The shared palm-print texture (created lazily, cached forever). */
export function getPalmPrintTexture(): THREE.CanvasTexture {
  if (!cached) {
    cached = new THREE.CanvasTexture(paintPalmPrint());
    cached.wrapS = THREE.RepeatWrapping;
    cached.wrapT = THREE.RepeatWrapping;
    cached.colorSpace = THREE.SRGBColorSpace;
    cached.anisotropy = 4;
  }
  return cached;
}
