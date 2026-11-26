import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {buildDetailedCar} from './vehicle-geometry.mjs';
import {material,mesh,box,beam,tube,parametric,labelTexture,batch} from './asset-kit.mjs';

const output=fileURLToPath(new URL('../../public/world-v2/',import.meta.url));
await fs.mkdir(output+'models',{recursive:true});
const metal=material('Polished_Aluminium','#bac2c5',.24,.95),trim=material('Graphite_Trim','#1a1f22',.45,.25),leather=material('Charcoal_Leather','#30302d',.82);
const led=material('Projector_LED','#f3efdc',.2,0,{emissive:'#f3e7ce',emissiveIntensity:.8});
const rear=material('Rear_LED','#9d2027',.3,0,{emissive:'#d01c24',emissiveIntensity:.7});
const glass=material('Smoked_Automotive_Glass','#9cb2bb',.12,0,{transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide,clearcoat:1});
const B=(p,n,s,pos,m=trim,r=.012)=>r?mesh(p,n,new RoundedBoxGeometry(...s,r>.02?3:2,Math.min(r,Math.min(...s)*.35)),m,pos):box(p,n,s,pos,m,0);
function plate(root,label,z,y,front){const mat=material('Registration_Plate','#ffffff',.62,0,{map:labelTexture(label,'#27343a','#e0dbcb',512,128)});const p=B(root,'Registration_plate',[.42,.105,.014],[0,y,z],mat,.003);if(!front)p.rotation.y=Math.PI;}
function getPaint(root){let paint;root.traverse(n=>{if(n.isMesh&&n.material.name?.includes('Clearcoat'))paint=n.material;});return paint;}
function removePart(root,predicate){for(const node of [...root.children])if(predicate(node)){node.removeFromParent();node.traverse(n=>{if(n.isMesh)n.geometry.dispose();});}}
function reverse(mesh){const ix=mesh.geometry.index.array;for(let i=0;i<ix.length;i+=3){const tmp=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=tmp;}mesh.geometry.computeVertexNormals();return mesh;}

