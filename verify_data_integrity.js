require('dotenv').config();
const { db, initDB } = require('./server/db');

async function verifyIntegrity() {
    await initDB();
    console.log("=== Data Integrity Report ===");

    try {
        // 1. Check for bad event names
        const badNamesRes = await db.execute(`
            SELECT event_name, COUNT(*) as c 
            FROM decks 
            WHERE event_name LIKE '% by %' OR event_name LIKE '% Deck'
            GROUP BY event_name
        `);
        console.log(`\nIncorrectly labeled events (should be 0): ${badNamesRes.rows.length}`);
        badNamesRes.rows.forEach(r => console.log(`  - ${r.event_name} (${r.c} decks)`));

        // 2. Check for Standard Challenges in the last 7 days
        const standardRes = await db.execute(`
            SELECT event_date, COUNT(*) as deck_count
            FROM decks
            WHERE format = 'Standard' AND event_name LIKE '%Challenge%'
            AND event_date >= date('now', '-7 days')
            GROUP BY event_date
            ORDER BY event_date DESC
        `);
        console.log(`\nStandard Challenges (Last 7 Days):`);
        standardRes.rows.forEach(r => {
            console.log(`  - ${r.event_date}: ${r.deck_count} decks ${r.deck_count < 4 ? '⚠️' : '✅'}`);
        });

        // 3. Check for format consistency
        const formatRes = await db.execute(`
            SELECT format, COUNT(*) as c FROM decks GROUP BY format
        `);
        console.log(`\nFormat Distribution:`);
        formatRes.rows.forEach(r => console.log(`  - ${r.format}: ${r.c} decks`));

        console.log("\n=== End of Report ===");
    } catch (err) {
        console.error("Verification failed:", err);
    }
}

verifyIntegrity();
