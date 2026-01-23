const { db } = require('./server/db');

async function checkStandard() {
    try {
        console.log("Checking Standard decks...");

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        console.log(`Querying since: ${threeDaysAgo.toISOString()}`);

        // Count by event
        const events = await db.execute({
            sql: `SELECT event_name, event_date, COUNT(*) as cnt 
                  FROM decks 
                  WHERE format = 'Standard' 
                  AND event_date >= ?
                  GROUP BY event_name, event_date
                  ORDER BY event_date DESC`,
            args: [threeDaysAgo.toISOString()]
        });

        console.table(events.rows);

        // Total count
        const total = await db.execute({
            sql: `SELECT COUNT(*) as total 
                  FROM decks 
                  WHERE format = 'Standard' 
                  AND event_date >= ?`,
            args: [threeDaysAgo.toISOString()]
        });
        console.log(`Total Standard Decks (Last 3 Days): ${total.rows[0].total}`);

    } catch (err) {
        console.error("Error:", err);
    }
}

checkStandard();
