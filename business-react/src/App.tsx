import {useEffect,useMemo,useState,type CSSProperties,type FormEvent,type ReactNode} from 'react';
import type {User} from 'firebase/auth';
import {
  BILLABLE_TYPES,DOCUMENT_TYPES,TEMPLATES,CURRENCIES,calculate,emptyWorkspace,money,
  newDocument,newId,nextNumber,status,summarize,today,
  type BusinessDocument,type BusinessProfile,type DocumentType,
  type LineItem,type WorkspaceData
} from './domain';
import {
  auth,acceptInvitation,businessUrl,createBusiness,createCloudCustomer,createCloudExpense,
  createCloudProduct,inviteStaff,listMyBusinesses,listStaff,myMembership,
  observeBusiness,observeProfile,onAccountChanged,parseInviteFromAddress,
  recordCloudPayment,refreshEmailVerification,register,saveBusinessProfile,
  saveCloudDocument,setStaffRole,signIn,signOutAccount,slugFromAddress,slugify,
  validSlug,voidCloudDocument,type Business,type Member,type Role
} from './cloud';
import {detectLegacy,importLegacySource,copyLegacyHistoryInfo,type LegacySource} from './legacy';
import {contactExport,documentExport,downloadText,expenseExport,productExport} from './storage';
import {SalesInsights} from './SalesInsights';

type Page='overview'|'create'|'documents'|'customers'|'products'|'expenses'|'team'|'profile'|'exports'|'migration';
const PAGE_ITEMS:{id:Page;label:string;symbol:string;roles?:Role[]}[]=[
  {id:'overview',label:'Overview',symbol:'▦',roles:['owner','admin','manager','accountant','cashier','sales','staff']},{id:'create',label:'Create document',symbol:'＋',roles:['owner','admin','manager','accountant','cashier','sales','staff']},
  {id:'documents',label:'Documents',symbol:'▤'},{id:'customers',label:'Customers',symbol:'♙',roles:['owner','admin','manager','accountant','cashier','sales','staff']},
  {id:'products',label:'Products & stock',symbol:'▥',roles:['owner','admin','manager','accountant','cashier','sales','staff']},
  {id:'expenses',label:'Expenses',symbol:'↗',roles:['owner','admin','manager','accountant']},
  {id:'team',label:'Team & access',symbol:'♧',roles:['owner','admin']},
  {id:'profile',label:'Business profile',symbol:'⚙',roles:['owner','admin']},
  {id:'exports',label:'Backup & export',symbol:'⇩',roles:['owner','admin','manager','accountant']},
  {id:'migration',label:'Upgrade old records',symbol:'⇧',roles:['owner']}
];
const kindName=(id:DocumentType)=>DOCUMENT_TYPES.find(t=>t[0]===id)?.[1]||id;
const readableDate=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}):'—';
const canWrite=(role:Role)=>role!=='viewer';
const canAdmin=(role:Role)=>role==='owner'||role==='admin';
const canFinance=(role:Role)=>['owner','admin','manager','accountant'].includes(role);
const receiptOnly=(role:Role)=>role==='cashier';
const allowedCashierTypes=['receipt','cash-sale','retail-receipt','thermal-receipt','service-receipt'];
const canCreateType=(role:Role,type:DocumentType)=>canWrite(role)&&(!receiptOnly(role)||allowedCashierTypes.includes(type));
const canEditDocument=(role:Role,type:DocumentType,draft=true)=>canCreateType(role,type)&&(!receiptOnly(role)||draft);
const asError=(e:unknown)=>e instanceof Error?e.message:String(e);

function Button({children,onClick,kind='outline',type='button',disabled=false}:{children:ReactNode;onClick?:()=>void;kind?:'outline'|'primary'|'dark';type?:'button'|'submit';disabled?:boolean}){
  return <button className={'button '+kind} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}
