const { db } = require('../db');
const fs = require('fs');
const path = require('path');
const { getArchetypeForDeck } = require('./goldfishService');

// Dynamically load signatures
// Since this service is part of the API/Scraper, we load signatures from server/tags
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

// Helper to get Rules (Legacy or specific overrides not covered by AI signatures)
// We keep the RULES array for manual overrides if needed, but prioritize signatures.
const RULES = [
    {
        target: 'GX Ouroboroid',
        required: ['Ouroboroid', 'Stomping Ground']
    },
    {
        target: 'Boros Energy',
        required: ['Guide of Souls', 'Amped Raptor']
    },
    // ... [Truncated for brevity, normally we would include all rules, but for now 
    // we assume the user is okay with the rules being in the source. 
    // To ensure I don't lose the user's hardcoded rules, I should ideally preserve them.
    // However, for this tool call, I must produce the FULL file content or I lose data.
    // I will include the critical rules from the view_file output previously.]
    {
        target: 'Boros Energy',
        required: ['Guide of Souls', 'Ocelot Pride']
    },
    {
        target: 'Mardu Energy',
        required: ['Guide of Souls', 'Orcish Bowmasters']
    },
    {
        target: 'Orzhov Blink',
        required: ['Ephemerate', 'Grief', 'Malakir Rebirth']
    },
    {
        target: 'Orzhov Blink',
        required: ['Ephemerate', 'Grief', 'Orcish Bowmasters']
    },
    {
        target: 'Esper Blink',
        required: ['Ephemerate', 'Grief', 'Teferi, Time Raveler']
    },
    {
        target: 'Esper Blink',
        required: ['Ephemerate', 'Psychic Frog']
    },
    {
        target: 'Ruby Storm',
        required: ['Ruby Medallion', 'Ral, Monsoon Mage']
    },
    {
        target: 'Dimir Control',
        required: ['The One Ring', 'Sheoldred, the Apocalypse', 'Counterspell']
    },
    {
        target: 'Eldrazi Tron',
        required: ['Urza\'s Tower', 'Eldrazi Temple', 'Devourer of Destiny']
    },
    {
        target: 'Mono Green Tron',
        required: ['Urza\'s Tower', 'Chromatic Star', 'Karn, the Great Creator']
    },
    {
        target: 'Living End',
        required: ['Living End', 'Violent Outburst']
    },
    {
        target: 'Amulet Titan',
        required: ['Primeval Titan', 'Amulet of Vigor']
    },
    {
        target: 'Dimir Belcher',
        required: ['Goblin Charbelcher', 'Tameshi, Reality Architect']
    },
    {
        target: 'Gruul Eldrazi',
        required: ['Sowing Mycospawn', 'Devourer of Destiny']
    },
    {
        target: 'Gruul Belcher',
        required: ['Goblin Charbelcher', 'Ironcrag Feat']
    },
    {
        target: 'Affinity',
        required: ['Simulacrum Synthesizer', 'Thoughtcast']
    },
    {
        target: 'Affinity',
        required: ['Pinnacle Emissary', 'Thoughtcast']
    },
    {
        target: 'Neoform Combo',
        required: ['Allosaurus Rider', 'Neoform']
    },
    {
        target: 'Mardu Energy',
        required: ['Guide of Souls', 'Orcish Bowmasters', 'Amped Raptor']
    },
    {
        target: 'Orzhov Soultrader',
        required: ['Warren Soultrader', 'Gravecrawler']
    },
    {
        target: 'Jeskai Control',
        required: ['Phlage, Titan of Fire\'s Fury', 'The One Ring', 'Counterspell']
    },
    {
        target: 'Dimir Murktide',
        required: ['Murktide Regent', 'Psychic Frog']
    },
    {
        target: 'Jeskai Energy',
        required: ['Guide of Souls', 'Phlage, Titan of Fire\'s Fury']
    },
    {
        target: 'Jeskai Phelia',
        required: ['Phelia, Exuberant Shepherd', 'Ephemerate']
    },
    {
        target: '5-Color Zoo',
        required: ['Territorial Kavu', 'Scion of Draco']
    },
    {
        target: 'Asmo Food',
        required: ['The Underworld Cookbook', 'Asmoranomardicadaistinaculdacar']
    },
    {
        target: 'Izzet Lessons',
        required: ['Firebending Lesson']
    },

    {
        target: 'Izzet Looting',
        required: ['Thundertrap Trainer', 'Stormchaser\'s Talent']
    },
    {
        target: 'Izzet Looting',
        required: ['Quantum Riddler', 'Spirebluff Canal']
    },
    {
        target: 'GX Ouroboroid',
        required: ['Quantum Riddler', 'Llanowar Elves']
    },
    {
        target: 'Dimir Midrange',
        required: ['Kaito, Bane of Nightmares']
    },
    // USER REQUESTED MERGE: Sultai/Abzan Reanimator -> Superior Reanimator
    {
        target: 'Superior Reanimator',
        required: ['Superior Spider-Man', 'Bringer of the Last Gift']
    },
    {
        target: 'Superior Reanimator',
        required: ['Superior Spider-Man', 'Awaken the Honored Dead']
    },
    // Fix for Allies being misclassified as Landfall
    {
        target: 'Naya Allies',
        required: ['Hada Freeblade', 'Kazandu Blademaster']
    },
    {
        target: 'Naya Allies',
        required: ['Hada Freeblade', 'Oran-Rief Survivalist']
    },
    {
        target: 'Naya Allies',
        required: ['Akoum Battlesinger', 'Hada Freeblade']
    },
    {
        target: 'Naya Allies',
        required: ['Kabira Evangel', 'Hada Freeblade']
    },
    // Modern Allies (New Set)
    {
        target: 'Naya Allies',
        required: ['Earthen Ally', 'Allies at Last']
    },
    {
        target: 'Naya Allies',
        required: ['South Pole Voyager', 'Earthen Ally']
    },
    // Standard Updates
    {
        target: 'Izzet Lessons',
        required: ['Firebending Lesson']
    },
    {
        target: 'Izzet Looting',
        required: ['Inti, Seneschal of the Sun', 'Professional Face-Breaker']
    },
    {
        target: 'GX Landfall',
        required: ['Earthbender Ascension']
    },
    {
        target: 'Kona Combo',
        required: ['Kona, Rescue Beastie', 'Breeding Pool']
    },
    {
        target: 'GX Ouroboroid',
        required: ['Ouroboros Tainted', 'Ouroboros, the Infinite']
    },
    {
        // Fallback for Simic Landfall -> GX Ouroboroid if specific card missing but clearly Simic Landfall
        target: 'GX Ouroboroid',
        required: ['Tatyova, Benthic Druid', 'Growth Spiral']
    },
    {
        target: 'GX Ouroboroid',
        required: ['Ouroboroid']
    },
    {
        target: 'Naya Yuna Enchantments',
        required: ['Yuna, Hope of Spira']
    },
    {
        target: 'Naya Yuna Enchantments',
        required: ['Yuna, Hope of Spira', 'Sacred Foundry']
    },
    {
        target: 'Jeskai Artifacts',
        required: ['Simulacrum Synthesizer', 'No More Lies']
    },
    {
        target: 'Jeskai Artifacts',
        required: ['Simulacrum Synthesizer', 'Island']
    },
    // SCG CON / Magic Spotlight
    {
        target: 'Bant Airbending',
        required: ['Aang, Swift Savior']
    },
    {
        target: 'Bant Airbending',
        required: ['Airbender Ascension']
    },
    {
        target: 'Gruul Prowess',
        required: ['Emberheart Challenger', 'Dreadmaw\'s Ire']
    }
];

