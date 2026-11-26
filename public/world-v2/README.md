# World V2 asset kit

This is an independently inspectable asset study for Vice City Stories. It contains four building types, four reduced-detail building variants, coastal infrastructure, an assembled scene, three CPU previews, and notes on 25 primary sources.

Run the original game normally with `npm ci` and `npm run dev`. Open `/world-v2/world-v2.html` for the preview and research index or `/world-v2/index.html?model=ocean-drive-world-v2` for the viewer. Files in this directory are copied into the Vite production build. Browsers without WebGL show an actual saved scene render and GLB download links.

The assembled scene has 417,664 triangles. All ten world GLBs pass the included offline validation. Building LOD1 meshes reduce triangle counts by 51–57%. The game now loads four buildings along Ocean Drive and selects their detail from graphics quality. Use the main menu's Explore Ocean Drive entry to start nearby. The standalone assembled scene remains an asset review, separate from the full city.

Fleet V3 adds six original vehicle GLBs: four garage cars and two police vehicles, each with 102,052–116,788 triangles. Open `fleet.html` for actual mesh images and a GT before/after comparison. The active drivable car and garage preview use these assets; detailed police render within 85 m and use the original lightweight fleet farther away. Background traffic and mission sedans retain their earlier meshes. V3 Kai/June/Lena models are also loaded by the player/story staging. Alternate player outfits keep their original geometry.

`validation-vehicle-runtime.json` covers actual game-module CPU checks for model loading, wheels/steering, paint/tuning, wall clearance, cleanup, police behavior/lights and character skeleton animation. The production build passes. Final fleet GPU performance remains unverified.

Unity target: 6000.6.10f1 / URP 17.6.0. Unity Editor initialization, glTF import, lightmap UV generation, GI/APV/reflection-probe bakes, LODGroup configuration, collision, gameplay integration and frame-rate verification remain pending. Previews are CPU renders of real meshes, not Unity screenshots. Interiors are shallow visual rooms.

Generation and validation tools are in `tools/world-v2`; see that directory's README. Sources and licensing: `research-world.html`, `world-research.json`, `licenses/WORLD-V2-SOURCES.txt`, and `vendor/THREE-LICENSE.txt`. No copyrighted papers or downloaded ZIP archives are included.
