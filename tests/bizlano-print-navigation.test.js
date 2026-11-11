const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'business-react/src/App.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'business-react/src/style.css'),'utf8');
test('document list printing waits for the selected receipt preview',()=>{
  assert.match(app,/setPendingPrintId\(d\.id\)/);
  assert.match(app,/requestAnimationFrame\(/);
  assert.doesNotMatch(app,/setTimeout\(\(\)=>window\.print\(\),150\)/);
});
test('Bizlano identity stays on printable receipts',()=>{
  assert.match(app,/Powered by <strong>Bizlano<\/strong>/);
  assert.match(css,/@media print[\s\S]*?receipt-powered/);
});
test('mobile-first workspace retains accessible bottom navigation',()=>{
  assert.match(app,/aria-label="Quick navigation"/);
  assert.match(app,/aria-current=\{page==='documents'/);
  assert.match(app,/aria-expanded=\{mobile\}/);
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(css,/\.mobile-tabbar\{position:fixed/);
});