function Heading({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:ReactNode}){
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action&&<div className="actions">{action}</div>}</div>;
}
function Panel({children}:{children:ReactNode}){return <section className="panel">{children}</section>;}
function Field({label,value,onChange,type='text',min,max,step,required=false,placeholder=''}:{label:string;value:string|number;onChange:(value:string)=>void;type?:string;min?:number;max?:number;step?:string;required?:boolean;placeholder?:string}){
  return <label className="field"><span>{label}</span><input value={value} onChange={e=>onChange(e.target.value)} type={type} min={min} max={max} step={step} required={required} placeholder={placeholder}/></label>;
}
function Select({label,value,onChange,options}:{label:string;value:string;onChange:(value:string)=>void;options:ReadonlyArray<[string,string]>}){
  return <label className="field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>;
}
function Empty({text}:{text:string}){return <p className="empty">{text}</p>;}
function DocumentStatus({document}:{document:BusinessDocument}){let name='Review';try{name=status(document);}catch(_){}return <span className={'status '+name.toLowerCase()}>{name}</span>;}
function ReceiptPreview({document,profile}:{document:BusinessDocument;profile:BusinessProfile}){
  const issuer=document.profileSnapshot||profile;
  const colour=document.style==='signature'?issuer.accent:TEMPLATES.find(s=>s.id===document.style)?.accent||'#4356ce';
  const rows=document.items.filter(i=>i.description.trim());
  let totals:ReturnType<typeof calculate>|null=null;
  try{totals=calculate({...document,items:rows});}catch(_){}
  const m=(n:number)=>money(n,document.currency);
  return <article className={'receipt style-'+document.style} id="printable-receipt" style={{'--accent':colour} as CSSProperties}>
    <header className="receipt-header">
      <div>{issuer.logo&&<img className="receipt-logo" alt="Business logo" src={issuer.logo}/>}<h2 className="receipt-brand">{issuer.name}</h2>
        <div className="smallprint">{[issuer.phone,issuer.email,issuer.address].filter(Boolean).join(' • ')}</div>
        {issuer.registration&&<div className="smallprint">RC: {issuer.registration}</div>}
        {issuer.taxId&&<div className="smallprint">TIN: {issuer.taxId}</div>}</div>
      <div className="receipt-type"><h2>{kindName(document.type)}</h2><small>{document.number}</small></div>
    </header>
    <section className="receipt-meta">
      <div><strong>ISSUED TO</strong><p>{document.customer||'Walk-in customer'}</p>
        {document.customerPhone&&<small>{document.customerPhone}</small>}
        {document.customerEmail&&<small>{document.customerEmail}</small>}
        {document.customerAddress&&<small>{document.customerAddress}</small>}</div>
      <div><strong>DOCUMENT DETAILS</strong><p>Issued: {readableDate(document.date)}</p>
        {document.dueDate&&<small>Due: {readableDate(document.dueDate)}</small>}
        {document.reference&&<small>Ref: {document.reference}</small>}
        <small>Currency: {document.currency}</small></div>
    </section>
    <table className="receipt-items"><thead><tr><th>DESCRIPTION</th><th>QTY</th><th>PRICE</th><th>AMOUNT</th></tr></thead>
      <tbody>{rows.map((item,i)=><tr key={i}><td>{item.description}</td><td>{item.qty}</td><td>{m(item.price)}</td><td>{m(item.qty*item.price)}</td></tr>)}</tbody></table>
    {totals?<div className="receipt-totals">
      <div><span>Subtotal</span><strong>{m(totals.subtotal)}</strong></div>
      {totals.discount>0&&<div><span>Discount ({document.discountPct}%)</span><strong>−{m(totals.discount)}</strong></div>}
      {document.taxPct>0&&<div><span>Tax ({document.taxPct}%)</span><strong>{m(totals.tax)}</strong></div>}
      {totals.shipping>0&&<div><span>Charges</span><strong>{m(totals.shipping)}</strong></div>}
      <div className="total"><span>TOTAL</span><strong>{m(totals.total)}</strong></div>
      {document.paid>0&&<div><span>Received</span><strong>{m(totals.paid)}</strong></div>}
      {BILLABLE_TYPES.has(document.type)&&<div><span>Balance</span><strong>{m(totals.balance)}</strong></div>}
    </div>:<Empty text="Enter a valid item to calculate totals."/>}
    <div className="document-stamp">{document.voided?'VOID':document.draft?'DRAFT':status(document).toUpperCase()}</div>
    <footer className="receipt-footer">
      {document.notes&&<><b>Notes</b><p>{document.notes}</p></>}
      {issuer.bank&&<><b>Payment details</b><p>{[issuer.bank,issuer.accountName,issuer.accountNumber].filter(Boolean).join(' · ')}</p></>}
      <p>{issuer.footer}</p><small>Created with MetaForge Business · {document.number}</small>
    </footer>
  </article>;
}
function LoginScreen({user,alert,note}:{user:User|null;alert:(e:unknown)=>void;note:(text:string)=>void}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[mode,setMode]=useState<'login'|'register'>('login'),[busy,setBusy]=useState(false);
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);
    try{if(mode==='register'){await register(email,password);note('Account created. Verify the email we sent, then sign in.');}
      else await signIn(email,password);}catch(err){alert(err);}finally{setBusy(false);}};
  if(user)return <div className="auth-layout"><Panel><h1>Verify your email</h1><p>Please open the verification email sent to <strong>{user.email}</strong>. Then return here.</p>
    <div className="actions"><Button onClick={async()=>{try{const ok=await refreshEmailVerification();if(ok)window.location.reload();else note('Email is not verified yet.');}catch(e){alert(e);}}} kind="primary">I verified my email</Button><Button onClick={()=>void signOutAccount()}>Sign out</Button></div>
    <p className="hint">Existing MetaForge accounts keep their same Firebase sign-in.</p></Panel></div>;
  return <div className="auth-layout"><div className="auth-brand"><a href="../">M <strong>MetaForge</strong> Business</a><p>Beautiful business documents. Organized sales. One workspace for your team.</p></div>
    <Panel><div className="eyebrow">YOUR BUSINESS ACCOUNT</div><h1>{mode==='login'?'Sign in':'Create a free account'}</h1>
      <p className="muted">No subscription gate is enabled while the product is being expanded.</p>
      <form onSubmit={submit}><Field label="Email" type="email" value={email} onChange={setEmail} required/>
        <Field label="Password" type="password" value={password} onChange={setPassword} required/>
        <Button kind="primary" type="submit" disabled={busy}>{busy?'Working…':mode==='login'?'Sign in':'Create account'}</Button></form>
      <button className="text-button" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'New here? Create an account':'Already have an account? Sign in'}</button>
    </Panel></div>;
}
function BusinessPicker({user,businesses,pick,refresh,alert,note,legacyCount}:{user:User;businesses:Business[];pick:(b:Business)=>void;refresh:()=>Promise<void>;alert:(e:unknown)=>void;note:(s:string)=>void;legacyCount:number}){
  const [name,setName]=useState(''),[slug,setSlug]=useState(''),[busy,setBusy]=useState(false);
  const invitation=parseInviteFromAddress(),expected=slugFromAddress();
  const create=async(e:FormEvent)=>{e.preventDefault();setBusy(true);
    try{const business=await createBusiness(name,slug);
      await saveBusinessProfile(business.id,{name:business.name,phone:'',email:user.email||'',address:'',registration:'',taxId:'',bank:'',accountName:'',accountNumber:'',currency:'NGN',taxDefault:0,accent:'#4855d9',footer:'Thank you for your patronage!',logo:''});
      await refresh();pick(business);note('Business created. Your workspace is ready.');}
    catch(err){alert(err);}finally{setBusy(false);}};
  return <div className="onboard-layout"><header><a href="../" className="brand-link">MetaForge Business</a>
    <div>{user.email} <button className="text-button" onClick={()=>void signOutAccount()}>Sign out</button></div></header>
    <main><div className="eyebrow">BUSINESS ONBOARDING</div><h1>Welcome to your business workspace.</h1><p className="muted">Create a business, or open one you belong to. Each workspace keeps its own staff and history.</p>
      {legacyCount>0&&<div className="legacy-alert"><strong>Upgrade available: {legacyCount} older receipt records detected</strong><p>Continue with your existing account. Create or select a business, then choose “Upgrade old records” to copy them safely. Your existing links stay available.</p></div>}
      {invitation&&<Panel><h2>Staff invitation detected</h2><p>Accept this invitation using the verified email that the business owner invited.</p>
        <Button kind="primary" disabled={busy} onClick={async()=>{setBusy(true);try{const b=await acceptInvitation(invitation.businessId,invitation.token);await refresh();pick(b);note('Invitation accepted.');}catch(e){alert(e);}finally{setBusy(false);}}}>Accept invitation</Button></Panel>}
      {expected&&!businesses.some(b=>b.slug===expected)&&<Panel><h2>Private business address</h2><p>You need an invitation to access this workspace. A branded address alone never grants permission.</p></Panel>}
      {businesses.length>0&&<Panel><h2>My businesses</h2>{businesses.map(b=><button key={b.id} className="business-choice" onClick={()=>pick(b)}>
        <span className="business-avatar">{b.name.slice(0,1).toUpperCase()}</span>
        <span><strong>{b.name}</strong><small>{b.slug} · Open dashboard</small></span><span>↗</span></button>)}</Panel>}
      <Panel><h2>Register a business</h2><p className="muted">Choose an available short address. After the final domain is connected, it can become your branded subdomain.</p>
        <form onSubmit={create}><Field label="Business name" value={name} required onChange={value=>{setName(value);if(slug===slugify(name)||!slug)setSlug(slugify(value));}} placeholder="e.g. Ada Fashion Hub"/>
          <Field label="Business address" value={slug} required onChange={value=>setSlug(slugify(value))} placeholder="ada-fashion"/>
          <p className="hint">{validSlug(slug)?businessUrl(slug):'Use 4–40 lowercase letters, numbers and hyphens.'}</p>
          <Button kind="primary" type="submit" disabled={!validSlug(slug)||busy}>{busy?'Creating…':'Create workspace'}</Button></form></Panel>
    </main></div>;
}
function Editor({document,onChange,save,print,share,back,workspace,busy,role}:{document:BusinessDocument;onChange:(d:BusinessDocument)=>void;save:(draft:boolean)=>void;print:()=>void;share:()=>void;back:()=>void;workspace:WorkspaceData;busy:boolean;role:Role}){
  const set=<K extends keyof BusinessDocument>(key:K,value:BusinessDocument[K])=>onChange({...document,[key]:value});
  const patchLine=(i:number,item:LineItem)=>set('items',document.items.map((row,n)=>n===i?item:row));
  return <>
    <Heading eyebrow="DOCUMENT STUDIO" title="Create and edit business documents" description="Choose a format, edit details and preview exactly what you print."
      action={<><Button onClick={back}>History</Button><Button onClick={()=>save(true)} disabled={busy}>Save draft</Button>
        <Button kind="primary" onClick={()=>save(false)} disabled={busy}>Save & issue</Button></>}/>
    <div className="editor-grid"><div className="editor-form">
      <Panel><h2><span className="step">01</span> Document and style</h2><div className="field-grid">
        <Select label="Document type" value={document.type} options={DOCUMENT_TYPES.filter(t=>canCreateType(role,t[0])).map(t=>[t[0],t[1]])}
          onChange={value=>{const type=value as DocumentType;onChange({...document,type,number:nextNumber(workspace.documents,type,today().slice(0,4))});}}/>
        <Field label="Document number" value={document.number} onChange={value=>set('number',value)}/>
        <Field label="Issue date" type="date" value={document.date} onChange={value=>set('date',value)}/>
        <Field label="Due date" type="date" value={document.dueDate} onChange={value=>set('dueDate',value)}/></div>
        <div className="style-grid">{TEMPLATES.map(t=><button type="button" key={t.id} className={'template-card '+(document.style===t.id?'selected':'')} onClick={()=>set('style',t.id)}>
          <span style={{background:t.accent}}/><strong>{t.name}</strong><small>{t.description}</small></button>)}</div>
      </Panel>
      <Panel><h2><span className="step">02</span> Customer information</h2>
        <Field label="Customer" value={document.customer} onChange={value=>{const found=workspace.customers.find(c=>c.name.toLowerCase()===value.trim().toLowerCase());
          onChange({...document,customer:value,customerPhone:found?.phone||document.customerPhone,customerEmail:found?.email||document.customerEmail,customerAddress:found?.address||document.customerAddress});}} placeholder="Customer name"/>
        <div className="field-grid"><Field label="Phone" value={document.customerPhone} onChange={value=>set('customerPhone',value)}/>
          <Field label="Email" value={document.customerEmail} type="email" onChange={value=>set('customerEmail',value)}/></div>
        <Field label="Address" value={document.customerAddress} onChange={value=>set('customerAddress',value)}/>
        <Field label="Order reference" value={document.reference} onChange={value=>set('reference',value)}/>
      </Panel>
      <Panel><div className="panel-row"><h2><span className="step">03</span> Products & services</h2>
        <button className="text-button" onClick={()=>set('items',[...document.items,{description:'',qty:1,price:0,productId:''}])}>+ Add item</button></div>
        <datalist id="catalog-products">{workspace.products.map(p=><option key={p.id} value={p.name}/>)}</datalist>
        {document.items.map((item,i)=><div className="line-editor" key={i}>
          <label>Item<input list="catalog-products" placeholder="Product or service" value={item.description} onChange={e=>{const value=e.target.value;const matched=workspace.products.find(p=>p.name.toLowerCase()===value.toLowerCase());
            patchLine(i,{...item,description:value,price:matched?.price??item.price,productId:matched?.id||''});}}/></label>
          <label>Qty<input type="number" min=".001" step=".001" value={item.qty} onChange={e=>patchLine(i,{...item,qty:Number(e.target.value)})}/></label>
          <label>Price<input type="number" min="0" step=".01" value={item.price} onChange={e=>patchLine(i,{...item,price:Number(e.target.value)})}/></label>
          <button className="remove-line" disabled={document.items.length===1} onClick={()=>set('items',document.items.filter((_,n)=>n!==i))} aria-label="Remove line">×</button>
        </div>)}
      </Panel>
      <Panel><h2><span className="step">04</span> Charges & payment</h2><div className="field-grid">
        <Field label="Discount %" type="number" min={0} max={100} step=".01" value={document.discountPct} onChange={v=>set('discountPct',Number(v))}/>
        <Field label="Tax / VAT %" type="number" min={0} max={100} step=".01" value={document.taxPct} onChange={v=>set('taxPct',Number(v))}/>
        <Field label="Additional charges" type="number" min={0} step=".01" value={document.shipping} onChange={v=>set('shipping',Number(v))}/>
        <Field label="Amount received" type="number" min={0} step=".01" value={document.paid} onChange={v=>set('paid',Number(v))}/></div>
        <Select label="Payment method" value={document.paymentMethod} options={['Bank transfer','Cash','POS terminal','Card','Mobile money','Other'].map(v=>[v,v])} onChange={v=>set('paymentMethod',v as BusinessDocument['paymentMethod'])}/>
        <label className="field">Notes / payment terms<textarea rows={3} value={document.notes} onChange={e=>set('notes',e.target.value)}/></label>
        <p className="hint">A manually entered payment is not independently verified by a bank or payment provider.</p>
      </Panel>
    </div><aside className="preview-column"><div className="preview-head"><strong>LIVE PREVIEW</strong><div className="actions"><Button onClick={print}>Print / PDF</Button><Button onClick={share}>Share</Button></div></div>
      <div className="paper-surface"><ReceiptPreview document={document} profile={workspace.profile}/></div>
    </aside></div>
  </>;
}

