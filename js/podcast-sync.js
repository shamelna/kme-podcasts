// Podcast data synchronization service
class PodcastSyncService {
    constructor(database, rssParser) {
        this.db = database;
        this.rssParser = rssParser;
        this.syncInProgress = false;
    }

    async syncPodcast(podcastId, maxEpisodes = 50, source = 'rss') {
        try {
            console.log(`Syncing RSS podcast: ${podcastId}`);
            
            // For RSS feeds, we need to get the feed URL from the database
            let feedUrl = podcastId;
            if (podcastId.startsWith('rss_')) {
                // This is an RSS podcast, get the original feed URL
                const trackedDoc = await this.db.db.collection('trackedPodcasts').doc(podcastId).get();
                if (trackedDoc.exists) {
                    feedUrl = trackedDoc.data().feedUrl;
                    console.log(`📡 Using stored feed URL: ${feedUrl}`);
                } else {
                    throw new Error(`RSS podcast ${podcastId} not found in tracked podcasts`);
                }
            }
            
            // Use RSS feed only
            const feedData = await this.rssParser.fetchRSSFeed(feedUrl);
            const podcastData = feedData.podcast;
            const episodesData = { episodes: feedData.episodes };
            
            // Save podcast to database
            await this.db.savePodcast({
                id: podcastData.id,
                title: podcastData.title,
                description: podcastData.description,
                image: podcastData.image,
                publisher: podcastData.publisher,
                genre: podcastData.genre,
                totalEpisodes: podcastData.totalEpisodes,
                lastSyncDate: new Date().toISOString(),
                source: 'rss',
                feedUrl: feedUrl
            });

            if (!episodesData || !episodesData.episodes) {
                console.log(`⚠️ No episodes found for podcast: ${podcastData.title}`);
                return { success: true, episodesCount: 0 };
            }
            
            // Save episodes to database
            const episodePromises = episodesData.episodes.map(async (episode) => {
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
                    duration: episode.duration || null
                });
            });

            await Promise.all(episodePromises);
            
