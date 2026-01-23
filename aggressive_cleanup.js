const { db } = require('./server/db');
const { normalizeEventNameForStorage } = require('./server/services/dedupService');

async function aggressiveCleanup() {
    console.log("Starting Aggressive Event Name Cleanup...");

    // Get ALL decks
    const res = await db.execute("SELECT id, event_name, format FROM decks");
    console.log(`Analyzing ${res.rows.length} records...`);

    let count = 0;
    for (const row of res.rows) {
        const normalized = normalizeEventNameForStorage(row.event_name, row.format);
        if (normalized !== row.event_name) {
            console.log(`  Updating: "${row.event_name}" -> "${normalized}"`);
            await db.execute({
                sql: "UPDATE decks SET event_name = ? WHERE id = ?",
                args: [normalized, row.id]
            });
            count++;
        }
    }

    console.log(`\nCleanup complete. Updated ${count} records.`);
    process.exit(0);
}

aggressiveCleanup();
