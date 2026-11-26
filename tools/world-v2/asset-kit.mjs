import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createCanvas as nativeCanvas, ImageData } from '@napi-rs/canvas';
export {T};
// Native Canvas exposes data() as a method. GLTFExporter treats any image.data
// property as pixel bytes, so hide the method on canvases passed to Three.
export function createCanvas(...args){const c=nativeCanvas(...args);Object.defineProperty(c,'data',{value:undefined,configurable:true});return c;}
export const output=fileURLToPath(new URL('../../public/world-v2/',import.meta.url));
globalThis.HTMLCanvasElement=createCanvas(1,1).constructor;
globalThis.ImageData=ImageData;
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(b){b.arrayBuffer().then(r=>{this.result=`data:${b.type};base64,${Buffer.from(r).toString('base64')}`;this.onloadend?.();});}};
export function material(name,color,roughness=.6,metalness=0,extra={}){return new T.MeshPhysicalMaterial({name,color,roughness,metalness,...extra});}
export function mesh(parent,name,geometry,mat,position=[0,0,0]){const m=new T.Mesh(geometry,mat);m.name=name;m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function group(parent,name,position=[0,0,0]){const g=new T.Group();g.name=name;g.position.set(...position);parent.add(g);return g;}
export function box(parent,name,size,position,mat,bevel=.02){return mesh(parent,name,bevel?new RoundedBoxGeometry(...size,1,Math.min(bevel,Math.min(...size)*.35)):new T.BoxGeometry(...size),mat,position);}
export function sphere(parent,name,radii,position,mat,segments=40,rings=24){const geo=new T.SphereGeometry(1,segments,rings);geo.scale(...radii);return mesh(parent,name,geo,mat,position);}
export function tube(parent,name,points,radius,mat,segments=24,radial=6){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(parent,name,new T.TubeGeometry(curve,segments,radius,radial,false),mat);}
export function beam(parent,name,a,b,radius,mat,radial=12){const av=new T.Vector3(...a),bv=new T.Vector3(...b),length=av.distanceTo(bv);if(length<1e-6)return group(parent,name,a);const m=mesh(parent,name,new T.CylinderGeometry(radius,radius,length,radial),mat,av.clone().add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return m;}
export function parametric(parent,name,nu,nv,fn,mat){const positions=[],uv=[],indices=[];for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){positions.push(...fn(u/nu,v/nv));uv.push(u/nu,v/nv);}for(let v=0;v<nv;v++)for(let u=0;u<nu;u++){let a=v*(nu+1)+u,b=a+1,c=a+nu+1,d=c+1;indices.push(a,c,b,b,c,d);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return mesh(parent,name,g,mat);}
export function loft(parent,name,sections,mat,segments=48){const m=parametric(parent,name,segments,sections.length-1,(u,v)=>{const row=Math.min(sections.length-1,Math.round(v*(sections.length-1))),s=sections[row],a=u*Math.PI*2;return[Math.sin(a)*s[1],s[0],Math.cos(a)*s[2]+(s[3]||0)];},mat);const ix=m.geometry.index.array;for(let i=0;i<ix.length;i+=3){const swap=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=swap;}m.geometry.computeVertexNormals();return m;}
export function labelTexture(text,color='#f8ead0',background='#274449',width=1024,height=256){const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);ctx.fillStyle=color;ctx.font=`600 ${Math.round(height*.56)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height*.53,width*.9);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;}
export function batch(root){for(const child of [...root.children])if(child.isGroup)batch(child);const buckets=new Map();for(const child of [...root.children]){if(!child.isMesh)continue;child.updateMatrix();const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();g.applyMatrix4(child.matrix);let bucket=buckets.get(child.material);if(!bucket){bucket=[];buckets.set(child.material,bucket);}bucket.push(g);root.remove(child);}for(const[mat,geos]of buckets){const hasColors=geos.some(g=>g.hasAttribute('color'));if(hasColors)for(const g of geos)if(!g.hasAttribute('color')){const colors=new Float32Array(g.attributes.position.count*3);colors.fill(1);g.setAttribute('color',new T.BufferAttribute(colors,3));}const merged=mergeGeometries(geos,false);if(!merged)throw Error('Cannot batch '+mat.name);const indexed=mergeVertices(merged,1e-5);mesh(root,mat.name,indexed,mat);merged.dispose();for(const g of geos)g.dispose();}}
export async function saveAsset({id,name,kind,root,description,animations=[],batchMeshes=true,version='V1',maxTextureSize=1024}){
 if(batchMeshes)batch(root);root.updateMatrixWorld(true);root.animations=animations;
 let triangles=0,meshes=0,vertices=0;root.traverseVisible(n=>{if(n.isMesh){const p=n.geometry.attributes.position;vertices+=p.count;meshes++;triangles+=(n.geometry.index?.count??p.count)/3;for(const a of Object.values(n.geometry.attributes))for(const v of a.array)if(!Number.isFinite(v))throw Error('Nonfinite mesh attribute in '+id);const normals=n.geometry.attributes.normal;if(normals)for(let i=0;i<normals.count;i++){const normal=new T.Vector3().fromBufferAttribute(normals,i);if(normal.lengthSq()<1e-12)normal.set(0,1,0);else normal.normalize();normals.setXYZ(i,normal.x,normal.y,normal.z);}}});
 const dimensions=new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray().map(n=>+n.toFixed(3));
 const modelPath=path.join(output,'models',id);await fs.mkdir(path.dirname(modelPath),{recursive:true});
 const binary=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,animations,maxTextureSize});
 await fs.writeFile(modelPath+'.glb',Buffer.from(binary));await fs.writeFile(modelPath+'.json',JSON.stringify(root.toJSON()));
 const catalog=JSON.parse(await fs.readFile(path.join(output,'catalog.json'),'utf8'));catalog.models=catalog.models.filter(m=>m.id!==id);
 const entry={id,name,kind,status:'Detailed '+version,version,description,triangles:Math.round(triangles),vertices,meshes,dimensions,animations:animations.map(a=>a.name),glb:'models/'+id+'.glb'};
 catalog.models.push(entry);catalog.status='Original V1 procedural asset collection with preserved source references. Unity runtime integration remains unverified.';
 await fs.writeFile(path.join(output,'catalog.json'),JSON.stringify(catalog,null,2));console.log(JSON.stringify(entry));
 root.traverse(n=>{if(n.isMesh){n.geometry.dispose();for(const mat of[].concat(n.material)){for(const value of Object.values(mat))if(value?.isTexture)value.dispose();mat.dispose();}}});globalThis.gc?.();return entry;
}
