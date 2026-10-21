import {openSetup,launchMatch} from './ui-helpers.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.MOBILE_ENGINE==='webkit'?'webkit':'chromium';
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const base=process.env.TEST_URL||'http://localhost:4173/',errors=[],checks=[];
await mkdir('artifacts',{recursive:true});
const prepare=async(page,distance=80)=>page.evaluate(async distance=>{
  const {game}=await import('./src/app.js');
  if(!window.__heldHook){const previous=game.onEvent;game.onEvent=e=>{previous(e);if(e.type==='attack'){window.__allAttacks.push({index:e.index,move:e.move});if(e.index===0)window.__attacks.push(e.move);}};window.__heldHook=true;}
  window.__attacks=[];window.__allAttacks=[];window.__combatGame=game;game.start({mode:'practice',p1:'classic',p2:'green'});game.platforms=[];game.fighters[0].x=1200;game.fighters[1].x=1200+distance;
},distance);
const snapshot=page=>page.evaluate(async()=>{const {game}=await import('./src/app.js');const a=game.fighters[0];return {x:a.x,vx:a.vx,y:a.y,move:a.attack?.move,last:a.lastMove?.move,attacks:window.__attacks.slice()};});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#start-button:enabled').waitFor();await openSetup(page);await page.locator('[data-mode="practice"]').click();await launchMatch(page);
 for(const key of ['KeyJ','KeyK','KeyL','KeyI']){
   await prepare(page,key==='KeyL'?400:80);await page.keyboard.down(key);await page.waitForTimeout(key==='KeyI'?2200:1900);const during=await snapshot(page);await page.keyboard.up(key);
   assert.equal(during.attacks.length,1,`${key} ${JSON.stringify(during)}`);
   await page.waitForTimeout(60);await page.keyboard.down(key);await page.waitForTimeout(180);await page.keyboard.down(key);await page.waitForTimeout(700);await page.keyboard.up(key);
   assert.equal((await snapshot(page)).attacks.length,2,'release and press starts exactly one new action; OS repeat adds none');checks.push({key,oneActionPerPress:true});
 }
 await prepare(page);await page.keyboard.down('KeyJ');await page.waitForFunction(()=>window.__combatGame.fighters[0].attack?.move==='jab'&&window.__combatGame.fighters[0].hasHit);
 await page.keyboard.down('KeyK');await page.waitForFunction(()=>window.__attacks.includes('branch'));await page.keyboard.up('KeyK');await page.keyboard.up('KeyJ');checks.push({heldPunchThenKickBranch:true});
 for(const [direction,attack,expected] of [['KeyD','KeyL','rushSkill'],['KeyA','KeyI','superStorm'],['KeyS','KeyK','sweep'],['KeyS','KeyJ','grab']]){
   await prepare(page,600);await page.keyboard.down(direction);await page.waitForTimeout(450);await page.keyboard.down(attack);await page.waitForTimeout(100);
   assert.ok((await snapshot(page)).attacks.includes(expected),expected);await page.keyboard.up(attack);await page.keyboard.up(direction);
 }
 await prepare(page,700);await page.keyboard.down('KeyW');await page.waitForTimeout(400);const before=await snapshot(page);await page.keyboard.down('KeyD');await page.waitForTimeout(300);const moving=await snapshot(page);assert.ok(moving.x>before.x+40);
 await page.keyboard.down('KeyK');await page.waitForTimeout(240);const airborne=await snapshot(page);assert.ok(airborne.x>moving.x+40);await page.keyboard.up('KeyK');await page.keyboard.up('KeyD');await page.keyboard.down('KeyA');await page.waitForTimeout(400);assert.ok((await snapshot(page)).vx<0);
 await page.keyboard.up('KeyA');await page.keyboard.up('KeyW');checks.push({keyboardJumpSteering:true,airAttackSteering:true});
 await prepare(page,700);await page.evaluate(()=>{const g=window.__combatGame;g.mode='local';});
 await page.keyboard.down('KeyQ');await page.keyboard.down('Enter');await page.waitForTimeout(120);
 assert.deepEqual(await page.evaluate(()=>window.__combatGame.fighters.map(f=>f.blocking)),[true,true]);assert.equal(await page.locator('#pause-overlay').isVisible(),false);
 await page.keyboard.up('KeyQ');await page.keyboard.up('Enter');await page.keyboard.press('KeyP');assert.equal(await page.locator('#pause-overlay').isVisible(),true);await page.keyboard.press('Enter');assert.equal(await page.locator('#pause-overlay').isVisible(),false);await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.__combatGame.fighters[1].blocking),false);checks.push({qAndEnterGuard:true,enterResumesWithoutLeakingGuard:true});
 for(const index of [0,1]){
   await prepare(page,600);await page.evaluate(async index=>{const g=window.__combatGame,{moveFor}=await import('./src/styles.js');g.mode='local';const victim=g.fighters[index],attacker=g.fighters[1-index];g.hit(attacker,victim,{...moveFor(attacker.character,'jab'),stun:.65,push:0},'jab',null,123);g.hitstop=0;},index);
   await page.keyboard.press(index?'Digit1':'KeyJ');await page.waitForTimeout(180);assert.equal(await page.evaluate(index=>window.__combatGame.fighters[index].attack,index),null);
   await page.waitForTimeout(650);assert.equal(await page.evaluate(index=>window.__allAttacks.filter(e=>e.index===index).length,index),1);checks.push({bufferedRetaliation:index});
 }
 await prepare(page,300);await page.keyboard.press('KeyI');await page.waitForTimeout(650);
 const victim=await page.evaluate(async()=>{const {game}=await import('./src/app.js');const b=game.fighters[1];return {type:b.reaction?.type,y:b.y,vy:b.vy};});assert.equal(victim.type,'body');assert.equal(victim.y,610);assert.equal(victim.vy,0);
 await page.screenshot({path:`artifacts/super-stagger-fixed-${engine}.png`});
 await page.close();

 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
   const context=await browser.newContext({viewport,hasTouch:true,isMobile:true});const mobile=await context.newPage();mobile.on('pageerror',e=>errors.push(e.message));
   await mobile.goto(base);await mobile.locator('#start-button:enabled').waitFor();await openSetup(mobile);await mobile.locator('[data-mode="practice"]').click();await launchMatch(mobile);await prepare(mobile,500);
   if(viewport.width===844&&engine==='chromium'){
     const cdp=await context.newCDPSession(mobile),stick=await mobile.locator('#joystick').boundingBox(),attack=await mobile.locator('[data-action="special"]').boundingBox();
     const f1={id:1,x:stick.x+stick.width/2,y:stick.y+stick.height*.85,radiusX:5,radiusY:5},f2={id:2,x:attack.x+attack.width/2,y:attack.y+attack.height/2,radiusX:5,radiusY:5};
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[f1]});await mobile.waitForTimeout(400);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[f1,f2]});await mobile.waitForTimeout(1500);
     const result=await snapshot(mobile);assert.deepEqual(result.attacks,['pulse']);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[f2]});await mobile.waitForTimeout(80);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[f1,f2]});await mobile.waitForTimeout(250);assert.deepEqual((await snapshot(mobile)).attacks,['pulse','pulse']);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await prepare(mobile,700);const start=await snapshot(mobile);f1.x=stick.x+stick.width/2;f1.y=stick.y+stick.height*.17;
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[f1]});await mobile.waitForTimeout(350);f1.x=stick.x+stick.width*.75;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[f1]});await mobile.waitForTimeout(450);
     assert.ok((await snapshot(mobile)).x>start.x+50);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});checks.push({touchHeldDirectionSkill:true,diagonalJumpSteering:true});
   }
   await prepare(mobile,400);
   await mobile.evaluate(async()=>{const {game}=await import('./src/app.js');game.phase='intro';game.phaseTime=-100;const a=game.fighters[0];a.blinkCharges=0;a.blinkRecharge=1.5;game.fighters[1].blinkCharges=1;game.fighters[1].blinkRecharge=2.4;});await mobile.waitForTimeout(100);
   const tracks=await mobile.locator('[data-blink-charge]').evaluateAll(nodes=>nodes.map(node=>Number(node.style.getPropertyValue('--charge'))));assert.ok(tracks[0]>.45&&tracks[0]<.55);assert.equal(tracks[1],0);
   const hud=await mobile.evaluate(async()=>{
     const {Renderer}=await import('./src/renderer.js'),{game}=await import('./src/app.js');const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const source=document.getElementById('game').getBoundingClientRect();canvas.getBoundingClientRect=()=>source;
     const renderer=new Renderer(canvas);await renderer.ready;const ctx=canvas.getContext('2d'),draw=ctx.fillText.bind(ctx),round=ctx.roundRect.bind(ctx),fill=ctx.fillRect.bind(ctx),labels=[],cooldowns=[],rects=[],texts=[];
     const scale=source.width/1280;
     ctx.roundRect=(x,y,w,h,r)=>{rects.push({x,y,w,h,color:ctx.fillStyle});round(x,y,w,h,r);};
     ctx.fillRect=(x,y,w,h)=>{rects.push({x,y,w,h,color:ctx.fillStyle});fill(x,y,w,h);};
     ctx.fillText=(label,x,y)=>{const font=parseFloat(ctx.font.match(/([\d.]+)px/)[1])*scale,textWidth=ctx.measureText(label).width,left=ctx.textAlign==='right'?x-textWidth:ctx.textAlign==='center'?x-textWidth/2:x;const text={label,x,y,left,right:left+textWidth,font};texts.push(text);if(['螺旋流','风影流'].includes(label))labels.push(text);if(/^\d\.\ds$/.test(label))cooldowns.push(text);draw(label,x,y);};renderer.drawHUD(ctx,game);
     const hp=rects.filter(r=>r.color==='#3f4032'),milk=rects.filter(r=>r.color==='#33564c'),rails=rects.filter(r=>r.color==='#18352c'&&r.w<200);
     const contains=(r,t)=>t.x>=r.x&&t.x<=r.x+r.w&&t.y>=r.y&&t.y<=r.y+r.h;
     return {labels,width:source.width,blinkLabels:document.querySelector('[data-blink-label]').textContent,hp:hp.map(r=>({...r,cssHeight:r.h*scale})),milk:milk.map(r=>({...r,cssHeight:r.h*scale})),rails:rails.map(r=>({...r,cssHeight:r.h*scale})),cooldowns,
       noStyleBoxes:labels.every(l=>rects.every(r=>!contains(r,l))),
       noCountsOrTicks:texts.every(t=>!/[✓✔]|[012]\/[12]/.test(t.label)),
       cooldownsFit:cooldowns.every((c,i)=>c.left>=hp[i].x&&c.right<=hp[i].x+hp[i].w&&rails.every(r=>!contains(r,c))),
       hudHeight:(Math.max(...cooldowns.map(c=>c.y+c.font/scale/2)))*scale};
   });
   assert.equal(hud.labels.length,2);assert.ok(hud.labels.every(l=>l.font>=9.4&&l.x>0&&l.x<1280));assert.equal(hud.blinkLabels,'1.5s');assert.ok(hud.noStyleBoxes,'style names have transparent backgrounds');assert.ok(hud.noCountsOrTicks);assert.ok(hud.cooldownsFit,'cooldowns stay beside the rails and within their health bar width');
   assert.equal(hud.rails.length,4);assert.deepEqual(hud.cooldowns.map(c=>c.label),['1.5s','2.4s']);assert.ok(hud.cooldowns.every(c=>c.font>=9.4));assert.ok(hud.rails.every((r,i)=>r.cssHeight<hud.milk[Math.floor(i/2)].cssHeight));assert.ok(hud.milk.every((m,i)=>m.cssHeight<hud.hp[i].cssHeight));
   assert.ok(hud.rails.every((r,i)=>Math.abs(r.y-hud.milk[Math.floor(i/2)].y-hud.milk[Math.floor(i/2)].h)<.01),'blink rails attach to the milk bar bottom');
   assert.ok(hud.rails.every((r,i)=>r.w*2<hud.hp[Math.floor(i/2)].w*.5),'each two-segment rail is less than half the health bar width');
   if(viewport.width<500){assert.ok(hud.hp.every(h=>h.cssHeight<=10.6));assert.ok(hud.milk.every(m=>m.cssHeight<=6.1));assert.ok(hud.hudHeight<46,'compact HUD must leave room for the fight');}
   await mobile.screenshot({path:`artifacts/held-hud-${engine}-${viewport.width}.png`});checks.push({viewport,hud,tracks});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`artifacts/held-input-${engine}.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,engine,checks:checks.length,errors}));
}finally{await browser.close();}
