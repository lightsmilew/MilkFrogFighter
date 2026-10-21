import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.MOBILE_ENGINE==='webkit'?'webkit':'chromium';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[],checks=[];await mkdir('artifacts',{recursive:true});
try{
 for(const viewport of [{width:1440,height:1000},{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://localhost:4173/');await page.locator('#start-button:enabled').waitFor();
  assert.equal(await page.locator('#setup-panel').isVisible(),false);assert.ok(await page.locator('#site-footer').isVisible());assert.ok(await page.locator('.quick-guide').isVisible());assert.equal(await page.locator('[data-character]:disabled').count(),6);
  assert.equal(await page.locator('#p2-select-label').textContent(),'人机对手');assert.ok(!(await page.locator('body').innerText()).includes('CPU'));
  const before=await page.locator('#game-screen').boundingBox();await page.locator('#start-button').click();const after=await page.locator('#game-screen').boundingBox();assert.equal(before.width,after.width);assert.equal(before.height,after.height);
  assert.equal(await page.locator('[data-character]:enabled').count(),6);assert.ok(await page.locator('#setup-mode-pane').isVisible());
  await page.locator('[data-mode="local"]').click();assert.ok(await page.locator('#setup-difficulty-pane').isHidden());assert.ok(await page.locator('#setup-stage-pane').isVisible());
  await page.locator('[data-stage="rain"]').click();await page.locator('[data-player="1"]').click();await page.locator('[data-character="purple"]').click();
  await page.locator('[data-mode="ai"]').click();assert.ok(await page.locator('#setup-difficulty-pane').isVisible());await page.locator('#difficulty').selectOption('easy');
  assert.ok(await page.locator('#setup-mode-pane').isVisible());assert.ok(await page.locator('#setup-stage-pane').isVisible());assert.equal(await page.locator('[data-setup-step],#setup-next').count(),0);
  // Small phones scroll within the same arena, without hiding any setup pane.
  for(const selector of ['[data-mode="ai"]','#difficulty','[data-stage="rain"]','#fight-button']){
    const control=page.locator(selector);await control.scrollIntoViewIfNeeded();const r=await control.boundingBox(),area=await page.locator('#game-screen').boundingBox();assert.ok(r.x>=area.x-.5&&r.x+r.width<=area.x+area.width+.5&&r.y>=area.y-.5&&r.y+r.height<=area.y+area.height+.5,`${selector} fits ${viewport.width}`);
  }
  const fit=true;
  await page.locator('#arcade').screenshot({path:`artifacts/setup-window-${engine}-${viewport.width}.png`});await page.locator('#home-button').click();assert.ok(await page.locator('#home-overlay').isVisible());assert.equal(await page.locator('[data-character]:disabled').count(),6);await page.screenshot({path:`artifacts/home-${engine}-${viewport.width}.png`,fullPage:true});
  await page.keyboard.press('Enter');assert.ok(await page.locator('#setup-panel').isVisible());await page.locator('#fight-button:enabled').click();
  assert.equal(await page.locator('body').getAttribute('data-screen'),'match');const game=await page.evaluate(async()=>{const {game}=await import('./src/app.js');return {mode:game.mode,p2:game.fighters[1].character.id,stage:game.stageId,difficulty:game.difficulty};});assert.deepEqual(game,{mode:'ai',p2:'purple',stage:'rain',difficulty:'easy'});
  await page.locator('#pause-button').click();await page.locator('#lobby-button').click();assert.ok(await page.locator('#setup-panel').isVisible());assert.ok(await page.locator('#site-footer').isVisible());checks.push({viewport,fit,game});await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`artifacts/lobby-flow-${engine}.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,engine,viewports:checks.length,errors}));
}finally{await browser.close();}
