/**
 * Bizlano public short-domain gateway for Cloudflare Pages.
 *
 * bizlano.pages.dev is a branded host. The main Bizlano Worker owns
 * authentication, D1, R2, subscriptions (later), finance, and receipt rules.
 * This proxy never receives or stores passwords, keys, or payment secrets.
 *
 * The separate Praylume worker and other projects stay untouched.
 */
const UPSTREAM='https://bizlano.praylume-staging-ng.workers.dev';
const UPSTREAM_ORIGIN=new URL(UPSTREAM).origin;
const EDGE_HEADERS={'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'};
export default {
 async fetch(request){
  const original=new URL(request.url);
  if(!['GET','HEAD','POST'].includes(request.method))
   return new Response('Method not allowed',{status:405,headers:{...EDGE_HEADERS,allow:'GET, HEAD, POST'}});
  const webhook=original.pathname.startsWith('/api/integrations/gws/');
  const suppliedOrigin=request.headers.get('origin');
  if(request.method==='POST'&&!webhook&&suppliedOrigin!==original.origin)
   return new Response(JSON.stringify({error:'Cross-site requests are not permitted'}),{status:403,headers:{'content-type':'application/json',...EDGE_HEADERS}});
  const url=new URL(original.pathname+original.search,UPSTREAM_ORIGIN);
  const headers=new Headers(request.headers);
  headers.delete('host');
  headers.delete('x-forwarded-host');
  // The upstream Worker already validates same-origin POSTs. Preserve its
  // protection while letting users work securely on the new short hostname.
  if(suppliedOrigin===original.origin)headers.set('origin',UPSTREAM_ORIGIN);
  const upstreamRequest=new Request(url,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,redirect:'manual'});
  let response;
  try{response=await fetch(upstreamRequest,{cf:{cacheEverything:false}})}
  catch{return new Response('Bizlano is temporarily unavailable. Please retry shortly.',{status:503,headers:{...EDGE_HEADERS,'cache-control':'no-store'}})}
  const outputHeaders=new Headers(response.headers);
  outputHeaders.set('x-content-type-options','nosniff');
  outputHeaders.set('x-frame-options','DENY');
  const location=outputHeaders.get('location');
  if(location){
   try{const redirect=new URL(location,UPSTREAM_ORIGIN);
    if(redirect.origin===UPSTREAM_ORIGIN){
     redirect.protocol=original.protocol;redirect.host=original.host;
     outputHeaders.set('location',redirect.toString());
    }
   }catch{}
  }
  outputHeaders.delete('content-length');
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:outputHeaders});
 }
};
