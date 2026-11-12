const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const read=x=>fs.readFileSync(path.join(__dirname,'..','platform','worker',x),'utf8');
test('branded loading screen has spinner and 7s recovery actions',()=>{
 const html=read('index.html');
 for(const expected of ['bizlano-startup-spinner','@keyframes bizlanoRotate','id="bizlano-startup-help"','setTimeout(function()','7000','Register','Sign in']){
  assert.ok(html.includes(expected),expected);
 }
 assert.ok(!html.includes('Loading Bizlano securely'));
});
test('native login no longer statically imports third party Firebase bundles',()=>{
 const client=read('client.js');
 assert.ok(!client.startsWith('import '));
 for(const expected of ['async function ensureLegacyReader()','await ensureLegacyReader()','nativeBoot().catch']){
  assert.ok(client.includes(expected),expected);
 }
});
test('account/session and other API calls have clear timeouts',()=>{
 const client=read('client.js');
 for(const expected of ['new AbortController()','6500:authRequest?12000','finally{clearTimeout(timer)}',"if(err?.name==='AbortError')"]){
  assert.ok(client.includes(expected),expected);
 }
});
test('PWA script caching prefers network, with offline cache only as fallback',()=>{
 const sw=read('sw.js');
 assert.ok(sw.includes("fetch(request,{cache:'no-store'})"));
 assert.ok(sw.includes("return await cache.match(u.pathname)||new Response('Offline',{status:503})"));
});
