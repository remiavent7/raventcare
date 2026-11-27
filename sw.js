// Site is paused: remove any old service worker and its caches so visitors get the current pages.
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil((async function(){try{var k=await caches.keys();await Promise.all(k.map(function(x){return caches.delete(x)}))}catch(_){}await self.registration.unregister();var cs=await self.clients.matchAll({type:'window'});cs.forEach(function(c){c.navigate(c.url)})})())});
