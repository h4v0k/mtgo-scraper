const { db } = require('../db');

/**
 * Clean and normalize event names for comparison and storage.
 */
function normalizeEventName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/mtgo/g, '')
        .replace(/standard|modern|pioneer|legacy|pauper|vintage|premodern/g, '')
        .replace(/showcase/g, '')
        .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '') // ISO Date
        .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '') // US Date
        .replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, '') // EU Date (DD.MM.YYYY)
        .replace(/\(\d{4}-\d{2}-\d{2}\)/g, '') // Date in parens
        .replace(/\([^)]*\d{2,4}[^)]*\)/g, '') // Any parens with year-like numbers
        .replace(/\(\s*\)/g, '') // Empty parens
        // .replace(/\(\d+\)/g, '') // STOP STRIPPING (1) suffix to distinguish multiple events per day
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Normalizes event names for consistency in the DB storage.
 */
function normalizeEventNameForStorage(name, format) {
    if (!name) return '';
    let normalized = name.trim();

    // 1. Handle LCQs specifically: "RC *Location* LCQ"
    if (normalized.toLowerCase().includes('lcq')) {
        // Try to find the location. If Portland is mentioned, it's RC Portland LCQ
        if (normalized.toLowerCase().includes('portland')) {
            return `RC Portland LCQ`;
        }
        // Generic fallback if location not found
        const lcqMatch = normalized.match(/RC\s+([\w\s]+)\s+LCQ/i);
        if (lcqMatch) return `RC ${lcqMatch[1]} LCQ`;

        return `${format} LCQ`;
    }

    // 2. Normalize Challenges: Keep "Challenge 32" or "Challenge 64" part
    const challengeMatch = normalized.match(/Challenge\s*(32|64)/i);
    if (challengeMatch) {
        return `${format} Challenge ${challengeMatch[1]}`;
    }

    // 3. Strip dates (Robust - multiple formats)
    normalized = normalized.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ''); // 2026-01-22
    normalized = normalized.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ''); // 1/22/2026
    normalized = normalized.replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, ''); // 21.01.2026

    // 4. Strip parenthetical content with dates/years AND brackets
    normalized = normalized.replace(/\([^)]*\d{2,4}[^)]*\)/g, ''); // (WntrSpr '26), (2026-01-22), etc.
    normalized = normalized.replace(/\[.*?\]/g, ''); // [Lyon Sat 09:00]

    // 5. Standardize MTGO prefix to Format name
    if (normalized.toLowerCase().startsWith('mtgo ')) {
        normalized = normalized.substring(5);
    }

    // 6. Ensure format name is prepended exactly once
    if (format) {
        const formatEscaped = format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fmtRegexAnywhere = new RegExp(`\\s*-\\s*${formatEscaped}|\\b${formatEscaped}\\b`, 'gi');
        normalized = normalized.replace(fmtRegexAnywhere, '').trim();
        normalized = normalized.replace(/\s*-\s*$/, '').trim();
        normalized = normalized.replace(/\s+-\s+.*\d{4}.*$/, '');
        normalized = normalized.replace(/\s+\d{4}-\d{2}-\d{2}$/, '');
        normalized = format + ' ' + normalized;
    }

    // 7. Final cleanup
    return normalized
        .replace(/\(\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Checks if an event already exists in the DB around a given date.
 */
async function isEventExists(format, dateStr, eventName) {
    const normName = normalizeEventName(eventName);
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const isoDate = d.toISOString().split('T')[0];

    const dPrev = new Date(d); dPrev.setDate(d.getDate() - 1);
    const dNext = new Date(d); dNext.setDate(d.getDate() + 1);
    const dates = [dPrev.toISOString().split('T')[0], isoDate, dNext.toISOString().split('T')[0]];

    try {
        const res = await db.execute({
            sql: `SELECT event_name, event_date FROM decks 
                  WHERE format = ? 
                  AND date(event_date) IN (?, ?, ?) 
                  GROUP BY event_name, event_date`,
            args: [format, ...dates]
        });

        for (const row of res.rows) {
            const dbNorm = normalizeEventName(row.event_name);
            const dbDate = (typeof row.event_date === 'string' ? row.event_date : row.event_date.toISOString()).split(' ')[0].split('T')[0];

            if (normName === dbNorm && isoDate === dbDate) return true;

            if (normName.includes('challenge') && dbNorm.includes('challenge')) {
                const nums1 = normName.match(/\d+/g);
                const nums2 = dbNorm.match(/\d+/g);
                // STRICT DATE CHECK for Challenges:
                // Prevents "Standard Challenge 32" on Saturday from being skipped because
                // "Standard Challenge 32" exists on Friday (within 1 day range).
                if (nums1 && nums2 && nums1[0] === nums2[0] && isoDate === dbDate) return true;
                if (nums1 || nums2) continue;
                if (normName === dbNorm && isoDate === dbDate) return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Finds if a deck already exists for a player.
 */
async function findExistingDeckForPlayer(playerName, format, dateStr, eventName, sourceUrl = null) {
    if (sourceUrl) {
        const urlRes = await db.execute({
            sql: 'SELECT id FROM decks WHERE player_name = ? AND source_url = ?',
            args: [playerName, sourceUrl]
        });
        if (urlRes.rows.length > 0) return true;
    }

    const normName = normalizeEventName(eventName);
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    // Strictly normalize to YYYY-MM-DD
    const isoDate = d.toISOString().split('T')[0];

    const dPrev = new Date(d); dPrev.setDate(d.getDate() - 1);
    const dNext = new Date(d); dNext.setDate(d.getDate() + 1);
    const dates = [dPrev.toISOString().split('T')[0], isoDate, dNext.toISOString().split('T')[0]];

    const candidates = await db.execute({
        sql: `SELECT event_name, event_date, source_url FROM decks 
              WHERE player_name = ? 
              AND format = ? 
              AND date(event_date) IN (?, ?, ?)`,
        args: [playerName, format, ...dates]
    });

    for (const cand of candidates.rows) {
        const candNorm = normalizeEventName(cand.event_name);
        // Use strictly YYYY-MM-DD comparison
        let candDateRaw = cand.event_date;
        if (typeof candDateRaw !== 'string') candDateRaw = candDateRaw.toISOString();
        const candDate = candDateRaw.split(/[ T]/)[0];

        // 1. Precise Match (Event Name + Date)
        if (normName === candNorm && isoDate === candDate) return true;

        // 2. Tournament Match (Challenge Number + Date + Format + Rank)
        if (normName.includes('challenge') && candNorm.includes('challenge')) {
            const nums1 = normName.match(/\d+/g);
            const nums2 = candNorm.match(/\d+/g);

            // If they are the same challenge size (e.g., 32) on the same date
            if (nums1 && nums2 && nums1[0] === nums2[0] && isoDate === candDate) {
                return true;
            }
        }
    }

    return false;
}

module.exports = { isEventExists, normalizeEventName, normalizeEventNameForStorage, findExistingDeckForPlayer };
