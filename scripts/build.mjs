import { mkdir, cp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,'dist');
if(output!==resolve(root,'dist'))throw new Error('Unexpected build output path');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const name of ['index.html','style.css','.nojekyll'])await cp(resolve(root,name),resolve(output,name));
await cp(resolve(root,'src'),resolve(output,'src'),{recursive:true});
await mkdir(resolve(output,'assets'),{recursive:true});
for(const name of ['favicon.svg','milk-lobby.webp','milk-rooftops.webp','milk-rain.webp','milk-rooftops-thumb.webp','milk-rain-thumb.webp']){
  await stat(resolve(root,'assets',name));
  await cp(resolve(root,'assets',name),resolve(output,'assets',name));
}
await cp(resolve(root,'assets','fighters'),resolve(output,'assets','fighters'),{recursive:true});
await cp(resolve(root,'assets','audio'),resolve(output,'assets','audio'),{recursive:true});
// All runtime links are relative, so both / and /repository-name/ are valid.
const html=await readFile(resolve(output,'index.html'),'utf8');
if(/(?:src|href)="\/(?!\/)/.test(html))throw new Error('Root-relative runtime URL is not compatible with project Pages.');
await writeFile(resolve(output,'404.html'),html);
console.log('Built static game in dist/ (no runtime dependencies).');
