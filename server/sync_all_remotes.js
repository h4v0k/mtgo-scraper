const { scrapeMTGTop8 } = require('./services/scraper');
const { scrapeGoldfishEvents } = require('./services/goldfishScraper');
const { initDB } = require('./db');

async function syncAll() {
    const startTime = Date.now();
    console.log("=== Starting Global Sync Job ===");

    try {
        await initDB();

        // 1. Goldfish Sync (6h cycle)
        console.log("\n--- Step 1: MTGGoldfish Scrape ---");
        // Scrape last 3 days to catch any missed updates
        await scrapeGoldfishEvents(3);

        // 2. MTGTop8 Sync (Daily gaps)
        console.log("\n--- Step 2: MTGTop8 Scrape ---");
        // Scrape last 7 days to ensure gaps are filled
        await scrapeMTGTop8(7);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n=== Global Sync Complete (Total: ${duration}s) ===`);
        process.exit(0);
    } catch (err) {
        console.error("\n❌ Global Sync Failed:", err);
        process.exit(1);
    }
}

syncAll();
