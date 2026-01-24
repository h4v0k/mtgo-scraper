const { db, initDB } = require('../db');

async function debugChallenges() {
    try {
        await initDB();
        const format = 'Standard';

        // 1. Get latest date
        const dateRes = await db.execute({
            sql: `SELECT MAX(event_date) as last_date 
                  FROM decks 
                  WHERE format = ? 
                  AND event_name LIKE '%Challenge%'`,
            args: [format]
        });
        const date = dateRes.rows[0].last_date;
        console.log("Latest Date:", date);

        if (!date) {
            console.log("No dates found.");
            process.exit(0);
        }

        const datePart = new Date(date).toISOString().split('T')[0];
        console.log("Date Part:", datePart);

        // 2. Run the actual query
        const query = `
            SELECT d.id, d.player_name, d.event_name, d.event_date, d.rank, d.raw_decklist, d.sideboard,
                   a.name as archetype
            FROM decks d
            JOIN archetypes a ON d.archetype_id = a.id
            WHERE d.format = ? 
            AND d.event_name LIKE '%Challenge%'
            AND d.event_date LIKE ?
            AND d.rank <= 4
            ORDER BY d.event_name DESC, d.rank ASC
        `;

        const result = await db.execute({
            sql: query,
            args: [format, `${datePart}%`]
        });

        console.log("Query Results Count:", result.rows.length);
        if (result.rows.length > 0) {
            console.log("Sample Row:", JSON.stringify(result.rows[0], null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
debugChallenges();
