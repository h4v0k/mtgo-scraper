const { db, initDB } = require('../db');

async function cleanDuplicates() {
    try {
        await initDB();
        console.log("Starting duplicate Challenge cleanup...\n");

        // Find all dates with duplicate Challenge entries
        const duplicatesQuery = `
            SELECT event_date, format,
                   REPLACE(REPLACE(event_name, ' (1)', ''), ' (2)', '') as base_name,
                   COUNT(DISTINCT event_name) as name_variants,
                   GROUP_CONCAT(DISTINCT event_name) as names,
                   SUM(CASE WHEN rank <= 4 THEN 1 ELSE 0 END) as total_top4
            FROM decks
            WHERE event_name LIKE '%Challenge%'
            GROUP BY event_date, format, base_name
            HAVING name_variants > 1
            ORDER BY event_date DESC
        `;

        const duplicates = await db.execute(duplicatesQuery);

        if (duplicates.rows.length === 0) {
            console.log("No duplicates found!");
            process.exit(0);
        }

        console.log(`Found ${duplicates.rows.length} dates with duplicate entries:\n`);
        console.table(duplicates.rows);

        // For each duplicate, keep the one with most decks and delete others
        let deletedCount = 0;

        for (const dup of duplicates.rows) {
            const names = dup.names.split(',');
            console.log(`\n=== Processing: ${dup.base_name} on ${dup.event_date} ===`);
            console.log(`Variants: ${names.join(', ')}`);

            // Get deck counts for each variant
            const counts = [];
            for (const name of names) {
                const countRes = await db.execute({
                    sql: "SELECT COUNT(*) as cnt FROM decks WHERE event_name = ? AND event_date = ? AND format = ?",
                    args: [name.trim(), dup.event_date, dup.format]
                });
                counts.push({ name: name.trim(), count: countRes.rows[0].cnt });
            }

            // Sort by count descending
            counts.sort((a, b) => b.count - a.count);
            const keepName = counts[0].name;
            const deleteNames = counts.slice(1).map(c => c.name);

            console.log(`  Keeping: ${keepName} (${counts[0].count} decks)`);
            console.log(`  Deleting: ${deleteNames.join(', ')}`);

            // Delete the duplicates
            for (const delName of deleteNames) {
                const result = await db.execute({
                    sql: "DELETE FROM decks WHERE event_name = ? AND event_date = ? AND format = ?",
                    args: [delName, dup.event_date, dup.format]
                });
                deletedCount += result.rowsAffected || 0;
                console.log(`    Deleted ${result.rowsAffected} decks from "${delName}"`);
            }
        }

        console.log(`\n✅ Cleanup complete. Deleted ${deletedCount} duplicate deck entries.`);
        process.exit(0);

    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

cleanDuplicates();
