const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../platform/worker/worker.js'),'utf8');
const start=source.indexOf('async function passwordDigest('),end=source.indexOf('async function limitAnonymousAttempt(',start);
assert.ok(start>=0&&end>start);
const fragment=source.slice(start,end);
const hex=u=>Array.from(u,b=>b.toString(16).padStart(2,'0')).join('');
const passwordDigest=new Function('crypto','hex',fragment+';return passwordDigest;')(webcrypto,hex);
test('Cloudflare-compatible password digest is stable, salted and rejects invalid passwords',async()=>{
 assert.ok(!fragment.includes('iterations:180000'));
 assert.ok(fragment.includes('iterations:100000'));
 assert.ok(fragment.includes('iterations:80000'));
 const salt='0123456789abcdef0123456789abcdef',password='StrongExamplePassword123!';
 const a=await passwordDigest(password,salt),b=await passwordDigest(password,salt);
 const c=await passwordDigest(password+'x',salt),d=await passwordDigest(password,'fedcba9876543210fedcba9876543210');
 assert.match(a,/^[a-f0-9]{64}$/);assert.equal(a,b);assert.notEqual(a,c);assert.notEqual(a,d);
});
test('all native account paths share the passwordDigest routine',()=>{
 const auth=fs.readFileSync(path.join(__dirname,'../platform/worker/native-auth.js'),'utf8');
 assert.equal(auth.split('await passwordDigest(').length-1,3);
 assert.ok(source.includes('await passwordDigest(password,salt)'));
});
