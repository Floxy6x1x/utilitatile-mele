// Service Worker optimizat pentru cache invalidation și performanță mobile
const CACHE_NAME = 'indexuri-app-v2.2';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // CDN-urile externe sunt cache-ate automat de browser
];

// Instalarea Service Worker-ului
self.addEventListener('install', function(event) {
  console.log('Service Worker: Instalez versiunea', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Cache deschis');
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        // Forțează activarea imediată a noului service worker
        return self.skipWaiting();
      })
  );
});

// Activarea Service Worker-ului
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activez versiunea', CACHE_NAME);
  
  event.waitUntil(
    // Șterge toate cache-urile vechi
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Șterg cache vechi:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // Preia controlul asupra tuturor paginilor
      return self.clients.claim();
    })
  );
});

// Interceptarea cererilor de rețea
self.addEventListener('fetch', function(event) {
  // Skip non-GET requests și cereri către alte domenii
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - returnează răspunsul din cache
        if (response) {
          console.log('Service Worker: Servesc din cache:', event.request.url);
          return response;
        }

        // IMPORTANT: Clonează cererea pentru că e un stream
        var fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          function(response) {
            // Verifică dacă e un răspuns valid
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clonează răspunsul pentru cache
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                // Cache-ază doar resursele din același origin
                if (event.request.url.startsWith(self.location.origin)) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(function() {
          // Fallback pentru offline - returnează pagina principală pentru navigare
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Gestionarea update-urilor de cache
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background Sync pentru date (opțional pentru viitor)
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync declanșat');
    // Aici poți adăuga logica pentru sincronizarea datelor în background
  }
});

// Push notifications (opțional pentru viitor)
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    console.log('Service Worker: Push notification primită:', data);
    
    const options = {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'indexuri-notification',
      requireInteraction: true
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});
