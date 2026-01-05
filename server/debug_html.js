const axios = require('axios');
const cheerio = require('cheerio');

async function debugScrape() {
    const formatUrl = 'https://www.mtgtop8.com/format?f=MO';
    console.log('Fetching Format Page: ' + formatUrl);

    // 1. Check Format Page for Dates
    const { data: formatHtml } = await axios.get(formatUrl);
    const $ = cheerio.load(formatHtml);

    console.log('--- Format Page Rows ---');
    $('tr.hover_tr').slice(0, 3).each((i, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        const tds = $(el).find('td');
        const eventName = $(tds[0]).text().trim(); // Assuming first col
        const dateStr = $(tds[tds.length - 2]).text().trim(); // Usually date is towards end
        console.log(`Row ${i}: Full="${text}" | Link="${$(el).find('a').attr('href')}" | DateCandidate="${dateStr}"`);
    });

    // 2. Check Event Page for Ranks
    // Grab first event link
    const firstEventLink = $('tr.hover_tr').find('a').attr('href');
    if (firstEventLink) {
        const eventUrl = 'https://www.mtgtop8.com/' + firstEventLink;
        console.log('\nFetching Event Page: ' + eventUrl);
        const { data: eventHtml } = await axios.get(eventUrl);
        const $e = cheerio.load(eventHtml);

        console.log('--- Event Page Decks ---');
        // Check structure of deck links
        // Usually grouped by div.class "Topic" or similar?
        // Or just raw links.
        let count = 0;
        $e('div').each((i, el) => {
            // Look for divs that contain deck links
            const link = $e(el).find('a[href*="&d="]');
            if (link.length > 0 && count < 5) {
                const linkText = link.text().trim();
                const siblingText = $e(el).text().trim(); // Context
                // Try to find rank indicators
                console.log(`Deck Div ${count}: Text="${siblingText.substring(0, 50)}..." Link="${link.attr('href')}"`);
                count++;
            }
        });

        // Also check if they are in a table
        console.log('--- Event Page Tables ---');
        $e('td').each((i, el) => {
            const width = $e(el).attr('width');
            // Ranking columns often have specific widths like 15%?
            // Actually decks are often in a layout with stars or rank numbers
        });
    }
}

debugScrape();
