/* Non-blocking upgrade announcement for signed-in existing MetaForge users.
   No analytics, no email, no credential collection, and no automatic migration. */
import {getApps,getApp,initializeApp} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
const options={
  apiKey:'AIzaSyAElgJBP-F322zoJ-T1qeE48s2ka0EcEvw',
  authDomain:'metaforge-6afdf.firebaseapp.com',
  projectId:'metaforge-6afdf',
  appId:'1:261172077627:web:cb3cec74be2dbcb1d6281e',
  messagingSenderId:'261172077627'
};
const app=getApps().length?getApp():initializeApp(options);
const auth=getAuth(app);
const target=new URL('./',import.meta.url).toString();
const days=21*24*60*60*1000;
let banner=null;
function removeBanner(){if(banner){banner.remove();banner=null;}}
function render(user){
  if(!user){removeBanner();return;}
  // Demonstrations should never show user-account upgrade marketing.
  if(/(?:[?#&]|\/)demo(?:=|\/|$)|[?&]dm=true/i.test(location.href))return;
  try{
    const dismissed=Number(localStorage.getItem('metaforge:upgrade-dismiss:'+user.uid)||0);
    if(dismissed&&Date.now()-dismissed<days)return;
  }catch(_){}
  if(banner)return;
  banner=document.createElement('aside');
  banner.setAttribute('aria-label','Optional account upgrade');
  banner.style.cssText='position:fixed;left:clamp(12px,3vw,30px);right:clamp(12px,3vw,30px);bottom:15px;max-width:800px;margin:auto;z-index:2147483600;background:#151c35;color:white;padding:15px 18px;border:1px solid #64719d;border-radius:15px;box-shadow:0 12px 50px #090e2466;font:13px/1.55 system-ui,Arial,sans-serif;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap';
  const copy=document.createElement('div');copy.style.cssText='flex:1 1 290px';
  const strong=document.createElement('strong');strong.style.cssText='font-size:15px;display:block;margin-bottom:4px';strong.textContent='An upgraded business workspace is coming';
  const detail=document.createElement('span');detail.textContent='Keep your existing receipts and login. Review your records and download a backup before choosing to upgrade.';
  copy.append(strong,detail);
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:9px;flex-wrap:wrap;align-items:center';
  const upgrade=document.createElement('a');upgrade.href=target;upgrade.textContent='Review my upgrade';upgrade.style.cssText='text-decoration:none;background:#dfe3ff;color:#15204c;padding:11px 14px;border-radius:8px;font-weight:800;white-space:nowrap';
  const later=document.createElement('button');later.type='button';later.textContent='Later';later.style.cssText='background:transparent;color:#fff;border:1px solid #7783a7;padding:10px 13px;border-radius:8px;cursor:pointer';
  later.addEventListener('click',()=>{try{localStorage.setItem('metaforge:upgrade-dismiss:'+user.uid,String(Date.now()));}catch(_){}removeBanner();});
  actions.append(upgrade,later);banner.append(copy,actions);document.body.append(banner);
}
onAuthStateChanged(auth,render);