function sedan(){
 const root=buildDetailedCar('shadow'),paint=getPaint(root);root.name='Shadow_LX_Detailed_V2';
 removePart(root,n=>n.name==='Active_Rear_Spoiler'||n.name.startsWith('Spoiler_Support_'));
 B(root,'Subtle_boot_lip',[1.6,.045,.13],[0,.84,-2.22],paint,.018);
 for(const side of[-1,1]){
  tube(root,'Chrome_window_beltline',[[side*.764,.805,1.04],[side*.771,.81,.12],[side*.77,.80,-.73],[side*.755,.80,-1.28]],.009,metal,20,6);
  B(root,'Lower_door_chrome',[.017,.026,2.65],[side*.943,.36,-.04],metal,.004);
  B(root,'Rear_headrest',[.25,.16,.12],[side*.37,1.26,-.95],leather,.025);
  B(root,'Rear_footwell',[.43,.02,.42],[side*.37,.72,-.65],trim,0);
  B(root,'Front_fog_lamp',[.22,.034,.025],[side*.69,.34,2.57],led,.009);
 }
 B(root,'Luxury_grille_frame',[1.02,.15,.05],[0,.41,2.58],metal,.014);
 B(root,'Luxury_grille_inset',[.95,.12,.055],[0,.41,2.61],trim,.006);
 for(let x=-.4;x<=.4;x+=.08)B(root,'Fine_grille_vane',[.012,.10,.016],[x,.41,2.647],metal,.002);
 plate(root,'VCS 204',2.665,.29,true);plate(root,'VCS 204',-2.56,.47,false);
 root.userData.features=['four-door body','raised cabin','rear seating','chrome beltline','independent wheels'];return root;
}
function trackCoupe(){
 const root=buildDetailedCar('vortex'),paint=getPaint(root);root.name='Vortex_RS_Detailed_V2';paint.color.set('#ff7a00');paint.name='Ember_Orange_Clearcoat';
 for(const node of root.children){
  if(node.isMesh){node.updateMatrix();node.geometry.applyMatrix4(node.matrix);node.position.set(0,0,0);node.quaternion.identity();node.scale.set(1,1,1);const p=node.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)*1.065);node.geometry.computeVertexNormals();}
  else{node.position.x*=1.065;node.scale.x*=1.065;}
 }
 for(const side of[-1,1]){
  for(const axle of[-1.4,1.4]){const arch=parametric(root,'Widebody_arch_flare',32,4,(u,v)=>{
   const a=u*Math.PI,r=.425+v*.067;return[side*(1.015+Math.sin(v*Math.PI)*.055),.365+Math.sin(a)*r,axle+Math.cos(a)*r];
  },paint);if(side>0)reverse(arch);}
  B(root,'Side_intake_cavity',[.025,.13,.35],[side*1.014,.49,.69],trim,.014);
  for(let i=0;i<4;i++)B(root,'Side_intake_louvre',[.029,.018,.28],[side*1.035,.44+i*.028,.69],metal,.004);
  B(root,'Carbon_side_skirt',[.10,.055,1.78],[side*1.03,.235,0],trim,.009);
 }
 for(let i=-4;i<=4;i++)B(root,'Extended_diffuser_fin',[.014,.12,.36],[i*.15,.225,-2.18],trim,.003);
 plate(root,'VCS 308',2.319,.32,true);plate(root,'VCS 308',-2.287,.46,false);
 root.userData.features=['widebody arches','carbon skirts','air extractors','track rear wing','independent wheels'];return root;
}
function suv(){
 const root=new T.Group();root.name='Trailhawk_X_Detailed_V2';const paint=material('Forest_Green_Clearcoat','#3f6b3a',.27,.65,{clearcoat:1,clearcoatRoughness:.14});
 const shape=new T.Shape();shape.moveTo(-2.28,.45);shape.lineTo(-2.28,1.06);shape.quadraticCurveTo(-2.21,1.18,-2.02,1.18);shape.lineTo(1.87,1.18);shape.quadraticCurveTo(2.28,1.16,2.28,.98);shape.lineTo(2.28,.45);shape.lineTo(1.91,.45);shape.lineTo(1.91,.48);shape.absarc(1.4,.48,.51,0,Math.PI,false);shape.lineTo(-.89,.45);shape.lineTo(-.89,.48);shape.absarc(-1.4,.48,.51,0,Math.PI,false);shape.closePath();
 for(const side of[-1,1]){const g=new T.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelSize:.018,bevelThickness:.015,bevelSegments:3,curveSegments:24});g.rotateY(-Math.PI/2);mesh(root,'Sculpted_SUV_side_panel',g,paint,[side<0?-.94:1.005,0,0]);}
 for(const side of[-1,1]){const flank=parametric(root,'Compound_curved_SUV_flank',128,12,(u,v)=>{const z=-2.26+u*4.52;let bottom=.45;for(const axle of[-1.4,1.4])if(Math.abs(z-axle)<.51)bottom=Math.max(bottom,.48+Math.sqrt(.51*.51-(z-axle)**2));const y=bottom+(1.18-bottom)*v;return[side*(1.008+.012*Math.sin(v*Math.PI)*Math.sin(u*Math.PI)),y,z];},paint);if(side<0)reverse(flank);}
 B(root,'Chassis_undertray',[1.61,.15,4.1],[0,.53,0],trim,.025);
 B(root,'Cabin_floor',[1.75,.10,2.88],[0,1.01,-.35],trim,.01);
 parametric(root,'Curved_SUV_bonnet',28,14,(u,v)=>[(u-.5)*1.86,1.15+.065*Math.sin(u*Math.PI)-.055*v*v,1.03+v*1.20],paint);
 reverse(parametric(root,'Wraparound_front_fascia',40,16,(u,v)=>[(u-.5)*2*(.99-.06*v),.64+v*(.455+.065*Math.sin(u*Math.PI)),2.23+.06*Math.sin(v*Math.PI)],paint));
 parametric(root,'Curved_rear_fascia',32,14,(u,v)=>[(u-.5)*1.95,.65+.55*v,-2.26-.035*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)],paint);
 parametric(root,'Crowned_SUV_roof',48,28,(u,v)=>[(u-.5)*1.79,1.91+.035*Math.sin(u*Math.PI)+.015*Math.sin(v*Math.PI),-1.72+v*2.43],paint);
 parametric(root,'SUV_windscreen',36,22,(u,v)=>[(u-.5)*2*(.86-v*.08),1.20+v*.71+.035*Math.sin(u*Math.PI)*v+.018*Math.sin(u*Math.PI)*Math.sin(v*Math.PI),1.06-v*.36+.028*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)],glass);
 parametric(root,'SUV_rear_glazing',32,20,(u,v)=>[(u-.5)*2*(.87-v*.08),1.20+v*.71+.035*Math.sin(u*Math.PI)*v,-1.91+v*.20-.02*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)],glass);
 for(const side of[-1,1]){
  const x=side*.91,xt=side*.81;
  for(const[z1,z2,t1,t2]of[[-1.83,-1.34,-1.68,-1.40],[-1.24,-.36,-1.31,-.42],[-.30,.97,-.36,.69]])parametric(root,'Separate_side_window',24,14,(u,v)=>[x+(xt-x)*v+side*.015*Math.sin(u*Math.PI)*Math.sin(v*Math.PI),1.2+.71*v+.015*Math.sin(u*Math.PI)*v,(z1+(z2-z1)*u)*(1-v)+(t1+(t2-t1)*u)*v],glass);
  for(const[z,topZ]of[[1.06,.70],[-.33,-.40],[-1.27,-1.34],[-1.9,-1.71]])tube(root,'Structural_window_pillar',[[x,1.16,z],[(x+xt)/2+side*.015,1.56,(z+topZ)/2],[xt,1.91,topZ]],.033,paint,20,10);
  beam(root,'Lower_window_trim',[x,1.18,-1.86],[x,1.18,1.03],.022,trim,10);
  for(const z of[-1.21,-.27,.98])tube(root,'SUV_door_shut_line',[[side*1.013,.55,z],[side*1.018,.9,z],[side*.96,1.18,z]],.0045,trim,10,5);
  for(const z of[-.93,.59])B(root,'Recessed_door_handle',[.024,.033,.17],[side*1.027,1.08,z],metal,.008);
  B(root,'Running_board',[.15,.07,2.55],[side*1.05,.47,-.10],trim,.014);
  for(let i=0;i<15;i++)B(root,'Running_board_grip',[.13,.008,.018],[side*1.05,.51,-1.26+i*.16],metal,0);
  for(const z of[-1.4,1.4]){const points=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI;points.push([side*1.035,.48+Math.sin(a)*.527,z+Math.cos(a)*.527]);}tube(root,'Curved_arch_cladding',points,.034,trim,24,7);}
  B(root,'Roof_rail',[.05,.045,2.25],[side*.65,2.02,-.4],metal,.009);
  for(const z of[-1.4,.58])B(root,'Roof_rail_mount',[.07,.09,.13],[side*.65,1.96,z],trim,.01);
  beam(root,'Mirror_stalk',[side*.90,1.35,.80],[side*1.06,1.35,.80],.022,trim,8);
  B(root,'Painted_mirror_cap',[.18,.14,.24],[side*1.10,1.39,.80],paint,.028);
  B(root,'Mirror_lens',[.15,.11,.012],[side*1.10,1.39,.673],metal,.008);
 }
 for(const z of[-.84,.34])for(const side of[-1,1]){B(root,'Leather_seat_base',[.51,.13,.47],[side*.40,1.11,z],leather,.04);B(root,'Contoured_seat_back',[.50,.42,.13],[side*.4,1.39,z-.24],leather,.045);B(root,'Seat_headrest',[.27,.16,.11],[side*.4,1.67,z-.26],leather,.03);}
 B(root,'SUV_dashboard',[1.60,.15,.32],[0,1.35,.72],trim,.025);
 const steering=mesh(root,'Steering_wheel',new T.TorusGeometry(.12,.015,8,32),leather,[-.4,1.48,.53]);steering.rotation.x=-.28;
 B(root,'Center_console',[.22,.17,.72],[0,1.14,-.01],trim,.018);
 B(root,'Front_bumper',[1.99,.17,.21],[0,.60,2.25],trim,.035);B(root,'Rear_bumper',[1.99,.16,.21],[0,.60,-2.25],trim,.035);
 B(root,'Grille_surround',[1.07,.28,.06],[0,.91,2.28],paint,.025);B(root,'Grille_recess',[.98,.22,.05],[0,.91,2.32],trim,.012);
 for(let i=-4;i<=4;i++)B(root,'Grille_vane',[.035,.19,.025],[i*.10,.91,2.355],metal,.005);
 B(root,'Front_skid_plate',[1.2,.12,.12],[0,.46,2.29],metal,.016);
 for(const side of[-1,1]){B(root,'Headlight_housing',[.40,.18,.07],[side*.73,1.02,2.26],trim,.026);for(const dx of[-.09,.09]){const l=mesh(root,'LED_projector',new T.CylinderGeometry(.047,.047,.026,24),led,[side*.73+dx,1.04,2.31]);l.rotation.x=Math.PI/2;}tube(root,'LED_running_light',[[side*.92,1.10,2.31],[side*.76,1.12,2.32],[side*.54,1.10,2.32]],.009,led,12,6);B(root,'Rear_light_housing',[.21,.38,.05],[side*.82,1.08,-2.30],trim,.02);B(root,'Rear_LED',[.14,.29,.025],[side*.82,1.08,-2.334],rear,.015);}
 B(root,'Tailgate',[1.67,.45,.05],[0,.94,-2.31],paint,.016);B(root,'Tailgate_handle',[.27,.038,.025],[0,1.12,-2.351],metal,.006);
 const donor=buildDetailedCar('velocity');
 for(const wheel of[...donor.children].filter(n=>n.isGroup&&n.name.startsWith('Wheel_'))){wheel.removeFromParent();wheel.position.set(Math.sign(wheel.position.x)*.99,.463,wheel.position.z);wheel.scale.set(1.1,1.267,1.267);root.add(wheel);}
 const used=new Set();root.traverse(n=>{if(n.isMesh)used.add(n.material);});donor.traverse(n=>{if(n.isMesh){n.geometry.dispose();if(!used.has(n.material))n.material.dispose();}});
 plate(root,'VCS 406',2.385,.64,true);plate(root,'VCS 406',-2.343,.91,false);
 root.userData.features=['curved wheel arches','separate transparent windows','four-seat cabin','roof rails','running boards','independent wheels'];return root;
}

