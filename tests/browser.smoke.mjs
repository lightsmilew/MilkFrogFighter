import {openSetup,launchMatch} from './ui-helpers.mjs';
// Optional browser QA: use PLAYWRIGHT_MODULE for a bundled Playwright module,
// or install Playwright locally. Set BROWSER_EXECUTABLE to use an existing browser.
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const base=process.env.TEST_URL||'http://localhost:4173/';
const errors=[];
const report=[];
const observe=page=>{
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
};
const state=page=>page.evaluate(async()=>{
  const {game}=await import('./src/app.js');
  return {phase:game.phase,mode:game.mode,stage:game.stageId,camera:game.camera,time:game.time,hp:game.fighters.map(f=>f.hp),x:game.fighters.map(f=>f.x),y:game.fighters.map(f=>f.y),vx:game.fighters.map(f=>f.vx),grounded:game.fighters.map(f=>f.grounded),blinkCharges:game.fighters[0].blinkCharges,grapples:game.grapples.length,airJumps:game.fighters[0].airJumps,jumpSince:game.fighters[0].jumpSince,jumps:window.__jumps||0,moves:game.fighters.map(f=>f.state),lastMoves:game.fighters.map(f=>f.lastMove?.move),attack:game.fighters[0].attack,energy:game.fighters.map(f=>f.energy),stats:game.matchStats};
});
async function waitState(page,predicate,timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){const current=await state(page);if(predicate(current))return current;await page.waitForTimeout(60);}
  throw new Error(`State wait timed out: ${JSON.stringify(await state(page))}`);
}
const assertSprint=async page=>{
  const result=await page.evaluate(async()=>{
    const {game}=await import('./src/app.js'),{Renderer}=await import('./src/renderer.js'),{ANIMATION_FRAMES}=await import('./assets/fighters/frames.js');
    const f=game.fighters[0];return {state:f.state,phase:f.runPhase,pose:Renderer.prototype.pose(f),cycle:ANIMATION_FRAMES.run};
  });
  assert.equal(result.state,'dash');assert.ok(result.phase!==0);assert.ok(result.cycle.includes(result.pose),JSON.stringify(result));
};
async function resetPractice(page){
  await page.locator('#practice-reset').click();
  await page.evaluate(async()=>{const {game}=await import('./src/app.js');const {WORLD}=await import('./src/config.js');game.fighters[0].x=500;game.fighters[1].x=500+WORLD.pushDistance+2;});
}
async function assertPauseFits(page,name){
  await page.locator('#pause-button').click();
  const fits=await page.evaluate(()=>{
    const screen=document.getElementById('game-screen').getBoundingClientRect();
    const items=[document.querySelector('#pause-overlay .overlay-card'),...document.querySelectorAll('#pause-overlay button')];
    return items.every(e=>{const r=e.getBoundingClientRect();return r.left>=screen.left&&r.right<=screen.right&&r.top>=screen.top&&r.bottom<=screen.bottom;});
  });
  assert.ok(fits,`${name} pause and every action must fit the game screen`);
  await page.screenshot({path:`artifacts/pause-${name}.png`});await page.locator('#resume-button').click();
}
await mkdir('artifacts',{recursive:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1050},deviceScaleFactor:1});
  const page=await context.newPage();observe(page);
  await page.goto(base);await page.locator('#start-button:enabled').waitFor();
  assert.equal(await page.title(),'奶蛙街头 · MILKFROG FIGHT CLUB');
  assert.equal(await page.locator('.fighter-card').count(),6);
  assert.equal(await page.locator('.fighter-info h3').allTextContents().then(x=>x.join(',')),'奶蛙,奶绿,奶红,奶紫,奶粉,奶蓝');
  assert.equal(await page.locator('[data-stage]').count(),2);assert.ok(await page.locator('.quick-guide').isVisible());
  assert.equal(await page.locator('#laugh-button').count(),0);assert.equal(await page.locator('#game-screen #pause-button, #game-screen #fullscreen-button').count(),0);
  assert.ok(await page.locator('#fullscreen-button').evaluate(e=>e.closest('.arcade-top')!==null));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'artifacts/lobby-desktop.png',fullPage:true});
  await openSetup(page);await page.locator('[data-stage="rain"]').click();assert.equal((await state(page)).stage,'rain');
  await page.locator('#game-screen').screenshot({path:'artifacts/rain-lobby.png'});
  await page.locator('#laugh-preview').click();
  const audio=await page.evaluate(async()=>{
    const {assetUrl}=await import('./src/asset-urls.js');
    const response=await fetch(assetUrl('audio/classic-laugh.mp3'));
    const context=new AudioContext();const clip=await context.decodeAudioData(await response.arrayBuffer());
    const result={duration:clip.duration,channels:clip.numberOfChannels,samples:clip.length};await context.close();return result;
  });
  assert.ok(audio.duration>2);report.push({check:'classic laugh decodes',...audio});
  await openSetup(page);await page.locator('[data-player="1"]').click();await openSetup(page);await page.locator('[data-character="purple"]').click();
  await openSetup(page);await page.locator('[data-player="0"]').click();await openSetup(page);await page.locator('[data-mode="practice"]').click();
  await launchMatch(page);
  assert.equal((await state(page)).phase,'fight');
  await page.keyboard.down('KeyD');await page.waitForTimeout(1550);await page.keyboard.up('KeyD');
  assert.ok((await state(page)).x[0]>700);
  await page.keyboard.press('KeyJ');
  await waitState(page,snapshot=>snapshot.stats[0].hits>0);
  await page.keyboard.press('KeyK');await page.waitForTimeout(210);
  await page.keyboard.press('KeyL');await page.waitForTimeout(320);
  report.push({check:'keyboard combat',...await state(page)});
  await page.keyboard.press('Escape');assert.ok(await page.locator('#pause-overlay').isVisible());
  const before=(await state(page)).time;await page.waitForTimeout(200);assert.equal((await state(page)).time,before);
  await page.locator('#resume-button').click();
  await page.locator('#help-button').click();assert.ok(await page.locator('#help-dialog').isVisible());
  await page.locator('#help-dialog [data-close]').click();assert.ok(!await page.locator('#pause-overlay').isVisible());
  await waitState(page,snapshot=>snapshot.moves[0]==='idle'&&!snapshot.attack);
  await page.keyboard.press('KeyH');await page.waitForTimeout(120);assert.equal((await state(page)).moves[0],'taunt');
  await page.screenshot({path:'artifacts/taunt-desktop.png'});
  await page.waitForTimeout(1850);
  await page.keyboard.press('KeyI');await page.waitForTimeout(440);
  await page.locator('#game-screen').screenshot({path:'artifacts/super-desktop.png'});
  await page.waitForTimeout(900);
  // Exercise the expanded command set through keyboard input, not direct calls.
  const advanced=[];
  for(const [held,key,move] of [['KeyS','KeyJ','grab'],['KeyS','KeyK','sweep'],['KeyS','KeyL','pulse'],['KeyW','KeyJ','uppercut'],[null,'KeyO','grab'],['KeyD','KeyI','superRush'],['KeyS','KeyI','superRise'],['KeyA','KeyI','superStorm']]){
    await resetPractice(page);
    if(held)await page.keyboard.down(held);
    await page.keyboard.press(key);
    const snapshot=await waitState(page,s=>s.lastMoves[0]===move);
    advanced.push(move);
    if(move==='sweep')await page.locator('#game-screen').screenshot({path:'artifacts/crouch-sweep.png'});
    if(held)await page.keyboard.up(held);
    if(move==='superRise')assert.ok(snapshot.y[0]<610);
  }
  await resetPractice(page);
  await page.keyboard.press('KeyD');await page.waitForTimeout(65);await page.keyboard.down('KeyD');
  await waitState(page,s=>s.moves[0]==='dash'&&s.vx[0]>600);await assertSprint(page);await page.keyboard.up('KeyD');
  await resetPractice(page);
  await page.keyboard.press('KeyW');await page.waitForTimeout(360);
  assert.ok((await state(page)).y[0]<400);
  await page.keyboard.press('KeyK');await waitState(page,s=>s.lastMoves[0]==='diveKick');
  report.push({check:'advanced keyboard commands, dash and high jump',moves:advanced});
  // Inspect the real decoded atlas, including the laughing cell's stray foot.
  const atlas=await page.evaluate(async()=>{
    const {Renderer}=await import('./src/renderer.js');
    const renderer=new Renderer(document.createElement('canvas'));await renderer.ready;
    const frames=renderer.frames,laugh=frames[11];
    const ctx=laugh.canvas.getContext('2d');
    let leftPixels=0;const pixels=ctx.getImageData(0,0,laugh.canvas.width,laugh.canvas.height);
    for(let y=0;y<pixels.height;y++)for(let x=0;x<laugh.bounds.left-2;x++)if(pixels.data[(y*pixels.width+x)*4+3]>48)leftPixels++;
    const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=Math.ceil(frames.length/6)*180;
    const draw=canvas.getContext('2d');draw.fillStyle='#ebe6d5';draw.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<frames.length;i++){
      const f=frames[i],x=i%6*240,y=Math.floor(i/6)*180;
      draw.drawImage(f.canvas,x+30,y+5,170,170);draw.fillStyle='#263d34';draw.font='13px monospace';draw.fillText(`FRAME ${i}`,x+10,y+19);
    }
    const tags=[],original=draw.fillText.bind(draw);draw.fillText=(label,...args)=>{tags.push(label);original(label,...args);};
    const {game}=await import('./src/app.js');const {WORLD}=await import('./src/config.js');
    for(const mode of ['ai','local','practice'])renderer.drawPlayerTag(draw,game.fighters[1],{mode,camera:{scale:1}});
    renderer.drawPlayerTag(draw,game.fighters[0],{mode:'ai',camera:{scale:1}});
    const rainCanvas=document.createElement('canvas');rainCanvas.width=1280;rainCanvas.height=720;const rain=rainCanvas.getContext('2d');
    renderer.drawWeather(rain,{stageId:'rain',phase:'attract',time:0});const first=rainCanvas.toDataURL();rain.clearRect(0,0,1280,720);
    renderer.drawWeather(rain,{stageId:'rain',phase:'attract',time:.3});const second=rainCanvas.toDataURL();
    const badgeCanvas=document.createElement('canvas');badgeCanvas.width=130;badgeCanvas.height=60;const badge=badgeCanvas.getContext('2d');
    renderer.drawPlayerTag(badge,{index:0,x:65,y:WORLD.standHeight+45,crouching:false,downTime:0,slow:0,charm:0},{mode:'ai',camera:{scale:1}});
    return {count:frames.length,leftPixels,bounds:laugh.bounds,tags,badgeCornerAlpha:badge.getImageData(30,4,1,1).data[3],rainMoves:first!==second,preview:canvas.toDataURL('image/png').split(',')[1]};
  });
  assert.equal(atlas.count,48);assert.equal(atlas.leftPixels,0);
  assert.deepEqual(atlas.tags,['P2 · 电脑','P2 · 玩家','P2 · 木桩','P1 · 玩家']);assert.ok(atlas.rainMoves);assert.equal(atlas.badgeCornerAlpha,0);
  await writeFile('artifacts/isolated-frames.png',Buffer.from(atlas.preview,'base64'));
  report.push({check:'48 unique packed animation frames per fighter; laugh has no detached foot',bounds:atlas.bounds});
  await resetPractice(page);
  await page.keyboard.press('KeyO');await waitState(page,s=>s.grapples===1);await page.waitForTimeout(230);
  await page.locator('#game-screen').screenshot({path:'artifacts/throw-arc.png'});
  await waitState(page,s=>s.grapples===0&&s.x[1]<s.x[0]);await page.locator('#game-screen').screenshot({path:'artifacts/throw-landing.png'});
  report.push({check:'throw catch, arc, opposite-side landing and recovery'});
  await resetPractice(page);
  await page.evaluate(async()=>{const {game}=await import('./src/app.js');window.__jumps=0;const previous=game.onEvent;game.onEvent=e=>{previous(e);if(e.type==='jump'&&e.index===0)window.__jumps++;};});
  await page.keyboard.down('KeyW');await page.waitForTimeout(2300);assert.ok((await state(page)).jumps>=2);
  await waitState(page,s=>!s.grounded[0]&&s.jumpSince>.15&&s.jumpSince<.4&&s.airJumps===1);await page.keyboard.up('KeyW');await page.waitForTimeout(40);
  await page.keyboard.press('KeyW');await waitState(page,s=>s.airJumps===0);
  await resetPractice(page);
  await page.evaluate(async()=>{const {game}=await import('./src/app.js');game.fighters[0].x=2800;game.fighters[1].x=3100;});
  await waitState(page,s=>s.camera.x>1900);await page.locator('#game-screen').screenshot({path:'artifacts/rain-wide-stage.png'});
  await page.evaluate(async()=>{const {game}=await import('./src/app.js');const [a,b]=game.fighters;a.x=2500;a.y=-210;a.platformId='sky-terrace';b.x=2300;b.y=-10;b.platformId='high-walkway';});
  await waitState(page,s=>s.camera.y< -300);await page.locator('#game-screen').screenshot({path:'artifacts/rooftop-platforms.png'});
  report.push({check:'rain animation, overhead player roles, camera pan, held keyboard jumps and double jump'});
  await resetPractice(page);
  await page.locator('#fullscreen-button').click();
  assert.ok(await page.evaluate(()=>Boolean(document.fullscreenElement)));
  await page.locator('#fullscreen-button').click();
  for(const failure of ['missing','rejected']){
    await page.evaluate(failure=>{const element=document.getElementById('arcade');element.requestFullscreen=failure==='missing'?undefined:()=>Promise.reject(new Error('Not allowed'));element.webkitRequestFullscreen=undefined;},failure);
    await page.locator('#fullscreen-button').click();assert.ok(await page.locator('#arcade.is-immersive').isVisible());
    assert.ok(await page.evaluate(()=>{const r=document.getElementById('arcade').getBoundingClientRect();return Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2;}));
    await page.locator('#fullscreen-button').click();assert.equal(await page.locator('#arcade.is-immersive').count(),0);
  }
  await page.evaluate(()=>{delete document.getElementById('arcade').requestFullscreen;delete document.getElementById('arcade').webkitRequestFullscreen;});
  report.push({check:'native fullscreen and absent/rejected-API immersive fallback'});
  await page.locator('#pause-overlay').waitFor({state:'visible'});await page.locator('#lobby-button').click();

  await openSetup(page);await page.locator('[data-mode="local"]').click();await launchMatch(page);
  await waitState(page,snapshot=>snapshot.phase==='fight');
  await page.keyboard.down('KeyD');await page.keyboard.down('ArrowLeft');await page.waitForTimeout(1100);await page.keyboard.up('KeyD');await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('Digit1');
  await waitState(page,snapshot=>snapshot.stats[1].hits>0);
  report.push({check:'local P2 combat',...await state(page)});
  await page.locator('#game-screen').screenshot({path:'artifacts/local-desktop.png'});
  // Exercise the real round/results UI without waiting through two full fights.
  await page.evaluate(async()=>{const {game}=await import('./src/app.js');game.wins[0]=1;game.fighters[1].hp=0;});
  await page.locator('#result-overlay').waitFor({state:'visible'});
  assert.ok((await page.locator('#result-title').textContent()).includes('P1'));
  await page.locator('#result-lobby-button').click();
  await page.locator('#settings-button').click();
  assert.equal(await page.locator('#scanlines').count(),0);await page.locator('#volume').fill('67');await page.locator('#music').uncheck();
  await page.locator('#settings-dialog [data-close]').click();
  await page.reload();await page.locator('#start-button:enabled').waitFor();
  assert.equal((await state(page)).stage,'rain');
  await page.locator('#settings-button').click();assert.equal(await page.locator('#music').isChecked(),false);
  assert.equal(await page.locator('#volume').inputValue(),'67');await page.locator('#settings-dialog [data-close]').click();

  const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const mobile=await mobileContext.newPage();observe(mobile);await mobile.goto(base);await mobile.locator('#start-button:enabled').waitFor();
  assert.ok(await mobile.locator('#touch-controls').isHidden());
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.screenshot({path:'artifacts/lobby-mobile.png',fullPage:true});
  await openSetup(mobile);await mobile.locator('[data-stage="rain"]').tap();
  await openSetup(mobile);await mobile.locator('[data-mode="practice"]').click();await launchMatch(mobile);
  const stick=await mobile.locator('#joystick').boundingBox();
  const center={x:stick.x+stick.width/2,y:stick.y+stick.height/2};
  await mobile.mouse.move(center.x,center.y);await mobile.mouse.down();await mobile.mouse.move(center.x+stick.width*.36,center.y);await mobile.waitForTimeout(750);await mobile.mouse.up();
  assert.ok((await state(mobile)).x[0]>500);
  await mobile.mouse.move(center.x,center.y);await mobile.mouse.down();await mobile.mouse.move(center.x,center.y-stick.height*.36);await mobile.waitForTimeout(90);
  assert.equal((await state(mobile)).moves[0],'jump');await mobile.mouse.up();
  await waitState(mobile,s=>s.grounded[0]);
  assert.equal(await mobile.locator('#joystick').evaluate(element=>element.style.getPropertyValue('--stick-x')),'0px');
  // Real two-finger touch: keep the stick dragged while tapping an attack.
  const cdp=await mobileContext.newCDPSession(mobile);
  const jab=await mobile.locator('[data-action="jab"]').boundingBox();
  const finger1={id:1,x:center.x,y:center.y,radiusX:5,radiusY:5};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger1]});
  finger1.x+=stick.width*.35;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger1]});
  await mobile.waitForTimeout(100);
  await assertSprint(mobile);
  const finger2={id:2,x:jab.x+jab.width/2,y:jab.y+jab.height/2,radiusX:5,radiusY:5};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger1,finger2]});
  await mobile.waitForTimeout(90);assert.equal((await state(mobile)).moves[0],'jab');
  assert.ok(await mobile.locator('#joystick').evaluate(element=>element.classList.contains('active')));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.waitForTimeout(500);
  assert.equal(await mobile.locator('.is-held').count(),0);
  await mobile.locator('[data-action="special"]').tap();
  await mobile.waitForTimeout(300);
  await mobile.screenshot({path:'artifacts/fight-mobile.png',fullPage:true});
  report.push({check:'mobile pointer controls',...await state(mobile)});
  await assertPauseFits(mobile,'portrait-390');
  for(const [direction,move] of [['up','uppercut'],['down','grab']]){
    await resetPractice(mobile);
    const stick=await mobile.locator('#joystick').boundingBox(),punch=await mobile.locator('[data-action="jab"]').boundingBox();
    const directionFinger={id:11,x:stick.x+stick.width/2,y:stick.y+stick.height*(direction==='up'?.15:.85),radiusX:5,radiusY:5};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[directionFinger]});await mobile.waitForTimeout(30);
    const punchFinger={id:12,x:punch.x+punch.width/2,y:punch.y+punch.height/2,radiusX:5,radiusY:5};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[directionFinger,punchFinger]});
    await waitState(mobile,s=>s.lastMoves[0]===move);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  assert.equal(await mobile.locator('.touch-controls button').count(),6);
  assert.equal(await mobile.locator('[data-action="uppercut"],[data-action="grab"]').count(),0);
  await resetPractice(mobile);
  await mobile.evaluate(async()=>{const {game}=await import('./src/app.js');window.__jumps=0;const previous=game.onEvent;game.onEvent=e=>{previous(e);if(e.type==='jump'&&e.index===0)window.__jumps++;};});
  const jumpStick=await mobile.locator('#joystick').boundingBox();
  const upFinger={id:7,x:jumpStick.x+jumpStick.width/2,y:jumpStick.y+jumpStick.height*.15,radiusX:5,radiusY:5};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[upFinger]});await mobile.waitForTimeout(2300);
  assert.ok((await state(mobile)).jumps>=2);
  await waitState(mobile,s=>!s.grounded[0]&&s.jumpSince>.15&&s.jumpSince<.4&&s.airJumps===1);
  upFinger.y=jumpStick.y+jumpStick.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[upFinger]});
  await mobile.waitForTimeout(40);
  upFinger.y=jumpStick.y+jumpStick.height*.15;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[upFinger]});
  await waitState(mobile,s=>s.airJumps===0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await resetPractice(mobile);await mobile.locator('[data-action="blink"]').tap();await waitState(mobile,s=>s.moves[0]==='blink');
  await mobile.waitForTimeout(200);assert.equal((await state(mobile)).blinkCharges,1);
  await mobile.locator('[data-action="blink"]').tap();await waitState(mobile,s=>s.blinkCharges===0);
  report.push({check:'real held-up joystick repeats, release/re-push double jumps, touch blink'});
  await resetPractice(mobile);
  const superButton=await mobile.locator('[data-action="super"]').boundingBox();
  const currentStick=await mobile.locator('#joystick').boundingBox();
  const downFinger={id:3,x:currentStick.x+currentStick.width/2,y:currentStick.y+currentStick.height*.84,radiusX:5,radiusY:5};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[downFinger]});
  await mobile.waitForTimeout(70);
  const superFinger={id:4,x:superButton.x+superButton.width/2,y:superButton.y+superButton.height/2,radiusX:5,radiusY:5};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[downFinger,superFinger]});
  await waitState(mobile,s=>s.lastMoves[0]==='superRise');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  report.push({check:'mobile uppercut, throw and two-finger directional super'});
  await resetPractice(mobile);
  await mobile.setViewportSize({width:844,height:390});
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await waitState(mobile,snapshot=>!snapshot.attack&&snapshot.moves[0]==='idle');
  const landscapeStick=await mobile.locator('#joystick').boundingBox(),landscapeStart=(await state(mobile)).x[0];
  await mobile.mouse.move(landscapeStick.x+landscapeStick.width/2,landscapeStick.y+landscapeStick.height/2);await mobile.mouse.down();
  await mobile.mouse.move(landscapeStick.x+landscapeStick.width*.85,landscapeStick.y+landscapeStick.height/2);await mobile.waitForTimeout(300);await mobile.mouse.up();
  assert.ok((await state(mobile)).x[0]>landscapeStart+15);
  await mobile.screenshot({path:'artifacts/fight-mobile-landscape.png',fullPage:true});
  const bounds=await mobile.evaluate(()=>{
    const buttons=[...document.querySelectorAll('.touch-controls button')].map(e=>e.getBoundingClientRect());
    const tools=[...document.querySelectorAll('.toolbar-controls button')].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect());
    return {inside:buttons.every(b=>b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&b.width>=44&&b.height>=44),overlap:buttons.some(a=>tools.some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top))};
  });
  assert.ok(bounds.inside);assert.equal(bounds.overlap,false);
  await assertPauseFits(mobile,'landscape-844');
  await mobile.evaluate(()=>{document.getElementById('arcade').requestFullscreen=undefined;document.getElementById('arcade').webkitRequestFullscreen=undefined;});
  await mobile.locator('#fullscreen-button').tap();assert.ok(await mobile.locator('#arcade.is-immersive').isVisible());
  await mobile.screenshot({path:'artifacts/mobile-immersive.png'});await assertPauseFits(mobile,'immersive-844');await mobile.locator('#fullscreen-button').tap();
  await mobile.locator('#pause-overlay').waitFor({state:'visible'});await mobile.locator('#resume-button').click();
  await mobile.setViewportSize({width:320,height:568});await assertPauseFits(mobile,'portrait-320');
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  report.push({check:'top toolbar, transparent tags, two touch flashes and bounded mobile pause at 320/390/844 plus immersive'});
  await mobileContext.close();await context.close();
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/browser-report.json',JSON.stringify({passed:true,report,errors},null,2));
  console.log(JSON.stringify({passed:true,checks:report,errors},null,2));
}finally{await browser.close();}
