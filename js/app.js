// Main application logic
class PodcastApp {
    constructor() {
        this.episodes = [];
        this.filteredEpisodes = [];
        this.featuredEpisodes = [];
        this.latestEpisodes = [];
        this.adminMode = false;
        this.allPodcasts = new Set();
        this.currentPage = 1;
        this.episodesPerPage = 50;
        this.totalEpisodes = 0;
        this.audioPlayer = null;
        this.playlist = [];
        this.currentEpisodeIndex = 0;
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.updateAdminPanel();
            console.log('🚀 Kaizen Podcast App initialized successfully');
            
            // Initialize auto-update service integration
            this.setupAutoUpdateIntegration();
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to load application');
        }
    }

    async loadData() {
        try {
            // Show loading states
            this.showLoading('featuredGrid', 'Loading featured episodes...');
            this.showLoading('latestGrid', 'Loading latest episodes...');
            this.showLoading('podcastGrid', 'Loading episode library...');

            // Load featured episodes
            this.featuredEpisodes = await podcastDB.getFeaturedEpisodes(10);
            console.log(`📊 Loaded ${this.featuredEpisodes.length} featured episodes`);
            this.displayFeaturedEpisodes();

            // Load latest episodes
            this.latestEpisodes = await podcastDB.getLatestEpisodes(10);
            console.log(`📊 Loaded ${this.latestEpisodes.length} latest episodes`);
            this.displayLatestEpisodes();

            // Load all episodes for main grid
            this.episodes = await podcastDB.searchEpisodes('');
            console.log(`📊 Loaded ${this.episodes.length} total episodes`);
            this.totalEpisodes = this.episodes.length; // Update totalEpisodes
            
            // Extract unique podcasts
            this.episodes.forEach(episode => {
                if (episode.podcastTitle) {
                    this.allPodcasts.add(episode.podcastTitle);
                }
            });
            
            console.log(`📊 Found ${this.allPodcasts.size} unique podcasts`);
            this.populateFilters();
            this.filterEpisodes();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load podcast data');
        }
    }

    showLoading(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div class="loading">${message}</div>`;
        }
    }

    displayFeaturedEpisodes() {
        const featuredGrid = document.getElementById('featuredGrid');
        
        if (this.featuredEpisodes.length === 0) {
            featuredGrid.innerHTML = '<p style="text-align: center; opacity: 0.8;">No featured episodes yet</p>';
            return;
        }

        featuredGrid.innerHTML = this.featuredEpisodes.map(episode => `
            <div class="featured-card" onclick="app.playEpisode('${episode.id}')">
                <div class="featured-card-title">${this.escapeHtml(episode.title)}</div>
                <div class="featured-card-podcast">${this.escapeHtml(episode.podcastTitle)}</div>
                <div class="featured-card-date">${this.formatDate(episode.publishDate)}</div>
            </div>
        `).join('');
    }

    displayLatestEpisodes() {
        const latestGrid = document.getElementById('latestGrid');
        
        if (this.latestEpisodes.length === 0) {
            latestGrid.innerHTML = '<p style="text-align: center; opacity: 0.8;">No episodes available</p>';
            return;
        }

        latestGrid.innerHTML = this.latestEpisodes.map(episode => `
            <div class="latest-card" onclick="app.playEpisode('${episode.id}')">
                <div class="latest-card-channel">${this.escapeHtml(episode.podcastTitle)}</div>
                <div class="latest-card-title">${this.escapeHtml(episode.title)}</div>
                <div class="latest-card-date">${this.formatDate(episode.publishDate)}</div>
            </div>
        `).join('');
    }

    filterEpisodes() {
        const searchInput = document.getElementById('searchInput');
        const podcastFilter = document.getElementById('podcastFilter');
        const sortFilter = document.getElementById('sortFilter');
        
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const podcastValue = podcastFilter ? podcastFilter.value : '';
        const sortValue = sortFilter ? sortFilter.value : 'date-desc';

        // Reset to first page when filters change
        this.currentPage = 1;

        this.filteredEpisodes = this.episodes.filter(episode => {
            const matchesSearch = !searchTerm || 
                episode.title.toLowerCase().includes(searchTerm) ||
                episode.description.toLowerCase().includes(searchTerm) ||
                episode.podcastTitle.toLowerCase().includes(searchTerm);

            const matchesPodcast = !podcastValue || episode.podcastTitle === podcastValue;
            const matchesTopic = true; // Removed topic filter

            return matchesSearch && matchesPodcast && matchesTopic;
        });

        this.sortEpisodes();
        this.displayEpisodes();
    }

    sortEpisodes() {
        const sortFilter = document.getElementById('sortFilter');
        const sortValue = sortFilter ? sortFilter.value : 'date-desc';

        switch(sortValue) {
            case 'date-desc':
                this.filteredEpisodes.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
                break;
            case 'date-asc':
                this.filteredEpisodes.sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate));
                break;
            case 'title-asc':
                this.filteredEpisodes.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title-desc':
                this.filteredEpisodes.sort((a, b) => b.title.localeCompare(a.title));
                break;
        }
    }

    displayEpisodes() {
        const podcastGrid = document.getElementById('podcastGrid');
        if (!podcastGrid) {
            console.error('Podcast grid element not found');
            return;
        }

        const filteredEpisodes = this.getFilteredEpisodes();
        const paginatedEpisodes = this.getPaginatedEpisodes(filteredEpisodes);
        
        // Update top pagination
        this.updatePagination(filteredEpisodes.length, 'top');
        
        // Clear and populate episode grid
        podcastGrid.innerHTML = '';
        
        if (paginatedEpisodes.length === 0) {
            podcastGrid.innerHTML = `
                <div class="no-results">
                    <h3>No episodes found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }
        
        // Add episodes
        paginatedEpisodes.forEach(episode => {
            const episodeCard = this.createEpisodeCard(episode);
            podcastGrid.appendChild(episodeCard);
        });
        
        // Update bottom pagination
        this.updatePagination(filteredEpisodes.length, 'bottom');
    }

    getFilteredEpisodes() {
        return this.filteredEpisodes;
    }

    getPaginatedEpisodes(episodes) {
        const startIndex = (this.currentPage - 1) * this.episodesPerPage;
        const endIndex = Math.min(startIndex + this.episodesPerPage, episodes.length);
        return episodes.slice(startIndex, endIndex);
    }

    createEpisodeCard(episode) {
        const episodeCard = document.createElement('div');
        episodeCard.className = 'podcast-card';
        
        // Check favorites and watch later (local storage for now)
        const isFavorite = this.isFavoriteLocal(episode.id);
        const isWatchLater = this.isWatchLaterLocal(episode.id);
        
        episodeCard.innerHTML = `
            ${episode.image ? `<img src="${episode.image}" alt="${this.escapeHtml(episode.title)}" class="podcast-image">` : ''}
            <div class="podcast-title">${this.escapeHtml(episode.title)}</div>
            <div class="podcast-channel">📻 ${this.escapeHtml(episode.podcastTitle)}</div>
            <div class="podcast-date">📅 ${this.formatDate(episode.publishDate)}</div>
            <div class="podcast-links">
                <button class="podcast-link play-btn" onclick="app.playEpisode('${episode.id}')" title="Play Episode">
                    <span class="btn-icon">▶️</span> Play
                </button>
                <button class="podcast-link playlist-btn" onclick="app.addToPlaylist('${episode.id}')" title="Add to Playlist">
                    <span class="btn-icon">➕</span> Add to Playlist
                </button>
                <button class="podcast-link favorite-btn ${isFavorite ? 'favorited' : ''}" onclick="app.toggleFavorite('${episode.id}')" title="${isFavorite ? 'Remove from' : 'Add to'} Favorites">
                    <span class="btn-icon">${isFavorite ? '❤️' : '🤍'}</span>
                    ${isFavorite ? 'Favorited' : 'Favorite'}
                </button>
                <button class="podcast-link watchlater-btn ${isWatchLater ? 'watching' : ''}" onclick="app.toggleWatchLater('${episode.id}')" title="${isWatchLater ? 'Remove from' : 'Add to'} Watch Later">
                    <span class="btn-icon">${isWatchLater ? '⏰' : '🕐'}</span>
                    ${isWatchLater ? 'Watching' : 'Watch Later'}
                </button>
            </div>
            <div class="admin-controls-card ${this.adminMode ? 'active' : ''}" id="admin-${episode.id}">
                ${episode.featured ? 
                    `<button class="admin-btn-small unfeature" onclick="app.unfeatureEpisode('${episode.id}')">Unfeature</button>` :
                    `<button class="admin-btn-small feature" onclick="app.featureEpisode('${episode.id}')">Feature</button>`
                }
                <button class="admin-btn-small" onclick="app.deleteEpisode('${episode.id}')">Delete</button>
            </div>
        `;
        
        return episodeCard;
    }

    updatePagination(totalEpisodes, position = 'bottom') {
        const paginationContainer = position === 'top' 
            ? document.getElementById('topPaginationContainer')
            : document.getElementById('paginationContainer');
            
        if (!paginationContainer) {
            console.warn(`${position} pagination container not found`);
            return;
        }

        const totalPages = Math.ceil(totalEpisodes / this.episodesPerPage);
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="pagination-controls">';
        
        // Previous button
        if (this.currentPage > 1) {
            paginationHTML += `
                <button class="pagination-btn" onclick="app.goToPage(${this.currentPage - 1})">
                    ← Previous
                </button>
            `;
        }

        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="app.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage;
            paginationHTML += `
                <button class="pagination-btn ${isActive ? 'active' : ''}" onclick="app.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHTML += `<button class="pagination-btn" onclick="app.goToPage(${totalPages})">${totalPages}</button>`;
        }

        // Next button
        if (this.currentPage < totalPages) {
            paginationHTML += `
                <button class="pagination-btn" onclick="app.goToPage(${this.currentPage + 1})">
                    Next →
                </button>
            `;
        }

        paginationHTML += '</div>';
        
        // Add pagination info
        paginationHTML += `
            <div class="pagination-info">
                Showing ${((this.currentPage - 1) * this.episodesPerPage) + 1}-${Math.min(this.currentPage * this.episodesPerPage, totalEpisodes)} of ${totalEpisodes} episodes
            </div>
        `;

        paginationContainer.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.displayEpisodes();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    async syncAllPodcasts() {
        const statusEl = document.getElementById('syncStatus');
        statusEl.textContent = 'Syncing...';
        statusEl.className = 'sync-status';

        try {
            const result = await syncService.syncAllTrackedPodcasts();
            
            if (result.failed > 0) {
                statusEl.textContent = `Sync completed: ${result.successful} success, ${result.failed} failed`;
                statusEl.className = 'sync-status error';
            } else {
                statusEl.textContent = `Sync completed: ${result.successful} podcasts synced`;
                statusEl.className = 'sync-status';
            }

            // Reload data
            await this.loadData();
        } catch (error) {
            console.error('Sync error:', error);
            statusEl.textContent = 'Sync failed';
            statusEl.className = 'sync-status error';
        }
    }

    async addNewPodcast(event) {
        event.preventDefault();
        
        try {
            console.log('🎯 Starting addNewPodcast process...');
            
            // Handle RSS feed addition only
            const rssFeedUrl = document.getElementById('rssFeedUrl').value;
            const podcastWebsite = document.getElementById('podcastWebsite').value;
            
            if (rssFeedUrl) {
                console.log('🔗 Adding RSS podcast from URL:', rssFeedUrl);
                const result = await syncService.addRSSPodcast(rssFeedUrl);
                console.log('✅ Podcast added successfully:', result.podcast.title);
                alert(`Successfully added "${result.podcast.title}"`);
            } else if (podcastWebsite) {
                console.log('🔍 Discovering RSS from website:', podcastWebsite);
                const result = await syncService.discoverAndAddRSSPodcast(podcastWebsite);
                console.log('✅ Podcast discovered and added:', result.podcast.title);
                alert(`Successfully added "${result.podcast.title}"`);
            } else {
                throw new Error('Please provide an RSS feed URL or podcast website');
            }
            
            console.log('🔄 Closing modal...');
            this.toggleAddPodcastModal();
            
            // Force reload with a small delay to ensure Firebase has updated
            console.log('🔄 Starting reload process after adding podcast...');
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log('⏱️ Delay completed, calling loadData()...');
                await this.loadData();
                console.log('✅ Data reload completed successfully');
            } catch (reloadError) {
                console.error('❌ Error during data reload:', reloadError);
            }
            
            console.log('🎉 addNewPodcast process completed');
        } catch (error) {
            console.error('❌ Error in addNewPodcast:', error);
            alert(`Error adding podcast: ${error.message}`);
        }
    }

    async featureEpisode(episodeId) {
        try {
            await syncService.featureEpisode(episodeId);
            
            // Update local data
            const episode = this.episodes.find(e => e.id === episodeId);
            if (episode) {
                episode.featured = true;
                this.featuredEpisodes.push(episode);
            }
            
            this.displayFeaturedEpisodes();
            this.displayEpisodes();
        } catch (error) {
            console.error('Error featuring episode:', error);
            alert('Error featuring episode');
        }
    }

    async unfeatureEpisode(episodeId) {
        try {
            await syncService.unfeatureEpisode(episodeId);
            
            // Update local data
            const episode = this.episodes.find(e => e.id === episodeId);
            if (episode) {
                episode.featured = false;
                this.featuredEpisodes = this.featuredEpisodes.filter(e => e.id !== episodeId);
            }
            
            this.displayFeaturedEpisodes();
            this.displayEpisodes();
        } catch (error) {
            console.error('Error unfeaturing episode:', error);
            alert('Error unfeaturing episode');
        }
    }

    toggleAddPodcastModal() {
        const modal = document.getElementById('addPodcastModal');
        if (modal) {
            modal.classList.toggle('active');
        }
    }

    // Manual sync function for admin panel
    async manualSyncAllPodcasts() {
        try {
            console.log('🔄 Manual sync triggered by admin');
            const statusEl = document.getElementById('syncStatus');
            if (statusEl) {
                statusEl.textContent = 'Manually syncing...';
                statusEl.className = 'sync-status';
            }

            // Use the same logic as auto-update but force refresh
            const allPodcasts = await podcastDB.getAllPodcasts();
            console.log(`📊 Found ${allPodcasts.length} podcasts to manually sync`);
            
            let successCount = 0;
            let failCount = 0;
            
            for (const podcast of allPodcasts) {
                try {
                    console.log(`🔄 Manually syncing: ${podcast.title}`);
                    if (podcast.feedUrl) {
                        const result = await syncService.syncPodcast(podcast.feedUrl || podcast.id, 50);
                        if (result.success) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                    }
                } catch (error) {
                    console.error(`❌ Failed to sync ${podcast.title}:`, error);
                    failCount++;
                }
            }
            
            // Show final status
            if (statusEl) {
                statusEl.textContent = `Manual sync complete: ${successCount} success, ${failCount} failed`;
                statusEl.className = failCount > 0 ? 'sync-status error' : 'sync-status';
            }
            
            // Reload data to show updates
            await this.loadData();
            
        } catch (error) {
            console.error('❌ Manual sync error:', error);
            const statusEl = document.getElementById('syncStatus');
            if (statusEl) {
                statusEl.textContent = 'Manual sync failed';
                statusEl.className = 'sync-status error';
            }
        }
    }

    toggleAdminMode() {
        this.adminMode = !this.adminMode;
        
        // Toggle admin panel visibility
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            if (this.adminMode) {
                adminPanel.classList.add('active');
                console.log('👨‍💼 Admin panel shown');
            } else {
                adminPanel.classList.remove('active');
                console.log('👨‍💼 Admin panel hidden');
            }
        }
        
        // Toggle admin controls on cards
        const adminControls = document.querySelectorAll('.admin-controls-card');
        adminControls.forEach(control => {
            if (this.adminMode) {
                control.classList.add('active');
            } else {
                control.classList.remove('active');
            }
        });
    }

    updateAdminPanel() {
        const adminPanel = document.getElementById('adminPanel');
        if (!adminPanel) {
            console.warn('Admin panel element not found');
            return;
        }
        
        // Check legacy password for admin access
        const adminPassword = localStorage.getItem('kme-admin-password');
        if (adminPassword === 'kaizen2024') {
            adminPanel.classList.add('active');
            console.log('👨‍💼 Admin panel activated with password');
        } else {
            adminPanel.classList.remove('active');
        }
    }

    // UI helper functions
    populateFilters() {
        const podcastFilter = document.getElementById('podcastFilter');
        [...this.allPodcasts].sort().forEach(podcast => {
            const option = document.createElement('option');
            option.value = podcast;
            option.textContent = podcast;
            podcastFilter.appendChild(option);
        });
    }

    filterByTag(tag) {
        // Topic filter removed - this method is no longer used
        console.log('Topic filtering has been removed');
    }

    clearFilters() {
        const searchInput = document.getElementById('searchInput');
        const podcastFilter = document.getElementById('podcastFilter');
        const sortFilter = document.getElementById('sortFilter');
        
        if (searchInput) searchInput.value = '';
        if (podcastFilter) podcastFilter.value = '';
        if (sortFilter) sortFilter.value = 'date-desc';
        this.filterEpisodes();
    }

    scrollToEpisode(episodeId) {
        const element = document.getElementById(`episode-${episodeId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.animation = 'pulse 2s';
            setTimeout(() => {
                element.style.animation = '';
            }, 2000);
        }
    }

    playEpisode(episodeId) {
        const episode = this.episodes.find(e => e.id === episodeId);
        if (episode && episode.audioUrl) {
            window.open(episode.audioUrl, '_blank');
        }
    }

    formatDate(dateString) {
        if (!dateString) {
            return 'No date available';
        }
        
        try {
            // Handle different date formats
            let date;
            
            // If it's a Firebase Timestamp
            if (dateString && typeof dateString === 'object' && dateString.toDate) {
                date = dateString.toDate();
            }
            // If it's a timestamp with seconds
            else if (dateString && typeof dateString === 'object' && dateString.seconds) {
                date = new Date(dateString.seconds * 1000);
            }
            // If it's already a Date object
            else if (dateString instanceof Date) {
                date = dateString;
            }
            // If it's a string
            else {
                date = new Date(dateString);
            }
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                return 'Invalid Date';
            }
            
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.warn('Date formatting error:', error, 'for date:', dateString);
            return 'Invalid Date';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        const grid = document.getElementById('podcastGrid');
        grid.innerHTML = `
            <div class="no-results">
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
    }

    buildPaginationControls(totalPages) {
        let paginationHtml = `
            <div class="pagination-container">
                <div class="pagination-info">
                    <span>Page ${this.currentPage} of ${totalPages}</span>
                </div>
                <div class="pagination-controls">
        `;

        // Previous button
        if (this.currentPage > 1) {
            paginationHtml += `
                <button class="pagination-btn" onclick="app.goToPage(${this.currentPage - 1})" title="Previous Page">
                    <span>‹</span>
                </button>
            `;
        }

        // Page number buttons
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        // Adjust if we're near the end
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // Always show first page
        if (startPage > 1) {
            paginationHtml += `
                <button class="pagination-btn ${this.currentPage === 1 ? 'active' : ''}" onclick="app.goToPage(1)">1</button>
                `;
            if (startPage > 2) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        // Show page range
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <button class="pagination-btn ${this.currentPage === i ? 'active' : ''}" onclick="app.goToPage(${i})">${i}</button>
            `;
        }

        // Always show last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHtml += `
                <button class="pagination-btn ${this.currentPage === totalPages ? 'active' : ''}" onclick="app.goToPage(${totalPages})">${totalPages}</button>
                `;
        }

        // Next button
        if (this.currentPage < totalPages) {
            paginationHtml += `
                <button class="pagination-btn" onclick="app.goToPage(${this.currentPage + 1})" title="Next Page">
                    <span>›</span>
                </button>
            `;
        }

        paginationHtml += `
                </div>
            </div>
        `;

        return paginationHtml;
    }

    goToPage(page) {
        if (page >= 1 && page <= Math.ceil(this.totalEpisodes / this.episodesPerPage)) {
            this.currentPage = page;
            this.displayEpisodes();
            
            // Smooth scroll to top
            setTimeout(() => {
                document.getElementById('podcastGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }

    loadMoreEpisodes() {
        this.goToPage(this.currentPage + 1);
    }

    // Audio Player Methods
    playEpisode(episodeId) {
        const episode = this.episodes.find(e => e.id === episodeId);
        if (!episode || !episode.audioUrl) {
            alert('Episode not available for playback');
            return;
        }

        // Add to playlist if not already there
        if (!this.playlist.find(e => e.id === episodeId)) {
            this.playlist.push(episode);
        }

        // Initialize audio player if not already done
        if (!this.audioPlayer) {
            this.audioPlayer = document.getElementById('audioPlayer');
            this.setupAudioPlayerEvents();
        }

        // Load and play the episode
        this.audioPlayer.src = episode.audioUrl;
        this.audioPlayer.play();
        
        // Update player UI
        this.updatePlayerUI(episode);
        
        // Show player
        this.showAudioPlayer();
        
        console.log(`Playing episode: ${episode.title}`);
    }

    addToPlaylist(episodeId) {
        const episode = this.episodes.find(e => e.id === episodeId);
        if (!episode) return;

        // Check if already in playlist
        if (this.playlist.find(e => e.id === episodeId)) {
            console.log('Episode already in playlist');
            return;
        }

        this.playlist.push(episode);
        console.log(`Added to playlist: ${episode.title}`);
        
        // Only update UI if playlist container exists
        const container = document.getElementById('playlistContainer');
        if (container) {
            this.updatePlaylistUI();
        }
        
        // Show playlist sidebar if it exists
        const sidebar = document.getElementById('playlistSidebar');
        if (sidebar) {
            this.showPlaylistSidebar();
        }
    }

    removeFromPlaylist(episodeId) {
        this.playlist = this.playlist.filter(e => e.id !== episodeId);
        this.updatePlaylistUI();
        console.log(`Removed from playlist`);
    }

    clearPlaylist() {
        this.playlist = [];
        this.updatePlaylistUI();
        console.log('Playlist cleared');
    }

    shufflePlaylist() {
        if (this.playlist.length === 0) return;
        
        for (let i = this.playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
        }
        
        this.updatePlaylistUI();
        console.log('Playlist shuffled');
    }

    setupAudioPlayerEvents() {
        if (!this.audioPlayer) return;

        this.audioPlayer.addEventListener('ended', () => {
            this.playNext();
        });

        this.audioPlayer.addEventListener('error', (e) => {
            console.error('Audio player error:', e);
        });

        this.audioPlayer.addEventListener('loadstart', () => {
            console.log('Audio loading...');
        });

        this.audioPlayer.addEventListener('canplay', () => {
            console.log('Audio ready to play');
        });
    }

    playNext() {
        if (this.playlist.length === 0) return;
        
        this.currentEpisodeIndex = (this.currentEpisodeIndex + 1) % this.playlist.length;
        const nextEpisode = this.playlist[this.currentEpisodeIndex];
        
        this.audioPlayer.src = nextEpisode.audioUrl;
        this.audioPlayer.play();
        this.updatePlayerUI(nextEpisode);
        this.updatePlaylistUI();
    }

    playPrevious() {
        if (this.playlist.length === 0) return;
        
        this.currentEpisodeIndex = this.currentEpisodeIndex === 0 ? 
            this.playlist.length - 1 : this.currentEpisodeIndex - 1;
        const prevEpisode = this.playlist[this.currentEpisodeIndex];
        
        this.audioPlayer.src = prevEpisode.audioUrl;
        this.audioPlayer.play();
        this.updatePlayerUI(prevEpisode);
        this.updatePlaylistUI();
    }

    updatePlayerUI(episode) {
        const playerTitle = document.getElementById('playerTitle');
        const playerPodcast = document.getElementById('playerPodcast');
        
        if (playerTitle) playerTitle.textContent = episode.title;
        if (playerPodcast) playerPodcast.textContent = episode.podcastTitle;
        
        // Update current episode index in playlist
        const index = this.playlist.findIndex(e => e.id === episode.id);
        if (index !== -1) {
            this.currentEpisodeIndex = index;
        }
    }

    updatePlaylistUI() {
        const container = document.getElementById('playlistContainer');
        
        if (!container) {
            console.warn('Playlist container not found');
            return;
        }
        
        if (this.playlist.length === 0) {
            container.innerHTML = '<div class="playlist-empty">Your playlist is empty</div>';
            return;
        }

        container.innerHTML = this.playlist.map((episode, index) => `
            <div class="playlist-item ${index === this.currentEpisodeIndex ? 'playing' : ''}" onclick="app.playFromPlaylist(${index})">
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${this.escapeHtml(episode.title)}</div>
                    <div class="playlist-item-podcast">${this.escapeHtml(episode.podcastTitle)}</div>
                </div>
                <button class="playlist-item-remove" onclick="event.stopPropagation(); app.removeFromPlaylist('${episode.id}')" title="Remove">
                    ✕
                </button>
            </div>
        `).join('');
    }

    shufflePlaylist() {
        if (this.playlist.length === 0) return;
        
        for (let i = this.playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
        }
        
        this.updatePlaylistUI();
        console.log('Playlist shuffled');
    }

setupAudioPlayerEvents() {
        if (!this.audioPlayer) return;

        this.audioPlayer.addEventListener('ended', () => {
            this.playNext();
        });

        this.audioPlayer.addEventListener('error', (e) => {
            console.error('Audio player error:', e);
        });

        this.audioPlayer.addEventListener('loadstart', () => {
            console.log('Audio loading...');
        });

        this.audioPlayer.addEventListener('canplay', () => {
            console.log('Audio ready to play');
        });
    }

    playNext() {
        if (this.playlist.length === 0) return;
        
        this.currentEpisodeIndex = (this.currentEpisodeIndex + 1) % this.playlist.length;
        const nextEpisode = this.playlist[this.currentEpisodeIndex];
        
        this.audioPlayer.src = nextEpisode.audioUrl;
        this.audioPlayer.play();
        this.updatePlayerUI(nextEpisode);
        this.updatePlaylistUI();
    }

    playPrevious() {
        if (this.playlist.length === 0) return;
        
        this.currentEpisodeIndex = this.currentEpisodeIndex === 0 ? 
            this.playlist.length - 1 : this.currentEpisodeIndex - 1;
        const prevEpisode = this.playlist[this.currentEpisodeIndex];
        
        this.audioPlayer.src = prevEpisode.audioUrl;
        this.audioPlayer.play();
        this.updatePlayerUI(prevEpisode);
        this.updatePlaylistUI();
    }

playFromPlaylist(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        this.currentEpisodeIndex = index;
        const episode = this.playlist[index];
        
        if (!this.audioPlayer) {
            this.audioPlayer = document.getElementById('audioPlayer');
            this.setupAudioPlayerEvents();
        }
        
        this.audioPlayer.src = episode.audioUrl;
        this.audioPlayer.play();
        this.updatePlayerUI(episode);
        this.updatePlaylistUI();
    }

    showAudioPlayer() {
        const player = document.getElementById('audioPlayerContainer');
        if (player) {
            player.classList.add('active');
            // Add padding to body to prevent content from being hidden behind player
            document.body.style.paddingBottom = '80px';
        }
    }

    closeAudioPlayer() {
        const player = document.getElementById('audioPlayerContainer');
        if (player) {
            player.classList.remove('active');
            // Remove padding from body
            document.body.style.paddingBottom = '';
        }
        
        if (this.audioPlayer) {
            this.audioPlayer.pause();
        }
    }

    showPlaylistSidebar() {
        const sidebar = document.getElementById('playlistSidebar');
        if (sidebar) {
            sidebar.classList.add('active');
        }
    }

    hidePlaylistSidebar() {
        const sidebar = document.getElementById('playlistSidebar');
        if (sidebar) {
            sidebar.classList.remove('active');
        }
    }

    togglePlaylist() {
        const sidebar = document.getElementById('playlistSidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            this.hidePlaylistSidebar();
        } else {
            this.showPlaylistSidebar();
        }
    }


    // Local storage methods for favorites and watch later
    isFavoriteLocal(episodeId) {
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        return favorites.includes(episodeId);
    }

    isWatchLaterLocal(episodeId) {
        const watchLater = JSON.parse(localStorage.getItem('watchLater') || '[]');
        return watchLater.includes(episodeId);
    }

    addFavoriteEpisode(episodeId) {
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        if (!favorites.includes(episodeId)) {
            favorites.push(episodeId);
            localStorage.setItem('favorites', JSON.stringify(favorites));
        }
        this.displayEpisodes();
    }

    removeFavoriteEpisode(episodeId) {
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        const index = favorites.indexOf(episodeId);
        if (index > -1) {
            favorites.splice(index, 1);
            localStorage.setItem('favorites', JSON.stringify(favorites));
        }
        this.displayEpisodes();
    }

    addWatchLater(episodeId) {
        const watchLater = JSON.parse(localStorage.getItem('watchLater') || '[]');
        if (!watchLater.includes(episodeId)) {
            watchLater.push(episodeId);
            localStorage.setItem('watchLater', JSON.stringify(watchLater));
        }
        this.displayEpisodes();
    }

    removeWatchLater(episodeId) {
        const watchLater = JSON.parse(localStorage.getItem('watchLater') || '[]');
        const index = watchLater.indexOf(episodeId);
        if (index > -1) {
            watchLater.splice(index, 1);
            localStorage.setItem('watchLater', JSON.stringify(watchLater));
        }
        this.displayEpisodes();
    }

    toggleFavorite(episodeId) {
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        const index = favorites.indexOf(episodeId);
        if (index > -1) {
            favorites.splice(index, 1);
        } else {
            favorites.push(episodeId);
        }
        localStorage.setItem('favorites', JSON.stringify(favorites));
        this.displayEpisodes();
    }

    toggleWatchLater(episodeId) {
        const watchLater = JSON.parse(localStorage.getItem('watchLater') || '[]');
        const index = watchLater.indexOf(episodeId);
        if (index > -1) {
            watchLater.splice(index, 1);
        } else {
            watchLater.push(episodeId);
        }
        localStorage.setItem('watchLater', JSON.stringify(watchLater));
        this.displayEpisodes();
    }

    setupAutoUpdateIntegration() {
        // Listen for messages from service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                switch (event.data.type) {
                    case 'NEW_EPISODES':
                        this.handleBackgroundEpisodes(event.data.episodes);
                        break;
                    case 'NEW_EPISODE_ALERT':
                        this.handleNewEpisodeAlert(event.data.podcast, event.data.episode);
                        break;
                }
            });
        }
        
        // Request notification permission if not granted
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ Notification permission granted');
                }
            });
        }
        
        // Add update controls to admin panel
        this.addUpdateControls();
    }

    handleBackgroundEpisodes(episodes) {
        console.log(`📱 Background sync found ${episodes.length} new episodes`);
        
        // Add new episodes to the existing episodes array
        if (episodes && episodes.length > 0) {
            episodes.forEach(podcastData => {
                if (podcastData.episodes && podcastData.episodes.length > 0) {
                    podcastData.episodes.forEach(episode => {
                        // Check if episode already exists
                        const exists = this.episodes.find(ep => ep.id === episode.id);
                        if (!exists) {
                            this.episodes.push({
                                ...episode,
                                isNew: true
                            });
                        }
                    });
                }
            });
            
            // Update display without full reload
            this.displayEpisodes();
            
            // Show notification
            this.showUpdateNotification(
                episodes.reduce((total, pod) => total + (pod.episodes ? pod.episodes.length : 0), 0),
                'New episodes available'
            );
        }
    }

    handleNewEpisodeAlert(podcastName, episode) {
        console.log(`🔔 New episode alert: ${episode.title} from ${podcastName}`);
        
        // Show prominent notification for new episode
        const alertDiv = document.createElement('div');
        alertDiv.className = 'new-episode-alert';
        alertDiv.innerHTML = `
            <div class="alert-content">
                <span class="alert-icon">🎵</span>
                <div class="alert-text">
                    <strong>New Episode!</strong><br>
                    ${episode.title}<br>
                    <small>from ${podcastName}</small>
                </div>
                <button class="alert-close" onclick="this.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 8000);
    }

    addUpdateControls() {
        // Add update controls to the admin panel
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            const updateControls = document.createElement('div');
            updateControls.className = 'update-controls';
            updateControls.innerHTML = `
                <div class="update-controls-header">
                    <span class="update-title">🔄 Auto-Updates</span>
                    <button class="update-btn primary" onclick="window.autoUpdateService.forceUpdate()">
                        <span class="btn-icon">🔄</span> Check Now
                    </button>
                </div>
                <div class="update-stats" id="updateStats">
                    <div class="stat-item">
                        <span class="stat-label">Status:</span>
                        <span class="stat-value" id="updateStatus">Initializing...</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Last Sync:</span>
                        <span class="stat-value" id="lastSyncTime">Never</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Cache:</span>
                        <span class="stat-value" id="cacheSize">0 items</span>
                    </div>
                </div>
            `;
            
            adminPanel.appendChild(updateControls);
            
            // Update stats periodically
            setInterval(() => this.updateUpdateStats(), 5000);
        }
    }

    updateUpdateStats() {
        if (window.autoUpdateService) {
            const stats = window.autoUpdateService.getUpdateStats();
            const statusEl = document.getElementById('updateStatus');
            const lastSyncEl = document.getElementById('lastSyncTime');
            const cacheEl = document.getElementById('cacheSize');
            
            if (statusEl) statusEl.textContent = stats.isOnline ? '🟢 Online' : '🔴 Offline';
            if (lastSyncEl) {
                const timeDiff = stats.minutesSinceLastSync;
                lastSyncEl.textContent = timeDiff < 1 ? 'Just now' : `${timeDiff} minutes ago`;
            }
            if (cacheEl) cacheEl.textContent = `${stats.cacheSize} items`;
        }
    }

    showUpdateNotification(count, message) {
        const notification = document.createElement('div');
        notification.className = 'update-notification bulk-update';
        notification.innerHTML = `
            <div class="update-content">
                <span class="update-icon">📊</span>
                <div class="update-text">
                    <strong>${count} updates</strong><br>
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
    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const podcastFilter = document.getElementById('podcastFilter');
        const sortFilter = document.getElementById('sortFilter');
        const clearFilters = document.getElementById('clearFilters');
        
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterEpisodes());
        }
        if (podcastFilter) {
            podcastFilter.addEventListener('change', () => this.filterEpisodes());
        }
        if (sortFilter) {
            sortFilter.addEventListener('change', () => this.filterEpisodes());
        }
        if (clearFilters) {
            clearFilters.addEventListener('click', () => this.clearFilters());
        }

        // Admin authentication shortcut
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+A to toggle admin panel
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                const password = prompt('Enter admin password:');
                if (password === 'kaizen2024') {
                    // Use password-only authentication
                    this.toggleAdminMode();
                    localStorage.setItem('kme-admin-password', 'kaizen2024');
                    console.log('👨‍💼 Admin panel activated with password');
                }
            }
            
        });
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PodcastApp();
    
    // Make app globally available for inline event handlers
    window.app = app;
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(1, 123, 181, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(1, 123, 181, 0); }
            100% { box-shadow: 0 0 0 0 rgba(1, 123, 181, 0); }
        }
    `;
    document.head.appendChild(style);
});
