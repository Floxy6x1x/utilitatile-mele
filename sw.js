// Service Worker pentru aplicația Indexuri & Reminder-uri
// Versiunea 2.0

const CACHE_NAME = 'indexuri-app-v2.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalarea Service Worker
self.addEventListener('install', function(event) {
  console.log('Service Worker: Instalare...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Cache deschis');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.error('Service Worker: Eroare la cache:', error);
      })
  );
  
  // Forțează activarea imediată
  self.skipWaiting();
});

// Activarea Service Worker
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activare...');
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Șterge cache-urile vechi
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Șterg cache vechi:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Preia controlul tuturor clientilor
  self.clients.claim();
});

// Interceptarea request-urilor
self.addEventListener('fetch', function(event) {
  // Doar pentru request-uri HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Returnează din cache dacă există
        if (response) {
          console.log('Service Worker: Servesc din cache:', event.request.url);
          return response;
        }
        
        // Altfel, încearcă să facă fetch din rețea
        return fetch(event.request)
          .then(function(response) {
            // Verifică dacă răspunsul este valid
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clonează răspunsul pentru cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(function(error) {
            console.error('Service Worker: Fetch failed:', error);
            
            // Returnează o pagină offline dacă este cazul
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});

// Gestionarea mesajelor de la aplicația principală
self.addEventListener('message', function(event) {
  console.log('Service Worker: Mesaj primit:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'UPDATE_CACHE') {
    // Actualizează cache-ul manual
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        event.ports[0].postMessage({ success: true });
      })
      .catch(function(error) {
        event.ports[0].postMessage({ success: false, error: error.message });
      });
  }
});

// Notificări push (pentru viitor)
self.addEventListener('push', function(event) {
  console.log('Service Worker: Push notification primit');
  
  const options = {
    body: 'Aveți reminder-uri noi!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'reminder'
    },
    actions: [
      {
        action: 'explore',
        title: 'Vezi aplicația',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Închide',
        icon: '/icon-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Indexuri & Reminder-uri', options)
  );
});

// Click pe notificare
self.addEventListener('notificationclick', function(event) {
  console.log('Service Worker: Notification click:', event.notification.tag);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    // Deschide aplicația
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Nu face nimic, notificarea se închide oricum
  } else {
    // Click pe corpul notificării
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Sincronizare în background (pentru viitor)
self.addEventListener('sync', function(event) {
  console.log('Service Worker: Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Aici se poate implementa sincronizarea automată
      // cu serverul când conexiunea revine
      console.log('Service Worker: Sincronizare în background')
    );
  }
});

// Periodic background sync (pentru viitor)
self.addEventListener('periodicsync', function(event) {
  console.log('Service Worker: Periodic sync:', event.tag);
  
  if (event.tag === 'reminder-check') {
    event.waitUntil(
      // Verifică reminder-urile periodic
      checkRemindersInBackground()
    );
  }
});

// Funcție pentru verificarea reminder-urilor în background
function checkRemindersInBackground() {
  return new Promise((resolve) => {
    // Aici se poate implementa logica pentru verificarea
    // reminder-urilor și trimiterea notificărilor
    console.log('Service Worker: Verific reminder-urile...');
    resolve();
  });
}

// Gestionarea erorilor
self.addEventListener('error', function(event) {
  console.error('Service Worker: Eroare:', event.error);
});

self.addEventListener('unhandledrejection', function(event) {
  console.error('Service Worker: Promise rejection nehandled:', event.reason);
});
