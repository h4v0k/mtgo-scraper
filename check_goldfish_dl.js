const axios = require('axios');
const cheerio = require('cheerio');

async function checkDownload() {
    // Sample deck from logs
    const url = 'https://www.mtggoldfish.com/deck/7585665';
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);

        let downloadHref = '';
        $('a').each((i, el) => {
            const h = $(el).attr('href');
            if (h && h.includes('/deck/download/')) {
                downloadHref = h;
            }
        });

        if (downloadHref) {
            console.log(`Found Download Link: ${downloadHref}`);
            // Try fetching it to see format
            const dlUrl = 'https://www.mtggoldfish.com' + downloadHref;
            const { data: txt } = await axios.get(dlUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            console.log("\n--- DECK TEXT PREVIEW ---\n");
            console.log(txt.substring(0, 200));
        } else {
            console.log("No download link found.");
        }

    } catch (e) {
        console.error(e);
    }
}

checkDownload();
