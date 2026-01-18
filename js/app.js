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

    // Helper function to strip HTML tags
    stripHtml(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    // Helper function to get clean description for tooltips
    getCleanDescription(description, maxLength = 250) {
        if (!description) return 'No description available';
        const cleanText = this.stripHtml(description);
        return cleanText.substring(0, maxLength) || 'No description available';
    }

    // Setup JavaScript tooltips
    setupTooltips() {
        // Remove any existing tooltip
        const existingTooltip = document.getElementById('custom-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.id = 'custom-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(18, 56, 91, 0.9);
            color: #ffffff;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            font-size: 0.85rem;
            white-space: normal;
            max-width: 280px;
            word-wrap: break-word;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            line-height: 1.4;
            pointer-events: none;
            visibility: hidden;
            backdrop-filter: blur(4px);
        `;
        document.body.appendChild(tooltip);

        // Add event listeners to all elements with data-description
        this.addTooltipListeners();
    }

    // Add tooltip listeners to elements
    addTooltipListeners() {
        const elements = document.querySelectorAll('[data-description]');
        
        elements.forEach(element => {
            element.addEventListener('mouseenter', (e) => this.showTooltip(e));
            element.addEventListener('mouseleave', () => this.hideTooltip());
        });
    }

    // Show tooltip
    showTooltip(event) {
        const tooltip = document.getElementById('custom-tooltip');
        if (!tooltip) return;

        const description = event.target.getAttribute('data-description');
        const secondaryDescription = event.target.getAttribute('data-secondary-description');
        
        if (!description && !secondaryDescription) return;

        // Only show main description (remove episode name/podcast info)
        let tooltipContent = '';
        if (description) {
            tooltipContent = `<div class="tooltip-content">${description}</div>`;
        }
        
        tooltip.innerHTML = tooltipContent;
        
        // Simple, direct positioning approach
        const rect = event.target.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Position tooltip directly above element with 2px gap
        const tooltipTop = rect.top + scrollTop - tooltip.offsetHeight - 2;
        const tooltipLeft = rect.left + scrollLeft + (rect.width / 2) - (tooltip.offsetWidth / 2);
        
        // Apply position directly
        tooltip.style.position = 'absolute';
        tooltip.style.top = tooltipTop + 'px';
        tooltip.style.left = tooltipLeft + 'px';
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
        tooltip.style.zIndex = '10000';
    }

    // Hide tooltip
    hideTooltip() {
        const tooltip = document.getElementById('custom-tooltip');
        if (!tooltip) return;

        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.updateAdminPanel();
            
            // Initialize auto-update service integration
            this.setupAutoUpdateIntegration();
            
            // Setup tooltips
            this.setupTooltips();
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to load application');
        }
    }

    async loadData() {
        try {
            // Load featured episodes
            this.featuredEpisodes = await podcastDB.getFeaturedEpisodes();
            
            // Load latest episodes
            this.latestEpisodes = await podcastDB.getLatestEpisodes(5);
            
            // Load all episodes for search and pagination
            this.allEpisodes = await podcastDB.getAllEpisodes();
            
            // Extract unique podcast names
            this.allPodcasts = new Set(this.allEpisodes.map(ep => ep.podcastTitle));
            
            // Set filtered episodes to all episodes initially
            this.filteredEpisodes = [...this.allEpisodes];
            
            // Display data
            this.displayFeaturedEpisodes();
            this.displayLatestEpisodes();
            this.displayEpisodes();
            this.populateFilters();
            
        } catch (error) {
            console.error('Failed to load podcast data:', error);
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
                <img src="${episode.image || 'https://marketing.kaizenmadeeasy.com/assets/images/Logo_blue.png'}" 
                     alt="${this.escapeHtml(episode.title)}" 
                     class="featured-card-image"
                     onerror="this.src='https://marketing.kaizenmadeeasy.com/assets/images/Logo_blue.png'"
                     data-description="${this.escapeHtml(this.getCleanDescription(episode.description))}">
                <div class="featured-card-content">
                    <div class="featured-card-title" data-description="${this.escapeHtml(this.getCleanDescription(episode.description))}">${this.escapeHtml(episode.title)}</div>
                    <div class="featured-card-podcast">${this.escapeHtml(episode.podcastTitle)}</div>
                    <div class="featured-card-date">${this.formatDate(episode.publishDate)}</div>
                </div>
            </div>
        `).join('');
        
        // Re-initialize tooltips for new elements
        setTimeout(() => this.addTooltipListeners(), 100);
    }

    displayLatestEpisodes() {
        const latestGrid = document.getElementById('latestGrid');
        
        if (this.latestEpisodes.length === 0) {
            latestGrid.innerHTML = '<p style="text-align: center; opacity: 0.8;">No episodes available</p>';
            return;
        }

        latestGrid.innerHTML = this.latestEpisodes.map(episode => `
            <div class="latest-card" onclick="app.playEpisode('${episode.id}')">
                <div class="latest-card-title" data-description="${this.escapeHtml(this.getCleanDescription(episode.description))}">${this.escapeHtml(episode.title)}</div>
                <div class="latest-card-channel">${this.escapeHtml(episode.podcastTitle)}</div>
                <div class="latest-card-date">${this.formatDate(episode.publishDate)}</div>
            </div>
        `).join('');
        
        // Re-initialize tooltips for new elements
        setTimeout(() => this.addTooltipListeners(), 100);
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

        console.log('🔍 Filtering episodes:', {
            totalEpisodes: this.allEpisodes.length,
            searchTerm,
            podcastValue,
            sortValue
        });

        this.filteredEpisodes = this.allEpisodes.filter(episode => {
            const matchesSearch = !searchTerm || 
                episode.title.toLowerCase().includes(searchTerm) ||
                episode.description.toLowerCase().includes(searchTerm) ||
                episode.podcastTitle.toLowerCase().includes(searchTerm);

            const matchesPodcast = !podcastValue || episode.podcastTitle === podcastValue;
            const matchesTopic = true; // Removed topic filter

            return matchesSearch && matchesPodcast && matchesTopic;
        });

        console.log('🔍 Filtered episodes:', {
            filteredCount: this.filteredEpisodes.length,
            matches: this.filteredEpisodes.slice(0, 3).map(e => e.title)
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
        
        // Re-initialize tooltips for new elements
        setTimeout(() => this.addTooltipListeners(), 100);
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
            <img src="${episode.image || 'https://marketing.kaizenmadeeasy.com/assets/images/Logo_blue.png'}" 
                 alt="${this.escapeHtml(episode.title)}" 
                 class="podcast-image" 
                 onclick="app.playEpisode('${episode.id}')"
                 onerror="this.src='https://marketing.kaizenmadeeasy.com/assets/images/Logo_blue.png'"
                 data-description="${this.escapeHtml(this.getCleanDescription(episode.description))}">
            <div class="podcast-title" data-description="${this.escapeHtml(this.getCleanDescription(episode.description))}">${this.escapeHtml(episode.title)}</div>
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
                <button class="podcast-link share-btn" onclick="app.shareEpisode('${episode.id}')" title="Share Episode">
                    <span class="btn-icon">🔗</span> Share
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
            // Look for episode in all episodes arrays
            const episode = this.allEpisodes.find(e => e.id === episodeId) || 
                          this.filteredEpisodes.find(e => e.id === episodeId) ||
                          this.latestEpisodes.find(e => e.id === episodeId);
            
            if (!episode) {
                this.showNotification('❌ Episode not found', 'error');
                return;
            }

            // Update episode in Firebase
            await podcastDB.db.collection('episodes').doc(episodeId).update({
                featured: true,
                featuredOrder: Date.now() // Use timestamp for ordering
            });
            
            this.showNotification(`✅ Featured "${episode.title}"`, 'success');
            
            // Reload data to update UI
            await this.loadData();
            
        } catch (error) {
            console.error('Error featuring episode:', error);
            this.showNotification('Failed to feature episode', 'error');
        }
    }

    async unfeatureEpisode(episodeId) {
        try {
            // Look for episode in all episodes arrays
            const episode = this.allEpisodes.find(e => e.id === episodeId) || 
                          this.filteredEpisodes.find(e => e.id === episodeId) ||
                          this.featuredEpisodes.find(e => e.id === episodeId) ||
                          this.latestEpisodes.find(e => e.id === episodeId);
            
            if (!episode) {
                this.showNotification('❌ Episode not found', 'error');
                return;
            }

            // Update episode in Firebase
            await podcastDB.db.collection('episodes').doc(episodeId).update({
                featured: false,
                featuredOrder: null
            });
            
            this.showNotification(`🔄 Unfeatured "${episode.title}"`, 'success');
            
            // Reload data to update UI
            await this.loadData();
            
        } catch (error) {
            console.error('Error unfeaturing episode:', error);
            this.showNotification('Failed to unfeature episode', 'error');
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

    // Show notification function
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }

    // Unfeature all featured episodes at once
    async unfeatureAllEpisodes() {
        try {
            if (!confirm('Are you sure you want to unfeature ALL featured episodes?')) {
                return;
            }

            console.log('🔄 Unfeaturing all episodes...');
            
            // Get all featured episodes from the episodes collection
            const featuredSnapshot = await podcastDB.db.collection('episodes')
                .where('featured', '==', true)
                .get();
            
            const batch = podcastDB.db.batch();
            
            featuredSnapshot.forEach(doc => {
                // Update episode to remove featured status
                const episodeRef = podcastDB.db.collection('episodes').doc(doc.id);
                batch.update(episodeRef, {
                    featured: false,
                    featuredOrder: null
                });
            });
            
            await batch.commit();
            
            console.log('✅ All episodes unfeatured successfully');
            
            // Show success notification
            this.showNotification('✅ All episodes have been unfeatured', 'success');
            
            // Reload data to update UI
            await this.loadData();
            
        } catch (error) {
            console.error('❌ Error unfeaturing all episodes:', error);
            this.showNotification('Failed to unfeature episodes', 'error');
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
        
        // Toggle featured section admin controls
        const featuredAdminControls = document.getElementById('featuredAdminControls');
        if (featuredAdminControls) {
            featuredAdminControls.style.display = this.adminMode ? 'block' : 'none';
        }
        
        // Re-render episodes to show/hide admin controls
        this.displayEpisodes();
        this.displayFeaturedEpisodes();
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
            this.adminMode = true; // Set admin mode flag
            
            // Show featured admin controls
            const featuredAdminControls = document.getElementById('featuredAdminControls');
            if (featuredAdminControls) {
                featuredAdminControls.style.display = 'block';
            }
        } else {
            adminPanel.classList.remove('active');
            this.adminMode = false; // Clear admin mode flag
            
            // Hide featured admin controls
            const featuredAdminControls = document.getElementById('featuredAdminControls');
            if (featuredAdminControls) {
                featuredAdminControls.style.display = 'none';
            }
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
        console.log('🎵 Attempting to play episode:', episodeId);
        console.log('📊 Available episodes count:', {
            allEpisodes: this.allEpisodes?.length || 0,
            filteredEpisodes: this.filteredEpisodes?.length || 0,
            featuredEpisodes: this.featuredEpisodes?.length || 0,
            latestEpisodes: this.latestEpisodes?.length || 0
        });
        
        // Look for episode in all episodes arrays
        const episode = this.allEpisodes.find(e => e.id === episodeId) || 
                      this.filteredEpisodes.find(e => e.id === episodeId) ||
                      this.featuredEpisodes.find(e => e.id === episodeId) ||
                      this.latestEpisodes.find(e => e.id === episodeId);
        
        console.log('🔍 Found episode:', episode ? {
            id: episode.id,
            title: episode.title,
            hasAudio: !!episode.audioUrl,
            podcastTitle: episode.podcastTitle
        } : 'NOT FOUND');
        
        if (!episode || !episode.audioUrl) {
            console.error('❌ Episode not available for playback:', {
                found: !!episode,
                hasAudio: episode?.audioUrl,
                episodeId: episodeId
            });
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
        
        // Handle autoplay policy - only play if user has interacted with page
        const playPromise = this.audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name === 'NotAllowedError') {
                    console.log('🔇 Autoplay blocked - waiting for user interaction');
                    // Show a message to user to click play
                    this.showAutoplayMessage(episode);
                } else {
                    console.error('❌ Audio playback error:', error);
                    this.showNotification('Failed to play episode', 'error');
                }
            });
        }
        
        // Update player UI
        this.updatePlayerUI(episode);
        
        // Show player
        this.showAudioPlayer();
    }

    // Show autoplay blocked message
    showAutoplayMessage(episode) {
        const message = document.createElement('div');
        message.className = 'autoplay-message';
        message.innerHTML = `
            <div class="autoplay-content">
                <div class="autoplay-icon">🔇</div>
                <div class="autoplay-text">
                    <strong>Autoplay Blocked</strong><br>
                    Browser blocked autoplay. Click the play button to start:<br>
                    <em>${this.escapeHtml(episode.title)}</em>
                </div>
                <button class="autoplay-play-btn" onclick="this.parentElement.parentElement.remove(); document.getElementById('audioPlayer').play();">
                    ▶️ Play Now
                </button>
                <button class="autoplay-close-btn" onclick="this.parentElement.parentElement.remove();">×</button>
            </div>
        `;
        
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            width: 90%;
        `;
        
        document.body.appendChild(message);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 8000);
    }

    addToPlaylist(episodeId) {
        // Look for episode in all episodes arrays
        const episode = this.allEpisodes.find(e => e.id === episodeId) || 
                      this.filteredEpisodes.find(e => e.id === episodeId) ||
                      this.featuredEpisodes.find(e => e.id === episodeId) ||
                      this.latestEpisodes.find(e => e.id === episodeId);
        
        if (!episode) {
            this.showNotification('❌ Episode not found', 'error');
            return;
        }

        // Check if already in playlist
        if (this.playlist.find(e => e.id === episodeId)) {
            this.showNotification('📋 Episode already in playlist', 'warning');
            return;
        }

        this.playlist.push(episode);
        this.showNotification(`📋 Added "${episode.title}" to playlist`, 'success');
        
        // Update playlist UI
        this.updatePlaylistUI();
        
        // Show playlist sidebar
        this.showPlaylistSidebar();
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
            // Audio loading
        });

        this.audioPlayer.addEventListener('canplay', () => {
            // Audio ready to play
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
            // Audio loading
        });

        this.audioPlayer.addEventListener('canplay', () => {
            // Audio ready to play
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
        
        // Show the audio player UI
        this.showAudioPlayer();
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
        this.showNotification('⭐ Favorites feature coming soon!', 'info');
    }

    toggleWatchLater(episodeId) {
        this.showNotification('⏰ Watch Later feature coming soon!', 'info');
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
                <span class="update-message">${message}</span>
                <button class="update-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 8000);
    }

    // Share episode functionality
    shareEpisode(episodeId) {
        const episode = this.allEpisodes.find(ep => ep.id === episodeId);
        if (!episode) {
            console.error('Episode not found:', episodeId);
            console.log('Available episodes:', this.allEpisodes.map(ep => ep.id).slice(0, 5));
            return;
        }

        // Create shareable URL with episode parameter
        const shareUrl = `${window.location.origin}${window.location.pathname}?episode=${encodeURIComponent(episodeId)}`;
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                this.showShareNotification('Episode link copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy link:', err);
                this.fallbackShare(shareUrl, episode);
            });
        } else {
            // Fallback for older browsers
            this.fallbackShare(shareUrl, episode);
        }
    }

    // Fallback share method
    fallbackShare(shareUrl, episode) {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showShareNotification('Episode link copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy link:', err);
            // Show dialog with link as last resort
            this.showShareDialog(shareUrl, episode);
        } finally {
            document.body.removeChild(textArea);
        }
    }

    // Show share notification
    showShareNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'share-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #12385b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Show share dialog for manual copy
    showShareDialog(shareUrl, episode) {
        const dialog = document.createElement('div');
        dialog.className = 'share-dialog-overlay';
        dialog.innerHTML = `
            <div class="share-dialog">
                <div class="share-dialog-header">
                    <h3>Share Episode</h3>
                    <button class="share-dialog-close" onclick="this.closest('.share-dialog-overlay').remove()">×</button>
                </div>
                <div class="share-dialog-content">
                    <p><strong>${this.escapeHtml(episode.title)}</strong></p>
                    <p>from ${this.escapeHtml(episode.podcastTitle)}</p>
                    <div class="share-url-container">
                        <input type="text" readonly value="${shareUrl}" id="shareUrlInput">
                        <button onclick="document.getElementById('shareUrlInput').select(); document.execCommand('copy'); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 2000)">Copy</button>
                    </div>
                </div>
            </div>
        `;
        
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const dialogContent = dialog.querySelector('.share-dialog');
        dialogContent.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(dialog);
        
        // Close on overlay click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    // Function to remove duplicate episodes from database
    async removeDuplicateEpisodes() {
        try {
            console.log('🔍 Starting advanced duplicate episode cleanup...');
            const statusEl = document.getElementById('syncStatus');
            if (statusEl) {
                statusEl.textContent = 'Finding and removing duplicate episodes...';
                statusEl.className = 'sync-status';
            }

            // Get all episodes from database
            const allEpisodes = await podcastDB.getAllEpisodes();
            console.log(`📊 Found ${allEpisodes.length} total episodes in database`);

            // Advanced duplicate detection
            const duplicates = [];
            const seenEpisodes = new Map();
            
            // Check for duplicates by multiple criteria
            allEpisodes.forEach((episode, index) => {
                const duplicateKey = this.createDuplicateKey(episode);
                
                if (seenEpisodes.has(duplicateKey)) {
                    // Found a duplicate
                    const originalEpisode = seenEpisodes.get(duplicateKey);
                    duplicates.push({
                        key: duplicateKey,
                        original: originalEpisode,
                        duplicate: episode,
                        originalIndex: originalEpisode.index,
                        duplicateIndex: index
                    });
                } else {
                    // First time seeing this episode
                    seenEpisodes.set(duplicateKey, {
                        ...episode,
                        index: index
                    });
                }
            });

            console.log(`🔍 Found ${duplicates.length} potential duplicates by content analysis`);

            if (duplicates.length === 0) {
                if (statusEl) {
                    statusEl.textContent = 'No duplicate episodes found';
                }
                this.showNotification('No duplicate episodes found in database');
                return;
            }

            // Remove duplicates (keep the first one found)
            let removedCount = 0;
            const BATCH_SIZE = 400; // Firebase limit is around 500 operations
            
            // Process duplicates in batches to avoid Firebase transaction size limits
            const duplicateBatches = [];
            for (let i = 0; i < duplicates.length; i += BATCH_SIZE) {
                duplicateBatches.push(duplicates.slice(i, i + BATCH_SIZE));
            }
            
            console.log(`🔄 Processing ${duplicateBatches.length} batches of up to ${BATCH_SIZE} duplicates each`);
            
            for (let batchIndex = 0; batchIndex < duplicateBatches.length; batchIndex++) {
                const batch = podcastDB.db.batch();
                const batchDuplicates = duplicateBatches[batchIndex];
                
                console.log(`📦 Processing batch ${batchIndex + 1}/${duplicateBatches.length} with ${batchDuplicates.length} duplicates`);
                
                for (const duplicate of batchDuplicates) {
                    // Remove the duplicate episode (keep the original)
                    console.log(`🗑️ Removing duplicate: "${duplicate.duplicate.title}" from ${duplicate.duplicate.podcastTitle}`);
                    console.log(`   Keeping: "${duplicate.original.title}" (index ${duplicate.originalIndex})`);
                    console.log(`   Removing: "${duplicate.duplicate.title}" (index ${duplicate.duplicateIndex})`);
                    
                    batch.delete(podcastDB.db.collection('episodes').doc(duplicate.duplicate.id));
                    removedCount++;
                }
                
                // Commit this batch
                await batch.commit();
                console.log(`✅ Batch ${batchIndex + 1} completed: removed ${batchDuplicates.length} duplicates`);
                
                // Small delay between batches to avoid overwhelming Firebase
                if (batchIndex < duplicateBatches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            console.log(`✅ Successfully removed ${removedCount} duplicate episodes`);
            
            if (statusEl) {
                statusEl.textContent = `Removed ${removedCount} duplicate episodes`;
                statusEl.className = 'sync-status';
            }

            this.showNotification(`Successfully removed ${removedCount} duplicate episodes from database`);
            
            // Reload data to refresh the display
            await this.loadData();
            
        } catch (error) {
            console.error('❌ Error removing duplicate episodes:', error);
            const statusEl = document.getElementById('syncStatus');
            if (statusEl) {
                statusEl.textContent = 'Failed to remove duplicates';
                statusEl.className = 'sync-status error';
            }
            this.showNotification('Failed to remove duplicate episodes', 'error');
        }
    }

    // Create a comprehensive key for duplicate detection
    createDuplicateKey(episode) {
        // Normalize title for comparison (remove extra spaces, lowercase)
        const normalizedTitle = episode.title.toLowerCase().trim().replace(/\s+/g, ' ');
        
        // Create key from multiple attributes for better matching
        const keyParts = [
            normalizedTitle,
            episode.podcastTitle?.toLowerCase().trim() || '',
            episode.audioUrl?.trim() || '',
            // Use first 100 characters of description for comparison
            (episode.description || '').substring(0, 100).toLowerCase().replace(/\s+/g, ' ')
        ];
        
        return keyParts.join('|');
    }

    // Show notification for duplicate cleanup
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'duplicate-cleanup-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#de1738' : '#12385b'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
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
                
                // Check if already in admin mode
                if (this.adminMode) {
                    console.log('👨‍💼 Admin mode disabled');
                    this.adminMode = false;
                    this.toggleAdminMode();
                    this.showNotification('Admin mode disabled');
                } else {
                    const password = prompt('Enter admin password:');
                    if (password === 'kaizen2024') {
                        // Use password-only authentication
                        this.toggleAdminMode();
                        localStorage.setItem('kme-admin-password', 'kaizen2024');
                        this.adminMode = true;
                        console.log('👨‍💼 Admin mode enabled');
                        this.showNotification('Admin mode enabled');
                    } else {
                        console.log('❌ Incorrect admin password');
                        this.showNotification('Incorrect admin password', 'error');
                    }
                }
            }
            
            // Debug: Check current admin status with Ctrl+Shift+D
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                console.log('🔍 Current admin status:', {
                    adminMode: this.adminMode,
                    hasPassword: !!localStorage.getItem('kme-admin-password')
                });
                alert(`Admin Mode: ${this.adminMode ? 'ENABLED' : 'DISABLED'}\nPassword Stored: ${localStorage.getItem('kme-admin-password') ? 'YES' : 'NO'}`);
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
    
    // Check for episode parameter in URL and play if found
    const urlParams = new URLSearchParams(window.location.search);
    const episodeId = urlParams.get('episode');
    if (episodeId) {
        // Decode the episode ID properly
        const decodedEpisodeId = decodeURIComponent(episodeId);
        console.log('🎵 Found episode parameter:', decodedEpisodeId);
        
        // Wait a bit for episodes to load, then play the episode
        setTimeout(() => {
            if (app.allEpisodes && app.allEpisodes.length > 0) {
                app.playEpisode(decodedEpisodeId);
            } else {
                // If episodes aren't loaded yet, wait for them
                const checkEpisodes = setInterval(() => {
                    if (app.allEpisodes && app.allEpisodes.length > 0) {
                        clearInterval(checkEpisodes);
                        app.playEpisode(decodedEpisodeId);
                    }
                }, 500);
                // Stop checking after 10 seconds
                setTimeout(() => clearInterval(checkEpisodes), 10000);
            }
        }, 1000);
    }
    
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
