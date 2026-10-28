const OFFLINE_CACHE = "loyvance-offline-v1";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add("/offline.html")).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
// Live cards, account pages and API responses always come from the network.
// Only the generic offline screen is stored on the device.
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});

 // A signed Web Push payload is delivered by the browser push service, even if
 // the installed PWA and its tabs are closed. Do not cache private message data.
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let data={};
    try { if(event.data)data=event.data.json(); } catch {}
    const rawUrl=typeof data.url==="string"?data.url:"/user/dashboard";
    const url=new URL(rawUrl,self.location.origin);
    const target=url.origin===self.location.origin && url.pathname.startsWith("/user/")
      ? url.pathname+url.search : "/user/dashboard";
    const title=typeof data.title==="string"?data.title.slice(0,100):"LOYVANCE";
    const body=typeof data.body==="string"?data.body.slice(0,360):"You have a new loyalty notification.";
    const tag=typeof data.tag==="string"?data.tag.slice(0,120):"loyvance-update";
    await self.registration.showNotification(title,{
      body,tag,icon:"/pwa/icon-192.png",badge:"/pwa/icon-192.png",
      data:{url:target},renotify:false
    });
  })());
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const requested=event.notification.data && event.notification.data.url;
    const u=new URL(typeof requested==="string"?requested:"/user/dashboard",self.location.origin);
    const target=u.origin===self.location.origin&&u.pathname.startsWith("/user/")?u.href:self.location.origin+"/user/dashboard";
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      if(client.url.startsWith(self.location.origin+"/user/")){
        await client.focus();
        if("navigate" in client)await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
