// Initial data seeding script for Kaizen Made Easy Podcast App
class PodcastSeeder {
    constructor(database) {
        this.db = database;
    }

    async seedInitialPodcasts() {
        console.log('Starting initial podcast seeding...');
        
        // Initial list of Lean/CI related podcasts to track
        const initialPodcasts = [
            {
                id: '9c754d8e8b44788b4e6a3a1c6c6c7b8', // The Lean Startup
                name: 'The Lean Startup'
            },
            {
                id: 'a1b2c3d4e5f6789012345678', // Gemba Academy Podcast
                name: 'Gemba Academy Podcast'
            },
            {
                id: 'b2c3d4e5f678901234567890', // Lean Blog Interviews
                name: 'Lean Blog Interviews'
            },
            {
                id: 'c3d4e5f67890123456789012', // My Favorite Mistake
                name: 'My Favorite Mistake'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Habitual Excellence
                name: 'Habitual Excellence'
            },
            {
                id: '4d3fe717742d49638da00e02', // The Lean Solutions Podcast
                name: 'The Lean Solutions Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // The Management Brief
                name: 'The Management Brief'
            },
            {
                id: '27a3cea6eda34f04aea766aba34c189a', // The John Maxwell Leadership Podcast
                name: 'The John Maxwell Leadership Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // HBR IdeaCast
                name: 'HBR IdeaCast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // The Knowledge Project
                name: 'The Knowledge Project'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // The Lean Effect
                name: 'The Lean Effect'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // The Lens
                name: 'The Lens'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Coacing for Leaders
                name: 'Coaching for Leaders'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Better Work
                name: 'Better Work'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Lean Blog Audio
                name: 'Lean Blog Audio'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Lean 911
                name: 'Lean 911'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Behind The Curtain
                name: 'Behind The Curtain'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Lean Made Simple
                name: 'Lean Made Simple'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Ever-So-Lean Podcast
                name: 'Ever-So-Lean Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Connecting the Dots
                name: 'Connecting the Dots'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // What It's Like To Be...
                name: 'What It\'s Like To Be...'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // The Shop Floor 
                name: 'The Shop Floor'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // People Solve Problems Podcast
                name: 'People Solve Problems Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // The Operational Excellence Journey
                name: 'The Operational Excellence Journey'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Gemba Academy Podcast
                name: 'Gemba Academy Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // WLEI - Lean Enterprise Institute's Podcast
                name: 'WLEI - Lean Enterprise Institute\'s Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // The Design Brief
                name: 'WLEI - Lean Enterprise Institute\'s Podcast (The Design Brief)'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Shingo Principles Podcast
                name: 'Shingo Principles Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // The Impruvers Podcast
                name: 'The Impruvers Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Maxwell Leadership Podcast
                name: 'Maxwell Leadership Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Kaizen Institute Global Podcast
                name: 'Kaizen Institute Global Podcast'
            },
            {
                id: 'b58c225f10ec49fb958dd6a315dce731', // Manufacturing Tech Australia
                name: 'Manufacturing Tech Australia'
            }
        ];

        const results = [];
        
        for (const podcast of initialPodcasts) {
            try {
                console.log(`Adding podcast: ${podcast.name}`);
                const result = await this.addAndSyncPodcast(podcast.id);
                results.push({ ...result, podcastName: podcast.name, success: true });
                console.log(`✅ Successfully added ${podcast.name}`);
            } catch (error) {
                console.error(`❌ Failed to add ${podcast.name}:`, error);
                results.push({ podcastName: podcast.name, success: false, error: error.message });
            }
            
            // Add delay to avoid rate limiting
            await this.delay(2000);
        }

        console.log('Seeding completed. Results:', results);
        return results;
    }

    async addAndSyncPodcast(podcastId) {
        try {
            console.log(`🔍 Fetching podcast data for ID: ${podcastId}`);
            
            // Get podcast info from Listen Notes
            const podcastData = await this.api.fetchPodcast(podcastId);
            
            if (!podcastData) {
                console.error(`❌ No podcast data found for ID: ${podcastId}`);
                throw new Error(`Podcast not found: ${podcastId}`);
            }
            
            console.log(`🔍 Podcast data received:`, podcastData);
            console.log(`🔍 Podcast ID: ${podcastData.id}`);
            console.log(`🔍 Podcast title: ${podcastData.title}`);
            
            // Add to tracked podcasts
            const trackedId = await this.db.addTrackedPodcast({
                id: podcastData.id,
                title: podcastData.title,
                description: podcastData.description,
                image: podcastData.image,
                publisher: podcastData.publisher,
                genre: podcastData.genre_ids,
                totalEpisodes: podcastData.total_episodes
            });
            
            console.log(`✅ Added to tracked podcasts with ID: ${trackedId}`);
            
            // Sync episodes
            const syncResult = await this.syncPodcastEpisodes(podcastData.id);
            
            return { 
                success: true, 
                trackedId, 
                podcast: podcastData,
                episodesSynced: syncResult.episodesCount
            };
            
        } catch (error) {
            console.error('❌ Error adding and syncing podcast:', error);
            console.error('❌ Error details:', error.message);
            console.error('❌ Error stack:', error.stack);
            throw error;
        }
    }

