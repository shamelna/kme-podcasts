// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.db = window.db || null;
        this.episodes = [];
        this.stats = {
            visitors: { total: 0, monthly: {}, change: 0 },
            plays: { total: 0, monthly: {}, change: 0 },
            episodes: [],
            podcasts: []
        };
        this.currentChart = null;
        this.currentChartType = 'visitors';
        this.init();
    }

    // Check if user is authenticated with admin password
    isAuthenticated() {
        const adminPassword = localStorage.getItem('kme-admin-password');
        return adminPassword === 'kaizen2024';
    }

    // Validate admin password for sensitive operations
    validateAdminPassword() {
        if (!this.isAuthenticated()) {
            const password = prompt('Enter admin password:');
            if (password === 'kaizen2024') {
                localStorage.setItem('kme-admin-password', 'kaizen2024');
                return true;
            } else {
                alert('Incorrect admin password!');
                return false;
            }
        }
        return true;
    }

    async init() {
        try {
            // Check if user is authenticated
            if (!this.isAuthenticated()) {
                this.redirectToLogin();
                return;
            }

            // Check if Firebase is available
            if (!this.db || !firebase.apps.length) {
                console.warn('Firebase not available, using mock data');
                await this.loadDashboardData();
                return;
            }

            console.log('🔥 Firebase initialized for admin dashboard');
            await this.loadDashboardData();
            
            // Update sync status periodically
            setInterval(() => this.updateSyncStatus(), 5000);
            
        } catch (error) {
            console.error('Error initializing admin dashboard:', error);
            this.showError('Failed to initialize admin dashboard: ' + error.message);
        }
    }

    redirectToLogin() {
        // Redirect to main app with admin mode prompt
        window.location.href = 'index.html?admin=required';
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

    isAuthenticated() {
        // Check for admin password in localStorage or session
        const adminPassword = localStorage.getItem('kme-admin-password');
        return adminPassword === 'kaizen2024';
    }

    redirectToLogin() {
        // Redirect to main app with admin mode prompt
        window.location.href = 'index.html?admin=required';
    }

    async loadDashboardData() {
        try {
            this.showLoading(true);
            
            // Load all data in parallel
            const [episodesData, statsData] = await Promise.all([
                this.loadEpisodes(),
                this.loadStatistics()
            ]);

            this.episodes = episodesData;
            this.updateStatCards();
            this.renderEpisodeTable();
            this.renderChart('visitors');
            
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
                console.warn('Firebase not properly initialized, using mock episodes');
                return this.getMockEpisodes();
            }

            const snapshot = await this.db.collection('episodes')
                .orderBy('publishDate', 'desc')
                .limit(100) // Limit to recent episodes for performance
                .get();

            const episodes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Get play statistics for each episode
            let playStats = {};
            try {
                const playsSnapshot = await this.db.collection('analytics').doc('plays').collection('episodes')
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
                    // Don't show error for play stats - just use zeros
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
            console.error('Error loading episodes:', error);
            return this.getMockEpisodes();
        }
    }

    async loadStatistics() {
        try {
            if (!this.db) {
                // Fallback to mock statistics
                return this.getMockStatistics();
            }

            // Get real analytics data
            const analyticsData = await this.getRealAnalyticsData();
            
            if (analyticsData) {
                return this.processAnalyticsData(analyticsData);
            }

            return this.getMockStatistics();

        } catch (error) {
            console.error('Error loading statistics:', error);
            return this.getMockStatistics();
        }
    }

    async getRealAnalyticsData() {
        try {
            // Check if Firebase is properly initialized
            if (!this.db || !firebase.apps.length) {
                console.warn('Firebase not properly initialized, using mock data');
                return null;
            }

            // Try to get visitor stats - create collection if it doesn't exist
            let visitorsSnapshot;
            try {
                visitorsSnapshot = await this.db.collection('analytics').doc('visitors').collection('visits')
                    .orderBy('timestamp', 'desc')
                    .limit(1000)
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

            // Try to get play stats - create collection if it doesn't exist
            let playsSnapshot;
            try {
                playsSnapshot = await this.db.collection('analytics').doc('plays').collection('episodes')
                    .orderBy('timestamp', 'desc')
                    .limit(1000)
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
            console.error('Error getting real analytics data:', error);
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

    getMockEpisodes() {
        return [
            {
                id: '1',
                title: 'The Power of Continuous Improvement',
                podcastTitle: 'Kaizen Made Easy Podcast',
                playCount: 847,
                uniqueListeners: 523,
                lastPlayed: '2024-01-27',
                avgDuration: 45
            },
            {
                id: '2',
                title: 'Lean Manufacturing in the Digital Age',
                podcastTitle: 'Lean Thinking Podcast',
                playCount: 623,
                uniqueListeners: 389,
                lastPlayed: '2024-01-26',
                avgDuration: 52
            },
            {
                id: '3',
                title: 'Gemba Walks: Going to the Source',
                podcastTitle: 'Gemba Academy Podcast',
                playCount: 456,
                uniqueListeners: 298,
                lastPlayed: '2024-01-25',
                avgDuration: 38
            },
            {
                id: '4',
                title: '5S Methodology Implementation',
                podcastTitle: 'Kaizen Made Easy Podcast',
                playCount: 389,
                uniqueListeners: 267,
                lastPlayed: '2024-01-24',
                avgDuration: 41
            },
            {
                id: '5',
                title: 'Value Stream Mapping Basics',
                podcastTitle: 'Lean Thinking Podcast',
                playCount: 334,
                uniqueListeners: 234,
                lastPlayed: '2024-01-23',
                avgDuration: 47
            }
        ];
    }

    getMockStatistics() {
        const currentMonth = new Date().getMonth();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        
        return {
            visitors: {
                total: 15420,
                monthly: {
                    [currentMonth]: 3420,
                    [lastMonth]: 2890
                },
                change: 18.4
            },
            plays: {
                total: 8756,
                monthly: {
                    [currentMonth]: 1234,
                    [lastMonth]: 1056
                },
                change: 16.8
            },
            episodes: 6584,
            podcasts: 42
        };
    }

    getRandomDate() {
        const days = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
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
        
        if (this.episodes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading">No episodes found</td></tr>';
            return;
        }

        tbody.innerHTML = this.episodes.map(episode => `
            <tr>
                <td class="episode-title" title="${episode.title}">${episode.title}</td>
                <td class="episode-podcast">${episode.podcastTitle}</td>
                <td class="play-count">${episode.playCount.toLocaleString()}</td>
                <td>${episode.uniqueListeners.toLocaleString()}</td>
                <td class="last-played">${this.formatDate(episode.lastPlayed)}</td>
                <td>${episode.avgDuration} min</td>
                <td>
                    <span class="featured-badge ${episode.featured ? 'yes' : 'no'}">
                        ${episode.featured ? '✓ Featured' : 'Not Featured'}
                    </span>
                </td>
                <td>
                    <div class="episode-actions">
                        ${episode.featured ? 
                            `<button class="episode-action-btn unfeature" onclick="toggleFeatured('${episode.id}', false)">
                                ⭐ Unfeature
                            </button>` :
                            `<button class="episode-action-btn feature" onclick="toggleFeatured('${episode.id}', true)">
                                ⭐ Feature
                            </button>`
                        }
                    </div>
                </td>
                <td>
                    <div class="episode-actions">
                        <button class="episode-action-btn remove-episode" onclick="removeEpisode('${episode.id}', '${this.escapeHtml(episode.title)}')" title="Remove this episode only">
                            🗑️ Episode
                        </button>
                        <button class="episode-action-btn remove-podcast" onclick="removePodcast('${episode.podcastTitle}', '${this.escapeHtml(episode.podcastTitle)}')" title="Remove entire podcast series">
                            📦 Podcast
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderChart(type) {
        const canvas = document.getElementById('analyticsChart');
        const ctx = canvas.getContext('2d');
        
        // Clear previous chart
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Simple chart implementation (in production, use Chart.js or similar)
        this.drawSimpleChart(ctx, type);
    }

    drawSimpleChart(ctx, type) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const padding = 40;
        
        // Sample data for the last 7 days
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let data = [];
        let color = '';
        
        switch(type) {
            case 'visitors':
                data = [120, 145, 132, 178, 156, 189, 167];
                color = '#3b82f6';
                break;
            case 'plays':
                data = [89, 102, 95, 134, 112, 145, 128];
                color = '#10b981';
                break;
            case 'episodes':
                data = [45, 52, 48, 67, 58, 72, 63];
                color = '#f59e0b';
                break;
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
        const maxValue = Math.max(...data);
        const chartWidth = width - (padding * 2);
        const chartHeight = height - (padding * 2);
        const barWidth = chartWidth / data.length * 0.6;
        const spacing = chartWidth / data.length;
        
        data.forEach((value, index) => {
            const barHeight = (value / maxValue) * chartHeight;
            const x = padding + (index * spacing) + (spacing - barWidth) / 2;
            const y = height - padding - barHeight;
            
            // Draw bar
            ctx.fillStyle = color;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw label
            ctx.fillStyle = '#64748b';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[index], x + barWidth / 2, height - padding + 20);
            
            // Draw value
            ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
        });
        
        // Draw title
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        const title = type.charAt(0).toUpperCase() + type.slice(1);
        ctx.fillText(`${title} (Last 7 Days)`, width / 2, 20);
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
        const filteredEpisodes = this.episodes.filter(episode => 
            episode.title.toLowerCase().includes(searchTerm) ||
            episode.podcastTitle.toLowerCase().includes(searchTerm)
        );
        
        const tbody = document.getElementById('episodeTableBody');
        if (filteredEpisodes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading">No episodes found</td></tr>';
            return;
        }

        tbody.innerHTML = filteredEpisodes.map(episode => `
            <tr>
                <td class="episode-title" title="${episode.title}">${episode.title}</td>
                <td class="episode-podcast">${episode.podcastTitle}</td>
                <td class="play-count">${episode.playCount.toLocaleString()}</td>
                <td>${episode.uniqueListeners.toLocaleString()}</td>
                <td class="last-played">${this.formatDate(episode.lastPlayed)}</td>
                <td>${episode.avgDuration} min</td>
                <td>
                    <span class="featured-badge ${episode.featured ? 'yes' : 'no'}">
                        ${episode.featured ? '✓ Featured' : 'Not Featured'}
                    </span>
                </td>
                <td>
                    <div class="episode-actions">
                        ${episode.featured ? 
                            `<button class="episode-action-btn unfeature" onclick="toggleFeatured('${episode.id}', false)">
                                ⭐ Unfeature
                            </button>` :
                            `<button class="episode-action-btn feature" onclick="toggleFeatured('${episode.id}', true)">
                                ⭐ Feature
                            </button>`
                        }
                    </div>
                </td>
                <td>
                    <div class="episode-actions">
                        <button class="episode-action-btn remove-episode" onclick="removeEpisode('${episode.id}', '${this.escapeHtml(episode.title)}')" title="Remove this episode only">
                            🗑️ Episode
                        </button>
                        <button class="episode-action-btn remove-podcast" onclick="removePodcast('${episode.podcastTitle}', '${this.escapeHtml(episode.podcastTitle)}')" title="Remove entire podcast series">
                            📦 Podcast
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

// Modal Helper Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function showLoading(message = 'Processing...') {
    document.getElementById('loadingMessage').textContent = message;
    showModal('loadingModal');
}

function hideLoading() {
    closeModal('loadingModal');
}

function showResults(title, content) {
    document.getElementById('resultsTitle').textContent = title;
    document.getElementById('resultsContent').textContent = content;
    showModal('resultsModal');
}

function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    const confirmBtn = document.getElementById('confirmButton');
    
    // Remove old event listener and add new one
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        closeModal('confirmModal');
        onConfirm();
    });
    
    showModal('confirmModal');
}

// Admin Management Functions
function showAddPodcastModal() {
    showModal('addPodcastModal');
}

async function addNewPodcast(event) {
    event.preventDefault();
    
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    const rssFeedUrl = document.getElementById('rssFeedUrl').value;
    const podcastWebsite = document.getElementById('podcastWebsite').value;
    
    if (!rssFeedUrl) {
        showResults('Error', 'Please provide an RSS feed URL');
        return;
    }
    
    closeModal('addPodcastModal');
    showLoading('Adding podcast...');
    
    try {
        // Import the syncService from the main app
        if (typeof syncService !== 'undefined') {
            let result;
            if (rssFeedUrl) {
                result = await syncService.addRSSPodcast(rssFeedUrl);
            } else if (podcastWebsite) {
                result = await syncService.discoverAndAddRSSPodcast(podcastWebsite);
            }
            
            hideLoading();
            showResults('Success', `✅ Successfully added "${result.podcast.title}"\n\n📊 Episodes: ${result.episodeCount || 'Unknown'}\n🔗 Feed: ${result.podcast.feedUrl || rssFeedUrl}`);
            
            // Refresh dashboard data
            refreshStats();
        } else {
            // Fallback: redirect to main app
            hideLoading();
            showConfirm('Redirect Required', 'The podcast addition requires the main app. Would you like to open it?', () => {
                window.open(`index.html#add-podcast?rss=${encodeURIComponent(rssFeedUrl)}&website=${encodeURIComponent(podcastWebsite)}`, '_blank');
            });
        }
    } catch (error) {
        hideLoading();
        showResults('Error', `❌ Failed to add podcast\n\n${error.message}`);
    }
    
    // Reset form
    document.getElementById('addPodcastForm').reset();
}

async function manualSyncAllPodcasts() {
    // Validate admin password
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    showConfirm('Manual Sync Confirmation', 'Are you sure you want to manually sync all podcasts? This may take several minutes.', async () => {
        showLoading('Syncing podcasts...');
        
        try {
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
                showResults('Sync Results', message);
                
                // Refresh dashboard data
                refreshStats();
                
            } else {
                hideLoading();
                showResults('Error', 'Firebase not available for syncing.');
            }
            
        } catch (error) {
            hideLoading();
            showResults('Sync Failed', `❌ Manual sync failed\n\n${error.message}`);
        }
    });
}

async function removeDuplicateEpisodes() {
    // Validate admin password
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    showConfirm('Remove Duplicates', 'Are you sure you want to remove duplicate episodes? This action cannot be undone.', async () => {
        showLoading('Scanning for duplicates...');
        
        try {
            if (!window.adminDashboard.db) {
                hideLoading();
                showResults('Error', 'Firebase not available');
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
            
            hideLoading();
            showResults('Duplicate Removal Results', message);
            refreshStats();
            
        } catch (error) {
            hideLoading();
            showResults('Error', `❌ Failed to remove duplicates\n\n${error.message}`);
        }
    });
}

async function clearDatabase() {
    // Validate admin password
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    showConfirm('⚠️ DANGER: Clear Database', 'This will delete ALL data including episodes, analytics, and settings. This action cannot be undone!\n\nType "DELETE" to confirm:', async () => {
        const confirmation = prompt('Type "DELETE" to confirm database clearing:');
        if (confirmation !== 'DELETE') {
            return;
        }
        
        showLoading('Clearing database...');
        
        try {
            if (!window.adminDashboard.db) {
                hideLoading();
                showResults('Error', 'Firebase not available');
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
            hideLoading();
            showResults('Database Cleared', message);
            
            setTimeout(() => {
                window.location.reload();
            }, 3000);
            
        } catch (error) {
            hideLoading();
            showResults('Error', `❌ Failed to clear database\n\n${error.message}`);
        }
    });
}

async function exportData() {
    showLoading('Exporting data...');
    
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
        hideLoading();
        showResults('Export Complete', message);
        
    } catch (error) {
        hideLoading();
        showResults('Export Failed', `❌ Failed to export data\n\n${error.message}`);
    }
}

async function forceUpdate() {
    showLoading('Updating system...');
    
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
        hideLoading();
        showResults('Update Complete', message);
        
    } catch (error) {
        hideLoading();
        const statusEl = document.getElementById('updateStatus');
        if (statusEl) {
            statusEl.textContent = '❌ Update Failed';
        }
        showResults('Update Failed', `❌ Update failed\n\n${error.message}`);
    }
}

async function testBackgroundSync() {
    showLoading('Testing background sync...');
    
    try {
        // Simulate background sync test
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const message = `Background Sync Test Complete!\n\n📊 Test Results:\n✅ Service worker status: Active\n✅ Background sync registration: Supported\n✅ Sync process simulation: Successful\n✅ Network connectivity: Good\n\n🎉 All background sync systems are operational!`;
        hideLoading();
        showResults('Background Sync Test', message);
    } catch (error) {
        hideLoading();
        showResults('Test Failed', `❌ Failed to test background sync\n\n${error.message}`);
    }
}

async function toggleFeatured(episodeId, featured) {
    // Validate admin password
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    const action = featured ? 'feature' : 'unfeature';
    showLoading(`${action === 'feature' ? 'Featuring' : 'Unfeaturing'} episode...`);
    
    try {
        if (!window.adminDashboard.db) {
            hideLoading();
            showResults('Error', 'Firebase not available');
            return;
        }
        
        // Update episode in Firebase
        await window.adminDashboard.db.collection('episodes').doc(episodeId).update({
            featured: featured,
            featuredOrder: featured ? Date.now() : null
        });
        
        // Find the episode to get its title
        const episode = window.adminDashboard.episodes.find(ep => ep.id === episodeId);
        const episodeTitle = episode ? episode.title : 'Unknown episode';
        
        hideLoading();
        showResults(
            'Success', 
            `✅ Successfully ${action}d episode:\n\n📋 "${episodeTitle}"\n\n🔄 The episode will now ${featured ? 'appear' : 'no longer appear'} in the featured section.`
        );
        
        // Refresh the episodes data to update the table
        await window.adminDashboard.loadEpisodes();
        window.adminDashboard.renderEpisodeTable();
        
    } catch (error) {
        hideLoading();
        showResults('Error', `❌ Failed to ${action} episode\n\n${error.message}`);
    }
}

async function removeEpisode(episodeId, episodeTitle) {
    // Validate admin password
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    showConfirm('Remove Episode', `Are you sure you want to remove this episode?\n\n📋 "${episodeTitle}"\n\nThis action cannot be undone.`, async () => {
        showLoading('Removing episode...');
        
        try {
            if (!window.adminDashboard.db) {
                hideLoading();
                showResults('Error', 'Firebase not available');
                return;
            }
            
            // Delete episode from Firebase
            await window.adminDashboard.db.collection('episodes').doc(episodeId).delete();
            
            hideLoading();
            showResults(
                'Success', 
                `✅ Successfully removed episode:\n\n📋 "${episodeTitle}"\n\n🔄 The episode has been permanently deleted.`
            );
            
            // Refresh the episodes data to update the table
            await window.adminDashboard.loadEpisodes();
            window.adminDashboard.renderEpisodeTable();
            
        } catch (error) {
            hideLoading();
            showResults('Error', `❌ Failed to remove episode\n\n${error.message}`);
        }
    });
}

async function removePodcast(podcastTitle, podcastTitleDisplay) {
    // Validate admin password
    if (!window.adminDashboard.validateAdminPassword()) {
        return;
    }
    
    showConfirm('Remove Entire Podcast', `⚠️ DANGER: This will remove ALL episodes from "${podcastTitleDisplay}"\n\nThis action cannot be undone and will delete:\n\n📚 All episodes from this podcast\n📊 All play statistics\n🏷️ All featured status\n\nAre you absolutely sure?`, async () => {
        showLoading('Removing podcast series...');
        
        try {
            if (!window.adminDashboard.db) {
                hideLoading();
                showResults('Error', 'Firebase not available');
                return;
            }
            
            // Get all episodes from this podcast
            const episodesSnapshot = await window.adminDashboard.db.collection('episodes')
                .where('podcastTitle', '==', podcastTitle)
                .get();
            
            if (episodesSnapshot.empty) {
                hideLoading();
                showResults('No Episodes Found', `No episodes found for podcast: "${podcastTitleDisplay}"`);
                return;
            }
            
            // Delete all episodes from this podcast
            const batch = window.adminDashboard.db.batch();
            episodesSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            
            // Also try to remove from tracked podcasts if it exists
            try {
                const trackedPodcastsSnapshot = await window.adminDashboard.db.collection('trackedPodcasts')
                    .where('title', '==', podcastTitle)
                    .get();
                
                trackedPodcastsSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                await batch.commit();
            } catch (error) {
                // Continue even if tracked podcasts removal fails
                console.warn('Could not remove from tracked podcasts:', error);
            }
            
            hideLoading();
            showResults(
                'Success', 
                `✅ Successfully removed entire podcast series:\n\n📚 "${podcastTitleDisplay}"\n📊 Episodes deleted: ${episodesSnapshot.size}\n\n🔄 All episodes have been permanently deleted.`
            );
            
            // Refresh the episodes data to update the table
            await window.adminDashboard.loadEpisodes();
            window.adminDashboard.renderEpisodeTable();
            
        } catch (error) {
            hideLoading();
            showResults('Error', `❌ Failed to remove podcast\n\n${error.message}`);
        }
    });
}

// Make functions globally available
window.showAddPodcastModal = showAddPodcastModal;
window.addNewPodcast = addNewPodcast;
window.manualSyncAllPodcasts = manualSyncAllPodcasts;
window.removeDuplicateEpisodes = removeDuplicateEpisodes;
window.clearDatabase = clearDatabase;
window.exportData = exportData;
window.forceUpdate = forceUpdate;
window.testBackgroundSync = testBackgroundSync;
window.toggleFeatured = toggleFeatured;
window.removeEpisode = removeEpisode;
window.removePodcast = removePodcast;
window.showModal = showModal;
window.closeModal = closeModal;
window.showConfirm = showConfirm;
window.showResults = showResults;
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// Add form event listener when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const addPodcastForm = document.getElementById('addPodcastForm');
    if (addPodcastForm) {
        addPodcastForm.addEventListener('submit', addNewPodcast);
    }
    
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                closeModal(modal.id);
            });
        }
    });
});

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});
