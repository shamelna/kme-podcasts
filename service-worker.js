// Service Worker for Background Podcast Updates - FIXED VERSION
const CACHE_NAME = 'podcast-app-v4';
const CACHE_VERSION = '4.0.0';

// Import Firebase scripts at the top level (synchronous)
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js');

// Debug: Check if Firebase is available
console.log('🔥 Firebase loaded in service worker:', typeof firebase !== 'undefined');
console.log('🔥 Firebase apps available:', firebase.apps ? firebase.apps.length : 'undefined');

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
    
    // Remove automatic skip waiting to prevent continuous refreshes
    // self.skipWaiting();
    
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

// Listen for skip waiting message
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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
        
        // Debug: Check Firebase availability before starting
        console.log('🔍 Firebase check before sync:', typeof firebase !== 'undefined' ? 'Available' : 'Not available');
        
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
            // Check if Firebase is already initialized
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            
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
                    
                    // Try multiple CORS proxies
                    const proxies = [
                        `https://api.allorigins.win/get?url=${encodeURIComponent(podcast.feedUrl)}`,
                        `https://corsproxy.io/?${encodeURIComponent(podcast.feedUrl)}`,
                        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(podcast.feedUrl)}`
                    ];
                    
                    let data = null;
                    let lastError = null;
                    
                    for (const proxyUrl of proxies) {
                        try {
                            console.log(`🌐 Trying proxy: ${proxyUrl.split('?')[0]}...`);
                            const response = await fetch(proxyUrl);
                            
                            if (response.ok) {
                                const responseData = await response.json();
                                if (responseData.contents || responseData.status === 200) {
                                    data = responseData;
                                    console.log(`✅ Success with proxy: ${proxyUrl.split('?')[0]}`);
                                    break;
                                }
                            }
                        } catch (proxyError) {
                            lastError = proxyError;
                            console.log(`❌ Proxy failed: ${proxyUrl.split('?')[0]} - ${proxyError.message}`);
                            continue;
                        }
                    }
                    
                    if (!data) {
                        throw lastError || new Error('All proxies failed');
                    }
                    
                    // Get RSS content from different proxy response formats
                    let rssContent = '';
                    if (data.contents) {
                        rssContent = data.contents;
                    } else if (typeof data === 'string') {
                        rssContent = data;
                    } else if (data.data) {
                        rssContent = data.data;
                    }
                    
                    if (!rssContent) {
                        console.log(`⚠️ No RSS content found for ${podcast.title}`);
                        continue;
                    }
                    
                    // Parse RSS feed using text-based parsing (DOMParser not available in service workers)
                    const rssText = rssContent;
                    const items = [];
                    
                    // Simple text-based RSS parsing
                    const itemMatches = rssText.match(/<item>([\s\S]*?)<\/item>/g);
                    if (itemMatches) {
                        itemMatches.forEach(itemText => {
                            const titleMatch = itemText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || 
                                              itemText.match(/<title>(.*?)<\/title>/);
                            const pubDateMatch = itemText.match(/<pubDate>(.*?)<\/pubDate>/);
                            const guidMatch = itemText.match(/<guid>(.*?)<\/guid>/) || 
                                           itemText.match(/<guid[^>]*>(.*?)<\/guid>/);
                            const enclosureMatch = itemText.match(/<enclosure[^>]*url="([^"]*)"/);
                            const descMatch = itemText.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || 
                                          itemText.match(/<description>(.*?)<\/description>/);
                            
                            if (titleMatch) {
                                items.push({
                                    title: titleMatch[1] ? titleMatch[1].trim() : '',
                                    pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
                                    guid: guidMatch ? guidMatch[1].trim() : titleMatch[1],
                                    audioUrl: enclosureMatch ? enclosureMatch[1] : '',
                                    description: descMatch ? descMatch[1].trim() : ''
                                });
                            }
                        });
                    }
                    
                    // Get existing episodes for this podcast
                    const existingEpisodesSnapshot = await db.collection('episodes')
                        .where('podcastId', '==', podcast.id)
                        .get();
                    const existingEpisodeIds = new Set(existingEpisodesSnapshot.docs.map(doc => doc.id));
                    
                    // Check for new episodes
                    for (const item of items) {
                        const title = item.title || '';
                        const pubDate = item.pubDate || '';
                        const guid = item.guid || title;
                        const audioUrl = item.audioUrl || '';
                        const description = item.description || '';
                        
                        // Generate stable episode ID
                        const episodeId = generateEpisodeId(title, pubDate, guid, audioUrl, podcast.id);
                        
                        if (!existingEpisodeIds.has(episodeId)) {
                            // Save new episode
                            const episodeData = {
                                id: episodeId,
                                title: title,
                                description: description,
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
                const result = await syncPodcast(podcast);
                results.push(result);
            } catch (error) {
                results.push({
                    podcast: podcast.title,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return new Response(JSON.stringify({
            success: true,
            results: results
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle update check requests
async function handleUpdateCheck(request) {
    try {
        await performBackgroundSync();
        return new Response(JSON.stringify({
            success: true,
            message: 'Update check completed'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Fetch tracked podcasts from Firebase
async function fetchTrackedPodcasts() {
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyCFC1q7p6MSly1ua50n-XI3yO4NmFCUMj4",
            authDomain: "kme-podcasts.firebaseapp.com",
            projectId: "kme-podcasts",
            storageBucket: "kme-podcasts.firebasestorage.app",
            messagingSenderId: "635239448486",
            appId: "1:635239448486:web:57c7f8c39009e3bb4cd967",
            measurementId: "G-NSEVF9C6G1"
        };
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        const db = firebase.firestore();
        const snapshot = await db.collection('podcasts').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching podcasts:', error);
        return [];
    }
}

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
