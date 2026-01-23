require('dotenv').config({ path: 'server/.env' });
const httpClient = require('./server/services/httpClient');

async function testSecondary() {
    console.log("=== Testing Secondary Proxy (ScrapeOps) ===");
    console.log("Key 2:", process.env.SCRAPER_API_KEY_2 ? "Set" : "Missing");
    console.log("URL 2:", process.env.SCRAPER_SERVICE_URL_2);

    try {
        console.log("Sending request to httpbin via Secondary Proxy...");
        // forceProxy: true is irrelevant if we useSecondary: true, but good measure
        const res = await httpClient.get('https://httpbin.org/ip', { useSecondary: true });

        console.log("Status:", res.status);
        console.log("Data:", JSON.stringify(res.data, null, 2));

        if (res.status === 200) {
            console.log("PASS: Secondary proxy working.");
        } else {
            console.log("FAIL: Status not 200");
        }
    } catch (e) {
        console.error("FAIL: Error:", e.message);
        if (e.response) {
            console.error("Response Data:", e.response.data);
        }
    }
}

testSecondary();
