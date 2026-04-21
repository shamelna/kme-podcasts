// Service Worker for KME Podcasts
const CACHE_NAME = 'kme-podcasts-v1';
const STATIC_CACHE = 'kme-static-v1';

// Files to cache for offline functionality
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/admin.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/admin-dashboard.js',
    '/js/firebase-config.js',
    '/js/podcast-sync.js',
    '/js/rss-parser.js',
    '/js/auto-update-service.js',
    '/js/seed-data.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.error('Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
    // Skip chrome-extension requests
    if (event.request.url.startsWith('chrome-extension://')) {
        return;
    }

    // Handle API requests (Firebase)
    if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                console.log('API request failed, app might be offline');
                return new Response('Offline - API unavailable', { 
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
        );
        return;
    }

    // Handle static assets
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                
                // Clone request for caching
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest)
                    .then((response) => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone response for caching
                        const responseToCache = response.clone();
                        
                        caches.open(STATIC_CACHE)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                            
                        return response;
                    })
                    .catch(() => {
                        // Return cached page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        
                        return new Response('Offline - Resource not available', { 
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Message handling for manual sync
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'TRIGGER_SYNC') {
        console.log('Manual sync triggered');
        // Trigger background sync if available
        if ('sync' in self.registration) {
            self.registration.sync.register('podcast-sync');
        }
    }
});

// Background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'podcast-sync') {
        event.waitUntil(
            // Perform background sync operations
            performBackgroundSync()
        );
    }
});

// Background sync function
async function performBackgroundSync() {
    console.log('Performing background sync...');
    try {
        // Add your sync logic here
        console.log('Background sync completed');
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

console.log('Service Worker loaded successfully');
