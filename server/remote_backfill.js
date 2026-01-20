// Load production env first
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.production') });

const { scrapeMTGTop8 } = require('./services/scraper');

async function runBackfill() {
    console.log("Starting REMOTE backfill to Turso...");
    console.log("Target DB:", process.env.TURSO_DATABASE_URL); // Verify it picked up the production URL

    // Run scrape for last 7 days to pick up the recent SCG events
    try {
        await scrapeMTGTop8(14);
        console.log("Remote backfill complete.");
    } catch (e) {
        console.error("Backfill failed:", e);
    }
}

runBackfill();
