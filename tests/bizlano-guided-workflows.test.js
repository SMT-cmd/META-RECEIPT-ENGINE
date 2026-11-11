const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const ui=source('platform/worker/client.js'),html=source('platform/worker/index.html'),worker=source('platform/worker/worker.js');
test('document studio begins with business type and recommends a short category shortlist',()=>{
 assert.match(ui,/What kind of business do you run\?/);
 for(const category of ['Electronics & gadgets','Baking, food & cafés','Electrical, repairs & construction','Fashion, beauty & salons']){
  assert.ok(ui.includes(category),category);
 }
 assert.match(ui,/sector\.templates/);
 assert.match(ui,/\.slice\(0,5\)/);
 assert.doesNotMatch(ui,/TEMPLATE_LIST\.map\(\(id,i\)=>/);
});
test('template cards and full-sized preview use the actual receipt rendering pipeline',()=>{
 assert.match(ui,/function sampleHtml\(template\)/);
 assert.match(ui,/return receipt\(sampleDocument\(template\)/);
 assert.match(ui,/template-thumbnail-inner/);
 assert.match(ui,/studio-receipt-preview/);
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

