import {getApps,getApp,initializeApp} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,getDocs,query,where,limit} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

const firebase={
  apiKey:'AIzaSyAElgJBP-F322zoJ-T1qeE48s2ka0EcEvw',
  authDomain:'metaforge-6afdf.firebaseapp.com',
  projectId:'metaforge-6afdf',
  appId:'1:261172077627:web:cb3cec74be2dbcb1d6281e',
  messagingSenderId:'261172077627'
};
const app=getApps().length?getApp():initializeApp(firebase);
const auth=getAuth(app),db=getFirestore(app);
const migration=window.MetaForgeLegacyMigration;
const $=id=>document.getElementById(id);
let signedIn=null,archive=null,backedUp=false,busy=false;
function notify(message,error=false){
  const elem=$('notice');elem.textContent=message;elem.classList.remove('hidden');elem.classList.toggle('error',error);
}
function setBusy(value){
  busy=value;$('scan-button').disabled=value;$('login-button').disabled=value;
  $('stage-button').disabled=value||!backedUp;
}
function reset(){
  archive=null;backedUp=false;
  $('stage').classList.add('hidden');
  $('download-button').classList.add('hidden');
  $('count-engines').textContent='—';$('count-cloud').textContent='—';$('count-local').textContent='—';
  $('stage-button').disabled=true;
  $('scan-info').textContent='Scan your original Firestore account and histories saved in this browser.';
  $('issues-panel').classList.add('hidden');
}
onAuthStateChanged(auth,user=>{
  const changed=user?.uid!==signedIn?.uid;
  signedIn=user;
  $('sign-in').classList.toggle('hidden',Boolean(user));
  $('review').classList.toggle('hidden',!user);
  if(changed)reset();
  if(user){
    $('signed-in').textContent='Signed in as '+(user.email||'your existing account');
    notify('Your original sign-in is still active. Nothing will be deleted during this migration.');
  }else notify('Sign in with your existing account to inspect owned receipt engines.');
});
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const form=event.currentTarget;setBusy(true);
  try{
    const email=form.elements.namedItem('email').value.trim();
    const password=form.elements.namedItem('password').value;
    await signInWithEmailAndPassword(auth,email,password);
    form.elements.namedItem('password').value='';
  }catch(error){
    notify(error?.code==='auth/invalid-credential'?'Your email or password is incorrect. Use the same login as the existing creator.':'Unable to sign in: '+String(error?.message||error),true);
  }finally{setBusy(false);}
});
function jsonCopy(value) {
  return JSON.parse(JSON.stringify(value));
}
function localSources() {
  if(!migration)throw Error('The legacy migration helper could not load.');
  try{return migration.readLocal(window.localStorage);}
  catch(e){return {histories:[],metadata:{},errors:['Browser history could not be read: '+String(e.message||e)]};}
}
async function scan(){
  if(busy)return;
  const user=signedIn;
  if(!user)throw Error('Please sign in to your old MetaForge account first.');
  setBusy(true);backedUp=false;$('stage-button').disabled=true;
  $('scan-button').textContent='Checking records…';
  notify('Reading your owned Firebase engines and local history. This is read-only.');
  const engines=[],issues=[],local=localSources();
  let settings=null;
  try {
    const snap=await getDoc(doc(db,'user_settings',user.uid));
    if(snap.exists())settings=jsonCopy(snap.data());
  }catch(e){issues.push('User settings could not be fetched: '+String(e.code||e.message||e));}
  try{
    const owned=await getDocs(query(collection(db,'short_urls'),where('owner_uid','==',user.uid),limit(1000)));
    if(owned.size===1000)issues.push('Engine scan reached its 1,000-record limit. Some engines may be missing. Use support-assisted export for the remainder.');
    let cursor=0;
    for(const row of owned.docs){
      if(signedIn?.uid!==user.uid){issues.push('The signed-in account changed during scanning. Scan again.');break;}
      cursor++;
      $('scan-info').textContent='Checking engine '+cursor+' of '+owned.size+'…';
      const data=row.data();
      if(data.owner_uid!==user.uid)continue;
      const entry={code:row.id,brandName:String(data.brandName||''),config:data.config||null,status:data.status||'active',owner_uid:user.uid,original_url:data.original_url||null,receipts:[],historyComplete:true};
      try{
        const history=await getDocs(query(collection(db,'short_urls',row.id,'receipts'),limit(1000)));
        if(history.size===1000){entry.historyComplete=false;issues.push(row.id+': receipt history exceeded 1,000 entries.');}
        entry.receipts=history.docs.map(x=>({id:x.id,...jsonCopy(x.data())}));
      }catch(e){
        entry.historyComplete=false;issues.push(row.id+': receipt history could not be read (possibly legacy permission rules). Original data was not changed.');
      }
      engines.push(entry);
    }
  }catch(e){issues.push('Cloud engine lookup was incomplete: '+String(e.code||e.message||e));}
  if(signedIn?.uid!==user.uid){setBusy(false);throw Error('Account changed while scanning. Sign in and retry.');}
  archive=migration.archiveFor(user,engines,settings,local,issues);
  const summary=migration.summarize(archive);
  $('count-engines').textContent=String(summary.engines);
  $('count-cloud').textContent=String(summary.cloudReceipts);
  $('count-local').textContent=String(summary.localReceipts);
  $('scan-info').textContent='Scan complete. Firebase engines are matched to your user ID. Local histories are device-based and cannot be independently verified as yours.';
  $('download-button').classList.remove('hidden');
  $('stage').classList.remove('hidden');
  $('business-name').value=engines[0]?.brandName||settings?.businessName||'';
  $('stage-preview').textContent='A backup is required before historical records can be staged. The original receipts remain untouched.';
  const all=[...issues,...local.errors];
  if(all.length){
    $('issues').replaceChildren();
    for(const text of all.slice(0,20)){const li=document.createElement('li');li.textContent=text;$('issues').appendChild(li);}
    $('issues-panel').classList.remove('hidden');
  }else $('issues-panel').classList.add('hidden');
  notify(all.length?'Scan finished with '+all.length+' warning(s). Download your archive and review what was not accessible.':'Scan complete. You can download the archive and safely stage eligible drafts.');
  $('scan-button').textContent='Scan again';setBusy(false);
}
$('scan-button').addEventListener('click',()=>scan().catch(error=>{setBusy(false);$('scan-button').textContent='Try scan again';notify(error.message,true);}));
function downloadBackup(){
  if(!archive||!signedIn||archive.userUid!==signedIn.uid)throw Error('Scan your own records before downloading.');
  const blob=new Blob([JSON.stringify(archive,null,2)],{type:'application/json'});
  const link=document.createElement('a'),url=URL.createObjectURL(blob);
  link.href=url;link.download='metaforge-legacy-backup-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  backedUp=true;$('stage-button').disabled=false;
  $('stage-preview').textContent='Backup prepared. Now you may stage eligible historical entries in the browser workspace; their original receipts will remain available.';
  notify('Your backup download was started. Keep it private and confirm it is saved before proceeding.');
}
$('download-button').addEventListener('click',()=>{
  try{downloadBackup();}catch(e){notify(e.message,true);}
});
$('stage-button').addEventListener('click',()=>{
  if(busy||!backedUp||!archive||archive.userUid!==signedIn?.uid)return notify('Download your backup first.',true);
  try{
    const key=migration.CURRENT_KEY;
    const stored=localStorage.getItem(key);
    let workspace;
    if(stored){
      workspace=JSON.parse(stored);
      if(workspace.schemaVersion!==1 || !Array.isArray(workspace.documents))
        throw Error('Existing workspace data has an unsupported format. No changes were made.');
    }else{
      workspace={
        schemaVersion:1,
        profile:{name:'My Business',phone:'',email:'',address:'',registration:'',taxId:'',bank:'',accountName:'',accountNumber:'',currency:'NGN',taxDefault:0,accent:'#4855d9',footer:'Thank you for your business!',logo:''},
        documents:[],customers:[],products:[],expenses:[],audit:[]
      };
    }
    const {result,preview}=migration.migrateArchive(archive,workspace,{businessName:$('business-name').value.trim()});
    if(preview.skipped)notify(preview.skipped+' entries lacked enough details and remain preserved in the JSON archive.');
    if(!window.confirm('Stage '+preview.importable+' legacy receipts as review-only drafts in this browser? '+preview.skipped+' will remain in the downloaded archive. No original cloud records or existing documents will be deleted.'))return;
    const prior=localStorage.getItem(key);
    try{localStorage.setItem(key,JSON.stringify(result));}
    catch(error){
      if(prior===null)localStorage.removeItem(key);
      else localStorage.setItem(key,prior);
      throw Error('This browser could not save the migrated draft records. Your downloaded backup is unchanged.');
    }
    window.location.assign('../business/');
  }catch(error){notify(error.message||String(error),true);}
});
