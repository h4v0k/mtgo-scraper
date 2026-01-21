const { db } = require('./server/db');

async function universalCleanup() {
    console.log("Starting UNIVERSAL deduplication...");

    // Find all potential duplicates: Same Player, Same Format, Same Date (approx)
    // We group by player/format/date to find clusters
    const sql = `
        SELECT 
            d1.id as id1, d1.event_name as event1, d1.raw_decklist as deck1,
            d2.id as id2, d2.event_name as event2, d2.raw_decklist as deck2
        FROM decks d1
        JOIN decks d2 ON 
            d1.player_name = d2.player_name AND 
            d1.format = d2.format AND 
            d1.id < d2.id AND
            (d1.event_date = d2.event_date OR abs(julianday(d1.event_date) - julianday(d2.event_date)) < 1)
    `;

    const result = await db.execute({ sql, args: [] });
    console.log(`Analyzing ${result.rows.length} candidate pairs...`);

    let deletedCount = 0;
    const deletedIds = new Set();

    for (const row of result.rows) {
        if (deletedIds.has(row.id1) || deletedIds.has(row.id2)) continue; // Already handled

        // 1. Content Check: Must be identical
        if (row.deck1 !== row.deck2) {
            // console.log(`Skipping content mismatch: ${row.event1} vs ${row.event2}`);
            continue;
        }

        let toDelete = null;
        const e1 = row.event1.toLowerCase();
        const e2 = row.event2.toLowerCase();

        // STRICT CHECK: Do not allow cross-type deduplication (e.g. League vs Challenge)
        // We categorize events into broad buckets: 'league', 'challenge', 'qualifier', 'preliminary', 'championship'

        const getType = (e) => {
            if (e.includes('league')) return 'league';
            if (e.includes('challenge')) return 'challenge';
            if (e.includes('qualifier')) return 'qualifier';
            if (e.includes('showcase')) return 'showcase';
            if (e.includes('preliminary')) return 'preliminary';
            if (e.includes('championship')) return 'championship';
            return 'other';
        };

        const t1 = getType(e1);
        const t2 = getType(e2);

        if (t1 !== t2) {
            console.log(`Skipping distinct event types: ${row.event1} (${t1}) vs ${row.event2} (${t2})`);
            continue;
        }

        // If types match (e.g. League vs League, or Challenge vs Challenge), check for Aliases
        // Priority: Specific Format Name > "MTGO" Generic Name

        const isGeneric1 = e1.startsWith('mtgo ');
        const isGeneric2 = e2.startsWith('mtgo ');

        if (isGeneric1 && !isGeneric2) {
            toDelete = row.id1;
            console.log(`[Specificity] Keeping ${row.event2}, Deleting Generic ${row.event1} (ID: ${toDelete})`);
        } else if (!isGeneric1 && isGeneric2) {
            toDelete = row.id2;
            console.log(`[Specificity] Keeping ${row.event1}, Deleting Generic ${row.event2} (ID: ${toDelete})`);
        } else {
            // Both are generic or both are specific.
            // Check for exact duplicates or near-duplicates?
            // e.g. "Modern Challenge 32" vs "Modern Challenge 32 (1)"
            // For Challenges, if one has (1) and other doesn't, usually they are duplicates of same ingest?
            // OR they are distinct brackets? 
            // Safest to SKIP if we aren't sure.

            if (row.event1 === row.event2) {
                toDelete = Math.max(row.id1, row.id2);
                console.log(`[Exact Duplicate] Deleting ID ${toDelete} of ${row.event1}`);
            } else {
                console.log(`Skipping ambiguous matching types: ${row.event1} vs ${row.event2}`);
            }
        }

        if (toDelete) {
            await db.execute({
                sql: `DELETE FROM decks WHERE id = ?`,
                args: [toDelete]
            });
            deletedIds.add(toDelete);
            deletedCount++;
        }
    }

    console.log(`Universal Cleanup Complete. Deleted ${deletedCount} records.`);
}

universalCleanup();
