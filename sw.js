// Service Worker pentru Utilitățile Mele PWA v4.0
const CACHE_NAME = 'utilitatile-mele-v4.0';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('📦 Service Worker instalat - Utilitățile Mele PWA v4.0');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📁 Cache deschis, se adaugă fișierele...');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
      })
      .then(() => {
        console.log('✅ Toate fișierele au fost cache-uite cu succes');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Eroare la cache-uirea fișierelor:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activat - curățare cache-uri vechi');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('utilitatile-mele-')) {
            console.log('🗑️ Ștergere cache vechi:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Cache-uri vechi șterse, aplicația este gata');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external requests that are not in our cache list
  const url = new URL(event.request.url);
  const isExternal = !url.origin.includes(self.location.origin) && 
                    !url.href.includes('cdnjs.cloudflare.com');
  
  if (isExternal) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          console.log('📦 Servit din cache:', event.request.url);
          return response;
        }

        // Otherwise fetch from network
        console.log('🌐 Se descarcă din rețea:', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Add to cache for future use
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('💾 Adăugat în cache:', event.request.url);
              });

            return response;
          })
          .catch(error => {
            console.error('❌ Eroare la fetch:', error);
            
            // Return offline page or basic response for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return new Response(`
                <!DOCTYPE html>
                <html lang="ro">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>📊 Utilitățile Mele - Offline</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            text-align: center;
                            padding: 50px 20px;
                            background: linear-gradient(135deg, #4CAF50, #2196F3);
                            color: white;
                            margin: 0;
                        }
                        .offline-container {
                            max-width: 400px;
                            margin: 0 auto;
                            background: rgba(255,255,255,0.1);
                            padding: 40px;
                            border-radius: 20px;
                            backdrop-filter: blur(10px);
                        }
                        .offline-icon {
                            font-size: 4rem;
                            margin-bottom: 20px;
                        }
                        h1 {
                            margin: 0 0 20px 0;
                            font-size: 1.5rem;
                        }
                        p {
                            margin: 10px 0;
                            opacity: 0.9;
                        }
                        .retry-btn {
                            background: rgba(255,255,255,0.2);
                            border: 2px solid rgba(255,255,255,0.3);
                            color: white;
                            padding: 15px 30px;
                            border-radius: 25px;
                            font-size: 1rem;
                            font-weight: 600;
                            cursor: pointer;
                            margin-top: 20px;
                            transition: all 0.3s ease;
                        }
                        .retry-btn:hover {
                            background: rgba(255,255,255,0.3);
                            transform: translateY(-2px);
                        }
                    </style>
                </head>
                <body>
                    <div class="offline-container">
                        <div class="offline-icon">📱</div>
                        <h1>📊 Utilitățile Mele</h1>
                        <p><strong>📡 Aplicația funcționează offline!</strong></p>
                        <p>Nu ești conectat la internet, dar aplicația este disponibilă local.</p>
                        <p>Datele tale sunt salvate și vor fi sincronizate când te vei reconecta.</p>
                        <button class="retry-btn" onclick="window.location.reload()">
                            🔄 Încearcă din nou
                        </button>
                    </div>
                </body>
                </html>
              `, {
                headers: {
                  'Content-Type': 'text/html'
                }
              });
            }
            
            // For other types of requests, just throw the error
            throw error;
          });
      })
  );
});

// Handle PWA updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('🔄 PWA Update forțat de utilizator');
    self.skipWaiting();
  }
});

// Background sync pentru sincronizarea datelor
self.addEventListener('sync', event => {
  console.log('🔄 Background sync declanșat:', event.tag);
  
  if (event.tag === 'sync-family-data') {
    event.waitUntil(syncFamilyData());
  }
});

// Funcție pentru sincronizarea datelor familiei
async function syncFamilyData() {
  try {
    console.log('👨‍👩‍👧‍👦 Se sincronizează datele familiei...');
    
    // Aici ar trebui să implementezi logica de sincronizare
    // Cu un backend real (Firebase, Supabase, etc.)
    
    // Pentru moment, simulăm sincronizarea
    const familyCode = await getStorageData('familyCode');
    if (familyCode) {
      console.log('✅ Sincronizare completă pentru familia:', familyCode);
      
      // Trimite notificare către aplicația principală
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          data: { familyCode, timestamp: Date.now() }
        });
      });
    }
  } catch (error) {
    console.error('❌ Eroare la sincronizarea datelor familiei:', error);
  }
}

// Helper pentru citirea din localStorage
async function getStorageData(key) {
  return new Promise((resolve) => {
    // Simulare - în realitate ar trebui să folosești IndexedDB
    resolve(null);
  });
}

// Push notifications (pentru viitoare implementări)
self.addEventListener('push', event => {
  console.log('📬 Push notification primită');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Ai o notificare nouă de la Utilitățile Mele',
      icon: './icon-192x192.png',
      badge: './icon-96x96.png',
      vibrate: [200, 100, 200],
      data: data.url || './',
      actions: [
        {
          action: 'open',
          title: 'Deschide aplicația',
          icon: './icon-96x96.png'
        },
        {
          action: 'close',
          title: 'Închide'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || '📊 Utilitățile Mele', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('👆 Click pe notificare:', event.action);
  
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data || './')
    );
  }
});

console.log('🚀 Service Worker pentru Utilitățile Mele PWA v4.0 încărcat!');
