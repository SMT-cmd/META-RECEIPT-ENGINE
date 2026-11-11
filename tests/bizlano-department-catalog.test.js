const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ui=fs.readFileSync(path.join(__dirname,'../platform/worker/client.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../platform/worker/index.html'),'utf8');
const modern=JSON.parse(ui.match(/const TEMPLATE_LIST=(\[[^\n]+\]);/)[1]);
const legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'../platform/worker/legacy-templates-map.json'),'utf8'));
const groupSource=ui.split('const STUDIO_DEPARTMENTS=')[1];
const groups=vm.runInNewContext('('+groupSource.slice(0,groupSource.indexOf('];')+1)+')',{});
test('every one of 71 printable layouts appears in one category carousel',()=>{
 assert.equal(groups.length,9);
 const actual=groups.flatMap(x=>x.templates);
 assert.equal(actual.length,71);
 assert.equal(new Set(actual).size,71);
 assert.deepEqual([...actual].sort(),[...modern,...Object.keys(legacy)].sort());
 assert.ok(groups.every(x=>x.templates.length>=4&&x.description&&x.name));
});
test('browse-by-category shows one complete design carousel, no long template dropdown',()=>{
 assert.match(ui,/const choices=chosenDepartment\.templates/);
 assert.match(ui,/state\.designBrowseAll\?/);
 assert.match(ui,/data-action="studio-explore"/);
 assert.match(ui,/data-action="studio-recommended"/);
 assert.match(ui,/data-design-department/);
 assert.match(ui,/studio-previous-department/);
 assert.match(ui,/studio-next-department/);
 assert.doesNotMatch(ui.slice(ui.indexOf('function designStudio(){'),ui.indexOf('function refreshStudioPreview(){')),/data-design-browse/);
 assert.match(html,/\.studio-department-tabs/);
 assert.match(html,/\.studio-carousel\{display:flex!important/);
});
test('business categories link to curated departments without omitting original August layouts',()=>{
 const pairs=ui.split('const STUDIO_INDUSTRY_DEPARTMENT=')[1].split(';')[0];
 for(const cat of ['general','electronics','bakery','retail','fashion','services','trades','health','hospitality','logistics'])assert.ok(pairs.includes(cat+':'));
 assert.ok(groups.find(x=>x.id==='creative').templates.includes('heritage-japanese-minimal'));
 assert.ok(groups.find(x=>x.id==='office').templates.includes('heritage-swiss-design'));
 assert.ok(groups.find(x=>x.id==='trades').templates.includes('heritage-garage-workshop'));
 assert.ok(groups.find(x=>x.id==='food').templates.includes('heritage-bakery-sweet'));
});
test('selection keeps carousel position and recovered designs remain available',()=>{
 assert.match(ui,/state\.designScroll=document\.getElementById\('studio-designs'\)\?\.scrollLeft/);
 assert.match(ui,/if\(track\)track\.scrollLeft=state\.designScroll/);
 assert.match(ui,/stageLegacyStyle\(index\)/);
 assert.match(ui,/departmentForTemplate\(record\.template\)/);
 assert.match(ui,/data-preview-template/);
});
