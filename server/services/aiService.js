const { GoogleGenerativeAI } = require("@google/generative-ai");
const { db } = require('../db');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Classifies a decklist into an archetype using Gemini.
 * @param {string} format - The format (e.g. Modern, Pioneer)
 * @param {string} decklist - The text representation of the deck
 * @returns {Promise<string>} - The archetype name
 */
async function classifyDeck(format, decklist) {
    if (!process.env.GEMINI_API_KEY) {
        console.warn("No GEMINI_API_KEY provided. Returning 'Unknown Archetype'.");
        return "Unknown Archetype";
    }

    const prompt = `
    You are an expert Magic: The Gathering meta analyst for the **Winter 2025/2026 Season**.
    Classify this ${format} deck based on these key cards into a single competitive archetype name (e.g. "Boros Energy", "Dimir Midrange").
    Return ONLY the name.
    
    Cards:
    ${decklist}
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text.trim();
    } catch (error) {
        console.error("Error classifying deck with Gemini:", error);
        return "Unclassified";
    }
}

/**
 * Clusters a batch of decks into archetypes and identifies defining cards.
 * @param {Array<{id: number, list: string}>} decks - Array of deck objects
 * @param {string} format - Format name
 * @returns {Promise<Array<{name: string, signature: string[], deckIds: number[]}>>}
 */
async function clusterDecks(decks, format) {
    if (!process.env.GEMINI_API_KEY) return [];

    // Prepare input for AI
    const inputData = decks.map(d => `ID: ${d.id}\nList:\n${d.list}`).join('\n\n');

    const prompt = `
    You are an expert MTG Analyst for the **Winter 2025/2026 Season**.
    I have a list of ${format} decks (ID and Card List).
    
    Task:
    1. Group these decks into distinct competitive Archetypes.
    2. For each Archetype, identify the **8-10 defining cards** (Signature) that distinguish it from others.
    3. Be precise with split archetypes (e.g. "Izzet Otters" vs "Izzet Control" vs "Simic Quantum").
    
    Input Decks:
    ${inputData}
    
    Response Format (JSON Array ONLY):
    [
      {
        "name": "Izzet Otters",
        "signature": ["Quantum Riddler", "Thundertrap Trainer", "Spirebluff Canal", "Stormchaser's Talent", ...],
        "deckIds": [101, 105, 203]
      },
      ...
    ]
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Error clustering decks:", error);
        return [];
    }
}

/**
 * Checks if a deck matches an existing archetype within a card distance threshold.
 * If match found, returns that archetype name.
 * If not, calls AI to classify and saves the new archetype if needed.
 */
async function identifyArchetype(format, decklist, cardMap) {
    // 1. Heuristic Check (Optimization)
    // TODO: Implement "distance" check against known decks in DB to save API calls.
    // For now, we'll just check if we have a very similar deck (exact match on key cards?)
    // This is a placeholder for the "within ~10 cards" logic.

    // 2. AI Fallback
    const archetype = await classifyDeck(format, decklist);

    // 3. Ensure Archetype exists in DB
    try {
        await db.execute({
            sql: 'INSERT OR IGNORE INTO archetypes (name, format) VALUES (?, ?)',
            args: [archetype, format]
        });
        const rowRes = await db.execute({
            sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
            args: [archetype, format]
        });
        if (rowRes.rows.length > 0) return rowRes.rows[0].id;
        return null; // Should not happen if insert works
    } catch (err) {
        console.error("Database error saving archetype:", err);
        return null; // Handle error
    }
}

/**
 * Batches a list of archetype names and asks Gemini to normalize them to their canonical Modern names.
 * @param {string[]} names - Array of archetype names to normalize
 * @returns {Promise<Object>} - Object mapping { "Old Name": "Canonical Name" }
 */
