const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
test('legacy staff accounts remain representable while new roles are supported',()=>{
 const cloud=file('business-react/src/cloud.ts');
 assert.match(cloud,/type Role='owner'\|'admin'\|'manager'\|'accountant'\|'cashier'\|'sales'\|'staff'\|'viewer'/);
 assert.match(cloud,/if\(\['owner','admin','manager','accountant'\].includes\(role\)\)listen\('expenses'\)/);
 assert.match(cloud,/!\['admin','manager','accountant','cashier','sales','viewer'\].includes\(role\)/);
});
test('cashiers cannot change other document types or finalized receipts',()=>{
 const rules=file('firestore.rules');
 assert.match(rules,/hasBusinessRole\(bid,\['cashier'\]\).*request\.resource\.data\.type/s);
 assert.match(rules,/resource\.data\.draft == true && request\.resource\.data\.type/s);
 const app=file('business-react/src/App.tsx');
 assert.match(app,/const receiptOnly=\(role:Role\)=>role==='cashier'/);
 assert.match(app,/canEditDocument\(role,d\.type,d\.draft\)/);
});
test('financial reports and expense records are restricted to financial staff',()=>{
 const rules=file('firestore.rules'),app=file('business-react/src/App.tsx');
 assert.match(rules,/allow read, write: if hasBusinessRole\(bid,\['owner','admin','manager','accountant'\]\)/);
 assert.match(app,/const canFinance=\(role:Role\)=>\['owner','admin','manager','accountant'\].includes\(role\)/);
 assert.match(app,/page==='expenses'&&finance/);
});
test('view-only members cannot read the private customer and product collections',()=>{
 const rules=file('firestore.rules');
 assert.match(rules,/match \/customers\/\{customerId\} \{\s*allow read: if businessEditor\(bid\);/);
 assert.match(rules,/match \/products\/\{productId\} \{\s*allow read: if businessEditor\(bid\);/);
});
test('role editing is an explicit owner action in the business UI',()=>{
 const app=file('business-react/src/App.tsx'),rules=file('firestore.rules');
 assert.match(app,/Change '\+m\.email\+' to '\+selected/);
 assert.match(app,/setStaffRole\(business\.id,m\.uid,selected,m\.status==='active'\)/);
 assert.match(rules,/allow update: if hasBusinessRole\(bid,\['owner'\]\)[\s\S]*?request\.resource\.data\.role in \['admin','manager','accountant','cashier','sales','staff','viewer'\]/);
});
