// Firebase configuration - Use environment variables for security
// Note: process.env works in Node.js, for browser we need window.env or hardcoded fallback
const getFirebaseConfig = () => {
    // Try to get from window environment (if configured in build process)
    if (typeof window !== 'undefined' && window.env) {
        return {
            apiKey: window.env.FIREBASE_API_KEY || "AIzaSyBYo1xq9y9qvvqepSUlsyytbc-bgEc2qjA",
            authDomain: "kme-podcasts.firebaseapp.com",
            projectId: "kme-podcasts",
            storageBucket: "kme-podcasts.firebasestorage.app",
            messagingSenderId: window.env.FIREBASE_MESSAGING_SENDER_ID || "635239448486",
            appId: window.env.FIREBASE_APP_ID || "1:635239448486:web:ec37eaa33adffb7b4cd967",
            measurementId: window.env.FIREBASE_MEASUREMENT_ID || "G-8W66LHYWJS"
        };
    }
    
    // Fallback to hardcoded values for browser
    return {
        apiKey: "AIzaSyBYo1xq9y9qvvqepSUlsyytbc-bgEc2qjA",
        authDomain: "kme-podcasts.firebaseapp.com",
        projectId: "kme-podcasts",
        storageBucket: "kme-podcasts.firebasestorage.app",
        messagingSenderId: "635239448486",
        appId: "1:635239448486:web:ec37eaa33adffb7b4cd967",
        measurementId: "G-8W66LHYWJS"
    };
};

const firebaseConfig = getFirebaseConfig();

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Configure Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Admin Authentication Functions
class AdminAuth {
    constructor(auth) {
        this.auth = auth;
        this.adminEmail = 'info@kaizenmadeeasy.com'; // Updated to newly added Firebase user
    }

    // Sign in admin with email/password
    async signInAdmin(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Admin signed in successfully');
            return result.user;
        } catch (error) {
            console.error('❌ Admin sign in failed:', error);
            throw error;
        }
    }

    // Sign out admin
    async signOut() {
        try {
            await this.auth.signOut();
            console.log('✅ Admin signed out');
        } catch (error) {
            console.error('❌ Sign out failed:', error);
            throw error;
        }
    }

    // Check if current user is admin
    isAdmin() {
        const user = this.auth.currentUser;
        return user && (
            user.email === 'info@kaizenmadeeasy.com' || 
            user.email === 'ahmed.a.redwan@gmail.com' || 
            user.email === 'eng.a.redwan@gmail.com'
        );
    }

    // Get current admin user
    getCurrentAdmin() {
        return this.auth.currentUser;
    }

    // Monitor auth state changes
    onAuthStateChanged(callback) {
        return this.auth.onAuthStateChanged(callback);
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

// Podcast Database Management
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
            // Uses composite index: featured ASC + featuredOrder ASC (firestore.indexes.json)
            const snapshot = await this.db.collection('episodes')
                .where('featured', '==', true)
                .orderBy('featuredOrder', 'asc')
                .limit(limit)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            // Uses composite index: podcastId ASC + publishDate DESC (firestore.indexes.json)
            let query = this.db.collection('episodes')
                .where('podcastId', '==', podcastId)
                .orderBy('publishDate', 'desc');
            if (limit) query = query.limit(limit);
            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching episodes by podcast:', error);
            throw error;
        }
    }

    async searchEpisodes(searchTerm, filters = {}) {
        try {
            let query = this.db.collection('episodes');

            // Apply Firestore-level filters where possible
            if (filters.podcastId) {
                query = query.where('podcastId', '==', filters.podcastId)
                             .orderBy('publishDate', 'desc');
            } else {
                query = query.orderBy('publishDate', 'desc');
            }

            // Fetch all matching episodes (no arbitrary cap —
            // the main app loads episodes once at startup and uses
            // the Fuse.js index for all subsequent searches)
            const snapshot = await query.get();
            const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Client-side keyword filter (fallback for admin panel usage)
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                return episodes.filter(ep =>
                    (ep.title || '').toLowerCase().includes(lower) ||
                    (ep.description || '').toLowerCase().includes(lower) ||
                    (ep.podcastTitle || '').toLowerCase().includes(lower)
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

    // ── Real-time listeners (onSnapshot) ─────────────────────────────────────

    /**
     * Subscribe to featured episodes in real time.
     * @param {function} callback  Called with the episodes array on every change.
     * @param {number}   limit     Max episodes to return (default 5).
     * @returns {function} Unsubscribe function — call it to stop listening.
     */
    subscribeFeaturedEpisodes(callback, limit = 5) {
        return this.db.collection('episodes')
            .where('featured', '==', true)
            .orderBy('featuredOrder', 'asc')
            .limit(limit)
            .onSnapshot(
                snapshot => {
                    const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    callback(episodes);
                },
                error => console.error('Featured episodes listener error:', error)
            );
    }

    /**
     * Subscribe to the latest episodes in real time.
     * @param {function} callback  Called with the episodes array on every change.
     * @param {number}   limit     Max episodes to return (default 5).
     * @returns {function} Unsubscribe function.
     */
    subscribeLatestEpisodes(callback, limit = 5) {
        return this.db.collection('episodes')
            .orderBy('publishDate', 'desc')
            .limit(limit)
            .onSnapshot(
                snapshot => {
                    const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    callback(episodes);
                },
                error => console.error('Latest episodes listener error:', error)
            );
    }

    /**
     * Subscribe to all episodes in real time (paginated).
     * For the main episode grid — fires when any episode document changes.
     * @param {function} callback  Called with full episode array on every change.
     * @returns {function} Unsubscribe function.
     */
    subscribeAllEpisodes(callback) {
        return this.db.collection('episodes')
            .orderBy('publishDate', 'desc')
            .onSnapshot(
                snapshot => {
                    const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    callback(episodes);
                },
                error => console.error('All episodes listener error:', error)
            );
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
}

// Initialize Database and User Manager
const podcastDB = new PodcastDatabase(db);
const userDataManager = new UserDataManager(db);
const adminAuth = new AdminAuth(auth);

// Expose Firebase instances globally for other scripts
window.db = db;
window.auth = auth;
window.podcastDB = podcastDB;
window.userDataManager = userDataManager;
window.adminAuth = adminAuth;
window.firebase = firebase;

console.log('✅ Firebase instances initialized and exposed globally');