const { db } = require('./server/db');

async function cleanup() {
    console.log("Cleaning up duplicate League entries...");

    // Find collisions where Decklist is identical
    const sql = `
        SELECT 
            d1.id as id1, d1.event_name as event1,
            d2.id as id2, d2.event_name as event2
        FROM decks d1
        JOIN decks d2 ON 
            d1.player_name = d2.player_name AND 
            d1.event_date = d2.event_date AND 
            d1.format = d2.format AND 
            d1.id < d2.id
        WHERE 
            d1.raw_decklist = d2.raw_decklist
    `;

    const result = await db.execute({ sql, args: [] });

    let deletedCount = 0;

    for (const row of result.rows) {
        let toDelete = null;

        // Priority: Challenge/Qualifier/Champ > League
        const isLeague1 = /League/i.test(row.event1);
        const isLeague2 = /League/i.test(row.event2);

        if (isLeague1 && !isLeague2) {
            toDelete = row.id1;
            console.log(`Deleting ${row.event1} (ID: ${row.id1}) in favor of ${row.event2}`);
        } else if (!isLeague1 && isLeague2) {
            toDelete = row.id2;
            console.log(`Deleting ${row.event2} (ID: ${row.id2}) in favor of ${row.event1}`);
        } else if (isLeague1 && isLeague2) {
            // Both leagues? Delete the one with the higher ID (duplicate ingest)
            toDelete = Math.max(row.id1, row.id2);
            console.log(`Deleting duplicate League (ID: ${toDelete})`);
        } else {
            // Both are non-leagues (e.g. Challenge 32 vs Challenge 64)
            // Arbitrarily delete the one with higher ID? Or just log?
            // Let's delete the higher ID to be clean
            toDelete = Math.max(row.id1, row.id2);
            console.log(`Deleting duplicate Event (ID: ${toDelete}) - ${row.event1} vs ${row.event2}`);
        }

        if (toDelete) {
            await db.execute({
                sql: `DELETE FROM decks WHERE id = ?`,
                args: [toDelete]
            });
            deletedCount++;
        }
    }

    console.log(`Cleanup complete. Deleted ${deletedCount} duplicate records.`);
}

cleanup();
