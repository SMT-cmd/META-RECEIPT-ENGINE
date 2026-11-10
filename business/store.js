/* MetaForge Business Workspace: local-first data, payments, stock and audit-safe document operations.
 * The browser storage in this release is device-local, not multi-user cloud synchronization. */
(function (root, factory) {
  const api = factory(root.MetaForgeCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MetaForgeBusiness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';
  if (!core) throw Error('Load core.js before store.js');
  const KEY = 'metaforge:workspace:v1';
  const MAX_BACKUP_BYTES = 4 * 1024 * 1024;
  const TYPES = core.DOCUMENT_TYPES;
  const CURRENCIES = ['NGN','USD','EUR','GBP','GHS','KES','ZAR','CAD','AUD'];
  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'mf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,12));
  const today = () => new Date().toLocaleDateString('en-CA');
  const now = () => new Date().toISOString();
  const positive = (v, allowZero) => Number.isFinite(Number(v)) && (allowZero ? Number(v) >= 0 : Number(v) > 0);
  const number = (v) => Number(v) || 0;
  const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  function defaults() {
    return { version:1, settings:{name:'My business',email:'',phone:'',address:'',taxId:'',currency:'NGN',tax:0,logo:'',accent:'#4757df',invoiceNotes:'Thank you for your business.'}, documents:[],customers:[],products:[],expenses:[],payments:[],events:[] };
  }
  function assertState(data) {
    if (!data || typeof data !== 'object' || data.version !== 1 || !data.settings || typeof data.settings !== 'object') throw Error('Unsupported backup format.');
    for (const key of ['documents','customers','products','expenses','payments','events']) {
      if (!Array.isArray(data[key]) || data[key].length > 100000) throw Error('Invalid backup collection: '+key);
    }
    if (!CURRENCIES.includes(data.settings.currency)) throw Error('Unsupported backup currency.');
    const ids = new Set();
    for (const section of ['documents','customers','products','expenses','payments']) {
      for (const row of data[section]) {
        if (!row || typeof row.id !== 'string' || row.id.length > 150 || ids.has(section+':'+row.id)) throw Error('Invalid or repeated '+section+' identifier.');
        ids.add(section+':'+row.id);
      }
    }
    for (const d of data.documents) {
      if (!TYPES.some(t=>t.id===d.type) || !Array.isArray(d.items) || d.items.length > 1000) throw Error('Invalid document in backup.');
      core.calculate(d);
    }
    for (const p of data.products) if (!positive(p.openingStock,true) || !positive(p.price,true) || !positive(p.lowStock,true)) throw Error('Invalid product stock or price.');
    for (const e of data.expenses) if (!positive(e.amount,true)) throw Error('Invalid expense amount.');
    for (const p of data.payments) if (!positive(p.amount)) throw Error('Invalid payment amount.');
    return data;
  }
  function read(storage) {
    const target = storage || localStorage;
    const raw = target.getItem(KEY);
    if (!raw) return defaults();
    try { return assertState(JSON.parse(raw)); } catch (e) { throw Error('Local workspace data cannot be read. Export a browser backup before making changes. '+e.message); }
  }
  function write(data, storage) {
    assertState(data);
    const value = JSON.stringify(data);
    if (value.length > MAX_BACKUP_BYTES) throw Error('Workspace storage limit reached. Export your backup before adding more records.');
    (storage || localStorage).setItem(KEY,value);
    return data;
  }
  function backup(data) { assertState(data); return JSON.stringify(data,null,2); }
  function restore(json) {
    if (typeof json !== 'string' || json.length > MAX_BACKUP_BYTES) throw Error('Backup must be under 4 MB.');
    return assertState(JSON.parse(json));
  }
  function event(data, action, text) {
    data.events.unshift({id:uid(),action,text:String(text).slice(0,240),at:now()});
    data.events = data.events.slice(0,200);
  }
  function saveSettings(data, settings) {
    const currency = String(settings.currency || 'NGN');
    if (!CURRENCIES.includes(currency)) throw Error('Choose a supported currency.');
    if (!positive(settings.tax,true) || Number(settings.tax)>100) throw Error('Default tax must be between 0 and 100.');
    const logo = String(settings.logo || '').trim();
    if (logo && !/^https:\/\/[^\s<>"]{1,500}$/i.test(logo)) throw Error('Logo must be a secure HTTPS image URL.');
    data.settings = {
      name:String(settings.name || '').trim().slice(0,120) || 'My business',
      email:String(settings.email || '').trim().slice(0,200),
      phone:String(settings.phone || '').trim().slice(0,100),
      address:String(settings.address || '').trim().slice(0,500),
      taxId:String(settings.taxId || '').trim().slice(0,100),
      currency, tax:Number(settings.tax),logo,
      accent:/^#[0-9a-f]{6}$/i.test(settings.accent || '') ? settings.accent : '#4757df',
      invoiceNotes:String(settings.invoiceNotes || '').slice(0,1500)
    };
    event(data,'settings','Updated business profile');
    return data.settings;
  }
  function saveCustomer(data, fields) {
    const name=String(fields.name || '').trim();
    if (!name) throw Error('Customer name is required.');
    const existing=data.customers.find(c=>c.id===fields.id);
    const row={id:existing ? existing.id : uid(),name:name.slice(0,150),email:String(fields.email||'').trim().slice(0,200),phone:String(fields.phone||'').trim().slice(0,80),address:String(fields.address||'').trim().slice(0,350),notes:String(fields.notes||'').slice(0,800),createdAt:existing?.createdAt||now(),updatedAt:now()};
    if (existing) Object.assign(existing,row); else data.customers.unshift(row);
    event(data,'customer',(existing?'Edited ':'Added ')+row.name);
    return row;
  }
  function saveProduct(data,fields) {
    const name=String(fields.name||'').trim();
    if (!name || !positive(fields.price,true) || !positive(fields.openingStock,true) || !positive(fields.lowStock,true) || !positive(fields.cost||0,true)) throw Error('Provide an item name, non-negative price, cost and stock quantities.');
    const existing=data.products.find(p=>p.id===fields.id);
    const row={id:existing?.id||uid(),name:name.slice(0,150),sku:String(fields.sku||'').trim().slice(0,60),category:String(fields.category||'').trim().slice(0,80),unit:String(fields.unit||'unit').trim().slice(0,30),price:round(number(fields.price)),cost:round(number(fields.cost)),openingStock:number(fields.openingStock),lowStock:number(fields.lowStock),trackStock:fields.trackStock!==false,createdAt:existing?.createdAt||now(),updatedAt:now()};
    if (row.sku && data.products.some(p=>p.id!==row.id && p.sku.toLowerCase()===row.sku.toLowerCase())) throw Error('A product already uses this SKU.');
    if (existing) Object.assign(existing,row); else data.products.unshift(row);
    event(data,'product',(existing?'Edited ':'Added ')+row.name);
    return row;
  }
  function saveExpense(data,fields) {
    const amount=number(fields.amount);
    const description=String(fields.description||'').trim();
    if (!positive(amount) || !description) throw Error('Expense needs a description and amount greater than zero.');
    const old=data.expenses.find(e=>e.id===fields.id);
    const row={id:old?.id||uid(),description:description.slice(0,180),amount:round(amount),date:String(fields.date||today()),category:String(fields.category||'General').slice(0,80),vendor:String(fields.vendor||'').slice(0,150),createdAt:old?.createdAt||now()};
    if (old) Object.assign(old,row); else data.expenses.unshift(row);
    event(data,'expense',(old?'Edited ':'Recorded ')+row.description);
    return row;
  }
  function issued(d) { return !d.draft && !d.voided && core.BILLABLE.has(d.type); }
  function availableStock(data,productId,excludeDocId) {
    const product=data.products.find(p=>p.id===productId);
    if (!product) return null;
    if (!product.trackStock) return Infinity;
    let used=0;
    for(const doc of data.documents) {
      if (!issued(doc) || (excludeDocId && doc.id===excludeDocId)) continue;
      for(const line of doc.items) if (line.productId===productId) used+=number(line.qty);
    }
    return round(number(product.openingStock)-used);
  }
  function stockFor(data,productId) { return availableStock(data,productId); }
  function normalizeItems(items) {
    if (!Array.isArray(items) || !items.length || items.length>1000) throw Error('Add between 1 and 1,000 line items.');
    return items.map(line=>({description:String(line.description||'').trim().slice(0,220),productId:String(line.productId||'').slice(0,150),qty:number(line.qty),price:round(number(line.price))}));
  }
  function prepareDocument(data,fields) {
    const existing=data.documents.find(d=>d.id===fields.id);
    if (!TYPES.some(t=>t.id===fields.type)) throw Error('Select a valid document type.');
    const paid=existing ? number(existing.paid) : number(fields.paid);
    if (!positive(paid,true)) throw Error('Payment cannot be negative.');
    const doc={id:existing?.id||uid(),number:existing?.number||core.numberFor(data.documents,fields.type,fields.date||today()),type:fields.type,style:core.STYLES.some(x=>x.id===fields.style)?fields.style:'signature',date:String(fields.date||today()),dueDate:String(fields.dueDate||''),customerId:String(fields.customerId||'').slice(0,150),buyerName:String(fields.buyerName||'').trim().slice(0,150),items:normalizeItems(fields.items),discountPct:number(fields.discountPct),taxPct:number(fields.taxPct),shipping:number(fields.shipping),paid,notes:String(fields.notes||'').slice(0,3000),draft:Boolean(fields.draft),voided:existing?.voided||false,createdAt:existing?.createdAt||now(),updatedAt:now()};
    if (doc.voided) throw Error('Voided documents cannot be edited. Duplicate it instead.');
    if (!core.BILLABLE.has(doc.type) && paid!==0) throw Error('Record payments against a billable invoice or sales document.');
    const totals=core.calculate(doc);
    if (issued(doc)) {
      const required=new Map();
      for (const item of doc.items) if (item.productId) required.set(item.productId,(required.get(item.productId)||0)+item.qty);
      for (const [id,qty] of required) {
        const product=data.products.find(p=>p.id===id);
        if (!product) throw Error('A selected catalogue product was deleted. Choose a current item.');
        if (product.trackStock && availableStock(data,id,doc.id)<qty) throw Error('Insufficient stock for '+product.name+'. Available: '+availableStock(data,id,doc.id));
      }
    }
    return {doc,existing,totals};
  }
  function saveDocument(data,fields) {
    const {doc,existing}=prepareDocument(data,fields);
    if (existing) Object.assign(existing,doc); else data.documents.unshift(doc);
    if (!existing && doc.paid>0) data.payments.unshift({id:uid(),docId:doc.id,amount:doc.paid,date:doc.date,method:'Initial payment',note:'Received when document was created',at:now()});
    event(data,'document',(existing?'Updated ':'Created ')+doc.number);
    return doc;
  }
  function recordPayment(data,docId,fields) {
    const doc=data.documents.find(d=>d.id===docId);
    if (!doc || doc.voided || doc.draft || !core.BILLABLE.has(doc.type)) throw Error('Choose an issued billable document.');
    const value=round(number(fields.amount));
    if (!positive(value)) throw Error('Payment must be greater than zero.');
    const totals=core.calculate(doc);
    if (Math.round(value*100)>Math.round(totals.balance*100)) throw Error('Payment exceeds the remaining balance.');
    const payment={id:uid(),docId,amount:value,date:String(fields.date||today()),method:String(fields.method||'Bank transfer').slice(0,80),note:String(fields.note||'').slice(0,350),at:now()};
    data.payments.unshift(payment);
    doc.paid=round(doc.paid+value);
    doc.updatedAt=now();
    event(data,'payment','Received '+value+' for '+doc.number);
    return payment;
  }
  function voidDocument(data,id) {
    const doc=data.documents.find(d=>d.id===id);
    if (!doc) throw Error('Document not found.');
    if (doc.voided) throw Error('Already voided.');
    if (doc.paid>0) throw Error('A document with recorded payments cannot be voided. Reconcile or refund payments first.');
    doc.voided=true;
    doc.updatedAt=now();
    event(data,'document','Voided '+doc.number);
  }
  function duplicateDocument(data,id,toType) {
    const old=data.documents.find(d=>d.id===id);
    if (!old) throw Error('Document not found.');
    const type=toType||old.type;
    return saveDocument(data,{...old,id:'',type,number:'',paid:0,draft:true,voided:false,date:today(),dueDate:'',items:old.items.map(x=>({...x})),notes:old.notes});
  }
  function customerBalance(data,id) {
    return round(data.documents.filter(d=>d.customerId===id && issued(d)).reduce((sum,d)=>sum+core.calculate(d).balance,0));
  }
  function financials(data) {
    const base=core.summary(data.documents,data.expenses);
    const productSales=new Map(), customerSales=new Map(), salesByDay=new Map();
    for(const doc of data.documents) {
      if(!issued(doc)) continue;
      const totals=core.calculate(doc);
      const day=doc.date||today();
      salesByDay.set(day,round((salesByDay.get(day)||0)+totals.total));
      const buyer=doc.customerId||'walk-in';
      customerSales.set(buyer,round((customerSales.get(buyer)||0)+totals.total));
      for (const line of doc.items) {
        const key=line.productId||line.description;
        const old=productSales.get(key)||{name:line.description,quantity:0,revenue:0};
        old.quantity+=line.qty; old.revenue=round(old.revenue+line.total);productSales.set(key,old);
      }
    }
    const lowStock=data.products.filter(p=>p.trackStock && stockFor(data,p.id)<=p.lowStock);
    return {...base, lowStock, topProducts:[...productSales.values()].sort((a,b)=>b.revenue-a.revenue),customerSales:[...customerSales.entries()].sort((a,b)=>b[1]-a[1]),salesByDay:[...salesByDay.entries()].sort((a,b)=>a[0].localeCompare(b[0]))};
  }
  function exportDocumentsCsv(data) {
    return core.csv([['Number','Type','Date','Customer','Status','Subtotal','Tax','Total','Paid','Outstanding','Currency'],...data.documents.map(d=>{
      const t=core.calculate(d);
      const customer=data.customers.find(c=>c.id===d.customerId);
      return [d.number,d.type,d.date,customer?.name||d.buyerName||'Walk-in',core.status(d),t.subtotal,t.tax,t.total,t.paid,t.balance,data.settings.currency];
    })]);
  }
  function exportProductsCsv(data) {
    return core.csv([['SKU','Product','Category','Unit','Price','Cost','Opening stock','Available stock','Low-stock limit'],...data.products.map(p=>[p.sku,p.name,p.category,p.unit,p.price,p.cost,p.openingStock,p.trackStock?stockFor(data,p.id):'Not tracked',p.lowStock])]);
  }
  return {KEY,CURRENCIES,defaults,read,write,backup,restore,assertState,uid,today,now,saveSettings,saveCustomer,saveProduct,saveExpense,availableStock,stockFor,prepareDocument,saveDocument,recordPayment,voidDocument,duplicateDocument,customerBalance,financials,exportDocumentsCsv,exportProductsCsv};
});
