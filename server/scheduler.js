const { runRemoteNormalization } = require('./remote_normalize');
const { scrapeGoldfishEvents } = require('./services/goldfishScraper');

// Interval: 6 Hours (in milliseconds)
const INTERVAL_MS = 6 * 60 * 60 * 1000;

async function startScheduler() {
    console.log(`[Scheduler] Starting... Normalization job scheduled every 6 hours.`);

    // Run immediately on startup
    console.log('[Scheduler] Triggering initial run...');
    await safeRun();

    // Schedule periodic runs
    setInterval(async () => {
        console.log('[Scheduler] Triggering scheduled run...');
        await safeRun();
    }, INTERVAL_MS);
}

async function safeRun() {
    try {
        const startTime = Date.now();
        console.log('[Scheduler] Running Goldfish Scrape...');
        await scrapeGoldfishEvents(3);
        console.log('[Scheduler] Running Normalization...');
        await runRemoteNormalization();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Scheduler] Job finished in ${duration}s.`);
    } catch (err) {
        console.error('[Scheduler] Job failed:', err);
    }
}

// Handle shutdown
process.on('SIGINT', () => {
    console.log('[Scheduler] Stopping...');
    process.exit(0);
});

startScheduler();
