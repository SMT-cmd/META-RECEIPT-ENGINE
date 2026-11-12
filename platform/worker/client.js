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
const state={user:null,me:null,biz:null,view:'overview',data:null,products:[],customers:[],items:[{description:'',qty:1,price:0,productId:''}],busy:false,authMode:new URL(location.href).searchParams.get('mode')==='register'?'register':'login',pendingEmail:null,resetToken:null,preview:null,legacyArchive:null,backupReady:false,chartMode:'bar',chartDays:30,connectError:'',design:null,templateChoice:null,designStep:1,designIndustry:null,designDraft:null,designScroll:0,designBrowseAll:false,designDepartment:null,legacyStyles:[],legacyChecked:false,docStep:1,printPaper:null,org:{arms:[],locations:[],profiles:[]},billingQuote:null,pendingConversion:null};
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
 if(section==='team'){
  const [team,scopes,arms,locations]=await Promise.all([api(t+'/team'),api(t+'/staff-scopes'),api(t+'/arms'),api(t+'/locations')]);
  state.data={...team,scopes:scopes.rows||[]};state.org.arms=arms.rows||[];state.org.locations=locations.rows||[];render();return;
 }
 if(section==='designProfiles'){
  const [profiles,arms]=await Promise.all([api(t+'/design-profiles'),api(t+'/arms')]);
  state.org.profiles=profiles.rows||[];state.org.arms=arms.rows||[];state.data=profiles;render();return;
 }
 if(section==='billing'){
  const [catalogue,history]=await Promise.all([api(t+'/billing'),api(t+'/billing/status')]);
  state.data={...catalogue,...history};render();return;
 }
 if(section==='purchases'){
  const [p,s,orders,locations]=await Promise.all([api(t+'/products'),api(t+'/suppliers'),api(t+'/purchases'),api(t+'/locations')]);
  state.products=p.rows||[];state.org.locations=locations.rows||[];
  state.data={rows:orders.rows||[],suppliers:s.rows||[]};render();return;
 }
 if(section==='locationStock'){
  const [p,l,balances]=await Promise.all([api(t+'/products'),api(t+'/locations'),api(t+'/stock-locations')]);
  state.products=p.rows||[];state.org.locations=l.rows||[];state.data={rows:balances.rows||[]};render();return;
 }
 if(section==='overview'){
  const [main,trends,goals]=await Promise.all([api(t+'/overview'),api(t+'/trends'),api(t+'/targets')]);
  state.data={...main,trends:trends.rows,goals:goals.rows};render();return;
 }
 if(section==='design'){const x=await api(t+'/design');state.design=x.design;state.data=x;state.designIndustry=state.designIndustry||x.industry||state.biz.industry||'general';render();if(!state.legacyChecked)void findLegacyStyles();return}
 if(section==='branding'){const [main,details]=await Promise.all([api(t+'/overview'),api(t+'/design')]);state.data=main;state.design=details.design;render();return}
 if(section==='create') {
  const [p,c,d,arms,locations,profiles]=await Promise.all([api(t+'/products'),api(t+'/customers'),api(t+'/design'),api(t+'/arms'),api(t+'/locations'),api(t+'/design-profiles')]);
  state.org={arms:arms.rows||[],locations:locations.rows||[],profiles:profiles.rows||[]};
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
 app.innerHTML='<section class="auth-root"><div class="auth-art"><a class="brand" href="/">'+brand()+'</a><div><p class="kicker">YOUR BUSINESS. YOUR SPACE.</p><h1>Run your business, beautifully.</h1><p>Create professional receipts and invoices, organize customers, track stock and work with your team from anywhere.</p></div><small>Your business, your team, your next chapter.</small></div><div class="auth-form-shell"><div><div class="eyebrow">WELCOME TO BIZLANO</div><h2>'+title+'</h2>'+body+'<p class="mini muted">Need help with an old MetaForge account? <a href="/help">Visit Help</a>.</p><div class="auth-parent"><a class="auth-parent-mark" href="https://www.globalwebstores.com/explore" target="_blank" rel="noopener noreferrer"><img src="https://www.globalwebstores.com/brand/global-webstores-full.png" alt="Global Web Stores official logo" width="39" height="39"></a><div><strong>Powered by Global Web Stores</strong><a href="https://www.globalwebstores.com/explore" target="_blank" rel="noopener noreferrer">Explore Global Web Stores ↗</a></div></div><a class="auth-home" href="/">← Back to Bizlano homepage</a></div></div></section>';
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

// Business-specific suggestions only guide selection; all original template IDs stay valid.
const HERITAGE_TEMPLATES={"heritage-modern-tech":{"name":"Modern Tech","group":"Corporate","accent":"#ff6b00","secondary":"#1a1a1a"},"heritage-minimalist-pro":{"name":"Minimalist Pro","group":"Corporate","accent":"#ff6b00","secondary":"#1a1a1a"},"heritage-corporate-luxe":{"name":"Corporate Luxe","group":"Premium","accent":"#d4af37","secondary":"#1a1a1a"},"heritage-legal-professional":{"name":"Legal Professional","group":"Professional","accent":"#8b0000","secondary":"#1a1a1a"},"heritage-cyber-punk":{"name":"Cyber Punk","group":"Tech","accent":"#00ff41","secondary":"#1a1a1a"},"heritage-retro-wave":{"name":"Retro Wave","group":"Creative","accent":"#558b2f","secondary":"#1a1a1a"},"heritage-neo-brutalist":{"name":"Neo Brutalist","group":"Bold","accent":"#ff006e","secondary":"#1a1a1a"},"heritage-startup-modern":{"name":"Startup Modern","group":"Tech","accent":"#f4a460","secondary":"#1a1a1a"},"heritage-royal-elegance":{"name":"Royal Elegance","group":"Classic","accent":"#8b4513","secondary":"#1a1a1a"},"heritage-art-deco":{"name":"Art Deco","group":"Vintage","accent":"#c9a961","secondary":"#1a1a1a"},"heritage-fashion-boutique":{"name":"Fashion Boutique","group":"Retail","accent":"#000000","secondary":"#1a1a1a"},"heritage-hotel-resort":{"name":"Hotel Resort","group":"Hospitality","accent":"#b8860b","secondary":"#1a1a1a"},"heritage-clean-air":{"name":"Clean Air","group":"Minimal","accent":"#4299e1","secondary":"#1a1a1a"},"heritage-swiss-design":{"name":"Swiss Design","group":"Professional","accent":"#ff0000","secondary":"#1a1a1a"},"heritage-japanese-minimal":{"name":"Japanese Minimal","group":"Zen","accent":"#e74c3c","secondary":"#1a1a1a"},"heritage-compact-slip":{"name":"Compact Slip","group":"Quick","accent":"#ff6b00","secondary":"#1a1a1a"},"heritage-midnight-special":{"name":"Midnight Special","group":"Dark","accent":"#e94560","secondary":"#1a1a1a"},"heritage-garage-workshop":{"name":"Garage Workshop","group":"Industrial","accent":"#ff6600","secondary":"#1a1a1a"},"heritage-bold-stripe":{"name":"Bold Stripe","group":"Modern","accent":"#ff6b00","secondary":"#1a1a1a"},"heritage-fitness-gym":{"name":"Fitness Gym","group":"Sports","accent":"#00ff00","secondary":"#1a1a1a"},"heritage-pharmacy-medical":{"name":"Pharmacy Medical","group":"Medical","accent":"#0066cc","secondary":"#1a1a1a"},"heritage-bakery-sweet":{"name":"Bakery Sweet","group":"Food","accent":"#ff6b9d","secondary":"#1a1a1a"},"heritage-nature-organic":{"name":"Nature Organic","group":"Eco","accent":"#558b2f","secondary":"#1a1a1a"},"heritage-salon-beauty":{"name":"Salon Beauty","group":"Beauty","accent":"#ff69b4","secondary":"#1a1a1a"},"heritage-restaurant-diner":{"name":"Restaurant Diner","group":"Food","accent":"#d2691e","secondary":"#1a1a1a"},"heritage-construction-industrial":{"name":"Construction","group":"Industrial","accent":"#f4a460","secondary":"#1a1a1a"},"heritage-education-academy":{"name":"Education Academy","group":"Education","accent":"#4169e1","secondary":"#1a1a1a"},"heritage-transport-logistics":{"name":"Transport","group":"Logistics","accent":"#ffd700","secondary":"#1a1a1a"},"heritage-real-estate":{"name":"Real Estate","group":"Property","accent":"#8b4513","secondary":"#1a1a1a"},"heritage-event-planning":{"name":"Event Planning","group":"Events","accent":"#ff1493","secondary":"#1a1a1a"},"heritage-curved-organic":{"name":"Curved Organic","group":"Artistic","accent":"#ff6b00","secondary":"#1a1a1a"},"heritage-geometric-slice":{"name":"Geometric Slice","group":"Bold","accent":"#ff6b00","secondary":"#1a1a1a"},"heritage-vintage-ticket":{"name":"Vintage Ticket","group":"Retro","accent":"#7d6b5d","secondary":"#1a1a1a"},"heritage-futuristic-glass":{"name":"Futuristic Glass","group":"Tech","accent":"#ff6b00","secondary":"#1a1a1a"},"heritage-stamp-quality":{"name":"Stamp Quality","group":"Premium","accent":"#ff6b00","secondary":"#1a1a1a"}};
const HERITAGE_KEYS=Object.keys(HERITAGE_TEMPLATES);
const isHeritage=id=>Object.hasOwn(HERITAGE_TEMPLATES,String(id||''));
const BUSINESS_TYPES=[
 {id:'general',name:'General business',templates:['heritage-swiss-design','heritage-japanese-minimal','heritage-modern-tech','signature','modern'],item:'Product or service'},
 {id:'electronics',name:'Electronics & gadgets',templates:['heritage-cyber-punk','heritage-modern-tech','heritage-neo-brutalist','heritage-swiss-design','sapphire'],item:'Wireless speaker'},
 {id:'bakery',name:'Baking, food & cafés',templates:['heritage-bakery-sweet','heritage-vintage-ticket','heritage-art-deco','heritage-nature-organic','artisan-paper'],item:'Freshly baked cake'},
 {id:'retail',name:'Retail, grocery & supermarkets',templates:['heritage-compact-slip','heritage-bold-stripe','heritage-vintage-ticket','heritage-nature-organic','retail'],item:'Household supplies'},
 {id:'fashion',name:'Fashion, beauty & salons',templates:['heritage-fashion-boutique','heritage-salon-beauty','heritage-art-deco','heritage-royal-elegance','boutique'],item:'Customer order'},
 {id:'services',name:'Professional services',templates:['heritage-swiss-design','heritage-legal-professional','heritage-minimalist-pro','heritage-corporate-luxe','corporate'],item:'Professional service'},
 {id:'trades',name:'Electrical, repairs & construction',templates:['heritage-garage-workshop','heritage-construction-industrial','heritage-swiss-design','heritage-japanese-minimal','service'],item:'Equipment installation'},
 {id:'health',name:'Health & education',templates:['heritage-pharmacy-medical','heritage-education-academy','heritage-clean-air','heritage-stamp-quality','medical'],item:'Service charges'},
 {id:'hospitality',name:'Hotels, events & hospitality',templates:['heritage-hotel-resort','heritage-event-planning','heritage-royal-elegance','heritage-art-deco','hospitality'],item:'Booking service'},
 {id:'logistics',name:'Logistics & wholesale',templates:['heritage-transport-logistics','heritage-swiss-design','heritage-construction-industrial','heritage-bold-stripe','wholesale'],item:'Delivery service'}
];
const TEMPLATE_FAMILIES=[
 ['Everyday business',['signature','classic','executive','minimal','modern','retail','digital','startup']],
 ['Retail & food',['thermal','restaurant','grocery','wholesale','artisan','artisan-paper']],
 ['Fashion & premium',['boutique','salon','luxury','editorial','premium-dark','festival']],
 ['Services & specialist',['service','legal','medical','education','real-estate','logistics','hospitality','event']],
 ['Corporate & colour',['corporate','ledger','bold','monochrome','gradient','formal','emerald','sapphire']]
];
// One full-size carousel per department. Every one of the 71 IDs appears in exactly one department.
const STUDIO_DEPARTMENTS=[
 {id:'office',name:'Business & professional',description:'Office, corporate, legal and professional services',templates:['heritage-modern-tech','heritage-minimalist-pro','heritage-corporate-luxe','heritage-legal-professional','heritage-swiss-design','heritage-clean-air','heritage-stamp-quality','signature','classic','executive','corporate','formal','minimal','legal']},
 {id:'technology',name:'Electronics & technology',description:'Gadgets, technology shops and digital businesses',templates:['heritage-cyber-punk','heritage-retro-wave','heritage-neo-brutalist','heritage-startup-modern','heritage-futuristic-glass','modern','digital','startup','sapphire','gradient']},
 {id:'retail',name:'Shops & retail',description:'Sales counters, general shops and stockists',templates:['heritage-fashion-boutique','heritage-compact-slip','heritage-bold-stripe','heritage-vintage-ticket','retail','thermal','grocery','wholesale']},
 {id:'food',name:'Food, cafés & bakeries',description:'Bakeries, restaurants, groceries and food businesses',templates:['heritage-bakery-sweet','heritage-restaurant-diner','heritage-nature-organic','restaurant','artisan','artisan-paper']},
 {id:'fashion',name:'Fashion, beauty & luxury',description:'Clothing, salons, cosmetics and premium brands',templates:['heritage-salon-beauty','heritage-royal-elegance','heritage-art-deco','boutique','salon','luxury','editorial']},
 {id:'trades',name:'Trades, repairs & delivery',description:'Electrical work, construction, workshops and transport',templates:['heritage-garage-workshop','heritage-construction-industrial','heritage-transport-logistics','service','ledger','logistics']},
 {id:'health',name:'Health, fitness & education',description:'Clinics, schools, tutoring and fitness businesses',templates:['heritage-pharmacy-medical','heritage-education-academy','heritage-fitness-gym','medical','education']},
 {id:'events',name:'Hotels, events & property',description:'Hospitality, event planning and property services',templates:['heritage-hotel-resort','heritage-event-planning','heritage-real-estate','event','hospitality','real-estate']},
 {id:'creative',name:'Creative & expressive',description:'Artistic, minimal, dramatic and colourful identities',templates:['heritage-curved-organic','heritage-geometric-slice','heritage-midnight-special','heritage-japanese-minimal','bold','monochrome','festival','premium-dark','emerald']}
];
const STUDIO_INDUSTRY_DEPARTMENT={general:'office',electronics:'technology',bakery:'food',retail:'retail',fashion:'fashion',services:'office',trades:'trades',health:'health',hospitality:'events',logistics:'trades'};
const departmentForIndustry=id=>STUDIO_INDUSTRY_DEPARTMENT[id]||'office';
const departmentById=id=>STUDIO_DEPARTMENTS.find(x=>x.id===id)||STUDIO_DEPARTMENTS[0];
const departmentForTemplate=id=>STUDIO_DEPARTMENTS.find(x=>x.templates.includes(id))||STUDIO_DEPARTMENTS[0];
const templateCatalogCount=STUDIO_DEPARTMENTS.reduce((total,d)=>total+d.templates.length,0);

const businessCategory=id=>BUSINESS_TYPES.find(x=>x.id===id)||BUSINESS_TYPES[0];
const templateTitle=id=>HERITAGE_TEMPLATES[id]?.name||String(id).split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' ');
const FONT_STYLES=[['modern','Modern sans'],['editorial','Editorial serif'],['mono','Technical monospaced'],['rounded','Friendly rounded'],['classic','Classic sans']];
const TEXT_LOGO_STYLES=[['split','Two-tone business name'],['plain','Plain wordmark'],['caps','Uppercase wordmark']];
const fontCssName=id=>({modern:"'Manrope',Arial,sans-serif",editorial:'Georgia,Times,serif',mono:'ui-monospace,Consolas,monospace',rounded:"'Trebuchet MS',Arial,sans-serif",classic:'Arial,Helvetica,sans-serif'})[id]||'Arial,sans-serif';
function stylizedCompanyName(name,mode){
 const original=String(name||'Business'),words=original.trim().split(/\s+/);
 if(mode==='caps')return '<span class="wordmark-caps">'+e(original)+'</span>';
 if(mode==='plain')return e(original);
 const i=words.length>1?words.slice(0,Math.ceil(words.length/2)).join(' ').length:Math.ceil(original.length/2);
 return e(original.slice(0,i))+'<span class="brand-accent">'+e(original.slice(i))+'</span>';
}
function activeDesign(){return state.designDraft||state.design||{template:'signature',accent:'#6935df',secondary_color:'#19223b',font_family:'modern',text_logo_style:'split',paper:'a4',header_note:'',footer_note:'Thank you for your business.',contact:'',show_logo:0,show_signature:0};}
function captureDesignForm(){
 const f=document.querySelector('[data-form=design]');if(!f)return;
 const prev=activeDesign(),value=(n,def)=>f.elements.namedItem(n)?.value??def;
 state.designDraft={...prev,accent:value('accent',prev.accent),secondary_color:value('secondaryColor',prev.secondary_color||'#19223b'),
  font_family:value('fontFamily',prev.font_family||'modern'),text_logo_style:value('textLogoStyle',prev.text_logo_style||'split'),
  paper:value('paper',prev.paper||'a4'),contact:value('contact',prev.contact||''),header_note:value('headerNote',prev.header_note||''),
  footer_note:value('footerNote',prev.footer_note||'Thank you for your business.'),
  show_logo:f.elements.namedItem('showLogo')?.checked?1:0,show_signature:f.elements.namedItem('showSignature')?.checked?1:0};
}
function sampleDocument(template){
 const sector=businessCategory(state.designIndustry||state.biz?.industry||'general');
 return {kind:'receipt',template,date:today(),customer:'Sample customer',items:[{description:sector.item,qty:2,price:5500}],discountPct:0,taxPct:0,shipping:0,received:11000,notes:'Thank you for your business.'};
}
function sampleHtml(template,asCard=false){
 const theme=templateArt(template);
 const design={...activeDesign(),font_family:asCard?undefined:activeDesign().font_family,secondary_color:asCard?(HERITAGE_TEMPLATES[template]?.secondary||'#19223b'):activeDesign().secondary_color,accent:asCard?theme.accent:(state.designDraft?.accent||(
   template===(state.design?.template||'signature')?activeDesign().accent:theme.accent)),paper:'a4',show_signature:0,show_logo:activeDesign().show_logo};
 return receipt(sampleDocument(template),'BZ-00021',false,design).replace(' id="printable"','');
}
function groupedTemplateOptions(selected){
 const families=[['Original MetaForge designs · 35',HERITAGE_KEYS],...TEMPLATE_FAMILIES];
 return families.map(([label,ids])=>'<optgroup label="'+e(label)+'">'+ids.map(id=>'<option value="'+e(id)+'" '+(selected===id?'selected':'')+'>'+e(templateTitle(id))+'</option>').join('')+'</optgroup>').join('');
}
function guidedSteps(labels,step){
 return '<div class="wizard-steps" role="list" aria-label="Your progress">'+labels.map((label,i)=>'<div role="listitem" class="wizard-step '+(i+1===step?'current':i+1<step?'done':'')+'"><span class="wizard-number">'+(i+1)+'</span><span>'+e(label)+'</span></div>').join('')+'</div>';
}

