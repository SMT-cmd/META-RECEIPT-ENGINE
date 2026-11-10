/* MetaForge legacy migration — no deletion, no network access, deterministic draft staging.
   This adapter deliberately does not treat unverified old totals as live revenue. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MetaForgeLegacyMigration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CURRENT_KEY='metaforge-business-v1';
  const VERSION=1;
  const MAX_HISTORY=10000;
  const iso=(x)=>{
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(x||'')))return x;
    const t=Date.parse(String(x||''));
    return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):new Date().toISOString().slice(0,10);
  };
  function readLocal(storage) {
    const histories=[],errors=[],metadata={};
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);
      if(!key)continue;
      if(key.endsWith('_history')){
        try {
          const value=JSON.parse(storage.getItem(key)||'null');
          if(!Array.isArray(value)||!value.every(x=>x&&typeof x==='object'))
            continue;
          if(!value.some(x=>'customer' in x||'data' in x||'type' in x))
            continue;
          if(value.length>MAX_HISTORY){errors.push('Local history '+key+' exceeds the safe import limit.');continue;}
          histories.push({key,brandName:key.slice(0,-8).replace(/_/g,' '),receipts:value});
        } catch(e){errors.push('Local history '+key+' could not be read.');}
      }
      if(['meta_receipt_engine_config'].includes(key)){
        try{const value=JSON.parse(storage.getItem(key)||'null');if(value&&typeof value==='object')metadata[key]=value;}
        catch(e){errors.push('Saved engine configuration is malformed.');}
      }
    }
    return {histories,metadata,errors};
  }
  function summarize(archive){
    const engines=Array.isArray(archive.engines)?archive.engines:[];
    const locals=Array.isArray(archive.local?.histories)?archive.histories||archive.local.histories:[];
    const legacyReceipts=engines.reduce((s,e)=>s+(e.receipts?.length||0),0);
    const localReceipts=locals.reduce((s,e)=>s+(e.receipts?.length||0),0);
    return {engines:engines.length,cloudReceipts:legacyReceipts,localReceipts,issues:(archive.issues||[]).length+(archive.local?.errors||[]).length};
  }
  function documentType(value) {
    const k=String(value||'').toLowerCase();
    if(k.includes('proforma'))return 'proforma';
    if(k.includes('quotation')||k.includes('quote'))return 'quotation';
    if(k.includes('estimate'))return 'estimate';
    if(k.includes('invoice'))return 'invoice';
    if(k.includes('receipt'))return 'receipt';
    return 'custom';
  }
  function toNumber(input){
    if(input===null||input===undefined||String(input).trim()==='')return 0;
    const n=Number(String(input).replace(/,/g,'').replace(/[₦$£€\s]/g,''));
    return Number.isFinite(n)&&n>=0?n:NaN;
  }
  function sanitizeItems(receipt){
    const source=receipt?.data?.items;
    if(!Array.isArray(source)||source.length>1000)return null;
    const lines=source.map(item=>{
      const description=String(item.desc||item.description||'').trim().slice(0,180);
      const qty=toNumber(item.qty??1),price=toNumber(item.price??item.unitPrice);
      return {description,qty,price,productId:''};
    });
    return lines.length&&lines.every(x=>x.description&&Number.isFinite(x.qty)&&x.qty>0&&Number.isFinite(x.price))?lines:null;
  }
  function stableId(text){
    let h1=2166136261,h2=16777619;
    for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);h1=Math.imul(h1^c,16777619);h2=Math.imul(h2^c,2246822519);}
    return (h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0');
  }
  function migrateArchive(archive,current,options={}){
    if(!archive||archive.kind!=='metaforge-legacy' || archive.version!==VERSION)throw Error('Choose a compatible MetaForge legacy archive.');
    if(!current||current.schemaVersion!==1||!Array.isArray(current.documents)||!Array.isArray(current.customers))
      throw Error('Business workspace format is not compatible.');
    const existingIds=new Set(current.documents.map(d=>d.id));
    const existingNumbers=new Set(current.documents.map(d=>String(d.number||'').toLowerCase()));
    const incoming=[],skipped=[];
    const sources=[
      ...(archive.engines||[]).map(e=>({source:'cloud:'+e.code,brand:e.brandName||e.code,receipts:e.receipts||[]})),
      ...(archive.local?.histories||[]).map(e=>({source:'local:'+e.key,brand:e.brandName||e.key,receipts:e.receipts||[]}))
    ];
    if(sources.length>11000)throw Error('Archive has too many sources.');
    const stamp=new Date().toISOString();
    for(const source of sources){
      if(!Array.isArray(source.receipts)||source.receipts.length>MAX_HISTORY){skipped.push(source.source+': history exceeds limit');continue;}
      for(const [index,receipt] of source.receipts.entries()){
        if(!receipt||typeof receipt!=='object'){skipped.push(source.source+': invalid entry #'+(index+1));continue;}
        const fingerprint=[archive.userUid||'',source.source,receipt.id??index].join('|');
        const id='legacy-'+stableId(fingerprint);
        if(existingIds.has(id))continue;
        const lines=sanitizeItems(receipt);
        if(!lines){skipped.push(source.source+': '+(receipt.id??index)+' missing reliable item details; preserved in archive');continue;}
        const type=documentType(receipt.type);
        let documentNumber='LEG-'+stableId(fingerprint).toUpperCase().slice(0,10);
        for(let suffix=2;existingNumbers.has(documentNumber.toLowerCase());suffix++)documentNumber='LEG-'+stableId(fingerprint).toUpperCase().slice(0,8)+'-'+suffix;
        existingNumbers.add(documentNumber.toLowerCase());
        const amount=String(receipt.total??'').slice(0,90);
        const doc={
          id,number:documentNumber,type,
          date:iso(receipt.date),dueDate:'',
          customer:String(receipt.customer||'Walk-in').slice(0,100),
          customerPhone:'',customerEmail:'',customerAddress:String(receipt.data?.address||'').slice(0,240),
          reference:String(receipt.id||'').slice(0,90),
          style:'signature',
          notes:[
            'Imported legacy document — REVIEW BEFORE ISSUING.',
            'Original business: '+source.brand,
            'Original type: '+String(receipt.type||'').slice(0,60),
            'Original displayed total: '+amount,
            'Source: '+source.source,
            'Original records have not been changed.'
          ].join('\n'),
          paymentMethod:'Other',discountPct:0,taxPct:0,shipping:0,paid:0,
          items:lines,draft:true,voided:false,
          currency:current.profile.currency,
          createdAt:stamp,updatedAt:stamp,legacySource:fingerprint
        };
        incoming.push(doc);
        existingIds.add(id);
      }
    }
    const preview={importable:incoming.length,skipped:skipped.length,existing:current.documents.length,issues:skipped.slice(0,25)};
    const result={
      ...current,
      documents:[...current.documents,...incoming],
      audit:[...(current.audit||[]),{id:'legacy-import-'+stableId(stamp),action:'legacy.import',detail:incoming.length+' review drafts staged from legacy backup',at:stamp}],
      profile:{...current.profile,name:current.profile.name==='My Business'&&options.businessName?String(options.businessName).slice(0,120):current.profile.name}
    };
    return {result,preview};
  }
  function archiveFor(user,engines,settings,local,issues){
    return {
      kind:'metaforge-legacy',version:VERSION,createdAt:new Date().toISOString(),
      userUid:String(user.uid),email:String(user.email||''),engines,settings:settings||null,local,
      issues:Array.isArray(issues)?issues:[]
    };
  }
  return {CURRENT_KEY,readLocal,summarize,documentType,toNumber,sanitizeItems,archiveFor,migrateArchive};
});
