const { db } = require('./server/db');

async function findSpice() {
    try {
        const res = await db.execute("SELECT player_name, count(*) as c FROM decks WHERE spice_count > 0 GROUP BY player_name ORDER BY c DESC LIMIT 5");
        console.log("Spicy Players:", res.rows);
    } catch (e) {
        console.error(e);
    }
}

findSpice();
