const httpClient = require('./httpClient');
const cheerio = require('cheerio');
const { db } = require('../db');
const { isEventExists } = require('./dedupService');

const BASE_URL = 'https://www.mtggoldfish.com';

const FORMATS = [
    { code: 'standard', name: 'Standard' },
    { code: 'pioneer', name: 'Pioneer' },
    { code: 'modern', name: 'Modern' },
    { code: 'legacy', name: 'Legacy' },
    { code: 'pauper', name: 'Pauper' },
    { code: 'vintage', name: 'Vintage' },
    { code: 'premodern', name: 'Premodern' }
];

// Helper to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeGoldfishEvents(maxDays = 2, forceUpdate = false) {
    console.log(`\n=== Starting Goldfish Scraper (Last ${maxDays} days) ===`);

    for (const fmt of FORMATS) {
        await scrapeFormat(fmt.code, fmt.name, maxDays, forceUpdate);
    }

    console.log("=== Goldfish Scraper Complete ===");
}

async function scrapeFormat(formatCode, formatName, maxDays, forceUpdate = false) {
    console.log(`Checking ${formatName}...`);
    const listUrl = `${BASE_URL}/tournaments/${formatCode}`;

    try {
        const { data } = await httpClient.get(listUrl);
        const $ = cheerio.load(data);

        // Find events: H4 > A
        // Then parse date from the <nobr> inside the H4 or next to it
        // Structure: <h4><a href="...">Name</a> <nobr>on YYYY-MM-DD</nobr></h4>

        const events = [];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxDays);

        $('.similar-events-container h4').each((i, el) => {
            const link = $(el).find('a').first();
            const dateText = $(el).find('nobr').text().replace('on ', '').trim(); // "2026-01-22"

            if (!link.length || !dateText) return;

            let name = link.text().trim();
            const href = link.attr('href');

            // Date check
            const evDate = new Date(dateText);
            if (evDate < cutoffDate) return; // Too old

            // Filter: Only Challenge/League/Showcase/Qualifier
            if (!name.match(/(Challenge|League|Showcase|Qualifier|Championship|Open)/i)) return;

            // Strip date from name (e.g. "Standard Challenge 32 2026-01-22" -> "Standard Challenge 32")
            name = name.replace(/\s\d{4}-\d{2}-\d{2}$/, '').trim();

            const { normalizeEventNameForStorage } = require('./dedupService');
            name = normalizeEventNameForStorage(name, formatName);

            events.push({
                name,
                url: BASE_URL + href,
                date: dateText,
                format: formatName
            });
        });

        console.log(`Found ${events.length} potential events for ${formatName}.`);

        // Process Events
        for (const ev of events) {
            // DEDUP CHECK
            const exists = await isEventExists(ev.format, ev.date, ev.name);
            if (exists && !forceUpdate) {
                console.log(`[SKIP] Exists: ${ev.name} (${ev.date})`);
                continue;
            }

            if (forceUpdate && exists) {
                console.log(`[UPDATE] Backfilling: ${ev.name} (${ev.date})`);
            } else {
                console.log(`[PROCESS] New Event: ${ev.name} (${ev.date})`);
            }
            await processEvent(ev);
            await delay(2000); // Be polite
        }

    } catch (e) {
        console.error(`Error scraping ${formatName} list:`, e.message);
    }
}

