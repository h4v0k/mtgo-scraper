
require('dotenv').config({ path: 'server/.env.production' });
const { db } = require('./db');

async function audit() {
    console.log('Starting Classification Audit (High Spice Detector)...');

    // Get all archetypes
    const archs = await db.execute("SELECT id, name, format FROM archetypes");

    for (const arch of archs.rows) {
        // Get decks for this archetype (last 30 days to be relevant like the app)
        const decksRes = await db.execute({
            sql: "SELECT id, player_name, raw_decklist, sideboard FROM decks WHERE archetype_id = ? AND event_date >= date('now', '-30 days')",
            args: [arch.id]
        });
        const decks = decksRes.rows;
        if (decks.length < 5) continue; // Skip small sample sizes

        // Build frequency map
        const cardCounts = {};
        let totalDecks = decks.length;

        const processList = (list) => {
            if (!list) return;
            const lines = list.split('\n');
            lines.forEach(line => {
                const parts = line.trim().split(' ');
                const count = parseInt(parts[0]);
                if (!isNaN(count)) {
                    const cardName = parts.slice(1).join(' ');
                    cardCounts[cardName] = (cardCounts[cardName] || 0) + 1;
                }
            });
        };

        decks.forEach(d => {
            processList(d.raw_decklist);
            processList(d.sideboard);
        });

        // Check each deck for spice
        for (const deck of decks) {
            let spiceCount = 0;
            const checkSpice = (list) => {
                if (!list) return;
                list.split('\n').forEach(line => {
                    const parts = line.trim().split(' ');
                    if (parseInt(parts[0])) {
                        const cardName = parts.slice(1).join(' ');
                        const freq = (cardCounts[cardName] || 0) / totalDecks;
                        if (freq < 0.20) spiceCount++;
                    }
                });
            };
            checkSpice(deck.raw_decklist);
            checkSpice(deck.sideboard);

            if (spiceCount > 5) {
                console.log(`[SUSPECT] Deck ID: ${deck.id} | Player: ${deck.player_name} | Arch: ${arch.name} | Spice Count: ${spiceCount}`);
            }
        }
    }
    console.log('Audit Complete.');
}

audit();