const RECEIPT_ART={
 signature:{accent:'#6a35cf',layout:'ribbon',story:'Personal signature',note:'A confident branded ribbon'},
 classic:{accent:'#354764',layout:'letterhead',story:'Classic trust',note:'Traditional serif letterhead'},
 executive:{accent:'#173d70',layout:'statement',story:'Boardroom blue',note:'A structured executive statement'},
 retail:{accent:'#13826e',layout:'ticket',story:'Retail energy',note:'Easy-to-scan point-of-sale'},
 thermal:{accent:'#333b49',layout:'thermal',story:'Till paper',note:'Simple narrow receipt'},
 minimal:{accent:'#596171',layout:'bare',story:'Quiet clarity',note:'Airy and almost borderless'},
 editorial:{accent:'#954a78',layout:'editorial',story:'Editorial plum',note:'Expressive magazine typography'},
 bold:{accent:'#c54a2e',layout:'poster',story:'Bold coral',note:'Oversized headline and blocks'},
 artisan:{accent:'#9e5838',layout:'craft',story:'Handmade terracotta',note:'Warm crafted paper'},
 medical:{accent:'#147f93',layout:'clinical',story:'Care teal',note:'Clean medical records'},
 education:{accent:'#5749ab',layout:'academic',story:'Academic violet',note:'Formal learning documents'},
 hospitality:{accent:'#987039',layout:'hotel',story:'Hotel brass',note:'Guest-services letterhead'},
 luxury:{accent:'#926b35',layout:'luxury',story:'Gold reserve',note:'Fine-line premium statement'},
 corporate:{accent:'#21437f',layout:'band',story:'Corporate navy',note:'Solid full-width business header'},
 ledger:{accent:'#515b68',layout:'ledger',story:'Workshop ledger',note:'Monospaced job record'},
 modern:{accent:'#385fe0',layout:'modern',story:'Digital cobalt',note:'Bright contemporary lines'},
 boutique:{accent:'#a74d78',layout:'boutique',story:'Boutique rose',note:'Elegant centered identity'},
 monochrome:{accent:'#292e36',layout:'mono',story:'True monochrome',note:'Black-ink typographic design'},
 festival:{accent:'#d98329',layout:'festival',story:'Celebration amber',note:'Playful event bands'},
 restaurant:{accent:'#923e31',layout:'menu',story:'Bistro burgundy',note:'Restaurant-menu format'},
 grocery:{accent:'#288851',layout:'grocery',story:'Fresh market',note:'Friendly green sales slip'},
 service:{accent:'#107c9d',layout:'blueprint',story:'Service blueprint',note:'Technical service details'},
 legal:{accent:'#293648',layout:'legal',story:'Legal authority',note:'Formal ruled statement'},
 'real-estate':{accent:'#6653a0',layout:'estate',story:'Estate lavender',note:'Property-style summary'},
 logistics:{accent:'#c67c20',layout:'logistics',story:'Dispatch amber',note:'Bold shipment-style header'},
 salon:{accent:'#ae688c',layout:'salon',story:'Beauty studio',note:'Soft elegant symmetry'},
 'artisan-paper':{accent:'#a87846',layout:'paper',story:'Bakery kraft',note:'Soft cream card stock'},
 gradient:{accent:'#634bba',layout:'gradient',story:'Colour movement',note:'Vivid diagonal colour band'},
 formal:{accent:'#3a4660',layout:'formal',story:'Formal seal',note:'Official centered document'},
 event:{accent:'#b44c89',layout:'event',story:'Event ribbon',note:'Lively celebration framing'},
 digital:{accent:'#2a64c2',layout:'digital',story:'Digital platform',note:'Modern screen-friendly panel'},
 wholesale:{accent:'#316ba2',layout:'wholesale',story:'Stock & parts',note:'Dense inventory-style grid'},
 startup:{accent:'#576cc3',layout:'startup',story:'New venture',note:'Fresh compact information'},
 'premium-dark':{accent:'#172545',layout:'dark',story:'Midnight premium',note:'High-contrast dark header'},
 emerald:{accent:'#198564',layout:'emerald',story:'Emerald growth',note:'Green business report'},
 sapphire:{accent:'#255bb5',layout:'sapphire',story:'Sapphire precision',note:'Clear blue invoice'}
};
const templateArt=id=>HERITAGE_TEMPLATES[id]?{accent:HERITAGE_TEMPLATES[id].accent,layout:'heritage-'+id,story:HERITAGE_TEMPLATES[id].name,note:'Original '+HERITAGE_TEMPLATES[id].group+' design'}:(RECEIPT_ART[id]||RECEIPT_ART.signature);
const COLOR_STORIES=[
 {name:'Midnight',hex:'#1d2b52',meaning:'Trust & precision'},
 {name:'Electric blue',hex:'#2668c5',meaning:'Modern technology'},
 {name:'Forest',hex:'#147b5c',meaning:'Growth & reliability'},
 {name:'Terracotta',hex:'#ad6040',meaning:'Warmth & craft'},
 {name:'Rose',hex:'#ac5680',meaning:'Style & elegance'},
 {name:'Gold',hex:'#a27835',meaning:'Premium & tradition'},
 {name:'Slate',hex:'#434f62',meaning:'Calm & professional'},
 {name:'Violet',hex:'#633ac2',meaning:'Creative confidence'}
];
const DESIGN_PALETTE=COLOR_STORIES.map(x=>x.hex);
function setDesignColour(value){
 if(!/^#[a-fA-F0-9]{6}$/.test(String(value)))return;
 state.designDraft={...activeDesign(),accent:value};
}
function templateDisplayArt(id){
 const a=templateArt(id);
 return '<span class="design-card-story"><span class="design-card-color" style="background:'+e(a.accent)+'"></span><span>'+e(a.note)+'</span></span>';
}
function colourStoryChooser(selected){
 return '<div class="colour-story-title"><strong>Choose the feeling of your brand</strong><small>Your choice changes the actual document, not just its preview.</small></div>'+
 '<div class="colour-story-grid">'+COLOR_STORIES.map(c=>
 '<button type="button" class="colour-story '+(selected.toLowerCase()===c.hex.toLowerCase()?'active':'')+'" data-design-color="'+e(c.hex)+'" aria-pressed="'+(selected.toLowerCase()===c.hex.toLowerCase())+'" title="'+e(c.meaning)+'">'+
 '<span class="colour-story-dot" style="background:'+e(c.hex)+'"></span><span class="colour-story-name">'+e(c.name)+'</span><span class="colour-story-meaning">'+e(c.meaning)+'</span></button>'
 ).join('')+'</div>'+
 '<label class="custom-colour-label">Or pick your own colour <input type="color" data-design-custom-color aria-label="Custom receipt colour" value="'+e(selected)+'"></label>';
}
const NAV=[
 ['overview','⌂','Overview'],['documents','▤','Documents'],['create','＋','New receipt'],
 ['customers','♙','Customers'],['products','▥','Products & stock'],['payments','⇆','Payments'],
 ['expenses','↗','Expenses'],['targets','▥','Sales targets'],['arms','⌂','Business arms'],['locations','▤','Locations'],['locationStock','▥','Stock by location'],['purchases','▧','Suppliers & purchases'],['team','♧','Team & invites'],['designProfiles','◈','Saved document designs'],['branding','⚙','Brand identity'],['design','◈','Document studio'],['gws','⇆','Global Webstores'],['alerts','♧','Receipt notifications'],['billing','₦','Plans & billing'],['upgrade','⇧','Upgrade old receipts']
];
function navigation(){
 const filtered=NAV.filter(([v])=>{
  if(v==='expenses'||v==='targets')return finance();
  if(v==='billing')return state.biz?.role==='owner';
  if(v==='upgrade')return state.biz?.role==='owner';
  if(v==='team'||v==='branding'||v==='design'||v==='gws'||v==='arms'||v==='locations'||v==='designProfiles')return admin();
  if(v==='locationStock')return stock();
  if(v==='purchases')return ['owner','admin','manager','accountant'].includes(state.biz?.role);
  if(v==='alerts')return true;
  if(v==='products'||v==='customers'||v==='payments'||v==='create')return edit();
  return true;
 });
 const primary=['overview','documents','create','customers','products','payments'];
 const item=([v,icon,label])=>'<button type="button" data-nav="'+v+'" data-active="'+(v===state.view)+'"><span aria-hidden="true">'+icon+'</span> '+e(label)+'</button>';
 const main=filtered.filter(([v])=>primary.includes(v)).map(item).join('');
 const other=filtered.filter(([v])=>!primary.includes(v));
 return main+(other.length?'<details class="nav-group" '+(other.some(([v])=>v===state.view)?'open':'')+'><summary>More business tools</summary><div class="nav-more">'+other.map(item).join('')+'</div></details>':'');
}
function shell(body){
 const t=state.biz;
 app.innerHTML='<div class="shell"><aside class="sidebar" id="sidebar"><a class="brand" href="/">'+brand()+'</a><div class="caption">WORKSPACE</div><nav class="nav" aria-label="Main navigation">'+navigation()+'</nav>'+
 '<div class="sidebar-bottom"><strong>'+e(t.business_name)+'</strong>'+e(t.slug)+' · '+e(t.role)+'<div style="margin-top:17px"><button class="btn" data-action="picker">Switch business</button></div><button class="btn" style="margin-top:8px" data-action="logout">Sign out</button></div></aside>'+
 '<div class="workspace"><header class="topbar"><div class="row"><button class="menu-toggle" aria-label="Open navigation" data-action="menu">☰</button><div><strong>'+e(t.business_name)+'</strong><small>'+e(t.slug)+' · '+e(t.role)+'</small></div></div><button class="btn primary" data-nav="create">+ New document</button></header>'+
 '<main class="workspace-main">'+body+'</main><footer class="footer"><span>© 2026 Bizlano · Powered by Global Web Stores</span><a class="footer-parent" href="https://www.globalwebstores.com/explore" target="_blank" rel="noopener noreferrer" aria-label="Explore Global Web Stores"><span class="footer-parent-logo"><img src="https://www.globalwebstores.com/brand/global-webstores-full.png" alt="Global Web Stores official logo" width="37" height="37" loading="lazy"></span><span><strong>A Global Web Stores brand</strong><small>Explore Global Web Stores ↗</small></span></a></footer>'+
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
 const metrics=[['Total sales',curr(r.invoiced)],['Payments received',curr(r.received)],['Outstanding',curr(r.outstanding)],['Customers',r.customers]];
 return heading('BUSINESS OVERVIEW','Welcome to '+state.biz.business_name,'Your most useful business tools in one place.')+
 '<div class="metrics">'+metrics.map(m=>'<div class="metric"><span>'+m[0]+'</span><strong>'+m[1]+'</strong></div>').join('')+'</div>'+
 '<section class="panel quick-work"><h2>What would you like to do?</h2><div class="quick-work-grid">'+
 (edit()?'<button type="button" class="quick-tile" data-nav="create"><strong>＋ Create document</strong><span>Receipt, invoice or quote</span></button>':'')+
 '<button type="button" class="quick-tile" data-nav="documents"><strong>▤ View documents</strong><span>History and printing</span></button>'+
 (edit()?'<button type="button" class="quick-tile" data-nav="products"><strong>▥ Products & stock</strong><span>Prices and stock levels</span></button>':'')+
 (admin()?'<button type="button" class="quick-tile" data-nav="design"><strong>◈ Receipt designs</strong><span>Styles for your business</span></button>':'')+
 '</div></section>'+
 '<details class="panel tidy-details" id="sales-details"><summary><strong>Sales insights</strong><span>View charts and trends</span></summary><div class="tidy-content">'+salesChart()+'</div></details>'+
 '<details class="panel tidy-details" id="share-details"><summary><strong>Share your business page</strong><span>Customer receipt recovery link</span></summary><div class="tidy-content">'+recoveryTools()+'</div></details>';
}
function gridRows(rows,headers,fn){return '<div class="table-scroll"><table><thead><tr>'+headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(fn).join('')+'</tbody></table></div>'}
function docs(){
 const rows=state.data?.rows||[];
 return heading('RECEIPTS & INVOICES','Your business documents','Create, view and share every receipt in one place.',edit()?'<button class="btn primary" data-nav="create">+ New document</button>':'')+
 '<section class="panel"><div class="recovery-quick"><strong>Customer lost a receipt?</strong><span>Send them your recovery link.</span><button class="btn" data-action="copy-recovery">Copy link</button><button class="btn" data-action="copy-recovery-message">Copy message</button></div>'+(rows.length?gridRows(rows,['Document','Customer','Total','Status','Actions'],d=>'<tr><td><strong>'+e(d.document_number)+'</strong><br><small>'+e(d.kind)+' · '+e(d.issued_on)+'</small></td><td>'+e(d.recipient_name)+'</td><td>'+curr(d.total_minor)+'</td><td>'+e(d.status)+'</td><td><button class="btn" data-doc="'+e(d.id)+'">Preview / Print</button>'+(!['voided','draft','paid'].includes(d.status)&&edit()?'<button class="btn" data-payment="'+e(d.id)+'">Payment</button>':'')+(d.status==='draft'&&edit()?'<button class="btn" data-issue="'+e(d.id)+'">Issue</button>':'')+
 (['quotation','estimate','proforma'].includes(d.kind)&&d.status==='issued'&&edit()?'<button class="btn" data-convert="'+e(d.id)+'">Convert to invoice</button>':'')+'</td></tr>'):'<div class="empty">Your document history is empty. Create the first receipt or invoice to begin.</div>')+'</section>';
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
 '<section class="panel">'+simpleRows(rows,p=>'<div class="rowcard"><div><strong>'+e(p.document_number)+'</strong><small>'+e(p.method)+' · '+e(p.received_at)+'</small></div><div class="end"><strong>'+curr(p.amount_minor)+'</strong><button class="btn" type="button" data-payment-proof="'+e(p.id)+'">Print payment receipt</button></div></div>')+'</section>';
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
function purchases(){
 const rows=state.data?.rows||[],suppliers=(state.data?.suppliers||[]).filter(x=>!x.archived_at),
  locations=state.org.locations.filter(x=>!x.archived_at),products=state.products.filter(x=>x.track_stock),
  canWrite=['owner','admin','manager'].includes(state.biz?.role);
 const supplierChoices=suppliers.map(x=>[x.id,x.name]),locationChoices=locations.map(x=>[x.id,x.name]),productChoices=products.map(x=>[x.id,x.name]);
 const itemInput='<div class="form-grid purchase-item-row">'+
  select('Product','purchaseProduct',productChoices)+
  input('Quantity','purchaseQuantity','number','1',true,'min=".001" step=".001"')+
  input('Unit cost (₦)','purchaseCost','number','0',true,'min="0" step=".01"')+
  '<button type="button" class="btn" data-action="remove-purchase-line">Remove item</button></div>';
 return heading('PURCHASING','Suppliers & stock purchases','Manage stock deliveries and supplier purchases without mixing them with customer sales.')+
 (canWrite?'<div class="cols"><section class="panel"><h2>New supplier</h2><form data-form="supplier">'+
  input('Supplier name','name','text','',true)+input('Phone (optional)','phone')+input('Email (optional)','email','email')+
  input('Address (optional)','address')+'<button class="btn primary">Save supplier</button></form></section>'+
 '<section class="panel"><h2>New purchase order</h2>'+
 (suppliers.length&&locations.length&&products.length?
 '<form data-form="purchase">'+select('Supplier','supplierId',supplierChoices)+select('Receive at','locationId',locationChoices)+
 input('Supplier reference (optional)','reference')+'<div id="purchase-items">'+itemInput+'</div>'+
 '<button type="button" class="btn" data-action="add-purchase-line">+ Add another item</button>'+
 '<label class="field">Notes<textarea name="notes" rows="2" maxlength="400"></textarea></label>'+
 '<button class="btn primary">Save purchase order</button></form>':
 '<p class="muted">Save a supplier, location and stock-tracked product before creating a purchase order.</p>')+
 '</section></div>':'')+
 '<section class="panel"><h2>Purchase history</h2>'+simpleRows(rows,o=>
 '<div class="rowcard"><div><strong>'+e(o.supplier_name)+'</strong><small>'+e(o.location_name)+' · '+e(o.created_at)+' · '+e(o.status)+'</small>'+
 (o.supplier_reference?'<small>Reference: '+e(o.supplier_reference)+'</small>':'')+'</div>'+
 '<div class="end"><strong>'+curr(o.total_minor)+'</strong>'+
 (canWrite&&o.status==='draft'?'<button type="button" class="btn primary" data-purchase-receive="'+e(o.id)+'">Mark stock received</button><button type="button" class="btn" data-purchase-cancel="'+e(o.id)+'">Cancel</button>':'')+
 '</div></div>')+'</section>';
}

function designProfiles(){
 const rows=state.data?.rows||[],active=rows.filter(x=>!x.archived_at),arms=state.org.arms.filter(x=>!x.archived_at);
 return heading('DOCUMENT STUDIO','Saved document designs','Keep a different document identity for each business arm. All 71 designs remain available to preview.')+
 '<div class="cols"><section class="panel"><h2>Create or replace a saved design</h2><p class="muted">Use a saved profile for receipts, invoices, estimates and quotations. Replacing a profile never changes previously issued documents.</p>'+
 '<form data-form="design-profile"><input type="hidden" name="id" value="">'+
 input('Design name','name','text','',true)+
 '<label class="field">Choose design<select name="template">'+groupedTemplateOptions('signature')+'</select></label>'+
 '<div class="form-grid">'+input('Primary colour','accent','color','#6935df',true)+input('Secondary colour','secondary','color','#19223b',true)+'</div>'+
 select('Typeface','font',[['modern','Modern'],['editorial','Editorial'],['mono','Monospace'],['rounded','Rounded']])+
 input('Header message','header','text','')+
 '<label class="field">Footer message<textarea name="footer" rows="2" maxlength="260">Thank you for your business.</textarea></label>'+
 '<button class="btn primary">Save design</button></form></section>'+
 '<section class="panel"><h2>Your saved designs ('+active.length+')</h2>'+
 simpleRows(rows,x=>'<div class="rowcard"><div><strong>'+e(x.name)+'</strong><small>'+e(templateTitle(x.template))+(x.archived_at?' · Archived':'')+'</small></div>'+
 (!x.archived_at?'<div class="row"><button type="button" class="btn" data-edit-profile="'+e(x.id)+'">Edit</button><button type="button" class="btn" data-archive-profile="'+e(x.id)+'">Archive</button></div>':'')+'</div>')+
 '</section></div>'+
 '<section class="panel"><h2>Use a saved design for a business arm</h2>'+
 (active.length&&arms.length?
 '<form data-form="assign-profile"><div class="form-grid">'+select('Business arm','armId',arms.map(a=>[a.id,a.name]))+select('Saved design','profileId',active.map(p=>[p.id,p.name]))+'</div><button class="btn primary">Assign design</button></form>':
 '<p class="muted">Save a design first, then assign it to a department or brand.</p>')+
 '</section>';
}

function businessArms(){
 const rows=state.data?.rows||[];
 const active=rows.filter(x=>!x.archived_at);
 return heading('BUSINESS SETTINGS','Business arms','Manage different brands or departments under the same business without duplicating your financial records.')+
 '<div class="cols"><section class="panel"><h2>Add a business arm</h2><p class="muted">Use this for another shop department, service division or trading name belonging to the same legal business.</p>'+
 '<form data-form="arm">'+input('Department or brand name','name','text','',true)+input('Short code','slug','text','',true,'pattern="[a-z0-9-]{3,40}" placeholder="e.g. repairs"')+
 input('Document prefix','prefix','text','BZ',true,'pattern="[a-zA-Z0-9]{2,8}" maxlength="8"')+
 input('Contact phone (optional)','phone')+
 '<label class="field">Receipt footer (optional)<textarea name="footer" rows="2" maxlength="260"></textarea></label>'+
 '<button class="btn primary">Add business arm</button></form></section>'+
 '<section class="panel"><h2>Business arms ('+active.length+')</h2>'+
 simpleRows(rows,r=>'<div class="rowcard"><div><strong>'+e(r.name)+(r.is_primary?' · Main':'')+'</strong><small>'+e(r.slug)+' · Prefix '+e(r.document_prefix)+(r.archived_at?' · Archived':'')+'</small></div>'+
 (!r.is_primary&&!r.archived_at?'<button class="btn" type="button" data-action="archive-arm" data-org-id="'+e(r.id)+'">Archive</button>':'')+'</div>')+
 '</section></div>';
}
function businessLocations(){
 const rows=state.data?.rows||[];
 const active=rows.filter(x=>!x.archived_at);
 return heading('BUSINESS SETTINGS','Locations & outlets','Keep each shop, office and warehouse organized while using one business account.')+
 '<div class="cols"><section class="panel"><h2>Add a location</h2>'+
 '<form data-form="location">'+input('Location name','name','text','',true)+input('Location code','code','text','',true,'pattern="[a-zA-Z0-9-]{2,20}" maxlength="20" placeholder="e.g. IKEJA"')+
 select('Type','type',[['shop','Shop / outlet'],['warehouse','Warehouse'],['office','Office'],['service','Service base']])+
 '<label class="field">Address<input name="address" maxlength="400" placeholder="Street, city and state"></label>'+
 '<button class="btn primary">Add location</button></form></section>'+
 '<section class="panel"><h2>Your locations ('+active.length+')</h2>'+
 simpleRows(rows,r=>'<div class="rowcard"><div><strong>'+e(r.name)+(r.is_primary?' · Main':'')+'</strong><small>'+e(r.code)+' · '+e(r.type)+(r.archived_at?' · Archived':'')+'</small><small>'+e(r.address||'')+'</small></div>'+
 (!r.is_primary&&!r.archived_at?'<button type="button" class="btn" data-action="archive-location" data-org-id="'+e(r.id)+'">Archive</button>':'')+'</div>')+
 '</section></div>';
}
function locationStock(){
 const rows=state.data?.rows||[],locations=state.org.locations.filter(x=>!x.archived_at),products=state.products.filter(x=>x.track_stock);
 const opts=locations.map(x=>[x.id,x.name]),productOpts=products.map(x=>[x.id,x.name]);
 return heading('STOCK MANAGEMENT','Stock by location','Move stock between shops and warehouses while keeping total inventory accurate.')+
 '<div class="cols"><section class="panel"><h2>Transfer stock</h2><p class="muted">A transfer moves stock between two locations without recording a new sale.</p>'+
 (locations.length>1&&products.length?
 '<form data-form="stock-transfer">'+select('Product','productId',productOpts)+select('From location','fromLocationId',opts)+select('To location','toLocationId',opts)+
 input('Quantity','quantity','number','1',true,'min=".001" step=".001"')+
 input('Reason (optional)','reason')+'<button class="btn primary">Transfer stock</button></form>':
 '<p class="muted">Create another location and add a stocked product to transfer inventory.</p>')+
 '</section><section class="panel"><h2>Available stock</h2>'+
 simpleRows(rows,r=>'<div class="rowcard"><div><strong>'+e(r.product_name)+'</strong><small>'+e(r.location_name)+'</small></div><strong>'+(r.stock_milli/1000).toLocaleString('en-NG')+'</strong></div>')+
 '</section></div>';
}

function branding(){
 const biz=state.data?.business||state.biz,design=state.design||{};
 const image=(src,label)=>src?'<div class="artwork-frame"><img src="'+e(src)+'" alt="'+e(label)+'"></div>':'<div class="artwork-empty">No '+e(label.toLowerCase())+' uploaded yet</div>';
 return heading('BUSINESS IDENTITY','Your business appearance','Update your logo or add an optional document signature.')+
 '<section class="panel identity-summary"><div><strong>'+e(biz.business_name)+'</strong><p class="mini muted">Customer receipt page and brand details</p></div><div class="row"><a class="btn" href="'+e(businessHref())+'" target="_blank" rel="noopener noreferrer">View business page ↗</a><button type="button" class="btn" data-action="copy-recovery">Copy customer receipt link</button><button class="btn" type="button" data-nav="design">Document designs →</button></div></section>'+
 '<div class="cols identity-sections">'+
 '<details class="panel tidy-details" '+(!biz.logo_url?'open':'')+'><summary><strong>Business logo</strong><span>'+(biz.logo_url?'Logo uploaded · Change':'Add your business logo')+'</span></summary><div class="tidy-content"><p class="muted">A transparent PNG looks best.</p>'+
 image(biz.logo_url,'Business logo')+
 '<form data-form="logo"><label class="field">Choose your logo<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required></label>'+
 '<label class="field artwork-option"><input type="checkbox" name="removeWhite"> Remove a plain white background (optional)</label>'+
 '<div class="artwork-preview hidden" data-artwork-preview="logo"></div><button class="btn primary">Save my logo</button></form></div></details>'+
 '<details class="panel tidy-details"><summary><strong>Business signature</strong><span>Optional · Shown only when enabled</span></summary><div class="tidy-content"><p class="muted">Only use a signature you are happy to show customers.</p>'+
 image(design.signature_url,'Authorized signature')+
 '<form data-form="signature"><label class="field">Choose a signature image<input type="file" name="signature" accept="image/png,image/jpeg,image/webp" required></label>'+
 '<label class="field artwork-option"><input type="checkbox" name="removeWhite"> Remove a plain white background (optional)</label>'+
 '<div class="artwork-preview hidden" data-artwork-preview="signature"></div><button class="btn primary">Save my signature</button></form></div></details></div>';
}
function team(){
 const rows=state.data?.rows||[],arms=state.org.arms.filter(x=>!x.archived_at),locations=state.org.locations.filter(x=>!x.archived_at),editable=rows.filter(x=>!['owner','admin'].includes(x.role)&&!x.disabled_at);
 return heading('TEAM & ACCESS','Your business team','Invite colleagues, give them the right role, and choose where they can issue or view business documents.')+
 '<div class="cols"><section class="panel"><h2>Invite a colleague</h2>'+
 '<form data-form="invite">'+input('Staff email','email','email','',true)+
 select('Permission','role',[['manager','Manager'],['accountant','Accountant'],['cashier','Cashier'],['sales','Sales'],['viewer','View-only']])+
 '<button class="btn primary">Generate private invite</button></form><div id="invite-result" class="banner hidden"></div></section>'+
 '<section class="panel"><h2>Team members</h2>'+simpleRows(rows,s=>'<div class="rowcard"><div><strong>'+e(s.email)+'</strong><small>'+e(s.role)+' · '+(s.disabled_at?'Suspended':'Active')+'</small></div></div>')+'</section></div>'+
 '<section class="panel"><h2>Assign a team member to locations</h2><p class="muted">Choose the business arms and locations where a team member may issue, view and take payments for documents. Leaving a group unselected means access to every arm or location in that group. Owners and administrators always have business-wide access.</p>'+
 (editable.length?
 '<form data-form="staff-scope">'+select('Team member','userId',editable.map(x=>[x.user_id,x.email]))+
 '<details class="tidy-details" open><summary>Business arms</summary><div class="tidy-content">'+arms.map(x=>'<label class="field"><input type="checkbox" name="armScope" value="'+e(x.id)+'" style="display:inline-block;width:auto"> '+e(x.name)+'</label>').join('')+'</div></details>'+
 '<details class="tidy-details" open><summary>Locations</summary><div class="tidy-content">'+locations.map(x=>'<label class="field"><input type="checkbox" name="locationScope" value="'+e(x.id)+'" style="display:inline-block;width:auto"> '+e(x.name)+'</label>').join('')+'</div></details>'+
 '<button class="btn primary">Save assignments</button></form>':'<p class="muted">Invite a non-administrator colleague to configure assignments.</p>')+
 '</section>';
}
function syncStaffScopeForm(){
 const f=document.querySelector('form[data-form="staff-scope"]');if(!f)return;
 const rows=(state.data?.scopes||[]).filter(x=>x.user_id===val(f,'userId'));
 const allowedArms=new Set(rows.map(x=>x.arm_id).filter(Boolean));
 const allowedLocations=new Set(rows.map(x=>x.location_id).filter(Boolean));
 f.querySelectorAll('input[name="armScope"]').forEach(x=>x.checked=allowedArms.has(x.value));
 f.querySelectorAll('input[name="locationScope"]').forEach(x=>x.checked=allowedLocations.has(x.value));
}
function readLegacyBrandConfig(raw){
 if(!raw)return null;
 try{
  const payload=typeof raw==='object'?raw:JSON.parse(new TextDecoder().decode(
   Uint8Array.from(atob(String(raw).replace(/-/g,'+').replace(/_/g,'/').replace(/[^a-zA-Z0-9+/=]/g,'')),x=>x.charCodeAt(0))));
  const original=String(payload.tp||payload.template||''),key=original.startsWith('heritage-')?original:'heritage-'+original;
  if(!isHeritage(key))return null;
  const colour=String(payload.pc||payload.primaryColor||HERITAGE_TEMPLATES[key].accent);
  const secondary=String(payload.sc||payload.secondaryColor||'#19223b');
  const hex=(x,fallback)=>/^#[0-9a-fA-F]{6}$/.test(x)?x.toLowerCase():fallback;
  const font=String(payload.ff||payload.fontFamily||'modern').toLowerCase();
  const fontFamily=font.includes('mono')||font.includes('rajdhani')?'mono':font.includes('serif')||font.includes('cinzel')||font.includes('playfair')?'editorial':font.includes('poppins')?'rounded':'modern';
  return {template:key,accent:hex(colour,HERITAGE_TEMPLATES[key].accent),secondary_color:hex(secondary,'#19223b'),
   font_family:fontFamily,text_logo_style:'split'};
 }catch{return null}
}
async function findLegacyStyles(){
 if(state.legacyChecked)return;
 state.legacyChecked=true;
 if(state.biz?.role!=='owner'||!auth.currentUser?.emailVerified)return;
 try{
  const q=query(collection(oldDb,'short_urls'),where('owner_uid','==',auth.currentUser.uid),limit(20));
  const rows=await getDocs(q),styles=[];
  for(const doc of rows.docs){
   const data=doc.data();
   const settings=readLegacyBrandConfig(data.config||data.original_url?.split('#')[1]);
   if(settings)styles.push({code:doc.id,brandName:String(data.brandName||doc.id).slice(0,100),...settings});
  }
  state.legacyStyles=styles;
  if(state.view==='design'&&state.designStep===1)render();
 }catch{state.legacyStyles=[]}
}
function stageLegacyStyle(index){
 if(state.biz?.role!=='owner'||!auth.currentUser?.emailVerified)throw Error('Only the verified business owner can restore an old design');
 const record=state.legacyStyles[index];
 if(!record||!isHeritage(record.template))throw Error('Could not find that original design');
 state.templateChoice=record.template;
 state.designDraft={...activeDesign(),...record,show_logo:0};
 state.designStep=2;state.designBrowseAll=true;state.designDepartment=departmentForTemplate(record.template).id;state.designScroll=0;
 render();
 flash('Your previous '+templateTitle(record.template)+' design is ready to review. Save it to use it here.');
}

function billing(){
 const d=state.data;if(!d)return '<div class="empty">Loading your business plan…</div>';
 const money=n=>'₦'+Number(n||0).toLocaleString('en-NG');
 const periods=[['monthly','Monthly'],['quarterly','3 months'],['six_months','6 months'],['yearly','Yearly']];
 const plans=d.plans||[];
 const current=plans.find(p=>p.id===d.currentPlan),history=d.invoices||[],active=(d.subscriptions||[]).find(s=>['active','grace'].includes(s.status)&&Date.parse(s.current_period_end)>Date.now());
 const q=state.billingQuote;
 return heading('BUSINESS SETTINGS','Plans & billing','One business workspace for your documents, sales, stock and team.')+
 '<section class="panel"><h2>Current plan: '+e(current?.name||'Free')+'</h2>'+
 '<p class="muted">'+(active?'Paid access through '+e(active.current_period_end?.slice(0,10)||'your current term')+'.': 'You are using the Free workspace. No payment is required to continue.')+'</p>'+
 '<p class="mini muted">This month: '+Number(d.actual?.monthlyFinalizedTransactions||0).toLocaleString('en-NG')+' finalized business transactions · '+Number(d.actual?.arms||1)+' business arms · '+Number(d.actual?.locations||1)+' locations · '+Number(d.actual?.staff||1)+' team members.</p>'+
 (active?'<button type="button" class="btn" data-action="cancel-billing">Manage renewal</button>':'')+
 '<p class="mini muted">Previously issued receipts and your business records remain available if you change plans.</p></section>'+
 '<section class="panel"><h2>Compare a plan</h2><p class="muted">Choose a plan and payment period to preview the amount. No card or charge is required to compare.</p>'+
 '<form class="form-grid" data-form="billing-quote">'+
 select('Plan','plan',plans.filter(p=>p.id!=='free').map(p=>[p.id,p.name]),q?.plan||'standard')+
 select('Payment period','term',periods,q?.term||'monthly')+
 '<button type="submit" class="btn primary">Show price</button></form>'+
 (q?'<div class="banner"><strong>'+money(q.amountNGN)+' · '+e(periods.find(x=>x[0]===q.term)?.[1]||q.term)+'</strong><p class="mini muted">'+(q.verifiedGwsPaidVendor?'Verified Global Webstores seller benefit applied.':'Standard proposed Bizlano price.')+' This does not subscribe you automatically.</p>'+
 (d.paymentsEnabled?'<button type="button" class="btn primary" data-action="start-billing">Continue to secure payment</button>':'<p class="mini muted">Optional paid subscriptions are not open yet. You can continue using Free.</p>')+'</div>':'')+
 '</section>'+
 '<div class="cols">'+plans.map(p=>
 '<section class="panel"><h2>'+e(p.name)+(p.id==='standard'?' · Recommended':'')+'</h2>'+
 '<div class="metric" style="margin:12px 0"><span>Proposed monthly price</span><strong>'+money(p.priceNGN.monthly)+'</strong></div>'+
 '<p class="muted">'+Number(p.monthlyTransactions).toLocaleString('en-NG')+' completed business transactions per month</p>'+
 '<p class="muted">'+p.designProfiles+' saved design profiles · '+p.availableDesigns+' designs available for saving · all 71 to preview</p>'+
 '<p class="muted">'+p.staff+' team members · '+p.brands+' business arms · '+p.locations+' locations</p>'+
 '<details class="tidy-details"><summary>See all payment periods</summary><div class="tidy-content">'+periods.map(([term,label])=>
 '<p class="row"><span>'+label+'</span><strong>'+money(p.priceNGN[term])+'</strong></p>').join('')+'</div></details></section>').join('')+'</div>'+
 '<section class="panel"><h2>Payment history</h2>'+
 (history.length?simpleRows(history,h=>'<div class="rowcard"><div><strong>'+e(plans.find(p=>p.id===h.plan_id)?.name||h.plan_id||'Subscription')+'</strong><small>'+e(h.issued_at)+' · '+e(h.state)+'</small></div><strong>'+money(h.amount_minor/100)+'</strong></div>'):'<p class="muted">No subscription payments yet.</p>')+
 '</section>'+
 '<section class="panel"><h2>About the Global Webstores benefit</h2><p class="muted">Verified vendors with an active paid Global Webstores subscription can qualify for 50% off Bizlano’s monthly list price. The benefit does not stack with longer-period discounts or other vouchers.</p>'+
 '<p class="mini muted">Prices are proposed for an optional February 2027 launch, subject to final financial and security acceptance. Historical receipts remain accessible even if your plan changes.</p></section>';
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
 (state.legacyStyles.length?'<div class="legacy-design-restore"><h3>Recovered document styles</h3>'+
 state.legacyStyles.map((x,i)=>'<button type="button" class="btn" data-restore-template="'+i+'">'+e(x.brandName)+' · '+e(templateTitle(x.template))+'</button>').join('')+'</div>':'')+
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
   engines.push({code:engine.id,brandName:engine.data().brandName||engine.id,config:engine.data().config||'',receipts:receipts.docs.slice(0,250).map(x=>({id:x.id,...x.data()}))});
  }catch(err){issues.push('We could not load the receipts for '+engine.id+'. You can try your original backup.');}
 }
 state.legacyArchive={kind:'metaforge-legacy',version:1,createdAt:new Date().toISOString(),userUid:account.uid,email:account.email,engines,settings:null,local:{histories:[],metadata:{},errors:[]},issues};
 state.backupReady=false;
 state.legacyStyles=engines.map(x=>({code:x.code,brandName:x.brandName,...readLegacyBrandConfig(x.config)})).filter(x=>isHeritage(x.template));
 state.legacyChecked=true;render();
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
 state.legacyStyles=(archive.engines||[]).map(x=>({code:x.code,brandName:String(x.brandName||x.code),...readLegacyBrandConfig(x.config||x.settings)})).filter(x=>isHeritage(x.template));
 state.legacyChecked=true;
 const groups=(archive.engines||[]).map(x=>({source:'engine:'+x.code,receipts:x.receipts||[]}));
 if(includeBrowser)for(const history of archive.local?.histories||[])groups.push({source:'browser:'+history.key,receipts:history.receipts||[]});
 const all=groups.reduce((n,x)=>n+x.receipts.length,0);
 if(!all){if(state.legacyStyles.length){state.legacyArchive=archive;flash('Original receipt design found. Choose it below to continue.');render();return;}throw Error('The archive contains no readable receipts or saved designs');}
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
 state.legacyArchive=archive;state.backupReady=false;
 flash('Import complete: '+imported+' review drafts staged. '+skipped+' skipped or previously imported.');
 await navigate('documents');
}
function globalWebstores(){
 const info=state.data||{},feed=info.feed||{};
 const stat=(label,n)=>'<div class="stat"><strong>'+e(n??0)+'</strong><span>'+e(label)+'</span></div>';
 return heading('CONNECTED BUSINESS','Global Webstores + Bizlano','Link your store once to keep verified sales receipts and connected business updates organized.')+
 '<div class="cols"><section class="panel"><div class="eyebrow">YOUR STORE CONNECTION</div><h2>'+(info.connected?'Your store is connected':'Connect Global Webstores')+'</h2>'+
 (info.connected?'<div class="banner"><strong>Connected</strong><br>Since '+e(info.connectedAt||'')+'<br>'+(info.lastSaleAt?'Last receipt event: '+e(info.lastSaleAt):'No recorded paid sales yet.')+'</div>'+
 '<p class="muted">When your store sends verified events, Bizlano records receipts, catalog snapshots, delivery updates and reconciliation details. Your direct Bizlano stock stays separate.</p><button class="btn" data-action="disconnect-gws">Disconnect this store</button>':
 '<p class="muted">Open your Global Webstores vendor dashboard and choose Connect Bizlano. Generate a secure one-time code here and enter it in that dashboard. Do not share account passwords.</p>'+
 '<button class="btn primary" data-action="gws-code">Generate a secure connection code</button><div id="gws-link-result" class="banner hidden"></div>')+
 '<div style="margin-top:18px"><a href="https://www.globalwebstores.com/dashboard" class="btn" target="_blank" rel="noopener noreferrer">Open Global Webstores dashboard ↗</a></div></section>'+
 '<section class="panel"><h2>Connected business activity</h2><div class="stats" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px">'+
 stat('Synced products',feed.products)+stat('Order status updates',feed.orderUpdates)+stat('Refund records',feed.refunds)+stat('Payout records',feed.settlements)+'</div>'+
 '<p class="muted">Figures show recorded events, not payments initiated by Bizlano. Refund and payout records are kept for reconciliation; they do not silently change issued receipts.</p><div class="stack">'+
 '<div class="rowcard"><span><strong>Verified orders</strong><small>Receipts are prepared only from signed paid-order events.</small></span></div>'+
 '<div class="rowcard"><span><strong>Products and fulfilment</strong><small>Connected catalog and order progress stay visible separately.</small></span></div>'+
 '<div class="rowcard"><span><strong>Financial reconciliation</strong><small>Refund and payout events are recorded without double-counting sales.</small></span></div></div></section></div>';
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
 const design=activeDesign(),sector=businessCategory(state.designIndustry||state.biz?.industry||'general');
 const current=state.templateChoice||design.template||'signature',step=state.designStep;
 const chosenDepartment=departmentById(state.designBrowseAll?state.designDepartment:departmentForIndustry(sector.id));
 const head=heading('RECEIPT DESIGNS','Find a style for your business','Browse full receipt layouts, choose your colours and font, then save your design.')+
  guidedSteps(['Your business','Choose a design','Make it yours','Finish'],step);
 const back=step>1?'<button class="btn" type="button" data-action="design-back">← Back</button>':'';
 const next=caption=>'<div class="wizard-actions">'+back+'<button class="btn primary" type="button" data-action="design-next">'+caption+' →</button></div>';
 if(step===1)return head+'<section class="panel guided-panel"><div class="eyebrow">STEP 1 OF 4</div><h2>What kind of business do you run?</h2>'+
  '<p class="muted">Choose your business type. We will show suitable receipt designs first. You can also see every design.</p>'+
  '<label class="field">Business type<select data-business-category>'+BUSINESS_TYPES.map(v=>'<option value="'+e(v.id)+'" '+(sector.id===v.id?'selected':'')+'>'+e(v.name)+'</option>').join('')+'</select></label>'+
  (state.legacyStyles.length?'<div class="legacy-design-restore"><h3>Your saved designs from the previous website</h3><p class="mini muted">Choose one to use it again. Your existing documents will stay unchanged.</p>'+
   state.legacyStyles.map((x,i)=>'<button type="button" class="btn" data-restore-template="'+i+'">'+e(x.brandName)+' · '+e(templateTitle(x.template))+'</button>').join('')+'</div>':'')+
  next('See designs')+'</section>';
 if(step===2){
  const choices=chosenDepartment.templates;
  const selectedInCategory=choices.includes(current);
  const cards=choices.map(id=>{
   const theme=templateArt(id),active=current===id;
   return '<article class="design-card real-template studio-slide '+(active?'selected':'')+'" data-style-id="'+e(id)+'">'+
   '<div class="template-thumbnail"><div class="template-thumbnail-inner '+(isHeritage(id)?'heritage-thumb':'modern-thumb')+'">'+sampleHtml(id,true)+'</div></div>'+
   '<div class="studio-card-info"><span class="design-card-color" style="background:'+e(theme.accent)+'"></span><div><strong>'+e(templateTitle(id))+'</strong><small>'+e(isHeritage(id)?(HERITAGE_TEMPLATES[id].group+' design'):(theme.note||'Business design'))+'</small></div></div>'+
   '<div class="studio-card-actions"><button type="button" class="btn '+(active?'primary':'')+'" data-template="'+e(id)+'">'+(active?'✓ Selected':'Use this design')+'</button>'+
   '<button type="button" class="btn" data-preview-template="'+e(id)+'">See full receipt</button></div></article>';
  }).join('');
  const index=STUDIO_DEPARTMENTS.findIndex(x=>x.id===chosenDepartment.id);
  const tabs=state.designBrowseAll?
   '<div class="studio-department-heading"><div><strong>Choose a category</strong><small>Each category has its own receipt designs. Select any one to browse.</small></div><button type="button" class="btn" data-action="studio-recommended">Show my business designs</button></div>'+
   '<div class="studio-department-tabs" role="group" aria-label="Receipt design categories">'+STUDIO_DEPARTMENTS.map(dep=>
    '<button type="button" class="studio-department-tab '+(dep.id===chosenDepartment.id?'active':'')+'" data-design-department="'+e(dep.id)+'" aria-pressed="'+(dep.id===chosenDepartment.id)+'">'+e(dep.name)+' <span>'+dep.templates.length+'</span></button>').join('')+'</div>':
   '<div class="studio-explore-note"><span>Want a different style? All '+templateCatalogCount+' designs are available.</span><button class="btn" type="button" data-action="studio-explore">Explore all '+templateCatalogCount+' designs →</button></div>';
  const changeDepartment=state.designBrowseAll?
    '<div class="studio-department-switch"><button type="button" class="btn" data-action="studio-previous-department" '+(index===0?'disabled':'')+'>← Previous category</button>'+
    '<span>Category '+(index+1)+' of '+STUDIO_DEPARTMENTS.length+'</span><button type="button" class="btn" data-action="studio-next-department" '+(index===STUDIO_DEPARTMENTS.length-1?'disabled':'')+'>Next category →</button></div>':'';
  return head+'<section class="panel guided-panel"><div class="eyebrow">STEP 2 OF 4</div>'+
   '<div class="studio-intro"><div><h2>'+(state.designBrowseAll?e(chosenDepartment.name):'For '+e(sector.name))+'</h2>'+
   '<p class="muted">'+e(chosenDepartment.description)+'. Browse the designs below, then choose the one you like.</p></div></div>'+
   tabs+'<div class="studio-carousel-head"><strong>'+chosenDepartment.templates.length+' receipt designs</strong><div class="studio-arrows"><button class="btn" type="button" data-action="studio-prev" aria-label="Previous receipts">←</button><button class="btn" type="button" data-action="studio-next" aria-label="Next receipts">→</button></div></div>'+
   '<div class="design-grid studio-carousel" id="studio-designs" role="region" aria-label="'+e(chosenDepartment.name)+' receipt designs" tabindex="0">'+cards+'</div>'+
   changeDepartment+
   '<p class="studio-selected-summary" aria-live="polite">Your choice: <strong>'+e(templateTitle(current))+'</strong>'+(selectedInCategory?'':' <span>(from another category)</span>')+'</p>'+
   next('Choose colours and font')+'</section>'+
   '<div class="studio-full-preview hidden" id="studio-preview-modal" role="dialog" aria-modal="true" aria-label="Full receipt preview"><div class="studio-modal-inner">'+
   '<div class="studio-modal-head"><strong id="studio-modal-title">See your receipt</strong><button class="btn" type="button" data-action="studio-close-preview">Close ✕</button></div>'+
   '<div id="studio-modal-receipt"></div></div></div>';
 }
 if(step===3){
  const accent=design.accent||templateArt(current).accent,secondary=design.secondary_color||'#19223b';
  return head+'<section class="panel guided-panel"><div class="eyebrow">STEP 3 OF 4</div><h2>Choose your colours, font and business name style</h2>'+
   '<p class="muted">Keep your chosen receipt layout and make it feel like your business.</p>'+
   '<div class="studio-choice-layout"><form data-form="design" class="design-custom-fields">'+
   '<div class="form-grid"><label class="field">Main colour<input type="color" name="accent" value="'+e(accent)+'"></label>'+
   '<label class="field">Second colour<input type="color" name="secondaryColor" value="'+e(secondary)+'"></label></div>'+
   '<div class="studio-colour-panel">'+colourStoryChooser(accent)+'</div>'+
   '<div class="form-grid">'+select('Lettering style','fontFamily',FONT_STYLES,design.font_family||'modern')+
   select('Business name style','textLogoStyle',TEXT_LOGO_STYLES,design.text_logo_style||'split')+
   select('Paper size','paper',[['a4','A4 paper'],['letter','Letter paper'],['80mm','80mm receipt roll'],['58mm','58mm receipt roll']],design.paper||'a4')+
   input('Business contact details','contact','text',design.contact||'')+
   input('Message at the top (optional)','headerNote','text',design.header_note||'')+
   input('Thank-you message','footerNote','text',design.footer_note||'Thank you for your business.')+'</div>'+
   '<label class="field inline-check"><input type="checkbox" name="showLogo" '+(design.show_logo?'checked':'')+'> Use my uploaded logo (optional)</label>'+
   '<p class="mini muted">No image logo? Your business name will appear as a styled text logo. You can <button class="text-link-button" type="button" data-nav="branding">add a logo</button> at any time.</p>'+
   '<label class="field inline-check"><input type="checkbox" name="showSignature" '+(design.show_signature?'checked':'')+'> Add my business signature (optional)</label>'+
   next('Review my receipt')+'</form><div class="studio-preview-sticky"><strong>Your receipt preview</strong><div id="studio-live-preview">'+sampleHtml(current)+'</div></div></div></section>';
 }
 const d={...design,template:current},hidden=(n,v)=>'<input type="hidden" name="'+n+'" value="'+e(v??'')+'">';
 return head+'<section class="panel guided-panel studio-complete"><div class="eyebrow">STEP 4 OF 4</div>'+
 '<h2>Your finished receipt design</h2><p class="muted">Review the layout, lettering and colours. Your real customer details will appear when you create a receipt.</p>'+
 '<div class="studio-final-summary"><strong>'+e(templateTitle(current))+'</strong><span>Chosen colours: '+e(d.accent)+' and '+e(d.secondary_color||'#19223b')+' · '+e(d.font_family||'modern')+'</span></div>'+
 '<div class="studio-final-preview">'+sampleHtml(current)+'</div>'+
 '<form data-form="design">'+hidden('accent',d.accent)+hidden('secondaryColor',d.secondary_color||'#19223b')+hidden('fontFamily',d.font_family||'modern')+
 hidden('textLogoStyle',d.text_logo_style||'split')+hidden('paper',d.paper||'a4')+hidden('contact',d.contact||'')+
 hidden('headerNote',d.header_note||'')+hidden('footerNote',d.footer_note||'Thank you for your business.')+
 '<input type="checkbox" name="showLogo" hidden '+(d.show_logo?'checked':'')+'><input type="checkbox" name="showSignature" hidden '+(d.show_signature?'checked':'')+'>'+
 '<div class="wizard-actions">'+back+'<button class="btn primary" type="submit">Save my receipt design ✓</button></div></form></section>';
}

