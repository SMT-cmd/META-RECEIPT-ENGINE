import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,reload,signOut,updateProfile} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';

const app=initializeApp({
 apiKey:'AIzaSyAElgJBP-F322zoJ-T1qeE48s2ka0EcEvw',
 authDomain:'metaforge-6afdf.firebaseapp.com',
 projectId:'metaforge-6afdf',
 appId:'1:261172077627:web:cb3cec74be2dbcb1d6281e'
});
const auth=getAuth(app),root=document.getElementById('customer-app'),modal=document.getElementById('modal'),toast=document.getElementById('toast');
const params=new URL(location.href).searchParams;
const state={user:null,account:null,receipts:[],filter:'',business:params.get('business')||'',mode:params.get('mode')==='register'?'register':'login',busy:false,error:'',current:null,nextCursor:null};
const escape=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cash=(value,currency='NGN')=>new Intl.NumberFormat('en-NG',{style:'currency',currency,currencyDisplay:'narrowSymbol',maximumFractionDigits:2,minimumFractionDigits:2}).format(Number(value||0)/100);
const date=s=>{const value=new Date(String(s).slice(0,10)+'T12:00:00Z');return Number.isFinite(value.getTime())?value.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):String(s||'')};
const statusName=x=>x==='paid'?'Paid':x==='part_paid'?'Partially paid':x==='issued'?'Issued':String(x||'');
function notice(message,error=false){
 toast.textContent=message;toast.hidden=false;toast.style.background=error?'#a12e48':'#222348';
 clearTimeout(notice.timeout);notice.timeout=setTimeout(()=>{toast.hidden=true},5000);
}
async function request(path,data){
 const r=await fetch('/api'+path,{credentials:'same-origin',...(data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})});
 const json=await r.json().catch(()=>null);
 if(!r.ok)throw Error(json?.error||'Please try again later');
 return json;
}
function loginView(){
 const needsEmailVerification=state.user&&!state.user.emailVerified;
 const connecting=Boolean(state.user?.emailVerified),register=state.mode==='register',phoneRegister=state.mode==='phone-register';
 const signUpFields=(register||phoneRegister?'<label class="field">Full name<input type="text" name="name" required maxlength="120" autocomplete="name" placeholder="Your name"></label>':'');
 const phoneFields=phoneRegister?
  '<label class="field">Phone number<input type="tel" name="phone" required inputmode="tel" autocomplete="tel" placeholder="080… or +234…"></label>'+
  '<label class="field">Private receipt code<input name="code" required maxlength="30" autocomplete="off" spellcheck="false" placeholder="BZ-XXXXXX-XXXXXX-XXXXXX-XXXXXX"></label>':
  '<label class="field">'+(register?'Email address (for free verification)':'Email address or phone number')+
  '<input type="text" name="identifier" required autocomplete="username" inputmode="email" placeholder="you@example.com or +234…"></label>'+
  (register?'<label class="field">Phone number (optional)<input type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="080… or +234…"></label>':'');
 const form='<form id="customer-auth" class="stack">'+signUpFields+phoneFields+
  '<label class="field">Password<input type="password" name="password" required minlength="'+(phoneRegister?'10':register?'8':'6')+'" autocomplete="'+(register||phoneRegister?'new-password':'current-password')+'" placeholder="Your account password"></label>'+
  '<button class="button primary" type="submit">'+(phoneRegister?'Register with phone and receipt code':register?'Register for free':'Sign in and find receipts')+'</button></form>';
 root.innerHTML='<div class="auth-root">'+
 '<section class="auth-story"><div><div class="eyebrow" style="color:#c3b4ff">YOUR PURCHASES, ALL TOGETHER</div><h1>Your receipts.<br>One account.<br>Every business.</h1><p>Never lose track of your purchases again. Save receipts from participating stores in one private, convenient place.</p></div><p>Find a receipt, print it, or save it as a PDF. Access is free.</p></section>'+
 '<section class="panel auth-card"><div class="eyebrow">CUSTOMER RECEIPT ACCESS</div><h2>'+
 (needsEmailVerification?'Confirm your email':connecting?'Connecting your receipts…':phoneRegister?'Register with your phone':register?'Create your free account':'Find your receipts')+'</h2>'+
 (needsEmailVerification?'<p>Check your email inbox for the verification link sent to <strong>'+escape(state.user.email)+'</strong>. Return here after you confirm it.</p><div class="stack"><button class="button primary" data-action="check-verification">I have verified my email</button><button class="button" data-action="resend-verification">Send the email again</button><button class="button" data-action="sign-out">Use another account</button></div>':
 connecting?'<p>Connecting your verified account to your private purchase history.</p><button class="button primary" data-action="retry">Try again</button>':
 '<p>'+(phoneRegister?'No email address? Use the phone number on your receipt and its private recovery code to create a password-protected account. No SMS verification or charges.':register?'Create an account with your name, email, optional phone number and password. Verify your email for automatic receipt recovery.':'Sign in with your email or a phone number linked to your account, together with your password.')+'</p>'+form+
 '<div class="row" style="margin-top:16px"><button class="button soft" data-action="toggle-auth">'+(phoneRegister?'I have an email address':register?'Already registered? Sign in':'Register for free')+'</button>'+
 (!phoneRegister?'<button class="button" data-action="phone-registration">'+(register?'No email? Use phone + receipt code':'Register using phone + receipt code')+'</button>':'')+
 (!phoneRegister?'<button class="button" data-action="reset-password">Forgot password?</button>':'')+'</div>')+
 '<div class="notice">'+(phoneRegister?'A private receipt code proves you have access to a particular purchase. Your phone account can recover receipts claimed with a code. Phone alone cannot reveal every purchase associated with that number. Without a verified email, password reset is not available.':'A verified email can find receipts across stores automatically. Phone-only accounts use private receipt codes to claim purchases. Your password alone does not prove phone ownership.')+'</div>'+
 (state.error?'<div class="notice error" role="alert">'+escape(state.error)+'</div>':'')+
 '</section></div>';
}
function customerView(){
 const all=state.receipts,needle=state.filter.toLowerCase().trim();
 const filtered=all.filter(x=>(!state.business||x.slug===state.business)&&(!needle||[x.business_name,x.items_summary,x.document_number,x.kind].some(y=>String(y||'').toLowerCase().includes(needle))));
 const stores=new Set(all.map(x=>x.slug));
 const heading=state.business?'Receipts from '+(all.find(x=>x.slug===state.business)?.business_name||state.business):'Every receipt, in one place.';
 root.innerHTML='<section class="hero"><div class="eyebrow">MY RECEIPTS</div><div class="spread"><div><h1>'+escape(heading)+'</h1><p>Signed in as <strong>'+escape(state.account.email)+'</strong>. Receipts from participating businesses appear automatically when they use this email.</p></div><button class="button" data-action="sign-out">Sign out</button></div></section>'+
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
 '<div class="empty"><h3>No matching receipts yet</h3><p>'+((!all.length)?'If a business has not recorded your email on a receipt, it will not appear automatically. Ask the business to add your email, or use your receipt code below.':'Try searching for another store or product.')+'</p></div>')+
 (state.nextCursor?'<div class="row" style="justify-content:center;margin:24px 0"><button class="button" data-action="load-more">Load more receipts</button></div>':'')+
 '<section class="panel" style="margin-top:30px"><div class="eyebrow">ANOTHER WAY TO RECOVER</div><h2>Have a receipt recovery code?</h2><p class="muted" style="font-size:13px">Some older purchases or cash sales may not have an email attached. If a business gave you a Bizlano receipt code, enter it to securely add the receipt to this account.</p>'+
 '<form id="claim-code" class="claim"><label class="field">Receipt code<input name="code" spellcheck="false" autocomplete="off" required maxlength="30" placeholder="BZ-XXXXXX-XXXXXX-XXXXXX-XXXXXX"></label><button class="button primary" type="submit">Add receipt</button></form></section>'+
 '<div class="notice">Your purchase history is private. A name or phone number alone cannot open another customer’s receipts. Ask the issuing business for a private recovery code if it only recorded your phone number.</div>'+ 
 '<section class="panel" style="margin-top:25px"><div class="eyebrow">MY ACCOUNT</div><h2>Contact details</h2><p class="muted" style="font-size:12px">An optional phone number helps you sign in with your password. It does not automatically unlock receipts tied to that number.</p><form id="customer-profile" class="stack"><label class="field">Your name<input name="name" maxlength="120" value="'+escape(state.account.name||'')+'" required autocomplete="name"></label><label class="field">Phone number (optional)<input type="tel" name="phone" autocomplete="tel" inputmode="tel" value="'+escape(state.account.phone||'')+'" placeholder="080… or +234…"></label><button class="button" type="submit">Save my details</button></form></section></section>';
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
 '<div class="document-footer"><div>Thank you for your purchase.</div><strong>Powered by Bizlano</strong><div style="margin-top:5px">bizlano.pages.dev</div></div></article>';
}
function showReceipt(r){
 state.current=r;
 modal.hidden=false;
 modal.innerHTML='<div class="drawer"><div class="drawer-inner" role="dialog" aria-modal="true" aria-label="Receipt preview"><div class="spread modal-actions"><div><h3>Receipt preview</h3><small>Free to save or print</small></div><div class="row"><button class="button primary" data-action="print-receipt">Print / Save PDF</button><button class="button" data-action="close-receipt">Close</button></div></div>'+receiptDocument(r)+'</div></div>';
 document.body.style.overflow='hidden';
 modal.querySelector('[data-action="close-receipt"]')?.focus();
}
function closeReceipt(){
 modal.hidden=true;modal.innerHTML='';state.current=null;document.body.style.overflow='';
}
async function connect(){
 if(!state.user?.emailVerified)return;
 const token=await state.user.getIdToken();
 await request('/auth',{token});
 const pending=sessionStorage.getItem('bizlano_customer_contact');
 if(pending){try{const saved=JSON.parse(pending);if(saved.uid===state.user.uid&&Date.now()-saved.at<604800000){await request('/customer/profile',{name:saved.name,phone:saved.phone});sessionStorage.removeItem('bizlano_customer_contact')}}catch{sessionStorage.removeItem('bizlano_customer_contact');notice('You can save your phone number from the account section.',true)}}
 state.account=await request('/customer/me');
 const result=await request('/customer/receipts');
 state.receipts=result.rows||[];
 state.nextCursor=result.nextCursor||null;
 state.error='';
 customerView();
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
  if(action==='print-receipt'){window.print();return}
  if(action==='all-receipts'){state.business='';history.replaceState(null,'','/receipts');customerView();return}
  if(action==='load-more'&&state.nextCursor){const r=await request('/customer/receipts?cursor='+encodeURIComponent(state.nextCursor));const existing=new Set(state.receipts.map(x=>x.id));state.receipts.push(...(r.rows||[]).filter(x=>!existing.has(x.id)));state.nextCursor=r.nextCursor||null;customerView();return}
  if(action==='toggle-auth'){state.mode=state.mode==='login'?'register':'login';state.error='';loginView();return}
  if(action==='check-verification'){await reload(auth.currentUser);state.user=auth.currentUser;if(!state.user.emailVerified){notice('Please confirm your email before continuing.',true);return}await connect();return}
  if(action==='resend-verification'){await sendEmailVerification(auth.currentUser);notice('Verification email requested. Check your inbox.');return}
  if(action==='reset-password'){
   const email=prompt('Enter the email address used on your receipts');
   if(email){await sendPasswordResetEmail(auth,email);notice('If this account exists, a password-reset email will arrive shortly.')}
   return;
  }
  if(action==='sign-out'){closeReceipt();await request('/logout',{});await signOut(auth);state.account=null;state.receipts=[];state.error='';return}
  if(action==='retry'){await connect();return}
 }catch(error){state.error=error.message||'Something went wrong';notice(state.error,true);if(!state.account)loginView()}
});
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
   const identifier=form.elements.namedItem('identifier').value.trim(),password=form.elements.namedItem('password').value;
   if(state.mode==='register'){
    if(!identifier.includes('@'))throw Error('An email address is needed for free account verification. You can add a phone number too.');
    const name=form.elements.namedItem('name').value.trim(),phone=form.elements.namedItem('phone').value.trim();
    if(!name)throw Error('Enter your full name');
    const result=await createUserWithEmailAndPassword(auth,identifier,password);
    await updateProfile(result.user,{displayName:name});
    if(phone)sessionStorage.setItem('bizlano_customer_contact',JSON.stringify({uid:result.user.uid,name,phone,at:Date.now()}));
    await sendEmailVerification(result.user);
    notice('Account created. Verify your email to view your receipts.');
   }else{
    const email=identifier.includes('@')?identifier:(await request('/customer/phone-login',{phone:identifier,password})).email;
    await signInWithEmailAndPassword(auth,email,password);
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
onAuthStateChanged(auth,async user=>{
 state.user=user;
 if(!user){state.account=null;loginView();return}
 if(!user.emailVerified){state.account=null;loginView();return}
 try{await connect()}catch(error){state.error=error.message||'Unable to load receipts';state.account=null;loginView()}
});
