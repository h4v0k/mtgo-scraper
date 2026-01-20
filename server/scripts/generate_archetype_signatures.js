const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Configuration
const FORMATS = [
    { code: 'modern', name: 'Modern' },
    { code: 'pioneer', name: 'Pioneer' },
    { code: 'legacy', name: 'Legacy' },
    { code: 'pauper', name: 'Pauper' }
];

const BASE_URL = 'https://www.mtggoldfish.com';
const TAGS_DIR = path.resolve(__dirname, '../tags');

// Helper for delays
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeArchetypeSignatures(formatCode, formatName) {
    console.log(`\n--- Scraping ${formatName} (${formatCode}) ---`);
    const signatures = [];

    try {
        // 1. Get Metagame Page (Full)
        const metaUrl = `${BASE_URL}/metagame/${formatCode}/full#paper`;
        console.log(`Fetching metagame: ${metaUrl}`);
        const { data: metaHtml } = await axios.get(metaUrl);
        const $ = cheerio.load(metaHtml);

        // 2. Extract Archetypes
        const archetypeLinks = [];
        $('.archetype-tile').each((i, el) => {
            let title = $(el).find('.archetype-tile-title').text().trim();
            // Clean title
            if (title.includes('\n')) {
                title = title.split('\n')[0].trim();
            }
            const href = $(el).find('.card-image-tile-link-overlay').attr('href');
            if (title && href) {
                archetypeLinks.push({ title, href: BASE_URL + href });
            }
        });

        console.log(`Found ${archetypeLinks.length} archetypes.`);

        // 3. Process each archetype
        for (const arch of archetypeLinks) {
            console.log(`  Processing ${arch.title}...`);
            await delay(1500); // Politeness delay

            try {
                const { data: archHtml } = await axios.get(arch.href);
                const $a = cheerio.load(archHtml);

                const signatureCards = [];
                const processedCards = new Set();

                // 4. Find Key Cards
                $a('.spoiler-card').each((j, cardEl) => {
                    // Check Category (Grandparent/Parent container text usually starts with the Header)
                    const containerText = $a(cardEl).closest('.spoiler-card-container').text().trim();
                    if (containerText.startsWith('Lands') || containerText.startsWith('Sideboard')) {
                        return; // Skip Lands and Sideboard
                    }

                    const text = $a(cardEl).text();
                    // Regex: (\d+(?:\.\d+)?) in (\d+)% of decks
                    const match = text.match(/(\d+(?:\.\d+)?) in (\d+)% of decks/);

                    if (match) {
                        const freq = parseInt(match[2], 10);

                        // Formatting: Prioritize IMG ALT
                        let cardName = $a(cardEl).find('img').attr('alt');

                        if (!cardName) {
                            cardName = $a(cardEl).find('.price-card-invisible-label').text().trim();
                        }

                        if (cardName) {
                            // Strip tags [SET], <variant>, (F)
                            cardName = cardName
                                .replace(/\s*\[.*?\]/g, '')
                                .replace(/\s*<.*?>/g, '')
                                .replace(/\s*\(.*?\)/g, '')
                                .trim();
                        }

                        if (cardName && !processedCards.has(cardName)) {
                            processedCards.add(cardName);
                            // Rule: Freq > 60% (High confidence core cards only)
                            if (freq >= 60) {
                                signatureCards.push(cardName);
                            }
                        }
                    }
                });

                if (signatureCards.length >= 4) {
                    // Start with high limit (60) to catch all core spells
                    const finalSig = signatureCards.slice(0, 60);

                    signatures.push({
                        name: arch.title,
                        signature: finalSig,
                        deckIds: [] // Placeholder
                    });
                }

            } catch (err) {
                console.error(`    Error scraping ${arch.title}: ${err.message}`);
            }
        }

    } catch (err) {
        console.error(`Error scraping metagame for ${formatName}: ${err.message}`);
    }

    return signatures;
}

async function run() {
    console.log("Starting MTGGoldfish Signature Generator (No Lands/SB, >60% Freq)...");

    for (const fmt of FORMATS) {
        const sigs = await scrapeArchetypeSignatures(fmt.code, fmt.name);

        if (sigs.length > 0) {
            const filePath = path.join(TAGS_DIR, `${fmt.name}_signatures.json`);
            console.log(`Saving ${sigs.length} signatures to ${filePath}`);
            fs.writeFileSync(filePath, JSON.stringify(sigs, null, 2));
        } else {
            console.warn(`No signatures found for ${fmt.name}.`);
        }
    }

    console.log("Done.");
}

run();