function refreshStudioPreview(){const target=document.getElementById('studio-live-preview');if(target)target.innerHTML=sampleHtml(state.templateChoice||activeDesign().template||'signature');}
function alerts(){
 const rows=state.data?.rows||[];
 return heading('BUSINESS UPDATES','Your receipts are ready','See receipts prepared from business activity and share them with customers.')+
 '<section class="panel">'+(rows.length?rows.map(n=>'<div class="rowcard"><div><strong>'+e(n.title)+'</strong><small>'+e(n.body||'')+' · '+e(n.created_at)+'</small></div><div class="row">'+(!n.read_at?'<button class="btn" data-read-alert="'+e(n.id)+'">Mark read</button>':'<span class="mini muted">Read</span>')+
 (n.document_id?'<button class="btn primary" data-doc="'+e(n.document_id)+'">Open receipt</button>':'')+'</div></div>').join(''):'<div class="empty">No new receipt updates. When a connected sale is completed, its prepared receipt will appear here.</div>')+'</section>';
}
function docEditor(){
 const options=state.biz.role==='cashier'?[['receipt','Sales receipt'],['cash-sale','Cash sale'],['service-receipt','Service receipt'],['thermal-receipt','Thermal POS']]:
 [['receipt','Sales receipt'],['invoice','Sales invoice'],['quotation','Quotation'],['estimate','Estimate'],['proforma','Proforma'],['purchase-order','Purchase order'],['delivery-note','Delivery note'],['credit-note','Credit note'],['debit-note','Debit note'],['retail-receipt','Retail receipt'],['service-receipt','Service receipt'],['tax-invoice','Tax invoice'],['thermal-receipt','Thermal POS']];
 const step=state.docStep||1;
 const panel=(n,content)=>'<section class="doc-step" data-doc-panel="'+n+'" '+(n!==step?'hidden':'')+'>'+content+'</section>';
 const forward='<button class="btn primary" type="button" data-action="doc-next">Continue →</button>';
 const back='<button class="btn" type="button" data-action="doc-back">← Back</button>';
 return heading('CREATE DOCUMENT','Make a new receipt or invoice','Just four short steps. You can review everything before issuing.')+
 guidedSteps(['Document','Customer','Items','Review'],step)+
 '<div class="editor guided-editor"><section class="panel editor-form"><form data-form="document">'+
 panel(1,'<div class="eyebrow">STEP 1 OF 4</div><h2>What would you like to create?</h2>'+
 '<div class="form-grid">'+select('Document type','kind',options)+input('Issue date','date','date',today(),true)+
 input('Due date (optional)','dueDate','date')+
 '<label class="field">Receipt design<select name="template" aria-label="Receipt design">'+groupedTemplateOptions(state.design?.template||'signature')+'</select></label></div>'+ 
 '<div class="form-grid">'+select('Business arm','armId',state.org.arms.filter(x=>!x.archived_at).map(x=>[x.id,x.name]))+
 select('Sale location','locationId',state.org.locations.filter(x=>!x.archived_at).map(x=>[x.id,x.name]))+'</div>'+
 '<div class="form-grid">'+select('Saved document design','profileId',[['','Business default'],...state.org.profiles.filter(p=>!p.archived_at).map(p=>[p.id,p.name])])+'</div>'+
 '<p class="mini muted">The receipt will use this exact style. Change your business default any time in Document Studio.</p>'+
 '<div class="wizard-actions">'+forward+'</div>')+
 panel(2,'<div class="eyebrow">STEP 2 OF 4</div><h2>Who is this for?</h2>'+
 input('Customer or recipient','customer','text','Walk-in customer',true)+
 '<div class="form-grid">'+input('Customer email','customerEmail','email','',false,'autocomplete="off" placeholder="customer@example.com"')+
 input('Customer phone','customerPhone','tel','',false,'inputmode="tel" placeholder="080… or +234…"')+'</div>'+
 '<p class="mini muted" id="contact-help">Add an email or phone when issuing. A customer with a private receipt code can recover their document later.</p>'+
 '<div class="wizard-actions">'+back+forward+'</div>')+
 panel(3,'<div class="eyebrow">STEP 3 OF 4</div><h2>What did the customer buy?</h2>'+
 '<datalist id="products-data">'+state.products.map(p=>'<option value="'+e(p.name)+'"></option>').join('')+'</datalist>'+
 '<div id="lines">'+state.items.map((i,n)=>lineHtml(i,n)).join('')+'</div>'+
 '<button class="btn ghost" type="button" data-action="add-line">+ Add another item</button>'+
 '<div class="wizard-actions">'+back+forward+'</div>')+
 panel(4,'<div class="eyebrow">STEP 4 OF 4</div><h2>Review charges & finish</h2>'+
 '<div class="form-grid">'+input('Discount (%)','discountPct','number','0',false,'min="0" max="100" step=".01"')+
 input('VAT / Tax (%)','taxPct','number','0',false,'min="0" max="100" step=".01"')+
 input('Other charges (₦)','shipping','number','0',false,'min="0" step=".01"')+
 input('Received (₦)','received','number','0',false,'min="0" step=".01"')+'</div>'+
 select('Payment method','method',[['Bank transfer','Bank transfer'],['Cash','Cash'],['POS terminal','POS terminal'],['Other','Other']])+
 '<label class="field">Notes (optional)<textarea name="notes" rows="2" maxlength="1800" placeholder="Terms, delivery or thank-you message">Thank you for your business.</textarea></label>'+
 '<div class="row"><button class="btn ghost" type="button" data-edit-notes>Expand notes</button></div>'+
 '<p class="mini muted">For a paid receipt, enter the amount actually received. For unpaid sales, choose Invoice instead. Save as draft if you are not ready.</p>'+
 '<div class="wizard-actions">'+back+'<button type="submit" class="btn" data-document-action="draft">Save draft</button><button type="submit" class="btn primary" data-document-action="issue">Save and issue</button></div>')+
 '</form></section>'+
 '<aside class="receipt-stage guided-preview"><details class="preview-fold" '+(step===4?'open':'')+'><summary>Actual document preview <span>Click to '+(step===4?'hide':'view')+'</span></summary><div id="preview"></div></details><button class="btn" type="button" data-action="print-preview" style="margin-top:13px">Print / Save PDF</button></aside></div>'+
 editorDialog();
}
function setDocStep(target){
 const form=document.querySelector('[data-form=document]');if(!form)return;
 const current=state.docStep||1;
 if(target>current){
  const panel=form.querySelector('[data-doc-panel="'+current+'"]');
  for(const field of panel.querySelectorAll('input[required],textarea[required],select[required]')){
   if(!field.checkValidity()){field.reportValidity();field.focus();return}
  }
  if(current===3){
   const items=currentDoc()?.items||[];
   const problem=items.some(x=>!x.description.trim()||!(x.qty>0)||x.price<0||!Number.isFinite(x.price));
   if(problem){flash('Add an item description, quantity and valid price before continuing.',true);return}
  }
 }
 state.docStep=Math.max(1,Math.min(4,target));
 form.querySelectorAll('[data-doc-panel]').forEach(panel=>panel.hidden=Number(panel.dataset.docPanel)!==state.docStep);
 document.querySelectorAll('.wizard-step').forEach((el,i)=>{el.classList.toggle('current',i+1===state.docStep);el.classList.toggle('done',i+1<state.docStep)});
 const preview=document.querySelector('.preview-fold');if(preview)preview.open=state.docStep===4;
 drawPreview();
 document.querySelector('.wizard-steps')?.scrollIntoView({behavior:'instant',block:'start'});
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
 return {kind:val(f,'kind'),date:val(f,'date'),dueDate:val(f,'dueDate'),template:val(f,'template'),armId:val(f,'armId'),locationId:val(f,'locationId'),profileId:val(f,'profileId'),convertFrom:state.pendingConversion||null,customer:val(f,'customer'),customerEmail:val(f,'customerEmail'),customerPhone:val(f,'customerPhone'),items,discountPct:Number(val(f,'discountPct')||0),taxPct:Number(val(f,'taxPct')||0),shipping:Number(val(f,'shipping')||0),received:Number(val(f,'received')||0),method:val(f,'method'),notes:val(f,'notes')};
}

