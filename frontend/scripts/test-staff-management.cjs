/* Independent PGlite regression checks for staff management, tenant isolation and audit. */
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:filename}).outputText,filename);
const {ensureStaffSchema,isActiveCashier,manageStaff,staffAudit}=require(path.join(__dirname,'../src/lib/server/staff-management.ts'));
const db=new PGlite(),id=()=>randomUUID();
function sql(parts,...values){return db.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),values).then(r=>r.rows);}
sql.transaction=(promises)=>Promise.all(promises);
async function call(business,method,path='',body){
 const request=new Request('https://loyvance.test/api/staff/'+path,{method,headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const response=await manageStaff(['staff',...(path?path.split('/'):[])],request,sql,business,async pw=>'test-hash-'+pw.length);
 return {status:response.status,data:await response.json()};
}
(async()=>{
 await db.exec("CREATE TABLE businesses(id uuid PRIMARY KEY,name text,status text DEFAULT 'active');CREATE TABLE app_users(id uuid PRIMARY KEY,business_id uuid REFERENCES businesses(id),name text,email text UNIQUE,password_hash text,role text,status text DEFAULT 'active');CREATE TABLE user_sessions(token text PRIMARY KEY,user_id uuid REFERENCES app_users(id));CREATE TABLE customers(id uuid PRIMARY KEY,business_id uuid REFERENCES businesses(id),user_id uuid,first_name text,last_name text);CREATE TABLE customer_profiles(user_id uuid PRIMARY KEY,first_name text,last_name text);CREATE TABLE visits(id uuid PRIMARY KEY,business_id uuid REFERENCES businesses(id),customer_id uuid REFERENCES customers(id),created_at timestamptz DEFAULT now(),stamp_count int,order_reference text);");
 await ensureStaffSchema(sql);
 const business=id(),other=id(),customer=id(),owner=id();
 await sql`INSERT INTO businesses(id,name) VALUES(${business},'Bakery'),(${other},'Different shop')`;
 await sql`INSERT INTO app_users(id,business_id,name,email,password_hash,role) VALUES(${owner},${business},'Manager','owner@local.test','ownerhash','business_owner')`;
 await sql`INSERT INTO customers(id,business_id,first_name,last_name) VALUES(${customer},${business},'Hana','Test')`;
 const weak=await call(business,'POST','',{name:'Salma',email:'cashier@local.test',password:'weak'});
 assert.equal(weak.status,422,'Weak password rejected');
 const created=await call(business,'POST','',{name:'Salma Cashier',email:'cashier@local.test',password:'LongStrongPassword_123'});
 assert.equal(created.status,201,JSON.stringify(created));
 const cashier=created.data.staff.id;assert.ok(cashier);
 assert.equal((await call(other,'GET')).data.staff.length,0,'Another business cannot enumerate staff');
 assert.equal((await call(other,'PATCH',cashier,{active:false})).status,404,'Cross-business deactivation rejected');
 assert.equal(await isActiveCashier(sql,cashier,business),true,'Own cashier enabled');
 assert.equal(await isActiveCashier(sql,cashier,other),false,'Cannot work for other business');
 const visit1=id(),visit2=id();
 await sql`INSERT INTO visits(id,business_id,customer_id,stamp_count,actor_id,order_reference) VALUES(${visit1},${business},${customer},2,${cashier},'A-100'),(${visit2},${business},${customer},1,${owner},'A-101')`;
 const history=await staffAudit(new Request('https://loyvance.test/api/staff/history'),sql,business);
 const result=await history.json();
 assert.equal(result.history.length,2);
 assert.equal(result.history.find(x=>x.id===visit1).actor_name,'Salma Cashier');
 assert.equal(result.history.find(x=>x.id===visit1).stamp_count,2);
 assert.equal(result.history.find(x=>x.id===visit1).customer_name,'Hana Test');
 assert.equal(result.history.find(x=>x.id===visit2).actor_role,'Owner');
 assert.equal((await (await staffAudit(new Request('https://loyvance.test/api/staff/history'),sql,other)).json()).history.length,0);
 await sql`INSERT INTO user_sessions(token,user_id) VALUES ('live-session',${cashier})`;
 const disabled=await call(business,'PATCH',cashier,{active:false});
 assert.equal(disabled.status,200);
 assert.equal(await isActiveCashier(sql,cashier,business),false,'Deactivation takes effect');
 assert.equal((await sql`SELECT count(*)::int AS n FROM user_sessions WHERE user_id=${cashier}`)[0].n,0,'Sessions revoked');
 assert.equal((await call(business,'GET')).data.staff[0].active,false);
 assert.equal((await call(business,'PATCH',cashier,{active:true})).status,200,'Owner can reactivate');
 assert.equal(await isActiveCashier(sql,cashier,business),true);
 assert.equal((await (await staffAudit(new Request('https://loyvance.test/api/staff/history'),sql,business)).json()).history.length,2,'Audit survives disabling staff');
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/[...path]/route.ts'),'utf8');
 assert.ok(route.includes('path[0]==="redeem-reward"?await requireBusinessOwner(req,sql):await requireStampOperator(req,sql)'),'Only owner can redeem rewards');
 assert.ok(route.includes('await isActiveCashier(sql,user.id,business.id)'),'Auth checks active cashier');
 console.log('PASS: isolated staff accounts, owner-only controls, status revocation, audit and stamp authorization');
})().finally(()=>db.close()).catch(e=>{console.error(e);process.exitCode=1;});