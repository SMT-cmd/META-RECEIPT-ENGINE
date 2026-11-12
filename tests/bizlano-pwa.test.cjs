const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
test('installable app manifest contains real 192 and 512px icon endpoints',()=>{
 const m=JSON.parse(read('platform/worker/manifest.webmanifest'));
 assert.equal(m.start_url,'/app?source=installed');assert.equal(m.display,'standalone');
 assert.ok(m.icons.some(x=>x.sizes==='192x192'));assert.ok(m.icons.some(x=>x.sizes==='512x512'&&x.purpose==='maskable'));
});
test('no account, API or personal receipts are stored in service-worker cache',()=>{
 const sw=read('platform/worker/sw.js');
 assert.match(sw,/u\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/u\.pathname\.startsWith\('\/media\/'\)/);
 assert.match(sw,/if\(u\.search\)return/);
 assert.match(sw,/if\(response\.ok&&!u\.search\)/);
 assert.doesNotMatch(sw,/cache\.put\(request/);
});
test('all three public shells load one shared PWA installer and manifest',()=>{
 for(const name of ['index.html','landing.html','customer.html']){
  const x=read('platform/worker/'+name);
  assert.match(x,/rel="manifest" href="\/manifest.webmanifest"/);
  assert.match(x,/src="\/pwa\.js"/);
 }
});
test('Cloudflare source bundles and serves all PWA endpoints',()=>{
 const source=read('platform/worker/worker.js'),build=read('platform/worker/build.mjs');
 for(const endpoint of ['/manifest.webmanifest','/sw.js','/pwa.js','/offline','/pwa/icon-maskable.png'])assert.ok(source.includes(endpoint));
 for(const resource of ['manifest.webmanifest','sw.js','pwa.js','offline.html'])assert.ok(build.includes("read('"+resource+"')"));
});
