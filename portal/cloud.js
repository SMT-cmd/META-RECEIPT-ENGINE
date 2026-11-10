/* MetaForge online tenant API.
 * Uses Firebase Authentication + Firestore. All tenant authorization is enforced
 * by firestore.rules, never by a client role flag alone. No secret keys here.
 */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import {
  getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,
  signOut,sendEmailVerification,sendPasswordResetEmail,reload,getIdToken
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import {
  getFirestore,doc,collection,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc,
  runTransaction,serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import {portalConfig,validateSlug,slugFromHost,tenantUrl} from './config.js';

const app=initializeApp(portalConfig.firebase),auth=getAuth(app),db=getFirestore(app);
const current=()=>auth.currentUser;
const requireUser=()=>{if(!auth.currentUser)throw Error('Sign in before continuing.');return auth.currentUser;};
const requireVerified=async()=>{
  const user=requireUser();await reload(user);await getIdToken(user,true);
  if(!user.emailVerified)throw Error('Verify your email address first, then select “I have verified”.');
  return user;
};
const normalizeEmail=(value)=>{
  const email=String(value||'').trim().toLowerCase();
  if(!/^[^\s/@]{1,64}@[^\s/@]{1,185}\.[^\s/@]{2,}$/.test(email))throw Error('Enter a valid email address.');
  return email;
};
const owner=(slug)=>doc(db,'tenants',slug);
const base=(slug,coll)=>collection(db,'tenants',slug,coll);
const record=(slug,coll,id)=>doc(db,'tenants',slug,coll,id);
const userIndex=slug=>doc(db,'user_spaces',requireUser().uid,'brands',slug);
const uid=()=>crypto.randomUUID();
const compactError=(error)=>{
  if(!error)return 'Something went wrong. Try again.';
  const code=String(error.code||'');
  const mapping={
    'auth/email-already-in-use':'An account already uses that email. Sign in instead.',
    'auth/invalid-credential':'Email or password is incorrect.',
    'auth/weak-password':'Choose a stronger password.',
    'auth/too-many-requests':'Too many attempts. Please retry later.',
    'permission-denied':'Access denied. Verify your email and check your business role.',
    'auth/unauthorized-domain':'This domain needs to be authorized in Firebase Authentication.'
  };
  return mapping[code.replace(/^firestore\//,'')]||String(error.message||'Something went wrong.').slice(0,280);
};
async function register(email,password){
  const result=await createUserWithEmailAndPassword(auth,normalizeEmail(email),String(password));
  await sendEmailVerification(result.user);
  return result.user;
}
async function login(email,password){return (await signInWithEmailAndPassword(auth,normalizeEmail(email),String(password))).user;}
async function verifyAgain(){return requireVerified();}
async function resendVerification(){await sendEmailVerification(requireUser());}
async function resetPassword(email){await sendPasswordResetEmail(auth,normalizeEmail(email));}
async function createBusiness(name,rawSlug){
  const user=await requireVerified();
  const slug=String(rawSlug||'').toLowerCase().trim(),businessName=String(name||'').trim();
  if(!validateSlug(slug))throw Error('Business address must use 3–40 letters, numbers or hyphens, and cannot use reserved words.');
  if(businessName.length<2||businessName.length>120)throw Error('Business name must be between 2 and 120 characters.');
  const listing=await getDoc(doc(db,'tenant_directory',slug));
  if(listing.exists()&&listing.data().ownerUid!==user.uid)throw Error('That business address is taken. Choose another.');
  const ref=owner(slug),data={
    slug,name:businessName,ownerUid:user.uid,currency:'NGN',phone:'',address:'',
    email:normalizeEmail(user.email),brandColor:'#4658d8',createdAt:serverTimestamp()
  };
  // First create reserves the globally unique slug. Existing owners can resume
  // unfinished onboarding without changing the immutable ownerUid field.
  await setDoc(ref,data,{merge:true});
  await setDoc(record(slug,'members',user.uid),{
    uid:user.uid,email:normalizeEmail(user.email),role:'owner',joinedAt:serverTimestamp()
  },{merge:true});
  await setDoc(doc(db,'tenant_directory',slug),{
    slug,name:businessName,ownerUid:user.uid,createdAt:serverTimestamp()
  },{merge:true});
  await setDoc(userIndex(slug),{slug,name:businessName,role:'owner',joinedAt:serverTimestamp()},{merge:true});
  return {slug,name:businessName,url:tenantUrl(slug)};
}
async function myBusinesses(){
  const user=requireUser();
  const rows=await getDocs(collection(db,'user_spaces',user.uid,'brands'));
  return rows.docs.map(d=>({...d.data(),slug:d.id})).sort((a,b)=>a.name.localeCompare(b.name));
}
async function publicBrand(slug){
  const row=await getDoc(doc(db,'tenant_directory',slug));
  return row.exists()?row.data():null;
}
async function joinBusiness(slug) {
  const user=await requireVerified();
  if(!validateSlug(slug))throw Error('Enter a valid business address.');
  const brand=await publicBrand(slug);
  if(!brand)throw Error('No business found at that address.');
  const memberRef=record(slug,'members',user.uid);
  let member=await getDoc(memberRef);
  if(!member.exists()){
    const email=normalizeEmail(user.email);
    const inviteRef=record(slug,'invites',email);
    const invitation=await getDoc(inviteRef);
    if(!invitation.exists()||invitation.data().status!=='pending')throw Error('No active invitation for this verified email. Ask the business owner to invite you.');
    const role=invitation.data().role;
    await setDoc(memberRef,{uid:user.uid,email,role,joinedAt:serverTimestamp()});
    await updateDoc(inviteRef,{status:'accepted',acceptedUid:user.uid,acceptedAt:serverTimestamp()});
    member=await getDoc(memberRef);
  }
  const role=member.data().role;
  await setDoc(userIndex(slug),{slug,name:brand.name,role,joinedAt:serverTimestamp()},{merge:true});
  return {slug,name:brand.name,role};
}
async function inviteStaff(slug,email,role) {
  const user=await requireVerified(),target=normalizeEmail(email);
  if(!['manager','staff','viewer'].includes(role))throw Error('Choose manager, staff or viewer.');
  if(target===normalizeEmail(user.email))throw Error('You already belong to this workspace.');
  await setDoc(record(slug,'invites',target),{
    email:target,role,status:'pending',invitedBy:user.uid,invitedAt:serverTimestamp()
  });
  return {email:target,role,url:tenantUrl(slug)};
}
async function listStaff(slug){
  const [members,invites]=await Promise.all([getDocs(base(slug,'members')),getDocs(base(slug,'invites'))]);
  return {members:members.docs.map(d=>d.data()),invites:invites.docs.map(d=>d.data())};
}
async function revokeInvitation(slug,email){await deleteDoc(record(slug,'invites',normalizeEmail(email)));}
async function removeMember(slug,uid){await deleteDoc(record(slug,'members',uid));}
async function loadWorkspace(slug) {
  const user=requireUser();
  const [business,membership]=await Promise.all([getDoc(owner(slug)),getDoc(record(slug,'members',user.uid))]);
  if(!business.exists())throw Error('The business could not be found or you do not have access.');
  const t=business.data();
  const role=t.ownerUid===user.uid?'owner':membership.exists()?membership.data().role:null;
  if(!role)throw Error('You are not a member of this business.');
  const canManage=['owner','manager'].includes(role);
  const names=['documents','customers','products','payments'];
  if(canManage)names.push('expenses');
  const snapshots=await Promise.all(names.map(name=>getDocs(base(slug,name))));
  const collections={};
  for(let i=0;i<names.length;i++)collections[names[i]]=snapshots[i].docs.map(d=>({id:d.id,...d.data()}));
  collections.expenses||=[];
  return {business:{...t,slug},role,...collections};
}
async function updateBusiness(slug,fields){
  const data={};
  if(fields.name!==undefined){
    data.name=String(fields.name).trim();
    if(data.name.length<2||data.name.length>120)throw Error('Business name must be 2–120 characters.');
  }
  if(fields.currency!==undefined){
    if(!['NGN','USD','GBP','EUR','GHS','KES','ZAR'].includes(fields.currency))throw Error('Unsupported currency.');
    data.currency=fields.currency;
  }
  for(const key of ['phone','address','email'])if(fields[key]!==undefined)data[key]=String(fields[key]).trim().slice(0,180);
  if(fields.brandColor!==undefined && /^#[0-9a-f]{6}$/i.test(fields.brandColor))data.brandColor=fields.brandColor;
  if(!Object.keys(data).length)return;
  await updateDoc(owner(slug),data);
  if(data.name)await updateDoc(doc(db,'tenant_directory',slug),{name:data.name});
}
async function saveCustomer(slug,fields) {
  const name=String(fields.name||'').trim();
  if(!name)throw Error('Customer name is required.');
  const data={
    tenantId:slug,name:name.slice(0,120),email:String(fields.email||'').trim().slice(0,150),
    phone:String(fields.phone||'').trim().slice(0,65),
    address:String(fields.address||'').trim().slice(0,300),
    updatedAt:serverTimestamp()
  };
  if(fields.id)await updateDoc(record(slug,'customers',fields.id),data);
  else await addDoc(base(slug,'customers'),{...data,createdAt:serverTimestamp()});
}
async function saveProduct(slug,fields) {
  const name=String(fields.name||'').trim();
  const stock=Number(fields.stock),price=Number(fields.price);
  if(!name||![stock,price].every(n=>Number.isFinite(n)&&n>=0))throw Error('Provide a name, valid price and non-negative stock.');
  const data={tenantId:slug,name:name.slice(0,150),sku:String(fields.sku||'').slice(0,60),
    stock,price,lowStock:Math.max(0,Number(fields.lowStock)||0),trackStock:fields.trackStock!==false,updatedAt:serverTimestamp()};
  if(fields.id)await updateDoc(record(slug,'products',fields.id),data);
  else await addDoc(base(slug,'products'),{...data,createdAt:serverTimestamp()});
}
async function saveExpense(slug,fields) {
  const amount=Number(fields.amount);
  if(!fields.description||!Number.isFinite(amount)||amount<=0)throw Error('Expense needs a description and a positive amount.');
  await addDoc(base(slug,'expenses'),{
    tenantId:slug,description:String(fields.description).slice(0,180),amount,
    category:String(fields.category||'General').slice(0,80),
    date:String(fields.date||new Date().toLocaleDateString('en-CA')),createdAt:serverTimestamp()
  });
}
const BILLABLE=new Set(['receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt',
  'service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt',
  'invoice','tax-invoice','recurring-invoice']);
function calc(fields){
  const rows=fields.items||[];
  if(!rows.length||rows.some(x=>!String(x.description||'').trim()||!Number.isFinite(Number(x.qty))||Number(x.qty)<=0||!Number.isFinite(Number(x.price))||Number(x.price)<0))throw Error('Complete every item description, quantity and price.');
  const subtotal=rows.reduce((sum,x)=>sum+Math.round(Number(x.qty)*Math.round(Number(x.price)*100)),0);
  const rate=Number(fields.taxPct)||0,discount=Number(fields.discountPct)||0;
  if(rate<0||rate>100||discount<0||discount>100)throw Error('Tax and discount must be between 0% and 100%.');
  const discounted=subtotal-Math.round(subtotal*discount/100);
  return Math.round(discounted+Math.round(discounted*rate/100)+Math.round((Number(fields.shipping)||0)*100))/100;
}
const normalizedLines=rows=>rows.map(x=>({
  description:String(x.description||'').trim().slice(0,220),
  qty:Number(x.qty),price:Number(x.price),productId:String(x.productId||'')
}));
function validateDocument(fields){
  const items=normalizedLines(fields.items||[]);
  if(items.length>100)throw Error('Limit documents to 100 line items.');
  const amountTotal=calc({...fields,items});
  if(!['NGN','USD','GBP','EUR','GHS','KES','ZAR'].includes(fields.currency))throw Error('Unsupported currency.');
  return {items,amountTotal};
}
async function createDocument(slug,fields,issued) {
  const user=await requireVerified();
  const docRef=doc(base(slug,'documents'));
  const {items,amountTotal}=validateDocument(fields);
  const type=String(fields.type||'invoice');
  const typeCfg=[
    ['receipt','REC'],['invoice','INV'],['quotation','QUO'],['estimate','EST'],
    ['proforma','PRO'],['tax-invoice','TAX'],['credit-note','CRN'],['delivery-note','DN'],
    ['thermal-receipt','POS'],['cash-sale','CSH']
  ];
  const prefix=(typeCfg.find(x=>x[0]===type)||['','DOC'])[1];
  const date=String(fields.date||new Date().toLocaleDateString('en-CA')),year=date.slice(0,4);
  const counterRef=record(slug,'counters',type+'-'+year);
  const grouped=new Map();
  if(issued&&BILLABLE.has(type)){
    for(const x of items)if(x.productId)grouped.set(x.productId,(grouped.get(x.productId)||0)+x.qty);
  }
  return runTransaction(db,async tx=>{
    const counterSnap=await tx.get(counterRef);
    const stockRecords=[];
    for(const [id,qty] of grouped){
      const ref=record(slug,'products',id),snapshot=await tx.get(ref);
      if(!snapshot.exists())throw Error('A product was removed from this business.');
      const data=snapshot.data();
      if(data.trackStock!==false && Number(data.stock)<qty)throw Error('Not enough stock for '+data.name+'.');
      stockRecords.push({ref,data,qty});
    }
    const seq=counterSnap.exists()?Number(counterSnap.data().next)+1:1;
    const number=prefix+'-'+year+'-'+String(seq).padStart(4,'0');
    tx.set(counterRef,{next:seq});
    tx.set(docRef,{
      tenantId:slug,createdBy:user.uid,number,type,
      date,dueDate:String(fields.dueDate||''),
      buyerName:String(fields.buyerName||'').trim().slice(0,120),customerId:String(fields.customerId||''),
      items,discountPct:Number(fields.discountPct)||0,taxPct:Number(fields.taxPct)||0,shipping:Number(fields.shipping)||0,
      currency:fields.currency,style:String(fields.style||'signature'),
      notes:String(fields.notes||'').slice(0,1500),amountTotal,paidTotal:0,
      status:issued?'issued':'draft',createdAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
    for(const {ref,data,qty} of stockRecords)if(data.trackStock!==false)
      tx.update(ref,{stock:Math.round((Number(data.stock)-qty)*1000)/1000,updatedAt:serverTimestamp()});
    return {id:docRef.id,number};
  });
}
async function issueDraft(slug,id){
  const ref=record(slug,'documents',id);
  return runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists()||snap.data().status!=='draft')throw Error('Only drafts can be issued.');
    const d=snap.data(),grouped=new Map();
    if(BILLABLE.has(d.type))for(const x of d.items||[])if(x.productId)grouped.set(x.productId,(grouped.get(x.productId)||0)+Number(x.qty));
    const changes=[];
    for(const [pid,qty] of grouped){
      const productRef=record(slug,'products',pid),product=await tx.get(productRef);
      if(!product.exists())throw Error('A catalogue item no longer exists.');
      const v=product.data();
      if(v.trackStock!==false && Number(v.stock)<qty)throw Error('Not enough stock for '+v.name);
      changes.push({productRef,data:v,qty});
    }
    tx.update(ref,{status:'issued',updatedAt:serverTimestamp()});
    for(const x of changes)if(x.data.trackStock!==false)tx.update(x.productRef,{
      stock:Math.round((Number(x.data.stock)-x.qty)*1000)/1000,updatedAt:serverTimestamp()
    });
  });
}
async function recordPayment(slug,documentId,amount,method){
  const user=await requireVerified(),value=Math.round(Number(amount)*100)/100;
  if(!Number.isFinite(value)||value<=0)throw Error('Payment must be greater than zero.');
  const target=record(slug,'documents',documentId),payment=doc(base(slug,'payments'));
  return runTransaction(db,async tx=>{
    const snap=await tx.get(target);
    if(!snap.exists()||snap.data().status!=='issued'||!BILLABLE.has(snap.data().type))throw Error('Only issued billable documents can receive payments.');
    const d=snap.data(),total=Math.round(Number(d.amountTotal)*100),paid=Math.round(Number(d.paidTotal||0)*100),incoming=Math.round(value*100);
    if(incoming>total-paid)throw Error('Payment is higher than the unpaid balance.');
    tx.update(target,{paidTotal:Math.round((paid+incoming))/100,updatedAt:serverTimestamp()});
    tx.set(payment,{tenantId:slug,documentId,amount:value,method:String(method||'Bank transfer').slice(0,65),
      receivedBy:user.uid,createdAt:serverTimestamp()});
  });
}
async function voidDocument(slug,id){
  const ref=record(slug,'documents',id);
  return runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists())throw Error('Document not found.');
    const d=snap.data();
    if(d.status==='void')throw Error('Already voided.');
    if(Number(d.paidTotal||0)>0)throw Error('Paid documents need a refund or reconciliation before voiding.');
    const grouped=new Map();
    if(d.status==='issued'&&BILLABLE.has(d.type))for(const x of d.items||[])if(x.productId)grouped.set(x.productId,(grouped.get(x.productId)||0)+Number(x.qty));
    const changes=[];
    for(const [pid,qty] of grouped){
      const p=record(slug,'products',pid),snap=await tx.get(p);
      if(snap.exists())changes.push({ref:p,data:snap.data(),qty});
    }
    tx.update(ref,{status:'void',updatedAt:serverTimestamp()});
    for(const c of changes)if(c.data.trackStock!==false)
      tx.update(c.ref,{stock:Math.round((Number(c.data.stock)+c.qty)*1000)/1000,updatedAt:serverTimestamp()});
  });
}
export {
  app,auth,db,portalConfig,slugFromHost,tenantUrl,current,compactError,
  onAuthStateChanged,register,login,verifyAgain,resendVerification,resetPassword,
  signOut,createBusiness,myBusinesses,publicBrand,joinBusiness,inviteStaff,listStaff,
  revokeInvitation,removeMember,loadWorkspace,updateBusiness,saveCustomer,saveProduct,
  saveExpense,createDocument,issueDraft,recordPayment,voidDocument,BILLABLE
};
