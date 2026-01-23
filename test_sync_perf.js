const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const { syncPlayerDecks } = require('./server/services/goldfish');

async function test() {
    const start = Date.now();
    const count = await syncPlayerDecks('Johnny_Hobbs', 30);
    const end = Date.now();
    console.log(`Sync took ${(end - start) / 1000}s. Imported ${count} decks.`);
}

test();
