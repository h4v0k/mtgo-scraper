const { calculateSpice } = require('./spice');
const { db } = require('../db');
const cheerio = require('cheerio');
const httpClient = require('./httpClient');
const { findExistingDeckForPlayer, normalizeEventNameForStorage } = require('./dedupService');
const { classifyDeck } = require('./heuristicService');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Robustly scrapes a deck from Goldfish, handling individual deck pages 
 * and fallback formats (xml/txt) which are safer for "EXT" decks.
 */
async function scrapeDeck(url) {
    try {
        const response = await httpClient.get(url, {
            useSecondary: true,
            headers: { 'Referer': 'https://www.mtggoldfish.com/' }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // STRATEGY 0: Try to find a direct Download link first (MTGO .dek or .txt)
        // This is the most reliable way for EXT decks.
        let downloadUrl = null;
        $('a').each((i, el) => {
            const h = $(el).attr('href');
            if (h && (h.includes('/deck/download/') || h.includes('/deck/arena_download/'))) {
                // Prioritize MTGO .dek or MTGO .txt
                if (h.includes('output=dek') || h.includes('output=txt')) {
                    downloadUrl = 'https://www.mtggoldfish.com' + h;
                    return false; // break
                }
            }
        });

        if (downloadUrl) {
            // console.log(`   [Scrape] Downloading raw list from: ${downloadUrl}`);
            const dlRes = await httpClient.get(downloadUrl, { useSecondary: true });
            const rawContent = dlRes.data;

            if (downloadUrl.includes('output=dek')) {
                // Parse XML (.dek)
                const main = [];
                const sb = [];
                const lines = rawContent.split('\n');
                for (const line of lines) {
                    const match = line.match(/Quantity="(\d+)".*Sideboard="(true|false)".*Name="([^"]+)"/);
                    if (match) {
                        const qty = match[1];
                        const isSb = match[2] === 'true';
                        const cardName = match[3].replace(/&amp;/g, '&').replace(/&apos;/g, "'");
                        const entry = `${qty} ${cardName}`;
                        if (isSb) sb.push(entry);
                        else main.push(entry);
                    }
                }
                if (main.length > 0) {
                    return { raw_decklist: main.join('\n'), sideboard: sb.join('\n') };
                }
            } else {
                // Parse Text/Arena format
                const main = [];
                const sb = [];
                let isSb = false;
                const lines = rawContent.split(/[\r\n]+/);
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    if (trimmed.toLowerCase().includes('sideboard')) { isSb = true; continue; }
                    if (isSb) sb.push(trimmed);
                    else main.push(trimmed);
                }
                if (main.length > 0) {
                    return { raw_decklist: main.join('\n'), sideboard: sb.join('\n') };
                }
            }
        }

        // STRATEGY 1: Try hidden input (Goldfish internally stores deck lists here)
        const deckInputVal = $('#deck_input_deck').val();
        if (deckInputVal) {
            const lines = deckInputVal.split('\n');
            let isSb = false;
            const main = [];
            const sb = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.toLowerCase() === 'sideboard') { isSb = true; continue; }
                if (isSb) sb.push(trimmed);
                else main.push(trimmed);
            }
            return { raw_decklist: main.join('\n'), sideboard: sb.join('\n') };
        }

        // STRATEGY 2: Textarea Fallback
        const deckTextArea = $('textarea.copy-paste-box').val();
        if (deckTextArea) {
            const lines = deckTextArea.split('\n');
            let isSb = false;
            const main = [];
            const sb = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.toLowerCase().includes('sideboard')) { isSb = true; continue; }
                if (isSb) sb.push(trimmed);
                else main.push(trimmed);
            }
            return { raw_decklist: main.join('\n'), sideboard: sb.join('\n') };
        }

        return null;
    } catch (e) {
        console.error(`Error scraping deck ${url}:`, e.message);
        return null;
    }
}

