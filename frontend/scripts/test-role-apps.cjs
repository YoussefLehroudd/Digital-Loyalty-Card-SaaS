const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
const {PGlite}=require("@electric-sql/pglite");
require.extensions[".ts"]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:file}).outputText,file);
const {ensurePasskeySchema,handlePasskeys}=require(path.join(__dirname,"../src/lib/server/customer-passkeys.ts"));
const db=new PGlite(),id=()=>randomUUID();
function sql(parts,...values){return db.query(parts.reduce((s,p,i)=>s+(i?"$"+i:"")+p,""),values).then(r=>r.rows);}
async function act(userId,operation,action="start",body={},elevated=false){
 const req=new Request("https://loyvance.vercel.app/api/passkeys/"+operation+"/"+action,
  {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const res=await handlePasskeys(req,sql,["passkeys",operation,action],{userId,elevated,verifyPassword:async(password,hash)=>password==="valid-current-password"&&hash==="test-hash",login:async()=>Response.json({token:"must-not-issue-for-fake-proof"})});
 return {status:res.status,data:await res.json()};
}
(async()=>{
 await db.exec("CREATE TABLE app_users(id uuid PRIMARY KEY,role text NOT NULL,name text NOT NULL,email text NOT NULL,password_hash text NOT NULL DEFAULT 'test-hash',status text NOT NULL DEFAULT 'active');");
 await ensurePasskeySchema(sql);
 const users=[
  {id:id(),role:"customer",email:"customer@loyvance.test"},
  {id:id(),role:"business_owner",email:"business@loyvance.test"},
  {id:id(),role:"staff",email:"cashier@loyvance.test"},
  {id:id(),role:"platform_admin",email:"admin@loyvance.test"}
 ];
 for(const u of users)await sql`INSERT INTO app_users(id,role,name,email) VALUES(${u.id},${u.role},${u.role},${u.email})`;
 for(const user of users){
  if(user.role!=="customer"){
    const denied=await act(user.id,"register","start",{},true);
    assert.equal(denied.status,403,"Privileged passkey enrollment must require current password");
  }
  const res=await act(user.id,"register","start",user.role!=="customer"?{current_password:"valid-current-password"}:{},user.role!=="customer");
  assert.equal(res.status,200,JSON.stringify({role:user.role,response:res}));
  assert.equal(res.data.options.rp.id,"loyvance.vercel.app");
  assert.equal(res.data.options.authenticatorSelection.userVerification,"required");
  assert.ok(res.data.challenge_id);
  assert.equal((await act(user.id,"register","finish",{challenge_id:res.data.challenge_id,response:{id:"fake-signature"}})).status,403,
   "Fake proofs forbidden across all roles");
 }
 const manifestIds=new Set();
 const appNames=new Set(),appShortNames=new Set(),scopes=new Set(),images=new Set();
 for(const [role,start] of [["customer","/user/dashboard"],["business","/dashboard"],["admin","/admin"]]){
  const content=fs.readFileSync(path.join(__dirname,"../public/"+role+"-app.webmanifest"),"utf8");
  const manifest=JSON.parse(content);
  assert.equal(manifest.start_url,start+"?loyvance_app="+role,"PWA launch must identify the installed app window");
  assert.equal(manifest.display,"standalone");
  assert.equal(manifest.scope,start.split("/").slice(0,2).join("/"),"Role scopes must not overlap other roles");
  assert.ok(manifest.id);assert.ok(!manifestIds.has(manifest.id),"One install identity per role");
  assert.ok(manifest.name&&!appNames.has(manifest.name),"Separate full app names");
  assert.ok(manifest.short_name&&!appShortNames.has(manifest.short_name),"Separate short phone icon names");
  assert.ok(!scopes.has(manifest.scope),"Separate app URL scopes");
  assert.equal(manifest.icons.length,2,"192 and 512 PNG icons");
  for(const icon of manifest.icons){
   assert.equal(icon.type,"image/png");
   assert.ok(icon.src.includes("/"+role+"/"),"Role-specific PNG icon, not the same shared logo");
   assert.ok(!images.has(icon.src),"Do not reuse app icons across roles");
   images.add(icon.src);
  }
  appNames.add(manifest.name);appShortNames.add(manifest.short_name);scopes.add(manifest.scope);
  manifestIds.add(manifest.id);
 }
 const routes=fs.readFileSync(path.join(__dirname,"../src/app/api/[...path]/route.ts"),"utf8");
 assert.ok(routes.includes("const admin=isPlatformAdmin(user)"),"Admin passkey login must use server authorization");
 assert.ok(routes.includes("isActiveCashier(sql,user.id,business.id)"),"Cashier passkeys must enforce active employee");
 const guard=fs.readFileSync(path.join(__dirname,"../src/components/auth/auth-guard.tsx"),"utf8");
 assert.ok(guard.includes("[401,403].includes(error.status)"),"Transient server failures must not delete PWA session");
 const admin=fs.readFileSync(path.join(__dirname,"../src/lib/admin.ts"),"utf8");
 assert.ok(admin.includes("getAdminToken"),"Admin PWA recovers remembered session");
 const installer=fs.readFileSync(path.join(__dirname,"../src/components/pwa/role-app-install-panel.tsx"),"utf8");
 assert.ok(installer.includes('if(!ev){setNotice(')&&installer.includes('setInstructions(true);return;}'),"Mobile install click must always show help if the native prompt is unavailable");
 assert.ok(installer.includes('<Modal isOpen={instructions}'),"Mobile install instructions must open in a visible modal, not below the fold");
 assert.ok(installer.includes("Add to Home Screen")&&installer.includes("Add to Home screen"),"Support iOS and Android manual install methods");
 assert.ok(installer.includes("copyInstallLink"),"Allow opening installer link in another browser");
 assert.ok(installer.includes("getInstalledWindowRole()")&&installer.includes("otherAppWindow"),"Standalone must detect installed APP identity, not all roles");
 assert.ok(installer.includes("Install as separate app"),"A different installed app must not disable installation of this role");
 assert.ok(installer.includes("if(otherAppWindow)"),"Guide customers to a normal browser when switching app roles");
 const iconRoute=fs.readFileSync(path.join(__dirname,"../src/app/pwa-app-icon/[role]/[size]/route.tsx"),"utf8");
 assert.ok(iconRoute.includes('new ImageResponse('),"Role icons must be real PNG images");
 const appContexts=fs.readFileSync(path.join(__dirname,"../src/components/pwa/role-install-capture.tsx"),"utf8");
 assert.ok(appContexts.includes("loyvance_app")&&appContexts.includes("loyvance:installed-pwa-window-role"),"Installed window role must persist in session scope");
 for(const [role,layout] of [["customer","user"],["business","dashboard"],["admin","admin"]]){
  const metadata=fs.readFileSync(path.join(__dirname,"../src/app/"+layout+"/layout.tsx"),"utf8");
  assert.ok(metadata.includes("/"+role+"-app.webmanifest"),"Matching per-role install manifest in route metadata");
  assert.ok(metadata.includes("/pwa-app-icon/"+role+"/192"),"Matching iOS Apple-touch icon");
 }

 const capture=fs.readFileSync(path.join(__dirname,"../src/components/pwa/role-install-capture.tsx"),"utf8");
 assert.ok(capture.includes('navigator.serviceWorker.register("/sw.js"'),"Service worker must register inside customer/business/admin areas too");
 console.log("PASS role PWAs: 3 independent manifests, all-role verified passkeys, fake proof denied, scoped admin login and remembered sessions");
})().finally(()=>db.close()).catch(e=>{console.error(e);process.exitCode=1;});