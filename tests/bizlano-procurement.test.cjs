const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('purchasing is tenant-scoped, location-aware and does not record sales',()=>{
 const sql=read('platform/migrations/0025_procurement.sql'),api=read('platform/worker/purchasing.mjs');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS business_suppliers/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS purchase_orders/);
 assert.match(sql,/AFTER UPDATE OF status ON purchase_orders/);
 assert.match(sql,/OLD.status='draft' AND NEW.status='received'/);
 assert.match(sql,/UPDATE products SET stock_milli=stock_milli\+/);
 assert.match(sql,/product_location_stock/);
 assert.match(api,/WHERE tenant_id=\? AND id=\?/);
 assert.match(api,/INSERT INTO purchase_orders/);
 assert.match(api,/staff_location_scopes/);
 assert.doesNotMatch(api,/INSERT INTO documents|INSERT INTO payments|marketplace_feed_events/);
});
test('procurement is in worker bundle and dashboard',()=>{
 assert.match(read('platform/worker/build.mjs'),/read\('purchasing.mjs'\)/);
 assert.match(read('platform/worker/client.js'),/function purchases\(\)/);
 assert.match(read('platform/worker/worker.js'),/return purchasingAPI\(req,env,user,t,resource\)/);
});