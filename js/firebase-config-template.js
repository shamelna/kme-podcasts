// Secure Firebase Configuration Template
// This file should be copied to firebase-config-local.js and filled with your API key
// NEVER commit this file to version control

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "YOUR_NEW_API_KEY_HERE",
    authDomain: "kme-podcasts.firebaseapp.com",
    projectId: "kme-podcasts",
    storageBucket: "kme-podcasts.firebasestorage.app",
    messagingSenderId: "635239448486",
    appId: "1:635239448486:web:57c7f8c39009e3bb4cd967",
    measurementId: "G-NSEVF9C6G1"
};

// Validate API key is present
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_NEW_API_KEY_HERE") {
    console.error("🚨 SECURITY ERROR: Firebase API key not configured!");
    console.error("Please set FIREBASE_API_KEY environment variable or update firebase-config-local.js");
    throw new Error("Firebase API key not configured");
}

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Export for use in application
if (typeof window !== 'undefined') {
    window.firebaseConfig = firebaseConfig;
    window.db = db;
    window.auth = auth;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        db,
        auth,
        firebase
    };
}
