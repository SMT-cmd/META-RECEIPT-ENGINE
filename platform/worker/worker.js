import {html,landing,client,icon,customerHtml,customerJs} from './ui.js';
const project='metaforge-6afdf';
const issuer='https://securetoken.google.com/'+project;
const jwks='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const billable=new Set(['receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice']);
const receiptTypes=new Set(['receipt','cash-sale','retail-receipt','thermal-receipt','service-receipt','rent-receipt','school-fees','medical-receipt']);
const types=new Set([...billable,'quotation','estimate','proforma','purchase-order','delivery-note','credit-note','debit-note','custom']);
const DESIGN_INDUSTRIES=new Set(['general','electronics','bakery','retail','fashion','services','trades','health','hospitality','logistics']);
const HERITAGE_TEMPLATE_IDS=["heritage-modern-tech","heritage-minimalist-pro","heritage-corporate-luxe","heritage-legal-professional","heritage-cyber-punk","heritage-retro-wave","heritage-neo-brutalist","heritage-startup-modern","heritage-royal-elegance","heritage-art-deco","heritage-fashion-boutique","heritage-hotel-resort","heritage-clean-air","heritage-swiss-design","heritage-japanese-minimal","heritage-compact-slip","heritage-midnight-special","heritage-garage-workshop","heritage-bold-stripe","heritage-fitness-gym","heritage-pharmacy-medical","heritage-bakery-sweet","heritage-nature-organic","heritage-salon-beauty","heritage-restaurant-diner","heritage-construction-industrial","heritage-education-academy","heritage-transport-logistics","heritage-real-estate","heritage-event-planning","heritage-curved-organic","heritage-geometric-slice","heritage-vintage-ticket","heritage-futuristic-glass","heritage-stamp-quality"];
const TEMPLATES=new Set(["signature","classic","executive","retail","thermal","minimal","editorial","bold","artisan","medical","education","hospitality","luxury","corporate","ledger","modern","boutique","monochrome","festival","restaurant","grocery","service","legal","real-estate","logistics","salon","artisan-paper","gradient","formal","event","digital","wholesale","startup","premium-dark","emerald","sapphire",...HERITAGE_TEMPLATE_IDS]);
const roles=['owner','admin','manager','accountant','cashier','sales','viewer'];
const access={view:roles,edit:['owner','admin','manager','accountant','cashier','sales'],stock:['owner','admin','manager'],finance:['owner','admin','manager','accountant'],admin:['owner','admin'],owner:['owner']};
const reserved=['www','api','auth','app','admin','billing','support','bizlano','metaforge','timi'];
const baseHeaders={'cache-control':'no-store','x-content-type-options':'nosniff'};
class ErrorWithStatus extends Error {constructor(code,message){super(message);this.code=code}}
function fail(code,message){throw new ErrorWithStatus(code,message)}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{...baseHeaders,'x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','content-type':'application/json; charset=utf-8',...headers}})}
const dec=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const str=bytes=>new TextDecoder().decode(bytes);
const hex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
const rnd=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
async function hash(s){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))))}
const field=(s,name,max=160)=>{if(typeof s!=='string'||!s.trim()||s.length>max)fail(400,'Invalid '+name);return s.trim()};
const email=s=>{s=field(s,'email',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))fail(400,'Invalid email');return s};
const phone=s=>{const v=String(s||'').trim();if(!v)return null;const n=v.replace(/[\s().-]/g,'');if(/^0[789][01]\d{8}$/.test(n))return '+234'+n.slice(1);if(/^234[789][01]\d{8}$/.test(n))return '+'+n;if(/^\+[1-9]\d{7,14}$/.test(n))return n;fail(400,'Enter a valid phone number, including the country code if outside Nigeria')};
const cents=v=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e11)fail(400,'Invalid amount');return Math.round(n*100)};
const milli=v=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e7)fail(400,'Invalid quantity');return Math.round(n*1000)};
const slugValid=s=>/^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/.test(s)&&!reserved.includes(s);
const dateValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s);
const day=()=>new Date().toISOString().slice(0,10);
async function input(req){const text=await req.text();if(text.length>200000)fail(413,'Request too large');try{return JSON.parse(text)}catch{fail(400,'Invalid JSON')}}
let certCache={at:0,keys:[]};
async function verifyFirebase(token){
 if(typeof token!=='string'||token.length>12000)fail(401,'Invalid sign-in');
 const parts=token.split('.');if(parts.length!==3)fail(401,'Invalid sign-in');
 let h,p;try{h=JSON.parse(str(dec(parts[0])));p=JSON.parse(str(dec(parts[1])))}catch{fail(401,'Invalid sign-in')}
 const now=Math.floor(Date.now()/1000);
 if(h.alg!=='RS256'||!h.kid||p.iss!==issuer||p.aud!==project||
  typeof p.sub!=='string'||!p.sub||p.sub.length>128||p.email_verified!==true||
  p.exp<=now||p.iat>now+60||p.auth_time>now+60||!p.email)fail(401,'Verify your Firebase email first');
 if(Date.now()-certCache.at>1800000){
  const r=await fetch(jwks,{cf:{cacheTtl:1800}});
  if(!r.ok)fail(503,'Firebase verification is unavailable');
  const body=await r.json();if(!Array.isArray(body.keys))fail(503,'Identity keys unavailable');
  certCache={at:Date.now(),keys:body.keys};
 }
 const key=certCache.keys.find(k=>k.kid===h.kid&&k.kty==='RSA');
 if(!key)fail(401,'Unknown Firebase signing key');
 const cryptoKey=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',cryptoKey,dec(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))fail(401,'Invalid Firebase signature');
 return {uid:p.sub,email:email(p.email),name:String(p.name||p.email.split('@')[0]).slice(0,100)};
}
const sessionCookie=(value,age)=>'bizlano_session='+value+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age='+age;
function sessionToken(req){return req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('bizlano_session='))?.split('=')[1]||''}
async function identity(req,env){
 const token=sessionToken(req);if(!/^[a-f0-9]{64}$/.test(token))fail(401,'Sign in to continue');
 const user=await env.DB.prepare("SELECT u.id,u.email,u.display_name,u.contact_phone FROM sessions s JOIN users u ON s.user_id=u.id WHERE token_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL AND u.disabled_at IS NULL").bind(await hash(token)).first();
 if(!user)fail(401,'Your session has expired. Sign in again.');
 return user;
}
async function member(env,user,slug,perm='view'){
 if(!slugValid(slug))fail(404,'Unknown business address');
 const t=await env.DB.prepare("SELECT t.id,t.slug,t.business_name,t.currency,t.logo_url,t.brand_color,m.role FROM tenants t JOIN memberships m ON m.tenant_id=t.id WHERE t.slug=? AND m.user_id=? AND m.disabled_at IS NULL AND t.disabled_at IS NULL").bind(slug,user.id).first();
 if(!t)fail(403,'You do not belong to this business');
 if(!access[perm].includes(t.role))fail(403,'Your role does not permit that action');
 return t;
}
const cashier=(t,kind)=>{if(t.role==='cashier'&&!receiptTypes.has(kind))fail(403,'Cashier may only issue receipts')};
async function audit(env,t,u,action,id){await env.DB.prepare('INSERT INTO audit_events(id,tenant_id,user_id,action,resource_type,resource_id) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),t,u.id,action,'bizlano',id).run()}

function legalPage(path){
 const page=legalPages[path];if(!page)return null;
 const safe=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'' :'&#39;'}[c]));
 const blocks=page.sections.map(section=>'<section class="legal-section"><h2>'+safe(section[0])+'</h2>'+section.slice(1).map(t=>'<p>'+safe(t)+'</p>').join('')+'</section>').join('');
 const form=(path==='/contact'||path==='/help')?'<section class="legal-section" id="contact-form"><h2>Send a message</h2><form id="contact-form-fields"><label>Topic<select name="topic"><option value="support">General support</option><option value="privacy">Privacy request</option><option value="security">Security concern</option><option value="billing">Business documents</option></select></label><label>Your email<input name="email" required type="email" maxlength="254" autocomplete="email"></label><label>How can we help?<textarea name="message" required minlength="12" maxlength="3000" rows="5"></textarea></label><button type="submit">Send message</button><p id="contact-result" role="status" aria-live="polite"></p></form></section>':'';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fcfbff"><meta name="description" content="'+safe(page.lead)+'"><link rel="icon" href="/assets/bizlano-mark.png" type="image/png"><title>'+safe(page.title)+' | Bizlano</title><style>:root{font-family:Inter,system-ui,sans-serif;color:#242a49;background:#fbfaff}*{box-sizing:border-box}body{margin:0}header{border-bottom:1px solid #e7e4f2;background:#fff}header nav{max-width:1020px;padding:20px 24px;margin:auto;display:flex;justify-content:space-between;align-items:center;gap:18px}nav a{color:#33265c;font-weight:700;text-decoration:none}nav img{width:126px;height:auto;vertical-align:middle}main{max-width:920px;margin:auto;padding:52px 24px 78px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:1.7px;color:#6935df}h1{font-size:clamp(33px,5vw,55px);letter-spacing:-2px;line-height:1.09;margin:14px 0 18px}.lead{font-size:18px;color:#5f6684;line-height:1.7;margin-bottom:35px}.legal-section{background:#fff;border:1px solid #e7e5f0;border-radius:15px;padding:26px 28px;margin:13px 0}.legal-section h2{margin:0 0 12px;font-size:19px}.legal-section p{color:#56617e;line-height:1.85;font-size:14px;margin:9px 0}label{display:block;font-weight:700;font-size:13px;margin:16px 0}input,select,textarea{display:block;width:100%;margin-top:7px;border:1px solid #d6d7e5;padding:12px;border-radius:8px;font:inherit;resize:vertical}button{border:0;background:#6733db;color:white;border-radius:10px;padding:13px 22px;font-weight:800;cursor:pointer}button:disabled{opacity:.6}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #9274ed;outline-offset:2px}footer{background:#1b1c3b;color:#d9dcf4;padding:30px 24px;text-align:center;font-size:12px}footer a{color:#e8e2ff;margin:0 10px}footer .owner-brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:15px;font-weight:700}footer .owner-brand img{width:48px;height:48px;object-fit:contain;background:#fff;border-radius:9px;padding:4px}footer .owner-brand span{display:block;text-align:left;line-height:1.8}@media(max-width:600px){header nav{padding:13px 17px}nav img{width:104px}main{padding:35px 17px 52px}.legal-section{padding:21px 18px}}</style></head><body><header><nav><a href="/"><img src="/assets/bizlano-logo.png" alt="Bizlano"></a><a href="/app">Business workspace</a></nav></header><main><div class="eyebrow">'+safe(page.eyebrow)+'</div><h1>'+safe(page.title)+'</h1><p class="lead">'+safe(page.lead)+'</p>'+blocks+form+'</main><footer><a href="/">Home</a><a href="/help">Help</a><a href="/contact">Contact</a><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><p>© 2026 Bizlano · Powered by Global Web Stores</p><a class="owner-brand" href="https://www.globalwebstores.com/explore" target="_blank" rel="noopener noreferrer" aria-label="Explore Global Web Stores"><img src="https://www.globalwebstores.com/brand/global-webstores-full.png" width="48" height="48" alt="Global Web Stores official logo" loading="lazy"><span>A Global Web Stores brand<br>Explore Global Web Stores ↗</span></a></footer><script>const f=document.getElementById("contact-form-fields");if(f)f.addEventListener("submit",async e=>{e.preventDefault();const b=f.querySelector("button");b.disabled=true;const d=Object.fromEntries(new FormData(f));const el=document.getElementById("contact-result");try{const r=await fetch("/api/public/contact",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(d)});const x=await r.json();if(!r.ok)throw Error(x.error||"Unable to send your message");el.textContent="Your message has been received. Thank you.";f.reset()}catch(err){el.textContent=err.message||"Please try again"}finally{b.disabled=false}});</script></body></html>';
}

