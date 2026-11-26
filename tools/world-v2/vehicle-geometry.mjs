import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
// Original hand-authored Velocity GT family geometry; model export is kept separate.
export function buildDetailedCar(variant){const car=new T.Group();car.name='Velocity_GT_Detailed_V1';
const paint=new T.MeshPhysicalMaterial({name:'Sunset_Red_Clearcoat',color:'#9e1825',metalness:.72,roughness:.23,clearcoat:1,clearcoatRoughness:.1});
const rubber=new T.MeshStandardMaterial({name:'Performance_Rubber',color:'#161719',roughness:.88});
const groove=new T.MeshStandardMaterial({name:'Tire_Grooves',color:'#090a0b',roughness:1});
const metal=new T.MeshStandardMaterial({name:'Forged_Aluminium',color:'#b6bec5',metalness:.96,roughness:.22});
const black=new T.MeshStandardMaterial({name:'Graphite_Trim',color:'#181c20',metalness:.48,roughness:.36});
const seam=new T.MeshStandardMaterial({name:'Panel_Shut_Lines',color:'#210b0e',roughness:.7});
const glass=new T.MeshPhysicalMaterial({name:'Smoked_Automotive_Glass',color:'#59717d',metalness:0,roughness:.1,transparent:true,opacity:.34,side:T.DoubleSide,clearcoat:1,clearcoatRoughness:.05,depthWrite:false});
const cabin=new T.MeshStandardMaterial({name:'Charcoal_Leather',color:'#25252a',roughness:.78});
const brake=new T.MeshStandardMaterial({name:'Ventilated_Brake_Disc',color:'#676d72',metalness:.9,roughness:.4});
const red=new T.MeshStandardMaterial({name:'Red_Brake_Caliper',color:'#d33223',metalness:.55,roughness:.3});
const led=new T.MeshStandardMaterial({name:'LED_Daytime_Lights',color:'#fff3de',emissive:'#fff1d1',emissiveIntensity:1.5,roughness:.2});
const tail=new T.MeshStandardMaterial({name:'LED_Rear_Lights',color:'#9f1420',emissive:'#ed1422',emissiveIntensity:1.5,roughness:.24});
function mesh(name,g,m,p=[0,0,0],parent=car){const obj=new T.Mesh(g,m);obj.name=name;obj.position.set(...p);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;}
function box(name,size,p,m=paint,r=.025,parent=car){const bevel=r&&Math.min(...size)>.03&&Math.max(...size)>.12;return mesh(name,bevel?new RoundedBoxGeometry(...size,r>=.018?3:2,r):new T.BoxGeometry(...size),m,p,parent);}
function beam(name,a,b,width,mat=paint,parent=car){const av=new T.Vector3(...a),bv=new T.Vector3(...b),obj=mesh(name,new T.CylinderGeometry(width,width,av.distanceTo(bv),8),mat,av.clone().add(bv).multiplyScalar(.5).toArray(),parent);obj.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return obj;}
function line(name,points,r,mat,parent=car){if(name.includes('Door')&&name.includes('Seam'))points=points.map(p=>[p[0]+Math.sign(p[0])*.025,p[1],p[2]]);const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(name,new T.TubeGeometry(curve,Math.max(20,points.length*7),r,r>.012?10:6,false),mat,[0,0,0],parent);}
function surface(name,nu,nv,fn,mat,parent=car){const pos=[],uv=[],ix=[];for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){pos.push(...fn(u/nu,v/nv));uv.push(u/nu,v/nv);}for(let v=0;v<nv;v++)for(let u=0;u<nu;u++){let a=v*(nu+1)+u,b=a+1,c=a+nu+1,d=c+1;ix.push(a,c,b,b,c,d);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return mesh(name,g,mat,[0,0,0],parent);}

// A real wheel opening in each side panel: these arches are geometry, not dark circles painted on a solid body.
const profile=new T.Shape();profile.moveTo(-2.21,.25);profile.lineTo(-2.21,.58);profile.bezierCurveTo(-2.1,.72,-1.8,.88,-1.4,.87);profile.bezierCurveTo(-1.02,.88,-.88,.72,-.57,.70);profile.lineTo(.62,.7);profile.bezierCurveTo(.92,.72,1.1,.88,1.42,.87);profile.bezierCurveTo(1.85,.85,2.22,.66,2.24,.5);profile.lineTo(2.24,.25);profile.lineTo(1.84,.25);profile.lineTo(1.84,.36);profile.absarc(1.4,.36,.44,0,Math.PI,false);profile.lineTo(.96,.25);profile.lineTo(-.96,.25);profile.lineTo(-.96,.36);profile.absarc(-1.4,.36,.44,0,Math.PI,false);profile.lineTo(-1.84,.25);profile.closePath();
for(const side of [-1,1]){const geo=new T.ExtrudeGeometry(profile,{depth:.065,bevelEnabled:true,bevelThickness:.015,bevelSize:.018,bevelSegments:3,curveSegments:20,steps:1});geo.rotateY(-Math.PI/2);mesh(side<0?'Left_Sculpted_Fender':'Right_Sculpted_Fender',geo,paint,[side<0?-.85:.915,0,0]);}
// A smooth compound-curved skin over the structural side panels, retaining real arch openings.
const shoulder=[[-2.22,.58],[-1.80,.86],[-1.40,.87],[-.57,.70],[.62,.70],[1.42,.87],[1.85,.85],[2.24,.50]];
function sideTop(z){let i=0;while(i<shoulder.length-2&&z>shoulder[i+1][0])i++;const a=shoulder[i],b=shoulder[i+1],p=shoulder[Math.max(0,i-1)],n=shoulder[Math.min(shoulder.length-1,i+2)],d=b[0]-a[0],t=Math.max(0,Math.min(1,(z-a[0])/d)),m0=(b[1]-p[1])/(b[0]-p[0]),m1=(n[1]-a[1])/(n[0]-a[0]);return(2*t*t*t-3*t*t+1)*a[1]+(t*t*t-2*t*t+t)*d*m0+(-2*t*t*t+3*t*t)*b[1]+(t*t*t-t*t)*d*m1;}
for(const side of[-1,1]){const skin=surface('Compound_curved_body_side_'+side,144,10,(u,v)=>{const z=-2.21+u*4.45;let bottom=.25;for(const axle of[-1.4,1.4])if(Math.abs(z-axle)<.44)bottom=Math.max(bottom,.36+Math.sqrt(.44*.44-(z-axle)**2));const top=Math.max(bottom+.015,sideTop(z)),y=bottom+(top-bottom)*v,x=.917+.030*Math.sin(v*Math.PI)*(.80+.20*Math.sin(u*Math.PI));return[side*x,y,z];},paint);if(side<0){const ix=skin.geometry.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}skin.geometry.computeVertexNormals();}}

