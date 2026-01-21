const { db } = require('./server/db');

async function migrate() {
    console.log("Migrating Database...");
    try {
        await db.execute("ALTER TABLE decks ADD COLUMN spice_count INTEGER DEFAULT 0");
        console.log("Migration Successful: Added spice_count column.");
    } catch (e) {
        console.log("Migration Note: " + e.message);
    }
}

migrate();
