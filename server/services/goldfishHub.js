const cheerio = require('cheerio');
const httpClient = require('./httpClient');

/**
 * Scrapes the Goldfish Tournament Hub for new events.
 * @param {string} format e.g. 'standard', 'modern'
 * @param {number} page
 */
async function scrapeHub(format = 'standard', page = 1) {
    const baseUrl = `https://www.mtggoldfish.com/tournaments/${format}`;
    const url = page > 1 ? `${baseUrl}?page=${page}` : baseUrl;
    console.log(`[Hub] Scraping ${url}...`);

    try {
        const response = await httpClient.get(url, {
            useSecondary: true, // Use proxies if configured to avoid blocks
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                'Referer': 'https://www.mtggoldfish.com/'
            }
        });

        const $ = cheerio.load(response.data);
        const events = [];

        $('table').each((i, tbl) => {
            // Find Header (usually preceding h2/h3 or parent sibling)
            let header = null;
            let current = $(tbl);

            // Search up/back 3 levels
            for (let k = 0; k < 3; k++) {
                const prev = current.prev();
                if (prev.length) {
                    if (prev.is('h2, h3, h4')) { header = prev; break; }
                    const nested = prev.find('a[href*="/tournament/"]');
                    if (nested.length) { header = nested.closest('h2, h3, h4'); break; }
                }
                current = prev;
            }
            if (!header) {
                const parentPrev = $(tbl).parent().prev();
                if (parentPrev.is('h2, h3, h4')) header = parentPrev;
            }

            if (header) {
                const linkEl = header.find('a');
                const relativeUrl = linkEl.attr('href');
                let fullText = header.text().replace(/\s+/g, ' ').trim();

                if (relativeUrl) {
                    const fullUrl = `https://www.mtggoldfish.com${relativeUrl}`;

                    // Extract Date: "Name on 2026-01-24"
                    let date = null;
                    const dateMatch = fullText.match(/on (\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                        date = dateMatch[1];
                        // Clean name
                        fullText = fullText.replace(`on ${date}`, '').trim();
                    } else {
                        // Sometimes date is in the text like "League 2026-01-24"
                        const isoMatch = fullText.match(/(\d{4}-\d{2}-\d{2})/);
                        if (isoMatch) date = isoMatch[1];
                    }
                    if (!date) date = new Date().toISOString().split('T')[0]; // Fallback if hub extraction fails

                    // Determine Type
                    let type = 'other';
                    const lowerName = fullText.toLowerCase();
                    if (lowerName.includes('challenge')) type = 'challenge';
                    else if (lowerName.includes('league')) type = 'league';
                    else if (lowerName.includes('lcq')) type = 'lcq';
                    else if (lowerName.includes('championship') || lowerName.includes('qualifier')) type = 'premier';

                    events.push({
                        name: fullText,
                        url: fullUrl,
                        date: date,
                        type: type
                    });
                }
            }
        });

        console.log(`[Hub] Found ${events.length} events.`);
        return events;

    } catch (e) {
        console.error(`[Hub] Error: ${e.message}`);
        return [];
    }
}

module.exports = { scrapeHub };