async function fetchPlayerHistory(playerName, days = 30) {
    const url = `https://www.mtggoldfish.com/player/${encodeURIComponent(playerName)}`;
    console.log(`FETCHING GOLDFISH HISTORY: ${url} (Days: ${days})`);

    try {
        const response = await httpClient.get(url, {
            useSecondary: true,
            headers: { 'Referer': 'https://www.mtggoldfish.com/' }
        });

        const html = response.data;
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

                        const isLeague = event.toLowerCase().includes('league') || format.toLowerCase().includes('league');
                        let rank = null;
                        const rankMatch = rankRaw.match(/(\d+)/);
                        if (rankMatch) rank = parseInt(rankMatch[1]);

                        if (isLeague) {
                            if (rankRaw !== '5-0' && rank !== 5) return;
                            rank = 0;
                        }

                        const eventDate = new Date(dateRaw);
                        const today = new Date();
                        const cutoffDate = new Date();
                        cutoffDate.setDate(today.getDate() - days);

                        if (eventDate.getTime() < cutoffDate.getTime()) return;

                        // INITIAL NORMALIZATION
                        const normalizedEvent = normalizeEventNameForStorage(event, format);

                        decks.push({
                            source: 'mtggoldfish',
                            id: deckLink || `gf-${Date.now()}-${Math.random()}`,
                            event_date: dateRaw,
                            event_name: normalizedEvent,
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
    const spiceContextCache = {};

    for (let i = 0; i < externalDecks.length; i++) {
        const d = externalDecks[i];
        if (!d.url) continue;

        const exists = await findExistingDeckForPlayer(playerName, d.format, d.event_date, d.event_name, d.url);
        if (exists) continue;

        console.log(`[${i + 1}/${externalDecks.length}] Scraping: ${d.url}`);
        const details = await scrapeDeck(d.url);
        if (!details || (!details.raw_decklist && !details.sideboard)) {
            console.warn(`Failed to scrape details for ${d.url}`);
            continue;
        }

        const classification = await classifyDeck(details.raw_decklist, d.format, d.archetype);
        const archName = classification.name;

        // FINAL NORMALIZATION SAFETY (Ensures no dates slip through)
        const finalEventName = normalizeEventNameForStorage(d.event_name, d.format);

        console.log(`Persisting: ${archName} | Event: ${finalEventName}`);

        let archId = null;
        try {
            const exArch = await db.execute({
                sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                args: [archName, d.format]
            });

            if (exArch.rows.length > 0) {
                archId = exArch.rows[0].id;
            } else {
                const ins = await db.execute({
                    sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                    args: [archName, d.format]
                });
                archId = ins.rows[0].id;
            }
        } catch (e) {
            const unk = await db.execute({ sql: `SELECT id FROM archetypes WHERE name = 'Unknown' AND format = ?`, args: [d.format] });
            if (unk.rows.length > 0) archId = unk.rows[0].id;
        }

        if (!archId) continue;

        let spiceCount = 0;
        let spiceCardsJSON = '[]';
        try {
            const cacheKey = `${archId}|${d.format}`;
            if (!spiceContextCache[cacheKey]) {
                const contextRes = await db.execute({
                    sql: `SELECT raw_decklist, sideboard FROM decks WHERE archetype_id = ? AND event_date >= date('now', '-60 days')`,
                    args: [archId]
                });
                spiceContextCache[cacheKey] = contextRes.rows;
            }

            const contextDecks = [...spiceContextCache[cacheKey]];
            contextDecks.push({ raw_decklist: details.raw_decklist, sideboard: details.sideboard });

            const spiceResult = calculateSpice({
                raw_decklist: details.raw_decklist,
                sideboard: details.sideboard
            }, contextDecks);

            spiceCount = spiceResult.count;
            spiceCardsJSON = JSON.stringify(spiceResult.cards);
        } catch (err) {
            console.error("Error calculating spice during ingest:", err);
        }

        await db.execute({
            sql: `INSERT INTO decks (player_name, event_name, event_date, format, rank, archetype_id, source_url, raw_decklist, sideboard, spice_count, spice_cards) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                playerName,
                finalEventName,
                d.event_date,
                d.format,
                d.rank || 0,
                archId,
                d.url,
                details.raw_decklist,
                details.sideboard,
                spiceCount,
                spiceCardsJSON || '[]'
            ]
        });

        importedCount++;
        await delay(1000);
    }

    console.log(`Sync complete for ${playerName}: Imported ${importedCount} new decks.`);
    return importedCount;
}

module.exports = { fetchPlayerHistory, syncPlayerDecks };
