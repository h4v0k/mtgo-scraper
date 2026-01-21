
const { db } = require('../db');
const cheerio = require('cheerio');

async function scrapeDeck(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Referer': 'https://www.mtggoldfish.com/'
            }
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        const mainDeck = [];
        const sideboard = [];

        // 1. Try hidden input (Most reliable for raw list)
        // Format is usually "Qty Name\nQty Name"
        // Sideboard is sometimes separated by empty line or "Sideboard" header in text, 
        // OR it's just a flat list. ID #deck_input_deck seems to convert to MTGO format.
        const deckInputVal = $('#deck_input_deck').val();

        if (deckInputVal) {
            const lines = deckInputVal.split('\n');
            let isSb = false;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                // Goldfish export format usually puts "Sideboard" line if it exists
                if (trimmed.toLowerCase() === 'sideboard') {
                    isSb = true;
                    continue;
                }
                if (isSb) sideboard.push(trimmed);
                else mainDeck.push(trimmed);
            }
        } else {
            // 2. Fallback to Copy/Paste Textarea
            const deckTextArea = $('textarea.copy-paste-box').val();
            if (deckTextArea) {
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
                // 3. Fallback to Table Parsing (Least reliable due to layout changes)
                // Goldfish separates main/side with headers in standard view
                let tableSbMode = false;
                $('table.deck-view-deck-table').each((tIdx, table) => {
                    // Heuristic: If we see a header row saying Sideboard, switch mode
                    if ($(table).prev().text().toLowerCase().includes('sideboard')) tableSbMode = true;

                    $(table).find('tr').each((i, row) => {
                        if ($(row).find('th').text().toLowerCase().includes('sideboard')) {
                            tableSbMode = true;
                            return;
                        }
                        const qty = $(row).find('.deck-col-qty').text().trim();
                        const name = $(row).find('.deck-col-card a').text().trim();
                        if (qty && name) {
                            if (tableSbMode) sideboard.push(`${qty} ${name}`);
                            else mainDeck.push(`${qty} ${name}`);
                        }
                    });
                    // If multiple tables, usually 2nd is sideboard?
                    // if (tIdx > 0 && !tableSbMode) tableSbMode = true; 
                });
            }
        }

        if (mainDeck.length === 0 && sideboard.length === 0) {
            console.warn("Goldfish scraper found no deck content.");
            return null;
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

                        // Normalize Event Name (Per User Request)
                        // "Standard League 2026-01-20" -> "MTGO League"
                        // "Modern Challenge 32 ..." -> "MTGO Challenge 32"
                        let normalizedEvent = event;
                        if (event.includes('League')) normalizedEvent = 'MTGO League';
                        else if (event.includes('Challenge 32')) normalizedEvent = 'MTGO Challenge 32';
                        else if (event.includes('Challenge 64')) normalizedEvent = 'MTGO Challenge 64';
                        else if (event.includes('Preliminary')) normalizedEvent = 'MTGO Preliminary';
                        // Keep Championships/Qualifiers specific as they are often unique named events

                        decks.push({
                            source: 'mtggoldfish',
                            id: deckLink || `gf-${Date.now()}-${Math.random()}`,
                            event_date: dateRaw,
                            event_name: normalizedEvent, // Use Normalized Name
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

        // 1. Strict Name Check (Fast Fail)
        const existing = await db.execute({
            sql: `SELECT id FROM decks WHERE player_name = ? AND event_name = ? AND event_date LIKE ?`,
            args: [playerName, d.event_name, `${d.event_date}%`]
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

        // 2. Content-Based Deduplication (Smart Check)
        const contentMatch = await db.execute({
            sql: `SELECT id, event_name, event_date FROM decks 
                  WHERE player_name = ? 
                  AND format = ? 
                  AND raw_decklist = ? 
                  AND (event_date LIKE ? OR abs(julianday(event_date) - julianday(?)) < 1)`,
            args: [playerName, d.format, details.raw_decklist, `${d.event_date}%`, d.event_date]
        });

        if (contentMatch.rows.length > 0) {
            const match = contentMatch.rows[0];
            const e1 = match.event_name.toLowerCase();
            const e2 = d.event_name.toLowerCase();

            // STRICT CHECK: Do not allow cross-type deduplication (e.g. League vs Challenge)
            const getType = (e) => {
                if (e.includes('league')) return 'league';
                if (e.includes('challenge')) return 'challenge';
                if (e.includes('qualifier')) return 'qualifier';
                if (e.includes('showcase')) return 'showcase';
                if (e.includes('preliminary')) return 'preliminary';
                if (e.includes('championship')) return 'championship';
                return 'other';
            };

            const t1 = getType(e1);
            const t2 = getType(e2);

            if (t1 !== t2) {
                console.log(`Skipping duplicate content check (Events are distinct types: ${match.event_name} vs ${d.event_name})`);
                // Proceed to insert as distinct event
            } else {
                // Same type (e.g. League vs League). Check for Generic Alias upgrade.
                const isGeneric1 = e1.startsWith('mtgo ');
                const isGeneric2 = e2.startsWith('mtgo ');

                let shouldReplace = false;

                if (isGeneric1 && !isGeneric2) {
                    shouldReplace = true;
                }

                if (shouldReplace) {
                    console.log(`UPGRADING event: Replacing Generic ${match.event_name} with Specific ${d.event_name}`);
                    await db.execute({
                        sql: 'DELETE FROM decks WHERE id = ?',
                        args: [match.id]
                    });
                    // Continue to insert
                } else {
                    console.log(`Skipping duplicate content (Already exists as ${match.event_name})`);
                    continue;
                }
            }
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
