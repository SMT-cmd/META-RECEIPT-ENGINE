(function () {
'use strict';
const C = window.MetaForgeCore;
if (!C) { document.body.textContent = 'The MetaForge calculation module could not load. Please refresh.'; return; }
const $ = (selector,scope=document) => scope.querySelector(selector);
const $$ = (selector,scope=document) => Array.from(scope.querySelectorAll(selector));
const E = C.escapeHtml;
const KEY = 'metaforge-business-v1';
const defaults = () => ({
  schemaVersion:1, profile:{name:'My Business',phone:'',email:'',address:'',registration:'',taxId:'',bank:'',accountName:'',accountNumber:'',currency:'NGN',taxDefault:0,accent:'#4855d9',footer:'Thank you for your business!',logo:''},
  documents:[],customers:[],products:[],expenses:[],audit:[]
});
const nowDate = () => {const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const newid = () => window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'mf-'+Date.now()+'-'+Math.random().toString(36).slice(2);
function load() {
  try {
    const v=JSON.parse(localStorage.getItem(KEY));
    if (v && v.schemaVersion===1 && Array.isArray(v.documents) && Array.isArray(v.customers) && Array.isArray(v.products) && Array.isArray(v.expenses) && v.profile && typeof v.profile==='object') {
      return {...defaults(),...v,profile:{...defaults().profile,...v.profile},audit:Array.isArray(v.audit)?v.audit:[]};
    }
  } catch (_) {}
  return defaults();
}
let state=load(),editingId=null,selectedStyle='signature',previewDoc=null,logoDraft=null;
const money=(n,currency)=>C.money(n,currency||state.profile.currency);
const typeInfo=id=>C.DOCUMENT_TYPES.find(t=>t.id===id)||C.DOCUMENT_TYPES[0];
const fmtDate=day=>day?new Date(day+'T12:00:00').toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}):'—';
function commit(action,detail) {
  if (action) {
    state.audit.push({id:newid(),action,detail:String(detail||'').slice(0,200),at:new Date().toISOString()});
    if (state.audit.length>2000) state.audit=state.audit.slice(-2000);
  }
  try { localStorage.setItem(KEY,JSON.stringify(state)); return true; }
  catch (err) { announce('Could not save: this browser storage is full or disabled. Export your records now.',true);return false; }
}
function announce(message,error=false) {
  const n=$('#notice');n.textContent=message;n.classList.remove('hidden');n.classList.toggle('error',error);window.scrollTo({top:0,behavior:'smooth'});
}
function closeNotice(){$('#notice').classList.add('hidden');}
function openView(view,preserveEditor=false) {
  if (!$('#view-'+view)) return;
  $$('.view').forEach(el=>el.classList.toggle('hidden',el.id!=='view-'+view));
  $$('.nav').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  $('#sidebar').classList.remove('open');$('#menuBtn').setAttribute('aria-expanded','false');
  closeNotice();
  if(view==='create'&&!preserveEditor) resetEditor();
  if(view==='dashboard') renderDashboard();
  if(view==='documents') renderDocuments();
  if(view==='customers') renderCustomers();
  if(view==='catalog') renderProducts();
  if(view==='expenses') renderExpenses();
  if(view==='settings') fillProfile();
  window.scrollTo(0,0);
}
function renderNav() {
  $('#topbarName').textContent=state.profile.name||'Your business';
  $('#topbarDate').textContent=new Date().toLocaleDateString('en-NG',{weekday:'long',month:'short',day:'numeric',year:'numeric'});
  document.title=(state.profile.name||'Bizlano Business')+' | Bizlano';
}
function renderDashboard() {
  renderNav();
  const s=C.summary(state.documents.filter(d=>!d.currency||d.currency===state.profile.currency),state.expenses.filter(e=>!e.currency||e.currency===state.profile.currency));
  const mixed=state.documents.some(d=>d.currency&&d.currency!==state.profile.currency);
  const stats=[
    ['Issued sales value',money(s.invoiced),'Total issued billable documents'],
    ['Payments received',money(s.collected),'Manually recorded'],
    ['Outstanding',money(s.outstanding),'Not yet collected'],
    ['Expenses logged',money(s.expenses),'Cash less expenses: '+money(s.cashAfterExpenses)+(mixed?' · Other currencies excluded':'')]
  ];
  $('#stats').innerHTML=stats.map(row=>'<div class="stat"><span>'+E(row[0])+'</span><strong>'+E(row[1])+'</strong><small>'+E(row[2])+'</small></div>').join('');
  const docs=state.documents.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,6);
  $('#recentDocs').innerHTML=docs.length?tableDocuments(docs,true):'<div class="empty">No documents yet. Create your first receipt or invoice.</div>';
  const debts=state.documents.filter(d=>C.BILLABLE.has(d.type)&&!d.draft&&!d.voided).map(d=>{try{return {d,totals:C.calculate(d)}}catch(_){return null}}).filter(x=>x && x.totals.balance>0).sort((a,b)=>b.totals.balance-a.totals.balance).slice(0,6);
  $('#debts').innerHTML=debts.length?debts.map(x=>'<div class="debt-item"><div><strong>'+E(x.d.customer||'Walk-in customer')+'</strong><small>'+E(x.d.number)+' · '+E(C.status(x.d))+'</small></div><strong>'+E(money(x.totals.balance,x.d.currency))+'</strong></div>').join(''):'<div class="empty">No outstanding payments.</div>';
  $('#setupPanel').classList.toggle('hidden',Boolean(state.profile.phone&&state.profile.name&&state.profile.name!=='My Business'));
}
function docStatus(d){try{return C.status(d)}catch(_){return 'Needs review'}}
function tableDocuments(list,compact=false) {
  const rows=list.map(d=>{
    let total='—';try{total=money(C.calculate(d).total,d.currency)}catch(_){}
    const status=docStatus(d);
    return '<tr><td><strong>'+E(d.number)+'</strong><small>'+E(typeInfo(d.type).label)+'</small></td><td>'+E(d.customer||'Walk-in')+'</td><td>'+E(fmtDate(d.date))+'</td><td class="money">'+E(total)+'</td><td><span class="status '+E(status.replace(/[^a-zA-Z-]/g,''))+'">'+E(status)+'</span></td>'+
      (compact?'':'<td><div class="table-actions"><button data-doc-action="edit" data-id="'+E(d.id)+'">Edit</button><button data-doc-action="copy" data-id="'+E(d.id)+'">Copy</button><button data-doc-action="print" data-id="'+E(d.id)+'">Print</button><button data-doc-action="share" data-id="'+E(d.id)+'">Share</button>'+(C.BILLABLE.has(d.type)&&!d.voided&&!d.draft&&docStatus(d)!=='Paid'?'<button data-doc-action="payment" data-id="'+E(d.id)+'">Payment</button>':'')+(d.draft?'<button data-doc-action="delete" data-id="'+E(d.id)+'">Delete</button>':!d.voided?'<button data-doc-action="void" data-id="'+E(d.id)+'">Void</button>':'')+'</div></td>')+'</tr>';
  }).join('');
  return '<div class="table-wrap"><table><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th>'+(compact?'':'<th>Actions</th>')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function renderDocuments() {
  const q=$('#docSearch').value.trim().toLowerCase(),filter=$('#docFilter').value;
  const docs=state.documents.filter(d=>{
    if(q && !([d.number,d.customer,d.type,d.reference,...(d.items||[]).map(i=>i.description)].join(' ').toLowerCase().includes(q)))return false;
    if(filter==='sales'&&!C.BILLABLE.has(d.type))return false;
    if(filter==='drafts'&&!d.draft)return false;
    if(filter==='unpaid'&&!(C.BILLABLE.has(d.type)&&!d.draft&&!d.voided&&['Unpaid','Part-paid','Overdue'].includes(docStatus(d))))return false;
    if(filter==='voided'&&!d.voided)return false;
    return true;
  }).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  $('#docsTable').innerHTML=docs.length?tableDocuments(docs):'<div class="empty">No matching documents.</div>';
}
function renderCustomers(){
  $('#customerOptions').innerHTML=state.customers.map(c=>'<option value="'+E(c.name)+'"></option>').join('');
  $('#customerList').innerHTML=state.customers.length?state.customers.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>{
    const docs=state.documents.filter(d=>d.customer&&d.customer.trim().toLowerCase()===c.name.toLowerCase()&&!d.voided);
    const outstanding=docs.reduce((sum,d)=>{try{return sum+(C.BILLABLE.has(d.type)&&!d.draft&&(!d.currency||d.currency===state.profile.currency)?C.calculate(d).balance:0)}catch(_){return sum}},0);
    return '<div class="list-row"><div><strong>'+E(c.name)+'</strong><small>'+E(c.phone||c.email||'No contact saved')+' · '+docs.length+' documents</small></div><div class="end"><strong>'+E(money(outstanding))+'</strong><small>Outstanding</small><button class="text-btn" data-remove="customer" data-id="'+E(c.id)+'">Remove</button></div></div>';
  }).join(''):'<div class="empty">No customers saved yet.</div>';
}
function renderProducts(){
  $('#productList').innerHTML=state.products.length?state.products.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>
    '<div class="list-row"><div><strong>'+E(p.name)+'</strong><small>'+E(p.sku||'No SKU')+' · '+E(money(p.price))+'</small></div><div class="end"><strong class="'+(p.track&&p.stock<=p.low?'kpi-warning':'')+'">'+(p.track?E(String(p.stock))+' left':'Service')+'</strong><small>'+(p.track&&p.stock<=p.low?'Low stock':'')+'</small><button class="text-btn" data-adjust="'+E(p.id)+'">Adjust</button></div></div>'
  ).join(''):'<div class="empty">Add a product to autofill invoice lines.</div>';
}
function renderExpenses(){
  const expenses=state.expenses.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $('#expenseList').innerHTML=expenses.length?expenses.map(e=>'<div class="list-row"><div><strong>'+E(e.description)+'</strong><small>'+E(e.category)+' · '+E(fmtDate(e.date))+'</small></div><div class="end"><strong>'+E(money(e.amount))+'</strong><button class="text-btn" data-remove="expense" data-id="'+E(e.id)+'">Remove</button></div></div>').join(''):'<div class="empty">No expenses recorded yet.</div>';
}
function renderStyles(){
  $('#styles').innerHTML=C.STYLES.map(s=>'<button type="button" class="style-card '+(selectedStyle===s.id?'active':'')+'" data-style="'+E(s.id)+'" aria-pressed="'+(selectedStyle===s.id)+'"><span class="swatch" style="background:'+E(s.accent)+'"></span><strong>'+E(s.label)+'</strong><small>'+E(s.description)+'</small></button>').join('');
}
function resetEditor(){
  editingId=null; selectedStyle='signature';previewDoc=null;
  $('#editorHeading').textContent='Create a business document';
  $('#docForm').reset();
  $('#docType').value='invoice';
  $('#docForm').elements.date.value=nowDate();
  $('#docForm').elements.taxPct.value=state.profile.taxDefault||0;
  $('#docNumber').value=C.numberFor(state.documents,'invoice',nowDate());
  $('#itemRows').innerHTML='';
  addLine();
  renderStyles();
  renderPreview();
}
function addLine(item){
  const row=document.createElement('div');row.className='item-row';
  const name=document.createElement('label');name.textContent='Description';
  const input=document.createElement('input');input.className='item-name';input.placeholder='Product / service';input.maxLength=180;input.setAttribute('list','catalogItems');input.value=item?.description||'';name.appendChild(input);
  const q=document.createElement('label');q.textContent='Qty';const qi=document.createElement('input');qi.className='item-qty';qi.type='number';qi.min='0.001';qi.step='0.001';qi.value=item?.qty??1;q.appendChild(qi);
  const p=document.createElement('label');p.textContent='Price';const pi=document.createElement('input');pi.className='item-price';pi.type='number';pi.min='0';pi.step='0.01';pi.value=item?.price??'';p.appendChild(pi);
  const del=document.createElement('button');del.type='button';del.className='icon-btn';del.textContent='×';del.setAttribute('aria-label','Remove line');del.addEventListener('click',()=>{if($('.item-row',$('#itemRows')).length>1){row.remove();renderPreview();}});
  row.dataset.productId=item?.productId||'';
  input.addEventListener('change',()=>{const match=state.products.find(x=>x.name.toLowerCase()===input.value.trim().toLowerCase());row.dataset.productId=match?.id||'';if(match){pi.value=match.price;renderPreview();}});
  input.addEventListener('input',()=>{const chosen=state.products.find(x=>x.id===row.dataset.productId);if(chosen && chosen.name!==input.value)row.dataset.productId='';renderPreview();});
  qi.addEventListener('input',renderPreview);pi.addEventListener('input',renderPreview);
  row.append(name,q,p,del);$('#itemRows').append(row);
  const list=$('#catalogItems')||document.createElement('datalist');list.id='catalogItems';list.innerHTML=state.products.map(x=>'<option value="'+E(x.name)+'"></option>').join('');
  if(!list.isConnected)document.body.appendChild(list);
  renderPreview();
}
function formDoc() {
  const v=Object.fromEntries(new FormData($('#docForm')).entries());
  return {
    id:editingId||'',number:String(v.number||'').trim(),type:v.type,date:v.date||nowDate(),dueDate:v.dueDate||'',
    customer:String(v.customer||'').trim(),customerPhone:v.customerPhone||'',customerEmail:v.customerEmail||'',customerAddress:v.customerAddress||'',reference:v.reference||'',
    style:selectedStyle,notes:v.notes||'',paymentMethod:v.paymentMethod||'',
    discountPct:Number(v.discountPct),taxPct:Number(v.taxPct),shipping:Number(v.shipping),paid:Number(v.paid),
    items:$$('.item-row',$('#itemRows')).map(row=>({
      description:$('.item-name',row).value.trim(),qty:Number($('.item-qty',row).value),
      price:Number($('.item-price',row).value),productId:row.dataset.productId||''
    })).filter(line=>line.description!=='')
  };
}
function validateDoc(doc){
  if(!doc.number) throw Error('Add a document number.');
  if(!C.DOCUMENT_TYPES.some(t=>t.id===doc.type))throw Error('Choose a valid document type.');
  if(state.documents.some(d=>d.id!==editingId&&d.number.toLowerCase()===doc.number.toLowerCase()))throw Error('That document number already exists. Use a unique number.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(doc.date))throw Error('Choose a valid issue date.');
  return C.calculate(doc);
}
function showDocument(doc){
  let totals;try{totals=C.calculate(doc);}catch(err){$('#preview').innerHTML='<div class="paper"><p class="empty">'+E(err.message)+'</p></div>';return;}
  const profile=doc.profileSnapshot||state.profile,docMoney=n=>money(n,doc.currency||profile.currency),style=C.STYLES.find(s=>s.id===doc.style)||C.STYLES[0];
  const accent=doc.style==='signature'?profile.accent:style.accent;
  const rows=totals.lines.map(line=>'<tr><td>'+E(line.description)+'</td><td>'+E(line.qty)+'</td><td>'+E(docMoney(line.price))+'</td><td>'+E(docMoney(line.total))+'</td></tr>').join('');
  const p=(text)=>text?'<div>'+E(text)+'</div>':'';
  $('#preview').innerHTML='<article class="paper" id="printableDocument" data-style="'+E(doc.style||'signature')+'" style="--receipt-accent:'+E(/^#[a-f\d]{6}$/i.test(accent)?accent:'#4855d9')+'">'+
    '<div class="paper-header"><div>'+(profile.logo&&/^data:image\/(png|jpeg|webp);base64,/.test(profile.logo)?'<img class="paper-logo" src="'+profile.logo+'" alt="Business logo">':'')+
    '<div class="paper-brand">'+E(profile.name||'Your business')+'</div><div class="paper-contact">'+[profile.phone,profile.email,profile.address].filter(Boolean).map(E).join(' · ')+ '</div>'+
    (profile.registration?'<div class="paper-contact">Registration: '+E(profile.registration)+'</div>':'')+(profile.taxId?'<div class="paper-contact">Tax ID: '+E(profile.taxId)+'</div>':'')+'</div>'+
    '<div class="paper-type">'+E(typeInfo(doc.type).label)+'<small>'+E(doc.number)+'</small></div></div>'+
    '<div class="paper-meta"><div><strong>Issued to</strong>'+p(doc.customer||'Walk-in customer')+p(doc.customerPhone)+p(doc.customerEmail)+p(doc.customerAddress)+'</div>'+
    '<div><strong>Document details</strong>'+p('Issued: '+fmtDate(doc.date))+(doc.dueDate?p('Due: '+fmtDate(doc.dueDate)):'')+(doc.reference?p('Ref: '+doc.reference):'')+p('Currency: '+profile.currency)+'</div></div>'+
    '<table class="paper-table"><thead><tr><th>Item / service</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div class="paper-totals"><div class="paper-total-row"><span>Subtotal</span><strong>'+E(docMoney(totals.subtotal))+'</strong></div>'+
    (totals.discount?'<div class="paper-total-row"><span>Discount ('+E(doc.discountPct)+'%)</span><strong>−'+E(docMoney(totals.discount))+'</strong></div>':'')+
    (doc.taxPct?'<div class="paper-total-row"><span>Tax ('+E(doc.taxPct)+'%)</span><strong>'+E(docMoney(totals.tax))+'</strong></div>':'')+
    (totals.shipping?'<div class="paper-total-row"><span>Extra charges</span><strong>'+E(docMoney(totals.shipping))+'</strong></div>':'')+
    '<div class="paper-total-row grand"><span>TOTAL</span><strong>'+E(docMoney(totals.total))+'</strong></div>'+
    (doc.paid?'<div class="paper-total-row"><span>Received</span><strong>'+E(docMoney(totals.paid))+'</strong></div>':'')+
    (C.BILLABLE.has(doc.type)?'<div class="paper-total-row"><span>Balance</span><strong>'+E(docMoney(totals.balance))+'</strong></div>':'')+'</div>'+
    '<div class="paper-status">'+E(doc.draft?'DRAFT':doc.voided?'VOID':doc.type==='invoice'&&totals.balance>0?'ISSUED':C.status(doc).toUpperCase())+'</div>'+
    '<div class="paper-foot">'+(doc.notes?'<div><strong class="paper-footer-title">Notes</strong>'+p(doc.notes)+'</div>':'')+
    (profile.bank?'<div><strong class="paper-footer-title">Payment details</strong>'+p([profile.bank,profile.accountName,profile.accountNumber].filter(Boolean).join(' · '))+'</div>':'')+
    (profile.footer?p(profile.footer):'')+
    '<div class="bizlano-powered">Powered by <strong>Bizlano</strong> · '+E(doc.number)+'</div></div></article>';
}
function renderPreview(){
  let doc;
  try{doc=formDoc();}catch(_){return;}
  previewDoc=doc; showDocument(doc);
}
function inventoryPlan(before,after){
  const snapshot=state.products.map(p=>({...p}));
  function apply(doc,sign){
    if(!doc||doc.draft||doc.voided||!C.BILLABLE.has(doc.type))return;
    for(const item of doc.items||[]){
      if(!item.productId)continue;
      const p=snapshot.find(x=>x.id===item.productId);
      if(!p)throw Error('An item in this document was removed from the catalog.');
      if(!p.track)continue;
      p.stock=Math.round((Number(p.stock)+sign*Number(item.qty))*1000)/1000;
      if(p.stock<-.00001)throw Error('Not enough stock for '+p.name+'. Available: '+(p.stock+Number(item.qty))+'.');
    }
  }
  apply(before,1);apply(after,-1);return snapshot;
}
function ensureCustomer(doc){
  if(!doc.customer) return;
  const match=state.customers.find(c=>c.name.toLowerCase()===doc.customer.toLowerCase());
  if(!match)state.customers.push({id:newid(),name:doc.customer,phone:doc.customerPhone,email:doc.customerEmail,address:doc.customerAddress});
}
function saveDocument(draft){
  try {
    const doc=formDoc();
    validateDoc(doc);
    if(C.BILLABLE.has(doc.type)&&!draft&&/(receipt|cash-sale)/.test(doc.type)&&Number(doc.paid)===0)throw Error('For a receipt, record the amount received. Use an invoice to bill an unpaid sale.');
    const old=editingId?state.documents.find(d=>d.id===editingId):null;
    if(old?.voided)throw Error('Voided documents cannot be edited. Duplicate it instead.');
    doc.draft=draft;doc.voided=false;
    doc.currency=old?.currency||state.profile.currency;
    doc.profileSnapshot=old?.profileSnapshot||(!draft?{...state.profile}:null);
    doc.revisions=Array.isArray(old?.revisions)?old.revisions.slice(-9):[];
    if(old&&!old.draft)doc.revisions.push({at:new Date().toISOString(),previous:{type:old.type,number:old.number,date:old.date,customer:old.customer,items:old.items,discountPct:old.discountPct,taxPct:old.taxPct,shipping:old.shipping,paid:old.paid}});
    doc.id=old?.id||newid();doc.createdAt=old?.createdAt||new Date().toISOString();doc.updatedAt=new Date().toISOString();
    state.products=inventoryPlan(old,doc);
    if(old)state.documents[state.documents.findIndex(d=>d.id===doc.id)]=doc;else state.documents.push(doc);
    ensureCustomer(doc);
    if(!commit(old?'document.updated':'document.created',doc.number))throw Error('Storage failed.');
    editingId=doc.id;previewDoc=doc;showDocument(doc);announce('Document '+doc.number+(draft?' saved as a draft.':' issued and saved.'));
    renderNav();
  }catch(err){announce(err.message,true);}
}
function populateEditor(doc,duplicate){
  editingId=duplicate?null:doc.id;
  const clone=Object.assign({},doc);
  if(duplicate){clone.number=C.numberFor(state.documents,clone.type,nowDate());clone.date=nowDate();clone.paid=0;clone.draft=true;}
  selectedStyle=clone.style||'signature';
  const form=$('#docForm');
  for(const [key,val] of Object.entries(clone)){if(form.elements[key]&&typeof val!=='object')form.elements[key].value=val??'';}
  $('#itemRows').innerHTML='';(clone.items||[]).forEach(addLine);if(!clone.items?.length)addLine();
  $('#editorHeading').textContent=(duplicate?'Duplicate document':clone.draft?'Edit draft':'Edit issued document');
  openView('create',true);renderStyles();renderPreview();
}
function printDocument(){if(!previewDoc){announce('Create a document first.',true);return;}window.print();}
function shareText(doc) {
  const s=C.calculate(doc),p=state.profile;
  const docMoney=n=>money(n,doc.currency);
  return [(doc.profileSnapshot?.name||p.name),typeInfo(doc.type).label+' '+doc.number,'Date: '+fmtDate(doc.date),'Customer: '+(doc.customer||'Walk-in'),...(doc.items||[]).map(i=>i.description+' × '+i.qty+' — '+docMoney(Number(i.qty)*Number(i.price))),
    'Total: '+docMoney(s.total),'Paid: '+docMoney(s.paid),'Balance: '+docMoney(s.balance),
    p.bank?'Payment details: '+[p.bank,p.accountName,p.accountNumber].filter(Boolean).join(' / '):'',
    'Please ask the sender for the official PDF copy.'].filter(Boolean).join('\n');
}
async function shareDocument(doc) {
  try {
    const text=shareText(doc);
    if(navigator.share){await navigator.share({title:'Document '+doc.number,text});}
    else window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
  }catch(err){if(err.name!=='AbortError')announce('Could not open sharing. You can print or save a PDF.',true);}
}
function handleDocAction(action,id){
  const d=state.documents.find(x=>x.id===id);if(!d)return;
  if(action==='edit'){if(d.voided){announce('Voided documents are read-only. Copy it to create a replacement.',true);return;}populateEditor(d,false);}
  if(action==='copy')populateEditor(d,true);
  if(action==='print'){populateEditor(d,false);window.print();}
  if(action==='share')shareDocument(d);
  if(action==='payment'){
    let s;try{s=C.calculate(d)}catch(err){announce(err.message,true);return;}
    const value=window.prompt('Additional payment received ('+state.profile.currency+'). Remaining: '+s.balance,'');
    if(value===null)return;
    const incoming=Number(value);
    if(!Number.isFinite(incoming)||incoming<=0||Math.round(incoming*100)>Math.round(s.balance*100)){announce('Enter a positive payment no larger than the outstanding balance.',true);return;}
    d.paid=Math.round((d.paid+incoming)*100)/100;d.updatedAt=new Date().toISOString();
    if(commit('payment.recorded',d.number+' '+incoming)){renderDocuments();announce('Payment recorded. Confirm it against your bank statement.');}
  }
  if(action==='void'){
    if(!confirm('Void '+d.number+'? This keeps the record but reverses its stock allocation.'))return;
    try{state.products=inventoryPlan(d,null);d.voided=true;d.updatedAt=new Date().toISOString();if(commit('document.voided',d.number)){renderDocuments();announce('Document voided.');}}catch(err){announce(err.message,true);}
  }
  if(action==='delete'&&d.draft){
    if(!confirm('Permanently delete this draft?'))return;
    state.documents=state.documents.filter(x=>x.id!==id);
    if(commit('draft.deleted',d.number)){renderDocuments();announce('Draft deleted.');}
  }
}
function addCustomer(form) {
  const data=Object.fromEntries(new FormData(form).entries());data.name=data.name?.trim();
  if(!data.name)return announce('Enter a customer name.',true);
  if(state.customers.some(c=>c.name.toLowerCase()===data.name.toLowerCase()))return announce('That customer already exists.',true);
  state.customers.push({id:newid(),...data});if(commit('customer.created',data.name)){form.reset();renderCustomers();announce('Customer saved.');}
}
function addProduct(form) {
  const v=Object.fromEntries(new FormData(form).entries());
  if(!v.name?.trim()||![v.price,v.stock,v.low].every(x=>Number.isFinite(Number(x))&&Number(x)>=0))return announce('Check the product name, price and stock.',true);
  if(v.sku&&state.products.some(p=>p.sku&&p.sku.toLowerCase()===v.sku.toLowerCase()))return announce('This SKU already exists.',true);
  const item={id:newid(),name:v.name.trim(),sku:v.sku||'',price:Number(v.price),stock:Number(v.stock),low:Number(v.low),track:v.track==='on'};
  state.products.push(item);if(commit('product.created',item.name)){form.reset();renderProducts();announce('Product added.');}
}
function adjustProduct(id) {
  const p=state.products.find(x=>x.id===id);if(!p)return;
  const value=prompt('Set current stock for '+p.name+' (current: '+p.stock+'). Leave blank to cancel.','');
  if(value===null||value.trim()==='')return;
  const number=Number(value);
  if(!Number.isFinite(number)||number<0)return announce('Enter a valid non-negative stock quantity.',true);
  p.stock=Math.round(number*1000)/1000;if(commit('stock.adjusted',p.name+': '+p.stock)){renderProducts();announce('Stock level updated.');}
}
function addExpense(form){
  const v=Object.fromEntries(new FormData(form).entries());
  if(!v.description.trim()||!Number.isFinite(Number(v.amount))||Number(v.amount)<=0)return announce('Add an expense name and positive amount.',true);
  const expense={id:newid(),description:v.description.trim(),category:v.category,date:v.date||nowDate(),amount:Number(v.amount),currency:state.profile.currency};
  state.expenses.push(expense);if(commit('expense.created',expense.description)){form.reset();form.elements.date.value=nowDate();renderExpenses();announce('Expense recorded.');}
}
function removeRecord(kind,id){
  const key=kind==='customer'?'customers':'expenses',value=state[key].find(x=>x.id===id);
  if(!value||!confirm('Remove this '+kind+'?'))return;
  state[key]=state[key].filter(x=>x.id!==id);
  if(commit(kind+'.deleted',id)){kind==='customer'?renderCustomers():renderExpenses();announce('Record removed.');}
}
function fillProfile(){
  const form=$('#profileForm');
  for(const [key,value] of Object.entries(state.profile)){if(form.elements[key]&&key!=='logo')form.elements[key].value=value;}
  logoDraft=state.profile.logo;
  $('#logoPreview').innerHTML=logoDraft?'<img class="logo-thumb" alt="Business logo preview" src="'+E(logoDraft)+'">':'';
}
function saveProfile(){
  const form=$('#profileForm'),v=Object.fromEntries(new FormData(form).entries());
  if(!v.name?.trim())return announce('Business name is required.',true);
  if(!/^(NGN|USD|GBP|EUR|GHS|KES|ZAR)$/.test(v.currency))return announce('Choose a valid currency.',true);
  if(!Number.isFinite(Number(v.taxDefault))||Number(v.taxDefault)<0||Number(v.taxDefault)>100)return announce('Default tax must be between 0 and 100.',true);
  const next={...v,name:v.name.trim(),taxDefault:Number(v.taxDefault),logo:logoDraft||''};
  state.profile=next;
  if(commit('profile.updated',next.name)){renderNav();announce('Business profile updated. Issued documents keep their original business branding.');}
}
function download(name,data,type){
  const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadBackup(){download('metaforge-business-backup-'+nowDate()+'.json',JSON.stringify(state,null,2),'application/json;charset=utf-8');}
function csvSafe(value){
  const v=String(value??'');
  return /^[=+\-@\t\r]/.test(v)?'\''+v:v;
}
function exportCsv(kind){
  let rows=[];
  if(kind==='documents')rows=[['Number','Type','Date','Due','Customer','Currency','Subtotal','Discount','Tax','Total','Paid','Balance','Status'],...state.documents.map(d=>{try{const s=C.calculate(d);return [d.number,typeInfo(d.type).label,d.date,d.dueDate,d.customer,d.currency||state.profile.currency,s.subtotal,s.discount,s.tax,s.total,s.paid,s.balance,docStatus(d)];}catch(_){return [d.number,'Invalid record'];}})];
  if(kind==='customers')rows=[['Name','Phone','Email','Address'],...state.customers.map(c=>[c.name,c.phone,c.email,c.address])];
  if(kind==='products')rows=[['Name','SKU','Price','Stock','Low-stock threshold','Track stock'],...state.products.map(p=>[p.name,p.sku,p.price,p.stock,p.low,p.track])];
  if(kind==='expenses')rows=[['Date','Description','Category','Amount','Currency'],...state.expenses.map(x=>[x.date,x.description,x.category,x.amount,x.currency||state.profile.currency])];
  download('metaforge-'+kind+'-'+nowDate()+'.csv','\uFEFF'+C.csv(rows.map(r=>r.map(csvSafe))),'text/csv;charset=utf-8');
}
async function restoreBackup(){
  const f=$('#restoreFile').files[0];if(!f)return announce('Choose your MetaForge JSON backup first.',true);
  if(f.size>5*1024*1024)return announce('Backup is larger than 5 MB. Contact support for assisted recovery.',true);
  try{
    const incoming=JSON.parse(await f.text());
    if(incoming.schemaVersion!==1||!incoming.profile||!['documents','customers','products','expenses'].every(k=>Array.isArray(incoming[k])&&incoming[k].length<=10000))throw Error('Invalid or unsupported MetaForge backup.');
    if(!confirm('Replace all current business records on this device? This cannot be undone.'))return;
    const next={...defaults(),...incoming,audit:Array.isArray(incoming.audit)?incoming.audit.slice(-2000):[]};
    const previous=state;state=next;
    if(!commit('backup.restored',f.name)){state=previous;return;}
    $('#restoreFile').value='';renderNav();openView('dashboard');announce('Backup restored. Review totals and documents before continuing.');
  }catch(err){announce('Restore failed: '+err.message,true);}
}
function bindEvents(){
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-view]');
    if(nav){event.preventDefault();openView(nav.dataset.view);return;}
    const action=event.target.closest('[data-doc-action]');
    if(action){handleDocAction(action.dataset.docAction,action.dataset.id);return;}
    const remove=event.target.closest('[data-remove]');
    if(remove){removeRecord(remove.dataset.remove,remove.dataset.id);return;}
    const adjust=event.target.closest('[data-adjust]');
    if(adjust){adjustProduct(adjust.dataset.adjust);return;}
    const exportBtn=event.target.closest('[data-export]');
    if(exportBtn)exportCsv(exportBtn.dataset.export);
  });
  $('#menuBtn').addEventListener('click',()=>{const aside=$('#sidebar');aside.classList.toggle('open');$('#menuBtn').setAttribute('aria-expanded',String(aside.classList.contains('open')));});
  $('#docType').addEventListener('change',()=>{if(!editingId)$('#docNumber').value=C.numberFor(state.documents,$('#docType').value,$('#docForm').elements.date.value);renderPreview();});
  $('#docForm').addEventListener('input',renderPreview);
  $('#docForm').addEventListener('change',renderPreview);
  $('#customerName').addEventListener('change',()=>{const c=state.customers.find(x=>x.name.toLowerCase()===$('#customerName').value.trim().toLowerCase());if(c){for(const [field,key] of [['customerPhone','phone'],['customerEmail','email'],['customerAddress','address']])$('#docForm').elements[field].value=c[key]||'';renderPreview();}});
  $('#addLine').addEventListener('click',()=>addLine());
  $('#styles').addEventListener('click',ev=>{const b=ev.target.closest('[data-style]');if(b){selectedStyle=b.dataset.style;renderStyles();renderPreview();}});
  $('#newDoc').addEventListener('click',resetEditor);
  $('#saveDraft').addEventListener('click',()=>saveDocument(true));
  $('#issueDoc').addEventListener('click',()=>saveDocument(false));
  $('#printDoc').addEventListener('click',printDocument);
  $('#shareDoc').addEventListener('click',()=>{try{shareDocument(previewDoc)}catch(err){announce(err.message,true);}});
  $('#docSearch').addEventListener('input',renderDocuments);
  $('#docFilter').addEventListener('change',renderDocuments);
  $('#customerForm').addEventListener('submit',ev=>{ev.preventDefault();addCustomer(ev.target);});
  $('#productForm').addEventListener('submit',ev=>{ev.preventDefault();addProduct(ev.target);});
  $('#expenseForm').addEventListener('submit',ev=>{ev.preventDefault();addExpense(ev.target);});
  $('#profileForm').addEventListener('submit',ev=>{ev.preventDefault();saveProfile();});
  $('#logoUpload').addEventListener('change',ev=>{
    const f=ev.target.files[0];if(!f)return;
    if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>600*1024){announce('Choose a PNG, JPG or WEBP image no larger than 600 KB.',true);ev.target.value='';return;}
    const reader=new FileReader();reader.onload=()=>{logoDraft=String(reader.result);$('#logoPreview').innerHTML='<img class="logo-thumb" alt="Business logo preview" src="'+E(logoDraft)+'">';};reader.readAsDataURL(f);
  });
  $('#backup').addEventListener('click',downloadBackup);
  $('#restoreBtn').addEventListener('click',restoreBackup);
}
function init(){
  const groups=[...new Set(C.DOCUMENT_TYPES.map(t=>t.group))];
  $('#docType').innerHTML=groups.map(group=>'<optgroup label="'+E(group)+'">'+C.DOCUMENT_TYPES.filter(t=>t.group===group).map(t=>'<option value="'+E(t.id)+'">'+E(t.label)+'</option>').join('')+'</optgroup>').join('');
  $('#expenseForm').elements.date.value=nowDate();
  bindEvents();renderNav();openView('dashboard');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();