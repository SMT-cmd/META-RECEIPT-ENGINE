const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');

test('React workspace uses Bizlano branding without deleting legacy upgrade routes',()=>{
  const app=source('business-react/src/App.tsx');
  const html=source('business-react/index.html');
  assert.match(html,/<title>Bizlano/);
  assert.match(app,/Powered by Bizlano/);
  assert.match(app,/Your business, beautifully managed/);
  assert.match(app,/old MetaForge receipts are ready to upgrade/);
  assert.ok(fs.existsSync(path.join(__dirname,'..','upgrade/index.html')));
  assert.ok(fs.existsSync(path.join(__dirname,'..','creator/index.html')));
});

test('business invitations stay in the actual React workspace not the offline-only app',()=>{
  const cloud=source('business-react/src/cloud.ts');
  assert.match(cloud,/new URL\(window\.location\.pathname,window\.location\.origin\)/);
  assert.doesNotMatch(cloud,/new URL\('\/business\/',window\.location\.origin\)/);
  assert.match(cloud,/target\.searchParams\.set\('shop',slug\)/);
});

test('recorded payments cannot be erased by stale edits or void actions',()=>{
  const cloud=source('business-react/src/cloud.ts');
  const local=source('business-react/src/storage.ts');
  const rules=source('firestore.rules');
  assert.match(cloud,/incoming\.paid!==previous\.paid/);
  assert.match(cloud,/document\.paid>0\)throw Error\('Paid documents cannot be voided/);
  assert.match(local,/incoming\.paid!==existing\.paid/);
  assert.match(local,/existing\.paid>0\)throw Error\('Paid documents cannot be voided/);
  assert.match(rules,/request\.resource\.data\.paid >= resource\.data\.paid/);
  assert.match(rules,/request\.resource\.data\.voided != true \|\| resource\.data\.paid == 0/);
});
