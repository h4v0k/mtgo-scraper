const { db } = require('../db');

async function debugChallengeGrouping() {
    try {
        console.log("Debugging 1/22 Challenge Data...");
        const result = await db.execute({
            sql: `SELECT id, event_name, event_date, rank 
                  FROM decks 
                  WHERE event_date LIKE '2026-01-22%' 
                  AND event_name LIKE '%Standard Challenge%'
                  ORDER BY event_date, rank`,
            args: []
        });

        console.log(result.rows);
    } catch (err) {
        console.error(err);
    }
}

debugChallengeGrouping();
