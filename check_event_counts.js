require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@libsql/client');

async function checkEvents() {
    const db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    try {
        console.log("Checking recent CHALLENGE events...");
        // Get events from last 7 days with their deck counts
        const res = await db.execute(`
            SELECT event_name, event_date, COUNT(*) as deck_count 
            FROM decks 
            WHERE event_name LIKE '%Challenge%' 
            AND event_date >= date('now', '-7 days')
            GROUP BY event_name 
            ORDER BY event_date DESC
        `);
        console.table(res.rows);

        console.log("\nChecking Top 8 specifically...");
        const res8 = await db.execute(`
            SELECT event_name, COUNT(*) as top8_count 
            FROM decks 
            WHERE event_name LIKE '%Challenge%' 
            AND event_date >= date('now', '-7 days')
            AND rank <= 8
            GROUP BY event_name 
            ORDER BY event_date DESC
        `);
        console.table(res8.rows);

    } catch (e) {
        console.error(e);
    }
}

checkEvents();
