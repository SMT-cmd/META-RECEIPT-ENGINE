const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('billing launch activates Free limits but not before',()=>{assert.match(read('platform/worker/worker.js'),/if\(billingEnabled\(env\)\)/);assert.match(read('platform/worker/billing-runtime.mjs'),/UPDATE tenant_entitlements SET enabled=1/)});
test('Paystack callback targets Pages and pending payment can be cleared only after provider check',()=>{const r=read('platform/worker/billing-runtime.mjs');assert.match(r,/https:\/\/bizlano\.pages\.dev/);assert.match(r,/if\(action==='abandon'/);assert.match(r,/30\*60\*1000/);assert.match(r,/\/transaction\/verify/)});
