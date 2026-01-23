const axios = require('axios');
const cheerio = require('cheerio');

async function debugGoldfish() {
    const url = 'https://www.mtggoldfish.com/tournaments/standard';
    console.log(`Fetching ${url}...`);
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });
        const $ = cheerio.load(data);

        console.log("Tournaments found:");
        $('.tournament-container tr').each((i, el) => {
            const date = $(el).find('td').eq(0).text().trim();
            const link = $(el).find('td').eq(1).find('a');
            const name = link.text().trim();
            const href = link.attr('href');

            if (name) {
                console.log(`[${i}] ${date} | ${name} | ${href}`);
            }
        });

    } catch (e) {
        console.error(e);
    }
}

debugGoldfish();
