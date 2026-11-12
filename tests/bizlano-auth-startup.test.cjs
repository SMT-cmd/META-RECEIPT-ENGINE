const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const read=x=>fs.readFileSync(path.join(__dirname,'..','platform','worker',x),'utf8');
test('Registration shell has a branded rotating loader and a 7s recovery path',()=>{
 const x=read('index.html');assert.match(x,/bizlano-startup-spinner/);
 assert.match(x,/@keyframes bizlanoRotate/);assert.match(x,/id="bizlano-startup-help"/);
 assert.match(x,/setTimeout\\(function\\(\\)/);assert.doesNotMatch(x,/Loading Bizlano securely/);
});
test('Native account screen is not blocked on external Firebase modules',()=>{
 const c=read('client.js');assert.doesNotMatch(c,/^import .*firebase/mi);
 assert.match(c,/async function ensureLegacyReader\\(\\)/);
 assert.match(c,/await ensureLegacyReader\\(\\)/);
 assert.match(c,/nativeBoot\\(\\)\\.catch/);
});
test('Slow session/API requests terminate and show login rather than an infinite spinner',()=>{
 const c=read('client.js');assert.match(c,/new AbortController\\(\\)/);
 assert.match(c,/6500:authRequest\\?12000/);
 assert.match(c,/finally\\{clearTimeout\\(timer\\)\\}/);
 assert.match(c,/catch\\(err\\)\\{state\\.me=null/);
});
test('Service worker fetches current JS first, with cache only for offline fallback',()=>{
 const sw=read('sw.js');assert.match(sw,/fetch\\(request,\\{cache:'no-store'\\}\\)/);
 assert.match(sw,/catch\\{\\s*return await cache\\.match\\(u\\.pathname\\)/);
});
