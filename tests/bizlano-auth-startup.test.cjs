const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..','platform','worker',x),'utf8');
test('branded opening screen always provides a 5.5-second recovery form',()=>{
 const h=read('index.html');
 for(const s of ['bizlano-startup-spinner','@keyframes bizlanoRotate','id="bizlano-startup-help"','root.replaceChildren(p)','5500','Register','Sign in'])assert.ok(h.includes(s),s);
 assert.ok(!h.includes('Loading Bizlano securely'));
});
test('native login has no blocking Firebase imports',()=>{
 const c=read('client.js');assert.ok(!c.startsWith('import '));
 for(const s of ['async function ensureLegacyReader()','await ensureLegacyReader()','nativeBoot().catch'])assert.ok(c.includes(s),s);
});
test('session/auth requests time out with user-facing recovery',()=>{
 const c=read('client.js');
 for(const s of ['new AbortController()','6500:authRequest?12000','finally{clearTimeout(timer)}',"if(err?.name==='AbortError')"])assert.ok(c.includes(s),s);
});
test('PWA always loads current workspace HTML/JS instead of old cached content',()=>{
 const sw=read('sw.js');assert.ok(sw.includes("fetch(req,{cache:'no-store'})"));assert.ok(sw.includes("if(u.pathname.endsWith('.js')"));
});
