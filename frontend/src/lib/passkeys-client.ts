import {apiFetch} from "@/lib/api";
import type {AuthResponse} from "@/lib/auth";

export type PasskeyDevice={credential_id:string;created_at:string;last_used_at:string|null};
export function canUsePasskeys(){
 return typeof window!=="undefined" && window.isSecureContext &&
  "PublicKeyCredential" in window && !!navigator.credentials;
}
export async function signInWithPasskey():Promise<AuthResponse>{
 if(!canUsePasskeys())throw Error("Fingerprint / Face ID login requires a compatible HTTPS browser.");
 const {startAuthentication}=await import("@simplewebauthn/browser");
 const started=await apiFetch<{options:Parameters<typeof startAuthentication>[0]["optionsJSON"];challenge_id:string}>(
  "/passkeys/login/start",{method:"POST",body:"{}"});
 const credential=await startAuthentication({optionsJSON:started.options});
 return apiFetch<AuthResponse>("/passkeys/login/finish",{method:"POST",
  body:JSON.stringify({challenge_id:started.challenge_id,response:credential})});
}
export async function registerCustomerPasskey(token:string){
 if(!canUsePasskeys())throw Error("This device does not support passkeys.");
 const {startRegistration}=await import("@simplewebauthn/browser");
 const started=await apiFetch<{options:Parameters<typeof startRegistration>[0]["optionsJSON"];challenge_id:string}>(
  "/passkeys/register/start",{token,method:"POST",body:"{}"});
 const credential=await startRegistration({optionsJSON:started.options});
 return apiFetch<{registered:boolean}>("/passkeys/register/finish",{token,method:"POST",
  body:JSON.stringify({challenge_id:started.challenge_id,response:credential})});
}
export async function customerPasskeys(token:string){
 return apiFetch<{devices:PasskeyDevice[]}>("/passkeys/devices",{token,cache:"no-store"});
}
export async function removeCustomerPasskey(token:string,credential_id:string){
 return apiFetch<{removed:boolean}>("/passkeys/devices",{token,method:"DELETE",
 body:JSON.stringify({credential_id})});
}
