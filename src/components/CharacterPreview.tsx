/**
 * A small live 3D preview of the protagonist in one outfit: the
 * same procedural character the world walks around (createCharacter),
 * recoloured by the outfit, on a turntable in its own lightweight
 * scene. Rebuilds when the outfit changes; disposes everything
 * when the panel closes.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createCharacter } from '../game/Character';
import { applyOutfit } from '../game/Outfits';
import type { OutfitDef } from '../game/Outfits';

interface CharacterPreviewProps {
  outfit: OutfitDef;
}

export default function CharacterPreview({ outfit }: CharacterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.5, 4.6);
    camera.lookAt(0, 1.0, 0);

    const hemi = new THREE.HemisphereLight(0xfff2dd, 0x2a2a33, 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
    sun.position.set(4, 8, 3);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x7fb4ff, 0.7);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    // A dark disc for the character to stand on.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 40),
      new THREE.MeshStandardMaterial({ color: 0x1c1a22, roughness: 0.9 }),
    );
    disc.rotation.x = -Math.PI / 2;
    scene.add(disc);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.3, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    const disposables: Array<{ dispose(): void }> = [];
    const track = <T extends { dispose(): void }>(r: T): T => {
      disposables.push(r);
      return r;
    };
    const { group, mats, parts } = createCharacter(track);
    applyOutfit(mats, parts, outfit);
    scene.add(group);

    const resize = () => {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      group.rotation.y += 0.008;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scene.remove(group);
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* already disposed */
        }
      }
      disc.geometry.dispose();
      (disc.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, [outfit]);

  return (
    <canvas
      ref={canvasRef}
      className="garage-preview-canvas"
      aria-label={`${outfit.name} preview`}
    />
  );
}
