/**
 * Opt-in, non-destructive migration from original MetaForge receipt engines.
 * Receipts without payment evidence migrate as DRAFTS FOR REVIEW.
 * Nothing is deleted from short_urls or localStorage.
 */
import {collection,doc,getDocs,query,serverTimestamp,where,writeBatch} from 'firebase/firestore';
import {auth,db,requireVerified} from './cloud';
import {newId,today,type BusinessDocument,type DocumentType,type BusinessProfile} from './domain';

interface LegacyRow {
  id?:unknown; date?:unknown; time?:unknown; customer?:unknown;
  total?:unknown; type?:unknown; data?:{
    address?:unknown;items?:Array<Record<string,unknown>>;
    discount?:unknown;vatEnabled?:unknown;words?:unknown;bonusItem?:unknown
  };
}
interface LegacySource {source:string;businessName:string;receiptCount:number;kind:'cloud'|'browser';code?:string}
export interface MigrationPreview {
  sources:LegacySource[];
  count:number;
  warnings:string[];
}
const clean=(x:unknown,n=180)=>String(x??'').slice(0,n);
const toNum=(x:unknown)=>Number(String(x??0).replace(/,/g,''))||0;
const SOURCE_KEY=/^[A-Z0-9]{6}$/i;
const slug=(str:string)=>str.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,90);
function localEntries():Array<{source:string;businessName:string;rows:LegacyRow[]}> {
  const results:Array<{source:string;businessName:string;rows:LegacyRow[]}>= [];
  try {
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key||!key.endsWith('_history')||key.length>200)continue;
      try{
        const value=JSON.parse(localStorage.getItem(key)||'null');
        if(!Array.isArray(value)||value.length>5000)continue;
        const rows=value.filter(x=>x&&typeof x==='object'&&'date' in x&&'data' in x);
        if(rows.length)results.push({source:'browser:'+key,businessName:key.slice(0,-8).replace(/_/g,' '),rows});
      }catch(_){/* ignore unrelated local storage */}
    }
  }catch(_){/* disabled browser storage */}
  return results;
}
export async function detectLegacy():Promise<MigrationPreview> {
  const user=requireVerified();
  const results:LegacySource[]=[];
  const warnings:string[]=[];
  try{
    const owned=await getDocs(query(collection(db,'short_urls'),where('owner_uid','==',user.uid)));
    for(const engine of owned.docs){
      const code=engine.id;
      if(!SOURCE_KEY.test(code))continue;
      try{
        const history=await getDocs(collection(db,'short_urls',code,'receipts'));
        if(history.size)results.push({
          source:'engine:'+code,businessName:clean(engine.data().brandName||'Legacy business',120),
          receiptCount:history.size,kind:'cloud',code
        });
      }catch(_){warnings.push('Could not read history from engine '+code+'. It remains unchanged.');}
    }
  }catch(_){warnings.push('Your older cloud engines could not be listed. Local records can still be checked.');}
  for(const local of localEntries())results.push({
    source:local.source,businessName:local.businessName,
    receiptCount:local.rows.length,kind:'browser'
  });
  return {sources:results,count:results.reduce((n,s)=>n+s.receiptCount,0),warnings};
}
function adaptLegacy(row:LegacyRow,source:string,index:number,profile:BusinessProfile):BusinessDocument{
  const given=clean(row.type,30).toUpperCase();
  const type:DocumentType=given==='RECEIPT'?'receipt':given==='ESTIMATE'?'estimate':given==='QUOTATION'?'quotation':
    given==='PROFORMA'?'proforma':'invoice';
  const sourceData=row.data||{};
  const items=(Array.isArray(sourceData.items)?sourceData.items:[]).slice(0,200).map((item)=>({
    description:clean(item.desc||item.description||'Legacy item'),
    qty:Math.max(.001,toNum(item.qty)||1),
    price:Math.max(0,toNum(item.price)),productId:''
  }));
  if(!items.length)items.push({
    description:'Imported legacy document amount — verify original',qty:1,
    price:Math.max(0,toNum(row.total)),productId:''
  });
  const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(row.date))?clean(row.date):today();
  const originalId=slug(clean(row.id??index));
  const sourceId=slug(source);
  const safeId=('legacy_'+sourceId+'_'+originalId).slice(0,190);
  return {
    id:safeId,number:('OLD-'+sourceId.toUpperCase()+'-'+(index+1)).slice(0,65),
    type,date,dueDate:'',customer:clean(row.customer||'Legacy customer'),
    customerPhone:'',customerEmail:'',customerAddress:clean(sourceData.address),
    reference:'Legacy source: '+source,style:'classic',
    notes:'Imported for review from original MetaForge. The old record did not prove a payment. Confirm quantities, charges, taxes and payment status before issuing. Legacy displayed total: '+clean(row.total,40),
    paymentMethod:'Other',discountPct:0,taxPct:0,shipping:0,paid:0,
    items,draft:true,voided:false,currency:profile.currency,
    profileSnapshot:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revisions:[]
  };
}
export interface ImportResult {found:number;imported:number;skipped:number;source:string}
export async function importLegacySource(businessId:string,source:LegacySource,profile:BusinessProfile):Promise<ImportResult>{
  const user=requireVerified();
  if(!businessId||!source.source)throw Error('Select a business and a migration source.');
  let rows:LegacyRow[]=[];
  if(source.kind==='cloud'){
    if(!source.code||!SOURCE_KEY.test(source.code))throw Error('Invalid legacy engine code.');
    const original=await getDocs(collection(db,'short_urls',source.code,'receipts'));
    // Membership and ownership verified by rules. No client-side account takeover.
    rows=original.docs.map(s=>({...s.data(),id:s.id} as LegacyRow));
  }else{
    const local=localEntries().find(s=>s.source===source.source);
    if(!local)throw Error('Browser history is not on this device.');
    rows=local.rows;
  }
  let imported=0,skipped=0;
  const documents=rows.map((r,i)=>adaptLegacy(r,source.source,i,profile));
  // Grouped writes (under the per-batch operation limit) retain old originals.
  for(let offset=0;offset<documents.length;offset+=150){
    const batch=writeBatch(db);
    const chunk=documents.slice(offset,offset+150);
    const destination=collection(db,'businesses',businessId,'documents');
    for(const record of chunk){
      const marker=doc(db,'businesses',businessId,'legacy_imports',record.id);
      const dest=doc(destination,record.id);
      // Deterministic target IDs make retries safe; do not overwrite edited documents.
      // Checks must be performed server-side via a transaction in a follow-up step.
      // This path deliberately uses create-only semantics via transaction below.
      void marker;void dest;
    }
    await importChunk(businessId,chunk,user.uid);
    imported+=chunk.length;
    void batch;
  }
  return {found:rows.length,imported,skipped,source:source.source};
}
import {runTransaction,getDoc} from 'firebase/firestore';
async function importChunk(businessId:string,documents:BusinessDocument[],actorUid:string):Promise<void>{
  // One transaction per receipt guards idempotency across retries and devices.
  for(const record of documents){
    const destination=doc(db,'businesses',businessId,'documents',record.id);
    const checkpoint=doc(db,'businesses',businessId,'legacy_imports',record.id);
    await runTransaction(db,async tx=>{
      const [existing,marker]=await Promise.all([tx.get(destination),tx.get(checkpoint)]);
      if(marker.exists()||existing.exists())return;
      tx.set(destination,record);
      tx.set(checkpoint,{
        sourceId:record.id,actorUid,createdAt:serverTimestamp(),
        source:record.reference,documentId:record.id
      });
    });
  }
}
export function copyLegacyHistoryInfo():string {
  return 'Your original engine receipts remain at their existing links and in the original browser. Imported drafts are separate copies and require review; no payments are automatically confirmed.';
}
