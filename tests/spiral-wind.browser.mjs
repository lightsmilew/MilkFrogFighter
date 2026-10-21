import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[];await mkdir('artifacts',{recursive:true});
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.TEST_URL||'http://localhost:4173/');await page.locator('#start-button:enabled').waitFor();
 const result=await page.evaluate(async()=>{
  const {Game}=await import('./src/engine.js'),{Renderer}=await import('./src/renderer.js');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const renderer=new Renderer(canvas);await renderer.ready;await renderer.ensureFighter('green');await renderer.ensureStage('rain');
  const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1472;const ctx=sheet.getContext('2d');ctx.fillStyle='#eee9d8';ctx.fillRect(0,0,sheet.width,sheet.height);const checks=[];
  for(const [i,[id,move]] of [['classic','airSuper'],['classic','superStorm'],['green','airSuper'],['green','superStorm']].entries()){
   const hits=[],g=new Game({random:()=>.5,onEvent:e=>{if(e.type==='hit')hits.push(e);}});g.start({mode:'local',p1:id,p2:'purple',stage:'rain'});g.phase='fight';g.platforms=[];g.fighters[0].x=1400;g.fighters[1].x=1800;g.fighters[0].energy=100;
   await renderer.ensureFighter('purple');if(move==='airSuper'){g.fighters[0].y=380;g.fighters[0].grounded=false;}g.beginAttack(g.fighters[0],move);const visuals=new Set();let snapshot=0;
   for(let n=0;n<130;n++){
    g.tick(1/60);for(const p of g.projectiles)visuals.add(p.visual);
    if([30,43,59][snapshot]===n){renderer.render(g);const x=snapshot*600,y=i*368;ctx.drawImage(canvas,x,y+30,600,338);ctx.fillStyle='#263d34';ctx.font='bold 16px sans-serif';ctx.fillText(`${g.fighters[0].character.name} · ${g.fighters[0].lastMove.name} · ${((n+1)/60).toFixed(2)}s`,x+12,y+22);snapshot++;}
   }
   checks.push({id,move,visuals:[...visuals],hits:hits.length,damage:1000-g.fighters[1].hp});
  }
  return {checks,png:sheet.toDataURL('image/png').split(',')[1]};
 });
 for(const c of result.checks){assert.ok(c.hits>0,JSON.stringify(c));assert.ok(c.damage>50&&c.damage<320,JSON.stringify(c));assert.ok(!c.visuals.includes('stormColumn')&&!c.visuals.includes('airBurst'));}
 assert.deepEqual(errors,[]);await writeFile('artifacts/spiral-wind-ultimates.png',Buffer.from(result.png,'base64'));await writeFile('artifacts/spiral-wind-ultimates.json',JSON.stringify({passed:true,checks:result.checks,errors},null,2));console.log(JSON.stringify({passed:true,checks:result.checks,errors}));
}finally{await browser.close();}
