const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('customer receipt inbox has a prominent homepage recovery path',()=>{
 const home=read('platform/worker/landing.html');
 const worker=read('platform/worker/worker.js');
 assert.match(home,/href="\/receipts">Recover your receipt/);
 assert.match(home,/href="\/receipts">Recover a receipt/);
 assert.match(worker,/p==='\/receipts'/);
 assert.match(worker,/p==='\/customer\.js'/);
});

test('customer auth is verified-email based and never requires a business membership',()=>{
 const worker=read('platform/worker/worker.js');
 const client=read('platform/worker/customer.js');
 assert.match(worker,/p\.email_verified!==true/);
 assert.match(worker,/path==='\/api\/customer\/receipts'/);
 assert.match(worker,/const user=await identity\(req,env\);/);
 assert.match(worker,/d\.recipient_email=\? COLLATE NOCASE/);
 assert.match(worker,/d\.paid_minor>0/);
 assert.doesNotMatch(worker,/path==='\/api\/customer\/receipts'[^]*?await member\(env,user,/);
 assert.match(client,/const auth=getAuth\(app\)/);
 assert.match(client,/state\.user\.emailVerified/);
});

test('customer cannot enumerate receipts by someone else name or product',()=>{
 const worker=read('platform/worker/worker.js');
 const section=worker.slice(worker.indexOf("if(path==='/api/customer/receipts'"),worker.indexOf('const privateDetail=path.match'));
 assert.match(section,/user\.email\.toLowerCase\(\)/);
 assert.doesNotMatch(section,/WHERE[^]*?recipient_name\s*=\s*\?/i);
 assert.match(section,/nextCursor/);
 assert.match(section,/LIMIT 51/);
});

test('receipt recovery codes are private hashed proofs and rate limited',()=>{
 const sql=read('platform/migrations/0005_customer_receipt_recovery.sql');
 const worker=read('platform/worker/worker.js');
 assert.match(sql,/code_hash TEXT NOT NULL UNIQUE/);
 assert.match(sql,/recovery_attempts/);
 assert.match(worker,/env\.RECEIPT_RECOVERY_KEY/);
 assert.match(worker,/crypto\.subtle\.sign\('HMAC'/);
 assert.match(worker,/INSERT OR IGNORE INTO customer_receipt_claims/);
 assert.match(worker,/Too many attempts/);
 assert.match(worker,/r\.revoked_at IS NULL/);
});

test('receipt issue stores buyer email and shows recovery code in print',()=>{
 const worker=read('platform/worker/worker.js'),vendor=read('platform/worker/client.js');
 assert.match(worker,/recipient_email,issued_on/);
 assert.match(worker,/b\.customerEmail\?email\(b\.customerEmail\):null/);
 assert.match(worker,/emailAddress,issueDate/);
 assert.match(vendor,/Customer email for receipt recovery/);
 assert.match(vendor,/doc\.recoveryCode/);
 assert.match(vendor,/Powered by <strong/);
});

test('dedicated customer portal is mobile-first and never creates a business',()=>{
 const html=read('platform/worker/customer.html'),client=read('platform/worker/customer.js');
 assert.match(html,/@media\(max-width:480px\)/);
 assert.match(html,/@media print/);
 assert.match(client,/Create your free account/);
 assert.match(client,/data-action="load-more"/);
 assert.match(client,/View \/ Save PDF/);
 assert.doesNotMatch(client,/\/businesses/);
});

test('business subdomain points to main customer account; staff entry is separate',()=>{
 const worker=read('platform/worker/worker.js');
 assert.match(worker,/\/receipts\?business=/);
 assert.match(worker,/\/app\?biz=/);
 assert.match(worker,/Lost your receipt\?/);
 assert.match(worker,/https:\/\/bizlano\.pages\.dev/);
});
