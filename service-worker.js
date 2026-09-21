var CACHE_NAME = 'talkflow-v2';
var urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// ===== INSTALL — cache all app files, activate immediately =====
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(urlsToCache);
        })
    );
});

// ===== ACTIVATE — clean old caches, take control right away =====
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(names.filter(function(n) {
                return n !== CACHE_NAME;
            }).map(function(n) {
                return caches.delete(n);
            }));
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ===== FETCH — cache-first, with navigation fallback to index.html =====
self.addEventListener('fetch', function(event) {
    var req = event.request;

    // For page navigations, always fall back to cached index.html when offline
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).catch(function() {
                return caches.match('./index.html');
            })
        );
        return;
    }

    // For everything else: serve from cache first, then network,
    // and stash any newly fetched file into the cache for next time.
    event.respondWith(
        caches.match(req).then(function(cached) {
            if (cached) return cached;
            return fetch(req).then(function(response) {
                if (response && response.status === 200 && response.type === 'basic') {
                    var copy = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(req, copy);
                    });
                }
                return response;
            });
        })
    );
});