// Curved hood and rear deck. The center creases and shoulder crowns catch reflections.
surface('Compound_Curved_Hood',28,18,(u,v)=>{const x=(u-.5)*1.72,z=.75+v*1.49,y=.705-.17*v*v+.06*Math.cos((u-.5)*Math.PI)+.14*Math.pow(Math.abs((u-.5)*2),4)*Math.sin(v*Math.PI);return[x,y,z];},paint);
surface('Sculpted_Rear_Deck',24,12,(u,v)=>{const x=(u-.5)*1.72,z=-2.21+v*1.22,y=.67+.07*Math.sin(v*Math.PI)+.07*(1-Math.pow((u-.5)*2,2));return[x,y,z];},paint);
box('Chassis_Undertray',[1.44,.055,3.45],[0,.22,0],black,.015);
box('Cabin_Floor',[1.45,.12,1.82],[0,.64,-.06],black,.02);
surface('Crowned_Painted_Roof',48,26,(u,v)=>[(u-.5)*1.29,1.285+.042*Math.sin(u*Math.PI)+.02*Math.sin(v*Math.PI),-.64+v*1.02],paint);
surface('Curved_Front_Windscreen',40,24,(u,v)=>{const width=.71-v*.065,s=Math.sin(u*Math.PI);return[(u-.5)*2*width,.79+v*.495+.042*s*v+.02*s*Math.sin(v*Math.PI),.96-v*.58+.055*s*Math.sin(v*Math.PI)];},glass);
surface('Curved_Rear_Windscreen',32,20,(u,v)=>{const s=Math.sin(u*Math.PI);return[(u-.5)*2*(.71-v*.065),.79+v*.495+.042*s*v+.015*s*Math.sin(v*Math.PI),-1.09+v*.45-.03*s*Math.sin(v*Math.PI)];},glass);
for(const side of [-1,1]){
  surface(`Side_Glass_${side}`,36,20,(u,v)=>{const rear=-1.07+v*.44,front=.93-v*.56;return[side*(.748-v*.103+.018*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)),.79+v*.495+.02*Math.sin(u*Math.PI)*v,rear+u*(front-rear)];},glass);
  line(`A_Pillar_${side}`,[[side*.75,.78,.96],[side*.713,1.035,.71],[side*.645,1.285,.38]],.028,paint);
  line(`C_Pillar_${side}`,[[side*.75,.78,-1.1],[side*.707,1.04,-.88],[side*.645,1.285,-.64]],.037,paint);
  beam(`Window_Sill_${side}`,[side*.752,.79,-1.08],[side*.752,.79,.95],.018);
  beam(`Window_Divider_${side}`,[side*.75,.79,-.36],[side*.645,1.285,-.30],.017,black);
  line(`Door_Rear_Seam_${side}`,[[side*.924,.69,-.68],[side*.932,.57,-.72],[side*.929,.36,-.68],[side*.919,.30,-.59]],.004,seam);
  line(`Door_Lower_Seam_${side}`,[[side*.923,.3,-.59],[side*.923,.29,0],[side*.923,.30,.65]],.004,seam);
  line(`Door_Front_Seam_${side}`,[[side*.923,.3,.65],[side*.931,.5,.71],[side*.923,.69,.73]],.004,seam);
  box(`Recessed_Door_Handle_${side}`,[.022,.032,.15],[side*.939,.625,-.38],metal,.009);
  box(`Sculpted_Side_Skirt_${side}`,[.09,.085,1.77],[side*.925,.235,0],black,.018);
  beam(`Mirror_Stalk_${side}`,[side*.74,.85,.68],[side*.99,.85,.61],.024,black);
  box(`Painted_Mirror_Cap_${side}`,[.20,.10,.25],[side*1.03,.88,.60],paint,.042);
  box(`Mirror_Lens_${side}`,[.15,.065,.015],[side*1.035,.88,.473],metal,.012);
  for(const z of [-1.4,1.4]){const pts=[];for(let i=0;i<=16;i++){const a=i/16*Math.PI;pts.push([side*.947,.36+Math.sin(a)*.447,z+Math.cos(a)*.447]);}line(`Wheel_Arch_Lip_${side}_${z}`,pts,.012,paint);}
}
// Visible cabin instead of an opaque black slab.
for(const side of [-1,1]){
  box(`Leather_Seat_Base_${side}`,[.46,.14,.5],[side*.37,.78,-.10],cabin,.06);
  const back=box(`Sport_Seat_Back_${side}`,[.45,.46,.13],[side*.37,1.0,-.36],cabin,.055);back.rotation.x=-.12;
  box(`Headrest_${side}`,[.24,.15,.12],[side*.37,1.23,-.39],cabin,.045);
}
box('Dashboard',[1.33,.12,.32],[0,.93,.55],black,.035);
const steering=mesh('Three_Spoke_Steering_Wheel',new T.TorusGeometry(.105,.013,8,32),cabin,[-.37,1.035,.40]);steering.rotation.x=-.38;
for(let i=0;i<3;i++){const a=i*Math.PI*2/3;beam('Steering_Spoke_'+i,[-.37,1.035,.40],[-.37+Math.cos(a)*.09,1.035+Math.sin(a)*.09,.40],.009,metal);}
box('Center_Console',[.16,.18,.63],[0,.80,-.04],black,.025);

