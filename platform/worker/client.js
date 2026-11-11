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
const state={user:null,me:null,biz:null,view:'overview',data:null,products:[],customers:[],items:[{description:'',qty:1,price:0,productId:''}],busy:false,authMode:'login',preview:null,legacyArchive:null,backupReady:false,chartMode:'bar',chartDays:30};
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
 const token=await state.user.getIdToken();
 await api('/auth',{token});
 state.me=await api('/me');
 const desired=new URL(location.href).searchParams.get('biz');
 const linked=state.me.businesses.find(b=>b.slug===desired)||state.me.businesses.find(b=>b.slug===state.biz?.slug)||state.me.businesses[0];
 state.biz=linked||null;
 const invite=new URL(location.href).searchParams.get('token');
 if(invite&&/^[a-f0-9]{64}$/.test(invite)){
  await api('/join',{token:invite});
  history.replaceState(null,'','/');
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
 let resource=section==='overview'||section==='branding'?'overview':section==='create'?'products':section==='team'?'team':section;
 if(section==='upgrade'){state.data={};render();return}
 if(section==='overview'){
  const [main,trends,goals]=await Promise.all([api(t+'/overview'),api(t+'/trends'),api(t+'/targets')]);
  state.data={...main,trends:trends.rows,goals:goals.rows};render();return;
 }
 if(section==='create') {
  const [p,c]=await Promise.all([api(t+'/products'),api(t+'/customers')]);
  state.products=p.rows;state.customers=c.rows;state.data={};
 }else state.data=await api(t+'/'+resource);
 render();
}
function brand(){return '<img class="brand-icon" src="/favicon.svg" width="43" height="43" alt=""><span>Bizlano</span>'}
function input(label,name,type='text',value='',required=false,extra=''){
 return '<label class="field">'+e(label)+'<input name="'+e(name)+'" type="'+type+'" value="'+e(value)+'" '+(required?'required':'')+' '+extra+'></label>';
}
function select(label,name,choices){
 return '<label class="field">'+e(label)+'<select name="'+e(name)+'">'+choices.map(x=>'<option value="'+e(x[0])+'">'+e(x[1])+'</option>').join('')+'</select></label>';
}
function heading(k,title,desc,actions=''){return '<div class="page-head"><div><div class="eyebrow">'+e(k)+'</div><h1>'+e(title)+'</h1><p>'+e(desc)+'</p></div>'+actions+'</div>'}
function simpleRows(rows,fn){return rows?.length?rows.map(fn).join(''):'<div class="empty">Nothing here yet. Your records will appear as you add them.</div>'}
function loginScreen(){
 const verify=Boolean(state.user&&!state.user.emailVerified);
 const logged=Boolean(state.user&&state.user.emailVerified);
 app.innerHTML='<section class="auth-root"><div class="auth-art"><a class="brand" href="/">'+brand()+'</a><div><p class="kicker">YOUR BUSINESS. YOUR SPACE.</p><h1>Run your business, beautifully.</h1><p>Create professional receipts and invoices, organize customers, track stock and collaborate with your team from anywhere.</p></div><small>One platform. Every business. No subscription gate.</small></div>'+
 '<div class="auth-form-shell"><div><div class="eyebrow">WELCOME TO BIZLANO</div><h2>'+(verify?'Verify your email':logged?'Connecting securely…':state.authMode==='register'?'Create your account':'Welcome back')+'</h2>'+
 (verify?'<p class="muted">Your existing MetaForge login is preserved. Verify the email for this account to access a secure cloud workspace.</p><div class="stack"><button class="btn primary" data-action="resend">Send verification email</button><button class="btn" data-action="refresh">I have verified</button><button class="btn ghost" data-action="logout">Use another account</button></div>':
 '<p class="muted">'+(state.authMode==='register'?'Start with your regular email address. No company email needed.':'Sign in with your existing MetaForge email or create a Bizlano account.')+'</p>'+
 '<form data-form="auth" class="stack">'+input('Email address','email','email','',true,'autocomplete="email"')+input('Password','password','password','',true,'minlength="8" autocomplete="'+(state.authMode==='register'?'new-password':'current-password')+'"')+
 '<button class="btn primary" type="submit">'+(state.authMode==='register'?'Create account':'Sign in')+'</button></form><div class="row" style="margin-top:15px"><button class="btn" data-action="toggle-auth">'+(state.authMode==='register'?'Already have an account? Sign in':'Create an account')+'</button><button class="btn" data-action="reset">Reset password</button></div>')+
 '<div class="banner">Existing MetaForge receipts and links will not be deleted or moved automatically. Your new Bizlano data is stored separately in Cloudflare D1.</div><p class="mini muted">Powered by Bizlano · Secure account access via Firebase</p></div></div></section>';
}
function businessPicker(){
 app.innerHTML='<section class="auth-root"><div class="auth-art"><a class="brand" href="/">'+brand()+'</a><div><p class="kicker">YOUR WORKSPACE</p><h1>Give your business a home online.</h1><p>Start issuing receipts and invoices, invite staff and grow from one secure dashboard.</p></div><small>Business links use the short address you choose.</small></div>'+
 '<div class="auth-form-shell"><div><div class="eyebrow">BUSINESS ONBOARDING</div><h2>Set up your business</h2><p class="muted">Choose a business name and a short unique address. Your business records stay isolated from other businesses.</p>'+
 '<form data-form="business">'+input('Business name','name','text','',true)+input('Short business address','slug','text','',true,'pattern="[a-z0-9-]{4,40}" placeholder="e.g. timi-store"')+'<p class="mini muted">No custom domain is required to begin. This address is reserved in Bizlano.</p><button type="submit" class="btn primary">Create business space</button></form><p style="margin-top:23px"><button class="btn ghost" data-action="logout">Sign out</button></p></div></div></section>';
}
const NAV=[
 ['overview','⌂','Overview'],['documents','▤','Documents'],['create','＋','New receipt'],
 ['customers','♙','Customers'],['products','▥','Products & stock'],['payments','⇆','Payments'],
 ['expenses','↗','Expenses'],['targets','▥','Sales targets'],['team','♧','Team & invites'],['branding','⚙','Brand identity'],['upgrade','⇧','Upgrade old receipts']
];
function navigation(){
 const filtered=NAV.filter(([v])=>{
  if(v==='expenses'||v==='targets')return finance();
  if(v==='upgrade')return state.biz?.role==='owner';
  if(v==='team'||v==='branding')return admin();
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
 '<main class="workspace-main">'+body+'</main><footer class="footer">Bizlano · Your business, beautifully managed. · <strong>Powered by Bizlano</strong></footer>'+
 '<nav class="mobile-nav" aria-label="Quick navigation"><button data-nav="overview" class="'+(state.view==='overview'?'active':'')+'"><span>⌂</span>Home</button>'+
 '<button data-nav="documents" class="'+(state.view==='documents'?'active':'')+'"><span>▤</span>Documents</button>'+
 (edit()?'<button data-nav="create" class="create '+(state.view==='create'?'active':'')+'"><span>＋</span>Create</button>':'')+
 '<button data-nav="'+(edit()?'products':'overview')+'"><span>▥</span>'+(edit()?'Stock':'Home')+'</button>'+
 '<button data-action="menu"><span>☷</span>More</button></nav></div></div>';
}
function overview(){
 const r=state.data;if(!r)return '<div class="empty">Loading your business overview…</div>';
 const metrics=[['Issued sales',curr(r.invoiced),'Issued documents'],['Payments entered',curr(r.received),'Operator-recorded'],['Outstanding',curr(r.outstanding),'Unpaid balances'],['Customers',r.customers,'Business records']];
 return heading('BUSINESS INTELLIGENCE','Every sale, clearly accounted for.','Your real cloud data, accessible to your authorized team.',edit()?'<button data-nav="create" class="btn primary">+ Create document</button>':'')+
 '<div class="metrics">'+metrics.map(m=>'<div class="metric"><span>'+m[0]+'</span><strong>'+m[1]+'</strong><small>'+m[2]+'</small></div>').join('')+'</div>'+
 '<div class="cols"><section class="panel"><h2>Get started with Bizlano</h2><p class="muted">Your secure workspace is connected to Cloudflare D1. Add customers, manage stock and issue invoices that can be printed or saved as PDF.</p><div class="row"><button class="btn primary" data-nav="create">Create your first receipt</button><button class="btn" data-nav="documents">View history</button></div></section>'+
 '<section class="panel"><h2>Your business address</h2><p class="muted">Bizlano business key</p><h3>'+e(state.biz.slug)+'</h3><p class="mini muted">A custom branded subdomain will be enabled when the Bizlano domain is connected. This address is already unique within the database.</p></section></div>';
}
function gridRows(rows,headers,fn){return '<div class="table-scroll"><table><thead><tr>'+headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(fn).join('')+'</tbody></table></div>'}
function docs(){
 const rows=state.data?.rows||[];
 return heading('RECORDS','Receipts and invoices','Issue, print, and review business documents.',edit()?'<button class="btn primary" data-nav="create">+ New document</button>':'')+
 '<section class="panel">'+(rows.length?gridRows(rows,['Document','Customer','Total','Status','Actions'],d=>'<tr><td><strong>'+e(d.document_number)+'</strong><br><small>'+e(d.kind)+' · '+e(d.issued_on)+'</small></td><td>'+e(d.recipient_name)+'</td><td>'+curr(d.total_minor)+'</td><td>'+e(d.status)+'</td><td><button class="btn" data-doc="'+e(d.id)+'">Preview / Print</button>'+(!['voided','draft','paid'].includes(d.status)&&edit()?'<button class="btn" data-payment="'+e(d.id)+'">Payment</button>':'')+(d.status==='draft'&&edit()?'<button class="btn" data-issue="'+e(d.id)+'">Issue</button>':'')+'</td></tr>'):'<div class="empty">Your document history is empty. Create the first receipt or invoice to begin.</div>')+'</section>';
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
 return heading('PAYMENT JOURNAL','Recorded payments','Amounts entered by authorized staff. Always independently verify receipt of money.')+
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
function branding(){const b=state.data?.business||state.biz;
 return heading('BUSINESS IDENTITY','Your brand, your documents','Upload your business logo and keep your workspace recognizable.')+
 '<div class="cols"><section class="panel"><h2>Business logo</h2><p class="muted">PNG, JPEG or WebP, maximum 400 KB. Uploaded logos stay in your dedicated Cloudflare R2 bucket.</p>'+
 (b.logo_url?'<img style="max-width:160px;max-height:100px;object-fit:contain" src="'+e(b.logo_url)+'" alt="Business logo">':'<div class="banner">No logo uploaded yet</div>')+
 '<form data-form="logo"><label class="field">Upload a logo<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required></label><button class="btn primary">Save logo</button></form></section>'+ 
 '<section class="panel"><h2>Business information</h2><p><strong>'+e(b.business_name)+'</strong></p><p class="muted">Unique business address: '+e(b.slug)+'</p><p class="mini muted">Until your brand domain is connected, Bizlano uses the Cloudflare worker address for your secure workspace.</p></section></div>';
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
 return heading('SAFE ACCOUNT MIGRATION','Bring your old receipts forward','Your original MetaForge receipts stay untouched. Imported copies are review-only drafts in Bizlano.')+
 '<div class="cols"><section class="panel"><h2>Scan your original account</h2><p class="muted">Read your own Firebase receipt engines using your currently signed-in account. This does not change any old document.</p>'+
 '<div class="row"><button class="btn primary" data-action="scan-legacy">Scan old receipts</button>'+
 (a?'<button class="btn" data-action="download-legacy">Download original archive</button>':'')+'</div>'+
 (a?'<div class="banner"><strong>'+a.engines.length+' engines · '+total+' accessible receipts</strong><br>'+e((a.issues||[]).length+' warning(s).')+' Only accessible sources are included.'+
 (state.backupReady?'<br>Backup prepared; you may stage copies as drafts.':'<br>Download a backup before importing.')+'</div>'+
 '<button class="btn primary" data-action="import-scanned" '+(state.backupReady?'':'disabled')+'>Copy to Bizlano for review</button>':'')+
 '<p class="mini muted">Scans are capped to avoid excessive legacy database reads. If history is missing, use your original MetaForge export and review warnings.</p></section>'+
 '<section class="panel"><h2>Already have a legacy backup?</h2><p class="muted">Upload a JSON backup downloaded from your old MetaForge account. The uploader verifies its owner UID matches your current Firebase login.</p>'+
 '<form data-form="legacy-file"><label class="field">Backup archive (.json)<input type="file" name="archive" accept=".json,application/json" required></label>'+
 '<label class="field"><input type="checkbox" name="includeBrowser" style="display:inline-block;width:auto"> Include histories saved only on my old browser (may be unverified)</label>'+
 '<button type="submit" class="btn primary">Review and import backup</button></form>'+
 '<div class="banner">We never treat historical receipts as newly paid sales. Business and customer information stays scoped to your own workspace.</div></section></div>';
}
async function scanLegacy(){
 if(state.biz?.role!=='owner'||!auth.currentUser?.emailVerified)throw Error('Only the verified owner can migrate history');
 const account=auth.currentUser,issues=[],engines=[];
 const found=await getDocs(query(collection(oldDb,'short_urls'),where('owner_uid','==',account.uid),limit(11)));
 if(found.size>10)issues.push('There are more than 10 engines; this scan only checks the first 10 to limit cloud reads.');
 for(const engine of found.docs.slice(0,10)){
  if(!/^[A-Za-z0-9]{6}$/.test(engine.id))continue;
  try{
   const receipts=await getDocs(query(collection(oldDb,'short_urls',engine.id,'receipts'),limit(251)));
   if(receipts.size>250)issues.push('Engine '+engine.id+' exceeds 250 receipts; use the original export for complete history.');
   engines.push({code:engine.id,brandName:engine.data().brandName||engine.id,receipts:receipts.docs.slice(0,250).map(x=>({id:x.id,...x.data()}))});
  }catch(err){issues.push('Could not read engine '+engine.id+' — the original records remain available on the old site.');}
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
function docEditor(){
 const tpl=['signature','classic','executive','retail','thermal','minimal','editorial','bold','artisan','medical','education','hospitality'];
 const options=state.biz.role==='cashier'?[['receipt','Sales receipt'],['cash-sale','Cash sale'],['service-receipt','Service receipt'],['thermal-receipt','Thermal POS']]:
 [['receipt','Sales receipt'],['invoice','Sales invoice'],['quotation','Quotation'],['estimate','Estimate'],['proforma','Proforma'],['retail-receipt','Retail receipt'],['service-receipt','Service receipt'],['tax-invoice','Tax invoice'],['thermal-receipt','Thermal POS']];
 return heading('DOCUMENT STUDIO','Create a business document','Live preview, flexible details and professionally branded output.')+
 '<div class="editor"><section class="panel editor-form"><form data-form="document">'+
 '<h2>01 · Document and style</h2><div class="form-grid">'+select('Document type','kind',options)+input('Issue date','date','date',today(),true)+input('Due date','dueDate','date')+select('Template','template',tpl.map(x=>[x,x.charAt(0).toUpperCase()+x.slice(1)]))+'</div>'+
 '<h2>02 · Customer information</h2>'+input('Customer or recipient','customer','text','Walk-in customer',true)+
 '<h2>03 · Products and services</h2><datalist id="products-data">'+state.products.map(p=>'<option value="'+e(p.name)+'"></option>').join('')+'</datalist><div id="lines">'+state.items.map((i,n)=>lineHtml(i,n)).join('')+'</div><button class="btn ghost" type="button" data-action="add-line">+ Add item</button>'+
 '<h2 style="margin-top:25px">04 · Charges and payments</h2><div class="form-grid">'+input('Discount (%)','discountPct','number','0',false,'min="0" max="100" step=".01"')+input('VAT / Tax (%)','taxPct','number','0',false,'min="0" max="100" step=".01"')+input('Other charges (₦)','shipping','number','0',false,'min="0" step=".01"')+input('Received (₦)','received','number','0',false,'min="0" step=".01"')+'</div>'+select('Payment method','method',[['Bank transfer','Bank transfer'],['Cash','Cash'],['POS terminal','POS terminal'],['Other','Other']])+
 '<label class="field">Notes<textarea name="notes">Thank you for your business.</textarea></label>'+
 '<div class="row"><button type="submit" class="btn primary" data-document-action="issue">Save and issue</button><button type="submit" class="btn" data-document-action="draft">Save draft</button></div><p class="mini muted">Issue only after confirming payment. Unpaid sales should be invoices, not receipts.</p></form></section>'+
 '<aside class="receipt-stage"><h2>LIVE PREVIEW</h2><div id="preview"></div><button class="btn" type="button" data-action="print-preview" style="margin-top:13px">Print / Save PDF</button></aside></div>';
}
function lineHtml(item,n){
 return '<div class="line-item" data-line="'+n+'"><label class="field">Item<input class="li-description" value="'+e(item.description||'')+'" placeholder="Product or service" required list="products-data"></label>'+
 '<label class="field">Qty<input class="li-qty" type="number" value="'+e(item.qty||1)+'" min=".001" step=".001"></label>'+
 '<label class="field">Price<input class="li-price" type="number" value="'+e(item.price||0)+'" min="0" step=".01"></label>'+
 '<button type="button" data-remove-line="'+n+'" aria-label="Remove line">×</button></div>';
}
function currentDoc(){
 const f=document.querySelector('[data-form=document]');if(!f)return null;
 const items=[...document.querySelectorAll('.line-item')].map((r,i)=>({description:r.querySelector('.li-description').value,qty:Number(r.querySelector('.li-qty').value),price:Number(r.querySelector('.li-price').value),productId:state.items[i]?.productId||null}));
 return {kind:val(f,'kind'),date:val(f,'date'),dueDate:val(f,'dueDate'),template:val(f,'template'),customer:val(f,'customer'),items,discountPct:Number(val(f,'discountPct')||0),taxPct:Number(val(f,'taxPct')||0),shipping:Number(val(f,'shipping')||0),received:Number(val(f,'received')||0),method:val(f,'method'),notes:val(f,'notes')};
}
function receipt(doc,number,stored=false){
 const lines=doc.items||[];
 let subtotal=0;const rows=lines.filter(i=>i.description).map(i=>{const total=Number(i.price)*Number(i.qty);subtotal+=total;return '<tr><td>'+e(i.description)+'</td><td>'+e(i.qty)+'</td><td>'+oldMoney(total)+'</td></tr>'}).join('');
 const discount=Math.round(subtotal*(Number(doc.discountPct)||0))/100,vat=Math.round((subtotal-discount)*(Number(doc.taxPct)||0))/100;
 const total=stored?doc.total_minor/100:subtotal-discount+vat+Number(doc.shipping||0);
 const template=String(doc.template||'signature');const logo=state.biz.logo_url||state.data?.business?.logo_url||'';
 return '<article class="receipt style-'+e(template)+'" id="printable"><div class="r-head"><div>'+(logo?'<img class="receipt-logo" src="'+e(logo)+'" alt="Business logo">':'')+'<h2>'+e(state.biz.business_name)+'</h2><div class="r-small">Official business document</div></div><div style="text-align:right"><h3>'+e(doc.kind||'Invoice').toUpperCase()+'</h3><div class="r-small">'+e(number||'UNSAVED DRAFT')+'</div></div></div>'+
 '<div class="r-section"><div><strong>Issued to</strong><div class="r-small">'+e(doc.customer||doc.recipient_name||'Walk-in')+'</div></div><div><strong>Issued on</strong><div class="r-small">'+e(doc.date||doc.issued_on||today())+'</div></div></div>'+
 '<table><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'+
 '<div class="r-total"><div><span>Subtotal</span><strong>'+oldMoney(subtotal)+'</strong></div><div><span>Discount</span><strong>'+oldMoney(discount)+'</strong></div><div><span>Tax</span><strong>'+oldMoney(vat)+'</strong></div><div class="grand"><span>Total</span><span>'+oldMoney(total)+'</span></div><div><span>Received</span><strong>'+oldMoney(doc.received??(stored?doc.paid_minor/100:0))+'</strong></div></div>'+
 '<p class="r-small" style="margin-top:23px">'+e(doc.notes||'Thank you for your business.')+'</p><div class="powered">Powered by <strong style="color:#6635db">Bizlano</strong> · Your business, beautifully managed.</div></article>';
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
 const views={overview,documents:docs,customers,products,payments,expenses,targets,team,branding,upgrade,create:docEditor};
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
 if(action==='toggle-auth'){state.authMode=state.authMode==='login'?'register':'login';render();return}
 if(action==='menu'){toggleMenu();return}
 if(action==='picker'){state.biz=null;render();return}
 if(action==='logout'){await api('/logout',{});await signOut(auth);state.me=null;state.biz=null;render();return}
 if(action==='resend'){await sendEmailVerification(auth.currentUser);flash('Verification email requested. Check your inbox.');return}
 if(action==='refresh'){await reload(auth.currentUser);state.user=auth.currentUser;if(!state.user.emailVerified)throw Error('Email is not yet verified.');await attach();return}
 if(action==='reset'){const address=prompt('Email for password reset');if(address){await sendPasswordResetEmail(auth,address);flash('Password reset email requested.')}return}
 if(action==='scan-legacy'){await scanLegacy();return}
 if(action==='download-legacy'){downloadLegacy();return}
 if(action==='import-scanned'){if(!state.backupReady)throw Error('Download a backup before importing');await importLegacy(state.legacyArchive,false);return}
 if(action==='add-line'){state.items=currentDoc()?.items||state.items;state.items.push({description:'',qty:1,price:0});document.getElementById('lines').innerHTML=state.items.map(lineHtml).join('');drawPreview();return}
 if(el.dataset.removeLine!==undefined){state.items=currentDoc()?.items||state.items;if(state.items.length>1)state.items.splice(Number(el.dataset.removeLine),1);document.getElementById('lines').innerHTML=state.items.map(lineHtml).join('');drawPreview();return}
 if(action==='print-preview'){window.print();return}
 if(el.dataset.doc){const d=await api('/b/'+state.biz.slug+'/doc/'+el.dataset.doc);printPage(d.document);return}
 if(el.dataset.payment){const value=prompt('Amount actually received in ₦');if(value===null)return;await api('/b/'+state.biz.slug+'/payments',{documentId:el.dataset.payment,amount:Number(value),method:'Manual'});flash('Payment recorded.');await navigate('documents');return}
 if(el.dataset.issue){if(!confirm('Issue this draft? Issued documents cannot be edited.'))return;await api('/b/'+state.biz.slug+'/issue',{documentId:el.dataset.issue});flash('Draft issued.');await navigate('documents');return}
 }catch(err){flash(err.message,true)}
});
document.addEventListener('input',ev=>{if(ev.target.closest('[data-form=document]'))drawPreview()});
document.addEventListener('change',ev=>{
 if(!ev.target.matches('.li-description'))return;
 const row=ev.target.closest('.line-item'),index=Number(row?.dataset.line);
 const matched=state.products.find(p=>p.name.toLowerCase()===ev.target.value.trim().toLowerCase());
 if(state.items[index])state.items[index].productId=matched?.id||null;
 if(matched)row.querySelector('.li-price').value=String(matched.price_minor/100);
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
  if(state.authMode==='register'){const result=await createUserWithEmailAndPassword(auth,address,password);await sendEmailVerification(result.user);flash('Account created. Check your email to verify your address.')}
  else await signInWithEmailAndPassword(auth,address,password);
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
  if(kind==='logo'){
    const file=form.elements.namedItem('logo')?.files?.[0];
    if(!file||file.size>400000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Select PNG, JPEG or WebP under 400 KB');
    const response=await fetch(t.replace(/^/,'/api')+'/logo',{method:'POST',headers:{'content-type':file.type},body:file});
    const payload=await response.json();if(!response.ok)throw Error(payload.error||'Logo upload failed');
    flash('Business logo uploaded.');await navigate('branding');state.busy=false;return;
  }
  if(kind==='invite'){const r=await api(t+'/invite',{email:val(form,'email'),role:val(form,'role')});const box=document.getElementById('invite-result');box.textContent='Invite link (share privately): '+r.url;box.classList.remove('hidden');flash('Invitation generated. Copy the private link.');state.busy=false;return}
  if(kind==='document'){
   const b=currentDoc();b.draft=documentMode==='draft';
   const result=await api(t+'/documents',b);
   flash('Saved '+result.number);await navigate('documents');
  }else{flash('Saved successfully');await navigate(state.view)}
 }
 }catch(err){flash(err.message,true)}
 finally{state.busy=false}
});
onAuthStateChanged(auth,async user=>{
 state.user=user;
 if(!user){state.me=null;state.biz=null;render();return}
 if(!user.emailVerified){state.me=null;loginScreen();return}
 try{await attach()}catch(err){state.me=null;flash(err.message,true);render()}
});
