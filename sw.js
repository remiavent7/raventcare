// Minimal service worker so browsers offer "Install Ravent Care" on desktop. Network-first, no offline caching of patient data.
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(e){e.respondWith(fetch(e.request))});
