require('dotenv').config({ path: './server/.env' });
const { db } = require('./server/db');

async function checkLeagues() {
    try {
        const result = await db.execute(`
            SELECT event_name, rank, count(*) as count 
            FROM decks 
            WHERE event_name LIKE '%League%' 
            GROUP BY event_name, rank
            ORDER BY count DESC
        `);
        console.log("League Data Summary:");
        console.table(result.rows);
    } catch (e) {
        console.error(e);
    }
}

checkLeagues();
