/* Bizlano app shell: only public, non-personal assets are cached. */
const VERSION='bizlano-app-shell-v20261112-1';
const STATIC=['/','/app','/receipts','/client.js','/customer.js','/pwa.js','/manifest.webmanifest','/pwa/icon-192.png','/pwa/icon-512.png','/pwa/icon-maskable.png','/assets/bizlano-mark.png'];
const STATIC_ROUTES=new Set(STATIC);
const PUBLIC_PAGES=new Set(['/','/app','/receipts']);
const safe=u=>u.origin===self.location.origin&&STATIC_ROUTES.has(u.pathname);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{const cache=await caches.open(VERSION);
   await Promise.allSettled(STATIC.map(async path=>{const response=await fetch(path,{cache:'no-cache',credentials:'omit'});if(response.ok)await cache.put(path,response)}));
   await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('bizlano-app-shell-')&&name!==VERSION)await caches.delete(name);await self.clients.claim()})());
});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const u=new URL(request.url);
 if(u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/media/')||u.pathname.startsWith('/s/')||u.pathname.startsWith('/go/'))return;
 if(!safe(u))return;
 if(request.mode==='navigate'&&PUBLIC_PAGES.has(u.pathname)){
  event.respondWith((async()=>{try{const response=await fetch(request);
      // Never retain URL parameters (including verification and recovery tokens).
      if(response.ok&&!u.search){const cache=await caches.open(VERSION);await cache.put(u.pathname,response.clone())}
      return response;
   }catch{const saved=await(await caches.open(VERSION)).match(u.pathname);return saved||new Response('<!doctype html><title>Bizlano offline</title><meta name="viewport" content="width=device-width,initial-scale=1"><main style="font:16px system-ui;max-width:420px;margin:18vh auto;padding:24px"><h1>Connection unavailable</h1><p>Reconnect to access your business records.</p><button onclick="location.reload()">Try again</button></main>',{headers:{'Content-Type':'text/html; charset=utf-8'}})}})());
  return;
 }
 if(u.search)return;
 event.respondWith((async()=>{const cache=await caches.open(VERSION);const saved=await cache.match(u.pathname);
  const fresh=fetch(request).then(async response=>{if(response.ok)await cache.put(u.pathname,response.clone());return response}).catch(()=>null);
  return saved||await fresh||new Response('Offline',{status:503});
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
