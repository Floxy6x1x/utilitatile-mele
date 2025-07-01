// Service Worker pentru Utilitățile Familiei PWA - Versiunea Simplificată
const CACHE_NAME = 'utilitati-familie-v1.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('📦 SW Utilitățile Familiei - Instalare...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📁 Se cache-ază resursele...');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
      })
      .then(() => {
        console.log('✅ Cache-uire completă - aplicația funcționează offline');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Eroare la cache-uire:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🔄 SW Utilitățile Familiei - Activare...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('utilitati-')) {
            console.log('🗑️ Ștergere cache vechi:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Aplicația este gata pentru utilizare offline');
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

  // Skip external requests (except XLSX)
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
          console.log('📦 Servit din cache:', event.request.url.split('/').pop());
          return response;
        }

        // Otherwise fetch from network
        console.log('🌐 Descărcare din rețea:', event.request.url.split('/').pop());
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
                console.log('💾 Adăugat în cache:', event.request.url.split('/').pop());
              });

            return response;
          })
          .catch(error => {
            console.error('❌ Eroare la fetch:', error);
            
            // Return offline page for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return new Response(`
                <!DOCTYPE html>
                <html lang="ro">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>🏠 Utilitățile Familiei - Offline</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            text-align: center;
                            padding: 50px 20px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            margin: 0;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
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
                            line-height: 1.6;
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
                        .features {
                            text-align: left;
                            margin: 20px 0;
                            padding: 15px;
                            background: rgba(255,255,255,0.05);
                            border-radius: 10px;
                        }
                        .features h3 {
                            margin: 0 0 10px 0;
                            font-size: 1rem;
                        }
                        .features ul {
                            margin: 0;
                            padding-left: 20px;
                        }
                        .features li {
                            margin: 5px 0;
                            font-size: 0.9rem;
                        }
                    </style>
                </head>
                <body>
                    <div class="offline-container">
                        <div class="offline-icon">🏠</div>
                        <h1>Utilitățile Familiei</h1>
                        <p><strong>📱 Aplicația funcționează offline!</strong></p>
                        <p>Nu ești conectat la internet, dar aplicația este disponibilă local.</p>
                        
                        <div class="features">
                            <h3>✅ Disponibil offline:</h3>
                            <ul>
                                <li>📊 Adaugă citiri utilități</li>
                                <li>🚗 Actualizează informații auto</li>
                                <li>📋 Generează rapoarte Excel</li>
                                <li>💾 Toate datele sunt salvate local</li>
                            </ul>
                        </div>
                        
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
            
            throw error;
          });
      })
  );
});

// Handle messages from main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('🔄 Forțare update PWA de către utilizator');
    self.skipWaiting();
  }
});

// Background sync pentru când se reconectează
self.addEventListener('sync', event => {
  console.log('🔄 Background sync declanșat:', event.tag);
  
  if (event.tag === 'family-sync') {
    event.waitUntil(syncFamilyData());
  }
});

// Sync familia când se reconectează
async function syncFamilyData() {
  try {
    console.log('👫 Background sync pentru datele familiei...');
    
    // Verifică dacă există date pentru sync
    const familyCode = await getStorageData('familyCode');
    const lastModified = await getStorageData('lastModified');
    
    if (familyCode && lastModified) {
      console.log(`✅ Date găsite pentru familia ${familyCode}`);
      
      // Notifică aplicația principală
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_AVAILABLE',
          data: { 
            familyCode, 
            lastModified, 
            timestamp: Date.now() 
          }
        });
      });
    }
  } catch (error) {
    console.error('❌ Eroare background sync:', error);
  }
}

// Helper pentru citirea din storage
async function getStorageData(key) {
  return new Promise((resolve) => {
    // În aplicația reală, aici ai accesa IndexedDB
    // Pentru simplitate, returnăm null
    resolve(null);
  });
}

// Push notifications pentru reminder-uri (viitor)
self.addEventListener('push', event => {
  console.log('📬 Push notification primită');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Ai un reminder nou pentru utilități sau mașină!',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      data: data.url || './',
      actions: [
        {
          action: 'open',
          title: 'Deschide aplicația',
          icon: './icon-192.png'
        },
        {
          action: 'dismiss',
          title: 'Închide'
        }
      ],
      tag: 'utilities-reminder',
      requireInteraction: true
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || '🏠 Utilitățile Familiei', 
        options
      )
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

// Notification close event
self.addEventListener('notificationclose', event => {
  console.log('❌ Notificare închisă:', event.notification.tag);
});

// Error handling
self.addEventListener('error', event => {
  console.error('❌ SW Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('❌ SW Unhandled Rejection:', event.reason);
});

console.log('🚀 Service Worker pentru Utilitățile Familiei v1.0 încărcat!');
console.log('✅ Aplicația funcționează offline cu toate funcționalitățile');
