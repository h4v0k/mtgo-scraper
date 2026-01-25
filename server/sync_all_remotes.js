const { scrapeMTGTop8 } = require('./services/scraper');
const { scrapeGoldfishEvents } = require('./services/goldfishScraper');
const { runRemoteNormalization } = require('./remote_normalize');
const { initDB } = require('./db');

async function syncAll() {
    const startTime = Date.now();
    console.log("=== Starting Global Sync Job ===");

    try {
        await initDB();

        // 1. Goldfish Sync (6h cycle)
        console.log("\n--- Step 1: MTGGoldfish Scrape (6h Cycle) ---");
        // Reverting to 2 days for automated runs. 
        // Note: User should run the 7-day manual sync before these changes apply.
        await scrapeGoldfishEvents(2);

        // 2. Normalization (Always Run)
        console.log("\n--- Step 2: Remote Normalization ---");
        await runRemoteNormalization();

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n=== Global Sync Complete (Total: ${duration}s) ===`);
        process.exit(0);
    } catch (err) {
        console.error("\n❌ Global Sync Failed:", err);
        process.exit(1);
    }
}

syncAll();
