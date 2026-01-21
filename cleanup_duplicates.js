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
            // toDelete = row.id1;
            console.log(`SKIPPING distinct event types: ${row.event1} vs ${row.event2}`);
        } else if (!isLeague1 && isLeague2) {
            // toDelete = row.id2;
            console.log(`SKIPPING distinct event types: ${row.event2} vs ${row.event1}`);
        } else if (isLeague1 && isLeague2) {
            // Both leagues? Prefer the one with more specific name (e.g. not just "MTGO League")
            // Or if both specific, delete higher ID.

            const isGeneric1 = row.event1 === 'MTGO League' || row.event1 === 'League';
            const isGeneric2 = row.event2 === 'MTGO League' || row.event2 === 'League';

            if (isGeneric1 && !isGeneric2) {
                toDelete = row.id1;
                console.log(`Deleting Generic League ${row.event1} (ID: ${row.id1}) in favor of ${row.event2}`);
            } else if (!isGeneric1 && isGeneric2) {
                toDelete = row.id2;
                console.log(`Deleting Generic League ${row.event2} (ID: ${row.id2}) in favor of ${row.event1}`);
            } else {
                toDelete = Math.max(row.id1, row.id2);
                console.log(`Deleting duplicate League (ID: ${toDelete}) - ${row.event1} vs ${row.event2}`);
            }
            // Both are non-leagues (e.g. Challenge 32 vs Challenge 64)
            // This implies duplicates of specific events, usually safe to delete if decklist is identical
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