function patrol(kind){
 const isSuv=kind==='suv',root=isSuv?suv():sedan(),paint=getPaint(root);
 root.name=isSuv?'Police_Patrol_SUV_Detailed_V2':'Police_Patrol_Sedan_Detailed_V2';paint.color.set('#18222d');paint.name='Patrol_Black_Clearcoat';
 const white=material('Police_White_Clearcoat','#e8e7df',.30,.22,{clearcoat:1});
 const sideX=isSuv?1.023:.950,cy=isSuv?.90:.54,doorH=isSuv?.45:.32,doorL=isSuv?2.32:1.65;
 for(const side of[-1,1]){
  B(root,'White_police_door_panel',[.012,doorH,doorL],[side*sideX,cy,-.15],white,.007);
  B(root,'Police_door_divider',[.017,doorH,.009],[side*(sideX+.009),cy,isSuv?-.27:.04],trim,0);
  const sign=mesh(root,'Police_door_marking',new T.PlaneGeometry(isSuv?1.0:.90,.16),material('Police_Marking','#ffffff',.7,0,{map:labelTexture('POLICE','#21313f','#e8e7df',512,128)}),[side*(sideX+.009),cy,-.2]);sign.rotation.y=side*Math.PI/2;
 }
 const nose=isSuv?2.42:2.75,pushY=isSuv?.79:.61;
 for(const x of[-.50,.50])beam(root,'Front_push_bar_upright',[x,pushY-.27,nose],[x,pushY+.21,nose],.032,trim,10);
 for(const y of[pushY-.12,pushY+.13])beam(root,'Front_push_bar_crossmember',[-.65,y,nose],[.65,y,nose],.035,trim,10);
 const barY=isSuv?2.03:1.63;
 B(root,'Emergency_bar_base',[1.32,.06,.32],[0,barY,0],trim,.012);
 for(const x of[-.48,.48])B(root,'Emergency_bar_mount',[.06,.11,.20],[x,barY-.06,0],trim,.008);
 for(const[side,name,color]of[[-1,'Emergency_Red','#f02a39'],[1,'Emergency_Blue','#1b5be9']]){
  const light=material(name,color,.19,0,{emissive:color,emissiveIntensity:.65});
  B(root,name,[.57,.11,.27],[side*.31,barY+.08,0],light,.018);
  for(let i=0;i<6;i++)B(root,'Lightbar_optic_rib',[.009,.085,.277],[side*.31-.22+i*.088,barY+.08,0],metal,.002);
 }
 const spot=mesh(root,'Driver_spotlight',new T.CylinderGeometry(.055,.055,.045,24),trim,[-(isSuv?.94:.79),isSuv?1.42:1.13,isSuv?.89:.88]);spot.rotation.x=Math.PI/2;
 root.userData.features=['black-and-white livery','police door markings','red-blue emergency bar','push bar','visible cabin','independent wheels'];
 return root;
}

