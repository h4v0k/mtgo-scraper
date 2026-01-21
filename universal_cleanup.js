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

        // Priority Logic
        const getScore = (e) => {
            if (e.includes('championship')) return 100;
            if (e.includes('qualifier') || e.includes('showcase')) return 90;
            if (e.includes('challenge')) return 80;
            if (e.includes('preliminary')) return 70;
            if (e.includes('league')) return 10;
            return 0; // Unknown
        };

        const s1 = getScore(e1);
        const s2 = getScore(e2);

        if (s1 > s2) {
            toDelete = row.id2;
            console.log(`[Score ${s1} vs ${s2}] Keeping ${row.event1}, Deleting ${row.event2} (ID: ${toDelete})`);
        } else if (s2 > s1) {
            toDelete = row.id1;
            console.log(`[Score ${s2} vs ${s1}] Keeping ${row.event2}, Deleting ${row.event1} (ID: ${toDelete})`);
        } else {
            // Scores equal (e.g. League vs League, or Challenge vs Challenge)
            // Tiebreaker 1: Specificity (Longer name usually better? e.g. "Standard League" > "MTGO League")
            // Actually, user prefers "Standard League" (Format League) over "MTGO League".

            const isGeneric1 = e1 === 'mtgo league' || e1 === 'league';
            const isGeneric2 = e2 === 'mtgo league' || e2 === 'league';

            if (isGeneric1 && !isGeneric2) {
                toDelete = row.id1;
                console.log(`[Specificity] Keeping ${row.event2}, Deleting Generic ${row.event1} (ID: ${toDelete})`);
            } else if (!isGeneric1 && isGeneric2) {
                toDelete = row.id2;
                console.log(`[Specificity] Keeping ${row.event1}, Deleting Generic ${row.event2} (ID: ${toDelete})`);
            } else {
                // Tiebreaker 2: ID (Keep newer import? Or older? Usually newer has better metadata from Goldfish)
                // Let's delete the HIGHER ID (duplicate import) to preserve original if indistinguishable
                // Wait, actually duplicate import might be the BETTER one if it came from Goldfish with 'Standard League'
                // But we handled specificity above. 
                // If both are "Modern Challenge 32", just delete one.
                toDelete = Math.max(row.id1, row.id2);
                console.log(`[Tiebreaker] Deleting duplicate ${row.event2} (ID: ${toDelete})`);
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
