const { db } = require('../db');
const fs = require('fs');
const path = require('path');

// Logic adapted from heuristicService.js

function loadSignatures() {
    const signatures = {};
    const tagsDir = path.resolve(__dirname, '../tags');
    if (!fs.existsSync(tagsDir)) return signatures;

    const files = fs.readdirSync(tagsDir);
    for (const file of files) {
        if (file.endsWith('_signatures.json')) {
            const format = file.replace('_signatures.json', '');
            try {
                const data = fs.readFileSync(path.join(tagsDir, file), 'utf8');
                signatures[format] = JSON.parse(data);
            } catch (e) {
                console.error(`Error loading signatures for ${format}:`, e.message);
            }
        }
    }
    return signatures;
}

async function analyze() {
    console.log('Starting Archetype Coverage Analysis...');

    // 1. Load Signatures
    const signatures = loadSignatures();
    const formats = Object.keys(signatures);
    console.log(`Loaded signatures for: ${formats.join(', ')}`);

    // 2. Fetch Decks (Last 30 days to be relevant, or all?)
    // User probably cares about the active meta. Let's do all to be safe, or large limit.
    // Fetching fields needed for check
    const decksRes = await db.execute(`
        SELECT id, raw_decklist, format, player_name, event_name, event_date 
        FROM decks 
        WHERE format IN ('Modern', 'Pioneer', 'Legacy', 'Pauper')
        ORDER BY event_date DESC
    `);

    const decks = decksRes.rows;
    console.log(`Analyzing ${decks.length} decks (Modern/Pioneer/Legacy/Pauper)...`);

    let stats = {
        total: decks.length,
        match75: 0,
        needsLookup: 0,
        noSignatureFile: 0
    };

    let sampleLookups = [];

    for (const deck of decks) {
        if (!deck.raw_decklist) continue;
        const list = deck.raw_decklist;
        const fmtSigs = signatures[deck.format];

        if (!fmtSigs || fmtSigs.length === 0) {
            stats.noSignatureFile++;
            stats.needsLookup++; // Technically falls through
            continue;
        }

        let maxScore = 0;
        let bestMatch = null;

        for (const sig of fmtSigs) {
            let matchCount = 0;
            for (const card of sig.signature) {
                if (list.includes(card)) matchCount++;
            }
            const score = matchCount / sig.signature.length;

            if (score > maxScore) {
                maxScore = score;
                bestMatch = sig.name;
            }
        }

        if (maxScore >= 0.75) {
            stats.match75++;
        } else {
            stats.needsLookup++;
            if (sampleLookups.length < 5) {
                sampleLookups.push(`${deck.format} | ${deck.player_name} @ ${deck.event_name} (Best Sig: ${bestMatch || 'None'} @ ${(maxScore * 100).toFixed(1)}%)`);
            }
        }
    }

    console.log('\n--- Analysis Results ---');
    console.log(`Total Decks Analyzed: ${stats.total}`);
    console.log(`Cards Matching Signatures (>= 75%): ${stats.match75} (${((stats.match75 / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Decks Requiring Goldfish Lookup: ${stats.needsLookup} (${((stats.needsLookup / stats.total) * 100).toFixed(1)}%)`);

    console.log('\n--- Sample Decks for Lookup ---');
    sampleLookups.forEach(l => console.log(l));
}

analyze();
