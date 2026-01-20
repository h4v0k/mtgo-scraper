// Load production env first
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.production') });

const { db } = require('./db');
const { runHeuristicNormalization } = require('./services/heuristicService');
const { runSimilarityClassification } = require('./services/similarityService');
const { runNormalizationJob } = require('./services/normalizationService');
const { resolveUnknownArchetypes } = require('./services/aiService');

async function runRemoteNormalization() {
    console.log("Starting REMOTE normalization on Turso...");

    // 1. Fix bad archetypes manually first
    try {
        console.log("Fixing 'Sunday Destination Qualifier' archetypes...");
        await db.execute({
            sql: "UPDATE decks SET archetype_id = (SELECT id FROM archetypes WHERE name = 'Unknown' AND format = decks.format LIMIT 1) WHERE archetype_id IN (SELECT id FROM archetypes WHERE name LIKE '%Destination Qualifier%')"
        });
        await db.execute("DELETE FROM archetypes WHERE name LIKE '%Destination Qualifier%'");
        console.log("Fixed 'Destination Qualifier'.");
    } catch (e) {
        console.error("Manual fix error (ignoring):", e.message);
    }

    // 2. Run Standard Pipeline
    try {
        console.log('Running Heuristic Normalization...');
        await runHeuristicNormalization();

        console.log('Running Similarity Classification...');
        await runSimilarityClassification();

        // console.log('Running AI Name Normalization...');
        // await runNormalizationJob();

        // console.log('Running AI Unknown Resolution (Limit 50)...');
        // // Increasing limit to handle the influx
        // await resolveUnknownArchetypes(100);

        console.log("Remote normalization complete.");
    } catch (err) {
        console.error('Pipeline failed:', err);
    }
}

// Only run if called directly
if (require.main === module) {
    runRemoteNormalization();
}

module.exports = { runRemoteNormalization };
