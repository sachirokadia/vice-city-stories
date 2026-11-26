import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Poly Haven CC0 source maps; downloaded inputs stay in the ignored tool cache.
const destination=fileURLToPath(new URL('./.cache/textures/',import.meta.url));
await fs.mkdir(destination,{recursive:true});
const ids=['concrete_wall_006','brick_wall_005','painted_plaster_wall','pavement_02','asphalt_02'];
const digest=bytes=>createHash('md5').update(bytes).digest('hex');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error(`${r.status}: ${url}`);return r;}
for(const id of ids){
 const metadata=await(await get(`https://api.polyhaven.com/files/${id}`)).json();
 for(const[role,format]of[['Diffuse','jpg'],['nor_gl','png'],['Rough','png']]){
  const item=metadata[role]?.['1k']?.[format];
  if(!item)throw Error(`Missing 1K ${role}/${format} for ${id}`);
  const url=new URL(item.url);
  if(url.protocol!=='https:'||url.hostname!=='dl.polyhaven.org')throw Error('Unexpected asset source');
  const filename=path.join(destination,`${id}_${role}.${format}`);
  const cached=await fs.readFile(filename).catch(()=>null);
  if(cached&&digest(cached)===item.md5)continue;
  const bytes=Buffer.from(await(await get(url)).arrayBuffer());
  if(digest(bytes)!==item.md5)throw Error(`Checksum mismatch for ${id}/${role}`);
  await fs.writeFile(filename,bytes);
 }
 console.log(`Ready: ${id}`);
}
