// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCFC1q7p6MSly1ua50n-XI3yO4NmFCUMj4",
    authDomain: "kme-podcasts.firebaseapp.com",
    projectId: "kme-podcasts",
    storageBucket: "kme-podcasts.firebasestorage.app",
    messagingSenderId: "635239448486",
    appId: "1:635239448486:web:57c7f8c39009e3bb4cd967",
    measurementId: "G-NSEVF9C6G1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // Available but disabled for user functionality

// Configure Google Auth Provider (available but not used)
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Auth is disabled - keeping only database functionality

// Firebase Firestore operations
class PodcastDatabase {
    constructor(db) {
        this.db = db;
    }

    async savePodcast(podcastData) {
        try {
            console.log('📝 Saving podcast data:', podcastData);
            const podcastRef = this.db.collection('podcasts').doc(podcastData.id);
            await podcastRef.set(podcastData, { merge: true });
            console.log('✅ Podcast saved successfully:', podcastData.title);
            return podcastRef.id;
        } catch (error) {
            console.error('Error saving podcast:', error);
            throw error;
        }
    }

    async saveEpisode(episodeData) {
        try {
            const episodeRef = this.db.collection('episodes').doc(episodeData.id);
            await episodeRef.set(episodeData, { merge: true });
            return episodeRef.id;
        } catch (error) {
            console.error('Error saving episode:', error);
            throw error;
        }
    }

    async getFeaturedEpisodes(limit = 10) {
        try {
            // Simple query without composite index requirement
            const snapshot = await this.db.collection('episodes')
                .where('featured', '==', true)
                .limit(limit)
                .get();
            
            // Sort client-side to avoid index requirement
            const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return episodes.sort((a, b) => (a.featuredOrder || 999) - (b.featuredOrder || 999));
        } catch (error) {
            console.error('Error fetching featured episodes:', error);
            throw error;
        }
    }

