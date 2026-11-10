const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const legacy=require('../upgrade/legacy.js');

function storage(values){
  const entries=Object.entries(values);
  return {length:entries.length,key:i=>entries[i]?.[0]??null,
    getItem:key=>values[key]??null,setItem:(k,v)=>{values[k]=v}};
}
function sample(){
  return {id:'receiptx',date:'2026-11-10',customer:'Ada Stores',total:'1,500',
    type:'RECEIPT',data:{address:'Lagos',items:[{desc:'Bags',qty:3,price:'500'}]}};
}
function empty(){
  return {schemaVersion:1,profile:{name:'My Business',currency:'NGN'},
    documents:[],customers:[],products:[],expenses:[],audit:[]};
}
test('only collects structurally valid legacy history keys',()=>{
  const local=legacy.readLocal(storage({
    'Ada_Stores_history':JSON.stringify([sample()]),
    'site_theme_history':JSON.stringify(['red','blue']),
    'unreadable_history':'{invalid'
  }));
  assert.equal(local.histories.length,1);
  assert.equal(local.histories[0].brandName,'Ada Stores');
  assert.equal(local.errors.length,1);
});
test('copies old data without counting guessed receipts as revenue',()=>{
  const local=legacy.readLocal(storage({'Ada_Stores_history':JSON.stringify([sample()])}));
  const archive=legacy.archiveFor({uid:'firebase-123',email:'ada@example.com'},[],null,local,[]);
  const current=empty();
  const {result,preview}=legacy.migrateArchive(archive,current,{businessName:'Ada Stores'});
  assert.equal(preview.importable,1);
  assert.equal(current.documents.length,0,'the source workspace must not be mutated');
  assert.equal(result.profile.name,'Ada Stores');
  const doc=result.documents[0];
  assert.equal(doc.draft,true);
  assert.equal(doc.paid,0);
  assert.equal(doc.items[0].qty,3);
  assert.equal(doc.items[0].price,500);
  assert.match(doc.notes,/REVIEW BEFORE ISSUING/);
  assert.match(doc.notes,/Original displayed total: 1,500/);
  assert.equal(legacy.summarize(archive).localReceipts,1);
});
test('import is idempotent and preserves existing business documents',()=>{
  const raw=legacy.archiveFor({uid:'user42',email:''},[
    {code:'ABC123',brandName:'Shop',receipts:[sample()]}],null,{histories:[],metadata:{},errors:[]},[]);
  const original=empty();original.documents.push({id:'original',number:'INV-1'});
  const imported=legacy.migrateArchive(raw,original);
  const again=legacy.migrateArchive(raw,imported.result);
  assert.equal(imported.preview.importable,1);
  assert.equal(again.preview.importable,0);
  assert.equal(again.result.documents.length,2);
  assert.equal(again.result.documents[0].id,'original');
});
test('unverifiable historical totals are preserved in backup but not fabricated into invoices',()=>{
  const incomplete={id:'bad',customer:'Client',type:'RECEIPT',total:'5000',data:{items:[]}};
  const archive=legacy.archiveFor({uid:'user42'},[
    {code:'AAA111',brandName:'Old Shop',receipts:[incomplete]}],null,{histories:[],metadata:{},errors:[]},[]);
  const result=legacy.migrateArchive(archive,empty());
  assert.equal(result.preview.importable,0);
  assert.equal(result.preview.skipped,1);
  assert.equal(archive.engines[0].receipts[0].total,'5000');
});
test('rejects incompatible backup format rather than overwriting the workspace',()=>{
  assert.throws(()=>legacy.migrateArchive({kind:'unknown',version:1},empty()),/compatible/i);
  assert.throws(()=>legacy.migrateArchive({kind:'metaforge-legacy',version:99},empty()),/compatible/i);
});
test('legacy sign-in pages expose voluntary review option',()=>{
  const root=path.resolve(__dirname,'..');
  for(const page of ['creator/index.html','engine/index.html']){
    assert.match(fs.readFileSync(path.join(root,page),'utf8'),/src="\.\.\/upgrade\/banner\.js"/);
  }
  assert.match(fs.readFileSync(path.join(root,'upgrade/index.html'),'utf8'),/Download my backup/);
});
