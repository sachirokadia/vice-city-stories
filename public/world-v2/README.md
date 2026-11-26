# World V2 asset kit

This is an independently inspectable asset study for Vice City Stories. It contains four building types, four reduced-detail building variants, coastal infrastructure, an assembled scene, three CPU previews, and notes on 25 primary sources.

Run the original game normally with `npm ci` and `npm run dev`. Open `/world-v2/world-v2.html` for the preview and research index or `/world-v2/index.html?model=ocean-drive-world-v2` for the viewer. Files in this directory are copied into the Vite production build. Browsers without WebGL show an actual saved scene render and GLB download links.

The assembled scene has 417,664 triangles. All ten GLB assets pass the included offline validation. Building LOD1 meshes reduce triangle counts by 51–57%; automatic LOD switching is not implemented here. The original campaign does not load these files yet.

Unity target: 6000.6.10f1 / URP 17.6.0. Unity Editor initialization, glTF import, lightmap UV generation, GI/APV/reflection-probe bakes, LODGroup configuration, collision, gameplay integration and frame-rate verification remain pending. Previews are CPU renders of real meshes, not Unity screenshots. Interiors are shallow visual rooms.

Generation and validation tools are in `tools/world-v2`; see that directory's README. Sources and licensing: `research-world.html`, `world-research.json`, `licenses/WORLD-V2-SOURCES.txt`, and `vendor/THREE-LICENSE.txt`. No copyrighted papers or downloaded ZIP archives are included.
