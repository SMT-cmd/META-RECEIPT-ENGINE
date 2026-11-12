const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('business templates are plan-scoped only after entitlements are active',()=>{
 const w=read('platform/worker/worker.js');const p=read('platform/worker/workspace-extra.mjs');
 assert.match(w,/async function assertTemplateAllowance\(env,tenant,template\)/);
 assert.match(w,/if\(!e\|\|e.enabled!==1\)return/);
 assert.match(w,/\.slice\(0,plan.availableDesigns\)/);
 assert.match(w,/await assertTemplateAllowance\(env,tenant,selectedTemplate\)/);
 assert.match(p,/await assertTemplateAllowance\(env,tenant,template\)/);
});
test('Pages permits verified-payment webhooks but retains regular CSRF checks',()=>{
 const p=read('platform/pages/worker.js');
 assert.match(p,/\/api\/billing\/paystack\/webhook/);
 assert.match(p,/suppliedOrigin!==original.origin/);
 assert.match(read('platform/worker/billing-runtime.mjs'),/signedPaystackEvent/);
});
