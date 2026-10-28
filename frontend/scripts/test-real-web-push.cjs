const assert=require('node:assert/strict');
const {randomUUID,createECDH,createHmac,createDecipheriv}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:file}).outputText,file);
const cryptoModule=require(path.join(__dirname,'../src/lib/server/web-push-crypto.ts'));
const {ensurePushSchema,handleCustomerPush,deliverQueuedPush}=require(path.join(__dirname,'../src/lib/server/push-delivery.ts'));
const b64=b=>Buffer.from(b).toString('base64url'),rand=()=>randomUUID();
const vapid=createECDH('prime256v1');vapid.generateKeys();
process.env.VAPID_PUBLIC_KEY=b64(vapid.getPublicKey());
process.env.VAPID_PRIVATE_KEY=b64(vapid.getPrivateKey());
process.env.VAPID_SUBJECT='https://loyvance.vercel.app';
const client=createECDH('prime256v1');client.generateKeys();
const auth=require('node:crypto').randomBytes(16);
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test-push',keys:{p256dh:b64(client.getPublicKey()),auth:b64(auth)}};
const extract=(salt,ikm)=>createHmac('sha256',salt).update(ikm).digest();
const expand=(key,info,len)=>{let prev=Buffer.alloc(0),result=Buffer.alloc(0),idx=0;while(result.length<len){prev=createHmac('sha256',key).update(Buffer.concat([prev,info,Buffer.from([++idx])])).digest();result=Buffer.concat([result,prev]);}return result.subarray(0,len);};
const str=s=>Buffer.from(s+'\\0');
function decrypt(packet){
 const salt=packet.subarray(0,16),length=packet.readUInt32BE(16),keyLength=packet[20];
 assert.equal(length,4096);assert.equal(keyLength,65);
 const pub=packet.subarray(21,21+keyLength);
 const shared=client.computeSecret(pub);
 const ikm=expand(extract(auth,shared),Buffer.concat([str('WebPush: info'),client.getPublicKey(),pub]),32);
 const prk=extract(salt,ikm);
 const cipher=packet.subarray(21+keyLength,-16),tag=packet.subarray(-16);
 const d=createDecipheriv('aes-128-gcm',expand(prk,str('Content-Encoding: aes128gcm'),16),expand(prk,str('Content-Encoding: nonce'),12));
 d.setAuthTag(tag);const plain=Buffer.concat([d.update(cipher),d.final()]);
 assert.equal(plain.at(-1),2);
 return JSON.parse(plain.subarray(0,-1).toString('utf8'));
}
const db=new PGlite();
function sql(parts,...values){return db.query(parts.reduce((all,part,i)=>all+(i?'$'+i:'')+part,''),values).then(x=>x.rows);}
async function api(userId,method,route,body){
 const request=new Request('https://loyvance.test/api/user/push/'+route,{method,headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const r=await handleCustomerPush(request,sql,userId,['user','push',route]);
 return {status:r.status,data:await r.json()};
}
(async()=>{
 assert.equal(cryptoModule.validateSubscription(subscription).endpoint,subscription.endpoint);
 assert.equal(cryptoModule.validateSubscription({...subscription,endpoint:'https://127.0.0.1/secret'}),null,'Block SSRF');
 assert.equal(cryptoModule.validateSubscription({...subscription,endpoint:'http://fcm.googleapis.com/fcm/send/test'}),null,'Require HTTPS');
 assert.equal(cryptoModule.validateSubscription({...subscription,endpoint:'https://evil.example/fcm.googleapis.com'}),null,'Block lookalike domains');
 const example={title:'Stamp added',body:'One stamp for you',url:'/user/cards'};
 assert.deepEqual(decrypt(cryptoModule.createEncryptedPush(example,subscription)),example,'RFC8291 AES-GCM push decryption');
 await db.exec("CREATE TABLE app_users(id uuid PRIMARY KEY,role text);CREATE TABLE businesses(id uuid PRIMARY KEY);CREATE TABLE customers(id uuid PRIMARY KEY,business_id uuid REFERENCES businesses(id),user_id uuid REFERENCES app_users(id));CREATE TABLE customer_profiles(user_id uuid PRIMARY KEY,preferences jsonb,birthday_opt_in boolean DEFAULT false);CREATE TABLE customer_notifications(id text PRIMARY KEY,customer_id uuid REFERENCES customers(id),type text,title text,message text,created_at timestamptz DEFAULT now());");
 await ensurePushSchema(sql);
 const a=rand(),b=rand(),business=rand(),ca=rand(),cb=rand();
 await sql`INSERT INTO app_users(id,role) VALUES(${a},'customer'),(${b},'customer')`;
 await sql`INSERT INTO businesses(id) VALUES(${business})`;
 await sql`INSERT INTO customers(id,business_id,user_id) VALUES(${ca},${business},${a}),(${cb},${business},${b})`;
 await sql`INSERT INTO customer_profiles(user_id,preferences,birthday_opt_in) VALUES(${a},'{"notifications":{"push_enabled":true,"reward_alerts":true,"promotions":false}}'::jsonb,true),(${b},'{"notifications":{"push_enabled":true,"promotions":false}}'::jsonb,false)`;
 assert.equal((await api(a,'GET','config')).data.configured,true);
 const add=await api(a,'POST','subscriptions',{subscription});assert.equal(add.status,201,JSON.stringify(add));
 assert.equal((await api(a,'GET','subscriptions')).data.devices,1);
 const pushRequests=[];
 const oldFetch=global.fetch;
 global.fetch=async(endpoint,request)=>{pushRequests.push({endpoint,request});return {status:201};};
 try {
  await sql`INSERT INTO customer_notifications(id,customer_id,type,title,message) VALUES('stamp-a',${ca},'stamp_added','Stamp added','You earned a stamp'),('campaign-a',${ca},'campaign','Promo','Special'),('stamp-b',${cb},'stamp_added','Other user','Private')`;
  const result=await deliverQueuedPush(sql,30);
  assert.equal(result.sent,1,JSON.stringify(result));
  assert.equal(pushRequests.length,1);
  const body=Buffer.from(pushRequests[0].request.body);
  assert.equal(decrypt(body).title,'Stamp added');
  assert.equal(decrypt(cryptoModule.createEncryptedPush({test:'another'},subscription)).test,'another');
  assert.match(pushRequests[0].request.headers.Authorization,/^vapid t=/);
  const again=await deliverQueuedPush(sql,30);
  assert.equal(again.sent,0,'Do not redeliver sent alerts');
  const muted=await sql`SELECT COUNT(*)::int AS total FROM web_push_deliveries WHERE notification_id='campaign-a'`;
  assert.equal(muted[0].total,0,'No promo push without promotional consent');
  const otherUser=await sql`SELECT COUNT(*)::int AS total FROM web_push_deliveries WHERE notification_id='stamp-b'`;
  assert.equal(otherUser[0].total,0,'Do not leak another customer notifications');
 }finally{global.fetch=oldFetch;}
 await api(a,'DELETE','subscriptions',{endpoint:subscription.endpoint});
 assert.equal((await api(a,'GET','subscriptions')).data.devices,0);
 console.log('PASS: native Web Push encryption, allowlisted endpoints, VAPID, tenant consent, once-only delivery and device removal');
})().finally(()=>db.close()).catch(e=>{console.error(e);process.exitCode=1;});
