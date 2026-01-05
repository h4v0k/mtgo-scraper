const cron = require('node-cron');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const cheerio = require('cheerio');
const { db } = require('../db');

// MTGTop8 Scraper
const BASE_URL = 'https://www.mtgtop8.com';
const FORMATS = [
    { code: 'ST', name: 'Standard' },
    { code: 'PI', name: 'Pioneer' },
    { code: 'MO', name: 'Modern' },
    { code: 'LE', name: 'Legacy' },
    { code: 'PAU', name: 'Pauper' }
];

// Helper to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeFormat(formatCode, formatName) {
    console.log(`\n--- Scraping Format: ${formatName} (${formatCode}) ---`);
    const formatUrl = `${BASE_URL}/format?f=${formatCode}`;

    try {
        // 1. Get Recent Events
        console.log(`Fetching Format Page: ${formatUrl}`);
        const { data: formatHtml } = await axios.get(formatUrl);
        const $ = cheerio.load(formatHtml);

        let events = [];
        // Look for "Last Events" table (often has class 'hover_tr') and links inside
        const eventsTableRows = $('tr.hover_tr');
        eventsTableRows.each((i, el) => {
            const tds = $(el).find('td');
            const fullText = $(el).text();
            const linkEl = $(el).find('a').first();
            const href = linkEl.attr('href');
            const text = linkEl.text().trim();

            const dateMatch = $(el).text().match(/(\d{2}\/\d{2}\/\d{2})/);
            let eventDateStr = new Date().toISOString();
            if (dateMatch) {
                const [day, month, year] = dateMatch[1].split('/');
                const fullYear = '20' + year;
                eventDateStr = `${fullYear}-${month}-${day}T12:00:00.000Z`; // Noon UTC
            }

            if (href && (text.includes('Challenge') || text.includes('League') || text.includes('Qualifier') || text.includes('Championship'))) {
                events.push({
                    text: text.trim(),
                    href: BASE_URL + '/' + href,
                    date: eventDateStr
                });
            }
        });

        // Filter duplicates and take top 30 (approx last 30 days)
        events = events.filter((v, i, a) => a.findIndex(t => (t.href === v.href)) === i).slice(0, 30);

        console.log(`Found ${events.length} target events for ${formatName}.`);

        for (const event of events) {
            console.log(`Processing Event: ${event.text} (${event.date})`);

            // 2. Fetch Event Page
            const { data: eventHtml } = await axios.get(event.href);
            const $e = cheerio.load(eventHtml);

            // 3. Find Deck Links (Row-based approach)
            const deckLinks = [];
            const seenUrls = new Set();
            const eventIdMatch = event.href.match(/e=(\d+)/);
            const currentEventId = eventIdMatch ? eventIdMatch[1] : null;

            const hoverTrs = $e('.hover_tr');
            hoverTrs.each((i, el) => {
                const links = $e(el).find('a');
                let deckHref = null;

                links.each((j, link) => {
                    const h = $e(link).attr('href');
                    if (h && h.includes('&d=') && !h.includes('process_deletion')) {
                        if (currentEventId) {
                            const lEvent = h.match(/e=(\d+)/);
                            if (lEvent && lEvent[1] === currentEventId) {
                                deckHref = h;
                            }
                        } else {
                            deckHref = h;
                        }
                    }
                });

                if (!deckHref) return;

                const fullHref = BASE_URL + '/event' + deckHref;
                if (seenUrls.has(fullHref)) return;
                seenUrls.add(fullHref);

                const rowText = $e(el).text().replace(/\s+/g, ' ').trim();
                let rank = 1;
                const rankMatch = rowText.match(/^(\d+)(?:-\d+)?\s+/);
                if (rankMatch) {
                    rank = parseInt(rankMatch[1], 10);
                } else if (event.text.includes('League')) {
                    rank = 1;
                }

                deckLinks.push({
                    url: fullHref,
                    rank: rank
                });
            });

            // Special Case: The Winner (Rank 1) often outside table
            $e('a').each((i, el) => {
                const href = $e(el).attr('href');
                if (href && href.includes('&d=') && !href.includes('process_deletion')) {
                    if (currentEventId) {
                        const lEvent = href.match(/e=(\d+)/);
                        if (lEvent && lEvent[1] !== currentEventId) return;
                    }

                    const fullHref = BASE_URL + '/event' + href;
                    if (!seenUrls.has(fullHref)) {
                        seenUrls.add(fullHref);
                        deckLinks.push({
                            url: fullHref,
                            rank: 1
                        });
                    }
                }
            });

            // 4. Process Decks
            for (const deckObj of deckLinks) {
                const deckUrl = deckObj.url;
                await delay(1000); // Politeness delay
                try {
                    const { data: deckHtml } = await axios.get(deckUrl);
                    const $d = cheerio.load(deckHtml);

                    const player = $d('.player_big').text().trim() || 'Unknown Player';

                    // Extract Archetype
                    let extractedArchetype = 'Unknown';
                    const headerText = $d('.w_title').first().text();

                    if (headerText && !headerText.startsWith('@')) {
                        let temp = headerText;
                        temp = temp.replace(/←/g, '').replace(/→/g, '');
                        const parts = temp.split('-');
                        if (parts.length > 1) {
                            extractedArchetype = parts[0].trim();
                        } else {
                            extractedArchetype = temp.trim();
                        }
                    } else {
                        const pageTitle = $d('title').text();
                        const titleParts = pageTitle.split('-');
                        if (titleParts.length >= 3) {
                            extractedArchetype = titleParts[titleParts.length - 1].trim();
                        }
                    }

                    // Clean Names
                    extractedArchetype = extractedArchetype.replace(event.text, '')
                        .replace('MTG Top8', '')
                        .replace(/^\s*@.*$/gm, '') // Remove lines starting with @ (Location data), handle multiline/whitespace
                        .replace(/#\d+/g, '')
                        .replace(/MTGO?\s+(League|Challenge|Preliminary|Qualifier|Showcase)( \d+)?/gi, '')
                        .replace(new RegExp(`${formatName}\\s+`, 'gi'), '') // Remove format prefix e.g. "Modern"
                        .replace(/\n/g, '')
                        .replace(/[-–—]/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (!extractedArchetype || extractedArchetype.length < 3) extractedArchetype = 'Unknown';

                    // Save Archetype
                    let archId = null;
                    if (extractedArchetype && extractedArchetype !== 'Unknown') {
                        try {
                            const result = await db.execute({
                                sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                                args: [extractedArchetype, formatName]
                            });
                            if (result.rows.length > 0) {
                                archId = result.rows[0].id; // Assuming object rows
                            } else {
                                const insertResult = await db.execute({
                                    sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                                    args: [extractedArchetype, formatName]
                                });
                                // Handle potential difference in returning: some setups return rows for RETURNING, others result properties
                                if (insertResult.rows.length > 0) {
                                    archId = insertResult.rows[0].id;
                                } else {
                                    // Fallback if RETURNING not supported or weird (shouldn't happen on modern sqlite)
                                    archId = insertResult.lastInsertRowid.toString();
                                }
                            }
                        } catch (e) {
                            // Fallback to Unknown if unique constraint or other error
                            try {
                                await db.execute({
                                    sql: 'INSERT OR IGNORE INTO archetypes (name, format) VALUES (?, ?)',
                                    args: ['Unknown', formatName]
                                });
                                const unk = await db.execute({
                                    sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                                    args: ['Unknown', formatName]
                                });
                                archId = unk.rows[0].id;
                            } catch (err2) {
                                console.error("Critical Arch Error:", err2);
                            }
                        }
                    } else {
                        try {
                            await db.execute({
                                sql: 'INSERT OR IGNORE INTO archetypes (name, format) VALUES (?, ?)',
                                args: ['Unknown', formatName]
                            });
                            const info = await db.execute({
                                sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                                args: ['Unknown', formatName]
                            });
                            archId = info.rows[0].id;
                        } catch (e) { console.error(e); }
                    }

                    // Extract Cards
                    const mainDeck = [];
                    const sideboard = [];
                    let sbMode = false;
                    $d('div').each((i, el) => {
                        const txt = $d(el).text().trim();
                        const cls = $d(el).attr('class') || '';
                        if (cls.includes('O14') && txt === 'SIDEBOARD') sbMode = true;
                        if (cls.includes('deck_line')) {
                            if (sbMode) sideboard.push(txt);
                            else mainDeck.push(txt);
                        }
                    });

                    const deckText = mainDeck.join('\n');
                    const sideboardText = sideboard.join('\n');

                    if (deckText.length < 10) continue;

                    // Check duplicate
                    const existingDeckRes = await db.execute({
                        sql: 'SELECT id FROM decks WHERE player_name = ? AND event_name = ?',
                        args: [player, event.text]
                    });
                    if (existingDeckRes.rows.length > 0) {
                        continue;
                    }

                    await db.execute({
                        sql: `
                        INSERT INTO decks (player_name, format, event_name, event_date, rank, archetype_id, raw_decklist, sideboard, source_url)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                       `,
                        args: [
                            player,
                            formatName,
                            event.text,
                            event.date,
                            deckObj.rank,
                            archId,
                            deckText,
                            sideboardText,
                            deckUrl
                        ]
                    });

                } catch (err) {
                    console.error(`Error parsing deck ${deckUrl}: ${err.message}`);
                }
            }
        }
    } catch (err) {
        console.error(`Error scraping format ${formatName}: ${err.message}`);
    }
}

async function scrapeMTGTop8() {
    console.log('Starting Scraper Job (All Formats)...');

    // Run formats in parallel
    try {
        await Promise.all(FORMATS.map(fmt => scrapeFormat(fmt.code, fmt.name)));
    } catch (err) {
        console.error("Parallel scraping error:", err);
    }

    try {
        console.log('Running Heuristic Normalization...');
        const { runHeuristicNormalization } = require('./heuristicService');
        await runHeuristicNormalization();

        console.log('Running Similarity Classification...');
        const { runSimilarityClassification } = require('./similarityService');
        await runSimilarityClassification();

        // AI Name Normalization (Batch)
        console.log('Running AI Name Normalization...');
        const { runNormalizationJob } = require('./normalizationService');
        await runNormalizationJob();

        // AI Deep Resolution for Unknowns
        console.log('Running AI Unknown Resolution...');
        const { resolveUnknownArchetypes } = require('./aiService');
        await resolveUnknownArchetypes(50);

    } catch (err) {
        console.error('Normalization pipeline failed: ' + err.message);
    }
    console.log('Scraper job finished.');
}

// Schedule: 2:00 AM and 2:00 PM
cron.schedule('0 2,14 * * *', () => {
    scrapeMTGTop8();
});

// Allow manual trigger
if (process.env.RUN_SCRAPER === 'true') {
    scrapeMTGTop8();
}

module.exports = {
    scrapeMTGTop8
};
