/* MetaForge Business — dependency-free business document arithmetic.
   All values are displayed in major currency units; calculations use minor units. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MetaForgeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DOCUMENT_TYPES = [
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
  ].map(([id,label,group,prefix]) => ({ id,label,group,prefix }));
  const STYLES = [
    ['signature','Signature','Clean corporate letterhead','#3b4ad9'],
    ['classic','Classic','Traditional invoice','#304055'],
    ['executive','Executive','Deep navy and gold','#1e3a5f'],
    ['retail','Retail','Compact shop receipt','#136e62'],
    ['thermal','Thermal','80mm printer-friendly','#27272a'],
    ['minimal','Minimal','Airy and neutral','#556375'],
    ['editorial','Editorial','Premium typography','#7a3e61'],
    ['bold','Bold','High-contrast headings','#9a4a16'],
    ['artisan','Artisan','Warm creative brand','#a4514a'],
    ['medical','Medical','Clinical clarity','#267e9a'],
    ['education','Education','School and institutional','#514a9e'],
    ['hospitality','Hospitality','Hotel, restaurant and events','#8c5d29']
  ].map(([id,label,description,accent]) => ({id,label,description,accent}));
  const BILLABLE = new Set(['receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice']);
  const NON_DEBT = new Set(['quotation','estimate','proforma','purchase-order','delivery-note','donation-receipt','payment-receipt','deposit-receipt','installment-receipt','credit-note','debit-note','refund-receipt','custom']);
  const amount = n => Math.round((Number(n) + Number.EPSILON) * 100);
  const major = n => Math.round(n) / 100;
  function valid(n) { return Number.isFinite(Number(n)) && Number(n) >= 0; }
  function calculate(doc) {
    const items = Array.isArray(doc.items) ? doc.items : [];
    if (!items.length || !items.some(i => String(i.description || '').trim())) throw Error('Add at least one item or service.');
    let subtotalCents = 0;
    const lines = items.map(item => {
      if (!String(item.description || '').trim()) throw Error('Each line needs a description.');
      if (!Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0 || !valid(item.price)) throw Error('Check item quantity and price.');
      const lineCents = Math.round(Number(item.qty) * amount(item.price));
      subtotalCents += lineCents;
      return {...item, total: major(lineCents)};
    });
    const discountPct = Number(doc.discountPct || 0), taxPct = Number(doc.taxPct || 0);
    if (![discountPct,taxPct].every(v=>Number.isFinite(v)&&v>=0&&v<=100)) throw Error('Tax and discount rates must be between 0 and 100.');
    if (!valid(doc.shipping || 0) || !valid(doc.paid || 0)) throw Error('Shipping and payments cannot be negative.');
    const discountCents = Math.round(subtotalCents * discountPct / 100);
    const taxableCents = subtotalCents - discountCents;
    const taxCents = Math.round(taxableCents * taxPct / 100);
    const totalCents = taxableCents + taxCents + amount(doc.shipping || 0);
    const paidCents = amount(doc.paid || 0);
    if (paidCents > totalCents) throw Error('Amount received cannot exceed the document total.');
    return {
      lines, subtotal:major(subtotalCents), discount:major(discountCents),
      tax:major(taxCents), shipping:major(amount(doc.shipping || 0)),
      total:major(totalCents), paid:major(paidCents), balance:major(totalCents-paidCents)
    };
  }
  function status(doc) {
    if (doc.voided) return 'Voided';
    if (doc.draft) return 'Draft';
    if (NON_DEBT.has(doc.type)) return 'Issued';
    const s = calculate(doc);
    if (s.balance === 0) return 'Paid';
    if (s.paid > 0) return 'Part-paid';
    return doc.dueDate && doc.dueDate < new Date().toISOString().slice(0,10) ? 'Overdue' : 'Unpaid';
  }
  function numberFor(documents,type,day) {
    const cfg = DOCUMENT_TYPES.find(t=>t.id===type) || DOCUMENT_TYPES[DOCUMENT_TYPES.length-1];
    const year = (day || new Date().toISOString().slice(0,10)).slice(0,4);
    const prefix = cfg.prefix + '-' + year + '-';
    const max = (documents || []).reduce((n,d)=>{
      const value = String(d.number || '');
      return value.startsWith(prefix) ? Math.max(n, Number(value.slice(prefix.length)) || 0) : n;
    },0);
    return prefix+String(max+1).padStart(4,'0');
  }
  function summary(documents,expenses) {
    let invoiced = 0, collected = 0, outstanding = 0, count = 0;
    for (const doc of documents || []) {
      if (!BILLABLE.has(doc.type) || doc.draft || doc.voided) continue;
      try {
        const s = calculate(doc);
        invoiced += s.total; collected += s.paid; outstanding += s.balance; count++;
      } catch (_) { /* ignore invalid imported records rather than corrupt totals */ }
    }
    const spent = (expenses || []).reduce((sum,e) => sum + (valid(e.amount) ? Number(e.amount) : 0),0);
    return { invoiced:round(invoiced), collected:round(collected), outstanding:round(outstanding), expenses:round(spent), cashAfterExpenses:round(collected-spent), count };
  }
  function round(n) { return Math.round((n + Number.EPSILON)*100)/100; }
  function money(value,currency) {
    const c = currency || 'NGN';
    try { return new Intl.NumberFormat('en-NG',{style:'currency',currency:c,minimumFractionDigits:2}).format(Number(value)||0); }
    catch (_) { return c+' '+(Number(value)||0).toFixed(2); }
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function csv(rows) {
    return rows.map(row=>row.map(cell=>'"'+String(cell??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  }
  return { DOCUMENT_TYPES, STYLES, BILLABLE, NON_DEBT, calculate, status, numberFor, summary, money, escapeHtml, csv };
});