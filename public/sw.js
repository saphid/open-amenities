const CACHE='open-amenities-offline-v1';
const FILES=['/offline.html','/offline.js','/offline.css','/icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('open-amenities-offline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));return;}
  if(FILES.includes(new URL(event.request.url).pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  // No API responses or third-party map tiles are cached by this worker.
});