// Four independently transformable 96-segment wheels; tires, forged rims, brake discs and calipers.
for(const side of [-1,1])for(const z of [-1.4,1.4]){
  const wheel=new T.Group();wheel.name=`Wheel_${z>0?'Front':'Rear'}_${side<0?'Left':'Right'}`;wheel.position.set(side*.88,.365,z);car.add(wheel);
  const tireG=new T.TorusGeometry(.278,.085,24,96);tireG.rotateY(Math.PI/2);tireG.scale(1.55,1,1);mesh('Rounded_Performance_Tire',tireG,rubber,[0,0,0],wheel);
  for(const offset of [-.065,0,.065]){const g=new T.TorusGeometry(.357,.0025,4,64);g.rotateY(Math.PI/2);mesh('Circumferential_Tread_Channel',g,groove,[offset,0,0],wheel);}
  const rimG=new T.CylinderGeometry(.237,.237,.22,64,1,true);rimG.rotateZ(Math.PI/2);mesh('Rim_Barrel',rimG,black,[0,0,0],wheel);
  for(const off of [-.121,.121]){const g=new T.TorusGeometry(.228,.014,12,72);g.rotateY(Math.PI/2);mesh('Machined_Rim_Lip',g,metal,[off,0,0],wheel);}
  const discG=new T.CylinderGeometry(.186,.186,.014,48);discG.rotateZ(Math.PI/2);mesh('Brake_Disc',discG,brake,[side*.074,0,0],wheel);
  for(let j=0;j<12;j++){const a=j*Math.PI*2/12;const g=new T.CircleGeometry(.008,6);g.rotateY(side*Math.PI/2);mesh('Disc_Drill_'+j,g,groove,[side*.082,Math.cos(a)*.15,Math.sin(a)*.15],wheel);}
  box('Fixed_Brake_Caliper',[.055,.17,.07],[side*.087,.015,-.166],red,.014,wheel);
  for(let j=0;j<10;j++){const a=j*Math.PI*2/10;const spoke=box('Swept_Forged_Spoke_'+j,[.031,.032,.19],[side*.126,Math.sin(a)*.12,Math.cos(a)*.12],metal,.006,wheel);spoke.rotation.x=-a;}
  const hubG=new T.CylinderGeometry(.051,.051,.042,32);hubG.rotateZ(Math.PI/2);mesh('Wheel_Center_Hub',hubG,metal,[side*.133,0,0],wheel);
  for(let j=0;j<5;j++){const a=j*Math.PI*2/5;const g=new T.CylinderGeometry(.008,.008,.006,6);g.rotateZ(Math.PI/2);mesh('Lug_Bolt_'+j,g,black,[side*.158,Math.sin(a)*.033,Math.cos(a)*.033],wheel);}
}
// Front fascia: inset housings, individual optics, daylight signatures and open grille slats.
box('Front_Bumper',[1.74,.22,.24],[0,.365,2.15],paint,.055);
box('Front_Lower_Intake',[.94,.115,.033],[0,.335,2.285],black,.025);
for(let i=-7;i<=7;i++)box('Front_Grille_Slat_'+i,[.018,.09,.018],[i*.056,.335,2.307],metal,.003);
box('Front_Splitter',[1.84,.035,.36],[0,.226,2.125],black,.012);
for(const side of [-1,1]){
  box('Headlight_Dark_Housing_'+side,[.45,.125,.075],[side*.60,.553,2.12],black,.035);
  for(let j=0;j<2;j++){const optic=mesh('Projector_Optic_'+side+'_'+j,new T.CylinderGeometry(.036,.036,.032,24),led,[side*.60+(j-.5)*.13,.562,2.17]);optic.rotation.x=Math.PI/2;}
  line('Daylight_Signature_'+side,[[side*.80,.60,2.15],[side*.65,.614,2.16],[side*.43,.604,2.17],[side*.40,.56,2.17]],.008,led);
  box('Side_Air_Intake_'+side,[.24,.10,.03],[side*.68,.337,2.29],black,.02);
  line('Hood_Power_Crease_'+side,[[side*.40,.78,.82],[side*.46,.78,1.12],[side*.49,.725,1.6],[side*.50,.625,1.98]],.003,seam);
}
box('Rear_Bumper',[1.76,.23,.23],[0,.36,-2.16],paint,.05);
box('Rear_Diffuser',[1.60,.11,.22],[0,.24,-2.19],black,.015);
for(let i=-3;i<=3;i++)box('Diffuser_Strake_'+i,[.014,.11,.3],[i*.18,.22,-2.18],black,.003);
for(const side of [-1,1]){
  box('Rear_Light_Housing_'+side,[.62,.10,.045],[side*.49,.61,-2.225],black,.02);
  line('Rear_LED_Signature_'+side,[[side*.79,.64,-2.257],[side*.54,.647,-2.259],[side*.20,.638,-2.257]],.013,tail);
  for(const off of [-.065,.065]){const g=new T.CylinderGeometry(.042,.042,.13,24,1,true);g.rotateX(Math.PI/2);mesh('Stainless_Exhaust_'+side+'_'+off,g,metal,[side*.58+off,.275,-2.30]);}
}
box('Rear_Number_Plate',[.30,.072,.018],[0,.42,-2.288],metal,.006);
box('Active_Rear_Spoiler',[1.50,.035,.20],[0,.84,-1.99],paint,.012);
for(const side of [-1,1])box('Spoiler_Support_'+side,[.035,.14,.06],[side*.51,.77,-1.99],black,.006);


