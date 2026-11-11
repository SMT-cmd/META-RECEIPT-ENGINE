const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('public Bizlano landing has genuine brand assets and a separate sign-in route',()=>{
 const landing=read('platform/worker/landing.html');
 assert.match(landing,/<img src="\/assets\/bizlano-logo\.png" alt="Bizlano"/);
 assert.match(landing,/\/assets\/bizlano-mark\.png/);
 assert.match(landing,/href="\/app"/);
 assert.match(landing,/aria-label="Main navigation"/);
 assert.match(landing,/Register for free now/);
 assert.match(landing,/href="\/app\?mode=register"/);
 assert.doesNotMatch(landing,/subscription/i);
 const workspace=read('platform/worker/client.js');
 assert.match(workspace,/authMode:new URL\(location.href\).searchParams.get\('mode'\)==='register'/);
 assert.doesNotMatch(workspace,/Cloudflare D1|subscription|Secure account access via Firebase/i);
 assert.match(landing,/Illustrative data/);
});

test('mobile-first header and product previews fit small devices',()=>{
 const landing=read('platform/worker/landing.html');
 assert.match(landing,/@media\(max-width:375px\)/);
 assert.match(landing,/@media\(max-width:560px\)/);
 assert.match(landing,/aria-expanded="false"/);
 assert.match(landing,/id="menu-toggle"/);
 assert.match(landing,/prefers-reduced-motion:reduce/);
 const app=read('platform/worker/index.html');
 assert.match(app,/env\(safe-area-inset-bottom,0px\)/);
 assert.match(app,/\.mobile-nav\{position:fixed/);
});

test('real logo and marketing page are served from R2 with bounded asset paths',()=>{
 const worker=read('platform/worker/worker.js');
 const build=read('platform/worker/build.mjs');
 assert.match(worker,/import \{html,landing,client,icon,customerHtml,customerJs\} from '\.\/ui\.js'/);
 assert.match(worker,/p==='\/'\)return new Response\(landing/);
 assert.match(worker,/p==='\/app'/);
 assert.match(worker,/\['\/assets\/bizlano-logo\.png','\/assets\/bizlano-mark\.png','\/assets\/bizlano-hero\.jpg'\]/);
 assert.match(worker,/env\.ASSETS\.get\(key\)/);
 assert.match(build,/read\('landing\.html'\)/);
 assert.match(build,/JSON\.stringify\(read\('client\.js'\)\)/);
});

test('the workspace stays tenant-scoped and receipts visibly credit Bizlano',()=>{
 const worker=read('platform/worker/worker.js');
 const client=read('platform/worker/client.js');
 assert.match(worker,/JOIN memberships m ON m\.tenant_id=t\.id/);
 assert.match(worker,/\['customers','products','payments'\]\.includes\(resource\)\?'edit'/);
 assert.match(client,/Powered by <strong style=\\?"color:#6635db\\?">Bizlano/);
 assert.match(client,/function businessPicker\(\)/);
 assert.match(client,/data-business/);
 assert.match(client,/function salesChart\(\)/);
 assert.match(client,/history\.replaceState\(null,'','\/app'\)/);
});
