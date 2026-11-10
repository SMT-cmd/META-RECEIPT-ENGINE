import type {BusinessDocument,Customer,Expense,Product,WorkspaceData} from './domain';
import {BILLABLE_TYPES,calculate,reconcileStock,blankProfile,emptyWorkspace,newId} from './domain';

const KEY='metaforge-business-react-v1';
const LEGACY_KEY='metaforge-business-v1';
const schemaValid=(x:unknown):x is WorkspaceData=>{
  if(!x||typeof x!=='object')return false;
  const data=x as Partial<WorkspaceData>;
  return data.schemaVersion===1&&!!data.profile&&typeof data.profile==='object'
    &&Array.isArray(data.documents)&&Array.isArray(data.customers)
    &&Array.isArray(data.products)&&Array.isArray(data.expenses)
    &&data.documents.length<=10000&&data.customers.length<=10000
    &&data.products.length<=10000&&data.expenses.length<=10000;
};
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
export function readWorkspace():WorkspaceData {
  try{
    const raw=localStorage.getItem(KEY);
    if(raw){
      const stored:unknown=JSON.parse(raw);
      if(schemaValid(stored)){
        return {...emptyWorkspace(),...stored,
          profile:{...blankProfile(),...stored.profile},
          audit:Array.isArray(stored.audit)?stored.audit.slice(-2000):[]};
      }
    }
  }catch(_){/* invalid local state leaves the workspace empty */}
  return emptyWorkspace();
}
export function hasLegacyWorkspace():boolean {
  if(localStorage.getItem(KEY))return false;
  try{
    const legacy:unknown=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null');
    return schemaValid(legacy)&&(
      legacy.documents.length>0||legacy.customers.length>0||legacy.products.length>0);
  }catch(_){return false;}
}
export function importLegacyWorkspace():WorkspaceData {
  const legacy:unknown=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null');
  if(!schemaValid(legacy))throw Error('No compatible legacy workspace was found.');
  const imported:WorkspaceData={...emptyWorkspace(),...clone(legacy),
    profile:{...blankProfile(),...legacy.profile},
    audit:Array.isArray(legacy.audit)?legacy.audit:[]};
  saveWorkspace(imported);
  return imported;
}
export function saveWorkspace(data:WorkspaceData):void {
  if(!schemaValid(data))throw Error('Invalid workspace data.');
  try{localStorage.setItem(KEY,JSON.stringify(data));}
  catch(_){throw Error('Could not save to this device. Storage may be disabled or full. Export your backup.');}
}
export function addAudit(data:WorkspaceData,action:string,detail:string):WorkspaceData {
  return {...data,audit:[...data.audit.slice(-1999),{id:newId(),action,detail:detail.slice(0,180),at:new Date().toISOString()}]};
}
export function recordDocument(data:WorkspaceData,incoming:BusinessDocument):WorkspaceData {
  const existing=data.documents.find(d=>d.id===incoming.id);
  if(existing?.voided)throw Error('Voided documents cannot be changed. Duplicate instead.');
  if(data.documents.some(d=>d.id!==incoming.id&&d.number.toLowerCase()===incoming.number.toLowerCase()))
    throw Error('This document number already exists.');
  calculate(incoming);
  if(!incoming.draft&&BILLABLE_TYPES.has(incoming.type)&&
    (incoming.type.includes('receipt')||incoming.type==='cash-sale')&&incoming.paid<=0)
    throw Error('Receipt must include a received payment. Issue an invoice for an unpaid sale.');
  const updated={...incoming,createdAt:existing?.createdAt||incoming.createdAt,
    updatedAt:new Date().toISOString(),
    profileSnapshot:existing?.profileSnapshot||(!incoming.draft?clone(data.profile):null),
    revisions:[...(existing?.revisions||[]).slice(-9),
      ...(existing&&!existing.draft?[{at:new Date().toISOString(),previous:existing}]:[])]};
  const products=reconcileStock(data.products,existing||null,updated);
  const documents=existing?data.documents.map(d=>d.id===updated.id?updated:d):[...data.documents,updated];
  let customers=data.customers;
  if(updated.customer&&!customers.some(c=>c.name.toLowerCase()===updated.customer.toLowerCase())){
    customers=[...customers,{id:newId(),name:updated.customer,phone:updated.customerPhone,email:updated.customerEmail,address:updated.customerAddress}];
  }
  return addAudit({...data,products,documents,customers},existing?'document.updated':'document.created',updated.number);
}
export function recordPayment(data:WorkspaceData,id:string,amount:number):WorkspaceData {
  const existing=data.documents.find(d=>d.id===id);
  if(!existing||existing.draft||existing.voided||!BILLABLE_TYPES.has(existing.type))
    throw Error('Only issued sales documents can receive payments.');
  const total=calculate(existing);
  if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)>Math.round(total.balance*100))
    throw Error('Payment must be positive and cannot exceed the balance.');
  const updated:BusinessDocument={...existing,paid:Math.round((existing.paid+amount)*100)/100,
    updatedAt:new Date().toISOString(),
    revisions:[...(existing.revisions||[]).slice(-9),{at:new Date().toISOString(),previous:existing}]};
  return addAudit({...data,documents:data.documents.map(d=>d.id===id?updated:d)},'payment.recorded',existing.number);
}
export function voidDocument(data:WorkspaceData,id:string):WorkspaceData {
  const existing=data.documents.find(d=>d.id===id);
  if(!existing||existing.voided)throw Error('Document is missing or already voided.');
  const products=reconcileStock(data.products,existing,null);
  return addAudit({...data,products,documents:data.documents.map(d=>
    d.id===id?{...d,voided:true,updatedAt:new Date().toISOString()}:d
  )},'document.voided',existing.number);
}
export function parseBackup(content:string):WorkspaceData {
  const value:unknown=JSON.parse(content);
  if(!schemaValid(value))throw Error('Not a supported MetaForge Business backup.');
  return {...emptyWorkspace(),...value,
    profile:{...blankProfile(),...value.profile},audit:Array.isArray(value.audit)?value.audit.slice(-2000):[]};
}
export function downloadText(filename:string,content:string,type:string):void {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');link.href=url;link.download=filename;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function csv(rows:unknown[][]):string {
  const value=(cell:unknown)=>{const string=String(cell??'');
    return '"'+(/^[=+\-@\t\r]/.test(string)?"'"+string:string).replace(/"/g,'""')+'"';};
  return '\uFEFF'+rows.map(row=>row.map(value).join(',')).join('\r\n');
}
export function documentExport(documents:BusinessDocument[]):string {
  return csv([['Number','Type','Date','Due','Customer','Currency','Total','Paid','Balance','Status'],
    ...documents.map(d=>{
      let total=0,balance=0;try{({total,balance}=calculate(d));}catch(_){}
      return [d.number,d.type,d.date,d.dueDate,d.customer,d.currency,total,d.paid,balance,d.draft?'Draft':d.voided?'Voided':'Issued'];
    })]);
}
export function contactExport(customers:Customer[]):string {
  return csv([['Name','Phone','Email','Address'],...customers.map(c=>[c.name,c.phone,c.email,c.address])]);
}
export function productExport(products:Product[]):string {
  return csv([['Name','SKU','Price','Stock','Low stock threshold','Track stock'],
    ...products.map(p=>[p.name,p.sku,p.price,p.stock,p.low,p.track])]);
}
export function expenseExport(expenses:Expense[]):string {
  return csv([['Date','Description','Category','Amount','Currency'],
    ...expenses.map(e=>[e.date,e.description,e.category,e.amount,e.currency])]);
}
