import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.MOBILE_ENGINE==='webkit'?'webkit':'chromium';
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const base=process.env.TEST_URL||'http://localhost:4173/';
await mkdir('artifacts',{recursive:true});
const errors=[],report=[];
const viewports=[{width:320,height:568},{width:390,height:844},{width:667,height:375},{width:844,height:390},{width:932,height:430},{width:1920,height:864}];
const bounds=async page=>page.evaluate(async()=>{
  const {game}=await import('./src/app.js'),rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();
  const buttons=[...document.querySelectorAll('#touch-controls button')].map(e=>({action:e.dataset.action,...e.getBoundingClientRect().toJSON()}));
  const c=document.getElementById('game'),ctx=c.getContext('2d');
  const edgeColors=[2,c.width-3].map(x=>{const colors=new Set();for(let y=Math.floor(c.height*.2);y<c.height*.85;y+=5){colors.add([...ctx.getImageData(x,y,1,1).data].join(','));}return colors.size;});
  const stickStyle=getComputedStyle(document.getElementById('joystick'));
  return {arena:rect('game-screen'),cabinet:rect('arcade'),canvas:rect('game'),camera:{...game.camera},buttons,edgeColors,stickBackground:stickStyle.backgroundColor,stickImage:stickStyle.backgroundImage,difficultyVisible:!!document.querySelector('.difficulty-label').getClientRects().length,full:document.getElementById('arcade').classList.contains('is-expanded')};
});
const inside=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.width<=b.x+b.width+1&&a.y+a.height<=b.y+b.height+1;
const checkHud=async page=>{
 await page.evaluate(async()=>{
  const {game}=await import('./src/app.js');game.mode='local';game.phase='intro';game.phaseTime=0;
  Object.assign(game.fighters[0],{hp:732.4,trailHp:732.4,energy:45.5});Object.assign(game.fighters[1],{hp:280,trailHp:280,energy:90});
  window.__hudNumbers=[];const original=CanvasRenderingContext2D.prototype.fillText;
  window.__restoreHud=()=>{CanvasRenderingContext2D.prototype.fillText=original;};
  CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
   if(this.canvas.id==='game'&&(/^\d+ \/ (100|1000)$/.test(text)||text==='体力'||text==='奶气')&&window.__hudNumbers.length<12){const m=this.getTransform();window.__hudNumbers.push({text,x:m.a*x+m.e,y:m.d*y+m.f,font:this.font});}
   return original.call(this,text,x,y,...rest);
  };
 });
 await page.waitForTimeout(80);
 const numbers=await page.evaluate(()=>{window.__restoreHud();return window.__hudNumbers.slice(0,4);});
 assert.deepEqual(numbers.map(n=>n.text),['733 / 1000','45 / 100','280 / 1000','90 / 100']);
 assert.ok(numbers[1].y>numbers[0].y&&numbers[3].y>numbers[2].y,'both milk values must appear below health values');
 assert.ok(numbers[0].x===numbers[1].x&&numbers[2].x===numbers[3].x,'values share the bars center');return numbers;
};
const cardFits=async(page,id)=>{
  const result=await page.locator(id).evaluate(e=>{
    const card=e.querySelector('.overlay-card'),last=card.lastElementChild;
    return {card:card.getBoundingClientRect().toJSON(),arena:document.getElementById('game-screen').getBoundingClientRect().toJSON(),client:card.clientHeight,scroll:card.scrollHeight,last:last.getBoundingClientRect().toJSON()};
  });
  assert.ok(inside(result.card,result.arena),JSON.stringify(result));
  assert.ok(result.scroll<=result.client+1,`all dialog actions should fit without scrolling: ${JSON.stringify(result)}`);
  assert.ok(inside(result.last,result.card));return result;
};
try{
 for(const viewport of viewports){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{delete Element.prototype.requestFullscreen;delete Element.prototype.webkitRequestFullscreen;});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#start-button:enabled').waitFor();
  await page.locator('[data-mode="practice"]').click();await page.locator('#start-button').click();await page.waitForTimeout(200);
  const normal=await bounds(page);
  assert.equal(normal.buttons.length,6);
  assert.equal(normal.stickBackground,'rgba(0, 0, 0, 0)');assert.ok(normal.stickImage.includes('0.1')||normal.stickImage.includes('0.2'),'the joystick base must use translucent stops');
  assert.ok(normal.buttons.every(b=>inside(b,{x:0,y:0,...viewport})&&b.width>=44&&b.height>=44),JSON.stringify({viewport,normal}));
  // No pairs may overlap: the resting punch must remain easy to find.
  for(const a of normal.buttons)for(const b of normal.buttons)if(a!==b)assert.ok(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,`overlapping ${a.action}/${b.action}: ${JSON.stringify({viewport,a,b})}`);
  await page.evaluate(async()=>{const {game}=await import('./src/app.js');game.phase='intro';game.phaseTime=0;game.fighters[0].y=-400;});await page.waitForTimeout(100);
  const visible=await page.evaluate(async()=>{const {game}=await import('./src/app.js'),{WORLD}=await import('./src/config.js'),c=game.camera;return game.fighters.every(f=>(f.y-WORLD.standHeight-c.y)*c.scale>=c.safeTop-1&&(f.y-c.y)*c.scale<=c.viewportHeight-74);});
  assert.ok(visible,'ground and rooftop fighters must clear the taller resource HUD');
  await page.locator('#pause-button').tap();await cardFits(page,'#pause-overlay');await page.locator('#restart-button').tap();
  assert.equal(await page.locator('#pause-overlay').isVisible(),false);assert.equal(await page.locator('#pause-button').getAttribute('aria-label'),'暂停游戏');
  await page.locator('#fullscreen-button').tap();await page.waitForTimeout(650);
  const full=await bounds(page);
  assert.ok(full.full&&!full.difficultyVisible);
  assert.ok(inside(full.cabinet,{x:0,y:0,...viewport})&&Math.abs(full.arena.width-viewport.width)<1&&Math.abs(full.arena.height-viewport.height)<1,JSON.stringify({viewport,full}));
  assert.ok(Math.abs(full.camera.viewportWidth/full.camera.viewportHeight-viewport.width/viewport.height)<.005);
  assert.ok(full.edgeColors.every(n=>n>8),`both screen edges contain scenery, not bars: ${full.edgeColors}`);
  assert.ok(full.buttons.every(b=>inside(b,{x:0,y:0,...viewport})));
  const hud=await checkHud(page);
  await page.screenshot({path:`artifacts/fullbleed-${viewport.width}.png`});
  await page.locator('#pause-button').tap();await cardFits(page,'#pause-overlay');await page.locator('#resume-button').tap();
  await page.evaluate(async()=>{const {game}=await import('./src/app.js');game.wins=[2,1];game.phase='matchOver';game.emit('matchEnd',{winner:0});});
  const result=await cardFits(page,'#result-overlay');assert.equal(await page.locator('#touch-controls').isVisible(),false);
  await page.screenshot({path:`artifacts/result-fit-${viewport.width}.png`});
  await page.locator('#rematch-button').tap();assert.equal(await page.locator('#result-overlay').isVisible(),false);assert.equal(await page.locator('#touch-controls').isVisible(),true);
  await page.locator('#fullscreen-button').tap();
  // Also reproduce a result in the small non-fullscreen arena.
  await page.evaluate(async()=>{const {game}=await import('./src/app.js');game.wins=[1,2];game.phase='matchOver';game.emit('matchEnd',{winner:1});});
  await cardFits(page,'#result-overlay');await page.locator('#result-lobby-button').tap();assert.equal(await page.locator('#home-overlay').isVisible(),true);
  report.push({viewport,normal:normal.buttons,full:{arena:full.arena,camera:full.camera,edgeColors:full.edgeColors},hud,result});await context.close();
 }
 const desktop=await browser.newPage({viewport:{width:1440,height:1050}});desktop.on('pageerror',e=>errors.push(e.message));
 await desktop.goto(base);await desktop.locator('#start-button:enabled').waitFor();await desktop.locator('[data-mode="practice"]').click();await desktop.locator('#start-button').click();
 await checkHud(desktop);await desktop.locator('#game-screen').screenshot({path:'artifacts/hud-desktop.png'});await desktop.close();
 const standalone=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 await standalone.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{value:true});delete Element.prototype.requestFullscreen;});
 const app=await standalone.newPage();app.on('pageerror',e=>errors.push(e.message));await app.goto(base);await app.locator('#start-button:enabled').waitFor();await app.locator('#start-button').tap();
 await app.locator('#arcade.is-expanded').waitFor();assert.equal(await app.locator('#fullscreen-tip').isVisible(),false);await app.locator('#pause-button').tap();await app.locator('#lobby-button').tap();
 assert.equal(await app.locator('#arcade.is-expanded').count(),0);await standalone.close();
 assert.deepEqual(errors,[]);await writeFile(`artifacts/viewport-report-${engine}.json`,JSON.stringify({passed:true,report,errors},null,2));console.log(JSON.stringify({passed:true,engine,viewports:viewports.length,errors}));
}finally{await browser.close();}
