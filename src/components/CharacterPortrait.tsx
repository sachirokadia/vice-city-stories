/**
 * A dialogue portrait rendered from the actual configured
 * character model (Phase 1).
 *
 * Why a cached still, not a live renderer: DialoguePanel
 * remounts on every dialogue node (key={nodeId} — the typewriter
 * reset, 7.1/7.7), so a per-mount WebGLRenderer would create and
 * destroy a context on every line. Instead one shared offscreen
 * renderer renders each lead once, the frame is cached as a
 * data URL, and the component is a plain <img> after that.
 * The character is disposed immediately after its frame, so no
 * portrait ever adds a permanent draw call or a leak.
 *
 * Speakers without a design (Kai, Rico, everyone else) get
 * null — the panel falls back to the initial medallion. A
 * design's portraitAsset, when set, is used instead of a render
 * (approved assets only — never an unrelated concept image).
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { createCharacter } from '../game/Character';
import { storyCharacter } from '../game/StoryCharacters';

const PORTRAIT_SIZE = 256;

/** speakerId -> rendered portrait data URL (or asset URL). */
const cache = new Map<string, string>();

/**
 * Lifecycle stats, exposed for verification (same debug-handle
 * pattern as window.__vcsEngine): `renders` counts real model
 * renders (one per lead, ever), `cacheHits` counts served-from-
 * cache calls (one per dialogue node after the first). If a
 * renderer were recreated per line, `renders` would grow with
 * the node count instead of staying at the speaker count.
 */
const stats = { renders: 0, cacheHits: 0 };
if (typeof window !== 'undefined') {
  (window as unknown as { __vcsPortraits?: typeof stats }).__vcsPortraits = stats;
}

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;

function getShared(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null {
  try {
    if (!renderer) {
      const canvas = document.createElement('canvas');
      canvas.width = PORTRAIT_SIZE;
      canvas.height = PORTRAIT_SIZE;
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(1);
      scene = new THREE.Scene();
      scene.background = null;
      camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      // Head-and-shoulders framing, slightly three-quarter so
      // long hair reads over the shoulder.
      camera.position.set(0.12, 1.6, 1.5);
      camera.lookAt(0, 1.52, 0);
      const hemi = new THREE.HemisphereLight(0xfff2dd, 0x2a2a33, 1.1);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
      sun.position.set(4, 8, 3);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0x7fb4ff, 0.7);
      fill.position.set(-5, 3, -4);
      scene.add(fill);
    }
    if (!scene || !camera) return null;
    return { renderer, scene, camera };
  } catch {
    // No WebGL (or context creation failed) — the panel falls
    // back to the medallion instead of breaking dialogue.
    return null;
  }
}

/** Render one speaker's portrait (or return the cached frame). */
export function getPortraitDataUrl(speakerId: string): string | null {
  const cached = cache.get(speakerId);
  if (cached !== undefined) {
    stats.cacheHits += 1;
    return cached;
  }
  const info = storyCharacter(speakerId);
  if (!info.design) return null;
  if (info.design.portraitAsset) {
    cache.set(speakerId, info.design.portraitAsset);
    return info.design.portraitAsset;
  }
  const shared = getShared();
  if (!shared) return null;
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const { group, mats } = createCharacter(track, info.design);
  // Same recolour as a staged actor (CinematicStaging).
  const palette = info.palette;
  if (palette) {
    mats.jacket.color.set(palette.jacket);
    mats.sleeve.color.set(palette.jacket);
    mats.shirt.color.set(palette.shirt);
    mats.thigh.color.set(palette.trousers);
    mats.shin.color.set(palette.trousers);
    mats.hair.color.set(palette.hair);
    if (palette.skin) mats.skin.color.set(palette.skin);
  }
  group.rotation.y = -0.35;
  shared.scene.add(group);
  shared.renderer.render(shared.scene, shared.camera);
  stats.renders += 1;
  const url = shared.renderer.domElement.toDataURL('image/png');
  shared.scene.remove(group);
  for (const d of disposables) {
    try {
      d.dispose();
    } catch {
      /* already disposed */
    }
  }
  cache.set(speakerId, url);
  return url;
}

// Debug handle for verification (same pattern as __vcsPortraits
// above): lets a harness render each speaker's portrait directly
// and confirm the shared renderer/cache serve distinct images.
if (typeof window !== 'undefined') {
  (window as unknown as { __vcsPortraitFor?: typeof getPortraitDataUrl }).__vcsPortraitFor = getPortraitDataUrl;
}

interface CharacterPortraitProps {
  speakerId: string;
  speakerName: string;
  speakerColor: string;
}

export default function CharacterPortrait({ speakerId, speakerName, speakerColor }: CharacterPortraitProps) {
  const [src, setSrc] = useState<string | null>(() => cache.get(speakerId) ?? null);
  useEffect(() => {
    if (src !== null) return;
    const url = getPortraitDataUrl(speakerId);
    if (url !== null) setSrc(url);
  }, [speakerId, src]);
  if (src === null) return null;
  return (
    <img
      src={src}
      className="dialogue-portrait-img"
      alt={`${speakerName} portrait`}
      aria-hidden="true"
      style={{ borderColor: speakerColor }}
    />
  );
}
