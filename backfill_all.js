const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const { scrapeGoldfishEvents } = require('./server/services/goldfishScraper');

async function backfill() {
    console.log("Starting forced backfill for all formats (3 days)...");
    // forceUpdate = true
    await scrapeGoldfishEvents(3, true);
    console.log("Backfill complete.");
}

backfill();
