import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as THREE from 'three';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = path.join(root, 'src/game');
const cache = path.join(root, 'tools/world-v2/.cache/world-preview');
const compiled = new Set();

export async function loadGameModule(name) {
  async function compile(module) {
    if (compiled.has(module)) return;
    compiled.add(module);
    const input = await fs.readFile(path.join(source, module + '.ts'), 'utf8');
    const imports = [];
    const code = stripTypeScriptTypes(input, { mode: 'transform' }).replace(
      /(from\s*['"])(\.\/[^'"]+)(['"])/g,
      (_, prefix, specifier, suffix) => {
        imports.push(specifier.slice(2));
        return prefix + specifier + '.mjs' + suffix;
      },
    );
    await fs.writeFile(path.join(cache, module + '.mjs'), code);
    for (const dependency of imports) await compile(dependency);
  }
  await fs.mkdir(cache, { recursive: true });
  await compile(name);
  return import(pathToFileURL(path.join(cache, name + '.mjs')));
}

export async function loadRuntimeWorld(tier) {
  const images = [];
  globalThis.document = {
    createElement: () => createCanvas(1, 1),
    createElementNS: () => new class extends EventTarget {
      set src(url) {
        const pending = (async () => {
          this.sourceImage = await loadImage(path.join(root, 'public', url));
          this.dispatchEvent(new Event('load'));
        })();
        images.push(pending);
      }
    }(),
  };
  globalThis.self = globalThis;
  globalThis.ProgressEvent = class { constructor(type, props) { Object.assign(this, props, { type }); } };
  globalThis.createImageBitmap = async blob => {
    const im = await loadImage(Buffer.from(await blob.arrayBuffer()));
    const canvas = createCanvas(im.width, im.height);
    canvas.getContext('2d').drawImage(im, 0, 0);
    return canvas;
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, options) => {
    const url = String(request);
    if (!url.startsWith('/world-v2/')) return originalFetch(request, options);
    return new Response(await fs.readFile(path.join(root, 'public', url), { signal: options?.signal }));
  };
  try {
    const { buildWorld } = await loadGameModule('World');
    const scene = new THREE.Scene();
    const world = buildWorld(scene, { tier, shadows: tier !== 'low', palmCount: tier === 'low' ? 12 : 46 });
    const status = await world.ready;
    await Promise.all(images);
    return { scene, world, status };
  } finally {
    globalThis.fetch = originalFetch;
  }
}
