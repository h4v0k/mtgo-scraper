const { runHeuristicNormalization } = require('./services/heuristicService');
const db = require('./db');

(async () => {
    try {
        console.log("--- Starting Database Cleanup (Round 4: Heuristics) ---");
        await runHeuristicNormalization();

        // Report
        const report = db.prepare(`
            SELECT name, count(*) as c 
            FROM decks JOIN archetypes ON decks.archetype_id = archetypes.id 
            WHERE name IN ('Jeskai Energy', 'Jeskai Phelia', 'Death And Taxes')
            GROUP BY name
        `).all();
        console.table(report);

    } catch (e) {
        console.error(e);
    }
})();
