const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
test('installable app manifest includes 192px, 512px and maskable icons',()=>{
 const m=JSON.parse(read('platform/worker/manifest.webmanifest'));
 assert.equal(m.start_url,'/app?source=installed');assert.equal(m.display,'standalone');
 assert.ok(m.icons.some(x=>x.sizes==='192x192'));
 assert.ok(m.icons.some(x=>x.sizes==='512x512'&&x.purpose==='maskable'));
});
test('service worker leaves business pages, scripts, APIs and receipt data uncached',()=>{
 const sw=read('platform/worker/sw.js');
 assert.ok(sw.includes("u.pathname.startsWith('/api/')"));
 assert.ok(sw.includes("req.mode==='navigate'"));
 assert.ok(sw.includes("fetch(req,{cache:'no-store'})"));
 assert.ok(!sw.includes("'/app'"));assert.ok(!sw.includes("'/client.js'"));
 assert.ok(!sw.includes('cache.put(request'));
});
test('all public shells load shared PWA installer and manifest',()=>{
 for(const name of ['index.html','landing.html','customer.html']){
  const x=read('platform/worker/'+name);
  assert.ok(x.includes('rel="manifest" href="/manifest.webmanifest"'));
  assert.ok(x.includes('src="/pwa.js"'));
 }
});
test('Worker bundle serves icon and PWA endpoints',()=>{
 const source=read('platform/worker/worker.js'),build=read('platform/worker/build.mjs');
 for(const endpoint of ['/manifest.webmanifest','/sw.js','/pwa.js','/offline','/pwa/icon-maskable.png'])assert.ok(source.includes(endpoint));
 for(const resource of ['manifest.webmanifest','sw.js','pwa.js','offline.html'])assert.ok(build.includes("read('"+resource+"')"));
});
