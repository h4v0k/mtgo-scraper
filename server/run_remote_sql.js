require('dotenv').config({ path: 'server/.env.production' });
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.error("Missing Turnso credentials.");
    process.exit(1);
}

const db = createClient({ url, authToken });

async function run() {
    const query = process.argv[2];
    if (!query) {
        console.log("Usage: node server/run_remote_sql.js \"SELECT * ...\"");
        return;
    }

    try {
        console.log(`Executing SQL on ${url}...`);
        const result = await db.execute(query);
        console.table(result.rows);
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
