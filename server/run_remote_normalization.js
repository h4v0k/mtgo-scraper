require('dotenv').config({ path: 'server/.env.production' });
const { runHeuristicNormalization } = require('./services/heuristicService');

async function main() {
    console.log("🚀 Starting Remote Normalization...");
    await runHeuristicNormalization();
    console.log("✅ Remote Normalization Complete.");
    process.exit(0);
}

main();
