// Business-workspace operations. Built into the existing Worker; all queries are tenant-scoped.
// This module does not activate subscriptions, paid limits, or outbound marketing.
export async function workspaceExtraAPI(req,env,user,t,resource){
 const method=req.method,tenant=t.id,slug=t.slug;
 const write=method==='POST';
 const admin=['owner','admin'].includes(t.role),owner=t.role==='owner';
 const str=(v,max=160)=>String(v??'').trim().slice(0,max);
 const required=(v,max=160)=>{const s=str(v,max);if(!s)fail(400,'Fill in all required details');return s};
 const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
 const active=async(table,id)=>env.DB.prepare('SELECT id FROM '+table+' WHERE tenant_id=? AND id=? AND archived_at IS NULL').bind(tenant,id).first();
 if(resource==='billing'){
  if(!owner)fail(403,'Only the business owner can manage billing');
  if(write)fail(405,'Subscription payments have not launched');
  const used=await env.DB.prepare('SELECT used FROM usage_counters WHERE tenant_id=? AND period_wat=?')
   .bind(tenant,lagosUsagePeriod()).first();
  const [arms,places,members]=await Promise.all([
    env.DB.prepare('SELECT count(*) n FROM business_arms WHERE tenant_id=? AND archived_at IS NULL').bind(tenant).first(),
    env.DB.prepare('SELECT count(*) n FROM business_locations WHERE tenant_id=? AND archived_at IS NULL').bind(tenant).first(),
    env.DB.prepare('SELECT count(*) n FROM memberships WHERE tenant_id=? AND disabled_at IS NULL').bind(tenant).first()
  ]);
  const active=await env.DB.prepare("SELECT plan_id,status,current_period_end FROM subscriptions WHERE tenant_id=? AND status IN('active','grace') AND datetime(current_period_end)>datetime('now') ORDER BY starts_at DESC LIMIT 1").bind(tenant).first();
  return json({...publicBillingCatalogue(),currentPlan:active?.plan_id||'free',paidThrough:active?.current_period_end||null,businessName:t.business_name,
   actual:{monthlyFinalizedTransactions:used?.used||0,arms:arms?.n||1,locations:places?.n||1,staff:members?.n||1},billingStatus:'not_activated'});
 }
 if(resource==='design-profiles'){
  if(!write){
   const r=await env.DB.prepare('SELECT id,name,template,accent,secondary_color,font_family,header_note,footer_note,archived_at FROM document_design_profiles WHERE tenant_id=? ORDER BY archived_at IS NOT NULL,created_at DESC LIMIT 100').bind(tenant).all();
   return json({rows:r.results||[]});
  }
  if(!admin)fail(403,'Only administrators can manage document designs');
  const b=await input(req),action=str(b.action||'create',24),id=b.id;
  if(action==='assign'){
   if(!uuid(b.armId)||!uuid(b.profileId))fail(400,'Choose a business arm and document design');
   if(!await active('business_arms',b.armId))fail(404,'Business arm does not exist');
   const found=await env.DB.prepare('SELECT id FROM document_design_profiles WHERE tenant_id=? AND id=? AND archived_at IS NULL').bind(tenant,b.profileId).first();
   if(!found)fail(404,'Document design no longer available');
   await env.DB.prepare('UPDATE business_arms SET design_profile_id=? WHERE tenant_id=? AND id=? AND archived_at IS NULL').bind(b.profileId,tenant,b.armId).run();
   return json({ok:true});
  }
  if(action==='archive'){
   if(!uuid(id))fail(400,'Invalid document design');
   const assigned=await env.DB.prepare('SELECT count(*) n FROM business_arms WHERE tenant_id=? AND design_profile_id=? AND archived_at IS NULL').bind(tenant,id).first();
   if(assigned?.n)fail(409,'Choose another design for the assigned business arm first');
   const changed=await env.DB.prepare("UPDATE document_design_profiles SET archived_at=datetime('now') WHERE tenant_id=? AND id=? AND archived_at IS NULL").bind(tenant,id).run();
   if(!changed.meta?.changes)fail(404,'Document design not found');
   return json({ok:true});
  }
  if(!['create','update'].includes(action))fail(400,'Invalid design action');
  const template=str(b.template,90),name=required(b.name,100),accent=str(b.accent||'#6935df',7),secondary=str(b.secondary||'#19223b',7),font=str(b.font||'modern',20);
  await assertTemplateAllowance(env,tenant,template);
  if(!/^#[0-9a-fA-F]{6}$/.test(accent)||!/^#[0-9a-fA-F]{6}$/.test(secondary)||!['modern','editorial','mono','rounded'].includes(font))fail(400,'Choose valid colours and a font');
  if(action==='create'){
   const newId=crypto.randomUUID();
   await env.DB.prepare('INSERT INTO document_design_profiles(tenant_id,id,name,template,accent,secondary_color,font_family,header_note,footer_note,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)')
   .bind(tenant,newId,name,template,accent,secondary,font,str(b.header,220),str(b.footer||'Thank you for your business.',260),user.id).run();
   return json({id:newId},201);
  }
  if(!uuid(id))fail(400,'Invalid design profile');
  const changed=await env.DB.prepare('UPDATE document_design_profiles SET name=?,template=?,accent=?,secondary_color=?,font_family=?,header_note=?,footer_note=? WHERE tenant_id=? AND id=? AND archived_at IS NULL')
   .bind(name,template,accent,secondary,font,str(b.header,220),str(b.footer||'Thank you for your business.',260),tenant,id).run();
  if(!changed.meta?.changes)fail(404,'Design profile not found');
  return json({ok:true});
 }
 if(resource==='arms'){
  if(!write){
   const r=await env.DB.prepare('SELECT id,slug,name,document_prefix,contact_phone,receipt_footer,design_profile_id,is_primary,archived_at FROM business_arms WHERE tenant_id=? ORDER BY is_primary DESC,created_at ASC').bind(tenant).all();
   return json({rows:r.results||[]});
  }
  if(!admin)fail(403,'Only administrators can manage business arms');
  const b=await input(req),action=str(b.action||'create',24);
  if(action==='create'){
   const name=required(b.name,100),slugValue=str(b.slug,40).toLowerCase(),prefix=str(b.prefix||'BZ',8).toUpperCase();
   if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slugValue)||!(/^[A-Z0-9]{2,8}$/).test(prefix))fail(400,'Choose a valid business-arm code and document prefix');
   const id=crypto.randomUUID();
   try{await env.DB.prepare('INSERT INTO business_arms(tenant_id,id,slug,name,document_prefix,contact_phone,receipt_footer,is_primary,created_by) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(tenant,id,slugValue,name,prefix,str(b.phone,30)||null,str(b.footer,260),0,user.id).run();
   }catch(e){if(String(e).includes('UNIQUE'))fail(409,'That business-arm code is already used');throw e}
   return json({id},201);
  }
  if(action==='update'||action==='archive'){
   const id=b.id;if(!uuid(id))fail(400,'Invalid business arm');
   const previous=await env.DB.prepare('SELECT * FROM business_arms WHERE tenant_id=? AND id=?').bind(tenant,id).first();
   if(!previous||previous.archived_at)fail(404,'Business arm not found');
   if(action==='archive'){
    if(previous.is_primary)fail(409,'Main business arm cannot be archived');
    await env.DB.prepare("UPDATE business_arms SET archived_at=datetime('now') WHERE tenant_id=? AND id=?").bind(tenant,id).run();
   }else{
    const name=required(b.name,100),prefix=str(b.prefix||previous.document_prefix,8).toUpperCase();
    if(!/^[A-Z0-9]{2,8}$/.test(prefix))fail(400,'Invalid document prefix');
    await env.DB.prepare('UPDATE business_arms SET name=?,document_prefix=?,contact_phone=?,receipt_footer=? WHERE tenant_id=? AND id=?')
     .bind(name,prefix,str(b.phone,30)||null,str(b.footer,260),tenant,id).run();
   }
   return json({ok:true});
  }
  fail(400,'Unsupported business-arm action');
 }
 if(resource==='locations'){
  if(!write){
   const r=await env.DB.prepare('SELECT id,code,name,type,address,is_primary,archived_at FROM business_locations WHERE tenant_id=? ORDER BY is_primary DESC,created_at ASC').bind(tenant).all();
   return json({rows:r.results||[]});
  }
  if(!admin)fail(403,'Only administrators can manage locations');
  const b=await input(req),action=str(b.action||'create',24);
  if(action==='create'){
   const name=required(b.name,100),code=str(b.code,20).toUpperCase(),type=str(b.type||'shop',20);
   if(!/^[A-Z0-9-]{2,20}$/.test(code)||!['shop','office','warehouse','service'].includes(type))fail(400,'Choose a valid location code and type');
   const id=crypto.randomUUID();
   try{await env.DB.prepare('INSERT INTO business_locations(tenant_id,id,code,name,type,address,is_primary,created_by) VALUES(?,?,?,?,?,?,0,?)').bind(tenant,id,code,name,type,str(b.address,400),user.id).run()}
   catch(e){if(String(e).includes('UNIQUE'))fail(409,'Location code already exists');throw e}
   return json({id},201);
  }
  if(action==='update'||action==='archive'){
   const id=b.id;if(!uuid(id))fail(400,'Invalid location');
   const existing=await env.DB.prepare('SELECT * FROM business_locations WHERE tenant_id=? AND id=?').bind(tenant,id).first();
   if(!existing||existing.archived_at)fail(404,'Location not found');
   if(action==='archive'){
    if(existing.is_primary)fail(409,'Main location cannot be archived');
    const balance=await env.DB.prepare('SELECT count(*) n FROM product_location_stock WHERE tenant_id=? AND location_id=? AND stock_milli>0').bind(tenant,id).first();
    if(balance?.n)fail(409,'Move stock to another location before archiving');
    await env.DB.prepare("UPDATE business_locations SET archived_at=datetime('now') WHERE tenant_id=? AND id=?").bind(tenant,id).run();
   }else{
    const name=required(b.name,100),type=str(b.type||existing.type,20);
    if(!['shop','office','warehouse','service'].includes(type))fail(400,'Invalid location type');
    await env.DB.prepare('UPDATE business_locations SET name=?,type=?,address=? WHERE tenant_id=? AND id=?')
     .bind(name,type,str(b.address,400),tenant,id).run();
   }
   return json({ok:true});
  }
  fail(400,'Unsupported location action');
 }
 if(resource==='stock-locations'){
  if(write)fail(405,'Use a stock transfer to move stock');
  const rows=await env.DB.prepare('SELECT s.product_id,p.name product_name,s.location_id,l.name location_name,s.stock_milli FROM product_location_stock s JOIN products p ON p.tenant_id=s.tenant_id AND p.id=s.product_id JOIN business_locations l ON l.tenant_id=s.tenant_id AND l.id=s.location_id WHERE s.tenant_id=? ORDER BY p.name,l.name LIMIT 500').bind(tenant).all();
  return json({rows:rows.results||[]});
 }
 if(resource==='stock-transfer'){
  if(!write)fail(405,'Transfer form requires a submission');
  if(!['owner','admin','manager'].includes(t.role))fail(403,'Only stock managers may transfer stock');
  const b=await input(req),from=b.fromLocationId,to=b.toLocationId,product=b.productId,qty=Number(b.quantity);
  if(!uuid(from)||!uuid(to)||!uuid(product)||from===to||!Number.isFinite(qty)||qty<=0||Math.round(qty*1000)<1||Math.round(qty*1000)>1e12)fail(400,'Select two different locations, a product and a positive quantity');
  const milliQty=Math.round(qty*1000);
  const id=crypto.randomUUID();
  try{await env.DB.prepare('INSERT INTO stock_transfers(tenant_id,id,product_id,from_location_id,to_location_id,quantity_milli,reason,created_by) VALUES(?,?,?,?,?,?,?,?)')
   .bind(tenant,id,product,from,to,milliQty,str(b.reason,250),user.id).run()}
  catch(e){if(String(e).includes('Insufficient stock'))fail(409,'Insufficient stock at source location');throw e}
  return json({id},201);
 }
 if(resource==='staff-scopes'){
  if(!admin)fail(403,'Only administrators may manage staff scopes');
  if(!write){
   const r=await env.DB.prepare("SELECT m.user_id,u.email,m.role,sl.location_id,sa.arm_id FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN staff_location_scopes sl ON sl.tenant_id=m.tenant_id AND sl.user_id=m.user_id LEFT JOIN staff_arm_scopes sa ON sa.tenant_id=m.tenant_id AND sa.user_id=m.user_id WHERE m.tenant_id=? AND m.disabled_at IS NULL ORDER BY u.email LIMIT 200").bind(tenant).all();
   return json({rows:r.results||[]});
  }
  const b=await input(req),userId=b.userId;
  if(!uuid(userId))fail(400,'Choose a valid staff member');
  const memberRow=await env.DB.prepare('SELECT role FROM memberships WHERE tenant_id=? AND user_id=? AND disabled_at IS NULL').bind(tenant,userId).first();
  if(!memberRow)fail(404,'Staff member not found');
  if(memberRow.role==='owner'||memberRow.role==='admin')fail(403,'Administrative access cannot be location-restricted');
  const locs=b.locations,arms=b.arms;
  if(!Array.isArray(locs)||!Array.isArray(arms)||locs.length>30||arms.length>30)fail(400,'Invalid staff scope');
  for(const id of [...locs,...arms])if(!uuid(id))fail(400,'Invalid scope identifier');
  if(new Set(locs).size!==locs.length||new Set(arms).size!==arms.length)fail(400,'Duplicate assigned scope');
  for(const id of locs)if(!await active('business_locations',id))fail(404,'Assigned location not active');
  for(const id of arms)if(!await active('business_arms',id))fail(404,'Assigned business arm not active');
  const queries=[
   env.DB.prepare('DELETE FROM staff_location_scopes WHERE tenant_id=? AND user_id=?').bind(tenant,userId),
   env.DB.prepare('DELETE FROM staff_arm_scopes WHERE tenant_id=? AND user_id=?').bind(tenant,userId),
   ...locs.map(id=>env.DB.prepare('INSERT INTO staff_location_scopes(tenant_id,user_id,location_id) VALUES(?,?,?)').bind(tenant,userId,id)),
   ...arms.map(id=>env.DB.prepare('INSERT INTO staff_arm_scopes(tenant_id,user_id,arm_id) VALUES(?,?,?)').bind(tenant,userId,id))
  ];
  await env.DB.batch(queries);
  return json({ok:true});
 }
 fail(404,'Unknown business resource');
}
export async function assertDocumentOrgScope(env,user,t,armId,locationId){
 const arm=armId||t.id,location=locationId||t.id;
 if(typeof arm!=='string'||typeof location!=='string'||!/^[a-f0-9-]{36}$/.test(arm)||!/^[a-f0-9-]{36}$/.test(location))fail(400,'Choose a valid business arm and location');
 const [a,l]=await Promise.all([
 env.DB.prepare('SELECT id,document_prefix FROM business_arms WHERE tenant_id=? AND id=? AND archived_at IS NULL').bind(t.id,arm).first(),
 env.DB.prepare('SELECT id FROM business_locations WHERE tenant_id=? AND id=? AND archived_at IS NULL').bind(t.id,location).first()
 ]);
 if(!a||!l)fail(404,'Business arm or location not found');
 if(!['owner','admin'].includes(t.role)){
  const [ac,lc]=await Promise.all([
   env.DB.prepare('SELECT count(*) n FROM staff_arm_scopes WHERE tenant_id=? AND user_id=?').bind(t.id,user.id).first(),
   env.DB.prepare('SELECT count(*) n FROM staff_location_scopes WHERE tenant_id=? AND user_id=?').bind(t.id,user.id).first()
  ]);
  if(ac?.n&&!await env.DB.prepare('SELECT 1 ok FROM staff_arm_scopes WHERE tenant_id=? AND user_id=? AND arm_id=?').bind(t.id,user.id,arm).first())fail(403,'You are not assigned to this business arm');
  if(lc?.n&&!await env.DB.prepare('SELECT 1 ok FROM staff_location_scopes WHERE tenant_id=? AND user_id=? AND location_id=?').bind(t.id,user.id,location).first())fail(403,'You are not assigned to this location');
 }
 return {armId:arm,locationId:location,documentPrefix:a.document_prefix};
}

export async function assertDocumentReadScope(env,user,t,armId,locationId){
 if(['owner','admin'].includes(t.role))return;
 const [arms,places]=await Promise.all([
  env.DB.prepare('SELECT count(*) n FROM staff_arm_scopes WHERE tenant_id=? AND user_id=?').bind(t.id,user.id).first(),
  env.DB.prepare('SELECT count(*) n FROM staff_location_scopes WHERE tenant_id=? AND user_id=?').bind(t.id,user.id).first()
 ]);
 if(arms?.n&&!await env.DB.prepare('SELECT 1 ok FROM staff_arm_scopes WHERE tenant_id=? AND user_id=? AND arm_id=?').bind(t.id,user.id,armId||t.id).first())fail(403,'Document belongs to another business arm');
 if(places?.n&&!await env.DB.prepare('SELECT 1 ok FROM staff_location_scopes WHERE tenant_id=? AND user_id=? AND location_id=?').bind(t.id,user.id,locationId||t.id).first())fail(403,'Document belongs to another location');
}
