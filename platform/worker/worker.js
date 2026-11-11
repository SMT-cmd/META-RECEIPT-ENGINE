import {html,client} from './ui.js';
const project='metaforge-6afdf';
const issuer='https://securetoken.google.com/'+project;
const jwks='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const billable=new Set(['receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice']);
const receiptTypes=new Set(['receipt','cash-sale','retail-receipt','thermal-receipt','service-receipt','rent-receipt','school-fees','medical-receipt']);
const types=new Set([...billable,'quotation','estimate','proforma','purchase-order','delivery-note','credit-note','debit-note','custom']);
const roles=['owner','admin','manager','accountant','cashier','sales','viewer'];
const access={view:roles,edit:['owner','admin','manager','accountant','cashier','sales'],stock:['owner','admin','manager'],finance:['owner','admin','manager','accountant'],admin:['owner','admin'],owner:['owner']};
const reserved=['www','api','auth','app','admin','billing','support','bizlano','metaforge','timi'];
const baseHeaders={'cache-control':'no-store','x-content-type-options':'nosniff'};
class ErrorWithStatus extends Error {constructor(code,message){super(message);this.code=code}}
function fail(code,message){throw new ErrorWithStatus(code,message)}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{...baseHeaders,'content-type':'application/json; charset=utf-8',...headers}})}
const dec=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const str=bytes=>new TextDecoder().decode(bytes);
const hex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
const rnd=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
async function hash(s){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))))}
const field=(s,name,max=160)=>{if(typeof s!=='string'||!s.trim()||s.length>max)fail(400,'Invalid '+name);return s.trim()};
const email=s=>{s=field(s,'email',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))fail(400,'Invalid email');return s};
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
 const user=await env.DB.prepare("SELECT u.id,u.email,u.display_name FROM sessions s JOIN users u ON s.user_id=u.id WHERE token_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL AND u.disabled_at IS NULL").bind(await hash(token)).first();
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
async function api(req,env,url) {
 const path=url.pathname,method=req.method;
 if(path==='/api/health'){const r=await env.DB.prepare('SELECT 1 AS ok').first();return json({ok:r?.ok===1,service:'bizlano',db:'D1',assets:'R2'})}
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
  const token=rnd();
  await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+7 days'))").bind(await hash(token),known.user_id).run();
  return json({ok:true},200,{'set-cookie':sessionCookie(token,604800)});
 }
 if(path==='/api/logout'&&method==='POST'){
  const token=sessionToken(req);
  if(token)await env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE token_hash=?").bind(await hash(token)).run();
  return json({ok:true},200,{'set-cookie':sessionCookie('',0)});
 }
 const user=await identity(req,env);
 if(path==='/api/me'&&method==='GET'){
  const businesses=await env.DB.prepare('SELECT t.slug,t.business_name,t.currency,m.role FROM memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=? AND m.disabled_at IS NULL AND t.disabled_at IS NULL ORDER BY t.created_at DESC').bind(user.id).all();
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
  const items=await env.DB.prepare('SELECT product_id,description,quantity_milli,unit_price_minor,line_total_minor FROM document_lines WHERE tenant_id=? AND document_id=? ORDER BY rowid').bind(tenant.id,detail[2]).all();
  return json({document:{...d,customer:d.recipient_name,date:d.issued_on,received:d.paid_minor/100,
   items:(items.results||[]).map(i=>({description:i.description,qty:i.quantity_milli/1000,price:i.unit_price_minor/100,productId:i.product_id})),
   discountPct:d.subtotal_minor?d.discount_minor*100/d.subtotal_minor:0,
   taxPct:d.subtotal_minor>d.discount_minor?d.tax_minor*100/(d.subtotal_minor-d.discount_minor):0,
   shipping:d.shipping_minor/100}});
 }
 const m=path.match(/^\/api\/b\/([a-z0-9-]+)\/(overview|customers|products|documents|payments|expenses|targets|team|invite|logo|issue|void)$/);
 if(!m)fail(404,'Not found');
 const slug=m[1],resource=m[2];
 const scope=['expenses','targets'].includes(resource)?'finance':['team','invite','logo','void'].includes(resource)?'admin':resource==='products'&&method==='POST'?'stock':'view';
 const t=await member(env,user,slug,scope),tenant=t.id;
 if(resource==='overview'&&method==='GET'){
  const [docs,customers,products,expenses]=await env.DB.batch([
   env.DB.prepare("SELECT count(*) AS count,coalesce(sum(total_minor),0) AS total,coalesce(sum(paid_minor),0) AS paid FROM documents WHERE tenant_id=? AND status NOT IN ('draft','voided') AND kind IN ('receipt','cash-sale','retail-receipt','thermal-receipt','service-receipt','invoice','tax-invoice','recurring-invoice')").bind(tenant),
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
  if(method==='GET'){const r=await env.DB.prepare('SELECT id,document_number,kind,recipient_name,issued_on,due_on,total_minor,paid_minor,status,currency,template,notes FROM documents WHERE tenant_id=? ORDER BY created_at DESC LIMIT 150').bind(tenant).all();return json({rows:r.results})}
  if(method==='POST'){
   await member(env,user,slug,'edit');
   const b=await input(req),kind=field(b.kind,'document type',60),items=b.items;
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
   const did=crypto.randomUUID(),number=kind.replace(/[^a-z]/g,'').slice(0,4).toUpperCase()+'-'+date.slice(0,4)+'-'+did.slice(0,8).toUpperCase();
   const batch=[env.DB.prepare('INSERT INTO documents(id,tenant_id,document_number,kind,template,recipient_name,issued_on,due_on,currency,subtotal_minor,discount_minor,tax_minor,shipping_minor,total_minor,status,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(did,tenant,number,kind,String(b.template||'signature').slice(0,40),String(b.customer||'Walk-in').slice(0,120),date,due||null,t.currency,subtotal,discount,tax,shipping,total,draft?'draft':'issued',String(b.notes||'').slice(0,1800),user.id)];
   for(const line of lines)batch.push(env.DB.prepare('INSERT INTO document_lines(id,tenant_id,document_id,product_id,description,quantity_milli,unit_price_minor,line_total_minor) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,did,line.productId,line.description,line.qty,line.price,line.value));
   if(received>0)batch.push(env.DB.prepare('INSERT INTO payments(id,tenant_id,document_id,amount_minor,method,recorded_by) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,did,received,String(b.method||'Cash').slice(0,50),user.id));
   try{await env.DB.batch(batch)}catch(e){if(String(e).includes('stock'))fail(409,'Insufficient stock to issue document');throw e}
   await audit(env,tenant,user,'document.created',did);
   return json({id:did,number,total_minor:total},201);
  }
 }
 if(resource==='payments'){
  if(method==='GET'){const r=await env.DB.prepare('SELECT p.id,p.amount_minor,p.method,p.received_at,d.document_number FROM payments p JOIN documents d ON d.id=p.document_id AND d.tenant_id=p.tenant_id WHERE p.tenant_id=? ORDER BY p.received_at DESC LIMIT 150').bind(tenant).all();return json({rows:r.results})}
  if(method==='POST'){
   await member(env,user,slug,'edit');
   const b=await input(req),did=field(b.documentId,'document ID',80),amount=cents(b.amount);
   if(amount<=0)fail(400,'Amount must be positive');
   const d=await env.DB.prepare('SELECT kind FROM documents WHERE tenant_id=? AND id=?').bind(tenant,did).first();
   if(!d||!billable.has(d.kind))fail(404,'Billable document not found');cashier(t,d.kind);
   try{await env.DB.prepare('INSERT INTO payments(id,tenant_id,document_id,amount_minor,method,recorded_by) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,did,amount,String(b.method||'Cash').slice(0,60),user.id).run()}catch(e){if(String(e).includes('Payment exceeds'))fail(409,'Payment exceeds outstanding balance');throw e}
   return json({ok:true},201);
  }
 }
 if(resource==='issue'&&method==='POST'){
  await member(env,user,slug,'edit');
  const b=await input(req),did=field(b.documentId,'document ID',80);
  const d=await env.DB.prepare('SELECT kind,status FROM documents WHERE tenant_id=? AND id=?').bind(tenant,did).first();
  if(!d||d.status!=='draft')fail(404,'Draft not found');cashier(t,d.kind);
  if(receiptTypes.has(d.kind))fail(400,'Issue paid receipts through new sale flow');
  await env.DB.prepare("UPDATE documents SET status='issued',updated_at=datetime('now') WHERE tenant_id=? AND id=? AND status='draft'").bind(tenant,did).run();
  return json({ok:true});
 }
 if(resource==='void'&&method==='POST'){
  const did=field((await input(req)).documentId,'document ID',80);
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
 if(resource==='logo'&&method==='POST'){
  const ct=req.headers.get('content-type');
  if(!['image/png','image/jpeg','image/webp'].includes(ct))fail(400,'Use PNG, JPEG or WebP');
  const content=await req.arrayBuffer();if(content.byteLength<30||content.byteLength>400000)fail(413,'Logo must be under 400 KB');
  await env.ASSETS.put('tenants/'+tenant+'/logo',content,{httpMetadata:{contentType:ct}});
  await env.DB.prepare('UPDATE tenants SET logo_url=? WHERE id=?').bind('/media/'+tenant+'/logo',tenant).run();
  return json({url:'/media/'+tenant+'/logo'});
 }
 fail(405,'Unsupported endpoint');
}
export default {async fetch(req,env){
 const url=new URL(req.url),p=url.pathname;
 if(req.method==='GET'&&(p==='/'||p==='/join'||p==='/index.html'))return new Response(html,{headers:{'content-type':'text/html;charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-cache'}});
 if(req.method==='GET'&&p==='/client.js')return new Response(client,{headers:{'content-type':'application/javascript;charset=utf-8','cache-control':'public,max-age=300'}});
 if(req.method==='GET'&&p==='/favicon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#181b43"/><path d="M19 10h17c18 0 20 17 8 23 14 5 12 21-8 21H10l9-44zm9 10-3 10h11c9 0 10-10 1-10h-9zm-5 20-3 9h15c8 0 9-9 0-9H23Z" fill="#9156ff"/></svg>',{headers:{'content-type':'image/svg+xml'}});
 if(req.method==='GET'&&/^\/media\/[a-f0-9-]{36}\/logo$/.test(p)){
  const id=p.split('/')[2],asset=await env.ASSETS.get('tenants/'+id+'/logo');
  return asset?new Response(asset.body,{headers:{'content-type':asset.httpMetadata?.contentType||'image/png','cache-control':'public,max-age=120'}}):new Response('Not found',{status:404});
 }
 if(!p.startsWith('/api/'))return new Response('Not found',{status:404});
 if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed'},405);
 if(req.method==='POST'){
  if(req.headers.get('origin')!==url.origin)return json({error:'Cross-site request denied'},403);
  if(!p.endsWith('/logo')&&!req.headers.get('content-type')?.includes('application/json'))return json({error:'Expected JSON'},415);
 }
 try{return await api(req,env,url)}catch(e){
  if(e instanceof ErrorWithStatus)return json({error:e.message},e.code);
  console.error('Bizlano API error',String(e?.message||e).slice(0,200));
  return json({error:'Server error; please try again'},500);
 }
}};
