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

async function scrapeFormat(formatCode, formatName, maxDays) {
    console.log(`\n--- Scraping Format: ${formatName} (${formatCode}) ---`);
    const formatUrl = `${BASE_URL}/format?f=${formatCode}`;

    try {
        // 1. Determine Meta ID (Timeframe)
        let metaId = '54'; // Default "Last 2 Weeks"
        let foundMeta = false;

        try {
            console.log(`Fetching Format Page: ${formatUrl}`);
            const { data: initialHtml } = await axios.get(formatUrl);
            const $init = cheerio.load(initialHtml);

            // Check dropdown for "Last 2 Months"
            // MTGTop8 sometimes uses a standard select, sometimes a custom div structure.
            // standard: <select name="meta"><option value="51">Last 2 Months</option>...</select>
            $init('select[name="meta"] option').each((i, el) => {
                const optText = $init(el).text().trim();
                // Check for exact text or case-insensitive match
                if (optText === 'Last 2 Months' || optText.toLowerCase() === 'last 2 months') {
                    metaId = $init(el).attr('value');
                    foundMeta = true;
                }
            });

            if (!foundMeta) {
                // Fallback: Check for custom dropdown links if CHEERIO sees them (unlikely if JS-generated, but checking <a> tags with meta=)
                // Or just hardcode the known "Last 2 Months" ID for Modern/Pioneer if we can't find it.
                // Known IDs: Modern=51, but they change.
                // Let's try to find *any* link saying "Last 2 Months"
                $init('a').each((i, el) => {
                    if ($init(el).text().trim().toLowerCase() === 'last 2 months') {
                        const href = $init(el).attr('href');
                        const match = href ? href.match(/meta=(\d+)/) : null;
                        if (match) {
                            metaId = match[1];
                            foundMeta = true;
                        }
                    }
                });
            }

            if (foundMeta) {
                console.log(`Found 'Last 2 Months' Meta ID: ${metaId}`);
            } else {
                console.warn("Could not auto-detect 'Last 2 Months' option.");
                // FORCE IT for Modern/Pioneer if we are desperate? 
                // Getting 30 days is critical. 
                // Modern "Last 2 Months" is often 51. 
                // Let's try using '51' if format is Modern (MO) and we failed detection.
                if (formatCode === 'MO') {
                    console.log("Applying Fallback Meta ID '51' for Modern.");
                    metaId = '51';
                }
            }

        } catch (e) {
            console.warn(`Error fetching format page: ${e.message}`);
        }

        // 2. Pagination Loop to find Events
        let events = [];
        let pageNum = 1;
        let reachedCutoff = false;
        const MAX_PAGES = 10;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxDays);
        console.log(`Cutoff Date: ${cutoffDate.toISOString()}`);

        while (!reachedCutoff && pageNum <= MAX_PAGES) {
            // Delay between pages
            if (pageNum > 1) await delay(1500);

            // Construct URL
            // If page 1 and we didn't find specific meta, standard URL is fine/safer
            // But if we want 30 days, we MUST use the found meta if possible.
            let pagedUrl = `${BASE_URL}/format?f=${formatCode}&meta=${metaId}&cp=${pageNum}`;
            if (pageNum === 1 && !foundMeta) {
                // Stick to base for safety if detection failed
                pagedUrl = formatUrl;
            }

            console.log(`Scraping Page ${pageNum}: ${pagedUrl}`);

            try {
                const { data: pageHtml } = await axios.get(pagedUrl);
                const $ = cheerio.load(pageHtml);

                const rows = $('tr.hover_tr');
                if (rows.length === 0) {
                    console.log("No event rows found. Stopping.");
                    break;
                }

                let addedOnThisPage = 0;

                rows.each((i, el) => {
                    const linkEl = $(el).find('a').first();
                    const href = linkEl.attr('href');
                    const text = linkEl.text().trim();
                    const fullText = $(el).text();

                    // Date Parse: 20/12/24
                    const dateMatch = fullText.match(/(\d{2}\/\d{2}\/\d{2})/);
                    let eventDateObj = new Date();
                    let eventDateStr = eventDateObj.toISOString();

                    if (dateMatch) {
                        const [day, month, year] = dateMatch[1].split('/');
                        const fullYear = '20' + year;
                        eventDateObj = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
                        eventDateStr = `${fullYear}-${month}-${day}T12:00:00.000Z`;
                    }

                    if (eventDateObj < cutoffDate) {
                        reachedCutoff = true;
                        // Don't return false to break cheerio loop, just ignore
                        return;
                    }

                    if (href && (
                        text.includes('Challenge') ||
                        text.includes('League') ||
                        text.includes('Qualifier') ||
                        text.includes('Championship') ||
                        text.includes('Showcase') ||
                        text.includes('Spotlight') ||
                        text.includes('SCG') ||
                        text.includes('RCQ') ||
                        text.includes('Open')
                    )) {
                        events.push({
                            text: text.trim(),
                            href: BASE_URL + '/' + href,
                            date: eventDateStr
                        });
                        addedOnThisPage++;
                    }
                });

                if (addedOnThisPage === 0 && reachedCutoff) {
                    break;
                }

            } catch (pageErr) {
                console.error(`Error on page ${pageNum}: ${pageErr.message}`);
                break;
            }

            pageNum++;
        }

        // Filter duplicates
        events = events.filter((v, i, a) => a.findIndex(t => (t.href === v.href)) === i);
        console.log(`Found ${events.length} target events for ${formatName} within ${maxDays} days.`);

        // 3. Process Events (Detailed Scraping)
        for (const event of events) {
            console.log(`Processing Event: ${event.text} (${event.date})`);
            await delay(1000);
            await processEvent(event, formatName);
        }

    } catch (err) {
        console.error(`Error scraping format ${formatName}: ${err.message}`);
    }
}

