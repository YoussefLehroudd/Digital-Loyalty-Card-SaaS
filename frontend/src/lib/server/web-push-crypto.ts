import {createCipheriv,createECDH,createHmac,createPrivateKey,randomBytes,sign} from "node:crypto";

const fromB64=(value:string)=>Buffer.from(value.replace(/-/g,"+").replace(/_/g,"/"),"base64");
const toB64=(data:Buffer|Uint8Array)=>Buffer.from(data).toString("base64url");
const hkdf=(key:Buffer,info:Buffer,size:number)=>{
 let prev=Buffer.alloc(0),result=Buffer.alloc(0),counter=0;
 while(result.length<size){counter++;prev=createHmac("sha256",key).update(Buffer.concat([prev,info,Buffer.from([counter])])).digest();result=Buffer.concat([result,prev]);}
 return result.subarray(0,size);
};
const extract=(salt:Buffer,ikm:Buffer)=>createHmac("sha256",salt).update(ikm).digest();
const cstr=(s:string)=>Buffer.from(s+"\0","utf8");

export type PushSubscriptionData={endpoint:string;keys:{p256dh:string;auth:string}};
export function validateSubscription(input:unknown):PushSubscriptionData|null{
 if(!input||typeof input!=="object")return null;
 const v=input as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}};
 if(typeof v.endpoint!=="string"||v.endpoint.length>2048||typeof v.keys?.p256dh!=="string"||typeof v.keys?.auth!=="string")return null;
 let u:URL;
 try{u=new URL(v.endpoint);}catch{return null;}
 const host=u.hostname.toLowerCase();
 // Browser Web Push services only; avoid user-controlled server-side fetch targets.
 const allowed=host==="fcm.googleapis.com"||host==="updates.push.services.mozilla.com"||host==="push.services.mozilla.com"||
  host==="web.push.apple.com"||host.endsWith(".push.apple.com")||
  /^wns\d*(-[a-z0-9-]+)?\.notify\.windows\.com$/.test(host);
 if(!allowed||u.protocol!=="https:"||u.port||u.username||u.password||u.hash)return null;
 if(!/^[A-Za-z0-9_-]+={0,2}$/.test(v.keys.p256dh)||!/^[A-Za-z0-9_-]+={0,2}$/.test(v.keys.auth))return null;
 const clientKey=fromB64(v.keys.p256dh),auth=fromB64(v.keys.auth);
 if(clientKey.length!==65||clientKey[0]!==4||auth.length!==16)return null;
 return {endpoint:v.endpoint,keys:{p256dh:v.keys.p256dh,auth:v.keys.auth}};
}
function configuration(){
 const publicKey=process.env.VAPID_PUBLIC_KEY||"";
 const privateKey=process.env.VAPID_PRIVATE_KEY||"";
 const subject=process.env.VAPID_SUBJECT||"https://loyvance.vercel.app";
 const pub=fromB64(publicKey),priv=fromB64(privateKey);
 if(pub.length!==65||pub[0]!==4||priv.length!==32||!(subject.startsWith("mailto:")||subject.startsWith("https://")))
  throw Error("Web Push VAPID keys are not configured.");
 const jwk={kty:"EC" as const,crv:"P-256" as const,x:toB64(pub.subarray(1,33)),y:toB64(pub.subarray(33,65)),d:toB64(priv)};
 return {publicKey,privateKey:createPrivateKey({key:jwk,format:"jwk"}),subject};
}
export function pushIsConfigured(){
 try{configuration();return true;}catch{return false;}
}
export function pushPublicKey(){return configuration().publicKey;}
export function createEncryptedPush(payload:unknown,subscription:PushSubscriptionData){
 const subscriber=validateSubscription(subscription);
 if(!subscriber)throw Error("Invalid Web Push subscription.");
 const data=Buffer.from(JSON.stringify(payload),"utf8");
 if(data.length>2700)throw Error("Push payload too large.");
 const clientKey=fromB64(subscriber.keys.p256dh);
 const authSecret=fromB64(subscriber.keys.auth);
 const ephemeral=createECDH("prime256v1");ephemeral.generateKeys();
 const ephemeralPublic=ephemeral.getPublicKey(undefined,"uncompressed");
 const shared=ephemeral.computeSecret(clientKey);
 const ikm=hkdf(extract(authSecret,shared),Buffer.concat([cstr("WebPush: info"),clientKey,ephemeralPublic]),32);
 const salt=randomBytes(16),prk=extract(salt,ikm);
 const cek=hkdf(prk,cstr("Content-Encoding: aes128gcm"),16);
 const nonce=hkdf(prk,cstr("Content-Encoding: nonce"),12);
 // RFC 8188: final record is terminated by 0x02, AES-128-GCM appends 16-byte tag.
 const cipher=createCipheriv("aes-128-gcm",cek,nonce);
 const ciphertext=Buffer.concat([cipher.update(Buffer.concat([data,Buffer.from([2])])),cipher.final(),cipher.getAuthTag()]);
 const header=Buffer.alloc(21);salt.copy(header,0);header.writeUInt32BE(4096,16);header[20]=ephemeralPublic.length;
 return Buffer.concat([header,ephemeralPublic,ciphertext]);
}
export async function sendWebPush(subscription:PushSubscriptionData,payload:unknown):Promise<{ok:boolean;expired:boolean;retryable:boolean}>{
 const target=validateSubscription(subscription);
 if(!target)return {ok:false,expired:true,retryable:false};
 const vapid=configuration(),u=new URL(target.endpoint);
 const encoded=(o:unknown)=>toB64(Buffer.from(JSON.stringify(o)));
 const signed=encoded({typ:"JWT",alg:"ES256"})+"."+encoded({aud:u.origin,exp:Math.floor(Date.now()/1000)+3600,sub:vapid.subject});
 const signature=sign("sha256",Buffer.from(signed),{key:vapid.privateKey,dsaEncoding:"ieee-p1363"});
 const token=signed+"."+toB64(signature);
 const encrypted=createEncryptedPush(payload,target);
 const response=await fetch(target.endpoint,{
  method:"POST",headers:{
   "TTL":"3600","Urgency":"normal","Content-Type":"application/octet-stream",
   "Content-Encoding":"aes128gcm",
   "Authorization":"vapid t="+token+", k="+vapid.publicKey
  },body:new Uint8Array(encrypted),signal:AbortSignal.timeout(6500),redirect:"error",cache:"no-store"
 });
 return {ok:response.status===201||response.status===202,expired:response.status===404||response.status===410,retryable:response.status===429||response.status>=500};
}
