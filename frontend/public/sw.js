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
