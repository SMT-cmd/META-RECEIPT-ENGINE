const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../business/core.js');
const root = path.resolve(__dirname, '..');
function doc(overrides={}) {
  return {type:'invoice',number:'INV-2026-0001',date:'2026-11-10',
    items:[{description:'Boxes',qty:2,price:250.25},{description:'Delivery item',qty:1,price:100}],
    discountPct:10,taxPct:7.5,shipping:100,paid:300,...overrides};
}
test('has multiple industry-specific document purposes and presentation styles',()=>{
  assert.equal(C.DOCUMENT_TYPES.length,28);
  assert.equal(new Set(C.DOCUMENT_TYPES.map(t=>t.id)).size,28);
  assert.equal(C.STYLES.length,12);
  assert.equal(new Set(C.STYLES.map(t=>t.id)).size,12);
  assert.ok(C.DOCUMENT_TYPES.some(t=>t.id==='thermal-receipt'));
  assert.ok(C.DOCUMENT_TYPES.some(t=>t.id==='credit-note'));
});
test('totals remain in two-decimal currency units',()=>{
  const result=C.calculate(doc());
  assert.deepEqual({
    subtotal:result.subtotal,discount:result.discount,tax:result.tax,shipping:result.shipping,
    total:result.total,paid:result.paid,balance:result.balance
  },{subtotal:600.5,discount:60.05,tax:40.53,shipping:100,total:680.98,paid:300,balance:380.98});
});
test('rejects invalid, negative and overpaid records',()=>{
  assert.throws(()=>C.calculate(doc({items:[]})),/item/i);
  assert.throws(()=>C.calculate(doc({items:[{description:'',qty:1,price:1}]})),/item/i);
  assert.throws(()=>C.calculate(doc({items:[{description:'Tea',qty:-1,price:20}]})),/quantity/i);
  assert.throws(()=>C.calculate(doc({items:[{description:'Tea',qty:1,price:-20}]})),/price/i);
  assert.throws(()=>C.calculate(doc({taxPct:101})),/rate/i);
  assert.throws(()=>C.calculate(doc({discountPct:-1})),/rate/i);
  assert.throws(()=>C.calculate(doc({paid:50000})),/exceed/i);
});
test('distinguishes drafts, issued quotes, paid, part-paid and overdue invoices',()=>{
  assert.equal(C.status(doc({draft:true})),'Draft');
  assert.equal(C.status(doc({type:'quotation',paid:0})),'Issued');
  assert.equal(C.status(doc({paid:300})),'Part-paid');
  assert.equal(C.status(doc({paid:680.98})),'Paid');
  assert.equal(C.status(doc({paid:0,dueDate:'2020-01-01'})),'Overdue');
  assert.equal(C.status(doc({voided:true})),'Voided');
});
test('numbers are type-specific and do not recycle existing series',()=>{
  assert.equal(C.numberFor([{number:'INV-2026-0001'},{number:'INV-2026-0011'},{number:'REC-2026-0040'}],'invoice','2026-11-10'),'INV-2026-0012');
  assert.equal(C.numberFor([{number:'INV-2026-0001'}],'receipt','2026-11-10'),'REC-2026-0001');
});
test('reports exclude drafts, quotes and voided documents',()=>{
  const result=C.summary([doc({draft:true}),doc({type:'quotation',paid:0}),doc({voided:true}),doc({paid:680.98})],[{amount:50},{amount:100}]);
  assert.deepEqual(result,{invoiced:680.98,collected:680.98,outstanding:0,expenses:150,cashAfterExpenses:530.98,count:1});
});
test('escapes HTML and properly quotes CSV export',()=>{
  assert.equal(C.escapeHtml('<b title="x">&</b>'),'&lt;b title=&quot;x&quot;&gt;&amp;&lt;/b&gt;');
  assert.equal(C.csv([['a,b','say "hi"'],['line\nbreak','x']]),'"a,b","say ""hi"""\r\n"line\nbreak","x"');
});
test('new business workspace is linked without replacing the existing creator',()=>{
  const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const page=fs.readFileSync(path.join(root,'business/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'business/app.js'),'utf8');
  assert.match(home,/href="business\/"/);
  assert.match(page,/src="core\.js"/);
  assert.match(page,/src="app\.js"/);
  assert.match(page,/href="\.\.\/metaforge-icon\.svg"/);
  assert.ok(fs.existsSync(path.join(root,'creator/index.html')));
  const ids=new Set([...page.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  const refs=new Set([...app.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]));
  for(const name of refs)assert.ok(ids.has(name)||name==='catalogItems'||name==='printableDocument','Missing DOM element #'+name);
});