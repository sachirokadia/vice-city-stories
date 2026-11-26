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
