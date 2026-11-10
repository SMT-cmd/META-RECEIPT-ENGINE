/* Brand-neutral deployment configuration.
   Set baseDomain AFTER acquiring/configuring the product domain and wildcard route.
   Until then every business has a working link: /portal/?brand=slug
   This file contains only publishable Firebase client configuration; never place secrets here. */
export const portalConfig = Object.freeze({
  baseDomain: '',
  brandName: 'MetaForge',
  firebase: {
    apiKey: 'AIzaSyAElgJBP-F322zoJ-T1qeE48s2ka0EcEvw',
    authDomain: 'metaforge-6afdf.firebaseapp.com',
    projectId: 'metaforge-6afdf',
    storageBucket: 'metaforge-6afdf.firebasestorage.app',
    messagingSenderId: '261172077627',
    appId: '1:261172077627:web:cb3cec74be2dbcb1d6281e'
  }
});
export function slugFromHost(hostname,baseDomain) {
  const domain=String(baseDomain||'').trim().toLowerCase();
  const host=String(hostname||'').trim().toLowerCase();
  if(!domain||!host.endsWith('.'+domain))return '';
  const sub=host.slice(0,-domain.length-1);
  return /^[a-z0-9][a-z0-9-]{2,39}$/.test(sub) ? sub : '';
}
export function validateSlug(slug) {
  return /^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)
    && !['www','app','admin','api','mail','auth','support','billing','help','assets','static','creator','engine'].includes(slug);
}
export function tenantUrl(slug) {
  const id=String(slug||'').trim().toLowerCase();
  if(!validateSlug(id))throw Error('Choose a valid business address.');
  return portalConfig.baseDomain ? 'https://'+id+'.'+portalConfig.baseDomain+'/' : location.origin+'/portal/?brand='+encodeURIComponent(id);
}
