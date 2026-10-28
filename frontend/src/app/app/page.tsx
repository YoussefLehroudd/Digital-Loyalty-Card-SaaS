"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {getStoredCustomerToken} from "@/lib/customerAuth";
import {getStoredToken} from "@/lib/auth";
export default function InstalledAppLauncher(){
 const router=useRouter();
 useEffect(()=>{
  // An installed app must open the authenticated workspace, never marketing.
  // Actual session validation is performed by its authenticated route guard.
  if(getStoredCustomerToken())router.replace("/user/dashboard");
  else if(getStoredToken())router.replace("/dashboard");
  else router.replace("/login?next=%2Fuser%2Fdashboard");
 },[router]);
 return <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#080907] text-[#e7b354]" aria-live="polite">
   <img src="/pwa/icon-192.png" alt="" width={64} height={64} className="size-16 rounded-2xl"/>
   <p className="font-semibold tracking-wide">Opening LOYVANCE…</p>
 </main>;
}