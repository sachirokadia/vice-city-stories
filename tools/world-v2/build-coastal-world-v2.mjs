import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadImage} from '@napi-rs/canvas';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {T,createCanvas,material,mesh,group,box,beam,tube,labelTexture,batch,output} from './asset-kit.mjs';

// Metres; local +Z is the street-facing facade. The earlier V1 assets are preserved.
const source=fileURLToPath(new URL('./.cache/textures/',import.meta.url));
const M={},audit={units:'metres',version:'World V2',openings:[],buildings:[],checks:[],textureTiles:{}};
async function texture(file,size=1024,srgb=false){const im=await loadImage(file),c=createCanvas(size,size);c.getContext('2d').drawImage(im,0,0,size,size);const t=new T.CanvasTexture(c);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
async function surface(key,id,tile,color='#ffffff'){
 const mat=material(key,color,1,0,{map:await texture(`${source}/${id}_Diffuse.jpg`,1024,true),normalMap:await texture(`${source}/${id}_nor_gl.png`,512),roughnessMap:await texture(`${source}/${id}_Rough.png`,512),normalScale:new T.Vector2(.65,.65)});mat.userData.tileMetres=tile;M[key]=mat;audit.textureTiles[key]={source:id,tileMetres:tile};return mat;
}
await surface('Plaster','painted_plaster_wall',2,'#eee6d7');
await surface('Concrete','concrete_wall_006',2);
// Neutralize the scanned wall's warm staining for the exposed pavement/concrete variant.
{const c=M.Concrete.map.image,ctx=c.getContext('2d'),im=ctx.getImageData(0,0,c.width,c.height),d=im.data;for(let i=0;i<d.length;i+=4){const l=d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722;d[i]=l*.6+70;d[i+1]=l*.6+72;d[i+2]=l*.6+70;}ctx.putImageData(im,0,0);M.Concrete.normalScale.set(.25,.25);}
await surface('Brick','brick_wall_005',1.44,'#e1d8cf');
await surface('Pavement','pavement_02',2.12,'#e7e4db');
M.Asphalt=material('Asphalt','#b9c0c1',.92,0,{map:await texture(path.join(source,'asphalt_02_Diffuse.jpg'),1024,true),normalMap:await texture(path.join(source,'asphalt_02_nor_gl.png'),512),normalScale:new T.Vector2(.35,.35)});M.Asphalt.userData.tileMetres=2;
Object.assign(M,{
 Stone:material('Limestone','#c5baa5',.82),Frame:material('Powder_coated_aluminium','#34424a',.36,.12),Metal:material('Galvanised_metal','#80908e',.35,.9),Roof:material('Roof_membrane','#696c64',.95),
 Glass:material('Recessed_clear_glass','#adced0',.17,0,{transparent:true,opacity:.22,depthWrite:false,side:T.DoubleSide,ior:1.5}),
 OfficeGlass:material('Office_glazing','#8faeb5',.2,0,{transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide}),
 Inner:material('Interior_plaster','#76736d',.88),Dark:material('Interior_shadow','#393f40',.88),Curtain:material('Linen_curtains','#bab09c',.96),Wood:material('Weathered_teak','#80674e',.75),
 Accent:material('Terracotta_signage','#99553f',.77),White:material('Road_paint','#d9d8bd',.94),Yellow:material('Lane_paint','#bf9d57',.85),Rubber:material('Rubber','#232b2e',.9),Soil:material('Planter_soil','#4b4738',1),
 Leaf:material('Palm_fronds','#465839',.83,0,{side:T.DoubleSide}),LeafLight:material('Palm_new_growth','#68764b',.86,0,{side:T.DoubleSide}),Bark:material('Palm_bark','#8b8068',.94),
 Water:material('Coastal_Water','#326b77',.23,.12,{side:T.DoubleSide}),Lamp:material('Lamp_diffuser','#e6d8b4',.4,0,{emissive:'#b99b6c',emissiveIntensity:.15})
});
function B(p,n,s,pos,m,bev=0){const obj=box(p,n,s,pos,m,bev);if(m.userData.tileMetres){const tile=m.userData.tileMetres,geo=obj.geometry,a=geo.attributes.position,no=geo.attributes.normal,uv=geo.attributes.uv;for(let i=0;i<a.count;i++){const x=a.getX(i)+pos[0],y=a.getY(i)+pos[1],z=a.getZ(i)+pos[2],nx=Math.abs(no.getX(i)),ny=Math.abs(no.getY(i));uv.setXY(i,(nx>.7?z:x)/tile,(ny>.7?z:y)/tile);}}return obj;}
function text(p,name,w,h,pos,txt,bg='#34464a',fg='#eee6cf'){return B(p,name,[w,h,.035],pos,material(name+'_ink','#ffffff',.8,0,{map:labelTexture(txt,fg,bg,1024,256)}));}
function railing(p,x,y,z,w,depth=0){
 for(const xx of[-w/2,w/2])beam(p,'Guard_post',[x+xx,y,z],[x+xx,y+1.1,z],.025,M.Metal,8);
 beam(p,'Guard_top',[x-w/2,y+1.1,z],[x+w/2,y+1.1,z],.032,M.Metal,8);
 for(let xx=-w/2+.16;xx<w/2;xx+=.16)beam(p,'Guard_baluster',[x+xx,y+.06,z],[x+xx,y+1.04,z],.011,M.Frame,6);
 if(depth)for(const xx of[-w/2,w/2]){beam(p,'Guard_return',[x+xx,y+1.1,z],[x+xx,y+1.1,z-depth],.028,M.Metal,8);for(let zz=.15;zz<depth;zz+=.16)beam(p,'Guard_return_baluster',[x+xx,y+.05,z-zz],[x+xx,y+1.04,z-zz],.011,M.Frame,6);}
}
function window(p,{x,y,w,h,bay,level,name,door=false,office=false,balcony=false,lod=0}){
 const z=-.16,frame=.065;
 audit.openings.push({building:name,level,bay,clearWidth:w-2*frame,clearHeight:h-2*frame,recessMetres:Math.abs(z-.025+.006),type:door?'door':'window'});
 // Frames, reveals and a glass pane sit inside an actual hole in the wall.
 for(const xx of[x-w/2+frame/2,x+w/2-frame/2])B(p,'Window_jamb',[frame,h,.13],[xx,y+h/2,z],M.Frame);
 for(const yy of[y+frame/2,y+h-frame/2])B(p,'Window_transom',[w,frame,.13],[x,yy,z],M.Frame);
 B(p,'Glazing',[w-frame*2,h-frame*2,.012],[x,y+h/2,z-.025],office?M.OfficeGlass:M.Glass);
 B(p,'Mullion',[.045,h-frame*2,.09],[x,y+h/2,z+.015],M.Frame);
 if(!door)B(p,'Projecting_sill',[w+.18,.085,.38],[x,y-.025,-.02],M.Stone,.01);
 if(lod)return;
 // Shallow actual rooms: floors are full slabs; these walls stop the hollow-box appearance.
 B(p,'Room_backwall',[bay-.28,h+.3,.10],[x,y+h/2,-2.65],M.Inner);
 for(const xx of[x-bay/2+.15,x+bay/2-.15])B(p,'Room_partition',[.1,h+.3,2.5],[xx,y+h/2,-1.4],M.Inner);
 if((level+Math.round(x))%3!==0&&!office){
  const cy=y+h/2;for(const side of[-1,1]){const cw=.22+((Math.abs(x)+level)%4)*.09;B(p,'Curtain',[cw,h-.12,.055],[x+side*(w/2-cw/2-.09),cy,-.38],M.Curtain);if(cw>.3)for(let f=0;f<3;f++)B(p,'Curtain_fold',[.018,h-.14,.05],[x+side*(w/2-cw/2-.09)-cw/3+f*cw/3,cy,-.335],M.Stone);}
 }else if(!door){for(let yy=y+h-.15;yy>y+h*.48;yy-=.11)B(p,'Blind_slat',[w-.15,.055,.08],[x,yy,-.36],M.Curtain);}
 if(door){for(const xx of[x-.13,x+.13])beam(p,'Door_handle',[xx,y+.95,-.055],[xx,y+1.3,-.055],.012,M.Metal,8);}
 if(balcony){B(p,'Balcony_slab',[w+.6,.18,1.45],[x,y-.12,.6],M.Concrete,.02);railing(p,x,y-.02,1.24,w+.5,1.32);}
}
function facade(parent,{width,depth,rotation=0,pos,name,floors,ground=4.2,storey=3.15,bays=6,wall=M.Plaster,lod=0,balconies=true}){
 const f=group(parent,'Facade_'+rotation,pos);f.rotation.y=rotation;const bw=width/bays;
 for(let level=0;level<=floors;level++){
  const base=level===0?0:ground+(level-1)*storey,fh=level===0?ground:storey;
  const g=group(f,'Storey_'+level);
  for(let i=0;i<bays;i++){
   const x=-width/2+bw*(i+.5),balcony=balconies&&level>0&&(i===1||i===bays-2)&&rotation===0,door=level===0||balcony,ww=level===0?bw-.65:balcony?Math.min(2.1,bw-.95):Math.min(1.8,bw-.95),wh=level===0?2.78:balcony?2.5:1.8,wy=level===0?.16:balcony?.10:.88,pier=(bw-ww)/2;
   for(const side of[-1,1])B(g,'Wall_pier',[pier,fh,.28],[x+side*(ww/2+pier/2),base+fh/2,-.14],level===0?M.Stone:wall);
   if(wy>0)B(g,'Sill_wall',[ww,wy,.28],[x,base+wy/2,-.14],level===0?M.Stone:wall);
   const top=fh-wy-wh;B(g,'Lintel_wall',[ww,top,.28],[x,base+wy+wh+top/2,-.14],level===0?M.Stone:wall);
   window(g,{x,y:base+wy,w:ww,h:wh,bay:bw,level,name,door,balcony,lod});
   if(!lod&&level===0){B(g,'Shop_counter',[bw*.58,.85,.65],[x,base+.56,-1.45],M.Wood,.02);B(g,'Shop_display',[bw*.4,.16,.3],[x,base+1.1,-1.45],M.Accent,.01);}
  }
  B(g,'Floor_string_course',[width+.12,.13,.4],[0,base+fh-.06,-.09],M.Stone,.006);
 }
 return f;
}
function roof(p,W,D,Y,lod){
 B(p,'Roof_deck',[W,.20,D],[0,Y,0],M.Roof);
 for(const side of[-1,1]){B(p,'Roof_parapet',[W,.95,.24],[0,Y+.48,side*(D/2-.12)],M.Plaster);B(p,'Parapet_cap',[W+.1,.08,.35],[0,Y+.99,side*(D/2-.12)],M.Stone,.01);B(p,'Roof_parapet',[.24,.95,D],[side*(W/2-.12),Y+.48,0],M.Plaster);}
 if(lod)return;
 for(const x of[-W*.26,W*.22]){
  B(p,'HVAC_plinth',[3.4,.2,2.1],[x,Y+.19,0],M.Concrete);B(p,'HVAC_cabinet',[3,.9,1.7],[x,Y+.7,0],M.Metal,.025);
  for(let i=-12;i<=12;i++)B(p,'HVAC_louvre',[2.78,.014,.025],[x,Y+.34+(i+12)*.027,.866],M.Frame);
  for(const xx of[-.7,.7]){const fan=mesh(p,'Condenser_fan',new T.CylinderGeometry(.5,.5,.035,24),M.Frame,[x+xx,Y+1.17,0]);for(let k=0;k<7;k++){const a=k*Math.PI/7;beam(p,'Fan_grille',[x+xx+Math.cos(a)*.48,Y+1.195,Math.sin(a)*.48],[x+xx-Math.cos(a)*.48,Y+1.195,-Math.sin(a)*.48],.009,M.Metal,5);}}
 }
 for(const side of[-1,1])tube(p,'Rainwater_downpipe',[[side*(W/2-.32),Y+.4,-D/2+.1],[side*(W/2-.32),Y-.2,-D/2-.1],[side*(W/2-.32),.25,-D/2-.1]],.045,M.Frame,8,8);
}
function apartment(lod=0,variant=false){const W=variant?20:24,D=14,F=variant?4:5,G=4.2,H=3.15,Y=G+F*H,name=variant?'Marina_House':'Ocean_View_Apartments',r=new T.Group();r.name=name;r.userData={units:'metres',floorToFloor:G,residentialFloorToFloor:H,wallThickness:.28};
 for(let f=0;f<=F+1;f++){const y=f?G+(f-1)*H:.06;B(r,'Floor_slab',[W,.18,D],[0,y,0],M.Concrete);}
 for(const [rotation,pos,width,bays]of[[0,[0,0,D/2],W,variant?5:6],[Math.PI,[0,0,-D/2],W,variant?5:6],[Math.PI/2,[W/2,0,0],D,4],[-Math.PI/2,[-W/2,0,0],D,4]])facade(r,{width,depth:D,rotation,pos,name,floors:F,bays,ground:G,storey:H,lod,wall:variant?M.Brick:M.Plaster});
 roof(r,W,D,Y+.15,lod);
 B(r,'Entrance_canopy',[4.8,.17,1.7],[0,3.15,D/2+.62],M.Frame,.02);text(r,'Building_sign',4.1,.4,[0,3.52,D/2+.035],variant?'MARINA HOUSE':'OCEAN VIEW');
 if(!lod){for(const xx of[-2.3,2.3])beam(r,'Canopy_support',[xx,.16,D/2+1.3],[xx,3.1,D/2+1.3],.04,M.Frame,10);for(const xx of[-W/2+.1,W/2-.1])B(r,'Vertical_corner_trim',[.18,Y,.25],[xx,Y/2+.15,D/2+.08],M.Stone,.015);}
 audit.buildings.push({name,lod,width:W,depth:D,height:Y+1.25,groundFloor:G,upperFloor:H});return r;}
function market(lod=0){const W=18,D=11,G=4.2,H=3.2,F=2,Y=G+F*H,r=new T.Group();r.name='Sunset_Corner_Market';
 for(let f=0;f<=3;f++)B(r,'Floor_slab',[W,.18,D],[0,f?G+(f-1)*H:.06,0],M.Concrete);
 for(const[rotation,pos,width,bays]of[[0,[0,0,D/2],W,5],[Math.PI,[0,0,-D/2],W,5],[Math.PI/2,[W/2,0,0],D,3],[-Math.PI/2,[-W/2,0,0],D,3]])facade(r,{width,depth:D,rotation,pos,name:r.name,floors:F,bays,ground:G,storey:H,wall:M.Brick,balconies:false,lod});
 roof(r,W,D,Y+.15,lod);B(r,'Shop_fascia',[W+.25,.65,.16],[0,3.55,D/2+.1],M.Accent,.01);text(r,'Market_sign',7.3,.44,[0,3.56,D/2+.198],'SUNSET • MARKET','#99553f');
 if(!lod){for(let i=0;i<18;i++){const x=-W/2+(i+.5);const canopy=B(r,'Canvas_awning',[.99,.035,1.6],[x,3.01,D/2+.8],i%2?M.Curtain:M.Accent);canopy.rotation.x=.14;}for(const x of[-7,-4,4,7]){B(r,'Produce_crate',[.85,.6,.8],[x,.46,D/2+.9],M.Wood,.025);for(let i=0;i<6;i++)mesh(r,'Market_produce',new T.SphereGeometry(.11,8,6),i%2?M.Yellow:M.Accent,[x-.25+(i%3)*.25,.83,D/2+.72+Math.floor(i/3)*.23]);}}
 audit.buildings.push({name:r.name,lod,width:W,depth:D,height:Y+1.25,groundFloor:G,upperFloor:H});return r;}
function office(lod=0){const W=18,D=14,G=5.2,H=3.4,F=8,Y=G+F*H,r=new T.Group();r.name='Harbor_Exchange';
 for(let f=0;f<=F+1;f++){const y=f?G+(f-1)*H:.1;B(r,'Office_slab',[W,.23,D],[0,y,0],M.Concrete);}
 for(const[rot,pos,width]of[[0,[0,0,D/2],W],[Math.PI,[0,0,-D/2],W],[Math.PI/2,[W/2,0,0],D],[-Math.PI/2,[-W/2,0,0],D]]){
  const g=group(r,'Curtain_wall_'+rot,pos);g.rotation.y=rot;const bays=Math.round(width/1.5),bw=width/bays;
  for(let f=0;f<=F;f++){const y=f?G+(f-1)*H:0,h=f?H:G;const floor=group(g,'Office_floor_'+f);B(floor,'Insulated_spandrel',[width,.8,.25],[0,y+h-.4,-.13],M.Frame);
   for(let i=0;i<bays;i++){const x=-width/2+(i+.5)*bw;window(floor,{x,y:y+.08,w:bw-.07,h:h-.94,bay:bw,level:f,name:r.name,office:true,lod});if(!lod&&f>0&&i%3===1){B(floor,'Office_desk',[1.1,.08,.65],[x,y+.84,-1.6],M.Wood);B(floor,'Monitor',[.45,.32,.05],[x,y+1.06,-1.6],M.Dark);}}
  }
 }
 roof(r,W,D,Y+.15,lod);B(r,'Lobby_canopy',[7,.22,2.3],[0,4.1,D/2+.8],M.Frame,.02);text(r,'Exchange_sign',6.5,.5,[0,4.55,D/2+.08],'HARBOR EXCHANGE');
 if(!lod)for(const xx of[-W/2+.2,W/2-.2])B(r,'Facade_fin',[.17,Y,.52],[xx,Y/2+.15,D/2+.1],M.Metal,.01);
 audit.buildings.push({name:r.name,lod,width:W,depth:D,height:Y+1.25,groundFloor:G,upperFloor:H});return r;}
function palm(p,x,z,h=7,seed=0){const g=group(p,'Coastal_palm',[x,.16,z]);tube(g,'Curved_palm_trunk',[[0,0,0],[.07,h*.3,.04],[.25,h*.65,.11],[.45,h,.15]],.145,M.Bark,16,10);for(let y=.2;y<h;y+=.23){const v=y/h;const c=mesh(g,'Trunk_ring',new T.TorusGeometry(.15,.012,4,10),M.Wood,[.45*v*v,y,.15*v]);c.rotation.x=Math.PI/2;}
 for(let j=0;j<13;j++){const a=j*2.399+seed,reach=2.3+(j%3)*.25,up=.8+(j%4)*.17,pts=[];for(let s=0;s<=8;s++){const t=s/8;pts.push([.45+Math.cos(a)*reach*t,h+up*Math.sin(t*Math.PI*.84)-1.45*t*t,.15+Math.sin(a)*reach*t]);}tube(g,'Palm_frond_stem',pts,.018,M.Bark,8,5);
  for(let s=1;s<8;s++){const t=s/8,pt=pts[s],len=.85*Math.sin(t*Math.PI)*(.9+(j%3)*.1);for(const sign of[-1,1]){const dx=Math.cos(a+sign*1.05)*len,dz=Math.sin(a+sign*1.05)*len,px=-Math.sin(a)*.065,pz=Math.cos(a)*.065;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([pt[0]-px,pt[1],pt[2]-pz,pt[0]+dx*.6-px,pt[1]-.13-t*.2,pt[2]+dz*.6-pz,pt[0]+dx,pt[1]-.3-t*.3,pt[2]+dz,pt[0]+dx*.6+px,pt[1]-.12-t*.2,pt[2]+dz*.6+pz,pt[0]+px,pt[1],pt[2]+pz],3));geo.setIndex([0,1,4,1,3,4,1,2,3]);geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,0,.6,.5,1,1,.6,1,0],2));geo.computeVertexNormals();mesh(g,'Palm_leaflet',geo,j%3?M.Leaf:M.LeafLight);}}
 }
 return g;}
