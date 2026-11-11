// Bizlano-native email/password authentication on Cloudflare D1.
// RESEND_API_KEY is a Worker SECRET; RESEND_FROM_EMAIL is a verified Bizlano sender.
// No Cloudflare Access seats, Supabase credentials, or Firebase client auth are required.
function nativeSafe(s){return String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function nativeEmailConfig(env){
 if(typeof env.RESEND_API_KEY!=='string'||!/^re_\S{8,}$/.test(env.RESEND_API_KEY)||typeof env.RESEND_FROM_EMAIL!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.RESEND_FROM_EMAIL))
 fail(503,'Account email delivery is being configured. Please try again later.');
}
function nativeTemplate(kind,name,url,origin){
 const title=kind==='verify_email'?'Confirm your email':'Reset your password';
 const intro=kind==='verify_email'?'One more step and your Bizlano workspace is ready.':'We received a request to reset your Bizlano password.';
 const button=kind==='verify_email'?'Verify email address':'Reset password';
 const caption=kind==='verify_email'?'This verification link is valid for 20 minutes.':'This password reset link is valid for 20 minutes.';
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+title+'</title></head><body style="margin:0;background:#f7f6fc;font-family:Arial,Helvetica,sans-serif;color:#1c2344"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f6fc;padding:32px 12px"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:white;border-radius:18px;border:1px solid #e8e6f0;overflow:hidden"><tr><td style="background:#ffffff;padding:28px 32px;border-bottom:1px solid #ece9f5"><img src="'+nativeSafe(origin)+'/assets/bizlano-logo.png" width="142" alt="Bizlano" style="max-width:142px;height:auto"></td></tr><tr><td style="padding:38px 34px"><p style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#6734d9;margin:0 0 14px">YOUR BUSINESS, BEAUTIFULLY MANAGED</p><h1 style="font-size:30px;letter-spacing:-1px;line-height:1.2;margin:0 0 17px">'+title+'</h1><p style="font-size:15px;color:#545e79;line-height:1.8;margin:0 0 14px">Hello '+nativeSafe(name)+',</p><p style="font-size:15px;color:#545e79;line-height:1.8;margin:0 0 28px">'+intro+'</p><a href="'+nativeSafe(url)+'" style="display:inline-block;background:#6c36df;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:15px 25px;border-radius:10px">'+button+'</a><p style="font-size:12px;color:#748098;line-height:1.7;margin:30px 0 0">'+caption+' If you did not request this, you can ignore this message.</p><p style="font-size:11px;color:#80869d;word-break:break-all;line-height:1.7;margin-top:18px">If the button does not work, copy this link: '+nativeSafe(url)+'</p></td></tr><tr><td style="padding:21px 34px;border-top:1px solid #eeeaf5;background:#faf9fe;color:#7a829b;font-size:12px">Bizlano · Your business, beautifully managed.<br><a href="'+nativeSafe(origin)+'/legal/privacy" style="color:#6535d7">Privacy</a> &nbsp; · &nbsp; <a href="'+nativeSafe(origin)+'/help" style="color:#6535d7">Help</a></td></tr></table></td></tr></table></body></html>';
 const text=title+'\n\nHello '+name+',\n'+intro+'\n\n'+button+': '+url+'\n\n'+caption+' If you did not request this, ignore this message.\nBizlano — '+origin;
 return {subject:title+' | Bizlano',html,text};
}
async function nativeSend(env,address,purpose,name,actionUrl,origin){
 nativeEmailConfig(env);
 const mail=nativeTemplate(purpose,name,actionUrl,origin);
 let r;try{r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:'Bizlano <'+env.RESEND_FROM_EMAIL+'>',to:[address],subject:mail.subject,html:mail.html,text:mail.text}),signal:AbortSignal.timeout(9000)})}catch{fail(503,'Email delivery is temporarily unavailable')}
 if(!r.ok)fail(503,'Email delivery is temporarily unavailable');
}
async function nativeSession(env,user){
 const token=rnd();
 await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+7 days'))").bind(await hash(token),user.id).run();
 return {body:json({user:{id:user.id,email:user.email,name:user.display_name,emailVerified:true}},200,{'set-cookie':sessionCookie(token,604800)}),token};
}
async function nativeAuthApi(req,env,url){
 const path=url.pathname,method=req.method;
 if(path==='/api/account/session'&&method==='GET'){
  try{
   const user=await identity(req,env);
   const record=await env.DB.prepare("SELECT email_verified_at FROM users WHERE id=?").bind(user.id).first();
   const phoneOnly=user.email.endsWith('@accounts.bizlano.invalid');
   return json({user:{id:user.id,email:phoneOnly?null:user.email,name:user.display_name,emailVerified:!!record?.email_verified_at||phoneOnly,phoneOnly}});
  }catch(e){if(e instanceof ErrorWithStatus&&e.code===401)return json({user:null});throw e}
 }
 if(method!=='POST')fail(405,'Method not allowed');
 const remote=req.headers.get('cf-connecting-ip')||'unknown',b=await input(req);
 if(path==='/api/account/register'){
  nativeEmailConfig(env);
  await limitAnonymousAttempt(env,'register',remote);
  const address=email(b.email),name=field(b.name,'name',120),password=b.password;
  if(typeof password!=='string'||password.length<10||password.length>256)fail(400,'Choose a password of at least 10 characters');
  const found=await env.DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').bind(address).first();
  if(found)fail(409,'An account with that email already exists. Sign in or reset the password.');
  const id=crypto.randomUUID(),salt=hex(crypto.getRandomValues(new Uint8Array(16))),digest=await passwordDigest(password,salt),token=rnd();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO users(id,email,display_name,password_hash,password_salt) VALUES(?,?,?,?,?)').bind(id,address,name,digest,salt),
   env.DB.prepare("INSERT INTO auth_action_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,'verify_email',datetime('now','+20 minutes'))").bind(await hash(token),id)
  ]);
  await nativeSend(env,address,'verify_email',name,url.origin+(b.audience==='customer'?'/receipts':'/app')+'?verify='+encodeURIComponent(token),url.origin);
  return json({ok:true,verificationRequired:true},201);
 }
 if(path==='/api/account/resend'){
  nativeEmailConfig(env);
  await limitAnonymousAttempt(env,'resend',remote);
  const address=email(b.email),user=await env.DB.prepare('SELECT id,email,display_name,email_verified_at FROM users WHERE email=? COLLATE NOCASE AND disabled_at IS NULL').bind(address).first();
  if(user&&!user.email_verified_at&&user.password_hash!=='firebase'){
   const token=rnd();await env.DB.prepare("INSERT INTO auth_action_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,'verify_email',datetime('now','+20 minutes'))").bind(await hash(token),user.id).run();
   await nativeSend(env,address,'verify_email',user.display_name,url.origin+(b.audience==='customer'?'/receipts':'/app')+'?verify='+encodeURIComponent(token),url.origin);
  }
  return json({ok:true});
 }
 if(path==='/api/account/verify'){
  const token=String(b.token||'');
  if(!/^[a-f0-9]{64}$/.test(token))fail(400,'Invalid verification link');
  const record=await env.DB.prepare("SELECT t.user_id,u.id,u.email,u.display_name FROM auth_action_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.purpose='verify_email' AND t.used_at IS NULL AND t.expires_at>datetime('now') AND u.disabled_at IS NULL").bind(await hash(token)).first();
  if(!record)fail(400,'Verification link has expired or has already been used');
  const used=await env.DB.prepare("UPDATE auth_action_tokens SET used_at=datetime('now') WHERE token_hash=? AND used_at IS NULL AND expires_at>datetime('now') RETURNING user_id").bind(await hash(token)).first();
  if(!used)fail(400,'Verification link is no longer valid');
  await env.DB.prepare("UPDATE users SET email_verified_at=datetime('now') WHERE id=?").bind(record.user_id).run();
  return (await nativeSession(env,record)).body;
 }
 if(path==='/api/account/login'){
  await limitAnonymousAttempt(env,'login',remote);
  const address=email(b.email),password=b.password;
  if(typeof password!=='string'||password.length<6||password.length>256)fail(401,'Incorrect email or password');
  const user=await env.DB.prepare('SELECT id,email,display_name,password_hash,password_salt,email_verified_at FROM users WHERE email=? COLLATE NOCASE AND disabled_at IS NULL').bind(address).first();
  if(!user||!user.password_salt||user.password_hash==='firebase')fail(401,'Incorrect email or password');
  const digest=await passwordDigest(password,user.password_salt);let diff=0;
  for(let i=0;i<64;i++)diff|=digest.charCodeAt(i)^user.password_hash.charCodeAt(i);
  if(diff!==0)fail(401,'Incorrect email or password');
  if(!user.email_verified_at)fail(403,'Confirm your email first, or request a new verification message.');
  return (await nativeSession(env,user)).body;
 }
 if(path==='/api/account/reset-request'){
  nativeEmailConfig(env);
  await limitAnonymousAttempt(env,'password-reset',remote);
  const address=email(b.email),user=await env.DB.prepare("SELECT id,email,display_name FROM users WHERE email=? COLLATE NOCASE AND password_hash!='firebase' AND disabled_at IS NULL AND email_verified_at IS NOT NULL").bind(address).first();
  if(user){const token=rnd();await env.DB.prepare("INSERT INTO auth_action_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,'reset_password',datetime('now','+20 minutes'))").bind(await hash(token),user.id).run();await nativeSend(env,address,'reset_password',user.display_name,url.origin+(b.audience==='customer'?'/receipts':'/app')+'?reset='+encodeURIComponent(token),url.origin)}
  return json({ok:true});
 }
 if(path==='/api/account/reset'){
  await limitAnonymousAttempt(env,'password-change',remote);
  const token=String(b.token||''),password=b.password;
  if(!/^[a-f0-9]{64}$/.test(token)||typeof password!=='string'||password.length<10||password.length>256)fail(400,'Reset link or password is invalid');
  const record=await env.DB.prepare("SELECT t.user_id,u.id,u.email,u.display_name FROM auth_action_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.purpose='reset_password' AND t.used_at IS NULL AND t.expires_at>datetime('now') AND u.disabled_at IS NULL").bind(await hash(token)).first();
  if(!record)fail(400,'Reset link has expired or has already been used');
  const salt=hex(crypto.getRandomValues(new Uint8Array(16))),digest=await passwordDigest(password,salt);
  const used=await env.DB.prepare("UPDATE auth_action_tokens SET used_at=datetime('now') WHERE token_hash=? AND used_at IS NULL AND expires_at>datetime('now') RETURNING user_id").bind(await hash(token)).first();
  if(!used)fail(400,'Reset link is no longer valid');
  await env.DB.batch([
   env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,email_verified_at=COALESCE(email_verified_at,datetime('now')) WHERE id=?").bind(digest,salt,record.id),
   env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL").bind(record.id)
  ]);
  return (await nativeSession(env,record)).body;
 }
 fail(404,'Unknown account action');
}
