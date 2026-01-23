const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const { db } = require('./server/db');

async function cleanup() {
    console.log('--- MTGO Scraper: Duplicate Cleanup Pass ---');

    try {
        // 1. URL-based duplicates (Goldfish)
        console.log('Checking for URL duplicates...');
        const urlDups = await db.execute(`
            SELECT player_name, source_url, count(*) as count 
            FROM decks 
            WHERE source_url IS NOT NULL 
            GROUP BY player_name, source_url 
            HAVING count > 1
        `);

        console.log(`Found ${urlDups.rows.length} URL-based duplicate sets.`);
        for (const set of urlDups.rows) {
            // Keep the one with the lowest ID
            const idsRes = await db.execute({
                sql: 'SELECT id FROM decks WHERE player_name = ? AND source_url = ? ORDER BY id ASC',
                args: [set.player_name, set.source_url]
            });
            const idsToKeep = idsRes.rows[0].id;
            const idsToDelete = idsRes.rows.slice(1).map(r => r.id);

            console.log(`  Deleting ${idsToDelete.length} duplicates for ${set.player_name} at ${set.source_url}`);
            await db.execute(`DELETE FROM decks WHERE id IN (${idsToDelete.join(',')})`);
        }

        // 2. Name/Date fuzzy duplicates (Multi-source or normalization issues)
        console.log('Checking for Name/Date/Rank duplicates...');
        const nameDups = await db.execute(`
            SELECT player_name, event_name, date(event_date) as day, rank, count(*) as count 
            FROM decks 
            GROUP BY player_name, event_name, day, rank 
            HAVING count > 1
        `);

        console.log(`Found ${nameDups.rows.length} Name/Date duplicate sets.`);
        for (const set of nameDups.rows) {
            const idsRes = await db.execute({
                sql: 'SELECT id FROM decks WHERE player_name = ? AND event_name = ? AND date(event_date) = ? AND rank = ? ORDER BY id ASC',
                args: [set.player_name, set.event_name, set.day, set.rank]
            });

            // Note: If they have different source_urls (Goldfish vs Top8), we might want to keep one.
            // But usually they are the same deck. If they have different urls, we prefer the one with a URL if possible.
            // For now, just keep the first one.
            const idsToDelete = idsRes.rows.slice(1).map(r => r.id);
            console.log(`  Deleting ${idsToDelete.length} duplicates for ${set.player_name} in ${set.event_name} on ${set.day}`);
            await db.execute(`DELETE FROM decks WHERE id IN (${idsToDelete.join(',')})`);
        }

        console.log('Cleanup complete.');
    } catch (err) {
        console.error('Cleanup failed:', err);
    }
}

cleanup();
