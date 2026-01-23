const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const { db } = require('./server/db');

async function test() {
    console.log("Testing Connection...");
    console.log("URL:", process.env.TURSO_DATABASE_URL);
    console.log("Token:", process.env.TURSO_AUTH_TOKEN ? "Set (Length: " + process.env.TURSO_AUTH_TOKEN.length + ")" : "Not Set");
    try {
        const res = await db.execute("SELECT COUNT(*) as c FROM decks");
        console.log("Decks Count:", res.rows[0].c);

        const res2 = await db.execute("SELECT COUNT(*) as c FROM decks WHERE spice_count > 0");
        console.log("Spicy Decks:", res2.rows[0].c);

    } catch (e) {
        console.error("Connection Failed:", e);
    }
}

test();
