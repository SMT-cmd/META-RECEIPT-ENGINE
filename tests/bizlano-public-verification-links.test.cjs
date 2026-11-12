const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const s=fs.readFileSync(path.join(__dirname,'../platform/worker/native-auth.js'),'utf8');
test('verification and password reset links use the canonical public host rather than internal worker subdomain',()=>{
 assert.match(s,/function nativePublicOrigin\(env\)/);
 assert.match(s,/https:\/\/bizlano\.pages\.dev/);
 assert.match(s,/publicOrigin\+\(b\.audience===/);
 assert.match(s,/url\.protocol!=='https:'/);
});