            console.log(`Successfully synced ${episodesData.episodes.length} episodes for ${podcastData.title}`);
            return { success: true, episodesCount: episodesData.episodes.length };
            
        } catch (error) {
            console.error(`Error syncing podcast ${podcastId}:`, error);
            throw error;
        }
    }

    async syncAllTrackedPodcasts() {
        try {
            console.log('Starting sync for all tracked podcasts...');
            
            const trackedPodcasts = await this.db.getTrackedPodcasts();
            console.log(`Found ${trackedPodcasts.length} podcasts to sync`);
            
            // Add delay between each podcast to avoid rate limiting
            const results = [];
            for (let i = 0; i < trackedPodcasts.length; i++) {
                const podcast = trackedPodcasts[i];
                try {
                    console.log(`Syncing podcast ${i + 1}/${trackedPodcasts.length}: ${podcast.title}`);
                    const podcastId = podcast.feedUrl || podcast.id;
                    const result = await this.syncPodcast(podcastId, 50);
                    results.push({ podcastId: podcast.id, success: true, result });
                    
                    // Add small delay between RSS feeds (not rate limited, but good practice)
                    if (i < trackedPodcasts.length - 1) {
                        console.log('⏳ Waiting 1 second between RSS feeds...');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                } catch (error) {
                    console.error(`Failed to sync ${podcast.title}:`, error);
                    results.push({ podcastId: podcast.id, success: false, error: error.message });
                }
            }
            
            console.log('Sync completed. Results:', results);
            return results;
            
        } catch (error) {
            console.error('Error during bulk sync:', error);
            throw error;
        } finally {
            this.syncInProgress = false;
        }
    }

    // Add and sync a new podcast (modified to skip tracked podcasts due to auth removal)
    async addAndSyncPodcast(podcastId, source = 'manual') {
        if (!this.rssParser) {
            throw new Error('RSS parser not available');
        }
        
        try {
            // Use RSS feed only - store original URL for syncing
            const originalFeedUrl = podcastId;
            const feedData = await this.rssParser.fetchRSSFeed(originalFeedUrl);
            const podcastData = feedData.podcast;
            
            // Skip tracked podcasts collection and save directly to main collections
            console.log('📝 Adding podcast directly to main collections (auth disabled)');
            
            // Limit episodes in podcast object to avoid Firebase size limits
            if (podcastData.episodes && podcastData.episodes.length > 0) {
                // Limit to last 50 episodes to avoid Firebase document size limits
                const episodesToSave = podcastData.episodes.slice(-50);
                console.log(`📊 Saving ${episodesToSave.length} episodes (limited from ${podcastData.episodes.length})`);
                
                // Update podcast data to only include limited episodes
                podcastData.episodes = episodesToSave;
                
                // Save podcast info
                await this.db.savePodcast(podcastData);
                
                for (const episode of episodesToSave) {
                    await this.db.saveEpisode({
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
                }
            } else {
                // Save podcast info without episodes
                await this.db.savePodcast(podcastData);
            }

            return {
                success: true,
                podcast: podcastData,
                episodesAdded: podcastData.episodes ? Math.min(podcastData.episodes.length, 50) : 0
            };
            
        } catch (error) {
            console.error('Error adding and syncing podcast:', error);
            throw error;
        }
    }

    // New method to add RSS feed by URL
    async addRSSPodcast(feedUrl) {
        if (!this.rssParser) {
            throw new Error('RSS parser not available');
        }
        
        if (!this.rssParser.validateFeedUrl(feedUrl)) {
            throw new Error('Invalid RSS feed URL');
        }
        
        return await this.addAndSyncPodcast(feedUrl, 'rss');
    }

    // New method to discover RSS feed from website
    async discoverAndAddRSSPodcast(websiteUrl) {
        if (!this.rssParser) {
            throw new Error('RSS parser not available');
        }
        
        const feedUrl = await this.rssParser.discoverFeed(websiteUrl);
        if (!feedUrl) {
            throw new Error('No RSS feed found on the website');
        }
        
        return await this.addAndSyncPodcast(feedUrl, 'rss');
    }

    extractTags(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        const tags = new Set();
        
        // Common Lean/CI related keywords
        const leanKeywords = [
            'lean', 'kaizen', 'continuous improvement', 'gemba', 'kata', '5s',
            'value stream', 'waste', 'muda', 'muri', 'just-in-time',
            'jidoka', 'andon', 'kanban', 'poka-yoke', 'takt time', 'cycle time',
            'problem solving', 'root cause', '5 whys', 'a3', 'pdca', 'plan-do-check-act'
        ];
        
        // Leadership keywords
        const leadershipKeywords = [
            'leadership', 'management', 'culture', 'change', 'transformation',
            'coaching', 'mentoring', 'team', 'organization', 'strategy'
        ];
        
        // Technology keywords
        const techKeywords = [
            'technology', 'digital', 'automation', 'ai', 'machine learning',
            'software', 'agile', 'scrum', 'devops', 'innovation'
        ];
        
        // Healthcare keywords
        const healthcareKeywords = [
            'healthcare', 'hospital', 'medical', 'patient', 'clinical', 'health'
        ];
        
        // Quality keywords
        const qualityKeywords = [
            'quality', 'six sigma', 'excellence', 'improvement', 'process',
            'standardization', 'metrics', 'performance'
        ];
        
        // Check for keywords and add corresponding tags
        const keywordGroups = [
            { keywords: leanKeywords, tag: 'Lean' },
            { keywords: leadershipKeywords, tag: 'Leadership' },
            { keywords: techKeywords, tag: 'Technology' },
            { keywords: healthcareKeywords, tag: 'Healthcare' },
            { keywords: qualityKeywords, tag: 'Quality' }
        ];
        
        keywordGroups.forEach(({ keywords, tag }) => {
            keywords.forEach(keyword => {
                if (text.includes(keyword)) {
                    tags.add(tag);
                }
            });
        });
        
        return Array.from(tags);
    }

    async featureEpisode(episodeId, order = null) {
        try {
            // Get current max order if not specified
            if (order === null) {
                const featuredEpisodes = await this.db.getFeaturedEpisodes(100);
                order = featuredEpisodes.length > 0 ? 
                    Math.max(...featuredEpisodes.map(e => e.featuredOrder || 0)) + 1 : 1;
            }
            
            await this.db.db.collection('episodes').doc(episodeId).update({
                featured: true,
                featuredOrder: order,
                featuredDate: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, order };
        } catch (error) {
            console.error('Error featuring episode:', error);
            throw error;
        }
    }

    async unfeatureEpisode(episodeId) {
        try {
            await this.db.db.collection('episodes').doc(episodeId).update({
                featured: false,
                featuredOrder: null,
                featuredDate: null
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error unfeaturing episode:', error);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize sync service with RSS parser support
const syncService = new PodcastSyncService(podcastDB, rssParser);

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PodcastSyncService, syncService };
}
