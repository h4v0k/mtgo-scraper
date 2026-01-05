const axios = require('axios');
const cheerio = require('cheerio');

const EVENT_URL = 'https://www.mtggoldfish.com/metagame/modern#paper';

async function analyze() {
    console.log('Fetching ' + EVENT_URL);
    try {
        const { data } = await axios.get(EVENT_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);

        console.log('Page Title:', $('title').text());

        // on /metagame/modern
        console.log('--- Archetypes (tiles) ---');
        // Structure: div.archetype-tile -> .deck-price-paper a
        const links = [];
        $('.archetype-tile').each((i, el) => {
            const name = $(el).find('.deck-price-paper a').text().trim();
            const href = $(el).find('.deck-price-paper a').attr('href');
            if (name && href && i < 3) {
                console.log(`Arch: ${name} -> ${href}`);
                links.push('https://www.mtggoldfish.com' + href);
            }
        });

        if (links.length > 0) {
            console.log('\n--- Deep Dive: ' + links[0] + ' ---');
            try {
                const sub = await axios.get(links[0]);
                const $sub = cheerio.load(sub.data);
                // Find specific deck links
                // usually in a table with class .archetype-recent-decks or just simple links
                let deckLink = null;
                $sub('a').each((i, el) => {
                    const h = $(el).attr('href');
                    if (h && h.includes('/deck/') && !deckLink && !h.includes('/custom/')) {
                        deckLink = 'https://www.mtggoldfish.com' + h;
                    }
                });

                if (deckLink) {
                    console.log('Found specific deck link: ' + deckLink);
                    try {
                        const dPage = await axios.get(deckLink);
                        const $d = cheerio.load(dPage.data);

                        // Try visible table first
                        const rows = $d('tr');
                        console.log(`Deck Page has ${rows.length} rows`);
                        if (rows.length > 0) {
                            console.log('--- First Row HTML ---');
                            console.log($d(rows[2]).html()); // Skip header? Try index 2
                            console.log('--- End HTML ---');
                        }
                        let foundCard = false;
                        rows.slice(0, 10).each((i, row) => {
                            const qty = $d(row).find('.deck-col-qty').text().trim();
                            const card = $d(row).find('.deck-col-card a').text().trim();
                            if (qty && card) {
                                console.log(`Deck Table Row: ${qty} ${card}`);
                                foundCard = true;
                            }
                        });

                        if (!foundCard) {
                            const raw = $d('.deck-view-input').val() || $d('textarea.copy-paste-textarea').text();
                            if (raw) console.log('Found Raw Input: ' + raw.substring(0, 20));
                        }

                    } catch (e) { console.error('Deck fetch error: ' + e.message); }
                } else {
                    console.log('No specific deck links found on archetype page.');
                }
            } catch (e) { console.error('Sub-fetch error: ' + e.message); }
        }

        // Search for specific text to find container
        const mainDeckHeader = $('*:contains("Main Deck")').last();
        if (mainDeckHeader.length) {
            console.log('Found "Main Deck" text!');
            console.log('Parent classes:', mainDeckHeader.parent().attr('class'));
            console.log('Grandparent classes:', mainDeckHeader.parent().parent().attr('class'));

            // Try to grab the whole deck container based on this
            const container = mainDeckHeader.closest('div');
            console.log('Closest div class:', container.attr('class'));
        } else {
            console.log('Could not find "Main Deck" text. Dumping all H3s:');
            $('h3').each((i, el) => console.log($(el).text().trim()));
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

analyze();
