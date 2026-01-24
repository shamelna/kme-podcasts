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
            return self.clients.claim();
        })
    );
});

// Periodic background sync event
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'podcast-sync') {
        console.log('🔄 Background periodic sync triggered');
        event.waitUntil(performBackgroundSync());
    }
});

// Background sync event (manual trigger)
self.addEventListener('sync', (event) => {
    if (event.tag === 'podcast-sync') {
        console.log('🔄 Background sync triggered');
        event.waitUntil(performBackgroundSync());
    }
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Handle sync requests from main app
    if (url.pathname === '/sync') {
        event.respondWith(handleSyncRequest(request));
        return;
    }
    
    // Handle update check requests
    if (url.pathname === '/check-updates') {
        event.respondWith(handleUpdateCheck(request));
        return;
    }
    
    // Cache strategy for other requests
    if (request.method === 'GET') {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    if (response) {
                        // Return cached version, but also fetch new version
                        fetch(request).then(networkResponse => {
                            if (networkResponse.ok) {
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(request, networkResponse.clone());
                                });
                            }
                        });
                        return response;
                    }
                    
                    // If not in cache, fetch from network
                    return fetch(request)
                        .then(networkResponse => {
                            if (networkResponse.ok) {
                                const responseClone = networkResponse.clone();
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(request, responseClone);
                                });
                            }
                            return networkResponse;
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
        );
    }
});

// Main background sync function
async function performBackgroundSync() {
    try {
        console.log('🔄 Starting background sync...');
        
        // Import Firebase config in service worker context
        const firebaseConfig = {
            apiKey: "AIzaSyCFC1q7p6MSly1ua50n-XI3yO4NmFCUMj4",
            authDomain: "kme-podcasts.firebaseapp.com",
            projectId: "kme-podcasts",
            storageBucket: "kme-podcasts.firebasestorage.app",
            messagingSenderId: "635239448486",
            appId: "1:635239448486:web:57c7f8c39009e3bb4cd967",
            measurementId: "G-NSEVF9C6G1"
        };
        
        // Initialize Firebase in service worker with retry logic
        let db;
        try {
            const app = await import('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
            const firestore = await import('https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js');
            
            app.default.initializeApp(firebaseConfig);
            db = firestore.default.firestore();
            
            // Test connection with timeout
            await Promise.race([
                db.collection('podcasts').limit(1).get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 5000))
            ]);
            
            console.log('✅ Firebase connection successful');
        } catch (firebaseError) {
            console.error('❌ Firebase connection failed:', firebaseError);
            console.log('⏳ Will retry on next sync cycle');
            return; // Skip this sync cycle, will retry later
        }
        
        // Get all podcasts from Firestore
        const podcastsSnapshot = await db.collection('podcasts').get();
        const podcasts = podcastsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log(`📡 Checking ${podcasts.length} podcasts for updates`);
        let newEpisodesFound = 0;
        
        // Check each podcast for new episodes
        for (const podcast of podcasts) {
            if (podcast.feedUrl) {
                try {
                    console.log(`🔍 Checking ${podcast.title}...`);
                    const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(podcast.feedUrl)}`);
                    const data = await response.json();
                    
                    if (data.contents) {
                        // Parse RSS feed
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(data.contents, 'text/xml');
                        const items = xmlDoc.querySelectorAll('item');
                        
                        // Get existing episodes for this podcast
                        const existingEpisodesSnapshot = await db.collection('episodes')
                            .where('podcastId', '==', podcast.id)
                            .get();
                        const existingEpisodeIds = new Set(existingEpisodesSnapshot.docs.map(doc => doc.id));
                        
                        // Check for new episodes
                        for (const item of items) {
                            const title = item.querySelector('title')?.textContent || '';
                            const pubDate = item.querySelector('pubDate')?.textContent || '';
                            const guid = item.querySelector('guid')?.textContent || title;
                            const audioUrl = item.querySelector('enclosure')?.getAttribute('url') || '';
                            
                            // Generate stable episode ID
                            const episodeId = generateEpisodeId(title, pubDate, guid, audioUrl, podcast.id);
                            
                            if (!existingEpisodeIds.has(episodeId)) {
                                // Save new episode
                                const episodeData = {
                                    id: episodeId,
                                    title: title,
                                    description: item.querySelector('description')?.textContent || '',
                                    publishDate: new Date(pubDate),
                                    audioUrl: audioUrl,
                                    podcastId: podcast.id,
                                    podcastTitle: podcast.title,
                                    image: podcast.image,
                                    featured: false,
                                    featuredOrder: null,
                                    tags: [],
                                    genre: podcast.genre || 'general',
                                    duration: null
                                };
                                
                                await db.collection('episodes').doc(episodeId).set(episodeData);
                                newEpisodesFound++;
                                
                                console.log(`🆕 New episode saved: ${title}`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error syncing ${podcast.title}:`, error);
                }
            }
        }
        
        // Notify all clients about new episodes
        if (newEpisodesFound > 0) {
            console.log(`🎉 Found ${newEpisodesFound} new episodes!`);
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'NEW_EPISODES',
                    count: newEpisodesFound,
                    message: `${newEpisodesFound} new episodes found`
                });
            });
        } else {
            console.log('✅ No new episodes found');
        }
        
        console.log(`✅ Background sync completed. Found ${newEpisodesFound} new episodes`);
        
    } catch (error) {
        console.error('❌ Background sync failed:', error);
        console.log('⏳ Will retry on next cycle');
    }
}

// Generate stable episode ID
function generateEpisodeId(title, pubDate, guid, audioUrl, podcastId) {
    const stableString = `${podcastId}_${title}_${pubDate}_${guid}_${audioUrl}`;
    let hash = 0;
    for (let i = 0; i < stableString.length; i++) {
        const char = stableString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'rss_ep_' + Math.abs(hash).toString(36);
}

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

// Fallback: Use setInterval for browsers without periodic sync support
console.log('🔄 Setting up fallback background sync (every 30 minutes)');
setInterval(performBackgroundSync, 30 * 60 * 1000); // 30 minutes

// Manual trigger for testing
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'TRIGGER_SYNC') {
        console.log('🔧 Manual sync triggered from main app');
        event.waitUntil(performBackgroundSync());
    }
});

console.log('🔧 Service Worker ready for background operations');
console.log('💡 To test manually: navigator.serviceWorker.controller.postMessage({type: "TRIGGER_SYNC"})');
