const { db } = require('./server/db');

async function analyzeGlobal() {
    console.log("Analyzing GLOBAL duplicate patterns...");

    // Find all cases where a Player has >1 deck for the same Format + Date
    // And list the conflicting Event Names
    const sql = `
        SELECT 
            d1.format,
            d1.event_name as event1,
            d2.event_name as event2,
            COUNT(*) as count
        FROM decks d1
        JOIN decks d2 ON 
            d1.player_name = d2.player_name AND 
            d1.event_date = d2.event_date AND 
            d1.format = d2.format AND 
            d1.id < d2.id
        WHERE 
            d1.event_name != d2.event_name
        GROUP BY d1.format, d1.event_name, d2.event_name
        ORDER BY count DESC
        LIMIT 50;
    `;

    const result = await db.execute({ sql, args: [] });

    if (result.rows.length === 0) {
        console.log("No duplicate event patterns found.");
    } else {
        console.table(result.rows);
    }
}

analyzeGlobal();
