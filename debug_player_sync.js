const { fetchPlayerHistory, syncPlayerDecks } = require('./server/services/goldfish');
const { db } = require('./server/db');

async function test() {
    const player = 'Johnny_Hobbs';
    console.log(`--- Testing fetchPlayerHistory for ${player} ---`);
    const hist = await fetchPlayerHistory(player, 60);
    console.log(`Found ${hist.length} decks in history.`);
    hist.forEach((d, i) => {
        console.log(`${i + 1}: ${d.event_name} | ${d.event_date} | ${d.url}`);
    });

    console.log(`\n--- Testing syncPlayerDecks for ${player} ---`);
    // Clear decks first to ensure we aren't skipped by initial existence
    await db.execute({ sql: 'DELETE FROM decks WHERE player_name = ?', args: [player] });
    console.log(`Cleared decks for ${player}`);

    const count = await syncPlayerDecks(player, 60);
    console.log(`Imported ${count} decks.`);

    const check = await db.execute({
        sql: 'SELECT event_name, event_date FROM decks WHERE player_name = ?',
        args: [player]
    });
    console.log('Stored in DB:');
    check.rows.forEach(r => console.log(`- ${r.event_name} (${r.event_date})`));

    process.exit(0);
}

test();
