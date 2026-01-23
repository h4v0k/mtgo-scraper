const { syncPlayerDecks } = require('./server/services/goldfish');

async function testSync() {
    const playerName = 'SaculSueahtam';
    const days = 60;

    console.log(`Testing sync for ${playerName}...`);

    try {
        const count = await syncPlayerDecks(playerName, days);
        console.log(`\nSync completed successfully!`);
        console.log(`Imported ${count} new decks.`);
    } catch (err) {
        console.error(`\nSync failed:`, err);
    }

    process.exit(0);
}

testSync();
