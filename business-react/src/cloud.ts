/**
 * Bizlano cloud workspace layer (legacy MetaForge Auth identities stay intact).
 * Firebase Auth identifies people; Firestore rules enforce tenancy and roles.
 * A business subdomain is branding/routing, never an authorization boundary.
 */
import {getApp,getApps,initializeApp} from 'firebase/app';
import {
  createUserWithEmailAndPassword,getAuth,onAuthStateChanged,reload,
  sendEmailVerification,signInWithEmailAndPassword,signOut,
  type User
} from 'firebase/auth';
import {
  collection,doc,getDoc,getDocs,onSnapshot,runTransaction,serverTimestamp,
  setDoc,Timestamp,updateDoc,writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import {getFirestore} from 'firebase/firestore';
import {
  BILLABLE_TYPES,calculate,reconcileStock,
  type BusinessDocument,type BusinessProfile,type Customer,type Expense,
  type Product
} from './domain';

const config={
  apiKey:import.meta.env.VITE_FIREBASE_API_KEY||'AIzaSyAElgJBP-F322zoJ-T1qeE48s2ka0EcEvw',
  authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN||'metaforge-6afdf.firebaseapp.com',
  projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID||'metaforge-6afdf',
  appId:import.meta.env.VITE_FIREBASE_APP_ID||'1:261172077627:web:cb3cec74be2dbcb1d6281e',
  messagingSenderId:import.meta.env.VITE_FIREBASE_SENDER_ID||'261172077627'
};
const app=getApps().length?getApp():initializeApp(config);
export const auth=getAuth(app), db=getFirestore(app);
export type Role='owner'|'admin'|'manager'|'accountant'|'cashier'|'sales'|'staff'|'viewer';
export interface Business {id:string;name:string;slug:string;ownerUid:string;}
export interface Member {uid:string;email:string;role:Role;status:'active'|'suspended';inviteId:string;}
export interface Invitation {email:string;role:Exclude<Role,'owner'>;createdBy:string;expiresAt:Timestamp;usedBy:string|null;}
export type CloudListener={stop:()=>void};
const VALID_SLUG=/^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/;
const RESERVED=new Set(['www','app','api','admin','support','help','billing','login','signup','register','business','receipt','mail','smtp','assets','static','tenant','dashboard','root','metaforge','bizlano','timi']);
const rootDomain=(import.meta.env.VITE_TENANT_ROOT_DOMAIN||'').toLowerCase().replace(/^\.+|\.+$/g,'');
export function slugify(value:string):string {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'');
}
export function validSlug(slug:string):boolean{return VALID_SLUG.test(slug)&&!RESERVED.has(slug);}
export function slugFromAddress():string|null {
  const hostname=window.location.hostname.toLowerCase();
  if(rootDomain && hostname.endsWith('.'+rootDomain)){
    const sub=hostname.slice(0,-rootDomain.length-1);
    return validSlug(sub)?sub:null;
  }
  const query=new URLSearchParams(window.location.search).get('shop');
  return query&&validSlug(query)?query:null;
}
export function businessUrl(slug:string):string {
  if(!validSlug(slug))throw Error('Choose a valid business address.');
  if(rootDomain)return 'https://'+slug+'.'+rootDomain+'/';
  // Keep invitations on the React workspace, never the unrelated /business/ local-only app.
  // Works at / in development and at the eventual configured SPA path in production.
  const target=new URL(window.location.pathname,window.location.origin);
  target.searchParams.set('shop',slug);
  return target.toString();
}
export function inviteUrl(slug:string,businessId:string,token:string):string {
  const target=new URL(businessUrl(slug));
  target.searchParams.set('invite',businessId+'.'+token);
  return target.toString();
}
export function parseInviteFromAddress():{businessId:string;token:string}|null {
  const raw=new URLSearchParams(window.location.search).get('invite')||'';
  const match=raw.match(/^([A-Za-z0-9]{15,40})\.([a-f0-9]{40,80})$/);
  return match?{businessId:match[1],token:match[2]}:null;
}
export function requireVerified():User {
  const user=auth.currentUser;
  if(!user)throw Error('Please sign in first.');
  if(!user.emailVerified)throw Error('Verify your email address, then refresh your session.');
  return user;
}
export const onAccountChanged=(callback:(user:User|null)=>void)=>onAuthStateChanged(auth,callback);
export async function register(email:string,password:string):Promise<void> {
  const credential=await createUserWithEmailAndPassword(auth,email.trim().toLowerCase(),password);
  await sendEmailVerification(credential.user);
}
export async function signIn(email:string,password:string):Promise<void> {
  await signInWithEmailAndPassword(auth,email.trim().toLowerCase(),password);
}
export async function refreshEmailVerification():Promise<boolean> {
  if(!auth.currentUser)return false;
  await reload(auth.currentUser);
  return auth.currentUser.emailVerified;
}
export const signOutAccount=()=>signOut(auth);
export async function createBusiness(name:string,desiredSlug:string):Promise<Business> {
  const owner=requireVerified(),slug=desiredSlug.trim().toLowerCase();
  if(!validSlug(slug))throw Error('Use 4–40 lowercase letters, numbers or hyphens; this address may be reserved.');
  const cleanName=name.trim();
  if(cleanName.length<2||cleanName.length>120)throw Error('Business name must be 2–120 characters.');
  const businessDoc=doc(collection(db,'businesses'));
  const reservation=doc(db,'business_slugs',slug);
  const membership=doc(db,'businesses',businessDoc.id,'members',owner.uid);
  const index=doc(db,'account_businesses',owner.uid,'items',businessDoc.id);
  const batch=writeBatch(db);
  batch.set(businessDoc,{slug,name:cleanName,ownerUid:owner.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  batch.set(reservation,{slug,businessId:businessDoc.id,ownerUid:owner.uid,createdAt:serverTimestamp()});
  batch.set(membership,{uid:owner.uid,email:owner.email,role:'owner',status:'active',inviteId:'',joinedAt:serverTimestamp()});
  batch.set(index,{businessId:businessDoc.id,createdAt:serverTimestamp()});
  try {await batch.commit();}
  catch(err){throw Error('Could not create business. The address may already be taken or your email is unverified. '+String(err));}
  return {id:businessDoc.id,name:cleanName,slug,ownerUid:owner.uid};
}
export async function resolveBusiness(slug:string):Promise<Business|null> {
  if(!validSlug(slug))return null;
  const pointer=await getDoc(doc(db,'business_slugs',slug));
  if(!pointer.exists())return null;
  const id=pointer.data().businessId as string;
  const business=await getDoc(doc(db,'businesses',id));
  if(!business.exists())return null;
  return {id,name:business.data().name,slug:business.data().slug,ownerUid:business.data().ownerUid};
}
export async function getBusinessById(id:string):Promise<Business|null> {
  const business=await getDoc(doc(db,'businesses',id));
  return business.exists()?{id,name:business.data().name,slug:business.data().slug,ownerUid:business.data().ownerUid}:null;
}
export async function listMyBusinesses():Promise<Business[]> {
  const user=requireVerified();
  const pointers=await getDocs(collection(db,'account_businesses',user.uid,'items'));
  const results=await Promise.all(pointers.docs.map(d=>getBusinessById(d.id).catch(()=>null)));
  return results.filter((x):x is Business=>x!==null);
}
export async function myMembership(businessId:string):Promise<Member|null> {
  const user=requireVerified();
  const ref=doc(db,'businesses',businessId,'members',user.uid);
  const snap=await getDoc(ref);
  return snap.exists()?snap.data() as Member:null;
}
export async function listStaff(businessId:string):Promise<Member[]> {
  const snap=await getDocs(collection(db,'businesses',businessId,'members'));
  return snap.docs.map(d=>d.data() as Member);
}
function invitationCode():string {
  const bytes=new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function inviteStaff(business:Business,email:string,role:Exclude<Role,'owner'>):Promise<string> {
  const user=requireVerified();
  const normalized=email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw Error('Enter a valid staff email.');
  if(!['admin','manager','accountant','cashier','sales','viewer'].includes(role))throw Error('Choose an available staff role.');
  const token=invitationCode();
  const ref=doc(db,'businesses',business.id,'invites',token);
  await setDoc(ref,{
    email:normalized,role,createdBy:user.uid,createdAt:serverTimestamp(),
    expiresAt:Timestamp.fromMillis(Date.now()+7*24*60*60*1000),
    usedBy:null,usedAt:null
  });
  return inviteUrl(business.slug,business.id,token);
}
export async function acceptInvitation(businessId:string,token:string):Promise<Business> {
  const user=requireVerified();
  if(!/^[a-f0-9]{48}$/.test(token))throw Error('Invalid invitation code.');
  const invite=doc(db,'businesses',businessId,'invites',token);
  const snap=await getDoc(invite);
  if(!snap.exists())throw Error('Invitation was revoked or does not exist.');
  const record=snap.data() as Invitation;
  if(record.usedBy)throw Error('This invitation has already been accepted.');
  if(record.expiresAt.toMillis()<Date.now())throw Error('This invitation has expired.');
  if(record.email!==user.email?.toLowerCase())throw Error('Sign in with the email address that was invited.');
  const member=doc(db,'businesses',businessId,'members',user.uid);
  const pointer=doc(db,'account_businesses',user.uid,'items',businessId);
  const batch=writeBatch(db);
  batch.update(invite,{usedBy:user.uid,usedAt:serverTimestamp()});
  batch.set(member,{uid:user.uid,email:user.email,role:record.role,status:'active',inviteId:token,joinedAt:serverTimestamp()});
  batch.set(pointer,{businessId,createdAt:serverTimestamp()});
  await batch.commit();
  const business=await getBusinessById(businessId);
  if(!business)throw Error('Invitation accepted, but the business could not be loaded.');
  return business;
}
export async function setStaffRole(businessId:string,uid:string,role:Exclude<Role,'owner'>,active:boolean):Promise<void> {
  requireVerified();
  await updateDoc(doc(db,'businesses',businessId,'members',uid),{role,status:active?'active':'suspended'});
}
export async function getBusinessProfile(businessId:string):Promise<BusinessProfile|null> {
  const snap=await getDoc(doc(db,'businesses',businessId,'settings','profile'));
  return snap.exists()?snap.data() as BusinessProfile:null;
}
export async function saveBusinessProfile(businessId:string,profile:BusinessProfile):Promise<void> {
  requireVerified();
  await setDoc(doc(db,'businesses',businessId,'settings','profile'),profile);
}
export interface BusinessCloudCollections {
  documents:BusinessDocument[];customers:Customer[];products:Product[];expenses:Expense[];
}
export function observeBusiness(
  businessId:string, role:Role, onUpdate:(key:keyof BusinessCloudCollections,value:BusinessCloudCollections[keyof BusinessCloudCollections])=>void,
  onError:(error:Error)=>void
):CloudListener {
  const stop:Unsubscribe[]=[];
  const listen=(name:keyof BusinessCloudCollections)=>{
    stop.push(onSnapshot(collection(db,'businesses',businessId,name),snap=>{
      onUpdate(name,snap.docs.map(d=>d.data()) as BusinessCloudCollections[keyof BusinessCloudCollections]);
    },err=>onError(err)));
  };
  listen('documents');
  // View-only staff can open issued documents, but customer PII and the
  // stock catalogue have their own protected collections in Firestore.
  if(role!=='viewer'){listen('customers');listen('products');}
  if(['owner','admin','manager','accountant'].includes(role))listen('expenses');
  return {stop:()=>stop.forEach(unsub=>unsub())};
}
export function observeProfile(businessId:string,callback:(profile:BusinessProfile|null)=>void,onError:(e:Error)=>void):Unsubscribe {
  return onSnapshot(doc(db,'businesses',businessId,'settings','profile'),snapshot=>callback(snapshot.exists()?snapshot.data() as BusinessProfile:null),onError);
}
export async function saveCloudDocument(businessId:string,incoming:BusinessDocument):Promise<BusinessDocument> {
  const user=requireVerified();
  return runTransaction(db,async transaction=>{
    const documentRef=doc(db,'businesses',businessId,'documents',incoming.id);
    const previousSnapshot=await transaction.get(documentRef);
    const previous=previousSnapshot.exists()?previousSnapshot.data() as BusinessDocument:null;
    if(previous?.voided)throw Error('Voided documents cannot be edited.');
    if(previous&&!previous.draft){
      if(incoming.draft)throw Error('An issued document cannot be returned to draft.');
      if(incoming.number!==previous.number)throw Error('An issued document number cannot be changed.');
      if(incoming.paid!==previous.paid)throw Error('Payments changed. Refresh and use the Payment action to record a new payment.');
    }
    if(!incoming.number.trim())throw Error('Enter a document reference.');
    calculate({...incoming,items:incoming.items.filter(x=>x.description.trim())});
    const final:BusinessDocument={...incoming,items:incoming.items.filter(x=>x.description.trim()),
      createdAt:previous?.createdAt||incoming.createdAt,updatedAt:new Date().toISOString(),
      profileSnapshot:previous?.profileSnapshot||incoming.profileSnapshot,
      revisions:[...(previous?.revisions||[]).slice(-9),...(previous&&!previous.draft?[{at:new Date().toISOString(),previous}]:[])]};
    if(!final.draft&&!previous?.profileSnapshot && !final.profileSnapshot) {
      const settings=await transaction.get(doc(db,'businesses',businessId,'settings','profile'));
      final.profileSnapshot=settings.exists()?settings.data() as BusinessProfile:null;
    }
    let counterRef:ReturnType<typeof doc>|null=null;
    let counterValue=0;
    if(!final.draft && (!previous||previous.draft)) {
      const prefix=final.type+'-'+final.date.slice(0,4);
      counterRef=doc(db,'businesses',businessId,'counters',prefix);
      const counter=await transaction.get(counterRef);
      counterValue=counter.exists()?Number(counter.data().last)+1:1;
      const typePrefix=final.type.replace(/[^a-z0-9]/g,'').slice(0,4).toUpperCase();
      final.number=typePrefix+'-'+final.date.slice(0,4)+'-'+String(counterValue).padStart(5,'0');
      // Counter writes happen below, after all transaction reads.
    }
    const ids=[...new Set([...(previous?.items||[]),...final.items].map(i=>i.productId).filter(Boolean))];
    const stocks=await Promise.all(ids.map(id=>transaction.get(doc(db,'businesses',businessId,'products',id))));
    const products=stocks.map(s=>s.exists()?s.data() as Product:null);
    if(products.some(p=>p===null))throw Error('A product in this document has been removed.');
    const reconciled=reconcileStock(products as Product[],previous,final);
    if(counterRef) {
      if(counterValue===1)transaction.set(counterRef,{last:counterValue,prefix:final.type});
      else transaction.update(counterRef,{last:counterValue});
    }
    for(const product of reconciled){
      const previousStock=products.find(p=>p?.id===product.id)?.stock;
      if(product.stock!==previousStock)transaction.update(doc(db,'businesses',businessId,'products',product.id),{stock:product.stock});
    }
    transaction.set(documentRef,final);
    const auditRef=doc(collection(db,'businesses',businessId,'audit'));
    transaction.set(auditRef,{actorUid:user.uid,createdAt:serverTimestamp(),action:previous?'document.updated':'document.created',documentId:final.id,documentNumber:final.number});
    return final;
  });
}
export async function recordCloudPayment(businessId:string,documentId:string,amount:number):Promise<void> {
  const user=requireVerified();
  await runTransaction(db,async tx=>{
    const ref=doc(db,'businesses',businessId,'documents',documentId);
    const snap=await tx.get(ref);if(!snap.exists())throw Error('Document not found.');
    const original=snap.data() as BusinessDocument;
    if(original.voided||original.draft||!BILLABLE_TYPES.has(original.type))throw Error('This document cannot accept payments.');
    const summary=calculate(original);
    if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)>Math.round(summary.balance*100))throw Error('Payment exceeds outstanding balance.');
    tx.update(ref,{paid:Math.round((original.paid+amount)*100)/100,updatedAt:new Date().toISOString()});
    tx.set(doc(collection(db,'businesses',businessId,'audit')),{actorUid:user.uid,action:'payment.recorded',documentId,amount,createdAt:serverTimestamp()});
  });
}
export async function voidCloudDocument(businessId:string,documentId:string):Promise<void> {
  const user=requireVerified();
  await runTransaction(db,async tx=>{
    const ref=doc(db,'businesses',businessId,'documents',documentId);
    const snap=await tx.get(ref);if(!snap.exists())throw Error('Document not found.');
    const document=snap.data() as BusinessDocument;
    if(document.voided)throw Error('Already voided.');
    if(document.paid>0)throw Error('Paid documents cannot be voided. Record a refund and issue a credit note instead.');
    const ids=[...new Set(document.items.map(i=>i.productId).filter(Boolean))];
    const products=await Promise.all(ids.map(id=>tx.get(doc(db,'businesses',businessId,'products',id))));
    const current=products.map(s=>s.exists()?s.data() as Product:null);
    if(current.some(p=>p===null))throw Error('Cannot restore inventory: catalog item missing.');
    const reconciled=reconcileStock(current as Product[],document,null);
    for(const product of reconciled)tx.update(doc(db,'businesses',businessId,'products',product.id),{stock:product.stock});
    tx.update(ref,{voided:true,updatedAt:new Date().toISOString()});
    tx.set(doc(collection(db,'businesses',businessId,'audit')),{actorUid:user.uid,action:'document.voided',documentId,createdAt:serverTimestamp()});
  });
}
export async function createCloudCustomer(businessId:string,customer:Customer):Promise<void> {
  requireVerified();await setDoc(doc(db,'businesses',businessId,'customers',customer.id),customer);
}
export async function createCloudProduct(businessId:string,product:Product):Promise<void> {
  requireVerified();await setDoc(doc(db,'businesses',businessId,'products',product.id),product);
}
export async function createCloudExpense(businessId:string,expense:Expense):Promise<void> {
  requireVerified();await setDoc(doc(db,'businesses',businessId,'expenses',expense.id),expense);
}
export async function deleteCloudExpense(businessId:string,expenseId:string):Promise<void> {
  requireVerified();
  const {deleteDoc}=await import('firebase/firestore');
  await deleteDoc(doc(db,'businesses',businessId,'expenses',expenseId));
}
