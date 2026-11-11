import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,reload,signOut} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import {getFirestore,collection,query,where,limit,getDocs} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
const firebase=initializeApp({
 apiKey:'AIzaSyAElgJBP-F322zoJ-T1qeE48s2ka0EcEvw',
 authDomain:'metaforge-6afdf.firebaseapp.com',
 projectId:'metaforge-6afdf',
 appId:'1:261172077627:web:cb3cec74be2dbcb1d6281e'
});
const auth=getAuth(firebase),oldDb=getFirestore(firebase),app=document.getElementById('app'),toast=document.getElementById('toast');
const state={user:null,me:null,biz:null,view:'overview',data:null,products:[],customers:[],items:[{description:'',qty:1,price:0,productId:''}],busy:false,authMode:new URL(location.href).searchParams.get('mode')==='register'?'register':'login',pendingEmail:null,resetToken:null,preview:null,legacyArchive:null,backupReady:false,chartMode:'bar',chartDays:30,connectError:'',design:null,templateChoice:null};
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const curr=n=>'₦'+Number(n/100||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
const oldMoney=n=>'₦'+Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
const slug=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
const today=()=>new Date().toISOString().slice(0,10);
const val=(f,k)=>f.elements.namedItem(k)?.value?.trim()||'';
const safeRole=r=>['owner','admin','manager','accountant','cashier','sales','viewer'].includes(r);
const finance=()=>['owner','admin','manager','accountant'].includes(state.biz?.role);
const admin=()=>['owner','admin'].includes(state.biz?.role);
const edit=()=>state.biz?.role!=='viewer';
const stock=()=>['owner','admin','manager'].includes(state.biz?.role);
function flash(m,error=false){toast.textContent=m;toast.classList.remove('hidden');toast.classList.toggle('error',error);clearTimeout(flash.timer);flash.timer=setTimeout(()=>toast.classList.add('hidden'),4800)}
async function api(path,data){
 const opts=data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)};
 const r=await fetch('/api'+path,{...opts,credentials:'same-origin'});
 let body;try{body=await r.json()}catch{throw Error('Cannot read server response')}
 if(!r.ok)throw Error(body.error||'Request failed');
 return body;
}
async function attach(){
 if(!state.user?.emailVerified)return;
 state.me=await api('/me');
 const desired=new URL(location.href).searchParams.get('biz');
 const linked=state.me.businesses.find(b=>b.slug===desired)||state.me.businesses.find(b=>b.slug===state.biz?.slug)||state.me.businesses[0];
 state.biz=linked||null;
 const invite=new URL(location.href).searchParams.get('token');
 if(invite&&/^[a-f0-9]{64}$/.test(invite)){
  await api('/join',{token:invite});
  history.replaceState(null,'','/app');
  state.me=await api('/me');state.biz=state.me.businesses[0]||null;
  flash('You have joined the business workspace.');
 }
 if(state.biz)await load();
 else render();
}
async function load(){
 if(!state.biz){render();return}
 state.data=null;render();
 const t='/b/'+state.biz.slug;
 const section=state.view;
 let resource=section==='overview'||section==='branding'?'overview':section==='create'?'products':section==='team'?'team':section==='alerts'?'notifications':section==='gws'?'marketplace':section;
 if(section==='upgrade'){state.data={};render();return}
 if(section==='overview'){
  const [main,trends,goals]=await Promise.all([api(t+'/overview'),api(t+'/trends'),api(t+'/targets')]);
  state.data={...main,trends:trends.rows,goals:goals.rows};render();return;
 }
 if(section==='design'){const x=await api(t+'/design');state.design=x.design;state.data=x;render();return}
 if(section==='branding'){const [main,details]=await Promise.all([api(t+'/overview'),api(t+'/design')]);state.data=main;state.design=details.design;render();return}
 if(section==='create') {
  const [p,c,d]=await Promise.all([api(t+'/products'),api(t+'/customers'),api(t+'/design')]);
  state.design=d.design;
  state.products=p.rows;state.customers=c.rows;state.data={};
 }else state.data=await api(t+'/'+resource);
 render();
}
function brand(){return '<img class="brand-icon" src="/assets/bizlano-mark.png" width="43" height="43" alt=""><span>Bizlano</span>'}
function input(label,name,type='text',value='',required=false,extra=''){
 return '<label class="field">'+e(label)+'<input name="'+e(name)+'" type="'+type+'" value="'+e(value)+'" '+(required?'required':'')+' '+extra+'></label>';
}
function select(label,name,choices,selected){
 return '<label class="field">'+e(label)+'<select name="'+e(name)+'">'+choices.map(x=>'<option value="'+e(x[0])+'" '+(selected===x[0]?'selected':'')+'>'+e(x[1])+'</option>').join('')+'</select></label>';
}
function heading(k,title,desc,actions=''){return '<div class="page-head"><div><div class="eyebrow">'+e(k)+'</div><h1>'+e(title)+'</h1><p>'+e(desc)+'</p></div>'+actions+'</div>'}
function simpleRows(rows,fn){return rows?.length?rows.map(fn).join(''):'<div class="empty">Nothing here yet. Your records will appear as you add them.</div>'}
function loginScreen(){
 const pending=Boolean(state.pendingEmail&&!state.user),logged=Boolean(state.user&&state.user.emailVerified),reset=Boolean(state.resetToken);
 const title=reset?'Create a new password':pending?'Check your email':logged?'Your secure workspace':state.authMode==='register'?'Register for free':state.authMode==='forgot'?'Reset password':'Welcome back';
 let body='';
 if(reset)body='<p class="muted">Choose a new password of at least 10 characters.</p><form data-form="reset" class="stack">'+input('New password','password','password','',true,'minlength="10" autocomplete="new-password"')+'<button class="btn primary" type="submit">Update password</button></form>';
 else if(pending)body='<p class="muted">We sent a verification link to <strong>'+e(state.pendingEmail)+'</strong>. Open it to activate your Bizlano account.</p><div class="stack"><button class="btn primary" data-action="resend">Resend verification email</button><button class="btn" data-action="refresh">I have verified</button><button class="btn ghost" data-action="logout">Use another account</button></div>';
 else if(logged)body='<p class="muted">'+e(state.connectError||'Connecting your business workspace securely.')+'</p><div class="stack"><button class="btn primary" data-action="retry-connect">Retry connection</button><button class="btn" data-action="logout">Sign out</button></div>';
 else if(state.authMode==='forgot')body='<p class="muted">Enter your email and we will send a secure reset link if you have an account.</p><form data-form="forgot" class="stack">'+input('Email address','email','email','',true,'autocomplete="email"')+'<button class="btn primary" type="submit">Email reset link</button></form><button class="btn" data-action="toggle-auth" style="margin-top:13px">Back to sign in</button>';
 else body='<p class="muted">'+(state.authMode==='register'?'Create your Bizlano workspace with an email you can verify.':'Sign in with your Bizlano email and password.')+'</p><form data-form="auth" class="stack">'+(state.authMode==='register'?input('Full name','name','text','',true,'maxlength="120" autocomplete="name"'):'')+input('Email address','email','email','',true,'autocomplete="email"')+input('Password','password','password','',true,'minlength="'+(state.authMode==='register'?'10':'6')+'" autocomplete="'+(state.authMode==='register'?'new-password':'current-password')+'"')+'<button class="btn primary" type="submit">'+(state.authMode==='register'?'Register for free':'Sign in')+'</button></form><div class="row" style="margin-top:15px"><button class="btn" data-action="toggle-auth">'+(state.authMode==='register'?'Already registered? Sign in':'Register for free')+'</button><button class="btn" data-action="reset">Forgot password?</button></div>';
 app.innerHTML='<section class="auth-root"><div class="auth-art"><a class="brand" href="/">'+brand()+'</a><div><p class="kicker">YOUR BUSINESS. YOUR SPACE.</p><h1>Run your business, beautifully.</h1><p>Create professional receipts and invoices, organize customers, track stock and work with your team from anywhere.</p></div><small>Your business, your team, your next chapter.</small></div><div class="auth-form-shell"><div><div class="eyebrow">WELCOME TO BIZLANO</div><h2>'+title+'</h2>'+body+'<p class="mini muted">Need help with an old MetaForge account? <a href="/help">Visit Help</a>.</p><a class="auth-home" href="/">← Back to Bizlano homepage</a></div></div></section>';
}
function businessPicker(){
 const businesses=state.me?.businesses||[];
 const owned=businesses.length?'<section style="margin:22px 0 27px"><div class="eyebrow">YOUR BUSINESSES</div><div class="stack" style="margin-top:12px">'+businesses.map(b=>'<button type="button" class="business-choice" data-business="'+e(b.slug)+'"><span class="choice-mark">'+e(b.business_name?.slice(0,1)||'B')+'</span><span style="flex:1;text-align:left"><strong>'+e(b.business_name)+'</strong><small>'+e(b.slug)+' · '+e(b.role)+'</small></span><span style="font-size:21px;color:#7a60cc">→</span></button>').join('')+'</div></section><div style="height:1px;background:#e9eaf1;margin-bottom:21px"></div>':'';
 app.innerHTML='<section class="auth-root"><div class="auth-art"><a class="brand" href="/">'+brand()+'</a><div><p class="kicker">YOUR WORKSPACE</p><h1>Your business deserves a better way to work.</h1><p>Professional receipts, simple invoicing, reliable sales records and a workspace your team can share.</p></div><small>Bizlano · Your business, beautifully managed.</small></div>'+
 '<div class="auth-form-shell"><div><div class="eyebrow">WELCOME TO YOUR WORKSPACE</div><h2>'+(businesses.length?'Choose a business':'Set up your business')+'</h2><p class="muted">Each business has its own protected records, documents and staff permissions.</p>'+owned+
 '<div class="eyebrow">'+(businesses.length?'CREATE ANOTHER BUSINESS':'GET STARTED')+'</div>'+
 '<form data-form="business">'+input('Business name','name','text','',true)+input('Short business address','slug','text','',true,'pattern="[a-z0-9-]{4,40}" placeholder="e.g. timi-store"')+
 '<p class="mini muted">Choose a short address customers can easily remember.</p><button type="submit" class="btn primary">Create business workspace →</button></form>'+
 '<p style="margin-top:23px" class="row"><a class="btn" href="/">Visit website</a><button class="btn ghost" data-action="logout">Sign out</button></p></div></div></section>';
}
const TEMPLATE_LIST=["signature","classic","executive","retail","thermal","minimal","editorial","bold","artisan","medical","education","hospitality","luxury","corporate","ledger","modern","boutique","monochrome","festival","restaurant","grocery","service","legal","real-estate","logistics","salon","artisan-paper","gradient","formal","event","digital","wholesale","startup","premium-dark","emerald","sapphire"];
const DESIGN_PALETTE=["#6935df","#212d52","#b18748","#168c78","#383c4b","#bc577b","#f08c42","#2b87ab","#6a9842","#a63f53"];
const NAV=[
 ['overview','⌂','Overview'],['documents','▤','Documents'],['create','＋','New receipt'],
 ['customers','♙','Customers'],['products','▥','Products & stock'],['payments','⇆','Payments'],
 ['expenses','↗','Expenses'],['targets','▥','Sales targets'],['team','♧','Team & invites'],['branding','⚙','Brand identity'],['design','◈','Document studio'],['gws','⇆','Global Webstores'],['alerts','♧','Receipt notifications'],['upgrade','⇧','Upgrade old receipts']
];
function navigation(){
 const filtered=NAV.filter(([v])=>{
  if(v==='expenses'||v==='targets')return finance();
  if(v==='upgrade')return state.biz?.role==='owner';
  if(v==='team'||v==='branding'||v==='design'||v==='gws')return admin();
  if(v==='alerts')return true;
  if(v==='products'||v==='customers'||v==='payments')return edit();
  if(v==='create')return edit();return true;
 });
 return filtered.map(([v,icon,label])=>'<button type="button" data-nav="'+v+'" data-active="'+(v===state.view)+'">'+icon+' &nbsp; '+e(label)+'</button>').join('');
}
function shell(body){
 const t=state.biz;
 app.innerHTML='<div class="shell"><aside class="sidebar" id="sidebar"><a class="brand" href="/">'+brand()+'</a><div class="caption">WORKSPACE</div><nav class="nav" aria-label="Main navigation">'+navigation()+'</nav>'+
 '<div class="sidebar-bottom"><strong>'+e(t.business_name)+'</strong>'+e(t.slug)+' · '+e(t.role)+'<div style="margin-top:17px"><button class="btn" data-action="picker">Switch business</button></div><button class="btn" style="margin-top:8px" data-action="logout">Sign out</button></div></aside>'+
 '<div class="workspace"><header class="topbar"><div class="row"><button class="menu-toggle" aria-label="Open navigation" data-action="menu">☰</button><div><strong>'+e(t.business_name)+'</strong><small>'+e(t.slug)+' · '+e(t.role)+'</small></div></div><button class="btn primary" data-nav="create">+ New document</button></header>'+
 '<main class="workspace-main">'+body+'</main><footer class="footer">© Bizlano · Your business, beautifully managed.</footer>'+
 '<nav class="mobile-nav" aria-label="Quick navigation"><button data-nav="overview" class="'+(state.view==='overview'?'active':'')+'"><span>⌂</span>Home</button>'+
 '<button data-nav="documents" class="'+(state.view==='documents'?'active':'')+'"><span>▤</span>Documents</button>'+
 (edit()?'<button data-nav="create" class="create '+(state.view==='create'?'active':'')+'"><span>＋</span>Create</button>':'')+
 '<button data-nav="'+(edit()?'products':'overview')+'"><span>▥</span>'+(edit()?'Stock':'Home')+'</button>'+
 '<button data-action="menu"><span>☷</span>More</button></nav></div></div>';
}
function salesChart(){
 const raw=state.data?.trends||[],days=state.chartDays,mode=state.chartMode;
 const now=new Date();now.setUTCHours(12,0,0,0);
 const entries=Array.from({length:days},(_,i)=>{
  const d=new Date(now);d.setUTCDate(d.getUTCDate()-days+1+i);
  const key=d.toISOString().slice(0,10);
  return {day:key,value:raw.filter(x=>x.day===key).reduce((n,r)=>n+Number(r.total_minor||0),0)};
 });
 const total=entries.reduce((n,x)=>n+x.value,0),month=today().slice(0,7);
 const target=state.data?.goals?.find(g=>g.id===month)?.target_minor||0;
 const actual=raw.filter(x=>x.day.startsWith(month)).reduce((n,x)=>n+Number(x.total_minor||0),0);
 const progress=target?Math.min(100,Math.round(actual/target*100)):0;
 let out='<div class="row" style="justify-content:space-between;margin:9px 0 17px"><div><div class="eyebrow">ISSUED SALES · '+days+' DAYS</div><strong style="font:800 25px Manrope">'+curr(total)+'</strong></div>'+
 '<div class="row" style="gap:5px">'+['bar','line','pie'].map(m=>'<button class="btn '+(mode===m?'ghost':'')+'" data-chart="'+m+'">'+m.charAt(0).toUpperCase()+m.slice(1)+'</button>').join('')+'</div></div>'+
 '<div class="row" style="margin-bottom:13px"><span class="mini muted">Period:</span>'+[7,30,90].map(n=>'<button class="btn '+(n===days?'ghost':'')+'" data-days="'+n+'">'+n+' days</button>').join('')+'</div>';
 if(total<=0)out+='<div class="empty" style="min-height:180px">No issued sales in this period. Your sales activity will appear here as you create documents.</div>';
 else if(mode==='pie'){
  const tally=new Map(),earliest=entries[0].day;
  for(const row of raw)if(row.day>=earliest)tally.set(row.kind,(tally.get(row.kind)||0)+Number(row.total_minor||0));
  const sorted=[...tally].sort((a,b)=>b[1]-a[1]);const values=sorted.slice(0,4);
  if(sorted.length>4)values.push(['Other',sorted.slice(4).reduce((n,x)=>n+x[1],0)]);
  const colors=['#6331dd','#40a8c7','#a57deb','#e4b569','#8a96c2'];
  let offset=0;const circles=values.map(([kind,value],i)=>{
   const p=value/total,from=offset;offset+=p;
   return '<circle cx="110" cy="110" r="67" fill="none" stroke="'+colors[i]+'" stroke-width="35" stroke-dasharray="'+(p*421)+' 421" stroke-dashoffset="'+(-from*421)+'" transform="rotate(-90 110 110)"><title>'+e(kind)+' '+curr(value)+'</title></circle>';
  }).join('');
  out+='<div class="row" style="align-items:center;gap:25px"><svg viewBox="0 0 220 220" width="230" role="img" aria-label="Sales by document type">'+circles+'<text x="110" y="115" text-anchor="middle" font-size="15" font-weight="800" fill="#2d3656">Sales</text></svg><div class="stack">'+values.map(([kind,value],i)=>'<div class="row"><span style="width:11px;height:11px;border-radius:3px;background:'+colors[i]+'"></span><span>'+e(kind)+'</span><strong>'+curr(value)+'</strong></div>').join('')+'</div></div>';
 }else{
  const w=740,h=218,left=25,top=16,iw=695,ih=166,max=Math.max(1,...entries.map(x=>x.value));
  const data=entries.map((d,i)=>({x:left+(i+.5)*iw/days,y:top+ih*(1-d.value/max),amount:d.value,day:d.day}));
  let shapes='';
  if(mode==='bar')shapes=data.map(p=>'<rect x="'+(p.x-Math.max(3,iw/days*.32))+'" y="'+p.y+'" width="'+Math.max(6,iw/days*.64)+'" height="'+(top+ih-p.y)+'" rx="3" fill="#6937df"><title>'+e(p.day)+' '+curr(p.amount)+'</title></rect>').join('');
  else shapes='<polyline fill="none" stroke="#6937df" stroke-width="3" points="'+data.map(p=>p.x+','+p.y).join(' ')+'"/>'+data.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3" fill="#6937df"><title>'+e(p.day)+' '+curr(p.amount)+'</title></circle>').join('');
  const grid=[0,.25,.5,.75,1].map(v=>'<line x1="'+left+'" y1="'+(top+ih*(1-v))+'" x2="'+(w-10)+'" y2="'+(top+ih*(1-v))+'" stroke="#e8eaf3" stroke-dasharray="3 4"/>').join('');
  const labels=data.filter((p,i)=>i===0||i===data.length-1||i%Math.max(1,Math.floor(days/6))===0).map(p=>'<text x="'+p.x+'" y="210" text-anchor="middle" font-size="10" fill="#8995ab">'+e(p.day.slice(5))+'</text>').join('');
  out+='<svg viewBox="0 0 '+w+' '+h+'" style="display:block;width:100%;height:auto" role="img" aria-label="Issued sales trend">'+grid+shapes+labels+'</svg>';
 }
 out+='<div style="border-top:1px solid #eceef4;margin-top:18px;padding-top:13px"><div class="row" style="justify-content:space-between"><strong>Monthly target: '+(target?curr(target):'Not set')+'</strong><span class="mini muted">'+progress+'% reached</span></div><div style="height:9px;background:#e8e4f3;border-radius:8px;margin-top:9px;overflow:hidden"><div style="width:'+progress+'%;height:100%;background:#6735df"></div></div></div>';
 return out;
}
function recoveryHref(){
 const u=new URL('/receipts',location.origin);
 u.searchParams.set('business',state.biz.slug);
 return u.toString();
}
function businessHref(){
 return new URL('/s/'+encodeURIComponent(state.biz.slug),location.origin).toString();
}
function recoveryMessage(){
 return 'Lost a receipt from '+state.biz.business_name+'? Find it here: '+recoveryHref()+' \nSign in using the email on your receipt, or enter your private receipt code.';
}
function recoveryTools(){
 return '<div class="recovery-share"><label class="field">Customer recovery link<input readonly aria-label="Customer receipt recovery link" value="'+e(recoveryHref())+'" class="recovery-link" data-recovery-url></label><div class="row"><button type="button" class="btn primary" data-action="copy-recovery">Copy customer link</button><button type="button" class="btn" data-action="copy-recovery-message">Copy ready-to-send message</button></div><p class="mini muted">Share this link with your customers.</p><a href="'+e(businessHref())+'" class="mini recovery-business-link" target="_blank" rel="noopener noreferrer">View business page ↗</a></div>';
}
async function copyShareText(value){
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);flash('Copied. Ready to share.');return}catch{}}
 const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.focus();input.select();
 let copied=false;try{copied=Boolean(document.execCommand?.('copy'))}catch{}input.remove();
 if(copied)flash('Copied. Ready to share.');
 else {const link=document.querySelector('[data-recovery-url]');if(link){link.focus();link.select()}flash('Select and copy the link above.',true)}
}
function overview(){
 const r=state.data;if(!r)return '<div class="empty">Loading your business overview…</div>';
 const metrics=[['Total sales',curr(r.invoiced),'Issued documents'],['Payments received',curr(r.received),'Recorded payments'],['Outstanding',curr(r.outstanding),'Unpaid balances'],['Customers',r.customers,'Saved customers']];
 return heading('YOUR BUSINESS AT A GLANCE','See how your business is doing.','Track sales, payments and customers in one place.',edit()?'<button data-nav="create" class="btn primary">+ Create document</button>':'')+
 '<div class="metrics">'+metrics.map(m=>'<div class="metric"><span>'+m[0]+'</span><strong>'+m[1]+'</strong><small>'+m[2]+'</small></div>').join('')+'</div>'+
 '<section class="panel"><h2>Sales analytics</h2>'+salesChart()+'</section>'+
 '<div class="cols"><section class="panel"><h2>Get started with Bizlano</h2><p class="muted">Build your business one step at a time. Add customers, organise your products, and create receipts or invoices ready to print or save.</p><div class="row"><button class="btn primary" data-nav="create">Create your first receipt</button><button class="btn" data-nav="documents">View history</button></div></section>'+
 '<section class="panel"><h2>Share your business page</h2><p class="muted">Customers can find lost receipts, while your team signs in separately.</p>'+recoveryTools()+'</section></div>';
}
function gridRows(rows,headers,fn){return '<div class="table-scroll"><table><thead><tr>'+headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(fn).join('')+'</tbody></table></div>'}
function docs(){
 const rows=state.data?.rows||[];
 return heading('RECEIPTS & INVOICES','Your business documents','Create, view and share every receipt in one place.',edit()?'<button class="btn primary" data-nav="create">+ New document</button>':'')+
 '<section class="panel"><div class="recovery-quick"><strong>Customer lost a receipt?</strong><span>Send them your recovery link.</span><button class="btn" data-action="copy-recovery">Copy link</button><button class="btn" data-action="copy-recovery-message">Copy message</button></div>'+(rows.length?gridRows(rows,['Document','Customer','Total','Status','Actions'],d=>'<tr><td><strong>'+e(d.document_number)+'</strong><br><small>'+e(d.kind)+' · '+e(d.issued_on)+'</small></td><td>'+e(d.recipient_name)+'</td><td>'+curr(d.total_minor)+'</td><td>'+e(d.status)+'</td><td><button class="btn" data-doc="'+e(d.id)+'">Preview / Print</button>'+(!['voided','draft','paid'].includes(d.status)&&edit()?'<button class="btn" data-payment="'+e(d.id)+'">Payment</button>':'')+(d.status==='draft'&&edit()?'<button class="btn" data-issue="'+e(d.id)+'">Issue</button>':'')+'</td></tr>'):'<div class="empty">Your document history is empty. Create the first receipt or invoice to begin.</div>')+'</section>';
}
function customers(){
 const rows=state.data?.rows||[];
 return heading('CUSTOMER DIRECTORY','People you do business with','Keep names and contact details together.')+
 '<div class="cols">'+(edit()?'<section class="panel"><h2>Add customer</h2><form data-form="customer">'+input('Customer name','name','text','',true)+input('Phone number','phone')+input('Email','email','email')+input('Address','address')+'<button class="btn primary">Save customer</button></form></section>':'')+
 '<section class="panel"><h2>Saved customers ('+rows.length+')</h2>'+simpleRows(rows,c=>'<div class="rowcard"><div><strong>'+e(c.name)+'</strong><small>'+e(c.phone||c.email||'No contact')+'</small></div></div>')+'</section></div>';
}
function products(){
 const rows=state.data?.rows||[];
 return heading('INVENTORY','Products and services','Keep product prices, availability and low stock visible.')+
 '<div class="cols">'+(stock()?'<section class="panel"><h2>Add catalog item</h2><form data-form="product">'+input('Product or service','name','text','',true)+input('SKU (optional)','sku')+'<div class="form-grid">'+input('Price (₦)','price','number','0',true,'min="0" step=".01"')+input('Opening stock','stock','number','0',true,'min="0" step=".001"')+input('Low-stock alert','lowStock','number','5',false,'min="0" step=".001"')+'</div><label class="field"><input type="checkbox" name="trackStock" checked style="display:inline-block;width:auto"> Track stock</label><button class="btn primary">Save item</button></form></section>':'')+
 '<section class="panel"><h2>Catalog ('+rows.length+')</h2>'+simpleRows(rows,p=>'<div class="rowcard"><div><strong>'+e(p.name)+'</strong><small>'+e(p.sku||'No SKU')+' · '+curr(p.price_minor)+'</small></div><div class="end"><strong>'+(p.track_stock?(p.stock_milli/1000)+' available':'Service')+'</strong>'+(p.track_stock&&p.stock_milli<=p.low_stock_milli?'<small style="color:#ab2945">Low stock</small>':'')+'</div></div>')+'</section></div>';
}
function payments(){
 const rows=state.data?.rows||[];
 return heading('PAYMENTS','Your recorded payments','Review the payments entered by your team and check them against your payment records.')+
 '<section class="panel">'+simpleRows(rows,p=>'<div class="rowcard"><div><strong>'+e(p.document_number)+'</strong><small>'+e(p.method)+' · '+e(p.received_at)+'</small></div><strong>'+curr(p.amount_minor)+'</strong></div>')+'</section>';
}
function expenses(){
 const rows=state.data?.rows||[];
 return heading('OPERATING EXPENSES','Business expenses','Visible to authorized financial staff only.')+
 '<div class="cols"><section class="panel"><h2>Record an expense</h2><form data-form="expense">'+input('Description','description','text','',true)+input('Amount (₦)','amount','number','',true,'min=".01" step=".01"')+input('Category','category','text','General')+input('Date','date','date',today())+'<button class="btn primary">Save expense</button></form></section>'+
 '<section class="panel"><h2>Expense history</h2>'+simpleRows(rows,x=>'<div class="rowcard"><div><strong>'+e(x.description)+'</strong><small>'+e(x.category)+' · '+e(x.spent_on)+'</small></div><strong>'+curr(x.amount_minor)+'</strong></div>')+'</section></div>';
}
function targets(){
 const rows=state.data?.rows||[];
 return heading('BUSINESS GOALS','Monthly sales targets','Goals are shared across your business team.')+
 '<div class="cols"><section class="panel"><h2>Set sales target</h2><form data-form="target">'+input('Month','month','month',today().slice(0,7),true)+input('Monthly target (₦)','amount','number','',true,'min=".01" step=".01"')+'<button class="btn primary">Save target</button></form></section>'+
 '<section class="panel"><h2>Saved goals</h2>'+simpleRows(rows,x=>'<div class="rowcard"><div><strong>'+e(x.label)+'</strong><small>'+e(x.period_start)+' to '+e(x.period_end)+'</small></div><strong>'+curr(x.target_minor)+'</strong></div>')+'</section></div>';
}
function branding(){
 const biz=state.data?.business||state.biz,design=state.design||{};
 const image=(src,label)=>src?'<div class="artwork-frame"><img src="'+e(src)+'" alt="'+e(label)+'"></div>':'<div class="artwork-empty">No '+e(label.toLowerCase())+' uploaded yet</div>';
 return heading('BUSINESS IDENTITY','Your brand, beautifully presented','Keep your business logo and optional signature consistent across receipts and invoices.')+
 '<div class="cols">'+
 '<section class="panel"><h2>Business logo</h2><p class="muted">For the clearest result, use a high-resolution transparent PNG. Square and horizontal logos are both supported.</p>'+
 image(biz.logo_url,'Business logo')+
 '<form data-form="logo"><label class="field">Choose your logo<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required></label>'+
 '<label class="field artwork-option"><input type="checkbox" name="removeWhite"> Remove a plain white background (optional)</label>'+
 '<p class="mini muted">For the best result, upload a transparent PNG.</p>'+
 '<div class="artwork-preview hidden" data-artwork-preview="logo"></div><button class="btn primary">Save my logo</button></form></section>'+
 '<section class="panel"><h2>Authorized signature <span class="mini muted">(optional)</span></h2><p class="muted">Add a transparent business signature for your document signatory area. It only appears when you enable it in the Document studio.</p>'+
 image(design.signature_url,'Authorized signature')+
 '<form data-form="signature"><label class="field">Choose a signature image<input type="file" name="signature" accept="image/png,image/jpeg,image/webp" required></label>'+
 '<label class="field artwork-option"><input type="checkbox" name="removeWhite"> Remove a plain white background (optional)</label>'+
 '<p class="mini muted">Only use a signature you’re happy to show customers.</p>'+
 '<div class="artwork-preview hidden" data-artwork-preview="signature"></div><button class="btn primary">Save my signature</button></form></section></div>'+
 '<section class="panel"><h2>Your business page</h2><p><strong>'+e(biz.business_name)+'</strong></p><p class="muted"><a href="'+e(businessHref())+'" target="_blank" rel="noopener noreferrer">'+e(businessHref())+'</a></p><div class="row"><button type="button" class="btn primary" data-action="copy-recovery">Copy receipt recovery link</button><button type="button" class="btn" data-action="copy-recovery-message">Copy customer message</button></div>'+
 '<button type="button" class="btn" data-nav="design">Manage document designs and signature visibility</button></section>';
}
function team(){
 const rows=state.data?.rows||[];
 return heading('TEAM & ACCESS','Build your team','Invite staff through a private one-time link. They must have a verified email account.')+
 '<div class="cols"><section class="panel"><h2>Invite staff</h2><form data-form="invite">'+input('Staff email','email','email','',true)+select('Permission','role',[['manager','Manager'],['accountant','Accountant'],['cashier','Cashier'],['sales','Sales'],['viewer','View-only']])+'<button class="btn primary">Generate invite</button></form><div id="invite-result" class="banner hidden"></div></section>'+
 '<section class="panel"><h2>Team members</h2>'+simpleRows(rows,s=>'<div class="rowcard"><div><strong>'+e(s.email)+'</strong><small>'+e(s.role)+' · '+(s.disabled_at?'Suspended':'Active')+'</small></div></div>')+'</section></div>';
}
function upgrade(){
 const a=state.legacyArchive;
 const total=(a?.engines||[]).reduce((v,x)=>v+x.receipts.length,0);
 return heading('YOUR RECEIPT HISTORY','Bring your old receipts into Bizlano','Your previous MetaForge receipts stay where they are. Choose which copies you want to keep here.')+
 '<div class="cols"><section class="panel"><h2>Scan your original account</h2><p class="muted">Find receipts linked to your previous account. Your original documents will not be changed.</p>'+
 '<div class="row"><button class="btn primary" data-action="scan-legacy">Scan old receipts</button>'+
 (a?'<button class="btn" data-action="download-legacy">Download backup</button>':'')+'</div>'+
 (a?'<div class="banner"><strong>'+a.engines.length+' receipt collections · '+total+' accessible receipts</strong><br>'+e((a.issues||[]).length+' warning(s).')+' Your old receipts remain unchanged.'+
 (state.backupReady?'<br>Your backup is ready. You can now review the receipts.':'<br>Save a backup before continuing.')+'</div>'+
 '<button class="btn primary" data-action="import-scanned" '+(state.backupReady?'':'disabled')+'>Copy to Bizlano for review</button>':'')+
 '<p class="mini muted">If some receipts are missing, try uploading your previous backup.</p></section>'+
 '<section class="panel"><h2>Already have a receipt backup?</h2><p class="muted">Already have a receipt backup from MetaForge? Choose that file to bring your previous records into Bizlano securely.</p>'+
 '<form data-form="legacy-file"><label class="field">Backup file (.json)<input type="file" name="archive" accept=".json,application/json" required></label>'+
 '<label class="field"><input type="checkbox" name="includeBrowser" style="display:inline-block;width:auto"> Include receipts saved on this device</label>'+
 '<button type="submit" class="btn primary">Review and import backup</button></form>'+
 '<div class="banner">Older receipts stay separate from your new sales until you review them.</div></section></div>';
}
async function scanLegacy(){
 if(state.biz?.role!=='owner'||!auth.currentUser?.emailVerified)throw Error('Only the verified owner can migrate history');
 const account=auth.currentUser,issues=[],engines=[];
 const found=await getDocs(query(collection(oldDb,'short_urls'),where('owner_uid','==',account.uid),limit(11)));
 if(found.size>10)issues.push('Some older receipts may not appear in this quick search. You can also import a backup.');
 for(const engine of found.docs.slice(0,10)){
  if(!/^[A-Za-z0-9]{6}$/.test(engine.id))continue;
  try{
   const receipts=await getDocs(query(collection(oldDb,'short_urls',engine.id,'receipts'),limit(251)));
   if(receipts.size>250)issues.push('There may be more receipts for '+engine.id+'. Try your original backup for the complete history.');
   engines.push({code:engine.id,brandName:engine.data().brandName||engine.id,receipts:receipts.docs.slice(0,250).map(x=>({id:x.id,...x.data()}))});
  }catch(err){issues.push('We could not load the receipts for '+engine.id+'. You can try your original backup.');}
 }
 state.legacyArchive={kind:'metaforge-legacy',version:1,createdAt:new Date().toISOString(),userUid:account.uid,email:account.email,engines,settings:null,local:{histories:[],metadata:{},errors:[]},issues};
 state.backupReady=false;render();
 flash('Scan complete. Review any warnings and download your backup.');
}
function downloadLegacy(){
 if(!state.legacyArchive)throw Error('Scan legacy data first');
 const data=JSON.stringify(state.legacyArchive,null,2),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='bizlano-legacy-archive-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 state.backupReady=true;render();flash('Backup download started. Confirm the file is saved before importing.');
}
async function importLegacy(archive,includeBrowser){
 if(!archive||archive.kind!=='metaforge-legacy'||archive.version!==1)throw Error('Unsupported MetaForge legacy archive');
 if(archive.userUid!==auth.currentUser?.uid)throw Error('The archive does not belong to your signed-in account');
 if(state.biz.role!=='owner')throw Error('Only the business owner can import receipts');
 const groups=(archive.engines||[]).map(x=>({source:'engine:'+x.code,receipts:x.receipts||[]}));
 if(includeBrowser)for(const history of archive.local?.histories||[])groups.push({source:'browser:'+history.key,receipts:history.receipts||[]});
 const all=groups.reduce((n,x)=>n+x.receipts.length,0);
 if(!all)throw Error('The archive contains no readable receipts');
 if(!confirm('Copy '+all+' historical receipts into '+state.biz.business_name+' as review-only drafts? Original records stay unchanged and no payment is marked as received.'))return;
 const bytes=new TextEncoder().encode(JSON.stringify(archive));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const archiveHash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 let imported=0,skipped=0;
 for(const group of groups){
  for(let offset=0;offset<group.receipts.length;offset+=25){
   const records=group.receipts.slice(offset,offset+25).map((receipt,i)=>({index:offset+i,receipt}));
   const result=await api('/b/'+state.biz.slug+'/migrate',{source:group.source,records,ownerUid:archive.userUid,archiveHash,totalCount:all,includeBrowser});
   imported+=result.imported;skipped+=result.skipped;
   flash('Legacy import: '+imported+' copied, '+skipped+' skipped.');
  }
 }
 state.legacyArchive=null;state.backupReady=false;
 flash('Import complete: '+imported+' review drafts staged. '+skipped+' skipped or previously imported.');
 await navigate('documents');
}
function globalWebstores(){
 const info=state.data||{};
 return heading('CONNECTED BUSINESS','Global Webstores + Bizlano','Connect your store once. Verified purchases can then prepare beautiful receipts in your business workspace.')+
 '<div class="cols"><section class="panel"><div class="eyebrow">YOUR STORE CONNECTION</div><h2>'+(info.connected?'Your store is connected':'Connect Global Webstores')+'</h2>'+
 (info.connected?'<div class="banner"><strong>Connected</strong><br>Since '+e(info.connectedAt||'')+'<br>'+(info.lastSaleAt?'Last sale: '+e(info.lastSaleAt):'New sales will appear here.')+'</div>'+
 '<p class="muted">Paid orders can automatically prepare receipts with your saved document design. You will find them under Receipt notifications.</p><button class="btn" data-action="disconnect-gws">Disconnect this store</button>':
 '<p class="muted">Open your Global Webstores vendor dashboard and choose <strong>Connect Bizlano</strong>. Generate a private connection code here and paste it in that dashboard. You will not need to share any account password.</p>'+
 '<button class="btn primary" data-action="gws-code">Generate a secure connection code</button><div id="gws-link-result" class="banner hidden"></div>')+
 '<div style="margin-top:18px"><a href="https://www.globalwebstores.com/dashboard" class="btn" target="_blank" rel="noopener noreferrer">Open Global Webstores dashboard ↗</a></div></section>'+
 '<section class="panel"><h2>After every paid order</h2><div class="stack">'+
 '<div class="rowcard"><span><strong>1. Payment verified</strong><small>Global Webstores confirms the sale before syncing.</small></span><span class="mini muted">Automatic</span></div>'+
 '<div class="rowcard"><span><strong>2. Receipt prepared</strong><small>Bizlano generates a receipt using your saved template.</small></span><span class="mini muted">Automatic</span></div>'+
 '<div class="rowcard"><span><strong>3. You receive an update</strong><small>Open Receipt notifications, print or share the document.</small></span><span class="mini muted">Free</span></div>'+
 '<div class="rowcard"><span><strong>4. Send it to your customer</strong><small>Share a PDF or send it through your preferred messaging app.</small></span><span class="mini muted">Your choice</span></div></div>'+
 '</section></div>';
}

