const { db } = require('./server/db');

async function compare() {
    const r1 = await db.execute({ sql: 'SELECT raw_decklist FROM decks WHERE id = 889', args: [] });
    const r2 = await db.execute({ sql: 'SELECT raw_decklist FROM decks WHERE id = 2465', args: [] });

    const d1 = r1.rows[0].raw_decklist;
    const d2 = r2.rows[0].raw_decklist;

    console.log(`D1 Length: ${d1.length}`);
    console.log(`D2 Length: ${d2.length}`);

    if (d1 === d2) {
        console.log("Decklists are EXACTLY identical.");
    } else {
        console.log("Decklists DIFFER.");
        // Find diff
        for (let i = 0; i < d1.length; i++) {
            if (d1[i] !== d2[i]) {
                console.log(`Difference at index ${i}: '${d1.charCodeAt(i)}' vs '${d2.charCodeAt(i)}'`);
                break;
            }
        }
    }
}

compare();
