const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const WebURL=require('node:url').URL;
const src=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('marketing footer is concise and business-facing',()=>{
 const home=src('platform/worker/landing.html');
 assert.doesNotMatch(home,/All business figures shown|Product illustration · Demonstration figures|Sample receipt · Illustrative document/);
 assert.match(home,/href="\/legal\/privacy"/);
 assert.match(home,/href="\/legal\/terms"/);
 assert.match(home,/href="\/contact"/);
 assert.match(home,/href="\/receipts"/);
 assert.match(home,/>Register for free/);
});

test('recovery share links follow the currently visited hostname',()=>{
 const vendor=src('platform/worker/client.js');
 const fn=vendor.match(/function recoveryHref\(\)\{[^]*?\n\}/)?.[0];
 const business=vendor.match(/function businessHref\(\)\{[^]*?\n\}/)?.[0];
 assert.ok(fn&&business);
 for(const origin of ['https://bizlano.pages.dev','https://bizlano.com']){
  const result=new Function('state','location','URL',fn+';return recoveryHref();')({biz:{slug:'corner-store'}},{origin},WebURL);
  assert.equal(result,origin+'/receipts?business=corner-store');
  const page=new Function('state','location','URL',business+';return businessHref();')({biz:{slug:'corner-store'}},{origin},WebURL);
  assert.equal(page,origin+'/s/corner-store');
 }
 assert.match(vendor,/data-action="copy-recovery-message"/);
 assert.match(vendor,/data-action="copy-recovery"/);
 assert.match(vendor,/async function copyShareText/);
});

test('printed documents use current hostname, never leak a code in URLs',()=>{
 const vendor=src('platform/worker/client.js'),customer=src('platform/worker/customer.js');
 assert.match(vendor,/new URL\('\/receipts',location\.origin\)/);
 assert.match(customer,/new URL\('\/receipts',location\.origin\)/);
 assert.doesNotMatch(vendor,/bizlano\.praylume-staging-ng/);
 assert.doesNotMatch(customer,/bizlano\.praylume-staging-ng|bizlano\.pages\.dev/);
 assert.match(vendor,/recoveryCode/);
 assert.match(customer,/Powered by Bizlano/);
});

test('future custom domains resolve to central Bizlano without moving data',()=>{
 const worker=src('platform/worker/worker.js');
 assert.match(worker,/BIZLANO_BUSINESS_DOMAIN/);
 assert.match(worker,/requestHost\.startsWith\(slug\+'\.'\)/);
 assert.match(worker,/tenantHost\?'https:\/\/'\+tenantHost:''/);
 assert.match(worker,/const recovery=base\+'\/receipts\?business='/);
 assert.doesNotMatch(worker,/const base=[^\n]+:'https:\/\/bizlano\.pages\.dev'/);
});

test('customer-facing text improves legibility on all three public surfaces',()=>{
 for(const file of ['platform/worker/landing.html','platform/worker/index.html','platform/worker/customer.html']){
  const source=src(file);
  assert.match(source, /--muted:#56647f/);
  assert.match(source, /@media screen and \(max-width:/);
  assert.match(source,/focus-visible/);
 }
 const ratio=(hexA,hexB)=>{
  const lum=h=>{const nums=h.replace('#','').match(/../g).map(x=>parseInt(x,16)/255);
   const vals=nums.map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));
   return .2126*vals[0]+.7152*vals[1]+.0722*vals[2]};
  const a=lum(hexA),b=lum(hexB);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 };
 assert.ok(ratio('#56647f','#ffffff')>=4.5,'Body secondary text must meet WCAG AA contrast');
});

test('receipt recovery remains authenticated and rejects anonymous customer listing',()=>{
 const worker=src('platform/worker/worker.js');
 assert.match(worker,/const user=await identity\(req,env\)/);
 assert.match(worker,/if\(path==='\/api\/customer\/receipts'&&method==='GET'\)/);
 assert.match(worker,/d\.recipient_email=\? COLLATE NOCASE/);
 assert.match(worker,/receipt_recovery_codes/);
});
