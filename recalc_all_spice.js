require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@libsql/client');
const { calculateSpice } = require('./server/services/spice');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function recalcSpice() {
    console.log("=== Recalculating Spice for ALL Decks ===");

    // 1. Get all archetypes
    const arcs = await db.execute("SELECT id, name, format FROM archetypes");
    console.log(`Found ${arcs.rows.length} archetypes.`);

    for (const arc of arcs.rows) {
        console.log(`Processing ${arc.name} (${arc.format})...`);

        // 2. Get all decks for this archetype (Context)
        // We use the LAST 60 DAYS for context, but we want to update ALL decks? 
        // Or just recent ones? 
        // Let's update decks from the last 60 days. Old decks outside of meta don't matter as much.

        const contextRes = await db.execute({
            sql: "SELECT id, raw_decklist, sideboard FROM decks WHERE archetype_id = ? AND event_date >= date('now', '-60 days')",
            args: [arc.id]
        });

        const contextDecks = contextRes.rows;
        if (contextDecks.length < 5) {
            console.log(`  Skipping (Low sample size: ${contextDecks.length})`);
            // Optionally clear spice for these?
            continue;
        }

        // 3. Recalculate for EACH deck in this context
        const updates = [];

        for (const deck of contextDecks) {
            const spiceResult = calculateSpice({
                raw_decklist: deck.raw_decklist,
                sideboard: deck.sideboard
            }, contextDecks);

            // Optimization: Only update if changed? 
            // For now, just direct update.

            updates.push({
                id: deck.id,
                count: spiceResult.count,
                cards: JSON.stringify(spiceResult.cards)
            });
        }

        // 4. Batch Update
        console.log(`  Updating ${updates.length} decks...`);
        for (const u of updates) {
            await db.execute({
                sql: "UPDATE decks SET spice_count = ?, spice_cards = ? WHERE id = ?",
                args: [u.count, u.cards, u.id]
            });
        }
    }

    console.log("=== Done ===");
}

recalcSpice();
