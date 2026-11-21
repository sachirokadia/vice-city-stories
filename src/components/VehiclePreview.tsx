/**
 * A small live 3D preview of one vehicle: the same procedural mesh
 * the world drives (buildVehicleMesh), on a turntable in its own
 * lightweight scene. Rebuilds when the vehicle or its paint
 * changes; disposes everything when the garage closes.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildVehicleMesh } from '../game/Vehicle';
import type { VehicleSpec } from '../game/VehicleCatalog';

interface VehiclePreviewProps {
  spec: VehicleSpec;
  paint: number;
}

export default function VehiclePreview({ spec, paint }: VehiclePreviewProps) {
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
    camera.position.set(6.2, 3.4, 6.8);
    camera.lookAt(0, 0.6, 0);

    const hemi = new THREE.HemisphereLight(0xfff2dd, 0x2a2a33, 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
    sun.position.set(4, 8, 3);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x7fb4ff, 0.7);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    // A dark disc for the car to sit on.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 40),
      new THREE.MeshStandardMaterial({ color: 0x1c1a22, roughness: 0.9 }),
    );
    disc.rotation.x = -Math.PI / 2;
    scene.add(disc);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.4, 3.55, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    const mesh = buildVehicleMesh(spec, paint);
    scene.add(mesh.group);

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
      mesh.group.rotation.y += 0.008;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scene.remove(mesh.group);
      mesh.dispose();
      disc.geometry.dispose();
      (disc.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, [spec, paint]);

  return (
    <canvas
      ref={canvasRef}
      className="garage-preview-canvas"
      aria-label={`${spec.name} preview`}
    />
  );
}
