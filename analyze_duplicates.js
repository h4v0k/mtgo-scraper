const { db } = require('./server/db');

async function analyze() {
    console.log("Analyzing potential duplicates...");

    // Find players/dates/formats with > 1 deck entry where event names differ
    // This implies we have two records for the same logical event
    const sql = `
        SELECT 
            d1.player_name, 
            d1.event_date, 
            d1.format,
            d1.event_name as event1,
            d2.event_name as event2,
            d1.id as id1,
            d2.id as id2,
            (d1.raw_decklist = d2.raw_decklist) as exact_match
        FROM decks d1
        JOIN decks d2 ON 
            d1.player_name = d2.player_name AND 
            d1.event_date = d2.event_date AND 
            d1.format = d2.format AND 
            d1.id < d2.id
        WHERE 
            d1.event_name != d2.event_name
        ORDER BY d1.event_date DESC
        LIMIT 20;
    `;

    const result = await db.execute({ sql, args: [] });

    if (result.rows.length === 0) {
        console.log("No obvious duplicates found based on Player+Date+Format.");
    } else {
        console.table(result.rows);
    }
}

analyze();
