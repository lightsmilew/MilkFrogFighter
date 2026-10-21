import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import jsQR from 'jsqr';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.MOBILE_ENGINE==='webkit'?'webkit':'chromium';
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const base=process.env.TEST_URL||'http://localhost:4173/',errors=[],checks=[];
await mkdir('artifacts',{recursive:true});
try{
  for(const [index,viewport] of [{width:1440,height:1000},{width:320,height:568},{width:390,height:844},{width:844,height:390}].entries()){
    const context=await browser.newContext({viewport,hasTouch:index>0,isMobile:index>0});
    await context.addInitScript(()=>{
      window.__shareCalls=[];
      Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shareCalls.push({url:data.url,active:navigator.userActivation?.isActive,files:data.files?.map(f=>({name:f.name,type:f.type,size:f.size}))});}});
      Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>Boolean(data.files?.length)});
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.goto(base);await page.locator('#start-button:enabled').waitFor();
    const initial=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));
    assert.ok(!initial.some(url=>/share-card\.[a-f0-9]{12}\.js/.test(url)),'QR encoder must not delay startup');
    await page.locator('#share-button').click();await page.waitForFunction(()=>document.getElementById('share-card-image').naturalWidth===720);
    assert.equal(await page.locator('#share-link').inputValue(),'https://lightsmilew.github.io/MilkFrogFighter/');
    assert.equal(await page.evaluate(()=>window.__copied),undefined,'opening share must not silently copy');
    const fit=await page.evaluate(()=>{
      const dialog=document.getElementById('share-dialog'),r=dialog.getBoundingClientRect();
      return {dialog:{x:r.x,y:r.y,width:r.width,height:r.height},inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
        actions:[...dialog.querySelectorAll('.share-actions button,.share-actions a')].filter(e=>!e.hidden).map(e=>{const b=e.getBoundingClientRect();return {text:e.textContent,width:b.width,height:b.height,visible:b.top>=r.top&&b.bottom<=r.bottom};})};
    });
    assert.ok(fit.inside,JSON.stringify(fit));assert.ok(fit.actions.every(a=>a.height>=44&&a.visible),JSON.stringify(fit));
    await page.screenshot({path:`artifacts/share-${engine}-${viewport.width}.png`});
    if(index===0){
      const poster=await page.locator('#share-card-image').evaluate(image=>{
        const c=document.createElement('canvas');c.width=720;c.height=1000;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
        return {png:c.toDataURL('image/png').split(',')[1],rgba:Array.from(ctx.getImageData(136,316,448,448).data)};
      });
      assert.equal(jsQR(Uint8ClampedArray.from(poster.rgba),448,448)?.data,'https://lightsmilew.github.io/MilkFrogFighter/');
      await writeFile(`artifacts/share-card-${engine}.png`,Buffer.from(poster.png,'base64'));
      if(engine==='chromium'){
        const downloaded=page.waitForEvent('download');await page.locator('#save-share-image').click();const download=await downloaded;
        assert.equal(download.suggestedFilename(),'奶蛙街头-约战.png');await download.saveAs('artifacts/shared-invitation.png');
      }
    }
    await page.locator('#native-share-link').click();await page.locator('#native-share-image').click();
    const calls=await page.evaluate(()=>window.__shareCalls);assert.equal(calls.length,2);assert.ok(calls.every(c=>c.active===true));assert.equal(calls[1].files[0].type,'image/png');assert.ok(calls[1].files[0].size>5000);
    await page.locator('#copy-share-link').click();assert.equal(await page.evaluate(()=>window.__copied),'https://lightsmilew.github.io/MilkFrogFighter/');
    await page.locator('#share-dialog [data-close]').click();
    await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});});
    await page.locator('#share-button').click();assert.ok(await page.locator('#native-share-link').isHidden());assert.ok(await page.locator('#share-card-image').isVisible());assert.ok(await page.locator('#save-share-image').getAttribute('href'));
    await page.locator('#share-dialog [data-close]').click();checks.push({viewport,fit,nativeGesture:true,qrImage:true});
    if(index===0){
      const visual=await page.evaluate(async()=>{
        const {Renderer}=await import('./src/renderer.js'),{Game}=await import('./src/engine.js'),{CHARACTERS,WORLD}=await import('./src/config.js');
        const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
        const renderer=new Renderer(canvas);await renderer.ready;
        await Promise.all(CHARACTERS.map(c=>renderer.ensureFighter(c.id)));await renderer.ensureStage('street');
        const {ANIMATION_FRAMES}=await import('./assets/fighters/frames.js');
        const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1350;const ctx=sheet.getContext('2d');
        const gait=document.createElement('canvas');gait.width=8*180;gait.height=6*200;const walkCtx=gait.getContext('2d');walkCtx.fillStyle='#eee9d8';walkCtx.fillRect(0,0,gait.width,gait.height);
        const runSheet=document.createElement('canvas');runSheet.width=6*200;runSheet.height=6*200;const runCtx=runSheet.getContext('2d');runCtx.fillStyle='#eee9d8';runCtx.fillRect(0,0,runSheet.width,runSheet.height);
        const gaitChecks=[];
        for(const [i,c] of CHARACTERS.entries()){
          const g=new Game({random:()=>.5});g.start({mode:'local',p1:c.id});g.phase='fight';g.platforms=[];g.fighters[0].x=1700;g.fighters[1].x=2100;g.fighters[0].energy=100;
          g.beginAttack(g.fighters[0],'superStorm');for(let n=0;n<43;n++)g.tick(1/60);renderer.render(g);
          const x=i%2*800,y=Math.floor(i/2)*450;ctx.drawImage(canvas,x,y+30,800,420);ctx.fillStyle='#263d34';ctx.font='bold 20px sans-serif';ctx.fillText(`${c.name} · ${g.fighters[0].lastMove.name}`,x+18,y+22);
          const f={...g.fighters[0],attack:null,state:'walk',controlTime:0,reaction:null,grounded:true,afterimages:[],invincible:0};
          const samples=[];
          for(let n=0;n<8;n++){
            f.x=n*180+90;f.y=i*200+180;f.walkPhase=(n+.01)/8;renderer.drawFighter(walkCtx,f,0);
            const tile=walkCtx.getImageData(n*180,i*200,180,200).data;let signature=0;for(let k=0;k<tile.length;k+=19)signature=(signature*31+tile[k])>>>0;samples.push(signature);
          }
          const runs=[];f.state='dash';
          for(let n=0;n<6;n++){
            f.x=n*200+100;f.y=i*200+180;f.runPhase=(n+.01)/6;renderer.drawFighter(runCtx,f,0);
            const tile=runCtx.getImageData(n*200,i*200,200,200).data;let signature=0;for(let k=0;k<tile.length;k+=19)signature=(signature*31+tile[k])>>>0;runs.push(signature);
          }
          gaitChecks.push({id:c.id,frames:ANIMATION_FRAMES.walk.length,distinct:new Set(samples).size,runFrames:ANIMATION_FRAMES.run.length,distinctRuns:new Set(runs).size});
        }
        return {effects:sheet.toDataURL('image/png').split(',')[1],gait:gait.toDataURL('image/png').split(',')[1],runs:runSheet.toDataURL('image/png').split(',')[1],gaitChecks};
      });
      assert.ok(visual.gaitChecks.every(c=>c.frames===8&&c.distinct===8&&c.runFrames===6&&c.distinctRuns===6));
      await writeFile(`artifacts/storms-${engine}.png`,Buffer.from(visual.effects,'base64'));await writeFile(`artifacts/walk-cycles-${engine}.png`,Buffer.from(visual.gait,'base64'));
      await writeFile(`artifacts/run-cycles-${engine}.png`,Buffer.from(visual.runs,'base64'));
      checks.push({gait:visual.gaitChecks});
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);await writeFile(`artifacts/tactics-share-${engine}.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,engine,viewports:4,qrDecode:true,gestureShares:true,gaits:6,errors}));
}finally{await browser.close();}
