const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const { fetchPlayerHistory } = require('./server/services/goldfish');

async function test() {
    const results = await fetchPlayerHistory('Johnny_Hobbs', 7);
    console.log(JSON.stringify(results, null, 2));
}

test();
