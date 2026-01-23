const { db } = require('./server/db');
const { normalizeEventNameForStorage } = require('./server/services/dedupService');

async function cleanup() {
    console.log("Starting Retroactive Event Normalization...");

    // Get all decks
    const res = await db.execute("SELECT id, event_name, format FROM decks");
    console.log(`Analyzing ${res.rows.length} records...`);

    let count = 0;
    for (const row of res.rows) {
        const normalized = normalizeEventNameForStorage(row.event_name, row.format);
        if (normalized !== row.event_name) {
            await db.execute({
                sql: "UPDATE decks SET event_name = ? WHERE id = ?",
                args: [normalized, row.id]
            });
            count++;
        }
    }

    console.log(`Normalization complete. Updated ${count} records.`);
    process.exit(0);
}

cleanup();
