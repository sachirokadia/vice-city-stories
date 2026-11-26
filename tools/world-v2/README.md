# World V2 generation tools

Run these commands from the repository root using Node.js 22 or later:

```sh
npm --prefix tools/world-v2 ci
npm --prefix tools/world-v2 run fetch-textures
npm --prefix tools/world-v2 run build
npm --prefix tools/world-v2 run render
npm --prefix tools/world-v2 run validate
```

The committed GLBs, previews and notes are ready to inspect without running the generation tools. The tools resolve paths relative to their own files and write into `public/world-v2`. The build regenerates ten GLBs and metric audit data; the renderer regenerates the three scene previews. If geometry is changed later, update the static review page's displayed measurements to match the new catalog.

The downloader retrieves five CC0 Poly Haven surface sets from the official API and verifies each file's MD5 against the API metadata. Downloaded maps and the pre-build catalog snapshot stay in `.cache/`, which is ignored by Git. Normal and roughness maps are linear data; color maps use sRGB. Concrete color is neutralized for the pavement variant. The small source GLB is the preserved original procedural V1 Velocity GT used in the assembled scene.

`publish-world-research.mjs` reproduces the 25-source index and its notes. `validate-world-v2.mjs` loads the actual exported assets and checks geometry, textures, bounds, recorded counts and LOD reduction. Its success is offline asset validation, not a Unity runtime or GPU performance result. The CPU renderer approximates PBR and shadows and is not a Unity capture.

## Curved vehicle fleet

The committed Fleet V3 files can be used immediately. Regenerate all six cars
from original procedural geometry and update their preview page with:

```sh
npm --prefix tools/world-v2 run build:fleet
node --expose-gc tools/world-v2/render-coastal-world-v2.mjs --vehicle=velocity-gt
node --expose-gc tools/world-v2/render-coastal-world-v2.mjs --vehicle=shadow-lx
node --expose-gc tools/world-v2/render-coastal-world-v2.mjs --vehicle=vortex-rs
node --expose-gc tools/world-v2/render-coastal-world-v2.mjs --vehicle=trailhawk-x
node --expose-gc tools/world-v2/render-coastal-world-v2.mjs --vehicle=police-sedan
node --expose-gc tools/world-v2/render-coastal-world-v2.mjs --vehicle=police-suv
node --expose-gc tools/world-v2/render-coastal-world-v2.mjs --vehicle=velocity-gt --reference-v1
node tools/world-v2/publish-vehicle-fleet.mjs
npm --prefix tools/world-v2 run test:vehicles
npm run build
```

The reference render uses the preserved V1 GT. The runtime test needs Node.js 24
and the root game's installed dependencies and character GLBs. It imports the
actual game modules using Node's TypeScript stripping and checks behavior on
CPU, with no WebGL context. It is not a browser FPS test. The renderer writes
studio PNGs of the exported meshes using approximate material/shadow shading.
The publisher merges fleet entries into the catalog and creates `fleet.html`.
Run large renders sequentially on machines with limited memory.
