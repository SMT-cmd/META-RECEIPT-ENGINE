const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const client=read('platform/worker/client.js');
const workspace=read('platform/worker/index.html');
const customer=read('platform/worker/customer.js');
const customerHtml=read('platform/worker/customer.html');
test('long printable documents are not clipped or restricted to one page',()=>{
 assert.match(workspace,/Multi-page printing: do not clip long receipts/);
 assert.match(workspace,/\.receipt,\.legacy-receipt\s*\{[\s\S]*?break-inside:auto!important/);
 assert.match(workspace,/\.receipt table thead,\.legacy-receipt \.items-table thead\{display:table-header-group!important\}/);
 assert.match(workspace,/\.receipt table tr,\.legacy-receipt \.items-table tr\s*\{/);
 assert.match(workspace,/\.legacy-receipt\.tpl-swiss-design \.heritage-rail\{[\s\S]*?position:fixed!important/);
});
test('paper choice uses real print window for office and POS printers',()=>{
 for(const paper of ['a4','letter','80mm','58mm'])assert.ok(client.includes("'"+paper+"'"),paper);
 assert.match(client,/@page \{ size: 80mm 297mm; margin: 3mm; \}/);
 assert.match(client,/@page \{ size: 58mm 297mm; margin: 2\.5mm; \}/);
 assert.match(client,/function printDocument\(\)/);
 assert.match(client,/window\.print\(\)/);
 assert.match(client,/data-print-paper/);
 assert.match(client,/Bluetooth, USB, Wi-Fi or POS printer/);
 assert.match(client,/pair the printer in your phone or computer settings/);
});
test('unsaved document previews cannot appear as issued receipts',()=>{
 assert.match(client,/state\.view==='create'&&state\.docStep!==4/);
 assert.match(client,/print-unsaved/);
 assert.match(workspace,/UNSAVED PREVIEW — NOT ISSUED/);
});
test('public customer receipts also paginate and expose paper sizes',()=>{
 assert.match(customerHtml,/Customer downloads use the same multi-page print rules/);
 assert.match(customerHtml,/\.document thead\{display:table-header-group!important\}/);
 assert.match(customerHtml,/\.document table tr\{break-inside:avoid-page!important/);
 assert.match(customer,/data-receipt-paper/);
 assert.match(customer,/function setCustomerPaper\(value\)/);
 assert.match(customer,/Print \/ Save PDF/);
 assert.match(customer,/window\.print\(\)/);
});

