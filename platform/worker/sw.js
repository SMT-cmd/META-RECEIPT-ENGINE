const VERSION='bizlano-public-pwa-v20261112-auth-repair-3';
const CACHED=['/offline','/pwa/icon-192.png','/pwa/icon-512.png','/pwa/icon-maskable.png','/assets/bizlano-mark.png'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{const cache=await caches.open(VERSION);
  await Promise.allSettled(CACHED.map(async path=>{const r=await fetch(path,{cache:'reload',credentials:'omit'});if(r.ok)await cache.put(path,r)}));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('bizlano-'))await (name===VERSION?Promise.resolve():caches.delete(name));await self.clients.claim()})());
});
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url);
 if(req.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;
 // Never cache sign-in pages, workspace JS or HTML. They must always be fresh.
 if(req.mode==='navigate'){
  event.respondWith(fetch(req,{cache:'no-store'}).catch(async()=>await caches.match('/offline')||new Response('Connection unavailable',{status:503})));return;
 }
 if(u.pathname.endsWith('.js')||u.pathname.endsWith('.webmanifest')||u.pathname==='/client.js')return;
 if(CACHED.includes(u.pathname)){
  event.respondWith((async()=>await caches.match(u.pathname)||fetch(req))());
 }
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
