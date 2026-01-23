const { db } = require('./server/db');

async function check() {
    console.log("Checking decks for TheMeatMan...");
    const result = await db.execute({
        sql: `SELECT id, event_date, event_name, rank, archetype_id, source_url FROM decks WHERE player_name = 'TheMeatMan' ORDER BY event_date DESC`,
        args: []
    });

    console.log(`Found ${result.rows.length} decks.`);
    console.table(result.rows);
}

check();
