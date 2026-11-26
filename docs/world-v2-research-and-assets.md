# World V2: researched coastal assets

The new coastal block replaces simple pasted-on facade detail in the asset study with metric storeys and bays, actual wall openings, recessed glazing, shallow rooms, balcony doors and railings, roof equipment, and shared CC0 PBR surfaces. Road, pavement, drainage, lighting props, palms, seawall and water form a coherent block.

## Inspect

- Preview: `/world-v2/world-v2.html`
- Model viewer: `/world-v2/index.html?model=ocean-drive-world-v2`
- Research: `/world-v2/research-world.html` — 25 primary sources, individual findings, applied decisions and pending Unity work
- Files: `public/world-v2/models/` — ten textured GLBs, with embedded textures
- Tools: `tools/world-v2/README.md`

The browser viewer renders on demand and disposes replaced model resources. A browser without WebGL shows actual saved scene imagery and model download links. The static previews are CPU renders of the GLBs.

## Asset scope and validation

The assembled scene has 417,664 triangles. There are four detailed buildings, four separate reduced-detail building meshes, infrastructure, and the assembled scene. All ten assets load with finite geometry, nonblank embedded images, expected dimensions and matching triangle counts. Reduced building variants use 51–57% fewer triangles. Results and design measurements are in `public/world-v2/validation-world-v2.json` and `world-metric-audit.json`.

Architecture is fictional and uses plausible metric proportions. Interiors provide shallow visual depth, rather than fully playable rooms. Research review covered relevant paper/documentation sections; the source log distinguishes applied asset decisions from future engine work.

## Integration status

This commit adds the kit and its review pages to the original game's repository. The campaign's runtime world does not load the new assets yet. Unity target is 6000.6.10f1 / URP 17.6.0. The Editor reached a `Corrupted Library Detected` recovery dialog after an earlier shared-memory startup failure. Unity scene import, lightmap UVs, lighting/probe bakes, automatic LOD switching, collisions, gameplay integration and laptop performance remain unverified.

Sources use Poly Haven CC0 textures and original procedural geometry. Attribution and the bundled Three.js MIT license are included. The repository contains linked research notes, not copies of copyrighted papers, and contains no duplicate model ZIP archives.