function bench(p,x,z,rot=0){const g=group(p,'Promenade_bench',[x,.16,z]);g.rotation.y=rot;for(let i=0;i<5;i++)B(g,'Seat_slat',[1.85,.055,.085],[0,.44,-.2+i*.1],M.Wood,.012);for(let i=0;i<4;i++)B(g,'Back_slat',[1.85,.095,.055],[0,.64+i*.12,-.26],M.Wood,.01);for(const xx of[-.65,.65]){beam(g,'Bench_leg',[xx,0,-.2],[xx,.48,-.2],.035,M.Frame,8);beam(g,'Bench_leg',[xx,0,.2],[xx,.48,.2],.035,M.Frame,8);beam(g,'Bench_back',[xx,.4,-.28],[xx,1.04,-.28],.03,M.Frame,8);}}
function lamp(p,x,z){const g=group(p,'Street_lamp',[x,.16,z]);B(g,'Lamp_base',[.34,.18,.34],[0,.09,0],M.Concrete,.025);beam(g,'Lamp_pole',[0,.12,0],[0,5.5,0],.055,M.Frame,12);tube(g,'Lamp_arm',[[0,5.3,0],[0,5.6,.25],[0,5.55,1.1]],.045,M.Frame,10,8);B(g,'Lamp_housing',[.32,.1,.72],[0,5.48,1.03],M.Frame,.03);B(g,'Lamp_diffuser',[.25,.025,.62],[0,5.42,1.03],M.Lamp,.01);}
function street(){const r=new T.Group();r.name='Coastal_Infrastructure';
 B(r,'Road_foundation',[112,.25,17],[0,-.14,4],M.Concrete);B(r,'Asphalt_two_lanes',[112,.05,12.5],[0,.008,4],M.Asphalt);
 // Street runs east-west. Buildings face south (+Z); waterfront is beyond +Z.
 B(r,'Parcel_foundation',[112,.22,30],[0,.045,-20],M.Concrete);
 for(const[z,w]of[[-6,7],[14,7]]){B(r,'Paved_sidewalk',[112,.22,w],[0,.05,z],M.Concrete);for(let x=-55;x<56;x+=1.2)B(r,'Kerbstone',[1.17,.25,.24],[x,.045,z+(z<0?1:-1)*(w/2)],M.Stone,.012);for(let x=-55;x<56;x+=1.5)B(r,'Paving_control_joint',[.012,.004,w-.2],[x,.163,z],M.Stone);}
 B(r,'Promenade_stone_border',[112,.012,.7],[0,.17,17.1],M.Pavement);
 for(let x=-51;x<54;x+=5){B(r,'Lane_dash',[2.8,.006,.11],[x,.039,4],M.White);for(const z of[-1.35,9.35])B(r,'Parking_line',[2.4,.006,.07],[x,.039,z],M.White);}
 for(const x of[-40,36]){for(let z=-1.5;z<10;z+=1.05)B(r,'Crosswalk_stripe',[2.8,.008,.55],[x,.042,z],M.White);for(const z of[-2.3,10.3]){const ramp=mesh(r,'Dropped_kerb',new T.BoxGeometry(3.4,.16,1.8),M.Pavement,[x,.04,z]);ramp.rotation.x=(z<0?1:-1)*.06;}}
 for(const x of[-48,-24,0,24,48]){for(const z of[-2.05,10.05]){B(r,'Storm_drain',[.8,.025,.32],[x,.037,z],M.Frame);for(let s=0;s<10;s++)B(r,'Drain_slot',[.035,.005,.27],[x-.34+s*.075,.053,z],M.Dark);}const cover=mesh(r,'Manhole',new T.CylinderGeometry(.35,.35,.025,28),M.Metal,[x+5,.04,5.6]);for(let k=-3;k<=3;k++)B(r,'Manhole_tread',[.51,.004,.014],[x+5,.055,5.6+k*.065],M.Frame);}
 for(const x of[-48,-28,-8,12,32,52]){palm(r,x,13.4,7+(x%3)*.15,x*.07);lamp(r,x-3,-3.1);bench(r,x+3,15.8,Math.PI);B(r,'Palm_planter',[2.2,.24,2.2],[x,.15,13.4],M.Stone,.035);B(r,'Soil_bed',[1.9,.04,1.9],[x,.285,13.4],M.Soil);}
 // Waterfront wall, coping and railings form a consistent edge rather than floating pieces.
 B(r,'Seawall',[112,2.2,.8],[0,-.83,18],M.Concrete);B(r,'Stone_coping',[112,.2,1],[0,.36,18],M.Stone,.025);
 for(let x=-55;x<55;x+=5)railing(r,x+2.5,.47,18,5);
 const waterGeo=new T.PlaneGeometry(160,96,120,72);waterGeo.rotateX(-Math.PI/2);const wp=waterGeo.attributes.position;for(let i=0;i<wp.count;i++){const x=wp.getX(i),z=wp.getZ(i);wp.setY(i,.045*Math.sin(x*.63+z*.42)+.025*Math.sin(x*1.4-z*.7));}waterGeo.computeVertexNormals();mesh(r,'Coastal_water_surface',waterGeo,M.Water,[0,-.82,67]);
 for(const x of[-44,-20,4,28,48]){for(const z of[-3,11]){beam(r,'Bollard',[x,.16,z],[x,.96,z],.055,M.Frame,10);B(r,'Bollard_reflector',[.11,.1,.11],[x,.82,z],M.White);}}
 // Markings are thin geometry in the interchange file; Unity decal projection remains a later pass.
 const sign=group(r,'Street_name_sign',[-39,.16,-3]);beam(sign,'Signpost',[0,0,0],[0,2.85,0],.035,M.Frame,10);text(sign,'Ocean_drive_sign',1.7,.27,[0,2.7,.05],'OCEAN DRIVE');
 return r;}

