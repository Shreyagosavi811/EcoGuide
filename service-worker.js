const CACHE_NAME = 'ecoguide-v1';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './hero.jpg',
  './js/benchmarks.js',
  './js/calculator.js',
  './js/profiler.js',
  './js/recommender.js',
  './js/storyteller.js',
  './js/planning.js',
  './js/simulator.js',
  './js/analytics.js',
  './js/report.js',
  './js/forest.js',
  './js/achievements.js',
  './js/tests.js',
  './js/conversation.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Install Event - Precache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Cache First Strategy
self.addEventListener('fetch', event => {
  // Only handle GET requests and local/safe URLs
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        // Cache dynamic fetch responses for http/https requests
        if (networkResponse && networkResponse.status === 200 && (event.request.url.startsWith('http') || event.request.url.startsWith('https'))) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for document navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
