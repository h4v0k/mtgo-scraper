const { db } = require('../db');
const fs = require('fs');
const path = require('path');
const { getArchetypeForDeck } = require('./goldfishService');
const { calculateSpice } = require('./spice');

// Dynamically load signatures
function loadSignatures() {
    const signatures = {};
    const tagsDir = path.resolve(__dirname, '../tags');
    if (!fs.existsSync(tagsDir)) return signatures;

    const files = fs.readdirSync(tagsDir);
    for (const file of files) {
        if (file.endsWith('_signatures.json')) {
            const format = file.replace('_signatures.json', '');
            try {
                const data = fs.readFileSync(path.join(tagsDir, file), 'utf8');
                signatures[format] = JSON.parse(data);
            } catch (e) {
                console.error(`Error loading signatures for ${format}:`, e.message);
            }
        }
    }
    return signatures;
}

// Global signatures cache
let _signatures = null;
function getSignatures() {
    if (!_signatures) _signatures = loadSignatures();
    return _signatures;
}

const RULES = [
    { target: 'Boros Energy', required: ['Guide of Souls', 'Amped Raptor'] },
    { target: 'Boros Energy', required: ['Guide of Souls', 'Ocelot Pride'] },
    { target: 'Mardu Energy', required: ['Guide of Souls', 'Orcish Bowmasters'] },
    { target: 'Orzhov Blink', required: ['Ephemerate', 'Grief', 'Malakir Rebirth'] },
    { target: 'Orzhov Blink', required: ['Ephemerate', 'Grief', 'Orcish Bowmasters'] },
    { target: 'Esper Blink', required: ['Ephemerate', 'Grief', 'Teferi, Time Raveler'] },
    { target: 'Esper Blink', required: ['Ephemerate', 'Psychic Frog'] },
    { target: 'Ruby Storm', required: ['Ruby Medallion', 'Ral, Monsoon Mage'] },
    { target: 'Dimir Control', required: ['The One Ring', 'Sheoldred, the Apocalypse', 'Counterspell'] },
    { target: 'Eldrazi Tron', required: ['Urza\'s Tower', 'Eldrazi Temple', 'Devourer of Destiny'] },
    { target: 'Mono Green Tron', required: ['Urza\'s Tower', 'Chromatic Star', 'Karn, the Great Creator'] },
    { target: 'Living End', required: ['Living End', 'Violent Outburst'] },
    { target: 'Amulet Titan', required: ['Primeval Titan', 'Amulet of Vigor'] },
    { target: 'Dimir Belcher', required: ['Goblin Charbelcher', 'Tameshi, Reality Architect'] },
    { target: 'Gruul Eldrazi', required: ['Sowing Mycospawn', 'Devourer of Destiny'] },
    { target: 'Gruul Belcher', required: ['Goblin Charbelcher', 'Ironcrag Feat'] },
    { target: 'Affinity', required: ['Simulacrum Synthesizer', 'Thoughtcast'] },
    { target: 'Affinity', required: ['Pinnacle Emissary', 'Thoughtcast'] },
    { target: 'Neoform Combo', required: ['Allosaurus Rider', 'Neoform'] },
    { target: 'Mardu Energy', required: ['Guide of Souls', 'Orcish Bowmasters', 'Amped Raptor'] },
    { target: 'Orzhov Soultrader', required: ['Warren Soultrader', 'Gravecrawler'] },
    { target: 'Jeskai Control', required: ['Phlage, Titan of Fire\'s Fury', 'The One Ring', 'Counterspell'] },
    { target: 'Dimir Murktide', required: ['Murktide Regent', 'Psychic Frog'] },
    { target: 'Jeskai Energy', required: ['Guide of Souls', 'Phlage, Titan of Fire\'s Fury'] },
    { target: 'Jeskai Phelia', required: ['Phelia, Exuberant Shepherd', 'Ephemerate'] },
    { target: '5-Color Zoo', required: ['Territorial Kavu', 'Scion of Draco'] },
    { target: 'Asmo Food', required: ['The Underworld Cookbook', 'Asmoranomardicadaistinaculdacar'] },
    { target: 'Izzet Lessons', required: ['Firebending Lesson'] },
    { target: 'Izzet Looting', required: ['Thundertrap Trainer', 'Stormchaser\'s Talent'] },
    { target: 'Izzet Looting', required: ['Quantum Riddler', 'Spirebluff Canal'] },
    { target: 'Dimir Midrange', required: ['Kaito, Bane of Nightmares'] },
    { target: 'Superior Reanimator', required: ['Superior Spider-Man', 'Bringer of the Last Gift'] },
    { target: 'Superior Reanimator', required: ['Superior Spider-Man', 'Awaken the Honored Dead'] },
    { target: 'Superior Reanimator', required: ['Overlord of the Balemurk', 'Bringer of the Last Gift', 'Harvester of Misery'] },
    { target: 'Sultai Elemental Scam', required: ['Not Dead After All', 'Overlord of the Balemurk'] },
    { target: 'Sultai Elemental Scam', required: ['Not Dead After All', 'Wistfulness'] },
    { target: 'Naya Allies', required: ['Hada Freeblade', 'Kazandu Blademaster'] },
    { target: 'Naya Allies', required: ['Hada Freeblade', 'Oran-Rief Survivalist'] },
    { target: 'Naya Allies', required: ['Akoum Battlesinger', 'Hada Freeblade'] },
    { target: 'Naya Allies', required: ['Kabira Evangel', 'Hada Freeblade'] },
    { target: 'Naya Allies', required: ['Earthen Ally', 'Allies at Last'] },
    { target: 'Naya Allies', required: ['South Pole Voyager', 'Earthen Ally'] },
    { target: 'Izzet Lessons', required: ['Firebending Lesson'] },
    { target: 'Izzet Looting', required: ['Inti, Seneschal of the Sun', 'Professional Face-Breaker'] },
    { target: 'GX Landfall', required: ['Earthbender Ascension'] },
    { target: 'Kona Combo', required: ['Kona, Rescue Beastie', 'Breeding Pool'] },
    { target: 'Naya Yuna Enchantments', required: ['Yuna, Hope of Spira'] },
    { target: 'Naya Yuna Enchantments', required: ['Yuna, Hope of Spira', 'Sacred Foundry'] },
    { target: 'Jeskai Artifacts', required: ['Simulacrum Synthesizer', 'No More Lies'] },
    { target: 'Jeskai Artifacts', required: ['Simulacrum Synthesizer', 'Island'] },
    { target: 'Bant Airbending', required: ['Aang, Swift Savior'] },
    { target: 'Bant Airbending', required: ['Airbender Ascension'] },
    { target: 'Gruul Prowess', required: ['Emberheart Challenger', 'Dreadmaw\'s Ire'] }
];

