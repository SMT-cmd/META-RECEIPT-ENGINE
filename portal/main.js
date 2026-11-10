/* The old portal route is intentionally a safe bridge until the verified
 * React/TypeScript SaaS is deployed. Never invite customers into an
 * unverified tenant backend. This UI makes the route useful without writes. */
const root=document.getElementById('root');
const params=new URLSearchParams(window.location.search);
const slug=String(params.get('brand')||params.get('shop')||'').toLowerCase();
const valid=/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug);
document.title='Bizlano | Online workspace preview';
function create(tag,props={},children=[]){
  const node=document.createElement(tag);
  Object.entries(props).forEach(([key,value])=>{
    if(key==='className')node.className=value;
    else if(key==='text')node.textContent=value;
    else node.setAttribute(key,value);
  });
  for(const item of children)node.append(typeof item==='string'?document.createTextNode(item):item);
  return node;
}
if(root){
  root.replaceChildren();
  root.className='bizlano-portal-bridge';
  root.append(
    create('header',{className:'bridge-header'},[
      create('a',{href:'../bizlano/',className:'bridge-logo'},[
        create('img',{src:'../bizlano-icon.svg',alt:'',width:'44',height:'44'}),
        create('strong',{text:'Bizlano'})
      ]),
      create('a',{href:'../upgrade/',className:'bridge-link',text:'Existing MetaForge user?'})
    ]),
    create('main',{className:'bridge-main'},[
      create('div',{className:'bridge-pill',text:'CONNECTED WORKSPACE · PREVIEW'}),
      create('h1',{text:valid?'Your business address is reserved for the next step.':'One business. Every important detail.'}),
      create('p',{text:valid?
        'You opened the business address "'+slug+'". The secure online workspace is still being verified, so staff sign-in and cloud record creation are not active on this route.':
        'We are preparing secure online receipts, invoices, stock, customers and staff access in one shared business workspace.'}),
      create('div',{className:'bridge-actions'},[
        create('a',{href:'../business/',className:'bridge-btn bridge-primary',text:'Explore browser workspace'}),
        create('a',{href:'../bizlano/',className:'bridge-btn',text:'Explore Bizlano'}),
        create('a',{href:'../upgrade/',className:'bridge-btn',text:'Migrate old records'})
      ]),
      create('aside',{className:'bridge-notice'},[
        create('strong',{text:'Your records stay safe.'}),
        create('p',{text:'The current browser demo saves records locally. It is separate from the future cloud workspace. Existing MetaForge accounts and receipts are not being switched or deleted.'})
      ])
    ]),
    create('footer',{className:'bridge-footer',text:'Bizlano · Your business, beautifully managed.'})
  );
}
