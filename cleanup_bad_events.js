require('dotenv').config();
const { db, initDB } = require('./server/db');

async function cleanupBadEvents() {
    await initDB();
    console.log("=== Starting Database Cleanup of Incorrectly Labeled Events ===");

    try {
        // Find events that are actually deck pages
        // Or names that look like deck titles
        const findQuery = `
            SELECT id, event_name, source_url
            FROM decks
            WHERE event_name LIKE '% by %'
               OR event_name LIKE '% Deck%'
               OR source_url LIKE '%/deck/%'
               OR event_name LIKE 'Standard %' AND event_name NOT LIKE '%Challenge%' AND event_name NOT LIKE '%League%' AND event_name NOT LIKE '%Qualifier%' AND event_name NOT LIKE '%Showcase%' AND event_name NOT LIKE '%Championship%'
        `;

        const res = await db.execute(findQuery);
        const badDecks = res.rows;

        console.log(`Found ${badDecks.length} incorrectly labeled deck entries.`);

        if (badDecks.length === 0) {
            console.log("No bad entries found. Skipping.");
            return;
        }

        // We want to delete these decks because they were ingested under a "fake" event name
        // and we will re-scrape them under the correct event name using the hardened backfill.
        const idsToDelete = badDecks.map(d => d.id);

        // Split into batches for deletion
        const BATCH_SIZE = 50;
        for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
            const batch = idsToDelete.slice(i, i + BATCH_SIZE);
            await db.execute({
                sql: `DELETE FROM decks WHERE id IN (${batch.map(() => '?').join(',')})`,
                args: batch
            });
            console.log(`Deleted batch of ${batch.length} decks...`);
        }

        // Also cleanup orphan archetypes if any (optional but good)
        await db.execute(`
            DELETE FROM archetypes 
            WHERE id NOT IN (SELECT DISTINCT archetype_id FROM decks)
            AND name NOT IN ('Unknown', 'Izzet Lessons', 'Standard Challenge 32')
        `);

        console.log("=== Cleanup Complete ===");
    } catch (err) {
        console.error("Cleanup failed:", err);
    }
}

cleanupBadEvents();
