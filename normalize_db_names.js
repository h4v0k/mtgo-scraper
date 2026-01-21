const { db } = require('./server/db');

async function normalize() {
    console.log("Normalizing Event Names...");

    // 1. Challenges 32
    // Matches: "Modern Challenge 32", "Standard Challenge 32 YYYY-MM-DD", "MTGO Challenge 32"
    await db.execute({
        sql: `UPDATE decks 
              SET event_name = 'MTGO Challenge 32' 
              WHERE event_name LIKE '%Challenge 32%'`
    });
    console.log("Normalized Challenge 32");

    // 2. Challenges 64
    await db.execute({
        sql: `UPDATE decks 
              SET event_name = 'MTGO Challenge 64' 
              WHERE event_name LIKE '%Challenge 64%'`
    });
    console.log("Normalized Challenge 64");

    // 3. Leagues
    // Matches: "Standard League", "Modern League 2026...", "MTGO League"
    await db.execute({
        sql: `UPDATE decks 
              SET event_name = 'MTGO League' 
              WHERE event_name LIKE '%League%'`
    });
    console.log("Normalized Leagues");

    // 4. Preliminaries (Optional, good practice)
    await db.execute({
        sql: `UPDATE decks 
              SET event_name = 'MTGO Preliminary' 
              WHERE event_name LIKE '%Preliminary%'`
    });
    console.log("Normalized Preliminaries");

    console.log("Normalization Complete.");
}

normalize();
