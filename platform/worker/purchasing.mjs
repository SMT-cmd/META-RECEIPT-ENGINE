// Tenant-bound procurement for Bizlano. Does not create sales or alter GWS marketplace orders.
export async function purchasingAPI(req,env,user,t,resource){
 const post=req.method==='POST',tenant=t.id;
 const canSee=['owner','admin','manager','accountant'].includes(t.role);
 const canWrite=['owner','admin','manager'].includes(t.role);
 if(!canSee)fail(403,'Your role cannot view purchasing');
 const required=(v,max=160)=>{const s=String(v??'').trim();if(!s||s.length>max)fail(400,'Complete the required purchase details');return s};
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(v);
 if(resource==='suppliers'){
  if(!post){
   const x=await env.DB.prepare('SELECT id,name,phone,email,address,archived_at FROM business_suppliers WHERE tenant_id=? ORDER BY name LIMIT 150').bind(tenant).all();
   return json({rows:x.results||[]});
  }
  if(!canWrite)fail(403,'Only purchasing managers can add suppliers');
  const b=await input(req),name=required(b.name,120),id=crypto.randomUUID();
  const emailAddress=b.email?email(b.email):null,telephone=b.phone?String(b.phone).trim().slice(0,30):null;
  await env.DB.prepare('INSERT INTO business_suppliers(tenant_id,id,name,phone,email,address,created_by) VALUES(?,?,?,?,?,?,?)')
   .bind(tenant,id,name,telephone,emailAddress,String(b.address||'').trim().slice(0,400),user.id).run();
  return json({id},201);
 }
 if(resource==='purchases'){
  if(!post){
   const x=await env.DB.prepare('SELECT o.id,o.supplier_reference,o.status,o.total_minor,o.created_at,o.received_at,s.name supplier_name,l.name location_name FROM purchase_orders o JOIN business_suppliers s ON s.tenant_id=o.tenant_id AND s.id=o.supplier_id JOIN business_locations l ON l.tenant_id=o.tenant_id AND l.id=o.location_id WHERE o.tenant_id=? ORDER BY o.created_at DESC LIMIT 150').bind(tenant).all();
   return json({rows:x.results||[]});
  }
  if(!canWrite)fail(403,'Only purchasing managers can record stock purchases');
  const b=await input(req);
  if(b.action==='receive'){
   if(!uuid(b.id))fail(400,'Choose a valid purchase order');
   const order=await env.DB.prepare('SELECT id,location_id,status FROM purchase_orders WHERE tenant_id=? AND id=?').bind(tenant,b.id).first();
   if(!order)fail(404,'Purchase order not found');
   const restricted=await env.DB.prepare('SELECT count(*) n FROM staff_location_scopes WHERE tenant_id=? AND user_id=?').bind(tenant,user.id).first();
   if(!['owner','admin'].includes(t.role)&&restricted?.n&&
    !await env.DB.prepare('SELECT 1 ok FROM staff_location_scopes WHERE tenant_id=? AND user_id=? AND location_id=?').bind(tenant,user.id,order.location_id).first())
    fail(403,'You are not assigned to this receiving location');
   const result=await env.DB.prepare("UPDATE purchase_orders SET status='received',received_by=?,received_at=datetime('now') WHERE tenant_id=? AND id=? AND status='draft'").bind(user.id,tenant,b.id).run();
   if(!result.meta?.changes)fail(409,'Purchase order is already received or no longer editable');
   return json({id:b.id,received:true});
  }
  if(b.action==='cancel'){
   if(!uuid(b.id))fail(400,'Choose a valid purchase order');
   const result=await env.DB.prepare("UPDATE purchase_orders SET status='cancelled' WHERE tenant_id=? AND id=? AND status='draft'").bind(tenant,b.id).run();
   if(!result.meta?.changes)fail(409,'This order cannot be cancelled');
   return json({ok:true});
  }
  if(b.action&&b.action!=='create')fail(400,'Unknown purchase action');
  if(!uuid(b.supplierId)||!uuid(b.locationId))fail(400,'Choose a supplier and receiving location');
  const [supplier,location]=await Promise.all([
   env.DB.prepare('SELECT id FROM business_suppliers WHERE tenant_id=? AND id=? AND archived_at IS NULL').bind(tenant,b.supplierId).first(),
   env.DB.prepare('SELECT id FROM business_locations WHERE tenant_id=? AND id=? AND archived_at IS NULL').bind(tenant,b.locationId).first()
  ]);
  if(!supplier||!location)fail(404,'Supplier or location not found in this business');
  const restricted=await env.DB.prepare('SELECT count(*) n FROM staff_location_scopes WHERE tenant_id=? AND user_id=?').bind(tenant,user.id).first();
  if(!['owner','admin'].includes(t.role)&&restricted?.n&&
   !await env.DB.prepare('SELECT 1 ok FROM staff_location_scopes WHERE tenant_id=? AND user_id=? AND location_id=?').bind(tenant,user.id,b.locationId).first())
   fail(403,'You are not assigned to the receiving location');
  if(!Array.isArray(b.items)||b.items.length<1||b.items.length>50)fail(400,'Add 1 to 50 purchase items');
  let total=0;const items=[];
  for(const item of b.items){
   if(!uuid(item.productId))fail(400,'Select a product from this business');
   const quantity=Number(item.quantity),unitCost=Number(item.unitCost);
   if(!Number.isFinite(quantity)||quantity<=0||quantity>1e7||!Number.isFinite(unitCost)||unitCost<0||unitCost>1e12)fail(400,'Invalid purchase quantity or unit cost');
   const quantityMilli=Math.round(quantity*1000),costMinor=Math.round(unitCost*100);
   if(!Number.isSafeInteger(quantityMilli)||quantityMilli<1||!Number.isSafeInteger(costMinor))fail(400,'Invalid item amounts');
   const product=await env.DB.prepare('SELECT id,track_stock FROM products WHERE tenant_id=? AND id=?').bind(tenant,item.productId).first();
   if(!product||!product.track_stock)fail(404,'Choose a stock-tracked product');
   const lineTotal=Math.round(quantityMilli*costMinor/1000);
   total+=lineTotal;if(!Number.isSafeInteger(total)||total>Number.MAX_SAFE_INTEGER/2)fail(400,'Purchase total is too large');
   items.push({productId:item.productId,quantityMilli,costMinor,lineTotal});
  }
  const id=crypto.randomUUID(),reference=String(b.reference||'').trim().slice(0,80);
  const batch=[
   env.DB.prepare('INSERT INTO purchase_orders(tenant_id,id,supplier_id,location_id,supplier_reference,notes,total_minor,created_by) VALUES(?,?,?,?,?,?,?,?)')
   .bind(tenant,id,b.supplierId,b.locationId,reference||null,String(b.notes||'').trim().slice(0,400),total,user.id),
   ...items.map(item=>env.DB.prepare('INSERT INTO purchase_order_lines(tenant_id,id,order_id,product_id,quantity_milli,unit_cost_minor,line_total_minor) VALUES(?,?,?,?,?,?,?)')
    .bind(tenant,crypto.randomUUID(),id,item.productId,item.quantityMilli,item.costMinor,item.lineTotal))
  ];
  await env.DB.batch(batch);
  return json({id,total_minor:total},201);
 }
 fail(404,'Unknown procurement resource');
}