const BRIDGE_PATH='/api/integrations/gws/';
async function verifyMarketplaceSignature(req,env){
 if(!env.GWS_BRIDGE_SECRET||String(env.GWS_BRIDGE_SECRET).length<32)fail(503,'Marketplace connector is not configured');
 const ts=req.headers.get('x-bizlano-timestamp')||'';
 if(!/^\d{10}$/.test(ts)||Math.abs(Date.now()/1000-Number(ts))>300)fail(401,'Expired marketplace signature');
 const incoming=req.headers.get('x-bizlano-signature')||'';
 if(!/^[a-f0-9]{64}$/.test(incoming))fail(401,'Invalid marketplace signature');
 const body=await req.text();
 if(body.length>100000)fail(413,'Marketplace event too large');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.GWS_BRIDGE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const actual=hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ts+'.'+body))));
 let diff=0;for(let i=0;i<64;i++)diff|=incoming.charCodeAt(i)^actual.charCodeAt(i);
 if(diff!==0)fail(401,'Invalid marketplace signature');
 let data;try{data=JSON.parse(body)}catch{fail(400,'Invalid marketplace message')}
 if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Invalid marketplace message');
 return data;
}
// A reconciliation-only feed. These records never authorize a payment or change
// the vendor's local inventory: GWS remains authoritative for marketplace state.
async function marketplaceSignal(env,data,vendorId){
 const kind=String(data.type||'');
 const allowed=['catalog.product.upsert','catalog.product.deleted','order.status.updated','order.refunded','payout.settled'];
 if(!allowed.includes(kind))fail(400,'Unsupported marketplace event');
 const eventId=field(data.eventId,'event ID',150);
 if(!/^[A-Za-z0-9_-]{8,150}$/.test(eventId))fail(400,'Invalid marketplace event ID');
 const connection=await env.DB.prepare("SELECT c.tenant_id,t.slug FROM marketplace_connections c JOIN tenants t ON t.id=c.tenant_id WHERE c.provider='globalwebstores' AND c.vendor_id=? AND c.disconnected_at IS NULL AND t.disabled_at IS NULL").bind(vendorId).first();
 if(!connection)return json({recorded:false,reason:'not_connected'});
 const tenant=connection.tenant_id,contentHash=await hash(JSON.stringify(data));
 const prior=await env.DB.prepare("SELECT event_hash FROM marketplace_feed_events WHERE vendor_id=? AND event_id=?").bind(vendorId,eventId).first();
 if(prior){if(prior.event_hash!==contentHash)fail(409,'Event ID reused with different data');return json({recorded:false,alreadyRecorded:true})}
 const item=data.product,order=data.order,settlement=data.settlement,refund=data.refund;
 const idVal=(v,name)=>{const out=field(v,name,100);if(!/^[A-Za-z0-9_-]{6,100}$/.test(out))fail(400,'Invalid '+name);return out};
 const amountVal=(v)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>100000000000)fail(400,'Invalid marketplace amount');return n};
 let orderId=null,op=null;
 if(kind.startsWith('catalog.product.')){
  if(!item||typeof item!=='object'||Array.isArray(item))fail(400,'Product details missing');
  const pid=idVal(item.id,'product reference');const name=kind.endsWith('.deleted')?String(item.name||'Archived product').slice(0,180):field(item.name,'product name',180);
  const price=kind.endsWith('.deleted')?0:amountVal(item.priceMinor);
  const stock=item.stockMilli==null?null:amountVal(item.stockMilli);
  op=kind.endsWith('.deleted')?
   env.DB.prepare("UPDATE marketplace_catalog_products SET active=0,updated_at=datetime('now') WHERE tenant_id=? AND product_id=?").bind(tenant,pid):
   env.DB.prepare("INSERT INTO marketplace_catalog_products(tenant_id,product_id,name,sku,price_minor,stock_milli,active) VALUES(?,?,?,?,?,?,1) ON CONFLICT(tenant_id,product_id) DO UPDATE SET name=excluded.name,sku=excluded.sku,price_minor=excluded.price_minor,stock_milli=excluded.stock_milli,active=1,updated_at=datetime('now')")
    .bind(tenant,pid,name,String(item.sku||'').slice(0,80)||null,price,stock);
 }else if(kind==='order.status.updated'){
  if(!order||typeof order!=='object'||Array.isArray(order))fail(400,'Order details missing');
  orderId=idVal(order.id,'order reference');
  const state=field(order.status,'order status',55);
  if(!['PAID_ESCROW_HELD','BOOKED_FOR_DELIVERY','IN_TRANSIT','DELIVERED','CONFIRMED','COMPLETED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED','RETURNED','DISPUTED'].includes(state))fail(400,'Invalid order status');
  op=env.DB.prepare("INSERT INTO marketplace_order_status(tenant_id,order_id,state,tracking_reference,last_event_id) VALUES(?,?,?,?,?) ON CONFLICT(tenant_id,order_id) DO UPDATE SET state=excluded.state,tracking_reference=excluded.tracking_reference,last_event_id=excluded.last_event_id,updated_at=datetime('now')")
   .bind(tenant,orderId,state,String(order.trackingReference||'').slice(0,100)||null,eventId);
 }else if(kind==='order.refunded'){
  if(!refund||typeof refund!=='object'||Array.isArray(refund)||refund.currency!=='NGN')fail(400,'Refund details missing');
  orderId=idVal(refund.orderId,'order reference');const refundId=idVal(refund.id,'refund reference'),amount=amountVal(refund.amountMinor);
  if(amount<=0)fail(400,'Refund must be positive');
  op=env.DB.prepare('INSERT INTO marketplace_adjustments(tenant_id,refund_id,order_id,amount_minor,reason) VALUES(?,?,?,?,?)')
   .bind(tenant,refundId,orderId,amount,String(refund.reason||'').slice(0,180)||null);
 }else if(kind==='payout.settled'){
  if(!settlement||typeof settlement!=='object'||Array.isArray(settlement)||settlement.currency!=='NGN')fail(400,'Settlement details missing');
  orderId=idVal(settlement.orderId,'order reference');const payoutId=idVal(settlement.id,'settlement reference');
  op=env.DB.prepare('INSERT INTO marketplace_settlements(tenant_id,payout_id,order_id,amount_minor,reference) VALUES(?,?,?,?,?)')
   .bind(tenant,payoutId,orderId,amountVal(settlement.amountMinor),String(settlement.reference||'').slice(0,140)||null);
 }
 const event=env.DB.prepare("INSERT INTO marketplace_feed_events(id,tenant_id,vendor_id,event_id,event_type,event_hash,order_id) VALUES(?,?,?,?,?,?,?)")
  .bind(crypto.randomUUID(),tenant,vendorId,eventId,kind,contentHash,orderId);
 try{await env.DB.batch([op,event])}catch(error){
  if(String(error).toLowerCase().includes('unique')){
   const again=await env.DB.prepare("SELECT event_hash FROM marketplace_feed_events WHERE vendor_id=? AND event_id=?").bind(vendorId,eventId).first();
   if(again&&again.event_hash===contentHash)return json({recorded:false,alreadyRecorded:true});
  }
  throw error;
 }
 return json({recorded:true,type:kind},201);
}
async function marketplaceApi(req,env,url){
 const suffix=url.pathname.slice(BRIDGE_PATH.length);
 if(req.method!=='POST')fail(405,'Method not allowed');
 const data=await verifyMarketplaceSignature(req,env);
 const vendorId=field(data.vendorId,'vendor identity',160);
 if(!/^[A-Za-z0-9_-]{6,150}$/.test(vendorId))fail(400,'Invalid marketplace business ID');
 if(suffix==='status'){
  const connection=await env.DB.prepare("SELECT t.slug,t.business_name,c.connected_at,c.last_sale_at FROM marketplace_connections c JOIN tenants t ON t.id=c.tenant_id WHERE c.provider='globalwebstores' AND c.vendor_id=? AND c.disconnected_at IS NULL AND t.disabled_at IS NULL").bind(vendorId).first();
  return json({connected:!!connection,contractVersion:2,supportedEvents:['order.paid','catalog.product.upsert','catalog.product.deleted','order.status.updated','order.refunded','payout.settled'],business:connection?{name:connection.business_name,slug:connection.slug,workspace:new URL('/app?biz='+connection.slug,url.origin).toString(),connectedAt:connection.connected_at,lastSaleAt:connection.last_sale_at}:null});
 }
 if(suffix==='connect'){
  const token=field(data.code,'connection code',100);
  if(!/^[a-f0-9]{64}$/.test(token))fail(400,'Incorrect connection code');
  const found=await env.DB.prepare("SELECT id,tenant_id FROM marketplace_link_codes WHERE provider='globalwebstores' AND code_hash=? AND redeemed_at IS NULL AND expires_at>datetime('now')").bind(await hash(token)).first();
  if(!found)fail(409,'Connection code has expired or already been used');
  const existing=await env.DB.prepare("SELECT tenant_id,vendor_id FROM marketplace_connections WHERE provider='globalwebstores' AND (vendor_id=? OR tenant_id=?)").bind(vendorId,found.tenant_id).all();
  if(existing.results?.some(x=>x.vendor_id!==vendorId||x.tenant_id!==found.tenant_id))fail(409,'This business is connected to a different store. Disconnect it first.');
  const change=await env.DB.prepare("UPDATE marketplace_link_codes SET redeemed_at=datetime('now'),redeemed_vendor_id=? WHERE id=? AND redeemed_at IS NULL AND expires_at>datetime('now') RETURNING tenant_id").bind(vendorId,found.id).first();
  if(!change)fail(409,'Connection code has already been used');
  await env.DB.prepare("INSERT INTO marketplace_connections(provider,vendor_id,tenant_id) VALUES('globalwebstores',?,?) ON CONFLICT(provider,vendor_id) DO UPDATE SET disconnected_at=NULL,connected_at=datetime('now')").bind(vendorId,found.tenant_id).run();
  return json({connected:true,business:(await env.DB.prepare('SELECT slug,business_name FROM tenants WHERE id=?').bind(found.tenant_id).first())});
 }
 if(suffix==='disconnect'){
  await env.DB.prepare("UPDATE marketplace_connections SET disconnected_at=datetime('now') WHERE provider='globalwebstores' AND vendor_id=? AND disconnected_at IS NULL").bind(vendorId).run();
  return json({connected:false});
 }
 if(suffix==='event'){
  if(data.type!=='order.paid')return marketplaceSignal(env,data,vendorId);
  const order=data.order;if(!order||typeof order!=='object')fail(400,'Order details missing');
  const orderId=field(order.id,'order reference',90);
  if(!/^[A-Za-z0-9_-]{6,80}$/.test(orderId)||order.currency!=='NGN'||!['PAID_ESCROW_HELD','BOOKED_FOR_DELIVERY','IN_TRANSIT','DELIVERED','CONFIRMED','COMPLETED'].includes(order.status)||order.legacyTestRecord===true)fail(400,'The order is not an eligible paid sale');
  const amount=Number(order.totalMinor),qty=Number(order.quantity),delivery=Number(order.deliveryMinor||0),handling=Number(order.handlingMinor||0),processing=Number(order.processingMinor||0);
  if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000000||!Number.isInteger(qty)||qty<1||qty>100000||
   ![delivery,handling,processing].every(x=>Number.isSafeInteger(x)&&x>=0)||delivery+handling+processing>amount)fail(400,'Invalid verified order totals');
  const existing=await env.DB.prepare("SELECT document_id FROM marketplace_events WHERE provider='globalwebstores' AND provider_event_id=?").bind(orderId).first();
  if(existing)return json({created:false,alreadyPrepared:true,documentId:existing.document_id});
  const connection=await env.DB.prepare("SELECT c.tenant_id,t.slug,t.business_name FROM marketplace_connections c JOIN tenants t ON t.id=c.tenant_id WHERE c.provider='globalwebstores' AND c.vendor_id=? AND c.disconnected_at IS NULL AND t.disabled_at IS NULL").bind(vendorId).first();
  if(!connection)return json({created:false,reason:'not_connected'});
  const title=field(order.productTitle,'product title',210),docId=crypto.randomUUID(),customer=String(order.customerName||'Customer').trim().slice(0,140)||'Customer';
  const emailAddress=typeof order.customerEmail==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customerEmail)?order.customerEmail.trim().toLowerCase().slice(0,200):null;
  const recipientPhone=order.customerPhone?phone(order.customerPhone):null;
  if(!emailAddress&&!recipientPhone)return json({created:false,reason:'customer_contact_missing'});
  const itemAmount=amount-delivery-handling-processing,unit=Math.floor(itemAmount/qty),remainder=itemAmount-unit*qty;
  const lines=[{desc:title,qty:qty*1000,unit,amount:unit*qty}];
  if(remainder>0)lines.push({desc:'Price rounding',qty:1000,unit:remainder,amount:remainder});
  if(handling>0)lines.push({desc:'Marketplace handling',qty:1000,unit:handling,amount:handling});
  if(processing>0)lines.push({desc:'Payment processing',qty:1000,unit:processing,amount:processing});
  const documentNumber='GWS-'+orderId.slice(0,32).toUpperCase();
  const design=await env.DB.prepare("SELECT template FROM tenant_designs WHERE tenant_id=?").bind(connection.tenant_id).first();
  const customerExisting=emailAddress?await env.DB.prepare("SELECT id FROM customers WHERE tenant_id=? AND email=? LIMIT 1").bind(connection.tenant_id,emailAddress).first():null;
  const customerId=customerExisting?.id||crypto.randomUUID(),now=new Date(),issueDate=now.toISOString().slice(0,10);
  const plans=[
   ...(!customerExisting?[env.DB.prepare("INSERT INTO customers(id,tenant_id,name,email,phone) VALUES(?,?,?,?,?)").bind(customerId,connection.tenant_id,customer,emailAddress,String(order.customerPhone||'').slice(0,70))]:[]),
   env.DB.prepare("INSERT INTO documents(id,tenant_id,document_number,kind,template,customer_id,recipient_name,recipient_email,recipient_phone,issued_on,currency,subtotal_minor,shipping_minor,total_minor,status,notes,created_by) SELECT ?,?,?, 'receipt',?,?,?,?,?,?, 'NGN',?,?,?,'issued',?,created_by FROM tenants WHERE id=?")
    .bind(docId,connection.tenant_id,documentNumber,design?.template||'signature',customerId,customer,emailAddress,recipientPhone,issueDate,amount-delivery,delivery,amount,'Prepared automatically from a verified Global Webstores purchase. Reference: '+orderId,connection.tenant_id)
  ];
  for(const line of lines)plans.push(env.DB.prepare('INSERT INTO document_lines(id,tenant_id,document_id,description,quantity_milli,unit_price_minor,line_total_minor) VALUES(?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),connection.tenant_id,docId,line.desc,line.qty,line.unit,line.amount));
  plans.push(env.DB.prepare("INSERT INTO payments(id,tenant_id,document_id,amount_minor,method,reference,recorded_by) SELECT ?,?,?,?,?,?,created_by FROM tenants WHERE id=?")
    .bind(crypto.randomUUID(),connection.tenant_id,docId,amount,'Global Webstores',String(order.paymentReference||orderId).slice(0,140),connection.tenant_id));
  plans.push(env.DB.prepare("INSERT INTO marketplace_events(id,provider,provider_event_id,tenant_id,vendor_id,document_id,event_type,event_hash) VALUES(?,'globalwebstores',?,?,?,?,?,?)").bind(crypto.randomUUID(),orderId,connection.tenant_id,vendorId,docId,'order.paid',await hash(JSON.stringify(order))));
  const retrieveCode=await recoveryCode(env,connection.tenant_id,docId);
  plans.push(env.DB.prepare('INSERT INTO receipt_recovery_codes(tenant_id,document_id,code_hash) VALUES(?,?,?)').bind(connection.tenant_id,docId,await hash(retrieveCode)));
  plans.push(env.DB.prepare("INSERT INTO receipt_notifications(id,tenant_id,document_id,kind,title,body) VALUES(?,?,?,'receipt_ready',?,?)")
   .bind(crypto.randomUUID(),connection.tenant_id,docId,'Your Global Webstores receipt is ready','Paid order '+orderId+' · '+title+' · Open, print or share.'));
  plans.push(env.DB.prepare("UPDATE marketplace_connections SET last_sale_at=datetime('now') WHERE provider='globalwebstores' AND vendor_id=? AND tenant_id=?")
    .bind(vendorId,connection.tenant_id));
  try{await env.DB.batch(plans)}
  catch(e){if(String(e).toLowerCase().includes('unique')){const done=await env.DB.prepare("SELECT document_id FROM marketplace_events WHERE provider='globalwebstores' AND provider_event_id=?").bind(orderId).first();if(done)return json({created:false,alreadyPrepared:true,documentId:done.document_id})}throw e}
  return json({created:true,documentId:docId,documentNumber,workspace:new URL('/app?biz='+connection.slug,url.origin).toString()},201);
 }
 fail(404,'Unknown marketplace action');
}

