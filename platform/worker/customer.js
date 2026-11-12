const root=document.getElementById('customer-app'),modal=document.getElementById('modal'),toast=document.getElementById('toast');
const params=new URL(location.href).searchParams;
const state={user:null,account:null,receipts:[],filter:'',business:params.get('business')||'',mode:params.get('mode')==='register'?'register':params.get('mode')==='forgot'?'forgot':'login',pendingEmail:null,resetToken:null,busy:false,error:'',current:null,nextCursor:null,printPaper:'a4'};
const escape=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cash=(value,currency='NGN')=>new Intl.NumberFormat('en-NG',{style:'currency',currency,currencyDisplay:'narrowSymbol',maximumFractionDigits:2,minimumFractionDigits:2}).format(Number(value||0)/100);
const date=s=>{const value=new Date(String(s).slice(0,10)+'T12:00:00Z');return Number.isFinite(value.getTime())?value.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):String(s||'')};
const statusName=x=>x==='paid'?'Paid':x==='part_paid'?'Partially paid':x==='issued'?'Issued':String(x||'');
function notice(message,error=false){
 toast.textContent=message;toast.hidden=false;toast.style.background=error?'#a12e48':'#222348';
 clearTimeout(notice.timeout);notice.timeout=setTimeout(()=>{toast.hidden=true},5000);
}
async function request(path,data){
 const controller=new AbortController(),auth=path.startsWith('/account/')||path==='/logout';
 const timer=setTimeout(()=>controller.abort(),path==='/account/session'?6500:auth?14000:30000);
 try{
  const r=await fetch('/api'+path,{credentials:'same-origin',cache:'no-store',signal:controller.signal,...(data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})});
  const json=await r.json().catch(()=>null);
  if(!r.ok)throw Error(json?.error||'Please try again later');
  return json;
 }catch(err){if(err?.name==='AbortError')throw Error('Connection timed out. Please try again.');throw err}
 finally{clearTimeout(timer)}
}
function loginView(){
 const pending=Boolean(state.pendingEmail),register=state.mode==='register',phoneRegister=state.mode==='phone-register',forgot=state.mode==='forgot',reset=Boolean(state.resetToken);
 let form='';
 if(reset)form='<p class="muted">Create a new password of at least 10 characters.</p><form id="customer-auth" class="stack"><label class="field">New password<input type="password" name="password" required minlength="10" autocomplete="new-password"></label><button class="button primary" type="submit">Update password and continue</button></form><button class="button" data-action="return-to-signin" style="margin-top:12px">Already updated? Sign in</button>';
 else if(pending)form='<p>We sent a secure verification link to <strong>'+escape(state.pendingEmail)+'</strong>. Open it to confirm your account.</p><div class="stack"><button class="button primary" data-action="resend-verification">Resend verification email</button><button class="button" data-action="check-verification">I have verified</button><button class="button" data-action="sign-out">Use another account</button></div>';
 else if(forgot)form='<p class="muted">Enter your account email. If it exists, we will send a password reset link.</p><form id="customer-auth" class="stack"><label class="field">Email address<input name="identifier" type="email" required autocomplete="email"></label><button class="button primary" type="submit">Email reset link</button></form><button class="button" data-action="toggle-auth" style="margin-top:15px">Back to sign in</button>';
 else{
  const fields=(register||phoneRegister?'<label class="field">Full name<input name="name" required maxlength="120" autocomplete="name"></label>':'')+
   (phoneRegister?'<label class="field">Phone number<input name="phone" type="tel" required autocomplete="tel" placeholder="080… or +234…"></label><label class="field">Private receipt code<input name="code" required maxlength="30" autocomplete="off" placeholder="BZ-XXXXXX-XXXXXX-XXXXXX-XXXXXX"></label>':'<label class="field">Email address'+(register?'':' or phone number')+'<input name="identifier" type="text" required autocomplete="username" placeholder="you@example.com"></label>');
  form='<p class="muted">'+(phoneRegister?'Create a phone-only account using a valid paid receipt recovery code.':register?'Create a free account using an email address you can verify.':'Sign in to securely access receipts from participating businesses.')+'</p><form id="customer-auth" class="stack">'+fields+'<label class="field">Password<input type="password" name="password" required minlength="'+(phoneRegister||register?'10':'6')+'" autocomplete="'+(register||phoneRegister?'new-password':'current-password')+'"></label><button class="button primary" type="submit">'+(phoneRegister?'Create phone account':register?'Register for free':'Sign in and find receipts')+'</button></form><div class="row" style="margin-top:16px"><button class="button soft" data-action="toggle-auth">'+(phoneRegister?'Use an email':register?'Already registered? Sign in':'Register for free')+'</button>'+(!phoneRegister?'<button class="button" data-action="phone-registration">Phone + receipt code</button><button class="button" data-action="reset-password">Forgot password?</button>':'')+'</div>';
 }
 root.innerHTML='<div class="auth-root"><section class="auth-story"><div><div class="eyebrow" style="color:#c3b4ff">YOUR PURCHASES, ALL TOGETHER</div><h1>Your receipts.<br>One account.<br>Every business.</h1><p>Find, view and save receipts from participating stores using your secure Bizlano account.</p></div><p>Receipt history and PDF saving are free.</p></section><section class="panel auth-card"><div class="eyebrow">MY RECEIPTS</div><h2>'+(reset?'Reset your password':pending?'Check your email':forgot?'Password recovery':phoneRegister?'Create phone account':register?'Create your account':'Find your receipts')+'</h2>'+form+'<div class="notice">Receipts are private. A verified email or a valid private receipt code is needed to recover a purchase.</div>'+(state.error?'<div class="notice error" role="alert">'+escape(state.error)+'</div>':'')+'</section></div>';
}
function customerView(){
 const all=state.receipts,needle=state.filter.toLowerCase().trim();
 const filtered=all.filter(x=>(!state.business||x.slug===state.business)&&(!needle||[x.business_name,x.items_summary,x.document_number,x.kind].some(y=>String(y||'').toLowerCase().includes(needle))));
 const stores=new Set(all.map(x=>x.slug));
 const heading=state.business?'Receipts from '+(all.find(x=>x.slug===state.business)?.business_name||state.business):'Every receipt, in one place.';
 root.innerHTML='<section class="hero"><div class="eyebrow">MY RECEIPTS</div><div class="spread"><div><h1>'+escape(heading)+'</h1><p>Signed in as <strong>'+escape(state.account.email||state.account.phone||state.account.name)+'</strong>. '+(state.account.phoneOnly?'Add receipts using the private code provided by the business.':'Your receipts appear here when a business uses this email.')+'</p></div><button class="button" data-action="sign-out">Sign out</button></div></section>'+
 '<section class="dashboard"><div class="stats">'+
 '<div class="stat"><strong>'+all.length+'</strong><span>Receipts available</span></div>'+
 '<div class="stat"><strong>'+stores.size+'</strong><span>Businesses in your history</span></div>'+
 '<div class="stat"><strong>Free</strong><span>Access and PDF saving</span></div></div>'+
 '<div class="toolbar"><input id="search-receipts" type="search" placeholder="Find a store, item or receipt number" value="'+escape(state.filter)+'" aria-label="Search your receipts">'+
 (state.business?'<button class="button soft" data-action="all-receipts">Show all businesses</button>':'')+'</div>'+
 '<div class="section-head"><div><h2>Purchase history</h2><small>'+filtered.length+' matching receipts</small></div></div>'+
 (filtered.length?'<div class="receipt-grid">'+filtered.map(x=>'<article class="receipt-card">'+
 '<div class="merchant"><span class="merchant-icon" aria-hidden="true">'+escape((x.business_name||'B')[0].toUpperCase())+'</span><div><strong>'+escape(x.business_name)+'</strong><small>'+escape(date(x.issued_on))+'</small></div></div>'+
 '<div class="receipt-meta">Receipt '+escape(x.document_number)+' · '+escape(statusName(x.status))+'</div>'+
 '<div class="receipt-desc">'+escape(x.items_summary||'Purchase receipt')+'</div>'+
 '<div class="spread"><strong class="receipt-total">'+escape(cash(x.total_minor,x.currency||'NGN'))+'</strong><button class="button primary" data-receipt="'+escape(x.id)+'">View / Save PDF</button></div>'+
 '</article>').join('')+'</div>':
 '<div class="empty"><h3>No matching receipts yet</h3><p>'+((!all.length)?'Missing a receipt? Use its private code below, or contact the business.':'Try searching for another store or product.')+'</p></div>')+
 (state.nextCursor?'<div class="row" style="justify-content:center;margin:24px 0"><button class="button" data-action="load-more">Load more receipts</button></div>':'')+
 '<section class="panel" style="margin-top:30px"><div class="eyebrow">ANOTHER WAY TO RECOVER</div><h2>Have a receipt recovery code?</h2><p class="muted" style="font-size:13px">Some older purchases or cash sales may not have an email attached. If a business gave you a Bizlano receipt code, enter it to securely add the receipt to this account.</p>'+
 '<form id="claim-code" class="claim"><label class="field">Receipt code<input name="code" spellcheck="false" autocomplete="off" required maxlength="30" placeholder="BZ-XXXXXX-XXXXXX-XXXXXX-XXXXXX"></label><button class="button primary" type="submit">Add receipt</button></form></section>'+
 '<div class="notice">Your purchase history is private. A name or phone number alone cannot open another customer’s receipts. Ask the issuing business for a private recovery code if it only recorded your phone number.</div>'+ 
 '<section class="panel" style="margin-top:25px"><div class="eyebrow">MY ACCOUNT</div><h2>Contact details</h2><p class="muted" style="font-size:12px">'+(state.account.phoneOnly?'Your phone number is your sign-in identifier. Changing it needs fresh receipt verification.':'An optional phone number helps you sign in with your password. It does not automatically unlock purchases tied to that number.')+'</p><form id="customer-profile" class="stack"><label class="field">Your name<input name="name" maxlength="120" value="'+escape(state.account.name||'')+'" required autocomplete="name"></label><label class="field">Phone number (optional)<input type="tel" name="phone" autocomplete="tel" inputmode="tel" value="'+escape(state.account.phone||'')+'" '+(state.account.phoneOnly?'readonly':'')+' placeholder="080… or +234…"></label><button class="button" type="submit">Save my details</button></form></section></section>';
}
function receiptDocument(r){
 const total=Number(r.totalMinor||0),paid=Number(r.paidMinor||0);
 const accent=/^#[0-9a-fA-F]{6}$/.test(r.storeColor||'')?r.storeColor:'#6634df';
 return '<article class="document" id="customer-print" style="--accent:'+accent+'">'+
 '<div class="document-header" style="border-bottom-color:var(--accent)"><div>'+(r.storeLogo?'<img src="'+escape(r.storeLogo)+'" alt="Store logo">':'')+
 '<strong style="display:block">'+escape(r.store)+'</strong><small>Official purchase record</small></div><div style="text-align:right"><h2>'+escape(r.kind?.replace(/-/g,' ').toUpperCase()||'RECEIPT')+'</h2><small>'+escape(r.documentNumber)+'</small></div></div>'+
 '<div class="document-details"><div><small>ISSUED TO</small><strong>'+escape(r.customer)+'</strong><div>'+escape(r.email||'')+'</div></div><div><small>ISSUED ON</small><strong>'+escape(date(r.date))+'</strong><div>'+escape(statusName(r.status))+'</div></div></div>'+
 '<table><thead><tr><th>PRODUCT / SERVICE</th><th>QTY</th><th>AMOUNT</th></tr></thead><tbody>'+
 r.items.map(x=>'<tr><td>'+escape(x.description)+'</td><td>'+escape(x.qty)+'</td><td>'+escape(cash(x.lineTotalMinor,r.currency))+'</td></tr>').join('')+'</tbody></table>'+
 '<div class="total-line"><span>Total</span><span>'+escape(cash(total,r.currency))+'</span></div>'+
 '<div class="total-line" style="font:700 12px DM Sans;color:#6b7892"><span>Amount received</span><span>'+escape(cash(paid,r.currency))+'</span></div>'+
 (paid<total?'<p style="font-size:11px;color:#996d33">Remaining balance: '+escape(cash(total-paid,r.currency))+'</p>':'')+
 (r.recoveryCode?'<div style="margin:20px 0;padding:12px;border:1px dashed #d2c7f3;border-radius:8px;font-size:11px"><strong>Receipt recovery code</strong><div style="font-family:monospace;font-weight:800;letter-spacing:.7px;margin-top:6px">'+escape(r.recoveryCode)+'</div><small>Keep this code private.</small></div>':'')+
 '<div class="document-footer"><div>Thank you for your purchase.</div><strong>Powered by Bizlano</strong><div style="margin-top:5px">'+escape(new URL('/receipts',location.origin).href)+'</div></div></article>';
}
const CUSTOMER_PAPER=[['a4','A4'],['letter','Letter'],['80mm','80 mm roll'],['58mm','58 mm roll']];
function setCustomerPaper(value){
 const paper=CUSTOMER_PAPER.some(x=>x[0]===value)?value:'a4';
 state.printPaper=paper;
 document.body.classList.remove('customer-print-roll-80mm','customer-print-roll-58mm');
 if(paper==='80mm'||paper==='58mm')document.body.classList.add('customer-print-roll-'+paper);
 const sheets={a4:'@page{size:A4;margin:12mm}',letter:'@page{size:letter;margin:12mm}',
  '80mm':'@page{size:80mm 297mm;margin:3mm}', '58mm':'@page{size:58mm 297mm;margin:2.5mm}'};
 let node=document.getElementById('customer-print-paper-size');
 if(!node){node=document.createElement('style');node.id='customer-print-paper-size';document.head.appendChild(node)}
 node.textContent=sheets[paper];
}

