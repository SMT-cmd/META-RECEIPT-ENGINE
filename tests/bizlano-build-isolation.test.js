const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
test('React build cannot overwrite existing local-first /business files',()=>{
  const vite=read('business-react/vite.config.ts');
  assert.match(vite,/base:'\/app\/'/);
  assert.match(vite,/outDir:'\.\.\/app'/);
  assert.doesNotMatch(vite,/outDir:'\.\.\/business'/);
  assert.match(read('business/index.html'),/id="view-create"/);
});
test('Bizlano React SPA has its own production rewrite and base-aware favicon',()=>{
  const firebase=JSON.parse(read('firebase.json'));
  assert.ok(firebase.hosting.rewrites.some(r=>r.source==='/app/**'&&r.destination==='/app/index.html'));
  assert.match(read('business-react/index.html'),/%BASE_URL%bizlano-icon\.svg/);
});
test('legacy migration retains backup-first local staging destination',()=>{
  const wizard=read('upgrade/app.js');
  assert.match(wizard,/migration\.CURRENT_KEY/);
  assert.match(wizard,/window\.location\.assign\('\.\.\/business\/'\)/);
  const local=read('business/app.js');
  assert.match(local,/const KEY = 'metaforge-business-v1'/);
});
test('future cloud app invitation points to its actual location instead of local demo',()=>{
  const cloud=read('business-react/src/cloud.ts');
  assert.match(cloud,/new URL\(window\.location\.pathname,window\.location\.origin\)/);
  assert.doesNotMatch(cloud,/new URL\('\/business\/',window\.location\.origin\)/);
});
