require('dotenv').config({ path: 'server/.env' });
const httpClient = require('./server/services/httpClient');

async function debugProxy() {
    console.log("Debugging Proxy Content...");
    const url = 'https://www.mtggoldfish.com/tournaments/standard';

    try {
        const res = await httpClient.get(url, { forceProxy: true });
        console.log("Status:", res.status);
        console.log("Headers:", JSON.stringify(res.headers, null, 2));

        const data = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        console.log("Body Start (First 1000 chars):");
        console.log(data.substring(0, 1000));

        // specific check for Scraping Robot JSON wrapper
        if (typeof res.data === 'object' && res.data.result) {
            console.log("NOTICE: This looks like a JSON wrapped response! Access .result or .body?");
        }
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.log("Error Body:", e.response.data);
        }
    }
}

debugProxy();
