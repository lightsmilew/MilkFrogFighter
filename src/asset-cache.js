import {productionAssets} from './asset-urls.js';

// Cache only resources the player actually used. HTML always comes from the
// network, so a deploy selects new hashes without pinning an old app shell.
const hashed = /\.[a-f0-9]{12}\.(?:js|css|webp|png|svg|mp3)$/;
let registration;
export function registerAssetCache() {
  if (!productionAssets || !isSecureContext || !('serviceWorker' in navigator)) return;
  registration = navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), {updateViaCache:'none'})
    .then(() => navigator.serviceWorker.ready).catch(() => null);
}

export function rememberLoadedAssets() {
  if (!registration || !('caches' in window)) return;
  const remember = async () => {
    const worker = await registration;
    if (!worker) return;
    // On the first visit the worker may take control after the first image
    // request. Reuse those completed responses from the HTTP cache once idle.
    const urls = [...new Set(performance.getEntriesByType('resource')
      .filter(entry => entry.responseEnd > 0)
      .map(entry => entry.name).filter(name => {
        const url = new URL(name);
        return url.origin === location.origin && url.href.startsWith(worker.scope) && hashed.test(url.pathname);
      }))];
    // Keep first-visit writes in the same worker that handles later reads.
    const target=navigator.serviceWorker.controller || worker.active;
    if(!target)return;
    const channel=new MessageChannel();
    channel.port1.onmessage=event=>{
      if(event.data===true)performance.mark('milkfrog-cached');
      channel.port1.close();
    };
    target.postMessage({type:'remember',urls},[channel.port2]);
  };
  const run = () => remember().catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(run, {timeout:5000});
  else setTimeout(run, 1500);
}
