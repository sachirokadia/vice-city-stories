import assert from 'node:assert/strict';
import { loadGameModule, loadRuntimeWorld } from './load-runtime-world.mjs';

const { generateLayout, GARAGE_ENTRANCE, STORE_ENTRANCE } = await loadGameModule('CityGenerator');
const { COASTAL_BUILDINGS, OCEAN_DRIVE_ENTRY, OCEAN_DRIVE_PARKING } = await loadGameModule('CoastalDistrictLayout');
const { STORY_MISSIONS } = await loadGameModule('StoryDefinitions');
const { MISSION_DEFS } = await loadGameModule('MissionDefinitions');
const { COLLECTIBLE_DEFS } = await loadGameModule('Collectibles');
const { SPRINT_START, SPRINT_CHECKPOINTS } = await loadGameModule('Sprint');
const { RANGE_LINE, RANGE_RACK, RANGE_SIGN } = await loadGameModule('Range');
const layout = generateLayout();
const anchors = [
  ...STORY_MISSIONS.flatMap(m => [m.startMarker, ...m.objectives.map(s => s.target)]),
  ...MISSION_DEFS.flatMap(m => [m.startMarker, ...m.objectives.map(s => s.target)]),
  ...COLLECTIBLE_DEFS, SPRINT_START, ...SPRINT_CHECKPOINTS, RANGE_LINE, RANGE_RACK, RANGE_SIGN,
  GARAGE_ENTRANCE, STORE_ENTRANCE, OCEAN_DRIVE_ENTRY, OCEAN_DRIVE_PARKING,
].filter(Boolean);
const unique = new Map(anchors.map(a => [`${a.x}, ${a.z}`, a]));
const results = [];
let plannedCollision;
for (const tier of ['low', 'high']) {
  const { scene, world, status } = await loadRuntimeWorld(tier);
  assert.deepEqual(status, { loaded: COASTAL_BUILDINGS.length, failed: 0, total: COASTAL_BUILDINGS.length });
  assert.equal(world.buildings.length, layout.plots.length + COASTAL_BUILDINGS.length + 4);
  for (const [name, { x, z }] of unique) {
    // The Beacon handoff circle intentionally overlaps its landmark's box.
    if (x === 0 && z === -165) {
      assert(world.buildings.every(b => x < b.minX || x > b.maxX || -162 < b.minZ || -162 > b.maxZ));
      continue;
    }
    const blocking = world.buildings.find(b => x > b.minX - .58 && x < b.maxX + .58 && z > b.minZ - .58 && z < b.maxZ + .58);
    assert(!blocking, `World location (${name}) intersects ${JSON.stringify(blocking)}`);
  }
  const architecture = world.group.getObjectByName('city-architecture');
  let triangles = 0;
  architecture.traverse(mesh => {
    if (!mesh.isInstancedMesh) return;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * mesh.count;
    assert(mesh.instanceMatrix.array.every(Number.isFinite));
  });
  const districts = new Set(layout.plots.map(p => p.district));
  assert.equal(districts.size, 5);
  for (const block of layout.blocks.filter(b => b.district !== 'park')) {
    assert([...layout.plots, ...COASTAL_BUILDINGS].some(p =>
      p.x >= block.minX && p.x <= block.maxX && p.z >= block.minZ && p.z <= block.maxZ),
      `No architecture on block ${block.cx}, ${block.cz}`);
  }
  if (plannedCollision) assert.deepEqual(world.buildings, plannedCollision);
  plannedCollision = world.buildings;
  results.push({ tier, buildings: layout.plots.length + COASTAL_BUILDINGS.length + 3,
    ordinaryBuildingTriangles: triangles, architectureBatches: architecture.children.length, accessibleAnchors: unique.size });
  world.dispose();
  assert.equal(scene.children.length, 0);
}
assert(results[0].ordinaryBuildingTriangles < results[1].ordinaryBuildingTriangles);
console.log(JSON.stringify({ blocks: layout.blocks.length, parks: layout.parks.length, results }, null, 2));
