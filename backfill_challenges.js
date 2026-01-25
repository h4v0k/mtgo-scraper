require('dotenv').config();
const { db, initDB } = require('./server/db');
const { scrapeTournament } = require('./server/services/goldfish');

async function backfillChallenges() {
    await initDB();
    console.log("=== Starting Challenge Backfill ===");

    try {
        // Find events in the last 7 days with fewer than 4 decks
        // We look for Standard Challenges specifically first but can expand
        const query = `
            SELECT event_name, event_date, source_url, COUNT(*) as deck_count
            FROM decks
            WHERE event_name LIKE '%Challenge%'
            AND event_date >= date('now', '-7 days')
            GROUP BY event_name, event_date, source_url
            HAVING deck_count < 4
        `;

        const res = await db.execute(query);
        const incompleteEvents = res.rows;

        console.log(`Found ${incompleteEvents.length} incomplete challenge events.`);

        for (const ev of incompleteEvents) {
            if (!ev.source_url || !ev.source_url.includes('mtggoldfish.com')) {
                console.log(`Skipping event with no valid Goldfish URL: ${ev.event_name}`);
                continue;
            }

            console.log(`[BACKFILL] Re-scraping: ${ev.event_name} (${ev.event_date}) - ${ev.source_url}`);
            try {
                // Force = true to bypass unique constraint if we handle it inside scrapeTournament
                // Actually scrapeTournament uses "INSERT" so it will skip duplicates anyway, 
                // but we want to catch the ones we missed.
                await scrapeTournament(ev.source_url, true);
            } catch (err) {
                console.error(`Failed to re-scrape ${ev.event_name}:`, err.message);
            }
        }

        console.log("=== Backfill Complete ===");
    } catch (err) {
        console.error("Backfill failed:", err);
    }
}

backfillChallenges();