async function removeWhiteBackground(file){
 // Fast local image editing: remove only near-white areas connected to the edge.
 // No remote service, private image upload or AI charge is involved.
 let image;
 try{
  const url=URL.createObjectURL(file);
  try{image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Cannot open this image'));im.src=url})}
  finally{URL.revokeObjectURL(url)}
 }catch{throw Error('This image could not be opened. Use a PNG, JPG or WebP image.')}
 const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
 if(!width||!height)throw Error('Invalid image size');
 for(const maxSide of [750,520,380]){
  const factor=Math.min(1,maxSide/Math.max(width,height)),w=Math.max(1,Math.round(width*factor)),h=Math.max(1,Math.round(height*factor));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Your device cannot process this image. Upload a transparent PNG instead.');
  ctx.drawImage(image,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h),v=pixels.data,seen=new Uint8Array(w*h),queue=new Uint32Array(w*h);
  let tail=0,head=0;
  const nearWhite=i=>{const p=i*4,r=v[p],g=v[p+1],b=v[p+2],max=Math.max(r,g,b),min=Math.min(r,g,b);return v[p+3]>0&&min>=231&&max-min<24};
  const push=i=>{if(!seen[i]&&nearWhite(i)){seen[i]=1;queue[tail++]=i}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}
  for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
  while(head<tail){
   const idx=queue[head++],p=idx*4;v[p+3]=0;
   const x=idx%w;
   if(x>0)push(idx-1);if(x<w-1)push(idx+1);if(idx>=w)push(idx-w);if(idx<w*(h-1))push(idx+w);
  }
  if(tail===0)throw Error('The image does not have a removable plain-white outer background. Upload a transparent PNG or turn off cleanup.');
  ctx.putImageData(pixels,0,0);
  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(png&&png.size>50&&png.size<=400000)return png;
 }
 throw Error('The cleaned image is too large. Please use a smaller or transparent PNG.');
}
async function uploadBusinessArtwork(form,kind,slugValue){
 const file=form.elements.namedItem(kind)?.files?.[0];
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image');
 if(file.size>5000000)throw Error('Choose an image under 5 MB for cleanup or 400 KB without cleanup');
 const remove=form.elements.namedItem('removeWhite')?.checked===true;
 const uploaded=remove?await removeWhiteBackground(file):file;
 if(uploaded.size>400000)throw Error('Image is over 400 KB. Turn on white-background cleanup or choose a smaller image.');
 const response=await fetch('/api/b/'+slugValue+'/'+kind,{method:'POST',headers:{'content-type':remove?'image/png':file.type},body:uploaded});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Image upload failed');
 return payload;
}
function designStudio(){
 const design=state.design||{template:'signature',accent:'#6935df',paper:'a4',header_note:'',footer_note:'Thank you for your business.',contact:'',show_logo:1};
 const current=state.templateChoice||design.template;
 const catalog=TEMPLATE_LIST.map((id,i)=>{const title=id.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),selected=current===id;return '<button type="button" class="design-card '+(selected?'selected':'')+'" data-template="'+e(id)+'" aria-pressed="'+selected+'"><span class="design-tiny style-'+e(id)+'" style="--receipt-accent:'+e(design.accent)+'"><span class="design-tiny-top"></span><span class="design-tiny-line"></span><span class="design-tiny-line short"></span><span class="design-tiny-table"></span><span class="design-tiny-total"></span></span><strong>'+e(title)+'</strong><small>'+(selected?'Selected · Ready to use':'Choose design')+'</small></button>'}).join('');
 return heading('DOCUMENT DESIGN STUDIO','A look that belongs to your business','Choose from 36 receipt and invoice layouts. Your saved design automatically appears on every new document.')+
 '<div class="panel"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:18px"><div><h2>Choose your permanent template</h2><p class="muted" style="font-size:12px;margin:0">Every layout includes your brand identity and clear payment details.</p></div><span class="eyebrow">36 DESIGNS</span></div><div class="design-grid">'+catalog+'</div></div>'+
 '<section class="panel"><h2>Customize your document style</h2><form data-form="design">'+
 '<div class="form-grid"><label class="field">Business accent color<input name="accent" type="color" value="'+e(design.accent)+'"></label>'+
 select('Paper size','paper',[['a4','A4 · Standard print'],['letter','US Letter'],['80mm','80mm · POS roll'],['58mm','58mm · Compact roll']],design.paper)+
 input('Business contact line','contact','text',design.contact)+
 input('Optional header message','headerNote','text',design.header_note)+
 input('Receipt footer message','footerNote','text',design.footer_note)+
 '</div><div class="row" style="margin:10px 0 17px"><span class="mini muted">Quick colors</span>'+DESIGN_PALETTE.map(c=>'<button type="button" class="color-swatch" data-accent="'+c+'" aria-label="Choose color '+c+'" style="background:'+c+'"></button>').join('')+'</div>'+
 '<label class="field"><input type="checkbox" name="showLogo" '+(design.show_logo?'checked':'')+' style="display:inline;width:auto;margin-right:7px">Display my business logo on receipts</label>'+
 '<label class="field"><input type="checkbox" name="showSignature" '+(design.show_signature?'checked':'')+' style="display:inline;width:auto;margin-right:7px">Show my uploaded signature at the signatory area (optional)</label><p class="mini muted">A signature is visible to everyone receiving the document. Use only a business signature intended for public use. You can manage it in Business identity.</p>'+
 '<div class="row"><button type="submit" class="btn primary">Save as business default</button><button type="button" data-action="preview-design" class="btn">See sample document</button></div></form></section>'+
 '<p class="mini muted">Your design is saved for your business. Previously issued documents keep the template selected when they were created.</p>';
}
function alerts(){
 const rows=state.data?.rows||[];
 return heading('BUSINESS UPDATES','Your receipts are ready','See receipts prepared from business activity and share them with customers.')+
 '<section class="panel">'+(rows.length?rows.map(n=>'<div class="rowcard"><div><strong>'+e(n.title)+'</strong><small>'+e(n.body||'')+' · '+e(n.created_at)+'</small></div><div class="row">'+(!n.read_at?'<button class="btn" data-read-alert="'+e(n.id)+'">Mark read</button>':'<span class="mini muted">Read</span>')+
 (n.document_id?'<button class="btn primary" data-doc="'+e(n.document_id)+'">Open receipt</button>':'')+'</div></div>').join(''):'<div class="empty">No new receipt updates. When a connected sale is completed, its prepared receipt will appear here.</div>')+'</section>';
}
function docEditor(){
 const tpl=TEMPLATE_LIST;
 const options=state.biz.role==='cashier'?[['receipt','Sales receipt'],['cash-sale','Cash sale'],['service-receipt','Service receipt'],['thermal-receipt','Thermal POS']]:
 [['receipt','Sales receipt'],['invoice','Sales invoice'],['quotation','Quotation'],['estimate','Estimate'],['proforma','Proforma'],['retail-receipt','Retail receipt'],['service-receipt','Service receipt'],['tax-invoice','Tax invoice'],['thermal-receipt','Thermal POS']];
 return heading('DOCUMENT STUDIO','Create a business document','Live preview, flexible details and professionally branded output.')+
 '<div class="editor"><section class="panel editor-form"><form data-form="document">'+
 '<h2>01 · Document and style</h2><div class="form-grid">'+select('Document type','kind',options)+input('Issue date','date','date',today(),true)+input('Due date','dueDate','date')+select('Template','template',tpl.map(x=>[x.split('-').join('-'),x.split('-').map(y=>y.charAt(0).toUpperCase()+y.slice(1)).join(' ')]),state.design?.template||'signature')+'</div>'+
 '<h2>02 · Customer information</h2>'+input('Customer or recipient','customer','text','Walk-in customer',true)+'<div class="form-grid">'+input('Customer email','customerEmail','email','',false,'autocomplete="off" placeholder="customer@example.com"')+input('Customer phone','customerPhone','tel','',false,'inputmode="tel" placeholder="080… or +234…"')+'</div><p class="mini muted" id="contact-help">Provide at least one: email or phone. A verified email links purchases automatically; for phone-only purchases, give the customer the private recovery code printed on their receipt.</p>'+
 '<h2>03 · Products and services</h2><datalist id="products-data">'+state.products.map(p=>'<option value="'+e(p.name)+'"></option>').join('')+'</datalist><div id="lines">'+state.items.map((i,n)=>lineHtml(i,n)).join('')+'</div><button class="btn ghost" type="button" data-action="add-line">+ Add item</button>'+
 '<h2 style="margin-top:25px">04 · Charges and payments</h2><div class="form-grid">'+input('Discount (%)','discountPct','number','0',false,'min="0" max="100" step=".01"')+input('VAT / Tax (%)','taxPct','number','0',false,'min="0" max="100" step=".01"')+input('Other charges (₦)','shipping','number','0',false,'min="0" step=".01"')+input('Received (₦)','received','number','0',false,'min="0" step=".01"')+'</div>'+select('Payment method','method',[['Bank transfer','Bank transfer'],['Cash','Cash'],['POS terminal','POS terminal'],['Other','Other']])+
 '<label class="field">Notes or special instructions<textarea name="notes" rows="4" maxlength="1800" placeholder="Details, payment terms, instructions or a thank-you message">Thank you for your business.</textarea></label><div class="row"><button class="btn ghost" type="button" data-edit-notes>Expand notes editor</button></div>'+
 '<div class="row"><button type="submit" class="btn primary" data-document-action="issue">Save and issue</button><button type="submit" class="btn" data-document-action="draft">Save draft</button></div><p class="mini muted">Issue only after confirming payment. Unpaid sales should be invoices, not receipts.</p></form></section>'+
 '<aside class="receipt-stage"><h2>LIVE PREVIEW</h2><div id="preview"></div><button class="btn" type="button" data-action="print-preview" style="margin-top:13px">Print / Save PDF</button></aside></div>'+editorDialog();
}
function lineHtml(item,n){
 const found=state.products.find(p=>p.id===item.productId);
 return '<div class="line-item" data-line="'+n+'">'+
 '<label class="field li-lookup">Find an item in your catalog (optional)<input class="li-catalog" list="products-data" placeholder="Search catalog" value="'+e(found?.name||'')+'" autocomplete="off"></label>'+
 '<label class="field li-main-desc">Description<textarea class="li-description" rows="2" maxlength="240" placeholder="What did the customer purchase?" required>'+e(item.description||'')+'</textarea><button class="expand-editor" type="button" data-expand-line="'+n+'" aria-label="Open full description editor for item '+(n+1)+'">Expand editor ↗</button></label>'+
 '<label class="field li-qty-box">Quantity<input class="li-qty" type="number" value="'+e(item.qty||1)+'" min=".001" step=".001" inputmode="decimal"></label>'+
 '<label class="field li-price-box">Price (₦)<input class="li-price" type="number" value="'+e(item.price||0)+'" min="0" step=".01" inputmode="decimal"></label>'+
 '<button type="button" class="remove-line" data-remove-line="'+n+'" aria-label="Remove item '+(n+1)+'">×</button></div>';
}
function editorDialog(){
 return '<dialog id="editor-dialog" class="editor-dialog" aria-labelledby="editor-dialog-title"><div class="editor-dialog-header"><div class="eyebrow">FULL-SIZE EDITOR</div><h2 id="editor-dialog-title">Edit details</h2><p class="mini muted">Take your time. Your text returns to the document when you select Done.</p></div><textarea id="editor-dialog-text" maxlength="1800" rows="9" aria-label="Expanded text editor" placeholder="Write here…"></textarea><div class="row editor-dialog-actions"><button class="btn" type="button" data-action="cancel-expanded">Cancel</button><button class="btn primary" type="button" data-action="save-expanded">Done</button></div></dialog>';
}
function currentDoc(){
 const f=document.querySelector('[data-form=document]');if(!f)return null;
 const items=[...document.querySelectorAll('.line-item')].map((r,i)=>({description:r.querySelector('.li-description').value,qty:Number(r.querySelector('.li-qty').value),price:Number(r.querySelector('.li-price').value),productId:state.items[i]?.productId||null}));
 return {kind:val(f,'kind'),date:val(f,'date'),dueDate:val(f,'dueDate'),template:val(f,'template'),customer:val(f,'customer'),customerEmail:val(f,'customerEmail'),customerPhone:val(f,'customerPhone'),items,discountPct:Number(val(f,'discountPct')||0),taxPct:Number(val(f,'taxPct')||0),shipping:Number(val(f,'shipping')||0),received:Number(val(f,'received')||0),method:val(f,'method'),notes:val(f,'notes')};
}
function receipt(doc,number,stored=false){
 const lines=doc.items||[];
 let subtotal=0;const rows=lines.filter(i=>i.description).map(i=>{const total=Number(i.price)*Number(i.qty);subtotal+=total;return '<tr><td>'+e(i.description)+'</td><td>'+e(i.qty)+'</td><td>'+oldMoney(total)+'</td></tr>'}).join('');
 const discount=Math.round(subtotal*(Number(doc.discountPct)||0))/100,vat=Math.round((subtotal-discount)*(Number(doc.taxPct)||0))/100;
 const total=stored?doc.total_minor/100:subtotal-discount+vat+Number(doc.shipping||0);
 const template=String(doc.template||state.design?.template||'signature');const logo=state.design?.show_logo===0?'':(state.biz.logo_url||state.data?.business?.logo_url||'');
 const accent=/^#[0-9a-fA-F]{6}$/.test(state.design?.accent||'')?state.design.accent:'#6935df';
 const paper=state.design?.paper||'a4',contact=state.design?.contact||'',headerNote=state.design?.header_note||'',footerNote=state.design?.footer_note||'';
 return '<article class="receipt style-'+e(template)+' paper-'+e(paper)+'" id="printable" style="--receipt-accent:'+e(accent)+'"><div class="r-head"><div>'+(logo?'<img class="receipt-logo" src="'+e(logo)+'" alt="Business logo">':'')+'<h2>'+e(state.biz.business_name)+'</h2><div class="r-small">'+e(headerNote||'Official business document')+'</div>'+(contact?'<div class="r-small">'+e(contact)+'</div>':'')+'</div><div style="text-align:right"><h3>'+e(doc.kind||'Invoice').toUpperCase()+'</h3><div class="r-small">'+e(number||'UNSAVED DRAFT')+'</div></div></div>'+
 '<div class="r-section"><div><strong>Issued to</strong><div class="r-small">'+e(doc.customer||doc.recipient_name||'Walk-in')+'</div>'+(doc.customerEmail||doc.recipient_email?'<div class="r-small">'+e(doc.customerEmail||doc.recipient_email)+'</div>':'')+(doc.customerPhone||doc.recipient_phone?'<div class="r-small">'+e(doc.customerPhone||doc.recipient_phone)+'</div>':'')+'</div><div><strong>Issued on</strong><div class="r-small">'+e(doc.date||doc.issued_on||today())+'</div></div></div>'+
 '<table><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'+
 '<div class="r-total"><div><span>Subtotal</span><strong>'+oldMoney(subtotal)+'</strong></div><div><span>Discount</span><strong>'+oldMoney(discount)+'</strong></div><div><span>Tax</span><strong>'+oldMoney(vat)+'</strong></div><div class="grand"><span>Total</span><span>'+oldMoney(total)+'</span></div><div><span>Received</span><strong>'+oldMoney(doc.received??(stored?doc.paid_minor/100:0))+'</strong></div></div>'+
 '<p class="r-small" style="margin-top:23px">'+e(doc.notes||footerNote||'Thank you for your business.')+'</p>'+(state.design?.show_signature&&state.design?.signature_url?'<div class="r-signature"><img src="'+e(state.design.signature_url)+'" alt="Authorized signature"><small>Authorized signatory</small></div>':'')+(doc.recoveryCode?'<div class="r-recovery"><strong>Receipt recovery code</strong><div class="r-recovery-code">'+e(doc.recoveryCode)+'</div><small>Keep this private. Recover a lost receipt at '+e(new URL('/receipts',location.origin).toString())+'</small></div>':'')+'<div class="powered">Powered by <strong style="color:#6635db">Bizlano</strong> · Your business, beautifully managed.</div></article>';
}
function drawPreview(){
 const div=document.getElementById('preview');if(!div)return;
 const d=currentDoc();if(d){state.items=d.items;div.innerHTML=receipt(d,'PREVIEW');}
}
function printPage(doc){
 state.view='print';const body=heading('DOCUMENT PREVIEW','Print or download','Use your browser Print / Save as PDF option.','<button class="btn" data-nav="documents">Back to history</button>')+
 '<div class="receipt-stage" style="max-width:850px;margin:auto"><div id="preview">'+receipt(doc,doc.document_number,true)+'</div><button data-action="print-preview" class="btn primary" style="margin-top:16px">Print / Save PDF</button></div>';
 shell(body);
}
function render(){
 if(!state.user||!state.user.emailVerified||!state.me){loginScreen();return}
 if(!state.biz){businessPicker();return}
 const views={overview,documents:docs,customers,products,payments,expenses,targets,team,branding,design:designStudio,alerts,gws:globalWebstores,upgrade,create:docEditor};
 const fn=views[state.view]||overview;
 shell(fn());
 if(state.view==='create')drawPreview();
}
async function navigate(view){
 closeMenu();state.view=view;state.items=[{description:'',qty:1,price:0,productId:''}];
 try{await load()}catch(err){flash(err.message,true);render()}
 window.scrollTo(0,0);
}
function closeMenu(){document.querySelector('.mobile-scrim')?.remove();document.getElementById('sidebar')?.classList.remove('open')}
function toggleMenu(){
 const bar=document.getElementById('sidebar');
 if(bar){const open=bar.classList.toggle('open');document.querySelector('.mobile-scrim')?.remove();if(open){const scrim=document.createElement('button');scrim.className='mobile-scrim';scrim.setAttribute('aria-label','Close navigation');scrim.onclick=toggleMenu;document.body.append(scrim)}}
}
document.addEventListener('click',async ev=>{
 const el=ev.target.closest('button');if(!el)return;
 const view=el.dataset.nav,action=el.dataset.action;
 try{
 if(view){await navigate(view);return}
 if(el.dataset.business){const selected=state.me?.businesses.find(b=>b.slug===el.dataset.business);if(!selected)throw Error('Business is no longer available');state.biz=selected;await navigate('overview');return}
 if(action==='toggle-auth'){state.authMode=state.authMode==='register'?'login':'register';state.resetToken=null;render();return}
 if(action==='copy-recovery'){await copyShareText(recoveryHref());return}
 if(action==='copy-recovery-message'){await copyShareText(recoveryMessage());return}
 if(action==='menu'){toggleMenu();return}
 if(action==='picker'){state.biz=null;render();return}
 if(action==='logout'){await api('/logout',{});if(auth.currentUser)await signOut(auth);state.user=null;state.pendingEmail=null;state.me=null;state.biz=null;render();return}
 if(action==='resend'){await api('/account/resend',{email:state.pendingEmail});flash('If your account needs verification, a new email will arrive.');return}
 if(action==='retry-connect'){state.connectError='';await attach();return}
 if(action==='refresh'){const result=await api('/account/session');state.user=result.user;if(!state.user)throw Error('Open the verification link sent to your email.');state.pendingEmail=null;await attach();return}
 if(action==='reset'){state.authMode='forgot';render();return}
 if(el.dataset.template){state.templateChoice=el.dataset.template;render();return}
 if(el.dataset.accent){const field=document.querySelector('[data-form=design] [name=accent]');if(field)field.value=el.dataset.accent;return}
 if(el.dataset.expandLine!==undefined||el.hasAttribute('data-edit-notes')){
  const dialog=document.getElementById('editor-dialog');
  if(!dialog)return;
  const line=el.hasAttribute('data-edit-notes')?null:Number(el.dataset.expandLine);
  const target=line===null?document.querySelector('[data-form=document] [name=notes]'):document.querySelector('[data-line="'+line+'"] .li-description');
  if(!target)return;
  dialog.dataset.editTarget=line===null?'notes':String(line);
  dialog.querySelector('#editor-dialog-title').textContent=line===null?'Notes & instructions':'Item '+(line+1)+' description';
  const editor=dialog.querySelector('#editor-dialog-text');
  editor.maxLength=line===null?1800:240;editor.value=target.value;
  dialog.showModal();editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);return;
 }
 if(action==='cancel-expanded'){document.getElementById('editor-dialog')?.close();return}
 if(action==='save-expanded'){
  const dialog=document.getElementById('editor-dialog'),value=dialog.querySelector('#editor-dialog-text').value;
  const key=dialog.dataset.editTarget;
  const field=key==='notes'?document.querySelector('[data-form=document] [name=notes]'):document.querySelector('[data-line="'+key+'"] .li-description');
  if(field){field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.focus()}
  dialog.close();return;
 }
 if(action==='preview-design'){const sample={kind:'receipt',template:state.templateChoice||state.design?.template||'signature',customer:'Sample customer',date:today(),items:[{description:'Sample product',qty:2,price:7500}],discountPct:0,taxPct:0,shipping:0,received:15000,notes:state.design?.footer_note};printPage(sample);return}
 if(el.dataset.readAlert){await api('/b/'+state.biz.slug+'/notifications',{id:el.dataset.readAlert});flash('Marked as read');await navigate('alerts');return}
 if(action==='gws-code'){
    const result=await api('/b/'+state.biz.slug+'/marketplace',{action:'link'});
    const code=result.code;
    const box=document.getElementById('gws-link-result');
    box.classList.remove('hidden');box.innerHTML='<p class="mini">Valid for '+result.expiresInMinutes+' minutes. Never share publicly.</p><code style="display:block;overflow-wrap:anywhere;font-weight:800;user-select:all">'+e(code)+'</code><button class="btn" type="button" data-copy="'+e(code)+'">Copy connection code</button>';
    return;
 }
 if(el.dataset.copy){await navigator.clipboard.writeText(el.dataset.copy);flash('Connection code copied.');return}
 if(action==='disconnect-gws'){if(!confirm('Disconnect Global Webstores? New sales will stop preparing receipts in Bizlano.'))return;await api('/b/'+state.biz.slug+'/marketplace',{action:'disconnect'});flash('Store disconnected.');await navigate('gws');return}
 if(action==='scan-legacy'){await scanLegacy();return}
 if(action==='download-legacy'){downloadLegacy();return}
 if(action==='import-scanned'){if(!state.backupReady)throw Error('Download a backup before importing');await importLegacy(state.legacyArchive,false);return}
 if(el.dataset.chart){state.chartMode=el.dataset.chart;render();return}
 if(el.dataset.days){state.chartDays=Number(el.dataset.days);render();return}
 if(action==='add-line'){state.items=currentDoc()?.items||state.items;state.items.push({description:'',qty:1,price:0});document.getElementById('lines').innerHTML=state.items.map(lineHtml).join('');drawPreview();return}
 if(el.dataset.removeLine!==undefined){state.items=currentDoc()?.items||state.items;if(state.items.length>1)state.items.splice(Number(el.dataset.removeLine),1);document.getElementById('lines').innerHTML=state.items.map(lineHtml).join('');drawPreview();return}
 if(action==='print-preview'){window.print();return}
 if(el.dataset.doc){const [d,settings]=await Promise.all([api('/b/'+state.biz.slug+'/doc/'+el.dataset.doc),api('/b/'+state.biz.slug+'/design')]);state.design=settings.design;printPage(d.document);return}
 if(el.dataset.payment){const value=prompt('Amount actually received in ₦');if(value===null)return;await api('/b/'+state.biz.slug+'/payments',{documentId:el.dataset.payment,amount:Number(value),method:'Manual'});flash('Payment recorded.');await navigate('documents');return}
 if(el.dataset.issue){if(!confirm('Issue this draft? Issued documents cannot be edited.'))return;await api('/b/'+state.biz.slug+'/issue',{documentId:el.dataset.issue});flash('Draft issued.');await navigate('documents');return}
 }catch(err){flash(err.message,true)}
});
document.addEventListener('input',ev=>{if(ev.target.closest('[data-form=document]'))drawPreview()});
document.addEventListener('change',ev=>{
 const artwork=ev.target.closest('[data-form=logo], [data-form=signature]');
 if(artwork&&(ev.target.type==='file'||ev.target.name==='removeWhite')){
  const file=artwork.querySelector('input[type=file]')?.files?.[0],preview=artwork.querySelector('[data-artwork-preview]');
  if(preview){preview.textContent='';preview.classList.toggle('hidden',!file);
    if(file){const image=document.createElement('img');const url=URL.createObjectURL(file);image.src=url;image.alt='Selected image preview';image.onload=()=>URL.revokeObjectURL(url);image.onerror=()=>URL.revokeObjectURL(url);preview.append(image);
     const hint=document.createElement('small');hint.textContent=artwork.querySelector('[name=removeWhite]')?.checked?'Plain-white background will be removed when you save.':'Original image preview — your file will be used unchanged.';preview.append(hint);}
  }return;
 }
 if(!ev.target.matches('.li-catalog'))return;
 const row=ev.target.closest('.line-item'),index=Number(row?.dataset.line);
 const matched=state.products.find(p=>p.name.toLowerCase()===ev.target.value.trim().toLowerCase());
 if(state.items[index])state.items[index].productId=matched?.id||null;
 if(matched){row.querySelector('.li-description').value=matched.name;row.querySelector('.li-price').value=String(matched.price_minor/100)}
 drawPreview();
});
let documentMode='issue';
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-document-action]');if(b)documentMode=b.dataset.documentAction;});
document.addEventListener('submit',async ev=>{
 const form=ev.target.closest('form[data-form]');if(!form)return;
 ev.preventDefault();if(state.busy)return;state.busy=true;
 try{
 const kind=form.dataset.form;
 if(kind==='auth'){
  const address=val(form,'email'),password=val(form,'password');
  if(state.authMode==='register'){
   await api('/account/register',{email:address,password,name:val(form,'name')});
   state.pendingEmail=address;flash('Your verification link has been sent.');loginScreen();
  }else{
   const result=await api('/account/login',{email:address,password});
   state.user=result.user;state.pendingEmail=null;await attach();
  }
 }else if(kind==='forgot'){
  await api('/account/reset-request',{email:val(form,'email')});
  state.authMode='login';render();flash('If this account exists, a reset link will arrive.');
 }else if(kind==='reset'){
  const result=await api('/account/reset',{token:state.resetToken,password:val(form,'password')});
  state.resetToken=null;state.user=result.user;history.replaceState(null,'','/app');await attach();
 }else if(kind==='business'){
  const name=val(form,'name');const slugValue=slug(val(form,'slug'));
  await api('/businesses',{name,slug:slugValue});state.me=await api('/me');state.biz=state.me.businesses.find(b=>b.slug===slugValue)||state.me.businesses[0];flash('Business workspace created.');await navigate('overview');
 }else{
  const t='/b/'+state.biz.slug;
  if(kind==='customer')await api(t+'/customers',{name:val(form,'name'),phone:val(form,'phone'),email:val(form,'email'),address:val(form,'address')});
  if(kind==='product')await api(t+'/products',{name:val(form,'name'),sku:val(form,'sku'),price:Number(val(form,'price')),stock:Number(val(form,'stock')),lowStock:Number(val(form,'lowStock')),trackStock:form.elements.namedItem('trackStock').checked});
  if(kind==='expense')await api(t+'/expenses',{description:val(form,'description'),category:val(form,'category'),amount:Number(val(form,'amount')),date:val(form,'date')});
  if(kind==='target')await api(t+'/targets',{month:val(form,'month'),amount:Number(val(form,'amount'))});
  if(kind==='legacy-file'){
    const file=form.elements.namedItem('archive')?.files?.[0];
    if(!file||file.size>4*1024*1024)throw Error('Choose a JSON backup under 4MB');
    const backup=JSON.parse(await file.text());
    await importLegacy(backup,form.elements.namedItem('includeBrowser').checked);
    state.busy=false;return;
  }
  if(kind==='design'){
    const template=state.templateChoice||state.design?.template||'signature';
    await api(t+'/design',{template,accent:val(form,'accent'),paper:val(form,'paper'),contact:val(form,'contact'),headerNote:val(form,'headerNote'),footerNote:val(form,'footerNote'),showLogo:form.elements.namedItem('showLogo').checked,showSignature:form.elements.namedItem('showSignature').checked});
    state.templateChoice=null;flash('Your document design is saved for this business.');await navigate('design');state.busy=false;return;
  }
  if(kind==='logo'||kind==='signature'){
    await uploadBusinessArtwork(form,kind,state.biz.slug);
    flash(kind==='logo'?'Your business logo is ready.':'Your signature was uploaded. Enable it in the Document studio if you want it visible on receipts.');
    await navigate('branding');state.busy=false;return;
  }
  if(kind==='invite'){const r=await api(t+'/invite',{email:val(form,'email'),role:val(form,'role')});const box=document.getElementById('invite-result');box.textContent='Invite link (share privately): '+r.url;box.classList.remove('hidden');flash('Invitation generated. Copy the private link.');state.busy=false;return}
  if(kind==='document'){
   const b=currentDoc();b.draft=documentMode==='draft';
   if(!b.draft&&!b.customerEmail&&!b.customerPhone){document.querySelector('[data-form=document] [name=customerEmail]')?.focus();throw Error('Add a customer email or phone number before issuing this document')}
   const result=await api(t+'/documents',b);
   flash('Saved '+result.number);await navigate('documents');
  }else{flash('Saved successfully');await navigate(state.view)}
 }
 }catch(err){flash(err.message,true)}
 finally{state.busy=false}
});
async function nativeBoot(){
 const params=new URL(location.href).searchParams;
 try{
  const verify=params.get('verify');
  if(verify){const result=await api('/account/verify',{token:verify});state.user=result.user;state.pendingEmail=null;history.replaceState(null,'','/app');}
  else if(params.get('reset')){state.resetToken=params.get('reset');loginScreen();return;}
  else {const result=await api('/account/session');state.user=result.user;}
  if(state.user){state.connectError='';await attach();}
  else loginScreen();
 }catch(err){state.me=null;state.connectError=err.message||'Sign-in was not completed';flash(state.connectError,true);loginScreen();}
}
nativeBoot();
