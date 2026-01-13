// RSS Feed Parser Service
class RSSFeedParser {
    constructor() {
        // Multiple proxy options for reliability
        this.proxies = [
            'http://localhost:3001/proxy?url=', // Local proxy (best option)
            'https://api.allorigins.win/get?url=',
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest='
        ];
        this.currentProxyIndex = 0;
    }

    async fetchRSSFeed(feedUrl) {
        try {
            console.log(`🔍 Fetching RSS feed: ${feedUrl}`);
            
            // First try direct fetch (some RSS feeds allow CORS)
            try {
                console.log('🌐 Trying direct fetch first...');
                const directResponse = await fetch(feedUrl);
                if (directResponse.ok) {
                    const xmlContent = await directResponse.text();
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
                    
                    const parseError = xmlDoc.querySelector('parsererror');
                    if (!parseError) {
                        console.log('✅ RSS feed fetched directly (no proxy needed)');
                        return this.parsePodcastFeed(xmlDoc, feedUrl);
                    }
                }
            } catch (directError) {
                console.log('⚠️ Direct fetch failed, trying proxies...');
            }
            
            // Try different proxies until one works
            for (let i = 0; i < this.proxies.length; i++) {
                try {
                    const proxy = this.proxies[i];
                    const response = await this.fetchWithProxy(feedUrl, proxy);
                    
                    if (response.ok) {
                        const contentType = response.headers.get('content-type') || '';
                        console.log(`📋 Proxy ${i + 1} response content-type: ${contentType}`);
                        
                        let data;
                        
                        // Handle local proxy differently (returns XML directly)
                        if (proxy.includes('localhost:3001')) {
                            const xmlContent = await response.text();
                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
                            
                            const parseError = xmlDoc.querySelector('parsererror');
                            if (parseError) {
                                throw new Error('XML parsing failed: ' + parseError.textContent);
                            }
                            
                            console.log('✅ RSS feed parsed successfully (local proxy)');
                            return this.parsePodcastFeed(xmlDoc, feedUrl);
                        }
                        
                        // Handle other proxies (return JSON)
                        if (contentType.includes('application/json')) {
                            data = await response.json();
                        } else {
                            // If not JSON, try to get text and parse manually
                            const text = await response.text();
                            console.log(`📄 Proxy ${i + 1} raw response (first 200 chars):`, text.substring(0, 200));
                            
                            // Check if it's an HTML error page
                            if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
                                throw new Error('Proxy returned HTML error page');
                            }
                            
                            // Try to extract JSON from text
                            try {
                                data = JSON.parse(text);
                            } catch (e) {
                                // If it's not JSON, maybe it's direct XML content
                                const xmlContent = text;
                                const parser = new DOMParser();
                                const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
                                
                                const parseError = xmlDoc.querySelector('parsererror');
                                if (parseError) {
                                    throw new Error('XML parsing failed: ' + parseError.textContent);
                                }
                                
                                console.log('✅ RSS feed parsed successfully (direct XML)');
                                return this.parsePodcastFeed(xmlDoc, feedUrl);
                            }
                        }
                        
                        if (!data.contents && !data.response) {
                            throw new Error('No content received from proxy');
                        }
                        
                        // Handle different proxy response formats
                        const xmlContent = data.contents || data.response;
                        
                        // Parse XML content
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
                        
                        // Check for parsing errors
                        const parseError = xmlDoc.querySelector('parsererror');
                        if (parseError) {
                            throw new Error('XML parsing failed: ' + parseError.textContent);
                        }
                        
                        console.log('✅ RSS feed parsed successfully');
                        return this.parsePodcastFeed(xmlDoc, feedUrl);
                    }
                } catch (proxyError) {
                    console.warn(`⚠️ Proxy ${i + 1} failed:`, proxyError.message);
                    continue; // Try next proxy
                }
            }
            
            throw new Error('All proxies failed');
            
        } catch (error) {
            console.error('❌ Error fetching RSS feed:', error);
            throw error;
        }
    }

    async fetchWithProxy(feedUrl, proxy) {
        const url = proxy + encodeURIComponent(feedUrl);
        console.log(`🌐 Trying proxy: ${proxy.substring(0, 50)}...`);
        const response = await fetch(url);
        console.log(`📡 Proxy response status: ${response.status}`);
        return response;
    }

    parsePodcastFeed(xmlDoc, feedUrl) {
        try {
            // Handle both RSS and Atom formats
            const channel = xmlDoc.querySelector('channel') || xmlDoc.querySelector('feed');
            
            if (!channel) {
                throw new Error('Invalid RSS feed format');
            }

            // Extract podcast metadata
            const podcast = {
                id: this.generateIdFromUrl(feedUrl),
                title: this.getElementText(channel, 'title') || 'Unknown Podcast',
                description: this.getElementText(channel, 'description') || '',
                image: this.extractImage(channel),
                publisher: this.getElementText(channel, 'author') || 
                          this.getElementText(channel, 'itunes:author') || 
                          'Unknown Publisher',
                feedUrl: feedUrl,
                totalEpisodes: 0,
                lastSyncDate: new Date().toISOString(),
                genre: [], // RSS feeds don't always have genre info
                language: this.getElementText(channel, 'language') || 'en'
            };

            // Extract episodes
            const episodes = [];
            const items = xmlDoc.querySelectorAll('item') || xmlDoc.querySelectorAll('entry');
            
            items.forEach((item, index) => {
                const episode = this.parseEpisode(item, podcast);
                if (episode) {
                    episodes.push(episode);
                }
            });

            podcast.totalEpisodes = episodes.length;
            podcast.episodes = episodes;

            console.log(`✅ Parsed ${episodes.length} episodes from "${podcast.title}"`);
            return { podcast, episodes };
            
        } catch (error) {
            console.error('❌ Error parsing podcast feed:', error);
            throw error;
        }
    }

    parseEpisode(item, podcast) {
        try {
            const episode = {
                id: this.generateEpisodeId(item, podcast.id),
                title: this.getElementText(item, 'title') || 'Untitled Episode',
                description: this.getElementText(item, 'description') || 
                           this.getElementText(item, 'content:encoded') || 
                           this.getElementText(item, 'summary') || '',
                publishDate: this.parsePublishDate(item),
                audioUrl: this.extractAudioUrl(item),
                audioLength: this.extractAudioLength(item),
                image: this.extractEpisodeImage(item) || podcast.image,
                podcastId: podcast.id,
                podcastTitle: podcast.title,
                thumbnail: this.extractEpisodeImage(item) || podcast.image,
                featured: false,
                featuredOrder: null,
                tags: this.extractTags(item),
                genre: podcast.genre,
                duration: this.getElementText(item, 'itunes:duration') || ''
            };

            // Only include episodes with valid audio URLs
            if (episode.audioUrl) {
                return episode;
            }
            
        } catch (error) {
            return null;
        }
    }

    extractAudioUrl(item) {
        // Try different audio URL formats
        const audioSelectors = [
            'enclosure',
            'link[type="audio/mpeg"]',
            'link[type="audio/mp3"]',
            'link[type="audio/x-m4a"]',
            'media:content'
        ];

        for (const selector of audioSelectors) {
            if (selector === 'enclosure') {
                const element = item.querySelector(selector);
                if (element) {
                    return element.getAttribute('url');
                }
            } else {
                const result = this.getElementText(item, selector);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    extractAudioLength(item) {
        const duration = this.getElementText(item, 'itunes:duration');
        if (duration) {
            // Convert HH:MM:SS or MM:SS to seconds
            const parts = duration.split(':').map(Number);
            if (parts.length === 3) {
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
                return parts[0] * 60 + parts[1];
            } else if (parts.length === 1) {
                return parts[0];
            }
        }
        return null;
    }

    extractImage(channel) {
        const imageSelectors = [
            'image url',
            'itunes:image',
            'media:thumbnail',
            'logo'
        ];

        for (const selector of imageSelectors) {
            const result = this.getElementText(channel, selector);
            if (result) {
                return result;
            }
        }

        return null;
    }

    extractEpisodeImage(item) {
        const imageSelectors = [
            'itunes:image',
            'media:thumbnail',
            'image url',
            'enclosure[type="image/jpeg"]'
        ];

        for (const selector of imageSelectors) {
            const result = this.getElementText(item, selector);
            if (result) {
                return result;
            }
        }

        return null;
    }

    extractTags(item) {
        const tags = new Set();
        const text = `${this.getElementText(item, 'title')} ${this.getElementText(item, 'description')}`.toLowerCase();
        
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
        
        // Also extract explicit categories from RSS
        const categories = item.querySelectorAll('category');
        categories.forEach(category => {
            if (category.textContent) {
                tags.add(category.textContent.trim());
            }
        });
        
        return Array.from(tags);
    }

    parsePublishDate(item) {
        const dateSelectors = [
            'pubDate',
            'published',
            'updated'
        ];

        for (const selector of dateSelectors) {
            const dateText = this.getElementText(item, selector);
            if (dateText) {
                const date = new Date(dateText);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }

        // Try to extract date from title or description as fallback
        const title = this.getElementText(item, 'title');
        const description = this.getElementText(item, 'description');
        
        // Look for year patterns in title/description
        const yearPattern = /(20\d{2})/;
        const titleMatch = title.match(yearPattern);
        const descMatch = description.match(yearPattern);
        
        if (titleMatch) {
            return new Date(`${titleMatch[1]}-01-01`).toISOString();
        }
        
        if (descMatch) {
            return new Date(`${descMatch[1]}-01-01`).toISOString();
        }
        
        return new Date().toISOString(); // Fallback to current date as ISO string
    }

    getElementText(parent, selector) {
        // Handle XML namespaces for iTunes elements
        if (selector.includes(':')) {
            const [prefix, tag] = selector.split(':');
            const namespaceElements = parent.getElementsByTagName(tag);
            for (let element of namespaceElements) {
                if (element.tagName && element.tagName.includes(prefix + ':' + tag)) {
                    return element.textContent || element.getAttribute('href') || element.getAttribute('url') || '';
                }
            }
            return null;
        }
        
        const element = parent.querySelector(selector);
        return element ? (element.textContent || element.getAttribute('href') || element.getAttribute('url') || '').trim() : null;
    }

    generateIdFromUrl(url) {
        // Create a consistent ID from the RSS feed URL
        return 'rss_' + this.safeEncode(url).substring(0, 20);
    }

    generateEpisodeId(item, podcastId) {
        const title = this.getElementText(item, 'title') || '';
        const pubDate = this.getElementText(item, 'pubDate') || '';
        const guid = this.getElementText(item, 'guid') || '';
        
        // Create a truly unique ID using timestamp and random components
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        const uniqueString = `${podcastId}_${title}_${pubDate}_${guid}_${timestamp}_${random}`;
        
        // Use a simple hash-like approach for consistency
        let hash = 0;
        for (let i = 0; i < uniqueString.length; i++) {
            const char = uniqueString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return 'rss_ep_' + Math.abs(hash).toString(36) + '_' + random;
    }

    // Safe encoding method that handles Unicode characters
    safeEncode(str) {
        try {
            // First try btoa (works for ASCII)
            return btoa(str);
        } catch (e) {
            // Fallback for Unicode characters
            return btoa(encodeURIComponent(str));
        }
    }

    // Method to validate RSS feed URL
    validateFeedUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    // Method to discover RSS feed from podcast website
    async discoverFeed(websiteUrl) {
        try {
            console.log(`🔍 Discovering RSS feed from: ${websiteUrl}`);
            
            // Try different proxies until one works
            for (let i = 0; i < this.proxies.length; i++) {
                try {
                    const proxy = this.proxies[i];
                    const response = await this.fetchWithProxy(websiteUrl, proxy);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        if (!data.contents && !data.response) {
                            throw new Error('Could not fetch website content');
                        }
                        
                        // Handle different proxy response formats
                        const htmlContent = data.contents || data.response;
                        
                        const parser = new DOMParser();
                        const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
                        
                        // Look for RSS feed links
                        const feedSelectors = [
                            'link[type="application/rss+xml"]',
                            'link[type="application/atom+xml"]',
                            'link[rel="alternate"][type*="rss"]',
                            'link[rel="alternate"][type*="atom"]'
                        ];
                        
                        for (const selector of feedSelectors) {
                            const link = htmlDoc.querySelector(selector);
                            if (link) {
                                let feedUrl = link.getAttribute('href');
                                
                                // Convert relative URLs to absolute
                                if (feedUrl.startsWith('/')) {
                                    const baseUrl = new URL(websiteUrl);
                                    feedUrl = baseUrl.origin + feedUrl;
                                } else if (!feedUrl.startsWith('http')) {
                                    feedUrl = new URL(feedUrl, websiteUrl).href;
                                }
                                
                                console.log(`✅ Found RSS feed: ${feedUrl}`);
                                return feedUrl;
                            }
                        }
                        
                        console.log(`⚠️ No RSS feed found on ${websiteUrl} (proxy ${i + 1})`);
                        break; // No need to try other proxies if we got content but no feed
                    }
                } catch (proxyError) {
                    console.warn(`⚠️ Proxy ${i + 1} failed for discovery:`, proxyError.message);
                    continue; // Try next proxy
                }
            }
            
            console.log(`❌ No RSS feed found on ${websiteUrl}`);
            return null;
            
        } catch (error) {
            console.error('❌ Error discovering RSS feed:', error);
            return null;
        }
    }
}

// Initialize RSS parser
const rssParser = new RSSFeedParser();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RSSFeedParser, rssParser };
}