    async getLatestEpisodes(limit = 20) {
        try {
            const snapshot = await this.db.collection('episodes')
                .orderBy('publishDate', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching latest episodes:', error);
            throw error;
        }
    }

    async getEpisodesByPodcast(podcastId, limit = null) {
        try {
            // First get all episodes for the podcast (without ordering to avoid index requirement)
            const snapshot = await this.db.collection('episodes')
                .where('podcastId', '==', podcastId)
                .get();
            
            // Convert to array and sort manually
            let episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Sort by publishDate manually (newest first)
            episodes.sort((a, b) => {
                const dateA = a.publishDate ? a.publishDate.toDate ? a.publishDate.toDate() : new Date(a.publishDate) : new Date(0);
                const dateB = b.publishDate ? b.publishDate.toDate ? b.publishDate.toDate() : new Date(b.publishDate) : new Date(0);
                return dateB - dateA;
            });
            
            // Apply limit only if specified
            return limit ? episodes.slice(0, limit) : episodes;
        } catch (error) {
            console.error('Error fetching episodes by podcast:', error);
            throw error;
        }
    }

    async searchEpisodes(searchTerm, filters = {}) {
        try {
            let query = this.db.collection('episodes');
            
            if (filters.podcastId) {
                query = query.where('podcastId', '==', filters.podcastId);
            }
            
            if (filters.genre) {
                query = query.where('genre', '==', filters.genre);
            }

            // Note: Firestore doesn't support full-text search natively
            // This is a simplified implementation
            const snapshot = await query
                .orderBy('publishDate', 'desc')
                .limit(1000) // Increased limit to show all episodes
                .get();
            
            const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Client-side filtering for search term
            if (searchTerm) {
                const lowerSearchTerm = searchTerm.toLowerCase();
                return episodes.filter(episode => 
                    episode.title.toLowerCase().includes(lowerSearchTerm) ||
                    episode.description.toLowerCase().includes(lowerSearchTerm) ||
                    episode.podcastTitle.toLowerCase().includes(lowerSearchTerm)
                );
            }
            
            return episodes;
        } catch (error) {
            console.error('Error searching episodes:', error);
            throw error;
        }
    }

    async getAllPodcasts() {
        try {
            const snapshot = await this.db.collection('podcasts').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching all podcasts:', error);
            throw error;
        }
    }

    async getAllEpisodes() {
        try {
            const snapshot = await this.db.collection('episodes')
                .orderBy('publishDate', 'desc')
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching all episodes:', error);
            if (error.code === 'permission-denied') {
                console.error('🔒 Firebase security rules are blocking access. Please apply the provided rules in Firebase Console.');
            }
            throw error;
        }
    }

    async getTrackedPodcasts() {
        try {
            const snapshot = await this.db.collection('trackedPodcasts')
                .orderBy('addedDate', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching tracked podcasts:', error);
            throw error;
        }
    }

    async addTrackedPodcast(podcastData) {
        try {
            const trackedPodcast = {
                ...podcastData,
                addedDate: firebase.firestore.FieldValue.serverTimestamp(),
                lastSyncDate: firebase.firestore.FieldValue.serverTimestamp(),
                active: true
            };
            
            const docRef = await this.db.collection('trackedPodcasts').add(trackedPodcast);
            return docRef.id;
        } catch (error) {
            console.error('Error adding tracked podcast:', error);
            throw error;
        }
    }

    async updateSyncDate(podcastId) {
        try {
            await this.db.collection('trackedPodcasts').doc(podcastId).update({
                lastSyncDate: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating sync date:', error);
            throw error;
        }
    }

    async deleteEpisode(episodeId) {
        try {
            await this.db.collection('episodes').doc(episodeId).delete();
            console.log('✅ Episode deleted successfully:', episodeId);
        } catch (error) {
            console.error('Error deleting episode:', error);
            throw error;
        }
    }

    // Analytics Methods for Admin Dashboard
    async trackVisitor(visitorData) {
        try {
            await this.db.collection('analytics').doc('visitors').collection('visits').add(visitorData);
            console.log('✅ Visitor tracked:', visitorData.sessionId);
        } catch (error) {
            console.error('Error tracking visitor:', error);
            throw error;
        }
    }

    async trackEpisodePlay(playData) {
        try {
            await this.db.collection('analytics').doc('plays').collection('episodes').add(playData);
            console.log('✅ Episode play tracked:', playData.episodeId);
        } catch (error) {
            console.error('Error tracking episode play:', error);
            throw error;
        }
    }

    async getAnalyticsData() {
        try {
            // Get visitor stats
            const visitorsSnapshot = await this.db.collection('analytics').doc('visitors').collection('visits')
                .orderBy('timestamp', 'desc')
                .limit(1000)
                .get();

            // Get play stats
            const playsSnapshot = await this.db.collection('analytics').doc('plays').collection('episodes')
                .orderBy('timestamp', 'desc')
                .limit(1000)
                .get();

            return {
                visitors: visitorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                plays: playsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            };

        } catch (error) {
            console.error('Error getting analytics data:', error);
            return null;
        }
    }
}

// User Data Management for Firebase
class UserDataManager {
    constructor(db, auth) {
        this.db = db;
        this.auth = auth;
    }

    // Save user data to Firestore
    async saveUserData(userId, userData) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            await userRef.set({
                ...userData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('✅ User data saved to Firebase');
            return true;
        } catch (error) {
            console.error('❌ Error saving user data:', error);
            throw error;
        }
    }

    // Load user data from Firestore
    async loadUserData(userId) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            const doc = await userRef.get();
            
            if (doc.exists) {
                return doc.data();
            } else {
                // Return default user data if not found
                return {
                    favorites: [],
                    watchLater: [],
                    playlists: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
            }
        } catch (error) {
            console.error('❌ Error loading user data:', error);
            throw error;
        }
    }

    // Add to favorites
    async addToFavorites(userId, episode) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            await userRef.update({
                favorites: firebase.firestore.FieldValue.arrayUnion(episode),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Added to favorites');
            return true;
        } catch (error) {
            console.error('❌ Error adding to favorites:', error);
            throw error;
        }
    }

    // Remove from favorites
    async removeFromFavorites(userId, episodeId) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                const updatedFavorites = userData.favorites.filter(fav => fav.id !== episodeId);
                await userRef.update({
                    favorites: updatedFavorites,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ Removed from favorites');
                return true;
            }
        } catch (error) {
            console.error('❌ Error removing from favorites:', error);
            throw error;
        }
    }

    // Add to watch later
    async addToWatchLater(userId, episode) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            await userRef.update({
                watchLater: firebase.firestore.FieldValue.arrayUnion(episode),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Added to watch later');
            return true;
        } catch (error) {
            console.error('❌ Error adding to watch later:', error);
            throw error;
        }
    }

    // Remove from watch later
    async removeFromWatchLater(userId, episodeId) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                const updatedWatchLater = userData.watchLater.filter(item => item.id !== episodeId);
                await userRef.update({
                    watchLater: updatedWatchLater,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ Removed from watch later');
                return true;
            }
        } catch (error) {
            console.error('❌ Error removing from watch later:', error);
            throw error;
        }
    }

    // Clear all user data
    async clearAllUserData(userId) {
        try {
            const userRef = this.db.collection('users').doc(userId);
            await userRef.set({
                favorites: [],
                watchLater: [],
                playlists: [],
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('✅ All user data cleared');
            return true;
        } catch (error) {
            console.error('❌ Error clearing user data:', error);
            throw error;
        }
    }
}

// Initialize Database and User Manager
const podcastDB = new PodcastDatabase(db);
const userDataManager = new UserDataManager(db, auth);

// Make globally available for browser environment
if (typeof window !== 'undefined') {
    window.podcastDB = podcastDB;
    window.userDataManager = userDataManager;
    window.db = db;
    window.auth = auth;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PodcastDatabase,
        UserDataManager,
        podcastDB,
        userDataManager,
        googleProvider,
        firebase
    };
}
