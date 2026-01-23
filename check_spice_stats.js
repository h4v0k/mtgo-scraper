require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@libsql/client');

async function checkIzzet() {
    const db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    try {
        console.log("Checking Izzet Lessons archetype...");

        // 1. Find Archetype ID
        const archRes = await db.execute("SELECT id, name, format FROM archetypes WHERE name LIKE '%Izzet Lessons%'");
        console.table(archRes.rows);

        if (archRes.rows.length === 0) {
            console.log("No exact match. Checking all Izzet...");
            const allRes = await db.execute("SELECT id, name, format FROM archetypes WHERE name LIKE '%Izzet%' AND format='Standard' LIMIT 10");
            console.table(allRes.rows);
            return;
        }

        const aid = archRes.rows[0].id;

        // 2. Count Decks in last 60 days
        const deckRes = await db.execute({
            sql: "SELECT count(*) as count FROM decks WHERE archetype_id = ? AND event_date >= date('now', '-60 days')",
            args: [aid]
        });
        console.log(`Decks in last 60 days: ${deckRes.rows[0].count}`);

        // 3. Check card usage if possible?
        // (Too complex for simple script, just need context size)

    } catch (e) {
        console.error(e);
    }
}

checkIzzet();
