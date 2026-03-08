const CACHE_NAME = 'metaforge-engine-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/creator/',
  '/creator/index.html',
  '/engine/',
  '/engine/index.html',
  '/manifest.json',
  '/sw.js',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Special handling for redirect links (e.g., /{code})
  // If we're offline, try to find the cached redirect target.
  if (url.origin === self.location.origin && url.pathname.length === 7 && url.pathname.startsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If successful, cache the response and the target
          if (response.status === 200 || response.type === 'opaque') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: try to serve from cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Fallback to offline page or message
            return new Response('Offline: Redirect target not cached.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
        })
    );
    return;
  }

  // Standard cache-first for other assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // Cache external assets like fonts on the fly
        if (fetchResponse.status === 200) {
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return fetchResponse;
      });
    })
  );
});
