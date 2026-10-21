import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const base=process.env.TEST_URL||'http://localhost:4173/';
await mkdir('artifacts',{recursive:true});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#start-button:enabled').waitFor();
  assert.equal(await page.locator('.header-tool').count(),5);assert.equal(await page.locator('.header-tool svg').count(),5);
  await page.locator('#sound-button').click();assert.equal(await page.locator('#sound-button svg').count(),1);await page.locator('#sound-button').click();
  await page.locator('.site-header').screenshot({path:'artifacts/header-controls.png'});
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shared=data;}});});
  await page.locator('#share-button').click();assert.equal(await page.evaluate(()=>window.__shared.url),'https://lightsmilew.github.io/MilkFrogFighter/');
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copied=value;}}});
  });
  await page.locator('#share-button').click();assert.equal(await page.evaluate(()=>window.__copied),'https://lightsmilew.github.io/MilkFrogFighter/');
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Denied');}}});});
  await page.locator('#share-button').click();assert.ok(await page.locator('#share-dialog').isVisible());
  assert.equal(await page.locator('#share-link').inputValue(),'https://lightsmilew.github.io/MilkFrogFighter/');await page.locator('#copy-share-link').click();
  assert.ok((await page.locator('#share-status').textContent()).includes('已选中'));await page.locator('#share-dialog [data-close]').click();
  const poses=await page.evaluate(async()=>{
    const {Renderer}=await import('./src/renderer.js'),{Game}=await import('./src/engine.js'),{CHARACTERS}=await import('./src/config.js');
    const canvas=document.createElement('canvas');canvas.width=1140;canvas.height=430;const ctx=canvas.getContext('2d');
    const renderer=new Renderer(document.createElement('canvas'));await renderer.ready;await renderer.warmRoster();
    ctx.fillStyle='#eee8d8';ctx.fillRect(0,0,1140,430);const poses=[];
    for(const [i,character] of CHARACTERS.entries()){
      const game=new Game();game.start({mode:'local',p1:character.id});const fighter={...game.fighters[0],grounded:true};fighter.x=95+i*190;fighter.y=190;
      const pose=renderer.pose(fighter);renderer.drawFighter(ctx,fighter,0);poses.push(pose);
      fighter.y=410;renderer.drawFighter(ctx,fighter,0,{pose:20});ctx.fillStyle='#263d34';ctx.font='bold 16px sans-serif';ctx.fillText(character.name,70+i*190,24);
    }
    return {poses,png:canvas.toDataURL('image/png').split(',')[1]};
  });
  assert.deepEqual(poses.poses,[0,0,0,0,0,0]);await writeFile('artifacts/idle-and-roster-poses.png',Buffer.from(poses.png,'base64'));
  await page.locator('[data-character="purple"]').click();await page.locator('[data-mode="practice"]').click();await page.locator('#start-button').click();
  await page.waitForTimeout(500);await page.locator('#game-screen').screenshot({path:'artifacts/idle-fixed.png'});
  await page.close();
  const layouts=[];
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});const mobile=await context.newPage();mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto(base);await mobile.locator('#start-button:enabled').waitFor();
    const header=await mobile.locator('.header-tool').evaluateAll(buttons=>buttons.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,inside:r.left>=0&&r.right<=innerWidth};}));
    assert.ok(header.every(e=>e.width>=44&&e.height>=40&&e.inside));
    await mobile.screenshot({path:`artifacts/header-${viewport.width}.png`});
    await mobile.locator('[data-mode="practice"]').click();await mobile.locator('#start-button').click();await mobile.waitForTimeout(200);
    const layout=await mobile.locator('.touch-controls button').evaluateAll(buttons=>({
      count:buttons.length,inside:buttons.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&r.width>=44&&r.height>=44;}),
      sizes:buttons.map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height];}),overflow:document.documentElement.scrollWidth>innerWidth,
    }));
    assert.equal(layout.count,6);assert.ok(layout.inside,JSON.stringify({viewport,layout}));assert.equal(layout.overflow,false);layouts.push({viewport,...layout});
    await mobile.screenshot({path:`artifacts/six-button-${viewport.width}.png`});await context.close();
  }
  assert.deepEqual(errors,[]);const report={passed:true,share:['native','clipboard','manual'],idlePoses:poses.poses,layouts,errors};
  await writeFile('artifacts/controls-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
