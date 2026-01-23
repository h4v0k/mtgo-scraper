require('dotenv').config({ path: 'server/.env' });
const httpClient = require('./server/services/httpClient');

async function testClient() {
    console.log("=== Testing HttpClient ===");

    try {
        // 1. Direct Request (Should work, rotates UA)
        console.log("1. Testing Direct Request...");
        const res1 = await httpClient.get('https://httpbin.org/user-agent');
        console.log("   UA 1:", res1.data['user-agent']);

        const res2 = await httpClient.get('https://httpbin.org/user-agent');
        console.log("   UA 2:", res2.data['user-agent']);

        if (res1.data['user-agent'] !== res2.data['user-agent']) {
            console.log("   PASS: User-Agent rotated.");
        } else {
            console.log("   NOTE: User-Agent did not rotate (random chance or sticky).");
        }

        // 2. Mock Proxy Request (if key is set, otherwise skip)
        if (process.env.SCRAPER_API_KEY) {
            console.log("2. Testing Proxy Request...");
            try {
                // Test against httpbin to verify IP/Headers via proxy
                // Note: ScrapingRobot might not support httpbin well if it blocks non-html, but let's try google or something simple
                const resProxy = await httpClient.get('https://example.com', { forceProxy: true });
                console.log("   Proxy Status:", resProxy.status);
                console.log("   PASS: Proxy request successful.");
            } catch (err) {
                console.error("   FAIL: Proxy request failed:", err.message);
                if (err.response) console.error("   Status:", err.response.status, err.response.data);
            }
        } else {
            console.log("2. Skipping Proxy Test (No Key Configured)");
        }

        console.log("=== Test Complete ===");

    } catch (e) {
        console.error("Test Failed:", e.message);
    }
}

testClient();
