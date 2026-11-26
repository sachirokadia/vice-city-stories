CURVED VEHICLE FLEET V3

Six original procedural models: Velocity GT, Shadow LX, Vortex RS, Trailhawk X, Police Patrol Sedan and Police Patrol SUV.
Actual GLB meshes with independent steering pivots and four wheel-spin groups. Character, road and campaign assets are separate.
The refined fleet has 102,052–116,788 triangles per model. Detailed police rendering is limited to 85 m; lighter instanced vehicles remain in use farther away. This is a geometry/LOD budget, not a guaranteed laptop FPS claim.

Preview: fleet.html (serve over HTTP). 3D viewer: index.html?model=velocity-gt-detailed-v3. Browsers without WebGL show the saved real-mesh render.
Native game: use a WebGL-enabled browser; Play or Explore Ocean Drive. E enters/exits the active car. Garage models require the game's normal ownership/purchase rules; their previews are visible before purchase.

Validation: validation-vehicle-runtime.json covers actual game modules and delivered model data on CPU. It is not a native browser FPS measurement. Studio PNGs show delivered geometry using an approximate CPU renderer; they are not Unity or game screenshots.

Sources: original project-authored geometry, generated with Three.js. No external branded vehicle mesh or copyrighted car texture was used. Three.js MIT license is included. The studio renderer and native canvas dependencies retain their respective MIT licenses.
Curve design references: https://docs.mcneel.com/rhino/9/help/en-us/commands/zebra.htm and https://docs.mcneel.com/rhino/9/help/en-us/commands/filletsrfcrv.htm. These informed attention to curve transitions; no claim of a complete CAD G2 continuity proof is made.

Generation: tools/world-v2/build-vehicle-fleet.mjs and vehicle-geometry.mjs. Render: render-coastal-world-v2.mjs --vehicle=<id>. Test: node --expose-gc tools/world-v2/test-vehicle-runtime.mjs (Node.js 24 recommended).
