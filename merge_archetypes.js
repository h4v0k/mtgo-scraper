require('dotenv').config();
const { db, initDB } = require('./server/db');

async function mergeArchetypes() {
    await initDB();
    const format = 'Standard';
    const sourceName = 'Izzet Lesson';
    const targetName = 'Izzet Lessons';

    console.log(`Merging "${sourceName}" -> "${targetName}" in ${format}`);

    try {
        // Find IDs
        const sourceRes = await db.execute({
            sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
            args: [sourceName, format]
        });
        const targetRes = await db.execute({
            sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
            args: [targetName, format]
        });

        if (sourceRes.rows.length === 0) {
            console.log(`Source archetype "${sourceName}" not found. skipping.`);
            return;
        }
        if (targetRes.rows.length === 0) {
            console.log(`Target archetype "${targetName}" not found. creating it.`);
            // This shouldn't happen based on my previous search but let's be safe
            const ins = await db.execute({
                sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                args: [targetName, format]
            });
            targetId = ins.rows[0].id;
        } else {
            targetId = targetRes.rows[0].id;
        }

        const sourceId = sourceRes.rows[0].id;

        // Move decks
        const updateRes = await db.execute({
            sql: 'UPDATE decks SET archetype_id = ? WHERE archetype_id = ?',
            args: [targetId, sourceId]
        });
        console.log(`Moved ${updateRes.rowsAffected} decks.`);

        // Delete source
        await db.execute({
            sql: 'DELETE FROM archetypes WHERE id = ?',
            args: [sourceId]
        });
        console.log(`Deleted source archetype ID: ${sourceId}`);

    } catch (err) {
        console.error('Merge failed:', err);
    }
}

mergeArchetypes();
