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

The browser game's world now loads the four detailed buildings along Ocean Drive, reserving their footprints in the procedural city and adding matching collision boxes. Low/Medium selects the reduced building meshes; High/Ultra selects full detail. The main-menu **Explore Ocean Drive** entry places the player and active car nearby without replacing the saved campaign checkpoint. Imports are awaited before gameplay, and replaced scenes dispose their owned resources.

The active player and staged Kai/June/Lena actors use the delivered V3 characters with independent skeletons and the existing animation poses. Alternate player outfits retain their original visuals. The four garage vehicles and the police sedan/SUV now use Fleet V3 meshes (102,052–116,788 triangles), with rolling wheels, steering, paint changes and emergency lights connected to the existing game. Detailed police render within 85 m; the lightweight fleet renders farther away. Civilian background traffic and mission sedans retain their earlier meshes.

`validation-vehicle-runtime.json` records CPU checks using actual game modules and GLBs: four car imports and animation pivots, forward motion, paint/tuning, visible bumper clearance at a wall, resource ownership/cancellation, police near/far rendering and lights, patrol/pursuit/search/arrest/reset, and independent character skeleton animation. The production TypeScript/Vite build passes. These checks do not measure browser GPU rendering or laptop FPS. The final fleet still needs a fresh native-browser performance run.

Unity target is 6000.6.10f1 / URP 17.6.0. The Editor reached a `Corrupted Library Detected` recovery dialog after an earlier shared-memory startup failure. Unity scene import, lightmap UVs, lighting/probe bakes, automatic LOD switching, collisions, gameplay integration and performance remain pending. Browser-game integration does not establish Unity readiness.

Sources use Poly Haven CC0 textures and original procedural geometry. Attribution and the bundled Three.js MIT license are included. The repository contains linked research notes, not copies of copyrighted papers, and contains no duplicate model ZIP archives.
