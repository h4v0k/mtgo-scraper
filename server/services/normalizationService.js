const { db } = require('../db');
const { normalizeArchetypeNames } = require('./aiService');

async function runNormalizationJob() {
    console.log('Starting Archetype Normalization Job...');

    // Iterate over each format
    const formatsRes = await db.execute('SELECT DISTINCT format FROM archetypes');
    const formats = formatsRes.rows.map(f => f.format);

    for (const format of formats) {
        console.log(`\n--- Normalizing ${format} Archetypes ---`);

        // 1. Fetch all distinct archetype names for this format
        const archRes = await db.execute({
            sql: 'SELECT id, name FROM archetypes WHERE format = ?',
            args: [format]
        });
        const names = archRes.rows.map(a => a.name);

        if (names.length === 0) continue;

        // 2. Batch process
        const CHUNK_SIZE = 50;
        for (let i = 0; i < names.length; i += CHUNK_SIZE) {
            const chunk = names.slice(i, i + CHUNK_SIZE);

            // Pass format to AI for context (requires update to aiService signature if not already present, 
            // but here we just pass names. The AI prompt should ideally know the format, but for simple name normalization 
            // "Boros Aggro" -> "Boros Energy" is often format-agnostic or we can just hope context implies it. 
            // Better: update prompt to include format.)

            const mapping = await normalizeArchetypeNames(chunk, format);

            // 3. Apply updates
            // 3. Apply updates
            // Transaction removed for HTTP compatibility
            for (const [oldName, newName] of Object.entries(mapping)) {
                if (oldName === newName) continue;
                if (!newName || newName === 'Unknown') continue;

                console.log(`[${format}] Normalizing: "${oldName}" -> "${newName}"`);

                // Check if target archetype exists IN THIS FORMAT
                let targetArch = null;
                const targetArchRes = await db.execute({
                    sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                    args: [newName, format]
                });
                if (targetArchRes.rows.length > 0) targetArch = targetArchRes.rows[0];

                if (!targetArch) {
                    // Create new canonical archetype in the correct format
                    try {
                        const infoRes = await db.execute({
                            sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                            args: [newName, format]
                        });
                        if (infoRes.rows.length > 0) targetArch = { id: infoRes.rows[0].id };
                        else targetArch = { id: infoRes.lastInsertRowid.toString() };
                    } catch (e) {
                        // Fallback check
                        const retryRes = await db.execute({
                            sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                            args: [newName, format]
                        });
                        if (retryRes.rows.length > 0) targetArch = retryRes.rows[0];
                    }
                }

                // Get old ID
                let oldArch = null;
                const oldArchRes = await db.execute({
                    sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                    args: [oldName, format]
                });
                if (oldArchRes.rows.length > 0) oldArch = oldArchRes.rows[0];

                if (!oldArch || !targetArch || oldArch.id === targetArch.id) continue;

                // Move Decks
                const result = await db.execute({
                    sql: 'UPDATE decks SET archetype_id = ? WHERE archetype_id = ?',
                    args: [targetArch.id, oldArch.id]
                });

                if (result.rowsAffected > 0) {
                    console.log(`  Moved ${result.rowsAffected} decks.`);
                    // Delete old archetype if empty
                    const countRes = await db.execute({
                        sql: 'SELECT count(*) as c FROM decks WHERE archetype_id = ?',
                        args: [oldArch.id]
                    });
                    // check result.rows[0].c or result.rows[0]['count(*)'] depending on driver? 
                    // safer to alias in SQL if possible, or assume 'c' works
                    const remaining = countRes.rows[0].c;

                    if (remaining === 0) {
                        await db.execute({
                            sql: 'DELETE FROM archetypes WHERE id = ?',
                            args: [oldArch.id]
                        });
                    }
                }
            }

            // Rate limit pause
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    console.log('Normalization Job Complete.');
}



module.exports = { runNormalizationJob };
