// Load production env
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.production') });
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.error("Missing Turnso credentials.");
    process.exit(1);
}

const db = createClient({ url, authToken });

async function migrate() {
    console.log("Starting Jeskai Artifacts migration...");

    try {
        // 1. Ensure Archetype Exists
        console.log("Creating archetype 'Jeskai Artifacts'...");
        // Handle potential race condition or existing entry manually since NOT EXISTS logic can be verbose in various SQL dialects
        try {
            await db.execute("INSERT INTO archetypes (name, format) VALUES ('Jeskai Artifacts', 'Standard')");
        } catch (e) {
            if (e.message.includes('UNIQUE constraint failed')) {
                console.log("Archetype already exists.");
            } else {
                throw e;
            }
        }

        // 2. Get IDs
        const newArchRes = await db.execute("SELECT id FROM archetypes WHERE name = 'Jeskai Artifacts' AND format = 'Standard'");
        const oldArchRes = await db.execute("SELECT id FROM archetypes WHERE name = 'Boros Artifacts' AND format = 'Standard'");

        if (newArchRes.rows.length === 0 || oldArchRes.rows.length === 0) {
            console.error("Could not find archetype IDs. Aborting.");
            return;
        }

        const newId = newArchRes.rows[0].id;
        const oldId = oldArchRes.rows[0].id;

        // 3. Update Decks
        console.log(`Moving decks from ${oldId} (Boros) to ${newId} (Jeskai)...`);

        const result = await db.execute({
            sql: `UPDATE decks 
                  SET archetype_id = ? 
                  WHERE archetype_id = ? 
                  AND (raw_decklist LIKE '%Island%' OR raw_decklist LIKE '%No More Lies%')`,
            args: [newId, oldId]
        });

        console.log(`Migration complete. Moved ${result.rowsAffected} decks.`);

    } catch (e) {
        console.error("Migration failed:", e);
    }
}

migrate();
