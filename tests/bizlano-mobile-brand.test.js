const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
test('brand icon and logo exist for static and React builds', () => {
  const root = read('bizlano-icon.svg');
  const react = read('business-react/public/bizlano-icon.svg');
  const wordmark = read('brand/bizlano-wordmark.svg');
  assert.match(root, /<svg[\s\S]*?Bizlano/);
  assert.match(react, /<svg[\s\S]*?Bizlano/);
  assert.match(wordmark, /Your business, beautifully managed/);
});
test('all current receipt renderers carry Bizlano attribution', () => {
  const engine = read('engine/index.html');
  const creator = read('creator/index.html');
  const local = read('business/app.js');
  const react = read('business-react/src/App.tsx');
  assert.equal((engine.match(/Powered by <strong class="powered-link">Bizlano<\/strong>/g)||[]).length, 2);
  assert.match(creator, /class="bizlano-attribution"[^>]*>Powered by/);
  assert.match(local, /class="bizlano-powered">Powered by/);
  assert.match(react, /Powered by <strong>Bizlano<\/strong>/);
  assert.match(read('business-react/src/style.css'), /@media print[\s\S]*?receipt/);
});
test('new Bizlano landing routes to real internal pages without claiming a live subdomain', () => {
  const page = read('bizlano/index.html');
  for (const href of ['../creator/','../upgrade/']) {
    assert.ok(page.includes('href="'+href+'"'),href);
  }
  const live=read('platform/worker/landing.html');
  assert.match(live,/href="\/app"/);
  assert.match(live,/href="\/receipts"/);
  assert.match(page, /browser/);
  assert.match(page, /noindex, follow/);
  assert.doesNotMatch(page, /https:\/\/timi\.bizlano\.com/);
});
test('React app has five-tab mobile navigation and safe area insets', () => {
  const app = read('business-react/src/App.tsx');
  const css = read('business-react/src/style.css');
  assert.match(app, /aria-label="Quick navigation"/);
  for (const label of ['Home','Documents','Create','Stock','More']) {
    assert.ok(app.includes('>'+label+'</small>'),label);
  }
  assert.match(app, /className="sidebar-scrim"/);
  assert.match(app, /aria-controls="bizlano-sidebar"/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media print[\s\S]*?mobile-tabbar/);
});
test('legacy MetaForge storage, authentication, and URLs are not renamed',()=>{
  const local = read('business/app.js');
  const engine = read('engine/index.html');
  const creator = read('creator/index.html');
  assert.match(local, /const KEY = 'metaforge-business-v1'/);
  assert.match(engine, /projectId: "metaforge-6afdf"/);
  assert.match(creator, /projectId: "metaforge-6afdf"/);
  assert.match(read('index.html'), /href="bizlano\/"/);
});
