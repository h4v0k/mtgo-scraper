const { db } = require('./server/db');

async function fixDuplicatesAndAddIndex() {
    console.log("Starting Database Cleanup and Indexing...");

    try {
        // 1. Identify and remove duplicates based on source_url
        console.log("Identifying duplicate decks by source_url...");
        const dupesRes = await db.execute(`
            SELECT source_url, COUNT(*) as count
            FROM decks
            WHERE source_url IS NOT NULL AND source_url != ''
            GROUP BY source_url
            HAVING count > 1
        `);

        if (dupesRes.rows.length > 0) {
            console.log(`Found ${dupesRes.rows.length} URLs with duplicates.`);
            for (const row of dupesRes.rows) {
                const url = row.source_url;
                // Keep the one with the lowest ID (earliest import)
                console.log(`Cleaning up duplicates for ${url}...`);
                await db.execute({
                    sql: `DELETE FROM decks 
                          WHERE source_url = ? 
                          AND id NOT IN (SELECT MIN(id) FROM decks WHERE source_url = ?)`,
                    args: [url, url]
                });
            }
            console.log("Duplicate cleanup complete.");
        } else {
            console.log("No duplicates found based on source_url.");
        }

        // 2. Add Unique Index
        console.log("Creating UNIQUE index on decks(source_url)...");
        await db.execute(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_decks_source_url 
            ON decks(source_url) 
            WHERE source_url IS NOT NULL AND source_url != ''
        `);
        console.log("Index created successfully.");

    } catch (err) {
        console.error("Database operation failed:", err);
    }

    process.exit(0);
}

fixDuplicatesAndAddIndex();