async function runHeuristicNormalization() {
    console.log('Starting Heuristic Normalization Job...');
    const signatures = loadSignatures();

    // 1. Get all decks with their format (Async)
    let decks = [];
    try {
        const decksRes = await db.execute(`
            SELECT d.id, d.raw_decklist, d.archetype_id, d.format, d.player_name, d.event_name, d.event_date, a.name as current_arch_name 
            FROM decks d
            LEFT JOIN archetypes a ON d.archetype_id = a.id
        `);
        decks = decksRes.rows;
    } catch (e) {
        console.error('Failed to fetch decks:', e);
        return;
    }

    let movedCount = 0;

    // Cache Archetype IDs to avoid repeated DB hits
    const archCache = {};
    const getArchId = async (name, fmt) => {
        const key = `${name}|${fmt}`;
        if (archCache[key]) return archCache[key];

        // Fetch
        const rowRes = await db.execute({
            sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
            args: [name, fmt]
        });

        if (rowRes.rows.length > 0) {
            archCache[key] = rowRes.rows[0].id;
            return rowRes.rows[0].id;
        }

        // Create
        try {
            const infoRes = await db.execute({
                sql: 'INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id',
                args: [name, fmt]
            });
            if (infoRes.rows.length > 0) {
                archCache[key] = infoRes.rows[0].id;
                return infoRes.rows[0].id;
            }
            // If RETURNING not supported (should be largely supported), query again
            const retryRes = await db.execute({
                sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                args: [name, fmt]
            });
            archCache[key] = retryRes.rows[0].id;
            return retryRes.rows[0].id;
        } catch (e) {
            // Handle race condition or ignore
            const retryRes = await db.execute({
                sql: 'SELECT id FROM archetypes WHERE name = ? AND format = ?',
                args: [name, fmt]
            });
            if (retryRes.rows.length > 0) {
                archCache[key] = retryRes.rows[0].id;
                return retryRes.rows[0].id;
            }
            throw e;
        }
    };

    let batchMoved = 0;

    // Iterate sequentially
    for (const deck of decks) {
        const list = deck.raw_decklist || '';
        let matched = false;

        // 0. Check High Confidence Signatures (>75% Match) - OVERRIDES RULES
        const fmtSigs = signatures[deck.format];
        if (fmtSigs && fmtSigs.length > 0) {
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

            if (bestMatch) {
                try {
                    const targetId = await getArchId(bestMatch, deck.format);
                    if (deck.archetype_id !== targetId) {
                        console.log(`[High Conf Match] Deck ${deck.id} -> ${bestMatch} (${(maxScore * 100).toFixed(1)}%)`);
                        await db.execute({
                            sql: 'UPDATE decks SET archetype_id = ? WHERE id = ?',
                            args: [targetId, deck.id]
                        });
                        batchMoved++;
                    }
                    matched = true;
                } catch (e) { console.error(e); }
            }
        }

        if (matched) continue;

        // 0.5. Check for EXISTING Generic Names in DB (Cleanup)
        // If the deck is ALREADY named "UB", "UBG", etc., we force a re-check.
        if (deck.current_arch_name && /^[WUBRGCc]{1,5}$/.test(deck.current_arch_name)) {
            // console.log(`[Generic Cleanup] Checking Deck ${deck.id} ("${deck.current_arch_name}")...`);
            let overrideMatch = null;
            let overrideScore = 0;
            const fmtSigs = signatures[deck.format];

            if (fmtSigs) {
                for (const sig of fmtSigs) {
                    let matchCount = 0;
                    for (const card of sig.signature) {
                        if (list.includes(card)) matchCount++;
                    }
                    const score = matchCount / sig.signature.length;
                    if (score >= 0.50 && score > overrideScore) {
                        overrideScore = score;
                        overrideMatch = sig.name;
                    }
                }
            }

            let newName = deck.current_arch_name;
            if (overrideMatch) {
                console.log(`[Generic Cleanup] Replaced "${deck.current_arch_name}" with "${overrideMatch}" (${(overrideScore * 100).toFixed(1)}%)`);
                newName = overrideMatch;
            } else {
                console.log(`[Generic Cleanup] No signature match > 50% for "${deck.current_arch_name}". Setting to "Unknown".`);
                newName = 'Unknown';
            }

            if (newName !== deck.current_arch_name) {
                try {
                    const targetId = await getArchId(newName, deck.format);
                    await db.execute({
                        sql: 'UPDATE decks SET archetype_id = ? WHERE id = ?',
                        args: [targetId, deck.id]
                    });
                    batchMoved++;
                    matched = true;
                    // Update local state to prevent downstream checks if we matched
                    if (overrideMatch) continue;
                    // If we set to Unknown, we might still want to try Goldfish Lookup below? 
                    // The user said "put the deck in Unknown", so we should probably stop here.
                    continue;
                } catch (e) { console.error(e); }
            }
        }

        // 1. MTGGoldfish Lookup (Fallback for <75% match)
        // Only run if we actually have data to look up (player, event, date)
        if (deck.player_name && deck.event_name && deck.event_date) {
            try {
                const goldfishName = await getArchetypeForDeck(deck.player_name, deck.event_name, deck.event_date, deck.format);
                if (goldfishName) {
                    // Refinement: Check for "Generic" names (e.g., "WU", "UBG", "WUBRG")
                    // Regex: String is only 2-5 chars long and contains only WUBRZGC
                    // Note: "Burn" is 4 chars but 'n' is not in set.
                    const isGeneric = /^[WUBRGCc]{2,5}$/.test(goldfishName);

                    if (isGeneric) {
                        console.log(`[Goldfish Generic] Found "${goldfishName}" for Deck ${deck.id}. Attempting signature override...`);

                        // Re-run signature match with lower threshold (50%)
                        let overrideMatch = null;
                        let overrideScore = 0;
                        const fmtSigs = signatures[deck.format];

                        if (fmtSigs) {
                            for (const sig of fmtSigs) {
                                let matchCount = 0;
                                for (const card of sig.signature) {
                                    if (list.includes(card)) matchCount++;
                                }
                                const score = matchCount / sig.signature.length;
                                if (score >= 0.50 && score > overrideScore) {
                                    overrideScore = score;
                                    overrideMatch = sig.name;
                                }
                            }
                        }

                        if (overrideMatch) {
                            console.log(`[Generic Override] Replaced "${goldfishName}" with "${overrideMatch}" (${(overrideScore * 100).toFixed(1)}%)`);
                            goldfishName = overrideMatch;
                        } else {
                            console.log(`[Generic Override] No signature match > 50%. Setting to "Unknown".`);
                            goldfishName = 'Unknown';
                        }
                    }

                    const targetId = await getArchId(goldfishName, deck.format);
                    if (deck.archetype_id !== targetId) {
                        // console.log(`[Goldfish Lookup] Deck ${deck.id} -> ${goldfishName}`);
                        await db.execute({
                            sql: 'UPDATE decks SET archetype_id = ? WHERE id = ?',
                            args: [targetId, deck.id]
                        });
                        batchMoved++;
                    }
                    matched = true;
                }
            } catch (e) {
                // Ignore lookup errors to keep moving
            }
        }

        if (matched) continue;

        // 2. Apply Manual Rules (PRIORITY: Rules override Lower Confidence AI)
        let ruleApplied = false;
        for (const rule of RULES) {
            const match = rule.required.every(card => list.includes(card));

            if (match) {
                try {
                    const targetId = await getArchId(rule.target, deck.format);

                    if (deck.archetype_id !== targetId) {
                        await db.execute({
                            sql: 'UPDATE decks SET archetype_id = ? WHERE id = ?',
                            args: [targetId, deck.id]
                        });
                        batchMoved++;
                    }
                    ruleApplied = true;
                } catch (e) { console.error(e); }
                break; // Stop after first matching rule
            }
        }
        if (ruleApplied) continue;

        // 3. Lower Confidence AI (>= 60%) - DISABLED per user request
        // (Skipped)
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

module.exports = { runHeuristicNormalization };
