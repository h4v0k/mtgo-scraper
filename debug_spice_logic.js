require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@libsql/client');
const { calculateSpice } = require('./server/services/spice');

async function debugSpice() {
    const db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    try {
        console.log("Fetching context for Izzet Lessons (Standard)...");
        const ctxRes = await db.execute({
            sql: "SELECT raw_decklist, sideboard FROM decks WHERE archetype_id = 3435 AND event_date >= date('now', '-60 days')"
        });

        const contextDecks = ctxRes.rows;
        console.log(`Context size: ${contextDecks.length}`);

        // Mock Deck (Valid Izzet Lessons list)
        // Check frequencies manually
        const cardCounts = {};
        contextDecks.forEach(d => {
            const lines = (d.raw_decklist || '').split('\n');
            lines.forEach(l => {
                const parts = l.trim().split(' ');
                if (parseInt(parts[0])) {
                    const name = parts.slice(1).join(' ');
                    cardCounts[name] = (cardCounts[name] || 0) + 1;
                }
            });
        });

        console.log("\nTop 10 Most Common Cards:");
        Object.entries(cardCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([name, count]) => console.log(`${name}: ${count}`));

        console.log(`\nFrequency Threshold (15%): ${Math.floor(contextDecks.length * 0.15)}`);

    } catch (e) {
        console.error(e);
    }
}

debugSpice();
