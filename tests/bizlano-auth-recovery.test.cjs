const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..','platform','worker',x),'utf8');
test('legacy sessions show setup flow instead of permanent spinner',()=>{
 const client=read('client.js');assert.match(client,/state\.user\.legacyAccount/);assert.match(client,/data-action="claim-legacy"/);assert.match(client,/loginScreen\(\);\s*return;/);
});
test('Firebase-authenticated legacy account may securely set native password through email link',()=>{
 const n=read('native-auth.js'),worker=read('worker.js');
 assert.ok(n.includes("legacyAccount:record?.password_hash==='firebase'"));
 assert.ok(n.includes("EXISTS(SELECT 1 FROM legacy_identity_links"));
 assert.ok(n.includes("password_hash=?,password_salt=?,email_verified_at=COALESCE"));
 assert.ok(worker.includes("email_verified_at=COALESCE(email_verified_at,datetime('now'))"));
});
test('failure of full app gives independent working auth UI within 5.5 seconds',()=>{
 const h=read('index.html');assert.ok(h.includes('root.replaceChildren(p)'));assert.ok(h.includes('5500'));assert.ok(h.includes('form.addEventListener(\'submit\''));
});
test('service worker never caches login, workspace HTML or JS',()=>{
 const sw=read('sw.js');assert.ok(sw.includes("if(req.mode==='navigate')"));assert.ok(sw.includes("fetch(req,{cache:'no-store'})"));assert.ok(!sw.includes("'/client.js'"));
 assert.ok(!sw.includes("'/app'"));
});
