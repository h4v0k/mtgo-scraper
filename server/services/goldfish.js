
const { db } = require('../db');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

async function scrapeDeck(url) {
    let browser = null;
    try {
        console.log(`Launching Puppeteer for ${url}`);
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();

        // Block images/css to speed up
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Go to page
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for connection/textarea logic or just dump html
        // Goldfish deck input is often in a textarea or table
        // We'll wait a bit for hydration
        await new Promise(r => setTimeout(r, 2000));

        const content = await page.content();
        const $ = cheerio.load(content);

        const mainDeck = [];
        const sideboard = [];
        let sbMode = false;

        // Try textarea first
        const deckTextArea = $('.deck-view-deck-table').next('textarea.copy-paste-box').val();

        if (deckTextArea) {
            // Easier parsing if text area exists
            const lines = deckTextArea.split('\n');
            let isSb = false;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.toLowerCase().includes('sideboard')) {
                    isSb = true;
                    continue;
                }
                if (isSb) sideboard.push(trimmed);
                else mainDeck.push(trimmed);
            }
        } else {
            // Fallback to table parsing if copy-paste box is missing
            $('table.deck-view-deck-table tr').each((i, row) => {
                const qty = $(row).find('.deck-col-qty').text().trim();
                const name = $(row).find('.deck-col-card a').text().trim();
                if (qty && name) {
                    // This scraper is tough because SB is separated by headers
                    // Simplified: just grab everything as mainboard for now if fallback
                    mainDeck.push(`${qty} ${name}`);
                }
            });
        }

        if (mainDeck.length === 0 && sideboard.length === 0) {
            console.warn("Puppeteer found no deck content.");
            return null;
        }

        return {
            raw_decklist: mainDeck.join('\n'),
            sideboard: sideboard.join('\n')
        };
    } catch (e) {
        console.error(`Error scraping deck ${url}:`, e);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

async function fetchPlayerHistory(playerName, days = 30) {
    const url = `https://www.mtggoldfish.com/player/${encodeURIComponent(playerName)}`;
    console.log(`FETCHING GOLDFISH HISTORY: ${url} (Days: ${days})`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.mtggoldfish.com/',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        if (response.status === 404) {
            console.warn(`Goldfish Player 404: ${playerName}`);
            return [];
        }

        if (!response.ok) {
            throw new Error(`Goldfish returned ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const decks = [];

        $('table').each((i, table) => {
            const headers = $(table).find('th').map((_i, el) => $(el).text().trim()).get();

            if (headers.some(h => h.includes('Date')) && headers.some(h => h.includes('Deck')) && headers.some(h => h.includes('Finish'))) {
                $(table).find('tbody tr').each((_j, row) => {
                    const cols = $(row).find('td');
                    if (cols.length >= 5) {
                        const dateRaw = $(cols[0]).text().trim();
                        if (!dateRaw) return;

                        const event = $(cols[1]).text().trim();
                        const format = $(cols[2]).text().trim();
                        const deckCell = $(cols[3]);
                        const deckName = deckCell.text().trim();
                        const deckLinkRef = deckCell.find('a').attr('href');
                        const deckLink = deckLinkRef ? `https://www.mtggoldfish.com${deckLinkRef}` : null;
                        const rankRaw = $(cols[4]).text().trim();

                        let rank = null;
                        const rankMatch = rankRaw.match(/(\d+)/);
                        if (rankMatch) rank = parseInt(rankMatch[1]);

                        const eventDate = new Date(dateRaw);
                        const today = new Date();
                        const cutoffDate = new Date();
                        cutoffDate.setDate(today.getDate() - days);

                        if (eventDate.getTime() < cutoffDate.getTime()) return;

                        decks.push({
                            source: 'mtggoldfish',
                            id: deckLink || `gf-${Date.now()}-${Math.random()}`,
                            event_date: dateRaw,
                            event_name: event,
                            format: format,
                            archetype: deckName,
                            rank: rank || 0,
                            url: deckLink
                        });
                    }
                });
            }
        });

        return decks;

    } catch (err) {
        console.error('Error fetching from Goldfish:', err);
        return [];
    }
}

async function syncPlayerDecks(playerName, days = 30) {
    console.log(`Syncing decks for ${playerName} (last ${days} days)...`);
    const externalDecks = await fetchPlayerHistory(playerName, days);
    console.log(`Found ${externalDecks.length} external decks to potentially sync.`);

    let importedCount = 0;

    for (const d of externalDecks) {
        if (!d.url) continue;

        const existing = await db.execute({
            sql: `SELECT id FROM decks WHERE player_name = ? AND event_name = ? AND event_date = ?`,
            args: [playerName, d.event_name, d.event_date]
        });

        if (existing.rows.length > 0) {
            continue;
        }

        console.log(`Scraping DETAILS for: ${d.url}`);
        const details = await scrapeDeck(d.url);
        if (!details || (!details.raw_decklist && !details.sideboard)) {
            console.warn(`Failed to scrape details for ${d.url}`);
            continue;
        }

        console.log(`Persisting new deck: ${d.archetype} for ${playerName}`);

        let archId = null;
        try {
            const exArch = await db.execute({
                sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                args: [d.archetype, d.format]
            });

            if (exArch.rows.length > 0) {
                archId = exArch.rows[0].id;
            } else {
                const ins = await db.execute({
                    sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                    args: [d.archetype, d.format]
                });
                if (ins.rows.length > 0) archId = ins.rows[0].id;
                else archId = ins.lastInsertRowid.toString();
            }
        } catch (e) {
            const unk = await db.execute({ sql: `SELECT id FROM archetypes WHERE name = 'Unknown' AND format = ?`, args: [d.format] });
            if (unk.rows.length > 0) archId = unk.rows[0].id;
        }

        if (!archId) continue;

        await db.execute({
            sql: `INSERT INTO decks (player_name, format, event_name, event_date, rank, archetype_id, raw_decklist, sideboard, source_url) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [playerName, d.format, d.event_name, d.event_date, d.rank, archId, details.raw_decklist, details.sideboard, d.url]
        });

        importedCount++;
    }

    console.log(`Sync complete for ${playerName}: Imported ${importedCount} new decks.`);
    return importedCount;
}

module.exports = { fetchPlayerHistory, syncPlayerDecks };
