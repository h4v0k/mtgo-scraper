const { syncPlayerDecks } = require('./server/services/goldfish');

async function testSync() {
    const playerName = 'Grogore';
    const days = 60;

    console.log(`Testing sync for ${playerName}...`);

    try {
        const count = await syncPlayerDecks(playerName, days);
        console.log(`\nSync completed successfully!`);
        console.log(`Imported ${count} new decks.`);
    } catch (err) {
        console.error(`\nSync failed:`, err);
        console.error(err.stack);
    }

    process.exit(0);
}

testSync();
