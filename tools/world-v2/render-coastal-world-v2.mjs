import {fileURLToPath} from 'node:url';
// Rasterize the exported GLB itself, including its real PBR textures and geometry.
// Offline preview renderer, not a Unity screenshot or performance measurement.
import fs from 'node:fs/promises';import * as T from 'three';import {createCanvas,loadImage} from '@napi-rs/canvas';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const out=fileURLToPath(new URL('../../public/world-v2/',import.meta.url)),which=process.argv[2]||'all';
const vehicleId=process.argv.find(a=>a.startsWith('--vehicle='))?.slice(10);
const vehicle=vehicleId?JSON.parse(await fs.readFile(out+'/vehicle-fleet.json','utf8')).models.find(m=>m.id===vehicleId):null;
const reference=vehicleId==='velocity-gt'&&process.argv.includes('--reference-v1');
if(vehicleId&&!vehicle)throw Error('Unknown vehicle '+vehicleId);
globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(t,p){Object.assign(this,p)}};globalThis.createImageBitmap=async b=>{const im=await loadImage(Buffer.from(await b.arrayBuffer())),c=createCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);return c;};
const cityView = process.argv.find(arg => arg.startsWith('--city='))?.slice(7);
let root;
if (cityView) {
  const { loadRuntimeWorld } = await import('./load-runtime-world.mjs');
  ({ scene: root } = await loadRuntimeWorld(cityView === 'overview' ? 'low' : 'high'));
  // Approximate the game shader's shallow-to-deep colour for this CPU renderer.
  const water = root.getObjectByName('shoreline-water');
  const strip = createCanvas(256, 32);
  const ctx = strip.getContext('2d');
  const color = ctx.createLinearGradient(0, 0, 255, 0);
  color.addColorStop(0, '#b2ded2');
  color.addColorStop(.012, '#408a7b');
  color.addColorStop(.22, '#306d83');
  color.addColorStop(1, '#17465e');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 32);
  water.material = new T.MeshStandardMaterial({ name: 'Coastal_Water', map: new T.CanvasTexture(strip) });
} else {
  const model = reference ? 'models/velocity-gt-detailed-v1.glb' : vehicle?.glb ?? 'models/ocean-drive-world-v2.glb';
  const bin = await fs.readFile(out + '/' + model);
  const gltf = await new GLTFLoader().parseAsync(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '');
  root = gltf.scene;
}
if(vehicle){const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({name:'Studio_floor',color:'#35414a',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;root.add(floor);}
root.updateMatrixWorld(true);

const imgs = new Map();
const meshes = [];
let pixelUV = 0;
const tint = new T.Color();
const instance = new T.Matrix4();
const worldMatrix = new T.Matrix4();
const tinted = new Map();
function stageMesh(geometry, material, name, matrix, castsShadow) {
  for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
    const tex = material[slot];
    if (!tex) continue;
    const img = tex.image;
    let canvas = img?.sourceImage ? createCanvas(img.sourceImage.width, img.sourceImage.height) : img;
    if (img?.sourceImage) canvas.getContext('2d').drawImage(img.sourceImage, 0, 0);
    if (canvas?.getContext) {
      if (!imgs.has(img)) {
        imgs.set(img, {
          data: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
          width: canvas.width,
          height: canvas.height,
        });
      }
      tex.image = imgs.get(img);
    }
    tex.updateMatrix();
  }
  const { position, normal, uv } = geometry.attributes;
  const normalMatrix = new T.Matrix3().getNormalMatrix(matrix);
  const verts = [];
  for (let i = 0; i < position.count; i++) {
    const p = new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix);
    const n = new T.Vector3().fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
    verts.push([p.x, p.y, p.z, n.x, n.y, n.z, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0]);
  }
  const center = new T.Vector3();
  if (material.transparent) {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    geometry.boundingBox.getCenter(center).applyMatrix4(matrix);
  }
  meshes.push({ verts, ix: geometry.index?.array, mat: material, name, center, castsShadow });
}
root.traverse(m => {
  if (!m.isMesh || Array.isArray(m.material) || !m.material.color) return;
  if (!m.isInstancedMesh) {
    stageMesh(m.geometry, m.material, m.name, m.matrixWorld, m.castShadow);
    return;
  }
  for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, instance);
    let material = m.material;
    if (m.instanceColor) {
      m.getColorAt(i, tint);
      const key = material.id + ':' + tint.getHex();
      if (!tinted.has(key)) {
        const variant = material.clone();
        variant.color.multiply(tint);
        tinted.set(key, variant);
      }
      material = tinted.get(key);
    }
    stageMesh(m.geometry, material, m.name, worldMatrix.multiplyMatrices(m.matrixWorld, instance), m.castShadow);
  }
});
for(const im of imgs.values()){im.mips=[];let current=im;while(current.width>16&&current.height>2){const w=current.width>>1,h=current.height>>1,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let ch=0;ch<4;ch++)data[(y*w+x)*4+ch]=(current.data[((y*2)*current.width+x*2)*4+ch]+current.data[((y*2)*current.width+x*2+1)*4+ch]+current.data[((y*2+1)*current.width+x*2)*4+ch]+current.data[((y*2+1)*current.width+x*2+1)*4+ch])/4;current={width:w,height:h,data};im.mips.push(current);}}
const sun=new T.Vector3(-.65,.85,.65).normalize(),light=vehicle?new T.OrthographicCamera(-5.5,5.5,4.5,-4.5,.1,35):cityView?new T.OrthographicCamera(-275,275,275,-275,.1,950):new T.OrthographicCamera(-88,88,65,-65,.1,300);light.position.copy(sun).multiplyScalar(vehicle?14:cityView?490:130).add(new T.Vector3(0,vehicle?.8:6,0));light.lookAt(0,vehicle?.8:6,0);light.updateMatrixWorld();const lvp=new T.Matrix4().multiplyMatrices(light.projectionMatrix,light.matrixWorldInverse),S=cityView?2048:vehicle?2048:3072,shadow=new Float32Array(S*S);shadow.fill(Infinity);
function project(v,vp,W,H){const e=vp.elements,x=v[0],y=v[1],z=v[2],cx=e[0]*x+e[4]*y+e[8]*z+e[12],cy=e[1]*x+e[5]*y+e[9]*z+e[13],cz=e[2]*x+e[6]*y+e[10]*z+e[14],cw=e[3]*x+e[7]*y+e[11]*z+e[15];return[...v,cx,cy,cz,cw];}
const planes=[[1,0,0,1],[-1,0,0,1],[0,1,0,1],[0,-1,0,1],[0,0,1,1],[0,0,-1,1]];
function clip(poly){for(const p of planes){const next=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=p[0]*a[8]+p[1]*a[9]+p[2]*a[10]+p[3]*a[11],db=p[0]*b[8]+p[1]*b[9]+p[2]*b[10]+p[3]*b[11];if(da>=0)next.push(a);if((da<0)!==(db<0)){const t=da/(da-db);next.push(a.map((v,j)=>v+(b[j]-v)*t));}}poly=next;if(poly.length<3)return[];}return poly;}
function screen(v,W,H){const q=1/v[11];return[(v[8]*q*.5+.5)*W,(.5-v[9]*q*.5)*H,v[10]*q,q];}
function triangles(m,vp,W,H,fn){const vs=m.verts.map(v=>project(v,vp,W,H)),ix=m.ix;for(let j=0;j<(ix?.length??vs.length);j+=3){const a=vs[ix?ix[j]:j],b=vs[ix?ix[j+1]:j+1],c=vs[ix?ix[j+2]:j+2];let flags=0,all=63;for(const v of[a,b,c]){let f=0;for(let k=0;k<6;k++){const p=planes[k];if(p[0]*v[8]+p[1]*v[9]+p[2]*v[10]+p[3]*v[11]<0)f|=1<<k;}flags|=f;all&=f;}if(all)continue;const poly=flags?clip([a,b,c]):[a,b,c];for(let i=1;i<poly.length-1;i++)fn(poly[0],poly[i],poly[i+1]);}}
function raster(a,b,c,W,H,fn){const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(area)<1e-7)return;const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const xx=x+.5,yy=y+.5,u=((b[0]-xx)*(c[1]-yy)-(b[1]-yy)*(c[0]-xx))/area,v=((c[0]-xx)*(a[1]-yy)-(c[1]-yy)*(a[0]-xx))/area,w=1-u-v;if(u>=0&&v>=0&&w>=0)fn(x,y,u,v,w,u*a[2]+v*b[2]+w*c[2]);}}
for(const m of meshes){if((cityView&&!m.castsShadow)||m.mat.transparent||m.mat.name==='Coastal_Water')continue;triangles(m,lvp,S,S,(a,b,c)=>raster(screen(a,S,S),screen(b,S,S),screen(c,S,S),S,S,(x,y,u,v,w,z)=>{const i=y*S+x;if(z<shadow[i])shadow[i]=z;}));}
console.log('Built actual-geometry shadow map.');
function visibility(x,y,z,nl){const e=lvp.elements,lx=e[0]*x+e[4]*y+e[8]*z+e[12],ly=e[1]*x+e[5]*y+e[9]*z+e[13],lz=e[2]*x+e[6]*y+e[10]*z+e[14],sx=Math.round((lx*.5+.5)*S),sy=Math.round((.5-ly*.5)*S),bias=cityView?.0013+.0014*(1-Math.max(0,nl)):vehicle?.000025+.00015*(1-Math.max(0,nl)):.00035+.0008*(1-Math.max(0,nl));if(sx<2||sx>=S-2||sy<2||sy>=S-2)return 1;let lit=0;for(const[dx,dy]of[[-1,-1],[1,-1],[-1,1],[1,1]])lit+=lz-bias<=shadow[(sy+dy)*S+sx+dx]?1:.0;return lit*.25;}
function sample(map,u,v){if(!map?.image?.data)return[255,255,255,255];const e=map.matrix.elements,lod=Math.floor(Math.log2(Math.max(1,pixelUV*map.image.width))),im=lod?map.image.mips[Math.min(map.image.mips.length-1,lod-1)]:map.image;let s=e[0]*u+e[3]*v+e[6],t=e[1]*u+e[4]*v+e[7];s=map.wrapS===T.RepeatWrapping?s-Math.floor(s):Math.max(0,Math.min(1,s));t=map.wrapT===T.RepeatWrapping?t-Math.floor(t):Math.max(0,Math.min(1,t));const x=Math.min(im.width-1,Math.floor(s*im.width)),y=Math.min(im.height-1,Math.floor((map.flipY?1-t:t)*im.height)),i=(y*im.width+x)*4;return[im.data[i],im.data[i+1],im.data[i+2],im.data[i+3]];}
const lin=Array.from({length:256},(_,i)=>{const v=i/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
const aces=x=>Math.max(0,Math.min(1,x*(2.51*x+.03)/(x*(2.43*x+.59)+.14))),encode=x=>{x=aces(x);return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055));};
const cityShots = {
  overview: { title: 'Vice City · Entire playable map', pos: [225, 440, 318], target: [1, 0, -6], fov: 53 },
  downtown: { title: 'Downtown · Office towers and street-level entrances', pos: [-5, 3.6, -84], target: [-55, 10, -132], fov: 66 },
  market: { title: 'Market district · Shops and apartments', pos: [47, 2.7, -33], target: [-5, 5, -43], fov: 66 },
  residential: { title: 'Southside · Houses beside West Park', pos: [-117, 9, 93], target: [-69, 3, 106], fov: 67 },
  waterfront: { title: 'Ocean Drive · Promenade and beach access', pos: [154, 11, 87], target: [121, 6, 35], fov: 70 },
  warehouses: { title: 'Southwest · Warehouse streets', pos: [-126, 5, 143], target: [-153, 5, 171], fov: 60 },
};
if (cityView && !cityShots[cityView]) throw new Error('Unknown city camera: ' + cityView);
const views = cityView ? [{ id: 'city-' + cityView, ...cityShots[cityView] }] : vehicle?[{id:'car-'+vehicle.id+(reference?'-before':''),title:vehicle.name+(reference?' · Earlier V1 reference':' · Curved-surface fleet'),pos:[4.7,2.65,6.5],target:[0,.7,0],fov:31}]:[{id:'world-v2-overview',title:'Ocean Drive · A coherent coastal block',pos:[69,44,82],target:[1,9,-9],fov:46},{id:'world-v2-street',title:'Street level · Recesses, materials and scale',pos:[-51,2.2,9],target:[-19,7.0,-13],fov:65},{id:'world-v2-facade',title:'Ocean View · Real openings and shallow interiors',pos:[-45,7.1,3],target:[-29,8.5,-10],fov:54}];
for(const view of views){if(!cityView&&!vehicle&&which!=='all'&&!view.id.includes(which))continue;const W=cityView?1440:1800,H=cityView?900:1125,c=createCanvas(W,H),ctx=c.getContext('2d'),im=ctx.createImageData(W,H),pixels=im.data,depth=new Float32Array(W*H);depth.fill(Infinity);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const t=y/H,k=(y*W+x)*4;pixels[k]=vehicle?31+17*t:132+70*t;pixels[k+1]=vehicle?43+19*t:161+55*t;pixels[k+2]=vehicle?53+21*t:180+42*t;pixels[k+3]=255;}
 const camera=new T.PerspectiveCamera(view.fov,W/H,cityView==='overview'?10:.15,cityView?950:500);camera.position.set(...view.pos);camera.lookAt(...view.target);camera.updateMatrixWorld();const vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),ordered=meshes.filter(m=>!m.mat.transparent).concat(meshes.filter(m=>m.mat.transparent).sort((a,b)=>b.center.distanceToSquared(camera.position)-a.center.distanceToSquared(camera.position)));
 let shaded=0;for(const m of ordered){const mat=m.mat;triangles(m,vp,W,H,(a,b,c)=>{
  if(mat.side===T.FrontSide){const e1=[0,1,2].map(i=>b[i]-a[i]),e2=[0,1,2].map(i=>c[i]-a[i]),face=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];if(face[0]*(camera.position.x-a[0])+face[1]*(camera.position.y-a[1])+face[2]*(camera.position.z-a[2])<=0)return;}
  const aa=screen(a,W,H),bb=screen(b,W,H),cc=screen(c,W,H),du1=b[6]-a[6],dv1=b[7]-a[7],du2=c[6]-a[6],dv2=c[7]-a[7],det=du1*dv2-du2*dv1,iv=Math.abs(det)>1e-9?1/det:0;pixelUV=Math.max(Math.hypot(du1,dv1)/Math.max(1,Math.hypot(bb[0]-aa[0],bb[1]-aa[1])),Math.hypot(du2,dv2)/Math.max(1,Math.hypot(cc[0]-aa[0],cc[1]-aa[1])));
  const tan=[0,1,2].map(i=>((b[i]-a[i])*dv2-(c[i]-a[i])*dv1)*iv),bit=[0,1,2].map(i=>((c[i]-a[i])*du1-(b[i]-a[i])*du2)*iv),tl=Math.hypot(...tan)||1,bl=Math.hypot(...bit)||1;for(let i=0;i<3;i++){tan[i]/=tl;bit[i]/=bl;}
  raster(aa,bb,cc,W,H,(x,y,u,v,w,z)=>{const index=y*W+x;if(z>=depth[index])return;const inv=u*aa[3]+v*bb[3]+w*cc[3],ba=u*aa[3]/inv,bd=v*bb[3]/inv,bc=w*cc[3]/inv,tu=a[6]*ba+b[6]*bd+c[6]*bc,tv=a[7]*ba+b[7]*bd+c[7]*bc,tex=sample(mat.map,tu,tv);if(tex[3]/255<(mat.alphaTest||.001))return;
   const wx=a[0]*ba+b[0]*bd+c[0]*bc,wy=a[1]*ba+b[1]*bd+c[1]*bc,wz=a[2]*ba+b[2]*bd+c[2]*bc;let nx=a[3]*ba+b[3]*bd+c[3]*bc,ny=a[4]*ba+b[4]*bd+c[4]*bc,nz=a[5]*ba+b[5]*bd+c[5]*bc;
   if(mat.normalMap&&iv){const n=sample(mat.normalMap,tu,tv),tx=(n[0]/127.5-1)*(mat.normalScale?.x??.5),ty=(n[1]/127.5-1)*(mat.normalScale?.y??.5),tz=n[2]/127.5-1;nx=tan[0]*tx+bit[0]*ty+nx*tz;ny=tan[1]*tx+bit[1]*ty+ny*tz;nz=tan[2]*tx+bit[2]*ty+nz*tz;}
   const nl2=Math.hypot(nx,ny,nz)||1;nx/=nl2;ny/=nl2;nz/=nl2;const ex=camera.position.x-wx,ey=camera.position.y-wy,ez=camera.position.z-wz,el=Math.hypot(ex,ey,ez),vx=ex/el,vy=ey/el,vz=ez/el;if(mat.side===T.DoubleSide&&nx*vx+ny*vy+nz*vz<0){nx=-nx;ny=-ny;nz=-nz;}
   const nl=nx*sun.x+ny*sun.y+nz*sun.z,vis=mat.transparent?1:visibility(wx,wy,wz,nl),direct=Math.max(0,nl)*vis,rough=(mat.roughness??.8)*(mat.roughnessMap?sample(mat.roughnessMap,tu,tv)[1]/255:1),hx=vx+sun.x,hy=vy+sun.y,hz=vz+sun.z,hl=Math.hypot(hx,hy,hz),nh=Math.max(0,(nx*hx+ny*hy+nz*hz)/hl),fres=.04+.96*(1-Math.max(0,nx*vx+ny*vy+nz*vz))**5,spec=nh**(8+180*(1-rough))*vis*(.03+.17*(1-rough)),ambient=.19+.12*(ny*.5+.5),fog=cityView?Math.min(.105,el/2200):Math.min(.22,el/850);
   let rgb=[lin[tex[0]]*mat.color.r*(ambient*.94+direct*1.05)+spec,lin[tex[1]]*mat.color.g*(ambient*1.07+direct*.98)+spec*.96,lin[tex[2]]*mat.color.b*(ambient*1.23+direct*.85)+spec*.89];
   if(cityView&&mat.isMeshBasicMaterial)rgb=[lin[tex[0]]*mat.color.r,lin[tex[1]]*mat.color.g,lin[tex[2]]*mat.color.b];
   if(cityView&&mat.emissive)rgb=rgb.map((channel,i)=>channel+[mat.emissive.r,mat.emissive.g,mat.emissive.b][i]*mat.emissiveIntensity);
   if(vehicle&&mat.name!=='Studio_floor'){
    const nv=Math.max(0,nx*vx+ny*vy+nz*vz),rx=2*nv*nx-vx,ry=2*nv*ny-vy,rz=2*nv*nz-vz,metal=mat.metalness??0;
    const boxA=Math.max(0,-.35*rx+.62*ry-.70*rz)**16*2.7,boxB=Math.max(0,.82*rx+.55*ry-.16*rz)**20*1.7,environment=.06+.16*Math.max(0,ry)+boxA+boxB;
    const base=[lin[tex[0]]*mat.color.r,lin[tex[1]]*mat.color.g,lin[tex[2]]*mat.color.b];
    const coat=(mat.clearcoat??0)*(boxA+boxB)*.16*(1-rough*.4);
    rgb=rgb.map((val,i)=>val*(1-metal*.35)+environment*(.04*(1-metal)+base[i]*metal)*(.85-.35*rough)+coat);
    if(mat.emissive)rgb=rgb.map((val,i)=>val+[mat.emissive.r,mat.emissive.g,mat.emissive.b][i]*(mat.emissiveIntensity??1));
   }
   if(mat.transparent||mat.name==='Coastal_Water'){const sky=[.34,.48,.57],reflection=mat.transparent?.22+fres*.6:.22+fres*.65;rgb=rgb.map((val,i)=>val*(1-reflection)+sky[i]*reflection);}
   const k=index*4,alpha=mat.transparent?Math.min(.65,(mat.opacity??1)+fres*.22):1;for(let i=0;i<3;i++){const value=encode(rgb[i]*(1-fog)+[.48,.59,.64][i]*fog);pixels[k+i]=Math.round(value*alpha+pixels[k+i]*(1-alpha));}if(!mat.transparent)depth[index]=z;shaded++;
  });
 });}
 ctx.putImageData(im,0,0);const grad=ctx.createLinearGradient(0,H-130,0,H);grad.addColorStop(0,'#11202800');grad.addColorStop(1,'#112028ee');ctx.fillStyle=grad;ctx.fillRect(0,H-140,W,140);ctx.fillStyle='#f2e9d6';ctx.font='28px sans-serif';ctx.fillText(view.title,38,H-65);ctx.fillStyle='#c1d0cc';ctx.font='16px sans-serif';ctx.fillText(cityView?'Game world geometry · Offline render with simplified water and lighting':vehicle?'Actual delivered GLB · CPU studio preview · game logic tested separately':'Actual exported GLB · CPU PBR preview with shadows · Unity Editor integration pending',38,H-32);
 const final=createCanvas(1440,900);final.getContext('2d').drawImage(c,0,0,1440,900);await fs.writeFile(out+'/previews/'+view.id+'.png',final.toBuffer('image/png'));console.log('Saved '+view.id+' ('+shaded+' shaded fragments)');
}
