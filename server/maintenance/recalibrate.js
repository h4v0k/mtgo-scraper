const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../db');
const { clusterDecks } = require('../services/aiService');
const fs = require('fs');

const BATCH_SIZE = 50;
const MAX_DECKS = 150;

async function runRecalibration(format) {
    if (!process.env.GEMINI_API_KEY) {
        console.error("FATAL: GEMINI_API_KEY is missing!");
        return;
    }
    console.log(`\n=== Starting AI Recalibration for ${format} (Winter 2025/2026) ===`);
    console.log(`API Key loaded: ${process.env.GEMINI_API_KEY.substring(0, 5)}...`);

    // 1. Fetch recent decks
    const decks = db.prepare(`
        SELECT id, raw_decklist 
        FROM decks 
        WHERE format = ? 
        ORDER BY event_date DESC 
        LIMIT ?
    `).all(format, MAX_DECKS);

    if (decks.length === 0) {
        console.log("No decks found.");
        return;
    }

    console.log(`Fetched ${decks.length} decks.`);

    const signatures = [];

    // 2. Process in batches
    for (let i = 0; i < decks.length; i += BATCH_SIZE) {
        const batch = decks.slice(i, i + BATCH_SIZE).map(d => {
            // Pre-processing: Remove lands to save tokens? 
            // Better: Keep lands but remove basics to allow AI to see land base (important for Simic vs Izzet)
            const cleanList = d.raw_decklist
                .split('\n')
                .filter(l => !['Island', 'Mountain', 'Swamp', 'Plains', 'Forest'].some(b => l.includes(b) && l.length < 10)) // Simple basic land filter
                .slice(0, 30) // Take top 30 unique cards
                .join('\n');
            return { id: d.id, list: cleanList };
        });

        console.log(`Processing Batch ${i / BATCH_SIZE + 1}...`);
        const clusters = await clusterDecks(batch, format);

        if (clusters.length > 0) {
            signatures.push(...clusters);
            console.log(`  Identified ${clusters.length} clusters.`);

            // Apply updates immediately to DB (optional, or just save signature)
            updateDatabase(clusters, format);
        }

        // Sleep to respect rate limits
        await new Promise(r => setTimeout(r, 2000));
    }

    // 3. Save Signatures
    const sigPath = path.join(__dirname, `../tags/${format}_signatures.json`);

    // Merge signatures (some batches might find same archetype)
    // We want a unified list. This simple script appends. 
    // Ideally we would merge duplicates, but for now we just save raw output.
    fs.mkdirSync(path.join(__dirname, '../tags'), { recursive: true });
    fs.writeFileSync(sigPath, JSON.stringify(signatures, null, 2));

    console.log(`Saved signatures to ${sigPath}`);
}

function updateDatabase(clusters, format) {
    const insertArch = db.prepare('INSERT OR IGNORE INTO archetypes (name, format) VALUES (?, ?)');
    const getArchId = db.prepare('SELECT id FROM archetypes WHERE name = ? AND format = ?');
    const updateDeck = db.prepare('UPDATE decks SET archetype_id = ? WHERE id = ?');

    db.transaction(() => {
        for (const cluster of clusters) {
            insertArch.run(cluster.name, format);
            const archId = getArchId.get(cluster.name, format).id;

            for (const deckId of cluster.deckIds) {
                updateDeck.run(archId, deckId);
            }
        }
    })();
}

// CLI Argument
const formatArg = process.argv.find(arg => arg.startsWith('--format='));
const format = formatArg ? formatArg.split('=')[1] : 'Standard';

runRecalibration(format);
