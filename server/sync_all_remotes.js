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
        // Scrape last 7 days to catch any missed updates and ensute full coverage
        await scrapeGoldfishEvents(7);

        // 2. MTGTop8 Sync (12h cycle)
        const currentHour = new Date().getUTCHours();
        const forceTop8 = process.argv.includes('--force-top8');
        const isTop8Time = currentHour === 0 || currentHour === 12;

        if (isTop8Time || forceTop8) {
            console.log("\n--- Step 2: MTGTop8 Scrape (12h Cycle) ---");
            // Scrape last 7 days to ensure gaps are filled
            await scrapeMTGTop8(7);
        } else {
            console.log(`\n--- Step 2: MTGTop8 Skip (Not 0/12 UTC, current: ${currentHour}:00) ---`);
        }

        // 3. Normalization (Always Run)
        console.log("\n--- Step 3: Remote Normalization ---");
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
