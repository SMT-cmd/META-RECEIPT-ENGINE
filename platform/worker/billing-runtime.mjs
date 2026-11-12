// Bizlano billing operates entirely separately from vendor/customer payments.
// Prepaid plans only. A hard-coded release flag AND an environment gate are required for checkout.
const BILLING_PAYMENT_PATH='/api/billing/paystack/webhook';
const billingEnabled=env=>BILLING_LIVE&&env.BIZLANO_BILLING_APPROVED==='yes'&&Date.now()>=Date.parse(BILLING_TARGET_DATE+'T00:00:00+01:00');
const billDate=d=>new Date(d).toISOString();
function addBillingMonths(value,count){
 const d=new Date(value);
 const target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+count,1,d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()));
 const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
 target.setUTCDate(Math.min(last,d.getUTCDate()));
 return target.toISOString();
}
const billingPlan=id=>PLANS.find(p=>p.id===id);
async function gwsVerifiedDiscount(env,tenant){
 const row=await env.DB.prepare("SELECT tenant_id FROM discount_eligibility WHERE tenant_id=? AND program='gws_paid_vendor' AND datetime(valid_until)>datetime('now') AND datetime(verified_at)<=datetime('now')").bind(tenant).first();
 return Boolean(row);
}
async function billingQuote(env,tenant,planId,term){
 const p=billingPlan(planId);
 if(!p||p.id==='free'||!['monthly','quarterly','six_months','yearly'].includes(term))fail(400,'Choose a valid paid plan and payment period');
 const verifiedGwsPaidVendor=await gwsVerifiedDiscount(env,tenant);
 const q=proposedQuote(planId,term,{verifiedGwsPaidVendor});
 return {...q,amountMinor:q.amountNGN*100,currency:'NGN',verifiedGwsPaidVendor,automaticRenewal:false};
}
async function paystackCall(env,method,endpoint,body){
 const key=String(env.BIZLANO_PAYSTACK_SECRET_KEY||'');
 if(!/^sk_(test|live)_[a-zA-Z0-9]+$/.test(key))fail(503,'Bizlano payment service has not been configured');
 const expected=env.BIZLANO_PAYMENT_MODE;
 if((expected==='live'&&!key.startsWith('sk_live_'))||(expected==='test'&&!key.startsWith('sk_test_'))||!['live','test'].includes(expected))fail(503,'Bizlano payment mode is not ready');
 const res=await fetch('https://api.paystack.co'+endpoint,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)fail(502,'Payment provider is temporarily unavailable');
 const data=await res.json();
 if(!data.status||!data.data)fail(502,'Payment provider did not complete the request');
 return data.data;
}
const constantTimeEqual=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0};
async function signedPaystackEvent(req,env){
 const raw=new Uint8Array(await req.arrayBuffer());
 if(raw.length>100000)fail(413,'Webhook payload is too large');
 const modern=req.headers.get('paystack-signature'),legacy=req.headers.get('x-paystack-signature');
 const signingKey=String(env.BIZLANO_PAYSTACK_WEBHOOK_SECRET||'');
 const oldKey=String(env.BIZLANO_PAYSTACK_SECRET_KEY||'');
 let valid=false;
 const digest=async(key,payload)=>{
  const cryptoKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-512'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,payload)),c=>c.toString(16).padStart(2,'0')).join('');
 };
 if(modern&&signingKey.startsWith('whsec_')){
  const parts=modern.split(',').map(x=>x.trim());
  const t=parts.find(x=>x.startsWith('t='))?.slice(2)||'';
  if(/^[0-9]{10}$/.test(t)&&Math.abs(Date.now()/1000-Number(t))<=300){
   const prefix=new TextEncoder().encode(t+'.'),payload=new Uint8Array(prefix.length+raw.length);
   payload.set(prefix);payload.set(raw,prefix.length);
   const check=await digest(signingKey,payload);
   valid=parts.filter(x=>x.startsWith('v1=')).some(x=>/^[a-zA-Z0-9_]+:[0-9a-f]{128}$/.test(x.slice(3))&&constantTimeEqual(x.slice(3).split(':')[1],check));
  }
 }else if(legacy&&/^sk_(test|live)_/.test(oldKey)&&/^[0-9a-f]{128}$/.test(legacy)){
  valid=constantTimeEqual(legacy,await digest(oldKey,raw));
 }
 if(!valid)fail(401,'Webhook signature is invalid');
 let event;try{event=JSON.parse(new TextDecoder().decode(raw))}catch{fail(400,'Invalid payment event')}
 if(!event||typeof event.event!=='string'||typeof event.data!=='object')fail(400,'Invalid payment event');
 return event;
}
async function settleBillingPayment(env,reference,eventId){
 if(!/^BZL[A-Z0-9]{32}$/.test(reference))fail(400,'Invalid transaction reference');
 const invoice=await env.DB.prepare("SELECT id,tenant_id,plan_id,term,state,amount_minor,currency,price_version_id,purchaser_user_id FROM subscription_invoices WHERE payment_reference=?").bind(reference).first();
 if(!invoice)return {ignored:true};
 if(invoice.state==='paid')return {ok:true,alreadyProcessed:true};
 if(invoice.state!=='pending')return {ignored:true,state:invoice.state};
 const charge=await paystackCall(env,'GET','/transaction/verify/'+encodeURIComponent(reference));
 if(charge.reference!==reference||charge.status!=='success'||charge.currency!=='NGN'||Number(charge.amount)!==invoice.amount_minor)fail(409,'Payment verification did not match the invoice');
 const p=billingPlan(invoice.plan_id);
 if(!p)fail(409,'The selected plan is no longer available');
 const now=new Date().toISOString();
 const previous=await env.DB.prepare("SELECT id,plan_id,current_period_end FROM subscriptions WHERE tenant_id=? AND status IN('active','grace') ORDER BY starts_at DESC LIMIT 1").bind(invoice.tenant_id).first();
 let end=addBillingMonths(now,{monthly:1,quarterly:3,six_months:6,yearly:12}[invoice.term]);
 if(previous&&Date.parse(previous.current_period_end)>Date.now()){
  if(previous.plan_id===p.id){end=addBillingMonths(previous.current_period_end,{monthly:1,quarterly:3,six_months:6,yearly:12}[invoice.term])}
  else{const remaining=Date.parse(previous.current_period_end)-Date.now();end=new Date(Date.parse(end)+Math.max(0,remaining)).toISOString()}
 }
 const id=crypto.randomUUID(),cycleId=crypto.randomUUID(),eventsId='paystack-'+String(eventId).slice(0,100);
 const person=await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(invoice.purchaser_user_id).first();
 const email=person?.email||'';
 const notify=email&&!email.endsWith('@accounts.bizlano.invalid');
 const receiptText='Your Bizlano '+p.name+' access is confirmed through '+end.slice(0,10)+'. Payment: ₦'+(invoice.amount_minor/100).toLocaleString('en-NG')+'. Your earlier business records remain available.';
 const batch=[
  env.DB.prepare("INSERT INTO payment_events(id,provider,provider_event_id,event_type,payload_hash,processed_at) VALUES(?,'paystack',?,'charge.success',?,datetime('now'))").bind(crypto.randomUUID(),eventsId,reference),
  ...(previous?[env.DB.prepare("UPDATE subscriptions SET status='cancelled',cancel_at_period_end=1 WHERE tenant_id=? AND id=? AND status IN('active','grace')").bind(invoice.tenant_id,previous.id)]:[]),
  env.DB.prepare('INSERT INTO subscriptions(id,tenant_id,plan_id,status,price_version_id,term,starts_at,current_period_end) VALUES(?,?,?,\'active\',?,?,?,?)').bind(id,invoice.tenant_id,p.id,invoice.price_version_id,invoice.term,now,end),
  env.DB.prepare('INSERT INTO billing_cycles(id,subscription_id,starts_at,ends_at,charged_minor,status) VALUES(?,?,?,?,?,\'paid\')').bind(cycleId,id,now,end,invoice.amount_minor),
  env.DB.prepare("UPDATE subscription_invoices SET state='paid',billing_cycle_id=? WHERE id=? AND state='pending'").bind(cycleId,invoice.id),
  env.DB.prepare("INSERT INTO tenant_entitlements(tenant_id,plan_id,transactions_per_month,saved_design_profiles,staff_limit,arm_limit,location_limit,enabled,starts_at,ends_at) VALUES(?,?,?,?,?,?,?,1,?,?) ON CONFLICT(tenant_id) DO UPDATE SET plan_id=excluded.plan_id,transactions_per_month=excluded.transactions_per_month,saved_design_profiles=excluded.saved_design_profiles,staff_limit=excluded.staff_limit,arm_limit=excluded.arm_limit,location_limit=excluded.location_limit,enabled=excluded.enabled,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=datetime('now')").bind(invoice.tenant_id,p.id,p.monthlyTransactions,p.designProfiles,p.staff,p.brands,p.locations,now,end),
  env.DB.prepare("INSERT INTO billing_audit_events(id,tenant_id,actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),invoice.tenant_id,invoice.purchaser_user_id,'subscription.activated','subscription',id),
  ...(notify?[env.DB.prepare("INSERT OR IGNORE INTO outbox_notifications(id,tenant_id,dedupe_key,kind,recipient,payload_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),invoice.tenant_id,'paid:'+invoice.id,'billing_confirmation',email,JSON.stringify({subject:'Bizlano plan activated',text:receiptText}))]:[])
 ];
 await env.DB.batch(batch);
 return {ok:true,plan:p.id,endsAt:end};
}
export async function billingAccountAPI(req,env,url,user,t,action){
 if(t.role!=='owner')fail(403,'Only the business owner can manage subscriptions');
 if(action==='status'&&req.method==='GET'){
  const r=await env.DB.prepare("SELECT s.id,s.plan_id,s.status,s.term,s.starts_at,s.current_period_end,s.cancel_at_period_end FROM subscriptions s WHERE s.tenant_id=? ORDER BY s.created_at DESC LIMIT 12").bind(t.id).all();
  const invoices=await env.DB.prepare("SELECT id,amount_minor,state,issued_at,plan_id,term FROM subscription_invoices WHERE tenant_id=? ORDER BY issued_at DESC LIMIT 20").bind(t.id).all();
  return json({paymentsEnabled:billingEnabled(env),subscriptions:r.results||[],invoices:invoices.results||[]});
 }
 if(action==='quote'&&req.method==='POST'){
  const b=await input(req);
  return json({...(await billingQuote(env,t.id,String(b.plan||''),String(b.term||''))),paymentsEnabled:billingEnabled(env)});
 }
 if(action==='cancel'&&req.method==='POST'){
  const active=await env.DB.prepare("SELECT id FROM subscriptions WHERE tenant_id=? AND status IN('active','grace')").bind(t.id).first();
  if(!active)fail(404,'No active paid plan to cancel');
  await env.DB.prepare('UPDATE subscriptions SET cancel_at_period_end=1 WHERE tenant_id=? AND id=?').bind(t.id,active.id).run();
  return json({ok:true,automaticRenewal:false,message:'Your current access remains until its paid-through date. No further automatic charge is scheduled.'});
 }
 if(action==='checkout'&&req.method==='POST'){
  if(!billingEnabled(env))fail(503,'Paid plans have not launched. Free access remains available.');
  const b=await input(req),plan=String(b.plan||''),term=String(b.term||'');
  const q=await billingQuote(env,t.id,plan,term);
  const pending=await env.DB.prepare("SELECT id FROM subscription_invoices WHERE tenant_id=? AND state='pending' ORDER BY issued_at DESC LIMIT 1").bind(t.id).first();
  if(pending)fail(409,'An earlier payment is awaiting confirmation. Please confirm it or contact Bizlano support before starting another.');
  const payVersion=BILLING_PRICE_VERSION+'-'+plan+'-'+term+(q.verifiedGwsPaidVendor?'-gws':'-regular');
  const reference='BZL'+crypto.randomUUID().replace(/-/g,'').toUpperCase();
  const id=crypto.randomUUID();
  await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO billing_accounts(tenant_id,billing_contact_user_id) VALUES(?,?)').bind(t.id,user.id),
   env.DB.prepare("INSERT OR IGNORE INTO price_versions(id,plan_id,term,amount_minor,discount_rule,effective_at) VALUES(?,?,?,?,?,datetime('now'))").bind(payVersion,plan,term,q.amountMinor,q.discount),
   env.DB.prepare("INSERT INTO subscription_invoices(id,tenant_id,amount_minor,currency,payment_reference,state,plan_id,term,price_version_id,purchaser_user_id) VALUES(?,?,?,?,?,'pending',?,?,?,?)").bind(id,t.id,q.amountMinor,'NGN',reference,plan,term,payVersion,user.id)
  ]);
  const target=new URL('/app?biz='+encodeURIComponent(t.slug)+'&billing=verify',url.origin);
  try{
   const r=await paystackCall(env,'POST','/transaction/initialize',{
    email:user.email,amount:String(q.amountMinor),currency:'NGN',reference,callback_url:target.toString(),
    metadata:JSON.stringify({bizlanoInvoiceId:id,bizlanoTenantId:t.id,plan,term,automaticRenewal:false})
   });
   const checkoutUrl=new URL(r.authorization_url);
   if(checkoutUrl.protocol!=='https:'||checkoutUrl.hostname!=='checkout.paystack.com')fail(502,'Unexpected payment provider checkout domain');
   return json({checkoutUrl:checkoutUrl.href,reference,...q},201);
  }catch(e){
   await env.DB.prepare("UPDATE subscription_invoices SET state='failed' WHERE id=? AND state='pending'").bind(id).run();
   throw e;
  }
 }
 if(action==='verify'&&req.method==='POST'){
  if(!billingEnabled(env))fail(503,'Billing verification is not enabled');
  const b=await input(req),reference=String(b.reference||'');
  const invoice=await env.DB.prepare('SELECT id FROM subscription_invoices WHERE tenant_id=? AND payment_reference=?').bind(t.id,reference).first();
  if(!invoice)fail(404,'Payment reference not found in this business');
  return json(await settleBillingPayment(env,reference,'manual-'+reference));
 }
 fail(405,'Subscription action not supported');
}
export async function billingPaystackWebhook(req,env){
 if(req.method!=='POST')fail(405,'Method not allowed');
 if(!billingEnabled(env))fail(503,'Bizlano subscription billing is disabled');
 const e=await signedPaystackEvent(req,env);
 if(e.event==='charge.success'){
  if(typeof e.data.reference!=='string')fail(400,'Missing payment reference');
  return json(await settleBillingPayment(env,e.data.reference,String(e.data.id||e.data.reference)),200);
 }
 // Ignore events that do not indicate verified successful charges.
 return json({ok:true,ignored:e.event},200);
}
export async function runBillingCron(env){
 if(!billingEnabled(env))return {disabled:true};
 const expired=await env.DB.prepare("SELECT s.id,s.tenant_id,s.plan_id,s.current_period_end,u.email,t.business_name FROM subscriptions s JOIN billing_accounts ba ON ba.tenant_id=s.tenant_id JOIN users u ON u.id=ba.billing_contact_user_id JOIN tenants t ON t.id=s.tenant_id WHERE s.status IN('active','grace') AND datetime(s.current_period_end)<=datetime('now') LIMIT 100").all();
 for(const row of expired.results||[]){
  await env.DB.batch([
   env.DB.prepare("UPDATE subscriptions SET status='expired' WHERE id=? AND tenant_id=? AND status IN('active','grace')").bind(row.id,row.tenant_id),
   env.DB.prepare("UPDATE tenant_entitlements SET plan_id='free',transactions_per_month=30,saved_design_profiles=1,staff_limit=1,arm_limit=1,location_limit=1,enabled=1,ends_at=NULL,updated_at=datetime('now') WHERE tenant_id=?").bind(row.tenant_id),
   env.DB.prepare("INSERT OR IGNORE INTO outbox_notifications(id,tenant_id,dedupe_key,kind,recipient,payload_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),row.tenant_id,'expired:'+row.id,'subscription_expired',row.email,JSON.stringify({subject:'Your Bizlano Free workspace is ready',text:row.business_name+': Your '+row.plan_id+' paid term has ended. You can still access previous receipts, invoices and records on Free. Upgrade only when you choose.'}))
  ]);
 }
 const due=await env.DB.prepare("SELECT s.id,s.tenant_id,s.plan_id,s.current_period_end,s.term,u.email,t.business_name FROM subscriptions s JOIN billing_accounts b ON b.tenant_id=s.tenant_id JOIN users u ON u.id=b.billing_contact_user_id JOIN tenants t ON t.id=s.tenant_id WHERE s.status='active' AND datetime(s.current_period_end) BETWEEN datetime('now') AND datetime('now','+30 days') LIMIT 100").all();
 for(const row of due.results||[]){
  const days=Math.ceil((Date.parse(row.current_period_end)-Date.now())/86400000);
  const intervals=row.term==='monthly'?[7,1]:[30,7,1];
  if(!intervals.some(d=>days>=d-1&&days<=d))continue;
  const subject='Bizlano plan renewal reminder';
  const message=row.business_name+': Your '+row.plan_id+' access ends on '+row.current_period_end.slice(0,10)+'. Renew only if you wish to continue premium features. Free access and historical documents remain available.';
  await env.DB.prepare("INSERT OR IGNORE INTO outbox_notifications(id,tenant_id,dedupe_key,kind,recipient,payload_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),row.tenant_id,'renew:'+row.id+':'+days,'renewal_reminder',row.email,JSON.stringify({subject,text:message})).run();
 }
 const queue=await env.DB.prepare("SELECT id,dedupe_key,recipient,payload_json,attempts FROM outbox_notifications WHERE status IN('pending','failed') AND (next_attempt_at IS NULL OR next_attempt_at<=datetime('now')) AND attempts<5 ORDER BY created_at ASC LIMIT 10").all();
 if(!env.BIZLANO_RESEND_API_KEY||!env.BIZLANO_BILLING_FROM)return {queued:queue.results?.length||0,mailConfigured:false};
 let sent=0;
 for(const item of queue.results||[]){
  const lock=await env.DB.prepare("UPDATE outbox_notifications SET status='sending',attempts=attempts+1 WHERE id=? AND status IN('pending','failed')").bind(item.id).run();
  if(!lock.meta?.changes)continue;
  let payload;try{payload=JSON.parse(item.payload_json)}catch{await env.DB.prepare("UPDATE outbox_notifications SET status='failed',next_attempt_at=datetime('now','+1 day') WHERE id=?").bind(item.id).run();continue}
  try{
   const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.BIZLANO_RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':item.dedupe_key},body:JSON.stringify({from:env.BIZLANO_BILLING_FROM,to:[item.recipient],subject:payload.subject,text:payload.text})});
   if(!r.ok)throw Error('Mail provider rejected the message');
   await env.DB.prepare("UPDATE outbox_notifications SET status='sent',sent_at=datetime('now') WHERE id=?").bind(item.id).run();sent++;
  }catch(e){
   await env.DB.prepare("UPDATE outbox_notifications SET status='failed',next_attempt_at=datetime('now','+1 hour') WHERE id=?").bind(item.id).run();
  }
 }
 return {sent,queued:queue.results?.length||0};
}
