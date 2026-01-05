const axios = require('axios');
const cheerio = require('cheerio');

async function debugRank() {
    // A recent Challenge URL from the logs or known structure
    // Example: MTGO Challenge 64
    // We need to find a valid URL. I'll fetch the format page first to get a fresh link.
    const TEST_URL = 'https://www.mtgtop8.com/format?f=MO';

    console.log('Fetching Format Page...');
    const { data: formatHtml } = await axios.get(TEST_URL);
    const $ = cheerio.load(formatHtml);

    let challengeUrl = null;
    $('a').each((i, el) => {
        const text = $(el).text();
        const href = $(el).attr('href');
        if (href && text.includes('Challenge') && !challengeUrl) {
            challengeUrl = 'https://www.mtgtop8.com/' + href;
            console.log(`Found Challenge: ${text} -> ${challengeUrl}`);
        }
    });

    if (!challengeUrl) {
        console.log('No Challenge found to debug.');
        return;
    }

    console.log(`Fetching Event Page: ${challengeUrl}`);
    const { data: eventHtml } = await axios.get(challengeUrl);
    const $e = cheerio.load(eventHtml);

    console.log('--- Inspecting Deck Links ---');
    let count = 0;
    $e('a').each((i, el) => {
        const href = $e(el).attr('href');
        if (href && href.includes('&d=') && !href.includes('process_deletion')) {
            if (count > 5) return; // Limit output

            const text = $e(el).text().trim();
            const parent = $e(el).parent();
            const grandParent = parent.parent();
            const greatGrandParent = grandParent.parent();

            console.log(`\nLINK [${i}]: "${text}"`);
            console.log(`  HREF: ${href}`);
            console.log(`  Parent Text: "${parent.text().trim().replace(/\n/g, ' ')}"`);
            console.log(`  GrandParent Text: "${grandParent.text().trim().replace(/\n/g, ' ')}"`);
            console.log(`  GreatGrandParent Text: "${greatGrandParent.text().trim().replace(/\n/g, ' ')}"`);

            // Test Regex
            const match1 = parent.text().match(/#(\d+)/);
            const match2 = grandParent.text().match(/#(\d+)/);
            console.log(`  Match Parent: ${match1 ? match1[1] : 'null'}`);
            console.log(`  Match GrandParent: ${match2 ? match2[1] : 'null'}`);

            count++;
        }
    });
}

debugRank();
