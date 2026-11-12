const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('business locations and supplier inventory are migrated',()=>{
 const a=read('platform/migrations/0021_business_organization.sql'),b=read('platform/migrations/0025_procurement.sql');
 for(const n of ['business_arms','business_locations','product_location_stock','stock_transfers'])assert.ok(a.includes(n));
 for(const n of ['business_suppliers','purchase_orders','purchase_order_lines','trg_purchase_receive_stock'])assert.ok(b.includes(n));
});
test('payment confirmation remains tied to one real payment',()=>{
 assert.match(read('platform/migrations/0024_payment_confirmations.sql'),/UNIQUE\(tenant_id,payment_id\)/);
 assert.match(read('platform/worker/worker.js'),/resource==='payment-confirmations'/);
});
test('billing remains disabled even with deployed source',()=>{
 assert.match(read('platform/worker/subscription.mjs'),/BILLING_LIVE = false/);
 assert.match(read('platform/worker/billing-runtime.mjs'),/BILLING_LIVE&&env\.BIZLANO_BILLING_APPROVED==='yes'/);
});
test('all new modules are bundled and cron is configured',()=>{
 const build=read('platform/worker/build.mjs');
 for(const name of ['subscription.mjs','workspace-extra.mjs','billing-runtime.mjs','purchasing.mjs'])assert.ok(build.includes("read('"+name+"')"));
 assert.deepEqual(JSON.parse(read('platform/worker/wrangler.jsonc')).triggers.crons,['0 8 * * *']);
});