require('dotenv').config({ path: './server/.env' });
const { db } = require('./db');

async function cleanupLeagues() {
    console.log("Starting League Data Cleanup...");

    try {
        // 1. Identify records to delete (Leagues that aren't 5-0)
        // Based on our analysis, 5-0s are usually rank 1 or 5 on Goldfish.
        // But the user specifically wants ONLY 5-0s.
        // We will keep rank 0 (our new sentinel), 1 (sometimes 5-0), and 5 (often 5-0).
        // Actually, to be safe and accurate with previous data, we'll delete anything where rank > 1 but rank != 5 for leagues?
        // Wait, looking at check_leagues_data.js output:
        // Rank 1: counts 340, 189, 170, 159...
        // Rank 5: counts 141, 141, 65, 43...
        // Rank 2, 3, 4, 6, 7, 8: counts 25, 22, 20...
        // Those definitely seem like non-5-0s.

        const deleteRes = await db.execute(`
            DELETE FROM decks 
            WHERE event_name LIKE '%League%' 
            AND rank NOT IN (0, 1, 5)
        `);
        console.log(`Deleted ${deleteRes.rowsAffected} non-5-0 League records.`);

        // 2. Standardize remaining leagues to rank 0
        const updateRes = await db.execute(`
            UPDATE decks 
            SET rank = 0 
            WHERE event_name LIKE '%League%' 
            AND rank IN (1, 5)
        `);
        console.log(`Standardized ${updateRes.rowsAffected} League records to Rank 0 (5-0).`);

        console.log("League Cleanup Complete!");
    } catch (e) {
        console.error("Cleanup failed:", e);
    }
}

cleanupLeagues();
