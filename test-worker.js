// Test script for Cloudflare Worker
const testFeeds = [
    'https://rss.buzzsprout.com/1715047.rss',
    'https://feed.podbean.com/myfavoritemistake/feed.xml',
    'https://feeds.harvardbusiness.org/harvardbusiness/ideacast',
    'https://feeds.transistor.fm/the-lean-solutions-podcast'
];

async function testWorker() {
    const workerUrl = 'https://podcast-rss-proxy.eng-a-redwan.workers.dev/?url=';
    
    for (const feed of testFeeds) {
        try {
            console.log(`Testing: ${feed}`);
            const response = await fetch(workerUrl + encodeURIComponent(feed));
            
            if (response.ok) {
                const text = await response.text();
                console.log(`✅ SUCCESS: ${feed}`);
                console.log(`   Content length: ${text.length}`);
                console.log(`   Starts with XML: ${text.trim().startsWith('<?xml') || text.trim().startsWith('<rss')}`);
            } else {
                console.log(`❌ FAILED: ${feed} - HTTP ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ ERROR: ${feed} - ${error.message}`);
        }
        console.log('---');
    }
}

// Run in browser console
testWorker();
