const { db } = require('../db');

/**
 * Similarity Service
 * Uses statistical analysis to classify "Unknown" decks by comparing them 
 * to the fingerprints of known archetypes.
 */

// Basic lands to ignore in fingerprinting
const IGNORED_CARDS = [
    'Plains', 'Island', 'Swamp', 'Mountain', 'Forest',
    'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
    'Snow-Covered Mountain', 'Snow-Covered Forest',
    'Wastes'
];

async function runSimilarityClassification() {
    console.log('Starting Similarity Classification Job...');

    // 1. Build Fingerprints for Known Archetypes
    const fingerprints = {}; // { archId: Set<CardName> }

    // Get all valid archetypes (exclude Unknown) with at least 5 decks
    const validArchsRes = await db.execute(`
        SELECT id, name FROM archetypes 
        WHERE name != 'Unknown' 
        AND id IN (SELECT archetype_id FROM decks GROUP BY archetype_id HAVING count(*) >= 5)
    `);
    const validArchs = validArchsRes.rows;

    console.log(`Building fingerprints for ${validArchs.length} archetypes...`);

    for (const arch of validArchs) {
        const decksRes = await db.execute({
            sql: 'SELECT raw_decklist FROM decks WHERE archetype_id = ? LIMIT 50',
            args: [arch.id]
        });
        const decks = decksRes.rows;
        const cardFrequency = {};

        decks.forEach(d => {
            const lines = d.raw_decklist.split('\n');
            lines.forEach(line => {
                const parts = line.trim().split(' ');
                if (parts.length < 2) return;
                const name = parts.slice(1).join(' ');
                if (IGNORED_CARDS.includes(name)) return;

                cardFrequency[name] = (cardFrequency[name] || 0) + 1;
            });
        });

        // Take top 15 most frequent cards as the "Fingerprint"
        const sortedCards = Object.entries(cardFrequency)
            .sort((a, b) => b[1] - a[1]) // Descending freq
            .slice(0, 15)
            .map(e => e[0]);

        fingerprints[arch.id] = new Set(sortedCards);
    }

    // 2. Classify Unknown Decks
    const unknownArchRes = await db.execute({
        sql: 'SELECT id FROM archetypes WHERE name = ?',
        args: ['Unknown']
    });
    const unknownArch = unknownArchRes.rows[0];

    if (!unknownArch) {
        console.log('No Unknown archetype found. Skipping.');
        return;
    }

    const unknownDecksRes = await db.execute({
        sql: 'SELECT id, raw_decklist FROM decks WHERE archetype_id = ?',
        args: [unknownArch.id]
    });
    const unknownDecks = unknownDecksRes.rows;
    console.log(`Analyzing ${unknownDecks.length} Unknown decks...`);

    let movedCount = 0;

    // Transaction removed
    for (const deck of unknownDecks) {
        const deckCards = new Set();
        deck.raw_decklist.split('\n').forEach(line => {
            const parts = line.trim().split(' ');
            if (parts.length < 2) return;
            deckCards.add(parts.slice(1).join(' '));
        });

        // Compare against all fingerprints
        let bestMatchId = null;
        let bestScore = 0;

        for (const [archId, fingerSet] of Object.entries(fingerprints)) {
            // Calculate Jaccard-ish Score: Intersection / Fingerprint Size
            let matchCount = 0;
            fingerSet.forEach(card => {
                if (deckCards.has(card)) matchCount++;
            });

            const score = matchCount / fingerSet.size; // 0.0 to 1.0

            if (score > bestScore) {
                bestScore = score;
                bestMatchId = archId;
            }
        }

        // Threshold: 0.6
        if (bestMatchId && bestScore >= 0.6) {
            await db.execute({
                sql: 'UPDATE decks SET archetype_id = ? WHERE id = ?',
                args: [bestMatchId, deck.id]
            });
            movedCount++;
        }
    }

    console.log(`Similarity Job Complete. Classified ${movedCount} decks.`);
}

module.exports = { runSimilarityClassification };
