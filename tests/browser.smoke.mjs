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
  return {phase:game.phase,mode:game.mode,time:game.time,hp:game.fighters.map(f=>f.hp),x:game.fighters.map(f=>f.x),moves:game.fighters.map(f=>f.state),attack:game.fighters[0].attack,energy:game.fighters.map(f=>f.energy),stats:game.matchStats};
});
async function waitState(page,predicate,timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){const current=await state(page);if(predicate(current))return current;await page.waitForTimeout(60);}
  throw new Error(`State wait timed out: ${JSON.stringify(await state(page))}`);
}
await mkdir('artifacts',{recursive:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1050},deviceScaleFactor:1});
  const page=await context.newPage();observe(page);
  await page.goto(base);await page.locator('#start-button:enabled').waitFor();
  assert.equal(await page.title(),'奶蛙街头 · MILKFROG FIGHT CLUB');
  assert.equal(await page.locator('.fighter-card').count(),4);
  assert.equal(await page.locator('.fighter-info h3').allTextContents().then(x=>x.join(',')),'奶蛙,奶绿,奶红,奶紫');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'artifacts/lobby-desktop.png',fullPage:true});
  await page.locator('#laugh-preview').click();
  const audio=await page.evaluate(async()=>{
    const response=await fetch(new URL('./assets/audio/classic-laugh.mp3',location.href));
    const context=new AudioContext();const clip=await context.decodeAudioData(await response.arrayBuffer());
    const result={duration:clip.duration,channels:clip.numberOfChannels,samples:clip.length};await context.close();return result;
  });
  assert.ok(audio.duration>2);report.push({check:'classic laugh decodes',...audio});
  await page.locator('[data-player="1"]').click();await page.locator('[data-character="purple"]').click();
  await page.locator('[data-player="0"]').click();await page.locator('[data-mode="practice"]').click();
  await page.locator('#start-button').click();
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
  await page.locator('#fullscreen-button').click();
  assert.ok(await page.evaluate(()=>Boolean(document.fullscreenElement)));
  await page.locator('#fullscreen-button').click();
  await page.keyboard.press('Escape');await page.locator('#lobby-button').click();

  await page.locator('[data-mode="local"]').click();await page.locator('#start-button').click();
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
  await page.locator('#scanlines').check();await page.locator('#music').uncheck();
  await page.locator('#settings-dialog [data-close]').click();
  await page.reload();await page.locator('#start-button:enabled').waitFor();
  assert.ok(await page.locator('body').evaluate(body=>body.classList.contains('scanlines')));
  await page.locator('#settings-button').click();assert.equal(await page.locator('#music').isChecked(),false);
  await page.locator('#scanlines').uncheck();await page.locator('#settings-dialog [data-close]').click();

  const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const mobile=await mobileContext.newPage();observe(mobile);await mobile.goto(base);await mobile.locator('#start-button:enabled').waitFor();
  assert.ok(await mobile.locator('#touch-controls').isVisible());
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.screenshot({path:'artifacts/lobby-mobile.png',fullPage:true});
  await mobile.locator('[data-mode="practice"]').click();await mobile.locator('#start-button').click();
  const stick=await mobile.locator('#joystick').boundingBox();
  const center={x:stick.x+stick.width/2,y:stick.y+stick.height/2};
  await mobile.mouse.move(center.x,center.y);await mobile.mouse.down();await mobile.mouse.move(center.x+stick.width*.36,center.y);await mobile.waitForTimeout(750);await mobile.mouse.up();
  assert.ok((await state(mobile)).x[0]>500);
  await mobile.mouse.move(center.x,center.y);await mobile.mouse.down();await mobile.mouse.move(center.x,center.y-stick.height*.36);await mobile.waitForTimeout(90);
  assert.equal((await state(mobile)).moves[0],'jump');await mobile.mouse.up();
  await mobile.waitForTimeout(950);
  assert.equal(await mobile.locator('#joystick').evaluate(element=>element.style.getPropertyValue('--stick-x')),'0px');
  // Real two-finger touch: keep the stick dragged while tapping an attack.
  const cdp=await mobileContext.newCDPSession(mobile);
  const jab=await mobile.locator('[data-action="jab"]').boundingBox();
  const finger1={id:1,x:center.x,y:center.y,radiusX:5,radiusY:5};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger1]});
  finger1.x+=stick.width*.35;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger1]});
  await mobile.waitForTimeout(100);
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
  await mobile.locator('#pause-button').tap();assert.ok(await mobile.locator('#pause-overlay').isVisible());
  await mobile.locator('#resume-button').tap();
  await mobile.setViewportSize({width:844,height:390});
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await waitState(mobile,snapshot=>!snapshot.attack&&snapshot.moves[0]==='idle');
  const landscapeStick=await mobile.locator('#joystick').boundingBox(),landscapeStart=(await state(mobile)).x[0];
  await mobile.mouse.move(landscapeStick.x+landscapeStick.width/2,landscapeStick.y+landscapeStick.height/2);await mobile.mouse.down();
  await mobile.mouse.move(landscapeStick.x+landscapeStick.width*.85,landscapeStick.y+landscapeStick.height/2);await mobile.waitForTimeout(300);await mobile.mouse.up();
  assert.ok((await state(mobile)).x[0]>landscapeStart+15);
  await mobile.screenshot({path:'artifacts/fight-mobile-landscape.png',fullPage:true});
  await mobileContext.close();await context.close();
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/browser-report.json',JSON.stringify({passed:true,report,errors},null,2));
  console.log(JSON.stringify({passed:true,checks:report,errors},null,2));
}finally{await browser.close();}
