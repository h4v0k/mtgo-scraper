const path = require('path');
const dotenv = require('dotenv');

// Load production secrets explicitly (Local Mode)
const prodEnvPath = path.resolve(__dirname, '.env.production');
const result = dotenv.config({ path: prodEnvPath });

// Check if we have what we need (either from file OR environment)
if (!process.env.TURSO_DATABASE_URL) {
    console.error("\n❌ Error: TURSO_DATABASE_URL is missing.");
    console.error("  - Local: Ensure server/.env.production exists.");
    console.error("  - GitHub: Ensure Secrets are set.");
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

        // Check for days argument
        const args = process.argv.slice(2);
        const daysArg = args.find(a => a.startsWith('--days='));
        const days = daysArg ? parseInt(daysArg.split('=')[1]) : 14; // Default to 14 days

        await scraper.scrapeMTGTop8(days);
        console.log("✅ Seed Complete!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seed Failed:", err);
        process.exit(1);
    }
})();
