require('dotenv').config({ path: 'server/.env' });
const { db } = require('./server/db');

async function migrate() {
    console.log("=== Starting Event Name Migration ===");

    const formats = ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Pauper', 'Vintage', 'Premodern'];
    const eventTypes = ['League', 'Challenge 32', 'Challenge 64', 'Showcase Challenge', 'Showcase Qualifier', 'Preliminary', 'RC Qualifier', 'RC Super Qualifier'];

    for (const format of formats) {
        for (const type of eventTypes) {
            const oldName = `MTGO ${type}`;
            const newName = `${format} ${type}`;

            console.log(`Migrating: "${oldName}" -> "${newName}" for format ${format}...`);

            try {
                const res = await db.execute({
                    sql: "UPDATE decks SET event_name = ? WHERE event_name = ? AND format = ?",
                    args: [newName, oldName, format]
                });
                if (res.rowsAffected > 0) {
                    console.log(`  Updated ${res.rowsAffected} records.`);
                }
            } catch (e) {
                console.error(`  Error updating ${oldName}:`, e.message);
            }
        }
    }

    // Catch-all for any missed "MTGO League" without specific type match if needed
    console.log("Running catch-all for 'MTGO League' variants...");
    try {
        const res = await db.execute("UPDATE decks SET event_name = format || ' League' WHERE event_name = 'MTGO League'");
        console.log(`  Updated ${res.rowsAffected} catch-all records.`);
    } catch (e) {
        console.error("  Catch-all error:", e.message);
    }

    console.log("=== Migration Complete ===");
}

migrate();
