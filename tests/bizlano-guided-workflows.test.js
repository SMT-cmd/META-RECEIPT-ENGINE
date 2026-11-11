const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const ui=source('platform/worker/client.js'),html=source('platform/worker/index.html'),worker=source('platform/worker/worker.js');
test('document studio begins with business type and shows matching department',()=>{
 assert.match(ui,/What kind of business do you run\?/);
 for(const category of ['Electronics & gadgets','Baking, food & cafés','Electrical, repairs & construction','Fashion, beauty & salons']){
  assert.ok(ui.includes(category),category);
 }
 assert.match(ui,/departmentForIndustry\(sector\.id\)/);
 assert.match(ui,/const choices=chosenDepartment\.templates/);
 assert.doesNotMatch(ui,/TEMPLATE_LIST\.map\(\(id,i\)=>/);
});
test('template cards and full-sized preview use the actual receipt rendering pipeline',()=>{
 assert.match(ui,/function sampleHtml\(template,asCard=false\)/);
 assert.match(ui,/return receipt\(sampleDocument\(template\)/);
 assert.match(ui,/template-thumbnail-inner/);
 assert.match(ui,/studio-full-preview/);
 assert.match(html,/\.template-thumbnail-inner \.receipt/);
 assert.match(html,/\.full-receipt-sample/);
});
test('all existing receipt templates remain selectable in grouped dropdowns',()=>{
 const tmpl=worker.match(/const TEMPLATES=new Set\(\[([^\]]+)\]\)/);
 assert.ok(tmpl);
 const titles=[...tmpl[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
 assert.equal(titles.length,36);
 const match=ui.match(/const TEMPLATE_FAMILIES=\[([\s\S]*?)\];/);
 assert.ok(match);
 const styleNames=[...match[1].matchAll(/'([a-z][a-z-]*)'/g)].map(x=>x[1]);
 const missing=titles.filter(x=>!styleNames.includes(x));
 assert.deepEqual(missing,[]);
});
test('business category persists only through the authorized design endpoint',()=>{
 assert.match(worker,/DESIGN_INDUSTRIES=new Set/);
 assert.match(worker,/SELECT signature_url,industry FROM tenants WHERE id=\?/);
 assert.match(worker,/UPDATE tenants SET industry=\? WHERE id=\?/);
 assert.match(worker,/if\(!DESIGN_INDUSTRIES\.has\(industry\)\)/);
 assert.match(ui,/industry:state\.designIndustry/);
});
test('document entry shows four panels with progression and unchanged backend save action',()=>{
 for(const n of [1,2,3,4])assert.ok(ui.includes('panel('+n+','));
 assert.match(ui,/function setDocStep\(target\)/);
 assert.match(html,/\.doc-step\[hidden\]/);
 assert.match(ui,/data-document-action="issue"/);
 assert.match(ui,/data-document-action="draft"/);
 assert.match(ui,/api\(t\+'\/documents',b\)/);
});
test('business dashboard uses short quick actions and optional insights',()=>{
 assert.match(ui,/quick-work-grid/);
 assert.match(ui,/tidy-details/);
 assert.match(ui,/Share your business page/);
 assert.match(ui,/More business tools/);
 assert.match(html,/\.tidy-details/);
 assert.match(html,/\.nav-group/);
});
test('receipt creation requires contact information and actual paid amount before issuing',()=>{
 assert.match(ui,/Add a customer email or phone number before issuing/);
 assert.match(ui,/Enter the amount paid to issue a receipt/);
 assert.match(ui,/For unpaid sales, choose Invoice instead/);
});

test('all 36 document themes have a separate visual structure and recommended hue',()=>{
 const art=ui.match(/const RECEIPT_ART=\{([\s\S]*?)\n\};/);
 assert.ok(art,'Design identities must exist');
 const layouts=[...art[1].matchAll(/layout:'([a-z-]+)'/g)].map(m=>m[1]);
 assert.equal(layouts.length,36);
 assert.equal(new Set(layouts).size,36,'No two template IDs should share a layout archetype');
 for(const layout of layouts){assert.ok(html.includes('.receipt-layout-'+layout),'Missing actual receipt CSS for '+layout)}
 const accents=[...art[1].matchAll(/accent:'(#[0-9a-f]{6})'/g)].map(m=>m[1]);
 assert.equal(accents.length,36);
 assert.ok(new Set(accents).size>=30,'Designs must not all use the same palette');
});
test('business colours can be chosen during design selection and reach the real print renderer',()=>{
 assert.match(ui,/const COLOR_STORIES=\[/);
 assert.match(ui,/data-design-color/);
 assert.match(ui,/data-design-custom-color/);
 assert.match(ui,/setDesignColour\(el\.dataset\.designColor\)/);
 assert.match(ui,/setDesignColour\(ev\.target\.value\)/);
 assert.match(ui,/--receipt-accent:/);
 assert.match(html,/Selected brand colour is printed on EVERY template/);
 assert.match(html,/\.receipt \.r-total \.grand\{box-shadow:inset 5px 0 var\(--receipt-accent\)/);
});
test('electrical and repair businesses receive four clearly different receipt categories',()=>{
 assert.match(ui,/id:'trades',[^\n]*templates:\['heritage-garage-workshop','heritage-construction-industrial','heritage-swiss-design','heritage-japanese-minimal','service'\]/);
 for(const variant of ['blueprint','ledger','dark','logistics'])assert.match(html,new RegExp('\\.receipt-layout-'+variant+' \\.r-head'));
});
test('sample thumbnails use real document rendering without duplicate printable IDs',()=>{
 assert.match(ui,/return receipt\(sampleDocument\(template\),'BZ-00021',false,design\)\.replace/);
 assert.match(ui,/id="printable"/);
 assert.match(html,/\.template-thumbnail-inner \.receipt/);
});

test('fresh receipt designs are not trapped by an old cached dashboard script',()=>{
 assert.match(html,/client\.js\?v=20261111-heritage-71/);
 assert.match(worker,/p==='\/client\.js'[^\n]*'cache-control':'no-store'/);
});
