const PREFIX='cycle-navi:'+self.registration.scope+':';
const CACHE=PREFIX+'v3';
const ASSETS=['./','./index.html','./style.css','./app.js','./nav.js','./planner.js','./services.js','./terrain.js','./elevation.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Do not intercept map tiles or any third-party requests.
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const allowed=ASSETS.map(p=>new URL(p,self.registration.scope).href);
  if(!allowed.includes(url.href))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const saved=await cache.match(event.request);
    return saved||fetch(event.request);
  }));
});