function showReceipt(r){
 state.current=r;
 modal.hidden=false;
 modal.innerHTML='<div class="drawer"><div class="drawer-inner" role="dialog" aria-modal="true" aria-label="Receipt preview"><div class="spread modal-actions"><div><h3>Receipt preview</h3><small>Print on paper or save as PDF</small></div><div class="row"><label class="customer-print-choice">Paper<select data-receipt-paper aria-label="Receipt paper size">'+CUSTOMER_PAPER.map(([id,title])=>'<option value="'+id+'" '+(state.printPaper===id?'selected':'')+'>'+title+'</option>').join('')+'</select></label><button class="button primary" data-action="print-receipt">Print / Save PDF</button><button class="button" data-action="close-receipt">Close</button></div></div>'+
 '<details class="customer-printer-help"><summary>Using a Bluetooth or POS printer?</summary><p>Pair or install it in your device settings, then select it in the Print window. Choose the matching paper roll size above. Some POS printers need their own app or driver.</p></details>'+
 receiptDocument(r)+'</div></div>';
 document.body.style.overflow='hidden';
 modal.querySelector('[data-action="close-receipt"]')?.focus();
}
function closeReceipt(){
 modal.hidden=true;modal.innerHTML='';state.current=null;document.body.style.overflow='';
}
async function loadCustomerReceipts(){
 const result=await request('/customer/receipts');state.receipts=result.rows||[];state.nextCursor=result.nextCursor||null;state.error='';customerView();
}
async function connect(){
 const active=await request('/account/session');
 if(!active.user)throw Error('Your session has expired. Sign in again.');
 state.user=active.user;
 state.account=await request('/customer/me');
 await loadCustomerReceipts();
}
document.addEventListener('click',async event=>{
 const target=event.target.closest('button');
 if(!target)return;
 const action=target.dataset.action;
 try{
  if(target.dataset.receipt){
   target.disabled=true;
   try{const result=await request('/customer/receipts/'+target.dataset.receipt);showReceipt(result.receipt)}
   finally{target.disabled=false}
   return;
  }
  if(action==='close-receipt'){closeReceipt();return}
  if(action==='print-receipt'){setCustomerPaper(state.printPaper);window.print();return}
  if(action==='all-receipts'){state.business='';history.replaceState(null,'','/receipts');customerView();return}
  if(action==='load-more'&&state.nextCursor){const r=await request('/customer/receipts?cursor='+encodeURIComponent(state.nextCursor));const existing=new Set(state.receipts.map(x=>x.id));state.receipts.push(...(r.rows||[]).filter(x=>!existing.has(x.id)));state.nextCursor=r.nextCursor||null;customerView();return}
  if(action==='toggle-auth'){state.mode=state.mode==='login'?'register':'login';state.pendingEmail=null;state.resetToken=null;state.error='';history.replaceState(null,'','/receipts?mode='+state.mode);loginView();return}
  if(action==='phone-registration'){state.mode='phone-register';state.error='';loginView();return}
  if(action==='check-verification'){await connect();state.pendingEmail=null;return}
  if(action==='resend-verification'){await request('/account/resend',{email:state.pendingEmail,audience:'customer'});notice('If verification is still needed, a new link will arrive.');return}
  if(action==='reset-password'){state.mode='forgot';state.error='';history.replaceState(null,'','/receipts?mode=forgot');loginView();return}
  if(action==='return-to-signin'){state.resetToken=null;state.mode='login';state.pendingEmail=null;state.error='';history.replaceState(null,'','/receipts?mode=login');loginView();return}
  if(action==='sign-out'){closeReceipt();await request('/logout',{});state.user=null;state.pendingEmail=null;state.account=null;state.receipts=[];state.error='';state.resetToken=null;state.mode='login';history.replaceState(null,'','/receipts?mode=login');loginView();return}
  if(action==='retry'){await connect();return}
 }catch(error){state.error=error.message||'Something went wrong';notice(state.error,true);if(!state.account)loginView()}
});
document.addEventListener('change',event=>{if(event.target.matches('[data-receipt-paper]'))setCustomerPaper(event.target.value)});
document.addEventListener('input',event=>{
 if(event.target.id==='search-receipts'){
  const focused=event.target,at=focused.selectionStart;
  state.filter=focused.value;
  customerView();
  const replacement=document.getElementById('search-receipts');
  replacement?.focus();
  try{replacement?.setSelectionRange(at,at)}catch{}
 }
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)closeReceipt()});
document.addEventListener('submit',async event=>{
 const form=event.target;
 if(!['customer-auth','claim-code','customer-profile'].includes(form.id))return;
 event.preventDefault();
 if(state.busy)return;
 state.busy=true;
 const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
 try{
  if(form.id==='customer-auth'){
   const password=form.elements.namedItem('password')?.value||'';
   if(state.resetToken){
    await request('/account/reset',{token:state.resetToken,password});
    state.resetToken=null;state.mode='login';state.pendingEmail=null;state.error='';
    history.replaceState(null,'','/receipts');
    notice('Password updated. Opening your receipts.');
    try{await connect()}catch(error){state.account=null;state.user=null;state.error='Password updated. Sign in with your new password.';loginView()}
   }else if(state.mode==='forgot'){
    await request('/account/reset-request',{email:form.elements.namedItem('identifier').value.trim(),audience:'customer'});
    state.mode='login';loginView();notice('If this account exists, a reset email will arrive.');
   }else if(state.mode==='phone-register'){
    const phone=form.elements.namedItem('phone').value.trim(),name=form.elements.namedItem('name').value.trim(),code=form.elements.namedItem('code').value.trim();
    await request('/customer/phone-register',{name,phone,code,password});
    await connect();notice('Your customer account is ready.');
   }else{
    const identifier=form.elements.namedItem('identifier').value.trim();
    if(state.mode==='register'){
     const name=form.elements.namedItem('name').value.trim();
     if(!identifier.includes('@'))throw Error('Enter an email address you can verify.');
     await request('/account/register',{email:identifier,name,password,audience:'customer'});
     state.pendingEmail=identifier;loginView();notice('Check your email for the verification link.');
    }else{
     if(identifier.includes('@'))await request('/account/login',{email:identifier,password});
     else await request('/customer/phone-login',{phone:identifier,password});
     state.pendingEmail=null;await connect();
    }
   }
  }else if(form.id==='customer-profile'){
   const result=await request('/customer/profile',{name:form.elements.namedItem('name').value.trim(),phone:form.elements.namedItem('phone').value.trim()});
   state.account={...state.account,name:result.name,phone:result.phone};
   notice('Your contact details have been saved.');customerView();
  }else{
   const code=form.elements.namedItem('code').value.trim();
   await request('/customer/claim',{code});
   const result=await request('/customer/receipts');
   state.receipts=result.rows||[];
   state.nextCursor=result.nextCursor||null;
   notice('Receipt added to your private purchase history.');customerView();
  }
 }catch(error){state.error=error.message||'Please try again';notice(state.error,true);if(form.id==='customer-auth')loginView()}
 finally{state.busy=false;if(submit?.isConnected)submit.disabled=false}
});
async function nativeCustomerBoot(){
 // Show authentication immediately, without waiting for a network session check.
 if(!params.has('verify')&&!params.has('reset'))loginView();
 try{
  const verify=params.get('verify');
  if(verify){await request('/account/verify',{token:verify});history.replaceState(null,'','/receipts');}
  else if(params.get('reset')){state.resetToken=params.get('reset');loginView();return;}
  const active=await request('/account/session');
  if(active.user){await connect();return}
  loginView();
 }catch(err){state.error=err.message||'Unable to open your receipts';loginView();}
}
nativeCustomerBoot();
