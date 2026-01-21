const { db } = require('./server/db');
const { calculateSpice } = require('./server/services/spice');

async function backfillSpice() {
    console.log("Starting Spice Backfill...");

    // Get all decks that need update (or all decks)
    // We process by Archetype to optimize context fetching
    const archetypes = await db.execute("SELECT id, name FROM archetypes");

    for (const arch of archetypes.rows) {
        console.log(`Processing Archetype: ${arch.name}`);

        // Fetch all decks for this archetype (Last 60 days to provide good context)
        const decksRes = await db.execute({
            sql: `SELECT id, raw_decklist, sideboard, event_date 
                  FROM decks 
                  WHERE archetype_id = ? 
                  ORDER BY event_date DESC`,
            args: [arch.id]
        });

        const decks = decksRes.rows;
        if (decks.length < 5) continue; // Skip small samples

        // For each deck, calculate spice relative to this group
        // Note: Ideally context is "last X days from deck date", but for backfill using "entire set" 
        // or "window around deck" is better.
        // Let's use the full set as context for simplicity and stability, or maybe a sliding window?
        // Using full set is faster.

        for (const deck of decks) {
            const result = calculateSpice(deck, decks);
            // Update even if count is 0 to clear old data if re-running
            const cardsJSON = JSON.stringify(result.cards);

            await db.execute({
                sql: 'UPDATE decks SET spice_count = ?, spice_cards = ? WHERE id = ?',
                args: [result.count, cardsJSON, deck.id]
            });
        }
    }

    console.log("Spice Backfill Complete.");
}

backfillSpice();