function isGeneric(name) {
    if (!name || name === 'Unknown') return true;
    return /^[WUBRGCc]{1,5}$/.test(name) ||
        /^(Azorius|Boros|Dimir|Golgari|Gruul|Izzet|Orzhov|Rakdos|Selesnya|Simic)$/i.test(name);
}

/**
 * Classifies a deck based on contents and optional metadata.
 * @param {string} rawDecklist - The decklist string.
 * @param {string} format - Format of the deck.
 * @param {string} goldfishName - (Optional) Name provided by MTGGoldfish.
 * @returns {Promise<{name: string, score: number, method: string}>}
 */
async function classifyDeck(rawDecklist, format, goldfishName = null) {
    const list = rawDecklist || '';
    const signatures = getSignatures();
    const fmtSigs = signatures[format] || [];

    // 1. Fallback to Goldfish (if specific) - PRIORITIZED per user request
    if (goldfishName && !isGeneric(goldfishName)) {
        return { name: goldfishName, score: 0, method: 'Goldfish' };
    }

    // 2. High Confidence Match (>75%) - AI Classification
    let bestMatch = null;
    let maxScore = 0;
    for (const sig of fmtSigs) {
        let matchCount = 0;
        for (const card of sig.signature) {
            if (list.includes(card)) matchCount++;
        }
        const score = matchCount / sig.signature.length;
        if (score >= 0.75 && score > maxScore) {
            maxScore = score;
            bestMatch = sig.name;
        }
    }
    if (bestMatch) return { name: bestMatch, score: maxScore, method: 'HighConfAI' };

    // 3. Manual Rules
    for (const rule of RULES) {
        if (rule.required.every(card => list.includes(card))) {
            return { name: rule.target, score: 1.0, method: 'ManualRule' };
        }
    }

    // 4. Aggressive Match for Generics (>50%)
    bestMatch = null;
    maxScore = 0;
    for (const sig of fmtSigs) {
        let matchCount = 0;
        for (const card of sig.signature) {
            if (list.includes(card)) matchCount++;
        }
        const score = matchCount / sig.signature.length;
        if (score >= 0.50 && score > maxScore) {
            maxScore = score;
            bestMatch = sig.name;
        }
    }

    if (bestMatch) return { name: bestMatch, score: maxScore, method: 'AggressiveMatch' };

    return { name: goldfishName || 'Unknown', score: 0, method: 'Default' };
}