// The original August 19 MetaForge document structure, adapted to Bizlano's tenant-scoped,
// read-only, escaped receipt model. No legacy Firebase writes or editor handlers are copied.
function heritageReceipt(doc,number,stored=false,style=state.design){
 const id=String(doc.template||style?.template||'heritage-modern-tech');
 const meta=HERITAGE_TEMPLATES[id];
 if(!meta)return '';
 const company=String(style?.business_name||state.biz?.business_name||'Business');
 const logo=style?.show_logo===0?'':(style?.logo_url||state.biz?.logo_url||state.data?.business?.logo_url||'');
 const primary=/^#[0-9a-fA-F]{6}$/.test(style?.accent||'')?style.accent:meta.accent;
 const secondary=meta.secondary||'#1a1a1a',note=style?.footer_note||'Thank you for your business.';
 const invoice=String(doc.kind||'receipt').replace(/-/g,' ').toUpperCase();
 const rows=(doc.items||[]).filter(x=>x.description).map((x,i)=>
  '<tr><td>'+(i+1)+'</td><td>'+e(x.description)+'</td><td>'+e(x.qty)+'</td><td>'+oldMoney(x.price)+'</td><td>'+oldMoney(Number(x.price)*Number(x.qty))+'</td></tr>').join('');
 const sub=(doc.items||[]).reduce((a,x)=>a+((Number(x.price)||0)*(Number(x.qty)||0)),0);
 const discount=Math.round(sub*(Number(doc.discountPct)||0))/100;
 const vat=Math.round((sub-discount)*(Number(doc.taxPct)||0))/100;
 const total=stored?doc.total_minor/100:sub-discount+vat+Number(doc.shipping||0);
 const paid=doc.received??(stored?doc.paid_minor/100:0);
 const balance=Math.max(0,total-Number(paid||0));
 const logoMarkup=logo?'<img src="'+e(logo)+'" alt="Business logo" class="heritage-logo">':'';
 const brand='<div class="brand-block">'+logoMarkup+'<div class="brand-name">'+stylizedCompanyName(company,style?.text_logo_style||'split')+'</div>'+
  (style?.header_note?'<div class="brand-tagline">'+e(style.header_note)+'</div>':'')+
  (style?.contact?'<div class="brand-contact">'+e(style.contact)+'</div>':'')+'</div>';
 const badge='<div class="doc-type-badge">'+e(invoice)+'</div>';
 const header='<header class="receipt-header"><div class="header-content">'+brand+badge+'</div><div class="header-accent"></div></header>';
 const info='<section class="info-section"><div class="info-block"><span class="info-label">CUSTOMER / CLIENT</span><strong>'+e(doc.customer||doc.recipient_name||'Walk-in customer')+'</strong>'+
 (doc.customerEmail||doc.recipient_email?'<span>'+e(doc.customerEmail||doc.recipient_email)+'</span>':'')+
 (doc.customerPhone||doc.recipient_phone?'<span>'+e(doc.customerPhone||doc.recipient_phone)+'</span>':'')+
 '</div><div class="info-block"><span class="info-label">DOCUMENT NUMBER</span><strong>'+e(number||'UNSAVED DRAFT')+'</strong><span>'+e(doc.date||doc.issued_on||today())+'</span></div></section>';
 const itemTable='<section class="items-section"><div class="section-header"><div class="section-line"></div><div class="section-title">Items & services</div><div class="section-line"></div></div>'+
 '<table class="items-table"><thead><tr><th>NO.</th><th>ITEM DESCRIPTION</th><th>QTY</th><th>PRICE</th><th>AMOUNT</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
 const summary='<div class="bottom-section"><div class="words-section"><div class="words-box"><div class="words-label">Document details</div>'+
 '<span>'+e(doc.notes||note)+'</span></div></div><div class="totals-section"><div class="totals-box">'+
 '<div class="total-row"><span class="total-label">Subtotal</span><span class="total-value">'+oldMoney(sub)+'</span></div>'+
 (discount?'<div class="total-row"><span class="total-label">Discount</span><span class="total-value">'+oldMoney(discount)+'</span></div>':'')+
 (vat?'<div class="total-row"><span class="total-label">Tax</span><span class="total-value">'+oldMoney(vat)+'</span></div>':'')+
 (Number(doc.shipping)>0?'<div class="total-row"><span class="total-label">Other charges</span><span class="total-value">'+oldMoney(doc.shipping)+'</span></div>':'')+
 '<div class="total-row"><span class="total-label">TOTAL</span><span class="total-value grand">'+oldMoney(total)+'</span></div>'+
 '<div class="total-row"><span class="total-label">Received</span><span class="total-value">'+oldMoney(paid)+'</span></div>'+
 '<div class="total-row"><span class="total-label">Balance</span><span class="total-value">'+oldMoney(balance)+'</span></div></div></div></div>';
 const isPaid=total>0&&Number(paid)>=total;
 const status=doc.draft===true||doc.status==='draft'?'DRAFT':isPaid?'PAID':Number(paid)>0?'PART PAID':'ISSUED';
 const signature=style?.show_signature&&style?.signature_url?'<img class="signature-img heritage-signed" src="'+e(style.signature_url)+'" alt="Authorized business signature">':'';
 const signatures='<section class="signature-section"><div class="signature-box"><div class="signature-line"></div><div class="signature-label">Customer signature</div></div>'+
 '<div class="signature-box"><div class="digital-stamp"><div class="stamp-outer"><div class="stamp-inner"></div><div class="stamp-content"><div class="stamp-status">'+status+'</div><div class="stamp-divider"></div><div class="stamp-date">'+e(doc.date||doc.issued_on||today())+'</div></div></div></div>'+
 signature+'<div class="signature-line"></div><div class="signature-label">Authorized signature</div></div></section>';
 const recCode=doc.recoveryCode?'<div class="heritage-recovery">PRIVATE RECOVERY CODE: <strong>'+e(doc.recoveryCode)+'</strong></div>':'';
 const footer='<div class="footer-message"><div class="message-text">'+e(note)+'</div></div>'+
 '<footer class="receipt-footer"><div class="footer-brand">'+e(company)+'</div><div class="footer-contact">'+e(style?.contact||'Official business document')+'</div></footer>'+
 recCode+'<div class="powered-by-footer">Powered by <strong class="powered-link">Bizlano</strong> · Your business, beautifully managed.</div>';
 const swiss=id==='heritage-swiss-design';
 const content=(swiss?'':header)+info+itemTable+summary+signatures+footer;
 const body=swiss?'<aside class="heritage-rail"><span class="brand-name">'+stylizedCompanyName(company,style?.text_logo_style||'plain')+'</span><span class="doc-type-badge">'+e(invoice)+'</span></aside>'+
 '<div class="heritage-main">'+logoMarkup+content+'</div>':content;
 return '<article class="legacy-receipt receipt-container tpl-'+e(id.slice(9))+'" style="'+(style?.font_family?'font-family:'+e(fontCssName(style.font_family))+';':'')+'--brand-primary:'+e(primary)+';--brand-secondary:'+e(style?.secondary_color||secondary)+';--brand-dark:'+e(secondary)+';--brand-gray:#586275;--brand-light:#f8f7f4;--tpl-primary:'+e(primary)+';--tpl-secondary:'+e(style?.secondary_color||secondary)+'" data-template-id="'+e(id)+'">'+body+'</article>';
}