async function processEvent(event, formatName) {
    try {
        const { data: eventHtml } = await axios.get(event.href);
        const $e = cheerio.load(eventHtml);

        // Parse Decks (Winners + Top 8)
        const deckLinks = [];
        const seenUrls = new Set();
        const eventIdMatch = event.href.match(/e=(\d+)/);
        const currentEventId = eventIdMatch ? eventIdMatch[1] : null;

        // Table Rows
        $e('.hover_tr').each((i, el) => {
            const links = $e(el).find('a');
            let deckHref = null;
            links.each((j, link) => {
                const h = $e(link).attr('href');
                if (h && h.includes('&d=') && !h.includes('process_deletion')) {
                    // Check event ID match
                    if (currentEventId) {
                        const lEvent = h.match(/e=(\d+)/);
                        if (lEvent && lEvent[1] === currentEventId) deckHref = h;
                    } else {
                        deckHref = h;
                    }
                }
            });

            if (!deckHref) return;
            const fullHref = BASE_URL + '/event' + deckHref;
            if (seenUrls.has(fullHref)) return;
            seenUrls.add(fullHref);

            const rowText = $e(el).text().trim();
            let rank = 1;
            // Try to parse rank "5-8" or "1"
            const rankMatch = rowText.match(/^(\d+)/);
            if (rankMatch) rank = parseInt(rankMatch[1], 10);
            if (event.text.includes('League')) rank = 1;

            deckLinks.push({ url: fullHref, rank });
        });

        // Top Winner sometimes separate
        $e('a').each((i, el) => {
            const h = $e(el).attr('href');
            if (h && h.includes('&d=') && !h.includes('process_deletion')) {
                if (currentEventId) {
                    const lEvent = h.match(/e=(\d+)/);
                    if (lEvent && lEvent[1] !== currentEventId) return;
                }
                const fullHref = BASE_URL + '/event' + h;
                if (!seenUrls.has(fullHref)) {
                    seenUrls.add(fullHref);
                    deckLinks.push({ url: fullHref, rank: 1 });
                }
            }
        });

        // 4. Process Each Deck
        for (const deckObj of deckLinks) {
            const deckUrl = deckObj.url;
            try {
                // Minimal delay inside event
                await delay(500);
                const { data: deckHtml } = await axios.get(deckUrl);
                const $d = cheerio.load(deckHtml);

                const player = $d('.player_big').text().trim() || 'Unknown Player';

                // Archetype Extraction
                let extractedArchetype = 'Unknown';
                const headerText = $d('.w_title').first().text();
                if (headerText && !headerText.startsWith('@')) {
                    let temp = headerText.replace(/←|→/g, '').trim();
                    const parts = temp.split('-');
                    extractedArchetype = parts.length > 1 ? parts[0].trim() : temp;
                } else {
                    const t = $d('title').text();
                    const tp = t.split('-');
                    if (tp.length >= 3) extractedArchetype = tp[tp.length - 1].trim();
                }

                // Clean Arch Name
                extractedArchetype = extractedArchetype
                    .replace(event.text, '')
                    .replace(/MTGO?\s+(League|Challenge|Preliminary|Qualifier|Showcase)( \d+)?/gi, '')
                    .replace(new RegExp(`${formatName}\\s+`, 'gi'), '')
                    .replace(/#\d+/, '')
                    .replace(/\s*@\s*.*$/, '')
                    .trim();

                if (extractedArchetype.length < 3) extractedArchetype = 'Unknown';

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

                // FILTER: Check bad archetype names
                if (extractedArchetype.startsWith('@') || extractedArchetype.includes(' @ ')) {
                    console.log(`Renaming metadata-like archetype to Unknown: ${extractedArchetype}`);
                    extractedArchetype = 'Unknown';
                }
                if (extractedArchetype.includes('Destination Qualifier') || extractedArchetype === 'RCQ') {
                    console.log(`Renaming event-like archetype to Unknown: ${extractedArchetype}`);
                    extractedArchetype = 'Unknown';
                }
                if (extractedArchetype.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)) {
                    extractedArchetype = 'Unknown';
                }

                // Resolve/Insert Archetype
                let archId = null;
                try {
                    // Find existing
                    const existing = await db.execute({
                        sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                        args: [extractedArchetype, formatName]
                    });
                    if (existing.rows.length > 0) {
                        archId = existing.rows[0].id;
                    } else {
                        // Create
                        const ins = await db.execute({
                            sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                            args: [extractedArchetype, formatName]
                        });
                        if (ins.rows.length > 0) archId = ins.rows[0].id;
                        else archId = ins.lastInsertRowid.toString();
                    }
                } catch (e) {
                    // Fallback unknown
                    try {
                        await db.execute({ sql: 'INSERT OR IGNORE INTO archetypes (name, format) VALUES (?, ?)', args: ['Unknown', formatName] });
                        const unk = await db.execute({ sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?', args: ['Unknown', formatName] });
                        archId = unk.rows[0].id;
                    } catch (e2) { }
                }

                // Check Deck Duplicate
                const dupCheck = await db.execute({
                    sql: 'SELECT id FROM decks WHERE player_name = ? AND event_name = ?',
                    args: [player, event.text]
                });
                if (dupCheck.rows.length > 0) continue;

                // Insert Deck
                await db.execute({
                    sql: `INSERT INTO decks (player_name, format, event_name, event_date, rank, archetype_id, raw_decklist, sideboard, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [player, formatName, event.text, event.date, deckObj.rank, archId, deckText, sideboardText, deckUrl]
                });

            } catch (deckErr) {
                console.error(`Error parsing deck ${deckUrl}:`, deckErr.message);
            }
        }

    } catch (evErr) {
        console.error(`Error parsing event ${event.href}: ${evErr.message}`);
    }
}

async function scrapeMTGTop8(maxDays = 2) {
    console.log(`Starting Scraper Job (History: ${maxDays} days)...`);

    // Run formats in parallel
    try {
        await Promise.all(FORMATS.map(fmt => scrapeFormat(fmt.code, fmt.name, maxDays)));
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

module.exports = { scrapeMTGTop8, processEvent };
