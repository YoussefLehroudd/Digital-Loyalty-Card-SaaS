"use client";
import {memo,useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useI18n} from "@/components/i18n/language-provider";
import {useCustomerAuth} from "@/components/customer-app/customer-auth-provider";
import {customerAffiliateNavItem,customerNavItems} from "@/components/customer-app/customer-nav-items";
import {apiFetch} from "@/lib/api";
import {cn} from "@/lib/utils";

// A route, auth guard refresh or installed PWA lifecycle can still remount the
// navigation. Persist the physical scroll offset per account so restoration
// works even across a full reload, without making React rerender on scroll.
const offsets=new Map<string,number>();
const storageKey=(userId:string)=>"loyvance:customer-mobile-tabs:"+userId;
const loadOffset=(id:string)=>{
  const stored=offsets.get(id);
  if(stored!==undefined)return stored;
  try{
    const raw=window.sessionStorage.getItem(storageKey(id));
    const value=raw===null?0:Number(raw);
    return Number.isFinite(value)&&value>=0?value:0;
  }catch{return 0;}
};
/** Bottom navigation is mounted in /user/layout; it also recovers after reloads. */
export const CustomerBottomNav=memo(function CustomerBottomNav(){
  const pathname=usePathname();
  const {t:tr}=useI18n();
  const {token,isAuthenticated,user}=useCustomerAuth();
  const [isAffiliate,setIsAffiliate]=useState(false);
  const scrollRef=useRef<HTMLDivElement|null>(null);
  const writeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const userId=user?.id??null;

  const saveOffset=useCallback(()=>{
    const strip=scrollRef.current;
    if(!strip||!userId)return;
    const left=Math.max(0,strip.scrollLeft);
    offsets.set(userId,left);
    if(writeTimer.current)window.clearTimeout(writeTimer.current);
    // Storage is written only after scrolling settles, keeping swipes smooth.
    writeTimer.current=window.setTimeout(()=>{
      try{window.sessionStorage.setItem(storageKey(userId),String(offsets.get(userId)??left));}catch{}
      writeTimer.current=null;
    },150);
  },[userId]);

  const flushOffset=useCallback(()=>{
    if(writeTimer.current){window.clearTimeout(writeTimer.current);writeTimer.current=null;}
    const strip=scrollRef.current;
    if(!strip||!userId)return;
    const left=Math.max(0,strip.scrollLeft);
    offsets.set(userId,left);
    try{window.sessionStorage.setItem(storageKey(userId),String(left));}catch{}
  },[userId]);

  // Restore before paint, including when Next.js rerenders/remounts the layout.
  useLayoutEffect(()=>{
    const strip=scrollRef.current;
    if(strip&&userId){
      strip.scrollLeft=loadOffset(userId);
    }
  },[pathname,userId,isAffiliate]);

  useEffect(()=>()=>{flushOffset();},[flushOffset]);

  useEffect(()=>{
    if(!token){setIsAffiliate(false);return;}
    let mounted=true;
    apiFetch("/affiliate/me",{token,cache:"no-store"})
      .then(()=>{if(mounted)setIsAffiliate(true);})
      .catch(()=>{if(mounted)setIsAffiliate(false);});
    return()=>{mounted=false;};
  },[token]);

  if(!isAuthenticated||pathname==="/user/login"||pathname==="/user/register")return null;
  const visibleNav=isAffiliate?[...customerNavItems,customerAffiliateNavItem]:customerNavItems;

  return <nav aria-label={tr("Customer navigation")} data-testid="persistent-customer-bottom-nav"
    className="fixed inset-x-0 bottom-0 z-[100] border-t border-[#d8a63f]/15 bg-[#0b0c0a]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden [transform:translate3d(0,0,0)]">
    <div ref={scrollRef} onScroll={saveOffset} onTouchEnd={saveOffset} tabIndex={0} className="customer-bottom-nav-scroll w-full overflow-x-auto overflow-y-hidden overscroll-x-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e7b354]">
      <div className="flex w-max min-w-full flex-nowrap items-center gap-1 px-2 py-2">
        {visibleNav.map(item=>{
          const active=pathname===item.href;
          const Icon=item.icon;
          return <Link key={item.href} href={item.href} onClick={flushOffset} title={tr(item.label)}
            aria-label={tr(item.label)} aria-current={active?"page":undefined}
            className={cn("flex min-h-12 w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[10px] transition-colors sm:w-[84px] sm:text-[11px]",
              active?"bg-[#d79b16]/12 text-[#ffc857]":"text-muted-foreground")}>
            <Icon className="h-[18px] w-[18px] shrink-0"/>
            <span className="block w-full truncate text-center leading-4">{tr(item.label)}</span>
          </Link>;
        })}
      </div>
    </div>
  </nav>;
});
