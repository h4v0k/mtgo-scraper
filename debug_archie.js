const { db } = require('./server/db');

async function debugArchie() {
    console.log("Checking decks for ArchieCoder...");
    const result = await db.execute({
        sql: `SELECT id, event_date, event_name, format, raw_decklist FROM decks WHERE player_name = 'ArchieCoder' ORDER BY event_date DESC`,
        args: []
    });

    console.table(result.rows.map(r => ({
        id: r.id,
        date: r.event_date,
        event: r.event_name,
        format: r.format,
        deck_len: r.raw_decklist.length
    })));
}

debugArchie();
