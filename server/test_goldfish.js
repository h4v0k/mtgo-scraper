
const cheerio = require('cheerio');
const fs = require('fs');

async function testScrape(player) {
    console.log(`Fetching data for ${player}...`);
    try {
        const response = await fetch(`https://www.mtggoldfish.com/player/${player}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log(`Response Status: ${response.status}`);
        const html = await response.text();
        // fs.writeFileSync('server/goldfish_dump.html', html);
        const $ = cheerio.load(html);

        const decks = [];

        $('table').each((i, table) => {
            const headers = $(table).find('th').map((_i, el) => $(el).text().trim()).get();
            console.log(`Table ${i} Headers:`, headers);

            // Loose matching
            if (headers.some(h => h.includes('Date')) && headers.some(h => h.includes('Format')) && headers.some(h => h.includes('Deck'))) {
                $(table).find('tbody tr').each((_j, row) => {
                    const cols = $(row).find('td');
                    if (cols.length > 0) {
                        const date = $(cols[0]).text().trim();
                        const event = $(cols[1]).text().trim();
                        const deckName = $(cols[2]).text().trim();
                        const deckLink = $(cols[2]).find('a').attr('href');
                        const result = $(cols[3]).text().trim();

                        decks.push({
                            date,
                            event,
                            deckName,
                            deckLink: deckLink ? `https://www.mtggoldfish.com${deckLink}` : null,
                            result
                        });
                    }
                });
            }
        });

        console.log(`Found ${decks.length} decks:`);
        console.log(decks.slice(0, 5));

    } catch (e) {
        console.error(e);
    }
}

testScrape('OkoDio');
