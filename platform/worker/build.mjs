// Bundles the Cloudflare Worker API and its mobile-first frontend without external build tools.
// Run from this directory: node build.mjs
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url));
const read=file=>readFileSync(join(dir,file),'utf8');
const canonical=readFileSync(resolve(dir,'../../business-react/public/bizlano-icon.svg'),'utf8');
const source=read('worker.js');
const marker="import {html,client,icon} from './ui.js';";
if(!source.includes(marker))throw Error('Expected UI entrypoint missing; aborting build');
const embedded=[
  'const html='+JSON.stringify(read('index.html'))+';',
  'const client='+JSON.stringify(read('client.js'))+';',
  'const icon='+JSON.stringify(canonical)+';'
].join('\n');
const bundle=source.replace(marker,embedded);
mkdirSync(join(dir,'dist'),{recursive:true});
writeFileSync(join(dir,'dist/worker.js'),bundle,'utf8');
console.log('Bizlano Worker built: '+bundle.length+' source bytes');
