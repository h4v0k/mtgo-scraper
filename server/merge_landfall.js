// Load production env
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.production') });
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function mergeArchetypes() {
    console.log("Merging Selesnya Landfall -> GX Landfall...");

    try {
        // Get IDs
        const gxRes = await db.execute("SELECT id FROM archetypes WHERE name = 'GX Landfall' AND format = 'Standard'");
        const selesnyaRes = await db.execute("SELECT id FROM archetypes WHERE name = 'Selesnya Landfall' AND format = 'Standard'");

        if (gxRes.rows.length === 0) {
            console.log("'GX Landfall' not found. Creating...");
            // If it was missing (weird given the error), handle it, but the error said it existed.
            // Maybe it exists in another format?
            // The constraint error was UNIQUE(name, format). So it must exist in Standard or whichever format 'Selesnya Landfall' is in.
            // Let's assume Standard for now based on context.
            return;
        }

        const gxId = gxRes.rows[0].id;

        if (selesnyaRes.rows.length === 0) {
            console.log("'Selesnya Landfall' not found. Nothing to merge.");
            return;
        }
        const selesnyaId = selesnyaRes.rows[0].id;

        // Move Decks
        console.log(`Moving decks from ${selesnyaId} to ${gxId}...`);
        const result = await db.execute({
            sql: "UPDATE decks SET archetype_id = ? WHERE archetype_id = ?",
            args: [gxId, selesnyaId]
        });
        console.log(`vMoved ${result.rowsAffected} decks.`);

        // Delete Old
        console.log(`Deleting archetype ${selesnyaId}...`);
        await db.execute({
            sql: "DELETE FROM archetypes WHERE id = ?",
            args: [selesnyaId]
        });
        console.log("Done.");

    } catch (e) {
        console.error("Merge failed:", e);
    }
}

mergeArchetypes();
