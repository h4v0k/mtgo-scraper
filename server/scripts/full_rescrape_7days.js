const { db, initDB } = require('../db');
const { scrapeGoldfishEvents } = require('../services/goldfishScraper');

async function fullRescrape() {
    try {
        await initDB();

        console.log("=== FULL 7-DAY DATA RESTORATION ===\n");

        // 1. Calculate cutoff date (7 days ago)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        console.log(`Cutoff date: ${cutoffStr}`);

        // 2. Count decks to be deleted
        const countRes = await db.execute({
            sql: "SELECT COUNT(*) as cnt FROM decks WHERE event_date >= ?",
            args: [cutoffStr]
        });
        const deckCount = countRes.rows[0].cnt;

        console.log(`\nDecks to be deleted: ${deckCount}`);
        console.log("\n⚠️  This will DELETE all deck data from the last 7 days!");
        console.log("Proceeding in 3 seconds...\n");

        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Delete all decks from last 7 days
        console.log("Deleting old data...");
        const deleteRes = await db.execute({
            sql: "DELETE FROM decks WHERE event_date >= ?",
            args: [cutoffStr]
        });
        console.log(`✅ Deleted ${deleteRes.rowsAffected} deck entries\n`);

        // 4. Rescrape last 7 days
        console.log("Starting fresh 7-day scrape...\n");
        await scrapeGoldfishEvents(7);

        console.log("\n✅ Full restoration complete!");
        console.log("All data from last 7 days has been refreshed.");

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

fullRescrape();
