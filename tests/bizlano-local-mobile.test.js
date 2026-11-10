const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('browser workspace mobile tabs link to actual sections',()=>{
  const html=read('business/index.html');
  const js=read('business/app.js');
  for(const view of ['dashboard','documents','create','catalog']){
    assert.match(html,new RegExp('class="bottom-tab[^"]*" data-view="'+view+'"'));
    assert.match(html,new RegExp('id="view-'+view+'"'));
    assert.match(js,new RegExp("if\\(view==='"+view+"'\\)"));
  }
  assert.match(html,/id="mobileMore"/);
  assert.match(html,/id="mobileScrim"/);
});
test('drawer navigation has functional backdrop, Escape and aria state',()=>{
  const js=read('business/app.js');
  assert.match(js,/function setMobileMenu\(open\)/);
  assert.match(js,/id/); // Includes record identifiers, but not used for auth.
  assert.match(js,/setAttribute\('aria-expanded',String\(open\)\)/);
  assert.match(js,/\$\('#mobileScrim'\)\.addEventListener\('click',\(\)=>setMobileMenu\(false\)\)/);
  assert.match(js,/event\.key==='Escape'/);
});
test('mobile navigation preserves legacy local storage key',()=>{
  const js=read('business/app.js');
  const css=read('business/style.css');
  assert.match(js,/const KEY = 'metaforge-business-v1'/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/body\.menu-open \.mobile-scrim\{display:block\}/);
  assert.match(css,/@media print\{\.mobile-bottom-nav,.mobile-scrim/);
});
