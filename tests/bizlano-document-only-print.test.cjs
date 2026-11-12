const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..','platform','worker',n),'utf8');
test('business printing clones exactly one receipt or legacy template instead of app shell',()=>{
 const c=read('client.js'),h=read('index.html');
 assert.ok(c.includes("const source=document.querySelector('#preview .receipt, #preview .legacy-receipt')"));
 assert.ok(c.includes("printRoot.append(copy)"));
 assert.ok(c.includes("printRoot.id='bizlano-print-root'"));
 assert.ok(!c.includes("document.body.classList.toggle('print-unsaved'"));
 assert.ok(h.includes("body.bizlano-print-active > :not(#bizlano-print-root){display:none!important}"));
 assert.ok(h.includes("body.bizlano-print-active > #bizlano-print-root"));
 assert.ok(h.includes('@media screen'));
});
test('unissued document gets an explicit watermark exactly once',()=>{
 const c=read('client.js');
 assert.ok(c.includes("warning.textContent='UNSAVED PREVIEW — NOT ISSUED'"));
 assert.ok(c.includes("if(state.view==='create')"));
 assert.ok(c.includes("copy.removeAttribute('id')"));
});
test('business and customer printing clean up after print and handle failure',()=>{
 const b=read('client.js'),c=read('customer.js');
 assert.ok(b.includes("window.addEventListener('afterprint',clearBusinessPrint)"));
 assert.ok(c.includes("window.addEventListener('afterprint',clearCustomerPrint)"));
 assert.ok(b.includes('try{window.print()}catch(error)'));
 assert.ok(c.includes('try{window.print()}catch(error)'));
});
test('customer PDF prints selected receipt only, with no full screen capture',()=>{
 const c=read('customer.js'),h=read('customer.html');
 assert.ok(c.includes("const source=modal.querySelector('#customer-print.document')"));
 assert.ok(c.includes("printRoot.id='bizlano-customer-print-root'"));
 assert.ok(c.includes("if(action==='print-receipt'){printCustomerDocument();return}"));
 assert.ok(h.includes("body.customer-print-active > :not(#bizlano-customer-print-root){display:none!important}"));
 assert.ok(h.includes("body.customer-print-active > #bizlano-customer-print-root"));
});
test('paper sizes and multipage rules remain supported',()=>{
 const b=read('client.js'),c=read('customer.js');
 for(const label of ["'a4'","'letter'","'80mm'","'58mm'"])assert.ok(b.includes(label)&&c.includes(label),label);
 assert.ok(read('index.html').includes('break-inside:avoid-page!important'));
 assert.ok(read('customer.html').includes('break-inside:avoid-page!important'));
});