    async syncPodcastEpisodes(podcastId, maxEpisodes = 50) {
        try {
            console.log(`Syncing episodes for podcast: ${podcastId}`);
            
            // Fetch podcast metadata first
            const podcastData = await this.api.fetchPodcast(podcastId);
            
            // Save podcast to database
            await this.db.savePodcast({
                id: podcastData.id,
                title: podcastData.title,
                description: podcastData.description,
                image: podcastData.image,
                publisher: podcastData.publisher,
                genre: podcastData.genre_ids,
                totalEpisodes: podcastData.total_episodes,
                lastSyncDate: new Date().toISOString()
            });

            // Fetch episodes
            const episodesData = await this.api.fetchEpisodes(podcastId, 1, 'recent_first');
            
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
                    publishDate: new Date(episode.pub_date_ms),
                    audioUrl: episode.audio,
                    audioLength: episode.audio_length_sec,
                    image: episode.image || podcastData.image,
                    podcastId: podcastData.id, // Use podcastData.id instead of episode.podcast_id
                    podcastTitle: podcastData.title, // Use podcastData.title instead of episode.podcast_title
                    thumbnail: episode.thumbnail,
                    featured: false,
                    featuredOrder: null,
                    tags: this.extractTags(episode.title, episode.description || ''),
                    genre: podcastData.genre_ids
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

    async featureRecentEpisodes(count = 5) {
        try {
            console.log(`Featuring ${count} recent episodes...`);
            
            // Get latest episodes
            const latestEpisodes = await this.db.getLatestEpisodes(count * 2); // Get more to choose from
            
            // Feature the top episodes
            const featurePromises = latestEpisodes.slice(0, count).map((episode, index) => {
                return this.db.db.collection('episodes').doc(episode.id).update({
                    featured: true,
                    featuredOrder: index + 1,
                    featuredDate: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await Promise.all(featurePromises);
            console.log(`✅ Successfully featured ${count} episodes`);
            
        } catch (error) {
            console.error('Error featuring episodes:', error);
            throw error;
        }
    }

    extractTags(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        const tags = new Set();
        
        // Common Lean/CI related keywords
        const leanKeywords = [
            'lean', 'kaizen', 'continuous improvement', 'gemba', 'kata', '5s',
            'value stream', 'waste', 'muda', 'muri', 'mura', 'just-in-time',
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

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async searchAndAddPodcasts(searchTerm, maxResults = 5) {
        try {
            console.log(`Searching for podcasts: ${searchTerm}`);
            
            const searchResults = await this.api.searchPodcasts(searchTerm);
            
            if (!searchResults.results || searchResults.results.length === 0) {
                console.log('No podcasts found for search term:', searchTerm);
                return [];
            }

            const results = [];
            const podcastsToAdd = searchResults.results.slice(0, maxResults);
            
            for (const podcast of podcastsToAdd) {
                try {
                    console.log(`Adding found podcast: ${podcast.title}`);
                    const result = await this.addAndSyncPodcast(podcast.id);
                    results.push({ ...result, podcastName: podcast.title, success: true });
                    console.log(`✅ Successfully added ${podcast.title}`);
                } catch (error) {
                    console.error(`❌ Failed to add ${podcast.title}:`, error);
                    results.push({ podcastName: podcast.title, success: false, error: error.message });
                }
                
                // Add delay to avoid rate limiting
                await this.delay(2000);
            }

            return results;
        } catch (error) {
            console.error('Error searching and adding podcasts:', error);
            throw error;
        }
    }
}

// Seeding functions to run in browser console
async function seedInitialData() {
    try {
        const seeder = new PodcastSeeder(podcastDB);
        
        // Seed initial podcasts
        const results = await seeder.seedInitialPodcasts();
        
        // Feature some recent episodes
        await seeder.featureRecentEpisodes(5);
        
        console.log('🎉 Initial seeding completed successfully!');
        console.log('Results:', results);
        
        // Reload the page to see new data
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Seeding failed:', error);
    }
}

async function searchAndAddLeanPodcasts() {
    try {
        const seeder = new PodcastSeeder(podcastDB);
        
        const searchTerms = [
            'lean manufacturing',
            'continuous improvement',
            'kaizen',
            'gemba'
        ];
        
        for (const term of searchTerms) {
            console.log(`Searching for: ${term}`);
            const results = await seeder.searchAndAddPodcasts(term, 3);
            console.log(`Results for "${term}":`, results);
            
            // Delay between searches
            await seeder.delay(3000);
        }
        
        console.log('🎉 Search and add completed!');
        
    } catch (error) {
        console.error('❌ Search and add failed:', error);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PodcastSeeder, seedInitialData, searchAndAddLeanPodcasts };
}

// Make functions available globally for console use
if (typeof window !== 'undefined') {
    window.seedInitialData = seedInitialData;
    window.searchAndAddLeanPodcasts = searchAndAddLeanPodcasts;
    window.PodcastSeeder = PodcastSeeder;
}
