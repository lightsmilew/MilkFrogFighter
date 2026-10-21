import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const base=process.env.TEST_URL||'http://localhost:4173/';
await mkdir('artifacts',{recursive:true});
try{
  const page=await browser.newPage();const cdp=await page.context().newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:120,downloadThroughput:200000,uploadThroughput:100000});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{window.longTasks=[];new PerformanceObserver(list=>window.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>performance.getEntriesByName('milkfrog-ready').length>0);
  const result=await page.evaluate(()=>{
    const ready=performance.getEntriesByName('milkfrog-ready')[0].startTime;
    return {ready,longTasks:window.longTasks.filter(e=>e.start<ready),resources:performance.getEntriesByType('resource').filter(e=>e.startTime<ready).map(e=>({name:e.name.split('/').pop(),bytes:e.transferSize,duration:e.duration}))};
  });
  assert.ok(!result.resources.some(e=>/milk-(street|rain|rooftops)(-tall)?(?:\.[a-f0-9]{12})?\.webp$|milkfrog-(sprites|advanced)\.webp/.test(e.name)));
  assert.ok(result.ready<8000,`cold start ${result.ready.toFixed(0)} ms`);
  if(result.resources.some(e=>/^game\.[a-f0-9]{12}\.js$/.test(e.name))){
    assert.equal(result.resources.filter(e=>e.name.endsWith('.js')).length,1,'production boot must use one module request');
    assert.ok(!result.resources.some(e=>/portraits|milk-lobby|thumb|classic-laugh|-walk\.|share-card\./.test(e.name)),'optional gait/QR/decoration/audio must not compete with opening sprites');
  }
  const report={passed:true,...result,bytes:result.resources.reduce((sum,e)=>sum+e.bytes,0),longTaskMax:Math.max(0,...result.longTasks.map(e=>e.duration)),conditions:{latencyMs:120,downloadBytesPerSec:200000,cpuSlowdown:4,cache:false}};
  await writeFile('artifacts/startup-after.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ready:report.ready,longTaskMax:report.longTaskMax,bytes:report.bytes,passed:true}));
}finally{await browser.close();}
