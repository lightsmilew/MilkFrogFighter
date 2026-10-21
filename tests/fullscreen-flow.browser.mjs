import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.MOBILE_ENGINE==='webkit'?'webkit':'chromium';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[],checks=[];await mkdir('artifacts',{recursive:true});
const buttonFits=async page=>{
 const placement=await page.locator('#fullscreen-button').evaluate(button=>{
  const r=button.getBoundingClientRect(),a=document.getElementById('game-screen').getBoundingClientRect(),back=document.getElementById('home-button'),b=back.getBoundingClientRect();
  return {visible:r.width>=44&&r.height>=44,inside:r.left>=a.left&&r.right<=a.right&&r.top>=a.top&&r.bottom<=a.bottom,right:a.right-r.right,top:r.top-a.top,clickable:button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),overlapBack:back.getClientRects().length&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top};
 });
 assert.ok(placement.visible&&placement.inside&&placement.clickable&&!placement.overlapBack,JSON.stringify(placement));assert.ok(placement.right<25&&placement.top<25,JSON.stringify(placement));return placement;
};
const paused=async page=>{
 await page.locator('#pause-overlay').waitFor({state:'visible'});assert.equal(await page.locator('#pause-button').getAttribute('data-icon'),'play');
 const time=await page.evaluate(async()=>(await import('./src/app.js')).game.time);await page.waitForTimeout(220);assert.equal(await page.evaluate(async()=>(await import('./src/app.js')).game.time),time);
};
try{
 for(const [index,viewport] of [{width:1440,height:1000},{width:320,height:568},{width:390,height:844},{width:844,height:390}].entries()){
  const page=await browser.newPage({viewport,isMobile:index>0,hasTouch:index>0});page.on('pageerror',e=>errors.push(e.message));
  if(index>0||engine==='webkit')await page.addInitScript(()=>{delete Element.prototype.requestFullscreen;delete Element.prototype.webkitRequestFullscreen;});
  await page.goto(process.env.TEST_URL||'http://localhost:4173/');await page.locator('#start-button:enabled').waitFor();const home=await buttonFits(page);
  await page.locator('#arcade').screenshot({path:`artifacts/fullscreen-home-button-${engine}-${viewport.width}.png`});
  await page.locator('#fullscreen-button').click();await page.locator('#arcade.is-expanded').waitFor();await buttonFits(page);assert.ok(await page.locator('#pause-overlay').isHidden());
  await page.locator('#start-button').click();assert.ok(await page.locator('#setup-panel').isVisible());assert.ok(await page.locator('#arcade.is-expanded').isVisible());const setup=await buttonFits(page);
  assert.ok(await page.locator('[data-stage="rain"]').isVisible());await page.locator('[data-stage="rain"]').click();await page.locator('[data-mode="practice"]').click();
  await page.locator('#arcade').screenshot({path:`artifacts/fullscreen-setup-${engine}-${viewport.width}.png`});
  await page.locator('#fullscreen-button').click();await page.locator('#arcade.is-expanded').waitFor({state:'hidden'});assert.ok(await page.locator('#pause-overlay').isHidden());await buttonFits(page);
  await page.locator('#arcade').screenshot({path:`artifacts/fullscreen-setup-button-${engine}-${viewport.width}.png`});
  await page.locator('#fullscreen-button').click();await page.locator('#arcade.is-expanded').waitFor();
  await page.locator('#fight-button:enabled').click();await page.locator('body[data-screen="match"]').waitFor();
  assert.ok(await page.locator('#arcade.is-expanded').isVisible());assert.ok(await page.locator('#pause-overlay').isHidden());
  // Exit with our button; gameplay freezes and needs an explicit resume.
  await page.locator('#fullscreen-button').click();await paused(page);
  await page.locator('#game-screen').screenshot({path:`artifacts/fullscreen-exit-paused-${engine}-${viewport.width}.png`});
  await page.locator('#resume-button').click();await page.locator('#pause-overlay').waitFor({state:'hidden'});
  await page.locator('#fullscreen-button').click();await page.locator('#arcade.is-expanded').waitFor();
  const native=await page.evaluate(()=>Boolean(document.fullscreenElement||document.webkitFullscreenElement));
  if(native)await page.evaluate(()=>document.exitFullscreen());else await page.keyboard.press('Escape');
  await page.locator('#arcade.is-expanded').waitFor({state:'hidden'});await paused(page);
  // A player who was already paused must stay paused across enter / exit.
  await page.locator('#fullscreen-button').click();await page.locator('#arcade.is-expanded').waitFor();await page.locator('#fullscreen-button').click();await paused(page);
  await page.locator('#fullscreen-button').click();await page.locator('#arcade.is-expanded').waitFor();await page.locator('#lobby-button').click();
  await page.locator('#arcade.is-expanded').waitFor({state:'hidden'});assert.ok(await page.locator('#setup-panel').isVisible());assert.ok(await page.locator('#pause-overlay').isHidden());await buttonFits(page);
  await page.locator('#home-button').click();await buttonFits(page);checks.push({viewport,native,home,setup,exitFreezes:true,alreadyPausedStaysPaused:true,lobbyHasNoPauseOverlay:true});await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`artifacts/fullscreen-flow-${engine}.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,engine,viewports:checks.length,checks,errors}));
}finally{await browser.close();}