async function processEvent(ev) {
    try {
        const { data } = await httpClient.get(ev.url);
        const $ = cheerio.load(data);

        // Parse rows
        // Structure is usually table.table-striped
        // Cols: Pl | Deck | Player | Price

        const decks = [];
        $('table tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length === 0) return; // header

            // Rank: "1st" or "5-8" or "5-0"
            let rankText = $(tds[0]).text().trim();
            const isLeague = ev.name.toLowerCase().includes('league');

            let rank = 1;
            const rm = rankText.match(/(\d+)/);
            if (rm) rank = parseInt(rm[1]);

            // League Logic: Only 5-0s, store as rank 0
            if (isLeague) {
                if (rankText !== '5-0' && rank !== 1) {
                    // Skip non-5-0 results in Leagues
                    return;
                }
                rank = 0; // Sentinel for 5-0
            }
            // Deck Link
            const deckLink = $(tds[1]).find('a').attr('href');
            // Player
            let player = $(tds[2]).text().trim();
            if (!player) {
                // Fallback for missing player name to avoid Dedup collision
                // Extract deck ID from link
                const idMatch = deckLink ? deckLink.match(/\/(\d+)(#|$)|\/(\d+)$/) : null;
                const deckId = idMatch ? (idMatch[1] || idMatch[3]) : 'Unknown';
                player = `Unknown Player ${deckId}`;
            }

            if (deckLink && deckLink.match(/^\/deck\/\d+/)) {
                decks.push({
                    url: BASE_URL + deckLink,
                    rank,
                    player
                });
            }
        });

        console.log(`  Found ${decks.length} decks.`);

        for (const deck of decks) {
            await processDeck(deck, ev);
            await delay(1000); // Verify rate limit compliance
        }

    } catch (e) {
        console.error(`  Error processing event ${ev.name}:`, e.message);
    }
}

async function processDeck(deck, ev) {
    try {
        // 1. Get Deck Page to find Download Link
        const { data: pageHtml } = await httpClient.get(deck.url);
        const $ = cheerio.load(pageHtml);

        // Find XML download
        let downloadUrl = null;
        $('a').each((i, el) => {
            const h = $(el).attr('href');
            if (h && h.includes('/deck/download/') && h.includes('output=dek')) {
                downloadUrl = BASE_URL + h;
            }
        });

        // Fallback to text download?
        // if (!downloadUrl) ...

        if (!downloadUrl) {
            console.warn(`  No download link for ${deck.url}`);
            return;
        }

        // 2. Fetch XML
        const { data: xml } = await httpClient.get(downloadUrl);

        // 3. Parse XML (Regex)
        // <Cards CatID="34466" Quantity="1" Sideboard="false" Name="Fountainport" Annotation="0" />
        const main = [];
        const sb = [];

        const lines = xml.split('\n');
        for (const line of lines) {
            const match = line.match(/Quantity="(\d+)".*Sideboard="(true|false)".*Name="([^"]+)"/);
            if (match) {
                const qty = match[1];
                const isSb = match[2] === 'true';
                const cardName = match[3]; // might be XML encoded? e.g. &amp;
                // Basic decode?
                const decodedName = cardName.replace(/&amp;/g, '&').replace(/&apos;/g, "'"); // minimal

                const entry = `${qty} ${decodedName}`;
                if (isSb) sb.push(entry);
                else main.push(entry);
            }
        }

        const deckText = main.join('\n');
        const sbText = sb.join('\n');

        // 4. Resolve Archetype (Improved logic using signatures)
        const { classifyDeck } = require('./heuristicService');

        // Title: "Archetype Name by Player Name"
        let titleText = $('.deck-view-title').text().trim();
        if (!titleText) titleText = $('h1').first().text().trim();

        // Remove "by Player" robustly
        let gfArchName = titleText.split(/[\r\n\s]+by[\r\n\s]+/i)[0].trim();
        if (!gfArchName) gfArchName = 'Unknown';

        // Normalize using Heuristics/Signatures
        const classification = await classifyDeck(deckText, ev.format, gfArchName);
        const archName = classification.name;

        // Use Scraper's Heuristic logic to normalize ID
        let archId = null;

        // Try to finding existing archetype ID
        const existing = await db.execute({
            sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
            args: [archName, ev.format]
        });

        if (existing.rows.length > 0) {
            archId = existing.rows[0].id;
        } else {
            // Create New
            const ins = await db.execute({
                sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                args: [archName, ev.format]
            });
            archId = ins.rows[0].id;
        }

        // 5. Spice Calculation
        let spiceCount = 0;
        let spiceCardsJSON = '[]';
        try {
            const { calculateSpice } = require('./spice');
            // Fetch context (last 60 days of this archetype)
            const contextRes = await db.execute({
                sql: `SELECT raw_decklist, sideboard 
                      FROM decks 
                      WHERE archetype_id = ? 
                      AND event_date >= date('now', '-60 days')`,
                args: [archId]
            });
            const contextDecks = contextRes.rows;
            // Add current deck to context for accurate calc
            contextDecks.push({ raw_decklist: deckText, sideboard: sbText });

            const spiceResult = calculateSpice({
                raw_decklist: deckText,
                sideboard: sbText
            }, contextDecks);

            spiceCount = spiceResult.count;
            spiceCardsJSON = JSON.stringify(spiceResult.cards);
        } catch (spErr) {
            console.error("  Error calculating spice:", spErr.message);
        }

        // 6. Insert
        // Check Dup Deck first
        const dupCheck = await db.execute({
            sql: 'SELECT id FROM decks WHERE player_name = ? AND event_name = ? AND event_date = ?',
            args: [deck.player, ev.name, ev.date]
        });

        // Goldfish has YYYY-MM-DD. Coerce to ISO
        const isoDate = new Date(ev.date).toISOString();

        if (dupCheck.rows.length === 0) {
            await db.execute({
                sql: `INSERT INTO decks (player_name, format, event_name, event_date, rank, archetype_id, raw_decklist, sideboard, source_url, spice_count, spice_cards) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [deck.player, ev.format, ev.name, isoDate, deck.rank, archId, deckText, sbText, deck.url, spiceCount, spiceCardsJSON]
            });
            // console.log(`    Saved deck: ${archName} by ${deck.player}`);
        }

    } catch (e) {
        console.error(`  Error processing deck ${deck.url}:`, e.message);
    }
}

module.exports = { scrapeGoldfishEvents };
