/* End-to-end SQL regression checks on an isolated in-memory PGlite database. */
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:filename
}).outputText,filename);
const {ensureCampaignSchema,handleBusinessCampaigns,unsubscribeCampaignEmail,runCampaignEmails}=require(path.join(__dirname,'../src/lib/server/campaigns.ts'));
function sql(parts,...values){return db.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),values).then(x=>x.rows);}
const id=()=>randomUUID();
async function api(businessId,userId,method,p,body){
 const response=await handleBusinessCampaigns(['campaigns','business',...p.split('/').filter(Boolean)],
   new Request('https://loyvance.test/api/campaigns/business/'+p,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),
   sql,businessId,userId);
 return {status:response.status,data:await response.json()};
}
async function setup(){
 await db.exec(`
  CREATE TABLE businesses (id uuid PRIMARY KEY, name text, status text DEFAULT 'active');
  CREATE TABLE app_users (id uuid PRIMARY KEY,business_id uuid REFERENCES businesses(id),role text,status text DEFAULT 'active',email text,name text);
  CREATE TABLE business_subscriptions (business_id uuid PRIMARY KEY REFERENCES businesses(id),trial_ends_at timestamptz,paid_ends_at timestamptz);
  CREATE TABLE customers (id uuid PRIMARY KEY,business_id uuid REFERENCES businesses(id),user_id uuid REFERENCES app_users(id),created_at timestamptz DEFAULT now());
  CREATE TABLE customer_profiles (user_id uuid PRIMARY KEY REFERENCES app_users(id),first_name text,last_name text,preferences jsonb DEFAULT '{}'::jsonb,updated_at timestamptz DEFAULT now());
  CREATE TABLE loyalty_cards (id uuid PRIMARY KEY,business_id uuid REFERENCES businesses(id),required_stamps int);
  CREATE TABLE customer_loyalties (id uuid PRIMARY KEY,customer_id uuid REFERENCES customers(id),loyalty_card_id uuid REFERENCES loyalty_cards(id),current_stamps int);
  CREATE TABLE visits (id uuid PRIMARY KEY, business_id uuid REFERENCES businesses(id),customer_id uuid REFERENCES customers(id),created_at timestamptz DEFAULT now());
  CREATE TABLE customer_notifications (id text PRIMARY KEY,customer_id uuid REFERENCES customers(id),type text,title text,message text,created_at timestamptz DEFAULT now());
  CREATE TABLE customer_notification_reads (user_id uuid,notification_key text,read_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,notification_key));
 `);
 await ensureCampaignSchema(sql);
}
async function main(){
 await setup();
 const businessA=id(),businessB=id(),ownerA=id(),ownerB=id(),customer1=id(),customer2=id(),customer3=id();
 await sql`INSERT INTO businesses(id,name) VALUES(${businessA},'Salon A'),(${businessB},'Salon B')`;
 await sql`INSERT INTO business_subscriptions(business_id,trial_ends_at) VALUES(${businessA},now()+interval '14 days'),(${businessB},now()+interval '14 days')`;
 await sql`INSERT INTO app_users(id,business_id,role,email,name) VALUES
  (${ownerA},${businessA},'business_owner','a@local.test','Owner A'),
  (${ownerB},${businessB},'business_owner','b@local.test','Owner B'),
  (${customer1},null,'customer','one@local.test','Opted in'),
  (${customer2},null,'customer','two@local.test','Not opted in'),
  (${customer3},null,'customer','three@local.test','Other business')`;
 const member1=id(),member2=id(),member3=id();
 await sql`INSERT INTO customers(id,business_id,user_id) VALUES(${member1},${businessA},${customer1}),(${member2},${businessA},${customer2}),(${member3},${businessB},${customer3})`;
 await sql`INSERT INTO customer_profiles(user_id,preferences) VALUES
  (${customer1},'{"notifications":{"promotions":true,"email_updates":true}}'::jsonb),
  (${customer2},'{"notifications":{"promotions":false,"email_updates":true}}'::jsonb),
  (${customer3},'{"notifications":{"promotions":true,"email_updates":true}}'::jsonb)`;
 const card=id();
 await sql`INSERT INTO loyalty_cards(id,business_id,required_stamps) VALUES(${card},${businessA},10)`;
 await sql`INSERT INTO customer_loyalties(id,customer_id,loyalty_card_id,current_stamps) VALUES(${id()},${member1},${card},9)`;
 const reqBody={title:'Visit us again',message:'You are almost at your next reward. Visit us today!',segment:'all',channel:'inapp'};
 const created=await api(businessA,ownerA,'POST','',reqBody);
 assert.equal(created.status,201,JSON.stringify(created));
 const campaignId=created.data.campaign.id;
 const mine=await api(businessA,ownerA,'GET','',null);
 assert.equal(mine.data.campaigns.length,1);
 const update=await api(businessA,ownerA,'PATCH',campaignId,{...reqBody,title:'Edited welcome campaign'});
 assert.equal(update.status,200,JSON.stringify(update));
 assert.equal(update.data.campaign.title,'Edited welcome campaign');
 assert.equal((await api(businessA,ownerA,'GET',campaignId)).data.campaign.title,'Edited welcome campaign');
 assert.equal((await api(businessB,ownerB,'PATCH',campaignId,reqBody)).status,404,'Cross-business PATCH must fail');
 assert.equal((await api(businessA,ownerA,'PATCH',campaignId,{...reqBody,message:'<script>alert(1)</script>'})).status,422,'HTML cannot be saved');
 const removable=await api(businessA,ownerA,'POST','',{...reqBody,title:'Remove this draft'});
 assert.equal(removable.status,201);
 assert.equal((await api(businessB,ownerB,'DELETE',removable.data.campaign.id)).status,404,'Cross-business DELETE must fail');
 const removed=await api(businessA,ownerA,'DELETE',removable.data.campaign.id);
 assert.equal(removed.status,200);
 assert.equal(removed.data.deleted,true);
 assert.equal((await api(businessA,ownerA,'GET',removable.data.campaign.id)).status,404);
 const scheduledTest=await api(businessA,ownerA,'POST','',{...reqBody,title:'Scheduled to archive'});
 const scheduledId=scheduledTest.data.campaign.id;
 assert.equal((await api(businessA,ownerA,'POST',scheduledId+'/schedule',{scheduled_at:new Date(Date.now()+3600000).toISOString()})).status,200);
 const scheduledEdit=await api(businessA,ownerA,'PATCH',scheduledId,{...reqBody,title:'Updated schedule'});
 assert.equal(scheduledEdit.status,200);
 assert.equal(scheduledEdit.data.campaign.status,'scheduled');
 assert.equal((await api(businessA,ownerA,'DELETE',scheduledId)).data.archived,true);
 assert.equal((await api(businessA,ownerA,'GET',scheduledId)).status,404);
 assert.equal((await sql`SELECT status FROM marketing_campaigns WHERE id=${scheduledId}`)[0].status,'cancelled');
 const theirs=await api(businessB,ownerB,'GET',campaignId,null);
 assert.equal(theirs.status,404,'Business B cannot see A campaigns');
 const preview=await api(businessA,ownerA,'GET',campaignId+'/audience');
 assert.equal(preview.data.eligible,1,'only opted-in customer A is eligible');
 assert.equal((await api(businessA,ownerA,'GET',campaignId+'/recipients')).data.recipients.length,0,'No names before delivery');
 assert.equal((await api(businessB,ownerB,'GET',campaignId+'/recipients')).status,404,'Different business cannot see recipients');
 const sent=await api(businessA,ownerA,'POST',campaignId+'/send',{});
 assert.equal(sent.status,200,JSON.stringify(sent));
 const rows=await sql`SELECT customer_id,type FROM customer_notifications`;
 assert.equal(rows.length,1);
 assert.equal(rows[0].customer_id,member1);
 assert.equal(rows[0].type,'campaign');
 const repeated=await api(businessA,ownerA,'POST',campaignId+'/send',{});
 assert.equal(repeated.status,409);
 const info=await api(businessA,ownerA,'GET',campaignId);
 assert.equal(info.data.analytics.recipients,1);
 assert.equal(info.data.analytics.viewed,0);
 const notifiedCustomers=await api(businessA,ownerA,'GET',campaignId+'/recipients');
 assert.equal(notifiedCustomers.status,200,JSON.stringify(notifiedCustomers));
 assert.equal(notifiedCustomers.data.recipients.length,1);
 assert.equal(notifiedCustomers.data.recipients[0].customer_id,member1);
 assert.equal(notifiedCustomers.data.recipients[0].customer_name,'Opted in');
 assert.equal(notifiedCustomers.data.recipients[0].read_at,null);
 await sql`INSERT INTO customer_notification_reads(user_id,notification_key)
  SELECT user_id,notification_id FROM marketing_campaign_recipients WHERE campaign_id=${campaignId}`;
 const viewed=await api(businessA,ownerA,'GET',campaignId);
 assert.equal(viewed.data.analytics.viewed,1,'tracking uses existing read table');
 assert.ok((await api(businessA,ownerA,'GET',campaignId+'/recipients')).data.recipients[0].read_at,'Reading status updates');
 assert.equal((await api(businessA,ownerA,'PATCH',campaignId,reqBody)).status,409,'Sent campaign immutable');
 const archiveSent=await api(businessA,ownerA,'DELETE',campaignId);
 assert.equal(archiveSent.status,200);
 assert.equal(archiveSent.data.archived,true);
 assert.equal((await api(businessA,ownerA,'GET',campaignId)).status,404,'Archived campaign hidden from history');
 assert.equal((await sql`SELECT count(*)::int AS n FROM marketing_campaign_recipients WHERE campaign_id=${campaignId}`)[0].n,1,'Audit preserved');
 assert.equal((await sql`SELECT count(*)::int AS n FROM customer_notifications`)[0].n,1,'Delivered notifications preserved');
 assert.equal((await api(businessB,ownerB,'DELETE',campaignId)).status,404,'Cross-business archived campaign inaccessible');
 const created2=await api(businessA,ownerA,'POST','',{...reqBody,title:'Later notification'});
 await api(businessA,ownerA,'POST',created2.data.campaign.id+'/send',{});
 const noSpam=await sql`SELECT count(*)::int AS n FROM customer_notifications`;
 assert.equal(noSpam[0].n,1,'7-day frequency cap prevents duplicate promotions');
 const oneAway=await api(businessA,ownerA,'POST','',{...reqBody,title:'One stamp left',segment:'one_away'});
 assert.equal((await api(businessA,ownerA,'GET',oneAway.data.campaign.id+'/audience')).data.eligible,1);
 const forbidden=await api(businessB,ownerB,'POST',campaignId+'/cancel',{});
 assert.equal(forbidden.status,404);
 const emailDraft=await api(businessB,ownerB,'POST','',{...reqBody,title:'Email loyalty news',channel:'inapp_email'});
 assert.equal(emailDraft.status,201);
 assert.equal((await api(businessB,ownerB,'POST',emailDraft.data.campaign.id+'/send',{})).status,200);
 const originalFetch=global.fetch,originalKey=process.env.RESEND_API_KEY,originalFrom=process.env.RESEND_FROM_EMAIL;
 process.env.RESEND_API_KEY='mock-resend-key';process.env.RESEND_FROM_EMAIL='LOYVANCE <test@local.test>';
 let outgoing=0;
 global.fetch=async(url,options)=>{assert.match(String(url),/resend.com\/emails/);assert.match(String(options.body),/Unsubscribe/);outgoing++;return Response.json({id:'mock-email'});};
 try{
   const delivery=await runCampaignEmails(sql,1,'https://loyvance.test');
   assert.equal(delivery.sent,1,JSON.stringify(delivery));
   assert.equal(outgoing,1);
   assert.equal((await sql`SELECT email_state FROM marketing_campaign_recipients WHERE campaign_id=${emailDraft.data.campaign.id}`)[0].email_state,'sent');
 }finally{
   global.fetch=originalFetch;
   if(originalKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=originalKey;
   if(originalFrom===undefined)delete process.env.RESEND_FROM_EMAIL;else process.env.RESEND_FROM_EMAIL=originalFrom;
 }
 await sql`UPDATE business_subscriptions SET trial_ends_at=now()-interval '1 day' WHERE business_id=${businessB}`;
 assert.equal((await api(businessB,ownerB,'POST','',reqBody)).status,403,'expired business cannot create');
 const unsubToken='c'.repeat(64),unsubHash=createHash('sha256').update(unsubToken).digest('hex');
 await sql`INSERT INTO marketing_unsubscribe_tokens(token_hash,business_id,user_id) VALUES(${unsubHash},${businessA},${customer1})`;
 const previewUnsub=await unsubscribeCampaignEmail(new Request('https://loyvance.test/api/campaigns/unsubscribe?token='+unsubToken),sql);
 assert.equal(previewUnsub.status,200);
 assert.equal((await sql`SELECT preferences->'notifications'->>'promotions' AS promo FROM customer_profiles WHERE user_id=${customer1}`)[0].promo,'true');
 const form=new FormData();form.set('token',unsubToken);
 const confirmed=await unsubscribeCampaignEmail(new Request('https://loyvance.test/api/campaigns/unsubscribe',{method:'POST',body:form}),sql);
 assert.equal(confirmed.status,200);
 assert.equal((await sql`SELECT preferences->'notifications'->>'promotions' AS promo FROM customer_profiles WHERE user_id=${customer1}`)[0].promo,'false');
 assert.equal((await api(businessA,ownerA,'GET',oneAway.data.campaign.id+'/audience')).data.eligible,0);
 console.log('PASS: campaign migration, tenant isolation, consent, stamp segment, sending, deduplication, analytics and unsub confirmation.');
}
main().finally(()=>db.close()).catch(e=>{console.error(e);process.exitCode=1;});
