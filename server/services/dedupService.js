const { db } = require('../db');

/**
 * Normalizes event names for comparison
 * e.g. "Standard Challenge 32" -> "challenge 32"
 * e.g. "MTGO Challenge 32" -> "challenge 32"
 */
function normalizeEventName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/mtgo/g, '')
        .replace(/standard|modern|pioneer|legacy|pauper|vintage/g, '')
        .replace(/showcase/g, '')
        .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove date
        .replace(/\(\d+\)/g, '') // Remove (1) suffix
        .replace(/[^a-z0-9]/g, ' ') // Remove special chars
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Checks if an event already exists in the DB around a given date.
 * @param {string} format "Standard"
 * @param {string} dateStr "2026-01-22"
 * @param {string} eventName "Standard Challenge 32"
 * @returns {Promise<boolean>}
 */
async function isEventExists(format, dateStr, eventName) {
    const normName = normalizeEventName(eventName);

    // Define date window (Target +/- 1 day)
    const d = new Date(dateStr);
    const dPrev = new Date(d); dPrev.setDate(d.getDate() - 1);
    const dNext = new Date(d); dNext.setDate(d.getDate() + 1);

    const dates = [
        dPrev.toISOString().split('T')[0],
        dateStr,
        dNext.toISOString().split('T')[0]
    ];

    try {
        // Query events in this format and date range
        // We do fuzzy matching in JS because SQL LIKE is limited for this logic
        const res = await db.execute({
            sql: `SELECT event_name FROM decks 
                  WHERE format = ? 
                  AND date(event_date) IN (?, ?, ?) 
                  GROUP BY event_name`,
            args: [format, ...dates]
        });

        for (const row of res.rows) {
            const dbNorm = normalizeEventName(row.event_name);

            // 1. Exact normalized match
            if (normName === dbNorm) return true;

            // 2. Specific Challenge Logic
            // If both are "challenge", but numbers differ? 
            // "challenge 32" vs "challenge" -> match? No, usually distinct.
            // "challenge 32" vs "challenge 32" -> match.
            // If the normalized string contains numbers, match strictly on them.
            const nums1 = normName.match(/\d+/g);
            const nums2 = dbNorm.match(/\d+/g);

            if (normName.includes('challenge') && dbNorm.includes('challenge')) {
                // If both have numbers and they match -> TRUE
                if (nums1 && nums2 && nums1[0] === nums2[0]) return true;
                // If one lacks numbers (e.g. "challenge" vs "challenge 32"), ambiguous. 
                // Usually safe to assume SAME if date matches closely.
                // But let's be strict: if numbers exist, they must match.
                if (nums1 && nums2 && nums1[0] !== nums2[0]) continue;

                // If numbers match or both missing numbers -> Match
                return true;
            }

            // 3. League Logic
            if (normName.includes('league') && dbNorm.includes('league')) return true;
        }

        return false;
    } catch (e) {
        console.error("Error checking event existence:", e);
        return false; // Fail safe? Or Fail open? Fail safe = don't skip.
    }
}

/**
 * Normalizes event names for consistency in the DB
 * e.g. "MTGO League" + "Standard" -> "Standard League"
 * e.g. "Standard Challenge 32" -> "Standard Challenge 32"
 */
function normalizeEventNameForStorage(name, format) {
    if (!name) return '';
    let normalized = name.trim();

    // Replace "MTGO" with the format name if MTGO is the prefix
    if (normalized.startsWith('MTGO ')) {
        normalized = normalized.replace('MTGO ', format + ' ');
    }

    // If the name doesn't contain the format yet, prepend it (optional, but keep consistent)
    // Most events from scrapers already include format.

    return normalized;
}

module.exports = { isEventExists, normalizeEventName, normalizeEventNameForStorage };
