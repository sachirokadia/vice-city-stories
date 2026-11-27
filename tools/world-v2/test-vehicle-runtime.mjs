import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import * as T from 'three';
import {createCanvas,loadImage} from '@napi-rs/canvas';

const repo=fileURLToPath(new URL('../../',import.meta.url));
const source=path.join(repo,'src/game'),compiled=path.join(repo,'tools/world-v2/.cache/runtime-test');
await fs.mkdir(compiled,{recursive:true});
const seen=new Set();
async function compile(name){
 if(seen.has(name))return;seen.add(name);
 const code=await fs.readFile(path.join(source,name+'.ts'),'utf8');
 let result=stripTypeScriptTypes(code,{mode:'transform',sourceUrl:name+'.ts'});
 const dependencies=[];
 result=result.replace(/(from\s*['"])(\.\/[^'"]+)(['"])/g,(full,prefix,target,suffix)=>{dependencies.push(target.slice(2));return prefix+target+'.mjs'+suffix;});
 await fs.writeFile(path.join(compiled,name+'.mjs'),result);
 for(const dependency of dependencies)await compile(dependency);
}
for(const name of['Vehicle','Police','DetailedPolice','Input','Player','CinematicStaging','Outfits'])await compile(name);
globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,props){Object.assign(this,props)}};
globalThis.createImageBitmap=async blob=>{const im=await loadImage(Buffer.from(await blob.arrayBuffer())),c=createCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);return c;};
const originalFetch=globalThis.fetch;
let warnings=[];const originalWarn=console.warn;console.warn=(...args)=>warnings.push(args.map(String).join(' '));
globalThis.fetch=async(input,init={})=>{
 const url=String(input);
 if(url.startsWith('blob:')||url.startsWith('data:'))return originalFetch(input,init);
 assert(url.startsWith('/world-v2/models/'),'Unexpected asset request '+url);
 const bytes=await fs.readFile(path.join(repo,'public',url),{signal:init.signal});
 return new Response(bytes,{status:200,headers:{'Content-Type':'model/gltf-binary'}});
};
const load=name=>import(pathToFileURL(path.join(compiled,name+'.mjs')));
const {createVehicle}=await load('Vehicle'),{VEHICLE_SPECS}=await load('VehicleCatalog'),{createInputState}=await load('Input');
const {installDetailedPolice}=await load('DetailedPolice'),{createPolice}=await load('Police');
const results=[];
for(const spec of VEHICLE_SPECS){
 const scene=new T.Scene(),probe=new T.Texture();let probeDisposals=0;probe.addEventListener('dispose',()=>probeDisposals++);
 const car=createVehicle(scene,new T.Vector3(),0,{spec});car.paintMat.envMap=probe;car.glassMat.envMap=probe;
 car.setPaint(0x176b87);await car.visualReady;
 const detailed=car.group.getObjectByName('detailed-'+spec.id);assert(detailed,'Missing detailed model '+spec.id);
 let triangles=0,paintMeshes=0;const spins=[],front=[],geometries=new Set();
 detailed.traverse(n=>{if(n.name==='WheelSpin'||n.name.startsWith('WheelSpin_'))spins.push(n);if(n.name.startsWith('Wheel_Front_'))front.push(n);if(n.isMesh){triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;geometries.add(n.geometry);if(n.material===car.paintMat)paintMeshes++;for(const attr of Object.values(n.geometry.attributes))for(const v of attr.array)assert(Number.isFinite(v),'Nonfinite vertex attribute');}});
 assert.equal(spins.length,4);assert.equal(front.length,2);assert(paintMeshes>0);assert.equal(car.paintMat.color.getHex(),0x176b87);
 const input=createInputState();input.moveY=1;
 for(let i=0;i<90;i++)car.update(1/60,input,[]);
 assert(car.position.z>1,'Car must move forward');assert(car.speed>0);assert.equal(car.gear(),'D');assert(spins.every(w=>Math.abs(w.rotation.x)>.05),'Every wheel must roll');
 input.moveX=.6;for(let i=0;i<12;i++)car.update(1/60,input,[]);assert(front.every(w=>Math.abs(w.rotation.y)>.01),'Both front wheels must steer');
 car.stop();assert(front.every(w=>Math.abs(w.rotation.y)<1e-9));car.setPaint(0xbb2233);assert.equal(car.paintMat.color.getHex(),0xbb2233);
 car.position.set(0,0,0);car.group.position.copy(car.position);car.heading=0;car.group.rotation.y=0;input.moveX=0;
 const halfLength=Math.max(Math.abs(new T.Box3().setFromObject(detailed).min.z),Math.abs(new T.Box3().setFromObject(detailed).max.z));
 const wall={minX:-10,maxX:10,minZ:7,maxZ:12,maxY:10};for(let i=0;i<300;i++)car.update(1/60,input,[wall]);assert(car.position.z<wall.minZ-1,'Car must stop before the wall');
 assert(car.position.z+halfLength<=wall.minZ+.01,'The visible bumper must not penetrate the wall');
 let freed=0;for(const g of geometries)g.addEventListener('dispose',()=>freed++);
 car.dispose();assert.equal(scene.children.length,0);assert.equal(probeDisposals,0,'Vehicle must not destroy the engine-owned reflection probe');assert.equal(freed,geometries.size,'Imported geometry must be freed once');probe.dispose();
 results.push({vehicle:spec.id,triangles,wheels:4,steeringWheels:2,driving:true,collision:true,repaint:true,probeOwnership:true,cleanup:true});
 globalThis.gc?.();
}
// Late asynchronous completion cannot resurrect a car after its garage or game closes.
{
 const scene=new T.Scene(),car=createVehicle(scene,new T.Vector3(),0,{spec:VEHICLE_SPECS[0]});car.dispose();await car.visualReady;assert.equal(scene.children.length,0);
 results.push({check:'dispose-during-download',passed:true});
}
// Test the real police visual renderer: both variants, per-unit flashes, near/far LOD and removal.
{
 const parent=new T.Group(),visual=installDetailedPolice(parent,6);await visual.ready;
 const sample={slot:0,kind:'sedan',x:10,z:12,heading:.3,wheelSpin:.8,steer:.2,onDuty:true,phase:true,distance:20};
 assert(visual.render(sample));assert(visual.render({...sample,slot:1,kind:'suv'}));visual.flush();
 const root=parent.getObjectByName('detailed-police-fleet');assert(root&&root.children.length>0);
 const flashes=root.children.filter(n=>n.isInstancedMesh&&n.instanceColor);assert(flashes.length>=4);
 const red=flashes.find(n=>n.name.includes('sedan')&&n.name.includes('Emergency_Red'));
 const blue=flashes.find(n=>n.name.includes('sedan')&&n.name.includes('Emergency_Blue'));
 assert(red&&blue);const a=new T.Color(),b=new T.Color();red.getColorAt(0,a);blue.getColorAt(0,b);assert(a.r>b.r);
 visual.render({...sample,phase:false});red.getColorAt(0,a);blue.getColorAt(0,b);assert(a.r<b.r,'Emergency halves must alternate');
 visual.render({...sample,onDuty:false});red.getColorAt(0,a);blue.getColorAt(0,b);assert(Math.abs(a.r-b.r)<1e-6,'Patrol lightbars must run dark');
 assert.equal(visual.render({...sample,distance:100}),false,'Distant cars must use the lightweight fleet');
 const matrix=new T.Matrix4();root.traverse(n=>{if(n.isInstancedMesh){n.getMatrixAt(0,matrix);assert.equal(matrix.determinant(),0,'Hidden detailed slot must have zero scale');}});
 visual.hide(1);visual.flush();visual.dispose();assert.equal(parent.children.length,0);
 results.push({check:'police-sedan-and-suv',nearDetail:true,farLOD:true,alternatingLights:true,patrolDark:true,cleanup:true});
}
// Exercise existing patrol -> pursuit -> search -> arrest targeting -> reset state transitions.
{
 const scene=new T.Scene(),police=createPolice(scene,'normal','normal',()=>({isAvenueGreen:()=>true}));await police.visualReady;
 const p=new T.Vector3(0,0,8),ctx={playerPos:p,playerSpeed:0,driving:false,vehiclePos:p.clone(),vehicleSpeed:0,vehicleHeading:0,npcs:[],aiVehicles:[],buildings:[],avenueGreen:true,wanted:{level:0,status:'clear',lastKnown:null},camForward:{x:0,z:-1}};
 for(let i=0;i<30;i++)police.update(1/30,ctx);
 assert.equal(police.activeCount(),4);assert(police.listUnits().every(u=>u.state==='patrol'));
 ctx.wanted={level:2,status:'pursuit',lastKnown:{x:0,z:8}};for(let i=0;i<30;i++)police.update(1/30,ctx);assert(police.listUnits().some(u=>u.state==='pursue'));
 ctx.wanted.status='search';police.update(1/30,ctx);assert(police.listUnits().some(u=>u.state==='search'));
 police.setArrestTarget({x:0,z:8,slot:null});police.update(1/30,ctx);police.setArrestTarget(null);
 police.resetToPatrol();assert(police.listUnits().every(u=>u.state==='patrol'));
 police.setCount('off');assert.equal(police.activeCount(),0);police.dispose();assert.equal(scene.children.length,0);
 results.push({check:'police-existing-ai',patrol:true,pursuit:true,search:true,arrestTarget:true,reset:true,off:true});
}
assert.deepEqual(warnings,[],'No detailed asset load may fall back during this test');
// The playable-entry work shares model lifecycle with this fleet; verify its character rigs too.
{
 const {createPlayer}=await load('Player'),{createStagedActor}=await load('CinematicStaging'),{OUTFIT_DEFS}=await load('Outfits');
 const checkStandingBounds = (actor, id, targetHeight) => {
  // Match the renderer: update the bones and inverse bind matrices before sampling deformed vertices.
  scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(actor, true);
  const height = bounds.max.y - bounds.min.y;
  assert(Math.abs(height - targetHeight) < .01, `${id} height must be ${targetHeight} m, got ${height} m`);
  assert(Math.abs(bounds.min.y) < .01, `${id} must stand on the ground, got ${bounds.min.y} m`);
 };
 const scene=new T.Scene(),player=createPlayer(scene,new T.Vector3(68,0,31),[]);await player.visualReady;
 const model=player.mesh.getObjectByName('detailed-actor-kai');assert(model,'The playable Kai model must load');
 checkStandingBounds(model, 'Playable Kai', 1.85);
 const leg=model.getObjectByName(T.PropertyBinding.sanitizeNodeName('upperleg01.L')),initial=leg.quaternion.clone(),input=createInputState();input.moveY=1;
 for(let i=0;i<25;i++)player.update(1/30,0,input);assert(player.position.z<30);assert(leg.quaternion.angleTo(initial)>.01,'Delivered skeleton must follow the gait');
 scene.updateMatrixWorld(true);
 const walkingBounds = new T.Box3().setFromObject(model, true);
 assert(walkingBounds.max.y < 2 && walkingBounds.min.y > -.2, 'The walking model must stay human-sized and near the street');
 player.setSurrendered(true);player.update(.5,0,input);player.setSurrendered(false);
 player.applyOutfit(OUTFIT_DEFS[1]);assert.equal(model.visible,false);player.applyOutfit(OUTFIT_DEFS[0]);assert.equal(model.visible,true);
 const staged=createStagedActor(scene,'kai',[1,0],0);await staged.visualReady;
 assert.notEqual(staged.group.getObjectByName(T.PropertyBinding.sanitizeNodeName('upperleg01.L')),leg,'Concurrent actors need independent bones');
 checkStandingBounds(staged.group.getObjectByName('detailed-actor-kai'), 'Staged Kai', 1.85);
 staged.dispose();player.update(1/30,0,input);player.dispose();assert.equal(scene.children.length,0);
 for(const [id, scale] of [['june', .96], ['lena', .97]]){
  const actor=createStagedActor(scene,id,[12,17],.7);await actor.visualReady;
  const detailed=actor.group.getObjectByName('detailed-actor-'+id);assert(detailed);
  checkStandingBounds(detailed, id, 1.85 * scale);
  actor.update(1/30);actor.dispose();assert.equal(scene.children.length,0);globalThis.gc?.();
 }
 results.push({check:'playable-and-story-character-rigs',kaiGait:true,outfitFallback:true,independentSkeletons:true,june:true,lena:true,humanScaleAndGrounding:true,cleanup:true});
}
assert.deepEqual(warnings,[],'No character import may fall back during this test');
console.warn=originalWarn;globalThis.fetch=originalFetch;
const report={passed:true,scope:'CPU tests of real exported GLBs and actual game vehicle/police modules; not an FPS or native browser-driving measurement.',results};
await fs.writeFile(path.join(repo,'public/world-v2/validation-vehicle-runtime.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
