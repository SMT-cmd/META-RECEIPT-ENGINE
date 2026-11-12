// Bizlano subscription catalogue. PROPOSAL ONLY: no live billing, quotas or entitlements.
// Prices are versioned here for preview; verified payments and activation must be server-side.
export const BILLING_LIVE = false;
export const BILLING_TARGET_DATE = '2027-02-01';
export const BILLING_PRICE_VERSION = '2027-02-proposal-v1';

const catalogue = [
  ['free','Free',[0,0,0,0],30,1,12,1,1,1],
  ['lite','Lite',[1000,2800,5400,9600],150,2,35,1,1,1],
  ['standard','Standard',[2400,6700,13000,23000],600,4,71,3,2,1],
  ['business','Business',[4900,13800,26500,47000],2500,8,71,8,5,3],
  ['business-max','Business Max',[8900,25000,48000,85000],10000,20,71,15,12,10]
];
const terms = ['monthly','quarterly','six_months','yearly'];
const months = {monthly:1,quarterly:3,six_months:6,yearly:12};
export const PLANS = Object.freeze(catalogue.map(([id,name,prices,monthlyTransactions,designProfiles,availableDesigns,staff,brands,locations])=>Object.freeze({
  id,name,priceNGN:Object.freeze(Object.fromEntries(terms.map((t,i)=>[t,prices[i]]))),
  monthlyTransactions,designProfiles,availableDesigns,staff,brands,locations
})));

export function proposedQuote(planId,term,{verifiedGwsPaidVendor=false}={}) {
  const plan=PLANS.find(p=>p.id===planId);
  if(!plan||!Object.hasOwn(months,term))throw new RangeError('Unknown plan or payment term');
  if(typeof verifiedGwsPaidVendor!=='boolean')throw new TypeError('Eligibility must be verified by the server');
  // GWS discount always uses monthly list price, never stacks term discounts.
  const totalNGN=verifiedGwsPaidVendor?plan.priceNGN.monthly*months[term]/2:plan.priceNGN[term];
  return {plan:plan.id,term,amountNGN:totalNGN,discount:verifiedGwsPaidVendor&&plan.id!=='free'?'verified_gws_monthly_half':'none',
    priceVersion:BILLING_PRICE_VERSION,proposed:true,payable:false};
}

export function lagosUsagePeriod(date=new Date()) {
  const d=new Date(date);
  if(!Number.isFinite(d.getTime()))throw new RangeError('Invalid date');
  // Nigeria is UTC+01:00 throughout the year.
  const local=new Date(d.getTime()+3600000);
  const year=local.getUTCFullYear(),month=local.getUTCMonth()+1;
  return year+'-'+String(month).padStart(2,'0');
}
export function lagosNextReset(date=new Date()) {
  const d=new Date(date);
  if(!Number.isFinite(d.getTime()))throw new RangeError('Invalid date');
  const local=new Date(d.getTime()+3600000);
  // First local midnight of the next month, expressed as UTC ISO timestamp.
  return new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,1)-3600000).toISOString();
}
export function publicBillingCatalogue(){
  return {billingEnabled:BILLING_LIVE,priceVersion:BILLING_PRICE_VERSION,
    targetDate:BILLING_TARGET_DATE,pricesAreProposed:true,currency:'NGN',
    plans:PLANS,terms:[...terms],nextUsageResetAt:lagosNextReset(),
    notice:'Free remains available. Paid plans are proposed for February 2027, subject to launch approval. No card or payment is required.'};
}