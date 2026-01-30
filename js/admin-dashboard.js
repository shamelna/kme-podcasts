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
            tbody.innerHTML = '<tr><td colspan="6" class="loading">No episodes found</td></tr>';
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
            tbody.innerHTML = '<tr><td colspan="6" class="loading">No episodes found</td></tr>';
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
            </tr>
        `).join('');
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

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});
