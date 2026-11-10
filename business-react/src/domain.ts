export const DOCUMENT_TYPES = [
  ['receipt','Sales Receipt','Sales','REC'],['cash-sale','Cash Sale','Sales','CSH'],
  ['retail-receipt','Retail Receipt','Sales','RTL'],['thermal-receipt','Thermal POS Receipt','Sales','POS'],
  ['restaurant-bill','Restaurant Bill','Sales','RST'],['wholesale-receipt','Wholesale Receipt','Sales','WHL'],
  ['service-receipt','Service Receipt','Sales','SRV'],['payment-receipt','Payment Acknowledgement','Payments','PAY'],
  ['deposit-receipt','Deposit Receipt','Payments','DEP'],['installment-receipt','Instalment Receipt','Payments','INS'],
  ['rent-receipt','Rent Receipt','Industry','RNT'],['school-fees','School Fees Receipt','Industry','SCH'],
  ['medical-receipt','Medical Service Receipt','Industry','MED'],['transport-receipt','Transport Receipt','Industry','TRN'],
  ['event-receipt','Event Booking Receipt','Industry','EVT'],['donation-receipt','Donation Acknowledgement','Industry','DON'],
  ['invoice','Sales Invoice','Billing','INV'],['tax-invoice','Tax Invoice','Billing','TAX'],
  ['proforma','Proforma Invoice','Billing','PRO'],['recurring-invoice','Recurring Invoice','Billing','SUB'],
  ['quotation','Quotation','Estimates','QUO'],['estimate','Estimate','Estimates','EST'],
  ['purchase-order','Purchase Order','Operations','PO'],['delivery-note','Delivery Note','Operations','DN'],
  ['credit-note','Credit Note','Adjustments','CRN'],['debit-note','Debit Note','Adjustments','DBN'],
  ['refund-receipt','Refund Acknowledgement','Adjustments','REF'],['custom','Custom Business Document','Custom','DOC']
] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number][0];
export type DocumentCategory = typeof DOCUMENT_TYPES[number][2];
export type TemplateStyle =
  'signature'|'classic'|'executive'|'retail'|'thermal'|'minimal'|
  'editorial'|'bold'|'artisan'|'medical'|'education'|'hospitality';

export const TEMPLATES: ReadonlyArray<{id:TemplateStyle;name:string;description:string;accent:string}> = [
  {id:'signature',name:'Signature',description:'Modern corporate',accent:'#4855d9'},
  {id:'classic',name:'Classic',description:'Formal letterhead',accent:'#3f4c62'},
  {id:'executive',name:'Executive',description:'Navy & gold',accent:'#203655'},
  {id:'retail',name:'Retail',description:'Shop counter',accent:'#117766'},
  {id:'thermal',name:'Thermal',description:'80mm POS-ready',accent:'#282c31'},
  {id:'minimal',name:'Minimal',description:'Clean typography',accent:'#627084'},
  {id:'editorial',name:'Editorial',description:'Premium aesthetic',accent:'#864269'},
  {id:'bold',name:'Bold',description:'Impactful banner',accent:'#a34c16'},
  {id:'artisan',name:'Artisan',description:'Creative businesses',accent:'#b3584c'},
  {id:'medical',name:'Medical',description:'Health and care',accent:'#207e9b'},
  {id:'education',name:'Education',description:'Institutional',accent:'#554aa5'},
  {id:'hospitality',name:'Hospitality',description:'Events & hotels',accent:'#90612d'}
];

