const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','functions','index.js'),'utf8');
function makeResolver(rows){
 const fn={https:{onRequest:fn=>fn}};
 const db={collection:name=>{
  assert.equal(name,'short_urls');
  return {doc:code=>({get:async()=>rows[code]?{exists:true,data:()=>rows[code],ref:{update:async()=>{}}}:{exists:false}})};
 }};
 const admin={initializeApp(){},firestore:()=>db};
 admin.firestore.FieldValue={increment:n=>n};
 const sandbox={require:name=>name==='firebase-functions'?fn:admin,exports:{},process:{env:{GCLOUD_PROJECT:'legacy-test'}},console:{error(){}}};
 vm.runInNewContext(source,sandbox,{timeout:1500});
 return sandbox.exports.redirect;
}
function response(){
 const r={statusCode:200,headers:{},redirected:null,sent:null};
 r.set=(key,val)=>{r.headers[key]=val;return r};
 r.status=code=>{r.statusCode=code;return r};
 r.send=body=>{r.sent=body;return r};
 r.redirect=(code,url)=>{r.statusCode=code;r.redirected=url;return r};
 return r;
}
test('legacy short-link resolver rejects malformed links without querying the database',async()=>{
 const fn=makeResolver({});
 const res=response();await fn({path:'/r/x',query:{}},res);
 assert.equal(res.statusCode,400);assert.match(String(res.sent),/Invalid Link/);
});
test('legacy short-link resolver redirects verified stored links',async()=>{
 const fn=makeResolver({ABC123:{original_url:'https://example.com/invoice'}});
 const res=response();await fn({path:'/r/abc123',query:{}},res);
 assert.equal(res.statusCode,302);assert.equal(res.redirected,'https://example.com/invoice');
});
test('legacy short-link resolver respects shutdown and nonexistent records',async()=>{
 const fn=makeResolver({LOCKED:{status:'shutdown',original_url:'https://example.com'}});
 const a=response();await fn({path:'/r/locked',query:{}},a);assert.equal(a.statusCode,403);
 const b=response();await fn({path:'/r/missing',query:{}},b);assert.equal(b.statusCode,404);
});
