(function(){
 'use strict';
 if(!('serviceWorker' in navigator)||location.protocol!=='https:')return;
 navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
 const installed=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
 const appName=()=>location.pathname==='/receipts'||location.pathname.startsWith('/receipts/')?'Bizlano Receipts':'Bizlano';
 let deferred=null,button=null,modal=null;
 const style=document.createElement('style');style.textContent='#bizlano-install{position:fixed;z-index:65;right:16px;bottom:calc(20px + env(safe-area-inset-bottom));background:#542bd0;color:#fff;border:0;border-radius:12px;box-shadow:0 9px 25px #26204a38;padding:11px 17px;font:700 13px system-ui;cursor:pointer;min-height:44px}#bizlano-install:focus-visible{outline:3px solid #a896ff;outline-offset:3px}#bizlano-install-dialog{position:fixed;z-index:70;inset:0;background:#14172b83;display:grid;place-items:center;padding:18px}#bizlano-install-dialog section{position:relative;max-width:380px;background:#fff;color:#242944;border-radius:16px;padding:29px 25px;box-shadow:0 24px 55px #161a3b44;font:14px/1.6 system-ui}#bizlano-install-dialog h2{font:800 21px system-ui;margin:0 0 10px}#bizlano-install-dialog p{margin:0 0 18px;color:#52607a}#bizlano-install-dialog button{border:0;background:#6335dc;color:white;border-radius:8px;min-height:40px;padding:9px 16px;font-weight:750;cursor:pointer}@media(max-width:700px){body:has(.mobile-nav) #bizlano-install{bottom:calc(88px + env(safe-area-inset-bottom))}}';
 document.head.appendChild(style);
 const hide=()=>{button?.remove();button=null;modal?.remove();modal=null};
 const showInstructions=()=>{
  if(modal)return;const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
  modal=document.createElement('div');modal.id='bizlano-install-dialog';modal.setAttribute('role','presentation');
  const section=document.createElement('section');section.setAttribute('role','dialog');section.setAttribute('aria-modal','true');section.setAttribute('aria-label','Install Bizlano');
  section.innerHTML='<h2>Install '+appName()+'</h2><p>'+ (ios?'On iPhone or iPad, open this page in Safari, tap <strong>Share</strong> and choose <strong>Add to Home Screen</strong>.':'Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.')+' Your receipts and business workspace will be a tap away.</p>';
  const close=document.createElement('button');close.textContent='Got it';close.addEventListener('click',()=>{modal.remove();modal=null});section.append(close);modal.append(section);
  modal.addEventListener('click',ev=>{if(ev.target===modal){modal.remove();modal=null}});document.body.append(modal);close.focus();
 };
 const requestInstall=async()=>{
  if(deferred){const prompt=deferred;deferred=null;try{await prompt.prompt();const answer=await prompt.userChoice;if(answer?.outcome==='accepted')hide()}catch{showInstructions()}}else showInstructions();
 };
 function mount(){if(installed()||button||document.getElementById('bizlano-install'))return;
  button=document.createElement('button');button.type='button';button.id='bizlano-install';button.textContent='Install '+appName();button.setAttribute('aria-label','Install '+appName()+' on this device');button.addEventListener('click',requestInstall);document.body.append(button);
 }
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;mount()});
 window.addEventListener('appinstalled',hide);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(!installed())mount()},{once:true});else if(!installed())mount();
 window.addEventListener('online',()=>{document.getElementById('bizlano-offline')?.remove()});
 window.addEventListener('offline',()=>{if(document.getElementById('bizlano-offline'))return;const b=document.createElement('div');b.id='bizlano-offline';b.role='status';b.textContent='You are offline. Connect to update business records.';b.style.cssText='position:fixed;z-index:90;left:10px;right:10px;top:10px;text-align:center;padding:11px 16px;border-radius:9px;background:#252746;color:white;font:600 13px system-ui';document.body.append(b)});
})();
