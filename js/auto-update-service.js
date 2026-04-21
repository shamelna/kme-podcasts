// Auto-Update Service for Seamless Podcast Management
class AutoUpdateService {
    constructor() {
        this.db = window.podcastDB;
        this.rssParser = window.rssParser;
        this.updateInterval = null;
        this.lastSyncTime = localStorage.getItem('lastSyncTime') || 0;
        this.isOnline = navigator.onLine;
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        this.init();
    }

    async init() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.isOnline = true;
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
        
        // Initialize cache
        this.cache = new Map();
        
        // Set last sync time
        this.lastSyncTime = parseInt(localStorage.getItem('lastSyncTime') || '0');
        
        // Display initial stats
        this.getUpdateStats();

        // Wire up Firestore realtime listener
        this.setupRealtimeListeners();
    }

    startPeriodicUpdates() {
        // Clear any existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Check for updates every 24 hours (daily)
        this.updateInterval = setInterval(async () => {
            if (this.isOnline) {
                console.log('🔄 Daily auto-update check starting...');
                try {
                    await this.checkForNewEpisodes();
                    console.log('✅ Daily auto-update completed');
                } catch (error) {
                    console.error('❌ Daily auto-update failed:', error);
                }
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
        
        console.log('⏰ Auto-update scheduled: Every 24 hours');
    }

    async checkForNewEpisodes() {
        try {
            console.log('🔍 Starting daily episode check...');
            
            // Get all podcasts from main collection
            const allPodcasts = await this.db.getAllPodcasts();
            console.log(`📡 Checking ${allPodcasts.length} podcasts for new episodes`);
            
            let totalNewEpisodes = 0;
            let successfulPodcasts = 0;
            let failedPodcasts = 0;
            
            for (const podcast of allPodcasts) {
                try {
                    if (podcast.feedUrl) {
                        console.log(`🔍 Checking ${podcast.title}...`);
                        const result = await this.syncPodcastWithCache(podcast.feedUrl || podcast.id);
                        
                        if (result.success) {
                            successfulPodcasts++;
                            if (result.newEpisodes > 0) {
                                totalNewEpisodes += result.newEpisodes;
                                this.notifyNewEpisodes(podcast.title, result.newEpisodes);
                                console.log(`✅ ${podcast.title}: ${result.newEpisodes} new episodes`);
                            } else {
                                console.log(`📭 ${podcast.title}: No new episodes`);
                            }
                        } else {
                            failedPodcasts++;
                            console.log(`❌ ${podcast.title}: Sync failed`);
                        }
                    }
                } catch (error) {
                    failedPodcasts++;
                    console.error(`❌ Error checking ${podcast.title}:`, error.message);
                    // Continue with next podcast instead of failing completely
                }
            }
            
            // Update last sync time
            this.lastSyncTime = new Date();
            this.updateStats();
            
            console.log(`📊 Daily sync summary: ${totalNewEpisodes} new episodes from ${successfulPodcasts}/${allPodcasts.length} podcasts`);
            
            return {
                totalNewEpisodes,
                successfulPodcasts,
                failedPodcasts,
                totalPodcasts: allPodcasts.length
            };
            
        } catch (error) {
            console.error('❌ Daily episode check failed:', error);
            throw error;
        }
    }

    async syncPodcastWithCache(feedUrl) {
        // Check cache first
        const cacheKey = `rss_${feedUrl}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < 5 * 60 * 1000) {
            return cached.data;
        }
        
        try {
            // Use the global rssParser instead of this.rssParser
            const feedData = await rssParser.fetchRSSFeed(feedUrl);
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: feedData,
                timestamp: Date.now()
            });
            
            return feedData;
        } catch (error) {
            console.warn(`⚠️ RSS fetch failed for ${feedUrl}:`, error.message);
            
            // Return fallback result to prevent complete failure
            const fallbackResult = {
                success: false,
                newEpisodes: 0,
                error: error.message,
                feedUrl: feedUrl
            };
            
            // Cache the failure for a shorter time to prevent rapid retries
            this.cache.set(cacheKey, {
                data: fallbackResult,
                timestamp: Date.now()
            });
            
            return fallbackResult;
        }
    }

    async findNewEpisodes(podcastData) {
        try {
            const existingEpisodes = await this.db.getEpisodesByPodcast(podcastData.id);
            const existingEpisodeIds = new Set(existingEpisodes.map(ep => ep.id));
            
            // Additional duplicate detection by title + publish date combination
            const existingEpisodeKeys = new Set(existingEpisodes.map(ep => {
                const date = ep.publishDate;
                // Convert to ISO string for consistent comparison
                const dateStr = date.toDate ? date.toDate().toISOString() : 
                              (date instanceof Date ? date.toISOString() : 
                              new Date(date).toISOString());
                return `${ep.title.toLowerCase().trim()}_${dateStr}`;
            }));
            
            const newEpisodes = podcastData.episodes.filter(episode => {
                // Primary check: by ID
                if (existingEpisodeIds.has(episode.id)) {
                    return false;
                }
                
                // Secondary check: by title + publish date (catch-all for ID issues)
                const episodeDate = episode.publishDate;
                const episodeDateStr = episodeDate.toDate ? episodeDate.toDate().toISOString() : 
                                     (episodeDate instanceof Date ? episodeDate.toISOString() : 
                                     new Date(episodeDate).toISOString());
                const episodeKey = `${episode.title.toLowerCase().trim()}_${episodeDateStr}`;
                if (existingEpisodeKeys.has(episodeKey)) {
                    console.log(`⚠️ Auto-update found duplicate by title+date: "${episode.title}"`);
                    return false;
                }
                
                return true;
            });
            
            if (newEpisodes.length > 0) {
                await this.saveNewEpisodes(newEpisodes, podcastData);
            }
            
            return newEpisodes;
            
        } catch (error) {
            return [];
        }
    }

    async saveNewEpisodes(episodes, podcastData) {
        try {
            const savePromises = episodes.map(async (episode) => {
                return await this.db.saveEpisode({
                    id: episode.id,
                    title: episode.title,
                    description: episode.description || '',
                    publishDate: episode.publishDate,
                    audioUrl: episode.audioUrl,
                    audioLength: episode.audioLength,
                    image: episode.image || podcastData.image,
                    podcastId: podcastData.id,
                    podcastTitle: podcastData.title,
                    thumbnail: episode.thumbnail || episode.image || podcastData.image,
                    featured: false,
                    featuredOrder: null,
                    tags: episode.tags || this.extractTags(episode.title, episode.description || ''),
                    genre: podcastData.genre,
                    duration: episode.duration || null,
                    isNew: true
                });
            });
            
            await Promise.all(savePromises);
            
        } catch (error) {
            console.error('❌ Error saving new episodes:', error);
        }
    }

    notifyNewEpisodes(podcastName, episodeCount) {
        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`🎵 New Episodes Available`, {
                body: `${episodeCount} new episodes from ${podcastName}`,
                icon: '/favicon.ico',
                tag: 'new-episodes'
            });
        }
        
        // Update UI notification
        this.showUpdateNotification(podcastName, episodeCount, 'New episodes available');
        
        // Trigger app refresh if main app is available
        if (window.app && window.app.loadData) {
            window.app.loadData();
        }
    }

    showUpdateNotification(podcastName, episodeCount, message) {
        // Create a non-intrusive notification
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <span class="update-icon">📊</span>
                <div class="update-text">
                    <strong>${episodeCount} updates</strong><br>
                    <small>${message}</small>
                </div>
                <button class="update-close" onclick="this.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 6 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 6000);
    }

    setupServiceWorker() {
        // Service worker disabled due to MIME type issues
        // Can be re-enabled when proper server configuration is available
        console.log('Service Worker registration disabled');
    }

    setupRealtimeListeners() {
        // Use Firestore onSnapshot (not Realtime Database — this project uses Firestore)
        if (!window.db || !window.firebase || !window.firebase.apps.length) {
            console.warn('⚠️ Firestore not available for realtime listeners');
            return;
        }

        // Listen for newly added episodes (most recent first, limit 1)
        this._episodeListener = window.db.collection('episodes')
            .orderBy('publishDate', 'desc')
            .limit(1)
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const ep = change.doc.data();
                        // Only notify if episode was added after service init
                        const added = ep.publishDate
                            ? (ep.publishDate.toDate ? ep.publishDate.toDate() : new Date(ep.publishDate))
                            : null;
                        if (added && added > new Date(this.lastSyncTime)) {
                            this.notifyNewEpisodes(ep.podcastTitle || 'Unknown Podcast', 1);
                        }
                    }
                });
            }, err => console.warn('Episode listener error:', err));

        console.log('👂 Firestore realtime episode listener active');
    }

    handleBackgroundUpdate(episodes) {
        if (window.app && window.app.addEpisodesToGrid) {
            window.app.addEpisodesToGrid(episodes);
        }
    }

    extractTags(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        const commonWords = ['lean', 'startup', 'business', 'leadership', 'management', 'productivity', 'agile', 'devops', 'ci', 'cd'];
        
        return commonWords.filter(word => text.includes(word))
            .slice(0, 5)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1));
    }

    // Public API for manual refresh
    async forceUpdate() {
        console.log('🔄 Forcing immediate update check');
        await this.checkForNewEpisodes();
    }

    // Persist last sync time to localStorage
    updateStats() {
        const now = new Date();
        this.lastSyncTime = now;
        localStorage.setItem('lastSyncTime', now.getTime().toString());
    }

    // Get update statistics
    getUpdateStats() {
        return {
            lastSyncTime: this.lastSyncTime,
            cacheSize: this.cache.size,
            isOnline: this.isOnline,
            updateInterval: this.updateInterval ? '24 hours' : 'stopped'
        };
    }
}

// Initialize the auto-update service
let autoUpdateService;
window.addEventListener('DOMContentLoaded', () => {
    autoUpdateService = new AutoUpdateService();
    window.autoUpdateService = autoUpdateService;
    
    // Start periodic updates for automatic episode refreshing
    autoUpdateService.startPeriodicUpdates();
    
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});
