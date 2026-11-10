const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('React business overview includes selectable analytics with monthly goals',()=>{
 const app=read('business-react/src/App.tsx');
 const chart=read('business-react/src/SalesInsights.tsx');
 assert.match(app,/import \{SalesInsights\} from '\.\/SalesInsights'/);
 assert.match(app,/<SalesInsights businessId=\{business\.id\}/);
 assert.match(chart,/type Chart='line'\|'bar'\|'pie'/);
 assert.match(chart,/type Span=7\|30\|90/);
 assert.match(chart,/BILLABLE_TYPES\.has\(d\.type\)/);
 assert.match(chart,/!d\.draft&&!d\.voided/);
 assert.match(chart,/role/);
});
test('monthly targets are saved per business and guarded by database permissions',()=>{
 const chart=read('business-react/src/SalesInsights.tsx');
 const rules=read('firestore.rules');
 assert.match(chart,/doc\(db,'businesses',businessId,'targets',month\)/);
 assert.match(rules,/match \/targets\/\{monthId\}/);
 assert.match(rules,/hasBusinessRole\(bid, \['owner','admin','manager'\]\)/);
 assert.match(rules,/request\.resource\.data\.month == monthId/);
 assert.match(rules,/request\.resource\.data\.updatedBy == request\.auth\.uid/);
});
test('Firestore rules are not malformed by duplicate tenant blocks',()=>{
 const rules=read('firestore.rules');
 assert.equal((rules.match(/function tenantSignedIn\(/g)||[]).length,1);
 assert.equal((rules.match(/match \/targets\/\{monthId\}/g)||[]).length,1);
 assert.equal((rules.match(/{/g)||[]).length,(rules.match(/}/g)||[]).length);
 assert.match(rules,/match \/receipts\/\{docId\}[\s\S]*?short_urls\/\$\(shortCode\)/);
});
test('future migration mapping cannot silently overwrite legacy ownership',()=>{
 const sql=read('platform/migrations/0002_legacy_identity.sql');
 assert.match(sql,/PRIMARY KEY\(provider,legacy_uid\)/);
 assert.match(sql,/UNIQUE\(tenant_id,source_platform,archive_hash\)/);
 assert.match(sql,/raw source backups/i);
});
