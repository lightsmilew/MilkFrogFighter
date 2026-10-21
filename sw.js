// Stable across deploys: content-addressed URLs are safe to reuse; HTML is not.
const cacheName = `milkfrog-files:${new URL(self.registration.scope).pathname}`;
const hashed = /\.[a-f0-9]{12}\.(?:js|css|webp|png|svg|mp3)$/;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if(event.data?.type!=='remember'||!Array.isArray(event.data.urls)||!event.source?.url?.startsWith(self.registration.scope))return;
  event.waitUntil((async()=>{
    const cache=await caches.open(cacheName);
    await Promise.allSettled(event.data.urls.slice(0,32).map(async name=>{
      const url=new URL(name);
      if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope)||!hashed.test(url.pathname))return;
      if(await cache.match(url.href,{ignoreVary:true}))return;
      const response=await fetch(url.href,{cache:'force-cache'});
      if(response.ok)await cache.put(url.href,response);
    }));
    event.ports[0]?.postMessage(true);
  })().catch(()=>{}));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    if(request.mode==='navigate')return fetch(request,{cache:'no-cache'});
    if(request.headers.has('range')||!hashed.test(url.pathname))return fetch(request);
    let cache;
    try {
      cache = await caches.open(cacheName);
      // These URLs identify decoded file contents. Browser-generated request
      // headers (preload/image/module and gzip variants) must not split them.
      const saved = await cache.match(url.href,{ignoreVary:true});
      if (saved) return saved;
    } catch { /* Storage restrictions must not prevent network loading. */ }
    const response = await fetch(request);
    if (response.ok && cache) {
      const copy = response.clone();
      event.waitUntil((async () => {
        await cache.put(url.href, copy);
        // Retain older hashes for already-open tabs, with bounded disk usage.
        const keys = await cache.keys();
        await Promise.all(keys.slice(0, Math.max(0, keys.length - 96)).map(key => cache.delete(key)));
      })().catch(() => {}));
    }
    return response;
  })());
});
