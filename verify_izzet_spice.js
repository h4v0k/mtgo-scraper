require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function verify() {
    console.log("Verifying Izzet Lessons Spice Data...");
    // standard
    const res = await db.execute("SELECT id, spice_cards, spice_count FROM decks WHERE archetype_id = 3435 LIMIT 1");
    if (res.rows.length === 0) {
        console.log("No decks found.");
        return;
    }
    const deck = res.rows[0];
    console.log(`Deck ID: ${deck.id}`);
    console.log(`Spice Count: ${deck.spice_count}`);
    console.log(`Spice Cards: ${deck.spice_cards}`);

    // Check if Accumulate Wisdom is in there
    if (deck.spice_cards && deck.spice_cards.includes("Accumulate Wisdom")) {
        console.log("FAIL: Accumulate Wisdom is still marked as spice!");
    } else {
        console.log("PASS: Accumulate Wisdom is NOT marked as spice.");
    }
}

verify();
