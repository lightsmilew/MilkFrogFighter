import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.MOBILE_ENGINE==='webkit'?'webkit':'chromium';
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
await mkdir('artifacts',{recursive:true});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://localhost:4173/');await page.locator('#start-button:enabled').waitFor();
  const result=await page.evaluate(async()=>{
    const {Renderer}=await import('./src/renderer.js'),{CHARACTERS}=await import('./src/config.js'),{ANIMATION_FRAMES}=await import('./assets/fighters/frames.js');
    const canvas=document.createElement('canvas'),r=new Renderer(canvas);await r.ready;await r.warmRoster();
    const frames=Object.entries(ANIMATION_FRAMES.reactions).flatMap(([kind,ids])=>ids.map((id,i)=>({kind,id,phase:i+1}))).filter((frame,i,all)=>all.findIndex(other=>other.id===frame.id)===i),sheets=[],checks=[];
    for(let start=0;start<16;start+=8){
      const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1200;const ctx=sheet.getContext('2d');ctx.fillStyle='#eee8d8';ctx.fillRect(0,0,1600,1200);
      CHARACTERS.forEach((c,row)=>frames.slice(start,start+8).forEach(({kind,id,phase},col)=>{
        const asset=r.variants.get(c.id)[id],x=col*200,y=row*200,size=175*asset.scale;
        ctx.fillStyle='#263d34';ctx.font='14px sans-serif';ctx.fillText(`${c.name} ${kind} ${phase}`,x+8,y+18);
        ctx.drawImage(asset.canvas,x+100-size*asset.anchor.x,y+187-size*asset.anchor.y,size,size);
        const pixels=asset.canvas.getContext('2d').getImageData(0,0,192,192).data;let hash=2166136261;for(let i=0;i<pixels.length;i++)hash=Math.imul(hash^pixels[i],16777619);
        const nonempty=[...pixels].filter((_,i)=>i%4===3&&pixels[i]>128).length;checks.push({character:c.id,kind,phase,id,hash:hash>>>0,nonempty});
      }));sheets.push(sheet.toDataURL('image/png').split(',')[1]);
    }
    return {checks,sheets,errors:r.assetErrors};
  });
  assert.equal(result.checks.length,96);assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);
  for(const id of ['classic','green','red','purple','pink','blue']){const frames=result.checks.filter(c=>c.character===id);assert.equal(new Set(frames.map(c=>c.hash)).size,16);assert.ok(frames.every(c=>c.nonempty>5000));}
  for(const [i,data] of result.sheets.entries())await writeFile(`artifacts/reaction-poses-${engine}-${i+1}.png`,Buffer.from(data,'base64'));
  await writeFile(`artifacts/reactions-${engine}.json`,JSON.stringify({passed:true,checks:result.checks,errors},null,2));console.log(JSON.stringify({passed:true,engine,reactionFrames:result.checks.length,errors}));
}finally{await browser.close();}
