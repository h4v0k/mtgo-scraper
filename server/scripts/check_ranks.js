const { db } = require('../db');

async function checkRanks() {
    try {
        const result = await db.execute({
            sql: `SELECT event_name, event_date, rank, player_name
                  FROM decks 
                  WHERE event_date LIKE '2026-01-22%' 
                  AND event_name LIKE '%Standard Challenge%'
                  AND rank <= 8
                  ORDER BY event_name, event_date, rank`,
            args: []
        });

        console.log(JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error(err);
    }
}

checkRanks();
