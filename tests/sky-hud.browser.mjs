import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
await mkdir('artifacts',{recursive:true});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://localhost:4173/');await page.locator('#start-button:enabled').waitFor();
 const sky=await page.evaluate(async()=>{
  const {Renderer}=await import('./src/renderer.js'),{Game}=await import('./src/engine.js'),{WORLD,stageById}=await import('./src/config.js'),{updateCamera}=await import('./src/camera.js');
  const renderer=new Renderer(document.createElement('canvas'));await renderer.ready;const samples=[];
  for(const id of ['street','rain']){
   await renderer.ensureStage(id);const game=new Game();game.start({mode:'local',stage:id});
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');
   ctx.translate(-1280,1200);game.camera.y=-1200;renderer.drawStage(ctx,game);ctx.resetTransform();
   const diffs=[];for(const x of [120,320,640,960,1160]){
    const a=ctx.getImageData(x,498,1,1).data,b=ctx.getImageData(x,502,1,1).data;
    diffs.push(Math.max(...[0,1,2].map(i=>Math.abs(a[i]-b[i]))));
   }
   const stage=stageById(id),painting=id==='rain'?renderer.rainPanorama:renderer.panorama;
   const n=()=>({held:new Set(),pressed:new Set()}),jump=()=>({held:new Set(['jump']),pressed:new Set(['jump'])});
   const ledge=game.platforms.find(p=>p.id==='sky-terrace');game.phase='fight';game.fighters.forEach((f,i)=>{f.x=ledge.x+60+i*130;f.y=ledge.y;f.platformId=ledge.id;});renderer.syncViewport(game);
   game.tick(1/60,[jump(),jump()]);for(let frame=0;frame<15;frame++)game.tick(1/60,[n(),n()]);game.tick(1/60,[jump(),jump()]);
   for(let frame=0;frame<100&&game.fighters[0].vy<0;frame++)game.tick(1/60,[n(),n()]);
   renderer.canvas.width=1280;renderer.canvas.height=720;renderer.render(game);
   samples.push({id,diffs,artHeight:painting.naturalHeight,artWidth:painting.naturalWidth,worldHeight:stage.imageBottom-stage.imageTop,peakY:game.fighters[0].y,cameraY:game.camera.y,
    covered:game.camera.y>=stage.imageTop-(stage.imageBottom-stage.imageTop)*.35,png:canvas.toDataURL().split(',')[1],peak:renderer.canvas.toDataURL().split(',')[1]});
   game.fighters[1].y=WORLD.floor;updateCamera(game.camera,game.fighters,0,true);renderer.render(game);
   const colors=new Set(),paint=renderer.canvas.getContext('2d');for(let y=150;y<660;y+=7)colors.add([...paint.getImageData(1277,y,1,1).data].join(','));
   samples.at(-1).mixedEdgeColors=colors.size;
  }return samples;
 });
 for(const sample of sky){assert.ok(sample.diffs.every(n=>n<25),`${sample.id} sky seam: ${sample.diffs}`);assert.equal(sample.artHeight,sample.artWidth);assert.equal(sample.worldHeight,3840);assert.ok(sample.mixedEdgeColors>15);assert.ok(sample.covered&&sample.peakY<-700,JSON.stringify({id:sample.id,covered:sample.covered,peakY:sample.peakY,cameraY:sample.cameraY}));
  await writeFile(`artifacts/sky-extension-${sample.id}.png`,Buffer.from(sample.png,'base64'));await writeFile(`artifacts/sky-high-jump-${sample.id}.png`,Buffer.from(sample.peak,'base64'));delete sample.png;delete sample.peak;}
 await page.locator('[data-mode="practice"]').click();await page.locator('#start-button').click();
 assert.equal(await page.locator('#pause-button svg').count(),1);assert.equal(await page.locator('#fullscreen-button svg').count(),1);
 await page.locator('#fullscreen-button').click();assert.equal(await page.locator('#fullscreen-button').getAttribute('data-icon'),'collapse');
 await page.locator('#pause-button').click();assert.equal(await page.locator('#pause-button').getAttribute('data-icon'),'play');
 await page.locator('#resume-button').click();assert.equal(await page.locator('#pause-button').getAttribute('data-icon'),'pause');
 await page.screenshot({path:'artifacts/fullscreen-svg-tools.png'});
 await page.locator('#fullscreen-button').click();assert.equal(await page.locator('#fullscreen-button').getAttribute('data-icon'),'expand');
 assert.deepEqual(errors,[]);await writeFile('artifacts/sky-hud-report.json',JSON.stringify({passed:true,sky,errors},null,2));console.log(JSON.stringify({passed:true,sky}));
}finally{await browser.close();}
