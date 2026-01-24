const { db, initDB } = require('../db');

async function findDuplicates() {
    try {
        await initDB();
        console.log("Checking for duplicate Challenge 32 events...");
        const result = await db.execute({
            sql: `SELECT event_name, event_date, COUNT(*) as c, GROUP_CONCAT(source_url) as urls
                  FROM decks 
                  WHERE event_name LIKE '%Challenge 32%'
                  GROUP BY event_name, event_date, player_name, rank
                  HAVING COUNT(*) > 1`,
            args: []
        });

        if (result.rows.length === 0) {
            console.log("No exact player/rank duplicates found.");
        } else {
            console.table(result.rows);
        }

        console.log("\nChecking for duplicate event entries in challenges list...");
        const events = await db.execute({
            sql: `SELECT DISTINCT event_name, event_date, COUNT(*) as deck_count
                  FROM decks 
                  WHERE event_date >= date('now', '-2 days')
                  GROUP BY event_name, event_date`,
            args: []
        });
        console.table(events.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findDuplicates();