async function normalizeArchetypeNames(names, format = 'Modern') {
    if (!process.env.GEMINI_API_KEY) return {};
    if (names.length === 0) return {};

    const prompt = `
    You are an expert Magic: The Gathering meta analyst.
    I have a list of raw deck names extracted from ${format} tournament reports. Many are duplicates or ambiguous.
    
    Your task is to Normalize these names to the established Tier 1/2 ${format} meta name.
    
    Rules:
    1. Standardize names (e.g. "UB Control" -> "Dimir Control").
    2. If a specific variant is popular in ${format}, use that name (e.g. "Boros Energy" vs "Boros Aggro").
    3. Keep "Unknown" as "Unknown".
    4. Return a JSON object where keys are the input names and values are the canonical names.
    5. ONLY return the map.
    
    Input Names:
    ${JSON.stringify(names)}
    
    Response Format (JSON ONLY):
    {
      "Boros Aggro": "Boros Energy",
      "Ruby Storm": "Ruby Storm"
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean markdown code blocks if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(text);
    } catch (error) {
        console.error("Error normalizing names with Gemini:", error);
        return {};
    }
}

/**
 * Resolves a batch of "Unknown" decks by asking Gemini to classify them based on their core cards.
 * @param {number} batchSize - Number of decks to process
 */
async function resolveUnknownArchetypes(batchSize = 20) {
    if (!process.env.GEMINI_API_KEY) return;

    // Get ALL 'Unknown' archetype IDs (one per format potentially)
    const unknownArchsRes = await db.execute({
        sql: 'SELECT id, format FROM archetypes WHERE name = ?',
        args: ['Unknown']
    });
    const unknownArchs = unknownArchsRes.rows;
    if (unknownArchs.length === 0) return;

    for (const unknownArch of unknownArchs) {
        console.log(`\n--- Resolving Unknowns for ${unknownArch.format} ---`);

        // Fetch Unknown Decks for this format specific ID
        const decksRes = await db.execute({
            sql: 'SELECT id, raw_decklist, format FROM decks WHERE archetype_id = ? LIMIT ?',
            args: [unknownArch.id, batchSize]
        });
        const decks = decksRes.rows;

        if (decks.length === 0) continue;

        console.log(`AI Resolving ${decks.length} Unknown decks for ${unknownArch.format}...`);

        const IGNORED_CARDS = [
            'Plains', 'Island', 'Swamp', 'Mountain', 'Forest',
            'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
            'Snow-Covered Mountain', 'Snow-Covered Forest',
            'Wastes'
        ];

        for (const deck of decks) {
            // Optimization: Filter chaff and take top 25 lines to save tokens
            const compressedList = deck.raw_decklist.split('\n')
                .filter(line => !IGNORED_CARDS.some(land => line.includes(land)))
                .slice(0, 25)
                .join('\n');

            const archetype = await classifyDeck(deck.format, compressedList);

            if (archetype && archetype !== 'Unknown Archetype' && archetype !== 'Unclassified') {
                console.log(`  Identified Deck ${deck.id} as: ${archetype}`);

                // Ensure Archetype Exists
                try {
                    // Check exact match first
                    let archRow = null;
                    const archRes = await db.execute({
                        sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                        args: [archetype, deck.format]
                    });
                    if (archRes.rows.length > 0) archRow = archRes.rows[0];

                    if (!archRow) {
                        // Create it
                        const infoRes = await db.execute({
                            sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                            args: [archetype, deck.format]
                        });
                        if (infoRes.rows.length > 0) archRow = { id: infoRes.rows[0].id };
                        else archRow = { id: infoRes.lastInsertRowid.toString() };
                    }

                    // Update Deck
                    await db.execute({
                        sql: 'UPDATE decks SET archetype_id = ? WHERE id = ?',
                        args: [archRow.id, deck.id]
                    });

                } catch (err) {
                    console.error("  Error saving resolved archetype:", err.message);
                }
            }
            // Polite delay
            await new Promise(r => setTimeout(r, 1000));
        }
    }

}

module.exports = {
    identifyArchetype,
    normalizeArchetypeNames,
    resolveUnknownArchetypes,
    resolveUnknownArchetypes,
    classifyDeck,
    clusterDecks
};
