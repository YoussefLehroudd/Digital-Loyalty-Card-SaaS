const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
const {PGlite}=require("@electric-sql/pglite");
require.extensions[".ts"]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:file}).outputText,file);
const {ensurePasskeySchema,handlePasskeys}=require(path.join(__dirname,"../src/lib/server/customer-passkeys.ts"));
const db=new PGlite(),id=randomUUID();
function sql(parts,...values){return db.query(parts.reduce((s,p,i)=>s+(i?"$"+i:"")+p,""),values).then(r=>r.rows);}
async function invoke(pathParts,userId=null,payload={},method="POST"){
 const req=new Request("https://loyvance.vercel.app/api/passkeys/"+pathParts.join("/"),{method,headers:{"content-type":"application/json","origin":"https://loyvance.vercel.app"},...(method==="POST"||method==="DELETE"?{body:JSON.stringify(payload)}:{})});
 const res=await handlePasskeys(req,sql,["passkeys",...pathParts],{userId,login:async()=>Response.json({token:"should-never-login-without-proof"})});
 return {status:res.status,data:await res.json()};
}
(async()=>{
 await db.exec("CREATE TABLE app_users(id uuid PRIMARY KEY,role text NOT NULL,name text NOT NULL,email text NOT NULL,password_hash text NOT NULL DEFAULT 'test-hash',status text NOT NULL DEFAULT 'active');");
 await ensurePasskeySchema(sql);
 const alice=id,bob=randomUUID();
 await sql`INSERT INTO app_users(id,role,name,email) VALUES(${alice},'customer','Alice','alice@example.test'),(${bob},'customer','Bob','bob@example.test')`;
 const blocked=await invoke(["register","start"]);
 assert.equal(blocked.status,401,"Cannot register a passkey without a logged-in user");
 const started=await invoke(["register","start"],alice);
 assert.equal(started.status,200,JSON.stringify(started));
 assert.equal(started.data.options.rp.id,"loyvance.vercel.app","RP must be pinned to production origin");
 assert.equal(started.data.options.authenticatorSelection.userVerification,"required");
 assert.ok(started.data.options.challenge);
 const suspicious=await invoke(["register","finish"],alice,{challenge_id:started.data.challenge_id,response:{id:"totally-fake-credential"}});
 assert.equal(suspicious.status,403,"Fake authenticator must never register");
 const reused=await invoke(["register","finish"],alice,{challenge_id:started.data.challenge_id,response:{id:"totally-fake-credential"}});
 assert.equal(reused.status,410,"Challenge must be consumed once, even after failure");
 const challenge=(await invoke(["login","start"])).data;
 assert.ok(challenge.challenge_id&&challenge.options.challenge);
 assert.equal(challenge.options.userVerification,"required");
 const wrong=(await invoke(["login","finish"],null,{challenge_id:challenge.challenge_id,response:{id:"fake-key-id-01234567890"}}));
 assert.equal(wrong.status,401,"Unknown passkeys rejected");
 const credentialId="test-secure-passkey-credential-id-ABC123";
 await sql`INSERT INTO customer_passkeys(credential_id,user_id,public_key,counter) VALUES(${credentialId},${alice},'AA',0)`;
 assert.equal((await invoke(["devices"],bob,{}, "GET")).data.devices.length,0,"Never list another user's passkeys");
 assert.equal((await invoke(["devices"],alice,{}, "GET")).data.devices.length,1);
 assert.equal((await invoke(["devices"],bob,{credential_id:credentialId},"DELETE")).status,404,"Cross-account passkey delete blocked");
 assert.equal((await invoke(["devices"],alice,{credential_id:credentialId},"DELETE")).status,200,"Owner can remove own passkey");
 assert.equal((await invoke(["devices"],alice,{},"GET")).data.devices.length,0);
 const provider=fs.readFileSync(path.join(__dirname,"../src/components/customer-app/customer-auth-provider.tsx"),"utf8");
 const manifest=fs.readFileSync(path.join(__dirname,"../src/app/manifest.ts"),"utf8");
 assert.ok(manifest.includes('start_url: "/app"'),"PWA must resume authenticated workspace on launch");
 assert.ok(provider.includes("e.status===401||e.status===403"),"Transient 5xx/network must not erase remembered login");
 console.log("PASS: passkey challenges, origin, fake-proof rejection, cross-account credential isolation and persistent PWA startup");
})().finally(()=>db.close()).catch(e=>{console.error(e);process.exitCode=1;});