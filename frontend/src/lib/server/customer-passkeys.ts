import {randomUUID} from "node:crypto";
import {
 generateRegistrationOptions,verifyRegistrationResponse,
 generateAuthenticationOptions,verifyAuthenticationResponse
} from "@simplewebauthn/server";
import type {getSql} from "@/lib/server/db";
type Sql=ReturnType<typeof getSql>;
type Row=Record<string,unknown>;
const raw=(sql:Sql)=>sql as unknown as {(pieces:TemplateStringsArray,...params:unknown[]):Promise<Row[]>};
const send=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
const validUUID=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const validCredentialID=(s:string)=>s.length>16&&s.length<1024&&/^[A-Za-z0-9_-]+$/.test(s);
function rp(){
 // Never determine passkey security boundaries from untrusted Host headers.
 const rpID=(process.env.PASSKEY_RP_ID||"loyvance.vercel.app").trim();
 const expectedOrigin=(process.env.PASSKEY_ORIGIN||"https://loyvance.vercel.app").trim();
 const parsed=new URL(expectedOrigin);
 if(!["https:","http:"].includes(parsed.protocol)||parsed.hostname!==rpID ||
   (parsed.protocol==="http:"&&rpID!=="localhost")||parsed.username||parsed.password||
   parsed.pathname!=="/"||parsed.search||parsed.hash){
   throw Error("PASSKEY_ORIGIN must match PASSKEY_RP_ID over HTTPS.");
 }
 return {rpID,expectedOrigin};
}
const challengeExpiresMs=5*60*1000;
export async function ensurePasskeySchema(sql:Sql){
 const q=raw(sql);
 await q`CREATE TABLE IF NOT EXISTS customer_passkeys (
  credential_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
 )`;
 await q`CREATE INDEX IF NOT EXISTS idx_customer_passkeys_user_id ON customer_passkeys(user_id)`;
 await q`CREATE TABLE IF NOT EXISTS customer_passkey_challenges (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('register','login')),
  challenge text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes'
 )`;
 await q`CREATE INDEX IF NOT EXISTS idx_customer_passkey_challenges_expire ON customer_passkey_challenges(expires_at)`;
}
type PasskeyOptions={
 userId:string|null;
 login:(userId:string)=>Promise<Response>;
};
export async function handlePasskeys(req:Request,sql:Sql,path:string[],{userId,login}:PasskeyOptions){
 const q=raw(sql),method=req.method;
 const operation=path[1]||"",action=path[2]||"";
 if(operation==="devices" && method==="GET"){
  if(!userId)return send({message:"Unauthorized."},401);
  const rows=await q`SELECT credential_id,created_at::text,last_used_at::text
   FROM customer_passkeys WHERE user_id=${userId}::uuid ORDER BY created_at DESC LIMIT 20`;
  return send({devices:rows});
 }
 if(operation==="devices"&&method==="DELETE"){
  if(!userId)return send({message:"Unauthorized."},401);
  const payload=await req.json().catch(()=>null) as {credential_id?:unknown}|null;
  const id=typeof payload?.credential_id==="string"?payload.credential_id:"";
  if(!validCredentialID(id))return send({message:"Invalid passkey."},422);
  const deleted=await q`DELETE FROM customer_passkeys WHERE credential_id=${id} AND user_id=${userId}::uuid RETURNING credential_id`;
  return deleted.length?send({removed:true}):send({message:"Passkey not found."},404);
 }
 if(operation==="register"&&action==="start"&&method==="POST"){
  if(!userId)return send({message:"Sign in before adding a passkey."},401);
  const existing=await q`SELECT credential_id AS id,transports
   FROM customer_passkeys WHERE user_id=${userId}::uuid`;
  if(existing.length>=10)return send({message:"Maximum 10 passkeys per account."},409);
  const users=await q`SELECT name,email FROM app_users WHERE id=${userId}::uuid AND role='customer' AND status<>'suspended' LIMIT 1`;
  if(!users.length)return send({message:"Customer account unavailable."},403);
  const cfg=rp();
  const options=await generateRegistrationOptions({
   rpName:"LOYVANCE",rpID:cfg.rpID,userName:String(users[0].email),
   userDisplayName:String(users[0].name),
   userID:new Uint8Array(Buffer.from(userId.replace(/-/g,""),"hex")),
   attestationType:"none",
   authenticatorSelection:{residentKey:"required",userVerification:"required"},
   supportedAlgorithmIDs:[-7,-257],
   excludeCredentials:existing.map(x=>({id:String(x.id),transports:(x.transports as Array<string>)||[]})) as Parameters<typeof generateRegistrationOptions>[0]["excludeCredentials"]
  });
  const challengeId=randomUUID();
  await q`INSERT INTO customer_passkey_challenges(id,user_id,kind,challenge)
   VALUES(${challengeId},${userId}::uuid,'register',${options.challenge})`;
  return send({options,challenge_id:challengeId});
 }
 if(operation==="register"&&action==="finish"&&method==="POST"){
  if(!userId)return send({message:"Sign in before registering a passkey."},401);
  const body=await req.json().catch(()=>null) as {challenge_id?:unknown;response?:unknown}|null;
  const challengeId=typeof body?.challenge_id==="string"?body.challenge_id:"";
  if(!validUUID(challengeId)||!body?.response||typeof body.response!=="object")return send({message:"Invalid registration."},422);
  const row=await q`DELETE FROM customer_passkey_challenges WHERE id=${challengeId}::uuid
   AND user_id=${userId}::uuid AND kind='register' AND expires_at>now() RETURNING challenge`;
  if(!row.length)return send({message:"Passkey setup expired. Try again."},410);
  try{
   const check=await verifyRegistrationResponse({
    response:body.response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
    expectedChallenge:String(row[0].challenge),expectedOrigin:rp().expectedOrigin,
    expectedRPID:rp().rpID,requireUserVerification:true
   });
   if(!check.verified||!check.registrationInfo)return send({message:"Passkey verification failed."},403);
   const c=check.registrationInfo.credential;
   if(!validCredentialID(c.id))return send({message:"Invalid credential ID."},422);
   const result=await q`INSERT INTO customer_passkeys(credential_id,user_id,public_key,counter,transports)
    VALUES(${c.id},${userId}::uuid,${Buffer.from(c.publicKey).toString("base64url")},${c.counter},
      ${JSON.stringify(c.transports||[])}::jsonb)
    ON CONFLICT(credential_id) DO NOTHING RETURNING credential_id`;
   return result.length?send({registered:true},201):send({message:"Passkey already registered."},409);
  }catch{return send({message:"Passkey verification failed. Please retry."},403);}
 }
 if(operation==="login"&&action==="start"&&method==="POST"){
  const cfg=rp();
  const options=await generateAuthenticationOptions({
   rpID:cfg.rpID,userVerification:"required"
   // Discoverable passkeys: account identity comes only from verified credential.
  });
  const challengeId=randomUUID();
  await q`INSERT INTO customer_passkey_challenges(id,kind,challenge) VALUES(${challengeId},'login',${options.challenge})`;
  return send({options,challenge_id:challengeId});
 }
 if(operation==="login"&&action==="finish"&&method==="POST"){
  const body=await req.json().catch(()=>null) as {challenge_id?:unknown;response?:unknown}|null;
  const challengeId=typeof body?.challenge_id==="string"?body.challenge_id:"";
  const response=body?.response as {id?:string}|undefined;
  if(!validUUID(challengeId)||!response||typeof response.id!=="string"||!validCredentialID(response.id))
   return send({message:"Invalid passkey response."},422);
  const challenge=await q`DELETE FROM customer_passkey_challenges WHERE id=${challengeId}::uuid
    AND user_id IS NULL AND kind='login' AND expires_at>now() RETURNING challenge`;
  if(!challenge.length)return send({message:"Passkey login expired. Try again."},410);
  const stored=await q`SELECT k.credential_id,k.public_key,k.counter,k.transports,k.user_id
    FROM customer_passkeys k JOIN app_users u ON u.id=k.user_id
    WHERE k.credential_id=${response.id} AND u.role='customer' AND u.status<>'suspended' LIMIT 1`;
  if(!stored.length)return send({message:"No matching customer passkey."},401);
  const key=stored[0];
  try{
   const verified=await verifyAuthenticationResponse({
    response:body!.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge:String(challenge[0].challenge),
    expectedOrigin:rp().expectedOrigin,expectedRPID:rp().rpID,requireUserVerification:true,
    credential:{id:String(key.credential_id),publicKey:new Uint8Array(Buffer.from(String(key.public_key),"base64url")),
     counter:Number(key.counter),transports:(key.transports as Array<string>)||[]} as Parameters<typeof verifyAuthenticationResponse>[0]["credential"]
   });
   if(!verified.verified)return send({message:"Passkey verification failed."},401);
   const counter=verified.authenticationInfo.newCounter;
   await q`UPDATE customer_passkeys SET counter=GREATEST(counter,${counter}),last_used_at=now()
     WHERE credential_id=${key.credential_id} AND user_id=${key.user_id}::uuid`;
   return login(String(key.user_id));
  }catch{return send({message:"Passkey verification failed. Use your password to sign in."},401);}
 }
 return send({message:"Passkey route not found."},404);
}
