// Service Worker for Mapbox tile caching
const CACHE_NAME = 'shadowcheck-map-tiles-v1';
const TILE_CACHE_SIZE = 500; // Max tiles to cache

// Mapbox tile URL patterns
const TILE_PATTERNS = [
  /^https:\/\/api\.mapbox\.com\/.*\/tiles\//,
  /^https:\/\/.*\.tiles\.mapbox\.com\//,
  /^https:\/\/api\.mapbox\.com\/styles\//,
  /^https:\/\/api\.mapbox\.com\/fonts\//,
];

function isTileRequest(url) {
  return TILE_PATTERNS.some((pattern) => pattern.test(url));
}

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing map cache service worker');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating map cache service worker');
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('shadowcheck-map-tiles-') && cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - cache tiles
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only cache tile requests
  if (!isTileRequest(url)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached tile
          return cachedResponse;
        }

        // Fetch from network and cache
        return fetch(event.request)
          .then((networkResponse) => {
            // Only cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              // Clone response before caching
              cache.put(event.request, networkResponse.clone());

              // Limit cache size
              limitCacheSize(cache, TILE_CACHE_SIZE);
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);
            // Return offline fallback if available
            return cache.match(event.request);
          });
      });
    })
  );
});

// Limit cache size by removing oldest entries
async function limitCacheSize(cache, maxSize) {
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    // Remove oldest 10% of tiles
    const toDelete = keys.slice(0, Math.floor(maxSize * 0.1));
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// Message handler for manual cache management
self.addEventListener('message', (event) => {
  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  } else if (event.data.action === 'getCacheSize') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.keys().then((keys) => {
          event.ports[0].postMessage({ size: keys.length });
        });
      })
    );
  }
});