const entries=[];
for(const[id,name,make]of[['velocity-gt','Velocity GT',()=>buildDetailedCar('velocity')],['shadow-lx','Shadow LX',sedan],['vortex-rs','Vortex RS',trackCoupe],['trailhawk-x','Trailhawk X',suv],['police-sedan','Police Patrol Sedan',()=>patrol('sedan')],['police-suv','Police Patrol SUV',()=>patrol('suv')]]){
 const root=make();root.userData.features=[...(root.userData.features??['sports coupe body','visible cabin','independent wheels']),'compound-curved panels','curved glazing','rounded edge profiles'];batch(root);root.updateMatrixWorld(true);let triangles=0,meshes=0;
 root.traverse(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;for(const a of Object.values(n.geometry.attributes))for(const v of a.array)if(!Number.isFinite(v))throw Error('Nonfinite geometry: '+id);const normal=n.geometry.attributes.normal;if(normal)for(let i=0;i<normal.count;i++){const v=new T.Vector3().fromBufferAttribute(normal,i);if(v.lengthSq()<1e-12)v.set(0,1,0);else v.normalize();normal.setXYZ(i,v.x,v.y,v.z);}}});
 const dimensions=new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray().map(v=>+v.toFixed(3));
 const model=id+'-detailed-v3',binary=await new GLTFExporter().parseAsync(root,{binary:true,maxTextureSize:1024});await fs.writeFile(output+'models/'+model+'.glb',Buffer.from(binary));
 entries.push({id,model,name,triangles,meshes,dimensions,features:root.userData.features,glb:'models/'+model+'.glb'});console.log(JSON.stringify(entries.at(-1)));
}
// Earlier V1/V2 files remain available for comparison; this is the curved-surface fleet revision.
await fs.writeFile(output+'vehicle-fleet.json',JSON.stringify({version:'Fleet V3',units:'metres',models:entries},null,2));
