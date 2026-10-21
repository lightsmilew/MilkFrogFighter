import {mkdir, readFile, writeFile, readdir, rm} from 'node:fs/promises';
import {resolve, dirname, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build, transform} from 'esbuild';
import {CHARACTERS} from '../src/config.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,'dist');
const hash=body=>createHash('sha256').update(body).digest('hex').slice(0,12);
const fingerprint=(name,body)=>name.slice(0,-extname(name).length)+'.'+hash(body)+extname(name);
const put=async(name,body)=>{const path=resolve(output,name);await mkdir(dirname(path),{recursive:true});await writeFile(path,body);};
// Fixed output directory only. Never clean the checkout or source artwork.
if(output!==resolve(root,'dist'))throw new Error('Unexpected build output path');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});

const assets={};
const runtimeAssets=['favicon.svg','milk-lobby.webp','milk-rooftops-tall.webp','milk-rain-tall.webp',
  'milk-rooftops-thumb.webp','milk-rain-thumb.webp','apple-touch-icon.png','icon-192.png','icon-512.png',
  'audio/classic-laugh.mp3','fighters/portraits.webp',...CHARACTERS.map(character=>`fighters/${character.id}.webp`)];
async function assetFiles(directory,prefix=''){
  const entries=await readdir(directory,{withFileTypes:true});
  return (await Promise.all(entries.map(entry=>entry.isDirectory()?assetFiles(resolve(directory,entry.name),prefix+entry.name+'/'):[prefix+entry.name]))).flat();
}
const unused=(await assetFiles(resolve(root,'assets'))).filter(name=>!runtimeAssets.includes(name)&&name!=='fighters/frames.js');
if(unused.length)throw new Error(`Unused files in assets/: ${unused.join(', ')}. Keep art masters outside the runtime directory.`);
for(const name of runtimeAssets){
  const body=await readFile(resolve(root,'assets',name));
  assets[name]=fingerprint(name,body);
  await put('assets/'+assets[name],body);
}

// A single discovery round replaces the nested module graph. Re-export public
// APIs for existing diagnostics without loading a second app instance.
// QR encoding is optional: it is fetched only when the share panel is opened.
const shareBuild=await build({entryPoints:[resolve(root,'src/share-card.js')],bundle:true,write:false,format:'esm',target:['es2020'],minify:true,charset:'utf8',legalComments:'none'});
const shareCode=shareBuild.outputFiles[0].contents,shareModule=`src/share-card.${hash(shareCode)}.js`;
await put(shareModule,shareCode);
await put('src/share-card.js',`export * from './${shareModule.split('/').pop()}';\n`);
const modules=(await readdir(resolve(root,'src'))).filter(name=>name.endsWith('.js')&&name!=='share-card.js').sort();
const entry=modules.map(name=>`export * from './src/${name}';`).join('\n')+"\nexport * from './assets/fighters/frames.js';";
const bundled=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'game-entry.js'},
  bundle:true,write:false,format:'esm',target:['es2020'],minify:true,charset:'utf8',legalComments:'none',
  define:{__ASSET_URLS__:JSON.stringify(assets),__SHARE_CARD_URL__:JSON.stringify('./'+shareModule.split('/').pop())}});
const code=bundled.outputFiles[0].contents;
const script=`src/game.${hash(code)}.js`;
await put(script,code);
for(const name of modules)await put(`src/${name}`,`export * from './${script.split('/').pop()}';\n`);
await put('assets/fighters/frames.js',`export {FRAME_DATA,ANIMATION_FRAMES,ATLAS_FRAME_SIZE} from '../../${script}';\n`);
const css=(await transform(await readFile(resolve(root,'style.css'),'utf8'),{loader:'css',minify:true,target:['es2020']})).code;
const stylesheet=fingerprint('style.css',css);
await put(stylesheet,css);

const replaceAssets=text=>text.replace(/\.\/assets\/([^"'\s<>]+)/g,(url,name)=>{
  if(!assets[name])throw new Error(`Unmapped asset ${name}`);
  return './assets/'+assets[name];
});
let html=replaceAssets(await readFile(resolve(root,'index.html'),'utf8'));
html=html.replace(/  <link rel="modulepreload"[^>]+>\r?\n/g,'')
  .replace('href="./style.css"',`href="./${stylesheet}"`)
  .replace('data-src="./src/app.js"',`data-src="./${script}"`)
  .replace('  <link rel="stylesheet"',`  <link rel="modulepreload" href="./${script}">\n  <link rel="stylesheet"`);
if(/(?:src|href)="\/(?!\/)/.test(html))throw new Error('Root-relative runtime URL is not compatible with project Pages.');
await put('index.html',html);
await put('404.html',html);
await put('manifest.webmanifest',replaceAssets(await readFile(resolve(root,'manifest.webmanifest'),'utf8')));
await put('sw.js',await readFile(resolve(root,'sw.js')));
await put('licenses/qrcode-generator.txt',await readFile(resolve(root,'licenses/qrcode-generator.txt')));
await put('.nojekyll','');
await put('asset-manifest.json',JSON.stringify({script,shareModule,stylesheet,assets},null,2)+'\n');
console.log(`Built static game: one ${(code.length/1024).toFixed(1)} KiB module, ${runtimeAssets.length} content-addressed assets (loaded on demand).`);
