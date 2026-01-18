// Service Worker for Background Podcast Updates
const CACHE_NAME = 'podcast-app-v1';
const CACHE_VERSION = '1.0.0';

// Files to cache for offline functionality
const CACHE_URLS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/firebase-config.js',
    '/js/app.js',
    '/js/user-auth.js',
    '/js/auto-update-service.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Caching files:', CACHE_URLS);
                return cache.addAll(CACHE_URLS.map(url => new Request(url, { cache: 'reload' })))
                    .catch(error => {
                        console.error('❌ Cache add failed:', error);
                        // Continue installation even if caching fails
                    });
            })
            .then(() => {
                console.log('✅ Service Worker installed');
                self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ Cache open failed:', error);
                // Continue installation even if cache fails
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`🗑️ Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker activated');
        })
    );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests and external resources
    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return fetch(request);
    }
    
    // Handle different request types
    if (url.pathname.includes('/sync-episodes')) {
        handleSyncRequest(request);
    } else if (url.pathname.includes('/check-updates')) {
        handleUpdateCheck(request);
    } else {
        // Serve from cache, then network
        event.respondWith(
            caches.match(request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    
                    // If not in cache, fetch from network
                    return fetch(request)
                        .then(networkResponse => {
                            // Try to cache the new response
                            if (networkResponse.ok && networkResponse.type === 'basic') {
                                return caches.open(CACHE_NAME).then(cache => {
                                    return cache.put(request, networkResponse.clone())
                                        .then(() => networkResponse)
                                        .catch(cacheError => {
                                            console.error('❌ Cache put failed:', cacheError);
                                            // Still return network response even if caching fails
                                        });
                                }).catch(cacheError => {
                                    console.error('❌ Cache open failed:', cacheError);
                                    // Still return network response even if caching fails
                                });
                            } else {
                                return networkResponse;
                            }
                        })
                        .catch(networkError => {
                            console.error('❌ Network fetch failed:', networkError);
                            // Return a basic error response
                            return new Response('Network error', { 
                                status: 500,
                                statusText: 'Network fetch failed'
                            });
                        });
                })
                .catch(cacheError => {
                    console.error('❌ Cache match failed:', cacheError);
                    // If cache fails, try network
                    return fetch(request);
                })
        );
    }
});

// Handle sync requests from main app
async function handleSyncRequest(request) {
    try {
        const podcasts = await fetchTrackedPodcasts();
        const results = [];
        
        for (const podcast of podcasts) {
            try {
                const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(podcast.feedUrl)}`);
                const data = await response.json();
                
                if (data.contents && data.contents.episodes) {
                    const newEpisodes = data.contents.episodes.slice(-5); // Get latest 5 episodes
                    results.push({
                        podcast: podcast.name,
                        episodes: newEpisodes,
                        lastUpdated: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error(`Error syncing ${podcast.name}:`, error);
            }
        }
        
        const response = new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' }
        });
        
        // Notify main app of new episodes
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'NEW_EPISODES',
                    episodes: results
                });
            });
        });
        
        event.respondWith(response);
        
    } catch (error) {
        console.error('Sync request error:', error);
        event.respondWith(new Response('{"error": "Sync failed"}', {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}

// Handle update check requests
async function handleUpdateCheck(request) {
    try {
        const lastSyncTime = localStorage.getItem('lastSyncTime') || '0';
        const currentTime = Date.now();
        const timeDiff = currentTime - parseInt(lastSyncTime);
        const minutesSinceLastSync = Math.floor(timeDiff / (60 * 1000));
        
        const shouldUpdate = minutesSinceLastSync > 5; // Update if more than 5 minutes old
        
        const response = new Response(JSON.stringify({
            shouldUpdate,
            lastSyncTime,
            minutesSinceLastSync,
            currentTime
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
        event.respondWith(response);
        
    } catch (error) {
        console.error('Update check error:', error);
        event.respondWith(new Response('{"error": "Check failed"}', {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}

// Helper function to fetch tracked podcasts
async function fetchTrackedPodcasts() {
    // In a real implementation, this would fetch from your database
    // For demo purposes, return mock data
    return [
        {
            name: 'My Favorite Mistake',
            feedUrl: 'https://feed.podbean.com/myfavoritemistake/feed.xml'
        },
        {
            name: 'Lean 911',
            feedUrl: 'https://lean911.com/feed/podcast/lean-911/'
        }
    ];
}

// Periodic sync even when app is closed
setInterval(async () => {
    try {
        console.log('🔄 Background sync check...');
        const podcasts = await fetchTrackedPodcasts();
        
        for (const podcast of podcasts) {
            try {
                const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(podcast.feedUrl)}`);
                const data = await response.json();
                
                if (data.contents && data.contents.episodes) {
                    const latestEpisode = data.contents.episodes[data.contents.episodes.length - 1];
                    const lastKnownEpisode = localStorage.getItem(`last_episode_${podcast.name}`);
                    
                    if (latestEpisode && latestEpisode.title !== lastKnownEpisode) {
                        console.log(`🆕 New episode found: ${latestEpisode.title}`);
                        
                        // Notify main app when it opens
                        self.clients.matchAll().then(clients => {
                            clients.forEach(client => {
                                client.postMessage({
                                    type: 'NEW_EPISODE_ALERT',
                                    podcast: podcast.name,
                                    episode: latestEpisode
                                });
                            });
                        });
                    }
                }
            } catch (error) {
                console.error(`Background sync error for ${podcast.name}:`, error);
            }
        }
    } catch (error) {
        console.error('Background sync error:', error);
    }
}, 10 * 60 * 1000); // Every 10 minutes

console.log('🔧 Service Worker ready for background operations');