async function runHeuristicNormalization() {
    console.log('Starting Heuristic Normalization Job...');
    const signatures = getSignatures();

    // 1. Get all decks with their format (Async)
    let decks = [];
    try {
        const decksRes = await db.execute(`
            SELECT d.id, d.raw_decklist, d.sideboard, d.archetype_id, d.format, d.player_name, d.event_name, d.event_date, a.name as current_arch_name 
            FROM decks d
            LEFT JOIN archetypes a ON d.archetype_id = a.id
        `);
        decks = decksRes.rows;
    } catch (e) {
        console.error('Failed to fetch decks:', e);
        return;
    }

    const archCache = {};
    const getArchId = async (name, fmt) => {
        const key = `${name}|${fmt}`;
        if (archCache[key]) return archCache[key];

        const rowRes = await db.execute({
            sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
            args: [name, fmt]
        });

        if (rowRes.rows.length > 0) {
            archCache[key] = rowRes.rows[0].id;
            return rowRes.rows[0].id;
        }

        try {
            const infoRes = await db.execute({
                sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                args: [name, fmt]
            });
            const id = infoRes.rows[0].id;
            archCache[key] = id;
            return id;
        } catch (e) {
            const retryRes = await db.execute({
                sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                args: [name, fmt]
            });
            if (retryRes.rows.length > 0) {
                const id = retryRes.rows[0].id;
                archCache[key] = id;
                return id;
            }
            throw e;
        }
    };

    let batchMoved = 0;

    for (const deck of decks) {
        try {
            // Fetch Goldfish name if absolutely necessary (slow)? 
            // Actually, for historical records, we might already have a name.
            // If the name is generic, we trigger the Aggressive match inside classifyDeck.

            const result = await classifyDeck(deck.raw_decklist, deck.format, deck.current_arch_name);

            if (result.name !== deck.current_arch_name) {
                const targetId = await getArchId(result.name, deck.format);

                if (deck.archetype_id !== targetId) {
                    console.log(`[Heuristic] ${deck.current_arch_name} -> ${result.name} (${result.method})`);

                    // Recalculate Spice
                    let spiceCount = 0;
                    let spiceCards = '[]';
                    try {
                        const contextRes = await db.execute({
                            sql: `SELECT raw_decklist, sideboard FROM decks WHERE archetype_id = ? AND event_date >= date('now', '-60 days') LIMIT 50`,
                            args: [targetId]
                        });
                        const spiceRes = calculateSpice({ raw_decklist: deck.raw_decklist, sideboard: deck.sideboard }, contextRes.rows);
                        spiceCount = spiceRes.count;
                        spiceCards = JSON.stringify(spiceRes.cards);
                    } catch (e) { }

                    await db.execute({
                        sql: 'UPDATE decks SET archetype_id = ?, spice_count = ?, spice_cards = ? WHERE id = ?',
                        args: [targetId, spiceCount, spiceCards, deck.id]
                    });
                    batchMoved++;
                }
            }
        } catch (e) {
            console.error(`Error processing deck ${deck.id}:`, e);
        }
    }

    console.log(`Heuristic Job Complete. Normalized ${batchMoved} decks.`);

    // Cleanup empty archetypes
    try {
        const deleted = await db.execute(`
            DELETE FROM archetypes 
            WHERE id NOT IN (SELECT DISTINCT archetype_id FROM decks)
        `);
        if (deleted.rowsAffected > 0) {
            console.log(`Crimped ${deleted.rowsAffected} empty archetypes.`);
        }
    } catch (e) {
        console.error('Cleanup error:', e);
    }
}

module.exports = { runHeuristicNormalization, classifyDeck, isGeneric };
