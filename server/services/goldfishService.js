const axios = require('axios');
const cheerio = require('cheerio');
const { db } = require('../db');

const BASE_URL = 'https://www.mtggoldfish.com';

// Cache results to avoid spamming Goldfish for the same deck
// Key: "Player|Event|Date" -> Archetype Name
const CACHE = new Map();

/**
 * Normalizes event names for comparison
 * e.g., "Modern Challenge 32" -> "Modern Challenge"
 */
function normalizeEventName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/ \d{4}-\d{2}-\d{2}/, '') // Remove date if present
        .replace(/ \d+$/, '') // Remove trailing numbers (e.g. Challenge 32)
        .replace(/mtgo /g, '') // Remove generic MTGO prefix
        .replace(/(modern|pioneer|legacy|pauper|standard|vintage) /g, '') // Remove format prefix
        .replace('showcase ', '')
        .replace('super ', '') // "RC Super Qualifier" vs "RC Qualifier" -> treat as same class
        .trim();
}

/**
 * Checks if two dates are within 1 day of each other
 */
function isDateMatch(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return false;
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
}

/**
 * Looks up a deck's archetype on MTGGoldfish
 * @param {string} playerName "SoIMBAGallade"
 * @param {string} eventName "Modern Challenge"
 * @param {string} dateStr "2025-07-12"
 * @param {string} format "Modern"
 * @returns {Promise<string|null>} Archetype Name or null
 */
async function getArchetypeForDeck(playerName, eventName, dateStr, format) {
    const key = `${playerName}|${eventName}|${dateStr}`;
    if (CACHE.has(key)) return CACHE.get(key);

    try {
        // 1. Fetch Player Page
        // sanitize player name? usually URL encoded is enough
        const playerUrl = `${BASE_URL}/player/${encodeURIComponent(playerName)}`;
        // console.log(`[Goldfish] Fetching player: ${playerUrl}`);

        const { data: playerHtml } = await axios.get(playerUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const $ = cheerio.load(playerHtml);
        // console.log(`[Goldfish] Page Title: "${$('title').text().trim()}"`);

        // 2. Find row in "Recent Tournament Finishes"
        let deckUrl = null;

        const rows = $('table tr');
        // console.log(`[Goldfish] Found ${rows.length} rows for ${playerName}`);

        rows.each((i, row) => {
            if (deckUrl) return; // Found already

            const cols = $(row).find('td');
            if (cols.length < 4) return;

            const dateText = $(cols[0]).text().trim(); // "2025-07-12"
            const eventText = $(cols[1]).text().trim(); // "Modern Challenge 32"
            const formatText = $(cols[2]).text().trim(); // "Modern"
            const deckLink = $(cols[3]).find('a').attr('href'); // "/deck/123456"

            // console.log(`[Goldfish] Checking row: ${dateText} | ${eventText} | ${formatText}`);

            if (!deckLink) return;

            // Check Format
            if (formatText.toLowerCase() !== format.toLowerCase()) return;

            // Check Date
            if (!isDateMatch(dateStr, dateText)) {
                // console.log(`[Goldfish] Date mismatch: ${dateStr} vs ${dateText}`);
                return;
            }

            // Check Event (Fuzzy)
            if (normalizeEventName(eventName) !== normalizeEventName(eventText)) {
                console.log(`[Goldfish] Event name mismatch (REJECTED): ${eventName} vs ${eventText} -> ${normalizeEventName(eventName)} vs ${normalizeEventName(eventText)}`);
                // Proceed to next row
                return;
            }

            console.log(`[Goldfish] Match found! URL: ${deckLink}`);
            deckUrl = BASE_URL + deckLink;
        });

        if (!deckUrl) {
            // console.log(`[Goldfish] No matching deck found for ${playerName} on ${dateStr}`);
            CACHE.set(key, null);
            return null;
        }

        // 3. Fetch Deck Page
        // console.log(`[Goldfish] Fetching deck page: ${deckUrl}`);
        await new Promise(r => setTimeout(r, 1000)); // Rate limit
        const { data: deckHtml } = await axios.get(deckUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $d = cheerio.load(deckHtml);


        // 4. Extract Archetype
        // Usually in .deck-view-title or h1
        // Expected format: "Archetype Name by Player" or similar header
        // Or in the breakdown: "Archetype: Boros Energy" (if exists)
        // MTGGoldfish usually puts specific name in h1 like "Boros Energy by SoIMBAGallade"
        // But the pure archetype might be in breadcrumbs or metadata.
        // Let's rely on the title parsing we saw in scraper

        let headerText = $d('.deck-view-title').first().text();
        if (!headerText) headerText = $d('h1').first().text();

        console.log(`[Goldfish] Header Text: "${headerText}"`);

        // Title often: "Boros Energy by SoIMBAGallade"
        // Sometimes "Boros Energy\nby SoIMBAGallade"
        let archName = headerText.trim().split(/ by |[\r\n]+/i)[0].trim();

        console.log(`[Goldfish] Extracted Arch: "${archName}"`);

        // Use scraper's cleaning logic just in case
        archName = archName.replace(/\s*@\s*.*$/, '').trim();

        if (archName) {
            console.log(`[Goldfish] Loopkup: ${playerName} / ${eventName} -> ${archName}`);
            CACHE.set(key, archName);
            return archName;
        }

    } catch (err) {
        // 404 is common if player has no recent results or name is wrong
        console.error(`[Goldfish] Error looking up ${playerName}: ${err.message}`);
    }

    // console.log(`[Goldfish] No match found for ${key}`);
    CACHE.set(key, null);
    return null;
}

module.exports = { getArchetypeForDeck };
