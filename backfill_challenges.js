require('dotenv').config();
const { db, initDB } = require('./server/db');
const { scrapeTournament } = require('./server/services/goldfish');

async function backfillChallenges() {
    await initDB();
    console.log("=== Starting Challenge Backfill ===");

    try {
        // Find events in the last 7 days with fewer than 4 decks
        const query = `
            SELECT event_name, event_date, source_url, COUNT(*) as deck_count
            FROM decks
            WHERE event_name LIKE '%Challenge%'
            AND event_date >= date('now', '-7 days')
            GROUP BY event_name, event_date, source_url
            HAVING (event_name LIKE '%Challenge%' AND deck_count < 32)
               OR (event_name LIKE '%League%' AND deck_count < 1)
               OR deck_count < 4
        `;

        const res = await db.execute(query);
        const incompleteEvents = res.rows;

        console.log(`Found ${incompleteEvents.length} incomplete challenge events.`);

        for (const ev of incompleteEvents) {
            if (!ev.source_url || !ev.source_url.includes('mtggoldfish.com')) {
                console.log(`[SKIP] Missing/Invalid URL: ${ev.event_name}`);
                continue;
            }

            let targetUrl = ev.source_url;
            console.log(`[BACKFILL] Processing: ${ev.event_name} (${ev.event_date})`);

            try {
                // If it's a deck URL (e.g., /deck/7589084), we might need to find the tournament link
                // or just trust that scrapeTournament handles redirection/discovery if we improve it.
                // For now, let's at least log it clearly.
                if (targetUrl.includes('/deck/')) {
                    console.log(`  Source is a DECK URL. Attempting discovery...`);
                }

                await scrapeTournament(targetUrl, true);
                console.log(`  Finished processing ${ev.event_name}`);
            } catch (err) {
                console.error(`  [ERROR] ${ev.event_name}:`, err.message);
            }
        }

        console.log("=== Backfill Complete ===");
    } catch (err) {
        console.error("Backfill failed:", err);
    }
}

backfillChallenges();
