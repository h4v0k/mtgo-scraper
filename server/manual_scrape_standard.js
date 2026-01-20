const { scrapeMTGTop8 } = require('./services/scraper');
const { db } = require('./db');

// Mock strict format scraping: override the module's FORMATS just for this run?
// Actually scrapeMTGTop8 runs all formats in the list.
// But I can copy-paste the logic or just run it. 
// running scrapeMTGTop8(7) will scrape all formats. That might be slow but acceptable.
// To be faster, I'll modify the FORMATS list locally or just construct a targeted call.

// Let's just use the internal function scrapeFormat if I could export it.
// Since I can't easily export internal functions without modifying the file again, 
// I will just require the file, but I can't access internal scrapeFormat.
// So I will just run scrapeMTGTop8 but I'll patch the FORMATS array if I can, 
// or I'll just accept it runs for all 5 formats. It's safe.

async function run() {
    console.log("Running manual scrape to test SCG pickup...");
    try {
        // We only care about Standard for this check really, but running all is fine.
        // It accepts maxDays.
        await scrapeMTGTop8(14);
    } catch (e) {
        console.error(e);
    }
}

run();