async function passwordDigest(password,saltHex){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const salt=Uint8Array.from(saltHex.match(/../g),x=>parseInt(x,16));
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},key,256)));
}
async function limitAnonymousAttempt(env,kind,remoteIp){
 const key=await hash('bizlano:'+kind+':'+remoteIp),now=Math.floor(Date.now()/1000);
 await env.DB.prepare("INSERT INTO recovery_attempts(attempt_key,count,period_start) VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET count=CASE WHEN excluded.period_start-recovery_attempts.period_start>=900 THEN 1 ELSE recovery_attempts.count+1 END,period_start=CASE WHEN excluded.period_start-recovery_attempts.period_start>=900 THEN excluded.period_start ELSE recovery_attempts.period_start END,updated_at=datetime('now')").bind(key,now).run();
 const recent=await env.DB.prepare('SELECT count FROM recovery_attempts WHERE attempt_key=?').bind(key).first();
 if((recent?.count||0)>8)fail(429,'Too many attempts. Please try again in 15 minutes.');
}
async function recoveryCode(env,tenantId,documentId){
 if(typeof env.RECEIPT_RECOVERY_KEY!=='string'||env.RECEIPT_RECOVERY_KEY.length<32)fail(503,'Receipt recovery is unavailable');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.RECEIPT_RECOVERY_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bits=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('receipt:v1:'+tenantId+':'+documentId)));
 const chunks=hex(bits.slice(0,12)).toUpperCase().match(/.{6}/g);
 return 'BZ-'+chunks.join('-');
}
async function ensureRecoveryCode(env,tenantId,documentId,eligible=true){
 if(!eligible)return null;
 const code=await recoveryCode(env,tenantId,documentId);
 await env.DB.prepare("INSERT OR IGNORE INTO receipt_recovery_codes(tenant_id,document_id,code_hash) VALUES(?,?,?)")
  .bind(tenantId,documentId,await hash(code)).run();
 const active=await env.DB.prepare("SELECT 1 AS ok FROM receipt_recovery_codes WHERE tenant_id=? AND document_id=? AND code_hash=? AND revoked_at IS NULL")
  .bind(tenantId,documentId,await hash(code)).first();
 return active?code:null;
}
async function limitRecoveryClaims(env,userId){
 const key=await hash('bizlano:customer-claim:'+userId),now=Math.floor(Date.now()/1000);
 await env.DB.prepare("INSERT INTO recovery_attempts(attempt_key,count,period_start) VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET count=CASE WHEN excluded.period_start-recovery_attempts.period_start>=900 THEN 1 ELSE recovery_attempts.count+1 END,period_start=CASE WHEN excluded.period_start-recovery_attempts.period_start>=900 THEN excluded.period_start ELSE recovery_attempts.period_start END,updated_at=datetime('now')")
  .bind(key,now).run();
 const usage=await env.DB.prepare('SELECT count FROM recovery_attempts WHERE attempt_key=?').bind(key).first();
 if((usage?.count||0)>8)fail(429,'Too many attempts. Please try again in 15 minutes.');
}
function customerDocument(row,lines){
 return {id:row.id,tenantId:row.tenant_id,documentNumber:row.document_number,kind:row.kind,template:row.template,
 customer:row.recipient_name,email:row.recipient_email,phone:row.recipient_phone,date:row.issued_on,dueDate:row.due_on,
 status:row.status,currency:row.currency,subtotalMinor:row.subtotal_minor,discountMinor:row.discount_minor,taxMinor:row.tax_minor,
 shippingMinor:row.shipping_minor,totalMinor:row.total_minor,paidMinor:row.paid_minor,notes:row.notes,store:row.business_name,
 storeSlug:row.slug,storeLogo:row.logo_url,storeColor:row.brand_color,
 items:(lines||[]).map(x=>({description:x.description,qty:x.quantity_milli/1000,price:x.unit_price_minor/100,lineTotalMinor:x.line_total_minor}))};
}
async function api(req,env,url) {
 const path=url.pathname,method=req.method;
 if(path==='/api/health'){const r=await env.DB.prepare('SELECT 1 AS ok').first();return json({ok:r?.ok===1,service:'bizlano',db:'D1',assets:'R2'})}
 if(path.startsWith('/api/account/'))return nativeAuthApi(req,env,url);
 if(path==='/api/public/contact'&&method==='POST'){
  await limitAnonymousAttempt(env,'public-contact',req.headers.get('cf-connecting-ip')||'unknown');
  const b=await input(req),topic=String(b.topic||'support'),address=email(b.email),message=field(b.message,'message',3000);
  if(!['support','privacy','security','billing'].includes(topic)||message.length<12)fail(400,'Choose a topic and write at least 12 characters');
  await env.DB.prepare('INSERT INTO support_requests(id,topic,sender_email,message) VALUES(?,?,?,?)')
   .bind(crypto.randomUUID(),topic,address,message).run();
  return json({ok:true},202);
 }
 if(path==='/api/customer/phone-register'&&method==='POST'){
  await limitAnonymousAttempt(env,'phone-register',req.headers.get('cf-connecting-ip')||'unknown');
  const b=await input(req),contact=phone(b.phone),displayName=field(b.name,'customer name',120),password=b.password;
  const claim=String(b.code||'').trim().toUpperCase().replace(/\s/g,'');
  if(!contact||typeof password!=='string'||password.length<10||password.length>256)
   fail(400,'A phone number and password of at least 10 characters are required');
  if(!/^BZ-(?:[A-F0-9]{6}-){3}[A-F0-9]{6}$/.test(claim))fail(400,'Enter the private recovery code from your receipt');
  const owned=await env.DB.prepare("SELECT r.tenant_id,r.document_id FROM receipt_recovery_codes r JOIN documents d ON d.tenant_id=r.tenant_id AND d.id=r.document_id JOIN tenants t ON t.id=r.tenant_id WHERE r.code_hash=? AND r.revoked_at IS NULL AND d.recipient_phone=? AND d.paid_minor>0 AND d.status IN ('issued','paid','part_paid') AND t.disabled_at IS NULL LIMIT 1")
   .bind(await hash(claim),contact).first();
  if(!owned)fail(403,'The receipt code and phone number could not be matched. Ask the business for help.');
  const salt=hex(crypto.getRandomValues(new Uint8Array(16))),digest=await passwordDigest(password,salt),uid=crypto.randomUUID(),session=rnd();
  if(!env.RECEIPT_RECOVERY_KEY||env.RECEIPT_RECOVERY_KEY.length<32)fail(503,'Receipt recovery is unavailable');
  const synthetic='ph-'+(await hash(contact+':'+env.RECEIPT_RECOVERY_KEY)).slice(0,32)+'@accounts.bizlano.invalid';
  try{
   await env.DB.batch([
    env.DB.prepare('INSERT INTO users(id,email,display_name,contact_phone,password_hash,password_salt) VALUES(?,?,?,?,?,?)').bind(uid,synthetic,displayName,contact,digest,salt),
    env.DB.prepare("INSERT INTO customer_receipt_claims(user_id,tenant_id,document_id,proof) VALUES(?,?,?,'receipt_code')").bind(uid,owned.tenant_id,owned.document_id),
    env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+7 days'))").bind(await hash(session),uid)
   ]);
  }catch(error){if(String(error).includes('UNIQUE'))fail(409,'This phone number already has a Bizlano account. Sign in instead.');throw error}
  return json({ok:true,phoneOnly:true},201,{'set-cookie':sessionCookie(session,604800)});
 }
 if(path==='/api/customer/phone-login'&&method==='POST'){
  const b=await input(req),alias=phone(b.phone),password=b.password;
  if(!alias||typeof password!=='string'||password.length<6||password.length>256)fail(400,'Enter your phone number and password');
  const remoteIp=req.headers.get('cf-connecting-ip')||'unknown',key=await hash('phone-signin:'+alias+':'+remoteIp),now=Math.floor(Date.now()/1000);
  await env.DB.prepare("INSERT INTO recovery_attempts(attempt_key,count,period_start) VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET count=CASE WHEN excluded.period_start-recovery_attempts.period_start>=900 THEN 1 ELSE recovery_attempts.count+1 END,period_start=CASE WHEN excluded.period_start-recovery_attempts.period_start>=900 THEN excluded.period_start ELSE recovery_attempts.period_start END,updated_at=datetime('now')").bind(key,now).run();
  const attempts=await env.DB.prepare("SELECT count FROM recovery_attempts WHERE attempt_key=?").bind(key).first();
  if((attempts?.count||0)>8)fail(429,'Too many sign-in attempts. Please wait 15 minutes.');
  const account=await env.DB.prepare("SELECT id,email,password_hash,password_salt,email_verified_at FROM users WHERE contact_phone=? AND disabled_at IS NULL").bind(alias).first();
  if(!account||!account.email)fail(401,'Phone number or password is incorrect');
  if(account.password_hash==='firebase'||!account.password_salt)fail(401,'Phone number or password is incorrect');
  const digest=await passwordDigest(password,account.password_salt);
  let different=0;for(let i=0;i<64;i++)different|=digest.charCodeAt(i)^account.password_hash.charCodeAt(i);
  if(different!==0)fail(401,'Phone number or password is incorrect');
  const phoneOnly=account.email.endsWith('@accounts.bizlano.invalid');
  if(!phoneOnly&&!account.email_verified_at)fail(403,'Confirm your account email before signing in');
  const session=rnd();
  await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+7 days'))").bind(await hash(session),account.id).run();
  return json({ok:true,phoneOnly},200,{'set-cookie':sessionCookie(session,604800)});
 }
 if(path==='/api/auth'&&method==='POST'){
  const claim=await verifyFirebase((await input(req)).token);
  let known=await env.DB.prepare("SELECT user_id FROM legacy_identity_links WHERE provider='firebase-metaforge' AND legacy_uid=?").bind(claim.uid).first();
  if(!known){
   const uid=crypto.randomUUID();
   await env.DB.batch([
    env.DB.prepare("INSERT INTO users(id,email,display_name,password_hash,password_salt) VALUES(?,?,?,'firebase','firebase')").bind(uid,claim.email,claim.name),
    env.DB.prepare("INSERT INTO legacy_identity_links(provider,legacy_uid,user_id) VALUES('firebase-metaforge',?,?)").bind(claim.uid,uid)
   ]);
   known={user_id:uid};
  }
  // Keep the verified current identity email in sync; it is the receipt inbox proof.
  await env.DB.prepare("UPDATE users SET email=?,display_name=? WHERE id=? AND disabled_at IS NULL").bind(claim.email,claim.name,known.user_id).run();
  const token=rnd();
  await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+7 days'))").bind(await hash(token),known.user_id).run();
  return json({ok:true},200,{'set-cookie':sessionCookie(token,604800)});
 }
 if(path==='/api/logout'&&method==='POST'){
  const token=sessionToken(req);
  if(token)await env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE token_hash=?").bind(await hash(token)).run();
  return json({ok:true},200,{'set-cookie':sessionCookie('',0)});
 }
 if(path.startsWith(BRIDGE_PATH))return marketplaceApi(req,env,url);
 const user=await identity(req,env);
 if(user.email.endsWith('@accounts.bizlano.invalid')&&!path.startsWith('/api/customer/'))fail(403,'Customer-only accounts cannot access business management');
 if(path==='/api/customer/me'&&method==='GET'){const phoneOnly=user.email.endsWith('@accounts.bizlano.invalid');return json({email:phoneOnly?null:user.email,name:user.display_name,phone:user.contact_phone||null,verified:!phoneOnly,phoneOnly});}
 if(path==='/api/customer/profile'&&method==='POST'){
  const b=await input(req),contact=phone(b.phone),name=b.name?field(b.name,'display name',120):user.display_name;
  if(user.email.endsWith('@accounts.bizlano.invalid')&&contact!==user.contact_phone)fail(403,'Phone-only accounts cannot change their phone number without a new receipt verification');
  try{
   await env.DB.prepare('UPDATE users SET contact_phone=?,display_name=? WHERE id=? AND disabled_at IS NULL').bind(contact,name,user.id).run();
  }catch(err){
   if(String(err).includes('UNIQUE'))fail(409,'This phone number is already registered to another account');
   throw err;
  }
  return json({ok:true,name,phone:contact});
 }
 if(path==='/api/customer/receipts'&&method==='GET'){
  // Cursor-based pagination supports history from many stores without loading it all.
  // Do not resolve customer identity from name or product: email is from the verified session.
  const cursor=url.searchParams.get('cursor')||'';
  if(cursor&&!/^\d{4}-\d{2}-\d{2}\|[a-f0-9-]{36}$/.test(cursor))fail(400,'Invalid purchase-history cursor');
  const [beforeDate,beforeId]=cursor?cursor.split('|'):['9999-12-31','zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz'];
  const data=await env.DB.prepare("SELECT DISTINCT d.tenant_id,d.id,d.document_number,d.kind,d.issued_on,d.total_minor,d.paid_minor,d.status,d.currency,t.business_name,t.slug,t.logo_url,COALESCE((SELECT group_concat(description,' · ') FROM (SELECT description FROM document_lines l WHERE l.tenant_id=d.tenant_id AND l.document_id=d.id LIMIT 3)),'') AS items_summary FROM documents d JOIN tenants t ON t.id=d.tenant_id LEFT JOIN customer_receipt_claims rc ON rc.tenant_id=d.tenant_id AND rc.document_id=d.id AND rc.user_id=? WHERE t.disabled_at IS NULL AND (d.recipient_email=? COLLATE NOCASE OR rc.user_id IS NOT NULL) AND d.paid_minor>0 AND d.status IN ('paid','part_paid','issued') AND (d.issued_on<? OR (d.issued_on=? AND d.id<?)) ORDER BY d.issued_on DESC,d.id DESC LIMIT 51")
   .bind(user.id,user.email.toLowerCase(),beforeDate,beforeDate,beforeId).all();
  const all=data.results||[],rows=all.slice(0,50);
  const last=rows[rows.length-1];
  return json({email:user.email.endsWith('@accounts.bizlano.invalid')?null:user.email,rows,nextCursor:all.length>50&&last?last.issued_on+'|'+last.id:null});
 }
 const privateDetail=path.match(/^\/api\/customer\/receipts\/([a-f0-9-]{36})$/);
 if(privateDetail&&method==='GET'){
  const row=await env.DB.prepare("SELECT d.*,t.slug,t.business_name,t.logo_url,t.brand_color FROM documents d JOIN tenants t ON t.id=d.tenant_id LEFT JOIN customer_receipt_claims rc ON rc.tenant_id=d.tenant_id AND rc.document_id=d.id AND rc.user_id=? WHERE d.id=? AND t.disabled_at IS NULL AND (d.recipient_email=? COLLATE NOCASE OR rc.user_id IS NOT NULL) AND d.paid_minor>0 AND d.status IN ('paid','part_paid','issued') LIMIT 1")
   .bind(user.id,privateDetail[1],user.email.toLowerCase()).first();
  if(!row)fail(404,'Receipt is not available for this account');
  const lines=await env.DB.prepare('SELECT description,quantity_milli,unit_price_minor,line_total_minor FROM document_lines WHERE tenant_id=? AND document_id=? ORDER BY rowid LIMIT 100').bind(row.tenant_id,row.id).all();
  const code=await ensureRecoveryCode(env,row.tenant_id,row.id,true);
  return json({receipt:{...customerDocument(row,lines.results),recoveryCode:code}});
 }
 if(path==='/api/customer/claim'&&method==='POST'){
  await limitRecoveryClaims(env,user.id);
  const body=await input(req),code=String(body?.code||'').trim().toUpperCase().replace(/\s/g,'');
  if(!/^BZ-(?:[A-F0-9]{6}-){3}[A-F0-9]{6}$/.test(code))fail(400,'Enter the complete receipt recovery code');
  const recovery=await env.DB.prepare("SELECT r.tenant_id,r.document_id FROM receipt_recovery_codes r JOIN documents d ON d.tenant_id=r.tenant_id AND d.id=r.document_id JOIN tenants t ON t.id=r.tenant_id WHERE r.code_hash=? AND r.revoked_at IS NULL AND d.status IN ('issued','part_paid','paid') AND d.paid_minor>0 AND t.disabled_at IS NULL").bind(await hash(code)).first();
  if(!recovery)fail(404,'That code could not be verified. Ask the business for a new receipt code.');
  await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO customer_receipt_claims(user_id,tenant_id,document_id,proof) VALUES(?,?,?,'receipt_code')").bind(user.id,recovery.tenant_id,recovery.document_id),
   env.DB.prepare("UPDATE receipt_recovery_codes SET last_used_at=datetime('now') WHERE tenant_id=? AND document_id=?").bind(recovery.tenant_id,recovery.document_id)
  ]);
  return json({ok:true,documentId:recovery.document_id});
 }
 if(path==='/api/me'&&method==='GET'){
  const businesses=await env.DB.prepare('SELECT t.slug,t.business_name,t.currency,t.logo_url,t.brand_color,m.role FROM memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=? AND m.disabled_at IS NULL AND t.disabled_at IS NULL ORDER BY t.created_at DESC').bind(user.id).all();
  return json({user:{email:user.email,name:user.display_name},businesses:businesses.results||[]});
 }
 if(path==='/api/businesses'&&method==='POST'){
  const b=await input(req),slug=String(b.slug||'').trim().toLowerCase(),name=field(b.name,'business name',120);
  if(!slugValid(slug))fail(400,'Choose a different 4–40 character business address');
  const id=crypto.randomUUID();
  try{await env.DB.batch([
    env.DB.prepare('INSERT INTO tenants(id,slug,business_name,created_by) VALUES(?,?,?,?)').bind(id,slug,name,user.id),
    env.DB.prepare("INSERT INTO memberships(tenant_id,user_id,role) VALUES(?,?,'owner')").bind(id,user.id)
  ])}catch(e){if(String(e).includes('UNIQUE'))fail(409,'Business address already taken');throw e}
  await audit(env,id,user,'business.created',id);
  return json({slug,name},201);
 }
 if(path==='/api/join'&&method==='POST'){
  const token=field((await input(req)).token,'invitation',100);
  if(!/^[a-f0-9]{64}$/.test(token))fail(400,'Invalid invitation code');
  const record=await env.DB.prepare("SELECT id,tenant_id,email,role FROM invitations WHERE token_hash=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>datetime('now')").bind(await hash(token)).first();
  if(!record||record.email.toLowerCase()!==user.email.toLowerCase())fail(403,'Invitation expired or intended for another verified email');
  await env.DB.batch([
   env.DB.prepare("INSERT INTO memberships(tenant_id,user_id,role,invited_by) SELECT tenant_id,?,role,created_by FROM invitations WHERE id=? AND accepted_at IS NULL ON CONFLICT(tenant_id,user_id) DO NOTHING").bind(user.id,record.id),
   env.DB.prepare("UPDATE invitations SET accepted_at=datetime('now') WHERE id=? AND accepted_at IS NULL").bind(record.id)
  ]);
  return json({ok:true});
 }
 const detail=path.match(/^\/api\/b\/([a-z0-9-]+)\/doc\/([a-f0-9-]{36})$/);
 if(detail&&method==='GET'){
  const tenant=await member(env,user,detail[1]);
  const d=await env.DB.prepare('SELECT * FROM documents WHERE tenant_id=? AND id=?').bind(tenant.id,detail[2]).first();
  if(!d)fail(404,'Document not found in this business');
  await assertDocumentReadScope(env,user,tenant,d.arm_id,d.location_id);
  const items=await env.DB.prepare('SELECT product_id,description,quantity_milli,unit_price_minor,line_total_minor FROM document_lines WHERE tenant_id=? AND document_id=? ORDER BY rowid').bind(tenant.id,detail[2]).all();
  const code=await ensureRecoveryCode(env,tenant.id,d.id,d.paid_minor>0&&billable.has(d.kind)&&d.status!=='voided');
  return json({document:{...d,recoveryCode:code,customer:d.recipient_name,date:d.issued_on,received:d.paid_minor/100,
   items:(items.results||[]).map(i=>({description:i.description,qty:i.quantity_milli/1000,price:i.unit_price_minor/100,productId:i.product_id})),
   discountPct:d.subtotal_minor?d.discount_minor*100/d.subtotal_minor:0,
   taxPct:d.subtotal_minor>d.discount_minor?d.tax_minor*100/(d.subtotal_minor-d.discount_minor):0,
   shipping:d.shipping_minor/100}});
 }
 const m=path.match(/^\/api\/b\/([a-z0-9-]+)\/(overview|trends|design|notifications|marketplace|customers|products|documents|payments|expenses|targets|team|invite|logo|signature|issue|void|migrate|billing|arms|locations|stock-locations|stock-transfer|staff-scopes)$/);
 if(!m)fail(404,'Not found');
 const slug=m[1],resource=m[2];
 const scope=resource==='expenses'||resource==='targets'&&method==='POST'?'finance':['team','invite','logo','signature','void','marketplace'].includes(resource)||resource==='design'&&method==='POST'?'admin':resource==='products'&&method==='POST'?'stock':['customers','products','payments'].includes(resource)?'edit':'view';
 const t=await member(env,user,slug,scope),tenant=t.id;
 if(['billing','arms','locations','stock-locations','stock-transfer','staff-scopes'].includes(resource))return workspaceExtraAPI(req,env,user,t,resource);
 if(resource==='migrate'&&method==='POST'){
  await member(env,user,slug,'owner');
  const b=await input(req),source=field(b.source,'migration source',190),records=b.records||[];
  if(!/^(engine:[A-Za-z0-9]{6}|browser:[A-Za-z0-9_ -]{3,150}_history)$/.test(source))fail(400,'Invalid legacy history source');
  if(source.startsWith('browser:')&&b.includeBrowser!==true)fail(400,'Explicit consent is required for device-local records');
  if(!Array.isArray(records)||records.length<1||records.length>25)fail(400,'Upload between 1 and 25 historical receipts per batch');
  const original=await env.DB.prepare("SELECT legacy_uid FROM legacy_identity_links WHERE provider='firebase-metaforge' AND user_id=?").bind(user.id).first();
  if(!original||original.legacy_uid!==b.ownerUid)fail(403,'This export does not match your verified legacy account');
  const archiveHash=field(b.archiveHash,'archive hash',64);
  if(!/^[a-f0-9]{64}$/.test(archiveHash))fail(400,'Invalid archive hash');
  const platform=source.startsWith('browser:')?'browser-backup':'firebase-metaforge';
  let job=await env.DB.prepare('SELECT id FROM legacy_migration_jobs WHERE tenant_id=? AND source_platform=? AND archive_hash=?').bind(tenant,platform,archiveHash).first();
  if(!job){
   try{const jobId=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO legacy_migration_jobs(id,tenant_id,user_id,state,source_platform,archive_hash,source_count) VALUES(?,?,?,?,?,?,?)')
      .bind(jobId,tenant,user.id,'importing',platform,archiveHash,Number(b.totalCount)||records.length).run();
    job={id:jobId}
   }catch{
    job=await env.DB.prepare('SELECT id FROM legacy_migration_jobs WHERE tenant_id=? AND source_platform=? AND archive_hash=?').bind(tenant,platform,archiveHash).first();
   }
  }
  if(!job)fail(500,'Could not initialize the migration');
  let imported=0,skipped=0;
  const issues=[];
  for(const rec of records){
   if(!rec||typeof rec!=='object'||!Number.isInteger(rec.index)||rec.index<0){skipped++;continue}
   const receipt=rec.receipt;
   if(!receipt||typeof receipt!=='object'||!Array.isArray(receipt.data?.items)){skipped++;continue}
   const lines=[];
   for(const line of receipt.data.items.slice(0,150)){
    const description=String(line.desc||line.description||'').trim().slice(0,200);
    const qty=Number(line.qty||0),price=Number(String(line.price||0).replace(/[₦,$\s]/g,''));
    if(!description||!Number.isFinite(qty)||qty<=0||!Number.isFinite(price)||price<0||price>1e9){lines.length=0;break}
    const q=Math.round(qty*1000),p=Math.round(price*100),lineTotal=Math.round(q*p/1000);
    if(q<=0){lines.length=0;break}
    lines.push({description,q,p,lineTotal});
   }
   if(!lines.length){skipped++;issues.push(source+' #'+rec.index+' requires manual review');continue}
   const sourceId=await hash(original.legacy_uid+'|'+source+'|'+String(receipt.id??rec.index));
   const previous=await env.DB.prepare('SELECT 1 AS exists_ FROM legacy_document_sources WHERE tenant_id=? AND legacy_source_id=?').bind(tenant,sourceId).first();
   if(previous){skipped++;continue}
   const docId=crypto.randomUUID(),number='LEG-'+sourceId.slice(0,14).toUpperCase();
   const kindName=String(receipt.type||'receipt').toLowerCase().replace(/[^a-z-]/g,'');
   const kind=types.has(kindName)?kindName:'receipt';
   const date=dateValid(String(receipt.date||''))?String(receipt.date):day();
   const subtotal=lines.reduce((sum,line)=>sum+line.lineTotal,0);
   const note='Imported historical record — REVIEW ONLY. Original source: '+source+'. Reported total: '+String(receipt.total||'unknown').slice(0,70)+'. No payment status has been presumed.';
   const changes=[env.DB.prepare("INSERT INTO documents(id,tenant_id,document_number,kind,recipient_name,issued_on,currency,subtotal_minor,total_minor,status,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,'draft',?,?)")
    .bind(docId,tenant,number,kind,String(receipt.customer||'Legacy customer').slice(0,120),date,t.currency,subtotal,subtotal,note,user.id)];
   for(const line of lines)changes.push(env.DB.prepare('INSERT INTO document_lines(id,tenant_id,document_id,description,quantity_milli,unit_price_minor,line_total_minor) VALUES(?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),tenant,docId,line.description,line.q,line.p,line.lineTotal));
   changes.push(env.DB.prepare('INSERT INTO legacy_document_sources(tenant_id,legacy_source_id,job_id,original_document_number,new_document_id) VALUES(?,?,?,?,?)')
    .bind(tenant,sourceId,job.id,String(receipt.id||'').slice(0,90),docId));
   try{await env.DB.batch(changes);imported++}
   catch(err){skipped++;issues.push(source+' #'+rec.index+' could not be imported: retry or inspect your backup')}
  }
  await env.DB.prepare("UPDATE legacy_migration_jobs SET imported_count=imported_count+?,skipped_count=skipped_count+?,state='partial',details=? WHERE tenant_id=? AND id=?")
   .bind(imported,skipped,JSON.stringify(issues.slice(0,15)),tenant,job.id).run();
  await audit(env,tenant,user,'legacy.imported',job.id);
  return json({imported,skipped,issues:issues.slice(0,15)});
 }
 if(resource==='trends'&&method==='GET'){
  const r=await env.DB.prepare("SELECT issued_on AS day,kind,COUNT(*) AS count,SUM(total_minor) AS total_minor FROM documents WHERE tenant_id=? AND status NOT IN ('draft','voided') AND issued_on>=date('now','-90 days') AND kind IN ('receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice') GROUP BY issued_on,kind ORDER BY issued_on ASC LIMIT 500").bind(tenant).all();
  return json({rows:r.results||[]});
 }
 if(resource==='marketplace'){
  if(method==='GET'){
   const c=await env.DB.prepare("SELECT vendor_id,connected_at,last_sale_at FROM marketplace_connections WHERE provider='globalwebstores' AND tenant_id=? AND disconnected_at IS NULL").bind(tenant).first();
   const [catalog,orders,refunds,settlements]=await env.DB.batch([
    env.DB.prepare('SELECT count(*) AS total FROM marketplace_catalog_products WHERE tenant_id=? AND active=1').bind(tenant),
    env.DB.prepare('SELECT count(*) AS total FROM marketplace_order_status WHERE tenant_id=?').bind(tenant),
    env.DB.prepare('SELECT count(*) AS total FROM marketplace_adjustments WHERE tenant_id=?').bind(tenant),
    env.DB.prepare('SELECT count(*) AS total FROM marketplace_settlements WHERE tenant_id=?').bind(tenant)
   ]);
   return json({connected:!!c,vendorId:c?.vendor_id||null,connectedAt:c?.connected_at||null,lastSaleAt:c?.last_sale_at||null,feed:{products:catalog.results?.[0]?.total||0,orderUpdates:orders.results?.[0]?.total||0,refunds:refunds.results?.[0]?.total||0,settlements:settlements.results?.[0]?.total||0}});

  }
  if(method==='POST'){
   const b=await input(req),action=String(b.action||'link');
   if(action==='disconnect'){
    await env.DB.prepare("UPDATE marketplace_connections SET disconnected_at=datetime('now') WHERE provider='globalwebstores' AND tenant_id=? AND disconnected_at IS NULL").bind(tenant).run();
    await audit(env,tenant,user,'marketplace.disconnected',tenant);
    return json({connected:false});
   }
   if(action!=='link')fail(400,'Unsupported connection request');
   const token=rnd();
   await env.DB.prepare("INSERT INTO marketplace_link_codes(id,tenant_id,code_hash,provider,created_by,expires_at) VALUES(?,?,?,'globalwebstores',?,datetime('now','+30 minutes'))")
    .bind(crypto.randomUUID(),tenant,await hash(token),user.id).run();
   await audit(env,tenant,user,'marketplace.link_code_issued',tenant);
   return json({code:token,expiresInMinutes:30});
  }
 }
 if(resource==='design'){
  if(method==='GET'){
   const design=await env.DB.prepare("SELECT template,accent,secondary_color,font_family,text_logo_style,paper,header_note,footer_note,contact,show_logo,show_signature FROM tenant_designs WHERE tenant_id=?").bind(tenant).first();
   const signature=await env.DB.prepare('SELECT signature_url,industry FROM tenants WHERE id=?').bind(tenant).first();
   return json({industry:DESIGN_INDUSTRIES.has(signature?.industry)?signature.industry:'general',design:{...(design||{template:'signature',accent:'#6935df',secondary_color:'#19223b',font_family:'modern',text_logo_style:'split',paper:'a4',header_note:'',footer_note:'Thank you for your business.',contact:'',show_logo:1,show_signature:0}),signature_url:signature?.signature_url||null},templates:[...TEMPLATES]});
  }
  if(method==='POST'){
   const b=await input(req),template=field(b.template,'receipt design',60),paper=String(b.paper||'a4'),accent=String(b.accent||'#6935df');
   const secondaryColor=String(b.secondaryColor||'#19223b'),fontFamily=String(b.fontFamily||'modern'),textLogoStyle=String(b.textLogoStyle||'split');
   if(!TEMPLATES.has(template))fail(400,'Choose a supported document design');
   const industry=String(b.industry||'general');
   if(!DESIGN_INDUSTRIES.has(industry))fail(400,'Choose a supported business category');
   if(!/^(a4|letter|80mm|58mm)$/.test(paper))fail(400,'Choose a supported paper size');
   if(!/^#[0-9a-fA-F]{6}$/.test(accent))fail(400,'Select a six-digit color');
   if(!/^#[0-9a-fA-F]{6}$/.test(secondaryColor))fail(400,'Select a six-digit secondary color');
   if(!['modern','editorial','mono','rounded','classic'].includes(fontFamily))fail(400,'Select a supported font');
   if(!['split','plain','caps'].includes(textLogoStyle))fail(400,'Choose a supported text logo');
   const note=String(b.footerNote||'Thank you for your business.').trim().slice(0,300),
    contact=String(b.contact||'').trim().slice(0,240),header=String(b.headerNote||'').trim().slice(0,150);
   await env.DB.prepare("INSERT INTO tenant_designs(tenant_id,template,accent,secondary_color,font_family,text_logo_style,paper,header_note,footer_note,contact,show_logo,show_signature,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET template=excluded.template,accent=excluded.accent,secondary_color=excluded.secondary_color,font_family=excluded.font_family,text_logo_style=excluded.text_logo_style,paper=excluded.paper,header_note=excluded.header_note,footer_note=excluded.footer_note,contact=excluded.contact,show_logo=excluded.show_logo,show_signature=excluded.show_signature,updated_by=excluded.updated_by,updated_at=datetime('now')")
    .bind(tenant,template,accent.toLowerCase(),secondaryColor.toLowerCase(),fontFamily,textLogoStyle,paper,header,note,contact,b.showLogo===true?1:0,b.showSignature===true?1:0,user.id).run();
   await env.DB.prepare('UPDATE tenants SET industry=? WHERE id=?').bind(industry,tenant).run();
   await audit(env,tenant,user,'design.updated',tenant);
   return json({ok:true,template,paper,accent,secondaryColor,fontFamily,textLogoStyle});
  }
 }
 if(resource==='notifications'){
  if(method==='GET'){
   const r=await env.DB.prepare("SELECT id,document_id,kind,title,body,created_at,read_at FROM receipt_notifications WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100").bind(tenant).all();
   return json({rows:r.results||[]});
  }
  if(method==='POST'){
   const b=await input(req),id=field(b.id,'notification',60);
   await env.DB.prepare("UPDATE receipt_notifications SET read_at=datetime('now') WHERE id=? AND tenant_id=? AND read_at IS NULL").bind(id,tenant).run();
   return json({ok:true});
  }
 }
 if(resource==='overview'&&method==='GET'){
  const [docs,customers,products,expenses]=await env.DB.batch([
   env.DB.prepare("SELECT count(*) AS count,coalesce(sum(total_minor),0) AS total,coalesce(sum(paid_minor),0) AS paid FROM documents WHERE tenant_id=? AND status NOT IN ('draft','voided') AND kind IN ('receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice')").bind(tenant),
   env.DB.prepare('SELECT count(*) AS count FROM customers WHERE tenant_id=?').bind(tenant),
   env.DB.prepare('SELECT count(*) AS count FROM products WHERE tenant_id=?').bind(tenant),
   env.DB.prepare('SELECT coalesce(sum(amount_minor),0) AS total FROM expenses WHERE tenant_id=?').bind(tenant)
  ]);
  const d=docs.results[0];return json({business:t,invoiced:d.total,received:d.paid,outstanding:d.total-d.paid,documents:d.count,customers:customers.results[0].count,products:products.results[0].count,expenses:access.finance.includes(t.role)?expenses.results[0].total:null});
 }
 if(resource==='customers'){
  if(method==='GET'){const r=await env.DB.prepare('SELECT id,name,email,phone,address FROM customers WHERE tenant_id=? ORDER BY created_at DESC LIMIT 150').bind(tenant).all();return json({rows:r.results})}
  if(method==='POST'){
   await member(env,user,slug,'edit');
   const b=await input(req),id=crypto.randomUUID();
   await env.DB.prepare('INSERT INTO customers(id,tenant_id,name,phone,email,address) VALUES(?,?,?,?,?,?)').bind(id,tenant,field(b.name,'customer name',150),String(b.phone||'').slice(0,80),String(b.email||'').slice(0,200),String(b.address||'').slice(0,400)).run();
   return json({id},201);
  }
 }
 if(resource==='products'){
  if(method==='GET'){const r=await env.DB.prepare('SELECT id,name,sku,price_minor,stock_milli,low_stock_milli,track_stock FROM products WHERE tenant_id=? ORDER BY created_at DESC LIMIT 150').bind(tenant).all();return json({rows:r.results})}
  if(method==='POST'){
   const b=await input(req),id=crypto.randomUUID();
   await env.DB.prepare('INSERT INTO products(id,tenant_id,name,sku,price_minor,stock_milli,low_stock_milli,track_stock) VALUES(?,?,?,?,?,?,?,?)').bind(id,tenant,field(b.name,'product name',150),String(b.sku||'')||null,cents(b.price),milli(b.stock||0),milli(b.lowStock||0),b.trackStock===false?0:1).run();
   return json({id},201);
  }
 }
 if(resource==='documents'){
  if(method==='GET'){const r=await env.DB.prepare("SELECT d.id,d.document_number,d.kind,d.recipient_name,d.recipient_email,d.recipient_phone,d.issued_on,d.due_on,d.total_minor,d.paid_minor,d.status,d.currency,d.template,d.notes,d.arm_id,d.location_id FROM documents d WHERE d.tenant_id=? AND (?=1 OR ((NOT EXISTS(SELECT 1 FROM staff_location_scopes s WHERE s.tenant_id=d.tenant_id AND s.user_id=?) OR EXISTS(SELECT 1 FROM staff_location_scopes s WHERE s.tenant_id=d.tenant_id AND s.user_id=? AND s.location_id=COALESCE(d.location_id,d.tenant_id))) AND (NOT EXISTS(SELECT 1 FROM staff_arm_scopes a WHERE a.tenant_id=d.tenant_id AND a.user_id=?) OR EXISTS(SELECT 1 FROM staff_arm_scopes a WHERE a.tenant_id=d.tenant_id AND a.user_id=? AND a.arm_id=COALESCE(d.arm_id,d.tenant_id))))) ORDER BY d.created_at DESC LIMIT 150").bind(tenant,['owner','admin'].includes(t.role)?1:0,user.id,user.id,user.id,user.id).all();return json({rows:r.results})}
  if(method==='POST'){
   await member(env,user,slug,'edit');
   const b=await input(req),kind=field(b.kind,'document type',60),items=b.items;
   const docScope=await assertDocumentOrgScope(env,user,t,b.armId,b.locationId);
   const convertedFrom=b.convertFrom||null;
   let transactionId=null;
   if(convertedFrom){
    if(!/^[a-f0-9-]{36}$/.test(convertedFrom))fail(400,'Invalid source document');
    const origin=await env.DB.prepare('SELECT id,kind,status,economic_transaction_id,arm_id,location_id FROM documents WHERE tenant_id=? AND id=?').bind(tenant,convertedFrom).first();
    if(!origin||!['quotation','estimate','proforma','invoice','tax-invoice'].includes(origin.kind)||origin.status==='voided')fail(404,'Source document cannot be converted');
    await assertDocumentReadScope(env,user,t,origin.arm_id,origin.location_id);
    if(origin.arm_id!==docScope.armId||origin.location_id!==docScope.locationId)fail(400,'Converted documents must belong to the same business arm and location');
    transactionId=origin.economic_transaction_id||origin.id;
   }
   const recipientEmail=b.customerEmail?email(b.customerEmail):null,recipientPhone=phone(b.customerPhone);
   if(b.draft!==true&&!recipientEmail&&!recipientPhone)fail(400,'Enter a customer email or phone number to issue this document');
   const preferred=await env.DB.prepare('SELECT template FROM tenant_designs WHERE tenant_id=?').bind(tenant).first();
   const selectedTemplate=String(b.template||preferred?.template||'signature');
   if(!TEMPLATES.has(selectedTemplate))fail(400,'Unsupported document design');
   if(!types.has(kind))fail(400,'Invalid document type');
   cashier(t,kind);
   if(!Array.isArray(items)||items.length<1||items.length>100)fail(400,'Add at least one line item');
   const lines=[];let subtotal=0;
   for(const item of items){
    const description=field(item.description,'line description',240),qty=milli(item.qty),price=cents(item.price),value=Math.round(qty*price/1000);
    if(qty<=0)fail(400,'Quantity must be positive');
    if(item.productId&&!/^[a-f0-9-]{36}$/.test(item.productId))fail(400,'Invalid product');
    subtotal+=value;lines.push({description,qty,price,value,productId:item.productId||null});
   }
   const discountPct=Number(b.discountPct||0),taxPct=Number(b.taxPct||0);
   if(![taxPct,discountPct].every(x=>Number.isFinite(x)&&x>=0&&x<=100))fail(400,'Tax and discount must be 0–100%');
   const discount=Math.round(subtotal*discountPct/100),tax=Math.round((subtotal-discount)*taxPct/100),shipping=cents(b.shipping||0),total=subtotal-discount+tax+shipping;
   const received=cents(b.received||0),draft=b.draft===true;
   if(received>total||draft&&received>0||(!billable.has(kind)&&received>0))fail(400,'Invalid received payment');
   if(receiptTypes.has(kind)&&!draft&&received===0)fail(400,'Record actual payment on a receipt, or issue an invoice');
   const date=String(b.date||day()),due=String(b.dueDate||'');
   if(!dateValid(date)||(due&&!dateValid(due)))fail(400,'Invalid date');
   const did=crypto.randomUUID(),economicId=transactionId||did,number=docScope.documentPrefix+'-'+kind.replace(/[^a-z]/g,'').slice(0,4).toUpperCase()+'-'+date.slice(0,4)+'-'+did.slice(0,8).toUpperCase();
   const batch=[env.DB.prepare('INSERT INTO documents(id,tenant_id,document_number,kind,template,recipient_name,recipient_email,recipient_phone,issued_on,due_on,currency,subtotal_minor,discount_minor,tax_minor,shipping_minor,total_minor,status,notes,created_by,arm_id,location_id,economic_transaction_id,origin_document_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(did,tenant,number,kind,selectedTemplate,String(b.customer||'Walk-in').slice(0,120),recipientEmail,recipientPhone,date,due||null,t.currency,subtotal,discount,tax,shipping,total,draft?'draft':'issued',String(b.notes||'').slice(0,1800),user.id,docScope.armId,docScope.locationId,economicId,convertedFrom)];
   if(!draft&&billable.has(kind))batch.push(env.DB.prepare('INSERT INTO usage_events(tenant_id,origin_transaction_id,period_wat) VALUES(?,?,?) ON CONFLICT(tenant_id,origin_transaction_id) DO NOTHING').bind(tenant,economicId,lagosUsagePeriod()));
   for(const line of lines)batch.push(env.DB.prepare('INSERT INTO document_lines(id,tenant_id,document_id,product_id,description,quantity_milli,unit_price_minor,line_total_minor) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,did,line.productId,line.description,line.qty,line.price,line.value));
   if(received>0)batch.push(env.DB.prepare('INSERT INTO payments(id,tenant_id,document_id,amount_minor,method,recorded_by) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,did,received,String(b.method||'Cash').slice(0,50),user.id));
   if(received>0&&billable.has(kind)){const code=await recoveryCode(env,tenant,did);batch.push(env.DB.prepare('INSERT INTO receipt_recovery_codes(tenant_id,document_id,code_hash) VALUES(?,?,?)').bind(tenant,did,await hash(code)));}
   try{await env.DB.batch(batch)}catch(e){if(String(e).includes('stock'))fail(409,'Insufficient stock to issue document');throw e}
   await audit(env,tenant,user,'document.created',did);
   return json({id:did,number,total_minor:total},201);
  }
 }
 if(resource==='payments'){
  if(method==='GET'){const r=await env.DB.prepare("SELECT p.id,p.amount_minor,p.method,p.received_at,d.document_number FROM payments p JOIN documents d ON d.id=p.document_id AND d.tenant_id=p.tenant_id WHERE p.tenant_id=? AND (?=1 OR ((NOT EXISTS(SELECT 1 FROM staff_location_scopes s WHERE s.tenant_id=d.tenant_id AND s.user_id=?) OR EXISTS(SELECT 1 FROM staff_location_scopes s WHERE s.tenant_id=d.tenant_id AND s.user_id=? AND s.location_id=COALESCE(d.location_id,d.tenant_id))) AND (NOT EXISTS(SELECT 1 FROM staff_arm_scopes a WHERE a.tenant_id=d.tenant_id AND a.user_id=?) OR EXISTS(SELECT 1 FROM staff_arm_scopes a WHERE a.tenant_id=d.tenant_id AND a.user_id=? AND a.arm_id=COALESCE(d.arm_id,d.tenant_id))))) ORDER BY p.received_at DESC LIMIT 150").bind(tenant,['owner','admin'].includes(t.role)?1:0,user.id,user.id,user.id,user.id).all();return json({rows:r.results})}
  if(method==='POST'){
   await member(env,user,slug,'edit');
   const b=await input(req),did=field(b.documentId,'document ID',80),amount=cents(b.amount);
   if(amount<=0)fail(400,'Amount must be positive');
   const d=await env.DB.prepare('SELECT kind,arm_id,location_id FROM documents WHERE tenant_id=? AND id=?').bind(tenant,did).first();
   if(!d||!billable.has(d.kind))fail(404,'Billable document not found');
   await assertDocumentReadScope(env,user,t,d.arm_id,d.location_id);cashier(t,d.kind);
   try{await env.DB.prepare('INSERT INTO payments(id,tenant_id,document_id,amount_minor,method,recorded_by) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,did,amount,String(b.method||'Cash').slice(0,60),user.id).run()}catch(e){if(String(e).includes('Payment exceeds'))fail(409,'Payment exceeds outstanding balance');throw e}
   return json({ok:true},201);
  }
 }
 if(resource==='issue'&&method==='POST'){
  await member(env,user,slug,'edit');
  const b=await input(req),did=field(b.documentId,'document ID',80);
  const d=await env.DB.prepare('SELECT kind,status,arm_id,location_id FROM documents WHERE tenant_id=? AND id=?').bind(tenant,did).first();
  if(!d||d.status!=='draft')fail(404,'Draft not found');await assertDocumentReadScope(env,user,t,d.arm_id,d.location_id);cashier(t,d.kind);
  if(receiptTypes.has(d.kind))fail(400,'Issue paid receipts through new sale flow');
  const economicId=await env.DB.prepare('SELECT economic_transaction_id FROM documents WHERE tenant_id=? AND id=?').bind(tenant,did).first();
  await env.DB.batch([
   env.DB.prepare("UPDATE documents SET status='issued',updated_at=datetime('now') WHERE tenant_id=? AND id=? AND status='draft'").bind(tenant,did),
   ...(billable.has(d.kind)?[env.DB.prepare('INSERT INTO usage_events(tenant_id,origin_transaction_id,period_wat) VALUES(?,?,?) ON CONFLICT(tenant_id,origin_transaction_id) DO NOTHING').bind(tenant,economicId?.economic_transaction_id||did,lagosUsagePeriod())]:[])
  ]);
  return json({ok:true});
 }
 if(resource==='void'&&method==='POST'){
  const did=field((await input(req)).documentId,'document ID',80);
  const selected=await env.DB.prepare('SELECT arm_id,location_id FROM documents WHERE tenant_id=? AND id=?').bind(tenant,did).first();
  if(!selected)fail(404,'Document not found');await assertDocumentReadScope(env,user,t,selected.arm_id,selected.location_id);
  const r=await env.DB.prepare("UPDATE documents SET status='voided',updated_at=datetime('now') WHERE tenant_id=? AND id=? AND status IN ('draft','issued') AND paid_minor=0").bind(tenant,did).run();
  if(!r.meta?.changes)fail(409,'Cannot void a paid or previously voided document');
  return json({ok:true});
 }
 if(resource==='expenses'){
  if(method==='GET'){const r=await env.DB.prepare('SELECT * FROM expenses WHERE tenant_id=? ORDER BY spent_on DESC LIMIT 100').bind(tenant).all();return json({rows:r.results})}
  if(method==='POST'){
   const b=await input(req),date=String(b.date||day());if(!dateValid(date))fail(400,'Invalid date');
   const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO expenses(id,tenant_id,description,category,amount_minor,spent_on,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,tenant,field(b.description,'expense description',180),String(b.category||'General').slice(0,50),cents(b.amount),date,user.id).run();return json({id},201);
  }
 }
 if(resource==='targets'){
  if(method==='GET'){const r=await env.DB.prepare('SELECT * FROM sales_targets WHERE tenant_id=? ORDER BY period_start DESC LIMIT 18').bind(tenant).all();return json({rows:r.results})}
  if(method==='POST'){
   await member(env,user,slug,'stock');const b=await input(req),month=String(b.month||day().slice(0,7));
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))fail(400,'Invalid month');
   const end=new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).toISOString().slice(0,10);
   await env.DB.prepare("INSERT INTO sales_targets(id,tenant_id,label,period_start,period_end,target_minor,created_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id,id) DO UPDATE SET target_minor=excluded.target_minor").bind(month,tenant,'Monthly sales',month+'-01',end,cents(b.amount),user.id).run();
   return json({ok:true});
  }
 }
 if(resource==='team'&&method==='GET'){
  const r=await env.DB.prepare('SELECT u.email,m.role,m.joined_at,m.disabled_at FROM memberships m JOIN users u ON m.user_id=u.id WHERE m.tenant_id=?').bind(tenant).all();return json({rows:r.results});
 }
 if(resource==='invite'&&method==='POST'){
  const b=await input(req),to=email(b.email),role=field(b.role,'role',30);
  if(!roles.includes(role)||role==='owner'||role==='admin'&&t.role!=='owner')fail(400,'Invalid invitation role');
  const token=rnd();
  await env.DB.prepare("INSERT INTO invitations(id,tenant_id,email,role,token_hash,created_by,expires_at) VALUES(?,?,?,?,?,?,datetime('now','+7 days'))").bind(crypto.randomUUID(),tenant,to,role,await hash(token),user.id).run();
  return json({url:new URL('/join?token='+token,req.url).toString()},201);
 }
 if(resource==='signature'&&method==='POST'){
  const ct=req.headers.get('content-type');
  if(!['image/png','image/jpeg','image/webp'].includes(ct))fail(400,'Use a transparent PNG, JPEG or WebP signature');
  const content=await req.arrayBuffer();
  if(content.byteLength<30||content.byteLength>400000)fail(413,'Signature image must be under 400 KB');
  const bytes=new Uint8Array(content);
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;
  if((ct==='image/png'&&!png)||(ct==='image/jpeg'&&!jpeg)||(ct==='image/webp'&&!webp))fail(400,'Signature file content does not match its image format');
  await env.ASSETS.put('tenants/'+tenant+'/signature',content,{httpMetadata:{contentType:ct}});
  await env.DB.prepare('UPDATE tenants SET signature_url=? WHERE id=?').bind('/media/'+tenant+'/signature',tenant).run();
  return json({url:'/media/'+tenant+'/signature'});
 }
 if(resource==='logo'&&method==='POST'){
  const ct=req.headers.get('content-type');
  if(!['image/png','image/jpeg','image/webp'].includes(ct))fail(400,'Use PNG, JPEG or WebP');
  const content=await req.arrayBuffer();if(content.byteLength<30||content.byteLength>400000)fail(413,'Logo must be under 400 KB');
  const bytes=new Uint8Array(content);
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;
  if((ct==='image/png'&&!png)||(ct==='image/jpeg'&&!jpeg)||(ct==='image/webp'&&!webp))fail(400,'The uploaded image contents do not match its format');
  await env.ASSETS.put('tenants/'+tenant+'/logo',content,{httpMetadata:{contentType:ct}});
  await env.DB.prepare('UPDATE tenants SET logo_url=? WHERE id=?').bind('/media/'+tenant+'/logo',tenant).run();
  return json({url:'/media/'+tenant+'/logo'});
 }
 fail(405,'Unsupported endpoint');
}
function escapeHtml(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function brandPage(slug,env,origin){
 if(!slugValid(slug))return new Response('Business not found',{status:404});
 const biz=await env.DB.prepare("SELECT slug,business_name,logo_url,brand_color FROM tenants WHERE slug=? AND disabled_at IS NULL").bind(slug).first();
 if(!biz)return new Response('Business not found',{status:404});
 const requestHost=new URL(origin).hostname;
 const tenantHost=requestHost.startsWith(slug+'.')?requestHost.slice(slug.length+1):null;
 const base=typeof env.BIZLANO_PUBLIC_ORIGIN==='string'&&/^https:\/\/[a-z0-9.-]+$/.test(env.BIZLANO_PUBLIC_ORIGIN)?env.BIZLANO_PUBLIC_ORIGIN:(tenantHost?'https://'+tenantHost:'');
 const name=escapeHtml(biz.business_name),logo=biz.logo_url?'<img src="'+escapeHtml(biz.logo_url)+'" alt="'+name+' logo" style="max-height:75px;max-width:135px;object-fit:contain;margin-bottom:20px">':'';
 const recovery=base+'/receipts?business='+encodeURIComponent(biz.slug),staff=base+'/app?biz='+encodeURIComponent(biz.slug);
 const page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+name+' · Receipt recovery | Bizlano</title><link rel="icon" type="image/png" href="/assets/bizlano-mark.png"><style>'+
 '*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:flex;flex-direction:column;font-family:system-ui,sans-serif;color:#242945;background:#faf9ff}header,footer{padding:17px max(20px,calc((100% - 1080px)/2));background:white}header{display:flex;justify-content:space-between;align-items:center;gap:15px;border-bottom:1px solid #e8e8f2}header img{height:34px;max-width:145px;object-fit:contain}main{flex:1;display:grid;place-items:center;padding:50px 18px}.card{width:100%;max-width:590px;text-align:center;border:1px solid #e7e7f0;background:white;padding:53px 28px;border-radius:18px;box-shadow:0 22px 55px #2f236b0b}h1{font-size:clamp(27px,5vw,43px);letter-spacing:-1.5px;margin:10px 0}h2{font-size:17px}.eyebrow{font-size:10px;font-weight:800;color:#6840d1;letter-spacing:2px;text-transform:uppercase}p{color:#768198;font-size:13px;line-height:1.85;max-width:425px;margin:12px auto}a{color:#6636dc;text-decoration:none;font-weight:750}a:focus-visible{outline:3px solid #a18cf0;outline-offset:3px}.button{display:inline-block;background:#6634df;color:white;border-radius:11px;padding:14px 20px;margin-top:17px;font-size:13px;min-height:47px}.separator{border-top:1px solid #e8e8f0;margin:31px 0 21px}.small-link{display:inline-block;margin-top:8px;font-size:12px}footer{text-align:center;font-size:11px;color:#8a92aa;border-top:1px solid #e8e8f0}footer .owner-brand{display:inline-flex;align-items:center;gap:8px;padding:8px;text-align:left;color:#5f33ca}footer .owner-brand img{width:38px;height:38px;object-fit:contain}@media(max-width:480px){main{padding:23px 12px}.card{padding:32px 19px}header img{height:29px}header a{font-size:11px}}'+
 '</style></head><body><header><a href="'+base+'/"><img src="/assets/bizlano-logo.png" alt="Bizlano"></a><a href="'+base+'/">← Back to Bizlano</a></header><main><section class="card">'+logo+'<div class="eyebrow">'+name+'</div><h1>Lost your receipt?</h1><p>Sign in using the email you gave '+name+'. Your receipts from this business and other participating stores will be together in your private Bizlano account.</p><a class="button" href="'+recovery+'">Recover your receipt →</a><div class="separator"></div><h2>Business and staff access</h2><p>Only authorized business members can manage receipts, sales and records.</p><a class="small-link" href="'+staff+'">Sign in to business workspace →</a></section></main><footer>Powered by Bizlano · <a href="'+base+'/">Bizlano homepage</a><br><a class="owner-brand" href="https://www.globalwebstores.com/explore" target="_blank" rel="noopener noreferrer"><img src="https://www.globalwebstores.com/brand/global-webstores-full.png" alt="Global Web Stores official logo" width="38" height="38"><span>A Global Web Stores brand<br>Explore Global Web Stores ↗</span></a></footer></body></html>';
 return new Response(page,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff','x-frame-options':'DENY'}});
}
export default {async fetch(req,env){
 const url=new URL(req.url),p=url.pathname;
 // Future wildcard domain works only after DNS and Cloudflare routes are configured.
 // The usable fallback today is /s/<business-slug> on the existing Cloudflare hostname.
 const host=url.hostname.toLowerCase();
 const businessDomain=String(env.BIZLANO_BUSINESS_DOMAIN||'').trim().toLowerCase();
 const suffix=businessDomain&&/^[a-z0-9.-]+\.[a-z]{2,}$/.test(businessDomain)?'.'+businessDomain:null;
 const sub=suffix&&host.endsWith(suffix)?host.slice(0,-suffix.length):null;
 if(sub&&slugValid(sub)&&p==='/')return brandPage(sub,env,url.origin);
 if(req.method==='GET'&&/^\/s\/[a-z0-9-]+\/?$/.test(p))return brandPage(p.split('/')[2],env,url.origin);
 if(req.method==='GET'&&/^\/go\/[a-z0-9-]+\/?$/.test(p)){
  const biz=p.split('/')[2];if(!slugValid(biz))return new Response('Unknown business',{status:404});
  return Response.redirect(new URL('/app?biz='+encodeURIComponent(biz),url.origin),302);
 }

 if(req.method==='GET'&&Object.prototype.hasOwnProperty.call(legalPages,p))return new Response(legalPage(p),{headers:{'content-type':'text/html;charset=utf-8','cache-control':'public,max-age=300','x-content-type-options':'nosniff','x-frame-options':'DENY'}});
 if(req.method==='GET'&&(p==='/receipts'||p==='/receipts/'))return new Response(customerHtml,{headers:{'content-type':'text/html;charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin'}});
 if(req.method==='GET'&&p==='/customer.js')return new Response(customerJs,{headers:{'content-type':'application/javascript;charset=utf-8','cache-control':'public,max-age=300'}});
 if(req.method==='GET'&&p==='/')return new Response(landing,{headers:{'content-type':'text/html;charset=utf-8','x-content-type-options':'nosniff','cache-control':'public,max-age=180','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','referrer-policy':'strict-origin-when-cross-origin'}});
 if(req.method==='GET'&&(p==='/app'||p==='/app/'||p==='/join'||p==='/index.html'))return new Response(html,{headers:{'content-type':'text/html;charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','referrer-policy':'strict-origin-when-cross-origin'}});
 if(req.method==='GET'&&p==='/client.js')return new Response(client,{headers:{'content-type':'application/javascript;charset=utf-8','cache-control':'no-store'}});
 if(req.method==='GET'&&p==='/favicon.svg')return Response.redirect(new URL('/assets/bizlano-mark.png',req.url),302);
 if(req.method==='GET'&&['/assets/bizlano-logo.png','/assets/bizlano-mark.png','/assets/bizlano-hero.jpg'].includes(p)){
  const key=p.endsWith('-logo.png')?'brand/bizlano-logo.png':p.endsWith('-mark.png')?'brand/bizlano-mark.png':'brand/bizlano-hero.jpg';
  const contentType=p.endsWith('.jpg')?'image/jpeg':'image/png';
  const asset=await env.ASSETS.get(key);
  if(!asset)return new Response('Brand asset unavailable',{status:404});
  return new Response(asset.body,{headers:{'content-type':contentType,'x-content-type-options':'nosniff','cache-control':'public,max-age=604800','access-control-allow-origin':'*'}});
 }
 if(req.method==='GET'&&/^\/media\/[a-f0-9-]{36}\/(logo|signature)$/.test(p)){
  const id=p.split('/')[2],imageType=p.split('/')[3],asset=await env.ASSETS.get('tenants/'+id+'/'+imageType);
  return asset?new Response(asset.body,{headers:{'content-type':asset.httpMetadata?.contentType||'image/png','cache-control':'public,max-age=120'}}):new Response('Not found',{status:404});
 }
 if(!p.startsWith('/api/'))return new Response('Not found',{status:404});
 if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed'},405);
 if(req.method==='POST'){
  if(!p.startsWith(BRIDGE_PATH)&&req.headers.get('origin')!==url.origin)return json({error:'Cross-site request denied'},403);
  if(!p.endsWith('/logo')&&!p.endsWith('/signature')&&!req.headers.get('content-type')?.includes('application/json'))return json({error:'Expected JSON'},415);
 }
 try{return await api(req,env,url)}catch(e){
  if(e instanceof ErrorWithStatus)return json({error:e.message},e.code);
  console.error('Bizlano API error',String(e?.message||e).slice(0,200));
  return json({error:'Server error; please try again'},500);
 }
}};
