const axios = require('axios');
const cheerio = require('cheerio');

async function debugDeckPage() {
    // Example Deck URL (from previous logs or known valid)
    // Using one captured in previous steps if possible, or fetch via event
    const TEST_URL = 'https://www.mtgtop8.com/format?f=MO';

    console.log('Fetching Format Page to find a deck...');
    const { data: formatHtml } = await axios.get(TEST_URL);
    const $ = cheerio.load(formatHtml);

    let eventUrl = null;
    $('a').each((i, el) => {
        if ($(el).text().includes('Challenge') && !eventUrl) {
            eventUrl = 'https://www.mtgtop8.com/' + $(el).attr('href');
        }
    });

    if (!eventUrl) return console.log('No event found');

    const { data: eventHtml } = await axios.get(eventUrl);
    const $e = cheerio.load(eventHtml);

    // Find a deck link
    let deckUrl = null;
    $e('a').each((i, el) => {
        const h = $e(el).attr('href');
        if (h && h.includes('&d=') && !deckUrl) {
            deckUrl = 'https://www.mtgtop8.com/event' + h;
        }
    });

    if (!deckUrl) return console.log('No deck found');

    console.log(`Inspecting Deck Page: ${deckUrl}`);
    const { data: deckHtml } = await axios.get(deckUrl);
    const $d = cheerio.load(deckHtml);

    // 1. Inspect Sideboard
    // Usually sideboards are in a column or separated by "SIDEBOARD" text
    // MTGTop8 often puts main deck in one `.G14` or `.deck_line` and SB in another?
    // Or uses `class="O14"` with "SIDEBOARD" header?

    console.log('--- Headers ---');
    $d('.w_title').each((i, el) => console.log(`Title ${i}: ${$d(el).text().trim()}`));

    console.log('--- Text Content Search ---');
    // Look for "Sideboard" text
    const textNodes = $d('*').contents().filter(function () {
        return this.nodeType === 3 && $d(this).text().toLowerCase().includes('sideboard');
    });

    textNodes.each((i, el) => {
        console.log(`Found "Sideboard" in: ${$d(el).parent().prop('tagName')} class="${$d(el).parent().attr('class')}"`);
        // Print siblings/children
        console.log(`Parent HTML (truncated): ${$d(el).parent().html().substring(0, 100)}`);
    });

    // Attempt to extract cards
    const allCards = [];
    $d('.deck_line').each((i, el) => {
        allCards.push($d(el).text().trim());
    });
    console.log(`Found ${allCards.length} .deck_line elements (Cards). First 5:`, allCards.slice(0, 5));

    // Check if there is a visual separator for Sideboard
}

debugDeckPage();