export default function App(){
  const [user,setUser]=useState<User|null>(auth.currentUser),[loading,setLoading]=useState(true);
  const [businesses,setBusinesses]=useState<Business[]>([]),[business,setBusiness]=useState<Business|null>(null),[member,setMember]=useState<Member|null>(null);
  const [workspace,setWorkspace]=useState<WorkspaceData>(emptyWorkspace),[page,setPage]=useState<Page>('overview'),[mobile,setMobile]=useState(false);
  const [document,setDocument]=useState<BusinessDocument>(()=>newDocument(emptyWorkspace()));
  const [profile,setProfile]=useState<BusinessProfile>(emptyWorkspace().profile);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState<{text:string;error:boolean}|null>(null);
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
  const [staff,setStaff]=useState<Member[]>([]),[inviteEmail,setInviteEmail]=useState(''),[inviteRole,setInviteRole]=useState<'admin'|'manager'|'accountant'|'cashier'|'sales'|'viewer'>('cashier'),[inviteLink,setInviteLink]=useState('');
  const [customer,setCustomer]=useState({name:'',phone:'',email:'',address:''});
  const [product,setProduct]=useState({name:'',sku:'',price:0,stock:0,low:5,track:true});
  const [expense,setExpense]=useState({description:'',amount:0,date:today(),category:'Stock purchase'});
  const [migrationSources,setMigrationSources]=useState<LegacySource[]>([]),[migrationWarnings,setMigrationWarnings]=useState<string[]>([]);
  const role=member?.role||'viewer';
  useEffect(()=>{if(member?.role==='viewer'&&page==='overview')setPage('documents');},[member?.role,page]);
  const totals=useMemo(()=>summarize(workspace),[workspace]);
  const alert=(e:unknown)=>setMessage({text:asError(e),error:true});
  const note=(text:string)=>setMessage({text,error:false});
  const loadBusinesses=async()=>setBusinesses(await listMyBusinesses());
  useEffect(()=>onAccountChanged(next=>{setUser(next);setLoading(false);if(!next){setBusiness(null);setMember(null);setBusinesses([]);setWorkspace(emptyWorkspace());}}),[]);
  useEffect(()=>{if(!user?.emailVerified)return;let live=true;
    listMyBusinesses().then(list=>{if(!live)return;setBusinesses(list);
      const matching=list.find(x=>x.slug===slugFromAddress());
      if(matching)setBusiness(matching);
    }).catch(alert);
    return ()=>{live=false;};
  },[user?.uid,user?.emailVerified]);
  useEffect(()=>{if(!user?.emailVerified||!business)return;let live=true;
    setMember(null);
    myMembership(business.id).then(m=>{if(!live)return;
      if(!m||m.status!=='active')throw Error('You do not have permission to access this business.');
      setMember(m);
    }).catch(alert);
    return ()=>{live=false;};
  },[business?.id,user?.uid,user?.emailVerified]);
  useEffect(()=>{if(!business||!member)return;
    let live=true;setWorkspace(emptyWorkspace());
    const connection=observeBusiness(business.id,role,(key,value)=>{
      if(live)setWorkspace(previous=>({...previous,[key]:value}));
    },alert);
    const stopProfile=observeProfile(business.id,next=>{
      if(!live)return;
      if(next){setWorkspace(previous=>({...previous,profile:next}));setProfile(next);}
      else setWorkspace(previous=>({...previous,profile:{...previous.profile,name:business.name}}));
    },alert);
    return ()=>{live=false;connection.stop();stopProfile();};
  },[business?.id,member?.role,member?.status]);
  useEffect(()=>{if(page==='team'&&business&&canAdmin(role))listStaff(business.id).then(setStaff).catch(alert);},[page,business?.id,role]);
  useEffect(()=>{if(!user?.emailVerified)return;
    let live=true;
    detectLegacy().then(value=>{if(live){setMigrationSources(value.sources);setMigrationWarnings(value.warnings);}}).catch(()=>{});
    return ()=>{live=false;};
  },[user?.uid,user?.emailVerified]);
  useEffect(()=>{if(page!=='migration'||!business||role!=='owner')return;
    detectLegacy().then(value=>{setMigrationSources(value.sources);setMigrationWarnings(value.warnings);}).catch(alert);
  },[page,business?.id,role]);
  const chooseBusiness=(b:Business)=>{setBusiness(b);setPage('overview');setMessage(null);};
  const go=(p:Page)=>{setPage(p);setMobile(false);setMessage(null);
    if(p==='create')setDocument(newDocument(workspace,receiptOnly(role)?'receipt':'invoice'));
    if(p==='profile')setProfile({...workspace.profile});
    window.scrollTo(0,0);
  };
  const edit=(item:BusinessDocument)=>{
    setDocument(structuredClone(item));setPage('create');window.scrollTo(0,0);
  };
  const clone=(item:BusinessDocument)=>{
    setDocument({...structuredClone(item),id:newId(),number:nextNumber(workspace.documents,item.type,today().slice(0,4)),
      date:today(),paid:0,draft:true,voided:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),profileSnapshot:null,revisions:[]});
    setPage('create');window.scrollTo(0,0);
  };
  const persistDocument=async(draft:boolean)=>{if(!business)return;
    setBusy(true);try{const saved=await saveCloudDocument(business.id,{...document,draft});
      setDocument(saved);note((draft?'Draft saved: ':'Document issued: ')+saved.number);}
    catch(e){alert(e);}finally{setBusy(false);}};
  const payment=async(item:BusinessDocument)=>{
    if(!business)return;
    const value=prompt('Record additional payment ('+item.currency+'). Confirm it with your payment provider first.','');
    if(value===null)return;
    try{await recordCloudPayment(business.id,item.id,Number(value));note('Payment recorded against '+item.number);}
    catch(e){alert(e);}
  };
  const voidDoc=async(item:BusinessDocument)=>{if(!business||!confirm('Void '+item.number+'? Stock will be restored and the record retained.'))return;
    try{await voidCloudDocument(business.id,item.id);note('Document voided.');}catch(e){alert(e);}
  };
  const share=async(item:BusinessDocument)=>{try{
    const t=calculate(item);
    const content=[item.profileSnapshot?.name||workspace.profile.name,kindName(item.type)+' '+item.number,
      'Date: '+readableDate(item.date),'Customer: '+(item.customer||'Walk-in'),
      ...item.items.filter(i=>i.description.trim()).map(i=>i.description+' × '+i.qty+' — '+money(i.qty*i.price,item.currency)),
      'Total: '+money(t.total,item.currency),'Received: '+money(t.paid,item.currency),'Balance: '+money(t.balance,item.currency),
      'Please request the official PDF from the issuing business.'].join('\n');
    if(navigator.share)await navigator.share({title:item.number,text:content});
    else window.open('https://wa.me/?text='+encodeURIComponent(content),'_blank','noopener,noreferrer');
  }catch(e){if(e instanceof DOMException&&e.name==='AbortError')return;alert(e);}};
  const docList=useMemo(()=>workspace.documents.filter(d=>{
    if(![d.number,d.customer,d.type,...d.items.map(i=>i.description)].join(' ').toLowerCase().includes(search.toLowerCase()))return false;
    if(filter==='draft')return d.draft;
    if(filter==='unpaid')return !d.draft&&!d.voided&&BILLABLE_TYPES.has(d.type)&&calculate(d).balance>0;
    if(filter==='void')return d.voided;
    return true;
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[workspace.documents,search,filter]);
  const listTable=(records:BusinessDocument[],compact=false)=><div className="table-scroll"><table className="data-table"><thead><tr>
    <th>Document</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th>{!compact&&<th>Actions</th>}</tr></thead>
    <tbody>{records.map(d=><tr key={d.id}><td><strong>{d.number}</strong><small>{kindName(d.type)}</small></td>
      <td>{d.customer||'Walk-in'}</td><td>{readableDate(d.date)}</td><td className="money">{money(calculate(d).total,d.currency)}</td><td><DocumentStatus document={d}/></td>
      {!compact&&<td><div className="table-actions">
        {canEditDocument(role,d.type,d.draft)&&!d.voided&&<button onClick={()=>edit(d)}>Edit</button>}
        {canCreateType(role,d.type)&&<button onClick={()=>clone(d)}>Copy</button>}
        <button onClick={()=>{edit(d);setTimeout(()=>window.print(),150);}}>Print</button>
        <button onClick={()=>void share(d)}>Share</button>
        {canEditDocument(role,d.type,d.draft)&&!d.draft&&!d.voided&&BILLABLE_TYPES.has(d.type)&&calculate(d).balance>0&&<button onClick={()=>void payment(d)}>Payment</button>}
        {canAdmin(role)&&!d.voided&&<button onClick={()=>void voidDoc(d)}>Void</button>}
      </div></td>}</tr>)}</tbody></table></div>;
  const saveContact=async(e:FormEvent)=>{e.preventDefault();if(!business)return;
    try{await createCloudCustomer(business.id,{...customer,id:newId()});setCustomer({name:'',phone:'',email:'',address:''});note('Customer saved.');}catch(err){alert(err);}
  };
  const saveProduct=async(e:FormEvent)=>{e.preventDefault();if(!business)return;
    try{await createCloudProduct(business.id,{...product,id:newId()});setProduct({name:'',sku:'',price:0,stock:0,low:5,track:true});note('Product saved.');}catch(err){alert(err);}
  };
  const saveExpense=async(e:FormEvent)=>{e.preventDefault();if(!business)return;
    try{await createCloudExpense(business.id,{...expense,id:newId(),currency:workspace.profile.currency});setExpense({description:'',amount:0,category:'Stock purchase',date:today()});note('Expense recorded.');}catch(err){alert(err);}
  };
  const invite=async(e:FormEvent)=>{e.preventDefault();if(!business)return;
    setBusy(true);try{setInviteLink(await inviteStaff(business,inviteEmail,inviteRole));note('Invite created. Copy the link and share directly with your staff member.');setInviteEmail('');}
    catch(err){alert(err);}finally{setBusy(false);}
  };
  const saveProfile=async(e:FormEvent)=>{e.preventDefault();if(!business)return;
    try{await saveBusinessProfile(business.id,profile);note('Brand profile saved.');}catch(err){alert(err);}
  };
  const exportCsv=(key:'documents'|'customers'|'products'|'expenses')=>{
    const csv=key==='documents'?documentExport(workspace.documents):
      key==='customers'?contactExport(workspace.customers):
      key==='products'?productExport(workspace.products):expenseExport(workspace.expenses);
    downloadText('metaforge-'+key+'-'+today()+'.csv',csv,'text/csv;charset=utf-8');
  };
  if(loading)return <div className="loading">Opening MetaForge Business…</div>;
  if(!user||!user.emailVerified)return <><LoginScreen user={user} alert={alert} note={note}/>
    {message&&<div className={'floating-alert '+(message.error?'error':'')}>{message.text}</div>}</>;
  if(!business)return <><BusinessPicker user={user} businesses={businesses} pick={chooseBusiness} refresh={loadBusinesses} alert={alert} note={note} legacyCount={migrationSources.reduce((n,x)=>n+x.receiptCount,0)}/>
    {message&&<div className={'floating-alert '+(message.error?'error':'')}>{message.text}</div>}</>;
  if(!member)return <div className="loading">Checking business permissions… <Button onClick={()=>setBusiness(null)}>Back</Button>{message?.text}</div>;
  const manage=canAdmin(role);
  const finance=canFinance(role);
  const f=(n:number)=>money(n,workspace.profile.currency);
  return <div className="app-shell">
    <aside className={'sidebar '+(mobile?'open':'')}><a className="brand" href="../"><span className="brandmark">M</span><span><strong>MetaForge</strong><small>BUSINESS</small></span></a>
      <p className="nav-caption">WORKSPACE</p><nav aria-label="Business navigation">
        {PAGE_ITEMS.filter(p=>!p.roles||p.roles.includes(role)).map(p=><button key={p.id} className={'nav-item '+(page===p.id?'active':'')}
          onClick={()=>go(p.id)}><span>{p.symbol}</span> {p.label}</button>)}</nav>
      <div className="sidebar-bottom"><strong>{business.name}</strong><p>{role.toUpperCase()} · {business.slug}</p>
        <button onClick={()=>{setBusiness(null);setMember(null);}}>Switch business ↗</button>
        <a href="../creator/">Advanced receipt designer ↗</a></div></aside>
    <div className="workspace"><header className="topbar">
      <button className="menu-button" onClick={()=>setMobile(!mobile)} aria-label="Toggle navigation" aria-expanded={mobile}>☰</button>
      <div><strong>{business.name}</strong><small>{business.slug} · {role}</small></div>
      <div className="top-actions"><span>● Secure team workspace</span>{canWrite(role)&&<Button kind="primary" onClick={()=>go('create')}>+ New document</Button>}<button className="signout" onClick={()=>void signOutAccount()}>Sign out</button></div>
    </header>
    <main className="main-area">
      {message&&<div className={'notice '+(message.error?'error':'')} role="status">{message.text}<button onClick={()=>setMessage(null)} aria-label="Close">×</button></div>}
      {page==='overview'&&<>
        {role==='owner'&&migrationSources.length>0&&<div className="legacy-alert"><div><strong>Your old MetaForge receipts are ready to upgrade</strong><p>We found {migrationSources.reduce((n,x)=>n+x.receiptCount,0)} records. Choose “Upgrade old records” to safely copy them as drafts. No old record will be deleted.</p></div><Button kind="primary" onClick={()=>go('migration')}>Upgrade records</Button></div>}
        <Heading eyebrow="BUSINESS OVERVIEW" title="Every sale. Clearly accounted for."
          description="Your business records, available to everyone you authorize."
          action={canWrite(role)&&<Button kind="dark" onClick={()=>go('create')}>Create a receipt ↗</Button>}/>
        <div className="stats">{[
          ['Issued sales',f(totals.invoiced),'Invoices and issued receipts'],
          ['Received',f(totals.received),'Manually recorded'],
          ['Outstanding',f(totals.outstanding),'Unpaid customer balances'],
          ...(finance?[['Expenses',f(totals.expenses),'Net cash: '+f(totals.netCash)]]:[])
        ].map(([title,value,caption])=><div className="stat" key={title}><span>{title}</span><strong>{value}</strong><small>{caption}</small></div>)}</div>
        <SalesInsights businessId={business.id} documents={workspace.documents} currency={workspace.profile.currency} role={role}/>
        <div className="two-columns"><Panel><div className="panel-row"><h2>Recent documents</h2><button className="text-button" onClick={()=>go('documents')}>View all</button></div>
          {docList.length?listTable(docList.slice(0,6),true):<Empty text="No documents yet. Create a receipt to get started."/>}</Panel>
          <Panel><h2>Outstanding invoices</h2>{workspace.documents.filter(d=>!d.draft&&!d.voided&&BILLABLE_TYPES.has(d.type)&&calculate(d).balance>0).slice(0,6).map(d=>
            <div className="list-entry" key={d.id}><div><strong>{d.customer||'Walk-in'}</strong><small>{d.number}</small></div><strong>{money(calculate(d).balance,d.currency)}</strong></div>)}
            {!workspace.documents.some(d=>!d.draft&&!d.voided&&BILLABLE_TYPES.has(d.type)&&calculate(d).balance>0)&&<Empty text="No outstanding balances."/>}</Panel>
        </div><div className="subdomain-banner"><div><strong>Business address</strong><p>{businessUrl(business.slug)}</p></div>
          <Button onClick={()=>void navigator.clipboard.writeText(businessUrl(business.slug)).then(()=>note('Address copied.')).catch(alert)}>Copy address</Button></div>
      </>}
      {page==='create'&&canWrite(role)&&<Editor document={document} onChange={setDocument} save={d=>void persistDocument(d)}
        print={()=>window.print()} share={()=>void share(document)} back={()=>go('documents')} workspace={workspace} busy={busy} role={role}/>}
      {page==='documents'&&<>
        <Heading eyebrow="DOCUMENT HISTORY" title="Receipts & invoices" description="View, edit, reprint, share and track payments."
          action={canWrite(role)&&<Button kind="primary" onClick={()=>go('create')}>+ Create document</Button>}/>
        <Panel><div className="filters"><input aria-label="Search documents" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer, number or item…"/>
          <select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter records">
            <option value="all">All</option><option value="draft">Drafts</option><option value="unpaid">Unpaid</option><option value="void">Voided</option></select></div>
          {docList.length?listTable(docList):<Empty text="No matching records."/>}</Panel>
      </>}
      {page==='customers'&&<>
        <Heading eyebrow="CUSTOMERS" title="Customer directory" description="Each business has its own shared customer history."/>
        <div className="two-columns narrow">{canWrite(role)&&<Panel><h2>Add customer</h2><form onSubmit={e=>void saveContact(e)}>
          <Field label="Name" value={customer.name} required onChange={name=>setCustomer(v=>({...v,name}))}/>
          <Field label="Phone" value={customer.phone} onChange={phone=>setCustomer(v=>({...v,phone}))}/>
          <Field label="Email" value={customer.email} type="email" onChange={email=>setCustomer(v=>({...v,email}))}/>
          <Field label="Address" value={customer.address} onChange={address=>setCustomer(v=>({...v,address}))}/>
          <Button kind="primary" type="submit">Save customer</Button></form></Panel>}
          <Panel><h2>Saved customers ({workspace.customers.length})</h2>{workspace.customers.map(c=>
            <div className="list-entry" key={c.id}><div><strong>{c.name}</strong><small>{c.phone||c.email||'No contact'} · {workspace.documents.filter(d=>d.customer===c.name).length} documents</small></div></div>)}
            {!workspace.customers.length&&<Empty text="No customers yet."/>}</Panel></div>
      </>}
      {page==='products'&&<>
        <Heading eyebrow="CATALOG" title="Products & stock" description="Store product prices and track stock when recording issued sales."/>
        <div className="two-columns narrow">{(['owner','admin','manager'] as Role[]).includes(role)&&<Panel><h2>Add product or service</h2><form onSubmit={e=>void saveProduct(e)}>
          <Field label="Item name" value={product.name} required onChange={name=>setProduct(v=>({...v,name}))}/>
          <div className="field-grid">
            <Field label="Price" type="number" min={0} step=".01" value={product.price} onChange={v=>setProduct(p=>({...p,price:Number(v)}))}/>
            <Field label="SKU" value={product.sku} onChange={v=>setProduct(p=>({...p,sku:v}))}/>
            <Field label="Opening stock" type="number" min={0} step=".001" value={product.stock} onChange={v=>setProduct(p=>({...p,stock:Number(v)}))}/>
            <Field label="Low-stock alert" type="number" min={0} step=".001" value={product.low} onChange={v=>setProduct(p=>({...p,low:Number(v)}))}/></div>
          <label className="checkbox"><input type="checkbox" checked={product.track} onChange={e=>setProduct(v=>({...v,track:e.target.checked}))}/> Track stock (uncheck for a service)</label>
          <Button kind="primary" type="submit">Save item</Button></form></Panel>}
          <Panel><h2>Catalog ({workspace.products.length})</h2>{workspace.products.map(p=>
            <div className="list-entry" key={p.id}><div><strong>{p.name}</strong><small>{p.sku||'No SKU'} · {f(p.price)}</small></div><div><strong>{p.track?p.stock+' left':'Service'}</strong>{p.track&&p.stock<=p.low&&<small className="low">Low stock</small>}</div></div>)}
            {!workspace.products.length&&<Empty text="No products yet."/>}</Panel></div>
      </>}
      {page==='expenses'&&finance&&<>
        <Heading eyebrow="FINANCIAL RECORDS" title="Expenses" description="Only owners and administrators can see this section."/>
        <div className="two-columns narrow"><Panel><h2>Record expense</h2><form onSubmit={e=>void saveExpense(e)}>
          <Field label="Description" value={expense.description} onChange={v=>setExpense(p=>({...p,description:v}))} required/>
          <div className="field-grid"><Field label="Amount" value={expense.amount} type="number" min={0} step=".01" onChange={v=>setExpense(p=>({...p,amount:Number(v)}))}/>
          <Field label="Date" value={expense.date} type="date" onChange={v=>setExpense(p=>({...p,date:v}))}/></div>
          <Select label="Category" value={expense.category} onChange={v=>setExpense(p=>({...p,category:v}))} options={['Stock purchase','Rent','Utilities','Transport','Salaries','Marketing','Equipment','Other'].map(v=>[v,v])}/>
          <Button kind="primary" type="submit">Record expense</Button></form></Panel>
          <Panel><h2>Expense records</h2>{workspace.expenses.map(e=><div key={e.id} className="list-entry"><div><strong>{e.description}</strong><small>{e.category} · {readableDate(e.date)}</small></div><strong>{money(e.amount,e.currency)}</strong></div>)}
            {!workspace.expenses.length&&<Empty text="No expenses saved."/>}</Panel></div>
      </>}
      {page==='team'&&manage&&<>
        <Heading eyebrow="TEAM & PERMISSIONS" title="Work together, securely." description="Invite members by email. They must verify their account before joining."/>
        <div className="two-columns narrow"><Panel><h2>Invite staff</h2><form onSubmit={e=>void invite(e)}>
          <Field label="Staff email" type="email" required value={inviteEmail} onChange={setInviteEmail}/>
          <Select label="Role" value={inviteRole} onChange={v=>setInviteRole(v as typeof inviteRole)} options={
            (role==='owner'?['admin','manager','accountant','cashier','sales','viewer']:['manager','accountant','cashier','sales','viewer']).map(r=>[r,r.charAt(0).toUpperCase()+r.slice(1)])}/>
          <Button kind="primary" type="submit" disabled={busy}>Create invite link</Button></form>
          {inviteLink&&<div className="invite-output"><label>Private invitation link<input readOnly value={inviteLink}/></label>
            <Button onClick={()=>void navigator.clipboard.writeText(inviteLink).then(()=>note('Invitation link copied.')).catch(alert)}>Copy invitation</Button></div>}
          <p className="hint">Invites expire in 7 days. No domain email is needed: share the link through WhatsApp or any email account.</p></Panel>
          <Panel><div className="panel-row"><h2>Team ({staff.length})</h2><button className="text-button" onClick={()=>void listStaff(business.id).then(setStaff).catch(alert)}>Refresh</button></div>
            {staff.map(m=><div className="list-entry" key={m.uid}><div><strong>{m.email}</strong><small>{m.role} · {m.status}</small></div>
              {role==='owner'&&m.role!=='owner'&&<div className="actions">
                <button className="text-button" onClick={async()=>{try{await setStaffRole(business.id,m.uid,m.role,m.status!=='active');await listStaff(business.id).then(setStaff);}catch(e){alert(e);}}}>{m.status==='active'?'Suspend':'Reactivate'}</button></div>}
            </div>)}{!staff.length&&<Empty text="No team members yet."/>}</Panel></div>
      </>}
      {page==='profile'&&manage&&<>
        <Heading eyebrow="BRAND IDENTITY" title="Business profile" description="These details appear on your future receipts and invoices."/>
        <Panel><form className="profile-form" onSubmit={e=>void saveProfile(e)}><div className="field-grid">
          {([
            ['name','Business name'],['phone','Phone'],['email','Email'],['address','Address'],
            ['registration','RC / business registration'],['taxId','TIN / tax identifier'],
            ['bank','Bank'],['accountName','Account name'],['accountNumber','Account number']
          ] as const).map(([key,label])=><Field key={key} label={label} value={profile[key]} onChange={v=>setProfile(p=>({...p,[key]:v}))}/>)}
          <Select label="Currency" value={profile.currency} onChange={value=>setProfile(p=>({...p,currency:value as BusinessProfile['currency']}))}
            options={CURRENCIES.map(c=>[c,c])}/>
          <Field label="Default tax %" type="number" min={0} max={100} step=".01" value={profile.taxDefault}
            onChange={v=>setProfile(p=>({...p,taxDefault:Number(v)}))}/>
          <Field label="Brand accent" type="color" value={profile.accent} onChange={v=>setProfile(p=>({...p,accent:v}))}/>
        </div><label className="field">Footer message<textarea rows={3} value={profile.footer} onChange={e=>setProfile(p=>({...p,footer:e.target.value}))}/></label>
          <label className="field">Business logo (PNG, JPEG or WEBP; maximum 500 KB)
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;
              if(f.size>500_000||!['image/png','image/jpeg','image/webp'].includes(f.type)){alert(Error('Choose an image under 500 KB.'));return;}
              const reader=new FileReader();reader.onload=()=>setProfile(p=>({...p,logo:String(reader.result)}));reader.readAsDataURL(f);
            }}/></label>
          {profile.logo&&<img src={profile.logo} alt="Current logo" className="profile-logo"/>}
          <p className="hint">Tax rates must be confirmed for your jurisdiction. This platform does not file tax returns.</p>
          <Button kind="primary" type="submit">Save business profile</Button></form></Panel>
      </>}
      {page==='exports'&&manage&&<>
        <Heading eyebrow="DATA PORTABILITY" title="Export your business records" description="Access your business data independently of any subscription."/>
        <Panel><h2>Download reports</h2><div className="actions">
          {(['documents','customers','products','expenses'] as const).map(key=><Button key={key} onClick={()=>exportCsv(key)}>Export {key} CSV</Button>)}
          <Button kind="primary" onClick={()=>downloadText('metaforge-business-'+today()+'.json',JSON.stringify(workspace,null,2),'application/json')}>Export JSON</Button>
        </div><p className="hint">JSON is a download for archival/review. Cross-business restore is intentionally disabled pending a secure, audited import workflow.</p></Panel>
      </>}
      {page==='migration'&&role==='owner'&&<>
        <Heading eyebrow="LEGACY UPGRADE" title="Move your existing records" description="Your old receipts remain untouched. Review imported drafts before issuing them."/>
        <Panel><h2>Found in your old MetaForge account</h2><p className="muted">{copyLegacyHistoryInfo()}</p>
          {migrationWarnings.map((w,i)=><p key={i} className="warning">{w}</p>)}
          {migrationSources.length?migrationSources.map(source=><div className="list-entry" key={source.source}>
            <div><strong>{source.businessName}</strong><small>{source.kind==='cloud'?'Cloud engine':'This device'} · {source.receiptCount} records</small></div>
            <Button disabled={busy} onClick={async()=>{
              if(!confirm('Copy '+source.receiptCount+' legacy records to '+business.name+' as drafts for review?'))return;
              setBusy(true);try{const result=await importLegacySource(business.id,source,workspace.profile);
                note('Imported '+result.imported+' legacy drafts. Original records remain unchanged.');}
              catch(err){alert(err);}finally{setBusy(false);}
            }}>Copy to workspace</Button></div>):
            <Empty text="No accessible legacy receipts were found in this account or browser. You may still use your old engine and export its history separately."/>}
          <p className="hint">Legacy records without proof of payment are never automatically counted as confirmed sales.</p></Panel>
      </>}
    </main><footer className="page-footer">MetaForge Business · Your business, in order. <a href="../">MetaForge home</a></footer></div>
  </div>;
}
