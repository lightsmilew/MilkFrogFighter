import {openSetup,launchMatch} from './ui-helpers.mjs';
// Production delivery regression: project Pages path, real HTTP requests,
// persistent asset cache, a changed deployment, and unavailable storage.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.MOBILE_ENGINE==='webkit'?'webkit':'chromium';
const root=resolve('dist'),scope='/MilkFrogFighter/',requests=[];
const manifest=JSON.parse(await readFile(resolve(root,'asset-manifest.json'),'utf8'));
const original=await readFile(resolve(root,manifest.script));
const changed=Buffer.concat([original,Buffer.from('\nglobalThis.__deliveryProbe="B";\n')]);
const changedName=`src/game.${createHash('sha256').update(changed).digest('hex').slice(0,12)}.js`;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg'};
let deployment=0;
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    requests.push(url.pathname);
    if(!url.pathname.startsWith(scope)){res.writeHead(404).end();return;}
    const name=decodeURIComponent(url.pathname.slice(scope.length))||'index.html',path=resolve(root,name);
    if(!path.startsWith(root+sep))throw new Error('Invalid path');
    let body=deployment&&name===changedName?changed:await readFile(path);
    if(deployment&&name==='index.html')body=Buffer.from(body.toString().replaceAll(manifest.script,changedName));
    const headers={'Content-Type':types[extname(name)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
    if(/\.(?:html|js|css|json|svg)$/.test(name)&&req.headers['accept-encoding']?.includes('gzip')){body=gzipSync(body);headers['Content-Encoding']='gzip';}
    res.writeHead(200,headers).end(body);
  }catch{res.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://localhost:${server.address().port}${scope}`;
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const ready=page=>page.waitForFunction(()=>performance.getEntriesByName('milkfrog-ready').length===1);
const checks=[];
await mkdir('artifacts',{recursive:true});
const profile=engine==='webkit'?await mkdtemp(resolve('artifacts/delivery-profile-')):null;
let persistent;
try{
  const context=profile?persistent=await playwright.webkit.launchPersistentContext(profile,{headless:true,serviceWorkers:'allow'}):await browser.newContext({serviceWorkers:'allow'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await ready(page);
  await page.waitForFunction(()=>navigator.serviceWorker.controller?.state==='activated'&&performance.getEntriesByName('milkfrog-cached').length>0);
  const cached=await page.evaluate(async()=>{
    const cache=await caches.open(`milkfrog-files:${location.pathname}`);
    return (await cache.keys()).map(r=>new URL(r.url).pathname);
  });
  assert.ok(['classic.','green.','/game.','/style.'].every(name=>cached.some(url=>url.includes(name))));
  assert.ok(!cached.some(name=>/index\.html|\/rain\.|\/red\.|\/pink\.|\/blue\.|classic-laugh|milk-rain-tall/.test(name)),'do not prefetch unrelated assets or cache HTML');
  checks.push({check:'first visit caches only used assets',cached});
  const cdp=engine==='chromium'?await context.newCDPSession(page):null;
  if(cdp){await cdp.send('Network.enable');await cdp.send('Network.clearBrowserCache');}
  let boundary=requests.length;
  await page.goto(base+'?visit=2',{waitUntil:'domcontentloaded'});await ready(page);await page.waitForTimeout(300);
  let fetched=requests.slice(boundary);
  assert.ok(!fetched.some(name=>/\.(?:webp|css)$|\/game\./.test(name)),JSON.stringify({fetched,cache:await page.evaluate(async()=>({controller:navigator.serviceWorker.controller?.scriptURL,keys:await caches.keys(),entries:await Promise.all((await caches.keys()).map(async name=>(await (await caches.open(name)).keys()).map(r=>r.url)))}))}));
  const warm=await page.evaluate(()=>performance.getEntriesByName('milkfrog-ready')[0].startTime);
  checks.push({check:cdp?'repeat visit reuses files after clearing HTTP cache':'repeat visit reuses files with no-cache HTTP responses',readyMs:warm,network:fetched});
  if(cdp)await cdp.send('Network.clearBrowserCache');
  deployment=1;boundary=requests.length;
  await page.goto(base+'?visit=3',{waitUntil:'domcontentloaded'});await ready(page);
  await page.waitForFunction(()=>globalThis.__deliveryProbe==='B');await page.waitForTimeout(300);
  fetched=requests.slice(boundary);
  assert.ok(fetched.includes(scope+changedName),'new code must be fetched');
  assert.ok(!fetched.some(name=>/\.(?:webp|css)$/.test(name)),'unchanged artwork/style must survive a deployment');
  assert.equal(await page.locator('.fighter-card').count(),6);
  assert.deepEqual(errors,[]);
  checks.push({check:'new deployment runs new code and keeps unchanged artwork',network:fetched});

  const restricted=await browser.newContext();
  await restricted.addInitScript(()=>{
    navigator.serviceWorker.register=()=>Promise.reject(new Error('Storage unavailable'));
    caches.open=()=>Promise.reject(new Error('Storage unavailable'));
  });
  const fallback=await restricted.newPage();await fallback.goto(base);await ready(fallback);
  await launchMatch(fallback);assert.ok(await fallback.locator('#home-overlay').isHidden());
  checks.push({check:'restricted cache/service worker still allows a match'});await restricted.close();

  const broken=await browser.newContext({serviceWorkers:'block'}),retry=await broken.newPage();
  let fail=true;await retry.route(/\/src\/game\.[a-f0-9]+\.js$/,route=>fail?route.abort():route.continue());
  await retry.goto(base,{waitUntil:'domcontentloaded'});
  await retry.locator('#retry-load').waitFor({state:'visible'});
  assert.ok(await retry.locator('#start-button').isDisabled());
  fail=false;await retry.locator('#retry-load').click();
  try{await ready(retry);}catch(error){console.log('retry diagnostic',await retry.evaluate(()=>({url:location.href,marks:performance.getEntriesByType('mark').map(e=>e.name),hint:document.getElementById('loading-hint').textContent,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,bytes:e.transferSize}))})),checks);throw error;}
  assert.ok(await retry.locator('#retry-load').isHidden());
  checks.push({check:'failed game download offers a working manual retry'});await broken.close();
  await mkdir('artifacts',{recursive:true});
  await writeFile(`artifacts/delivery-report-${engine}.json`,JSON.stringify({passed:true,engine,checks,errors},null,2));
  console.log(JSON.stringify({passed:true,engine,checks}));
}finally{
  await persistent?.close();await browser.close();await new Promise(resolve=>server.close(resolve));
  if(profile&&profile.startsWith(resolve('artifacts')+sep))await rm(profile,{recursive:true,force:true});
}
