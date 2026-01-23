const { db } = require('./server/db');

async function checkEventNames() {
    console.log("Checking for event names with dates...");

    // Find any event names that still contain dates
    const res = await db.execute(`
        SELECT DISTINCT event_name, format, COUNT(*) as count
        FROM decks 
        WHERE event_name LIKE '%202%-%-%' 
           OR event_name LIKE '%(202%)'
           OR event_name LIKE '%(%)%'
        GROUP BY event_name, format
        ORDER BY count DESC
    `);

    console.log(`Found ${res.rows.length} event names with potential date issues:`);
    for (const row of res.rows) {
        console.log(`  ${row.format}: "${row.event_name}" (${row.count} decks)`);
    }

    process.exit(0);
}

checkEventNames();
