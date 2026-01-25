require('dotenv').config();
const goldfish = require('./server/services/goldfish');

async function testPlayerSync() {
    const player = 'albert62';
    console.log(`Testing sync for player: ${player}`);
    try {
        const history = await goldfish.fetchPlayerHistory(player, 30);
        console.log(`Found ${history.length} decks in history.`);
        if (history.length > 0) {
            console.log('First deck sample:', JSON.stringify(history[0], null, 2));

            // Try syncing one
            const count = await goldfish.syncPlayerDecks(player, 7);
            console.log(`Sync count: ${count}`);
        }
    } catch (err) {
        console.error('Test failed:', err);
    }
}

testPlayerSync();
