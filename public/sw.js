// Network-first for pages, cache-first for hashed assets; never touches Supabase/Mollie.
const C='ptlog-v7';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./manifest.json','./icon.svg','./icon-192.png'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
 if(r.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('.html')){
  e.respondWith(fetch(r).then(n=>{const cp=n.clone();caches.open(C).then(c=>c.put('./',cp));return n}).catch(()=>caches.match('./')));return}
 e.respondWith(caches.match(r).then(x=>x||fetch(r).then(n=>{if(n.ok){const cp=n.clone();caches.open(C).then(c=>c.put(r,cp))}return n})))});