function receipt(doc,number,stored=false,style=state.design){
 if(isHeritage(doc.template||style?.template))return heritageReceipt(doc,number,stored,style);
 const lines=doc.items||[];
 let subtotal=0;
 const rows=lines.filter(i=>i.description).map(i=>{
  const lineTotal=Number(i.price)*Number(i.qty);subtotal+=lineTotal;
  return '<tr><td>'+e(i.description)+'</td><td>'+e(i.qty)+'</td><td>'+oldMoney(lineTotal)+'</td></tr>';
 }).join('');
 const discount=Math.round(subtotal*(Number(doc.discountPct)||0))/100;
 const vat=Math.round((subtotal-discount)*(Number(doc.taxPct)||0))/100;
 const total=stored?doc.total_minor/100:subtotal-discount+vat+Number(doc.shipping||0);
 const template=String(doc.template||style?.template||'signature'),art=templateArt(template);
 const logo=style?.show_logo===0?'':(style?.logo_url||state.biz.logo_url||state.data?.business?.logo_url||'');
 const accent=/^#[0-9a-fA-F]{6}$/.test(style?.accent||'')?style.accent:art.accent;
 const paper=style?.paper||'a4',contact=style?.contact||'',headerNote=style?.header_note||'',footerNote=style?.footer_note||'';
 const company=String(style?.business_name||state.biz?.business_name||'Business'),initials=company.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 const documentType=String(doc.kind||'Invoice').replaceAll('-',' ').toUpperCase(),documentNumber=number||'UNSAVED DRAFT';
 const head='<div class="r-head"><div class="r-brand"><div class="r-brand-identity">'+(logo?'<img class="receipt-logo" src="'+e(logo)+'" alt="Business logo">':'<span class="r-initials" aria-hidden="true">'+e(initials)+'</span>')+
  '<div class="r-brand-name"><span class="r-overline">BUSINESS DOCUMENT</span><h2>'+stylizedCompanyName(company,style?.text_logo_style||'split')+'</h2><div class="r-small">'+e(headerNote||'Official business document')+'</div>'+(contact?'<div class="r-small">'+e(contact)+'</div>':'')+'</div></div></div>'+
  '<div class="r-document-identity"><span class="r-doc-kicker">DOCUMENT</span><h3>'+e(documentType)+'</h3><div class="r-small r-document-number">'+e(documentNumber)+'</div></div></div>';
 return '<article class="receipt style-'+e(template)+' receipt-layout-'+e(art.layout)+' paper-'+e(paper)+'" id="printable" style="font-family:'+e(fontCssName(style?.font_family||'modern'))+';--receipt-accent:'+e(accent)+';--receipt-ink:'+e(style?.secondary_color||'#26324c')+'">'+
 '<div class="r-design-strip" aria-hidden="true"><i></i><i></i><i></i></div>'+head+
 '<div class="r-section"><div><strong>Issued to</strong><div class="r-small">'+e(doc.customer||doc.recipient_name||'Walk-in')+'</div>'+
 (doc.customerEmail||doc.recipient_email?'<div class="r-small">'+e(doc.customerEmail||doc.recipient_email)+'</div>':'')+
 (doc.customerPhone||doc.recipient_phone?'<div class="r-small">'+e(doc.customerPhone||doc.recipient_phone)+'</div>':'')+
 '</div><div><strong>Issued on</strong><div class="r-small">'+e(doc.date||doc.issued_on||today())+'</div></div></div>'+
 '<div class="r-table-wrap"><table><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<div class="r-total"><div><span>Subtotal</span><strong>'+oldMoney(subtotal)+'</strong></div><div><span>Discount</span><strong>'+oldMoney(discount)+'</strong></div><div><span>Tax</span><strong>'+oldMoney(vat)+'</strong></div><div class="grand"><span>Total</span><span>'+oldMoney(total)+'</span></div><div><span>Received</span><strong>'+oldMoney(doc.received??(stored?doc.paid_minor/100:0))+'</strong></div></div>'+
 '<p class="r-small r-notes">'+e(doc.notes||footerNote||'Thank you for your business.')+'</p>'+
 (style?.show_signature&&style?.signature_url?'<div class="r-signature"><img src="'+e(style.signature_url)+'" alt="Authorized signature"><small>Authorized signatory</small></div>':'')+
 (doc.recoveryCode?'<div class="r-recovery"><strong>Receipt recovery code</strong><div class="r-recovery-code">'+e(doc.recoveryCode)+'</div><small>Keep this private. Recover a lost receipt at '+e(new URL('/receipts',location.origin).toString())+'</small></div>':'')+
 '<div class="powered">Powered by <strong>Bizlano</strong> · Your business, beautifully managed.</div></article>';
}
function drawPreview(){
 const div=document.getElementById('preview');if(!div)return;
 const d=currentDoc();if(d){state.items=d.items;div.innerHTML=receipt(d,'PREVIEW');}
}
const PAPER_CHOICES=[
 ['a4','A4 · office printer'],
 ['letter','Letter · office printer'],
 ['80mm','80 mm · receipt printer'],
 ['58mm','58 mm · compact receipt printer']
];
function applyPrintPaper(paper){
 const chosen=PAPER_CHOICES.some(x=>x[0]===paper)?paper:'a4';
 state.printPaper=chosen;
 document.body.classList.remove('print-roll-80mm','print-roll-58mm','print-sheet-a4','print-sheet-letter');
 document.body.classList.add(chosen==='80mm'?'print-roll-80mm':chosen==='58mm'?'print-roll-58mm':chosen==='letter'?'print-sheet-letter':'print-sheet-a4');
 const rules={
  a4:'@page { size: A4; margin: 12mm; }',
  letter:'@page { size: letter; margin: 12mm; }',
  '80mm':'@page { size: 80mm 297mm; margin: 3mm; }',
  '58mm':'@page { size: 58mm 297mm; margin: 2.5mm; }'
 };
 let node=document.getElementById('bizlano-print-page-size');
 if(!node){node=document.createElement('style');node.id='bizlano-print-page-size';document.head.appendChild(node)}
 node.textContent=rules[chosen];
 return chosen;
}
function printDocument(){
 if(state.view==='create'&&state.docStep!==4){flash('Review your document before printing.',true);return}
 if(!document.querySelector('#preview .receipt, #preview .legacy-receipt')){flash('Open a document to print.',true);return}
 applyPrintPaper(state.printPaper||state.design?.paper||'a4');
 document.body.classList.toggle('print-unsaved',state.view==='create');
 window.print();
}
document.addEventListener('afterprint',()=>document.body.classList.remove('print-unsaved'));
function printOptions(){
 const selected=state.printPaper||state.design?.paper||'a4';
 return '<section class="print-options panel"><div class="print-options-main"><div><strong>Print your document</strong><p class="mini muted">Choose the paper size, then select your printer or Save as PDF.</p></div>'+
 '<label class="field print-paper-field">Paper size<select data-print-paper aria-label="Printer paper size">'+PAPER_CHOICES.map(([value,label])=>'<option value="'+value+'" '+(selected===value?'selected':'')+'>'+e(label)+'</option>').join('')+'</select></label>'+
 '<button type="button" class="btn primary" data-action="print-preview">Print / Save PDF</button></div>'+
 '<details class="print-help"><summary>Using a Bluetooth, USB, Wi-Fi or POS printer?</summary>'+
 '<p>First add or pair the printer in your phone or computer settings. Choose <strong>Print / Save PDF</strong>, then select that printer from the print window. For receipt-roll printers, choose the matching 80 mm or 58 mm paper size in Bizlano and your printer settings.</p>'+
 '<p class="mini muted">Some Bluetooth POS printers only work with their manufacturer’s app or driver. If yours does not appear in the print window, save the receipt as a PDF and print it using the printer’s app. Bizlano cannot automatically pair every printer.</p></details></section>';
}

