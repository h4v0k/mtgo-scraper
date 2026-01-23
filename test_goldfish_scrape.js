const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const { scrapeGoldfishEvents } = require('./server/services/goldfishScraper');

async function test() {
    // Run for Standard only first, via modifying the service momentarily OR just trusting the loop
    // Default loop does all formats. Max days 3.
    await scrapeGoldfishEvents(3);
}

test();
