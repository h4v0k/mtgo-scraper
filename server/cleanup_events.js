const { db, initDB } = require('./db');
const { normalizeEventNameForStorage } = require('./services/dedupService');

async function cleanup() {
    await initDB();
    console.log("Starting Event Name Cleanup...");

    const CHUNK_SIZE = 1000;
    let offset = 0;
    let updatedCount = 0;

    while (true) {
        const res = await db.execute({
            sql: `SELECT id, event_name, format FROM decks LIMIT ? OFFSET ?`,
            args: [CHUNK_SIZE, offset]
        });

        if (res.rows.length === 0) break;

        for (const deck of res.rows) {
            const newName = normalizeEventNameForStorage(deck.event_name, deck.format);
            if (newName !== deck.event_name) {
                // console.log(`[UPDATE] "${deck.event_name}" -> "${newName}"`);
                await db.execute({
                    sql: `UPDATE decks SET event_name = ? WHERE id = ?`,
                    args: [newName, deck.id]
                });
                updatedCount++;
            }
        }

        console.log(`Processed ${offset + res.rows.length} decks...`);
        offset += CHUNK_SIZE;
    }

    console.log(`Cleanup Complete. Updated ${updatedCount} decks.`);
    process.exit(0);
}

cleanup();
