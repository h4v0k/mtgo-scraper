const { db } = require('../db');

async function checkChallengeNames() {
    try {
        console.log("Checking Challenge Event Names...");
        const result = await db.execute({
            sql: `SELECT DISTINCT event_name, event_date 
                  FROM decks 
                  WHERE event_name LIKE '%Challenge%' 
                  ORDER BY event_date DESC 
                  LIMIT 20`,
            args: []
        });

        console.log(result.rows);
    } catch (err) {
        console.error(err);
    }
}

checkChallengeNames();