async function save(id,name,kind,root,description,lod=false){
 batch(root);root.updateMatrixWorld(true);let triangles=0,vertices=0,meshes=0;root.traverse(n=>{if(n.isMesh){meshes++;const g=n.geometry;vertices+=g.attributes.position.count;triangles+=(g.index?.count??g.attributes.position.count)/3;for(const a of Object.values(g.attributes))for(const v of a.array)if(!Number.isFinite(v))throw Error('Nonfinite '+n.name);}});
 const bounds=new T.Box3().setFromObject(root),dims=bounds.getSize(new T.Vector3()).toArray().map(v=>+v.toFixed(3));const bytes=await new GLTFExporter().parseAsync(root,{binary:true,maxTextureSize:1024});await fs.writeFile(path.join(output,'models',id+'.glb'),Buffer.from(bytes));
 const entry={id,name,kind,status:'World V2 asset study',version:'World V2',description,triangles:Math.round(triangles),vertices,meshes,dimensions:dims,animations:[],glb:'models/'+id+'.glb',lod};const catalog=JSON.parse(await fs.readFile(output+'/catalog.json','utf8'));catalog.models=catalog.models.filter(m=>m.id!==id);catalog.models.push(entry);catalog.status='Preserved V1/V2/V3 assets plus researched World V2 coastal architecture. Unity runtime integration remains unverified.';await fs.writeFile(output+'/catalog.json',JSON.stringify(catalog,null,2));console.log(JSON.stringify(entry));return entry;
}
const originals=JSON.parse(await fs.readFile(output+'/catalog.json','utf8'));await fs.mkdir(fileURLToPath(new URL('./.cache/',import.meta.url)),{recursive:true});await fs.writeFile(fileURLToPath(new URL('./.cache/catalog-before-world-v2.json',import.meta.url)),JSON.stringify(originals,null,2));
const buildings=[['ocean-view-v2','Ocean View Apartments',apartment(),[-29,.01,-16.5]],['harbor-exchange-v2','Harbor Exchange',office(),[0,.01,-16.5]],['sunset-market-v2','Sunset Corner Market',market(),[23,.01,-15]],['marina-house-v2','Marina House',apartment(0,true),[46,.01,-16.5]]];
const scene=new T.Group();scene.name='Ocean_Drive_World_V2';scene.userData={units:'metres',research:'research-world.html',renderPipelineTarget:'Unity 6000.6 / URP 17.6',engineVerified:false};
for(const[id,name,root,pos]of buildings){await save(id,name,'Environment',root,'Metric architecture with wall openings, recessed glazing, shallow rooms, floor slabs, parapets, services and CC0 PBR surfaces.');const clone=root.clone(true);clone.position.set(...pos);scene.add(clone);}
const infra=street();await save('coastal-infrastructure-v2','Ocean Drive · Road and Waterfront','Environment',infra,'Two lanes, parking marks, dropped kerbs, drains, pavement, benches, palms, lamps, coping, guardrails and water.');scene.add(infra);
// Include the already-approved car as a separate node; its original exported source remains untouched.
globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(t,p){Object.assign(this,p)}};globalThis.createImageBitmap=async blob=>{const im=await loadImage(Buffer.from(await blob.arrayBuffer())),c=createCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);return c;};
try{const bin=await fs.readFile(fileURLToPath(new URL('./source/velocity-gt-detailed-v1.glb',import.meta.url)));const gltf=await new GLTFLoader().parseAsync(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),'');gltf.scene.position.set(-24,.09,-.7);gltf.scene.rotation.y=Math.PI/2;gltf.scene.name='Parked_Velocity_GT';scene.add(gltf.scene);}catch(e){console.log('Existing car not added: '+e.message);}
await save('ocean-drive-world-v2','Ocean Drive · Coastal World V2','Scene',scene,'Four distinct metric buildings and a complete coastal street block. Actual asset scene; not a Unity screenshot or verified playable build.');
for(const[id,name,root]of[['ocean-view-v2-lod1','Ocean View · LOD1',apartment(1)],['harbor-exchange-v2-lod1','Harbor Exchange · LOD1',office(1)],['sunset-market-v2-lod1','Sunset Market · LOD1',market(1)],['marina-house-v2-lod1','Marina House · LOD1',apartment(1,true)]])await save(id,name,'Environment',root,'Separate reduced-detail mesh: no curtains, furniture, balcony balusters or roof equipment. Unity LODGroup wiring pending.',true);
audit.checks=[{name:'All exported mesh attributes finite',passed:true},{name:'Facade openings have positive clearance',passed:audit.openings.every(o=>o.clearWidth>1&&o.clearHeight>1.5)},{name:'Glazing recessed approximately 18 cm',passed:audit.openings.every(o=>o.recessMetres>=.17&&o.recessMetres<=.18)},{name:'Ground floors at least 4.2 m',passed:audit.buildings.every(b=>b.groundFloor>=4.2)},{name:'Residential and office storeys at least 3.15 m',passed:audit.buildings.every(b=>b.upperFloor>=3.15)}];
await fs.writeFile(output+'/world-metric-audit.json',JSON.stringify(audit,null,2));
console.log('World export complete: '+audit.openings.length+' designed openings across LOD variants.');
