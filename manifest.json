const cacheName = 'ollie-controller-v2';
// External resources are removed to prevent CORS errors.
// The browser will handle caching for these.
const assetsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/main.js',
    './js/ollie.js',
    './img/logo_ms.png',
    './img/logo_mt.png',
    './img/icon-192x192.png',
    './img/icon-512x512.png',
    './manifest.json'
];

self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(cacheName)
            .then(cache => {
                console.log('[Service Worker] Caching all: app shell and content');
                return cache.addAll(assetsToCache);
            })
            .catch(error => {
                console.error('Failed to cache assets during install:', error);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // IMPORTANT: Clone the request. A request is a stream and
                // can only be consumed once. Since we are consuming this
                // once by cache and once by the browser for fetch, we need
                // to clone the response.
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(
                    response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // IMPORTANT: Clone the response. A response is a stream
                        // and because we want the browser to consume the response
                        // as well as the cache consuming the response, we need
                        // to clone it so we have two streams.
                        const responseToCache = response.clone();

                        caches.open(cacheName)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
});

// Clean up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [cacheName];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (cacheWhitelist.indexOf(name) === -1) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
});