if(variant==='shadow'){
 paint.color.set('#172633');paint.name='Midnight_Blue_Clearcoat';
 // Longer four-door body, raised cabin and an upright rear screen.
 for(const n of car.children){
  if(n.isGroup&&n.name.startsWith('Wheel_')){n.position.z*=1.12;continue;}
  if(n.isMesh){n.updateMatrix();const g=n.geometry;g.applyMatrix4(n.matrix);n.position.set(0,0,0);n.quaternion.identity();n.scale.set(1,1,1);const p=g.attributes.position;
   for(let i=0;i<p.count;i++){const y=p.getY(i),z=p.getZ(i);let nz=z*1.12,ny=y;
    if(y>.78){ny=.78+(y-.78)*1.30;if(z<-.25&&z>-1.15)nz-=.23*Math.min(1,(y-.78)/.3);}
    p.setXYZ(i,p.getX(i),ny,nz);
   }g.computeVertexNormals();
  }
 }
 for(const side of[-1,1]){
  line('Rear_Door_Seam_'+side,[[side*.928,.70,-.90],[side*.936,.48,-.91],[side*.927,.30,-.84]],.004,seam);
  line('Center_Door_Seam_'+side,[[side*.928,.70,.08],[side*.936,.49,.04],[side*.927,.30,.04]],.004,seam);
  box('Rear_Door_Handle_'+side,[.023,.032,.15],[side*.940,.626,-.65],metal,.008);
  beam('Sedan_B_Pillar_'+side,[side*.752,.79,.04],[side*.645,1.44,-.04],.023,black);
  box('Rear_Seat_'+side,[.48,.35,.14],[side*.37,.96,-.81],cabin,.04);
 }
}
if(variant==='vortex'){
 paint.color.set('#c59c47');paint.name='Champagne_Gold_Clearcoat';
 for(const n of car.children)if(n.name==='Active_Rear_Spoiler'||n.name.startsWith('Spoiler_Support_'))car.remove(n);
 for(const side of[-1,1]){
  box('Track_Wing_Upright_'+side,[.04,.31,.08],[side*.62,.91,-1.98],black,.008);
  box('Wing_End_Plate_'+side,[.025,.19,.30],[side*.86,1.11,-1.98],black,.008);
  for(let j=0;j<4;j++)box('Hood_Extractor_'+side+'_'+j,[.26,.018,.035],[side*.43,.79-j*.016,1.0+j*.09],black,.004);
  box('Fender_Vent_'+side,[.018,.055,.30],[side*.954,.62,.83],black,.008);
 }
 box('Track_Rear_Wing',[1.76,.045,.30],[0,1.10,-1.98],black,.015);
 box('Race_Front_Splitter',[1.98,.027,.43],[0,.203,2.16],black,.01);
}
for(const wheel of car.children.filter(n=>n.isGroup&&n.name.startsWith('Wheel_'))){const spin=new T.Group();spin.name='WheelSpin';for(const child of [...wheel.children])if(child.name!=='Fixed_Brake_Caliper')spin.add(child);wheel.add(spin);}
return car;}
