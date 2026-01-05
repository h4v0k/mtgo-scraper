const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@libsql/client');

// Load production secrets
const prodEnvPath = path.resolve(__dirname, '.env.production');
const result = dotenv.config({ path: prodEnvPath });

if (result.error) {
    console.error("Could not find .env.production");
    process.exit(1);
}

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function check() {
    try {
        console.log("--- DEBUGGER ---");
        const decks = await db.execute("SELECT COUNT(*) as c FROM decks");
        console.log(`Decks Count: ${decks.rows[0].c}`);

        const arch = await db.execute("SELECT COUNT(*) as c FROM archetypes");
        console.log(`Archetypes Count: ${arch.rows[0].c}`);

        if (decks.rows[0].c > 0) {
            const sample = await db.execute("SELECT * FROM decks LIMIT 1");
            console.log("Sample Deck:", sample.rows[0]);
        }
    } catch (e) {
        console.error("Query Failed:", e);
    }
}

check();
