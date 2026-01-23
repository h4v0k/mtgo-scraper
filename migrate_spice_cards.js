const { db } = require('./server/db');

async function migrate() {
    console.log("Migrating Database: Adding spice_cards column...");
    try {
        await db.execute("ALTER TABLE decks ADD COLUMN spice_cards TEXT");
        console.log("Migration successful.");
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log("Column already exists.");
        } else {
            console.error("Migration failed:", e);
        }
    }
}

migrate();
