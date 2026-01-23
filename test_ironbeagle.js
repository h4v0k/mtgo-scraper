const { syncPlayerDecks } = require('./server/services/goldfish');

async function testSync() {
    const playerName = 'IronBeagle';
    const days = 60;

    console.log(`Testing sync for ${playerName}...`);
    console.log(`Start time: ${new Date().toISOString()}`);

    try {
        const count = await syncPlayerDecks(playerName, days);
        console.log(`\nSync completed successfully!`);
        console.log(`End time: ${new Date().toISOString()}`);
        console.log(`Imported ${count} new decks.`);
    } catch (err) {
        console.error(`\nSync failed:`, err);
        console.error(err.stack);
    }

    process.exit(0);
}

testSync();
