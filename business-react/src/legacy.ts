/**
 * Opt-in, non-destructive migration from original MetaForge receipt engines.
 * Receipts without payment evidence migrate as DRAFTS FOR REVIEW.
 * Nothing is deleted from short_urls or localStorage.
 */
import {collection,doc,getDocs,query,serverTimestamp,where,getDoc,runTransaction} from 'firebase/firestore';
import {auth,db,requireVerified} from './cloud';
import {today,type BusinessDocument,type DocumentType,type BusinessProfile} from './domain';

interface LegacyRow {
  id?:unknown; date?:unknown; time?:unknown; customer?:unknown;
  total?:unknown; type?:unknown; data?:{
    address?:unknown;items?:Array<Record<string,unknown>>;
    discount?:unknown;vatEnabled?:unknown;words?:unknown;bonusItem?:unknown
  };
}
export interface LegacySource {source:string;businessName:string;receiptCount:number;kind:'cloud'|'browser';code?:string}
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
    const link=await getDoc(doc(db,'short_urls',source.code));
    if(!link.exists()||link.data().owner_uid!==user.uid)throw Error('Only the original owner can import this engine.');
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
  // Original payload is retained as JSON in an immutable owner-only checkpoint.
  // Deterministic IDs make interrupted migrations safe to resume.
  for(let offset=0;offset<documents.length;offset+=100){
    const chunk=documents.slice(offset,offset+100);
    const originals=rows.slice(offset,offset+100);
    const outcome=await importChunk(businessId,chunk,originals,user.uid);
    imported+=outcome.imported;skipped+=outcome.skipped;
  }
  return {found:rows.length,imported,skipped,source:source.source};
}
async function importChunk(
  businessId:string,documents:BusinessDocument[],originals:LegacyRow[],actorUid:string
):Promise<{imported:number;skipped:number}>{
  let imported=0,skipped=0;
  for(let i=0;i<documents.length;i++){
    const record=documents[i],originalJSON=JSON.stringify(originals[i]);
    if(originalJSON.length>700000)throw Error('One old document is too large for Firestore. Export its original data before continuing.');
    const destination=doc(db,'businesses',businessId,'documents',record.id);
    const checkpoint=doc(db,'businesses',businessId,'legacy_imports',record.id);
    const didWrite=await runTransaction(db,async tx=>{
      const [existing,marker]=await Promise.all([tx.get(destination),tx.get(checkpoint)]);
      if(marker.exists()||existing.exists())return false;
      tx.set(destination,record);
      tx.set(checkpoint,{
        sourceId:record.id,actorUid,createdAt:serverTimestamp(),
        source:record.reference,documentId:record.id,
        originalJSON,originalTotal:clean(originals[i].total,60),
        migratedAs:'draft',reviewRequired:true
      });
      return true;
    });
    if(didWrite)imported++;else skipped++;
  }
  return {imported,skipped};
}

export function copyLegacyHistoryInfo():string {
  return 'Your original engine receipts remain at their existing links and in the original browser. Imported drafts are separate copies and require review; no payments are automatically confirmed.';
}