export type Currency = 'NGN'|'USD'|'GBP'|'EUR'|'GHS'|'KES'|'ZAR';
export const CURRENCIES: readonly Currency[] = ['NGN','USD','GBP','EUR','GHS','KES','ZAR'];
export type PaymentMethod = 'Bank transfer'|'Cash'|'POS terminal'|'Card'|'Mobile money'|'Other';
export interface BusinessProfile {
  name:string;phone:string;email:string;address:string;registration:string;taxId:string;
  bank:string;accountName:string;accountNumber:string;currency:Currency;
  taxDefault:number;accent:string;footer:string;logo:string;
}
export interface LineItem { description:string;qty:number;price:number;productId:string }
export interface BusinessDocument {
  id:string;number:string;type:DocumentType;date:string;dueDate:string;customer:string;
  customerPhone:string;customerEmail:string;customerAddress:string;reference:string;
  style:TemplateStyle;notes:string;paymentMethod:PaymentMethod;
  discountPct:number;taxPct:number;shipping:number;paid:number;
  items:LineItem[];draft:boolean;voided:boolean;currency:Currency;
  createdAt:string;updatedAt:string;profileSnapshot?:BusinessProfile|null;
  revisions?:Array<{at:string;previous:Partial<BusinessDocument>}>;
}
export interface Customer {
  id:string;name:string;phone:string;email:string;address:string;
}
export interface Product {
  id:string;name:string;sku:string;price:number;stock:number;low:number;track:boolean;
}
export interface Expense {
  id:string;description:string;category:string;date:string;amount:number;currency:Currency;
}
export interface AuditEvent {id:string;action:string;detail:string;at:string}
export interface WorkspaceData {
  schemaVersion:1;profile:BusinessProfile;
  documents:BusinessDocument[];customers:Customer[];products:Product[];
  expenses:Expense[];audit:AuditEvent[];
}
export interface Totals {
  lines:Array<LineItem&{total:number}>;
  subtotal:number;discount:number;tax:number;shipping:number;
  total:number;paid:number;balance:number;
}
export const BILLABLE_TYPES: ReadonlySet<DocumentType> = new Set<DocumentType>([
  'receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt',
  'service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt',
  'event-receipt','invoice','tax-invoice','recurring-invoice'
]);
const cents = (value:number):number => Math.round((value+Number.EPSILON)*100);
const units = (value:number):number => Math.round(value)/100;
const finiteNonnegative = (value:number):boolean => Number.isFinite(value)&&value>=0;
export function calculate(doc:Pick<BusinessDocument,'items'|'taxPct'|'discountPct'|'shipping'|'paid'>):Totals {
  if(!doc.items.length) throw Error('Add at least one product or service.');
  let subtotal=0;
  const lines=doc.items.map(item=>{
    if(!item.description.trim())throw Error('Every line needs a description.');
    if(!Number.isFinite(item.qty)||item.qty<=0||!finiteNonnegative(item.price))
      throw Error('Check item quantity and price.');
    const value=Math.round(item.qty*cents(item.price));
    subtotal+=value;
    return {...item,total:units(value)};
  });
  if(![doc.discountPct,doc.taxPct].every(n=>Number.isFinite(n)&&n>=0&&n<=100))
    throw Error('Discount and tax must be from 0 to 100%.');
  if(!finiteNonnegative(doc.shipping)||!finiteNonnegative(doc.paid))
    throw Error('Shipping and payments cannot be negative.');
  const discount=Math.round(subtotal*doc.discountPct/100);
  const taxable=subtotal-discount;
  const tax=Math.round(taxable*doc.taxPct/100);
  const total=taxable+tax+cents(doc.shipping);
  const paid=cents(doc.paid);
  if(paid>total)throw Error('Received amount cannot exceed the total.');
  return {lines,subtotal:units(subtotal),discount:units(discount),tax:units(tax),
    shipping:units(cents(doc.shipping)),total:units(total),paid:units(paid),balance:units(total-paid)};
}
export type DocumentStatus = 'Draft'|'Voided'|'Issued'|'Paid'|'Part-paid'|'Unpaid'|'Overdue';
export function status(doc:BusinessDocument,today=new Date().toISOString().slice(0,10)):DocumentStatus {
  if(doc.voided)return 'Voided';
  if(doc.draft)return 'Draft';
  if(!BILLABLE_TYPES.has(doc.type))return 'Issued';
  const s=calculate(doc);
  if(s.balance===0)return 'Paid';
  if(s.paid>0)return 'Part-paid';
  return doc.dueDate&&doc.dueDate<today?'Overdue':'Unpaid';
}
export function nextNumber(docs:readonly BusinessDocument[],type:DocumentType,year:string):string {
  const info=DOCUMENT_TYPES.find(row=>row[0]===type)!;
  const prefix=info[3]+'-'+year+'-';
  const max=docs.reduce((last,doc)=>{
    if(!doc.number.startsWith(prefix))return last;
    return Math.max(last,Number(doc.number.slice(prefix.length))||0);
  },0);
  return prefix+String(max+1).padStart(4,'0');
}
export function money(value:number,currency:Currency='NGN'):string {
  return new Intl.NumberFormat('en-NG',{style:'currency',currency,minimumFractionDigits:2}).format(value);
}
export interface FinancialSummary {invoiced:number;received:number;outstanding:number;expenses:number;netCash:number;sales:number}
export function summarize(data:WorkspaceData):FinancialSummary {
  const docs=data.documents.filter(d=>!d.voided&&!d.draft&&BILLABLE_TYPES.has(d.type)&&d.currency===data.profile.currency);
  const totals=docs.map(calculate);
  const sum=(values:number[]):number=>Math.round(values.reduce((a,b)=>a+b,0)*100)/100;
  const invoiced=sum(totals.map(t=>t.total));
  const received=sum(totals.map(t=>t.paid));
  const outstanding=sum(totals.map(t=>t.balance));
  const expenses=sum(data.expenses.filter(e=>e.currency===data.profile.currency).map(e=>e.amount));
  return {invoiced,received,outstanding,expenses,netCash:Math.round((received-expenses)*100)/100,sales:docs.length};
}
export function today():string {
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
export function newId():string {
  return typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2);
}
export function blankProfile():BusinessProfile {return {
  name:'My Business',phone:'',email:'',address:'',registration:'',taxId:'',
  bank:'',accountName:'',accountNumber:'',currency:'NGN',
  taxDefault:0,accent:'#4855d9',footer:'Thank you for your patronage!',logo:''
};}
export function emptyWorkspace():WorkspaceData{return {schemaVersion:1,profile:blankProfile(),documents:[],customers:[],products:[],expenses:[],audit:[]};}
export function newDocument(data:WorkspaceData,type:DocumentType='invoice'):BusinessDocument {
  const time=new Date().toISOString();return {
    id:newId(),number:nextNumber(data.documents,type,today().slice(0,4)),type,date:today(),dueDate:'',
    customer:'',customerPhone:'',customerEmail:'',customerAddress:'',reference:'',
    style:'signature',notes:'',paymentMethod:'Bank transfer',
    discountPct:0,taxPct:data.profile.taxDefault,shipping:0,paid:0,
    items:[{description:'',qty:1,price:0,productId:''}],draft:true,voided:false,
    currency:data.profile.currency,createdAt:time,updatedAt:time,profileSnapshot:null,revisions:[]
  };
}
/** Returns a new inventory list. No mutation if the transaction fails. */
export function reconcileStock(products:readonly Product[],previous:BusinessDocument|null,next:BusinessDocument|null):Product[] {
  const result=products.map(product=>({...product}));
  const apply=(doc:BusinessDocument|null,direction:1|-1)=>{
    if(!doc||doc.draft||doc.voided||!BILLABLE_TYPES.has(doc.type))return;
    for(const item of doc.items){
      if(!item.productId)continue;
      const itemProduct=result.find(p=>p.id===item.productId);
      if(!itemProduct)throw Error('A document item is missing from the product catalog.');
      if(itemProduct.track){
        itemProduct.stock=Math.round((itemProduct.stock+direction*item.qty)*1000)/1000;
        if(itemProduct.stock<0)throw Error('Insufficient stock for '+itemProduct.name+'.');
      }
    }
  };
  apply(previous,1);apply(next,-1);
  return result;
}
