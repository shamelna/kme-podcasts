// Firebase Index Creation Script
// This script creates the required composite index for episodes collection

const firebaseConfig = {
    projectId: "kme-podcasts"
};

// The index definition needed for the episodes query
const indexDefinition = {
    collectionGroup: "episodes",
    queryScope: "COLLECTION",
    fields: [
        {
            fieldPath: "podcastId",
            order: "ASCENDING"
        },
        {
            fieldPath: "publishDate",
            order: "DESCENDING"
        }
    ]
};

// Function to create index using Firebase REST API
async function createFirebaseIndex() {
    try {
        // Get Firebase auth token (you'll need to authenticate first)
        const authToken = await getFirebaseAuthToken();
        
        if (!authToken) {
            console.error("❌ Authentication required. Please run: firebase login");
            return;
        }

        // Create the index via Firebase REST API
        const response = await fetch(
            `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/collectionGroups/episodes/indexes`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(indexDefinition)
            }
        );

        if (response.ok) {
            const result = await response.json();
            console.log("✅ Index creation initiated successfully!");
            console.log("📊 Index details:", result);
            console.log("⏳ Index will take a few minutes to build...");
            console.log("🔄 You can check status in Firebase Console → Firestore → Indexes");
        } else {
            const error = await response.json();
            console.error("❌ Failed to create index:", error);
        }
    } catch (error) {
        console.error("❌ Error creating index:", error);
    }
}

// Helper function to get Firebase auth token
async function getFirebaseAuthToken() {
    try {
        // This would require Firebase CLI authentication
        // For now, we'll provide instructions for manual creation
        return null;
    } catch (error) {
        return null;
    }
}

// Alternative: Manual index creation instructions
function showManualInstructions() {
    console.log("🔧 Manual Index Creation Instructions:");
    console.log("\n1. Go to Firebase Console:");
    console.log("   https://console.firebase.google.com/project/kme-podcasts/firestore");
    console.log("\n2. Navigate to: Indexes tab");
    console.log("\n3. Click 'Create Index'");
    console.log("\n4. Configure index:");
    console.log("   - Collection ID: episodes");
    console.log("   - Field 1: podcastId (Ascending)");
    console.log("   - Field 2: publishDate (Descending)");
    console.log("\n5. Click 'Create'");
    console.log("\n6. Wait for index to build (usually 1-2 minutes)");
    console.log("\n7. Run manual sync again in the app");
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createFirebaseIndex, showManualInstructions };
}

// Auto-run instructions
console.log("🚀 Firebase Index Creation Script");
console.log("=====================================");
showManualInstructions();