function printPage(doc){
 state.view='print';
 applyPrintPaper(state.printPaper||state.design?.paper||'a4');
 const isSaved=Boolean(doc.document_number);
 const displayDoc=isSaved?doc:{...doc,unsavedPreview:true,document_number:'UNSAVED PREVIEW'};
 const body=heading('DOCUMENT PREVIEW','Your printable document','Review it, choose the paper size and print or save as PDF.','<button class="btn" data-nav="documents">Back to documents</button>')+
 printOptions()+'<div class="receipt-stage printable-document" style="max-width:850px;margin:auto"><div id="preview">'+receipt(displayDoc,displayDoc.document_number,isSaved,doc.design_snapshot_json?JSON.parse(doc.design_snapshot_json):state.design)+'</div></div>';
 shell(body);
}

function render(){
 if(!state.user||!state.user.emailVerified||!state.me){loginScreen();return}
 if(!state.biz){businessPicker();return}
 const views={overview,documents:docs,customers,products,payments,expenses,targets,arms:businessArms,locations:businessLocations,locationStock,purchases,designProfiles,team,branding,design:designStudio,alerts,gws:globalWebstores,billing,upgrade,create:docEditor};
 const fn=views[state.view]||overview;
 shell(fn());
 if(state.view==='team')syncStaffScopeForm();
 if(state.view==='create')drawPreview();
}
async function navigate(view){
 closeMenu();state.view=view;state.items=[{description:'',qty:1,price:0,productId:''}];if(view==='create'){state.docStep=1;state.pendingConversion=null}else state.pendingConversion=null;if(view==='design'){state.designStep=1;state.designDraft=null;state.templateChoice=null;state.designIndustry=null;state.designBrowseAll=false;state.designDepartment=null;state.designScroll=0;}
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
 if(el.dataset.business){const selected=state.me?.businesses.find(b=>b.slug===el.dataset.business);if(!selected)throw Error('Business is no longer available');state.biz=selected;state.billingQuote=null;await navigate('overview');return}
 if(action==='toggle-auth'){state.authMode=state.authMode==='register'||state.authMode==='forgot'?'login':'register';state.resetToken=null;render();return}
 if(el.dataset.editProfile){
  const p=state.data?.rows?.find(x=>x.id===el.dataset.editProfile);const form=document.querySelector('[data-form=design-profile]');if(!p||!form)throw Error('Saved design no longer available');
  for(const [k,v] of Object.entries({id:p.id,name:p.name,template:p.template,accent:p.accent,secondary:p.secondary_color,font:p.font_family,header:p.header_note,footer:p.footer_note})){const field=form.elements.namedItem(k);if(field)field.value=v||''}
  form.scrollIntoView({behavior:'smooth',block:'start'});return;
 }
 if(el.dataset.archiveProfile){
  if(!confirm('Archive this design? Documents already issued will not change.'))return;
  await api('/b/'+state.biz.slug+'/design-profiles',{action:'archive',id:el.dataset.archiveProfile});flash('Design archived.');await navigate('designProfiles');return;
 }
 if(action==='start-billing'){
  if(!state.billingQuote)throw Error('Choose your plan and payment period first');
  const r=await api('/b/'+state.biz.slug+'/billing/checkout',{plan:state.billingQuote.plan,term:state.billingQuote.term});
  window.location.assign(r.checkoutUrl);return;
 }
 if(action==='cancel-billing'){
  if(!confirm('Stop any future automatic renewal? Your paid-through access will remain.'))return;
  await api('/b/'+state.biz.slug+'/billing/cancel',{});flash('Renewal setting updated.');await navigate('billing');return;
 }
 if(action==='add-purchase-line'){
  const items=document.getElementById('purchase-items'),first=items?.querySelector('.purchase-item-row');
  if(!items||!first)throw Error('Open purchase order editor first');
  if(items.children.length>=50)throw Error('A purchase order may contain 50 items');
  const clone=first.cloneNode(true);
  clone.querySelectorAll('input').forEach(x=>x.value=x.name==='purchaseQuantity'?'1':'0');
  items.appendChild(clone);return;
 }
 if(action==='remove-purchase-line'){
  const items=document.getElementById('purchase-items');
  if(items?.children.length>1)el.closest('.purchase-item-row')?.remove();
  return;
 }
 if(el.dataset.purchaseReceive||el.dataset.purchaseCancel){
  const receive=Boolean(el.dataset.purchaseReceive),id=el.dataset.purchaseReceive||el.dataset.purchaseCancel;
  if(!confirm(receive?'Confirm stock has physically arrived at the selected location?':'Cancel this unfinished purchase order?'))return;
  await api('/b/'+state.biz.slug+'/purchases',{action:receive?'receive':'cancel',id});
  flash(receive?'Stock received and inventory updated.':'Purchase cancelled.');await navigate('purchases');return;
 }
 if(action==='archive-arm'||action==='archive-location'){
  if(!confirm('Archive this item? Historical documents will remain available.'))return;
  await api('/b/'+state.biz.slug+(action==='archive-arm'?'/arms':'/locations'),{action:'archive',id:el.dataset.orgId});
  flash('Archived.');await navigate(action==='archive-arm'?'arms':'locations');return;
 }
 if(action==='copy-recovery'){await copyShareText(recoveryHref());return}
 if(action==='copy-recovery-message'){await copyShareText(recoveryMessage());return}
 if(action==='menu'){toggleMenu();return}
 if(action==='picker'){state.biz=null;render();return}
 if(action==='logout'){await api('/logout',{});if(auth.currentUser)await signOut(auth);state.user=null;state.pendingEmail=null;state.me=null;state.biz=null;render();return}
 if(action==='resend'){await api('/account/resend',{email:state.pendingEmail});flash('If your account needs verification, a new email will arrive.');return}
 if(action==='retry-connect'){state.connectError='';await attach();return}
 if(action==='refresh'){const result=await api('/account/session');state.user=result.user;if(!state.user)throw Error('Open the verification link sent to your email.');state.pendingEmail=null;await attach();return}
 if(action==='reset'){state.authMode='forgot';render();return}
 if(el.dataset.restoreTemplate!==undefined){stageLegacyStyle(Number(el.dataset.restoreTemplate));return}
 if(action==='design-next'){if(state.designStep<4){captureDesignForm();state.designStep++;render();window.scrollTo(0,0);}return}
 if(action==='design-back'){if(state.designStep>1){if(state.designStep!==4)captureDesignForm();state.designStep--;render();window.scrollTo(0,0);}return}
 if(action==='studio-explore'){state.designBrowseAll=true;state.designDepartment=departmentForTemplate(state.templateChoice||activeDesign().template).id;state.designScroll=0;render();return}
 if(action==='studio-recommended'){state.designBrowseAll=false;state.designDepartment=null;state.designScroll=0;render();return}
 if(action==='studio-previous-department'||action==='studio-next-department'){
  const active=state.designDepartment||departmentForIndustry(state.designIndustry),index=STUDIO_DEPARTMENTS.findIndex(x=>x.id===active);
  const nextIndex=Math.max(0,Math.min(STUDIO_DEPARTMENTS.length-1,index+(action==='studio-next-department'?1:-1)));
  state.designDepartment=STUDIO_DEPARTMENTS[nextIndex].id;state.designScroll=0;render();return;
 }
 if(el.dataset.designDepartment){state.designBrowseAll=true;state.designDepartment=el.dataset.designDepartment;state.designScroll=0;render();return}
 if(action==='studio-prev'||action==='studio-next'){const scroller=document.getElementById('studio-designs');if(scroller){scroller.scrollBy({left:(action==='studio-next'?1:-1)*Math.max(280,scroller.clientWidth*.76),behavior:'smooth'});state.designScroll=scroller.scrollLeft;}return}
 if(action==='studio-close-preview'){document.getElementById('studio-preview-modal')?.classList.add('hidden');return}
 if(el.dataset.previewTemplate){const modal=document.getElementById('studio-preview-modal');if(modal){document.getElementById('studio-modal-title').textContent=templateTitle(el.dataset.previewTemplate);document.getElementById('studio-modal-receipt').innerHTML=sampleHtml(el.dataset.previewTemplate);modal.classList.remove('hidden');modal.querySelector('button')?.focus();}return}
 if(action==='doc-next'){setDocStep(state.docStep+1);return}
 if(action==='doc-back'){setDocStep(state.docStep-1);return}
 if(el.dataset.template){
  state.designScroll=document.getElementById('studio-designs')?.scrollLeft||0;
  captureDesignForm();state.templateChoice=el.dataset.template;setDesignColour(templateArt(state.templateChoice).accent);
  render();const track=document.getElementById('studio-designs');if(track)track.scrollLeft=state.designScroll;return;
 }
 if(el.dataset.designColor){setDesignColour(el.dataset.designColor);render();return}
 if(el.dataset.accent){const field=document.querySelector('[data-form=design] [name=accent]');if(field){field.value=el.dataset.accent;captureDesignForm();refreshStudioPreview();}return}
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
 if(action==='print-preview'){printDocument();return}
 if(el.dataset.paymentProof){
  const t='/b/'+state.biz.slug;
  const created=await api(t+'/payment-confirmations',{paymentId:el.dataset.paymentProof});
  const receipt=(await api(t+'/payment-confirmation/'+created.id)).receipt;
  printPage(receipt);return;
 }
 if(el.dataset.convert){
  const original=(await api('/b/'+state.biz.slug+'/doc/'+el.dataset.convert)).document;
  await navigate('create');
  state.pendingConversion=original.id;
  state.items=(original.items||[]).map(x=>({...x}));
  const f=document.querySelector('form[data-form="document"]');
  if(!f)throw Error('Unable to open document editor');
  const fields={kind:'invoice',customer:original.recipient_name,customerEmail:original.recipient_email||'',customerPhone:original.recipient_phone||'',armId:original.arm_id||state.biz.id,locationId:original.location_id||state.biz.id,template:original.template};
  for(const [name,value] of Object.entries(fields)){const el=f.elements.namedItem(name);if(el&&value)el.value=value}
  const lines=document.getElementById('lines');if(lines)lines.innerHTML=state.items.map((item,n)=>lineHtml(item,n)).join('');
  flash('Quotation loaded. Review the invoice before issuing it.');drawPreview();return;
 }
 if(el.dataset.doc){const [d,settings]=await Promise.all([api('/b/'+state.biz.slug+'/doc/'+el.dataset.doc),api('/b/'+state.biz.slug+'/design')]);state.design=settings.design;printPage(d.document);return}
 if(el.dataset.payment){const value=prompt('Amount actually received in ₦');if(value===null)return;await api('/b/'+state.biz.slug+'/payments',{documentId:el.dataset.payment,amount:Number(value),method:'Manual'});flash('Payment recorded.');await navigate('documents');return}
 if(el.dataset.issue){if(!confirm('Issue this draft? Issued documents cannot be edited.'))return;await api('/b/'+state.biz.slug+'/issue',{documentId:el.dataset.issue});flash('Draft issued.');await navigate('documents');return}
 }catch(err){flash(err.message,true)}
});
document.addEventListener('input',ev=>{
 if(ev.target.matches('[data-design-custom-color]')){
  setDesignColour(ev.target.value);
  const panel=document.querySelector('.studio-receipt-preview .full-receipt-sample');
  if(panel)panel.innerHTML=sampleHtml(state.templateChoice||state.design?.template||'signature');
  return;
 }
 if(ev.target.closest('[data-form=document]'))drawPreview();
 if(ev.target.closest('[data-form=design]')){captureDesignForm();refreshStudioPreview()}
});
document.addEventListener('change',ev=>{
 if(ev.target.closest('[data-form=document]')&&['armId','profileId'].includes(ev.target.name)){
  const form=ev.target.closest('[data-form=document]'),chosen=ev.target.name==='armId'?state.org.arms.find(x=>x.id===val(form,'armId'))?.design_profile_id:val(form,'profileId');
  if(ev.target.name==='armId')form.elements.namedItem('profileId').value=chosen||'';
  const profile=state.org.profiles.find(p=>p.id===chosen);
  if(profile)form.elements.namedItem('template').value=profile.template;
  drawPreview();return;
 }
 if(ev.target.closest('[data-form="staff-scope"]')&&ev.target.name==='userId'){syncStaffScopeForm();return}
 if(ev.target.matches('[data-print-paper]')){applyPrintPaper(ev.target.value);return}
 if(ev.target.matches('[data-design-custom-color]')){setDesignColour(ev.target.value);render();return}
 if(ev.target.matches('[data-business-category]')){state.designIndustry=ev.target.value;state.designBrowseAll=false;state.designDepartment=null;state.designScroll=0;state.templateChoice=departmentById(departmentForIndustry(ev.target.value)).templates[0];setDesignColour(templateArt(state.templateChoice).accent);return}
 if(ev.target.closest('[data-form=design]')){captureDesignForm();refreshStudioPreview()}
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
document.addEventListener('invalid',ev=>{
 const panel=ev.target.closest('[data-doc-panel]');
 if(panel){const number=Number(panel.dataset.docPanel);if(number!==state.docStep)setDocStep(number)}
},true);
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
  if(kind==='supplier'){await api(t+'/suppliers',{name:val(form,'name'),phone:val(form,'phone'),email:val(form,'email'),address:val(form,'address')});flash('Supplier saved.');await navigate('purchases');state.busy=false;return}
  if(kind==='purchase'){
   const items=[...form.querySelectorAll('.purchase-item-row')].map(row=>({
    productId:row.querySelector('[name=purchaseProduct]')?.value,
    quantity:Number(row.querySelector('[name=purchaseQuantity]')?.value),
    unitCost:Number(row.querySelector('[name=purchaseCost]')?.value)
   }));
   await api(t+'/purchases',{action:'create',supplierId:val(form,'supplierId'),locationId:val(form,'locationId'),reference:val(form,'reference'),notes:val(form,'notes'),items});
   flash('Purchase order saved. Mark stock received only when it arrives.');await navigate('purchases');state.busy=false;return;
  }
  if(kind==='staff-scope'){
    const userId=val(form,'userId'),locations=[...form.querySelectorAll('input[name="locationScope"]:checked')].map(x=>x.value),arms=[...form.querySelectorAll('input[name="armScope"]:checked')].map(x=>x.value);
    await api(t+'/staff-scopes',{userId,locations,arms});flash('Staff assignments saved.');await navigate('team');state.busy=false;return;
  }
  if(kind==='billing-quote'){
    state.billingQuote=await api(t+'/billing/quote',{plan:val(form,'plan'),term:val(form,'term')});
    render();flash('Here is your proposed plan price.');state.busy=false;return;
  }
  if(kind==='design-profile'){
    await api(t+'/design-profiles',{action:val(form,'id')?'update':'create',id:val(form,'id')||undefined,name:val(form,'name'),template:val(form,'template'),accent:val(form,'accent'),secondary:val(form,'secondary'),font:val(form,'font'),header:val(form,'header'),footer:val(form,'footer')});
    flash('Saved design updated.');await navigate('designProfiles');state.busy=false;return;
  }
  if(kind==='assign-profile'){
    await api(t+'/design-profiles',{action:'assign',armId:val(form,'armId'),profileId:val(form,'profileId')});
    flash('Business arm design updated.');await navigate('designProfiles');state.busy=false;return;
  }
  if(kind==='arm'){await api(t+'/arms',{name:val(form,'name'),slug:val(form,'slug'),prefix:val(form,'prefix'),phone:val(form,'phone'),footer:val(form,'footer')});flash('Business arm added.');await navigate('arms');return}
  if(kind==='location'){await api(t+'/locations',{name:val(form,'name'),code:val(form,'code'),type:val(form,'type'),address:val(form,'address')});flash('Location added.');await navigate('locations');return}
  if(kind==='stock-transfer'){const fromLocationId=val(form,'fromLocationId'),toLocationId=val(form,'toLocationId');if(fromLocationId===toLocationId)throw Error('Choose two different locations');await api(t+'/stock-transfer',{productId:val(form,'productId'),fromLocationId,toLocationId,quantity:Number(val(form,'quantity')),reason:val(form,'reason')});flash('Stock transferred.');await navigate('locationStock');return}
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
    captureDesignForm();const template=state.templateChoice||state.design?.template||'signature';
    await api(t+'/design',{template,industry:state.designIndustry||'general',accent:val(form,'accent'),secondaryColor:val(form,'secondaryColor'),fontFamily:val(form,'fontFamily'),textLogoStyle:val(form,'textLogoStyle'),paper:val(form,'paper'),contact:val(form,'contact'),headerNote:val(form,'headerNote'),footerNote:val(form,'footerNote'),showLogo:form.elements.namedItem('showLogo').checked,showSignature:form.elements.namedItem('showSignature').checked});
    state.templateChoice=null;state.designDraft=null;state.designStep=1;flash('Your document design is saved for this business.');await navigate('design');state.busy=false;return;
  }
  if(kind==='logo'||kind==='signature'){
    await uploadBusinessArtwork(form,kind,state.biz.slug);
    flash(kind==='logo'?'Your business logo is ready.':'Your signature was uploaded. Enable it in the Document studio if you want it visible on receipts.');
    await navigate('branding');state.busy=false;return;
  }
  if(kind==='invite'){const r=await api(t+'/invite',{email:val(form,'email'),role:val(form,'role')});const box=document.getElementById('invite-result');box.textContent='Invite link (share privately): '+r.url;box.classList.remove('hidden');flash('Invitation generated. Copy the private link.');state.busy=false;return}
  if(kind==='document'){
   const b=currentDoc();b.draft=documentMode==='draft';
   if(!b.draft&&!b.customerEmail&&!b.customerPhone){setDocStep(2);document.querySelector('[data-form=document] [name=customerEmail]')?.focus();throw Error('Add a customer email or phone number before issuing this document')}
   if(!b.draft&&['receipt','cash-sale','retail-receipt','service-receipt','thermal-receipt'].includes(b.kind)&&!(b.received>0)){document.querySelector('[data-form=document] [name=received]')?.focus();throw Error('Enter the amount paid to issue a receipt, or select Invoice for an unpaid sale')}
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
  if(state.user){state.connectError='';await attach();
   const reference=params.get('reference')||params.get('trxref');
   if(state.biz&&params.get('billing')==='verify'&&reference){
    try{await api('/b/'+state.biz.slug+'/billing/verify',{reference});flash('Payment verified. Your plan has been updated.');await navigate('billing')}
    catch(error){flash(error.message||'Payment is awaiting confirmation. Check billing history before retrying.',true)}
    finally{history.replaceState(null,'','/app?biz='+encodeURIComponent(state.biz.slug))}
   }
  }
  else loginScreen();
 }catch(err){state.me=null;state.connectError=err.message||'Sign-in was not completed';flash(state.connectError,true);loginScreen();}
}
nativeBoot();
