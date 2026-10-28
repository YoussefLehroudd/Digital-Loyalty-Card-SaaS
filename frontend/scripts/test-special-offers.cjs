const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:filename}).outputText,filename);
const {ensureSpecialOfferSchema,handleBusinessOffers,handleCustomerOffers}=require(path.join(__dirname,'../src/lib/server/special-offers.ts'));
function sql(parts,...values){return db.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),values).then(r=>r.rows);}
const id=()=>randomUUID();
async function api(businessId,method,p='',body){
 const res=await handleBusinessOffers(['special-offers','business',...p.split('/').filter(Boolean)],new Request('https://loyvance.test/api/special-offers/business/'+p,{method,headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),sql,businessId);
 return {status:res.status,data:await res.json()};
}
async function main(){
 await db.exec("CREATE TABLE businesses(id uuid PRIMARY KEY,name text,status text DEFAULT 'active',reward_config_version int DEFAULT 1,custom_stamp_quantity bool DEFAULT false,custom_stamp_quantity_active bool DEFAULT false,stamp_messages bool DEFAULT false,stamp_messages_active bool DEFAULT false);CREATE TABLE app_users(id uuid PRIMARY KEY,role text);CREATE TABLE business_subscriptions(business_id uuid,paid_ends_at timestamptz,trial_ends_at timestamptz);CREATE TABLE customers(id uuid PRIMARY KEY,business_id uuid,user_id uuid);CREATE TABLE visits(id uuid PRIMARY KEY,business_id uuid,customer_id uuid,order_reference text,stamp_count int,stamp_message text,actor_id uuid,created_at timestamptz DEFAULT now());CREATE UNIQUE INDEX visits_business_order_reference ON visits(business_id,order_reference) WHERE order_reference IS NOT NULL;CREATE TABLE customer_loyalties(id uuid PRIMARY KEY,customer_id uuid,loyalty_card_id uuid,current_stamps int DEFAULT 0,target_stamps int,updated_at timestamptz DEFAULT now());CREATE TABLE reward_redemptions(id uuid PRIMARY KEY,business_id uuid,customer_id uuid,loyalty_card_id uuid,status text,required_stamps_snapshot int,reward_name_snapshot text,description_snapshot text);CREATE TABLE customer_notifications(id text PRIMARY KEY,customer_id uuid,type text,title text,message text,reward_id uuid);");
 await ensureSpecialOfferSchema(sql);
 const b=id(),other=id(),owner=id(),u=id(),customerId=id(),loyaltyId=id(),cardId=id();
 await sql`INSERT INTO businesses(id,name) VALUES(${b},'Café'),(${other},'Other shop')`;
 await sql`INSERT INTO business_subscriptions(business_id,trial_ends_at) VALUES(${b},now()+interval '60 days'),(${other},now()+interval '60 days')`;
 await sql`INSERT INTO app_users(id,role) VALUES(${owner},'business_owner'),(${u},'customer')`;
 await sql`INSERT INTO customers(id,business_id,user_id) VALUES(${customerId},${b},${u})`;
 await sql`INSERT INTO customer_loyalties(id,customer_id,loyalty_card_id) VALUES(${loyaltyId},${customerId},${cardId})`;
 const common={description:'Double loyalty stamps',starts_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date(Date.now()+3*86400000).toISOString(),max_uses:1};
 const created=await api(b,'POST','',{...common,title:'First visit special',kind:'first_visit_double'});
 assert.equal(created.status,201,JSON.stringify(created));const offerId=created.data.offer.id;
 assert.equal((await api(other,'GET')).data.offers.length,0);
 assert.equal((await api(other,'PATCH',offerId,{is_active:false})).status,404);
 assert.equal((await api(b,'POST','',{...common,title:'Bad day',kind:'weekday_double',weekday:9})).status,422);
 const mine=await handleCustomerOffers(new Request('https://loyvance.test/api/special-offers/mine'),sql,u);
 assert.equal((await mine.json()).offers.length,1);
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/[...path]/route.ts'),'utf8');
 const tick=String.fromCharCode(96);
 const block=route.split('const stampRows = (await sql'+tick)[1]?.split(tick+') as Array<DbLoyalty')[0];
 assert.ok(block&&block.includes('offer_candidate AS')&&block.includes('offer_redemption AS'),'Use actual production stamp SQL');
 const runStamp=new Function('sql','randomUUID','auth','card','current','stampCount','stampMessage','orderReference','customer','return sql'+tick+block+tick+';');
 const auth={business:{id:b,name:'Café'},user:{id:owner}};
 const card={id:cardId,goal_selection:null,reward_config_version:1,required_stamps:10,reward_name:'Coffee',reward_description:'A reward'};
 const current={id:loyaltyId},customer={id:customerId};
 const stamp=(ref)=>runStamp(sql,randomUUID,auth,card,current,1,'',ref,customer);
 const first=await stamp('ORDER-1');
 assert.equal(first.length,1);assert.equal(first[0].stamps_awarded,2);assert.equal(first[0].bonus_recorded,true);
 assert.equal((await sql`SELECT uses_count FROM special_offers WHERE id=${offerId}`)[0].uses_count,1);
 assert.equal((await sql`SELECT count(*)::int AS n FROM special_offer_redemptions WHERE offer_id=${offerId}`)[0].n,1);
 assert.equal((await stamp('ORDER-1')).length,0,'Duplicate order not credited');
 assert.equal((await stamp('ORDER-2'))[0].stamps_awarded,1,'First visit only once');
 const day=new Date().getUTCDay();
 const week=await api(b,'POST','',{...common,title:'Weekday double',kind:'weekday_double',weekday:day});
 assert.equal(week.status,201);
 assert.equal((await stamp('ORDER-3'))[0].stamps_awarded,2,'Matching weekday doubles stamps');
 assert.equal((await stamp('ORDER-4'))[0].stamps_awarded,1,'Exhausted offer gives normal stamps');
 const next=await api(b,'POST','',{...common,title:'Last stamp',kind:'weekday_double',weekday:day,max_uses:3});
 assert.equal(next.status,201);
 await sql`UPDATE customer_loyalties SET current_stamps=9 WHERE id=${loyaltyId}`;
 assert.equal((await stamp('ORDER-5'))[0].stamps_awarded,1,'Cannot exceed reward cap');
 assert.equal((await sql`SELECT uses_count FROM special_offers WHERE id=${next.data.offer.id}`)[0].uses_count,0);
 console.log('PASS: tenant isolation, first-visit, weekday, limits, duplicate order protection and atomic bonus stamps');
}
main().finally(()=>db.close()).catch(e=>{console.error(e);process.exitCode=1;});
