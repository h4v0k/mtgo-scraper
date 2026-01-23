require('dotenv').config({ path: 'server/.env' });
const { scrapeGoldfishEvents } = require('./server/services/goldfishScraper');

async function run() {
    console.log("=== Starting Daily Scraper (Distributed/Proxy Mode) ===");
    // Run for the last 2 days to catch late-posted events
    // false = do not force update existing events
    await scrapeGoldfishEvents(2, false);
    console.log("=== Scraper Finished ===");
}

run();
