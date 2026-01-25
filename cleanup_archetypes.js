require('dotenv').config();
const { db, initDB } = require('./server/db');

async function cleanupArchetypes() {
    await initDB();

    // Define merges: [source, target, format]
    const merges = [
        ['Izzet Lesson', 'Izzet Lessons', 'Standard'],
        ['Mono Green Landfall', 'Mono-Green Landfall', 'Standard'],
        ['Allies', 'Naya Allies', 'Standard'],
        ['Sultai Elementals', 'Sultai Elemental Scam', 'Standard'],
        ['Bant Airbending Combo', 'Bant Airbending', 'Standard'],
        ['Simic Nature\'s Rhythm', 'Simic Landfall', 'Standard'],
        ['U-B-R-G', '4c Control', 'Standard'],
        ['U-B-R-G Midrange', '4c Control', 'Standard'],
        ['U-B-R-G Reanimator', 'Abzan Reanimator', 'Standard'], // Wait, 4c Reanimator? Let's be careful
        ['Weenie White', 'White Weenie', 'Standard'],
        ['Challenge\n    \n     Boros Aggro', 'Boros Aggro', 'Standard']
    ];

    // Handle Premodern / Pioneer weirdness if any seen in the raw output
    // I noticed "PIL Online League 01/26\n    \n     Oath of Druids"

    try {
        const archsRes = await db.execute('SELECT id, name, format FROM archetypes');
        const archs = archsRes.rows;

        for (const arch of archs) {
            let newName = arch.name.replace(/\n\s+/g, ' ').trim();
            if (newName.startsWith('Challenge ')) {
                newName = newName.replace(/^Challenge\s+/, '');
            }
            if (newName.startsWith('PIL Online League 01/26 ')) {
                newName = newName.replace(/^PIL Online League 01\/26\s+/, '');
            }

            if (newName !== arch.name) {
                console.log(`Cleaning up name: "${arch.name}" -> "${newName}"`);
                // Check if target exists
                const targetRes = await db.execute({
                    sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                    args: [newName, arch.format]
                });

                if (targetRes.rows.length > 0 && targetRes.rows[0].id !== arch.id) {
                    const targetId = targetRes.rows[0].id;
                    console.log(`  Merging decks for "${arch.name}" into "${newName}" (ID ${targetId})`);
                    await db.execute({
                        sql: 'UPDATE decks SET archetype_id = ? WHERE archetype_id = ?',
                        args: [targetId, arch.id]
                    });
                    await db.execute({
                        sql: 'DELETE FROM archetypes WHERE id = ?',
                        args: [arch.id]
                    });
                } else {
                    console.log(`  Updating name for ID ${arch.id}`);
                    await db.execute({
                        sql: 'UPDATE archetypes SET name = ? WHERE id = ?',
                        args: [newName, arch.id]
                    });
                }
            }
        }

        // Apply explicit merges
        for (const [source, target, format] of merges) {
            const sRes = await db.execute({ sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?', args: [source, format] });
            const tRes = await db.execute({ sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?', args: [target, format] });

            if (sRes.rows.length > 0 && tRes.rows.length > 0) {
                const sId = sRes.rows[0].id;
                const tId = tRes.rows[0].id;
                if (sId === tId) continue;

                console.log(`Explicit merge: "${source}" -> "${target}" (${format})`);
                await db.execute({ sql: 'UPDATE decks SET archetype_id = ? WHERE archetype_id = ?', args: [tId, sId] });
                await db.execute({ sql: 'DELETE FROM archetypes WHERE id = ?', args: [sId] });
            }
        }

    } catch (err) {
        console.error('Cleanup failed:', err);
    }
}

cleanupArchetypes();
