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
        console.log('🔄 Auto-Update Service initialized (development mode - auto-updates disabled)');
        
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
        
        console.log('🔄 Auto-Update Service ready (manual sync only)');
    }

    startPeriodicUpdates() {
        // Clear any existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Check for updates every hour (more reasonable)
        this.updateInterval = setInterval(async () => {
            if (this.isOnline) {
                await this.checkForNewEpisodes();
            }
        }, 60 * 60 * 1000); // 1 hour
    }

    async checkForNewEpisodes() {
        try {
            // Check all podcasts in main database (not tracked podcasts)
            
            // Get all podcasts from main collection
            const allPodcasts = await this.db.getAllPodcasts();
            
            for (const podcast of allPodcasts) {
                try {
                    if (podcast.feedUrl) {
                        const result = await this.syncPodcastWithCache(podcast.feedUrl || podcast.id);
                        if (result.success && result.newEpisodes > 0) {
                            this.notifyNewEpisodes(podcast.title, result.newEpisodes);
                        }
                    }
                } catch (error) {
                    // Silently handle individual podcast errors
                }
            }
            
            // Update last sync time
            this.lastSyncTime = Date.now();
            localStorage.setItem('lastSyncTime', this.lastSyncTime);
            
            this.getUpdateStats();
        } catch (error) {
            // Only log critical errors
            console.error('❌ Critical error in auto-update:', error);
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
            // Silently handle RSS fetch errors
            throw error;
        }
    }

    async findNewEpisodes(podcastData) {
        try {
            const existingEpisodes = await this.db.getEpisodesByPodcast(podcastData.id);
            const existingEpisodeIds = new Set(existingEpisodes.map(ep => ep.id));
            
            const newEpisodes = podcastData.episodes.filter(episode => 
                !existingEpisodeIds.has(episode.id)
            );
            
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
                    publishDate: new Date(episode.publishDate),
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
        if (window.firebase && window.firebase.database) {
            const database = window.firebase.database();
            
            database.ref('episodes').limitToLast(1).on('child_added', (snapshot) => {
                const newEpisode = snapshot.val();
                this.notifyNewEpisodes(newEpisode.podcastTitle || 'Unknown', 1);
            });
            
            database.ref('syncStatus').on('value', (snapshot) => {
                const status = snapshot.val();
                if (status === 'completed' && window.app && window.app.loadData) {
                    window.app.loadData();
                }
            });
        }
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

    // Get update statistics
    getUpdateStats() {
        return {
            lastSyncTime: this.lastSyncTime,
            cacheSize: this.cache.size,
            isOnline: this.isOnline,
            updateInterval: this.updateInterval ? '2 minutes' : 'stopped'
        };
    }
}

// Initialize the auto-update service
let autoUpdateService;
window.addEventListener('DOMContentLoaded', () => {
    autoUpdateService = new AutoUpdateService();
    window.autoUpdateService = autoUpdateService;
    
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});
