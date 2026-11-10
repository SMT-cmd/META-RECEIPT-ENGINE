import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {doc,onSnapshot,serverTimestamp,setDoc} from 'firebase/firestore';
import {auth,db,type Role} from './cloud';
import {BILLABLE_TYPES,calculate,money,type BusinessDocument,type Currency} from './domain';
import './insights.css';

type Chart='line'|'bar'|'pie';
type Span=7|30|90;
type Target={amount:number;currency:Currency;updatedBy:string};
type Props={businessId:string;documents:BusinessDocument[];currency:Currency;role:Role};
const day=(date:Date):string=>{
  const d=new Date(date);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const safeTotal=(d:BusinessDocument):number=>{try{return calculate(d).total;}catch{return 0;}};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
function dataFor(days:Span,docs:BusinessDocument[]) {
  const dates=Array.from({length:days},(_,i)=>{
    const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(days-1-i));
    return day(d);
  });
  const totals=new Map(dates.map(d=>[d,0]));
  for(const d of docs)if(totals.has(d.date))totals.set(d.date,(totals.get(d.date)||0)+safeTotal(d));
  const size=days===7?1:days===30?2:7;
  const groups:{label:string;value:number}[]=[];
  for(let i=0;i<dates.length;i+=size){
    const block=dates.slice(i,i+size);
    groups.push({label:new Date(block[0]+'T12:00:00').toLocaleDateString('en-NG',{day:'numeric',month:'short'}),
      value:Math.round(block.reduce((s,d)=>s+(totals.get(d)||0),0)*100)/100});
  }
  return groups;
}
function chartSvg(points:{label:string;value:number}[],mode:'line'|'bar',currency:Currency){
  const width=840,height=238,left=48,right=22,top=23,bottom=43;
  const w=width-left-right,h=height-top-bottom;
  const highest=Math.max(1,...points.map(x=>x.value));
  const xFor=(i:number)=>left+(i+.5)*w/points.length;
  const yFor=(v:number)=>top+h-(v/highest)*h;
  const bar=Math.max(8,Math.min(43,w/points.length*.58));
  return <svg className="insight-svg" viewBox={'0 0 '+width+' '+height} role="img" aria-label={mode==='bar'?'Bar chart of issued sales':'Line chart of issued sales'}>
    {[0,.25,.5,.75,1].map((p,i)=><g key={i}><line x1={left} y1={top+h*(1-p)} x2={width-right} y2={top+h*(1-p)} stroke="#e6eaf2" strokeDasharray={i===0?'0':'3 4'}/>
      <text x={left-7} y={top+h*(1-p)+4} textAnchor="end" fontSize="10" fill="#7c899e">{p===0?'0':Math.round(highest*p).toLocaleString('en-NG')}</text></g>)}
    {mode==='bar'?points.map((d,i)=><rect key={i} x={xFor(i)-bar/2} y={yFor(d.value)} width={bar} height={Math.max(0,top+h-yFor(d.value))} rx={4} fill="#4a59cd"><title>{d.label}: {money(d.value,currency)}</title></rect>):
      <><polyline points={points.map((d,i)=>xFor(i)+','+yFor(d.value)).join(' ')} stroke="#4958d1" strokeWidth="3" strokeLinejoin="round" fill="none"/>
        {points.map((d,i)=><circle key={i} cx={xFor(i)} cy={yFor(d.value)} r={3.5} fill="#4958d1"><title>{d.label}: {money(d.value,currency)}</title></circle>)}</>}
    {points.map((d,i)=><text key={i} x={xFor(i)} y={height-19} fill="#8290a6" textAnchor="middle" fontSize={points.length>9?8:10}>{d.label}</text>)}
  </svg>;
}
function pieSvg(docs:BusinessDocument[],currency:Currency) {
  const totals=new Map<string,number>();
  for(const d of docs){
    const kind=d.type.replace(/-/g,' ');
    totals.set(kind,(totals.get(kind)||0)+safeTotal(d));
  }
  const ranked=[...totals].sort((a,b)=>b[1]-a[1]);
  const entries=ranked.slice(0,4);
  if(ranked.length>4)entries.push(['Other types',ranked.slice(4).reduce((s,tuple)=>s+tuple[1],0)]);
  const total=entries.reduce((s,e)=>s+e[1],0)||1;
  const colors=['#4859d5','#8792e8','#31a8a0','#e9b366','#98a6bd'];
  let offset=0;
  return <div className="pie-layout">
    <svg viewBox="0 0 280 280" className="insight-pie" role="img" aria-label="Sales by document type">
      <circle cx="140" cy="140" r="90" stroke="#ebeff5" strokeWidth="31" fill="none"/>
      {entries.map(([name,value],i)=>{
        const percent=value/total*100;
        const element=<circle key={name} cx="140" cy="140" r="90" stroke={colors[i]} strokeWidth="31"
          fill="none" strokeDasharray={percent*5.65486+' '+(100-percent)*5.65486}
          strokeDashoffset={-offset*5.65486} transform="rotate(-90 140 140)">
          <title>{name}: {money(value,currency)} ({percent.toFixed(1)}%)</title></circle>;
        offset+=percent;return element;
      })}
      <text x="140" y="136" textAnchor="middle" fontSize="14" fill="#69778c">Total sales</text>
      <text x="140" y="155" textAnchor="middle" fontSize="17" fontWeight="800" fill="#1c2944">{new Intl.NumberFormat('en-NG',{notation:'compact',maximumFractionDigits:1}).format(total)}</text>
    </svg>
    <div className="insight-legend">{entries.map(([name,value],i)=><div key={name}><span style={{background:colors[i]}}/><div><strong>{name}</strong><small>{money(value,currency)}</small></div></div>)}</div>
  </div>;
}
export function SalesInsights({businessId,documents,currency,role}:Props){
  const [mode,setMode]=useState<Chart>('bar');
  const [span,setSpan]=useState<Span>(30);
  const [target,setTarget]=useState<Target|null>(null);
  const [targetInput,setTargetInput]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const month=day(new Date()).slice(0,7);
  const canEdit=['owner','admin','manager'].includes(role);
  const issued=useMemo(()=>documents.filter(d=>!d.draft&&!d.voided&&BILLABLE_TYPES.has(d.type)&&d.currency===currency),[documents,currency]);
  const points=useMemo(()=>dataFor(span,issued),[span,issued]);
  const monthSales=useMemo(()=>issued.filter(d=>d.date.startsWith(month)).reduce((sum,d)=>sum+safeTotal(d),0),[issued,month]);
  const periodSum=points.reduce((sum,p)=>sum+p.value,0);
  const goal=target?.currency===currency?target.amount:0;
  const progress=goal>0?clamp(monthSales/goal*100,0,100):0;
  useEffect(()=>{
    setError('');
    const ref=doc(db,'businesses',businessId,'targets',month);
    return onSnapshot(ref,snapshot=>{
      const data=snapshot.data() as Target|undefined;
      setTarget(data&&typeof data.amount==='number'?data:null);
      setTargetInput(data&&typeof data.amount==='number'?String(data.amount):'');
    },err=>setError('Target could not be loaded: '+err.message));
  },[businessId,month]);
  async function saveTarget(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!canEdit)return;
    const amount=Number(targetInput);
    if(!Number.isFinite(amount)||amount<=0||amount>100000000000){
      setError('Enter a realistic target amount greater than zero.');return;
    }
    const user=auth.currentUser;if(!user){setError('Sign in first.');return;}
    setSaving(true);setError('');
    try{
      await setDoc(doc(db,'businesses',businessId,'targets',month),{
        month,amount:Math.round(amount*100)/100,currency,updatedBy:user.uid,updatedAt:serverTimestamp()
      });
    }catch(err){setError(err instanceof Error?err.message:'Could not save the target.');}
    finally{setSaving(false);}
  }
  return <section className="sales-insights">
    <div className="sales-head">
      <div><div className="insights-eyebrow">SALES INTELLIGENCE</div><h2>Understand your business at a glance</h2><p>Issued sales only. Drafts and voided documents are excluded; amounts are not gateway-verified.</p></div>
      <div className="insights-controls" aria-label="Chart controls">
        <select aria-label="Sales period" value={span} onChange={e=>setSpan(Number(e.target.value) as Span)}>
          <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
        </select>
        <div className="seg-tabs">{(['bar','line','pie'] as Chart[]).map(value=>
          <button type="button" key={value} aria-pressed={mode===value} className={mode===value?'selected':''} onClick={()=>setMode(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div>
      </div>
    </div>
    <div className="sales-insight-body">
      <div className="chart-card"><div className="chart-meta"><div><span>Issued sales · selected period</span><strong>{money(periodSum,currency)}</strong></div><small>{issued.length} issued sales records in this currency</small></div>
        {periodSum===0?<div className="chart-empty">No issued sales in this period yet. Once you start creating receipts and invoices, the trend will appear here.</div>:
          mode==='pie'?pieSvg(issued.filter(d=>d.date>=day(new Date(Date.now()-(span-1)*86400000))),currency):chartSvg(points,mode,currency)}
      </div>
      <div className="target-card"><div className="insights-eyebrow">THIS MONTH</div><h3>Sales goal</h3>
        <strong className="target-earned">{money(monthSales,currency)}</strong>
        <p className="target-caption">out of {goal?money(goal,currency):'no target set'} · {month}</p>
        <div className="target-track" role="progressbar" aria-label="Monthly sales target progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{width:progress+'%'}}/></div>
        <p className="target-note">{goal?Math.round(progress)+'% achieved · '+money(Math.max(0,goal-monthSales),currency)+' remaining':'Set a monthly sales target for the team to follow.'}</p>
        {canEdit?<form className="target-form" onSubmit={e=>void saveTarget(e)}>
          <label>Monthly target ({currency})<input type="number" required min=".01" max="100000000000" step=".01" value={targetInput} onChange={e=>setTargetInput(e.target.value)} placeholder="e.g. 500000"/></label>
          <button type="submit" disabled={saving}>{saving?'Saving…':'Save target'}</button></form>:<p className="target-note">Targets are managed by owners, administrators and managers.</p>}
        {error&&<p className="target-error" role="alert">{error}</p>}
      </div>
    </div>
  </section>;
}
