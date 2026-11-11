const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');

test('at least one verified-format customer contact is required for issued documents',()=>{
 const worker=read('platform/worker/worker.js');
 assert.match(worker,/const phone=s=>/);
 assert.match(worker,/recipientEmail=b\.customerEmail\?email\(b\.customerEmail\):null,recipientPhone=phone\(b\.customerPhone\)/);
 assert.match(worker,/!recipientEmail&&!recipientPhone/);
 assert.match(worker,/recipient_name,recipient_email,recipient_phone,issued_on/);
 const form=read('platform/worker/client.js');
 assert.match(form,/Customer email/);
 assert.match(form,/Customer phone/);
 assert.match(form,/Add a customer email or phone number before issuing/);
});

test('paid marketplace receipts keep the actual contact but never grant access from phone alone',()=>{
 const worker=read('platform/worker/worker.js');
 assert.match(worker,/const recipientPhone=order\.customerPhone\?phone\(order\.customerPhone\):null/);
 assert.match(worker,/customer_contact_missing/);
 assert.match(worker,/recipient_phone,issued_on,currency/);
 const inbox=worker.slice(worker.indexOf("if(path==='/api/customer/receipts'"),worker.indexOf("const privateDetail=path.match"));
 assert.doesNotMatch(inbox,/recipient_phone=\?/);
 assert.match(inbox,/recipient_email=\? COLLATE NOCASE/);
 assert.match(inbox,/rc\.user_id IS NOT NULL/);
});

test('phone only account requires private paid receipt code matching exact phone',()=>{
 const worker=read('platform/worker/worker.js');
 const route=worker.slice(worker.indexOf("if(path==='/api/customer/phone-register'"),worker.indexOf("if(path==='/api/customer/phone-login'"));
 assert.match(route,/r\.code_hash=\?/);
 assert.match(route,/d\.recipient_phone=\?/);
 assert.match(route,/d\.paid_minor>0/);
 assert.match(route,/passwordDigest\(password,salt\)/);
 assert.match(route,/customer_receipt_claims/);
 assert.match(route,/sessionCookie\(session,604800\)/);
 assert.match(worker,/Customer-only accounts cannot access business management/);
});

test('phone accounts are password protected and sign-in attempts are bounded',()=>{
 const worker=read('platform/worker/worker.js');
 assert.match(worker,/PBKDF2/);
 assert.match(worker,/iterations:180000/);
 assert.match(worker,/limitAnonymousAttempt\(env,'phone-register'/);
 assert.match(worker,/Too many sign-in attempts/);
 assert.match(worker,/contact_phone=\? AND disabled_at IS NULL/);
 assert.match(read('platform/migrations/0008_phone_signin_alias.sql'),/UNIQUE INDEX/);
});

test('signature is opt-in, uploaded to R2 and displayed on business prints',()=>{
 const worker=read('platform/worker/worker.js'),ui=read('platform/worker/client.js');
 assert.match(worker,/resource==='signature'&&method==='POST'/);
 assert.match(worker,/\/\(logo\|signature\)\$/);
 assert.match(worker,/show_signature/);
 assert.match(ui,/name="showSignature"/);
 assert.match(ui,/data-form="signature"/);
 assert.match(ui,/state\.design\?\.show_signature/);
 assert.match(ui,/Authorized signatory/);
});

test('mobile editor provides a safe full-size description with Done and Cancel',()=>{
 const ui=read('platform/worker/client.js'),html=read('platform/worker/index.html');
 assert.match(ui,/function editorDialog/);
 assert.match(ui,/dialog\.showModal\(\)/);
 assert.match(ui,/data-action="save-expanded"/);
 assert.match(ui,/data-action="cancel-expanded"/);
 assert.match(ui,/rows="2"/);
 assert.match(ui,/list="products-data"/);
 assert.match(html,/@media\(max-width:760px\)/);
 assert.match(html,/\.editor-dialog::backdrop/);
});

test('plain-white removal stays local and never promises arbitrary background removal',()=>{
 const ui=read('platform/worker/client.js');
 assert.match(ui,/async function removeWhiteBackground\(file\)/);
 assert.match(ui,/ctx\.getImageData/);
 assert.match(ui,/canvas\.toBlob/);
 assert.match(ui,/nearWhite/);
 assert.match(ui,/solid white/);
 assert.match(ui,/transparent PNG/);
});

test('new schema additions preserve existing D1 and migration history',()=>{
 const migration=read('platform/migrations/0007_receipt_contacts_signature.sql');
 assert.match(migration,/ALTER TABLE documents ADD COLUMN recipient_phone/);
 assert.match(migration,/ALTER TABLE tenants ADD COLUMN signature_url/);
 assert.match(migration,/ALTER TABLE tenant_designs ADD COLUMN show_signature/);
 assert.match(migration,/ALTER TABLE users ADD COLUMN contact_phone/);
});
