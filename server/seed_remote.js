const path = require('path');
const dotenv = require('dotenv');

// Load production secrets explicitly
const prodEnvPath = path.resolve(__dirname, '.env.production');
const result = dotenv.config({ path: prodEnvPath });

if (result.error) {
    console.error("\n❌ Error: Could not find '.env.production' file.");
    console.error("Please create a file named '.env.production' in the server/ directory with your Turso credentials:");
    console.error("\nTURSO_DATABASE_URL=libsql://...");
    console.error("TURSO_AUTH_TOKEN=...\n");
    process.exit(1);
}

console.log("✅ Loaded secrets from .env.production");
console.log(`Target DB: ${process.env.TURSO_DATABASE_URL}`);

// Import and run the scraper
const scraper = require('./services/scraper');
const { initDB } = require('./db');

(async () => {
    try {
        console.log("🚀 Initializing Database Schema...");
        await initDB();

        console.log("🚀 Starting Remote Seed Job...");
        await scraper.scrapeMTGTop8();
        console.log("✅ Seed Complete!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seed Failed:", err);
        process.exit(1);
    }
})();
