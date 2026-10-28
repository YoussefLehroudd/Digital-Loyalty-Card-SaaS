const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"../src",p),"utf8");
const install=read("components/pwa/role-app-install-panel.tsx");
const settings=read("app/user/settings/page.tsx");
const sidebar=read("components/navigation/use-persistent-nav-scroll.ts");
const customer=read("components/customer-app/customer-layout.tsx");
const business=read("components/dashboard/dashboard-shell.tsx");
const admin=read("components/admin/admin-shell.tsx");
const css=read("app/globals.css");
const defaults=read("lib/customerAuth.ts");

assert.ok(install.includes('role==="customer"?')&&install.includes("Customer Settings"),"Customer Install only links to Settings for passkeys");
assert.ok(!install.includes('<AccountPasskeySettings token={token} elevated={role!=="customer"}/>'),"No second Customer Passkey enrollment");
assert.ok(settings.includes("<CustomerPasskeySettings/>"),"Keep Customer Passkey settings unchanged");
assert.ok(settings.includes('<Card className="lg:hidden">')&&settings.includes("Real phone notifications"),"Show phone device controls only on narrow screens");
assert.ok(settings.includes('checked={emailUpdates}')&&settings.includes('checked={rewardAlerts}')&&settings.includes('checked={pushEnabled}'),"Keep notification switches functional");
for(const enabled of ["email_updates: Boolean(notifications.email_updates ?? true)","reward_alerts: Boolean(notifications.reward_alerts ?? true)","push_enabled: Boolean(notifications.push_enabled ?? true)"]){
 assert.ok(defaults.includes(enabled),"Default account and reward notifications enabled by default");
}
assert.ok(defaults.includes("promotions: Boolean(notifications.promotions ?? false)"),"Marketing requires explicit consent");
assert.ok(sidebar.includes("useLayoutEffect")&&sidebar.includes("sessionStorage.setItem")&&sidebar.includes("sessionStorage.getItem"),"Saved navigation offsets restore before paint");
assert.ok(sidebar.includes("scrollTop")&&sidebar.includes("scrollLeft"),"Support vertical and horizontal sidebars");
assert.ok(sidebar.includes("onClickCapture:saveNow"),"Capture positions before page transition");
assert.ok(sidebar.includes("const attach=useCallback"),"Typed callback ref fits all sidebar elements");
for(const [name,code] of [["Customer",customer],["Business",business],["Admin",admin]]){
 assert.ok(code.includes("usePersistentNavScroll("),name+" must restore sidebar after route change/refresh");
 assert.ok(code.includes("loyvance-sidebar-scroll"),name+" must allow lightweight scrolling");
}
assert.ok(business.includes("ref={desktopScroll.ref}")&&business.includes("ref={mobileScroll.ref}"),"Business scroll desktop and mobile drawer preserved");
assert.ok(admin.includes('mobileTabsScroll=usePersistentNavScroll(')&&admin.includes('"x"'),"Admin mobile bottom bar horizontal offset preserved");
assert.ok(admin.includes("flex-nowrap")&&admin.includes("shrink-0"),"Admin bottom bar must stay one row");
assert.ok(css.includes(".loyvance-sidebar-scroll::-webkit-scrollbar"),"Sidebar scrollbar hidden without disabling scrolling");
console.log("PASS: single customer passkey location, mobile-only push controls, safe notification defaults, and persistent customer/business/admin navigation");
