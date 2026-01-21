
const cheerio = require('cheerio');

async function fetchPlayerHistory(playerName) {
    // Goldfish tends to use simple usernames in URLs, but sometimes they differ.
    // For now, we assume direct mapping or user knows the handle.
    // 'OkoDioWins' -> 'OkoDio' mappings might be needed if they differ often,
    // but the user's request implies they want to query 'OkoDioWins' or whatever the handle is.
    // We should try to handle 404s gracefully.

    // Note: User-Agent is required to avoid 403/404 on some setups.
    const url = `https://www.mtggoldfish.com/player/${encodeURIComponent(playerName)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (response.status === 404) {
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

                        // Parse date and filter > 30 days
                        // Goldfish date is YYYY-MM-DD
                        const eventDate = new Date(dateRaw);
                        const today = new Date();
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(today.getDate() - 30);

                        // Compare timestamps to be safe
                        // Note: Goldfish dates are UTC midnight usually.
                        if (eventDate.getTime() < thirtyDaysAgo.getTime()) return;

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

module.exports = { fetchPlayerHistory };
