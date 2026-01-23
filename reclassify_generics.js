const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const { runHeuristicNormalization } = require('./server/services/heuristicService');

async function main() {
    console.log('--- MTGO Scraper: Archetype Re-classification Pass ---');
    try {
        await runHeuristicNormalization();
        console.log('Pass completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Pass failed:', err);
        process.exit(1);
    }
}

main();
