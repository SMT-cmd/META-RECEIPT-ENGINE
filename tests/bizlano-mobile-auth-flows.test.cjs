const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..','platform','worker',name),'utf8');

test('business and customer installs are distinct applications',()=>{
 const b=JSON.parse(read('manifest.webmanifest'));
 const c=JSON.parse(read('customer.webmanifest'));
 assert.equal(b.start_url,'/app?source=installed');
 assert.equal(c.start_url,'/receipts?source=installed');
 assert.notEqual(b.id,c.id);
 assert.equal(c.scope,'/receipts');
 assert.equal(c.display,'standalone');
 assert.ok(c.icons.some(x=>x.sizes==='512x512'&&x.purpose==='maskable'));
});
test('website homepage stays public; installed mode launches the business app',()=>{
 assert.ok(read('landing.html').includes("location.replace('/app?source=installed')"));
 assert.ok(read('landing.html').includes('display-mode: standalone'));
 assert.ok(read('index.html').includes('@media(display-mode:standalone)'));
});
test('business password reset clears token and auto-opens authenticated workspace',()=>{
 const s=read('client.js');
 assert.ok(s.includes("state.resetToken=null;state.pendingEmail=null;state.user=result.user;state.authMode='login'"));
 assert.ok(s.includes("history.replaceState(null,'','/app');"));
 assert.ok(s.includes("try{await attach();flash('Password updated."));
 assert.ok(s.includes('back-to-login'));
});
test('business logout routes to standalone sign in, not marketing homepage',()=>{
 const s=read('client.js');
 assert.ok(s.includes("history.replaceState(null,'','/app?mode=login');loginScreen()"));
 assert.ok(s.includes('isInstalledApp')||s.includes('const installed='));
});
test('receipt PWA installs to customer recovery, not business workspace',()=>{
 assert.ok(read('customer.html').includes('href="/customer.webmanifest"'));
 assert.ok(read('worker.js').includes("p==='/customer.webmanifest'"));
 assert.ok(read('build.mjs').includes("read('customer.webmanifest')"));
 assert.ok(read('pwa.js').includes("'Bizlano Receipts'"));
});
test('customer reset and logout return to customer app',()=>{
 const s=read('customer.js');
 assert.ok(s.includes("history.replaceState(null,'','/receipts');"));
 assert.ok(s.includes("history.replaceState(null,'','/receipts?mode=login');loginView()"));
 assert.ok(s.includes('return-to-signin'));
 assert.ok(s.includes("try{await connect()}catch(error)"));
 assert.ok(s.includes('new AbortController()'));
});
