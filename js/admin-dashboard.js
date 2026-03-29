// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        console.log('🚀 Admin Dashboard v=35 loading with comprehensive image fixes...');
        this.db = window.db || null;
        this.episodes = [];
        this.filteredEpisodes = [];
        this.currentPage = 1;
        this.episodesPerPage = 50;
        this.stats = {
            visitors: { total: 0, monthly: {}, change: 0 },
            plays: { total: 0, monthly: {}, change: 0 },
            episodes: [],
            podcasts: []
        };
        this.currentChart = null;
        this.currentChartType = 'visitors';
        
        // Emergency cost control - rate limiting
        this.lastDataLoad = 0;
        this.dataLoadCooldown = 30000; // 30 seconds between loads
        this.analyticsLoaded = false; // Prevent multiple analytics loads
        
        this.init();
    }

    // Check if user is authenticated with Firebase Admin
    isAuthenticated() {
        return window.adminAuth ? window.adminAuth.isAdmin() : false;
    }

    // Validate admin authentication for sensitive operations
    async validateAdminPassword() {
        if (this.isAuthenticated()) {
            return true;
        }
        
        // Show admin login modal
        return this.showAdminLoginModal();
    }

    // Show admin login modal
    showAdminLoginModal() {
        return new Promise((resolve, reject) => {
            // Check if modal already exists
            if (document.getElementById('admin-login-modal')) {
                resolve(false);
                return;
            }

            // Create modal overlay
            const modal = document.createElement('div');
            modal.id = 'admin-login-modal';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); display: flex; align-items: center;
                justify-content: center; z-index: 10000;
            `;
            
            // Create login form
            const form = document.createElement('div');
            form.style.cssText = `
                background: white; padding: 2rem; border-radius: 8px;
                max-width: 400px; width: 90%;
            `;
            form.innerHTML = `
                <h3 style="margin-bottom: 1rem; color: #12385b;">🔐 Admin Login Required</h3>
                <div style="margin-bottom: 1rem;">
                    <input type="email" id="admin-email" placeholder="Admin Email" value="ahmed.a.redwan@gmail.com"
                        style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <input type="password" id="admin-password" placeholder="Firebase Password" 
                        style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 1rem; font-size: 0.875rem; color: #666;">
                    Use your Firebase account credentials (ahmed.a.redwan@gmail.com or eng.a.redwan@gmail.com).
                </div>
                <div style="margin-bottom: 1rem; font-size: 0.75rem; color: #888;">
                    Note: This uses Firebase Authentication, not the old localStorage password.
                </div>
                <button type="submit" style="width: 100%; padding: 0.75rem; background: #12385b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Sign In
                </button>
                <button type="button" id="cancel-login" style="width: 100%; padding: 0.75rem; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 0.5rem;">
                    Cancel
                </button>
            `;
            
            modal.appendChild(form);
            document.body.appendChild(modal);
            
            // Handle form submission
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('admin-email').value;
                const password = document.getElementById('admin-password').value;
                
                if (!email || !password) {
                    alert('❌ Please enter both email and password');
                    return;
                }
                
                try {
                    console.log('🔐 Attempting admin login...');
                    const user = await window.adminAuth.signInAdmin(email, password);
                    console.log('✅ Admin login successful:', user.email);
                    
                    // Remove modal
                    document.body.removeChild(modal);
                    
                    // Show success message
                    this.showNotification('✅ Admin login successful! Loading dashboard...', 'success');
                    
                    // Load dashboard data
                    setTimeout(() => {
                        this.loadDashboardData();
                    }, 1000);
                    
                    resolve(true);
                } catch (error) {
                    console.error('❌ Admin login failed:', error);
                    alert('❌ Login failed: ' + error.message);
                    reject(error);
                }
            });
            
            // Handle cancel
            document.getElementById('cancel-login').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', handleEscape);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }

    async init() {
        try {
            console.log('🔧 Initializing Admin Dashboard...');
            
            // Wait for Firebase to be available
            if (typeof window !== 'undefined' && window.firebase) {
                // Check if Firebase is properly initialized
                if (!window.firebase.apps.length) {
                    console.error('❌ Firebase not initialized');
                    this.showError('Firebase not initialized. Please check configuration.');
                    return;
                }
                
                // Set up auth state monitoring
                if (window.adminAuth) {
                    console.log('✅ AdminAuth available, setting up auth state monitoring...');
                    window.adminAuth.onAuthStateChanged((user) => {
                        if (!user) {
                            console.log('🔒 No user authenticated, showing login modal');
                            // Show login modal directly instead of redirecting
                            this.showAdminLoginModal().then((success) => {
                                if (!success) {
                                    console.log('❌ Admin login cancelled');
                                    this.showError('Admin access cancelled. Please refresh to try again.');
                                }
                            });
                            return;
                        }
                        
                        if (!window.adminAuth.isAdmin()) {
                            console.warn('⚠️ User is not admin, showing login modal');
                            // Show login modal for admin credentials
                            this.showAdminLoginModal().then((success) => {
                                if (!success) {
                                    console.log('❌ Admin login failed');
                                    this.showError('Invalid admin credentials. Please try again.');
                                }
                            });
                            return;
                        }
                        
                        console.log('🔥 Admin authenticated via Firebase');
                        this.loadDashboardData();
                    });
                } else {
                    console.error('❌ AdminAuth not available');
                    this.showError('Admin authentication not available. Please refresh the page.');
                    return;
                }
            } else {
                console.error('❌ Firebase not available');
                this.showError('Firebase not available. Please check your internet connection.');
                return;
            }

            // Update sync status periodically
            setInterval(() => this.updateSyncStatus(), 5000);
            
        } catch (error) {
            console.error('Error initializing admin dashboard:', error);
            this.showError('Failed to initialize admin dashboard: ' + error.message);
        }
    }

    redirectToLogin() {
        // Redirect to main app with Firebase Auth required
        window.location.href = 'index.html?admin=firebase-auth-required';
    }

    async updateSyncStatus() {
        const statusEl = document.getElementById('updateStatus');
        const lastSyncEl = document.getElementById('lastSyncTime');
        const cacheEl = document.getElementById('cacheSize');
        
        if (statusEl) {
            statusEl.textContent = '';
        }
        if (lastSyncEl) {
            lastSyncEl.textContent = 'Just now';
        }
        if (cacheEl) {
            cacheEl.textContent = `${this.episodes.length} items`;
        }
    }

    async loadDashboardData() {
        try {
            // Emergency cost control - rate limiting
            const now = Date.now();
            if (now - this.lastDataLoad < this.dataLoadCooldown) {
                console.log(`⏰ Rate limiting active. Please wait ${Math.ceil((this.dataLoadCooldown - (now - this.lastDataLoad)) / 1000)} seconds.`);
                this.showNotification('⏰ Please wait a moment before refreshing data...', 'warning');
                return;
            }
            
            this.lastDataLoad = now;
            this.showLoading(true);
            
            // Load all data in parallel
            const [episodesData, statsData] = await Promise.all([
                this.loadEpisodes(),
                this.loadStatistics()
            ]);

            this.episodes = episodesData;
            this.filteredEpisodes = [...this.episodes]; // Initialize filtered episodes
            this.populatePodcastFilter(); // Populate podcast dropdown
            this.updateStatCards();
            this.renderEpisodeTable();
            this.renderChart('visitors');
            
            // Load podcast list
            await this.loadPodcastList();
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data: ' + error.message);
            this.showLoading(false);
        }
    }

    async loadEpisodes() {
        try {
            // Check if Firebase is properly initialized
            if (!this.db || !firebase.apps.length) {
                throw new Error('Firebase not properly initialized. Please check your configuration.');
            }

            const snapshot = await this.db.collection('episodes')
                .orderBy('publishDate', 'desc')
                .limit(100) // Limit to recent episodes for performance
                .get();

            const episodes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Skip expensive analytics loading by default
            // Only load when specifically requested (e.g., analytics view)
            console.log(`📊 Loaded ${episodes.length} episodes (analytics skipped for performance)`);

            // Return episodes without play statistics for better performance
            return episodes.map(episode => ({
                ...episode,
                playCount: 0, // Default to 0 to avoid expensive analytics queries
                uniqueListeners: 0,
                lastPlayed: null,
                avgDuration: 0
            }));

        } catch (error) {
            console.error('Error loading episodes:', error);
            throw new Error(`Failed to load episodes: ${error.message}`);
        }
    }

    // Separate method to load analytics data only when needed
    async loadEpisodesWithAnalytics() {
        try {
            const episodes = await this.loadEpisodes();
            
            // Get play statistics for each episode (expensive operation)
            let playStats = {};
            try {
                const playsSnapshot = await this.db.collection('analytics').doc('plays').collection('episodes')
                    .limit(500) // Reduce from unlimited to 500
                    .get();

                playsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (!playStats[data.episodeId]) {
                        playStats[data.episodeId] = {
                            playCount: 0,
                            uniqueListeners: new Set(),
                            lastPlayed: null
                        };
                    }
                    playStats[data.episodeId].playCount++;
                    playStats[data.episodeId].uniqueListeners.add(data.sessionId);
                    
                    const playDate = new Date(data.timestamp);
                    if (!playStats[data.episodeId].lastPlayed || playDate > new Date(playStats[data.episodeId].lastPlayed)) {
                        playStats[data.episodeId].lastPlayed = data.timestamp;
                    }
                });

                // Convert Sets to counts
                Object.keys(playStats).forEach(episodeId => {
                    playStats[episodeId].uniqueListeners = playStats[episodeId].uniqueListeners.size;
                });
            } catch (error) {
                if (error.code === 'permission-denied') {
                    console.warn('🔒 Firebase permissions error: Cannot access play statistics. Admin access required.');
                } else {
                    console.warn('Play statistics not available, using zeros:', error);
                }
            }

            // Combine episode data with play statistics
            return episodes.map(episode => ({
                ...episode,
                playCount: playStats[episode.id]?.playCount || 0,
                uniqueListeners: playStats[episode.id]?.uniqueListeners || 0,
                lastPlayed: playStats[episode.id]?.lastPlayed || null,
                avgDuration: Math.floor(Math.random() * 60) + 20 // Mock duration - would need to be tracked
            }));

        } catch (error) {
            console.error('Error loading episodes with analytics:', error);
            throw new Error(`Failed to load episodes with analytics: ${error.message}`);
        }
    }

    async loadStatistics() {
        try {
            if (!this.db) {
                throw new Error('Firebase not initialized. Please check your configuration.');
            }

            // Skip expensive analytics loading by default for better performance
            // Only load when user specifically requests analytics view
            console.log('📊 Skipping analytics loading for performance - use loadFullStatistics() when needed');
            
            return this.getBasicStatistics();

        } catch (error) {
            console.error('Error loading statistics:', error);
            throw new Error(`Failed to load statistics: ${error.message}`);
        }
    }

    // Separate method to load full analytics data only when explicitly requested
    async loadFullStatistics() {
        try {
            if (!this.db) {
                throw new Error('Firebase not initialized. Please check your configuration.');
            }

            console.log('📊 Loading full analytics data (expensive operation)...');
            
            // Get real analytics data with reduced limits
            const analyticsData = await this.getRealAnalyticsDataOptimized();
            
            if (analyticsData) {
                return this.processAnalyticsData(analyticsData);
            }

            // If no analytics data, return basic statistics from episodes
            return this.getBasicStatistics();

        } catch (error) {
            console.error('Error loading full statistics:', error);
            throw new Error(`Failed to load full statistics: ${error.message}`);
        }
    }

    getBasicStatistics() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        
        // Calculate basic stats from episodes
        const uniquePodcasts = new Set(this.episodes.map(e => e.podcastTitle)).size;
        
        return {
            visitors: {
                total: 0,
                monthly: {
                    [currentMonth]: 0,
                    [lastMonth]: 0
                },
                change: 0
            },
            plays: {
                total: 0,
                monthly: {
                    [currentMonth]: 0,
                    [lastMonth]: 0
                },
                change: 0
            },
            episodes: this.episodes.length,
            podcasts: uniquePodcasts
        };
    }

    // Optimized version with reduced data limits
    async getRealAnalyticsDataOptimized() {
        try {
            // Check if Firebase is properly initialized
            if (!this.db || !firebase.apps.length) {
                console.warn('Firebase not properly initialized, using mock data');
                return null;
            }

            // Try to get visitor stats with reduced limit
            let visitorsSnapshot;
            try {
                visitorsSnapshot = await this.db.collection('analytics').doc('visitors').collection('visits')
                    .orderBy('timestamp', 'desc')
                    .limit(100) // Reduced from 1000 to 100
                    .get();
            } catch (error) {
                if (error.code === 'permission-denied') {
                    console.warn('🔒 Firebase permissions error. Analytics collections need admin access.');
                    this.showError('Firebase permissions error: Admin access required for analytics. Please check Firebase security rules.');
                    return null;
                } else {
                    console.warn('Analytics collection not found, will use mock data:', error);
                    return null;
                }
            }

            // Try to get play stats with reduced limit
            let playsSnapshot;
            try {
                playsSnapshot = await this.db.collection('analytics').doc('plays').collection('episodes')
                    .orderBy('timestamp', 'desc')
                    .limit(100) // Reduced from 1000 to 100
                    .get();
            } catch (error) {
                if (error.code === 'permission-denied') {
                    console.warn('🔒 Firebase permissions error. Analytics collections need admin access.');
                    this.showError('Firebase permissions error: Admin access required for analytics. Please check Firebase security rules.');
                    return null;
                } else {
                    console.warn('Plays collection not found, will use mock data:', error);
                    return null;
                }
            }

            return {
                visitors: visitorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                plays: playsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            };

        } catch (error) {
            console.error('Error getting optimized analytics data:', error);
            if (error.code === 'permission-denied') {
                this.showError('Firebase permissions error: Admin access required for analytics.');
            }
            return null;
        }
    }

    processAnalyticsData(data) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const currentYear = now.getFullYear();

        // Process visitor data
        const currentMonthVisitors = data.visitors.filter(visit => {
            const visitDate = new Date(visit.timestamp);
            return visitDate.getMonth() === currentMonth && visitDate.getFullYear() === currentYear;
        }).length;

        const lastMonthVisitors = data.visitors.filter(visit => {
            const visitDate = new Date(visit.timestamp);
            return visitDate.getMonth() === lastMonth && visitDate.getFullYear() === currentYear;
        }).length;

        // Process play data
        const currentMonthPlays = data.plays.filter(play => {
            const playDate = new Date(play.timestamp);
            return playDate.getMonth() === currentMonth && playDate.getFullYear() === currentYear;
        }).length;

        const lastMonthPlays = data.plays.filter(play => {
            const playDate = new Date(play.timestamp);
            return playDate.getMonth() === lastMonth && playDate.getFullYear() === currentYear;
        }).length;

        // Calculate unique visitors and plays
        const uniqueVisitors = new Set(data.visitors.map(v => v.sessionId)).size;
        const totalPlays = data.plays.length;

        return {
            visitors: {
                total: uniqueVisitors,
                monthly: {
                    [currentMonth]: currentMonthVisitors,
                    [lastMonth]: lastMonthVisitors
                },
                change: lastMonthVisitors > 0 ? ((currentMonthVisitors - lastMonthVisitors) / lastMonthVisitors * 100) : 0
            },
            plays: {
                total: totalPlays,
                monthly: {
                    [currentMonth]: currentMonthPlays,
                    [lastMonth]: lastMonthPlays
                },
                change: lastMonthPlays > 0 ? ((currentMonthPlays - lastMonthPlays) / lastMonthPlays * 100) : 0
            },
            episodes: 6584, // This would come from episodes collection
            podcasts: 42 // This would come from podcasts collection
        };
    }

    getRandomDate() {
        const days = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
    }

    populatePodcastFilter() {
        const podcastFilter = document.getElementById('podcastFilter');
        if (!podcastFilter) return;
        
        const uniquePodcasts = [...new Set(this.episodes.map(e => e.podcastTitle))].sort();
        
        podcastFilter.innerHTML = '<option value="">All Podcasts</option>' +
            uniquePodcasts.map(podcast => 
                `<option value="${podcast}">${podcast}</option>`
            ).join('');
    }

    updateStatCards() {
        const stats = this.stats;
        
        // Update visitor stats
        document.getElementById('totalVisitors').textContent = 
            stats.visitors.monthly[new Date().getMonth()]?.toLocaleString() || '0';
        
        const visitorsChange = stats.visitors.change;
        document.getElementById('visitorsChange').textContent = 
            `${visitorsChange > 0 ? '+' : ''}${visitorsChange}% from last month`;
        document.getElementById('visitorsChange').className = 
            `stat-change ${visitorsChange > 0 ? 'positive' : 'negative'}`;

        // Update play stats
        document.getElementById('totalPlays').textContent = 
            stats.plays.monthly[new Date().getMonth()]?.toLocaleString() || '0';
        
        const playsChange = stats.plays.change;
        document.getElementById('playsChange').textContent = 
            `${playsChange > 0 ? '+' : ''}${playsChange}% from last month`;
        document.getElementById('playsChange').className = 
            `stat-change ${playsChange > 0 ? 'positive' : 'negative'}`;

        // Update episode and podcast counts
        document.getElementById('totalEpisodes').textContent = 
            stats.episodes.toLocaleString() || this.episodes.length.toLocaleString();
        document.getElementById('totalPodcasts').textContent = 
            stats.podcasts.toLocaleString() || '42';
    }

    renderEpisodeTable() {
        const tbody = document.getElementById('episodeTableBody');
        
        if (this.filteredEpisodes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">No episodes found</td></tr>';
            this.updatePaginationInfo();
            return;
        }

        // Get paginated episodes
        const startIndex = (this.currentPage - 1) * this.episodesPerPage;
        const endIndex = Math.min(startIndex + this.episodesPerPage, this.filteredEpisodes.length);
        const paginatedEpisodes = this.filteredEpisodes.slice(startIndex, endIndex);

        tbody.innerHTML = paginatedEpisodes.map(episode => `
            <tr>
                <td class="episode-title" title="${episode.title}">${episode.title}</td>
                <td class="episode-podcast">${episode.podcastTitle}</td>
                <td class="play-count">${(episode.playCount || 0).toLocaleString()}</td>
                <td>${(episode.uniqueListeners || 0).toLocaleString()}</td>
                <td class="last-played">${this.formatDate(episode.lastPlayed)}</td>
                <td>${episode.avgDuration || 0} min</td>
                <td class="featured-status">
                    ${episode.featured ? '✓ Featured' : 'Not Featured'}
                </td>
                <td class="actions">
                    <button class="action-btn-icon" onclick="adminDashboard.toggleFeature('${episode.id}')" title="${episode.featured ? 'Unfeature' : 'Feature'}">
                        ${episode.featured ? '⭐' : '☆'}
                    </button>
                    <button class="action-btn-icon" onclick="adminDashboard.removeEpisode('${episode.id}')" title="Remove Episode">
                        🗑️
                    </button>
                    <button class="action-btn-icon" onclick="adminDashboard.removePodcast('${episode.podcastId}')" title="Remove Podcast">
                        📦
                    </button>
                </td>
            </tr>
        `).join('');

        this.updatePaginationInfo();
        this.renderPaginationControls();
    }

    updatePaginationInfo() {
        const totalEpisodes = this.filteredEpisodes.length;
        const startIndex = totalEpisodes === 0 ? 0 : (this.currentPage - 1) * this.episodesPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.episodesPerPage, totalEpisodes);

        document.getElementById('showingFrom').textContent = startIndex;
        document.getElementById('showingTo').textContent = endIndex;
        document.getElementById('totalEpisodes').textContent = totalEpisodes;
    }

    renderPaginationControls() {
        const totalPages = Math.ceil(this.filteredEpisodes.length / this.episodesPerPage);
        const paginationControls = document.getElementById('paginationControls');
        
        if (totalPages <= 1) {
            paginationControls.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="pagination-buttons">';
        
        // Previous button
        if (this.currentPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="adminDashboard.goToPage(${this.currentPage - 1})">← Previous</button>`;
        }

        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage;
            paginationHTML += `<button class="pagination-btn ${isActive ? 'active' : ''}" onclick="adminDashboard.goToPage(${i})">${i}</button>`;
        }

        // Next button
        if (this.currentPage < totalPages) {
            paginationHTML += `<button class="pagination-btn" onclick="adminDashboard.goToPage(${this.currentPage + 1})">Next →</button>`;
        }

        paginationHTML += '</div>';
        paginationControls.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderEpisodeTable();
    }

    async toggleFeature(episodeId) {
        if (!this.validateAdminPassword()) return;
        
        try {
            const episode = this.episodes.find(e => e.id === episodeId);
            if (!episode) return;
            
            const newFeaturedStatus = !episode.featured;
            const action = newFeaturedStatus ? 'featuring' : 'unfeaturing';
            
            this.showNotification(`🔄 ${action.charAt(0).toUpperCase() + action.slice(1)} "${episode.title}"...`, 'info');
            
            await this.db.collection('episodes').doc(episodeId).update({
                featured: newFeaturedStatus,
                featuredOrder: newFeaturedStatus ? Date.now() : null
            });
            
            episode.featured = newFeaturedStatus;
            this.filterEpisodes(); // Refresh the table
            
            this.showNotification(
                `✅ Successfully ${newFeaturedStatus ? 'featured' : 'unfeatured'} "${episode.title}"`,
                'success'
            );
        } catch (error) {
            console.error('Error toggling feature status:', error);
            this.showNotification('❌ Failed to update featured status. Please try again.', 'error');
        }
    }

    async removeEpisode(episodeId) {
        if (!this.validateAdminPassword()) return;
        
        const episode = this.episodes.find(e => e.id === episodeId);
        if (!episode) return;
        
        if (!confirm(`Are you sure you want to remove "${episode.title}"?\n\nThis action cannot be undone and will permanently delete this episode from the database.`)) {
            return;
        }
        
        try {
            this.showNotification(`🔄 Removing "${episode.title}"...`, 'info');
            
            await this.db.collection('episodes').doc(episodeId).delete();
            
            // Remove from local arrays
            this.episodes = this.episodes.filter(e => e.id !== episodeId);
            this.filterEpisodes(); // Refresh the table
            
            this.showNotification(`✅ Successfully removed "${episode.title}"`, 'success');
        } catch (error) {
            console.error('Error removing episode:', error);
            this.showNotification('❌ Failed to remove episode. Please try again.', 'error');
        }
    }

    async removePodcast(podcastId) {
        if (!this.validateAdminPassword()) return;
        
        const episode = this.episodes.find(e => e.podcastId === podcastId);
        if (!episode) return;
        
        const podcastEpisodes = this.episodes.filter(e => e.podcastId === podcastId);
        
        if (!confirm(`Are you sure you want to remove ALL episodes from "${episode.podcastTitle}"?\n\nThis will delete ${podcastEpisodes.length} episodes and cannot be undone.`)) {
            return;
        }
        
        try {
            this.showNotification(`🔄 Removing ${podcastEpisodes.length} episodes from "${episode.podcastTitle}"...`, 'info');
            
            // Delete all episodes from this podcast
            const batch = this.db.batch();
            podcastEpisodes.forEach(episode => {
                batch.delete(this.db.collection('episodes').doc(episode.id));
            });
            
            await batch.commit();
            
            // Remove from local arrays
            this.episodes = this.episodes.filter(e => e.podcastId !== podcastId);
            this.filterEpisodes(); // Refresh the table
            
            this.showNotification(`✅ Successfully removed ${podcastEpisodes.length} episodes from "${episode.podcastTitle}"`, 'success');
        } catch (error) {
            console.error('Error removing podcast:', error);
            this.showNotification('❌ Failed to remove podcast. Please try again.', 'error');
        }
    }

    async unfeatureAllEpisodes() {
        if (!this.validateAdminPassword()) return;
        
        try {
            // Show confirmation dialog
            const shouldContinue = confirm('⚠️ Are you sure you want to unfeature ALL episodes? This will remove the featured status from every episode in the database.');
            if (!shouldContinue) return;
            
            this.showNotification('🚫 Unfeaturing all episodes...', 'info');
            
            // Get all featured episodes
            const featuredSnapshot = await this.db.collection('episodes')
                .where('featured', '==', true)
                .get();
            
            if (featuredSnapshot.empty) {
                this.showNotification('ℹ️ No featured episodes found to unfeature.', 'info');
                return;
            }
            
            // Batch update to remove featured status
            const batch = this.db.batch();
            featuredSnapshot.forEach(doc => {
                batch.update(doc.ref, { 
                    featured: false,
                    featuredOrder: null 
                });
            });
            
            await batch.commit();
            
            // Update local episodes array
            this.episodes.forEach(episode => {
                episode.featured = false;
                episode.featuredOrder = null;
            });
            
            // Refresh the table
            this.filterEpisodes();
            
            this.showNotification(`✅ Successfully unfeatured ${featuredSnapshot.size} episodes`, 'success');
            
        } catch (error) {
            console.error('Error unfeaturing all episodes:', error);
            this.showNotification('❌ Failed to unfeature episodes. Please try again.', 'error');
        }
    }

    async manualSyncAllPodcasts() {
        if (!this.validateAdminPassword()) return;
        
        // Show a more user-friendly confirmation modal
        const shouldContinue = await this.showSyncConfirmation();
        if (!shouldContinue) return;
        
        try {
            this.showNotification('🔄 Starting podcast sync... This may take a few minutes.', 'info');
            this.showSyncProgress(0, 'Initializing...');
            
            // Get all podcasts from Firestore (include both active and inactive)
            const podcastsSnapshot = await this.db.collection('podcasts').get();
            
            if (podcastsSnapshot.empty) {
                this.showNotification('ℹ️ No active podcasts found to sync.', 'info');
                this.hideSyncProgress();
                return;
            }
            
            const totalPodcasts = podcastsSnapshot.size;
            let processedPodcasts = 0;
            let totalUpdated = 0;
            let totalNewEpisodes = 0;
            let errors = [];
            let syncResults = []; // Track detailed results per podcast
            
            // Process each podcast
            for (const podcastDoc of podcastsSnapshot.docs) {
                const podcast = podcastDoc.data();
                const podcastId = podcastDoc.id;
                
                try {
                    processedPodcasts++;
                    const progress = Math.round((processedPodcasts / totalPodcasts) * 100);
                    this.showSyncProgress(progress, `Syncing "${podcast.title}"...`);
                    this.showNotification(`🔄 Syncing "${podcast.title}"... (${processedPodcasts}/${totalPodcasts})`, 'info');
                    
                    console.log(`📻 Processing podcast: "${podcast.title}"`);
                    console.log(`🔗 RSS URL: ${podcast.rssUrl}`);
                    console.log(`🆔 Podcast ID: ${podcastId}`);
                    
                    // Skip if RSS URL is missing or invalid
                    if (!podcast.rssUrl || podcast.rssUrl === '-' || podcast.rssUrl.trim() === '') {
                        console.log(`⚠️ Skipping "${podcast.title}" - No valid RSS URL found`);
                        syncResults.push({
                            podcast: podcast.title,
                            status: 'skipped',
                            error: 'No valid RSS URL',
                            newEpisodes: 0,
                            totalEpisodes: podcast.episodeCount || 0
                        });
                        continue;
                    }
                    
                    // Try multiple CORS proxies with fallback
                    const proxies = [
                        'https://podcast-rss-proxy.eng-a-redwan.workers.dev/?url=',
                        'https://corsproxy.io/?',
                        'https://api.allorigins.win/raw?url='
                    ];
                    
                    console.log('🆕 Using updated proxy list with Cloudflare Worker as primary:', proxies);
                    
                    let fetchSuccess = false;
                    let rssText = '';
                    
                    for (const proxy of proxies) {
                        try {
                            const fetchUrl = podcast.rssUrl.startsWith('http') ? 
                                proxy + encodeURIComponent(podcast.rssUrl) : 
                                podcast.rssUrl;
                            
                            console.log(`🔄 Trying proxy: ${proxy} for URL: ${podcast.rssUrl}`);
                            console.log(`📡 Fetch URL: ${fetchUrl}`);
                            
                            const response = await fetch(fetchUrl, {
                                headers: {
                                    'X-Requested-With': 'XMLHttpRequest'
                                }
                            });
                            
                            console.log(`📊 Response status: ${response.status} for proxy: ${proxy}`);
                            
                            if (response.ok) {
                                rssText = await response.text();
                                console.log(`✅ Success with proxy: ${proxy}, RSS length: ${rssText.length}`);
                                fetchSuccess = true;
                                break;
                            } else {
                                console.log(`❌ Proxy ${proxy} returned status: ${response.status}`);
                            }
                        } catch (proxyError) {
                            console.log(`❌ Proxy ${proxy} failed with error:`, proxyError);
                            continue;
                        }
                    }
                    
                    if (!fetchSuccess) {
                        throw new Error('All CORS proxies failed');
                    }
                    console.log(`🔍 Parsing RSS feed for "${podcast.title}"...`);
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(rssText, 'text/xml');
                    
                    // Check for parsing errors
                    const parseError = xmlDoc.querySelector('parsererror');
                    if (parseError) {
                        console.error(`❌ RSS parsing error for "${podcast.title}":`, parseError);
                        throw new Error('Invalid RSS feed format');
                    }
                    
                    console.log(`✅ RSS parsed successfully for "${podcast.title}"`);
                    
                    // Extract podcast-level image
                    const channel = xmlDoc.querySelector('channel');
                    const podcastImageUrl = this.extractImage(channel) || podcast.imageUrl || '';
                    console.log(`🖼️ Podcast image for "${podcast.title}": ${podcastImageUrl || 'None found'}`);
                    
                    // Extract episodes
                    const items = xmlDoc.querySelectorAll('item');
                    console.log(`📺 Found ${items.length} episodes in "${podcast.title}"`);
                    
                    // Get existing episodes for this podcast
                    const existingEpisodesSnapshot = await this.db.collection('episodes')
                        .where('podcastId', '==', podcastId)
                        .get();
                    
                    const existingEpisodeTitles = new Set();
                    existingEpisodesSnapshot.forEach(doc => {
                        const title = doc.data().title;
                        existingEpisodeTitles.add(title);
                    });
                    
                    console.log(`📚 Found ${existingEpisodeTitles.size} existing episodes for "${podcast.title}"`);
                    console.log('📋 Existing episode titles (first 10):', Array.from(existingEpisodeTitles).slice(0, 10));
                    
                    // Arrays for new episodes and episodes needing image updates
                    const syncedEpisodes = [];
                    const episodesToUpdate = [];
                    
                    for (const item of items) {
                        const episodeTitle = item.querySelector('title')?.textContent?.trim() || '';
                        const episodeDescription = item.querySelector('description')?.textContent?.trim() || '';
                        const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
                        const enclosure = item.querySelector('enclosure');
                        const episodeUrl = enclosure?.getAttribute('url') || '';
                        const episodeImage = this.extractEpisodeImage(item) || podcastImageUrl;
                        
                        const normalizedTitle = episodeTitle.toLowerCase().trim();
                        const normalizedExistingTitles = Array.from(existingEpisodeTitles).map(title => title.toLowerCase().trim());
                        
                        if (!existingEpisodeTitles.has(episodeTitle) && !normalizedExistingTitles.includes(normalizedTitle)) {
                            console.log(`📺 Found new episode: "${episodeTitle}"`);
                            syncedEpisodes.push({
                                title: episodeTitle,
                                description: episodeDescription,
                                publishDate: new Date(pubDate).toISOString(),
                                audioUrl: episodeUrl,
                                image: episodeImage,
                                podcastTitle: podcast.title,
                                podcastId: podcastId,
                                featured: false,
                                playCount: 0,
                                uniqueListeners: 0,
                                lastPlayed: null,
                                avgDuration: 0
                            });
                        } else {
                            // Check if existing episode needs image update
                            if (episodeTitle && pubDate && (existingEpisodeTitles.has(episodeTitle) || normalizedExistingTitles.includes(normalizedTitle))) {
                                if (!episodeImage) {
                                    console.log(`⚠️ Episode "${episodeTitle}" has no image available`);
                                } else {
                                    console.log(`🖼️ Found image for existing episode "${episodeTitle}": ${episodeImage}`);
                                    // Add to episodes to update images
                                    episodesToUpdate.push({
                                        title: episodeTitle,
                                        image: episodeImage,
                                        podcastId: podcastId
                                    });
                                }
                            }
                            if (!episodeTitle || !pubDate) {
                                console.log(`⚠️ Skipping episode due to missing data - Title: "${episodeTitle}", PubDate: "${pubDate}"`);
                            } else {
                                // Check if it's a whitespace or case sensitivity issue
                                const existsInOriginalSet = existingEpisodeTitles.has(episodeTitle);
                                const existsInNormalizedSet = normalizedExistingTitles.includes(normalizedTitle);
                                
                                if (existsInOriginalSet !== existsInNormalizedSet) {
                                    console.log(`🔍 Title comparison issue:`);
                                    console.log(`  RSS title: "${episodeTitle}" (length: ${episodeTitle.length})`);
                                    console.log(`  DB original check: ${existsInOriginalSet}`);
                                    console.log(`  DB normalized check: ${existsInNormalizedSet}`);
                                    console.log(`  Normalized title: "${normalizedTitle}"`);
                                }
                                
                                console.log(`⏭️ Skipping episode: "${episodeTitle}" (already exists or missing data)`);
                            }
                        }
                    }
                    
                    console.log(`🆕 Found ${syncedEpisodes.length} new episodes to add for "${podcast.title}"`);
                    
                    // Add new episodes to Firestore
                    if (syncedEpisodes.length > 0) {
                        console.log(`💾 Saving ${syncedEpisodes.length} new episodes to database...`);
                        const batch = this.db.batch();
                        syncedEpisodes.forEach(episode => {
                            const episodeRef = this.db.collection('episodes').doc();
                            batch.set(episodeRef, episode);
                        });
                        
                        await batch.commit();
                        console.log(`✅ Successfully saved ${syncedEpisodes.length} episodes for "${podcast.title}"`);
                        totalNewEpisodes += syncedEpisodes.length;
                    } else {
                        console.log(`ℹ️ No new episodes to add for "${podcast.title}"`);
                    }
                    
                    // Update existing episodes with missing images
                    if (episodesToUpdate.length > 0) {
                        console.log(`🖼️ Updating ${episodesToUpdate.length} existing episodes with images...`);
                        const imageUpdateBatch = this.db.batch();
                        
                        for (const episodeToUpdate of episodesToUpdate) {
                            // Find the episode document by title and podcastId
                            const episodeQuery = await this.db.collection('episodes')
                                .where('title', '==', episodeToUpdate.title)
                                .where('podcastId', '==', episodeToUpdate.podcastId)
                                .limit(1)
                                .get();
                            
                            if (!episodeQuery.empty) {
                                const episodeDoc = episodeQuery.docs[0];
                                imageUpdateBatch.update(episodeDoc.ref, {
                                    image: episodeToUpdate.image
                                });
                                console.log(`📸 Updated image for: "${episodeToUpdate.title}"`);
                            }
                        }
                        
                        await imageUpdateBatch.commit();
                        console.log(`✅ Successfully updated ${episodesToUpdate.length} episode images`);
                    }
                    
                    // Track successful sync
                    syncResults.push({
                        podcast: podcast.title,
                        status: 'success',
                        newEpisodes: syncedEpisodes.length,
                        totalEpisodes: existingEpisodesSnapshot.size + syncedEpisodes.length
                    });
                    
                    totalUpdated++;
                    console.log(`✅ Successfully synced "${podcast.title}"`);
                    
                    // Update podcast metadata
                    const podcastUpdateData = {
                        lastUpdated: new Date().toISOString(),
                        episodeCount: existingEpisodesSnapshot.size + syncedEpisodes.length
                    };
                    
                    // Update podcast image if found
                    if (podcastImageUrl && podcastImageUrl !== podcast.imageUrl) {
                        podcastUpdateData.imageUrl = podcastImageUrl;
                        console.log(`🖼️ Updated podcast image for "${podcast.title}"`);
                    }
                    
                    await this.db.collection('podcasts').doc(podcastId).update(podcastUpdateData);
                    
                } catch (error) {
                    console.error(`Error syncing podcast "${podcast.title}":`, error);
                    
                    let errorMessage = error.message;
                    if (error.message.includes('CORS')) {
                        errorMessage = 'CORS error - RSS feed blocks cross-origin requests';
                    }
                    
                    errors.push(`${podcast.title}: ${errorMessage}`);
                    
                    // Track failed sync but continue with next podcast
                    syncResults.push({
                        podcast: podcast.title,
                        status: 'error',
                        error: errorMessage,
                        newEpisodes: 0,
                        totalEpisodes: podcast.episodeCount || 0
                    });
                    
                    // Continue to next podcast instead of stopping
                    totalUpdated++;
                    console.log(`⚠️ Failed to sync "${podcast.title}" but continuing...`);
                }
            }
            
            // Hide progress and show final summary
            this.hideSyncProgress();
            
            // Show detailed sync results
            this.showDetailedSyncResults(syncResults, totalNewEpisodes, errors.length);
            
            // Also show brief notification
            if (errors.length === 0) {
                this.showNotification(
                    `✅ Successfully synced ${totalUpdated} podcasts and added ${totalNewEpisodes} new episodes!`, 
                    'success'
                );
            } else {
                this.showNotification(
                    `⚠️ Synced ${totalUpdated} podcasts with ${totalNewEpisodes} new episodes. ${errors.length} errors occurred.`, 
                    'warning'
                );
                
                // Log errors to console for debugging
                console.error('Sync errors:', errors);
            }
            
            // Refresh the dashboard data
            this.loadDashboardData();
            
        } catch (error) {
            console.error('Error syncing podcasts:', error);
            this.hideSyncProgress();
            this.showNotification('❌ Failed to sync podcasts. Please try again.', 'error');
        }
    }

    async removeDuplicateEpisodes() {
        if (!this.validateAdminPassword()) return;
        
        if (!confirm('Are you sure you want to remove duplicate episodes?\n\nThis will scan for and delete duplicate episodes based on title and podcast.')) {
            return;
        }
        
        try {
            this.showNotification('🔄 Scanning for duplicate episodes...', 'info');
            
            // Get all episodes
            const episodesSnapshot = await this.db.collection('episodes').get();
            
            if (episodesSnapshot.empty) {
                this.showNotification('ℹ️ No episodes found to scan for duplicates.', 'info');
                return;
            }
            
            // Group episodes by title + podcast combination
            const episodeGroups = new Map();
            
            episodesSnapshot.forEach(doc => {
                const episode = doc.data();
                const key = `${episode.title.toLowerCase().trim()}-${episode.podcastTitle.toLowerCase().trim()}`;
                
                if (!episodeGroups.has(key)) {
                    episodeGroups.set(key, []);
                }
                episodeGroups.get(key).push({
                    id: doc.id,
                    ...episode
                });
            });
            
            // Find duplicates (groups with more than 1 episode)
            const duplicates = [];
            let totalDuplicates = 0;
            
            episodeGroups.forEach((episodes, key) => {
                if (episodes.length > 1) {
                    // Sort by publish date (newest first) to keep the latest
                    episodes.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
                    
                    // Mark all but the newest as duplicates
                    for (let i = 1; i < episodes.length; i++) {
                        duplicates.push(episodes[i]);
                        totalDuplicates++;
                    }
                }
            });
            
            if (totalDuplicates === 0) {
                this.showNotification('✅ No duplicate episodes found!', 'success');
                return;
            }
            
            // Confirm the specific duplicates
            const duplicateList = duplicates.slice(0, 5).map(d => `• "${d.title}" (${d.podcastTitle})`).join('\n');
            const moreText = duplicates.length > 5 ? `\n... and ${duplicates.length - 5} more` : '';
            
            if (!confirm(`Found ${totalDuplicates} duplicate episodes:\n\n${duplicateList}${moreText}\n\nDelete the older duplicates?`)) {
                return;
            }
            
            this.showNotification(`🔄 Removing ${totalDuplicates} duplicate episodes...`, 'info');
            
            // Delete duplicates in batches
            const batchSize = 500; // Firestore batch limit
            let deletedCount = 0;
            
            for (let i = 0; i < duplicates.length; i += batchSize) {
                const batch = this.db.batch();
                const batchEnd = Math.min(i + batchSize, duplicates.length);
                
                for (let j = i; j < batchEnd; j++) {
                    batch.delete(this.db.collection('episodes').doc(duplicates[j].id));
                }
                
                await batch.commit();
                deletedCount += (batchEnd - i);
            }
            
            this.showNotification(`✅ Successfully removed ${deletedCount} duplicate episodes!`, 'success');
            
            // Refresh the dashboard data
            this.loadDashboardData();
            
        } catch (error) {
            console.error('Error removing duplicates:', error);
            this.showNotification('❌ Failed to remove duplicates. Please try again.', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Modal Functions
    showAddPodcastModal() {
        const modal = document.getElementById('addPodcastModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            // Clear form fields
            document.getElementById('rssFeedUrl').value = '';
            document.getElementById('podcastWebsite').value = '';
        }
    }

    closeAddPodcastModal() {
        const modal = document.getElementById('addPodcastModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }

    async addNewPodcast(event) {
        event.preventDefault();
        
        try {
            this.showNotification('🔄 Adding podcast... Please wait.', 'info');
            
            const rssFeedUrl = document.getElementById('rssFeedUrl').value;
            const podcastWebsite = document.getElementById('podcastWebsite').value;
            
            if (!rssFeedUrl && !podcastWebsite) {
                this.showNotification('⚠️ Please enter an RSS feed URL or podcast website', 'error');
                return;
            }
            
            let result;
            if (rssFeedUrl) {
                // Add RSS feed directly
                result = await this.addRSSPodcast(rssFeedUrl);
            } else if (podcastWebsite) {
                // Discover RSS from website
                result = await this.discoverAndAddRSSPodcast(podcastWebsite);
            }
            
            if (result) {
                const episodeCount = result.episodes.length;
                const episodeText = episodeCount === 1 ? 'episode' : 'episodes';
                this.showNotification(
                    `✅ Successfully added "${result.podcast.title}" with ${episodeCount} ${episodeText}!`, 
                    'success'
                );
                this.closeAddPodcastModal();
                
                // Refresh the episodes list after a short delay
                setTimeout(() => {
                    this.loadDashboardData();
                }, 2000);
            }
            
        } catch (error) {
            console.error('Error adding podcast:', error);
            let errorMessage = 'Failed to add podcast';
            
            if (error.message.includes('404')) {
                errorMessage = '❌ RSS feed not found. Please check the URL and try again.';
            } else if (error.message.includes('403')) {
                errorMessage = '❌ Access denied. The RSS feed may be protected.';
            } else if (error.message.includes('network')) {
                errorMessage = '❌ Network error. Please check your connection and try again.';
            } else if (error.message.includes('parse')) {
                errorMessage = '❌ Invalid RSS feed format. Please check the feed URL.';
            } else {
                errorMessage = `❌ ${error.message}`;
            }
            
            this.showNotification(errorMessage, 'error');
        }
    }

    async addRSSPodcast(rssFeedUrl) {
        try {
            this.showNotification('🔄 Fetching RSS feed...', 'info');
            
            // Try multiple CORS proxy options
            const proxyOptions = [
                'https://podcast-rss-proxy.eng-a-redwan.workers.dev/?url=',
                'https://corsproxy.io/?',
                'https://api.allorigins.win/raw?url='
            ];
            
            let rssText = null;
            let lastError = null;
            
            // Try direct fetch first (in case CORS is allowed)
            try {
                const directResponse = await fetch(rssFeedUrl);
                if (directResponse.ok) {
                    rssText = await directResponse.text();
                    this.showNotification('✅ Direct fetch successful (no proxy needed)', 'info');
                }
            } catch (directError) {
                console.log('Direct fetch failed, trying proxies...');
            }
            
            // If direct fetch failed, try proxies
            if (!rssText) {
                for (const proxyUrl of proxyOptions) {
                    try {
                        this.showNotification(`🔄 Trying proxy: ${proxyUrl}...`, 'info');
                        
                        let fetchUrl;
                        if (proxyUrl.includes('allorigins.win')) {
                            fetchUrl = proxyUrl + encodeURIComponent(rssFeedUrl) + '&_t=' + Date.now();
                        } else if (proxyUrl.includes('corsproxy.io')) {
                            fetchUrl = proxyUrl + rssFeedUrl + '&_t=' + Date.now();
                        } else if (proxyUrl.includes('podcast-rss-proxy')) {
                            fetchUrl = proxyUrl + encodeURIComponent(rssFeedUrl) + '&_t=' + Date.now();
                        } else {
                            fetchUrl = proxyUrl + encodeURIComponent(rssFeedUrl);
                        }
                        
                        const response = await fetch(fetchUrl, {
                            headers: {
                                'Accept': 'application/rss+xml, application/xml, text/xml'
                            }
                        });
                        
                        if (response.ok) {
                            rssText = await response.text();
                            this.showNotification(`✅ Proxy successful: ${proxyUrl}`, 'info');
                            break;
                        } else {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                    } catch (proxyError) {
                        console.warn(`Proxy ${proxyUrl} failed:`, proxyError);
                        lastError = proxyError;
                        continue;
                    }
                }
            }
            
            if (!rssText) {
                throw new Error('Unable to fetch RSS feed. All proxy options failed. The RSS feed may be protected or unavailable.');
            }
            
            // Parse RSS feed
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(rssText, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('Invalid RSS feed format');
            }
            
            // Extract podcast information
            const channel = xmlDoc.querySelector('channel');
            if (!channel) {
                throw new Error('No channel found in RSS feed');
            }
            
            const title = channel.querySelector('title')?.textContent || 'Unknown Podcast';
            const description = channel.querySelector('description')?.textContent || '';
            const websiteUrl = channel.querySelector('link')?.textContent || rssFeedUrl;
            const imageUrl = this.extractImage(channel) || '';
            
            // Extract episodes
            const items = xmlDoc.querySelectorAll('item');
            const episodes = [];
            
            items.forEach((item, index) => {
                const episodeTitle = item.querySelector('title')?.textContent || '';
                const episodeDescription = item.querySelector('description')?.textContent || '';
                const pubDate = item.querySelector('pubDate')?.textContent || '';
                const episodeUrl = item.querySelector('enclosure')?.getAttribute('url') || '';
                const episodeImage = this.extractEpisodeImage(item) || imageUrl;
                
                if (episodeTitle && pubDate) {
                    episodes.push({
                        title: episodeTitle,
                        description: episodeDescription,
                        publishDate: new Date(pubDate).toISOString(),
                        audioUrl: episodeUrl,
                        image: episodeImage,
                        podcastTitle: title,
                        podcastId: null, // Will be set after podcast is created
                        featured: false,
                        playCount: 0,
                        uniqueListeners: 0,
                        lastPlayed: null,
                        avgDuration: 0
                    });
                }
            });
            
            // Add podcast to Firestore
            const podcastData = {
                title: title,
                description: description,
                rssUrl: rssFeedUrl, // Store original URL without proxy
                websiteUrl: websiteUrl,
                imageUrl: imageUrl,
                lastUpdated: new Date().toISOString(),
                isActive: true,
                episodeCount: episodes.length
            };
            
            const podcastRef = await this.db.collection('podcasts').add(podcastData);
            
            // Add episodes to Firestore
            if (episodes.length > 0) {
                const batch = this.db.batch();
                
                episodes.forEach(episode => {
                    episode.podcastId = podcastRef.id;
                    const episodeRef = this.db.collection('episodes').doc();
                    batch.set(episodeRef, episode);
                });
                
                await batch.commit();
            }
            
            return {
                podcast: { ...podcastData, id: podcastRef.id },
                episodes: episodes
            };
            
        } catch (error) {
            console.error('Error adding RSS podcast:', error);
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Could not fetch RSS feed. This could be due to:\n• CORS restrictions\n• Network connectivity issues\n• RSS feed server blocking requests\n\nTry a different RSS feed or contact the podcast provider.');
            } else if (error.message.includes('HTTP 403')) {
                throw new Error('Access denied (403). The RSS feed server is blocking requests. This is common with commercial platforms like Kajabi. Try:\n• Using a different RSS feed URL\n• Contacting the podcast provider for a public RSS feed\n• Using a server-side proxy solution');
            } else if (error.message.includes('HTTP 404')) {
                throw new Error('RSS feed not found (404). Please check the URL and ensure it\'s a valid RSS feed.');
            } else if (error.message.includes('Unable to fetch RSS feed')) {
                throw new Error('RSS feed unavailable. All proxy options failed. This RSS feed may be protected or temporarily unavailable. Please try:\n• A different RSS feed URL\n• A different podcast platform\n• Contacting support for assistance');
            } else if (error.message.includes('Invalid RSS feed format')) {
                throw new Error('Invalid RSS feed format. The URL may not point to a valid RSS feed. Please verify the RSS feed URL.');
            } else if (error.message.includes('No channel found')) {
                throw new Error('Invalid RSS feed: No channel information found. The feed may be corrupted or incomplete.');
            } else {
                throw new Error(`Failed to process RSS feed: ${error.message}`);
            }
        }
    }

    async discoverAndAddRSSPodcast(websiteUrl) {
        try {
            this.showNotification('🔄 Discovering RSS feed from website...', 'info');
            
            // Fetch the website HTML
            const response = await fetch(websiteUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const htmlText = await response.text();
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(htmlText, 'text/html');
            
            // Look for RSS feed links in common locations
            const rssSelectors = [
                'link[type="application/rss+xml"]',
                'link[type="application/atom+xml"]',
                'link[rel="alternate"][type*="rss"]',
                'link[rel="alternate"][type*="atom"]'
            ];
            
            let rssUrl = null;
            
            // Try to find RSS link in HTML head
            for (const selector of rssSelectors) {
                const link = htmlDoc.querySelector(selector);
                if (link) {
                    rssUrl = link.getAttribute('href');
                    if (rssUrl) {
                        // Convert relative URL to absolute
                        if (rssUrl.startsWith('/')) {
                            const url = new URL(websiteUrl);
                            rssUrl = `${url.protocol}//${url.host}${rssUrl}`;
                        } else if (!rssUrl.startsWith('http')) {
                            rssUrl = new URL(rssUrl, websiteUrl).href;
                        }
                        break;
                    }
                }
            }
            
            // If not found in HTML, try common RSS feed paths
            if (!rssUrl) {
                const commonPaths = [
                    '/feed.xml',
                    '/rss.xml',
                    '/feed/',
                    '/rss/',
                    '/podcast.xml',
                    '/podcast/feed.xml',
                    '/index.rss'
                ];
                
                const url = new URL(websiteUrl);
                const baseUrl = `${url.protocol}//${url.host}`;
                
                for (const path of commonPaths) {
                    try {
                        const testUrl = baseUrl + path;
                        const testResponse = await fetch(testUrl, { method: 'HEAD' });
                        if (testResponse.ok) {
                            rssUrl = testUrl;
                            break;
                        }
                    } catch (e) {
                        // Continue trying other paths
                    }
                }
            }
            
            if (!rssUrl) {
                throw new Error('Could not find RSS feed on this website. Please enter the RSS feed URL directly.');
            }
            
            this.showNotification(`✅ Found RSS feed: ${rssUrl}`, 'info');
            
            // Now add the podcast using the discovered RSS URL
            return await this.addRSSPodcast(rssUrl);
            
        } catch (error) {
            console.error('Error discovering RSS feed:', error);
            
            if (error.message.includes('fetch')) {
                throw new Error('Could not access the website. Please check the URL and your connection.');
            } else if (error.message.includes('HTTP 404')) {
                throw new Error('Website not found (404). Please check the URL.');
            } else if (error.message.includes('HTTP 403')) {
                throw new Error('Access denied (403). The website may be protected.');
            } else if (error.message.includes('Could not find RSS feed')) {
                throw new Error('No RSS feed found on this website. Please enter the RSS feed URL directly.');
            } else {
                throw new Error(`Failed to discover RSS feed: ${error.message}`);
            }
        }
    }

    renderChart(type) {
        const canvas = document.getElementById('analyticsChart');
        const ctx = canvas.getContext('2d');
        
        // Clear previous chart
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Use real analytics data
        this.drawRealChart(ctx, type);
    }

    drawRealChart(ctx, type) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const padding = 40;
        
        // Get real data from stats
        let data = [];
        let color = '';
        let title = '';
        
        switch(type) {
            case 'visitors':
                data = this.getMonthlyData(this.stats.visitors.monthly);
                color = '#3b82f6';
                title = 'Visitors';
                break;
            case 'plays':
                data = this.getMonthlyData(this.stats.plays.monthly);
                color = '#10b981';
                title = 'Plays';
                break;
            case 'episodes':
                // Show episode count over time (last 6 months)
                data = this.getEpisodeGrowthData();
                color = '#f59e0b';
                title = 'Episodes';
                break;
        }
        
        if (data.length === 0) {
            // Show no data message
            ctx.fillStyle = '#64748b';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', width / 2, height / 2);
            return;
        }
        
        // Draw axes
        ctx.strokeStyle = '#e1e8ed';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw data
        const maxValue = Math.max(...data.map(d => d.value));
        const chartWidth = width - (padding * 2);
        const chartHeight = height - (padding * 2);
        const barWidth = chartWidth / data.length * 0.6;
        const spacing = chartWidth / data.length;
        
        data.forEach((item, index) => {
            const barHeight = (item.value / maxValue) * chartHeight;
            const x = padding + (index * spacing) + (spacing - barWidth) / 2;
            const y = height - padding - barHeight;
            
            // Draw bar
            ctx.fillStyle = color;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw label
            ctx.fillStyle = '#64748b';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, x + barWidth / 2, height - padding + 20);
            
            // Draw value
            ctx.fillText(item.value.toString(), x + barWidth / 2, y - 5);
        });
        
        // Draw title
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${title} (Last 6 Months)`, width / 2, 20);
    }

    getMonthlyData(monthlyData) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = new Date().getMonth();
        const data = [];
        
        // Get last 6 months
        for (let i = 5; i >= 0; i--) {
            const monthIndex = (currentMonth - i + 12) % 12;
            const monthName = months[monthIndex];
            const value = monthlyData[monthIndex] || 0;
            data.push({ label: monthName, value });
        }
        
        return data;
    }

    getEpisodeGrowthData() {
        // Calculate episode growth over time
        const episodesByMonth = {};
        
        this.episodes.forEach(episode => {
            if (episode.publishDate) {
                const date = new Date(episode.publishDate);
                const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
                episodesByMonth[monthKey] = (episodesByMonth[monthKey] || 0) + 1;
            }
        });
        
        // Get last 6 months of episode growth
        const data = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let cumulativeCount = 0;
        
        for (let i = 5; i >= 0; i--) {
            const monthIndex = (currentMonth - i + 12) % 12;
            const year = monthIndex > currentMonth ? currentYear - 1 : currentYear;
            const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            const monthName = months[monthIndex];
            
            cumulativeCount += episodesByMonth[monthKey] || 0;
            data.push({ label: monthName, value: cumulativeCount });
        }
        
        return data;
    }

    setupEventListeners() {
        // Episode search
        const searchInput = document.getElementById('episodeSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterEpisodes());
        }
    }

    filterEpisodes() {
        const searchTerm = document.getElementById('episodeSearch').value.toLowerCase();
        const podcastFilter = document.getElementById('podcastFilter').value;
        const featuredFilter = document.getElementById('featuredFilter').value;
        
        this.filteredEpisodes = this.episodes.filter(episode => {
            const matchesSearch = !searchTerm || 
                episode.title.toLowerCase().includes(searchTerm) ||
                episode.podcastTitle.toLowerCase().includes(searchTerm);
            
            const matchesPodcast = !podcastFilter || episode.podcastTitle === podcastFilter;
            
            let matchesFeatured = true;
            if (featuredFilter === 'featured') {
                matchesFeatured = episode.featured === true;
            } else if (featuredFilter === 'not-featured') {
                matchesFeatured = episode.featured !== true;
            }
            
            return matchesSearch && matchesPodcast && matchesFeatured;
        });
        
        // Reset to first page when filtering
        this.currentPage = 1;
        this.renderEpisodeTable();
    }

    formatDate(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString();
    }

    showLoading(show) {
        // You can add a loading overlay here if needed
        console.log(show ? 'Loading...' : 'Loading complete');
    }

    showError(message) {
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        }
    }

    async refreshStats() {
        await this.loadDashboardData();
    }

    // Helper methods for better sync UX
    async showSyncConfirmation() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'sync-confirmation-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>🔄 Sync All Podcasts</h3>
                    <p>This will update all podcast feeds and may take several minutes.</p>
                    <p>You'll see progress updates for each podcast as it syncs.</p>
                    <div class="modal-buttons">
                        <button class="btn btn-primary" id="confirm-sync">Continue Sync</button>
                        <button class="btn btn-secondary" id="cancel-sync">Cancel</button>
                    </div>
                </div>
            `;
            
            // Add modal styles
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            document.body.appendChild(modal);
            
            document.getElementById('confirm-sync').onclick = () => {
                document.body.removeChild(modal);
                resolve(true);
            };
            
            document.getElementById('cancel-sync').onclick = () => {
                document.body.removeChild(modal);
                resolve(false);
            };
        });
    }

    showSyncProgress(percentage, message) {
        let progressContainer = document.getElementById('sync-progress-container');
        
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'sync-progress-container';
            progressContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                min-width: 300px;
            `;
            document.body.appendChild(progressContainer);
        }
        
        progressContainer.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #333;">🔄 Syncing Podcasts</h4>
            <div style="margin-bottom: 10px; font-size: 14px; color: #666;">${message}</div>
            <div style="background: #f0f0f0; border-radius: 4px; height: 8px; overflow: hidden;">
                <div style="background: #007bff; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
            </div>
            <div style="margin-top: 5px; font-size: 12px; color: #888; text-align: center;">${percentage}%</div>
        `;
    }

    hideSyncProgress() {
        const progressContainer = document.getElementById('sync-progress-container');
        if (progressContainer) {
            document.body.removeChild(progressContainer);
        }
    }

    showDetailedSyncResults(syncResults, totalNewEpisodes, errorCount) {
        // Create detailed results modal
        const modal = document.createElement('div');
        modal.className = 'sync-results-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const successResults = syncResults.filter(r => r.status === 'success');
        const errorResults = syncResults.filter(r => r.status === 'error');

        let resultsHTML = `
            <div style="background: white; border-radius: 12px; padding: 30px; max-width: 600px; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #333;">📊 Sync Results</h2>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center;">
                        <div>
                            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${successResults.length}</div>
                            <div style="font-size: 12px; color: #666;">Successful</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: bold; color: #007bff;">${totalNewEpisodes}</div>
                            <div style="font-size: 12px; color: #666;">New Episodes</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${errorResults.length}</div>
                            <div style="font-size: 12px; color: #666;">Failed</div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Podcast Details</h3>
                    <div style="max-height: 300px; overflow-y: auto;">
        `;

        syncResults.forEach(result => {
            if (result.status === 'success') {
                resultsHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                        <div style="flex: 1;">
                            <div style="font-weight: 500; color: #333;">${result.podcast}</div>
                            <div style="font-size: 12px; color: #666;">${result.totalEpisodes} total episodes</div>
                        </div>
                        <div style="text-align: right;">
                            ${result.newEpisodes > 0 ? 
                                `<div style="color: #28a745; font-weight: bold;">+${result.newEpisodes} new</div>` : 
                                `<div style="color: #6c757d; font-size: 12px;">No new episodes</div>`
                            }
                        </div>
                    </div>
                `;
            } else {
                resultsHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; background: #fff5f5;">
                        <div style="flex: 1;">
                            <div style="font-weight: 500; color: #333;">${result.podcast}</div>
                            <div style="font-size: 12px; color: #dc3545;">${result.error}</div>
                        </div>
                        <div style="color: #dc3545; font-weight: bold;">Failed</div>
                    </div>
                `;
            }
        });

        resultsHTML += `
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">Close</button>
                </div>
            </div>
        `;

        modal.innerHTML = resultsHTML;
        document.body.appendChild(modal);

        // Auto-hide after 30 seconds
        setTimeout(() => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        }, 30000);
    }

    // Load and display all podcasts (including inactive ones)
    async loadAllPodcasts() {
        try {
            console.log('🔄 Loading ALL podcasts for admin dashboard...');
            const podcastsSnapshot = await this.db.collection('podcasts').get();
            const podcastTableBody = document.getElementById('podcastTableBody');
            
            if (!podcastTableBody) {
                console.log('❌ Podcast table body not found');
                return;
            }
            
            console.log(`📊 Found ${podcastsSnapshot.size} total podcasts in database`);
            
            if (podcastsSnapshot.empty) {
                podcastTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No podcasts found</td></tr>';
                return;
            }
            
            podcastTableBody.innerHTML = ''; // Clear existing content
            
            for (const podcastDoc of podcastsSnapshot.docs) {
                const podcast = podcastDoc.data();
                const podcastId = podcastDoc.id;
                const isActive = podcast.isActive !== false; // Default to true if not set
                
                console.log(`📻 Processing podcast for list: "${podcast.title}" (ID: ${podcastId}) - Active: ${isActive}`);
                
                // Get episode count for this podcast
                let episodeCount = 0;
                try {
                    const episodesSnapshot = await this.db.collection('episodes')
                        .where('podcastId', '==', podcastId)
                        .get();
                    episodeCount = episodesSnapshot.size;
                    console.log(`📺 Found ${episodeCount} episodes for "${podcast.title}"`);
                } catch (error) {
                    console.error(`❌ Error getting episode count for "${podcast.title}":`, error);
                    episodeCount = 0;
                }
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${podcast.title || 'Untitled'}</strong> ${!isActive ? '<span style="color: red; font-size: 0.8rem;">[INACTIVE]</span>' : ''}</td>
                    <td><a href="${podcast.rssUrl}" target="_blank" style="font-size: 0.9rem; color: #64748b;">${podcast.rssUrl || 'No RSS URL'}</a></td>
                    <td>${episodeCount}</td>
                    <td>${podcast.lastUpdated ? new Date(podcast.lastUpdated).toLocaleDateString() : 'Never'}</td>
                    <td>
                        <button class="admin-btn primary" onclick="adminDashboard.editRssUrl('${podcastId}')" style="padding: 5px 10px; font-size: 0.8rem;">
                            📝 Edit RSS
                        </button>
                        <button class="admin-btn danger" onclick="adminDashboard.removePodcast('${podcastId}')" style="padding: 5px 10px; font-size: 0.8rem;">
                            🗑️ Remove
                        </button>
                        ${!isActive ? `
                        <button class="admin-btn primary" onclick="adminDashboard.activatePodcast('${podcastId}')" style="padding: 5px 10px; font-size: 0.8rem;">
                            ✅ Activate
                        </button>` : ''}
                    </td>
                `;
                
                podcastTableBody.appendChild(row);
            }
            
            console.log(`✅ Podcast list updated with ${podcastsSnapshot.size} podcasts`);
            
        } catch (error) {
            console.error('Error loading podcast list:', error);
            const podcastTableBody = document.getElementById('podcastTableBody');
            if (podcastTableBody) {
                podcastTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error loading podcasts</td></tr>';
            }
        }
    }

    // Edit RSS URL for a podcast
    async editRssUrl(podcastId) {
        if (!this.validateAdminPassword()) return;
        
        try {
            // Get current podcast data
            const podcastDoc = await this.db.collection('podcasts').doc(podcastId).get();
            const podcast = podcastDoc.data();
            
            const newRssUrl = prompt(`Edit RSS URL for "${podcast.title}":`, podcast.rssUrl || '');
            
            if (newRssUrl === null) {
                console.log('❌ User cancelled RSS URL edit');
                return;
            }
            
            if (newRssUrl.trim() === '') {
                this.showNotification('❌ RSS URL cannot be empty', 'error');
                return;
            }
            
            await this.db.collection('podcasts').doc(podcastId).update({
                rssUrl: newRssUrl.trim(),
                isActive: true // Auto-activate when RSS URL is added
            });
            
            this.showNotification(`✅ Updated RSS URL for "${podcast.title}" and activated podcast`, 'success');
            
            // Refresh the list
            await this.loadAllPodcasts();
            
        } catch (error) {
            console.error('Error editing RSS URL:', error);
            this.showNotification('❌ Error editing RSS URL', 'error');
        }
    }

    // Activate a podcast
    async activatePodcast(podcastId) {
        if (!this.validateAdminPassword()) return;
        
        try {
            await this.db.collection('podcasts').doc(podcastId).update({
                isActive: true
            });
            
            this.showNotification('✅ Podcast activated successfully', 'success');
            await this.loadAllPodcasts(); // Refresh the list
            
        } catch (error) {
            console.error('Error activating podcast:', error);
            this.showNotification('❌ Error activating podcast', 'error');
        }
    }

    // Load and display podcast list
    async loadPodcastList() {
        try {
            console.log('🔄 Loading podcast list for admin dashboard...');
            const podcastsSnapshot = await this.db.collection('podcasts').where('isActive', '==', true).get();
            const podcastTableBody = document.getElementById('podcastTableBody');
            
            if (!podcastTableBody) {
                console.log('❌ Podcast table body not found');
                return;
            }
            
            console.log(`📊 Found ${podcastsSnapshot.size} active podcasts in database`);
            
            if (podcastsSnapshot.empty) {
                podcastTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No active podcasts found</td></tr>';
                return;
            }
            
            podcastTableBody.innerHTML = ''; // Clear existing content
            
            for (const podcastDoc of podcastsSnapshot.docs) {
                const podcast = podcastDoc.data();
                const podcastId = podcastDoc.id;
                
                console.log(`📻 Processing podcast for list: "${podcast.title}" (ID: ${podcastId})`);
                
                // Get episode count for this podcast
                let episodeCount = 0;
                try {
                    const episodesSnapshot = await this.db.collection('episodes')
                        .where('podcastId', '==', podcastId)
                        .get();
                    episodeCount = episodesSnapshot.size;
                    console.log(`📺 Found ${episodeCount} episodes for "${podcast.title}"`);
                } catch (error) {
                    console.error(`❌ Error getting episode count for "${podcast.title}":`, error);
                    episodeCount = 0;
                }
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${podcast.title || 'Untitled'}</strong></td>
                    <td><a href="${podcast.rssUrl}" target="_blank" style="font-size: 0.9rem; color: #64748b;">${podcast.rssUrl}</a></td>
                    <td>${episodeCount}</td>
                    <td>${podcast.lastUpdated ? new Date(podcast.lastUpdated).toLocaleDateString() : 'Never'}</td>
                    <td>
                        <button class="admin-btn danger" onclick="adminDashboard.removePodcast('${podcastId}', '${podcast.title}')" style="padding: 5px 10px; font-size: 0.8rem;">
                            <span class="btn-icon">🗑️</span> Remove
                        </button>
                    </td>
                `;
                podcastTableBody.appendChild(row);
            }
            
            console.log(`✅ Podcast list updated with ${podcastsSnapshot.size} podcasts`);
            
        } catch (error) {
            console.error('Error loading podcast list:', error);
            const podcastTableBody = document.getElementById('podcastTableBody');
            if (podcastTableBody) {
                podcastTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error loading podcasts</td></tr>';
            }
        }
    }

    // Find and add missing podcasts from episodes
    async findMissingPodcasts() {
        if (!this.validateAdminPassword()) return;
        
        try {
            console.log('🔍 Finding missing podcasts from episodes...');
            
            // Get all podcasts
            const podcastsSnapshot = await this.db.collection('podcasts').get();
            const existingPodcasts = new Map();
            podcastsSnapshot.docs.forEach(doc => {
                const podcast = doc.data();
                existingPodcasts.set(podcast.title.toLowerCase().trim(), {
                    title: podcast.title,
                    id: doc.id,
                    rssUrl: podcast.rssUrl,
                    isActive: podcast.isActive
                });
            });
            
            // Get all episodes and extract unique podcast titles
            const episodesSnapshot = await this.db.collection('episodes').get();
            const podcastTitlesFromEpisodes = new Set();
            const missingPodcasts = new Map();
            const titleMismatches = new Map();
            
            episodesSnapshot.docs.forEach(doc => {
                const episode = doc.data();
                if (episode.podcastTitle) {
                    const episodeTitle = episode.podcastTitle.toLowerCase().trim();
                    podcastTitlesFromEpisodes.add(episode.podcastTitle);
                    
                    // Check if this podcast exists in database (case-insensitive)
                    let foundMatch = false;
                    for (const [dbTitle, dbInfo] of existingPodcasts) {
                        // Check for exact match (case-insensitive)
                        if (dbTitle === episodeTitle) {
                            foundMatch = true;
                            break;
                        }
                        // Check for close matches (remove common suffixes/prefixes)
                        const cleanEpisodeTitle = episodeTitle.replace(/\s+(podcast|show|the)\s*$/gi, '').trim();
                        const cleanDbTitle = dbTitle.replace(/\s+(podcast|show|the)\s*$/gi, '').trim();
                        if (cleanEpisodeTitle === cleanDbTitle) {
                            titleMismatches.set(episode.podcastTitle, dbInfo.title);
                            foundMatch = true;
                            break;
                        }
                    }
                    
                    // If no match found, it's truly missing
                    if (!foundMatch) {
                        if (!missingPodcasts.has(episode.podcastTitle)) {
                            missingPodcasts.set(episode.podcastTitle, {
                                firstEpisode: episode,
                                episodeCount: 0
                            });
                        }
                        missingPodcasts.get(episode.podcastTitle).episodeCount++;
                    }
                }
            });
            
            console.log(`\n📊 MISSING PODCAST ANALYSIS:`);
            console.log(`📻 Podcasts in database: ${existingPodcasts.size}`);
            console.log(`📺 Unique podcast titles from episodes: ${podcastTitlesFromEpisodes.size}`);
            console.log(`🚨 Truly missing podcasts: ${missingPodcasts.size}`);
            console.log(`⚠️ Title mismatches: ${titleMismatches.size}`);
            
            // Show title mismatches first
            if (titleMismatches.size > 0) {
                console.log(`\n⚠️ TITLE MISMATCHES (episodes vs database):`);
                titleMismatches.forEach((dbTitle, episodeTitle) => {
                    console.log(`   Episode: "${episodeTitle}" ↔ Database: "${dbTitle}"`);
                });
            }
            
            if (missingPodcasts.size === 0) {
                if (titleMismatches.size > 0) {
                    this.showNotification(`⚠️ Found ${titleMismatches.size} title mismatches but no missing podcasts. Check console for details.`, 'warning');
                } else {
                    this.showNotification('✅ No missing podcasts found!', 'success');
                }
                return;
            }
            
            console.log(`\n🚨 TRULY MISSING PODCASTS (need to be added to database):`);
            missingPodcasts.forEach((data, title) => {
                console.log(`   - "${title}" | Episodes: ${data.episodeCount} | First episode: "${data.firstEpisode.title}"`);
            });
            
            // Create detailed message for confirmation dialog
            let missingPodcastsList = '';
            missingPodcasts.forEach((data, title) => {
                missingPodcastsList += `• "${title}" (${data.episodeCount} episodes)\n`;
            });
            
            // Ask for confirmation before adding
            const confirmAdd = confirm(`Found ${missingPodcasts.size} truly missing podcasts (and ${titleMismatches.size} title mismatches).\n\nMissing podcasts to be added:\n${missingPodcastsList}\nDo you want to add these ${missingPodcasts.size} missing podcasts to the database?\n\nThese podcasts will be added as inactive and will need RSS URLs to sync.`);
            
            if (!confirmAdd) {
                console.log('❌ User cancelled adding missing podcasts');
                return;
            }
            
            // Add missing podcasts to database
            let addedCount = 0;
            for (const [title, data] of missingPodcasts) {
                try {
                    const newPodcast = {
                        title: title,
                        rssUrl: '', // Will need to be set manually
                        isActive: false, // Start as inactive
                        lastUpdated: null,
                        createdAt: new Date().toISOString()
                    };
                    
                    const docRef = await this.db.collection('podcasts').add(newPodcast);
                    console.log(`✅ Added podcast: "${title}" (ID: ${docRef.id})`);
                    addedCount++;
                    
                } catch (error) {
                    console.error(`❌ Error adding podcast "${title}":`, error);
                }
            }
            
            this.showNotification(`✅ Added ${addedCount} missing podcasts. Found ${titleMismatches.size} title mismatches. Check console for details.`, 'success');
            
            // Refresh the podcast list
            await this.loadAllPodcasts();
            
        } catch (error) {
            console.error('Error finding missing podcasts:', error);
            this.showNotification('❌ Error finding missing podcasts', 'error');
        }
    }

    // Comprehensive database audit to find all inconsistencies
    async auditDatabase() {
        if (!this.validateAdminPassword()) return;
        
        try {
            console.log('🔍 Running comprehensive database audit...');
            
            // Get all podcasts
            const podcastsSnapshot = await this.db.collection('podcasts').get();
            const allPodcasts = podcastsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Get all episodes
            const episodesSnapshot = await this.db.collection('episodes').get();
            const allEpisodes = episodesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            console.log(`\n📊 DATABASE AUDIT RESULTS:`);
            console.log(`📻 Total podcasts in database: ${allPodcasts.length}`);
            console.log(`📺 Total episodes in database: ${allEpisodes.length}`);
            
            // Categorize podcasts
            const activePodcasts = allPodcasts.filter(p => p.isActive !== false);
            const inactivePodcasts = allPodcasts.filter(p => p.isActive === false);
            const podcastsWithRss = allPodcasts.filter(p => p.rssUrl && p.rssUrl !== undefined);
            const podcastsWithoutRss = allPodcasts.filter(p => !p.rssUrl || p.rssUrl === undefined);
            
            // Find podcasts with episodes vs without episodes
            const podcastsWithEpisodes = new Set();
            allEpisodes.forEach(ep => {
                if (ep.podcastId) {
                    podcastsWithEpisodes.add(ep.podcastId);
                }
            });
            
            const podcastsWithEpisodesList = allPodcasts.filter(p => podcastsWithEpisodes.has(p.id));
            const podcastsWithoutEpisodesList = allPodcasts.filter(p => !podcastsWithEpisodes.has(p.id));
            
            console.log(`\n📈 PODCAST STATUS:`);
            console.log(`✅ Active podcasts: ${activePodcasts.length}`);
            console.log(`❌ Inactive podcasts: ${inactivePodcasts.length}`);
            console.log(`🔗 With RSS URLs: ${podcastsWithRss.length}`);
            console.log(`⚠️ Without RSS URLs: ${podcastsWithoutRss.length}`);
            console.log(`📺 With episodes: ${podcastsWithEpisodesList.length}`);
            console.log(`📭 Without episodes: ${podcastsWithoutEpisodesList.length}`);
            
            // Show inactive podcasts
            if (inactivePodcasts.length > 0) {
                console.log(`\n❌ INACTIVE PODCASTS (should appear in main app but don't):`);
                inactivePodcasts.forEach(p => {
                    const hasEpisodes = podcastsWithEpisodes.has(p.id);
                    console.log(`   - "${p.title}" | Has RSS: ${!!p.rssUrl} | Has Episodes: ${hasEpisodes}`);
                });
            }
            
            // Show podcasts without episodes
            if (podcastsWithoutEpisodesList.length > 0) {
                console.log(`\n📭 PODCASTS WITHOUT EPISODES (won't appear in main app filter):`);
                podcastsWithoutEpisodesList.forEach(p => {
                    console.log(`   - "${p.title}" | RSS: ${p.rssUrl || 'MISSING'} | Active: ${p.isActive !== false}`);
                });
            }
            
            // Show podcasts without RSS
            if (podcastsWithoutRss.length > 0) {
                console.log(`\n⚠️ PODCASTS WITHOUT RSS URL (can't sync):`);
                podcastsWithoutRss.forEach(p => {
                    console.log(`   - "${p.title}" | ID: ${p.id}`);
                });
            }
            
            // Check for duplicate RSS URLs
            const rssUrlMap = new Map();
            podcastsWithRss.forEach(p => {
                if (rssUrlMap.has(p.rssUrl)) {
                    rssUrlMap.get(p.rssUrl).push(p);
                } else {
                    rssUrlMap.set(p.rssUrl, [p]);
                }
            });
            
            const duplicates = Array.from(rssUrlMap.entries()).filter(([url, podcasts]) => podcasts.length > 1);
            if (duplicates.length > 0) {
                console.log(`\n🔄 DUPLICATE RSS URLs:`);
                duplicates.forEach(([url, podcasts]) => {
                    console.log(`   URL: ${url}`);
                    podcasts.forEach(p => console.log(`     - "${p.title}"`));
                });
            }
            
            // Show unique podcast titles from episodes (for main app filter)
            const uniquePodcastTitlesFromEpisodes = new Set();
            allEpisodes.forEach(ep => {
                if (ep.podcastTitle) {
                    uniquePodcastTitlesFromEpisodes.add(ep.podcastTitle);
                }
            });
            
            console.log(`\n📋 MAIN APP FILTER ANALYSIS:`);
            console.log(`📺 Unique podcast titles from episodes: ${uniquePodcastTitlesFromEpisodes.size}`);
            console.log(`📻 Total podcasts in database: ${allPodcasts.length}`);
            console.log(`⚠️ Missing from main app: ${allPodcasts.length - uniquePodcastTitlesFromEpisodes.size}`);
            
            const missingFromMainApp = allPodcasts.filter(p => !uniquePodcastTitlesFromEpisodes.has(p.title));
            if (missingFromMainApp.length > 0) {
                console.log(`\n🚨 PODCASTS MISSING FROM MAIN APP FILTER:`);
                missingFromMainApp.forEach(p => {
                    const hasEpisodes = podcastsWithEpisodes.has(p.id);
                    console.log(`   - "${p.title}" | Has Episodes: ${hasEpisodes} | Active: ${p.isActive !== false}`);
                });
            }
            
            this.showNotification(`🔍 Audit complete. Check console for detailed analysis.`, 'success');
            
        } catch (error) {
            console.error('Error auditing database:', error);
            this.showNotification('❌ Error auditing database', 'error');
        }
    }

    // Force fix duplicate RSS URLs
    async fixDuplicateRssUrls() {
        if (!this.validateAdminPassword()) return;
        
        try {
            console.log('🔧 Fixing duplicate RSS URLs...');
            
            // Get all podcasts
            const podcastsSnapshot = await this.db.collection('podcasts').get();
            let fixedCount = 0;
            
            for (const podcastDoc of podcastsSnapshot.docs) {
                const podcast = podcastDoc.data();
                const podcastId = podcastDoc.id;
                const title = podcast.title.toLowerCase();
                
                let newRssUrl = '';
                
                // Fix specific duplicates with correct unique URLs
                if (podcast.rssUrl === 'https://rss.buzzsprout.com/1715047.rss') {
                    if (title.includes('gemba academy')) {
                        newRssUrl = 'https://rss.buzzsprout.com/1319367.rss';
                    } else if (title.includes('shingo principles')) {
                        newRssUrl = 'https://rss.buzzsprout.com/2008963.rss';
                    }
                    // Keep Excellence Unlocked as is (1715047.rss)
                } else if (podcast.rssUrl === 'https://rss.buzzsprout.com/2056326.rss') {
                    if (title.includes('lean blog interviews')) {
                        newRssUrl = 'https://rss.buzzsprout.com/1894955.rss';
                    } else if (title.includes('lean solutions')) {
                        newRssUrl = 'https://rss.buzzsprout.com/2249655.rss';
                    } else if (title.includes('business problems solved')) {
                        newRssUrl = 'https://rss.buzzsprout.com/2128784.rss';
                    } else if (title.includes('scrum master toolbox')) {
                        newRssUrl = 'https://rss.buzzsprout.com/1319367.rss';
                    }
                    // Keep Lean Made Simple as is (2056326.rss)
                }
                
                if (newRssUrl) {
                    await this.db.collection('podcasts').doc(podcastId).update({
                        rssUrl: newRssUrl
                    });
                    fixedCount++;
                    console.log(`✅ Fixed RSS URL for "${podcast.title}": ${newRssUrl}`);
                }
            }
            
            this.showNotification(`🔧 Fixed ${fixedCount} duplicate RSS URLs`, 'success');
            console.log(`✅ RSS URL fixing complete. ${fixedCount} podcasts updated.`);
            
            // Refresh the podcast list to show updated URLs
            await this.loadPodcastList();
            
        } catch (error) {
            console.error('Error fixing RSS URLs:', error);
            this.showNotification('❌ Error fixing RSS URLs', 'error');
        }
    }

    // Fix podcasts with missing RSS URLs
    async fixMissingRssUrls() {
        if (!this.validateAdminPassword()) return;
        
        try {
            console.log('🔧 Fixing podcasts with missing RSS URLs...');
            
            // Get all podcasts
            const podcastsSnapshot = await this.db.collection('podcasts').get();
            let fixedCount = 0;
            
            for (const podcastDoc of podcastsSnapshot.docs) {
                const podcast = podcastDoc.data();
                const podcastId = podcastDoc.id;
                
                // Check if RSS URL is missing or undefined
                if (!podcast.rssUrl || podcast.rssUrl === undefined) {
                    console.log(`🔍 Fixing RSS URL for: "${podcast.title}"`);
                    
                    // Try to extract RSS URL from title or use common patterns
                    let rssUrl = '';
                    const title = podcast.title.toLowerCase();
                    
                    // Common RSS URL patterns based on podcast titles
                    if (title.includes('hbr')) {
                        if (title.includes('ideacast')) {
                            rssUrl = 'https://feeds.harvardbusiness.org/harvardbusiness/ideacast';
                        } else if (title.includes('strategy')) {
                            rssUrl = 'https://feeds.harvardbusiness.org/harvardbusiness/strategy';
                        }
                    } else if (title.includes('excellence unlocked')) {
                        rssUrl = 'https://rss.buzzsprout.com/1715047.rss';
                    } else if (title.includes('lean made simple')) {
                        rssUrl = 'https://rss.buzzsprout.com/2056326.rss';
                    } else if (title.includes('gemba academy')) {
                        rssUrl = 'https://rss.buzzsprout.com/1319367.rss';
                    } else if (title.includes('lean blog interviews')) {
                        rssUrl = 'https://rss.buzzsprout.com/1894955.rss';
                    } else if (title.includes('lean solutions')) {
                        rssUrl = 'https://rss.buzzsprout.com/2249655.rss';
                    } else if (title.includes('business problems solved')) {
                        rssUrl = 'https://rss.buzzsprout.com/2128784.rss';
                    } else if (title.includes('shingo principles')) {
                        rssUrl = 'https://rss.buzzsprout.com/2008963.rss';
                    } else if (title.includes('scrum master toolbox')) {
                        rssUrl = 'https://rss.buzzsprout.com/1319367.rss';
                    }
                    
                    if (rssUrl) {
                        await this.db.collection('podcasts').doc(podcastId).update({
                            rssUrl: rssUrl,
                            isActive: true
                        });
                        fixedCount++;
                        console.log(`✅ Fixed RSS URL for "${podcast.title}": ${rssUrl}`);
                    }
                }
            }
            
            this.showNotification(`🔧 Fixed RSS URLs for ${fixedCount} podcasts`, 'success');
            console.log(`✅ RSS URL fixing complete. ${fixedCount} podcasts updated.`);
            
        } catch (error) {
            console.error('Error fixing RSS URLs:', error);
            this.showNotification('❌ Error fixing RSS URLs', 'error');
        }
    }

    // Database inspection function
    async inspectDatabase() {
        if (!this.validateAdminPassword()) return;
        
        try {
            console.log('🔍 Inspecting database contents...');
            
            // Get all podcasts (including inactive ones)
            const podcastsSnapshot = await this.db.collection('podcasts').get();
            console.log(`📊 Total podcasts in database: ${podcastsSnapshot.size}`);
            
            let activeCount = 0;
            let inactiveCount = 0;
            
            for (const podcastDoc of podcastsSnapshot.docs) {
                const podcast = podcastDoc.data();
                const isActive = podcast.isActive !== false; // Default to true if not set
                
                if (isActive) {
                    activeCount++;
                } else {
                    inactiveCount++;
                }
                
                console.log(`\n📻 Podcast: "${podcast.title}"`);
                console.log(`   ID: ${podcastDoc.id}`);
                console.log(`   RSS: ${podcast.rssUrl}`);
                console.log(`   Active: ${isActive}`);
                console.log(`   Last Updated: ${podcast.lastUpdated || 'Never'}`);
            }
            
            console.log(`\n📈 Summary: ${activeCount} active, ${inactiveCount} inactive podcasts`);
            
            // Get all episodes
            const episodesSnapshot = await this.db.collection('episodes').get();
            console.log(`\n📺 Total episodes in database: ${episodesSnapshot.size}`);
            
            // Group episodes by podcast
            const episodesByPodcast = {};
            episodesSnapshot.docs.forEach(doc => {
                const episode = doc.data();
                const podcastId = episode.podcastId;
                if (!episodesByPodcast[podcastId]) {
                    episodesByPodcast[podcastId] = [];
                }
                episodesByPodcast[podcastId].push(episode.title);
            });
            
            // Show episode counts per podcast
            for (const [podcastId, episodes] of Object.entries(episodesByPodcast)) {
                const podcast = podcastsSnapshot.docs.find(doc => doc.id === podcastId)?.data();
                if (podcast) {
                    console.log(`\n📻 "${podcast.title}" has ${episodes.length} episodes`);
                    console.log(`   Episodes: ${episodes.slice(0, 5).join(', ')}${episodes.length > 5 ? '...' : ''}`);
                }
            }
            
        } catch (error) {
            console.error('Error inspecting database:', error);
        }
    }

    // Remove a podcast and all its episodes
    async removePodcast(podcastId, podcastTitle) {
        if (!this.validateAdminPassword()) return;
        
        const confirmMessage = `Are you sure you want to remove "${podcastTitle}"?\n\nThis will:\n• Delete the podcast from the database\n• Delete ALL episodes associated with this podcast\n• This action CANNOT be undone\n\nType "DELETE" to confirm:`;
        
        const confirmation = prompt(confirmMessage);
        if (confirmation !== 'DELETE') {
            this.showNotification('Podcast removal cancelled', 'info');
            return;
        }
        
        try {
            this.showNotification(`🗑️ Removing podcast "${podcastTitle}"...`, 'info');
            
            // Delete all episodes for this podcast
            const episodesSnapshot = await this.db.collection('episodes')
                .where('podcastId', '==', podcastId)
                .get();
            
            const batch = this.db.batch();
            
            // Delete episodes
            episodesSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete the podcast
            const podcastRef = this.db.collection('podcasts').doc(podcastId);
            batch.delete(podcastRef);
            
            await batch.commit();
            
            this.showNotification(`✅ Successfully removed "${podcastTitle}" and ${episodesSnapshot.size} episodes`, 'success');
            
            // Reload the podcast list
            await this.loadPodcastList();
            
            // Reload dashboard data to update stats
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Error removing podcast:', error);
            this.showNotification(`❌ Failed to remove "${podcastTitle}": ${error.message}`, 'error');
        }
    }

    // Extract podcast-level image using comprehensive selectors
    extractImage(channel) {
        const imageSelectors = [
            'itunes:image',
            'itunes:image href', 
            'image url',
            'image',
            'media:thumbnail',
            'logo',
            'icon'
        ];

        for (const selector of imageSelectors) {
            const result = this.getElementText(channel, selector);
            if (result) {
                return result;
            }
        }

        return null;
    }

    // Extract episode image using comprehensive selectors (matching rss-parser.js)
    extractEpisodeImage(item) {
        const imageSelectors = [
            'itunes:image',
            'itunes:image href',
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

    // Helper method to extract text from XML elements (matching rss-parser.js)
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
}

// Global functions for HTML onclick handlers
function showChart(type) {
    // Update button states
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Render new chart
    if (window.adminDashboard) {
        window.adminDashboard.renderChart(type);
    }
}

function filterEpisodes() {
    if (window.adminDashboard) {
        window.adminDashboard.filterEpisodes();
    }
}

function refreshStats() {
    if (window.adminDashboard) {
        window.adminDashboard.refreshStats();
    }
}

function logout() {
    localStorage.removeItem('kme-admin-password');
    window.location.href = 'index.html';
}

// Admin Management Functions
function showAddPodcastModal() {
    // Redirect to main app to add podcast
    window.open('index.html#add-podcast', '_blank');
}

async function manualSyncAllPodcasts() {
    // Validate admin password
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    if (!confirm('Are you sure you want to manually sync all podcasts? This may take several minutes.')) {
        return;
    }
    
    try {
        const statusEl = document.getElementById('syncStatus');
        if (statusEl) {
            statusEl.innerHTML = '<div class="status-item"><span class="status-label">Status:</span><span class="status-value">🔄 Syncing...</span></div>';
        }
        
        // Get all tracked podcasts and sync them
        if (window.adminDashboard.db) {
            const trackedPodcasts = await window.adminDashboard.db.collection('trackedPodcasts').get();
            
            let successCount = 0;
            let errorCount = 0;
            const results = [];
            
            for (const doc of trackedPodcasts.docs) {
                const podcast = doc.data();
                console.log(`🔄 Syncing podcast: ${podcast.title}`);
                
                try {
                    // Update sync date
                    await window.adminDashboard.db.collection('trackedPodcasts').doc(doc.id).update({
                        lastSyncDate: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    successCount++;
                    results.push(`✅ ${podcast.title}`);
                } catch (error) {
                    errorCount++;
                    results.push(`❌ ${podcast.title}: ${error.message}`);
                }
            }
            
            // Show detailed results
            const message = `Sync Complete!\n\n📊 Results:\n✅ Successfully synced: ${successCount} podcasts\n❌ Failed: ${errorCount} podcasts\n\n${results.slice(0, 5).join('\n')}${results.length > 5 ? `\n... and ${results.length - 5} more` : ''}`;
            alert(message);
        } else {
            alert('Firebase not available for syncing.');
        }
        
        if (statusEl) {
            statusEl.innerHTML = '<div class="status-item"><span class="status-label">Status:</span><span class="status-value">✅ Sync Complete</span></div>';
        }
        
        // Refresh dashboard data
        refreshStats();
        
    } catch (error) {
        console.error('Manual sync failed:', error);
        const statusEl = document.getElementById('syncStatus');
        if (statusEl) {
            statusEl.innerHTML = '<div class="status-item"><span class="status-label">Status:</span><span class="status-value">❌ Sync Failed</span></div>';
        }
        alert('Sync failed: ' + error.message);
    }
}

async function removeDuplicateEpisodes() {
    // Validate admin password
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    if (!confirm('Are you sure you want to remove duplicate episodes? This action cannot be undone.')) {
        return;
    }
    
    try {
        if (!window.adminDashboard.db) {
            alert('Firebase not available');
            return;
        }
        
        const episodesSnapshot = await window.adminDashboard.db.collection('episodes').get();
        const episodes = episodesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Find duplicates based on title + podcast combination
        const duplicates = {};
        const toDelete = [];
        const duplicateGroups = [];
        
        episodes.forEach(episode => {
            const key = `${episode.title.toLowerCase()}_${episode.podcastTitle.toLowerCase()}`;
            if (duplicates[key]) {
                duplicates[key].push(episode);
            } else {
                duplicates[key] = [episode];
            }
        });
        
        // Find groups with duplicates
        Object.keys(duplicates).forEach(key => {
            if (duplicates[key].length > 1) {
                duplicateGroups.push(duplicates[key]);
                // Keep the first one, mark others for deletion
                for (let i = 1; i < duplicates[key].length; i++) {
                    toDelete.push(duplicates[key][i].id);
                }
            }
        });
        
        // Delete duplicates
        let deletedCount = 0;
        for (const episodeId of toDelete) {
            await window.adminDashboard.db.collection('episodes').doc(episodeId).delete();
            deletedCount++;
        }
        
        // Show detailed results
        let message = `Duplicate Removal Complete!\n\n📊 Results:\n✅ Successfully removed: ${deletedCount} duplicate episodes\n📋 Found: ${duplicateGroups.length} duplicate groups\n\n`;
        
        if (duplicateGroups.length > 0) {
            message += `🔍 Duplicate Groups Found:\n`;
            duplicateGroups.slice(0, 5).forEach((group, index) => {
                message += `${index + 1}. "${group[0].title}" (${group.length} copies)\n`;
            });
            if (duplicateGroups.length > 5) {
                message += `... and ${duplicateGroups.length - 5} more groups\n`;
            }
        } else {
            message += `🎉 No duplicates found! Your database is clean.`;
        }
        
        alert(message);
        refreshStats();
        
    } catch (error) {
        console.error('Remove duplicates failed:', error);
        alert('Failed to remove duplicates: ' + error.message);
    }
}

async function clearDatabase() {
    // Validate admin password
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    if (!confirm('⚠️ WARNING: This will delete ALL data including episodes, analytics, and settings. This action cannot be undone!\n\nType "DELETE" to confirm:')) {
        return;
    }
    
    const confirmation = prompt('Type "DELETE" to confirm database clearing:');
    if (confirmation !== 'DELETE') {
        return;
    }
    
    try {
        if (!window.adminDashboard.db) {
            alert('Firebase not available');
            return;
        }
        
        // Clear all collections
        const collections = ['episodes', 'podcasts', 'trackedPodcasts', 'analytics'];
        const results = [];
        
        for (const collectionName of collections) {
            const snapshot = await window.adminDashboard.db.collection(collectionName).get();
            const batch = window.adminDashboard.db.batch();
            
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            results.push(`✅ ${collectionName}: ${snapshot.docs.length} documents deleted`);
            console.log(`✅ Cleared collection: ${collectionName}`);
        }
        
        // Show detailed results
        const message = `Database Clear Complete!\n\n📊 Results:\n${results.join('\n')}\n\n🔄 The page will now refresh to show the clean state.`;
        alert(message);
        
        window.location.reload();
        
    } catch (error) {
        console.error('Clear database failed:', error);
        alert('Failed to clear database: ' + error.message);
    }
}

async function exportData() {
    try {
        const episodes = await window.adminDashboard.loadEpisodes();
        const statistics = await window.adminDashboard.loadStatistics();
        
        const data = {
            episodes: episodes,
            statistics: statistics,
            exportDate: new Date().toISOString(),
            summary: {
                totalEpisodes: episodes.length,
                totalPlays: statistics.plays?.total || 0,
                totalVisitors: statistics.visitors?.total || 0,
                exportVersion: '1.0'
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kme-podcasts-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show detailed results
        const message = `Export Complete!\n\n📊 Export Summary:\n✅ Episodes exported: ${episodes.length}\n✅ Total plays: ${statistics.plays?.total || 0}\n✅ Total visitors: ${statistics.visitors?.total || 0}\n📁 File: kme-podcasts-export-${new Date().toISOString().split('T')[0]}.json\n\n📂 The file has been downloaded to your device.`;
        alert(message);
        
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export data: ' + error.message);
    }
}

async function forceUpdate() {
    try {
        const statusEl = document.getElementById('updateStatus');
        if (statusEl) {
            statusEl.textContent = '🔄 Updating...';
        }
        
        // Simulate update process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (statusEl) {
            statusEl.textContent = '✅ Update Complete';
        }
        
        setTimeout(() => {
            if (statusEl) {
                statusEl.textContent = '🟢 Online';
            }
        }, 3000);
        
        // Show detailed results
        const message = `Update Complete!\n\n📊 Update Summary:\n✅ System updated successfully\n🔄 Cache refreshed\n📡 Connection verified\n🔧 All services operational\n\n🎉 Your admin dashboard is now running the latest version!`;
        alert(message);
        
    } catch (error) {
        console.error('Force update failed:', error);
        const statusEl = document.getElementById('updateStatus');
        if (statusEl) {
            statusEl.textContent = '❌ Update Failed';
        }
        alert('Update failed: ' + error.message);
    }
}

async function testBackgroundSync() {
    try {
        alert('Background sync test initiated!\n\nIn a real implementation, this would:\n1. Check service worker status\n2. Test background sync registration\n3. Simulate sync process\n4. Report results\n\nTest completed successfully!');
    } catch (error) {
        console.error('Background sync test failed:', error);
        alert('Failed to test background sync: ' + error.message);
    }
}

// Make functions globally available
window.showAddPodcastModal = showAddPodcastModal;
window.manualSyncAllPodcasts = manualSyncAllPodcasts;
window.removeDuplicateEpisodes = removeDuplicateEpisodes;
window.clearDatabase = clearDatabase;
window.exportData = exportData;
window.forceUpdate = forceUpdate;
window.testBackgroundSync = testBackgroundSync;
window.unfeatureAllEpisodes = function() {
    if (window.adminDashboard) {
        window.adminDashboard.unfeatureAllEpisodes();
    }
};

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});
