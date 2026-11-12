const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const bill=()=>import('../platform/worker/subscription.mjs');
test('five tiers retain agreed limits and pricing without turning on payments',async()=>{
 const b=await bill();
 assert.equal(b.BILLING_LIVE,false);
 assert.deepEqual(b.PLANS.map(p=>p.id),['free','lite','standard','business','business-max']);
 assert.deepEqual(b.PLANS.map(p=>p.priceNGN.yearly),[0,9600,23000,47000,85000]);
 assert.deepEqual(b.PLANS.map(p=>p.monthlyTransactions),[30,150,600,2500,10000]);
 assert.deepEqual(b.PLANS.map(p=>p.designProfiles),[1,2,4,8,20]);
 assert.equal(b.publicBillingCatalogue().pricesAreProposed,true);
});
test('GWS discount preview uses monthly list rate and cannot stack term discounts',async()=>{
 const b=await bill();
 assert.equal(b.proposedQuote('standard','yearly').amountNGN,23000);
 assert.equal(b.proposedQuote('standard','yearly',{verifiedGwsPaidVendor:true}).amountNGN,14400);
 assert.equal(b.proposedQuote('standard','monthly',{verifiedGwsPaidVendor:true}).amountNGN,1200);
 assert.equal(b.proposedQuote('free','yearly',{verifiedGwsPaidVendor:true}).amountNGN,0);
 assert.equal(b.proposedQuote('business-max','quarterly',{verifiedGwsPaidVendor:true}).payable,false);
 assert.throws(()=>b.proposedQuote('nonexistent','yearly'),RangeError);
});
test('usage periods reset on Lagos midnight and year boundaries',async()=>{
 const b=await bill();
 assert.equal(b.lagosUsagePeriod('2026-12-31T22:59:59Z'),'2026-12');
 assert.equal(b.lagosUsagePeriod('2026-12-31T23:00:00Z'),'2027-01');
 assert.equal(b.lagosNextReset('2026-12-31T22:00:00Z'),'2026-12-31T23:00:00.000Z');
 assert.equal(b.lagosNextReset('2027-02-10T20:00:00Z'),'2027-02-28T23:00:00.000Z');
});
test('billing endpoint is owner-only and read-only; build bundles catalogue',()=>{
 const worker=read('platform/worker/worker.js'),client=read('platform/worker/client.js');
 const build=read('platform/worker/build.mjs');
 assert.match(worker,/if\(resource==='billing'\)/);
 assert.match(worker,/await member\(env,user,slug,'owner'\)/);
 assert.match(worker,/if\(method!=='GET'\)fail\(405/);
 assert.match(client,/function billing\(\)/);
 assert.match(client,/v==='billing'\)return state\.biz\?\.role==='owner'/);
 assert.match(build,/read\('subscription\.mjs'\)\.replace/);
});