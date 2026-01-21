
const { db } = require('../db');
const cheerio = require('cheerio');

async function scrapeDeck(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        const mainDeck = [];
        const sideboard = [];
        let sbMode = false;

        // Goldfish structure is usually specific tables or text input hidden
        // But often they have a text input area we can grab easily
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

        return {
            raw_decklist: mainDeck.join('\n'),
            sideboard: sideboard.join('\n')
        };
    } catch (e) {
        console.error(`Error scraping deck ${url}:`, e);
        return null; // Fail gracefully
    }
}

async function fetchPlayerHistory(playerName, days = 30) {
    // Goldfish tends to use simple usernames in URLs, but sometimes they differ.
    // For now, we assume direct mapping or user knows the handle.
    // 'OkoDioWins' -> 'OkoDio' mappings might be needed if they differ often,
    // but the user's request implies they want to query 'OkoDioWins' or whatever the handle is.
    // We should try to handle 404s gracefully.

    // Note: User-Agent is required to avoid 403/404 on some setups.
    const url = `https://www.mtggoldfish.com/player/${encodeURIComponent(playerName)}`;
    console.log(`FETCHING GOLDFISH HISTORY: ${url} (Days: ${days})`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

        // Headers usually: Date, Event, Format, Deck, Finish, Price...
        // Indices: 0=Date, 1=Event, 2=Format, 3=Deck, 4=Finish

        $('table').each((i, table) => {
            const headers = $(table).find('th').map((_i, el) => $(el).text().trim()).get();

            // Look for the tournament results table
            if (headers.some(h => h.includes('Date')) && headers.some(h => h.includes('Deck')) && headers.some(h => h.includes('Finish'))) {
                $(table).find('tbody tr').each((_j, row) => {
                    const cols = $(row).find('td');
                    if (cols.length >= 5) {
                        const dateRaw = $(cols[0]).text().trim();
                        // Skip empty rows (sometimes ads or spacers)
                        if (!dateRaw) return;

                        const event = $(cols[1]).text().trim();
                        const format = $(cols[2]).text().trim();
                        const deckCell = $(cols[3]);
                        const deckName = deckCell.text().trim();
                        const deckLinkRef = deckCell.find('a').attr('href');
                        const deckLink = deckLinkRef ? `https://www.mtggoldfish.com${deckLinkRef}` : null;
                        const rankRaw = $(cols[4]).text().trim();

                        // normalize rank to number if possible
                        let rank = null;
                        const rankMatch = rankRaw.match(/(\d+)/);
                        if (rankMatch) rank = parseInt(rankMatch[1]);

                        // Parse date and filter > X days
                        // Goldfish date is YYYY-MM-DD
                        const eventDate = new Date(dateRaw);
                        const today = new Date();
                        const cutoffDate = new Date();
                        cutoffDate.setDate(today.getDate() - days);

                        // Compare timestamps to be safe
                        // Note: Goldfish dates are UTC midnight usually.
                        if (eventDate.getTime() < cutoffDate.getTime()) return;

                        decks.push({
                            source: 'mtggoldfish',
                            id: deckLink || `gf-${Date.now()}-${Math.random()}`, // unique-ish id
                            event_date: dateRaw,
                            event_name: event,
                            format: format,
                            archetype: deckName, // Goldfish calls the deck name the archetype often
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
        return []; // Return empty on error to not break the frontend
    }
}

async function syncPlayerDecks(playerName, days = 30) {
    console.log(`Syncing decks for ${playerName} (last ${days} days)...`);
    const externalDecks = await fetchPlayerHistory(playerName, days);
    console.log(`Found ${externalDecks.length} external decks to potentially sync.`);

    let importedCount = 0;

    for (const d of externalDecks) {
        if (!d.url) continue;

        // Check duplicates
        // We match strictly on player + event + date to start
        const existing = await db.execute({
            sql: `SELECT id FROM decks WHERE player_name = ? AND event_name = ? AND event_date = ?`,
            args: [playerName, d.event_name, d.event_date]
        });

        if (existing.rows.length > 0) {
            // console.log(`Skipping existing: ${d.event_name} - ${d.event_date}`);
            continue;
        }

        console.log(`Scraping DETAILS for: ${d.url}`);
        // Scrape details
        const details = await scrapeDeck(d.url);
        if (!details || (!details.raw_decklist && !details.sideboard)) {
            console.warn(`Failed to scrape details for ${d.url}`);
            continue;
        }

        console.log(`Persisting new deck: ${d.archetype} for ${playerName}`);
        // Resolve Archetype
        let archId = null;
        try {
            // Find existing
            const exArch = await db.execute({
                sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                args: [d.archetype, d.format] // Goldfish "Deck" column is basically archetype
            });

            if (exArch.rows.length > 0) {
                archId = exArch.rows[0].id;
            } else {
                // Creates
                const ins = await db.execute({
                    sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                    args: [d.archetype, d.format]
                });
                if (ins.rows.length > 0) archId = ins.rows[0].id;
                else archId = ins.lastInsertRowid.toString();
            }
        } catch (e) {
            // Fallback
            // If failed to create, maybe just search 'Unknown'
            const unk = await db.execute({ sql: `SELECT id FROM archetypes WHERE name = 'Unknown' AND format = ?`, args: [d.format] });
            if (unk.rows.length > 0) archId = unk.rows[0].id;
        }

        if (!archId) {
            // Ensure Unknown exists if we strictly failed
            // We'll skip for safety if database is totally acting up
            continue;
        }

        // Insert
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
