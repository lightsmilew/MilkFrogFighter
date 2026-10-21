import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const base=process.env.TEST_URL||'http://localhost:4173/';
await mkdir('artifacts',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>!document.getElementById('start-button').disabled);
  const result=await page.evaluate(async()=>{
    const {Renderer}=await import('./src/renderer.js'),{Game}=await import('./src/engine.js');
    const {CHARACTERS}=await import('./src/config.js'),{stylePose}=await import('./src/vfx.js');
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    const renderer=new Renderer(canvas);await renderer.ready;await renderer.warmRoster();await renderer.ensureStage('rain');
    const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1350;const ctx=sheet.getContext('2d');
    ctx.fillStyle='#eee8d8';ctx.fillRect(0,0,sheet.width,sheet.height);
    const checks=[];
    for(const [i,character] of CHARACTERS.entries()){
      const game=new Game({random:()=>.5});game.start({mode:'local',p1:character.id,p2:'classic',stage:'rain'});game.phase='fight';game.platforms=[];
      const [a,b]=game.fighters;a.x=1700;b.x=2040;a.energy=100;
      game.beginAttack(a,character.id==='classic'?'powerWave':character.id==='green'?'special':character.id==='red'?'pulse':'super');
      for(let n=0;n<35;n++)game.tick(1/60);
      renderer.render(game);
      const x=i%2*800,y=Math.floor(i/2)*450;
      ctx.drawImage(canvas,x,y+32,800,418);ctx.fillStyle='#263d34';ctx.font='bold 22px sans-serif';ctx.fillText(`${character.name} · ${a.lastMove.name}`,x+20,y+25);
      const poses=renderer.variants.get(character.id);checks.push({character:character.id,frames:poses.length,liveEffects:game.effects.length,liveSkills:game.projectiles.length,hp:b.hp,pose:stylePose(a)});
    }
    return {checks,png:sheet.toDataURL('image/png').split(',')[1]};
  });
  assert.ok(result.checks.every(c=>c.frames===24));assert.deepEqual(errors,[]);
  await writeFile('artifacts/six-styles.png',Buffer.from(result.png,'base64'));
  // Block both large maps: neither can hold the start button hostage.
  const fallback=await browser.newPage();
  await fallback.route(/milk-(rain|rooftops)(-tall)?\.webp$/,route=>route.abort());
  await fallback.goto(base,{waitUntil:'domcontentloaded'});await fallback.waitForFunction(()=>!document.getElementById('start-button').disabled);
  await fallback.locator('#start-button').click();await fallback.waitForFunction(async()=>{const {game}=await import('./src/app.js');return game.phase==='fight';});
  assert.equal(await fallback.locator('#home-overlay').isHidden(),true);await fallback.close();
  await writeFile('artifacts/styles-browser-report.json',JSON.stringify({passed:true,checks:result.checks,mapFailureCanStart:true,errors},null,2));
  console.log(JSON.stringify({passed:true,checks:result.checks,mapFailureCanStart:true,errors}));
}finally{await browser.close();}
