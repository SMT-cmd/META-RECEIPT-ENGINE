const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ui=get('platform/worker/client.js'),css=get('platform/worker/index.html'),api=get('platform/worker/worker.js');
const catalog=JSON.parse(get('platform/worker/legacy-templates-map.json'));
test('historical August 2026 collection restores all 35 original IDs without changing modern IDs',()=>{
 assert.equal(Object.keys(catalog).length,35);
 const id=api.match(/const HERITAGE_TEMPLATE_IDS=(\[[^\n]+\]);/);
 assert.ok(id);
 assert.deepEqual(JSON.parse(id[1]).sort(),Object.keys(catalog).sort());
 for(const key of Object.keys(catalog))assert.ok(css.includes('.legacy-receipt.tpl-'+key.slice(9)),'missing historical styling '+key);
 for(const name of ['japanese-minimal','swiss-design','garage-workshop','bakery-sweet'])assert.ok(catalog['heritage-'+name]);
});
test('original Swiss and Japanese preserve structural differences, not just colours',()=>{
 assert.match(ui,/class="heritage-rail"/);
 assert.match(ui,/class="heritage-main"/);
 assert.match(css,/tpl-swiss-design \.heritage-rail \.brand-name \{ writing-mode: vertical-rl/);
 assert.match(css,/tpl-japanese-minimal \.brand-block \{ writing-mode: vertical-rl/);
 assert.match(css,/tpl-garage-workshop.*background: #1a1a1a/s);
 assert.match(ui,/heritageReceipt\(doc,number,stored,style\)/);
});
test('four-stage flow separates business, layout, colour and font, completion',()=>{
 assert.match(ui,/guidedSteps\(\['Your business','Choose a design','Make it yours','Finish'\],step\)/);
 for(const n of ['STEP 1 OF 4','STEP 2 OF 4','STEP 3 OF 4','STEP 4 OF 4'])assert.ok(ui.includes(n),n);
 assert.match(ui,/Explore all '\+templateCatalogCount\+' designs/);
 assert.match(ui,/data-preview-template/);
 assert.match(ui,/studio-final-preview/);
 assert.match(css,/\.studio-carousel\{display:flex!important/);
});
test('optional image logo and styled text logo use chosen font without requiring upload',()=>{
 assert.match(ui,/function stylizedCompanyName\(name,mode\)/);
 assert.match(ui,/class="brand-accent"/);
 assert.match(ui,/const fontCssName/);
 assert.match(ui,/Use my uploaded logo \(optional\)/);
 assert.match(ui,/No image logo\? Your business name will appear as a styled text logo/);
 assert.match(ui,/show_logo:0/);
});
test('primary + secondary colours and typography have schema and server-side validation',()=>{
 const migration=get('platform/migrations/0011_heritage_receipt_designs.sql');
 for(const key of ['secondary_color','font_family','text_logo_style'])assert.ok(migration.includes('ADD COLUMN '+key),key);
 assert.match(ui,/secondaryColor:val\(form,'secondaryColor'\)/);
 assert.match(ui,/fontFamily:val\(form,'fontFamily'\)/);
 assert.match(ui,/textLogoStyle:val\(form,'textLogoStyle'\)/);
 assert.match(api,/if\(!\['modern','editorial','mono','rounded','classic'\]\.includes\(fontFamily\)\)/);
 assert.match(api,/INSERT INTO tenant_designs\(tenant_id,template,accent,secondary_color,font_family,text_logo_style/);
});
test('legacy owner style restoration uses authenticated firebase UID, staged review, and leaves existing receipts untouched',()=>{
 assert.match(ui,/where\('owner_uid','==',auth\.currentUser\.uid\)/);
 assert.match(ui,/archive\.userUid!==auth\.currentUser\?\.uid/);
 assert.match(ui,/stageLegacyStyle\(index\)/);
 assert.match(ui,/state\.designStep=2/);
 assert.match(ui,/Your existing documents will stay unchanged/);
 assert.match(ui,/data-restore-template/);
 assert.match(ui,/readLegacyBrandConfig\(data\.config/);
 assert.match(ui,/state\.legacyArchive=archive/);
});

