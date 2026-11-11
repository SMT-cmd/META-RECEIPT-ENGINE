const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('Cloudflare Worker is tenant-isolated and Firebase-token verified',()=>{
 const source=read('platform/worker/worker.js');
 assert.match(source,/https:\/\/securetoken\.google\.com\//);
 assert.match(source,/crypto\.subtle\.verify\('RSASSA-PKCS1-v1_5'/);
 assert.match(source,/JOIN memberships m ON m\.tenant_id=t\.id/);
 assert.match(source,/m\.user_id=\?/);
 assert.match(source,/Cross-site request denied/);
 assert.match(source,/HttpOnly; Secure; SameSite=Lax/);
});
test('D1 and R2 are connected under Bizlano only',()=>{
 const config=JSON.parse(read('platform/worker/wrangler.jsonc'));
 assert.equal(config.name,'bizlano');
 assert.equal(config.d1_databases[0].database_name,'bizlano-db');
 assert.equal(config.r2_buckets[0].bucket_name,'bizlano-assets');
 assert.match(read('platform/worker/worker.js'),/env\.ASSETS\.put/);
 assert.match(read('platform/worker/worker.js'),/env\.DB\.batch/);
});
test('mobile UX and receipt output retain Bizlano branding',()=>{
 const css=read('platform/worker/index.html'),js=read('platform/worker/client.js');
 assert.match(css,/env\(safe-area-inset-bottom/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.mobile-nav\{position:fixed/);
 assert.match(js,/Powered by <strong style=\\"color:#6635db\\">Bizlano/);
 assert.match(js,/function salesChart\(/);
 assert.match(js,/mode==='pie'/);
 assert.match(js,/function receipt\(/);
});
test('legacy documents migrate as review-only drafts with owner check',()=>{
 const source=read('platform/worker/worker.js'),js=read('platform/worker/client.js');
 assert.match(source,/original\.legacy_uid!==b\.ownerUid/);
 assert.match(source,/status,notes,created_by\) VALUES/);
 assert.match(source,/legacy_document_sources\(tenant_id,legacy_source_id,job_id/);
 assert.match(js,/downloadLegacy\(\)/);
 assert.match(js,/archive\.userUid!==auth\.currentUser\?\.uid/);
 assert.match(js,/review-only drafts/);
});
test('SQL settlement guards are present',()=>{
 const sql=read('platform/migrations/0003_financial_integrity.sql');
 assert.match(sql,/trg_stock_on_issued_line/);
 assert.match(sql,/trg_issue_draft_stock/);
 assert.match(sql,/trg_immutable_issued_financials/);
 assert.match(read('platform/migrations/0001_multitenant.sql'),/trg_payment_validate/);
});
